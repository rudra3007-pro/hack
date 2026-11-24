import { useEffect, useState } from 'react';
import {
  ArrowUpDown,
  Bookmark,
  Check,
  Clock,
  Footprints,
  Navigation,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { QUICK_CORRIDOR_PRESETS, TRANSIT_STOPS } from '../data/cityNetwork.ts';
import type {
  BusProbe,
  JourneyOption,
  MapLayerSettings,
  SegmentTelemetry,
  TimeBucketId,
  TravelTimeApiResponse,
} from '../types/transit.ts';
import PlaceSearchInput, { type SelectedLocationValue } from './PlaceSearchInput.tsx';
import SmartCityGoogleMap from './SmartCityGoogleMap.tsx';

interface JourneyPlannerViewProps {
  buses: BusProbe[];
  segments: SegmentTelemetry[];
  timeBucket: TimeBucketId;
  layers: MapLayerSettings;
  onChangeLayers: (next: MapLayerSettings) => void;
  userLocation: { lat: number; lng: number } | null;
  onDetectCurrentLocation: () => void;
  initialOrigin: SelectedLocationValue;
  initialDestination: SelectedLocationValue;
  onSaveJourney: (journey: JourneyOption, originLabel: string, destLabel: string, originId: string, destId: string) => Promise<void>;
  isDarkMode?: boolean;
}

export default function JourneyPlannerView({
  buses,
  segments,
  timeBucket,
  layers,
  onChangeLayers,
  userLocation,
  onDetectCurrentLocation,
  initialOrigin,
  initialDestination,
  onSaveJourney,
  isDarkMode = false,
}: JourneyPlannerViewProps) {
  const [originLoc, setOriginLoc] = useState<SelectedLocationValue>(initialOrigin);
  const [destLoc, setDestLoc] = useState<SelectedLocationValue>(initialDestination);
  const [departAt, setDepartAt] = useState<string>('now');
  const [customTime, setCustomTime] = useState<string>('09:00');
  const [planResult, setPlanResult] = useState<TravelTimeApiResponse | null>(null);
  const [selectedJourneyId, setSelectedJourneyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [savedNoticeId, setSavedNoticeId] = useState<string | null>(null);
  const [googleRouteMetrics, setGoogleRouteMetrics] = useState<{
    distanceMeters: number;
    durationSeconds: number;
  } | null>(null);

  useEffect(() => {
    setOriginLoc(initialOrigin);
  }, [initialOrigin.label, initialOrigin.stopId, initialOrigin.lat, initialOrigin.lng]);

  useEffect(() => {
    setDestLoc(initialDestination);
  }, [
    initialDestination.label,
    initialDestination.stopId,
    initialDestination.lat,
    initialDestination.lng,
  ]);

  const toQueryToken = (loc: SelectedLocationValue): string =>
    loc.stopId ? loc.stopId : `${loc.lat.toFixed(5)},${loc.lng.toFixed(5)}`;

  useEffect(() => {
    let cancelled = false;
    const fetchPlan = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          origin: toQueryToken(originLoc),
          destination: toQueryToken(destLoc),
          time_bucket: timeBucket,
          depart_at: departAt === 'now' ? 'now' : customTime,
        });
        const res = await fetch(`/api/v1/travel-time?${params.toString()}`);
        if (!res.ok) return;
        const data: TravelTimeApiResponse = await res.json();
        if (!cancelled) {
          setPlanResult(data);
          setSelectedJourneyId(data.journeys[0]?.id || null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetchPlan();
    return () => {
      cancelled = true;
    };
  }, [
    originLoc.stopId,
    originLoc.lat,
    originLoc.lng,
    destLoc.stopId,
    destLoc.lat,
    destLoc.lng,
    timeBucket,
    departAt,
    customTime,
  ]);

  const journeys = planResult?.journeys || [];
  const selectedJourney =
    journeys.find((j) => j.id === selectedJourneyId) || journeys[0] || null;

  // Identify least congested route option
  const leastCongestedId = useMemoId(journeys);

  const handleSwap = () => {
    const tmp = originLoc;
    setOriginLoc(destLoc);
    setDestLoc(tmp);
  };

  const handleUseCurrentLocation = () => {
    onDetectCurrentLocation();
    if (userLocation) {
      setOriginLoc({
        label: 'Current GPS Location',
        lat: userLocation.lat,
        lng: userLocation.lng,
        source: 'gps',
      });
    } else {
      // Fallback prompt if browser geolocation is still resolving
      navigator.geolocation?.getCurrentPosition(
        (pos) => {
          setOriginLoc({
            label: 'Current GPS Location',
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            source: 'gps',
          });
        },
        () => {
          setOriginLoc({
            label: 'Charbagh Railway Station (Lucknow Central)',
            stopId: 'charbagh-nr',
            lat: 26.8322,
            lng: 80.9197,
            source: 'stop',
          });
        }
      );
    }
  };

  const handleSave = async (journey: JourneyOption) => {
    await onSaveJourney(
      journey,
      originLoc.label,
      destLoc.label,
      toQueryToken(originLoc),
      toQueryToken(destLoc)
    );
    setSavedNoticeId(journey.id);
    setTimeout(() => setSavedNoticeId(null), 2200);
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 min-h-[600px]">
      {/* Left Planner Controls & Route Options */}
      <div className="flex flex-col gap-4 lg:col-span-5">
        <div className="rounded-2xl border border-stone-200 dark:border-[#2E2924] bg-white dark:bg-[#1C1916] p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-stone-900 dark:text-[#FAF5EE]">
              Plan Public Bus Journey
            </h2>
            <button
              type="button"
              onClick={handleSwap}
              className="inline-flex items-center gap-1 rounded-lg border border-stone-200 dark:border-[#2E2924] bg-stone-50 dark:bg-[#12100E] px-2.5 py-1 text-[11px] font-semibold text-stone-700 dark:text-[#C4B9AC] hover:bg-stone-100 dark:hover:bg-[#1C1916]"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              Swap
            </button>
          </div>

          <PlaceSearchInput
            label="Starting Point"
            placeholder="Search stop, address, or use current GPS"
            value={originLoc.label}
            onSelectLocation={setOriginLoc}
            showCurrentLocationBtn
            onUseCurrentLocation={handleUseCurrentLocation}
          />

          <PlaceSearchInput
            label="Destination"
            placeholder="Search destination stop or landmark"
            value={destLoc.label}
            onSelectLocation={setDestLoc}
          />

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setDepartAt('now')}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                  departAt === 'now'
                    ? 'bg-[#E85D04] text-white'
                    : 'bg-stone-100 dark:bg-[#2E2924] text-stone-600 dark:text-[#C4B9AC] hover:bg-stone-200'
                }`}
              >
                Depart Now
              </button>
              <button
                type="button"
                onClick={() => setDepartAt('custom')}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                  departAt === 'custom'
                    ? 'bg-[#E85D04] text-white'
                    : 'bg-stone-100 dark:bg-[#2E2924] text-stone-600 dark:text-[#C4B9AC] hover:bg-stone-200'
                }`}
              >
                Schedule Time
              </button>
              {departAt === 'custom' && (
                <input
                  type="time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  className="rounded-lg border border-stone-200 dark:border-[#2E2924] bg-stone-50 dark:bg-[#12100E] px-2 py-1 text-xs font-mono text-stone-800 dark:text-[#FAF5EE]"
                />
              )}
            </div>

            {googleRouteMetrics && (
              <span className="text-[11px] font-mono text-stone-500 dark:text-[#C4B9AC]">
                Road path: {(googleRouteMetrics.distanceMeters / 1000).toFixed(1)} km
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1 border-t border-stone-100 dark:border-[#2E2924]">
            {QUICK_CORRIDOR_PRESETS.map((p) => {
              const o = TRANSIT_STOPS.find((s) => s.id === p.origin);
              const d = TRANSIT_STOPS.find((s) => s.id === p.destination);
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    setOriginLoc({
                      label: o?.name || p.origin,
                      stopId: p.origin,
                      lat: o?.lat || 26.8322,
                      lng: o?.lng || 80.9197,
                      source: 'stop',
                    });
                    setDestLoc({
                      label: d?.name || p.destination,
                      stopId: p.destination,
                      lat: d?.lat || 26.8598,
                      lng: d?.lng || 81.0068,
                      source: 'stop',
                    });
                  }}
                  className="rounded-lg border border-stone-200 dark:border-[#2E2924] bg-stone-50 dark:bg-[#12100E] px-2 py-1 text-[10px] font-medium text-stone-600 dark:text-[#C4B9AC] hover:border-[#E85D04] hover:text-[#E85D04]"
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Route Comparison Options */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="font-display text-sm font-bold text-stone-900 dark:text-[#FAF5EE]">
              Available Bus Routes ({journeys.length})
            </h3>
            {loading && <span className="text-xs text-[#E85D04] font-medium">Calculating...</span>}
          </div>

          {journeys.map((journey, idx) => {
            const isSelected = selectedJourney?.id === journey.id;
            const isFastest = idx === 0;
            const isLeastCongested = journey.id === leastCongestedId;

            return (
              <div
                key={journey.id}
                onClick={() => setSelectedJourneyId(journey.id)}
                className={`cursor-pointer rounded-2xl border bg-white dark:bg-[#1C1916] p-4 transition ${
                  isSelected
                    ? 'border-[#E85D04] ring-2 ring-[#E85D04]/20 shadow-md'
                    : 'border-stone-200 dark:border-[#2E2924] hover:border-stone-300 dark:hover:border-stone-700 shadow-xs'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      {isSelected && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-[#E85D04] px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                          <Navigation className="h-2.5 w-2.5" />
                          HIGHLIGHTED ON MAP
                        </span>
                      )}
                      {isFastest && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 dark:bg-amber-950/40 px-2 py-0.5 text-[10px] font-bold text-[#E85D04]">
                          <Sparkles className="h-3 w-3" />
                          Fastest
                        </span>
                      )}
                      {isLeastCongested && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 dark:bg-emerald-950/40 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                          <ShieldCheck className="h-3 w-3" />
                          Least Congested
                        </span>
                      )}
                      <span className="rounded-md bg-stone-100 dark:bg-[#2E2924] px-2 py-0.5 text-[10px] font-semibold text-stone-700 dark:text-[#C4B9AC]">
                        {journey.transfers === 0
                          ? 'Direct'
                          : `${journey.transfers} Transfer${journey.transfers > 1 ? 's' : ''}`}
                      </span>
                    </div>
                    <h4 className="font-display text-sm font-bold text-stone-900 dark:text-[#FAF5EE]">
                      {journey.title}
                    </h4>
                  </div>

                  <div className="text-right">
                    <p className="font-display text-xl font-extrabold text-[#E85D04]">
                      {journey.predictedMin} min
                    </p>
                    <p className="font-mono text-[10px] text-stone-400">
                      Range {journey.predictedRangeMin[0]}–{journey.predictedRangeMin[1]}m
                    </p>
                  </div>
                </div>

                {/* Metrics Row */}
                <div className="mt-3 grid grid-cols-4 gap-2 rounded-xl bg-stone-50 dark:bg-[#12100E] border border-stone-100 dark:border-[#2E2924] p-2.5 text-[11px]">
                  <div>
                    <p className="text-[10px] text-stone-400 dark:text-[#C4B9AC]">Distance</p>
                    <p className="font-mono font-bold text-stone-800 dark:text-[#FAF5EE]">
                      {journey.totalDistanceKm} km
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-stone-400 dark:text-[#C4B9AC]">Wait Time</p>
                    <p className="font-mono font-bold text-stone-800 dark:text-[#FAF5EE]">
                      {journey.waitTimeMin} min
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-stone-400 dark:text-[#C4B9AC]">Avg Speed</p>
                    <p className="font-mono font-bold text-stone-800 dark:text-[#FAF5EE]">
                      {journey.avgSensorSpeedKmh} km/h
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-stone-400 dark:text-[#C4B9AC]">ETA</p>
                    <p className="font-mono font-bold text-stone-800 dark:text-[#FAF5EE]">
                      {journey.stopEtas[journey.stopEtas.length - 1]?.etaClock}
                    </p>
                  </div>
                </div>

                {/* Stop-by-stop & Save action when selected */}
                {isSelected && (
                  <div className="mt-3 border-t border-stone-100 dark:border-[#2E2924] pt-3 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-600 dark:text-[#C4B9AC]">
                      <span className="inline-flex items-center gap-1">
                        <Footprints className="h-3.5 w-3.5 text-stone-400" />
                        Walk {journey.walkToStopMin + journey.walkFromStopMin}m total
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-stone-400" />
                        Model Confidence {journey.confidencePct}%
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleSave(journey);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-stone-200 dark:border-[#2E2924] bg-stone-100 dark:bg-[#2E2924] px-2.5 py-1 text-[11px] font-semibold text-[#E85D04] hover:bg-[#E85D04] hover:text-white transition"
                      >
                        {savedNoticeId === journey.id ? (
                          <>
                            <Check className="h-3.5 w-3.5" /> Saved
                          </>
                        ) : (
                          <>
                            <Bookmark className="h-3.5 w-3.5" /> Save Route
                          </>
                        )}
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      {journey.segments.map((seg, sIdx) => (
                        <div
                          key={`${seg.segmentId}-${sIdx}`}
                          className="flex items-center justify-between rounded-lg border border-stone-200 dark:border-[#2E2924] bg-stone-50/60 dark:bg-[#12100E]/60 px-2.5 py-1.5 text-[11px]"
                        >
                          <div className="min-w-0">
                            <span className="font-mono font-bold text-[#E85D04] mr-1.5">
                              {seg.routeShortName}
                            </span>
                            <span className="font-medium text-stone-800 dark:text-[#FAF5EE]">{seg.roadName}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                seg.flowStatus === 'smooth'
                                  ? 'bg-[#52796F]'
                                  : seg.flowStatus === 'moderate'
                                    ? 'bg-[#F48C06]'
                                    : seg.flowStatus === 'heavy'
                                      ? 'bg-[#E85D04]'
                                      : 'bg-[#D62828]'
                              }`}
                            />
                            <span className="font-mono text-stone-600 dark:text-[#C4B9AC]">
                              {seg.travelMinutes}m
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Interactive Route Map */}
      <div className="lg:col-span-7 min-h-[540px] flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-stone-200 dark:border-[#2E2924] bg-white dark:bg-[#1C1916] px-4 py-2.5 text-xs shadow-xs">
          <div className="flex items-center gap-2 font-semibold text-stone-900 dark:text-[#FAF5EE]">
            <Navigation className="h-4 w-4 text-[#E85D04]" />
            <span>
              {originLoc.label} → {destLoc.label}
            </span>
          </div>
          {selectedJourney && (
            <span className="font-mono text-stone-500 dark:text-[#C4B9AC]">
              {selectedJourney.activeSensorBuses} bus sensors ·{' '}
              {selectedJourney.dwellFilteredCount} stops dwell-filtered
            </span>
          )}
        </div>

        <div className="flex-1 min-h-[480px]">
          <SmartCityGoogleMap
            buses={buses}
            segments={segments}
            selectedJourney={selectedJourney}
            originCoords={originLoc}
            destinationCoords={destLoc}
            userLocation={userLocation}
            layers={layers}
            onChangeLayers={onChangeLayers}
            onDetectCurrentLocation={onDetectCurrentLocation}
            showRouteComputation={true}
            onGoogleRouteComputed={setGoogleRouteMetrics}
            isDarkMode={isDarkMode}
          />
        </div>
      </div>
    </div>
  );
}

function useMemoId(journeys: JourneyOption[]): string | null {
  if (journeys.length === 0) return null;
  let best = journeys[0];
  for (const j of journeys) {
    if (j.avgSensorSpeedKmh > best.avgSensorSpeedKmh) {
      best = j;
    }
  }
  return best.id;
}
