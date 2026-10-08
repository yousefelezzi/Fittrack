import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, subDays, isToday, parseISO } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Cell } from 'recharts';
import { Footprints, Flame, Target, TrendingUp, Check } from 'lucide-react';
import { stepsAPI } from '../api';
import ChartTooltip, { CHART_CURSOR } from '../components/ChartTooltip';

const RANGE_DAYS = 30;
const QUICK_ADD = [1000, 2500, 5000];
const key = (d) => format(d, 'yyyy-MM-dd');

const StatCard = ({ icon: Icon, label, value, sub }) => (
  <div className="card !p-4">
    <p className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400"><Icon size={13} /> {label}</p>
    <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">{value}</p>
    {sub && <p className="text-[11px] text-gray-400 dark:text-gray-500">{sub}</p>}
  </div>
);

/** Daily step tracking: log a day's steps, see the goal, history and the calories they add. */
export default function Steps() {
  const [data, setData]       = useState(null); // { goal, baseline, canAdjustCalories, days }
  const [loading, setLoading] = useState(true);
  const [date, setDate]       = useState(key(new Date()));
  const [input, setInput]     = useState('');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [saved, setSaved]     = useState(false);

  const load = useCallback(async () => {
    try {
      const { data: res } = await stepsAPI.getRange(key(subDays(new Date(), RANGE_DAYS - 1)), key(new Date()));
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Days are stored at UTC midnight of the date sent, so the date part is the day.
  const byDate = new Map((data?.days || []).map((d) => [d.date.slice(0, 10), d]));
  const selected = byDate.get(date);
  // Show what's already logged for the chosen day so it can be corrected.
  useEffect(() => { setInput(selected ? String(selected.steps) : ''); setSaved(false); }, [date, selected?.steps]);

  const save = async (steps) => {
    if (!(steps >= 0) || steps > 200000) { setError('Enter a number of steps from 0 to 200,000'); return; }
    setSaving(true);
    setError('');
    try {
      await stepsAPI.set(date, Math.round(steps));
      await load();
      setSaved(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save your steps');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!data) return <p className="text-sm text-red-500">Could not load your steps.</p>;

  const { goal, baseline, canAdjustCalories } = data;
  const today = byDate.get(key(new Date()));
  const todaySteps = today?.steps || 0;
  const pct = Math.min(100, Math.round((todaySteps / goal) * 100));

  // Last 30 days, oldest first, with empty days as 0.
  const chart = Array.from({ length: RANGE_DAYS }, (_, i) => {
    const d = subDays(new Date(), RANGE_DAYS - 1 - i);
    return { date: key(d), label: format(d, 'MMM d'), steps: byDate.get(key(d))?.steps || 0 };
  });
  const avg = (n) => {
    const logged = chart.slice(-n).filter((d) => d.steps > 0);
    return logged.length ? Math.round(logged.reduce((s, d) => s + d.steps, 0) / logged.length) : 0;
  };
  const daysAtGoal = chart.filter((d) => d.steps >= goal).length;
  // Days in a row at the goal, counting back from today (today not reached yet doesn't break it).
  let streak = 0;
  for (let i = chart.length - 1; i >= 0; i--) {
    if (chart[i].steps >= goal) streak++;
    else if (i !== chart.length - 1) break;
  }

  const gridColor = 'var(--chart-grid, #e2e8f0)';
  const tickStyle = { fontSize: 11, fill: 'var(--chart-tick, #6b7280)' };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Steps</h1>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Today */}
        <div className="card space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Today</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Goal {goal.toLocaleString()} · <Link to="/profile" className="text-brand-600 hover:underline">change</Link>
            </p>
          </div>
          <div>
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
              {todaySteps.toLocaleString()} <span className="text-sm font-normal text-gray-400">steps</span>
            </p>
            <div className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mt-2">
              <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-emerald-500' : 'bg-brand-500'}`} style={{ width: `${pct}%` }} />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {pct >= 100 ? 'Goal reached' : `${(goal - todaySteps).toLocaleString()} to go (${pct}%)`}
            </p>
          </div>
          <p className="flex items-start gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <Flame size={13} className="mt-0.5 shrink-0 text-orange-500" />
            {!canAdjustCalories
              ? <>Add your weight to your <Link to="/profile" className="text-brand-600">profile</Link> so extra steps can raise your calorie target.</>
              : <>
                  {today?.burned > 0 && <>About {today.burned.toLocaleString()} kcal burned walking today. </>}
                  {today?.calories > 0
                    ? <>+{today.calories} kcal of that is added to today's <Link to="/nutrition" className="text-brand-600">calorie target</Link>; the first {baseline.toLocaleString()} are everyday movement that's already in your maintenance.</>
                    : <>Steps beyond {baseline.toLocaleString()} (everyday movement, already in your maintenance) raise your calorie target for the day.</>}
                </>}
          </p>
        </div>

        {/* Log */}
        <div className="card space-y-3">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Log steps</h2>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Day</label>
              <input className="input" type="date" value={date} max={key(new Date())} onChange={(e) => e.target.value && setDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Steps</label>
              <input className="input" type="number" min={0} max={200000} step={100} inputMode="numeric" placeholder="8000"
                value={input} onChange={(e) => { setInput(e.target.value); setSaved(false); }}
                onKeyDown={(e) => e.key === 'Enter' && save(Number(input))} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-400 dark:text-gray-500">Add</span>
            {QUICK_ADD.map((n) => (
              <button key={n} type="button" disabled={saving} onClick={() => save((selected?.steps || 0) + n)}
                className="px-2.5 py-1 rounded-full text-xs font-medium border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-brand-400">
                +{n.toLocaleString()}
              </button>
            ))}
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex items-center gap-3">
            <button onClick={() => save(Number(input))} disabled={saving || input === ''} className="btn-primary">
              {saving ? 'Saving…' : selected ? 'Update' : 'Save'}
            </button>
            {saved && <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400"><Check size={13} /> Saved</span>}
          </div>
          <p className="text-[11px] text-gray-400 dark:text-gray-500">
            {isToday(parseISO(date))
              ? 'Copy the count from your phone or watch. You can update it as the day goes on.'
              : `Editing ${format(parseISO(date), 'EEEE, MMM d')}. Save 0 to remove it.`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Footprints} label="7-day average" value={avg(7).toLocaleString()} sub="logged days" />
        <StatCard icon={TrendingUp} label="30-day average" value={avg(30).toLocaleString()} sub="logged days" />
        <StatCard icon={Target} label="Days at goal" value={daysAtGoal} sub={`last ${RANGE_DAYS} days`} />
        <StatCard icon={Flame} label="Goal streak" value={`${streak}d`} />
      </div>

      <div className="card">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Last {RANGE_DAYS} days</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chart} onClick={(e) => e?.activePayload?.[0] && setDate(e.activePayload[0].payload.date)}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis dataKey="label" tick={tickStyle} interval={4} />
            <YAxis tick={tickStyle} width={44} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
            <Tooltip cursor={CHART_CURSOR} content={<ChartTooltip format={(v) => [v.toLocaleString(), 'Steps']} />} />
            <ReferenceLine y={goal} stroke="#10b981" strokeDasharray="4 4" />
            <Bar dataKey="steps" radius={[4, 4, 0, 0]} className="cursor-pointer">
              {chart.map((d) => <Cell key={d.date} fill={d.steps >= goal ? '#10b981' : '#0ea5e9'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">Dashed line is your goal. Click a day to edit it.</p>
      </div>
    </div>
  );
}
