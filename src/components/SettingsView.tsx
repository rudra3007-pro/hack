import { useState } from 'react';
import { CheckCircle2, Database, ExternalLink, Layers, Radio, Save, ShieldCheck, Sliders } from 'lucide-react';
import firebaseConfig from '../../firebase-applet-config.json';
import { TRANSIT_STOPS } from '../data/cityNetwork.ts';
import type { MapLayerSettings, UserSessionProfile } from '../types/transit.ts';

interface SettingsViewProps {
  layers: MapLayerSettings;
  onChangeLayers: (next: MapLayerSettings) => void;
  userProfile: UserSessionProfile;
  onSavePreferences: (updates: {
    displayName: string;
    preferredCommuteMode: UserSessionProfile['preferredCommuteMode'];
    homeStopId: string;
    refreshIntervalSec: number;
  }) => Promise<void>;
  googleFormUrl: string;
  onUpdateGoogleFormUrl: (url: string) => void;
}

export default function SettingsView({
  layers,
  onChangeLayers,
  userProfile,
  onSavePreferences,
  googleFormUrl,
  onUpdateGoogleFormUrl,
}: SettingsViewProps) {
  const [preferredMode, setPreferredMode] = useState(userProfile.preferredCommuteMode);
  const [homeStopId, setHomeStopId] = useState(userProfile.homeStopId);
  const [refreshSec, setRefreshSec] = useState(userProfile.refreshIntervalSec);
  const [savedOk, setSavedOk] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSavePreferences({
      displayName: userProfile.displayName,
      preferredCommuteMode: preferredMode,
      homeStopId,
      refreshIntervalSec: refreshSec,
    });
    setSavedOk(true);
    setTimeout(() => setSavedOk(false), 2500);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {/* Map & Traffic Layers */}
      <div className="rounded-2xl border border-stone-200 dark:border-[#2E2924] bg-white dark:bg-[#1C1916] p-6 shadow-xs">
        <div className="mb-4 flex items-center gap-2">
          <Layers className="h-5 w-5 text-[#E85D04]" />
          <h2 className="font-display text-base font-bold text-stone-900 dark:text-[#FAF5EE]">
            Default Map &amp; Traffic Layers
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            { key: 'showTrafficRoads' as const, label: 'Road Congestion Lines (Green–Amber–Red)' },
            { key: 'showBuses' as const, label: 'Live Moving Bus GPS Probes' },
            { key: 'showStops' as const, label: 'Transit Stops & Interchange Hubs' },
            { key: 'showHeatmap' as const, label: 'Congestion Hotspot Intensity Circles' },
          ].map((item) => (
            <label
              key={item.key}
              className="flex items-center justify-between rounded-xl border border-stone-200 dark:border-[#2E2924] bg-stone-50 dark:bg-[#12100E] px-4 py-3 text-xs font-semibold text-stone-700 dark:text-[#C4B9AC] cursor-pointer hover:border-[#E85D04]/40 transition-colors"
            >
              <span>{item.label}</span>
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

        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold text-stone-600 dark:text-[#C4B9AC]">Google Map Base Layer</p>
          <div className="flex gap-2">
            {(['roadmap', 'hybrid', 'terrain'] as const).map((style) => (
              <button
                key={style}
                type="button"
                onClick={() => onChangeLayers({ ...layers, mapTypeId: style })}
                className={`rounded-xl px-4 py-2 text-xs font-semibold capitalize transition-colors ${
                  layers.mapTypeId === style
                    ? 'bg-[#E85D04] text-white shadow-xs'
                    : 'border border-stone-200 dark:border-[#2E2924] bg-white dark:bg-[#12100E] text-stone-700 dark:text-[#C4B9AC] hover:bg-stone-50 dark:hover:bg-[#1C1916]'
                }`}
              >
                {style}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Commuter Preferences */}
      <form
        onSubmit={handleSave}
        className="rounded-2xl border border-stone-200 dark:border-[#2E2924] bg-white dark:bg-[#1C1916] p-6 shadow-xs space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="h-5 w-5 text-[#E85D04]" />
            <h2 className="font-display text-base font-bold text-stone-900 dark:text-[#FAF5EE]">
              Commuter Routing &amp; Telemetry Preferences
            </h2>
          </div>
          {savedOk && (
            <span className="inline-flex items-center gap-1 rounded-lg border border-[#52796F]/30 bg-[#52796F]/15 px-2.5 py-1 text-xs font-semibold text-[#52796F]">
              <CheckCircle2 className="h-3.5 w-3.5" /> Saved
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-stone-700 dark:text-[#C4B9AC]">
              Default Route Optimization
            </label>
            <select
              value={preferredMode}
              onChange={(e) =>
                setPreferredMode(e.target.value as UserSessionProfile['preferredCommuteMode'])
              }
              className="w-full rounded-xl border border-stone-200 dark:border-[#2E2924] bg-stone-50 dark:bg-[#12100E] px-3 py-2.5 text-sm text-stone-900 dark:text-[#FAF5EE] outline-none focus:border-[#E85D04]"
            >
              <option value="fastest">Fastest Predicted ETA</option>
              <option value="least_congested">Least Congested Corridor</option>
              <option value="minimal_transfers">Minimal Bus Transfers</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-stone-700 dark:text-[#C4B9AC]">
              Home Transit Hub (Uttar Pradesh)
            </label>
            <select
              value={homeStopId}
              onChange={(e) => setHomeStopId(e.target.value)}
              className="w-full rounded-xl border border-stone-200 dark:border-[#2E2924] bg-stone-50 dark:bg-[#12100E] px-3 py-2.5 text-sm text-stone-900 dark:text-[#FAF5EE] outline-none focus:border-[#E85D04]"
            >
              {TRANSIT_STOPS.map((stop) => (
                <option key={stop.id} value={stop.id}>
                  {stop.name} ({stop.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-stone-700 dark:text-[#C4B9AC]">
            Bus GPS Polling Interval: <span className="font-mono text-[#E85D04]">{refreshSec}s</span>
          </label>
          <input
            type="range"
            min={2}
            max={15}
            value={refreshSec}
            onChange={(e) => setRefreshSec(Number(e.target.value))}
            className="w-full accent-[#E85D04]"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-stone-700 dark:text-[#C4B9AC]">
            Google Forms Feedback / Preferences Survey URL (Zero Passwords)
          </label>
          <input
            type="url"
            value={googleFormUrl}
            onChange={(e) => onUpdateGoogleFormUrl(e.target.value)}
            placeholder="https://docs.google.com/forms/d/e/.../viewform?embedded=true"
            className="w-full rounded-xl border border-stone-200 dark:border-[#2E2924] bg-stone-50 dark:bg-[#12100E] px-3 py-2 text-xs font-mono text-stone-800 dark:text-[#FAF5EE] outline-none focus:border-[#E85D04]"
          />
        </div>

        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-xl bg-[#E85D04] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#d45403] transition-colors"
        >
          <Save className="h-4 w-4" />
          Save Settings
        </button>
      </form>

      {/* Firebase Console & Cloud Database */}
      <div className="rounded-2xl border border-stone-200 dark:border-[#2E2924] bg-white dark:bg-[#1C1916] p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-[#E85D04]" />
            <h2 className="font-display text-base font-bold text-stone-900 dark:text-[#FAF5EE]">
              Firebase Console &amp; Firestore Cloud
            </h2>
          </div>
          <span className="inline-flex items-center gap-1 rounded-lg border border-[#52796F]/30 bg-[#52796F]/15 px-2.5 py-1 text-[11px] font-semibold text-[#52796F]">
            <ShieldCheck className="h-3.5 w-3.5" /> Connected
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
          <div className="rounded-xl border border-stone-200 dark:border-[#2E2924] bg-stone-50 dark:bg-[#12100E] p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Firebase Project ID</p>
            <p className="mt-1 font-mono font-semibold text-stone-900 dark:text-[#FAF5EE]">
              {firebaseConfig.projectId}
            </p>
          </div>
          <div className="rounded-xl border border-stone-200 dark:border-[#2E2924] bg-stone-50 dark:bg-[#12100E] p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Firestore Database ID</p>
            <p className="mt-1 font-mono font-semibold text-stone-900 dark:text-[#FAF5EE] truncate">
              {firebaseConfig.firestoreDatabaseId}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/overview`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#E85D04] px-4 py-2 text-xs font-semibold text-white hover:bg-[#D65202] transition"
          >
            Open Firebase Console
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <a
            href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/providers`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 dark:border-[#2E2924] bg-stone-50 dark:bg-[#12100E] px-4 py-2 text-xs font-semibold text-stone-800 dark:text-[#FAF5EE] hover:border-[#E85D04] transition"
          >
            Auth Providers (Enable Email/Password)
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <a
            href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/data`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 dark:border-[#2E2924] bg-stone-50 dark:bg-[#12100E] px-4 py-2 text-xs font-semibold text-stone-800 dark:text-[#FAF5EE] hover:border-[#E85D04] transition"
          >
            Firestore Data Explorer
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* Telemetry Disclosure Notice */}
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3">
        <Radio className="h-4.5 w-4.5 shrink-0 text-[#F48C06] mt-0.5" />
        <div>
          <p className="font-bold">Uttar Pradesh Bus Telemetry (DEMO Simulated Mode)</p>
          <p className="mt-0.5 leading-relaxed text-amber-800 dark:text-amber-300">
            This platform currently models UPSRTC Janrath, Lucknow Electric, and express intercity corridors
            across 24 major transit segments and 26 active fleet probes, fused with Google Maps JavaScript API,
            Places API (New), and Routes API.
          </p>
        </div>
      </div>
    </div>
  );
}
