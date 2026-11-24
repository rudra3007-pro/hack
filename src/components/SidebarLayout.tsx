import { useState, type ReactNode } from 'react';
import {
  Activity,
  BarChart3,
  Bus,
  Compass,
  History,
  Home,
  LogIn,
  LogOut,
  Menu,
  Moon,
  Pause,
  Play,
  Radio,
  Settings,
  Sun,
  Terminal,
  Ticket,
  User,
  X,
} from 'lucide-react';
import { TIME_BUCKET_PRESETS } from '../data/cityNetwork.ts';
import type {
  SidebarSection,
  StreamStatus,
  TimeBucketId,
  UserSessionProfile,
} from '../types/transit.ts';

interface SidebarLayoutProps {
  activeSection: SidebarSection;
  onSelectSection: (section: SidebarSection) => void;
  streamStatus: StreamStatus;
  onToggleStream: () => void;
  timeBucket: TimeBucketId;
  onChangeTimeBucket: (bucket: TimeBucketId) => void;
  lastUpdatedLabel: string;
  userProfile: UserSessionProfile;
  onOpenAuth: () => void;
  onSignOut: () => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  children: ReactNode;
}

const NAV_ITEMS: Array<{
  id: SidebarSection;
  label: string;
  icon: typeof Home;
}> = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'live-tracking', label: 'Live Bus Tracking', icon: Bus },
  { id: 'journey-planner', label: 'Journey Planner', icon: Compass },
  { id: 'book-tickets', label: 'Book Tickets', icon: Ticket },
  { id: 'traffic-analytics', label: 'Traffic Analytics', icon: Activity },
  { id: 'historical-data', label: 'Historical Data', icon: History },
  { id: 'api-playground', label: 'API Playground', icon: Terminal },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'profile', label: 'Profile', icon: User },
];

