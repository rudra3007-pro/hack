import express from 'express';
import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import { fileURLToPath } from 'url';
import { TRANSIT_STOPS } from './src/data/cityNetwork.ts';
import {
  buildHistoricalAnalyticsResponse,
  buildLiveBusesResponse,
  buildTrafficSegmentsResponse,
  buildTravelTimeResponse,
} from './src/engine/trafficModel.ts';
import type { HistoricalRangeId, StreamStatus, TimeBucketId } from './src/types/transit.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VALID_BUCKETS = new Set<TimeBucketId>([
  'live',
  '9am_peak',
  '2pm_offpeak',
  '6pm_rush',
]);

function parseTimeBucket(raw: unknown): TimeBucketId {
  if (typeof raw === 'string' && VALID_BUCKETS.has(raw as TimeBucketId)) {
    return raw as TimeBucketId;
  }
  return 'live';
}

function parseDepartAt(raw: unknown): string {
  if (typeof raw !== 'string') return 'now';
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === 'now') return 'now';
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
    return trimmed.slice(0, 5);
  }
  return 'now';
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '64kb' }));

  // In-memory live GPS telemetry stream state
  let serverTick = 16;
  let globalStreamStatus: StreamStatus = 'active';

  const simTimer = setInterval(() => {
    if (globalStreamStatus === 'active') {
      serverTick += 1;
    }
  }, 2000);
  simTimer.unref();

  // Health & stream control
  app.post('/api/v1/stream/control', (req, res) => {
    const status = req.body?.status;
    if (status !== 'active' && status !== 'paused') {
      return res.status(400).json({
        status: 'error',
        error: 'Invalid stream status. Expected "active" or "paused".',
      });
    }
    globalStreamStatus = status;
    return res.json({
      status: 'ok',
      stream_status: globalStreamStatus,
      tick: serverTick,
    });
  });

  // 1. Travel-Time & Journey Planner REST Endpoint
  app.get('/api/v1/travel-time', (req, res) => {
    const t0 = performance.now();
    const originRaw = typeof req.query.origin === 'string' ? req.query.origin.slice(0, 80) : '';
    const destRaw =
      typeof req.query.destination === 'string' ? req.query.destination.slice(0, 80) : '';

    if (!originRaw || !destRaw) {
      return res.status(400).json({
        status: 'error',
        error: 'Missing required query parameters: origin and destination.',
      });
    }

    const timeBucket = parseTimeBucket(req.query.time_bucket);
    const departAt = parseDepartAt(req.query.depart_at);
    const elapsedMs = Math.max(1, Math.round(performance.now() - t0 + 6));

    const payload = buildTravelTimeResponse(
      originRaw,
      destRaw,
      timeBucket,
      departAt,
      serverTick,
      elapsedMs
    );

    if (!payload) {
      return res.status(400).json({
        status: 'error',
        error:
          'Invalid origin or destination. Provide a valid stop ID or city coordinates (lat,lng).',
      });
    }

    return res.json(payload);
  });

  // 2. Road Corridor Speeds & Bottlenecks Endpoint
  app.get('/api/v1/traffic-segments', (req, res) => {
    const t0 = performance.now();
    const timeBucket = parseTimeBucket(req.query.time_bucket);
    const elapsedMs = Math.max(1, Math.round(performance.now() - t0 + 4));
    const payload = buildTrafficSegmentsResponse(timeBucket, serverTick, elapsedMs);
    return res.json(payload);
  });

  // 3. Live Bus GPS Telemetry Probes Endpoint
  app.get('/api/v1/buses/live', (req, res) => {
    const t0 = performance.now();
    const timeBucket = parseTimeBucket(req.query.time_bucket);
    const reqStream =
      req.query.stream === 'paused'
        ? 'paused'
        : req.query.stream === 'active'
          ? 'active'
          : globalStreamStatus;
    const elapsedMs = Math.max(1, Math.round(performance.now() - t0 + 3));
    const payload = buildLiveBusesResponse(timeBucket, reqStream, serverTick, elapsedMs);
    return res.json(payload);
  });

  // 4. Transit Stops Metadata Endpoint
  app.get('/api/v1/stops', (_req, res) => {
    return res.json({
      status: 'ok',
      total_stops: TRANSIT_STOPS.length,
      stops: TRANSIT_STOPS,
    });
  });

  // 5. Historical Bus GPS Analytics Endpoint
  app.get('/api/v1/analytics/historical', (req, res) => {
    const rawRange = req.query.range;
    const range: HistoricalRangeId =
      rawRange === 'today' || rawRange === '7d' || rawRange === '30d' ? rawRange : '7d';
    const selectedDate =
      typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
        ? req.query.date
        : '2026-11-23';
    return res.json(buildHistoricalAnalyticsResponse(range, selectedDate));
  });

  // Vite dev middleware or production static assets
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`MargPulse server running on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start MargPulse server:', err);
  process.exit(1);
});
