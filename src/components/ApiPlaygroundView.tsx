import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Clock,
  Code2,
  Copy,
  ExternalLink,
  Flame,
  Play,
  RotateCcw,
  Send,
  Terminal,
} from 'lucide-react';
import { TRANSIT_STOPS } from '../data/cityNetwork.ts';
import type { TimeBucketId } from '../types/transit.ts';

type EndpointId = 'travel-time' | 'traffic-segments' | 'buses-live' | 'stops' | 'historical';

interface EndpointConfig {
  id: EndpointId;
  method: 'GET' | 'POST';
  path: string;
  name: string;
  category: 'Routing' | 'Sensors' | 'Metadata' | 'Analytics';
  description: string;
}

const ENDPOINTS: EndpointConfig[] = [
  {
    id: 'travel-time',
    method: 'GET',
    path: '/api/v1/travel-time',
    name: 'Travel-Time & Journey Engine',
    category: 'Routing',
    description: 'Calculates multimodal transit ETA, congestion delay, sensor confidence, and corridor hops.',
  },
  {
    id: 'traffic-segments',
    method: 'GET',
    path: '/api/v1/traffic-segments',
    name: 'Road Segments & Bottlenecks',
    category: 'Sensors',
    description: 'Fused corridor speeds computed from live bus GPS probes and historical baseline speeds.',
  },
  {
    id: 'buses-live',
    method: 'GET',
    path: '/api/v1/buses/live',
    name: 'Live Bus GPS Probes',
    category: 'Sensors',
    description: 'Current real-time and simulated telemetry stream of active UPSRTC and city electric buses.',
  },
  {
    id: 'stops',
    method: 'GET',
    path: '/api/v1/stops',
    name: 'Transit Stops & Terminals',
    category: 'Metadata',
    description: 'Uttar Pradesh transit network stop coordinates, district codes, and scheduled dwell bounds.',
  },
  {
    id: 'historical',
    method: 'GET',
    path: '/api/v1/analytics/historical',
    name: 'Historical Congestion Analytics',
    category: 'Analytics',
    description: 'Hourly speed profiles, peak vs. off-peak degradation curves, and bottleneck recurring patterns.',
  },
];

