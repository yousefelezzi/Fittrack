import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { nutritionAPI } from '../api';
import {
  NUTRITION_METRICS, NUTRITION_RANGES, rangeDates, dailySeries, seriesStats, TARGET_RULE, formatMl,
} from '../utils/nutritionProgress';
import ChartTooltip, { CHART_CURSOR } from '../components/ChartTooltip';

const COLORS = { calories: '#f97316', protein: '#0ea5e9', carbs: '#eab308', fat: '#a855f7', water: '#06b6d4' };

/** Charts of daily calories, macros and water over 7 / 30 / 90 days, against your goals. */
export default function NutritionProgress() {
  const [metric, setMetric] = useState('calories');
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const { from, to } = rangeDates(days);
    setSummary(null);
    nutritionAPI.summary(from, to).then(({ data }) => setSummary(data)).catch(() => setError('Could not load your nutrition history'));
  }, [days]);

  const [, label, unit] = NUTRITION_METRICS.find(([k]) => k === metric);
  const series = summary ? dailySeries(summary, metric, days) : [];
  const stats = seriesStats(series, metric);
  const fmt = (v) => (v == null ? '–' : metric === 'water' ? formatMl(v) : `${Math.round(v).toLocaleString()} ${unit}`);
  const data = series.map((p) => ({ ...p, label: format(new Date(`${p.date}T00:00`), days > 30 ? 'MMM d' : 'EEE d') }));
  const pill = (active) => `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${active
    ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Nutrition Progress</h1>
      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* What to chart */}
        <div className="flex flex-wrap gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
          {NUTRITION_METRICS.map(([k, l]) => <button key={k} onClick={() => setMetric(k)} className={pill(metric === k)}>{l}</button>)}
        </div>
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
          {NUTRITION_RANGES.map(([n, l]) => <button key={n} onClick={() => setDays(n)} className={pill(days === n)}>{l}</button>)}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="card !p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Daily average</p>
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">{fmt(stats.average)}</p>
        </div>
        <div className="card !p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Days logged</p>
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">{stats.daysLogged} <span className="text-sm font-normal text-gray-400">/ {days}</span></p>
        </div>
        <div className="card !p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">On target</p>
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">{stats.onTarget} <span className="text-sm font-normal text-gray-400">/ {stats.daysWithTarget}</span></p>
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">{label} per day</h2>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">The line is your goal; a day is on target when it's {TARGET_RULE[metric]}. Days with nothing logged are left empty.</p>
        {!summary ? <p className="text-sm text-gray-400 py-10 text-center">Loading…</p> : stats.daysLogged === 0 ? (
          <p className="text-sm text-gray-400 py-10 text-center">Nothing logged in the last {days} days.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={12} />
              <YAxis tick={{ fontSize: 11 }} width={48} />
              <Tooltip cursor={CHART_CURSOR} content={<ChartTooltip format={(v, k) => [fmt(v), k === 'target' ? 'Goal' : label]} />} />
              <Bar dataKey="value" name={label} fill={COLORS[metric]} radius={[4, 4, 0, 0]} />
              <Line type="stepAfter" dataKey="target" name="target" stroke="#10b981" strokeDasharray="5 4" dot={false} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
