import { useEffect, useState } from 'react';
import { BarChart3, Calendar, Clock, Flame, TrendingUp } from 'lucide-react';
import type { HistoricalAnalyticsApiResponse, HistoricalRangeId } from '../types/transit.ts';

export default function HistoricalDataView() {
  const [range, setRange] = useState<HistoricalRangeId>('7d');
  const [selectedDate, setSelectedDate] = useState<string>('2026-11-24');
  const [data, setData] = useState<HistoricalAnalyticsApiResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/v1/analytics/historical?range=${range}&date=${encodeURIComponent(selectedDate)}`
        );
        if (!res.ok) return;
        const json: HistoricalAnalyticsApiResponse = await res.json();
        if (!cancelled) setData(json);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [range, selectedDate]);

  const hourly = data?.hourly_trends || [];
  const daily = data?.daily_comparison || [];
  const roads = data?.road_averages || [];
  const routes = data?.route_comparisons || [];

  return (
    <div className="space-y-5">
      {/* Date & Range Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 dark:border-[#2E2924] bg-white dark:bg-[#1C1916] p-4 shadow-xs">
        <div>
          <h2 className="font-display text-base font-bold text-stone-900 dark:text-[#FAF5EE]">
            Historical Bus GPS Traffic Analytics
          </h2>
          <p className="text-xs text-stone-500 dark:text-[#C4B9AC]">
            Analyze Uttar Pradesh bus corridors, peak-hour congestion trends, and route reliability curves
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-xl border border-stone-200 dark:border-[#2E2924] bg-stone-50 dark:bg-[#12100E] p-1">
            {(
              [
                { id: 'today', label: 'Today' },
                { id: '7d', label: '7 Days' },
                { id: '30d', label: '30 Days' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setRange(opt.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  range === opt.id
                    ? 'bg-[#E85D04] text-white shadow-xs'
                    : 'text-stone-600 dark:text-[#C4B9AC] hover:text-stone-900 dark:hover:text-[#FAF5EE]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-stone-200 dark:border-[#2E2924] bg-stone-50 dark:bg-[#12100E] px-3 py-1.5">
            <Calendar className="h-4 w-4 text-[#E85D04]" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-mono font-medium text-stone-800 dark:text-[#FAF5EE] outline-none"
            />
          </div>
        </div>
      </div>

      {/* Summary KPI Row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-stone-200 dark:border-[#2E2924] bg-white dark:bg-[#1C1916] p-4 shadow-xs">
          <p className="text-xs font-medium text-stone-500 dark:text-[#C4B9AC]">Avg Network Speed</p>
          <p className="mt-1 font-display text-2xl font-bold text-stone-900 dark:text-[#FAF5EE]">
            {data?.summary.avg_network_speed_kmh ?? '--'} km/h
          </p>
          <p className="text-[11px] text-stone-400">Across {range.toUpperCase()} window</p>
        </div>
        <div className="rounded-2xl border border-stone-200 dark:border-[#2E2924] bg-white dark:bg-[#1C1916] p-4 shadow-xs">
          <p className="text-xs font-medium text-stone-500 dark:text-[#C4B9AC]">Peak Congestion Hour</p>
          <p className="mt-1 font-display text-lg font-bold text-[#D62828]">
            {data?.summary.peak_congestion_hour ?? '18:00'}
          </p>
          <p className="text-[11px] text-stone-400">Shaheed Path &amp; ISBT surge</p>
        </div>
        <div className="rounded-2xl border border-stone-200 dark:border-[#2E2924] bg-white dark:bg-[#1C1916] p-4 shadow-xs">
          <p className="text-xs font-medium text-stone-500 dark:text-[#C4B9AC]">Smoothest Travel Hour</p>
          <p className="mt-1 font-display text-lg font-bold text-[#52796F]">
            {data?.summary.smoothest_hour ?? '22:00'}
          </p>
          <p className="text-[11px] text-stone-400">Near free-flow speeds</p>
        </div>
        <div className="rounded-2xl border border-stone-200 dark:border-[#2E2924] bg-white dark:bg-[#1C1916] p-4 shadow-xs">
          <p className="text-xs font-medium text-stone-500 dark:text-[#C4B9AC]">GPS Pings Analyzed</p>
          <p className="mt-1 font-display text-2xl font-bold text-[#E85D04]">
            {data ? data.summary.total_gps_pings_analyzed.toLocaleString() : '--'}
          </p>
          <p className="text-[11px] text-[#F48C06] font-medium">
            {loading ? 'Refreshing...' : 'UP Telemetry Archive'}
          </p>
        </div>
      </div>

      {/* Hourly Peak-Hour Curve & Daily Comparison */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Hourly Speed Curve */}
        <div className="rounded-2xl border border-stone-200 dark:border-[#2E2924] bg-white dark:bg-[#1C1916] p-5 shadow-xs lg:col-span-7">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4.5 w-4.5 text-[#E85D04]" />
              <h3 className="font-display text-sm font-bold text-stone-900 dark:text-[#FAF5EE]">
                Peak-Hour Speed &amp; Congestion Trend (06:00 – 22:00)
              </h3>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="inline-flex items-center gap-1 text-stone-700 dark:text-[#FAF5EE]">
                <span className="h-2.5 w-2.5 rounded-full bg-[#E85D04]" /> Historical Avg
              </span>
              <span className="inline-flex items-center gap-1 text-stone-500 dark:text-[#C4B9AC]">
                <span className="h-2.5 w-2.5 rounded-full bg-[#F48C06]" /> Observed
              </span>
            </div>
          </div>

          {hourly.length > 0 && (
            <div className="w-full overflow-x-auto">
              <svg viewBox="0 0 680 230" className="h-56 w-full min-w-[520px]">
                {/* Horizontal Grid */}
                {[10, 20, 30, 40].map((spd) => {
                  const y = 195 - (spd / 45) * 165;
                  return (
                    <g key={spd}>
                      <line x1="40" y1={y} x2="660" y2={y} stroke="#3D352E" strokeDasharray="4 4" opacity="0.4" />
                      <text x="8" y={y + 4} fontSize="10" fill="#888">
                        {spd}
                      </text>
                    </g>
                  );
                })}

                {/* Historical Line */}
                <polyline
                  fill="none"
                  stroke="#E85D04"
                  strokeWidth="3"
                  strokeLinejoin="round"
                  points={hourly
                    .map((h, i) => {
                      const x = 48 + (i / Math.max(1, hourly.length - 1)) * 604;
                      const y = 195 - (h.historical_speed_kmh / 45) * 165;
                      return `${x},${y}`;
                    })
                    .join(' ')}
                />

                {/* Observed Line */}
                <polyline
                  fill="none"
                  stroke="#F48C06"
                  strokeWidth="2.5"
                  strokeDasharray="6 4"
                  points={hourly
                    .map((h, i) => {
                      const x = 48 + (i / Math.max(1, hourly.length - 1)) * 604;
                      const y = 195 - (h.current_speed_kmh / 45) * 165;
                      return `${x},${y}`;
                    })
                    .join(' ')}
                />

                {/* Hour Labels */}
                {hourly.map((h, i) => {
                  if (i % 2 !== 0 && i !== hourly.length - 1) return null;
                  const x = 48 + (i / Math.max(1, hourly.length - 1)) * 604;
                  return (
                    <text
                      key={h.hour}
                      x={x}
                      y="218"
                      fontSize="9"
                      fill="#888"
                      textAnchor="middle"
                      fontFamily="monospace"
                    >
                      {h.hour}
                    </text>
                  );
                })}
              </svg>
            </div>
          )}
        </div>

        {/* Daily / Weekly Comparison */}
        <div className="rounded-2xl border border-stone-200 dark:border-[#2E2924] bg-white dark:bg-[#1C1916] p-5 shadow-xs lg:col-span-5">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-4.5 w-4.5 text-[#F48C06]" />
            <h3 className="font-display text-sm font-bold text-stone-900 dark:text-[#FAF5EE]">
              Daily / Weekly Congestion Comparison
            </h3>
          </div>

          <div className="space-y-3">
            {daily.map((d) => {
              const barColor =
                d.congestion_pct >= 55
                  ? '#D62828'
                  : d.congestion_pct >= 42
                    ? '#E85D04'
                    : d.congestion_pct >= 30
                      ? '#F48C06'
                      : '#52796F';
              return (
                <div key={d.day} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-stone-900 dark:text-[#FAF5EE] w-10">{d.day}</span>
                    <span className="font-mono text-stone-500 dark:text-[#C4B9AC]">
                      Avg {d.avg_speed_kmh} km/h · +{d.peak_delay_min}m peak
                    </span>
                    <span className="font-mono font-bold text-stone-800 dark:text-[#FAF5EE]">{d.congestion_pct}%</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-stone-100 dark:bg-[#12100E]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${d.congestion_pct}%`, backgroundColor: barColor }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Road-by-Road Historical Averages & Route Travel Time Comparisons */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="rounded-2xl border border-stone-200 dark:border-[#2E2924] bg-white dark:bg-[#1C1916] p-5 shadow-xs lg:col-span-7">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="h-4.5 w-4.5 text-[#E85D04]" />
              <h3 className="font-display text-sm font-bold text-stone-900 dark:text-[#FAF5EE]">
                Average Speeds by Corridor &amp; Frequent Bottlenecks
              </h3>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-200 dark:border-[#2E2924] text-[11px] uppercase tracking-wider text-stone-400">
                  <th className="py-2 pr-3">Road Segment</th>
                  <th className="py-2 px-2">Hist Avg</th>
                  <th className="py-2 px-2">Peak Avg</th>
                  <th className="py-2 px-2">Off-Peak</th>
                  <th className="py-2 pl-2 text-right">Jam Freq</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-[#2E2924]">
                {roads.slice(0, 10).map((road) => (
                  <tr key={road.segment_id} className="hover:bg-stone-50 dark:hover:bg-[#12100E]">
                    <td className="py-2.5 pr-3">
                      <p className="font-semibold text-stone-900 dark:text-[#FAF5EE]">{road.road_name}</p>
                      <p className="text-[10px] text-stone-500 dark:text-[#C4B9AC]">{road.corridor}</p>
                    </td>
                    <td className="py-2.5 px-2 font-mono font-semibold text-stone-800 dark:text-[#FAF5EE]">
                      {road.historical_avg_kmh} km/h
                    </td>
                    <td className="py-2.5 px-2 font-mono text-[#E85D04]">
                      {road.peak_avg_kmh} km/h
                    </td>
                    <td className="py-2.5 px-2 font-mono text-[#52796F]">
                      {road.offpeak_avg_kmh} km/h
                    </td>
                    <td className="py-2.5 pl-2 text-right">
                      <span
                        className={`inline-flex rounded-md px-2 py-0.5 font-mono text-[11px] font-bold ${
                          road.frequent_hotspot
                            ? 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300'
                            : 'bg-stone-100 dark:bg-[#2E2924] text-stone-700 dark:text-[#C4B9AC]'
                        }`}
                      >
                        {road.congestion_frequency_pct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200 dark:border-[#2E2924] bg-white dark:bg-[#1C1916] p-5 shadow-xs lg:col-span-5">
          <div className="mb-3 flex items-center gap-2">
            <Clock className="h-4.5 w-4.5 text-[#E85D04]" />
            <h3 className="font-display text-sm font-bold text-stone-900 dark:text-[#FAF5EE]">
              Historical Route Travel-Time Comparison
            </h3>
          </div>

          <div className="space-y-3">
            {routes.map((rt) => (
              <div
                key={rt.route_short_name}
                className="rounded-xl border border-stone-200 dark:border-[#2E2924] bg-stone-50 dark:bg-[#12100E] p-3.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="rounded bg-[#E85D04] px-2 py-0.5 font-mono text-[11px] font-bold text-white mr-2">
                      {rt.route_short_name}
                    </span>
                    <span className="text-xs font-bold text-stone-900 dark:text-[#FAF5EE]">{rt.route_name}</span>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    {rt.reliability_pct}% on-time
                  </span>
                </div>
                <div className="mt-2.5 grid grid-cols-3 gap-2 text-center text-[11px]">
                  <div className="rounded-lg bg-white dark:bg-[#1C1916] p-2 border border-stone-200 dark:border-[#2E2924]">
                    <p className="text-stone-400 text-[10px]">Off-Peak</p>
                    <p className="font-mono font-bold text-[#52796F]">{rt.offpeak_trip_min}m</p>
                  </div>
                  <div className="rounded-lg bg-white dark:bg-[#1C1916] p-2 border border-stone-200 dark:border-[#2E2924]">
                    <p className="text-stone-400 text-[10px]">Average</p>
                    <p className="font-mono font-bold text-stone-900 dark:text-[#FAF5EE]">{rt.avg_trip_min}m</p>
                  </div>
                  <div className="rounded-lg bg-white dark:bg-[#1C1916] p-2 border border-stone-200 dark:border-[#2E2924]">
                    <p className="text-stone-400 text-[10px]">Peak Rush</p>
                    <p className="font-mono font-bold text-[#D62828]">{rt.peak_trip_min}m</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