export default function ApiPlaygroundView() {
  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointId>('travel-time');

  // Parameters
  const [origin, setOrigin] = useState('charbagh-nr');
  const [destination, setDestination] = useState('gomti-nagar');
  const [timeBucket, setTimeBucket] = useState<TimeBucketId>('live');
  const [departAt, setDepartAt] = useState('now');
  const [range, setRange] = useState<'today' | '7d' | '30d'>('7d');
  const [date, setDate] = useState('2026-11-24');

  // Response State
  const [loading, setLoading] = useState(false);
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [responseLatencyMs, setResponseLatencyMs] = useState<number | null>(null);
  const [responseBody, setResponseBody] = useState<unknown | null>(null);
  const [copiedResponse, setCopiedResponse] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [activeCodeTab, setActiveCodeTab] = useState<'curl' | 'js' | 'python'>('curl');

  // Active endpoint configuration
  const currentEndpoint = useMemo(
    () => ENDPOINTS.find((e) => e.id === selectedEndpoint) || ENDPOINTS[0],
    [selectedEndpoint]
  );

  // Compute query URL string
  const requestUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedEndpoint === 'travel-time') {
      params.set('origin', origin);
      params.set('destination', destination);
      if (timeBucket !== 'live') params.set('time_bucket', timeBucket);
      if (departAt !== 'now') params.set('depart_at', departAt);
    } else if (selectedEndpoint === 'traffic-segments') {
      if (timeBucket !== 'live') params.set('time_bucket', timeBucket);
    } else if (selectedEndpoint === 'buses-live') {
      if (timeBucket !== 'live') params.set('time_bucket', timeBucket);
    } else if (selectedEndpoint === 'historical') {
      params.set('range', range);
      params.set('date', date);
    }
    const query = params.toString();
    return `${currentEndpoint.path}${query ? `?${query}` : ''}`;
  }, [selectedEndpoint, currentEndpoint.path, origin, destination, timeBucket, departAt, range, date]);

  // Execute request
  const handleExecuteRequest = async () => {
    setLoading(true);
    const t0 = performance.now();
    try {
      const res = await fetch(requestUrl);
      const elapsed = Math.round(performance.now() - t0);
      const data = await res.json();
      setResponseStatus(res.status);
      setResponseLatencyMs(elapsed);
      setResponseBody(data);
    } catch (err: unknown) {
      const elapsed = Math.round(performance.now() - t0);
      setResponseStatus(500);
      setResponseLatencyMs(elapsed);
      setResponseBody({
        status: 'error',
        message: err instanceof Error ? err.message : 'Network error or request timeout',
      });
    } finally {
      setLoading(false);
    }
  };

  // Run automatically on first mount or when switching endpoint
  useEffect(() => {
    void handleExecuteRequest();
  }, [selectedEndpoint]);

  const handleCopyResponse = async () => {
    if (!responseBody) return;
    await navigator.clipboard.writeText(JSON.stringify(responseBody, null, 2));
    setCopiedResponse(true);
    setTimeout(() => setCopiedResponse(false), 2000);
  };

  // Generate code snippet
  const codeSnippet = useMemo(() => {
    const fullUrl = `http://localhost:3000${requestUrl}`;
    if (activeCodeTab === 'curl') {
      return `curl -X GET "${fullUrl}" \\\n  -H "Accept: application/json"`;
    }
    if (activeCodeTab === 'js') {
      return `const response = await fetch("${fullUrl}", {\n  headers: { Accept: "application/json" }\n});\nconst data = await response.json();\nconsole.log(data);`;
    }
    if (activeCodeTab === 'python') {
      return `import requests\n\nurl = "${fullUrl}"\nheaders = {"Accept": "application/json"}\n\nresponse = requests.get(url, headers=headers)\ndata = response.json()\nprint(data)`;
    }
    return '';
  }, [requestUrl, activeCodeTab]);

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(codeSnippet);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const payloadSizeKb = useMemo(() => {
    if (!responseBody) return 0;
    const str = JSON.stringify(responseBody);
    return (new Blob([str]).size / 1024).toFixed(1);
  }, [responseBody]);

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto pb-8">
      {/* Header */}
      <div className="flex flex-col gap-2 border-b border-stone-200 dark:border-[#2E2924] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#E85D04]/10 text-[#E85D04]">
              <Terminal className="h-4 w-4" />
            </span>
            <h1 className="font-display text-xl font-bold tracking-tight text-stone-900 dark:text-[#FAF5EE]">
              MargFlow API Playground
            </h1>
            <span className="rounded-md border border-amber-300 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300">
              UP MODEL v1.0
            </span>
          </div>
          <p className="mt-1 text-xs text-stone-500 dark:text-[#C4B9AC]">
            Interactive REST playground for Uttar Pradesh bus traffic intelligence, journey ETAs, and road sensor telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExecuteRequest}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#E85D04] to-[#F48C06] px-4 py-2 text-xs font-semibold text-white shadow-md shadow-orange-950/20 transition hover:brightness-110 active:scale-95 disabled:opacity-50"
          >
            {loading ? (
              <>
                <RotateCcw className="h-3.5 w-3.5 animate-spin" />
                <span>Executing...</span>
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                <span>Send Request</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Endpoint Selector Tabs */}
      <div className="flex flex-wrap gap-2">
        {ENDPOINTS.map((ep) => {
          const isSelected = ep.id === selectedEndpoint;
          return (
            <button
              key={ep.id}
              type="button"
              onClick={() => setSelectedEndpoint(ep.id)}
              className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-medium transition ${
                isSelected
                  ? 'border-[#E85D04] bg-[#E85D04]/10 text-[#E85D04] dark:bg-[#E85D04]/20 shadow-xs'
                  : 'border-stone-200 dark:border-[#2E2924] bg-white dark:bg-[#1C1916] text-stone-700 dark:text-[#C4B9AC] hover:border-stone-300 dark:hover:border-stone-700'
              }`}
            >
              <span className="font-mono text-[10px] font-bold uppercase text-[#F48C06]">
                {ep.method}
              </span>
              <span className="font-semibold">{ep.name}</span>
            </button>
          );
        })}
      </div>

      {/* Main Split: Left Builder & Right Response */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 flex-1">
        {/* Left Column: Request Builder */}
        <div className="flex flex-col gap-4 lg:col-span-5">
          {/* Endpoint Summary Card */}
          <div className="rounded-2xl border border-stone-200 dark:border-[#2E2924] bg-white dark:bg-[#1C1916] p-4 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-[#C4B9AC]">
                Endpoint Documentation
              </span>
              <span className="rounded bg-stone-100 dark:bg-[#2E2924] px-2 py-0.5 text-[10px] font-medium text-stone-600 dark:text-[#C4B9AC]">
                {currentEndpoint.category}
              </span>
            </div>
            <h3 className="font-display text-sm font-bold text-stone-900 dark:text-[#FAF5EE]">
              {currentEndpoint.name}
            </h3>
            <p className="mt-1 text-xs text-stone-500 dark:text-[#C4B9AC] leading-relaxed">
              {currentEndpoint.description}
            </p>

            {/* URL Display */}
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-stone-200 dark:border-[#2E2924] bg-stone-50 dark:bg-[#12100E] p-2.5">
              <span className="rounded bg-[#E85D04]/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#E85D04]">
                {currentEndpoint.method}
              </span>
              <span className="truncate font-mono text-xs font-medium text-stone-800 dark:text-[#FAF5EE]">
                {requestUrl}
              </span>
            </div>
          </div>

          {/* Dynamic Parameters Form */}
          <div className="rounded-2xl border border-stone-200 dark:border-[#2E2924] bg-white dark:bg-[#1C1916] p-4 shadow-xs">
            <h4 className="font-display text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-[#C4B9AC] mb-3">
              Query Parameters
            </h4>

            {selectedEndpoint === 'travel-time' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 dark:text-[#FAF5EE] mb-1">
                    Origin (Stop ID or lat,lng)
                  </label>
                  <select
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 dark:border-[#2E2924] bg-stone-50 dark:bg-[#12100E] px-3 py-2 text-xs font-medium text-stone-800 dark:text-[#FAF5EE] focus:border-[#E85D04] focus:outline-hidden"
                  >
                    {TRANSIT_STOPS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 dark:text-[#FAF5EE] mb-1">
                    Destination (Stop ID or lat,lng)
                  </label>
                  <select
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 dark:border-[#2E2924] bg-stone-50 dark:bg-[#12100E] px-3 py-2 text-xs font-medium text-stone-800 dark:text-[#FAF5EE] focus:border-[#E85D04] focus:outline-hidden"
                  >
                    {TRANSIT_STOPS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-700 dark:text-[#FAF5EE] mb-1">
                      Time Bucket
                    </label>
                    <select
                      value={timeBucket}
                      onChange={(e) => setTimeBucket(e.target.value as TimeBucketId)}
                      className="w-full rounded-xl border border-stone-200 dark:border-[#2E2924] bg-stone-50 dark:bg-[#12100E] px-3 py-2 text-xs font-medium text-stone-800 dark:text-[#FAF5EE] focus:border-[#E85D04] focus:outline-hidden"
                    >
                      <option value="live">Live Telemetry</option>
                      <option value="9am_peak">9 AM Peak</option>
                      <option value="2pm_offpeak">2 PM Off-Peak</option>
                      <option value="6pm_rush">6 PM Rush</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-700 dark:text-[#FAF5EE] mb-1">
                      Depart At
                    </label>
                    <input
                      type="text"
                      value={departAt}
                      onChange={(e) => setDepartAt(e.target.value)}
                      placeholder="now or HH:MM"
                      className="w-full rounded-xl border border-stone-200 dark:border-[#2E2924] bg-stone-50 dark:bg-[#12100E] px-3 py-2 text-xs font-medium text-stone-800 dark:text-[#FAF5EE] focus:border-[#E85D04] focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>
            )}

            {(selectedEndpoint === 'traffic-segments' || selectedEndpoint === 'buses-live') && (
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 dark:text-[#FAF5EE] mb-1">
                    Simulation Time Bucket
                  </label>
                  <select
                    value={timeBucket}
                    onChange={(e) => setTimeBucket(e.target.value as TimeBucketId)}
                    className="w-full rounded-xl border border-stone-200 dark:border-[#2E2924] bg-stone-50 dark:bg-[#12100E] px-3 py-2 text-xs font-medium text-stone-800 dark:text-[#FAF5EE] focus:border-[#E85D04] focus:outline-hidden"
                  >
                    <option value="live">Live Stream (Real-Time)</option>
                    <option value="9am_peak">9 AM Morning Peak</option>
                    <option value="2pm_offpeak">2 PM Midday Off-Peak</option>
                    <option value="6pm_rush">6 PM Evening Rush</option>
                  </select>
                </div>
              </div>
            )}

            {selectedEndpoint === 'historical' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 dark:text-[#FAF5EE] mb-1">
                    Historical Range
                  </label>
                  <select
                    value={range}
                    onChange={(e) => setRange(e.target.value as 'today' | '7d' | '30d')}
                    className="w-full rounded-xl border border-stone-200 dark:border-[#2E2924] bg-stone-50 dark:bg-[#12100E] px-3 py-2 text-xs font-medium text-stone-800 dark:text-[#FAF5EE] focus:border-[#E85D04] focus:outline-hidden"
                  >
                    <option value="today">Today (24 Hour Analysis)</option>
                    <option value="7d">Last 7 Days (Trend Blend)</option>
                    <option value="30d">Last 30 Days (Seasonality)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 dark:text-[#FAF5EE] mb-1">
                    Reference Date (YYYY-MM-DD)
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 dark:border-[#2E2924] bg-stone-50 dark:bg-[#12100E] px-3 py-2 text-xs font-medium text-stone-800 dark:text-[#FAF5EE] focus:border-[#E85D04] focus:outline-hidden"
                  />
                </div>
              </div>
            )}

            {selectedEndpoint === 'stops' && (
              <p className="text-xs text-stone-500 dark:text-[#C4B9AC]">
                No query parameters required. Returns full list of active Uttar Pradesh bus hubs, terminals, and stops.
              </p>
            )}
          </div>

          {/* Quick Integration Snippet */}
          <div className="rounded-2xl border border-stone-200 dark:border-[#2E2924] bg-white dark:bg-[#1C1916] p-4 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Code2 className="h-4 w-4 text-[#F48C06]" />
                <span className="font-display text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-[#FAF5EE]">
                  Client Integration
                </span>
              </div>
              <div className="flex items-center gap-1">
                {(['curl', 'js', 'python'] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setActiveCodeTab(lang)}
                    className={`rounded-lg px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      activeCodeTab === lang
                        ? 'bg-[#E85D04] text-white'
                        : 'text-stone-500 dark:text-[#C4B9AC] hover:bg-stone-100 dark:hover:bg-[#2E2924]'
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative mt-2">
              <pre className="max-h-40 overflow-x-auto rounded-xl border border-stone-200 dark:border-[#2E2924] bg-[#12100E] p-3 font-mono text-[11px] text-[#FAF5EE]">
                <code>{codeSnippet}</code>
              </pre>
              <button
                type="button"
                onClick={() => void handleCopyCode()}
                className="absolute right-2 top-2 rounded-lg bg-[#2E2924] px-2 py-1 text-[10px] font-semibold text-white hover:bg-[#3D3730]"
              >
                {copiedCode ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Live Response Viewer */}
        <div className="flex flex-col rounded-2xl border border-stone-200 dark:border-[#2E2924] bg-white dark:bg-[#1C1916] shadow-xs lg:col-span-7 min-h-[500px]">
          {/* Response Status Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 dark:border-[#2E2924] px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-stone-700 dark:text-[#FAF5EE]">Response</span>
              {responseStatus !== null && (
                <span
                  className={`rounded-md px-2 py-0.5 font-mono text-xs font-bold ${
                    responseStatus === 200
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                      : 'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300'
                  }`}
                >
                  {responseStatus} {responseStatus === 200 ? 'OK' : 'Error'}
                </span>
              )}
              {responseLatencyMs !== null && (
                <span className="flex items-center gap-1 font-mono text-xs text-stone-500 dark:text-[#C4B9AC]">
                  <Clock className="h-3.5 w-3.5 text-[#F48C06]" />
                  {responseLatencyMs} ms
                </span>
              )}
              {payloadSizeKb !== 0 && (
                <span className="font-mono text-xs text-stone-400 dark:text-stone-500">
                  {payloadSizeKb} KB
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleCopyResponse()}
                disabled={!responseBody}
                className="flex items-center gap-1 rounded-xl border border-stone-200 dark:border-[#2E2924] bg-stone-50 dark:bg-[#12100E] px-2.5 py-1 text-xs font-medium text-stone-700 dark:text-[#FAF5EE] hover:border-[#E85D04] hover:text-[#E85D04] disabled:opacity-40"
              >
                {copiedResponse ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy JSON</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Pretty JSON Viewer */}
          <div className="flex-1 overflow-auto p-4 bg-[#12100E] rounded-b-2xl">
            {loading ? (
              <div className="flex h-full min-h-[360px] items-center justify-center gap-2 text-stone-400">
                <RotateCcw className="h-5 w-5 animate-spin text-[#E85D04]" />
                <span className="text-xs font-mono">Querying Uttar Pradesh Traffic Model...</span>
              </div>
            ) : responseBody ? (
              <pre className="font-mono text-xs leading-relaxed text-[#FAF5EE]">
                <code>{JSON.stringify(responseBody, null, 2)}</code>
              </pre>
            ) : (
              <div className="flex h-full min-h-[360px] items-center justify-center text-xs text-stone-500">
                Click "Send Request" to fetch live JSON payload
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
