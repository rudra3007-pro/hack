import { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Bus,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
} from 'lucide-react';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  registerWithEmailPassword,
  signInWithEmailPassword,
  signInWithGoogleAccount,
} from '../firebase.ts';

interface AuthViewProps {
  onBackToWelcome: () => void;
  onContinueAsGuest: () => void;
  googleFormUrl: string;
  onUpdateGoogleFormUrl: (url: string) => void;
  onAuthSuccess: () => void;
}

export default function AuthView({
  onBackToWelcome,
  onContinueAsGuest,
  googleFormUrl,
  onUpdateGoogleFormUrl,
  onAuthSuccess,
}: AuthViewProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'preferences-form'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Commuter preferences (Google Form companion)
  const [prefRoute, setPrefRoute] = useState('JANRATH-101 UPSRTC Janrath AC Express');
  const [prefSlot, setPrefSlot] = useState('08:30 – 10:00 AM Peak');
  const [prefGoal, setPrefGoal] = useState('Fastest predicted ETA');
  const [prefSaved, setPrefSaved] = useState(false);

  const validateEmailPassword = (): boolean => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMsg('Please enter a valid email address.');
      return false;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return false;
    }
    if (mode === 'register' && displayName.trim().length < 2) {
      setErrorMsg('Please enter your full name (at least 2 characters).');
      return false;
    }
    return true;
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    if (!validateEmailPassword()) return;

    setSubmitting(true);
    try {
      if (mode === 'register') {
        await registerWithEmailPassword(email, password, displayName);
        setInfoMsg(
          'Account created! Profile initialized in Firestore. Entering Uttar Pradesh transit dashboard...'
        );
      } else {
        await signInWithEmailPassword(email, password);
      }
      onAuthSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('auth/operation-not-allowed')) {
        setErrorMsg(
          'Email/Password sign-in is disabled in your Firebase Console. Click "Open Firebase Console Auth" below to enable Email/Password, or use "Continue with Google" / "Continue as Guest".'
        );
      } else if (msg.includes('auth/invalid-credential') || msg.includes('auth/wrong-password')) {
        setErrorMsg('Incorrect email or password. Please verify your credentials or register a new account.');
      } else if (msg.includes('auth/email-already-in-use')) {
        setErrorMsg('An account with this email already exists. Switch to Sign In.');
      } else if (msg.includes('auth/too-many-requests')) {
        setErrorMsg('Too many attempts. Please wait a moment or continue with Google.');
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setSubmitting(true);
    try {
      await signInWithGoogleAccount();
      onAuthSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('popup-closed-by-user')) {
        setErrorMsg('Google sign-in popup was closed before completing.');
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleFillDemoCredentials = () => {
    setEmail('commuter@up-transit.org');
    setPassword('Pass@1234');
    if (mode === 'register') {
      setDisplayName('Priya Sharma');
    }
    setErrorMsg(null);
  };

  const handleSaveCommuterPreferences = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem(
      'margflow_guest_prefs',
      JSON.stringify({ prefRoute, prefSlot, prefGoal, savedAt: new Date().toISOString() })
    );
    setPrefSaved(true);
    setInfoMsg('Travel preferences saved. You can now sign in or continue as guest to view journeys.');
  };

  return (
    <div className="min-h-screen w-full bg-[#12100E] px-4 py-8 sm:px-6 flex flex-col justify-center text-[#FAF5EE]">
      <div className="mx-auto w-full max-w-5xl">
        <button
          type="button"
          onClick={onBackToWelcome}
          className="mb-6 inline-flex items-center gap-2 rounded-xl border border-[#2E2924] bg-[#1C1916] px-3.5 py-2 text-xs font-semibold text-[#FAF5EE] transition hover:bg-[#2E2924]"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Welcome Page</span>
        </button>

        <div className="grid grid-cols-1 overflow-hidden rounded-3xl border border-[#2E2924] bg-[#1C1916] shadow-2xl lg:grid-cols-12">
          {/* Left Hero / Brand Card */}
          <div className="relative flex flex-col justify-between border-b border-[#2E2924] p-8 lg:col-span-5 lg:border-b-0 lg:border-r bg-gradient-to-br from-[#1C1916] via-[#241F1B] to-[#12100E]">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#E85D04] to-[#F48C06] shadow-lg shadow-orange-950/40">
                  <Bus className="h-6 w-6 text-white" />
                </div>
                <div>
                  <span className="font-display text-lg font-bold tracking-tight text-[#FAF5EE]">
                    MargFlow UP
                  </span>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#F48C06]">
                    Transit Intelligence
                  </p>
                </div>
              </div>

              <div className="mt-8 space-y-3">
                <h2 className="font-display text-2xl font-bold leading-tight text-[#FAF5EE]">
                  Uttar Pradesh Intelligent Bus Mobility
                </h2>
                <p className="text-xs text-[#C4B9AC] leading-relaxed">
                  Real-time GPS telemetry from UPSRTC Janrath, Lucknow Electric, and state express corridors fused into live traffic intelligence and instant ticket booking.
                </p>
              </div>

              <div className="mt-8 space-y-3 rounded-2xl border border-[#2E2924] bg-[#12100E]/70 p-4 text-xs text-[#C4B9AC]">
                <div className="flex items-center gap-2 font-bold text-[#FAF5EE]">
                  <ShieldCheck className="h-4 w-4 text-[#F48C06]" />
                  <span>Firebase Console &amp; Cloud Sync</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Project <span className="font-mono text-[#FAF5EE]">{firebaseConfig.projectId}</span> is connected to Firestore for commuter profiles, saved corridors, and e-tickets.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <a
                    href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/providers`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-[#E85D04]/40 bg-[#E85D04]/10 px-2.5 py-1 text-[10px] font-bold text-[#F48C06] hover:bg-[#E85D04]/20 transition"
                  >
                    Auth Providers
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <a
                    href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/data`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-[#2E2924] bg-[#1C1916] px-2.5 py-1 text-[10px] font-semibold text-[#FAF5EE] hover:border-[#E85D04] transition"
                  >
                    Firestore Console
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-[#2E2924]">
              <button
                type="button"
                onClick={onContinueAsGuest}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-[#E85D04]/60 bg-[#E85D04]/10 py-2.5 text-xs font-bold text-[#F48C06] hover:bg-[#E85D04]/20 transition"
              >
                <span>Continue as Guest Commuter (Demo)</span>
              </button>
            </div>
          </div>

          {/* Right Forms Area */}
          <div className="p-8 lg:col-span-7 bg-[#1C1916]">
            {/* Mode Switcher Tabs */}
            <div className="mb-6 flex rounded-xl border border-[#2E2924] bg-[#12100E] p-1">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMsg(null);
                  setInfoMsg(null);
                }}
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold transition ${
                  mode === 'login'
                    ? 'bg-[#E85D04] text-white shadow-sm'
                    : 'text-[#C4B9AC] hover:text-[#FAF5EE]'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setErrorMsg(null);
                  setInfoMsg(null);
                }}
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold transition ${
                  mode === 'register'
                    ? 'bg-[#E85D04] text-white shadow-sm'
                    : 'text-[#C4B9AC] hover:text-[#FAF5EE]'
                }`}
              >
                Register
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('preferences-form');
                  setErrorMsg(null);
                  setInfoMsg(null);
                }}
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold transition ${
                  mode === 'preferences-form'
                    ? 'bg-[#E85D04] text-white shadow-sm'
                    : 'text-[#C4B9AC] hover:text-[#FAF5EE]'
                }`}
              >
                Google Form Survey
              </button>
            </div>

            {errorMsg && (
              <div className="mb-5 flex flex-col gap-2 rounded-xl border border-red-900/50 bg-red-950/30 p-3.5 text-xs text-red-200">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
                {errorMsg.includes('Firebase Console') && (
                  <a
                    href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/providers`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="self-start inline-flex items-center gap-1.5 rounded-lg bg-[#E85D04] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#D65202]"
                  >
                    Open Firebase Console Auth
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            )}

            {infoMsg && (
              <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-emerald-900/50 bg-emerald-950/30 p-3.5 text-xs text-emerald-200">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                <span>{infoMsg}</span>
              </div>
            )}

            {mode !== 'preferences-form' ? (
              <div className="space-y-5">
                {/* Google Sign-In */}
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleGoogleSignIn}
                  className="flex w-full items-center justify-center gap-3 rounded-xl border border-[#2E2924] bg-[#12100E] px-4 py-3 text-xs font-bold text-[#FAF5EE] shadow-sm transition hover:bg-[#241F1B] disabled:opacity-60"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                    />
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </button>

                <div className="relative flex items-center py-1">
                  <div className="flex-grow border-t border-[#2E2924]" />
                  <span className="mx-3 text-[10px] font-bold uppercase tracking-wider text-[#C4B9AC]">
                    or email credentials
                  </span>
                  <div className="flex-grow border-t border-[#2E2924]" />
                </div>

                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  {mode === 'register' && (
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-[#C4B9AC]">
                        Full Name
                      </label>
                      <div className="relative">
                        <UserIcon className="absolute left-3.5 top-3 h-4 w-4 text-stone-500" />
                        <input
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="Ananya Sharma"
                          className="w-full rounded-xl border border-[#2E2924] bg-[#12100E] pl-10 pr-4 py-2.5 text-xs text-[#FAF5EE] outline-none focus:border-[#E85D04]"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-[#C4B9AC]">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3 h-4 w-4 text-stone-500" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="commuter@up-transit.org"
                        className="w-full rounded-xl border border-[#2E2924] bg-[#12100E] pl-10 pr-4 py-2.5 text-xs text-[#FAF5EE] outline-none focus:border-[#E85D04]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-[#C4B9AC]">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3 h-4 w-4 text-stone-500" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimum 6 characters"
                        className="w-full rounded-xl border border-[#2E2924] bg-[#12100E] pl-10 pr-4 py-2.5 text-xs text-[#FAF5EE] outline-none focus:border-[#E85D04]"
                      />
                    </div>
                  </div>

                  {/* 1-Click Demo Fill */}
                  <div className="flex items-center justify-between text-[11px]">
                    <button
                      type="button"
                      onClick={handleFillDemoCredentials}
                      className="inline-flex items-center gap-1 font-semibold text-[#F48C06] hover:underline"
                    >
                      <Sparkles className="h-3 w-3" />
                      <span>Fill Demo Credentials</span>
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-xl bg-gradient-to-r from-[#E85D04] to-[#F48C06] px-4 py-3 text-xs font-bold text-white shadow-lg shadow-orange-950/20 transition hover:brightness-110 disabled:opacity-60"
                  >
                    {submitting
                      ? 'Authenticating...'
                      : mode === 'register'
                        ? 'Create Commuter Account'
                        : 'Sign In to MargFlow'}
                  </button>
                </form>
              </div>
            ) : (
              /* Google Forms Integration Panel */
              <div className="space-y-4">
                <div className="rounded-xl border border-[#2E2924] bg-[#12100E] p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#F48C06]">
                      <ClipboardList className="h-4 w-4" />
                      Commuter Travel Preferences (Google Forms)
                    </span>
                    <span className="rounded bg-emerald-950/50 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-800/40">
                      NO PASSWORDS COLLECTED
                    </span>
                  </div>
                  <p className="text-xs text-[#C4B9AC] leading-relaxed">
                    Submit preferred Uttar Pradesh travel corridors and commute windows. Passwords are never collected via Google Forms.
                  </p>
                </div>

                <form onSubmit={handleSaveCommuterPreferences} className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#C4B9AC]">
                      Frequent UP Corridor
                    </label>
                    <select
                      value={prefRoute}
                      onChange={(e) => setPrefRoute(e.target.value)}
                      className="w-full rounded-xl border border-[#2E2924] bg-[#12100E] px-3 py-2 text-xs text-[#FAF5EE] outline-none focus:border-[#E85D04]"
                    >
                      <option>JANRATH-101 UPSRTC Janrath AC Express</option>
                      <option>EV-202 Lucknow City Electric Circular</option>
                      <option>SHD-303 Shaheed Path Airport &amp; IT Express</option>
                      <option>HRT-404 Old City Heritage Feeder</option>
                      <option>PVN-606 Purvanchal State Superfast</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#C4B9AC]">
                        Usual Travel Window
                      </label>
                      <select
                        value={prefSlot}
                        onChange={(e) => setPrefSlot(e.target.value)}
                        className="w-full rounded-xl border border-[#2E2924] bg-[#12100E] px-3 py-2 text-xs text-[#FAF5EE] outline-none focus:border-[#E85D04]"
                      >
                        <option>08:30 – 10:00 AM Peak</option>
                        <option>12:00 – 03:00 PM Midday</option>
                        <option>05:30 – 07:30 PM Rush</option>
                        <option>Flexible / Off-Peak</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#C4B9AC]">
                        Journey Priority
                      </label>
                      <select
                        value={prefGoal}
                        onChange={(e) => setPrefGoal(e.target.value)}
                        className="w-full rounded-xl border border-[#2E2924] bg-[#12100E] px-3 py-2 text-xs text-[#FAF5EE] outline-none focus:border-[#E85D04]"
                      >
                        <option>Fastest predicted ETA</option>
                        <option>Least congested corridor</option>
                        <option>Direct AC Janrath seat</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#C4B9AC]">
                      Google Form Embed / Survey URL (Optional)
                    </label>
                    <input
                      type="url"
                      value={googleFormUrl}
                      onChange={(e) => onUpdateGoogleFormUrl(e.target.value)}
                      placeholder="https://docs.google.com/forms/d/e/.../viewform?embedded=true"
                      className="w-full rounded-xl border border-[#2E2924] bg-[#12100E] px-3 py-2 text-xs font-mono text-[#FAF5EE] outline-none focus:border-[#E85D04]"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button
                      type="submit"
                      className="rounded-xl bg-[#E85D04] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#D65202]"
                    >
                      {prefSaved ? 'Preferences Saved' : 'Save Travel Preferences'}
                    </button>
                    {googleFormUrl.trim().startsWith('https://docs.google.com/forms') && (
                      <a
                        href={googleFormUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[#2E2924] bg-[#12100E] px-3.5 py-2.5 text-xs font-semibold text-[#FAF5EE] hover:bg-[#241F1B]"
                      >
                        Open Google Form
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
