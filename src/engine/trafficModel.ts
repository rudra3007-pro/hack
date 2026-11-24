import {
  BUS_ROUTES,
  HISTORICAL_HOURLY_PROFILE,
  ROAD_SEGMENTS,
  TRANSIT_STOPS,
  getTimeBucketPreset,
} from '../data/cityNetwork.ts';
import type {
  BottleneckHotspot,
  BusProbe,
  BusSensorState,
  FlowStatus,
  HistoricalAnalyticsApiResponse,
  HistoricalRangeId,
  JourneyOption,
  JourneySegmentDetail,
  LiveBusesApiResponse,
  RoadSegment,
  SegmentTelemetry,
  StreamStatus,
  TimeBucketId,
  TrafficSegmentsApiResponse,
  TransitStop,
  TravelTimeApiResponse,
} from '../types/transit.ts';

const stopMap = new Map<string, TransitStop>(TRANSIT_STOPS.map((s) => [s.id, s]));

export function getStopById(id: string): TransitStop {
  return stopMap.get(id) || TRANSIT_STOPS[0];
}

export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function canvasToGeo(x: number, y: number): { lat: number; lng: number } {
  const lat = 27.05 - (y / 700) * 0.65;
  const lng = 80.3 + (x / 1000) * 0.95;
  return {
    lat: Number(lat.toFixed(5)),
    lng: Number(lng.toFixed(5)),
  };
}

export function geoToCanvas(lat: number, lng: number): { x: number; y: number } {
  const x = ((lng - 80.3) / 0.95) * 1000;
  const y = ((27.05 - lat) / 0.65) * 700;
  return {
    x: Math.max(20, Math.min(980, Math.round(x))),
    y: Math.max(20, Math.min(680, Math.round(y))),
  };
}

export interface ResolvedLocation {
  input: string;
  stop: TransitStop;
  coordinates: [number, number];
  walkSeconds: number;
  isCustomCoord: boolean;
}

export function resolveLocationInput(input: string): ResolvedLocation | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const directStop = stopMap.get(trimmed);
  if (directStop) {
    return {
      input: trimmed,
      stop: directStop,
      coordinates: [directStop.lat, directStop.lng],
      walkSeconds: 90, // ~1.5 min typical walk from surrounding street block
      isCustomCoord: false,
    };
  }

  // Try parsing "lat,lng"
  const parts = trimmed.split(',').map((s) => Number(s.trim()));
  if (
    parts.length === 2 &&
    Number.isFinite(parts[0]) &&
    Number.isFinite(parts[1]) &&
    parts[0] >= 25.0 &&
    parts[0] <= 28.5 &&
    parts[1] >= 79.5 &&
    parts[1] <= 83.5
  ) {
    const [lat, lng] = parts;
    let nearest = TRANSIT_STOPS[0];
    let minMeters = Infinity;
    for (const s of TRANSIT_STOPS) {
      const d = haversineMeters(lat, lng, s.lat, s.lng);
      if (d < minMeters) {
        minMeters = d;
        nearest = s;
      }
    }
    // Walking speed ~ 4.8 km/h = 1.333 m/s
    const walkSeconds = Math.max(45, Math.min(900, Math.round(minMeters / 1.333)));
    return {
      input: trimmed,
      stop: nearest,
      coordinates: [Number(lat.toFixed(5)), Number(lng.toFixed(5))],
      walkSeconds,
      isCustomCoord: true,
    };
  }

  return null;
}

export function findSegmentBetween(stopA: string, stopB: string): RoadSegment | undefined {
  return ROAD_SEGMENTS.find(
    (s) =>
      (s.fromStopId === stopA && s.toStopId === stopB) ||
      (s.fromStopId === stopB && s.toStopId === stopA)
  );
}

export function getSegmentPoints(
  segment: RoadSegment,
  reverse = false
): Array<{ x: number; y: number }> {
  const from = getStopById(segment.fromStopId);
  const to = getStopById(segment.toStopId);
  const mid = segment.waypoints || [];
  const pts = [{ x: from.x, y: from.y }, ...mid, { x: to.x, y: to.y }];
  return reverse ? [...pts].reverse() : pts;
}

export function interpolatePolyline(
  points: Array<{ x: number; y: number }>,
  t: number
): { x: number; y: number; headingDeg: number } {
  const clamped = Math.max(0, Math.min(1, t));
  if (points.length < 2) {
    return { x: points[0]?.x ?? 0, y: points[0]?.y ?? 0, headingDeg: 0 };
  }

  let totalLen = 0;
  const lengths: number[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    const len = Math.hypot(dx, dy);
    lengths.push(len);
    totalLen += len;
  }

  let target = clamped * totalLen;
  for (let i = 0; i < lengths.length; i++) {
    const segLen = lengths[i];
    if (target <= segLen || i === lengths.length - 1) {
      const localT = segLen > 0 ? target / segLen : 0;
      const p0 = points[i];
      const p1 = points[i + 1];
      const x = p0.x + (p1.x - p0.x) * localT;
      const y = p0.y + (p1.y - p0.y) * localT;
      const headingDeg = (Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180) / Math.PI;
      return { x, y, headingDeg };
    }
    target -= segLen;
  }

  const last = points[points.length - 1];
  return { x: last.x, y: last.y, headingDeg: 0 };
}

