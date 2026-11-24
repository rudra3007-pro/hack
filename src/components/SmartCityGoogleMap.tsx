import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  useAdvancedMarkerRef,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  Bus,
  Flag,
  Layers,
  LocateFixed,
  MapPin,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
} from 'lucide-react';
import { BUS_ROUTES, TRANSIT_STOPS } from '../data/cityNetwork.ts';
import { canvasToGeo, getStopById } from '../engine/trafficModel.ts';
import type {
  BottleneckHotspot,
  BusProbe,
  FlowStatus,
  JourneyOption,
  MapLayerSettings,
  SegmentTelemetry,
  TransitStop,
} from '../types/transit.ts';

interface SmartCityGoogleMapProps {
  buses: BusProbe[];
  segments: SegmentTelemetry[];
  hotspots?: BottleneckHotspot[];
  selectedJourney?: JourneyOption | null;
  highlightedRouteShortName?: string | null;
  originCoords?: { lat: number; lng: number; label: string } | null;
  destinationCoords?: { lat: number; lng: number; label: string } | null;
  userLocation?: { lat: number; lng: number } | null;
  layers: MapLayerSettings;
  onChangeLayers: (next: MapLayerSettings) => void;
  onDetectCurrentLocation: () => void;
  onSelectBus?: (bus: BusProbe) => void;
  onSetOriginStop?: (stop: TransitStop) => void;
  onSetDestinationStop?: (stop: TransitStop) => void;
  selectedBusId?: string | null;
  showRouteComputation?: boolean;
  onGoogleRouteComputed?: (info: { distanceMeters: number; durationSeconds: number } | null) => void;
  isDarkMode?: boolean;
}

// STRICTLY ZERO BLUE: Warm transit palette
const FLOW_COLOR: Record<FlowStatus, string> = {
  smooth: '#52796F',    // Muted Sage
  moderate: '#F48C06',  // Signal Amber
  heavy: '#E85D04',     // Burnt Terracotta
  severe: '#D62828',    // Warm Crimson
};

function buildSegmentGeoPath(
  fromId: string,
  toId: string,
  segments: SegmentTelemetry[]
): google.maps.LatLngLiteral[] {
  const from = getStopById(fromId);
  const to = getStopById(toId);
  const matched = segments.find(
    (s) =>
      (s.segment.fromStopId === fromId && s.segment.toStopId === toId) ||
      (s.segment.fromStopId === toId && s.segment.toStopId === fromId)
  );
  if (!matched || !matched.segment.waypoints || matched.segment.waypoints.length === 0) {
    return [
      { lat: from.lat, lng: from.lng },
      { lat: to.lat, lng: to.lng },
    ];
  }
  const reverse = matched.segment.fromStopId === toId;
  const rawWps = reverse ? [...matched.segment.waypoints].reverse() : matched.segment.waypoints;
  const midPts = rawWps.map((wp) => canvasToGeo(wp.x, wp.y));
  return [{ lat: from.lat, lng: from.lng }, ...midPts, { lat: to.lat, lng: to.lng }];
}

