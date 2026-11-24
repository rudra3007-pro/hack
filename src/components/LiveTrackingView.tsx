import { useMemo, useState } from 'react';
import { AlertCircle, Bus, Clock, Gauge, Radio, ShieldAlert } from 'lucide-react';
import { BUS_ROUTES } from '../data/cityNetwork.ts';
import type {
  BottleneckHotspot,
  BusProbe,
  BusSensorState,
  MapLayerSettings,
  SegmentTelemetry,
} from '../types/transit.ts';
import SmartCityGoogleMap from './SmartCityGoogleMap.tsx';

interface LiveTrackingViewProps {
  buses: BusProbe[];
  segments: SegmentTelemetry[];
  hotspots: BottleneckHotspot[];
  layers: MapLayerSettings;
  onChangeLayers: (next: MapLayerSettings) => void;
  userLocation: { lat: number; lng: number } | null;
  onDetectCurrentLocation: () => void;
  lastUpdatedLabel: string;
  isDarkMode?: boolean;
}

export default function LiveTrackingView({
  buses,
  segments,
  hotspots,
  layers,
  onChangeLayers,
  userLocation,
  onDetectCurrentLocation,
  lastUpdatedLabel,
  isDarkMode = false,
}: LiveTrackingViewProps) {
  const [routeFilter, setRouteFilter] = useState<string>('ALL');
  const [stateFilter, setStateFilter] = useState<'ALL' | BusSensorState>('ALL');
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);

  const filteredBuses = useMemo(() => {
    return buses.filter((b) => {
      if (routeFilter !== 'ALL' && b.routeShortName !== routeFilter) return false;
      if (stateFilter !== 'ALL' && b.sensorState !== stateFilter) return false;
      return true;
    });
  }, [buses, routeFilter, stateFilter]);

  const jamCount = buses.filter((b) => b.sensorState === 'Stuck in Jam').length;
  const dwellCount = buses.filter((b) => b.sensorState === 'At Stop').length;
  const movingCount = buses.filter((b) => b.sensorState === 'Moving').length;

  return (
    <div className="space-y-4">
      {/* Live Status Header & DEMO Transparency Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 dark:border-[#2E2924] bg-white dark:bg-[#1C1916] p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-xl bg-[#12100E] px-3 py-1.5 text-xs font-bold text-[#FAF5EE]">
            <Radio className="h-3.5 w-3.5 text-[#F48C06] animate-pulse" />
            UP BUS-AS-SENSOR FLEET STREAM
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:text-amber-300">
            DEMO · Simulated UP AVL Telemetry
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs text-stone-500 dark:text-[#C4B9AC]">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-[#E85D04]" />
            Last GPS Sync: <strong className="font-mono text-stone-900 dark:text-[#FAF5EE]">{lastUpdatedLabel}</strong>
          </span>
        </div>
      </div>

      {/* Bus Sensor Breakdown Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-stone-200 dark:border-[#2E2924] bg-white dark:bg-[#1C1916] p-3.5">
          <p className="text-xs text-stone-500 dark:text-[#C4B9AC]">Moving Probes</p>
          <p className="mt-1 font-display text-xl font-bold text-[#52796F]">{movingCount}</p>
        </div>
        <div className="rounded-xl border border-stone-200 dark:border-[#2E2924] bg-white dark:bg-[#1C1916] p-3.5">
          <p className="text-xs text-stone-500 dark:text-[#C4B9AC]">At Stop (Filtered Dwell)</p>
          <p className="mt-1 font-display text-xl font-bold text-[#F48C06]">{dwellCount}</p>
        </div>
        <div className="rounded-xl border border-stone-200 dark:border-[#2E2924] bg-white dark:bg-[#1C1916] p-3.5">
          <p className="text-xs text-stone-500 dark:text-[#C4B9AC]">Stuck in Jam Alerts</p>
          <p className="mt-1 font-display text-xl font-bold text-[#D62828]">{jamCount}</p>
        </div>
        <div className="rounded-xl border border-stone-200 dark:border-[#2E2924] bg-white dark:bg-[#1C1916] p-3.5">
          <p className="text-xs text-stone-500 dark:text-[#C4B9AC]">Hotspot Segments</p>
          <p className="mt-1 font-display text-xl font-bold text-[#E85D04]">
            {hotspots.filter((h) => h.severity === 'heavy' || h.severity === 'severe').length}
          </p>
        </div>
      </div>

      {/* Map + Live Bus Inspector */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7 h-[520px] relative">
          <SmartCityGoogleMap
            buses={filteredBuses}
            segments={segments}
            hotspots={hotspots}
            highlightedRouteShortName={
              routeFilter !== 'ALL'
                ? routeFilter
                : buses.find((b) => b.id === selectedBusId)?.routeShortName || null
            }
            userLocation={userLocation}
            layers={layers}
            onChangeLayers={onChangeLayers}
            onDetectCurrentLocation={onDetectCurrentLocation}
            selectedBusId={selectedBusId}
            onSelectBus={(bus) =>
              setSelectedBusId((prev) => (prev === bus.id ? null : bus.id))
            }
            isDarkMode={isDarkMode}
          />
        </div>

        {/* Live Fleet Telemetry List & Filters */}
        <div className="flex h-[520px] flex-col rounded-2xl border border-stone-200 dark:border-[#2E2924] bg-white dark:bg-[#1C1916] p-4 shadow-xs lg:col-span-5">
          <div className="mb-3 space-y-2.5 border-b border-stone-100 dark:border-[#2E2924] pb-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm font-bold text-stone-900 dark:text-[#FAF5EE]">
                Active Fleet Telemetry ({filteredBuses.length})
              </h2>
              <span className="text-[11px] font-medium text-stone-500 dark:text-[#C4B9AC]">
                Click bus to inspect
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setRouteFilter('ALL')}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                  routeFilter === 'ALL'
                    ? 'bg-[#E85D04] text-white'
                    : 'bg-stone-100 dark:bg-[#2E2924] text-stone-600 dark:text-[#C4B9AC] hover:bg-stone-200'
                }`}
              >
                All Routes
              </button>
              {BUS_ROUTES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRouteFilter(r.shortName)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                    routeFilter === r.shortName
                      ? 'bg-[#E85D04] text-white'
                      : 'bg-stone-100 dark:bg-[#2E2924] text-stone-600 dark:text-[#C4B9AC] hover:bg-stone-200'
                  }`}
                >
                  {r.shortName}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(['ALL', 'Moving', 'At Stop', 'Stuck in Jam'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStateFilter(st)}
                  className={`rounded-lg border px-2 py-0.5 text-[10px] font-semibold transition ${
                    stateFilter === st
                      ? 'border-[#E85D04] bg-[#E85D04]/10 text-[#E85D04]'
                      : 'border-stone-200 dark:border-[#2E2924] bg-white dark:bg-[#12100E] text-stone-600 dark:text-[#C4B9AC] hover:bg-stone-50'
                  }`}
                >
                  {st === 'ALL' ? 'All States' : st}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto pr-1">
            {filteredBuses.map((bus) => {
              const isSelected = selectedBusId === bus.id;
              const badgeColor =
                bus.sensorState === 'Stuck in Jam'
                  ? 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border-red-200 dark:border-red-900/50'
                  : bus.sensorState === 'At Stop'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-900/50'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/50';
              return (
                <button
                  key={bus.id}
                  type="button"
                  onClick={() => setSelectedBusId(isSelected ? null : bus.id)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    isSelected
                      ? 'border-[#E85D04] bg-[#E85D04]/10 ring-1 ring-[#E85D04]'
                      : 'border-stone-200 dark:border-[#2E2924] bg-white dark:bg-[#12100E] hover:border-stone-300 hover:bg-stone-50 dark:hover:bg-[#1C1916]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E85D04] text-white">
                        <Bus className="h-3.5 w-3.5" />
                      </span>
                      <div>
                        <p className="font-mono text-xs font-bold text-stone-900 dark:text-[#FAF5EE]">
                          {bus.busId}{' '}
                          <span className="ml-1 rounded bg-[#E85D04]/15 px-1.5 py-0.5 text-[10px] text-[#E85D04]">
                            {bus.routeShortName}
                          </span>
                        </p>
                        <p className="text-[11px] text-stone-500 dark:text-[#C4B9AC]">Next: {bus.nextStopName}</p>
                      </div>
                    </div>

                    <span
                      className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${badgeColor}`}
                    >
                      {bus.sensorState}
                    </span>
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 dark:border-[#2E2924] pt-2 text-[11px] text-stone-600 dark:text-[#C4B9AC]">
                    <span className="inline-flex items-center gap-1 font-mono font-semibold text-stone-900 dark:text-[#FAF5EE]">
                      <Gauge className="h-3 w-3 text-[#E85D04]" />
                      {bus.speedKmh} km/h
                    </span>
                    <span className="font-mono text-[10px]">
                      {bus.lat.toFixed(4)}, {bus.lng.toFixed(4)}
                    </span>
                    <span className="text-[10px] text-stone-400">
                      Ping {bus.lastPingSecAgo}s ago
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Congestion Hotspot Sensor Diagnostics */}
      <div className="rounded-2xl border border-stone-200 dark:border-[#2E2924] bg-white dark:bg-[#1C1916] p-4 shadow-xs">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4.5 w-4.5 text-[#E85D04]" />
            <h3 className="font-display text-sm font-bold text-stone-900 dark:text-[#FAF5EE]">
              Uttar Pradesh Bus-Inferred Road Congestion Hotspots
            </h3>
          </div>
          <span className="text-xs text-stone-500 dark:text-[#C4B9AC]">
            Stop dwell within 45m excluded from jam alerts
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {hotspots.slice(0, 6).map((spot) => (
            <div
              key={spot.segmentId}
              className="rounded-xl border border-stone-200 dark:border-[#2E2924] bg-stone-50 dark:bg-[#12100E] p-3.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-stone-900 dark:text-[#FAF5EE]">{spot.roadName}</span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                    spot.severity === 'severe'
                      ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                      : spot.severity === 'heavy'
                        ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300'
                        : spot.severity === 'moderate'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                  }`}
                >
                  {spot.severity}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-stone-500 dark:text-[#C4B9AC]">{spot.corridorName}</p>
              <div className="mt-2.5 flex items-center justify-between text-xs">
                <span className="font-mono font-bold text-stone-900 dark:text-[#FAF5EE]">
                  {spot.fusedSpeedKmh} km/h
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-stone-500 dark:text-[#C4B9AC]">
                  <AlertCircle className="h-3 w-3 text-[#E85D04]" />
                  {spot.cause}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
