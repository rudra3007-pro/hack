import { useState } from 'react';
import {
  Bookmark,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  LogIn,
  Navigation,
  ShieldCheck,
  Trash2,
  User as UserIcon,
} from 'lucide-react';
import firebaseConfig from '../../firebase-applet-config.json';
import type { SavedRouteRecord, UserSessionProfile } from '../types/transit.ts';

interface ProfileViewProps {
  userProfile: UserSessionProfile;
  savedRoutes: SavedRouteRecord[];
  onDeleteRoute: (routeId: string) => Promise<void>;
  onOpenSavedRoute: (route: SavedRouteRecord) => void;
  onUpdateDisplayName: (displayName: string) => Promise<void>;
  onSubmitFeedback: (payload: {
    frequentRoute: string;
    commuteTimeSlot: string;
    satisfactionRating: number;
    congestionHotspotNote: string;
    submittedViaGoogleForm: boolean;
  }) => Promise<void>;
  googleFormUrl: string;
  onOpenAuth: () => void;
}

export default function ProfileView({
  userProfile,
  savedRoutes,
  onDeleteRoute,
  onOpenSavedRoute,
  onUpdateDisplayName,
  onSubmitFeedback,
  googleFormUrl,
  onOpenAuth,
}: ProfileViewProps) {
  const [nameInput, setNameInput] = useState(userProfile.displayName);
  const [nameSaved, setNameSaved] = useState(false);

  const [frequentRoute, setFrequentRoute] = useState('JANRATH-101 UPSRTC Janrath AC Express');
  const [commuteSlot, setCommuteSlot] = useState('09:00 AM Peak');
  const [rating, setRating] = useState(5);
  const [hotspotNote, setHotspotNote] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    await onUpdateDisplayName(nameInput.trim());
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2000);
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmitFeedback({
      frequentRoute,
      commuteTimeSlot: commuteSlot,
      satisfactionRating: rating,
      congestionHotspotNote: hotspotNote,
      submittedViaGoogleForm: Boolean(googleFormUrl.trim()),
    });
    setHotspotNote('');
    setFeedbackSent(true);
    setTimeout(() => setFeedbackSent(false), 3000);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* User Identity Card */}
      <div className="rounded-2xl border border-stone-200 dark:border-[#2E2924] bg-white dark:bg-[#1C1916] p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E85D04] text-white shadow-sm">
              <UserIcon className="h-7 w-7 text-white" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-xl font-bold text-stone-900 dark:text-[#FAF5EE]">
                  {userProfile.displayName}
                </h2>
                <span
                  className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                    userProfile.isGuest
                      ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                      : userProfile.emailVerified
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                        : 'bg-amber-100 dark:bg-amber-950/60 text-[#E85D04]'
                  }`}
                >
                  {userProfile.isGuest
                    ? 'Guest Demo'
                    : userProfile.emailVerified
                      ? 'Verified Cloud Profile'
                      : 'Authenticated Commuter'}
                </span>
              </div>
              <p className="text-xs text-stone-500 dark:text-[#C4B9AC] mt-0.5">
                {userProfile.email || 'Local demonstration session (sign in to sync across devices)'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/data`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 dark:border-[#2E2924] bg-stone-50 dark:bg-[#12100E] px-3 py-2 text-xs font-semibold text-stone-700 dark:text-[#FAF5EE] hover:border-[#E85D04] hover:text-[#E85D04] transition"
            >
              Firebase Console
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            {userProfile.isGuest && (
              <button
                type="button"
                onClick={onOpenAuth}
                className="inline-flex items-center gap-2 rounded-xl bg-[#E85D04] px-4 py-2 text-xs font-semibold text-white hover:bg-[#D65202] transition"
              >
                <LogIn className="h-4 w-4" />
                Sign In / Create Account
              </button>
            )}
          </div>
        </div>

        <form onSubmit={handleSaveName} className="mt-5 flex flex-wrap items-end gap-3 border-t border-stone-100 dark:border-[#2E2924] pt-4">
          <div className="flex-1 min-w-[220px]">
            <label className="mb-1 block text-xs font-semibold text-stone-600 dark:text-[#C4B9AC]">
              Commuter Display Name
            </label>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              maxLength={80}
              className="w-full rounded-xl border border-stone-200 dark:border-[#2E2924] bg-stone-50 dark:bg-[#12100E] px-3.5 py-2 text-sm text-stone-900 dark:text-[#FAF5EE] outline-none focus:border-[#E85D04]"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-[#12100E] border border-[#2E2924] px-4 py-2.5 text-xs font-semibold text-white hover:bg-stone-800 transition"
          >
            {nameSaved ? 'Updated!' : 'Update Name'}
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Saved Bus Journeys */}
        <div className="rounded-2xl border border-stone-200 dark:border-[#2E2924] bg-white dark:bg-[#1C1916] p-5 shadow-xs lg:col-span-6">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bookmark className="h-4.5 w-4.5 text-[#E85D04]" />
              <h3 className="font-display text-sm font-bold text-stone-900 dark:text-[#FAF5EE]">
                Saved Commute Corridors ({savedRoutes.length})
              </h3>
            </div>
          </div>

          {savedRoutes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-200 dark:border-[#2E2924] bg-stone-50 dark:bg-[#12100E] p-6 text-center text-xs text-stone-500 dark:text-[#C4B9AC]">
              No saved corridors yet. Plan a bus journey and click <strong>Save Route</strong> to
              pin your frequent commute here.
            </div>
          ) : (
            <div className="space-y-2.5">
              {savedRoutes.map((rt) => (
                <div
                  key={rt.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 dark:border-[#2E2924] bg-stone-50 dark:bg-[#12100E] p-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-stone-900 dark:text-[#FAF5EE] truncate">
                      {rt.originName} → {rt.destinationName}
                    </p>
                    <p className="mt-0.5 text-[11px] text-stone-500 dark:text-[#C4B9AC] font-mono">
                      Route {rt.preferredBusRoute} · Est {rt.estimatedMinutes} min
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onOpenSavedRoute(rt)}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#E85D04] px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-[#D65202]"
                    >
                      <Navigation className="h-3 w-3" /> Open
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDeleteRoute(rt.id)}
                      className="rounded-lg border border-stone-200 dark:border-[#2E2924] bg-white dark:bg-[#1C1916] p-1.5 text-stone-500 hover:text-red-500"
                      title="Delete route"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Google Forms & Commuter Preferences Survey */}
        <div className="rounded-2xl border border-stone-200 dark:border-[#2E2924] bg-white dark:bg-[#1C1916] p-5 shadow-xs lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4.5 w-4.5 text-[#E85D04]" />
              <h3 className="font-display text-sm font-bold text-stone-900 dark:text-[#FAF5EE]">
                Travel Preferences &amp; Feedback (Google Forms)
              </h3>
            </div>
            <span className="inline-flex items-center gap-1 rounded bg-emerald-100 dark:bg-emerald-950/40 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
              <ShieldCheck className="h-3 w-3" /> NO PASSWORDS
            </span>
          </div>

          <form onSubmit={handleFeedbackSubmit} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-stone-600 dark:text-[#C4B9AC]">
                  Frequent Bus Route
                </label>
                <select
                  value={frequentRoute}
                  onChange={(e) => setFrequentRoute(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 dark:border-[#2E2924] bg-stone-50 dark:bg-[#12100E] px-3 py-2 text-xs text-stone-900 dark:text-[#FAF5EE]"
                >
                  <option>JANRATH-101 UPSRTC Janrath AC Express</option>
                  <option>EV-202 Lucknow City Electric Circular</option>
                  <option>SHD-303 Shaheed Path Airport &amp; IT Express</option>
                  <option>HRT-404 Old City Heritage Feeder</option>
                  <option>PVN-606 Purvanchal State Superfast</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-stone-600 dark:text-[#C4B9AC]">
                  Typical Commute Slot
                </label>
                <select
                  value={commuteSlot}
                  onChange={(e) => setCommuteSlot(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 dark:border-[#2E2924] bg-stone-50 dark:bg-[#12100E] px-3 py-2 text-xs text-stone-900 dark:text-[#FAF5EE]"
                >
                  <option>09:00 AM Peak</option>
                  <option>02:00 PM Off-Peak</option>
                  <option>06:00 PM Rush</option>
                  <option>Weekend / Mixed</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-stone-600 dark:text-[#C4B9AC]">
                ETA Accuracy Rating (1–5): <strong className="font-mono">{rating}/5</strong>
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setRating(num)}
                    className={`h-8 w-10 rounded-lg font-mono text-xs font-bold transition ${
                      rating === num
                        ? 'bg-[#E85D04] text-white shadow-xs'
                        : 'border border-stone-200 dark:border-[#2E2924] bg-stone-50 dark:bg-[#12100E] text-stone-700 dark:text-[#C4B9AC]'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-stone-600 dark:text-[#C4B9AC]">
                Congestion Hotspot / Travel Feedback
              </label>
              <textarea
                rows={2}
                maxLength={500}
                value={hotspotNote}
                onChange={(e) => setHotspotNote(e.target.value)}
                placeholder="Share Uttar Pradesh corridor bottlenecks or preferred stops..."
                className="w-full rounded-xl border border-stone-200 dark:border-[#2E2924] bg-stone-50 dark:bg-[#12100E] px-3 py-2 text-xs text-stone-900 dark:text-[#FAF5EE] outline-none focus:border-[#E85D04]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="rounded-xl bg-[#E85D04] px-4 py-2 text-xs font-semibold text-white hover:bg-[#D65202] transition"
              >
                Submit Travel Feedback
              </button>
              {feedbackSent && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                  <CheckCircle2 className="h-4 w-4" /> Feedback saved to Firestore!
                </span>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