function BusAdvancedMarker({
  bus,
  isSelected,
  isDimmed,
  onSelect,
}: {
  bus: BusProbe;
  isSelected: boolean;
  isDimmed: boolean;
  onSelect: (b: BusProbe) => void;
}) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const stateColor =
    bus.sensorState === 'Stuck in Jam'
      ? '#D62828'
      : bus.sensorState === 'At Stop'
        ? '#F48C06'
        : '#52796F';

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: bus.lat, lng: bus.lng }}
        onClick={() => onSelect(bus)}
        title={`Bus ${bus.busId} (${bus.routeShortName}) · ${bus.speedKmh} km/h`}
        zIndex={isSelected ? 70 : isDimmed ? 15 : 40}
      >
        <div
          className={`flex items-center gap-1.5 rounded-full border-2 px-2.5 py-0.5 text-[10px] font-bold shadow-lg transition-all ${
            isSelected
              ? 'scale-115 ring-2 ring-[#E85D04]'
              : isDimmed
                ? 'opacity-45 scale-90'
                : 'hover:scale-105'
          }`}
          style={{
            backgroundColor: '#1C1916',
            borderColor: stateColor,
            color: '#FAF5EE',
          }}
        >
          <span
            className="h-2 w-2 rounded-full shrink-0 animate-pulse"
            style={{ backgroundColor: stateColor }}
          />
          <span className="font-mono text-[#FAF5EE]">{bus.routeShortName}</span>
          <span className="font-mono text-[#F48C06] font-semibold">{Math.round(bus.speedKmh)}</span>
        </div>
      </AdvancedMarker>

      {isSelected && marker && (
        <InfoWindow anchor={marker} onCloseClick={() => onSelect(bus)}>
          <div className="min-w-[210px] p-1.5 text-[#1C1916]">
            <div className="flex items-center justify-between gap-2 border-b border-[#2E2924]/20 pb-1.5 mb-2">
              <div className="flex items-center gap-1.5 font-bold text-xs">
                <Bus className="h-3.5 w-3.5 text-[#E85D04]" />
                <span className="text-[#1C1916]">{bus.busId}</span>
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-[#E85D04]">
                  {bus.routeShortName}
                </span>
              </div>
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-900">
                UP DEMO GPS
              </span>
            </div>
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-stone-500">Speed:</span>
                <span className="font-mono font-semibold text-[#1C1916]">{bus.speedKmh} km/h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Sensor State:</span>
                <span className="font-semibold" style={{ color: stateColor }}>
                  {bus.sensorState}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Next Stop:</span>
                <span className="font-medium text-[#1C1916] truncate max-w-[120px]">
                  {bus.nextStopName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Telemetry Age:</span>
                <span className="font-mono text-stone-600">{bus.lastPingSecAgo}s ago</span>
              </div>
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

function StopAdvancedMarker({
  stop,
  isOpen,
  routeStepIndex,
  isDimmed,
  onToggle,
  onSetOrigin,
  onSetDest,
}: {
  stop: TransitStop;
  isOpen: boolean;
  routeStepIndex: number | null;
  isDimmed: boolean;
  onToggle: (stopId: string | null) => void;
  onSetOrigin?: (stop: TransitStop) => void;
  onSetDest?: (stop: TransitStop) => void;
}) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const isOnRoute = routeStepIndex !== null;

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: stop.lat, lng: stop.lng }}
        onClick={() => onToggle(isOpen ? null : stop.id)}
        title={`${stop.name} (${stop.code})`}
        zIndex={isOnRoute ? 55 : isDimmed ? 10 : 18}
      >
        {isOnRoute ? (
          <div className="flex items-center gap-1 rounded-full border-2 border-[#FAF5EE] bg-[#E85D04] px-2 py-0.5 text-[10px] font-extrabold text-white shadow-lg ring-2 ring-[#F48C06]/60">
            <span className="font-mono">{routeStepIndex}</span>
            <span className="hidden sm:inline max-w-[90px] truncate">{stop.code}</span>
          </div>
        ) : (
          <div
            className={`flex items-center justify-center rounded-full border-2 shadow-sm transition hover:scale-110 ${
              isDimmed ? 'opacity-45' : ''
            } ${
              stop.isHub
                ? 'h-5 w-5 border-[#E85D04] bg-[#1C1916]'
                : 'h-3.5 w-3.5 border-[#F48C06] bg-[#1C1916]'
            }`}
          >
            <span
              className={`rounded-full ${
                stop.isHub ? 'h-2 w-2 bg-[#E85D04]' : 'h-1.5 w-1.5 bg-[#F48C06]'
              }`}
            />
          </div>
        )}
      </AdvancedMarker>

      {isOpen && marker && (
        <InfoWindow anchor={marker} onCloseClick={() => onToggle(null)}>
          <div className="min-w-[200px] p-1.5 text-[#1C1916]">
            <p className="font-bold text-xs text-[#1C1916]">{stop.name}</p>
            <p className="text-[11px] text-stone-500 mb-2">
              {stop.district} · Hub Code{' '}
              <span className="font-mono font-bold text-[#E85D04]">{stop.code}</span>
            </p>
            {(onSetOrigin || onSetDest) && (
              <div className="flex gap-1.5">
                {onSetOrigin && (
                  <button
                    type="button"
                    onClick={() => {
                      onSetOrigin(stop);
                      onToggle(null);
                    }}
                    className="flex-1 rounded-lg bg-[#E85D04] px-2 py-1 text-[10px] font-semibold text-white transition hover:bg-[#D65202]"
                  >
                    Set Origin
                  </button>
                )}
                {onSetDest && (
                  <button
                    type="button"
                    onClick={() => {
                      onSetDest(stop);
                      onToggle(null);
                    }}
                    className="flex-1 rounded-lg border border-stone-300 bg-stone-100 px-2 py-1 text-[10px] font-semibold text-stone-800 transition hover:bg-stone-200"
                  >
                    Set Dest
                  </button>
                )}
              </div>
            )}
          </div>
        </InfoWindow>
      )}
    </>
  );
}

