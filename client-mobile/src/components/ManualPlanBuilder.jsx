import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text, TextInput } from './AppText';
import { exerciseAPI, planAPI } from '../api';
import { colors, makeStyles, cardSurface } from './tokens';
import { Chip, ChipRow, Stepper, Label, Hint, ErrorText, LinkText, Segmented } from './ui';
import ExercisePicker from './ExercisePicker';
import SimilarExercises from './SimilarExercises';
import StimulusTable from './StimulusTable';
import {
  SPLIT_OPTIONS, PRIORITY_OPTIONS, MANUAL_DEFAULTS, unitLabel,
  sessionsForSkeleton, sessionTotals, sessionDays, describeSchedule, manualPlanDays, analysisRequest, manualPlanProblem,
} from '../../../client-web/src/utils/planAnalysis';
import { ArrowLeftRight, X } from 'lucide-react-native';

function Btn({ title, onPress, disabled, style }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.75} style={[styles.btn, disabled && { opacity: 0.5 }, style]}>
      <Text style={styles.btnText}>{title}</Text>
    </TouchableOpacity>
  );
}

/**
 * Build your own plan with the generator's structure: days per week, split and
 * A/B sessions give the sessions and their days (POST /plans/skeleton); you
 * fill each session within the per-session limits. The weekly net stimulus per
 * muscle is re-checked on the server (/plans/analyze) as you edit.
 * Same logic as the web's ManualPlanBuilder (shared helpers in planAnalysis.js).
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
  const [picking, setPicking] = useState(null); // index of the session choosing an exercise
  const [replacingWith, setReplacingWith] = useState(null); // { i, idx } picking any exercise as a replacement
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
  const addExercise = (i, ex) => {
    updateSession(i, (s) => {
      if (inSession(s, ex._id)) return s;
      const room = maxSets - sessionTotals(s).sets;
      if (room <= 0 || s.exercises.length >= maxExercises) return s;
      return { ...s, exercises: [...s.exercises, { exercise: ex, sets: Math.min(MANUAL_DEFAULTS.sets, room), reps: MANUAL_DEFAULTS.reps, repsMax: MANUAL_DEFAULTS.repsMax, rir: MANUAL_DEFAULTS.rir }] };
    });
    setPicking(null);
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

  const pickingSession = picking != null ? sessions[picking] : null;

  return (
    <View>
      <Hint>
        Pick a split like the generator does, then choose the exercises, sets, reps and RIR for each session yourself. The
        weekly net stimulus for each muscle updates as you go, using the same model as the generator. Sets taken closer to
        failure (lower RIR) count more.
      </Hint>

      <Label>Days per week</Label>
      <ChipRow>
        {[2, 3, 4, 5, 6].map((n) => <Chip key={n} label={String(n)} active={days === n} onPress={() => { setDays(n); setSplit(SPLIT_OPTIONS[n][0][0]); }} />)}
      </ChipRow>

      <Label>Split</Label>
      <ChipRow>
        {SPLIT_OPTIONS[days].map(([k, l]) => <Chip key={k} label={l} active={split === k} onPress={() => setSplit(k)} />)}
      </ChipRow>
      <Hint style={{ marginTop: 4 }}>Days are spaced so each muscle gets about 48–72 h between sessions.</Hint>

      {days !== 5 && (
        <>
          <Label>Repeated sessions</Label>
          <Segmented value={variation} onChange={setVariation} options={[['ab', 'A/B days', 'alternate exercises'], ['repeat', 'Same workout', 'every time']]} />
        </>
      )}

      {skeleton && <Text style={styles.schedule}>{describeSchedule(skeleton)}</Text>}

      <Label>Per session, at most</Label>
      <View style={{ gap: 8 }}>
        <View style={styles.limitBox}><Text style={styles.small}>Working sets</Text><Stepper value={maxSets} min={4} max={40} onChange={setMaxSets} /></View>
        <View style={styles.limitBox}><Text style={styles.small}>Exercises</Text><Stepper value={maxExercises} min={2} max={12} onChange={setMaxExercises} /></View>
      </View>

      <Label>Experience · sets each muscle's target</Label>
      <ChipRow>
        {[['beginner', 'Beginner'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']].map(([k, l]) => (
          <Chip key={k} label={l} active={level === k} onPress={() => setLevel(k)} />
        ))}
      </ChipRow>

      <Label>Priorities · optional, raises their target</Label>
      <ChipRow style={{ gap: 6 }}>
        {PRIORITY_OPTIONS.map((m) => (
          <Chip key={m} small label={m} active={priorities.includes(m)}
            onPress={() => setPriorities((p) => (p.includes(m) ? p.filter((x) => x !== m) : [...p, m]))} />
        ))}
      </ChipRow>

      <Label>Plan name</Label>
      <TextInput style={styles.field} value={name} onChangeText={(v) => { setName(v); setNameEdited(true); }} maxLength={80} />

      {skeleton && sessions.map((s, i) => {
        const t = sessionTotals(s);
        const roomSets = maxSets - t.sets;
        const full = t.exercises >= maxExercises || roomSets <= 0;
        const over = t.sets > maxSets || t.exercises > maxExercises;
        return (
          <View key={s.label} style={styles.session}>
            <View style={styles.sessionHead}>
              <Text style={styles.title}>{s.label}</Text>
              <Text style={[styles.small, { flexShrink: 1, textAlign: 'right' }]}>{sessionDays(skeleton, i)}</Text>
            </View>
            <Text style={[styles.totals, over ? { color: colors.danger } : full ? { color: colors.warning } : null]}>
              {t.sets} / {maxSets} working sets · {t.exercises} / {maxExercises} exercises
            </Text>

            {s.exercises.map((e, idx) => (
              <View key={`${e.exercise._id}-${idx}`} style={styles.exRow}>
                <View style={styles.row}>
                  <Text style={styles.exName} numberOfLines={2}>
                    {e.exercise.name}{e.exercise.laterality === 'unilateral' ? <Text style={styles.tag}>  each side</Text> : null}
                  </Text>
                  <TouchableOpacity hitSlop={8} onPress={() => setSwapping(swapping === `${i}-${idx}` ? null : `${i}-${idx}`)}>
                    <ArrowLeftRight size={17} color={swapping === `${i}-${idx}` ? colors.brand : colors.textMuted} />
                  </TouchableOpacity>
                  <TouchableOpacity hitSlop={8} onPress={() => updateSession(i, (x) => ({ ...x, exercises: x.exercises.filter((_, k) => k !== idx) }))}>
                    <X size={17} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
                {swapping === `${i}-${idx}` && (
                  <View style={{ marginTop: 8 }}>
                    <SimilarExercises exerciseId={e.exercise._id} excludeIds={s.exercises.map((x) => x.exercise._id)} onPick={(picked) => replaceExercise(i, idx, picked)} onClose={() => setSwapping(null)} />
                    <LinkText style={{ marginTop: 6 }} onPress={() => setReplacingWith({ i, idx })}>…or pick any exercise</LinkText>
                  </View>
                )}
                <View style={[styles.row, { marginTop: 6, flexWrap: 'wrap' }]}>
                  <Stepper value={e.sets} min={1} max={e.sets + Math.max(0, roomSets)} format={(v) => `${v} set${v !== 1 ? 's' : ''}`}
                    onChange={(v) => updateExercise(i, idx, { sets: v })} />
                  <View style={styles.reps}>
                    <TextInput style={styles.repBox} keyboardType="number-pad" value={String(e.reps)} onChangeText={(v) => updateExercise(i, idx, { reps: v })} />
                    <Text style={styles.small}>–</Text>
                    <TextInput style={styles.repBox} keyboardType="number-pad" value={String(e.repsMax)} onChangeText={(v) => updateExercise(i, idx, { repsMax: v })} />
                    <Text style={styles.small}>reps</Text>
                  </View>
                  <View style={styles.reps}>
                    <Text style={styles.small}>RIR</Text>
                    <TextInput style={styles.repBox} keyboardType="decimal-pad" value={String(e.rir)} onChangeText={(v) => updateExercise(i, idx, { rir: v })} />
                  </View>
                </View>
              </View>
            ))}

            {full
              ? <Hint style={{ marginTop: 8 }}>{t.exercises >= maxExercises ? 'Exercise limit reached' : 'Set limit reached'} for this session. Raise the limit above to add more.</Hint>
              : <LinkText style={{ marginTop: 10 }} onPress={() => setPicking(i)}>+ Add exercise</LinkText>}
          </View>
        );
      })}

      <View style={styles.stimHead}>
        <Text style={styles.title}>Weekly net stimulus & recovery</Text>
        {analyzing && <ActivityIndicator size="small" color={colors.textMuted} />}
      </View>
      {!units ? (
        <Hint>Add exercises to see the stimulus each muscle gets.</Hint>
      ) : (
        <View>
          {losing.length > 0 && (
            <Text style={[styles.small, { color: colors.danger, marginBottom: 6 }]}>
              {losing.length} muscle{losing.length !== 1 ? 's' : ''} would lose ground (negative WNS): {losing.map((u) => unitLabel(u.unit)).join(', ')}.
            </Text>
          )}
          {low.length > 0 && (
            <Text style={[styles.small, { color: colors.warning, marginBottom: 6 }]}>
              {low.length} muscle{low.length !== 1 ? 's are' : ' is'} under target: {low.map((u) => unitLabel(u.unit)).join(', ')}.
            </Text>
          )}
          {losing.length === 0 && low.length === 0 && <Text style={[styles.small, { color: colors.success, marginBottom: 6 }]}>Every muscle reaches its target.</Text>}
          <Hint style={{ marginBottom: 6 }}>Tap a muscle to see its regions. Recovery above medium means the sets may be hard to recover from.</Hint>
          <StimulusTable units={required} />
        </View>
      )}

      <ErrorText>{error}</ErrorText>
      <Btn title={saving ? 'Saving…' : 'Save plan'} disabled={saving || !skeleton} onPress={save} style={{ marginTop: 16 }} />
      {problem ? <Hint style={{ textAlign: 'center', marginTop: 6 }}>{problem}</Hint> : null}

      <ExercisePicker visible={!!replacingWith} title="Replace with…" muscleFilter
        exercises={replacingWith ? library.filter((x) => x._id !== sessions[replacingWith.i]?.exercises[replacingWith.idx]?.exercise._id) : []}
        disabledIds={replacingWith ? sessions[replacingWith.i]?.exercises.map((e) => e.exercise._id) || [] : []}
        onPick={(ex) => { replaceExercise(replacingWith.i, replacingWith.idx, ex); setReplacingWith(null); }}
        onClose={() => setReplacingWith(null)} />
      <ExercisePicker visible={picking != null} muscleFilter title={`Add to ${pickingSession?.label || 'session'}`} exercises={library}
        disabledIds={pickingSession?.exercises.map((e) => e.exercise._id) || []}
        onPick={(ex) => addExercise(picking, ex)} onClose={() => setPicking(null)} />
    </View>
  );
}

const styles = makeStyles(() => ({
  field:       { minHeight: 42, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, fontSize: 14, color: colors.textPrimary, backgroundColor: colors.surface },
  small:       { fontSize: 12, color: colors.textSecondary },
  title:       { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  schedule:    { fontSize: 12, color: colors.textSecondary, backgroundColor: colors.subtle, borderRadius: 10, padding: 10, marginTop: 14, lineHeight: 17 },
  row:         { flexDirection: 'row', alignItems: 'center', gap: 10 },
  limitBox:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: colors.border },
  session:     { backgroundColor: colors.surface, borderRadius: 14, padding: 12, marginTop: 14, borderWidth: 1, borderColor: colors.border, ...cardSurface() },
  sessionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  totals:      { fontSize: 12, color: colors.textMuted, marginTop: 6 },
  exRow:       { paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.subtle, marginTop: 8 },
  exName:      { flex: 1, fontSize: 14, color: colors.textPrimary },
  tag:         { fontSize: 11, color: colors.brand },
  icon:        { fontSize: 16, color: colors.textMuted },
  reps:        { flexDirection: 'row', alignItems: 'center', gap: 4 },
  repBox:      { width: 40, minHeight: 32, borderWidth: 1, borderColor: colors.border, borderRadius: 8, textAlign: 'center', fontSize: 13, color: colors.textPrimary },
  stimHead:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, marginBottom: 6 },
  btn:         { minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.brand },
  btnText:     { color: '#fff', fontSize: 14, fontWeight: '600', textAlign: 'center' },
}));
