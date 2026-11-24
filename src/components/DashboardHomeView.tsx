import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bus,
  ChevronDown,
  ChevronUp,
  Filter,
  Gauge,
  MapPin,
  Navigation,
  Route,
  X,
} from 'lucide-react';
import { BUS_ROUTES, QUICK_CORRIDOR_PRESETS, TRANSIT_STOPS } from '../data/cityNetwork.ts';
import type {
  BottleneckHotspot,
  BusProbe,
  JourneyOption,
  MapLayerSettings,
  SegmentTelemetry,
  TrafficSegmentsApiResponse,
  TransitStop,
  TravelTimeApiResponse,
} from '../types/transit.ts';
import PlaceSearchInput, { type SelectedLocationValue } from './PlaceSearchInput.tsx';
import SmartCityGoogleMap from './SmartCityGoogleMap.tsx';

interface DashboardHomeViewProps {
  buses: BusProbe[];
  trafficData: TrafficSegmentsApiResponse | null;
  layers: MapLayerSettings;
  onChangeLayers: (next: MapLayerSettings) => void;
  userLocation: { lat: number; lng: number } | null;
  onDetectCurrentLocation: () => void;
  onOpenJourneyWithPoints: (
    origin: { label: string; stopId?: string; lat: number; lng: number },
    destination: { label: string; stopId?: string; lat: number; lng: number }
  ) => void;
  onOpenLiveTracking: () => void;
  isDarkMode?: boolean;
}

