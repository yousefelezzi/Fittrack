import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, Minus, AlertTriangle, Loader2, Repeat } from 'lucide-react';
import ExerciseSearch from './ExerciseSearch';
import StimulusTable from './StimulusTable';
import SimilarExercises from './SimilarExercises';
import { exerciseAPI, planAPI } from '../api';
import {
  SPLIT_OPTIONS, PRIORITY_OPTIONS, MANUAL_DEFAULTS, unitLabel,
  sessionsForSkeleton, sessionTotals, sessionDays, describeSchedule, manualPlanDays, analysisRequest, manualPlanProblem,
} from '../utils/planAnalysis';

const pill = (active) => `px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
  active ? 'bg-brand-600 text-white border-brand-600'
    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-brand-400'}`;
const numInput = 'w-12 text-center border border-gray-200 dark:border-gray-700 rounded-md py-1 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100';
const label = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2';
const hint = 'text-[11px] text-gray-400 dark:text-gray-500 mt-1';

function Stepper({ value, onChange, min, max, label: text }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-gray-50 dark:bg-gray-800 px-3 py-2">
      <span className="text-sm text-gray-600 dark:text-gray-300">{text}</span>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}
          className="w-7 h-7 rounded-lg bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 disabled:opacity-40">−</button>
        <span className="w-6 text-center text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{value}</span>
        <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}
          className="w-7 h-7 rounded-lg bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 disabled:opacity-40">+</button>
      </div>
    </div>
  );
}

/**
 * Build your own plan with the generator's structure: days per week, split and
 * A/B sessions give the sessions and their days (POST /plans/skeleton); you
 * fill each session within the per-session limits. The weekly net stimulus per
 * muscle is re-checked on the server (/plans/analyze) as you edit.
 */