export default function SidebarLayout({
  activeSection,
  onSelectSection,
  streamStatus,
  onToggleStream,
  timeBucket,
  onChangeTimeBucket,
  lastUpdatedLabel,
  userProfile,
  onOpenAuth,
  onSignOut,
  isDarkMode = false,
  onToggleDarkMode,
  children,
}: SidebarLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const activeTitle =
    NAV_ITEMS.find((item) => item.id === activeSection)?.label || 'Dashboard';

  const SidebarContent = (
    <div className="flex h-full flex-col justify-between bg-[#1C1916] text-[#FAF5EE] border-r border-[#2E2924]">
      <div>
        {/* Brand */}
        <div className="flex items-center justify-between border-b border-[#2E2924] px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#E85D04] to-[#F48C06] shadow-lg shadow-orange-950/40">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="font-display text-base font-bold tracking-tight text-[#FAF5EE]">
                MargFlow
              </span>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#F48C06]">
                UP Bus Traffic Model
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="rounded-lg p-1.5 text-stone-400 hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="mt-4 space-y-1 px-3" aria-label="Main Sidebar">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectSection(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition ${
                  active
                    ? 'bg-gradient-to-r from-[#E85D04] to-[#F48C06] text-white shadow-md shadow-orange-950/30'
                    : 'text-[#C4B9AC] hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-white' : 'text-[#F48C06]'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Actions & User Strip */}
      <div className="space-y-3 border-t border-[#2E2924] p-4">
        {/* Dark Mode & Demo Status Ribbon */}
        <div className="flex items-center justify-between rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
          <div className="flex items-center gap-1.5 font-bold text-[#F48C06]">
            <Radio className="h-3.5 w-3.5 animate-pulse" />
            <span>UP TELEMETRY</span>
          </div>

          {onToggleDarkMode && (
            <button
              type="button"
              onClick={onToggleDarkMode}
              className="flex items-center gap-1 rounded-lg bg-stone-900/60 px-2 py-1 text-[10px] font-semibold text-stone-200 hover:text-white"
              title="Toggle Dark / Light Mode"
            >
              {isDarkMode ? (
                <>
                  <Sun className="h-3 w-3 text-amber-400" />
                  <span>Light</span>
                </>
              ) : (
                <>
                  <Moon className="h-3 w-3 text-stone-300" />
                  <span>Dark</span>
                </>
              )}
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 rounded-xl border border-[#2E2924] bg-stone-900/40 p-2.5">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-[#FAF5EE]">
              {userProfile.displayName}
            </p>
            <p className="truncate text-[10px] text-[#C4B9AC]">
              {userProfile.isGuest ? 'Guest Commuter' : userProfile.email || 'Authenticated'}
            </p>
          </div>
          {userProfile.isGuest ? (
            <button
              type="button"
              onClick={onOpenAuth}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#E85D04] px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-[#D65202]"
              title="Sign In or Register"
            >
              <LogIn className="h-3.5 w-3.5" />
              Sign In
            </button>
          ) : (
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 p-1.5 text-[#C4B9AC] hover:bg-white/10 hover:text-white"
              title="Sign Out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className={`flex h-screen w-full overflow-hidden ${isDarkMode ? 'dark bg-[#12100E]' : 'bg-stone-50'}`}>
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-[#2E2924] lg:block">
        {SidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 w-68 max-w-[82vw] shadow-2xl">
            {SidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-stone-50 dark:bg-[#12100E] text-stone-900 dark:text-[#FAF5EE]">
        {/* Top Utility Header */}
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-stone-200 dark:border-[#2E2924] bg-white dark:bg-[#1C1916] px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-lg border border-stone-200 dark:border-[#2E2924] p-2 text-stone-700 dark:text-[#FAF5EE] hover:bg-stone-100 dark:hover:bg-[#2E2924] lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h1 className="font-display text-base font-bold text-stone-900 dark:text-[#FAF5EE] sm:text-lg">
                {activeTitle}
              </h1>
              <p className="text-[11px] text-stone-500 dark:text-[#C4B9AC]">
                Uttar Pradesh Bus Traffic Intelligence · Updated{' '}
                <span className="font-mono font-medium text-stone-800 dark:text-[#FAF5EE]">{lastUpdatedLabel}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Time-of-day selector */}
            <div className="hidden sm:flex items-center rounded-xl border border-stone-200 dark:border-[#2E2924] bg-stone-100 dark:bg-[#12100E] p-0.5">
              {TIME_BUCKET_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onChangeTimeBucket(preset.id)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    timeBucket === preset.id
                      ? 'bg-[#E85D04] text-white shadow-xs'
                      : 'text-stone-600 dark:text-[#C4B9AC] hover:text-stone-900 dark:hover:text-[#FAF5EE]'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Dark / Light Mode Header Button */}
            {onToggleDarkMode && (
              <button
                type="button"
                onClick={onToggleDarkMode}
                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 dark:border-[#2E2924] bg-stone-100 dark:bg-[#12100E] px-3 py-1.5 text-xs font-semibold text-stone-700 dark:text-[#FAF5EE] hover:border-[#E85D04] hover:text-[#E85D04] transition"
                title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {isDarkMode ? (
                  <>
                    <Sun className="h-3.5 w-3.5 text-[#F48C06]" />
                    <span>Light Mode</span>
                  </>
                ) : (
                  <>
                    <Moon className="h-3.5 w-3.5 text-[#E85D04]" />
                    <span>Dark Mode</span>
                  </>
                )}
              </button>
            )}

            {/* Stream Active / Pause toggle */}
            <button
              type="button"
              onClick={onToggleStream}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                streamStatus === 'active'
                  ? 'border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100'
                  : 'border-stone-200 dark:border-[#2E2924] bg-stone-100 dark:bg-[#12100E] text-stone-700 dark:text-[#C4B9AC] hover:bg-stone-200'
              }`}
            >
              {streamStatus === 'active' ? (
                <>
                  <Pause className="h-3.5 w-3.5" />
                  <span>Stream Active</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" />
                  <span>Paused</span>
                </>
              )}
            </button>
          </div>
        </header>

        {/* Scrollable / Full-Height Page Body */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-5">{children}</main>
      </div>
    </div>
  );
}