export default function DashboardHomeView({
  buses,
  trafficData,
  layers,
  onChangeLayers,
  userLocation,
  onDetectCurrentLocation,
  onOpenJourneyWithPoints,
  onOpenLiveTracking,
  isDarkMode = false,
}: DashboardHomeViewProps) {
  // Default to Lucknow UP Hubs
  const [originVal, setOriginVal] = useState<SelectedLocationValue>({
    label: 'Charbagh Railway Station (Lucknow Central)',
    stopId: 'charbagh-nr',
    lat: 26.8322,
    lng: 80.9197,
    source: 'stop',
  });
  const [destVal, setDestVal] = useState<SelectedLocationValue>({
    label: 'Gomti Nagar IT & High Court',
    stopId: 'gomti-nagar',
    lat: 26.8598,
    lng: 81.0068,
    source: 'stop',
  });

  // Active map route highlight state (either a specific UP Bus Route or a computed Origin->Dest journey)
  const [highlightedRoute, setHighlightedRoute] = useState<string | null>(null);
  const [previewJourney, setPreviewJourney] = useState<JourneyOption | null>(null);
  const [showOriginDestHighlight, setShowOriginDestHighlight] = useState(false);

  // Collapsible bottom-right intel panel
  const [intelDrawerOpen, setIntelDrawerOpen] = useState(false);
  const [activeIntelTab, setActiveIntelTab] = useState<'hotspots' | 'fleet'>('hotspots');

  const segments: SegmentTelemetry[] = trafficData?.segments || [];
  const hotspots: BottleneckHotspot[] = trafficData?.hotspots || [];
  const summary = trafficData?.summary;

  useEffect(() => {
    if (!showOriginDestHighlight || highlightedRoute) {
      setPreviewJourney(null);
      return;
    }
    let cancelled = false;
    const oParam = originVal.stopId || `${originVal.lat},${originVal.lng}`;
    const dParam = destVal.stopId || `${destVal.lat},${destVal.lng}`;
    fetch(
      `/api/v1/travel-time?origin=${encodeURIComponent(oParam)}&destination=${encodeURIComponent(dParam)}`
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data: TravelTimeApiResponse | null) => {
        if (!cancelled && data && data.journeys.length > 0) {
          setPreviewJourney(data.journeys[0]);
        }
      })
      .catch(() => {
        // Ignore transient network errors
      });
    return () => {
      cancelled = true;
    };
  }, [originVal, destVal, showOriginDestHighlight, highlightedRoute]);

  const handleStopAsOrigin = (stop: TransitStop) => {
    setHighlightedRoute(null);
    setOriginVal({
      label: stop.name,
      stopId: stop.id,
      lat: stop.lat,
      lng: stop.lng,
      source: 'stop',
    });
    setShowOriginDestHighlight(true);
  };

  const handleStopAsDest = (stop: TransitStop) => {
    setHighlightedRoute(null);
    setDestVal({
      label: stop.name,
      stopId: stop.id,
      lat: stop.lat,
      lng: stop.lng,
      source: 'stop',
    });
    setShowOriginDestHighlight(true);
  };

  const handleSelectBusRoute = (shortName: string) => {
    setShowOriginDestHighlight(false);
    setPreviewJourney(null);
    setHighlightedRoute((prev) => (prev === shortName ? null : shortName));
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded-2xl">
      {/* 1. Full-Height Panoramic City Map Container */}
      <div className="relative h-full w-full flex-1 min-h-[500px]">
        <SmartCityGoogleMap
          buses={buses}
          segments={segments}
          hotspots={hotspots}
          selectedJourney={previewJourney}
          highlightedRouteShortName={highlightedRoute}
          originCoords={showOriginDestHighlight ? originVal : null}
          destinationCoords={showOriginDestHighlight ? destVal : null}
          userLocation={userLocation}
          layers={layers}
          onChangeLayers={onChangeLayers}
          onDetectCurrentLocation={onDetectCurrentLocation}
          onSetOriginStop={handleStopAsOrigin}
          onSetDestinationStop={handleStopAsDest}
          isDarkMode={isDarkMode}
        />

        {/* 2. Sleek Floating Command Header (Top-Left) */}
        <div className="absolute left-3 top-3 z-20 max-w-2xl w-[calc(100%-74px)] sm:w-auto">
          <div className="rounded-2xl border border-stone-200/90 dark:border-[#2E2924] bg-white/92 dark:bg-[#1C1916]/92 p-3 shadow-xl backdrop-blur-md transition-all">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex-1 min-w-[170px]">
                <PlaceSearchInput
                  placeholder="Origin (e.g. Alambagh ISBT)..."
                  value={originVal.label}
                  onSelectLocation={(loc) => {
                    setHighlightedRoute(null);
                    setOriginVal(loc);
                    setShowOriginDestHighlight(true);
                  }}
                  showCurrentLocationBtn
                  onUseCurrentLocation={() => {
                    onDetectCurrentLocation();
                    if (userLocation) {
                      setHighlightedRoute(null);
                      setOriginVal({
                        label: 'My Current Location',
                        lat: userLocation.lat,
                        lng: userLocation.lng,
                        source: 'gps',
                      });
                      setShowOriginDestHighlight(true);
                    }
                  }}
                  compact
                />
              </div>

              <div className="flex-1 min-w-[170px]">
                <PlaceSearchInput
                  placeholder="Destination (e.g. Gomti Nagar)..."
                  value={destVal.label}
                  onSelectLocation={(loc) => {
                    setHighlightedRoute(null);
                    setDestVal(loc);
                    setShowOriginDestHighlight(true);
                  }}
                  compact
                />
              </div>

              <button
                type="button"
                onClick={() => onOpenJourneyWithPoints(originVal, destVal)}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#E85D04] to-[#F48C06] px-4 py-2 text-xs font-bold text-white shadow-md shadow-orange-950/20 transition hover:brightness-110 active:scale-95 shrink-0"
              >
                <Navigation className="h-3.5 w-3.5" />
                <span>Plan Route</span>
              </button>
            </div>

            {/* Highlight UP Bus Route Pills */}
            <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-[#C4B9AC] shrink-0">
                <Route className="h-3 w-3 text-[#E85D04]" />
                Highlight Route:
              </span>
              {BUS_ROUTES.map((rt) => {
                const isActive = highlightedRoute === rt.shortName;
                return (
                  <button
                    key={rt.id}
                    type="button"
                    onClick={() => handleSelectBusRoute(rt.shortName)}
                    className={`rounded-lg border px-2 py-0.5 font-mono text-[10px] font-bold transition shrink-0 ${
                      isActive
                        ? 'border-[#E85D04] bg-[#E85D04] text-white shadow-xs'
                        : 'border-stone-200 dark:border-[#2E2924] bg-stone-50 dark:bg-[#12100E] text-stone-700 dark:text-[#C4B9AC] hover:border-[#E85D04] hover:text-[#E85D04]'
                    }`}
                    title={rt.name}
                  >
                    {rt.shortName}
                  </button>
                );
              })}
            </div>

            {/* Quick Corridor Filter Pills */}
            <div className="mt-1.5 flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-[#C4B9AC] shrink-0">
                UP Corridors:
              </span>
              {QUICK_CORRIDOR_PRESETS.map((preset) => {
                const oStop = TRANSIT_STOPS.find((s) => s.id === preset.origin);
                const dStop = TRANSIT_STOPS.find((s) => s.id === preset.destination);
                const isSelectedPreset =
                  showOriginDestHighlight &&
                  originVal.stopId === preset.origin &&
                  destVal.stopId === preset.destination;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setHighlightedRoute(null);
                      if (oStop) {
                        setOriginVal({
                          label: oStop.name,
                          stopId: oStop.id,
                          lat: oStop.lat,
                          lng: oStop.lng,
                          source: 'stop',
                        });
                      }
                      if (dStop) {
                        setDestVal({
                          label: dStop.name,
                          stopId: dStop.id,
                          lat: dStop.lat,
                          lng: dStop.lng,
                          source: 'stop',
                        });
                      }
                      setShowOriginDestHighlight(true);
                    }}
                    className={`rounded-lg border px-2 py-0.5 text-[10px] font-medium transition shrink-0 ${
                      isSelectedPreset
                        ? 'border-[#E85D04] bg-[#E85D04]/15 text-[#E85D04] font-bold'
                        : 'border-stone-200 dark:border-[#2E2924] bg-stone-50 dark:bg-[#12100E] text-stone-700 dark:text-[#C4B9AC] hover:border-[#E85D04] hover:text-[#E85D04]'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {/* Active Highlight Indicator Banner */}
            {(highlightedRoute || previewJourney) && (
              <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-[#E85D04]/30 bg-[#E85D04]/10 px-2.5 py-1.5 text-[11px]">
                <span className="font-semibold text-stone-900 dark:text-[#FAF5EE] truncate">
                  {highlightedRoute ? (
                    <>
                      Highlighting <strong className="font-mono text-[#E85D04]">{highlightedRoute}</strong>{' '}
                      — {BUS_ROUTES.find((r) => r.shortName === highlightedRoute)?.name}
                    </>
                  ) : (
                    <>
                      Selected Corridor: <strong className="text-[#E85D04]">{previewJourney?.title}</strong> (
                      {previewJourney?.predictedMin} min)
                    </>
                  )}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {previewJourney && (
                    <button
                      type="button"
                      onClick={() => onOpenJourneyWithPoints(originVal, destVal)}
                      className="rounded-lg bg-[#E85D04] px-2 py-0.5 text-[10px] font-bold text-white hover:bg-[#D65202]"
                    >
                      Details
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setHighlightedRoute(null);
                      setShowOriginDestHighlight(false);
                      setPreviewJourney(null);
                    }}
                    className="inline-flex items-center gap-0.5 rounded-lg border border-stone-300 dark:border-[#2E2924] bg-white dark:bg-[#12100E] px-1.5 py-0.5 text-[10px] font-semibold text-stone-600 dark:text-[#C4B9AC] hover:text-[#E85D04]"
                  >
                    <X className="h-3 w-3" /> Clear
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 3. Floating Micro-Metrics Glass Ribbon (Bottom-Left) */}
        <div className="absolute left-3 bottom-3 z-20 flex flex-wrap items-center gap-2 max-w-3xl">
          <div className="flex items-center gap-2.5 rounded-2xl border border-stone-200/90 dark:border-[#2E2924] bg-white/90 dark:bg-[#1C1916]/90 px-3.5 py-2 shadow-lg backdrop-blur-md">
            <div className="flex items-center gap-1.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#E85D04]/10 text-[#E85D04]">
                <Bus className="h-3.5 w-3.5" />
              </span>
              <div>
                <span className="font-mono text-xs font-bold text-stone-900 dark:text-[#FAF5EE]">
                  {summary?.active_bus_sensors ?? buses.length}
                </span>
                <span className="text-[10px] text-stone-500 dark:text-[#C4B9AC] ml-1">
                  Active UP Probes
                </span>
              </div>
            </div>

            <span className="h-4 w-px bg-stone-300 dark:bg-[#2E2924]" />

            <div className="flex items-center gap-1.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#F48C06]/10 text-[#F48C06]">
                <Gauge className="h-3.5 w-3.5" />
              </span>
              <div>
                <span className="font-mono text-xs font-bold text-stone-900 dark:text-[#FAF5EE]">
                  {summary?.avg_corridor_speed_kmh ?? 26.4} km/h
                </span>
                <span className="text-[10px] text-stone-500 dark:text-[#C4B9AC] ml-1">
                  Avg Speed
                </span>
              </div>
            </div>

            <span className="h-4 w-px bg-stone-300 dark:bg-[#2E2924]" />

            <div className="flex items-center gap-1.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#D62828]/10 text-[#D62828]">
                <AlertTriangle className="h-3.5 w-3.5" />
              </span>
              <div>
                <span className="font-mono text-xs font-bold text-stone-900 dark:text-[#FAF5EE]">
                  {summary?.detected_bottlenecks ?? hotspots.length}
                </span>
                <span className="text-[10px] text-stone-500 dark:text-[#C4B9AC] ml-1">
                  Bottlenecks
                </span>
              </div>
            </div>

            <span className="h-4 w-px bg-stone-300 dark:bg-[#2E2924]" />

            <div className="hidden sm:flex items-center gap-1.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#52796F]/10 text-[#52796F]">
                <Filter className="h-3.5 w-3.5" />
              </span>
              <div>
                <span className="font-mono text-xs font-bold text-stone-900 dark:text-[#FAF5EE]">
                  {summary?.at_stop_filtered_count ?? 6}
                </span>
                <span className="text-[10px] text-stone-500 dark:text-[#C4B9AC] ml-1">
                  Dwells Filtered
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Floating Expandable Traffic Intel Drawer (Bottom-Right) */}
        <div className="absolute right-3 bottom-3 z-20 w-80 sm:w-96">
          <div className="rounded-2xl border border-stone-200/90 dark:border-[#2E2924] bg-white/95 dark:bg-[#1C1916]/95 shadow-xl backdrop-blur-md transition-all">
            {/* Drawer Header Toggle */}
            <div
              onClick={() => setIntelDrawerOpen((o) => !o)}
              className="flex items-center justify-between p-3 cursor-pointer select-none border-b border-stone-100 dark:border-[#2E2924]"
            >
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E85D04] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#E85D04]" />
                </span>
                <span className="font-display text-xs font-bold text-stone-900 dark:text-[#FAF5EE]">
                  UP Corridor Traffic Intel
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="rounded bg-amber-100 dark:bg-amber-950/40 px-1.5 py-0.5 text-[9px] font-bold text-[#E85D04]">
                  DEMO SENSORS
                </span>
                <button
                  type="button"
                  className="rounded-lg p-1 text-stone-500 hover:text-stone-900 dark:hover:text-white"
                >
                  {intelDrawerOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Expanded Drawer Content */}
            {intelDrawerOpen && (
              <div className="p-3 space-y-3 max-h-72 overflow-y-auto">
                <div className="flex items-center gap-1 rounded-xl bg-stone-100 dark:bg-[#12100E] p-1">
                  <button
                    type="button"
                    onClick={() => setActiveIntelTab('hotspots')}
                    className={`flex-1 rounded-lg py-1 text-center text-[10px] font-semibold transition ${
                      activeIntelTab === 'hotspots'
                        ? 'bg-[#E85D04] text-white'
                        : 'text-stone-600 dark:text-[#C4B9AC]'
                    }`}
                  >
                    Hotspots ({hotspots.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveIntelTab('fleet')}
                    className={`flex-1 rounded-lg py-1 text-center text-[10px] font-semibold transition ${
                      activeIntelTab === 'fleet'
                        ? 'bg-[#E85D04] text-white'
                        : 'text-stone-600 dark:text-[#C4B9AC]'
                    }`}
                  >
                    Active Fleet ({buses.length})
                  </button>
                </div>

                {activeIntelTab === 'hotspots' ? (
                  <div className="space-y-2">
                    {hotspots.slice(0, 4).map((spot) => (
                      <div
                        key={spot.segmentId}
                        className="rounded-xl border border-stone-200 dark:border-[#2E2924] bg-stone-50 dark:bg-[#12100E] p-2.5"
                      >
                        <div className="flex items-center justify-between text-xs font-bold text-stone-800 dark:text-[#FAF5EE]">
                          <span className="truncate">{spot.roadName}</span>
                          <span
                            className={`rounded px-1.5 py-0.2 text-[9px] font-bold uppercase ${
                              spot.severity === 'severe'
                                ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                                : spot.severity === 'heavy'
                                  ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300'
                                  : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                            }`}
                          >
                            {spot.severity}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[11px] text-stone-500 dark:text-[#C4B9AC]">
                          <span className="font-mono font-semibold text-[#E85D04]">
                            {spot.fusedSpeedKmh} km/h
                          </span>
                          <span className="text-[10px]">{spot.cause}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {buses.slice(0, 4).map((b) => (
                      <div
                        key={b.id}
                        onClick={() => handleSelectBusRoute(b.routeShortName)}
                        className="cursor-pointer flex items-center justify-between rounded-xl border border-stone-200 dark:border-[#2E2924] bg-stone-50 dark:bg-[#12100E] p-2 text-xs hover:border-[#E85D04]"
                      >
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-[#E85D04]" />
                          <div>
                            <p className="font-mono font-bold text-stone-900 dark:text-[#FAF5EE]">{b.busId}</p>
                            <p className="text-[10px] text-stone-400">{b.routeShortName}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-semibold text-[#F48C06]">{b.speedKmh} km/h</p>
                          <p className="text-[10px] text-stone-400">{b.sensorState}</p>
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={onOpenLiveTracking}
                      className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-[#E85D04] py-2 text-xs font-semibold text-white hover:bg-[#D65202] transition"
                    >
                      <span>Open Full Telemetry Grid</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
