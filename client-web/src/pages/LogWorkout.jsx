import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { workoutAPI, exerciseAPI, planAPI, userAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { Plus, Trash2, Search, Check, ClipboardList, Play, X, Timer, PartyPopper, Repeat, Clock, GripVertical, Flame, SkipForward, ChevronUp, ChevronDown, ListOrdered } from 'lucide-react';
import ExerciseCombobox from '../components/ExerciseCombobox';
import SimilarExercises from '../components/SimilarExercises';
import ExerciseImage from '../components/ExerciseImage';
import { setsFromLastWorkout } from '../utils/lastSets';
import { UNITS, toKg, fromKg } from '../utils/weightUnits';
import { buildSessionReport, pickPreviousWorkout, formatChange, changeTone } from '../utils/sessionReport';
import {
  SIDES, isUnilateral, makeSet, setBasics, makeWarmup, warmupInsertIndex, withUnit, setNumber,
} from '../utils/logSets';
import { format, isToday, isYesterday, subDays } from 'date-fns';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, arrayMove, verticalListSortingStrategy, sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// rir (reps in reserve) and restTime are optional. In a live session the rest
// timer measures restTime; when logging a past workout it's typed in.
// Unilateral exercises are logged per side, warm-ups are flagged, and each
// exercise has its own kg/lb unit: see utils/logSets.js.
// "1:30" → 90, "90" → 90, "" → null. Returns undefined when it can't be read.
const parseRest = (text) => {
  const t = String(text).trim();
  if (t === '') return null;
  const m = t.match(/^(\d+):([0-5]?\d)$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  if (/^\d+$/.test(t)) return Number(t);
  return undefined;
};

// ── When (for workouts logged after the fact) ────────────────────────────────
const roundTo5 = (d) => { const x = new Date(d); x.setSeconds(0, 0); x.setMinutes(Math.floor(x.getMinutes() / 5) * 5); return x; };
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const HOURS_12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

/** Day chips (Today / Yesterday / pick a date) and an hour : minute AM/PM time. */
function WhenPicker({ value, onChange }) {
  const hours24 = value.getHours();
  const isPM = hours24 >= 12;
  const hour12 = hours24 % 12 === 0 ? 12 : hours24 % 12;

  const setDay = (day) => {
    const d = new Date(day);
    d.setHours(value.getHours(), value.getMinutes(), 0, 0);
    onChange(d);
  };
  const setTime = (h12, minute, pm) => {
    const d = new Date(value);
    d.setHours((h12 % 12) + (pm ? 12 : 0), minute, 0, 0);
    onChange(d);
  };
  const chip = (active) => `px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${active
    ? 'bg-brand-600 text-white border-brand-600'
    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-brand-400'}`;
  const select = 'input !w-auto py-1.5 pr-8 text-sm';
  const other = !isToday(value) && !isYesterday(value);

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap items-center">
        <button type="button" onClick={() => setDay(new Date())} className={chip(isToday(value))}>Today</button>
        <button type="button" onClick={() => setDay(subDays(new Date(), 1))} className={chip(isYesterday(value))}>Yesterday</button>
        <input type="date" max={format(new Date(), 'yyyy-MM-dd')} value={format(value, 'yyyy-MM-dd')}
          onChange={(e) => e.target.value && setDay(new Date(`${e.target.value}T00:00`))}
          className={`input !w-auto py-1.5 text-sm ${other ? 'border-brand-500 ring-1 ring-brand-500' : ''}`} />
      </div>
      <div className="flex items-center gap-2">
        <select className={select} value={hour12} onChange={(e) => setTime(Number(e.target.value), value.getMinutes(), isPM)} aria-label="Hour">
          {HOURS_12.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
        <span className="text-gray-400">:</span>
        <select className={select} value={value.getMinutes() - (value.getMinutes() % 5)}
          onChange={(e) => setTime(hour12, Number(e.target.value), isPM)} aria-label="Minute">
          {MINUTES.map((m) => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
        </select>
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
          {['AM', 'PM'].map((p) => (
            <button key={p} type="button" onClick={() => setTime(hour12, value.getMinutes(), p === 'PM')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${(p === 'PM') === isPM
                ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Draggable exercise card ──────────────────────────────────────────────────
function SortableCard({ id, enabled, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !enabled });
  return (
    <div ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`card space-y-3 ${isDragging ? 'relative z-10 shadow-lg ring-2 ring-brand-500 opacity-95' : ''}`}>
      {children(enabled ? { ...attributes, ...listeners } : null)}
    </div>
  );
}

let uidCounter = 0;
const newUid = () => `ex-${Date.now()}-${uidCounter++}`;

const cellInput = 'w-full text-center border border-gray-200 dark:border-gray-700 rounded-md py-1 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none';

/** Rest typed as m:ss (or seconds); commits on blur so typing "1:" isn't rejected. */
function RestInput({ value, onChange }) {
  const [text, setText] = useState(value != null && value !== '' ? fmtClock(Number(value)) : '');
  const [bad, setBad] = useState(false);
  useEffect(() => { setText(value != null && value !== '' ? fmtClock(Number(value)) : ''); }, [value]);
  const commit = () => {
    const secs = parseRest(text);
    if (secs === undefined || secs > 3600) { setBad(true); return; }
    setBad(false);
    onChange(secs);
  };
  return (
    <input className={`${cellInput} ${bad ? '!border-red-400' : ''}`} placeholder="m:ss" inputMode="numeric"
      value={text} onChange={(e) => { setText(e.target.value); setBad(false); }} onBlur={commit}
      title={bad ? 'Use m:ss, e.g. 1:30 (max 60:00)' : 'Rest after this set, e.g. 1:30'} />
  );
}

const fmtClock = (totalSeconds) => {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

// ── Session Player ────────────────────────────────────────────────────────────
// Walks through every exercise's sets one at a time, so the user can just follow
// along instead of re-reading the whole plan mid-workout. Between sets a rest
// timer counts up until the user ends it, and that time is saved as the rest
// after the set. Reps/weight stay editable in case the set didn't go as planned.
// Most recently logged weight for an exercise, or null.
const lastWeightFor = (exerciseId) =>
  workoutAPI.getProgress(exerciseId)
    .then(({ data }) => (data.length ? data[data.length - 1].maxWeight : null))
    .catch(() => null);

// Splits the current exercise at the current set: sets already done stay where
// they are, the rest are returned so they can be moved or swapped.
const splitAtSet = (list, exIdx, setIdx) => {
  const ex = list[exIdx];
  const done = ex.sets.slice(0, setIdx);
  const remaining = ex.sets.slice(setIdx);
  const before = list.slice(0, exIdx);
  const after = list.slice(exIdx + 1);
  const kept = done.length ? [{ ...ex, sets: done }] : [];
  return { before, kept, remaining, after, ex };
};

/** kg | lb switch for one exercise (or the default for new ones). */
function UnitToggle({ value, onChange, title = 'Weight unit' }) {
  return (
    <div className="inline-flex p-0.5 bg-gray-100 dark:bg-gray-800 rounded-md shrink-0" role="group" aria-label={title} title={title}>
      {UNITS.map((u) => (
        <button key={u} type="button" onClick={() => u !== value && onChange(u)}
          className={`px-2 py-0.5 text-[11px] font-semibold rounded transition-colors ${u === value
            ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}>
          {u}
        </button>
      ))}
    </div>
  );
}

function SessionField({ label, value, onChange, small, placeholder }) {
  return (
    <div className="text-center">
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
        title={label === 'RIR' ? 'Reps in reserve: how many more reps you could have done' : undefined}>{label}</label>
      <input
        type="number" min={0} max={label === 'RIR' ? 10 : undefined} placeholder={label === 'RIR' ? (placeholder || '–') : undefined}
        className={`${small ? 'w-16' : 'w-20'} text-center text-lg font-semibold border border-gray-200 dark:border-gray-700 rounded-lg py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// ── Session report ───────────────────────────────────────────────────────────
// Shown when a live session ends: sets, reps, volume and time, each with the
// change from the last session, and per exercise the change in reps and top weight.
const TONE = {
  up: 'text-emerald-600 dark:text-emerald-400',
  down: 'text-red-500 dark:text-red-400',
  same: 'text-gray-400 dark:text-gray-500',
};
function Change({ value, suffix = '' }) {
  const tone = changeTone(value);
  if (!tone) return null;
  return <span className={`text-xs font-semibold ${TONE[tone]}`}>{formatChange(value)}{suffix}</span>;
}

function SessionReport({ exercises, seconds, name, volumeUnit, onDone }) {
  const [report, setReport] = useState(null);

  useEffect(() => {
    let alive = true;
    const ids = [...new Set(exercises.map((e) => String(e.exercise._id)))];
    Promise.all([
      workoutAPI.getAll({ limit: 20 }).then(({ data }) => data.workouts || []).catch(() => []),
      ...ids.map((id) => workoutAPI.lastSets(id).then(({ data }) => [id, data.sets]).catch(() => [id, []])),
    ]).then(([workouts, ...last]) => {
      if (!alive) return;
      const previous = pickPreviousWorkout(workouts, name, ids);
      setReport(buildSessionReport({ exercises, seconds, previous, lastSets: Object.fromEntries(last) }));
    });
    return () => { alive = false; };
    // The report is of the session as it ended.
  }, []);

  const vol = (kg) => Math.round(fromKg(kg, volumeUnit)).toLocaleString();
  const t = report?.totals;
  const c = report?.change;
  const stats = t && [
    ['Sets', t.sets, c?.sets],
    ['Reps', t.reps, c?.reps],
    [`Volume (${volumeUnit})`, vol(t.volume), c && Math.round(fromKg(c.volume, volumeUnit))],
    ['Time (min)', t.minutes, c?.minutes],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 px-4">
      <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl shadow-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="text-center">
          <PartyPopper size={32} className="mx-auto text-brand-500" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-2">Workout complete!</h3>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {!report ? 'Comparing with your last session…'
              : report.previousDate ? `Compared with ${report.previousName}, ${format(new Date(report.previousDate), 'MMM d')}`
                : 'Your first session to compare against next time.'}
          </p>
        </div>

        {report && (<>
          <div className="grid grid-cols-2 gap-2">
            {stats.map(([label, value, change]) => (
              <div key={label} className="rounded-xl bg-gray-50 dark:bg-gray-800 px-3 py-2">
                <p className="text-[11px] text-gray-400 dark:text-gray-500">{label}</p>
                <p className="flex items-baseline gap-2">
                  <span className="text-xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">{value}</span>
                  <Change value={change} />
                </p>
              </div>
            ))}
          </div>

          {report.exercises.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                By set <span className="font-normal">· each set vs the same set last time</span>
              </p>
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {report.exercises.map((e) => (
                  <li key={e.name} className="py-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {e.name}
                      {e.isFirst && <span className="ml-1.5 text-xs font-normal italic text-gray-400">first time</span>}
                    </p>
                    <table className="w-full text-xs mt-1 tabular-nums">
                      <tbody>
                        {e.setRows.flatMap((row) => row.entries.map((en, k) => (
                          <tr key={`${row.number}-${k}`} className="text-gray-600 dark:text-gray-300">
                            <td className="py-0.5 w-12 text-gray-400 dark:text-gray-500">{k === 0 ? `Set ${row.number}` : ''}</td>
                            <td className="py-0.5 w-5 text-gray-400 dark:text-gray-500 font-semibold">{en.side ? (en.side === 'left' ? 'L' : 'R') : ''}</td>
                            <td className="py-0.5">{en.weight}{e.unit} × {en.reps}</td>
                            <td className="py-0.5 text-right">
                              {en.change ? (
                                <span className="inline-flex gap-2">
                                  <span><Change value={en.change.weight} suffix={e.unit} /></span>
                                  <span><Change value={en.change.reps} suffix=" reps" /></span>
                                </span>
                              ) : !e.isFirst && <span className="italic text-gray-400">new set</span>}
                            </td>
                          </tr>
                        )))}
                      </tbody>
                    </table>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>)}

        <button onClick={onDone} className="btn-primary w-full justify-center">Back to Save Workout</button>
      </div>
    </div>
  );
}

function SessionPlayer({ exercises, allExercises, name, volumeUnit, onUpdateSet, onChangeExercises, onSetUnit, onClose, onFinish }) {
  // Flatten to a single ordered list of {exIdx, setIdx} steps across all exercises.
  const steps = exercises.flatMap((ex, exIdx) => ex.sets.map((_, setIdx) => ({ exIdx, setIdx })));

  const [stepIdx, setStepIdx]   = useState(0);
  const [phase, setPhase]       = useState('active'); // 'active' | 'resting' | 'done'
  const [startedAt]             = useState(() => Date.now());
  const [restStartedAt, setRestStartedAt] = useState(null);
  const [lastRest, setLastRest] = useState(null); // seconds, shown on the next set
  const [, setTick]             = useState(0);
  const [swapOpen, setSwapOpen] = useState(false);
  const [endedAt, setEndedAt]   = useState(null); // session seconds when it ended
  const [orderOpen, setOrderOpen] = useState(false);
  const [swapId, setSwapId]     = useState('');
  const [swapping, setSwapping] = useState(false);

  // Re-render twice a second. Times are worked out from timestamps rather than
  // counted ticks, so they stay right even if the tab was in the background.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, []);

  const secondsSince = (t) => Math.max(0, Math.floor((Date.now() - t) / 1000));
  const elapsed = secondsSince(startedAt);
  const restSeconds = restStartedAt ? secondsSince(restStartedAt) : 0;

  // Skipping warm-ups can remove the last steps. The session time stops here.
  const finished = phase === 'done' || stepIdx >= steps.length;
  if (finished) {
    const seconds = endedAt ?? elapsed;
    return <SessionReport exercises={exercises} seconds={seconds} name={name} volumeUnit={volumeUnit} onDone={() => onFinish(seconds)} />;
  }

  const { exIdx, setIdx } = steps[stepIdx];
  const currentEx  = exercises[exIdx];
  const currentSet = currentEx.sets[setIdx];
  const nextStep   = steps[stepIdx + 1];
  const unit       = currentEx.unit || 'kg';
  const isWarmup   = !!currentSet.warmup;
  const warmupCount  = currentEx.sets.filter((st) => st.warmup).length;
  const workingCount = currentEx.sets.length - warmupCount;
  // Warm-ups can be added until the first working set of the exercise is done.
  const canAddWarmup = !isWarmup && currentEx.sets.slice(0, setIdx).every((st) => st.warmup);

  // Skip the rest of this exercise's warm-ups (they're removed, not logged).
  const skipWarmups = () => {
    onChangeExercises((list) => list.map((ex, i) => {
      if (i !== exIdx) return ex;
      let end = setIdx;
      while (ex.sets[end]?.warmup) end++;
      return { ...ex, sets: [...ex.sets.slice(0, setIdx), ...ex.sets.slice(end)] };
    }));
    setLastRest(null);
  };
  // Add a warm-up before the current (first working) set and do it now.
  const addWarmup = () => {
    onChangeExercises((list) => list.map((ex, i) => (i !== exIdx ? ex
      : { ...ex, sets: [...ex.sets.slice(0, setIdx), makeWarmup(ex), ...ex.sets.slice(setIdx)] })));
  };

  const completeSet = () => {
    if (stepIdx === steps.length - 1) { setEndedAt(elapsed); setPhase('done'); return; }
    setRestStartedAt(Date.now());
    setPhase('resting');
  };

  // Save the rest on the set that was just finished, then move on.
  const recordRest = () => {
    const rest = restSeconds;
    onUpdateSet(exIdx, setIdx, 'restTime', rest);
    return rest;
  };

  const endRest = () => {
    setLastRest(recordRest());
    setRestStartedAt(null);
    setStepIdx((i) => i + 1);
    setPhase('active');
  };

  // Machine taken? Replace the rest of this exercise with another one.
  // Sets already done stay logged under the original exercise.
  const swapExercise = async () => {
    const newEx = allExercises.find((e) => e._id === swapId);
    if (!newEx) return;
    setSwapping(true);
    const lastWeight = await lastWeightFor(newEx._id);
    onChangeExercises((list) => {
      const { before, kept, remaining, after, ex } = splitAtSet(list, exIdx, setIdx);
      const replacement = {
        exercise: newEx,
        unit: ex.unit,
        // Keep the planned reps; weight starts from what they last lifted on it.
        sets: remaining.map((st) => makeSet(newEx, {
          reps: setBasics(st).reps,
          weight: st.warmup ? setBasics(st).weight : fromKg(lastWeight ?? 0, ex.unit),
          warmup: !!st.warmup,
        })),
      };
      return [...before, ...kept, replacement, ...after];
    });
    // The done sets are unchanged, so stepIdx already points at the new exercise's first set.
    setSwapping(false);
    setSwapOpen(false);
    setSwapId('');
    setLastRest(null);
  };

  // Machine busy: do the next exercise first, then come back to the rest of this one.
  const doLater = () => {
    onChangeExercises((list) => {
      const { before, kept, remaining, after, ex } = splitAtSet(list, exIdx, setIdx);
      const [next, ...rest] = after;
      return [...before, ...kept, ...(next ? [next] : []), { ...ex, sets: remaining }, ...rest];
    });
    setLastRest(null);
  };
  // Only useful if some other exercise is still to come.
  const canDoLater = steps.slice(stepIdx).some((st) => st.exIdx !== exIdx);
  // Change the order of exercises not started yet: the current one (until its
  // first set is done) and everything after it. Sets already done stay put.
  const firstMovable = phase === 'active' && setIdx === 0 ? exIdx : exIdx + 1;
  const moveExercise = (i, dir) => onChangeExercises((list) => {
    const j = i + dir;
    if (i < firstMovable || j < firstMovable || j >= list.length) return list;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });

  // Closing mid-rest still keeps the rest taken so far.
  const close = () => {
    if (phase === 'resting') recordRest();
    onClose(elapsed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 px-4">
      {/* Scrolls when the swap list makes it taller than the screen. */}
      <div className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-2xl shadow-xl p-6 space-y-5 max-h-[90vh] overflow-y-auto overscroll-contain">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
            Exercise {exIdx + 1}/{exercises.length} · Session {fmtClock(elapsed)}
          </span>
          <button onClick={close} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={18} />
          </button>
        </div>

        {phase === 'active' ? (
          <>
            <div className="text-center">
              {currentEx.exercise.images?.length > 0 && (
                <ExerciseImage images={currentEx.exercise.images} name={currentEx.exercise.name} both className="h-28 mb-3" />
              )}
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{currentEx.exercise.name}</h3>
              <div className="flex items-center justify-center gap-2 mt-1">
                {isWarmup ? (
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-amber-600 dark:text-amber-400">
                    <Flame size={14} /> Warm-up {setIdx + 1} of {warmupCount}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400 dark:text-gray-500">Set {setNumber(currentEx.sets, setIdx)} of {workingCount}</span>
                )}
                <UnitToggle value={unit} onChange={(u) => onSetUnit(exIdx, u)} />
              </div>
              {lastRest != null && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Rested {fmtClock(lastRest)}</p>
              )}
            </div>

            {currentSet.left ? (
              // Unilateral: a row of inputs per side.
              <div className="space-y-3">
                {SIDES.map((side) => (
                  <div key={side} className="flex items-end gap-2 justify-center">
                    <span className="w-12 pb-2.5 text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">{side}</span>
                    <SessionField label="Reps" value={currentSet[side].reps} onChange={(v) => onUpdateSet(exIdx, setIdx, 'reps', v, side)} />
                    <SessionField label={`Weight (${unit})`} value={currentSet[side].weight} onChange={(v) => onUpdateSet(exIdx, setIdx, 'weight', v, side)} />
                    {!isWarmup && <SessionField label="RIR" small placeholder={currentEx.targetRir} value={currentSet[side].rir ?? ''} onChange={(v) => onUpdateSet(exIdx, setIdx, 'rir', v, side)} />}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex gap-3 justify-center">
                <SessionField label="Reps" value={currentSet.reps} onChange={(v) => onUpdateSet(exIdx, setIdx, 'reps', v)} />
                <SessionField label={`Weight (${unit})`} value={currentSet.weight} onChange={(v) => onUpdateSet(exIdx, setIdx, 'weight', v)} />
                {!isWarmup && <SessionField label="RIR" small placeholder={currentEx.targetRir} value={currentSet.rir ?? ''} onChange={(v) => onUpdateSet(exIdx, setIdx, 'rir', v)} />}
              </div>
            )}

            <button onClick={completeSet} className="btn-primary w-full justify-center py-3">
              {stepIdx === steps.length - 1 ? 'Finish Workout' : isWarmup ? 'Complete Warm-up' : 'Complete Set'}
            </button>
            {/* Warm-ups are optional: skip them, or add one before the first working set. */}
            {isWarmup ? (
              <button onClick={skipWarmups} className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-brand-600 -mt-2">
                <SkipForward size={13} /> Skip warm-up{currentEx.sets.slice(setIdx).filter((st) => st.warmup).length > 1 ? 's' : ''}
              </button>
            ) : canAddWarmup && (
              <button onClick={addWarmup} className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-amber-600 -mt-2">
                <Flame size={13} /> Add a warm-up set first
              </button>
            )}

            {/* Machine or equipment busy: swap to something else, or come back later */}
            {swapOpen ? (
              <div className="space-y-2 border-t border-gray-100 dark:border-gray-800 pt-4">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Replace {currentEx.exercise.name} for the remaining {currentEx.sets.length - setIdx} set{currentEx.sets.length - setIdx !== 1 ? 's' : ''} with:
                </p>
                {/* Similar exercises first; pick one or search everything below */}
                <SimilarExercises exerciseId={currentEx.exercise._id} compact onPick={(ex) => setSwapId(ex._id)} />
                <ExerciseCombobox
                  exercises={allExercises.filter((e) => e._id !== currentEx.exercise._id)}
                  value={swapId}
                  onChange={setSwapId}
                  placeholder="…or search all exercises"
                />
                <div className="flex gap-2">
                  <button onClick={() => { setSwapOpen(false); setSwapId(''); }} className="btn-secondary flex-1 justify-center text-sm">Cancel</button>
                  <button onClick={swapExercise} disabled={!swapId || swapping} className="btn-primary flex-1 justify-center text-sm">
                    {swapping ? 'Swapping…' : 'Swap'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setSwapOpen(true)} className="btn-secondary flex-1 justify-center text-xs py-2">
                  <Repeat size={14} /> Swap exercise
                </button>
                <button onClick={doLater} disabled={!canDoLater} className="btn-secondary flex-1 justify-center text-xs py-2 disabled:opacity-40"
                  title={canDoLater ? 'Do the next exercise first, then come back to the rest of this one' : 'This is the last exercise'}>
                  <Clock size={14} /> Do it later
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="text-center">
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Resting</p>
              <p className="text-5xl font-bold text-brand-500 my-3 tabular-nums">{fmtClock(restSeconds)}</p>
              {nextStep && (
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  Up next: {exercises[nextStep.exIdx].exercise.name} — {exercises[nextStep.exIdx].sets[nextStep.setIdx]?.warmup ? 'Warm-up' : `Set ${setNumber(exercises[nextStep.exIdx].sets, nextStep.setIdx)}`}
                </p>
              )}
            </div>
            <button onClick={endRest} className="btn-primary w-full justify-center py-3">
              <Timer size={16} /> End rest — start next set
            </button>
          </>
        )}

        {exercises.length - firstMovable > 1 && (
          <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
            <button onClick={() => setOrderOpen(!orderOpen)}
              className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-brand-600">
              <ListOrdered size={14} /> {orderOpen ? 'Done reordering' : 'Change exercise order'}
            </button>
            {orderOpen && (
              <ol className="mt-2 space-y-1">
                {exercises.map((ex, i) => (i < firstMovable ? null : (
                  <li key={ex.uid || `${ex.exercise._id}-${i}`}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${i === exIdx && phase === 'active' ? 'bg-brand-50 dark:bg-brand-900/30' : 'bg-gray-50 dark:bg-gray-800'}`}>
                    <span className="w-5 text-xs text-gray-400 tabular-nums">{i + 1}</span>
                    <span className="flex-1 min-w-0 truncate text-gray-800 dark:text-gray-200">{ex.exercise.name}</span>
                    <span className="text-xs text-gray-400">{ex.sets.length} set{ex.sets.length !== 1 ? 's' : ''}</span>
                    <button onClick={() => moveExercise(i, -1)} disabled={i === firstMovable} aria-label={`Move ${ex.exercise.name} up`}
                      className="p-0.5 text-gray-400 hover:text-brand-600 disabled:opacity-25"><ChevronUp size={16} /></button>
                    <button onClick={() => moveExercise(i, 1)} disabled={i === exercises.length - 1} aria-label={`Move ${ex.exercise.name} down`}
                      className="p-0.5 text-gray-400 hover:text-brand-600 disabled:opacity-25"><ChevronDown size={16} /></button>
                  </li>
                )))}
              </ol>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function LogWorkout() {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  // Unit new exercises start in; each exercise can be switched on its own.
  const defaultUnit = user?.weightUnit === 'lb' ? 'lb' : 'kg';
  const [name, setName] = useState(`Workout ${new Date().toLocaleDateString()}`);
  // 'live': follow along with the session player (rest is timed).
  // 'past': log a workout that's already done, typing in the date and rests.
  const [mode, setMode] = useState('live');
  const [doneAt, setDoneAt] = useState(() => roundTo5(new Date()));
  const [replacing, setReplacing] = useState(null); // index of the exercise showing similar ones

  const [exercises, setExercises] = useState([]);
  const [duration, setDuration] = useState(45);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [allExercises, setAllExercises] = useState([]);

  const [plans, setPlans] = useState([]);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(false);

  const [sessionOpen, setSessionOpen] = useState(false);

  // Each exercise card needs a stable id to be dragged around.
  useEffect(() => {
    if (exercises.some((e) => !e.uid)) setExercises((prev) => prev.map((e) => (e.uid ? e : { ...e, uid: newUid() })));
  }, [exercises]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    setExercises((prev) => {
      const from = prev.findIndex((e) => e.uid === active.id);
      const to = prev.findIndex((e) => e.uid === over.id);
      return from < 0 || to < 0 ? prev : arrayMove(prev, from, to);
    });
  };

  useEffect(() => {
    exerciseAPI.getAll().then(({ data }) => setAllExercises(data)).catch(console.error);
    planAPI.getAll().then(({ data }) => setPlans(data)).catch(console.error);
  }, []);

  const filteredExercises = allExercises.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  // Starts with what was logged last time on this exercise (same sets, reps and
  // weight). It's added straight away and filled in when that arrives, unless
  // its sets were edited in the meantime.
  const addExercise = (ex) => {
    if (exercises.find(e => e.exercise._id === ex._id)) return;
    const uid = newUid();
    const placeholder = [makeSet(ex)];
    setExercises(prev => [...prev, { uid, exercise: ex, unit: defaultUnit, sets: placeholder }]);
    workoutAPI.lastSets(ex._id)
      .then(({ data }) => {
        // In the unit used last time, unless the unit was changed in the meantime.
        setExercises(prev => prev.map((e) => {
          if (e.uid !== uid || e.sets !== placeholder) return e;
          const unit = e.unit !== defaultUnit ? e.unit : (data.weightUnit || e.unit);
          const sets = setsFromLastWorkout(ex, data.sets, unit);
          return sets.length ? { ...e, unit, sets, lastDate: data.date } : e;
        }));
      })
      .catch(() => {});
    setPickerOpen(false);
    setSearch('');
  };

  const removeExercise = (idx) => setExercises(prev => prev.filter((_, i) => i !== idx));

  // Load a plan day as a starting point — sets are pre-filled with the day's
  // target reps/weight so there's less typing, but nothing is submitted yet:
  // every value below stays fully editable, and today's actual sets can
  // (and often should) differ from the plan's targets.
  const useTemplateDay = async (plan, day) => {
    if (exercises.length > 0 && !window.confirm('This will replace the exercises you\'ve already added. Continue?')) {
      return;
    }
    const validEntries = day.exercises.filter((e) => e.exercise); // skip entries whose exercise was since deleted

    setTemplateLoading(true);
    try {
      // Pull each exercise's most recently logged weight so sets start from
      // where the user actually left off, instead of the plan's static target.
      const lastWeights = await Promise.all(validEntries.map((e) => lastWeightFor(e.exercise._id)));

      const loaded = validEntries.map((e, i) => {
        const unit = e.weightUnit || defaultUnit; // the plan's unit for this exercise
        return {
          exercise: e.exercise,
          unit,
          targetRir: e.targetRir || '', // shown as the RIR placeholder
          sets: Array.from({ length: e.targetSets || 1 }, () => makeSet(e.exercise, {
            reps: e.targetReps ?? 10,
            weight: lastWeights[i] != null ? fromKg(lastWeights[i], unit) : Number(e.targetWeight) || 0,
          })),
        };
      });
      setExercises(loaded);
      setName(`${plan.name} — ${day.label || (plan.schedule === 'rotation' ? `Workout ${day.dayOfWeek + 1}` : DAYS[day.dayOfWeek])}`);
      setTemplatePickerOpen(false);
    } finally {
      setTemplateLoading(false);
    }
  };

  // A new working set copies the last working set's reps and weight.
  const addSet = (exIdx) => setExercises(prev => {
    const updated = [...prev];
    const ex = updated[exIdx];
    const last = [...ex.sets].reverse().find((st) => !st.warmup);
    updated[exIdx] = { ...ex, sets: [...ex.sets, makeSet(ex.exercise, last ? setBasics(last) : {})] };
    return updated;
  });

  // Warm-ups go before the working sets.
  const addWarmup = (exIdx) => setExercises(prev => prev.map((ex, i) => {
    if (i !== exIdx) return ex;
    const at = warmupInsertIndex(ex.sets);
    return { ...ex, sets: [...ex.sets.slice(0, at), makeWarmup(ex), ...ex.sets.slice(at)] };
  }));

  // Switch one exercise between kg and lb; typed weights convert (same load).
  // The last unit picked is remembered: new exercises start in it.
  const setUnit = (exIdx, unit) => {
    setExercises(prev => prev.map((ex, i) => (i !== exIdx ? ex : withUnit(ex, unit))));
    if (unit !== defaultUnit) {
      updateUser({ weightUnit: unit });
      userAPI.updateMe({ weightUnit: unit }).catch(() => {});
    }
  };

  const removeSet = (exIdx, setIdx) => setExercises(prev => {
    const updated = [...prev];
    const sets = updated[exIdx].sets.filter((_, i) => i !== setIdx);
    if (sets.length === 0) return prev;
    updated[exIdx] = { ...updated[exIdx], sets };
    return updated;
  });

  // Swap an exercise for a similar one, keeping its sets (reps carry over, weight
  // starts from what was last lifted on the new exercise). Handles bilateral ↔
  // unilateral by rebuilding each set for the new exercise.
  const replaceExercise = async (exIdx, picked) => {
    setReplacing(null);
    const full = allExercises.find((e) => e._id === picked._id) || picked;
    const lastWeight = await lastWeightFor(full._id);
    setExercises((prev) => prev.map((e, i) => (i !== exIdx ? e : {
      ...e,
      exercise: full,
      sets: e.sets.map((st) => ({
        ...makeSet(full, {
          reps: setBasics(st).reps,
          weight: st.warmup ? setBasics(st).weight : fromKg(lastWeight ?? 0, e.unit || 'kg'),
          warmup: !!st.warmup,
        }),
        restTime: st.restTime,
      })),
    })));
  };

  // `side` ('left'/'right') targets one side of a unilateral set.
  const updateSet = (exIdx, setIdx, field, value, side) => setExercises(prev =>
    prev.map((ex, ei) => ei !== exIdx ? ex : {
      ...ex,
      sets: ex.sets.map((s, si) => {
        if (si !== setIdx) return s;
        // rir/restTime can be left blank (= not recorded); everything else is a number.
        const v = (field === 'rir' || field === 'restTime') && (value === '' || value == null) ? '' : Number(value);
        return side ? { ...s, [side]: { ...s[side], [field]: v } } : { ...s, [field]: v };
      }),
    })
  );

  // One entry per performed set; unilateral sets become a left and a right entry
  // (a side with 0 reps is left out). Rest goes on the last entry of the set.
  const flattenSets = (sets) => sets.flatMap((s) => {
    if (!s.left) return Number(s.reps) > 0 ? [s] : [];
    const sides = SIDES.filter((side) => Number(s[side].reps) > 0).map((side) => ({ ...s[side], side, warmup: s.warmup }));
    if (sides.length) sides[sides.length - 1].restTime = s.restTime;
    return sides;
  });

  const handleSave = async () => {
    if (exercises.length === 0) { setError('Add at least one exercise.'); return; }

    // A set left at 0 reps (skipped during the session, or a cleared field)
    // wasn't actually performed, so leave it out rather than sending it —
    // the API requires reps ≥ 1 and would reject the whole workout.
    const cleaned = exercises
      .map(e => ({ ...e, sets: flattenSets(e.sets) }))
      .filter(e => e.sets.length > 0);

    if (cleaned.length === 0) {
      setError('Every set has 0 reps — enter the reps you did before saving.');
      return;
    }

    for (const ex of cleaned) {
      let setNo = 0;
      for (const set of ex.sets) {
        if (set.side !== 'right' && !set.warmup) setNo++;
        const where = `${ex.exercise.name}, ${set.warmup ? 'warm-up' : `set ${setNo}`}${set.side ? ` (${set.side})` : ''}`;
        if (!Number.isInteger(Number(set.reps))) {
          setError(`${where}: reps must be a whole number.`);
          return;
        }
        if (!Number.isFinite(Number(set.weight)) || Number(set.weight) < 0) {
          setError(`${where}: weight can't be negative.`);
          return;
        }
        if (!set.warmup && set.rir !== '' && set.rir != null && !(Number.isInteger(Number(set.rir)) && Number(set.rir) >= 0 && Number(set.rir) <= 10)) {
          setError(`${where}: RIR must be a whole number from 0 to 10.`);
          return;
        }
      }
    }
    if (mode === 'past' && doneAt > new Date()) {
      setError("The workout can't be in the future. Pick an earlier time.");
      return;
    }

    setError('');
    setSaving(true);
    try {
      await workoutAPI.create({
        name,
        ...(mode === 'past' && { date: doneAt.toISOString() }),
        duration: Number(duration) || 0,
        notes,
        exercises: cleaned.map(e => ({
          exercise: e.exercise._id,
          weightUnit: e.unit || 'kg',
          sets: e.sets.map(s => ({
            ...(s.side && { side: s.side }),
            ...(s.warmup && { warmup: true }),
            reps: Number(s.reps),
            weight: toKg(s.weight, e.unit), // stored in kg
            // Optional: only sent when recorded. Warm-ups have none.
            ...(!s.warmup && s.rir !== '' && s.rir != null && Number.isFinite(Number(s.rir)) ? { rir: Number(s.rir) } : {}),
            ...(Number.isFinite(Number(s.restTime)) && s.restTime !== '' && s.restTime != null
              ? { restTime: Math.round(Number(s.restTime)) } : {}),
          })),
        })),
      });
      navigate('/');
    } catch (err) {
      // Show which field the server rejected instead of a bare "Validation failed".
      const data = err.response?.data;
      const details = data?.errors?.map(e => e.message).filter(Boolean);
      setError(details?.length
        ? `${data.message}: ${[...new Set(details)].join('; ')}`
        : data?.message || 'Failed to save workout');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Log Workout</h1>

      {error && <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm rounded-lg">{error}</div>}

      <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
        {[['live', 'Live session', 'Timed rests as you train'], ['past', 'Already done', 'Type in rests and the date']].map(([key, label, hint]) => (
          <button key={key} onClick={() => setMode(key)}
            className={`px-3 py-2 rounded-lg text-left transition-colors ${mode === key
              ? 'bg-white dark:bg-gray-900 shadow-sm' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}>
            <p className={`text-sm font-medium ${mode === key ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}>{label}</p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">{hint}</p>
          </button>
        ))}
      </div>

      <div className="card space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Workout name</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} />
        </div>
        {mode === 'past' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">When</label>
            <WhenPicker value={doneAt} onChange={setDoneAt} />
            {doneAt > new Date() && <p className="text-xs text-red-500 mt-1">That's in the future.</p>}
          </div>
        )}
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Duration (min)</label>
            <input className="input" type="number" min={1} value={duration} onChange={e => setDuration(e.target.value)} />
          </div>
        </div>
      </div>

      {exercises.length > 1 && (
        <p className="text-xs text-gray-400 dark:text-gray-500 -mb-2">
          Drag <GripVertical size={12} className="inline -mt-0.5" /> to {mode === 'past' ? 'put exercises in the order you did them' : 'change the order of exercises'}.
        </p>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={exercises.map((e) => e.uid || '')} strategy={verticalListSortingStrategy}>
      {exercises.map((ex, exIdx) => (
        <SortableCard key={ex.uid || `${ex.exercise._id}-${exIdx}`} id={ex.uid || `${ex.exercise._id}-${exIdx}`} enabled={!!ex.uid}>
          {(handle) => (<>
          <div className="flex items-center justify-between gap-2">
            {handle && (
              <button {...handle} type="button" title="Drag to reorder" aria-label={`Reorder ${ex.exercise.name}`}
                className="p-1 -ml-1 text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 cursor-grab active:cursor-grabbing touch-none">
                <GripVertical size={18} />
              </button>
            )}
            <ExerciseImage images={ex.exercise.images} name={ex.exercise.name} className="w-12 h-9 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 dark:text-gray-100">{ex.exercise.name}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 capitalize">
                {ex.exercise.muscleGroups?.join(', ')}
                {isUnilateral(ex.exercise) && <span className="ml-1.5 normal-case text-brand-600 dark:text-brand-400">· each side</span>}
                {ex.lastDate && <span className="ml-1.5 normal-case" title="Sets, reps and weight copied from your last workout with this exercise">· last time {format(new Date(ex.lastDate), 'MMM d')}</span>}
              </p>
            </div>
            <UnitToggle value={ex.unit || 'kg'} onChange={(u) => setUnit(exIdx, u)} />
            <button onClick={() => setReplacing(replacing === exIdx ? null : exIdx)} title="Replace with a similar exercise"
              className={`p-1 hover:text-brand-600 ${replacing === exIdx ? 'text-brand-600' : 'text-gray-400'}`}>
              <Repeat size={16} />
            </button>
            <button onClick={() => removeExercise(exIdx)} className="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400">
              <Trash2 size={16} />
            </button>
          </div>
          {replacing === exIdx && (
            <SimilarExercises exerciseId={ex.exercise._id} compact
              onPick={(picked) => replaceExercise(exIdx, picked)} onClose={() => setReplacing(null)} />
          )}

          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 dark:text-gray-500 uppercase">
                <th className="text-left pb-1">Set</th>
                <th className="pb-1">Reps</th>
                <th className="pb-1">Weight ({ex.unit || 'kg'})</th>
                <th className="pb-1" title="Reps in reserve: how many more reps you could have done">RIR</th>
                <th className="pb-1" title="Rest after this set">Rest</th>
                <th className="pb-1"></th>
              </tr>
            </thead>
            <tbody>
              {ex.sets.map((set, setIdx) => {
                // Unilateral sets show a row per side; rest and delete cover both rows.
                const rows = set.left ? SIDES.map((side) => ({ side, values: set[side] })) : [{ side: null, values: set }];
                return rows.map(({ side, values }, rowIdx) => (
                  <tr key={`${setIdx}-${side || 'both'}`} className={rowIdx === 0 ? 'border-t border-gray-50 dark:border-gray-800' : ''}>
                    <td className="py-1 text-gray-400 dark:text-gray-500 text-xs whitespace-nowrap">
                      {/* Fixed-width number so R lines up under L. */}
                      <span className={`inline-block w-4 mr-1 ${set.warmup ? 'font-semibold text-amber-600 dark:text-amber-400' : ''}`}
                        title={set.warmup && rowIdx === 0 ? 'Warm-up: not counted in your stats' : undefined}>
                        {rowIdx === 0 ? (set.warmup ? 'W' : setNumber(ex.sets, setIdx)) : ''}
                      </span>
                      {side && <span className="font-semibold text-[10px] uppercase">{side === 'left' ? 'L' : 'R'}</span>}
                    </td>
                    {['reps', 'weight'].map(field => (
                      <td key={field} className="py-1 px-1">
                        <input
                          type="number" min={0}
                          className={cellInput}
                          value={values[field]}
                          onChange={e => updateSet(exIdx, setIdx, field, e.target.value, side || undefined)}
                        />
                      </td>
                    ))}
                    <td className="py-1 px-1 w-14">
                      {set.warmup ? <span className="block text-center text-xs text-gray-300 dark:text-gray-600">—</span> : (
                        <input type="number" min={0} max={10} placeholder={ex.targetRir || '–'} className={cellInput}
                          title={ex.targetRir ? `Target: ${ex.targetRir} reps in reserve` : undefined}
                          value={values.rir ?? ''} onChange={e => updateSet(exIdx, setIdx, 'rir', e.target.value, side || undefined)} />
                      )}
                    </td>
                    {rowIdx === 0 && (<>
                      {/* Live: measured by the rest timer. Already done: typed in. */}
                      <td rowSpan={rows.length} className="py-1 px-1 w-16 text-center text-xs text-gray-400 dark:text-gray-500 tabular-nums align-middle">
                        {mode === 'past'
                          ? <RestInput value={set.restTime} onChange={(secs) => updateSet(exIdx, setIdx, 'restTime', secs ?? '')} />
                          : (set.restTime != null && set.restTime !== '' ? fmtClock(Number(set.restTime)) : '—')}
                      </td>
                      <td rowSpan={rows.length} className="py-1 pl-1 align-middle">
                        <button onClick={() => removeSet(exIdx, setIdx)} className="text-gray-300 dark:text-gray-600 hover:text-red-400">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </>)}
                  </tr>
                ));
              })}
            </tbody>
          </table>

          <div className="flex gap-2">
            <button onClick={() => addSet(exIdx)} className="btn-secondary text-xs py-1">
              <Plus size={13} /> Add set
            </button>
            <button onClick={() => addWarmup(exIdx)} className="btn-secondary text-xs py-1" title="Optional lighter sets before your working sets. They aren't counted in your stats.">
              <Flame size={13} /> Add warm-up
            </button>
          </div>
          </>)}
        </SortableCard>
      ))}
      </SortableContext>
      </DndContext>

      <div className="flex gap-2">
        <button onClick={() => setTemplatePickerOpen(true)} className="btn-secondary flex-1 justify-center">
          <ClipboardList size={16} /> Use Template
        </button>
        <button onClick={() => setPickerOpen(true)} className="btn-secondary flex-1 justify-center">
          <Plus size={16} /> Add Exercise
        </button>
      </div>

      {exercises.length > 0 && mode === 'live' && (
        <button onClick={() => setSessionOpen(true)} className="btn-primary w-full justify-center py-3">
          <Play size={16} /> Start Session
        </button>
      )}

      {templatePickerOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 dark:bg-black/50 px-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl shadow-xl overflow-hidden max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800">
              <p className="font-semibold text-gray-900 dark:text-gray-100">Use Template</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Pick a day from one of your plans to pre-fill exercises and sets — you can still edit everything before saving.</p>
            </div>
            <div className="overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800">
              {plans.length === 0 && (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8 px-4">No workout plans yet. Create one in the Plans tab first.</p>
              )}
              {plans.map((plan) => (
                <div key={plan._id} className="p-4">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">{plan.name}</p>
                  {plan.days.length === 0 ? (
                    <p className="text-xs text-gray-400 dark:text-gray-500">No days configured.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {plan.days.map((day) => (
                        <button
                          key={day.dayOfWeek}
                          onClick={() => useTemplateDay(plan, day)}
                          disabled={templateLoading}
                          className="w-full text-left px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between disabled:opacity-50 disabled:cursor-wait"
                        >
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {plan.schedule === 'rotation' ? `Workout ${day.dayOfWeek + 1}` : DAYS[day.dayOfWeek]} {day.label ? `— ${day.label}` : ''}
                          </span>
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            {templateLoading ? 'Loading…' : `${day.exercises.length} exercise${day.exercises.length !== 1 ? 's' : ''}`}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-gray-100 dark:border-gray-800">
              <button onClick={() => setTemplatePickerOpen(false)} className="btn-secondary w-full justify-center">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 dark:bg-black/50 px-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800">
              <p className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Add Exercise</p>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input autoFocus className="input pl-9" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
            <ul className="overflow-y-auto max-h-72 divide-y divide-gray-50 dark:divide-gray-800">
              {filteredExercises.map(ex => (
                <li key={ex._id}>
                  <button onClick={() => addExercise(ex)} className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{ex.name}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 capitalize">{ex.muscleGroups?.join(', ')}</p>
                    </div>
                    {exercises.find(e => e.exercise._id === ex._id) && <Check size={16} className="text-brand-500" />}
                  </button>
                </li>
              ))}
            </ul>
            <div className="p-4 border-t border-gray-100 dark:border-gray-800">
              <button onClick={() => setPickerOpen(false)} className="btn-secondary w-full justify-center">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
        <textarea className="input resize-none" rows={3} placeholder="How did it feel?" value={notes} onChange={e => setNotes(e.target.value)} />
      </div>

      <button onClick={handleSave} disabled={saving} className="btn-primary w-full justify-center py-3 text-base">
        {saving ? 'Saving…' : <><Check size={16} /> Save Workout</>}
      </button>

      {sessionOpen && (
        <SessionPlayer
          exercises={exercises}
          allExercises={allExercises}
          name={name}
          volumeUnit={defaultUnit}
          onUpdateSet={updateSet}
          onChangeExercises={setExercises}
          onSetUnit={setUnit}
          onClose={() => setSessionOpen(false)}
          onFinish={(elapsedSeconds) => {
            setDuration(Math.max(1, Math.round(elapsedSeconds / 60)));
            setSessionOpen(false);
          }}
        />
      )}
    </div>
  );
}
