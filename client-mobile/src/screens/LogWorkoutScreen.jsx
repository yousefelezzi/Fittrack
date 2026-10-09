import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Modal, KeyboardAvoidingView, Platform, Alert, Vibration,
} from 'react-native';
import { exerciseAPI, workoutAPI, planAPI, userAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import {
  Card, Button, Spinner, colors, makeStyles, Sheet, Segmented, Chip, ChipRow, Stepper, Label, Hint, ErrorText, LinkText, ExerciseImage, ExercisePicker, SimilarExercises, confirm,
} from '../components';
import { setsFromLastWorkout } from '../../../client-web/src/utils/lastSets';
import { UNITS, fromKg } from '../../../client-web/src/utils/weightUnits';
import { typeOf, fieldsOf, amountKey, toSavedFields, TYPE_LABEL } from '../../../client-web/src/utils/exerciseTypes';
import {
  buildSessionReport, pickPreviousWorkout, loggingCalories, formatChange, changeTone, reportEntryText, amountSuffix, showsWeight,
} from '../../../client-web/src/utils/sessionReport';
import { formatRest } from '../../../client-web/src/utils/workoutCalories';
import {
  SIDES, isUnilateral, makeSet, setBasics, makeWarmup, warmupInsertIndex, withUnit, setNumber,
} from '../../../client-web/src/utils/logSets';
import { syncReminders } from '../utils/notifications';
import { X, Flame, SkipForward, PartyPopper, ArrowLeftRight, Clock, ChevronUp, ChevronDown, ClipboardList, Plus, Play, Check, ListOrdered, Square } from 'lucide-react-native';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// rir (reps in reserve) and restTime are optional. In a live session the rest
// timer measures restTime; when logging a past workout it's typed in.
// Unilateral exercises are logged per side, warm-ups are flagged, and each
// exercise has its own kg/lb unit: see client-web/src/utils/logSets.js.

// "1:30" → 90, "90" → 90, "" → null. Returns undefined when it can't be read.
const parseRest = (text) => {
  const t = String(text).trim();
  if (t === '') return null;
  const m = t.match(/^(\d+):([0-5]?\d)$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  if (/^\d+$/.test(t)) return Number(t);
  return undefined;
};
const fmtClock = (totalSeconds) => `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;

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
  return { before: list.slice(0, exIdx), kept: done.length ? [{ ...ex, sets: done }] : [], remaining, after: list.slice(exIdx + 1), ex };
};

// ── When (for workouts logged after the fact) ────────────────────────────────
const roundTo5 = (d) => { const x = new Date(d); x.setSeconds(0, 0); x.setMinutes(Math.floor(x.getMinutes() / 5) * 5); return x; };
const daysBefore = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };

/** Today / Yesterday / earlier (− +), then hour : minute and AM/PM. */
function WhenPicker({ value, onChange }) {
  const hours24 = value.getHours();
  const isPM = hours24 >= 12;
  const hour12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const daysAgo = Math.round((new Date(new Date().toDateString()) - new Date(value.toDateString())) / 86400000);

  const setDaysAgo = (n) => {
    const d = daysBefore(n);
    d.setHours(value.getHours(), value.getMinutes(), 0, 0);
    onChange(d);
  };
  const setTime = (h12, minute, pm) => {
    const d = new Date(value);
    d.setHours((h12 % 12) + (pm ? 12 : 0), minute, 0, 0);
    onChange(d);
  };

  return (
    <View style={{ gap: 10 }}>
      <ChipRow>
        <Chip label="Today" active={daysAgo === 0} onPress={() => setDaysAgo(0)} />
        <Chip label="Yesterday" active={daysAgo === 1} onPress={() => setDaysAgo(1)} />
        <Chip label={daysAgo > 1 ? value.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : 'Earlier…'}
          active={daysAgo > 1} onPress={() => setDaysAgo(Math.max(2, daysAgo))} />
      </ChipRow>
      {daysAgo > 1 && (
        <View style={styles.inlineRow}>
          <Text style={styles.small}>Days ago</Text>
          <Stepper value={daysAgo} min={2} max={365} onChange={setDaysAgo} />
        </View>
      )}
      <View style={styles.inlineRow}>
        <Stepper value={hour12} min={1} max={12} onChange={(h) => setTime(h, value.getMinutes(), isPM)} />
        <Text style={styles.small}>:</Text>
        <Stepper value={value.getMinutes() - (value.getMinutes() % 5)} min={0} max={55} step={5}
          format={(m) => String(m).padStart(2, '0')} onChange={(m) => setTime(hour12, m, isPM)} />
        <Segmented style={{ width: 96 }} options={[[false, 'AM'], [true, 'PM']]} value={isPM} onChange={(pm) => setTime(hour12, value.getMinutes(), pm)} />
      </View>
    </View>
  );
}

/** Number box used in the set table and the session player. */
function NumBox({ value, onChange, placeholder, big, width }) {
  return (
    <TextInput
      style={[big ? styles.bigBox : styles.cell, width && { width }]}
      keyboardType="decimal-pad"
      value={value === '' || value == null ? '' : String(value)}
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      onChangeText={onChange}
      selectTextOnFocus
    />
  );
}

/** Rest typed as m:ss (or seconds); commits on blur so typing "1:" isn't rejected. */
function RestInput({ value, onChange }) {
  const shown = value != null && value !== '' ? fmtClock(Number(value)) : '';
  const [text, setText] = useState(shown);
  const [bad, setBad] = useState(false);
  useEffect(() => { setText(shown); }, [shown]);
  const commit = () => {
    const secs = parseRest(text);
    if (secs === undefined || secs > 3600) { setBad(true); return; }
    setBad(false);
    onChange(secs);
  };
  return (
    <TextInput style={[styles.cell, { width: 56 }, bad && { borderColor: colors.danger }]} placeholder="m:ss" placeholderTextColor={colors.textMuted}
      keyboardType="numbers-and-punctuation" value={text} onChangeText={(t) => { setText(t); setBad(false); }} onBlur={commit} />
  );
}

/** kg | lb switch for one exercise (or the default for new ones). */
function UnitToggle({ value, onChange }) {
  return (
    <View style={styles.unitToggle}>
      {UNITS.map((u) => (
        <TouchableOpacity key={u} onPress={() => u !== value && onChange(u)} hitSlop={4}
          style={[styles.unitBtn, u === value && styles.unitBtnOn]}>
          <Text style={[styles.unitText, u === value && styles.unitTextOn]}>{u}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Session report ───────────────────────────────────────────────────────────
// Shown when a live session ends: sets, reps, volume and time, each with the
// change from the last session, and per exercise the change in reps and top weight.
const TONE = { up: 'success', down: 'danger', same: 'textMuted' }; // token names
function Change({ value, suffix = '' }) {
  const tone = changeTone(value);
  if (!tone) return null;
  return <Text style={[styles.change, { color: colors[TONE[tone]] }]}> {formatChange(value)}{suffix}</Text>;
}

function SessionReport({ exercises, seconds, name, volumeUnit, onDone }) {
  const [report, setReport] = useState(null);
  const { user } = useAuth(); // body weight, for the calories

  // The report is of the session as it ended, so it's built once.
  useEffect(() => {
    let alive = true;
    const ids = [...new Set(exercises.map((e) => String(e.exercise._id)))];
    Promise.all([
      workoutAPI.getAll({ limit: 20 }).then(({ data }) => data.workouts || []).catch(() => []),
      ...ids.map((id) => workoutAPI.lastSets(id).then(({ data }) => [id, data.sets]).catch(() => [id, []])),
    ]).then(([workouts, ...last]) => {
      if (!alive) return;
      const previous = pickPreviousWorkout(workouts, name, ids);
      setReport(buildSessionReport({ exercises, seconds, previous, lastSets: Object.fromEntries(last), kg: user?.weight }));
    });
    return () => { alive = false; };
  }, []);

  const t = report?.totals;
  const c = report?.change;
  const stats = t && [
    ['Sets', t.sets, c?.sets],
    ['Reps', t.reps, c?.reps],
    [`Volume (${volumeUnit})`, Math.round(fromKg(t.volume, volumeUnit)).toLocaleString(), c && Math.round(fromKg(c.volume, volumeUnit))],
    ['Time (min)', t.minutes, c?.minutes],
    ['Rest', t.restSeconds ? formatRest(t.restSeconds) : '–', c?.restMinutes, ' min'],
    [`Calories${t.estimatedWeight ? '*' : ''}`, `~${t.calories.toLocaleString()}`, c?.calories, ' kcal'],
  ];

  return (
    <ScrollView contentContainerStyle={styles.player}>
      <View style={{ alignItems: 'center' }}>
        <PartyPopper size={40} color={colors.brand} />
        <Text style={styles.playerTitle}>Workout complete!</Text>
        <Text style={[styles.small, { textAlign: 'center', marginTop: 4 }]}>
          {!report ? 'Comparing with your last session…'
            : report.previousDate ? `Compared with ${report.previousName}, ${new Date(report.previousDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
              : 'Your first session to compare against next time.'}
        </Text>
      </View>
      {!report ? <Spinner /> : (
        <>
          <View style={styles.statGrid}>
            {stats.map(([label, value, change, suffix]) => (
              <View key={label} style={styles.statBox}>
                <Text style={styles.statLabel}>{label}</Text>
                <Text style={styles.statValue}>{value}<Change value={change} suffix={suffix} /></Text>
              </View>
            ))}
          </View>
          <Text style={[styles.small, { marginTop: 6 }]}>
            Calories are an estimate from your session time, rest and body weight.{t.estimatedWeight ? ' * Using a typical weight: add yours to your profile.' : ''}
          </Text>
          {report.exercises.length > 0 && (
            <View style={{ marginTop: 16 }}>
              <Text style={styles.reportHead}>By set <Text style={styles.small}>· each set vs the same set last time</Text></Text>
              {report.exercises.map((e) => (
                <View key={e.name} style={styles.reportRow}>
                  <Text style={styles.exName}>{e.name}{e.isFirst ? <Text style={styles.small}>  first time</Text> : null}</Text>
                  {e.setRows.flatMap((row) => row.entries.map((en, k) => (
                    <View key={`${row.number}-${k}`} style={styles.setReportRow}>
                      <Text style={[styles.small, { width: 44 }]}>{k === 0 ? `Set ${row.number}` : ''}</Text>
                      {e.setRows.some((r) => r.entries.some((x) => x.side)) ? (
                        <Text style={[styles.small, { width: 14, fontWeight: '700' }]}>{en.side ? (en.side === 'left' ? 'L' : 'R') : ''}</Text>
                      ) : null}
                      <Text style={[styles.small, { flex: 1, color: colors.textPrimary }]}>{reportEntryText(e, en)}</Text>
                      {en.change ? (
                        <Text style={styles.small}>{showsWeight(e) ? <Change value={en.change.weight} suffix={e.unit} /> : null}  <Change value={en.change.amount} suffix={amountSuffix(e)} /></Text>
                      ) : !e.isFirst ? <Text style={[styles.small, { fontStyle: 'italic' }]}>new set</Text> : null}
                    </View>
                  )))}
                </View>
              ))}
            </View>
          )}
        </>
      )}
      <Button title="Back to Save Workout" onPress={onDone} style={{ marginTop: 20 }} />
    </ScrollView>
  );
}

// ── Isometric timers ─────────────────────────────────────────────────────────
// In a live session these replace "Complete Set" for isometric exercises:
//   yielding   — a stopwatch: start, hold, stop; the time held is recorded
//   overcoming — a guided interval timer: each burst counts down, then the rest
//                between bursts; the number of bursts done is recorded
// Unilateral exercises run once per side. Times come from timestamps, so they
// stay right if the app was in the background.
const buzz = () => Vibration.vibrate(150);

function IsometricTimer({ exercise, set, onRecord, onFinish }) {
  const type = typeOf(exercise);
  const sides = set.left ? SIDES : [null];
  const [sideIdx, setSideIdx] = useState(0);
  const [run, setRun] = useState(null); // { startedAt } (yielding) or { startedAt, burst, resting } (overcoming)
  const [, setTick] = useState(0);
  const side = sides[sideIdx];
  const values = side ? set[side] : set;

  useEffect(() => {
    if (!run) return undefined;
    const id = setInterval(() => setTick((t) => t + 1), 100);
    return () => clearInterval(id);
  }, [run]);

  const nextSideOrFinish = () => {
    setRun(null);
    if (sideIdx < sides.length - 1) setSideIdx(sideIdx + 1);
    else onFinish();
  };
  const elapsed = run ? (Date.now() - run.startedAt) / 1000 : 0;

  // Overcoming: move through bursts and rests as time passes.
  const bursts = Math.max(1, Number(values.bursts) || 1);
  const burstLen = Math.max(1, Number(values.burstSeconds) || 1);
  const restLen = Math.max(0, Number(values.burstRest) || 0);
  useEffect(() => {
    if (type !== 'overcoming' || !run) return;
    if (elapsed < (run.resting ? restLen : burstLen)) return;
    buzz();
    if (!run.resting && run.burst >= bursts) { onRecord(side, 'bursts', bursts); nextSideOrFinish(); return; }
    if (!run.resting && restLen > 0) setRun({ startedAt: Date.now(), burst: run.burst, resting: true });
    else setRun({ startedAt: Date.now(), burst: run.burst + 1, resting: false });
  });

  const sideLabel = side ? ` — ${side} side` : '';

  if (type === 'yielding') {
    const target = Number(values.seconds) || 0;
    const stop = () => { onRecord(side, 'seconds', Math.round(elapsed)); buzz(); nextSideOrFinish(); };
    return run ? (
      <View style={{ alignItems: 'center' }}>
        <Text style={styles.restLabel}>HOLDING{sideLabel.toUpperCase()}</Text>
        <Text style={[styles.timerClock, target && elapsed >= target && { color: colors.success }]}>{fmtClock(Math.floor(elapsed))}</Text>
        {target > 0 ? <Text style={styles.small}>Target {target}s</Text> : null}
        <Button icon={Square} title="Stop" variant="danger" onPress={stop} style={{ alignSelf: 'stretch', marginTop: 12 }} />
      </View>
    ) : (
      <Button icon={Play} title={`Start hold${sideLabel}`} onPress={() => { buzz(); setRun({ startedAt: Date.now() }); }} />
    );
  }

  // Overcoming. Stopping early counts the bursts started (the current one included).
  const done = () => { onRecord(side, 'bursts', run ? run.burst : 0); nextSideOrFinish(); };
  return run ? (
    <View style={{ alignItems: 'center' }}>
      <Text style={[styles.restLabel, !run.resting && { color: colors.warning }]}>
        {run.resting ? 'REST' : 'PUSH!'} · BURST {run.burst} OF {bursts}{sideLabel.toUpperCase()}
      </Text>
      <Text style={[styles.timerClock, { color: run.resting ? colors.textMuted : colors.warning }]}>
        {Math.max(0, Math.ceil((run.resting ? restLen : burstLen) - elapsed))}
      </Text>
      <Button icon={Square} title="Stop early" variant="secondary" onPress={done} style={{ alignSelf: 'stretch', marginTop: 12 }} />
    </View>
  ) : (
    <View style={{ gap: 6 }}>
      <Text style={[styles.small, { textAlign: 'center' }]}>{bursts} × {burstLen}s bursts, {restLen}s rest between</Text>
      <Button icon={Play} title={`Start bursts${sideLabel}`} onPress={() => { buzz(); setRun({ startedAt: Date.now(), burst: 1, resting: false }); }} />
    </View>
  );
}

// ── Session Player ────────────────────────────────────────────────────────────
// Walks through every exercise's sets one at a time. Between sets a rest timer
// counts up until the user ends it, and that time is saved as the rest after
// the set. Reps/weight stay editable in case the set didn't go as planned.
function SessionPlayer({ exercises, allExercises, name, volumeUnit, onUpdateSet, onChangeExercises, onSetUnit, onClose, onFinish }) {
  const steps = exercises.flatMap((ex, exIdx) => ex.sets.map((_, setIdx) => ({ exIdx, setIdx })));

  const [stepIdx, setStepIdx]   = useState(0);
  const [phase, setPhase]       = useState('active'); // 'active' | 'resting' | 'done'
  const [startedAt]             = useState(() => Date.now());
  const [restStartedAt, setRestStartedAt] = useState(null);
  const [lastRest, setLastRest] = useState(null);
  const [, setTick]             = useState(0);
  const [swapOpen, setSwapOpen] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [endedAt, setEndedAt]   = useState(null); // session seconds when it ended
  const [orderOpen, setOrderOpen] = useState(false);

  // Times come from timestamps, so they stay right even if the app was in the background.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, []);

  const secondsSince = (t) => Math.max(0, Math.floor((Date.now() - t) / 1000));
  const elapsed = secondsSince(startedAt);
  const restSeconds = restStartedAt ? secondsSince(restStartedAt) : 0;

  // Skipping warm-ups can remove the last steps. The session time stops here.
  if (phase === 'done' || stepIdx >= steps.length) {
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
  const isometric = typeOf(currentEx.exercise) !== 'dynamic';
  const canAddWarmup = !isometric && !isWarmup && currentEx.sets.slice(0, setIdx).every((st) => st.warmup);
  const warmupsLeft = currentEx.sets.slice(setIdx).filter((st) => st.warmup).length;

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
  const addWarmup = () => onChangeExercises((list) => list.map((ex, i) => (i !== exIdx ? ex
    : { ...ex, sets: [...ex.sets.slice(0, setIdx), makeWarmup(ex), ...ex.sets.slice(setIdx)] })));

  const completeSet = () => {
    if (stepIdx === steps.length - 1) { setEndedAt(elapsed); setPhase('done'); return; }
    setRestStartedAt(Date.now());
    setPhase('resting');
  };
  const recordRest = () => { onUpdateSet(exIdx, setIdx, 'restTime', restSeconds); return restSeconds; };
  const endRest = () => {
    setLastRest(recordRest());
    setRestStartedAt(null);
    setStepIdx((i) => i + 1);
    setPhase('active');
  };

  // Machine taken? Replace the rest of this exercise with another one.
  const swapExercise = async (picked) => {
    const newEx = allExercises.find((e) => e._id === picked._id) || picked;
    setSwapping(true);
    const lastWeight = await lastWeightFor(newEx._id);
    onChangeExercises((list) => {
      const { before, kept, remaining, after, ex } = splitAtSet(list, exIdx, setIdx);
      const replacement = {
        exercise: newEx,
        unit: ex.unit,
        sets: remaining.map((st) => makeSet(newEx, {
          reps: setBasics(st).reps,
          weight: st.warmup ? setBasics(st).weight : fromKg(lastWeight ?? 0, ex.unit),
          warmup: !!st.warmup,
        })),
      };
      return [...before, ...kept, replacement, ...after];
    });
    setSwapping(false);
    setSwapOpen(false);
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
  const close = () => { if (phase === 'resting') recordRest(); onClose(elapsed); };

  const fields = (values, side) => (
    <View style={styles.playerFields}>
      {side ? <Text style={styles.sideLabel}>{side}</Text> : null}
      {/* The fields depend on the exercise type (reps, seconds held or bursts). */}
      {fieldsOf(currentEx.exercise).filter((f) => !(f.effort && isWarmup)).map((f) => (
        <View key={f.key} style={{ alignItems: 'center' }}>
          <Text style={styles.fieldCap}>{f.weight ? unit : f.short || f.label}</Text>
          <NumBox big width={f.effort ? 60 : 78} value={values[f.key] ?? ''}
            placeholder={f.effort ? (f.key === 'rir' && currentEx.targetRir) || '–' : undefined}
            onChange={(v) => onUpdateSet(exIdx, setIdx, f.key, v, side || undefined)} />
        </View>
      ))}
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.player} keyboardShouldPersistTaps="handled">
      <View style={styles.playerTop}>
        <Text style={styles.small}>Exercise {exIdx + 1}/{exercises.length} · Session {fmtClock(elapsed)}</Text>
        <TouchableOpacity onPress={close} hitSlop={12}><X size={22} color={colors.textMuted} /></TouchableOpacity>
      </View>

      {phase === 'active' ? (
        <>
          {currentEx.exercise.images?.length > 0 && <ExerciseImage images={currentEx.exercise.images} both style={{ height: 130, marginBottom: 12 }} />}
          <Text style={styles.playerTitle}>{currentEx.exercise.name}</Text>
          <View style={styles.setLine}>
            {isWarmup ? (
              <View style={styles.row}>
                <Flame size={14} color={colors.warning} />
                <Text style={[styles.small, { color: colors.warning, fontWeight: '600' }]}>Warm-up {setIdx + 1} of {warmupCount}</Text>
              </View>
            ) : <Text style={styles.small}>Set {setNumber(currentEx.sets, setIdx)} of {workingCount}</Text>}
            {typeOf(currentEx.exercise) !== 'overcoming' && <UnitToggle value={unit} onChange={(u) => onSetUnit(exIdx, u)} />}
          </View>
          {lastRest != null && <Text style={[styles.small, { textAlign: 'center' }]}>Rested {fmtClock(lastRest)}</Text>}

          <View style={{ marginVertical: 20, gap: 12 }}>
            {currentSet.left ? SIDES.map((side) => <View key={side}>{fields(currentSet[side], side)}</View>) : fields(currentSet)}
          </View>

          {isometric ? (
            // A stopwatch (holds) or burst timer instead of "Complete Set".
            <>
              <IsometricTimer key={`${exIdx}-${setIdx}`} exercise={currentEx.exercise} set={currentSet}
                onRecord={(side, field, value) => onUpdateSet(exIdx, setIdx, field, value, side || undefined)}
                onFinish={completeSet} />
              <TouchableOpacity onPress={completeSet} style={styles.quietBtn} hitSlop={6}>
                <Text style={styles.quietText}>Log the numbers above without the timer</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Button title={stepIdx === steps.length - 1 ? 'Finish Workout' : isWarmup ? 'Complete Warm-up' : 'Complete Set'} onPress={completeSet} />
          )}
          {/* Warm-ups are optional: skip them, or add one before the first working set. */}
          {isWarmup ? (
            <TouchableOpacity onPress={skipWarmups} style={styles.quietBtn} hitSlop={6}>
              <SkipForward size={14} color={colors.textSecondary} />
              <Text style={styles.quietText}>Skip warm-up{warmupsLeft > 1 ? 's' : ''}</Text>
            </TouchableOpacity>
          ) : canAddWarmup ? (
            <TouchableOpacity onPress={addWarmup} style={styles.quietBtn} hitSlop={6}>
              <Flame size={14} color={colors.textSecondary} />
              <Text style={styles.quietText}>Add a warm-up set first</Text>
            </TouchableOpacity>
          ) : null}

          {swapOpen ? (
            <View style={{ marginTop: 16, gap: 8 }}>
              <Hint>Replace {currentEx.exercise.name} for the remaining {currentEx.sets.length - setIdx} set{currentEx.sets.length - setIdx !== 1 ? 's' : ''} with:</Hint>
              {swapping ? <Spinner size="small" /> : <SimilarExercises exerciseId={currentEx.exercise._id} onPick={swapExercise} onClose={() => setSwapOpen(false)} />}
              <LinkText onPress={() => setSwapOpen('all')}>…or search all exercises</LinkText>
            </View>
          ) : (
            <View style={styles.twoBtns}>
              <Button icon={ArrowLeftRight} title="Swap exercise" variant="secondary" onPress={() => setSwapOpen(true)} style={{ flex: 1 }} />
              <Button icon={Clock} title="Do it later" variant="secondary" onPress={doLater} disabled={!canDoLater} style={{ flex: 1 }} />
            </View>
          )}
          <ExercisePicker visible={swapOpen === 'all'} title="Swap to…" exercises={allExercises.filter((e) => e._id !== currentEx.exercise._id)}
            onPick={swapExercise} onClose={() => setSwapOpen(false)} />
        </>
      ) : (
        <View style={{ alignItems: 'center', marginTop: 40 }}>
          <Text style={styles.restLabel}>RESTING</Text>
          <Text style={styles.restClock}>{fmtClock(restSeconds)}</Text>
          {nextStep && (
            <Text style={styles.small}>
              Up next: {exercises[nextStep.exIdx].exercise.name} — {exercises[nextStep.exIdx].sets[nextStep.setIdx]?.warmup ? 'Warm-up' : `Set ${setNumber(exercises[nextStep.exIdx].sets, nextStep.setIdx)}`}
            </Text>
          )}
          <Button title="End rest — start next set" onPress={endRest} style={{ alignSelf: 'stretch', marginTop: 28 }} />
        </View>
      )}

      {exercises.length - firstMovable > 1 && (
        <View style={styles.orderBox}>
          <TouchableOpacity onPress={() => setOrderOpen(!orderOpen)} style={styles.quietBtn} hitSlop={6}>
            <ListOrdered size={14} color={colors.textSecondary} />
            <Text style={styles.quietText}>{orderOpen ? 'Done reordering' : 'Change exercise order'}</Text>
          </TouchableOpacity>
          {orderOpen && exercises.map((ex, i) => (i < firstMovable ? null : (
            <View key={`${ex.exercise._id}-${i}`} style={[styles.orderRow, i === exIdx && phase === 'active' && { backgroundColor: colors.brandLight }]}>
              <Text style={[styles.small, { width: 20 }]}>{i + 1}</Text>
              <Text style={[styles.small, { flex: 1, color: colors.textPrimary }]} numberOfLines={1}>{ex.exercise.name}</Text>
              <Text style={styles.small}>{ex.sets.length} set{ex.sets.length !== 1 ? 's' : ''}</Text>
              <TouchableOpacity onPress={() => moveExercise(i, -1)} disabled={i === firstMovable} hitSlop={6} style={i === firstMovable && { opacity: 0.25 }}>
                <ChevronUp size={20} color={colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => moveExercise(i, 1)} disabled={i === exercises.length - 1} hitSlop={6} style={i === exercises.length - 1 && { opacity: 0.25 }}>
                <ChevronDown size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          )))}
        </View>
      )}
    </ScrollView>
  );
}

export default function LogWorkoutScreen({ navigation, route }) {
  const { user, updateUser } = useAuth();
  // Unit new exercises start in; each exercise can be switched on its own.
  const defaultUnit = user?.weightUnit === 'lb' ? 'lb' : 'kg';
  const [name, setName] = useState(`Workout ${new Date().toLocaleDateString()}`);
  // 'live': follow along with the session player (rest is timed).
  // 'past': log a workout that's already done, typing in the date and rests.
  const [mode, setMode] = useState('live');
  const [doneAt, setDoneAt] = useState(() => roundTo5(new Date()));
  const [replacing, setReplacing] = useState(null);

  const [exercises, setExercises] = useState([]);
  const [duration, setDuration] = useState('45');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [allExercises, setAllExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [plans, setPlans] = useState([]);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);

  useEffect(() => {
    Promise.all([exerciseAPI.getAll(), planAPI.getAll()])
      .then(([e, p]) => { setAllExercises(e.data); setPlans(p.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Opened from Plans with a day to load.
  useEffect(() => {
    const t = route?.params?.template;
    if (t) { loadTemplateDay(t.plan, t.day, true); navigation.setParams({ template: undefined }); }
  }, [route?.params?.template]);

  // Starts with what was logged last time on this exercise (same sets, reps and
  // weight). It's added straight away and filled in when that arrives, unless
  // its sets were edited in the meantime.
  const addExercise = (ex) => {
    setPickerOpen(false);
    if (exercises.find((e) => e.exercise._id === ex._id)) return;
    const placeholder = [makeSet(ex)];
    setExercises((prev) => [...prev, { exercise: ex, unit: defaultUnit, sets: placeholder }]);
    workoutAPI.lastSets(ex._id)
      .then(({ data }) => {
        // In the unit used last time, unless the unit was changed in the meantime.
        setExercises((prev) => prev.map((e) => {
          if (e.sets !== placeholder) return e;
          const unit = e.unit !== defaultUnit ? e.unit : (data.weightUnit || e.unit);
          const sets = setsFromLastWorkout(ex, data.sets, unit);
          return sets.length ? { ...e, unit, sets, lastDate: data.date } : e;
        }));
      })
      .catch(() => {});
  };
  const removeExercise = (idx) => setExercises((prev) => prev.filter((_, i) => i !== idx));
  const move = (idx, dir) => setExercises((prev) => {
    const to = idx + dir;
    if (to < 0 || to >= prev.length) return prev;
    const next = [...prev];
    [next[idx], next[to]] = [next[to], next[idx]];
    return next;
  });

  // Load a plan day as a starting point: sets start at the plan's targets and
  // the last weight lifted on each exercise, and everything stays editable.
  const loadTemplateDay = async (plan, day, skipConfirm) => {
    if (!skipConfirm && exercises.length > 0 && !(await confirm('Replace exercises?', "This will replace the exercises you've already added.", 'Replace'))) return;
    const valid = day.exercises.filter((e) => e.exercise);
    setTemplateLoading(true);
    try {
      const lastWeights = await Promise.all(valid.map((e) => lastWeightFor(e.exercise._id)));
      setExercises(valid.map((e, i) => {
        const unit = e.weightUnit || defaultUnit; // the plan's unit for this exercise
        return {
          exercise: e.exercise,
          unit,
          targetRir: e.targetRir || '',
          sets: Array.from({ length: e.targetSets || 1 }, () => makeSet(e.exercise, {
            // A plan's "reps" target is seconds held or bursts for isometric exercises.
            [amountKey(e.exercise)]: e.targetReps ?? undefined,
            weight: lastWeights[i] != null ? fromKg(lastWeights[i], unit) : Number(e.targetWeight) || 0,
          })),
        };
      }));
      setName(`${plan.name} — ${day.label || (plan.schedule === 'rotation' ? `Workout ${day.dayOfWeek + 1}` : DAYS[day.dayOfWeek])}`);
      setTemplateOpen(false);
    } finally {
      setTemplateLoading(false);
    }
  };

  // A new working set copies the last working set's reps and weight.
  const addSet = (exIdx) => setExercises((prev) => prev.map((e, i) => {
    if (i !== exIdx) return e;
    const last = [...e.sets].reverse().find((st) => !st.warmup);
    return { ...e, sets: [...e.sets, makeSet(e.exercise, last ? setBasics(last) : {})] };
  }));
  // Warm-ups go before the working sets.
  const addWarmup = (exIdx) => setExercises((prev) => prev.map((e, i) => {
    if (i !== exIdx) return e;
    const at = warmupInsertIndex(e.sets);
    return { ...e, sets: [...e.sets.slice(0, at), makeWarmup(e), ...e.sets.slice(at)] };
  }));
  // Switch one exercise between kg and lb; typed weights convert (same load).
  // The last unit picked is remembered: new exercises start in it.
  const setUnit = (exIdx, unit) => {
    setExercises((prev) => prev.map((e, i) => (i !== exIdx ? e : withUnit(e, unit))));
    if (unit !== defaultUnit) {
      updateUser({ weightUnit: unit });
      userAPI.updateMe({ weightUnit: unit }).catch(() => {});
    }
  };
  const removeSet = (exIdx, setIdx) => setExercises((prev) => prev.map((e, i) => (i !== exIdx || e.sets.length === 1 ? e : { ...e, sets: e.sets.filter((_, si) => si !== setIdx) })));

  // Swap an exercise for a similar one, keeping its sets.
  const replaceExercise = async (exIdx, picked) => {
    setReplacing(null);
    const full = allExercises.find((e) => e._id === picked._id) || picked;
    const lastWeight = await lastWeightFor(full._id);
    setExercises((prev) => prev.map((e, i) => (i !== exIdx ? e : {
      ...e, exercise: full,
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

  // `side` ('left'/'right') targets one side of a unilateral set. Values stay as
  // typed (so "2." can be typed) and are converted on save.
  const updateSet = (exIdx, setIdx, field, value, side) => setExercises((prev) => prev.map((ex, ei) => (ei !== exIdx ? ex : {
    ...ex,
    sets: ex.sets.map((s, si) => {
      if (si !== setIdx) return s;
      const v = value == null ? '' : value;
      return side ? { ...s, [side]: { ...s[side], [field]: v } } : { ...s, [field]: v };
    }),
  })));

  // One entry per performed set; unilateral sets become a left and a right entry.
  // A set counts if its reps / seconds / bursts are above 0.
  const flattenSets = (ex) => ex.sets.flatMap((s) => {
    const key = amountKey(ex.exercise);
    if (!s.left) return Number(s[key]) > 0 ? [s] : [];
    const sides = SIDES.filter((side) => Number(s[side][key]) > 0).map((side) => ({ ...s[side], side, warmup: s.warmup }));
    if (sides.length) sides[sides.length - 1].restTime = s.restTime;
    return sides;
  });

  const handleSave = async () => {
    if (exercises.length === 0) { setError('Add at least one exercise.'); return; }
    const cleaned = exercises.map((e) => ({ ...e, sets: flattenSets(e) })).filter((e) => e.sets.length > 0);
    if (cleaned.length === 0) { setError('Every set is empty — enter the reps, seconds or bursts you did before saving.'); return; }

    for (const ex of cleaned) {
      let setNo = 0;
      for (const set of ex.sets) {
        if (set.side !== 'right' && !set.warmup) setNo++;
        const where = `${ex.exercise.name}, ${set.warmup ? 'warm-up' : `set ${setNo}`}${set.side ? ` (${set.side})` : ''}`;
        for (const f of fieldsOf(ex.exercise)) {
          const v = set[f.key];
          if (f.effort) {
            if (!set.warmup && v !== '' && v != null && !(Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= f.max)) {
              setError(`${where}: ${f.label} must be a whole number from 0 to ${f.max}.`); return;
            }
          } else if (f.weight) {
            if (!Number.isFinite(Number(v)) || Number(v) < 0) { setError(`${where}: weight can't be negative.`); return; }
          } else if (v !== '' && v != null && !(Number.isInteger(Number(v)) && Number(v) >= 0)) {
            setError(`${where}: ${f.label.toLowerCase()} must be a whole number.`); return;
          }
        }
      }
    }
    if (mode === 'past' && doneAt > new Date()) { setError("The workout can't be in the future. Pick an earlier time."); return; }

    setError('');
    setSaving(true);
    try {
      await workoutAPI.create({
        name,
        ...(mode === 'past' && { date: doneAt.toISOString() }),
        duration: Number(duration) || 0,
        notes,
        exercises: cleaned.map((e) => ({
          exercise: e.exercise._id,
          weightUnit: e.unit || 'kg',
          sets: e.sets.map((s) => ({
            ...(s.side && { side: s.side }),
            ...(s.warmup && { warmup: true }),
            // reps/weight/RIR, or seconds/weight/SIR, or bursts (weights stored in kg). Warm-ups have no RIR.
            ...toSavedFields(e.exercise, s.warmup ? { ...s, rir: '' } : s, e.unit),
            ...(s.restTime !== '' && s.restTime != null && Number.isFinite(Number(s.restTime)) ? { restTime: Math.round(Number(s.restTime)) } : {}),
          })),
        })),
      });
      syncReminders(); // no workout reminder later today
      setExercises([]);
      setNotes('');
      setName(`Workout ${new Date().toLocaleDateString()}`);
      // A workout logged afterwards gets its calorie estimate here (a live one saw it in the report).
      const burned = mode === 'past' ? `About ${loggingCalories(exercises, (Number(duration) || 0) * 60, user?.weight).toLocaleString()} kcal burned (estimate).` : '';
      Alert.alert('Workout saved!', burned, [{ text: 'OK', onPress: () => navigation.popTo('Tabs', { screen: 'Dashboard' }) }]);
    } catch (err) {
      const data = err.response?.data;
      const details = data?.errors?.map((e) => e.message).filter(Boolean);
      setError(details?.length ? `${data.message}: ${[...new Set(details)].join('; ')}` : data?.message || 'Failed to save workout');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View style={styles.centered}><Spinner /></View>;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ErrorText>{error}</ErrorText>

        <Segmented value={mode} onChange={setMode} style={{ marginBottom: 12 }}
          options={[['live', 'Live session', 'Timed rests as you train'], ['past', 'Already done', 'Type in rests and the date']]} />

        <Card>
          <Label style={{ marginTop: 0 }}>Workout name</Label>
          <TextInput style={styles.field} value={name} onChangeText={setName} />
          {mode === 'past' && (
            <>
              <Label>When</Label>
              <WhenPicker value={doneAt} onChange={setDoneAt} />
              {doneAt > new Date() && <Text style={[styles.small, { color: colors.danger, marginTop: 4 }]}>That's in the future.</Text>}
            </>
          )}
          <Label>Duration (min)</Label>
          <TextInput style={styles.field} value={duration} onChangeText={setDuration} keyboardType="number-pad" />
        </Card>

        {exercises.map((ex, exIdx) => (
          <Card key={`${ex.exercise._id}-${exIdx}`}>
            <View style={styles.exHeader}>
              <ExerciseImage images={ex.exercise.images} style={{ width: 48, height: 36 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.exName}>{ex.exercise.name}</Text>
                <Text style={styles.exMeta} numberOfLines={2}>
                  {ex.exercise.muscleGroups?.join(', ')}{isUnilateral(ex.exercise) ? ' · each side' : ''}
                  {typeOf(ex.exercise) !== 'dynamic' ? ` · ${TYPE_LABEL[typeOf(ex.exercise)].toLowerCase()}` : ''}
                  {ex.lastDate ? ` · last time ${new Date(ex.lastDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}
                </Text>
              </View>
              {exercises.length > 1 && (
                <View>
                  <TouchableOpacity onPress={() => move(exIdx, -1)} disabled={exIdx === 0} hitSlop={6} style={exIdx === 0 && { opacity: 0.25 }}><ChevronUp size={18} color={colors.textMuted} /></TouchableOpacity>
                  <TouchableOpacity onPress={() => move(exIdx, 1)} disabled={exIdx === exercises.length - 1} hitSlop={6} style={exIdx === exercises.length - 1 && { opacity: 0.25 }}><ChevronDown size={18} color={colors.textMuted} /></TouchableOpacity>
                </View>
              )}
              <TouchableOpacity onPress={() => setReplacing(replacing === exIdx ? null : exIdx)} hitSlop={6} style={styles.icon}>
                <ArrowLeftRight size={18} color={replacing === exIdx ? colors.brand : colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => removeExercise(exIdx)} hitSlop={6} style={styles.icon}><X size={18} color={colors.danger} /></TouchableOpacity>
            </View>
            {replacing === exIdx && (
              <SimilarExercises exerciseId={ex.exercise._id} onPick={(p) => replaceExercise(exIdx, p)} onClose={() => setReplacing(null)} />
            )}

            <View style={styles.setHead}>
              <Text style={[styles.headCell, { width: 34 }]}>Set</Text>
              {/* Columns follow the exercise type; kg/lb sits right above the weights. */}
              {fieldsOf(ex.exercise).map((f) => (f.weight ? (
                <View key={f.key} style={{ flex: 1, alignItems: 'center' }}><UnitToggle value={ex.unit || 'kg'} onChange={(u) => setUnit(exIdx, u)} /></View>
              ) : (
                <Text key={f.key} style={f.effort ? [styles.headCell, { width: 46 }] : styles.headCellFlex}>{f.short || f.label}</Text>
              )))}
              <Text style={[styles.headCell, { width: 56 }]}>Rest</Text>
              <View style={{ width: 22 }} />
            </View>
            {ex.sets.map((set, setIdx) => {
              const rows = set.left ? SIDES.map((side) => ({ side, values: set[side] })) : [{ side: null, values: set }];
              return (
                <View key={setIdx} style={styles.setBlock}>
                  <View style={{ flex: 1, gap: 4 }}>
                    {rows.map(({ side, values }) => (
                      <View key={side || 'both'} style={styles.setRow}>
                        {/* Set number, then the side in its own column so R lines up under L. */}
                        <View style={styles.setNoCell}>
                          <Text style={[styles.setNo, set.warmup && styles.warmupNo]}>{side === 'right' ? '' : setNumber(ex.sets, setIdx)}</Text>
                          {side ? <Text style={styles.sideTag}>{side === 'left' ? 'L' : 'R'}</Text> : null}
                        </View>
                        {fieldsOf(ex.exercise).map((f) => (f.effort ? (set.warmup
                          ? <Text key={f.key} style={[styles.small, { width: 46, textAlign: 'center' }]}>—</Text>
                          : <NumBox key={f.key} width={46} value={values[f.key] ?? ''} placeholder={(f.key === 'rir' && ex.targetRir) || '–'}
                            onChange={(v) => updateSet(exIdx, setIdx, f.key, v, side || undefined)} />
                        ) : (
                          <View key={f.key} style={{ flex: 1 }}>
                            <NumBox value={values[f.key] ?? ''} onChange={(v) => updateSet(exIdx, setIdx, f.key, v, side || undefined)} />
                          </View>
                        )))}
                      </View>
                    ))}
                  </View>
                  {mode === 'past'
                    ? <RestInput value={set.restTime} onChange={(secs) => updateSet(exIdx, setIdx, 'restTime', secs ?? '')} />
                    : <Text style={[styles.small, { width: 56, textAlign: 'center' }]}>{set.restTime != null && set.restTime !== '' ? fmtClock(Number(set.restTime)) : '—'}</Text>}
                  <TouchableOpacity onPress={() => removeSet(exIdx, setIdx)} style={{ width: 22, alignItems: 'center' }} hitSlop={6}>
                    <X size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              );
            })}
            <View style={[styles.row, { gap: 18, marginTop: 8 }]}>
              <LinkText onPress={() => addSet(exIdx)}>+ Add set</LinkText>
              {typeOf(ex.exercise) === 'dynamic' ? (
                <TouchableOpacity onPress={() => addWarmup(exIdx)} style={styles.row} hitSlop={8}>
                  <Flame size={14} color={colors.warning} />
                  <Text style={styles.warmupLink}>Add warm-up</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {ex.sets.some((st) => st.warmup) ? <Hint style={{ marginTop: 4 }}>W = warm-up. Not counted in your stats.</Hint> : null}
          </Card>
        ))}

        <View style={styles.twoBtns}>
          <Button icon={ClipboardList} title="Use Template" variant="secondary" onPress={() => setTemplateOpen(true)} style={{ flex: 1 }} />
          <Button icon={Plus} title="Add Exercise" variant="secondary" onPress={() => setPickerOpen(true)} style={{ flex: 1 }} />
        </View>

        {exercises.length > 0 && mode === 'live' && (
          <Button icon={Play} title="Start Session" onPress={() => setSessionOpen(true)} style={{ marginTop: 12 }} />
        )}

        <Card style={{ marginTop: 12 }}>
          <Label style={{ marginTop: 0 }}>Notes</Label>
          <TextInput style={[styles.field, { height: 70, textAlignVertical: 'top' }]} placeholder="How did it feel?" placeholderTextColor={colors.textMuted}
            value={notes} onChangeText={setNotes} multiline />
        </Card>

        <Button icon={Check} title="Save Workout" onPress={handleSave} loading={saving} style={{ marginBottom: 32 }} />
      </ScrollView>

      <ExercisePicker visible={pickerOpen} exercises={allExercises} selectedIds={exercises.map((e) => e.exercise._id)}
        onPick={addExercise} onClose={() => setPickerOpen(false)} />

      <Sheet visible={templateOpen} title="Use Template" onClose={() => setTemplateOpen(false)}
        subtitle="Pick a day from one of your plans to pre-fill exercises and sets. You can still edit everything before saving.">
        {plans.length === 0 && <Text style={styles.empty}>No workout plans yet. Create one in Plans first.</Text>}
        {plans.map((plan) => (
          <View key={plan._id} style={{ marginBottom: 14 }}>
            <Text style={styles.exName}>{plan.name}</Text>
            {plan.days.length === 0 ? <Hint>No days configured.</Hint> : plan.days.map((day) => (
              <TouchableOpacity key={day.dayOfWeek} style={styles.templateRow} disabled={templateLoading} onPress={() => loadTemplateDay(plan, day)}>
                <Text style={styles.small}>
                  {plan.schedule === 'rotation' ? `Workout ${day.dayOfWeek + 1}` : DAYS[day.dayOfWeek]}{day.label ? ` — ${day.label}` : ''}
                </Text>
                <Text style={styles.small}>{templateLoading ? 'Loading…' : `${day.exercises.length} exercise${day.exercises.length !== 1 ? 's' : ''}`}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </Sheet>

      <Modal visible={sessionOpen} animationType="slide" onRequestClose={() => setSessionOpen(false)}>
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
            onFinish={(secs) => { setDuration(String(Math.max(1, Math.round(secs / 60)))); setSessionOpen(false); }}
          />
        )}
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = makeStyles(() => ({
  root:        { flex: 1, backgroundColor: colors.bg },
  content:     { padding: 16 },
  centered:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  small:       { fontSize: 12, color: colors.textSecondary },
  field:       { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.textPrimary },
  inlineRow:   { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  exHeader:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  exName:      { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  exMeta:      { fontSize: 12, color: colors.textMuted, textTransform: 'capitalize', marginTop: 1 },
  icon:        { paddingHorizontal: 4 },
  row:         { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  statBox:     { width: '48%', flexGrow: 1, backgroundColor: colors.inset, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  statLabel:   { fontSize: 11, color: colors.textMuted },
  statValue:   { fontSize: 22, fontWeight: '700', color: colors.textPrimary, marginTop: 2 },
  change:      { fontSize: 13, fontWeight: '700' },
  reportHead:  { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginBottom: 4 },
  reportRow:   { paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.subtle, gap: 2 },
  setReportRow:{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 1 },
  unitToggle:  { flexDirection: 'row', backgroundColor: colors.subtle, borderRadius: 8, padding: 2 },
  unitBtn:     { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6 },
  unitBtnOn:   { backgroundColor: colors.surface, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  unitText:    { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  unitTextOn:  { color: colors.textPrimary },
  warmupNo:    { color: colors.warning, fontWeight: '700' },
  warmupLink:  { fontSize: 14, fontWeight: '600', color: colors.warning },
  setLine:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 4 },
  orderBox:    { marginTop: 20, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.subtle, gap: 6 },
  orderRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.inset, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  quietBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, paddingVertical: 6 },
  quietText:   { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  setHead:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, marginBottom: 4 },
  headCell:    { fontSize: 10, color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase', textAlign: 'center' },
  headCellFlex:{ flex: 1, fontSize: 10, color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase', textAlign: 'center' },
  setBlock:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, borderTopWidth: 1, borderTopColor: colors.subtle },
  setRow:      { flexDirection: 'row', alignItems: 'center', gap: 6 },
  setNoCell:   { width: 34, flexDirection: 'row', alignItems: 'center' },
  setNo:       { width: 18, fontSize: 12, color: colors.textMuted },
  sideTag:     { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  cell:        { height: 36, borderWidth: 1, borderColor: colors.border, borderRadius: 8, textAlign: 'center', fontSize: 14, color: colors.textPrimary, backgroundColor: colors.surface },
  bigBox:      { height: 50, borderWidth: 1, borderColor: colors.border, borderRadius: 10, textAlign: 'center', fontSize: 20, fontWeight: '600', color: colors.textPrimary },
  twoBtns:     { flexDirection: 'row', gap: 10, marginTop: 12 },
  templateRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.inset, borderRadius: 10, padding: 12, marginTop: 6 },
  empty:       { textAlign: 'center', color: colors.textMuted, paddingVertical: 20 },
  player:      { padding: 20, paddingTop: 60, flexGrow: 1, backgroundColor: colors.bg },
  playerCenter:{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.bg },
  playerTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  playerTitle: { fontSize: 22, fontWeight: '700', color: colors.textPrimary, textAlign: 'center', marginTop: 8 },
  playerFields:{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 10 },
  sideLabel:   { width: 44, fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', paddingBottom: 16 },
  fieldCap:    { fontSize: 11, color: colors.textSecondary, marginBottom: 4 },
  restLabel:   { fontSize: 12, fontWeight: '700', color: colors.textMuted, letterSpacing: 1 },
  timerClock:  { fontSize: 56, fontWeight: '700', color: colors.brand, marginVertical: 8, fontVariant: ['tabular-nums'] },
  restClock:   { fontSize: 64, fontWeight: '700', color: colors.brand, marginVertical: 12, fontVariant: ['tabular-nums'] },
}));
