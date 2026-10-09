/**
 * Log Cardio: start a timed session (switch intensity as you go, report at the
 * end) or log one you've already done, for the built-in activities and your
 * own. With the dynamic calorie goal active, a day's cardio adds to that day's goal.
 */
import { useEffect, useState } from 'react';
import { format, startOfWeek } from 'date-fns';
import { HeartPulse, Trash2, Flame, Check, Play, Pause, Square, Plus, X, ChevronDown, ChevronUp } from 'lucide-react';
import { cardioAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import {
  CARDIO_ACTIVITIES, INTENSITIES, activityOf, cardioCalories, distanceUnit, toKm, fromKm, paceText, cardioSteps, STEP_OVERLAP_NOTE,
  startLive, liveSeconds, pauseLive, resumeLive, setLiveIntensity, finishLive, formatClock, previousSession, cardioReport, formatPace,
} from '../utils/cardio';

const STORE = 'fittrack.cardioSession'; // { live } or { finished }, so a reload keeps the session
const load = () => { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; } };
const keep = (v) => { try { if (v) localStorage.setItem(STORE, JSON.stringify(v)); else localStorage.removeItem(STORE); } catch { /* not kept */ } };
const localNow = () => format(new Date(), "yyyy-MM-dd'T'HH:mm");
const pill = (on) => `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${on
  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`;
const nameOf = (s) => s.customName || activityOf(s.activity).label;
const signed = (n, f) => (n == null || Math.round(n) === 0 ? '±0' : `${n > 0 ? '+' : '−'}${f(Math.abs(n))}`);