export function classifyFlow(speedKmh: number, freeFlowKmh: number): FlowStatus {
  const ratio = speedKmh / freeFlowKmh;
  if (ratio >= 0.7) return 'smooth';
  if (ratio >= 0.5) return 'moderate';
  if (ratio >= 0.36) return 'heavy';
  return 'severe';
}

function deterministicHash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

export function generateBusProbes(
  timeBucket: TimeBucketId,
  tick: number,
  streamStatus: StreamStatus = 'active'
): BusProbe[] {
  const probes: BusProbe[] = [];
  const nowIso = new Date().toISOString();
  let idx = 0;

  for (const route of BUS_ROUTES) {
    const legCount = route.stopIds.length - 1;
    const busesOnRoute = route.type === 'Express' ? 5 : 4;

    for (let b = 0; b < busesOnRoute; b++) {
      idx++;
      const seedOffset = deterministicHash(`${route.id}-${b}`);
      const direction = b % 2 === 0 ? 1 : -1;
      const speedFactor = timeBucket === 'live' ? 0.022 : 0.015;
      const basePhase = (seedOffset * legCount + tick * speedFactor) % legCount;
      const routeProgress = direction === 1 ? basePhase : legCount - basePhase;
      const legIdx = Math.min(legCount - 1, Math.max(0, Math.floor(routeProgress)));
      const localT = routeProgress - legIdx;

      const stopA = route.stopIds[legIdx];
      const stopB = route.stopIds[legIdx + 1];
      const segment = findSegmentBetween(stopA, stopB);
      if (!segment) continue;

      const isReversed = segment.fromStopId !== stopA;
      const pts = getSegmentPoints(segment, isReversed);
      const pos = interpolatePolyline(pts, localT);
      const geo = canvasToGeo(pos.x, pos.y);
      const nextStop = getStopById(stopB);
      const prevStop = getStopById(stopA);

      // Distance along segment endpoints to apply 40m Stop-vs-Jam Filter
      const distFromStartM = localT * segment.distanceKm * 1000;
      const distToEndM = (1 - localT) * segment.distanceKm * 1000;
      const withinStopRadius40m = distFromStartM <= 45 || distToEndM <= 45;

      const baseRatio = segment.periodSpeedRatio[timeBucket];
      const liveWave =
        timeBucket === 'live'
          ? Math.sin(tick * 0.18 + idx * 1.7) * 0.1 + (seedOffset - 0.5) * 0.08
          : (seedOffset - 0.5) * 0.04;

      const effectiveRatio = Math.max(0.18, Math.min(1.02, baseRatio + liveWave));
      let speedKmh = Math.round(segment.freeFlowKmh * effectiveRatio * 10) / 10;

      let sensorState: BusSensorState = 'Moving';
      let dwellSeconds = 0;

      if (withinStopRadius40m) {
        sensorState = 'At Stop';
        dwellSeconds = Math.round(18 + seedOffset * 22);
        speedKmh = 0.0;
      } else if (effectiveRatio < 0.37) {
        sensorState = 'Stuck in Jam';
        dwellSeconds = Math.round(14 + (1 - effectiveRatio) * 38);
        speedKmh = Math.max(3.4, Math.min(9.4, speedKmh));
      }

      probes.push({
        id: `probe-${route.shortName}-${b + 1}`,
        busId: `${route.shortName.replace('-', '')}-${104 + idx}`,
        routeId: route.id,
        routeShortName: route.shortName,
        segmentId: segment.id,
        x: pos.x,
        y: pos.y,
        lat: geo.lat,
        lng: geo.lng,
        headingDeg: pos.headingDeg,
        speedKmh,
        dwellSeconds,
        sensorState,
        occupancyPct: Math.min(
          98,
          Math.round(
            (timeBucket === '9am_peak' || timeBucket === '6pm_rush' || timeBucket === 'live'
              ? 64
              : 40) +
              seedOffset * 30
          )
        ),
        timestamp: nowIso,
        lastPingSecAgo:
          streamStatus === 'paused' ? 0 : Math.round(1 + ((idx + tick) % 4)),
        nextStopName: Math.min(distFromStartM, distToEndM) === distFromStartM ? prevStop.name : nextStop.name,
        isDemo: true,
      });
    }
  }

  return probes;
}

