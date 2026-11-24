import { Activity, AlertTriangle, Bus, Gauge, Layers, Route, TrendingUp } from 'lucide-react';
import type {
  BusProbe,
  FlowStatus,
  MapLayerSettings,
  SegmentTelemetry,
  TrafficSegmentsApiResponse,
} from '../types/transit.ts';
import SmartCityGoogleMap from './SmartCityGoogleMap.tsx';

interface TrafficAnalyticsViewProps {
  buses: BusProbe[];
  trafficData: TrafficSegmentsApiResponse | null;
  layers: MapLayerSettings;
  onChangeLayers: (next: MapLayerSettings) => void;
  userLocation: { lat: number; lng: number } | null;
  onDetectCurrentLocation: () => void;
  isDarkMode?: boolean;
}

const FLOW_HEX: Record<FlowStatus, string> = {
  smooth: '#52796F',
  moderate: '#F48C06',
  heavy: '#E85D04',
  severe: '#D62828',
};

export default function TrafficAnalyticsView({
  buses,
  trafficData,
  layers,
  onChangeLayers,
  userLocation,
  onDetectCurrentLocation,
  isDarkMode = false,
}: TrafficAnalyticsViewProps) {
  const summary = trafficData?.summary;
  const segments: SegmentTelemetry[] = trafficData?.segments || [];
  const hotspots = trafficData?.hotspots || [];

  const mostCongested = [...segments]
    .sort((a, b) => a.fusedSpeedKmh - b.fusedSpeedKmh)
    .slice(0, 8);

  return (
    <div className="space-y-5">
      {/* City-Wide KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-stone-200 dark:border-[#2E2924] bg-white dark:bg-[#1C1916] p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-[#C4B9AC]">
              Total Tracked Buses
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E85D04]/10 text-[#E85D04]">
              <Bus className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-2 font-display text-3xl font-extrabold text-stone-900 dark:text-[#FAF5EE]">
            {summary?.active_bus_sensors ?? buses.length}
          </p>
          <p className="mt-1 text-xs text-stone-500 dark:text-[#C4B9AC]">UP transit fleet sensors online</p>
        </div>

        <div className="rounded-2xl border border-stone-200 dark:border-[#2E2924] bg-white dark:bg-[#1C1916] p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-[#C4B9AC]">
              Active Bus Routes
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F48C06]/10 text-[#F48C06]">
              <Route className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-2 font-display text-3xl font-extrabold text-stone-900 dark:text-[#FAF5EE]">
            {summary?.active_routes_count ?? 6}
          </p>
          <p className="mt-1 text-xs text-stone-500 dark:text-[#C4B9AC]">Janrath, EV Ring &amp; Feeder corridors</p>
        </div>

        <div className="rounded-2xl border border-stone-200 dark:border-[#2E2924] bg-white dark:bg-[#1C1916] p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-[#C4B9AC]">
              Average Bus Speed
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#52796F]/10 text-[#52796F]">
              <Gauge className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-2 font-display text-3xl font-extrabold text-stone-900 dark:text-[#FAF5EE]">
            {summary?.avg_corridor_speed_kmh ?? 26.5}{' '}
            <span className="text-base font-semibold text-stone-400">km/h</span>
          </p>
          <p className="mt-1 text-xs text-stone-500 dark:text-[#C4B9AC]">70% live probes / 30% historical prior</p>
        </div>

        <div className="rounded-2xl border border-stone-200 dark:border-[#2E2924] bg-white dark:bg-[#1C1916] p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-[#C4B9AC]">
              Congestion Hotspots
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10 text-[#D62828]">
              <AlertTriangle className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-2 font-display text-3xl font-extrabold text-[#D62828]">
            {summary?.detected_bottlenecks ?? hotspots.length}
          </p>
          <p className="mt-1 text-xs text-stone-500 dark:text-[#C4B9AC]">Excludes stop dwell time &lt;45m</p>
        </div>
      </div>

      {/* City Heatmap & Most Congested Split */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="h-[460px] rounded-2xl border border-stone-200 dark:border-[#2E2924] bg-white dark:bg-[#1C1916] p-4 shadow-xs lg:col-span-7 flex flex-col">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-4.5 w-4.5 text-[#E85D04]" />
              <h2 className="font-display text-base font-bold text-stone-900 dark:text-[#FAF5EE]">
                Uttar Pradesh Road Congestion Network
              </h2>
            </div>
            <span className="text-xs text-stone-500 dark:text-[#C4B9AC]">Live Corridor Sensor Overlay</span>
          </div>
          <div className="flex-1 min-h-0">
            <SmartCityGoogleMap
              buses={buses}
              segments={segments}
              hotspots={hotspots}
              userLocation={userLocation}
              layers={{ ...layers, showHeatmap: true }}
              onChangeLayers={onChangeLayers}
              onDetectCurrentLocation={onDetectCurrentLocation}
              isDarkMode={isDarkMode}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200 dark:border-[#2E2924] bg-white dark:bg-[#1C1916] p-5 shadow-xs lg:col-span-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4.5 w-4.5 text-[#E85D04]" />
              <h2 className="font-display text-base font-bold text-stone-900 dark:text-[#FAF5EE]">
                Most Congested Roads
              </h2>
            </div>
            <span className="text-xs text-stone-500 dark:text-[#C4B9AC]">Live vs Historical</span>
          </div>

          <div className="space-y-3">
            {mostCongested.map((item) => {
              const ratioPct = Math.min(
                100,
                Math.round((item.fusedSpeedKmh / item.segment.freeFlowKmh) * 100)
              );
              const color = FLOW_HEX[item.flowStatus];
              return (
                <div key={item.segment.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-stone-900 dark:text-[#FAF5EE]">{item.segment.name}</p>
                      <p className="text-[10px] text-stone-500 dark:text-[#C4B9AC]">
                        {item.segment.corridor} · {item.segment.causeTag}
                      </p>
                    </div>
                    <div className="text-right font-mono">
                      <p className="font-bold text-stone-900 dark:text-[#FAF5EE]">{item.fusedSpeedKmh} km/h</p>
                      <p className="text-[10px] text-stone-500 dark:text-[#C4B9AC]">
                        Hist {item.historicalSpeedKmh} ({item.speedDeltaPct >= 0 ? '+' : ''}
                        {item.speedDeltaPct}%)
                      </p>
                    </div>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100 dark:bg-[#12100E]">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${ratioPct}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Live vs Historical Corridor Comparison Chart */}
      <div className="rounded-2xl border border-stone-200 dark:border-[#2E2924] bg-white dark:bg-[#1C1916] p-5 shadow-xs">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-bold text-stone-900 dark:text-[#FAF5EE]">
              Live vs. Historical Traffic Speed Comparison
            </h2>
            <p className="text-xs text-stone-500 dark:text-[#C4B9AC]">
              Comparing live fused bus probe speed against historical baseline across Uttar Pradesh corridors
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium">
            <span className="inline-flex items-center gap-1.5 text-stone-700 dark:text-[#FAF5EE]">
              <span className="h-3 w-3 rounded bg-[#E85D04]" /> Live Fused Speed
            </span>
            <span className="inline-flex items-center gap-1.5 text-stone-500 dark:text-[#C4B9AC]">
              <span className="h-3 w-3 rounded bg-stone-300 dark:bg-stone-700" /> Historical Baseline
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8 pt-2">
          {mostCongested.map((item) => {
            const liveHeight = Math.min(100, Math.round((item.fusedSpeedKmh / 75) * 100));
            const histHeight = Math.min(100, Math.round((item.historicalSpeedKmh / 75) * 100));
            return (
              <div
                key={item.segment.id}
                className="flex flex-col items-center rounded-xl border border-stone-100 dark:border-[#2E2924] bg-stone-50/70 dark:bg-[#12100E]/70 p-3"
              >
                <div className="flex h-36 w-full items-end justify-center gap-2 border-b border-stone-200 dark:border-[#2E2924] pb-2">
                  <div
                    className="w-4 rounded-t-md bg-[#E85D04] transition-all duration-500"
                    style={{ height: `${liveHeight}%` }}
                    title={`Live: ${item.fusedSpeedKmh} km/h`}
                  />
                  <div
                    className="w-4 rounded-t-md bg-stone-300 dark:bg-stone-700 transition-all duration-500"
                    style={{ height: `${histHeight}%` }}
                    title={`Historical: ${item.historicalSpeedKmh} km/h`}
                  />
                </div>
                <p className="mt-2 text-center text-[10px] font-bold text-stone-800 dark:text-[#FAF5EE] line-clamp-2">
                  {item.segment.name}
                </p>
                <p className="mt-0.5 font-mono text-[10px] text-stone-500 dark:text-[#C4B9AC]">
                  {item.fusedSpeedKmh}/{item.historicalSpeedKmh} km/h
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