/** Built-in activities and your own; add or remove your own. value: { activity, customActivity }. */
function ActivityPicker({ value, onChange, mine, setMine }) {
  const [adding, setAdding] = useState(false);
  const [managing, setManaging] = useState(false);
  const [form, setForm] = useState({ name: '', base: 'running' });
  const [error, setError] = useState('');
  const add = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      const { data } = await cardioAPI.addActivity({ name: form.name.trim(), base: form.base });
      setMine((m) => [...m, data].sort((a, b) => a.name.localeCompare(b.name)));
      onChange({ activity: data.base, customActivity: data._id, name: data.name });
      setForm({ name: '', base: 'running' });
      setAdding(false);
    } catch (err) { setError(err.response?.data?.errors?.[0]?.message || err.response?.data?.message || 'Could not add that'); }
  };
  const remove = async (a) => {
    if (!window.confirm(`Remove "${a.name}"? Sessions you logged keep it.`)) return;
    try {
      await cardioAPI.deleteActivity(a._id);
      setMine((m) => m.filter((x) => x._id !== a._id));
      if (String(value.customActivity) === String(a._id)) onChange({ activity: a.base, customActivity: null, name: activityOf(a.base).label });
    } catch { setError('Could not remove that'); }
  };
  const chip = (on) => `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${on
    ? 'bg-rose-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {CARDIO_ACTIVITIES.map((a) => (
          <button key={a.key} type="button" onClick={() => onChange({ activity: a.key, customActivity: null, name: a.label })}
            className={chip(!value.customActivity && value.activity === a.key)}>{a.label}</button>
        ))}
      </div>
      {(mine.length > 0 || adding) && <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 pt-1">Your activities</p>}
      <div className="flex flex-wrap gap-1.5 items-center">
        {mine.map((a) => (
          <span key={a._id} className="inline-flex items-center">
            <button type="button" onClick={() => onChange({ activity: a.base, customActivity: a._id, name: a.name })}
              className={chip(String(value.customActivity) === String(a._id))} title={`Counts like ${activityOf(a.base).label.toLowerCase()}`}>{a.name}</button>
            {managing && <button type="button" onClick={() => remove(a)} className="p-1 text-gray-400 hover:text-red-500" aria-label={`Remove ${a.name}`}><X size={13} /></button>}
          </span>
        ))}
        {!adding && <button type="button" onClick={() => setAdding(true)} className="text-sm font-medium text-rose-600 hover:underline inline-flex items-center gap-1"><Plus size={14} /> Add your own</button>}
        {mine.length > 0 && !adding && <button type="button" onClick={() => setManaging(!managing)} className="text-xs text-gray-400 hover:underline">{managing ? 'Done' : 'Manage'}</button>}
      </div>
      {adding && (
        <div className="flex flex-wrap gap-2 items-end rounded-xl border border-gray-200 dark:border-gray-700 p-3">
          <label className="flex-1 min-w-[10rem] text-xs text-gray-500">Name
            <input className="input mt-0.5 text-sm" maxLength={40} placeholder="e.g. Incline treadmill" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
          </label>
          <label className="text-xs text-gray-500">Most like (for calories)
            <select className="input mt-0.5 text-sm" value={form.base} onChange={(e) => setForm({ ...form, base: e.target.value })}>
              {CARDIO_ACTIVITIES.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
            </select>
          </label>
          <button type="button" onClick={add} disabled={!form.name.trim()} className="btn-primary text-sm py-2">Add</button>
          <button type="button" onClick={() => { setAdding(false); setError(''); }} className="btn-secondary text-sm py-2"><X size={14} /></button>
        </div>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

/** The running session: clock, calories so far, intensity switch, pause, finish. */
function LiveCardio({ live, setLive, kg, onFinish, onCancel }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  const seconds = liveSeconds(live, now);
  const calories = cardioCalories({ activity: live.activity, segments: finishLive(live, now) }, kg);
  return (
    <div className="card text-center space-y-5 py-8">
      <div>
        <p className="text-sm font-semibold text-rose-500 uppercase tracking-wide">{live.name}</p>
        <p className={`text-6xl font-bold tabular-nums mt-2 ${live.running ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'}`}>{formatClock(seconds)}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center justify-center gap-1.5"><Flame size={14} className="text-orange-500" /> ~{calories.toLocaleString()} kcal{!live.running && ' · paused'}</p>
      </div>
      <div>
        <div className="inline-flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
          {INTENSITIES.map(([k, l]) => <button key={k} type="button" onClick={() => setLive(setLiveIntensity(live, k))} className={pill(live.intensity === k)}>{l}</button>)}
        </div>
        <p className="text-xs text-gray-400 mt-1">{INTENSITIES.find(([k]) => k === live.intensity)[2]}. Switch as you go.</p>
      </div>
      <div className="flex justify-center gap-3">
        {live.running
          ? <button onClick={() => setLive(pauseLive(live))} className="btn-secondary px-5"><Pause size={16} /> Pause</button>
          : <button onClick={() => setLive(resumeLive(live))} className="btn-secondary px-5"><Play size={16} /> Resume</button>}
        <button onClick={() => onFinish(finishLive(live))} disabled={seconds < 1} className="btn-primary px-5 !bg-rose-500 hover:!bg-rose-600"><Square size={15} /> Finish</button>
      </div>
      <button onClick={onCancel} className="text-xs text-gray-400 hover:text-red-500">Cancel session</button>
    </div>
  );
}

