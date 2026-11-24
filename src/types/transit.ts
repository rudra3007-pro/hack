export type AppScreen = 'welcome' | 'auth' | 'app';

export type SidebarSection =
  | 'home'
  | 'live-tracking'
  | 'journey-planner'
  | 'book-tickets'
  | 'traffic-analytics'
  | 'historical-data'
  | 'api-playground'
  | 'settings'
  | 'profile';

export type ThemeMode = 'light' | 'dark';

export type StreamStatus = 'active' | 'paused';

export type TimeBucketId = 'live' | '9am_peak' | '2pm_offpeak' | '6pm_rush';

export interface TimeBucketPreset {
  id: TimeBucketId;
  label: string;
  clock: string;
  description: string;
  globalCongestionFactor: number;
}

export type FlowStatus = 'smooth' | 'moderate' | 'heavy' | 'severe';

export type BusSensorState = 'Moving' | 'At Stop' | 'Stuck in Jam';

export interface TransitStop {
  id: string;
  code: string;
  name: string;
  district: string;
  x: number;
  y: number;
  lat: number;
  lng: number;
  isHub: boolean;
  scheduledDwellSec: number;
}

export interface RoadSegment {
  id: string;
  name: string;
  corridor: string;
  fromStopId: string;
  toStopId: string;
  waypoints?: Array<{ x: number; y: number; lat?: number; lng?: number }>;
  distanceKm: number;
  freeFlowKmh: number;
  periodSpeedRatio: Record<TimeBucketId, number>;
  causeTag: 'Signal Queue' | 'Merge Bottleneck' | 'Stop Spillback' | 'Clear Arterial';
}

export interface BusRoute {
  id: string;
  shortName: string;
  name: string;
  type: 'Express' | 'Ring' | 'Feeder';
  headwayMin: number;
  stopIds: string[];
  accentColor: string;
}

export interface BusProbe {
  id: string;
  busId: string;
  routeId: string;
  routeShortName: string;
  segmentId: string;
  x: number;
  y: number;
  lat: number;
  lng: number;
  headingDeg: number;
  speedKmh: number;
  dwellSeconds: number;
  sensorState: BusSensorState;
  occupancyPct: number;
  timestamp: string;
  lastPingSecAgo: number;
  nextStopName: string;
  isDemo?: boolean;
}

export interface SegmentTelemetry {
  segment: RoadSegment;
  liveSpeedKmh: number;
  historicalSpeedKmh: number;
  fusedSpeedKmh: number;
  speedDeltaPct: number;
  flowStatus: FlowStatus;
  confidencePct: number;
  activeProbes: number;
  atStopFiltered: number;
  stuckInJam: number;
  travelSeconds: number;
  scheduledSeconds: number;
}

export interface JourneySegmentDetail {
  segmentId: string;
  roadName: string;
  fromStop: TransitStop;
  toStop: TransitStop;
  routeShortName: string;
  distanceKm: number;
  fusedSpeedKmh: number;
  historicalSpeedKmh: number;
  flowStatus: FlowStatus;
  travelMinutes: number;
  scheduledMinutes: number;
  probeCount: number;
  dwellFilteredCount: number;
  etaAtEndClock: string;
}

export interface JourneyOption {
  id: string;
  title: string;
  summaryTag: string;
  routeLabels: string[];
  transfers: number;
  walkToStopMin: number;
  walkFromStopMin: number;
  waitTimeMin: number;
  nextBusArrivalMin: number;
  inVehicleMin: number;
  transferPenaltyMin: number;
  predictedMin: number;
  predictedRangeMin: [number, number];
  scheduledMin: number;
  trafficDelayMin: number;
  confidencePct: number;
  confidenceLabel: 'High confidence' | 'Moderate confidence' | 'Volatile corridor';
  avgSensorSpeedKmh: number;
  totalDistanceKm: number;
  activeSensorBuses: number;
  dwellFilteredCount: number;
  segments: JourneySegmentDetail[];
  stopEtas: Array<{
    stop: TransitStop;
    etaClock: string;
    cumulativeMin: number;
    isTransfer?: boolean;
  }>;
}

export interface BottleneckHotspot {
  segmentId: string;
  corridorName: string;
  roadName: string;
  fusedSpeedKmh: number;
  historicalSpeedKmh: number;
  deltaPct: number;
  probeCount: number;
  stallCount: number;
  dwellCount: number;
  cause: string;
  severity: FlowStatus;
  center: { x: number; y: number; lat: number; lng: number };
}