export default function ManualPlanBuilder({ onSaved }) {
  const [days, setDays] = useState(4);
  const [split, setSplit] = useState('ul');
  const [variation, setVariation] = useState('ab');
  const [skeleton, setSkeleton] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [name, setName] = useState('');
  const [nameEdited, setNameEdited] = useState(false);
  const [level, setLevel] = useState('intermediate');
  const [priorities, setPriorities] = useState([]);
  const [maxSets, setMaxSets] = useState(MANUAL_DEFAULTS.maxSets);
  const [maxExercises, setMaxExercises] = useState(MANUAL_DEFAULTS.maxExercises);
  const [library, setLibrary] = useState([]);
  const [units, setUnits] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [swapping, setSwapping] = useState(null); // "session-exercise" showing similar exercises
  const requestId = useRef(0);

  useEffect(() => {
    exerciseAPI.getAll().then(({ data }) => setLibrary(data.filter((e) => (e.category || 'strength') === 'strength'))).catch(() => {});
  }, []);

  // New structure whenever the split changes; exercises carry over to matching sessions.
  useEffect(() => {
    let cancelled = false;
    planAPI.skeleton({ daysPerWeek: days, split, variation })
      .then(({ data }) => {
        if (cancelled) return;
        setSkeleton(data);
        setSessions((prev) => sessionsForSkeleton(data, prev));
        if (!nameEdited) setName(data.rotation?.everyDays ? `${data.name} (my build)` : `${data.name} ${data.daysPerWeek}×/week (my build)`);
      })
      .catch(() => !cancelled && setError('Could not load that split'));
    return () => { cancelled = true; };
  }, [days, split, variation]);

  // Re-check stimulus shortly after the last change; ignore answers to older requests.
  const hasExercises = sessions.some((s) => s.exercises.length);
  useEffect(() => {
    if (!skeleton || !hasExercises) { setUnits(null); return undefined; }
    const id = ++requestId.current;
    setAnalyzing(true);
    const t = setTimeout(() => {
      planAPI.analyze(analysisRequest(skeleton, sessions, { level, priorities }))
        .then(({ data }) => { if (id === requestId.current) setUnits(data.units); })
        .catch(() => {})
        .finally(() => { if (id === requestId.current) setAnalyzing(false); });
    }, 400);
    return () => clearTimeout(t);
  }, [skeleton, sessions, level, priorities, hasExercises]);

  const updateSession = (i, fn) => setSessions((list) => list.map((s, j) => (j === i ? fn(s) : s)));
  const updateExercise = (i, idx, patch) => updateSession(i, (s) => ({ ...s, exercises: s.exercises.map((e, k) => (k === idx ? { ...e, ...patch } : e)) }));
  // Swap for a similar exercise, keeping its sets, reps and RIR.
  // An exercise can only be in a session once.
  const inSession = (s, id, exceptIdx = -1) => s.exercises.some((e, k) => k !== exceptIdx && e.exercise._id === id);
  const replaceExercise = (i, idx, picked) => {
    if (inSession(sessions[i], picked._id, idx)) return;
    updateExercise(i, idx, { exercise: library.find((e) => e._id === picked._id) || picked });
    setSwapping(null);
  };
  const addExercise = (i, exerciseId) => {
    const ex = library.find((e) => e._id === exerciseId);
    if (!ex) return;
    updateSession(i, (s) => {
      if (inSession(s, ex._id)) return s;
      const room = maxSets - sessionTotals(s).sets;
      if (room <= 0 || s.exercises.length >= maxExercises) return s;
      return { ...s, exercises: [...s.exercises, { exercise: ex, sets: Math.min(MANUAL_DEFAULTS.sets, room), reps: MANUAL_DEFAULTS.reps, repsMax: MANUAL_DEFAULTS.repsMax, rir: MANUAL_DEFAULTS.rir }] };
    });
  };

  const required = useMemo(() => (units || []).filter((u) => u.required), [units]);
  const losing = required.filter((u) => u.wns < 0);
  const low = required.filter((u) => u.wns >= 0 && u.wns < u.target);
  const problem = manualPlanProblem(name, sessions, { maxSets, maxExercises });

  const save = async () => {
    if (problem) { setError(problem); return; }
    setSaving(true);
    setError('');
    try {
      const { data } = await planAPI.create({
        name: name.trim(),
        description: `Built by hand: ${skeleton.name}, ${sessions.length} session${sessions.length !== 1 ? 's' : ''}, up to ${maxSets} working sets and ${maxExercises} exercises each.`,
        days: manualPlanDays(skeleton, sessions),
        schedule: skeleton.schedule,
        ...(skeleton.rotation && { rotation: skeleton.rotation }),
      });
      onSaved(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save the plan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Pick a split like the generator does, then choose the exercises, sets, reps and RIR for each session yourself. The
        weekly net stimulus for each muscle updates as you go, using the same model as the generator. Sets taken closer to
        failure (lower RIR) count more.
      </p>

      <div>
        <label className={label}>Days per week</label>
        <div className="flex gap-2">
          {[2, 3, 4, 5, 6].map((n) => (
            <button key={n} type="button" onClick={() => { setDays(n); setSplit(SPLIT_OPTIONS[n][0][0]); }} className={pill(days === n)}>{n}</button>
          ))}
        </div>
      </div>

      <div>
        <label className={label}>Split</label>
        <div className="flex flex-wrap gap-2">
          {SPLIT_OPTIONS[days].map(([k, l]) => <button key={k} type="button" onClick={() => setSplit(k)} className={pill(split === k)}>{l}</button>)}
        </div>
        <p className={hint}>Days are spaced so each muscle gets about 48–72 h between sessions.</p>
      </div>

      {days !== 5 && (
        <div>
          <label className={label}>Repeated sessions</label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setVariation('ab')} className={pill(variation === 'ab')}>A/B days (alternate exercises)</button>
            <button type="button" onClick={() => setVariation('repeat')} className={pill(variation === 'repeat')}>Same workout each time</button>
          </div>
        </div>
      )}

      {skeleton && <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">{describeSchedule(skeleton)}</p>}

      <div>
        <label className={label}>Per session, at most</label>
        <div className="grid grid-cols-2 gap-3">
          <Stepper label="Working sets" value={maxSets} onChange={setMaxSets} min={4} max={40} />
          <Stepper label="Exercises" value={maxExercises} onChange={setMaxExercises} min={2} max={12} />
        </div>
      </div>

      <div>
        <label className={label}>Experience <span className="font-normal text-gray-400">· sets each muscle's target</span></label>
        <div className="flex flex-wrap gap-2">
          {[['beginner', 'Beginner'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setLevel(k)} className={pill(level === k)}>{l}</button>
          ))}
        </div>
      </div>

      <div>
        <label className={label}>Priorities <span className="font-normal text-gray-400">· optional, raises their target</span></label>
        <div className="flex flex-wrap gap-2">
          {PRIORITY_OPTIONS.map((m) => (
            <button key={m} type="button" className={`${pill(priorities.includes(m))} capitalize`}
              onClick={() => setPriorities((p) => (p.includes(m) ? p.filter((x) => x !== m) : [...p, m]))}>{m}</button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Plan name</label>
        <input className="input" value={name} onChange={(e) => { setName(e.target.value); setNameEdited(true); }} maxLength={80} />
      </div>

      {/* Sessions from the split */}
      <div className="space-y-3">
        {skeleton && sessions.map((s, i) => {
          const t = sessionTotals(s);
          const roomSets = maxSets - t.sets;
          const full = t.exercises >= maxExercises || roomSets <= 0;
          const over = t.sets > maxSets || t.exercises > maxExercises;
          return (
            <div key={s.label} className="rounded-xl border border-gray-100 dark:border-gray-800 p-3 space-y-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{s.label}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">{sessionDays(skeleton, i)}</p>
              </div>
              <p className={`text-xs ${over ? 'text-red-600 dark:text-red-400' : full ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400 dark:text-gray-500'}`}>
                {t.sets} / {maxSets} working sets · {t.exercises} / {maxExercises} exercises
              </p>

              {s.exercises.length > 0 && (
                <ul className="space-y-1.5">
                  {s.exercises.map((e, idx) => (
                    <li key={`${e.exercise._id}-${idx}`} className="text-sm">
                    <div className="flex items-center gap-2">
                      <span className="flex-1 min-w-0 truncate text-gray-800 dark:text-gray-200">
                        {e.exercise.name}
                        {e.exercise.laterality === 'unilateral' && <span className="text-[11px] text-brand-600 dark:text-brand-400 ml-1">each side</span>}
                      </span>
                      <div className="flex items-center gap-1" title="Working sets">
                        <button type="button" disabled={e.sets <= 1} onClick={() => updateExercise(i, idx, { sets: e.sets - 1 })}
                          className="w-6 h-6 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 disabled:opacity-40 flex items-center justify-center"><Minus size={12} /></button>
                        <span className="w-12 text-center text-xs tabular-nums text-gray-700 dark:text-gray-300">{e.sets} set{e.sets !== 1 ? 's' : ''}</span>
                        <button type="button" disabled={roomSets <= 0} onClick={() => updateExercise(i, idx, { sets: e.sets + 1 })}
                          className="w-6 h-6 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 disabled:opacity-40 flex items-center justify-center"><Plus size={12} /></button>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-400" title="Rep range">
                        <input type="number" min={1} className={numInput} value={e.reps} onChange={(ev) => updateExercise(i, idx, { reps: ev.target.value })} />
                        –
                        <input type="number" min={1} className={numInput} value={e.repsMax} onChange={(ev) => updateExercise(i, idx, { repsMax: ev.target.value })} />
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-400" title="Reps in reserve: how many more reps you could do before failure. Closer to failure counts more.">
                        RIR
                        <input type="number" min={0} max={10} step={0.5} className={numInput} value={e.rir} onChange={(ev) => updateExercise(i, idx, { rir: ev.target.value })} />
                      </div>
                      <button type="button" title="Replace with a similar exercise"
                        onClick={() => setSwapping(swapping === `${i}-${idx}` ? null : `${i}-${idx}`)}
                        className={`p-1 hover:text-brand-600 ${swapping === `${i}-${idx}` ? 'text-brand-600' : 'text-gray-400'}`}><Repeat size={13} /></button>
                      <button type="button" onClick={() => updateSession(i, (x) => ({ ...x, exercises: x.exercises.filter((_, k) => k !== idx) }))}
                        className="p-1 text-gray-300 dark:text-gray-600 hover:text-red-500"><Trash2 size={13} /></button>
                    </div>
                    {swapping === `${i}-${idx}` && (
                      <div className="mt-1.5 space-y-1.5">
                        <SimilarExercises exerciseId={e.exercise._id} compact excludeIds={s.exercises.map((x) => x.exercise._id)}
                          onPick={(picked) => replaceExercise(i, idx, picked)} onClose={() => setSwapping(null)} />
                        {/* …or any exercise at all */}
                        <ExerciseSearch exercises={library} excludeIds={s.exercises.map((x) => x.exercise._id)} placeholder="…or pick any exercise"
                          onPick={(id) => replaceExercise(i, idx, library.find((x) => x._id === id))} />
                      </div>
                    )}
                    </li>
                  ))}
                </ul>
              )}

              {full ? (
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {t.exercises >= maxExercises ? 'Exercise limit reached' : 'Set limit reached'} for this session. Raise the limit above to add more.
                </p>
              ) : (
                <ExerciseSearch exercises={library} excludeIds={s.exercises.map((x) => x.exercise._id)} onPick={(id) => addExercise(i, id)} placeholder="+ Add exercise" />
              )}
            </div>
          );
        })}
      </div>

      {/* Live stimulus */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Weekly net stimulus &amp; recovery</p>
          {analyzing && <Loader2 size={14} className="animate-spin text-gray-400" />}
        </div>
        {!units ? (
          <p className="text-xs text-gray-400 dark:text-gray-500">Add exercises to see the stimulus each muscle gets.</p>
        ) : (
          <>
            {losing.length > 0 && (
              <p className="text-xs text-red-600 dark:text-red-400 mb-1.5">
                {losing.length} muscle{losing.length !== 1 ? 's' : ''} would lose ground (negative WNS): {losing.map((u) => unitLabel(u.unit)).join(', ')}.
              </p>
            )}
            {low.length > 0 && (
              <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400 mb-1.5">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                {low.length} muscle{low.length !== 1 ? 's are' : ' is'} under target: {low.map((u) => unitLabel(u.unit)).join(', ')}.
              </p>
            )}
            {losing.length === 0 && low.length === 0 && <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-1.5">Every muscle reaches its target.</p>}
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-2">Click a muscle to see its regions. Recovery above medium means the sets may be hard to recover from.</p>
            <StimulusTable units={required} />
          </>
        )}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      <button onClick={save} disabled={saving || !skeleton} className="btn-primary w-full justify-center py-2.5" title={problem || undefined}>
        {saving ? 'Saving…' : 'Save plan'}
      </button>
      {problem && !error && <p className="text-xs text-gray-400 dark:text-gray-500 text-center -mt-3">{problem}</p>}
    </div>
  );
}