export function computeSegmentTelemetry(
  timeBucket: TimeBucketId,
  tick: number,
  probes: BusProbe[]
): SegmentTelemetry[] {
  return ROAD_SEGMENTS.map((segment) => {
    const segProbes = probes.filter((p) => p.segmentId === segment.id);
    // Stop-vs-Jam Filter: exclude 'At Stop' probes within 40m of stops from speed fusion
    const roadMovingOrJamProbes = segProbes.filter((p) => p.sensorState !== 'At Stop');
    const atStopFiltered = segProbes.filter((p) => p.sensorState === 'At Stop').length;
    const stuckInJam = segProbes.filter((p) => p.sensorState === 'Stuck in Jam').length;

    const historicalRatio = segment.periodSpeedRatio[timeBucket];
    const historicalSpeedKmh = Math.round(segment.freeFlowKmh * historicalRatio * 10) / 10;

    // Live probe average (or synthetic baseline wave if no moving probe is currently mid-segment)
    const liveWave =
      Math.sin(tick * 0.14 + deterministicHash(segment.id) * 12) * 0.06 -
      (timeBucket === '6pm_rush' ? 0.04 : 0.01);

    let liveSpeedKmh = historicalSpeedKmh;
    let fusedSpeedKmh = historicalSpeedKmh;
    let confidencePct = 78;

    if (roadMovingOrJamProbes.length > 0) {
      liveSpeedKmh =
        Math.round(
          (roadMovingOrJamProbes.reduce((acc, p) => acc + p.speedKmh, 0) /
            roadMovingOrJamProbes.length) *
            10
        ) / 10;
      // Weighted 70% live probe speed + 30% historical baseline
      fusedSpeedKmh = Math.round((liveSpeedKmh * 0.7 + historicalSpeedKmh * 0.3) * 10) / 10;
      confidencePct = Math.min(97, 84 + roadMovingOrJamProbes.length * 4);
    } else {
      const priorLive =
        Math.round(
          segment.freeFlowKmh * Math.max(0.24, Math.min(1, historicalRatio + liveWave)) * 10
        ) / 10;
      liveSpeedKmh = priorLive;
      fusedSpeedKmh = Math.round((priorLive * 0.35 + historicalSpeedKmh * 0.65) * 10) / 10;
      confidencePct = 76;
    }

    const speedDeltaPct = Math.round(
      ((fusedSpeedKmh - historicalSpeedKmh) / Math.max(1, historicalSpeedKmh)) * 100
    );
    const travelSeconds = Math.round((segment.distanceKm / Math.max(4, fusedSpeedKmh)) * 3600);
    const scheduledSeconds = Math.round(
      (segment.distanceKm / (segment.freeFlowKmh * 0.84)) * 3600
    );

    return {
      segment,
      liveSpeedKmh,
      historicalSpeedKmh,
      fusedSpeedKmh,
      speedDeltaPct,
      flowStatus: classifyFlow(fusedSpeedKmh, segment.freeFlowKmh),
      confidencePct,
      activeProbes: segProbes.length,
      atStopFiltered,
      stuckInJam,
      travelSeconds,
      scheduledSeconds,
    };
  });
}