function MapOverlaysAndRouting({
  segments,
  hotspots,
  selectedJourney,
  highlightedRouteShortName,
  originCoords,
  destinationCoords,
  layers,
  showRouteComputation,
  onGoogleRouteComputed,
  isDarkMode,
}: {
  segments: SegmentTelemetry[];
  hotspots?: BottleneckHotspot[];
  selectedJourney?: JourneyOption | null;
  highlightedRouteShortName?: string | null;
  originCoords?: { lat: number; lng: number } | null;
  destinationCoords?: { lat: number; lng: number } | null;
  layers: MapLayerSettings;
  showRouteComputation?: boolean;
  onGoogleRouteComputed?: (info: { distanceMeters: number; durationSeconds: number } | null) => void;
  isDarkMode: boolean;
}) {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');

  const roadLinesRef = useRef<google.maps.Polyline[]>([]);
  const heatCirclesRef = useRef<google.maps.Circle[]>([]);
  const journeyLinesRef = useRef<google.maps.Polyline[]>([]);
  const googleRouteLinesRef = useRef<google.maps.Polyline[]>([]);

  const hasActiveHighlight = Boolean(
    (selectedJourney && selectedJourney.segments.length > 0) || highlightedRouteShortName
  );

  // 1. Render Traffic Road Network Polylines (dimmed when a route is actively highlighted)
  useEffect(() => {
    roadLinesRef.current.forEach((p) => p.setMap(null));
    roadLinesRef.current = [];
    heatCirclesRef.current.forEach((c) => c.setMap(null));
    heatCirclesRef.current = [];

    if (!map) return;

    if (layers.showTrafficRoads) {
      for (const tel of segments) {
        const from = getStopById(tel.segment.fromStopId);
        const to = getStopById(tel.segment.toStopId);
        const midPts = (tel.segment.waypoints || []).map((wp) => canvasToGeo(wp.x, wp.y));
        const path = [{ lat: from.lat, lng: from.lng }, ...midPts, { lat: to.lat, lng: to.lng }];

        const color = FLOW_COLOR[tel.flowStatus];
        const line = new google.maps.Polyline({
          path,
          geodesic: true,
          strokeColor: color,
          strokeOpacity: hasActiveHighlight ? 0.25 : layers.showHeatmap ? 0.92 : 0.82,
          strokeWeight: hasActiveHighlight ? 3 : layers.showHeatmap ? 6 : 4.5,
          zIndex: 5,
          map,
        });
        roadLinesRef.current.push(line);
      }
    }

    if (layers.showHeatmap && hotspots && hotspots.length > 0) {
      for (const spot of hotspots) {
        const color = FLOW_COLOR[spot.severity];
        const circle = new google.maps.Circle({
          center: { lat: spot.center.lat, lng: spot.center.lng },
          radius: spot.severity === 'severe' ? 700 : spot.severity === 'heavy' ? 520 : 380,
          strokeColor: color,
          strokeOpacity: hasActiveHighlight ? 0.25 : 0.5,
          strokeWeight: 1.5,
          fillColor: color,
          fillOpacity: hasActiveHighlight ? 0.1 : spot.severity === 'severe' ? 0.28 : 0.18,
          zIndex: 3,
          map,
        });
        heatCirclesRef.current.push(circle);
      }
    }

    return () => {
      roadLinesRef.current.forEach((p) => p.setMap(null));
      roadLinesRef.current = [];
      heatCirclesRef.current.forEach((c) => c.setMap(null));
      heatCirclesRef.current = [];
    };
  }, [map, segments, hotspots, layers.showTrafficRoads, layers.showHeatmap, hasActiveHighlight]);

  // 2. Render Luminous Triple-Layer Highlight for Selected Journey OR Selected Bus Route
  useEffect(() => {
    journeyLinesRef.current.forEach((p) => p.setMap(null));
    journeyLinesRef.current = [];

    if (!map) return;

    const pathCoords: google.maps.LatLngLiteral[] = [];
    let accentColor = '#E85D04';

    if (selectedJourney && selectedJourney.segments.length > 0) {
      selectedJourney.segments.forEach((seg, idx) => {
        const segPts = buildSegmentGeoPath(seg.fromStop.id, seg.toStop.id, segments);
        if (idx === 0) {
          pathCoords.push(...segPts);
        } else {
          pathCoords.push(...segPts.slice(1));
        }
      });
    } else if (highlightedRouteShortName) {
      const routeObj = BUS_ROUTES.find(
        (r) =>
          r.shortName.toUpperCase() === highlightedRouteShortName.toUpperCase() ||
          r.id === highlightedRouteShortName
      );
      if (routeObj && routeObj.stopIds.length >= 2) {
        accentColor = routeObj.accentColor || '#E85D04';
        for (let i = 0; i < routeObj.stopIds.length - 1; i++) {
          const segPts = buildSegmentGeoPath(routeObj.stopIds[i], routeObj.stopIds[i + 1], segments);
          if (i === 0) {
            pathCoords.push(...segPts);
          } else {
            pathCoords.push(...segPts.slice(1));
          }
        }
      }
    }

    if (pathCoords.length < 2) return;

    const arrowSymbol: google.maps.Symbol = {
      path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
      scale: 3.2,
      strokeColor: '#FAF5EE',
      strokeWeight: 1.5,
      fillColor: '#FAF5EE',
      fillOpacity: 1,
    };

    // Layer A: Outer luminous glow halo
    const halo = new google.maps.Polyline({
      path: pathCoords,
      geodesic: true,
      strokeColor: '#F48C06',
      strokeOpacity: 0.35,
      strokeWeight: 18,
      zIndex: 22,
      map,
    });

    // Layer B: High-contrast border casing (adapts to light/dark map)
    const casing = new google.maps.Polyline({
      path: pathCoords,
      geodesic: true,
      strokeColor: isDarkMode ? '#FAF5EE' : '#12100E',
      strokeOpacity: 0.95,
      strokeWeight: 11,
      zIndex: 23,
      map,
    });

    // Layer C: Bright core route line with directional arrows
    const core = new google.maps.Polyline({
      path: pathCoords,
      geodesic: true,
      strokeColor: accentColor,
      strokeOpacity: 1,
      strokeWeight: 6,
      icons: [
        {
          icon: arrowSymbol,
          offset: '35px',
          repeat: '85px',
        },
      ],
      zIndex: 24,
      map,
    });

    journeyLinesRef.current.push(halo, casing, core);

    // Optional dashed walk connectors from custom Origin/Destination coords to boarding/alighting stops
    const firstPt = pathCoords[0];
    const lastPt = pathCoords[pathCoords.length - 1];
    const walkDashSymbol: google.maps.Symbol = {
      path: 'M 0,-1 0,1',
      strokeOpacity: 0.9,
      strokeColor: '#F48C06',
      scale: 3,
    };

    if (
      selectedJourney &&
      originCoords &&
      (Math.abs(originCoords.lat - firstPt.lat) > 0.001 ||
        Math.abs(originCoords.lng - firstPt.lng) > 0.001)
    ) {
      const walkStart = new google.maps.Polyline({
        path: [originCoords, firstPt],
        geodesic: true,
        strokeOpacity: 0,
        icons: [{ icon: walkDashSymbol, offset: '0', repeat: '12px' }],
        zIndex: 21,
        map,
      });
      journeyLinesRef.current.push(walkStart);
    }

    if (
      selectedJourney &&
      destinationCoords &&
      (Math.abs(destinationCoords.lat - lastPt.lat) > 0.001 ||
        Math.abs(destinationCoords.lng - lastPt.lng) > 0.001)
    ) {
      const walkEnd = new google.maps.Polyline({
        path: [lastPt, destinationCoords],
        geodesic: true,
        strokeOpacity: 0,
        icons: [{ icon: walkDashSymbol, offset: '0', repeat: '12px' }],
        zIndex: 21,
        map,
      });
      journeyLinesRef.current.push(walkEnd);
    }

    const bounds = new google.maps.LatLngBounds();
    pathCoords.forEach((pt) => bounds.extend(pt));
    if (originCoords && selectedJourney) bounds.extend(originCoords);
    if (destinationCoords && selectedJourney) bounds.extend(destinationCoords);
    map.fitBounds(bounds, 75);

    return () => {
      journeyLinesRef.current.forEach((p) => p.setMap(null));
      journeyLinesRef.current = [];
    };
  }, [map, selectedJourney, highlightedRouteShortName, segments, isDarkMode, originCoords, destinationCoords]);

  // 3. Modern Routes API street-level path (subtle companion line beneath selected bus corridor)
  useEffect(() => {
    googleRouteLinesRef.current.forEach((p) => p.setMap(null));
    googleRouteLinesRef.current = [];

    if (!showRouteComputation || !routesLib || !map || !originCoords || !destinationCoords) {
      onGoogleRouteComputed?.(null);
      return;
    }

    let cancelled = false;
    const request: google.maps.routes.ComputeRoutesRequest = {
      origin: { lat: originCoords.lat, lng: originCoords.lng },
      destination: { lat: destinationCoords.lat, lng: destinationCoords.lng },
      travelMode: routesLib.TravelMode.DRIVING,
      fields: ['path', 'distanceMeters', 'durationMillis', 'viewport'],
    };

    routesLib.Route.computeRoutes(request)
      .then((response) => {
        if (cancelled) return;
        const primary = response.routes?.[0];
        if (!primary) {
          onGoogleRouteComputed?.(null);
          return;
        }
        const polylines = primary.createPolylines();
        polylines.forEach((polyline: google.maps.Polyline) => {
          polyline.setOptions({
            strokeColor: '#F48C06',
            strokeOpacity: 0.45,
            strokeWeight: 3.5,
            zIndex: 12,
          });
          polyline.setMap(map);
        });
        googleRouteLinesRef.current = polylines;

        const dist = primary.distanceMeters ?? 0;
        const durSec = Math.round((primary.durationMillis ?? 0) / 1000);
        onGoogleRouteComputed?.(dist > 0 ? { distanceMeters: dist, durationSeconds: durSec } : null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg.includes('OVER_QUERY_LIMIT') ||
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('Quota')
        ) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        onGoogleRouteComputed?.(null);
      });

    return () => {
      cancelled = true;
      googleRouteLinesRef.current.forEach((p) => p.setMap(null));
      googleRouteLinesRef.current = [];
    };
  }, [
    routesLib,
    map,
    showRouteComputation,
    originCoords?.lat,
    originCoords?.lng,
    destinationCoords?.lat,
    destinationCoords?.lng,
  ]);

  return null;
}