export interface TravelTimeApiResponse {
  status: 'ok';
  endpoint: string;
  is_demo: boolean;
  time_bucket: TimeBucketId;
  timestamp: string;
  latency_ms: number;
  origin: {
    input: string;
    resolved_stop_id: string;
    resolved_stop_name: string;
    coordinates: [number, number];
    walk_to_stop_seconds: number;
  };
  destination: {
    input: string;
    resolved_stop_id: string;
    resolved_stop_name: string;
    coordinates: [number, number];
    walk_from_stop_seconds: number;
  };
  recommended_route: string;
  predicted_eta_seconds: number;
  formatted_eta: string;
  min_eta_seconds: number;
  max_eta_seconds: number;
  scheduled_seconds: number;
  traffic_delay_seconds: number;
  congestion_level: 'Smooth' | 'Moderate' | 'Heavy' | 'Severe';
  confidence: number;
  active_sensor_bus_count: number;
  dwell_filtered_probes: number;
  breakdown: {
    walk_seconds: number;
    wait_seconds: number;
    in_vehicle_seconds: number;
    transfer_penalty_seconds: number;
  };
  segments: Array<{
    segment_id: string;
    corridor: string;
    route_line: string;
    distance_meters: number;
    live_probe_speed_kmh: number;
    historical_speed_kmh: number;
    fused_speed_kmh: number;
    duration_seconds: number;
    flow_state: FlowStatus;
    sensor_bus_count: number;
  }>;
  journeys: JourneyOption[];
}

export interface TrafficSegmentsApiResponse {
  status: 'ok';
  is_demo: boolean;
  time_bucket: TimeBucketId;
  timestamp: string;
  latency_ms: number;
  summary: {
    active_bus_sensors: number;
    active_routes_count: number;
    avg_corridor_speed_kmh: number;
    detected_bottlenecks: number;
    model_confidence_pct: number;
    at_stop_filtered_count: number;
    stuck_in_jam_count: number;
  };
  segments: SegmentTelemetry[];
  hotspots: BottleneckHotspot[];
}

export interface LiveBusesApiResponse {
  status: 'ok';
  is_demo: boolean;
  time_bucket: TimeBucketId;
  stream_status: StreamStatus;
  tick: number;
  timestamp: string;
  latency_ms: number;
  total_buses: number;
  buses: BusProbe[];
}

export type HistoricalRangeId = 'today' | '7d' | '30d';

export interface HistoricalAnalyticsApiResponse {
  status: 'ok';
  is_demo: boolean;
  range: HistoricalRangeId;
  selected_date: string;
  generated_at: string;
  summary: {
    avg_network_speed_kmh: number;
    peak_congestion_hour: string;
    smoothest_hour: string;
    total_gps_pings_analyzed: number;
    bottleneck_events_count: number;
  };
  hourly_trends: Array<{
    hour: string;
    historical_speed_kmh: number;
    current_speed_kmh: number;
    congestion_index: number;
    active_buses: number;
  }>;
  daily_comparison: Array<{
    day: string;
    avg_speed_kmh: number;
    peak_delay_min: number;
    congestion_pct: number;
  }>;
  road_averages: Array<{
    segment_id: string;
    road_name: string;
    corridor: string;
    historical_avg_kmh: number;
    peak_avg_kmh: number;
    offpeak_avg_kmh: number;
    congestion_frequency_pct: number;
    frequent_hotspot: boolean;
  }>;
  route_comparisons: Array<{
    route_short_name: string;
    route_name: string;
    avg_trip_min: number;
    peak_trip_min: number;
    offpeak_trip_min: number;
    reliability_pct: number;
  }>;
}

export interface MapLayerSettings {
  showTrafficRoads: boolean;
  showBuses: boolean;
  showStops: boolean;
  showHeatmap: boolean;
  mapTypeId: 'roadmap' | 'hybrid' | 'terrain';
}

export interface UserSessionProfile {
  uid: string;
  displayName: string;
  email: string | null;
  isGuest: boolean;
  emailVerified: boolean;
  provider: 'google' | 'password' | 'guest';
  preferredCommuteMode: 'fastest' | 'least_congested' | 'minimal_transfers';
  homeStopId: string;
  refreshIntervalSec: number;
  googleFormCompleted: boolean;
}

export interface SavedRouteRecord {
  id: string;
  userId: string;
  label: string;
  originName: string;
  originStopId: string;
  destinationName: string;
  destinationStopId: string;
  preferredBusRoute: string;
  estimatedMinutes: number;
  createdAt?: string;
}

export interface CommuterFeedbackRecord {
  id?: string;
  userId: string;
  displayName: string;
  frequentRoute: string;
  commuteTimeSlot: string;
  satisfactionRating: number;
  congestionHotspotNote: string;
  submittedViaGoogleForm: boolean;
  createdAt?: string;
}

export interface BusTicketRecord {
  id: string;
  userId: string;
  pnrNumber: string;
  routeId: string;
  routeShortName: string;
  routeName: string;
  busType: string;
  originStopName: string;
  originStopId: string;
  destinationStopName: string;
  destinationStopId: string;
  travelDate: string;
  departureTime: string;
  passengerName: string;
  passengerAge: number;
  passengerGender: string;
  passengerPhone: string;
  seatList: string;
  totalFare: number;
  status: 'CONFIRMED' | 'CANCELLED';
  qrCodeToken: string;
  createdAt?: string;
}