export function extractHotspots(telemetry: SegmentTelemetry[]): BottleneckHotspot[] {
  return telemetry
    .map((item) => {
      const from = getStopById(item.segment.fromStopId);
      const to = getStopById(item.segment.toStopId);
      const mid = item.segment.waypoints?.[0];
      const xy = mid || { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
      const geo = canvasToGeo(xy.x, xy.y);
      const center = { x: xy.x, y: xy.y, lat: geo.lat, lng: geo.lng };
      const ratio = item.fusedSpeedKmh / item.segment.freeFlowKmh;
      return {
        segmentId: item.segment.id,
        corridorName: item.segment.corridor,
        roadName: item.segment.name,
        fusedSpeedKmh: item.fusedSpeedKmh,
        historicalSpeedKmh: item.historicalSpeedKmh,
        deltaPct: item.speedDeltaPct,
        probeCount: Math.max(1, item.activeProbes),
        stallCount: item.stuckInJam,
        dwellCount: item.atStopFiltered,
        cause: item.segment.causeTag,
        severity: item.flowStatus,
        center,
        _ratio: ratio,
      };
    })
    .sort((a, b) => a._ratio - b._ratio)
    .slice(0, 7)
    .map(({ _ratio, ...rest }) => rest);
}

function addMinutesToClock(clockStr: string, addMin: number): string {
  const [hStr, mStr] = clockStr.split(':');
  const baseH = parseInt(hStr || '9', 10);
  const baseM = parseInt(mStr || '0', 10);
  const total = (baseH * 60 + baseM + Math.round(addMin)) % (24 * 60);
  const hh = Math.floor(total / 60)
    .toString()
    .padStart(2, '0');
  const mm = (total % 60).toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

interface PathHop {
  fromStopId: string;
  toStopId: string;
  routeShortName: string;
}

function buildOptionFromHops(
  id: string,
  title: string,
  summaryTag: string,
  hops: PathHop[],
  telemetryMap: Map<string, SegmentTelemetry>,
  departClock: string,
  walkToStopSec: number,
  walkFromStopSec: number,
  tick: number
): JourneyOption | null {
  if (hops.length === 0) return null;

  const segments: JourneySegmentDetail[] = [];
  const stopEtas: JourneyOption['stopEtas'] = [];

  const walkToStopMin = Math.max(1, Math.round(walkToStopSec / 60));
  const walkFromStopMin = Math.max(1, Math.round(walkFromStopSec / 60));
  const firstRoute = BUS_ROUTES.find((r) => r.shortName === hops[0].routeShortName);
  const headway = firstRoute?.headwayMin ?? 8;
  const nextBusArrivalMin = Math.max(
    1,
    Math.round(1 + ((headway - 1) * ((tick + deterministicHash(id) * 10) % headway)) / headway)
  );
  const waitTimeMin = nextBusArrivalMin;

  let cumulativeMin = walkToStopMin + waitTimeMin;
  let inVehicleMin = 0;
  let scheduledInVehicleMin = 0;
  let transferPenaltyMin = 0;
  let totalDistanceKm = 0;
  let totalProbes = 0;
  let totalDwellFiltered = 0;
  let speedSum = 0;
  let confSum = 0;

  const firstStop = getStopById(hops[0].fromStopId);
  stopEtas.push({
    stop: firstStop,
    etaClock: addMinutesToClock(departClock, cumulativeMin),
    cumulativeMin: Math.round(cumulativeMin),
  });

  const routeLabels: string[] = [];
  let prevRoute = '';
  let transfers = 0;

  for (let i = 0; i < hops.length; i++) {
    const hop = hops[i];
    const seg = findSegmentBetween(hop.fromStopId, hop.toStopId);
    if (!seg) return null;
    const tel = telemetryMap.get(seg.id);
    if (!tel) return null;

    if (hop.routeShortName !== prevRoute) {
      if (prevRoute !== '') {
        transfers++;
        transferPenaltyMin += 3.5;
        cumulativeMin += 3.5;
      }
      routeLabels.push(hop.routeShortName);
      prevRoute = hop.routeShortName;
    }

    const fromStop = getStopById(hop.fromStopId);
    const toStop = getStopById(hop.toStopId);
    const dwellMin = toStop.scheduledDwellSec / 60;
    const segMin = tel.travelSeconds / 60 + dwellMin;
    const schedMin = tel.scheduledSeconds / 60 + dwellMin;

    inVehicleMin += segMin;
    scheduledInVehicleMin += schedMin;
    cumulativeMin += segMin;
    totalDistanceKm += seg.distanceKm;
    totalProbes += Math.max(1, tel.activeProbes);
    totalDwellFiltered += tel.atStopFiltered;
    speedSum += tel.fusedSpeedKmh;
    confSum += tel.confidencePct;

    const etaAtEndClock = addMinutesToClock(departClock, cumulativeMin);

    segments.push({
      segmentId: seg.id,
      roadName: seg.name,
      fromStop,
      toStop,
      routeShortName: hop.routeShortName,
      distanceKm: seg.distanceKm,
      fusedSpeedKmh: tel.fusedSpeedKmh,
      historicalSpeedKmh: tel.historicalSpeedKmh,
      flowStatus: tel.flowStatus,
      travelMinutes: Math.round(segMin * 10) / 10,
      scheduledMinutes: Math.round(schedMin * 10) / 10,
      probeCount: Math.max(1, tel.activeProbes),
      dwellFilteredCount: tel.atStopFiltered,
      etaAtEndClock,
    });

    const nextHop = hops[i + 1];
    stopEtas.push({
      stop: toStop,
      etaClock: etaAtEndClock,
      cumulativeMin: Math.round(cumulativeMin),
      isTransfer: Boolean(nextHop && nextHop.routeShortName !== hop.routeShortName),
    });
  }

  const totalPredicted = Math.round(cumulativeMin + walkFromStopMin);
  const scheduledMin = Math.round(
    walkToStopMin + waitTimeMin + scheduledInVehicleMin + transferPenaltyMin + walkFromStopMin
  );
  const trafficDelayMin = Math.max(0, totalPredicted - scheduledMin);
  const variance = Math.max(2, Math.round(totalPredicted * (trafficDelayMin > 4 ? 0.16 : 0.1)));
  const confidencePct = Math.max(
    72,
    Math.min(97, Math.round(confSum / hops.length - trafficDelayMin * 0.5))
  );

  const confidenceLabel: JourneyOption['confidenceLabel'] =
    confidencePct >= 88
      ? 'High confidence'
      : confidencePct >= 80
        ? 'Moderate confidence'
        : 'Volatile corridor';

  return {
    id,
    title,
    summaryTag,
    routeLabels,
    transfers,
    walkToStopMin,
    walkFromStopMin,
    waitTimeMin,
    nextBusArrivalMin,
    inVehicleMin: Math.round(inVehicleMin),
    transferPenaltyMin: Math.round(transferPenaltyMin),
    predictedMin: totalPredicted,
    predictedRangeMin: [
      Math.max(4, totalPredicted - Math.floor(variance / 2)),
      totalPredicted + Math.ceil(variance / 2),
    ],
    scheduledMin,
    trafficDelayMin,
    confidencePct,
    confidenceLabel,
    avgSensorSpeedKmh: Math.round((speedSum / hops.length) * 10) / 10,
    totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
    activeSensorBuses: totalProbes,
    dwellFilteredCount: totalDwellFiltered,
    segments,
    stopEtas,
  };
}

function getRouteSubPath(
  routeStopIds: string[],
  startId: string,
  endId: string,
  routeShortName: string
): PathHop[] | null {
  const iStart = routeStopIds.indexOf(startId);
  const iEnd = routeStopIds.indexOf(endId);
  if (iStart === -1 || iEnd === -1 || iStart === iEnd) return null;

  const hops: PathHop[] = [];
  if (iStart < iEnd) {
    for (let i = iStart; i < iEnd; i++) {
      hops.push({
        fromStopId: routeStopIds[i],
        toStopId: routeStopIds[i + 1],
        routeShortName,
      });
    }
  } else {
    for (let i = iStart; i > iEnd; i--) {
      hops.push({
        fromStopId: routeStopIds[i],
        toStopId: routeStopIds[i - 1],
        routeShortName,
      });
    }
  }
  return hops;
}

function findShortestGraphHops(
  originId: string,
  destinationId: string,
  telemetryMap: Map<string, SegmentTelemetry>,
  avoidSegmentId?: string
): PathHop[] {
  const dist = new Map<string, number>();
  const prev = new Map<string, { stopId: string; segment: RoadSegment }>();
  const unvisited = new Set<string>(TRANSIT_STOPS.map((s) => s.id));

  for (const s of TRANSIT_STOPS) {
    dist.set(s.id, s.id === originId ? 0 : Infinity);
  }

  while (unvisited.size > 0) {
    let u: string | null = null;
    let best = Infinity;
    for (const id of unvisited) {
      const d = dist.get(id) ?? Infinity;
      if (d < best) {
        best = d;
        u = id;
      }
    }
    if (!u || best === Infinity || u === destinationId) break;
    unvisited.delete(u);

    for (const seg of ROAD_SEGMENTS) {
      if (seg.id === avoidSegmentId) continue;
      let neighbor: string | null = null;
      if (seg.fromStopId === u) neighbor = seg.toStopId;
      else if (seg.toStopId === u) neighbor = seg.fromStopId;
      if (!neighbor || !unvisited.has(neighbor)) continue;

      const tel = telemetryMap.get(seg.id);
      const weight = tel ? tel.travelSeconds : seg.distanceKm * 120;
      const alt = best + weight;
      if (alt < (dist.get(neighbor) ?? Infinity)) {
        dist.set(neighbor, alt);
        prev.set(neighbor, { stopId: u, segment: seg });
      }
    }
  }

  const hops: PathHop[] = [];
  let curr = destinationId;
  while (curr !== originId) {
    const step = prev.get(curr);
    if (!step) break;
    const matchingRoute =
      BUS_ROUTES.find((r) => {
        const i1 = r.stopIds.indexOf(step.stopId);
        const i2 = r.stopIds.indexOf(curr);
        return i1 !== -1 && i2 !== -1 && Math.abs(i1 - i2) === 1;
      }) || BUS_ROUTES[0];
    hops.unshift({
      fromStopId: step.stopId,
      toStopId: curr,
      routeShortName: matchingRoute.shortName,
    });
    curr = step.stopId;
  }

  return hops;
}

export function planJourneys(
  originId: string,
  destinationId: string,
  telemetry: SegmentTelemetry[],
  departClock: string,
  walkToStopSec = 90,
  walkFromStopSec = 90,
  tick = 12
): JourneyOption[] {
  if (originId === destinationId) return [];

  const telemetryMap = new Map<string, SegmentTelemetry>(
    telemetry.map((t) => [t.segment.id, t])
  );

  const candidates: JourneyOption[] = [];
  const seenSignature = new Set<string>();

  for (const route of BUS_ROUTES) {
    const hops = getRouteSubPath(route.stopIds, originId, destinationId, route.shortName);
    if (hops && hops.length > 0) {
      const sig = hops.map((h) => `${h.fromStopId}-${h.toStopId}`).join('|');
      if (!seenSignature.has(sig)) {
        seenSignature.add(sig);
        const opt = buildOptionFromHops(
          `direct-${route.id}`,
          `${route.shortName} Direct`,
          `${route.type} · Direct corridor`,
          hops,
          telemetryMap,
          departClock,
          walkToStopSec,
          walkFromStopSec,
          tick
        );
        if (opt) candidates.push(opt);
      }
    }
  }

  for (const r1 of BUS_ROUTES) {
    if (!r1.stopIds.includes(originId)) continue;
    for (const r2 of BUS_ROUTES) {
      if (r1.id === r2.id || !r2.stopIds.includes(destinationId)) continue;
      const sharedStops = r1.stopIds.filter(
        (sid) => sid !== originId && sid !== destinationId && r2.stopIds.includes(sid)
      );
      for (const hubId of sharedStops) {
        const leg1 = getRouteSubPath(r1.stopIds, originId, hubId, r1.shortName);
        const leg2 = getRouteSubPath(r2.stopIds, hubId, destinationId, r2.shortName);
        if (leg1 && leg2 && leg1.length + leg2.length <= 7) {
          const combined = [...leg1, ...leg2];
          const sig = combined.map((h) => `${h.fromStopId}-${h.toStopId}`).join('|');
          if (!seenSignature.has(sig)) {
            seenSignature.add(sig);
            const hubStop = getStopById(hubId);
            const opt = buildOptionFromHops(
              `xfer-${r1.shortName}-${r2.shortName}-${hubId}`,
              `${r1.shortName} → ${r2.shortName}`,
              `1 transfer at ${hubStop.code}`,
              combined,
              telemetryMap,
              departClock,
              walkToStopSec,
              walkFromStopSec,
              tick
            );
            if (opt) candidates.push(opt);
          }
        }
      }
    }
  }

  const fastestHops = findShortestGraphHops(originId, destinationId, telemetryMap);
  if (fastestHops.length > 0) {
    const sig = fastestHops.map((h) => `${h.fromStopId}-${h.toStopId}`).join('|');
    if (!seenSignature.has(sig)) {
      seenSignature.add(sig);
      const opt = buildOptionFromHops(
        'sensor-optimal',
        `${Array.from(new Set(fastestHops.map((h) => h.routeShortName))).join(' → ')}`,
        'Congestion-adjusted feeder',
        fastestHops,
        telemetryMap,
        departClock,
        walkToStopSec,
        walkFromStopSec,
        tick
      );
      if (opt) candidates.push(opt);
    }

    if (fastestHops.length >= 2) {
      let slowestSegId: string | undefined;
      let minRatio = 2;
      for (const h of fastestHops) {
        const seg = findSegmentBetween(h.fromStopId, h.toStopId);
        const tel = seg ? telemetryMap.get(seg.id) : undefined;
        if (seg && tel) {
          const r = tel.fusedSpeedKmh / seg.freeFlowKmh;
          if (r < minRatio) {
            minRatio = r;
            slowestSegId = seg.id;
          }
        }
      }
      if (slowestSegId) {
        const altHops = findShortestGraphHops(
          originId,
          destinationId,
          telemetryMap,
          slowestSegId
        );
        if (altHops.length > 0) {
          const altSig = altHops.map((h) => `${h.fromStopId}-${h.toStopId}`).join('|');
          if (!seenSignature.has(altSig)) {
            seenSignature.add(altSig);
            const opt = buildOptionFromHops(
              'sensor-bypass',
              `${Array.from(new Set(altHops.map((h) => h.routeShortName))).join(' → ')}`,
              'Bottleneck bypass corridor',
              altHops,
              telemetryMap,
              departClock,
              walkToStopSec,
              walkFromStopSec,
              tick
            );
            if (opt) candidates.push(opt);
          }
        }
      }
    }
  }

  candidates.sort((a, b) => a.predictedMin - b.predictedMin || a.transfers - b.transfers);

  return candidates.slice(0, 3).map((opt, idx) => ({
    ...opt,
    summaryTag: idx === 0 ? `Fastest · ${opt.summaryTag}` : opt.summaryTag,
  }));
}

export function buildTravelTimeResponse(
  originInput: string,
  destinationInput: string,
  timeBucket: TimeBucketId,
  departAt: string,
  tick: number,
  latencyMs = 18
): TravelTimeApiResponse | null {
  const origin = resolveLocationInput(originInput);
  const destination = resolveLocationInput(destinationInput);
  if (!origin || !destination) return null;

  const preset = getTimeBucketPreset(timeBucket);
  const probes = generateBusProbes(timeBucket, tick);
  const telemetry = computeSegmentTelemetry(timeBucket, tick, probes);
  const departClock = departAt === 'now' ? preset.clock : departAt;

  const journeys = planJourneys(
    origin.stop.id,
    destination.stop.id,
    telemetry,
    departClock,
    origin.walkSeconds,
    destination.walkSeconds,
    tick
  );

  const best = journeys[0];
  const avgFlowRatio = best
    ? best.segments.reduce((acc, s) => acc + s.fusedSpeedKmh / 42, 0) / best.segments.length
    : preset.globalCongestionFactor;

  const congestionLevel: TravelTimeApiResponse['congestion_level'] =
    avgFlowRatio >= 0.72
      ? 'Smooth'
      : avgFlowRatio >= 0.52
        ? 'Moderate'
        : avgFlowRatio >= 0.36
          ? 'Heavy'
          : 'Severe';

  const telMap = new Map(telemetry.map((t) => [t.segment.id, t]));

  return {
    status: 'ok',
    endpoint: '/api/v1/travel-time',
    is_demo: true,
    time_bucket: timeBucket,
    timestamp: new Date().toISOString(),
    latency_ms: latencyMs,
    origin: {
      input: origin.input,
      resolved_stop_id: origin.stop.id,
      resolved_stop_name: origin.stop.name,
      coordinates: origin.coordinates,
      walk_to_stop_seconds: origin.walkSeconds,
    },
    destination: {
      input: destination.input,
      resolved_stop_id: destination.stop.id,
      resolved_stop_name: destination.stop.name,
      coordinates: destination.coordinates,
      walk_from_stop_seconds: destination.walkSeconds,
    },
    recommended_route: best ? best.routeLabels.join(' -> ') : 'Direct Walk',
    predicted_eta_seconds: best
      ? best.predictedMin * 60
      : origin.walkSeconds + destination.walkSeconds,
    formatted_eta: best
      ? `${best.predictedRangeMin[0]}–${best.predictedRangeMin[1]} min`
      : '5–7 min',
    min_eta_seconds: best ? best.predictedRangeMin[0] * 60 : 300,
    max_eta_seconds: best ? best.predictedRangeMin[1] * 60 : 420,
    scheduled_seconds: best ? best.scheduledMin * 60 : 300,
    traffic_delay_seconds: best ? best.trafficDelayMin * 60 : 0,
    congestion_level: congestionLevel,
    confidence: best ? Number((best.confidencePct / 100).toFixed(2)) : 0.9,
    active_sensor_bus_count: best ? best.activeSensorBuses : 0,
    dwell_filtered_probes: best ? best.dwellFilteredCount : 0,
    breakdown: {
      walk_seconds: best ? (best.walkToStopMin + best.walkFromStopMin) * 60 : 180,
      wait_seconds: best ? best.waitTimeMin * 60 : 0,
      in_vehicle_seconds: best ? best.inVehicleMin * 60 : 0,
      transfer_penalty_seconds: best ? best.transferPenaltyMin * 60 : 0,
    },
    segments: best
      ? best.segments.map((s) => {
          const t = telMap.get(s.segmentId);
          return {
            segment_id: s.segmentId,
            corridor: s.roadName,
            route_line: s.routeShortName,
            distance_meters: Math.round(s.distanceKm * 1000),
            live_probe_speed_kmh: t ? t.liveSpeedKmh : s.fusedSpeedKmh,
            historical_speed_kmh: s.historicalSpeedKmh,
            fused_speed_kmh: s.fusedSpeedKmh,
            duration_seconds: Math.round(s.travelMinutes * 60),
            flow_state: s.flowStatus,
            sensor_bus_count: s.probeCount,
          };
        })
      : [],
    journeys,
  };
}

export function buildTrafficSegmentsResponse(
  timeBucket: TimeBucketId,
  tick: number,
  latencyMs = 12
): TrafficSegmentsApiResponse {
  const probes = generateBusProbes(timeBucket, tick);
  const segments = computeSegmentTelemetry(timeBucket, tick, probes);
  const hotspots = extractHotspots(segments);

  const avgSpeed =
    segments.reduce((acc, s) => acc + s.fusedSpeedKmh, 0) / Math.max(1, segments.length);
  const avgConf =
    segments.reduce((acc, s) => acc + s.confidencePct, 0) / Math.max(1, segments.length);
  const bottlenecks = segments.filter(
    (s) => s.flowStatus === 'heavy' || s.flowStatus === 'severe'
  ).length;

  return {
    status: 'ok',
    is_demo: true,
    time_bucket: timeBucket,
    timestamp: new Date().toISOString(),
    latency_ms: latencyMs,
    summary: {
      active_bus_sensors: probes.length,
      active_routes_count: BUS_ROUTES.length,
      avg_corridor_speed_kmh: Math.round(avgSpeed * 10) / 10,
      detected_bottlenecks: bottlenecks,
      model_confidence_pct: Math.round(avgConf),
      at_stop_filtered_count: probes.filter((p) => p.sensorState === 'At Stop').length,
      stuck_in_jam_count: probes.filter((p) => p.sensorState === 'Stuck in Jam').length,
    },
    segments,
    hotspots,
  };
}

export function buildLiveBusesResponse(
  timeBucket: TimeBucketId,
  streamStatus: StreamStatus,
  tick: number,
  latencyMs = 8
): LiveBusesApiResponse {
  const buses = generateBusProbes(timeBucket, tick, streamStatus);
  return {
    status: 'ok',
    is_demo: true,
    time_bucket: timeBucket,
    stream_status: streamStatus,
    tick,
    timestamp: new Date().toISOString(),
    latency_ms: latencyMs,
    total_buses: buses.length,
    buses,
  };
}

export function buildHistoricalAnalyticsResponse(
  range: HistoricalRangeId,
  selectedDate: string
): HistoricalAnalyticsApiResponse {
  const rangeFactor = range === 'today' ? 1.0 : range === '7d' ? 0.97 : 1.03;
  const dateSeed = deterministicHash(selectedDate || '2026-11-23');

  const hourly_trends = HISTORICAL_HOURLY_PROFILE.map((row, idx) => {
    const wave = Math.sin(idx * 0.7 + dateSeed * 6) * 1.4;
    const hist = Math.round((row.historicalKmh * rangeFactor + wave * 0.4) * 10) / 10;
    const curr = Math.round(hist * row.liveModifier * 10) / 10;
    const congestion_index = Math.min(96, Math.max(12, Math.round((1 - curr / 44) * 100)));
    return {
      hour: row.hour,
      historical_speed_kmh: hist,
      current_speed_kmh: curr,
      congestion_index,
      active_buses: idx >= 2 && idx <= 14 ? 26 : 16,
    };
  });

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dayProfiles = [24.6, 23.8, 24.1, 22.9, 21.8, 29.4, 33.2];
  const daily_comparison = dayNames.map((day, idx) => {
    const avg_speed_kmh =
      Math.round((dayProfiles[idx] * rangeFactor + (dateSeed - 0.5) * 1.5) * 10) / 10;
    const congestion_pct = Math.min(88, Math.max(18, Math.round((1 - avg_speed_kmh / 42) * 100)));
    const peak_delay_min = Math.max(2, Math.round(congestion_pct * 0.24));
    return {
      day,
      avg_speed_kmh,
      peak_delay_min,
      congestion_pct,
    };
  });

  const road_averages = ROAD_SEGMENTS.map((seg) => {
    const offpeak_avg_kmh = Math.round(seg.freeFlowKmh * seg.periodSpeedRatio['2pm_offpeak'] * 10) / 10;
    const peak_avg_kmh = Math.round(seg.freeFlowKmh * seg.periodSpeedRatio['6pm_rush'] * 10) / 10;
    const historical_avg_kmh =
      Math.round(((offpeak_avg_kmh + peak_avg_kmh + seg.freeFlowKmh * seg.periodSpeedRatio['9am_peak']) / 3) * 10) / 10;
    const congestion_frequency_pct = Math.min(
      95,
      Math.max(10, Math.round((1 - seg.periodSpeedRatio['6pm_rush']) * 115))
    );
    return {
      segment_id: seg.id,
      road_name: seg.name,
      corridor: seg.corridor,
      historical_avg_kmh,
      peak_avg_kmh,
      offpeak_avg_kmh,
      congestion_frequency_pct,
      frequent_hotspot: congestion_frequency_pct >= 55,
    };
  }).sort((a, b) => b.congestion_frequency_pct - a.congestion_frequency_pct);

  const route_comparisons = BUS_ROUTES.map((r) => {
    let dist = 0;
    for (let i = 0; i < r.stopIds.length - 1; i++) {
      const s = findSegmentBetween(r.stopIds[i], r.stopIds[i + 1]);
      if (s) dist += s.distanceKm;
    }
    const offpeak_trip_min = Math.round((dist / 33) * 60 + (r.stopIds.length - 1) * 0.6);
    const peak_trip_min = Math.round((dist / 17.5) * 60 + (r.stopIds.length - 1) * 1.1);
    const avg_trip_min = Math.round((offpeak_trip_min + peak_trip_min) / 2);
    const reliability_pct = Math.round(78 + deterministicHash(r.id) * 17);
    return {
      route_short_name: r.shortName,
      route_name: r.name,
      avg_trip_min,
      peak_trip_min,
      offpeak_trip_min,
      reliability_pct,
    };
  });

  const avgNet =
    Math.round(
      (hourly_trends.reduce((acc, h) => acc + h.historical_speed_kmh, 0) / hourly_trends.length) *
        10
    ) / 10;

  return {
    status: 'ok',
    is_demo: true,
    range,
    selected_date: selectedDate || '2026-11-23',
    generated_at: new Date().toISOString(),
    summary: {
      avg_network_speed_kmh: avgNet,
      peak_congestion_hour: '18:00 (6 PM Rush)',
      smoothest_hour: '22:00 (Late Evening)',
      total_gps_pings_analyzed: range === 'today' ? 48240 : range === '7d' ? 338600 : 1452800,
      bottleneck_events_count: road_averages.filter((r) => r.frequent_hotspot).length,
    },
    hourly_trends,
    daily_comparison,
    road_averages,
    route_comparisons,
  };
}