function MapControlButtons({
  onDetectLocation,
  isFullscreen,
  onToggleFullscreen,
  layers,
  onChangeLayers,
}: {
  onDetectLocation: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  layers: MapLayerSettings;
  onChangeLayers: (next: MapLayerSettings) => void;
}) {
  const map = useMap();
  const [layersOpen, setLayersOpen] = useState(false);

  const adjustZoom = (delta: number) => {
    if (!map) return;
    const z = map.getZoom() ?? 13;
    map.setZoom(Math.max(8, Math.min(18, z + delta)));
  };

  return (
    <div className="absolute right-3 top-3 z-20 flex flex-col items-end gap-2">
      {/* Layers Button & Panel */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setLayersOpen((o) => !o)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 dark:border-[#2E2924] bg-white/90 dark:bg-[#1C1916]/90 text-stone-700 dark:text-[#FAF5EE] shadow-lg backdrop-blur-md transition hover:border-[#E85D04] hover:text-[#E85D04]"
          title="Map Layers"
        >
          <Layers className="h-4.5 w-4.5" />
        </button>

        {layersOpen && (
          <div className="absolute right-0 mt-2 w-56 rounded-xl border border-stone-200 dark:border-[#2E2924] bg-white/95 dark:bg-[#1C1916]/95 p-3 shadow-xl backdrop-blur-md text-stone-800 dark:text-[#FAF5EE]">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-stone-400 dark:text-[#C4B9AC]">
              Transit &amp; Traffic Layers
            </p>
            <div className="space-y-2 text-xs">
              {[
                { key: 'showTrafficRoads' as const, label: 'Traffic Congestion Roads' },
                { key: 'showBuses' as const, label: 'Live Bus GPS Markers' },
                { key: 'showStops' as const, label: 'Bus Stops & Hubs' },
                { key: 'showHeatmap' as const, label: 'Hotspot Intensity Zones' },
              ].map((item) => (
                <label key={item.key} className="flex items-center justify-between cursor-pointer">
                  <span className="font-medium text-stone-700 dark:text-[#FAF5EE]">{item.label}</span>
                  <input
                    type="checkbox"
                    checked={layers[item.key]}
                    onChange={(e) =>
                      onChangeLayers({ ...layers, [item.key]: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-stone-300 dark:border-stone-700 accent-[#E85D04]"
                  />
                </label>
              ))}
            </div>

            <div className="mt-3 border-t border-stone-200 dark:border-[#2E2924] pt-2.5">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-[#C4B9AC]">
                Base Map Style
              </p>
              <div className="grid grid-cols-3 gap-1">
                {(['roadmap', 'hybrid', 'terrain'] as const).map((mType) => (
                  <button
                    key={mType}
                    type="button"
                    onClick={() => onChangeLayers({ ...layers, mapTypeId: mType })}
                    className={`rounded-lg py-1 text-[11px] font-semibold capitalize transition ${
                      layers.mapTypeId === mType
                        ? 'bg-[#E85D04] text-white'
                        : 'bg-stone-100 dark:bg-[#2E2924] text-stone-600 dark:text-[#C4B9AC] hover:bg-stone-200 dark:hover:bg-[#3D3730]'
                    }`}
                  >
                    {mType}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Current Location */}
      <button
        type="button"
        onClick={onDetectLocation}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 dark:border-[#2E2924] bg-white/90 dark:bg-[#1C1916]/90 text-stone-700 dark:text-[#FAF5EE] shadow-lg backdrop-blur-md transition hover:border-[#E85D04] hover:text-[#E85D04]"
        title="Detect Current Location"
      >
        <LocateFixed className="h-4.5 w-4.5" />
      </button>

      {/* Zoom Controls */}
      <div className="flex flex-col overflow-hidden rounded-xl border border-stone-200 dark:border-[#2E2924] bg-white/90 dark:bg-[#1C1916]/90 shadow-lg backdrop-blur-md">
        <button
          type="button"
          onClick={() => adjustZoom(1)}
          className="flex h-9 w-10 items-center justify-center border-b border-stone-200 dark:border-[#2E2924] text-stone-700 dark:text-[#FAF5EE] hover:text-[#E85D04]"
          title="Zoom In"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => adjustZoom(-1)}
          className="flex h-9 w-10 items-center justify-center text-stone-700 dark:text-[#FAF5EE] hover:text-[#E85D04]"
          title="Zoom Out"
        >
          <Minus className="h-4 w-4" />
        </button>
      </div>

      {/* Fullscreen */}
      <button
        type="button"
        onClick={onToggleFullscreen}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 dark:border-[#2E2924] bg-white/90 dark:bg-[#1C1916]/90 text-stone-700 dark:text-[#FAF5EE] shadow-lg backdrop-blur-md transition hover:border-[#E85D04] hover:text-[#E85D04]"
        title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Map'}
      >
        {isFullscreen ? <Minimize2 className="h-4.5 w-4.5" /> : <Maximize2 className="h-4.5 w-4.5" />}
      </button>
    </div>
  );
}

export default function SmartCityGoogleMap({
  buses,
  segments,
  hotspots,
  selectedJourney,
  highlightedRouteShortName,
  originCoords,
  destinationCoords,
  layers,
  onChangeLayers,
  onDetectCurrentLocation,
  onSelectBus,
  onSetOriginStop,
  onSetDestinationStop,
  selectedBusId,
  showRouteComputation = false,
  onGoogleRouteComputed,
  isDarkMode = false,
}: SmartCityGoogleMapProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [internalBusId, setInternalBusId] = useState<string | null>(null);
  const [openStopId, setOpenStopId] = useState<string | null>(null);

  const activeBusId = selectedBusId !== undefined ? selectedBusId : internalBusId;

  // Map each stopId in the active highlighted journey or bus route to its 1-based step index
  const highlightedStopOrder = useMemo(() => {
    const order = new Map<string, number>();
    if (selectedJourney && selectedJourney.segments.length > 0) {
      let step = 1;
      selectedJourney.segments.forEach((seg, idx) => {
        if (idx === 0) order.set(seg.fromStop.id, step++);
        if (!order.has(seg.toStop.id)) order.set(seg.toStop.id, step++);
      });
    } else if (highlightedRouteShortName) {
      const rt = BUS_ROUTES.find(
        (r) =>
          r.shortName.toUpperCase() === highlightedRouteShortName.toUpperCase() ||
          r.id === highlightedRouteShortName
      );
      if (rt) {
        rt.stopIds.forEach((id, idx) => {
          if (!order.has(id)) order.set(id, idx + 1);
        });
      }
    }
    return order;
  }, [selectedJourney, highlightedRouteShortName]);

  const highlightedRouteLabels = useMemo(() => {
    if (selectedJourney && selectedJourney.routeLabels.length > 0) {
      return new Set(selectedJourney.routeLabels.map((l) => l.toUpperCase()));
    }
    if (highlightedRouteShortName) {
      return new Set([highlightedRouteShortName.toUpperCase()]);
    }
    return null;
  }, [selectedJourney, highlightedRouteShortName]);

  const hasActiveRouteHighlight = highlightedStopOrder.size > 0;

  const handleBusSelect = (bus: BusProbe) => {
    setInternalBusId((prev) => (prev === bus.id ? null : bus.id));
    onSelectBus?.(bus);
  };

  const toggleFullscreen = async () => {
    if (!wrapperRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await wrapperRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      setIsFullscreen((prev) => !prev);
    }
  };

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  return (
    <div
      ref={wrapperRef}
      className={`relative w-full overflow-hidden rounded-2xl border border-stone-200 dark:border-[#2E2924] bg-stone-100 dark:bg-[#12100E] shadow-sm ${
        isFullscreen ? 'h-screen rounded-none' : 'h-full min-h-[460px]'
      }`}
    >
      <GoogleMap
        key={isDarkMode ? 'gmap-dark' : 'gmap-light'}
        mapId="DEMO_MAP_ID"
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        defaultCenter={{ lat: 26.8467, lng: 80.9462 }} // Focused on Lucknow, Uttar Pradesh
        defaultZoom={13}
        gestureHandling="greedy"
        disableDefaultUI={true}
        mapTypeId={layers.mapTypeId}
        colorScheme={isDarkMode ? 'DARK' : 'LIGHT'}
        style={{ width: '100%', height: '100%' }}
      >
        <MapOverlaysAndRouting
          segments={segments}
          hotspots={hotspots}
          selectedJourney={selectedJourney}
          highlightedRouteShortName={highlightedRouteShortName}
          originCoords={originCoords}
          destinationCoords={destinationCoords}
          layers={layers}
          showRouteComputation={showRouteComputation}
          onGoogleRouteComputed={onGoogleRouteComputed}
          isDarkMode={isDarkMode}
        />

        {/* Highlighted Origin Pin */}
        {originCoords && (selectedJourney || showRouteComputation) && (
          <AdvancedMarker
            position={{ lat: originCoords.lat, lng: originCoords.lng }}
            title={`Origin: ${originCoords.label}`}
            zIndex={65}
          >
            <div className="flex items-center gap-1 rounded-full border-2 border-white bg-[#52796F] px-2.5 py-1 text-[10px] font-bold text-white shadow-lg">
              <MapPin className="h-3 w-3 shrink-0" />
              <span>START</span>
            </div>
          </AdvancedMarker>
        )}

        {/* Highlighted Destination Pin */}
        {destinationCoords && (selectedJourney || showRouteComputation) && (
          <AdvancedMarker
            position={{ lat: destinationCoords.lat, lng: destinationCoords.lng }}
            title={`Destination: ${destinationCoords.label}`}
            zIndex={66}
          >
            <div className="flex items-center gap-1 rounded-full border-2 border-white bg-[#D62828] px-2.5 py-1 text-[10px] font-bold text-white shadow-lg">
              <Flag className="h-3 w-3 shrink-0" />
              <span>END</span>
            </div>
          </AdvancedMarker>
        )}

        {/* Transit Stops */}
        {layers.showStops &&
          TRANSIT_STOPS.map((stop) => (
            <StopAdvancedMarker
              key={stop.id}
              stop={stop}
              isOpen={openStopId === stop.id}
              routeStepIndex={highlightedStopOrder.get(stop.id) ?? null}
              isDimmed={hasActiveRouteHighlight && !highlightedStopOrder.has(stop.id)}
              onToggle={setOpenStopId}
              onSetOrigin={onSetOriginStop}
              onSetDest={onSetDestinationStop}
            />
          ))}

        {/* Live / Simulated Moving Buses */}
        {layers.showBuses &&
          buses.map((bus) => {
            const isDimmed = Boolean(
              highlightedRouteLabels &&
                !highlightedRouteLabels.has(bus.routeShortName.toUpperCase())
            );
            return (
              <BusAdvancedMarker
                key={bus.id}
                bus={bus}
                isSelected={activeBusId === bus.id}
                isDimmed={isDimmed}
                onSelect={handleBusSelect}
              />
            );
          })}

        <MapControlButtons
          onDetectLocation={onDetectCurrentLocation}
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => void toggleFullscreen()}
          layers={layers}
          onChangeLayers={onChangeLayers}
        />
      </GoogleMap>
    </div>
  );
}
