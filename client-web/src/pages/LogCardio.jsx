/**
 * Log Cardio: runs, rides, swims and other cardio, with an estimated calorie
 * burn. With the dynamic calorie goal on, a day's cardio adds to that day's goal.
 */
import { useEffect, useState } from 'react';
import { format, startOfWeek } from 'date-fns';
import { HeartPulse, Trash2, Flame, Check } from 'lucide-react';
import { cardioAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import {
  CARDIO_ACTIVITIES, INTENSITIES, activityOf, cardioCalories, distanceUnit, toKm, fromKm, paceText,
} from '../utils/cardio';

const localNow = () => format(new Date(), "yyyy-MM-dd'T'HH:mm");
const EMPTY = { activity: 'running', intensity: 'moderate', minutes: '', distance: '', when: '', notes: '' };

export default function LogCardio() {
  const { user } = useAuth();
  const unit = distanceUnit(user);
  const [form, setForm] = useState(EMPTY);
  const [list, setList] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setError(''); setSaved(''); };

  useEffect(() => { cardioAPI.getAll().then(({ data }) => setList(data)).catch(() => setList([])); }, []);

  const activity = activityOf(form.activity);
  const minutes = Number(form.minutes) || 0;
  const estimate = minutes > 0 ? cardioCalories({ ...form, minutes }, user?.weight) : 0;

  const save = async (e) => {
    e.preventDefault();
    if (!(minutes >= 1 && minutes <= 600)) { setError('Enter how many minutes (1 to 600).'); return; }
    if (form.when && new Date(form.when) > new Date()) { setError("Cardio can't be in the future."); return; }
    setSaving(true);
    try {
      const { data } = await cardioAPI.create({
        activity: form.activity, intensity: form.intensity, minutes,
        ...(activity.hasDistance && form.distance !== '' && { distanceKm: Math.round(toKm(form.distance, unit) * 1000) / 1000 }),
        ...(form.when && { date: new Date(form.when).toISOString() }),
        notes: form.notes.trim(),
      });
      setList((l) => [data, ...(l || [])].sort((a, b) => new Date(b.date) - new Date(a.date)));
      setForm((f) => ({ ...EMPTY, activity: f.activity, intensity: f.intensity }));
      setSaved(`${activity.label} saved. About ${data.calories.toLocaleString()} kcal burned.`);
    } catch (err) {
      setError(err.response?.data?.errors?.[0]?.message || err.response?.data?.message || 'Could not save that');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this cardio session?')) return;
    try { await cardioAPI.delete(id); setList((l) => l.filter((s) => s._id !== id)); } catch { setError('Could not delete that'); }
  };

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const thisWeek = (list || []).filter((s) => new Date(s.date) >= weekStart);
  const pill = (on) => `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${on
    ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2"><HeartPulse size={24} className="text-rose-500" /> Log Cardio</h1>

      <form onSubmit={save} className="card space-y-4">
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Activity</p>
          <div className="flex flex-wrap gap-1.5">
            {CARDIO_ACTIVITIES.map((a) => (
              <button key={a.key} type="button" onClick={() => set('activity', a.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${form.activity === a.key
                  ? 'bg-rose-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                {a.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Minutes</label>
            <input className="input" type="number" min={1} max={600} placeholder="e.g. 30" value={form.minutes} onChange={(e) => set('minutes', e.target.value)} />
          </div>
          {activity.hasDistance ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Distance ({unit}, optional)</label>
              <input className="input" type="number" min={0} step={0.01} placeholder={unit === 'mi' ? 'e.g. 3.1' : 'e.g. 5'} value={form.distance} onChange={(e) => set('distance', e.target.value)} />
            </div>
          ) : <div />}
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Intensity</p>
          <div className="inline-flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
            {INTENSITIES.map(([k, l]) => <button key={k} type="button" onClick={() => set('intensity', k)} className={pill(form.intensity === k)}>{l}</button>)}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{INTENSITIES.find(([k]) => k === form.intensity)[2]}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">When</label>
            <input className="input" type="datetime-local" max={localNow()} value={form.when} onChange={(e) => set('when', e.target.value)} />
            <p className="text-[11px] text-gray-400 mt-0.5">Leave empty for now</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
            <input className="input" maxLength={300} placeholder="Optional" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
            <Flame size={15} className="text-orange-500" />
            {estimate ? <>About <span className="font-semibold">{estimate.toLocaleString()} kcal</span>{!user?.weight && ' (add your weight to your profile for a better estimate)'}</> : 'Enter the minutes to see the calories'}
          </p>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save cardio'}</button>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        {saved && <p className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5"><Check size={15} /> {saved}</p>}
      </form>

      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Recent cardio</h2>
          {thisWeek.length > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400">This week: {thisWeek.reduce((n, s) => n + s.minutes, 0)} min · ~{thisWeek.reduce((n, s) => n + s.calories, 0).toLocaleString()} kcal</p>
          )}
        </div>
        {list === null ? <p className="text-sm text-gray-400 py-4">Loading…</p> : list.length === 0 ? (
          <p className="text-sm text-gray-400 py-4">No cardio in the last 60 days.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {list.map((s) => {
              const pace = paceText(s.minutes, s.distanceKm, unit);
              return (
                <li key={s._id} className="py-2.5 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{activityOf(s.activity).label} <span className="font-normal text-gray-400">· {s.intensity}</span></p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {format(new Date(s.date), 'EEE, MMM d · HH:mm')} · {s.minutes} min
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
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2">Calories are estimated from the activity, intensity, time and your weight. With the dynamic calorie goal on, a day's cardio adds to that day's goal.</p>
      </div>
    </div>
  );
}
