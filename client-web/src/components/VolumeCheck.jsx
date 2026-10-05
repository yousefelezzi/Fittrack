import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Settings2 } from 'lucide-react';
import { workoutAPI } from '../api';
import { wnsFromSessions, WNS_DEFAULTS } from '../utils/wnsCalculations';

// Muscles trained in this lookback are checked; ones you never train aren't flagged.
const LOOKBACK_DAYS = 56;
const SETTINGS_KEY = 'fittrack.wnsSettings';

const loadSettings = () => {
  try { return { ...WNS_DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; }
  catch { return { ...WNS_DEFAULTS }; }
};
const saveSettings = (s) => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ } };

// "triceps › Long head" → "Triceps · long head"
const label = (key) => {
  const [muscle, sub] = key.split(' › ');
  const m = muscle.charAt(0).toUpperCase() + muscle.slice(1);
  return sub ? `${m} · ${sub.charAt(0).toLowerCase()}${sub.slice(1)}` : m;
};

/**
 * Runs the WNS model on each muscle (and sub-region) you train, using your
 * logged workouts, and warns about any that are losing ground: not enough sets
 * or not trained often enough to beat atrophy.
 * `compact` shows a short summary (dashboard); otherwise the full list with settings.
 */
export default function VolumeCheck({ compact = false }) {
  const [sessions, setSessions] = useState(null);
  const [settings, setSettings] = useState(loadSettings);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    workoutAPI.getMuscleSessions({ days: LOOKBACK_DAYS })
      .then(({ data }) => setSessions(data))
      .catch(() => setSessions([]));
  }, []);

  const update = (key, value) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    saveSettings(next);
  };

  const results = useMemo(() => {
    if (!sessions) return null;
    const muscles = new Set(sessions.flatMap((s) => Object.keys(s.sets)));
    return [...muscles]
      .map((key) => ({
        key,
        ...wnsFromSessions(sessions.map((s) => ({ date: s.date, sets: s.sets[key] || 0 })), {
          dataset: settings.dataset,
          maintenance: Number(settings.maintenance) || WNS_DEFAULTS.maintenance,
          stimHours: Number(settings.stimHours) || WNS_DEFAULTS.stimHours,
          windowDays: WNS_DEFAULTS.windowDays,
        }),
      }))
      .sort((a, b) => a.wns - b.wns);
  }, [sessions, settings]);

  if (!results) return null;
  const negatives = results.filter((r) => r.wns < 0);
  const weeks = WNS_DEFAULTS.windowDays / 7;

  if (compact) {
    if (results.length === 0 || negatives.length === 0) return null;
    return (
      <Link to="/progress" className="card flex items-start gap-3 !py-3 border-l-4 !border-l-amber-400 hover:shadow-md transition-shadow">
        <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {negatives.length} muscle{negatives.length !== 1 ? 's' : ''} not getting enough volume
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {negatives.slice(0, 4).map((r) => label(r.key)).join(', ')}{negatives.length > 4 ? '…' : ''}
          </p>
        </div>
      </Link>
    );
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Volume check</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Weekly net stimulus from your last {weeks} weeks. Negative means sets or frequency are too low to beat atrophy.
          </p>
        </div>
        <button onClick={() => setShowSettings((v) => !v)} title="Model settings"
          className={`p-1.5 rounded-lg shrink-0 ${showSettings ? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}>
          <Settings2 size={16} />
        </button>
      </div>

      {showSettings && (
        <div className="grid grid-cols-3 gap-3 bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-xs">
          <label className="space-y-1">
            <span className="text-gray-500 dark:text-gray-400">Dataset</span>
            <select className="input py-1 text-xs" value={settings.dataset} onChange={(e) => update('dataset', e.target.value)}>
              <option value="S">Schoenfeld</option>
              <option value="P">Pelland</option>
              <option value="A">Average</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-gray-500 dark:text-gray-400">Maintenance sets</span>
            <input className="input py-1 text-xs" type="number" min={1} max={5} step={0.5} value={settings.maintenance}
              onChange={(e) => update('maintenance', Math.min(5, Math.max(1, Number(e.target.value) || 1)))} />
          </label>
          <label className="space-y-1">
            <span className="text-gray-500 dark:text-gray-400">Stimulus (hours)</span>
            <input className="input py-1 text-xs" type="number" min={12} max={72} step={6} value={settings.stimHours}
              onChange={(e) => update('stimHours', Math.min(72, Math.max(12, Number(e.target.value) || 12)))} />
          </label>
          <button onClick={() => { setSettings({ ...WNS_DEFAULTS }); saveSettings(WNS_DEFAULTS); }}
            className="col-span-3 text-left text-brand-600 font-medium">
            Reset to defaults (Schoenfeld · 3 sets · 48 h)
          </button>
        </div>
      )}

      {results.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">Log a few workouts to see how each muscle is doing.</p>
      ) : negatives.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 size={16} /> Every muscle you train is getting enough volume.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {negatives.map((r) => (
            <li key={r.key} className="flex items-center gap-3 py-2">
              <AlertTriangle size={15} className="text-amber-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 dark:text-gray-200">{label(r.key)}</p>
                <p className="text-[11px] text-gray-400 dark:text-gray-500">
                  {r.sessions === 0
                    ? `Not trained in the last ${weeks} weeks`
                    : `${r.sets} set${r.sets !== 1 ? 's' : ''} over ${r.sessions} workout${r.sessions !== 1 ? 's' : ''} in ${weeks} weeks`}
                </p>
              </div>
              <span className="text-sm font-semibold tabular-nums text-red-600 dark:text-red-400">{r.wns.toFixed(2)}</span>
            </li>
          ))}
        </ul>
      )}
      {results.length > 0 && negatives.length > 0 && (
        <p className="text-[11px] text-gray-400 dark:text-gray-500">
          {results.length - negatives.length} other muscle{results.length - negatives.length !== 1 ? 's are' : ' is'} fine.
          More sets per workout or training a muscle more often both help. <Link to="/calculators/wns" className="text-brand-600">Try it in the WNS calculator</Link>.
        </p>
      )}
    </div>
  );
}