/** The end-of-session report; add the distance, then save or discard. */
function CardioReport({ finished, previous, kg, unit, onSave, onDiscard, saving, error }) {
  const [distance, setDistance] = useState('');
  const [notes, setNotes] = useState('');
  const activity = activityOf(finished.activity);
  const report = cardioReport({ activity: finished.activity, segments: finished.segments, distanceKm: toKm(distance, unit) }, previous, kg, unit);
  const c = report.change;
  const Change = ({ value, good, text }) => (value == null ? null
    : <span className={`text-xs font-semibold ${Math.round(value) === 0 ? 'text-gray-400' : (good ? value > 0 : value < 0) ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>{text}</span>);
  const tiles = [
    ['Time', formatClock(report.seconds), c && <Change value={c.seconds} good text={signed(c.seconds, formatClock)} />],
    ...(activity.hasDistance ? [
      [`Distance (${unit})`, report.distance ?? '–', c?.distance != null && <Change value={c.distance} good text={`${signed(c.distance, (v) => v)} ${unit}`} />],
      [`Pace (/${unit})`, report.pace ? formatPace(report.pace) : '–', c?.pace != null && <Change value={-c.pace} good text={`${Math.abs(Math.round(c.pace))} s ${c.pace < 0 ? 'faster' : 'slower'}`} />],
    ] : []),
    ['Calories', `~${report.calories.toLocaleString()}`, c && <Change value={c.calories} good text={signed(c.calories, (v) => `${Math.round(v)} kcal`)} />],
  ];
  const COLORS = { easy: 'bg-emerald-400', moderate: 'bg-amber-400', hard: 'bg-rose-500' };
  return (
    <div className="card space-y-4">
      <div className="text-center">
        <HeartPulse size={30} className="mx-auto text-rose-500" />
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">{finished.name} done!</h2>
        <p className="text-xs text-gray-400">{previous ? `Compared with your last ${finished.name.toLowerCase()}, ${format(new Date(previous.date), 'MMM d')}` : 'Your first one to compare against next time.'}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {tiles.map(([label, value, change]) => (
          <div key={label} className="rounded-xl bg-gray-50 dark:bg-gray-800 px-3 py-2">
            <p className="text-[11px] text-gray-400">{label}</p>
            <p className="flex items-baseline gap-2"><span className="text-xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">{value}</span>{change}</p>
          </div>
        ))}
      </div>
      {report.byIntensity.length > 0 && (
        <div>
          <div className="flex h-2.5 rounded-full overflow-hidden">
            {report.byIntensity.map((x) => <div key={x.intensity} className={COLORS[x.intensity]} style={{ width: `${x.pct}%` }} />)}
          </div>
          <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-gray-500 dark:text-gray-400">
            {report.byIntensity.map((x) => <span key={x.intensity} className="inline-flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${COLORS[x.intensity]}`} />{x.label} {formatClock(x.seconds)} ({x.pct}%)</span>)}
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {activity.hasDistance && (
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Distance ({unit})
            <input className="input mt-1" type="number" min={0} step={0.01} placeholder="optional" value={distance} onChange={(e) => setDistance(e.target.value)} />
          </label>
        )}
        <label className={`text-sm font-medium text-gray-700 dark:text-gray-300 ${activity.hasDistance ? '' : 'col-span-2'}`}>Notes
          <input className="input mt-1" maxLength={300} placeholder="Optional" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>
      {cardioSteps({ activity: finished.activity, segments: finished.segments }) > 0 && (
        <p className="text-xs text-gray-400">{STEP_OVERLAP_NOTE(cardioSteps({ activity: finished.activity, segments: finished.segments }))}</p>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button onClick={onDiscard} className="btn-secondary">Discard</button>
        <button onClick={() => onSave({ distanceKm: toKm(distance, unit), notes })} disabled={saving} className="btn-primary flex-1 justify-center !bg-rose-500 hover:!bg-rose-600">{saving ? 'Saving…' : 'Save session'}</button>
      </div>
    </div>
  );
}

