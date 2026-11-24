import { ArrowRight, Bus, Compass, MapPin, Navigation, Radio, ShieldCheck, Ticket, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';

interface WelcomeViewProps {
  onGetStarted: () => void;
  onExplorePlatform: () => void;
}

// STRICTLY ZERO BLUE: Warm transit animated corridors
const ANIMATED_CORRIDORS = [
  { id: 'c1', path: 'M 80 420 Q 320 380 540 280 T 1080 180', color: '#F48C06', dur: 9, delay: 0 },
  { id: 'c2', path: 'M 140 120 Q 420 260 660 340 T 1120 490', color: '#E85D04', dur: 11, delay: 1.5 },
  { id: 'c3', path: 'M 220 580 Q 480 420 720 310 T 1060 90', color: '#52796F', dur: 10, delay: 0.8 },
  { id: 'c4', path: 'M 60 260 Q 380 290 610 410 T 1140 360', color: '#D62828', dur: 13, delay: 2.2 },
];

export default function WelcomeView({ onGetStarted, onExplorePlatform }: WelcomeViewProps) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#12100E] text-[#FAF5EE] flex flex-col justify-between">
      {/* Animated Smart-City Vector Map & Moving Buses Background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Radial warm transit glow */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 24% 28%, rgba(232, 93, 4, 0.22), transparent 46%), radial-gradient(circle at 78% 72%, rgba(244, 140, 6, 0.16), transparent 48%), linear-gradient(160deg, #12100E 0%, #1A1613 55%, #241D17 100%)',
          }}
        />

        {/* Subtle city block grid */}
        <svg
          className="absolute inset-0 h-full w-full opacity-20"
          viewBox="0 0 1200 700"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <defs>
            <pattern id="smartCityGrid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#3D352E" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="1200" height="700" fill="url(#smartCityGrid)" />

          {/* Secondary road lattice */}
          <g stroke="#3D352E" strokeWidth="1.5" fill="none" opacity="0.75">
            <path d="M 0 190 L 1200 190" />
            <path d="M 0 360 L 1200 360" />
            <path d="M 0 520 L 1200 520" />
            <path d="M 240 0 L 240 700" />
            <path d="M 560 0 L 560 700" />
            <path d="M 880 0 L 880 700" />
          </g>

          {/* Animated Transit Corridors & Moving Buses */}
          {ANIMATED_CORRIDORS.map((corridor) => (
            <g key={corridor.id}>
              <path
                d={corridor.path}
                fill="none"
                stroke={corridor.color}
                strokeWidth="3"
                strokeOpacity="0.25"
              />
              <path
                d={corridor.path}
                fill="none"
                stroke={corridor.color}
                strokeWidth="2.5"
                strokeDasharray="10 14"
                strokeOpacity="0.85"
              />
              {/* Moving Bus Marker */}
              <g>
                <circle r="7" fill="#FFFFFF" stroke={corridor.color} strokeWidth="3">
                  <animateMotion
                    dur={`${corridor.dur}s`}
                    begin={`${corridor.delay}s`}
                    repeatCount="indefinite"
                    path={corridor.path}
                  />
                </circle>
                <circle r="15" fill="none" stroke={corridor.color} strokeWidth="1.5" opacity="0.55">
                  <animateMotion
                    dur={`${corridor.dur}s`}
                    begin={`${corridor.delay}s`}
                    repeatCount="indefinite"
                    path={corridor.path}
                  />
                </circle>
              </g>
            </g>
          ))}

          {/* Pulsing GPS Nodes */}
          {[
            { cx: 240, cy: 360, color: '#52796F' },
            { cx: 560, cy: 295, color: '#F48C06' },
            { cx: 740, cy: 340, color: '#E85D04' },
            { cx: 880, cy: 215, color: '#D62828' },
            { cx: 420, cy: 480, color: '#F48C06' },
          ].map((node, idx) => (
            <g key={idx}>
              <circle cx={node.cx} cy={node.cy} r="5" fill={node.color} />
              <circle
                cx={node.cx}
                cy={node.cy}
                r="18"
                fill="none"
                stroke={node.color}
                strokeWidth="1.5"
                opacity="0.45"
              >
                <animate
                  attributeName="r"
                  from="6"
                  to="32"
                  dur="2.8s"
                  begin={`${idx * 0.45}s`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  from="0.7"
                  to="0"
                  dur="2.8s"
                  begin={`${idx * 0.45}s`}
                  repeatCount="indefinite"
                />
              </circle>
            </g>
          ))}
        </svg>
      </div>

      {/* Top Navigation Strip */}
      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 sm:px-10">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#E85D04] to-[#F48C06] shadow-lg shadow-orange-950/40">
            <Bus className="h-6 w-6 text-white" />
          </div>
          <div>
            <span className="font-display text-lg font-bold tracking-tight text-[#FAF5EE]">
              MargFlow
            </span>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#F48C06]">
              Uttar Pradesh Bus Traffic Model
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200">
            <Radio className="h-3.5 w-3.5 text-[#F48C06] animate-pulse" />
            UP Sensor Fleet Active
          </span>
          <button
            type="button"
            onClick={onGetStarted}
            className="rounded-xl border border-[#2E2924] bg-[#1C1916] px-4 py-2 text-sm font-semibold text-[#FAF5EE] backdrop-blur-md transition hover:bg-[#2E2924]"
          >
            Sign In
          </button>
        </div>
      </header>

      {/* Main Hero */}
      <main className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-6 py-10 sm:px-10">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: 'easeOut' }}
            className="lg:col-span-7 space-y-6"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[#F48C06]">
              <Navigation className="h-3.5 w-3.5" />
              Uttar Pradesh Smart Transit Intelligence
            </div>

            <h1 className="font-display text-4xl font-extrabold tracking-tight text-[#FAF5EE] sm:text-5xl lg:text-6xl leading-[1.08]">
              Move Smarter. <br />
              <span className="bg-gradient-to-r from-[#F48C06] via-[#E85D04] to-white bg-clip-text text-transparent">
                Travel Better.
              </span>
            </h1>

            <p className="max-w-xl text-base leading-relaxed text-[#C4B9AC] sm:text-lg">
              Transforming public transport data into intelligent city-wide mobility.
              Monitor live UPSRTC and city electric bus GPS telemetry across Lucknow, Kanpur, and Ayodhya,
              plan congestion-aware journeys, and reserve bus seats instantly.
            </p>

            {/* Primary Animated Buttons */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <motion.button
                type="button"
                whileHover={{ scale: 1.03, y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={onGetStarted}
                className="inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-[#E85D04] to-[#F48C06] px-7 py-3.5 text-base font-bold text-white shadow-xl shadow-orange-950/40 transition hover:brightness-110"
              >
                Get Started
                <ArrowRight className="h-5 w-5" />
              </motion.button>

              <motion.button
                type="button"
                whileHover={{ scale: 1.03, y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={onExplorePlatform}
                className="inline-flex items-center gap-2.5 rounded-xl border border-[#2E2924] bg-[#1C1916] px-7 py-3.5 text-base font-semibold text-[#FAF5EE] backdrop-blur-md transition hover:bg-[#2E2924]"
              >
                <Compass className="h-5 w-5 text-[#F48C06]" />
                Explore Platform
              </motion.button>
            </div>

            {/* Traffic legend strip */}
            <div className="flex flex-wrap items-center gap-5 pt-4 text-xs text-[#C4B9AC]">
              <span className="font-semibold uppercase tracking-wider text-stone-400">
                Congestion Signals:
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#52796F]" /> Smooth
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#F48C06]" /> Moderate
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#E85D04]" /> Heavy
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#D62828]" /> Severe
              </span>
            </div>
          </motion.div>

          {/* Smart Mobility Feature Card Preview */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: 'easeOut' }}
            className="lg:col-span-5"
          >
            <div className="rounded-2xl border border-[#2E2924] bg-[#1C1916] p-6 shadow-2xl backdrop-blur-xl space-y-5">
              <div className="flex items-center justify-between border-b border-[#2E2924] pb-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#F48C06]">
                    Uttar Pradesh State Mobility
                  </p>
                  <h2 className="font-display text-lg font-bold text-[#FAF5EE]">
                    Live Fleet-as-Traffic Sensor
                  </h2>
                </div>
                <span className="rounded-md bg-amber-500/20 border border-amber-400/30 px-2.5 py-1 text-[11px] font-semibold text-amber-200">
                  DEMO SENSORS
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-[#2E2924] bg-[#12100E] p-3.5">
                  <p className="text-xs text-[#C4B9AC]">Active Bus Probes</p>
                  <p className="mt-1 font-display text-2xl font-bold text-[#FAF5EE]">32 Units</p>
                  <p className="mt-0.5 text-[11px] text-emerald-400">UPSRTC &amp; EV fleet</p>
                </div>
                <div className="rounded-xl border border-[#2E2924] bg-[#12100E] p-3.5">
                  <p className="text-xs text-[#C4B9AC]">Tracked Corridors</p>
                  <p className="mt-1 font-display text-2xl font-bold text-[#F48C06]">15 Highways</p>
                  <p className="mt-0.5 text-[11px] text-[#C4B9AC]">Shaheed Path &amp; NH-27</p>
                </div>
              </div>

              <div className="space-y-2.5">
                {[
                  {
                    icon: MapPin,
                    title: 'Uttar Pradesh Interactive Tracking',
                    desc: 'Live bus GPS markers across Lucknow, Kanpur, and Ayodhya corridors.',
                  },
                  {
                    icon: Ticket,
                    title: 'Bus Ticket Booking with 2x2 Seat Layout',
                    desc: 'Reserve Janrath AC and EV seats with digital QR code passes and PNR.',
                  },
                  {
                    icon: TrendingUp,
                    title: 'Developer REST API Playground',
                    desc: 'Query live travel-time, road speeds, and historical speed curves with cURL.',
                  },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 rounded-xl border border-[#2E2924] bg-[#12100E]/70 p-3"
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E85D04]/10 text-[#F48C06]">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#FAF5EE]">{item.title}</p>
                      <p className="text-xs text-[#C4B9AC] leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Bottom coordinate bar */}
      <footer className="relative z-10 mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-2 px-6 py-5 text-xs text-[#C4B9AC] sm:px-10 border-t border-[#2E2924]/60">
        <span className="font-mono">GRID REF: 26.8467° N, 80.9462° E · UTTAR PRADESH TRANSIT SENSOR MODEL</span>
        <span>Built for Smart-City Public Transport Analytics &amp; Journey Planning</span>
      </footer>
    </div>
  );
}
