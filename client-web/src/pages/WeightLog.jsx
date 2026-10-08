import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ComposedChart, Line, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Scale, Trash2 } from 'lucide-react';
import { weightAPI, userAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import DayNav from '../components/DayNav';
import { kgTo, toKgFrom, formatBodyWeight, weightSeries } from '../utils/bodyUnits';
import ChartTooltip, { CHART_CURSOR } from '../components/ChartTooltip';

const key = (d) => format(d, 'yyyy-MM-dd');
const RANGES = [[30, '30 days'], [90, '90 days'], [180, '6 months']];

/**
 * Body weight: a weigh-in per day. The profile weight (calorie targets, FFMI,
 * water goal) is the 7-day average; a day without a weigh-in uses the day before's.
 */
export default function WeightLog() {
  const { user, updateUser } = useAuth();
  const unit = user?.bodyWeightUnit === 'lb' ? 'lb' : 'kg';
  const [date, setDate] = useState(key(new Date()));
  const [days, setDays] = useState(90);
  const [data, setData] = useState(null); // { entries, before, average }
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => weightAPI.list(days).then(({ data: d }) => setData(d)).catch(() => setError('Could not load your weigh-ins')), [days]);
  useEffect(() => { load(); }, [load]);

  const onDay = data?.entries.find((e) => e.date.slice(0, 10) === date);
  useEffect(() => { setInput(onDay ? String(kgTo(onDay.weight, unit)) : ''); }, [onDay?._id, unit]);

  const setUnit = async (u) => {
    try { updateUser((await userAPI.updateMe({ bodyWeightUnit: u })).data); } catch { setError('Could not save that'); }
  };
  const save = async (e) => {
    e.preventDefault();
    const kg = toKgFrom(input, unit);
    if (!(kg >= 20 && kg <= 400)) { setError(`Enter a weight between ${kgTo(20, unit)} and ${kgTo(400, unit)} ${unit}.`); return; }
    setBusy(true); setError('');
    try {
      const { data: res } = await weightAPI.log(date, kg);
      updateUser({ weight: res.average });
      load();
    } catch (err) {
      setError(err.response?.data?.errors?.[0]?.message || err.response?.data?.message || 'Could not save that');
    } finally { setBusy(false); }
  };
  const remove = async (id) => {
    try { const { data: res } = await weightAPI.delete(id); if (res.average != null) updateUser({ weight: res.average }); load(); }
    catch { setError('Could not remove that'); }
  };

  const series = data ? weightSeries(data.entries, data.before, days).map((p) => ({
    ...p, label: format(new Date(`${p.date}T00:00`), 'MMM d'),
    weight: p.weight == null ? null : kgTo(p.weight, unit), average: p.average == null ? null : kgTo(p.average, unit),
  })) : [];
  const pill = (active) => `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${active
    ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Weight</h1>
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
          {['kg', 'lb'].map((u) => <button key={u} onClick={() => u !== unit && setUnit(u)} className={pill(unit === u)}>{u}</button>)}
        </div>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="card">
          <p className="text-xs text-gray-500 dark:text-gray-400">7-day average</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">{data?.average != null ? formatBodyWeight(data.average, unit) : '–'}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            This is your profile weight, used for your calorie targets, FFMI and water goal. A day you don't weigh in counts as the day before's weight.
          </p>
        </div>
        <form onSubmit={save} className="card space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300"><Scale size={16} /> Weigh-in</p>
            <DayNav date={date} onChange={setDate} />
          </div>
          <div className="flex gap-2">
            <input className="input" type="number" step="0.1" min="0" placeholder={unit === 'lb' ? '176.4' : '80.0'} value={input} onChange={(e) => setInput(e.target.value)} />
            <span className="self-center text-sm text-gray-500">{unit}</span>
            <button type="submit" disabled={busy || !input} className="btn-primary">{onDay ? 'Update' : 'Save'}</button>
          </div>
          <p className="text-[11px] text-gray-400 dark:text-gray-500">Weigh at the same time each day, e.g. in the morning before eating.</p>
        </form>
      </div>

      <div className="card">
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Trend</h2>
          <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
            {RANGES.map(([n, l]) => <button key={n} onClick={() => setDays(n)} className={pill(days === n)}>{l}</button>)}
          </div>
        </div>
        {!data ? <p className="text-sm text-gray-400 py-10 text-center">Loading…</p> : series.every((p) => p.average == null) ? (
          <p className="text-sm text-gray-400 py-10 text-center">Log your first weigh-in to see your trend.</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={16} />
                <YAxis tick={{ fontSize: 11 }} width={44} domain={['dataMin - 1', 'dataMax + 1']} />
                <Tooltip cursor={{ stroke: 'var(--tooltip-border, #e5e7eb)' }} content={<ChartTooltip format={(v, k) => [`${v} ${unit}`, k === 'average' ? '7-day average' : 'Weigh-in']} />} />
                <Scatter dataKey="weight" name="weight" fill="#94a3b8" />
                <Line type="monotone" dataKey="average" name="average" stroke="#0284c7" strokeWidth={2} dot={false} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Dots are weigh-ins; the line is the 7-day average.</p>
          </>
        )}
      </div>

      {data?.entries?.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Weigh-ins</h2>
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {[...data.entries].reverse().map((e) => (
              <li key={e._id} className="flex items-center gap-3 py-2">
                <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">{format(new Date(`${e.date.slice(0, 10)}T00:00`), 'EEE, MMM d')}</span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{formatBodyWeight(e.weight, unit)}</span>
                <button onClick={() => remove(e._id)} className="p-1 text-gray-300 hover:text-red-500" aria-label="Remove weigh-in"><Trash2 size={14} /></button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