export default function LogCardio() {
  const { user } = useAuth();
  const unit = distanceUnit(user);
  const kg = user?.weight;
  const [stored, setStored] = useState(load);
  const [list, setList] = useState(null);
  const [mine, setMine] = useState([]);
  const [pick, setPick] = useState({ activity: 'running', customActivity: null, name: 'Running' });
  const [startIntensity, setStartIntensity] = useState('moderate');
  const [pastOpen, setPastOpen] = useState(false);
  const [past, setPast] = useState({ intensity: 'moderate', minutes: '', distance: '', when: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  useEffect(() => {
    cardioAPI.getAll().then(({ data }) => setList(data)).catch(() => setList([]));
    cardioAPI.activities().then(({ data }) => setMine(data)).catch(() => {});
  }, []);
  const save = (v) => { keep(v); setStored(v || {}); };
  const setLive = (live) => save({ live });

  const create = async (body, name) => {
    setSaving(true);
    setError('');
    try {
      const { data } = await cardioAPI.create(body);
      setList((l) => [data, ...(l || [])].sort((a, b) => new Date(b.date) - new Date(a.date)));
      setSaved(`${name} saved. About ${data.calories.toLocaleString()} kcal burned.`);
      return true;
    } catch (err) {
      setError(err.response?.data?.errors?.[0]?.message || err.response?.data?.message || 'Could not save that');
      return false;
    } finally {
      setSaving(false);
    }
  };
  const which = (p) => (p.customActivity ? { customActivity: p.customActivity } : { activity: p.activity });

  if (stored.finished) {
    const f = stored.finished;
    return (
      <div className="max-w-xl mx-auto space-y-5">
        <CardioReport finished={f} previous={previousSession(list || [], f)} kg={kg} unit={unit} saving={saving} error={error}
          onDiscard={() => { if (window.confirm('Discard this session?')) save(null); }}
          onSave={async ({ distanceKm, notes }) => {
            const ok = await create({ ...which(f), segments: f.segments, date: new Date(f.startedAt).toISOString(), notes: notes.trim(),
              ...(distanceKm != null && activityOf(f.activity).hasDistance && { distanceKm: Math.round(distanceKm * 1000) / 1000 }) }, f.name);
            if (ok) save(null);
          }} />
      </div>
    );
  }
  if (stored.live) {
    return (
      <div className="max-w-xl mx-auto space-y-5">
        <LiveCardio live={stored.live} setLive={setLive} kg={kg}
          onCancel={() => { if (window.confirm('Cancel this session? Nothing is saved.')) save(null); }}
          onFinish={(segments) => save({ finished: { ...stored.live, segments } })} />
      </div>
    );
  }

  const minutes = Number(past.minutes) || 0;
  const estimate = minutes > 0 ? cardioCalories({ activity: pick.activity, intensity: past.intensity, minutes }, kg) : 0;
  const savePast = async (e) => {
    e.preventDefault();
    if (!(minutes >= 1 && minutes <= 600)) { setError('Enter how many minutes (1 to 600).'); return; }
    if (past.when && new Date(past.when) > new Date()) { setError("Cardio can't be in the future."); return; }
    const ok = await create({
      ...which(pick), intensity: past.intensity, minutes,
      ...(activityOf(pick.activity).hasDistance && past.distance !== '' && { distanceKm: Math.round(toKm(past.distance, unit) * 1000) / 1000 }),
      ...(past.when && { date: new Date(past.when).toISOString() }), notes: past.notes.trim(),
    }, pick.name);
    if (ok) setPast((p) => ({ ...p, minutes: '', distance: '', when: '', notes: '' }));
  };
  const remove = async (id) => {
    if (!window.confirm('Delete this cardio session?')) return;
    try { await cardioAPI.delete(id); setList((l) => l.filter((s) => s._id !== id)); } catch { setError('Could not delete that'); }
  };
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const thisWeek = (list || []).filter((s) => new Date(s.date) >= weekStart);

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2"><HeartPulse size={24} className="text-rose-500" /> Cardio</h1>

      <div className="card space-y-4">
        <ActivityPicker value={pick} onChange={(v) => { setPick(v); setError(''); setSaved(''); }} mine={mine} setMine={setMine} />
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <div className="inline-flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
            {INTENSITIES.map(([k, l]) => <button key={k} type="button" onClick={() => setStartIntensity(k)} className={pill(startIntensity === k)}>{l}</button>)}
          </div>
          <button onClick={() => { setSaved(''); setLive(startLive({ ...pick, intensity: startIntensity })); }} className="btn-primary !bg-rose-500 hover:!bg-rose-600 ml-auto">
            <Play size={16} /> Start {pick.name.toLowerCase()}
          </button>
        </div>
        {saved && <p className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5"><Check size={15} /> {saved}</p>}

        <button onClick={() => setPastOpen(!pastOpen)} className="w-full flex items-center justify-between text-sm font-medium text-gray-600 dark:text-gray-300 pt-3 border-t border-gray-100 dark:border-gray-800">
          Log one you've already done {pastOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {pastOpen && (
          <form onSubmit={savePast} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Minutes
                <input className="input mt-1" type="number" min={1} max={600} placeholder="e.g. 30" value={past.minutes} onChange={(e) => setPast({ ...past, minutes: e.target.value })} />
              </label>
              {activityOf(pick.activity).hasDistance ? (
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Distance ({unit}, optional)
                  <input className="input mt-1" type="number" min={0} step={0.01} value={past.distance} onChange={(e) => setPast({ ...past, distance: e.target.value })} />
                </label>
              ) : <div />}
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">When
                <input className="input mt-1" type="datetime-local" max={localNow()} value={past.when} onChange={(e) => setPast({ ...past, when: e.target.value })} />
              </label>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Notes
                <input className="input mt-1" maxLength={300} placeholder="Optional" value={past.notes} onChange={(e) => setPast({ ...past, notes: e.target.value })} />
              </label>
            </div>
            <div className="inline-flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
              {INTENSITIES.map(([k, l]) => <button key={k} type="button" onClick={() => setPast({ ...past, intensity: k })} className={pill(past.intensity === k)}>{l}</button>)}
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-1.5"><Flame size={15} className="text-orange-500" />
                {estimate ? <>About <span className="font-semibold">{estimate.toLocaleString()} kcal</span></> : 'Enter the minutes to see the calories'}</p>
              <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
            </div>
            {estimate > 0 && cardioSteps({ activity: pick.activity, intensity: past.intensity, minutes }) > 0 && (
              <p className="text-xs text-gray-400">{STEP_OVERLAP_NOTE(cardioSteps({ activity: pick.activity, intensity: past.intensity, minutes }))}</p>
            )}
          </form>
        )}
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Recent cardio</h2>
          {thisWeek.length > 0 && <p className="text-xs text-gray-500 dark:text-gray-400">This week: {thisWeek.reduce((n, s) => n + s.minutes, 0)} min · ~{thisWeek.reduce((n, s) => n + s.calories, 0).toLocaleString()} kcal</p>}
        </div>
        {list === null ? <p className="text-sm text-gray-400 py-4">Loading…</p> : list.length === 0 ? <p className="text-sm text-gray-400 py-4">No cardio in the last 60 days.</p> : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {list.map((s) => {
              const pace = paceText(s.seconds ? s.seconds / 60 : s.minutes, s.distanceKm, unit);
              return (
                <li key={s._id} className="py-2.5 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{nameOf(s)} <span className="font-normal text-gray-400">· {s.segments?.length > 1 ? 'mixed' : s.intensity}{s.segments?.length ? ' · timed' : ''}</span></p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {format(new Date(s.date), 'EEE, MMM d · HH:mm')} · {s.seconds ? formatClock(s.seconds) : `${s.minutes} min`}
                      {s.distanceKm ? ` · ${fromKm(s.distanceKm, unit)} ${unit}` : ''}{pace ? ` · ${pace}` : ''} · ~{s.calories.toLocaleString()} kcal
                    </p>
                    {s.notes && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{s.notes}</p>}
                  </div>
                  <button onClick={() => remove(s._id)} className="p-1.5 text-gray-300 hover:text-red-500" aria-label="Delete"><Trash2 size={15} /></button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2">Calories are estimated from the activity, intensity, time and your weight.</p>
      </div>
    </div>
  );
}
