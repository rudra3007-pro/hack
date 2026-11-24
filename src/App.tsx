import { useCallback, useEffect, useState } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { onAuthStateChanged } from 'firebase/auth';
import {
  auth,
  deleteSavedRoute,
  ensureUserProfileDoc,
  listSavedRoutes,
  markGoogleFormCompletedDoc,
  saveCommuterRoute,
  signOutAccount,
  submitCommuterFeedback,
  updateUserPreferencesDoc,
} from './firebase.ts';
import AuthView from './components/AuthView.tsx';
import ApiPlaygroundView from './components/ApiPlaygroundView.tsx';
import DashboardHomeView from './components/DashboardHomeView.tsx';
import HistoricalDataView from './components/HistoricalDataView.tsx';
import JourneyPlannerView from './components/JourneyPlannerView.tsx';
import LiveTrackingView from './components/LiveTrackingView.tsx';
import type { SelectedLocationValue } from './components/PlaceSearchInput.tsx';
import ProfileView from './components/ProfileView.tsx';
import SettingsView from './components/SettingsView.tsx';
import SidebarLayout from './components/SidebarLayout.tsx';
import TicketBookingView from './components/TicketBookingView.tsx';
import TrafficAnalyticsView from './components/TrafficAnalyticsView.tsx';
import WelcomeView from './components/WelcomeView.tsx';
import { getStopById } from './engine/trafficModel.ts';
import type {
  AppScreen,
  BusProbe,
  JourneyOption,
  LiveBusesApiResponse,
  MapLayerSettings,
  SavedRouteRecord,
  SidebarSection,
  StreamStatus,
  TimeBucketId,
  TrafficSegmentsApiResponse,
  UserSessionProfile,
} from './types/transit.ts';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

