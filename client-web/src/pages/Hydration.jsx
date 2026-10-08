import { useCallback, useEffect, useState } from 'react';
import { format, subDays } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { GlassWater, Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import { nutritionAPI, userAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import DayNav from '../components/DayNav';
import { WATER_PRESETS, formatMl, dailySeries } from '../utils/nutritionProgress';
import ChartTooltip, { CHART_CURSOR } from '../components/ChartTooltip';

const key = (d) => format(d, 'yyyy-MM-dd');

/** Water: log drinks for a day against a daily goal, and see the last 7 days. */
export default function Hydration() {
  const { updateUser } = useAuth();
  const [date, setDate] = useState(key(new Date()));
  const [log, setLog] = useState(null);
  const [summary, setSummary] = useState(null); // last 7 days + goal
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState('');

  const load = useCallback(async () => {
    try {
      const [l, s] = await Promise.all([
        nutritionAPI.getByDate(date),
        nutritionAPI.summary(key(subDays(new Date(), 6)), key(new Date())),
      ]);
      setLog(l.data);
      setSummary(s.data);
    } catch {
      setError('Could not load your water log');
    }
  }, [date]);
  useEffect(() => { load(); }, [load]);

  const drinks = log?.water || [];
  const total = drinks.reduce((n, w) => n + w.amount, 0);
  const goal = summary?.waterGoal || 2500;
  const pct = Math.min(100, Math.round((total / goal) * 100));

  const add = async (amount) => {
    const ml = Math.round(Number(amount));
    if (!(ml >= 1 && ml <= 5000)) { setError('Enter an amount between 1 and 5000 ml.'); return; }
    setBusy(true); setError('');
    try { setLog((await nutritionAPI.addWater(date, ml)).data); setCustom(''); load(); }
    catch (err) { setError(err.response?.data?.message || 'Could not log that'); }
    finally { setBusy(false); }
  };
  const remove = async (id) => {
    try { setLog((await nutritionAPI.deleteWater(id)).data); load(); } catch { setError('Could not remove that drink'); }
  };
  // The kind of water sets the minerals it adds to the day's micronutrients.
  const setWaterType = async (waterType) => {
    try { updateUser((await userAPI.updateMe({ waterType })).data); load(); } catch { setError('Could not save that'); }
  };
  const waterType = summary?.waterType || 'tap';
  const types = summary?.waterTypes || {};
  const minerals = Object.entries(log?.waterMicros || {}).filter(([, v]) => v > 0);
  const perLitre = (t) => Object.entries(types[t]?.perLitre || {}).filter(([, v]) => v > 0).map(([k, v]) => `${k} ${v} mg`).join(' · ');

  const saveGoal = async (value) => {
    try {
      const { data } = await userAPI.updateMe({ waterGoal: value });
      updateUser(data);
      setEditingGoal(false);
      load();
    } catch (err) {
      setError(err.response?.data?.errors?.[0]?.message || err.response?.data?.message || 'Could not save your goal');
    }
  };

  const week = dailySeries(summary, 'water', 7).map((p) => ({ ...p, label: format(new Date(`${p.date}T00:00`), 'EEE'), value: p.value || 0 }));

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Hydration</h1>
        <DayNav date={date} onChange={setDate} />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="card space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Drunk</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{formatMl(total)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 dark:text-gray-400">Daily goal</p>
            {editingGoal ? (
              <div className="flex items-center gap-1 mt-0.5">
                <input type="number" min={500} max={8000} step={50} className="input !w-24 py-1 text-sm" value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)} placeholder="ml" autoFocus />
                <button onClick={() => saveGoal(Number(goalInput))} className="p-1 text-brand-600" aria-label="Save goal"><Check size={16} /></button>
                <button onClick={() => setEditingGoal(false)} className="p-1 text-gray-400" aria-label="Cancel"><X size={16} /></button>
              </div>
            ) : (
              <button onClick={() => { setGoalInput(String(goal)); setEditingGoal(true); }} className="inline-flex items-center gap-1 text-lg font-semibold text-gray-700 dark:text-gray-300 hover:text-brand-600">
                {formatMl(goal)} <Pencil size={13} />
              </button>
            )}
          </div>
        </div>
        <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-emerald-500' : 'bg-sky-500'}`} style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          {pct >= 100 ? 'Goal reached.' : `${formatMl(goal - total)} to go (${pct}%).`}
          {editingGoal && <button onClick={() => saveGoal(null)} className="ml-2 text-brand-600">Use suggested (35 ml per kg)</button>}
        </p>

        <div className="flex flex-wrap gap-2">
          {WATER_PRESETS.map((ml) => (
            <button key={ml} onClick={() => add(ml)} disabled={busy} className="btn-secondary text-sm py-1.5"><GlassWater size={14} /> +{formatMl(ml)}</button>
          ))}
          <div className="flex items-center gap-1">
            <input type="number" min={1} max={5000} className="input !w-24 py-1.5 text-sm" placeholder="ml" value={custom}
              onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && custom && add(custom)} />
            <button onClick={() => add(custom)} disabled={busy || !custom} className="btn-primary py-1.5 px-3 text-sm"><Plus size={14} /> Add</button>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Drinks</h2>
        {drinks.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 py-2">Nothing logged{date === key(new Date()) ? ' yet today' : ''}.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {[...drinks].reverse().map((w) => (
              <li key={w._id} className="flex items-center gap-3 py-2">
                <GlassWater size={16} className="text-sky-500" />
                <span className="flex-1 text-sm text-gray-800 dark:text-gray-200">{formatMl(w.amount)}</span>
                <span className="text-xs text-gray-400">{format(new Date(w.at), 'HH:mm')}</span>
                <button onClick={() => remove(w._id)} className="p-1 text-gray-300 hover:text-red-500" aria-label="Remove"><Trash2 size={14} /></button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card space-y-3">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Your water</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500">Water has minerals too: they're added to the Food Log's micronutrients. Values are typical per litre; tap water varies by area and mineral waters list theirs on the label.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {Object.entries(types).map(([key, t]) => (
            <button key={key} onClick={() => key !== waterType && setWaterType(key)}
              className={`px-3 py-2 rounded-lg border text-left transition-colors ${waterType === key
                ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/30' : 'border-gray-300 dark:border-gray-600 hover:border-brand-400'}`}>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t.label}</p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 capitalize">{perLitre(key)} per L</p>
            </button>
          ))}
        </div>
        {minerals.length > 0 && (
          <p className="text-xs text-sky-600 dark:text-sky-400 capitalize">
            From your water {date === key(new Date()) ? 'today' : 'this day'}: {minerals.map(([k, v]) => `${k} ${v} mg`).join(' · ')}
          </p>
        )}
      </div>

      <div className="card">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Last 7 days</h2>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={week}>
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} width={40} />
            <Tooltip cursor={CHART_CURSOR} content={<ChartTooltip format={(v) => [formatMl(v), 'Water']} />} />
            <ReferenceLine y={goal} stroke="#10b981" strokeDasharray="4 4" />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {week.map((p) => <Cell key={p.date} fill={p.value >= goal ? '#10b981' : '#0ea5e9'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