const DEFAULT_GUEST_PROFILE: UserSessionProfile = {
  uid: 'guest-demo',
  displayName: 'Guest Commuter',
  email: null,
  isGuest: true,
  emailVerified: false,
  provider: 'guest',
  preferredCommuteMode: 'fastest',
  homeStopId: 'charbagh-nr',
  refreshIntervalSec: 4,
  googleFormCompleted: false,
};

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('welcome');
  const [section, setSection] = useState<SidebarSection>('home');

  // Dark Mode State with LocalStorage Persistence
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('margflow_dark_mode');
      if (saved !== null) return saved === 'true';
      return true; // Default to sleek warm obsidian dark mode
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('margflow_dark_mode', String(isDarkMode));
  }, [isDarkMode]);

  // Mandatory Google Maps Demo Key Quota Banner State
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  // Auth & Profile State
  const [userProfile, setUserProfile] = useState<UserSessionProfile>(DEFAULT_GUEST_PROFILE);
  const [savedRoutes, setSavedRoutes] = useState<SavedRouteRecord[]>(() => {
    try {
      const raw = localStorage.getItem('margflow_guest_routes');
      return raw ? (JSON.parse(raw) as SavedRouteRecord[]) : [];
    } catch {
      return [];
    }
  });
  const [googleFormUrl, setGoogleFormUrl] = useState<string>(
    () => localStorage.getItem('margflow_google_form_url') || ''
  );

  // Live Telemetry State
  const [timeBucket, setTimeBucket] = useState<TimeBucketId>('live');
  const [streamStatus, setStreamStatus] = useState<StreamStatus>('active');
  const [buses, setBuses] = useState<BusProbe[]>([]);
  const [trafficData, setTrafficData] = useState<TrafficSegmentsApiResponse | null>(null);
  const [lastUpdatedLabel, setLastUpdatedLabel] = useState<string>('Syncing...');

  // Map Layers & User Location
  const [layers, setLayers] = useState<MapLayerSettings>({
    showTrafficRoads: true,
    showBuses: true,
    showStops: true,
    showHeatmap: false,
    mapTypeId: 'roadmap',
  });
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Planner Origin & Destination (Uttar Pradesh Hubs)
  const [plannerOrigin, setPlannerOrigin] = useState<SelectedLocationValue>({
    label: 'Charbagh Railway Station (Lucknow Central)',
    stopId: 'charbagh-nr',
    lat: 26.8322,
    lng: 80.9197,
    source: 'stop',
  });
  const [plannerDest, setPlannerDest] = useState<SelectedLocationValue>({
    label: 'Gomti Nagar IT & High Court',
    stopId: 'gomti-nagar',
    lat: 26.8598,
    lng: 81.0068,
    source: 'stop',
  });

  // Listen for Google Maps quota-exceeded custom event
  useEffect(() => {
    const onQuota = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuota);
  }, []);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setUserProfile(DEFAULT_GUEST_PROFILE);
        return;
      }
      try {
        const profile = await ensureUserProfileDoc(fbUser);
        setUserProfile(profile);
        const routes = await listSavedRoutes(fbUser.uid);
        setSavedRoutes(routes);
      } catch (err) {
        console.error('Failed loading Firebase profile:', err);
      }
    });
    return () => unsub();
  }, []);

  const fetchTelemetry = useCallback(async () => {
    try {
      const [busRes, segRes] = await Promise.all([
        fetch(`/api/v1/buses/live?time_bucket=${timeBucket}&stream=${streamStatus}`),
        fetch(`/api/v1/traffic-segments?time_bucket=${timeBucket}`),
      ]);
      if (busRes.ok) {
        const busJson: LiveBusesApiResponse = await busRes.json();
        setBuses(busJson.buses);
      }
      if (segRes.ok) {
        const segJson: TrafficSegmentsApiResponse = await segRes.json();
        setTrafficData(segJson);
      }
      setLastUpdatedLabel(new Date().toLocaleTimeString([], { hour12: false }));
    } catch (err) {
      console.error('Telemetry polling error:', err);
    }
  }, [timeBucket, streamStatus]);

  useEffect(() => {
    void fetchTelemetry();
    const intervalMs = Math.max(2000, userProfile.refreshIntervalSec * 1000);
    const id = setInterval(() => {
      if (streamStatus === 'active') {
        void fetchTelemetry();
      }
    }, intervalMs);
    return () => clearInterval(id);
  }, [fetchTelemetry, streamStatus, userProfile.refreshIntervalSec]);

  const handleToggleStream = async () => {
    const next: StreamStatus = streamStatus === 'active' ? 'paused' : 'active';
    setStreamStatus(next);
    try {
      await fetch('/api/v1/stream/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
    } catch {
      // ignore network jitter
    }
  };

  const handleDetectCurrentLocation = () => {
    if (!navigator.geolocation) {
      setUserLocation({ lat: 26.8467, lng: 80.9462 });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => {
        // Graceful UP city-center fallback if iframe/browser blocks geolocation permission
        setUserLocation({ lat: 26.8467, lng: 80.9462 });
      },
      { timeout: 6000 }
    );
  };

  const handleUpdateGoogleFormUrl = (url: string) => {
    setGoogleFormUrl(url);
    localStorage.setItem('margflow_google_form_url', url);
  };

  const handleSaveJourney = async (
    journey: JourneyOption,
    originLabel: string,
    destLabel: string,
    originId: string,
    destId: string
  ) => {
    if (!userProfile.isGuest && userProfile.uid) {
      const saved = await saveCommuterRoute(userProfile.uid, {
        label: `${originLabel} → ${destLabel}`,
        originName: originLabel,
        originStopId: originId,
        destinationName: destLabel,
        destinationStopId: destId,
        preferredBusRoute: journey.routeLabels.join(' + '),
        estimatedMinutes: journey.predictedMin,
      });
      setSavedRoutes((prev) => [saved, ...prev]);
    } else {
      const localItem: SavedRouteRecord = {
        id: `local_${Date.now()}`,
        userId: userProfile.uid,
        label: `${originLabel} → ${destLabel}`,
        originName: originLabel,
        originStopId: originId,
        destinationName: destLabel,
        destinationStopId: destId,
        preferredBusRoute: journey.routeLabels.join(' + '),
        estimatedMinutes: journey.predictedMin,
        createdAt: new Date().toISOString(),
      };
      setSavedRoutes((prev) => {
        const next = [localItem, ...prev];
        localStorage.setItem('margflow_guest_routes', JSON.stringify(next));
        return next;
      });
    }
  };

  const handleDeleteRoute = async (routeId: string) => {
    if (!userProfile.isGuest && userProfile.uid && !routeId.startsWith('local_')) {
      await deleteSavedRoute(userProfile.uid, routeId);
    }
    setSavedRoutes((prev) => {
      const next = prev.filter((r) => r.id !== routeId);
      localStorage.setItem('margflow_guest_routes', JSON.stringify(next));
      return next;
    });
  };

  const handleSavePreferences = async (updates: {
    displayName: string;
    preferredCommuteMode: UserSessionProfile['preferredCommuteMode'];
    homeStopId: string;
    refreshIntervalSec: number;
  }) => {
    setUserProfile((prev) => ({ ...prev, ...updates }));
    if (!userProfile.isGuest && userProfile.uid) {
      await updateUserPreferencesDoc(userProfile.uid, updates);
    }
  };

  const handleSubmitFeedback = async (payload: {
    frequentRoute: string;
    commuteTimeSlot: string;
    satisfactionRating: number;
    congestionHotspotNote: string;
    submittedViaGoogleForm: boolean;
  }) => {
    if (!userProfile.isGuest && userProfile.uid) {
      await submitCommuterFeedback({
        userId: userProfile.uid,
        displayName: userProfile.displayName,
        ...payload,
      });
      await markGoogleFormCompletedDoc(userProfile.uid);
    } else {
      localStorage.setItem('margflow_guest_feedback', JSON.stringify(payload));
    }
  };

  const handleOpenSavedRoute = (route: SavedRouteRecord) => {
    const oStop = getStopById(route.originStopId);
    const dStop = getStopById(route.destinationStopId);
    setPlannerOrigin({
      label: route.originName,
      stopId: oStop?.id === route.originStopId ? oStop.id : undefined,
      lat: oStop?.lat ?? 26.8322,
      lng: oStop?.lng ?? 80.9197,
      source: 'stop',
    });
    setPlannerDest({
      label: route.destinationName,
      stopId: dStop?.id === route.destinationStopId ? dStop.id : undefined,
      lat: dStop?.lat ?? 26.8598,
      lng: dStop?.lng ?? 81.0068,
      source: 'stop',
    });
    setSection('journey-planner');
  };

  const handleOpenJourneyWithPoints = (
    origin: { label: string; stopId?: string; lat: number; lng: number },
    destination: { label: string; stopId?: string; lat: number; lng: number }
  ) => {
    const resolvedO = origin.stopId ? getStopById(origin.stopId) : null;
    const resolvedD = destination.stopId ? getStopById(destination.stopId) : null;
    setPlannerOrigin({
      label: resolvedO ? resolvedO.name : origin.label,
      stopId: origin.stopId,
      lat: resolvedO ? resolvedO.lat : origin.lat,
      lng: resolvedO ? resolvedO.lng : origin.lng,
      source: origin.stopId ? 'stop' : 'place',
    });
    setPlannerDest({
      label: resolvedD ? resolvedD.name : destination.label,
      stopId: destination.stopId,
      lat: resolvedD ? resolvedD.lat : destination.lat,
      lng: resolvedD ? resolvedD.lng : destination.lng,
      source: destination.stopId ? 'stop' : 'place',
    });
    setSection('journey-planner');
  };

  return (
    <APIProvider
      apiKey={GOOGLE_MAPS_API_KEY}
      libraries={['places', 'routes', 'marker']}
      language="en"
      region="IN"
    >
      {/* Mandatory Demo Key Quota Banner */}
      {quotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {screen === 'welcome' && (
        <WelcomeView
          onGetStarted={() => setScreen('auth')}
          onExplorePlatform={() => {
            setScreen('app');
            setSection('home');
          }}
        />
      )}

      {screen === 'auth' && (
        <AuthView
          onBackToWelcome={() => setScreen('welcome')}
          onContinueAsGuest={() => {
            setUserProfile(DEFAULT_GUEST_PROFILE);
            setScreen('app');
            setSection('home');
          }}
          googleFormUrl={googleFormUrl}
          onUpdateGoogleFormUrl={handleUpdateGoogleFormUrl}
          onAuthSuccess={() => {
            setScreen('app');
            setSection('home');
          }}
        />
      )}

      {screen === 'app' && (
        <SidebarLayout
          activeSection={section}
          onSelectSection={setSection}
          streamStatus={streamStatus}
          onToggleStream={() => void handleToggleStream()}
          timeBucket={timeBucket}
          onChangeTimeBucket={setTimeBucket}
          lastUpdatedLabel={lastUpdatedLabel}
          userProfile={userProfile}
          onOpenAuth={() => setScreen('auth')}
          onSignOut={() => {
            void signOutAccount();
            setUserProfile(DEFAULT_GUEST_PROFILE);
            setScreen('auth');
          }}
          isDarkMode={isDarkMode}
          onToggleDarkMode={() => setIsDarkMode((d) => !d)}
        >
          {section === 'home' && (
            <DashboardHomeView
              buses={buses}
              trafficData={trafficData}
              layers={layers}
              onChangeLayers={setLayers}
              userLocation={userLocation}
              onDetectCurrentLocation={handleDetectCurrentLocation}
              onOpenJourneyWithPoints={handleOpenJourneyWithPoints}
              onOpenLiveTracking={() => setSection('live-tracking')}
              isDarkMode={isDarkMode}
            />
          )}

          {section === 'live-tracking' && (
            <LiveTrackingView
              buses={buses}
              segments={trafficData?.segments || []}
              hotspots={trafficData?.hotspots || []}
              layers={layers}
              onChangeLayers={setLayers}
              userLocation={userLocation}
              onDetectCurrentLocation={handleDetectCurrentLocation}
              lastUpdatedLabel={lastUpdatedLabel}
              isDarkMode={isDarkMode}
            />
          )}

          {section === 'journey-planner' && (
            <JourneyPlannerView
              buses={buses}
              segments={trafficData?.segments || []}
              timeBucket={timeBucket}
              layers={layers}
              onChangeLayers={setLayers}
              userLocation={userLocation}
              onDetectCurrentLocation={handleDetectCurrentLocation}
              initialOrigin={plannerOrigin}
              initialDestination={plannerDest}
              onSaveJourney={handleSaveJourney}
              isDarkMode={isDarkMode}
            />
          )}

          {section === 'book-tickets' && (
            <TicketBookingView
              userProfile={userProfile}
              onOpenAuth={() => setScreen('auth')}
            />
          )}

          {section === 'traffic-analytics' && (
            <TrafficAnalyticsView
              buses={buses}
              trafficData={trafficData}
              layers={layers}
              onChangeLayers={setLayers}
              userLocation={userLocation}
              onDetectCurrentLocation={handleDetectCurrentLocation}
              isDarkMode={isDarkMode}
            />
          )}

          {section === 'historical-data' && <HistoricalDataView />}

          {section === 'api-playground' && <ApiPlaygroundView />}

          {section === 'settings' && (
            <SettingsView
              layers={layers}
              onChangeLayers={setLayers}
              userProfile={userProfile}
              onSavePreferences={handleSavePreferences}
              googleFormUrl={googleFormUrl}
              onUpdateGoogleFormUrl={handleUpdateGoogleFormUrl}
            />
          )}

          {section === 'profile' && (
            <ProfileView
              userProfile={userProfile}
              savedRoutes={savedRoutes}
              onDeleteRoute={handleDeleteRoute}
              onOpenSavedRoute={handleOpenSavedRoute}
              onUpdateDisplayName={async (newName) => {
                await handleSavePreferences({
                  displayName: newName,
                  preferredCommuteMode: userProfile.preferredCommuteMode,
                  homeStopId: userProfile.homeStopId,
                  refreshIntervalSec: userProfile.refreshIntervalSec,
                });
              }}
              onSubmitFeedback={handleSubmitFeedback}
              googleFormUrl={googleFormUrl}
              onOpenAuth={() => setScreen('auth')}
            />
          )}
        </SidebarLayout>
      )}
    </APIProvider>
  );
}
