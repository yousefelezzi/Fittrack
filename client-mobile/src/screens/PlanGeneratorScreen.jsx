import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { Text } from '../components/AppText';
import { planAPI } from '../api';
import {
  Card, Button, colors, makeStyles, Chip, ChipRow, Segmented, Stepper, Label, Hint, ErrorText, SimilarExercises,
} from '../components';
import { SPLIT_OPTIONS, EQUIPMENT_OPTIONS as EQUIPMENT, PRIORITY_OPTIONS, unitLabel } from '../../../client-web/src/utils/planAnalysis';
import StimulusTable from '../components/StimulusTable';
import ManualPlanBuilder from '../components/ManualPlanBuilder';
import { Sparkles, ArrowLeftRight, RefreshCw } from 'lucide-react-native';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const LEVEL_HINT = {
  beginner: 'Full-body days of 6–7 compound lifts with more sets each. Muscles only isolation work reaches (e.g. biceps, calves, abs) are left out unless you prioritise them.',
  intermediate: 'A balance of compound lifts and isolation work.',
  advanced: 'More exercises with fewer sets each, with extra isolation work.',
};

/**
 * Generates a low-volume, high-frequency plan on the server, shows a preview
 * with the weekly net stimulus per muscle group, and saves it as a plan.
 */
export default function PlanGeneratorScreen({ navigation }) {
  const [mode, setMode]             = useState('generate'); // 'generate' | 'manual'
  const [days, setDays]             = useState(4);
  const [split, setSplit]           = useState('ul');
  const [preferCustom, setPreferCustom] = useState(true);
  const [variation, setVariation]   = useState('ab');
  const [level, setLevel]           = useState('intermediate');
  const [exclude, setExclude]       = useState([]);
  const [maxSets, setMaxSets]       = useState(16);
  const [maxExercises, setMaxExercises] = useState(6);
  const [equipment, setEquipment]   = useState(EQUIPMENT.map(([k]) => k));
  const [priorities, setPriorities] = useState([]);
  const [result, setResult]         = useState(null);
  const [busy, setBusy]             = useState(false);
  const [error, setError]           = useState('');
  const [swapping, setSwapping]     = useState(null); // { label, exerciseId }

  const toggle = (list, setList, v) => setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  // `change` applies a suggested fix (e.g. { variation: 'repeat' }) and regenerates.
  const generate = async (change = {}) => {
    if (change.variation) setVariation(change.variation);
    if (change.maxSets) setMaxSets(change.maxSets);
    if (change.maxExercises) setMaxExercises(change.maxExercises);
    if (change.daysPerWeek) { setDays(change.daysPerWeek); setSplit(SPLIT_OPTIONS[change.daysPerWeek][0][0]); }
    if (change.priorities) setPriorities(change.priorities);
    setBusy(true);
    setError('');
    try {
      const { data } = await planAPI.generate({
        daysPerWeek: days, split, variation, level, exclude, maxSets, maxExercises, equipment, priorities, preferCustom,
        ...change,
        ...(change.daysPerWeek && { split: SPLIT_OPTIONS[change.daysPerWeek][0][0] }),
      });
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not generate a plan');
    } finally {
      setBusy(false);
    }
  };

  // Replace an exercise in every day of that session, then re-check WNS and recovery.
  const replaceExercise = async (label, oldId, ex) => {
    const plan = {
      ...result.plan,
      days: result.plan.days.map((d) => (d.label !== label ? d : {
        ...d, exercises: d.exercises.map((e) => (String(e.exercise._id) === String(oldId) ? { ...e, exercise: ex } : e)),
      })),
    };
    setResult((r) => ({ ...r, plan }));
    setSwapping(null);
    try {
      const { data } = await planAPI.analyze({
        days: plan.days.map((d) => ({ dayOfWeek: d.dayOfWeek, exercises: d.exercises.map((e) => ({ exercise: e.exercise._id, targetSets: e.targetSets, targetReps: e.targetReps, targetRir: e.targetRir })) })),
        schedule: plan.schedule, rotation: plan.rotation, priorities, level,
      });
      setResult((r) => ({ ...r, analysis: { ...r.analysis, units: data.units } }));
    } catch {
      // keep the old numbers if the check fails; the swap itself still stands
    }
  };

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const { plan } = result;
      const { data } = await planAPI.create({
        name: plan.name,
        description: plan.description,
        days: plan.days.map((d) => ({ ...d, exercises: d.exercises.map((e) => ({ ...e, exercise: e.exercise._id })) })),
        schedule: plan.schedule || 'weekly',
        ...(plan.rotation && { rotation: plan.rotation }),
      });
      navigation.popTo('Plans', { savedPlan: data });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save the plan');
    } finally {
      setBusy(false);
    }
  };

  const modeSwitch = (
    <Segmented value={mode} onChange={setMode} style={{ marginBottom: 14 }}
      options={[['generate', 'Generate for me', 'Picks exercises and sets'], ['manual', 'Build my own', 'Stimulus updates live']]} />
  );

  // ── Build my own ───────────────────────────────────────────────────────────
  if (mode === 'manual') {
    return (
      <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: 40 }]} keyboardShouldPersistTaps="handled">
        {modeSwitch}
        <ManualPlanBuilder onSaved={(plan) => navigation.popTo('Plans', { savedPlan: plan })} />
      </ScrollView>
    );
  }

  // ── Options ────────────────────────────────────────────────────────────────
  if (!result) {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        {modeSwitch}
        <Hint>
          Builds a low-volume, high-frequency plan. It picks compound exercises that overlap several muscles, then adds sets where
          they raise weekly net stimulus the most. Schoenfeld dose-response, 3 maintenance sets, 48 h stimulus.
        </Hint>

        <Label>Experience</Label>
        <Segmented value={level} onChange={setLevel} options={[['beginner', 'Beginner'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']]} />
        <Hint style={{ marginTop: 4 }}>{LEVEL_HINT[level]}</Hint>

        <Label>Days per week</Label>
        <ChipRow>
          {[2, 3, 4, 5, 6].map((n) => <Chip key={n} label={String(n)} active={days === n} onPress={() => { setDays(n); setSplit(SPLIT_OPTIONS[n][0][0]); }} />)}
        </ChipRow>

        <Label>Split</Label>
        <ChipRow>
          {SPLIT_OPTIONS[days].map(([k, l]) => <Chip key={k} label={l} active={split === k} onPress={() => setSplit(k)} style={{ maxWidth: '100%' }} />)}
        </ChipRow>
        <Hint style={{ marginTop: 4 }}>Days are spaced so each muscle gets about 48–72 h between sessions.</Hint>

        {days !== 5 && (
          <>
            <Label>Repeated sessions</Label>
            <Segmented value={variation} onChange={setVariation} options={[['ab', 'A/B days', 'alternate exercises'], ['repeat', 'Same workout', 'every time']]} />
          </>
        )}

        <Label>Per session, at most</Label>
        <View style={styles.limits}>
          <View style={styles.limitBox}><Text style={styles.small}>Working sets</Text><Stepper value={maxSets} min={4} max={40} onChange={setMaxSets} /></View>
          <View style={styles.limitBox}><Text style={styles.small}>Exercises</Text><Stepper value={maxExercises} min={2} max={12} onChange={setMaxExercises} /></View>
        </View>
        <Hint style={{ marginTop: 4 }}>Warm-up sets don't count. The plan may use fewer if recovery limits are reached first.</Hint>

        <Label>Equipment you have</Label>
        <ChipRow>
          {EQUIPMENT.map(([k, l]) => <Chip key={k} label={l} active={equipment.includes(k)} onPress={() => toggle(equipment, setEquipment, k)} />)}
        </ChipRow>

        <Label>Priorities · optional</Label>
        <Hint style={{ marginBottom: 8 }}>Prioritised muscles get a higher target and a slightly higher volume ceiling per session.</Hint>
        <ChipRow>
          {PRIORITY_OPTIONS.filter((m) => !exclude.includes(m)).map((m) => (
            <Chip key={m} label={m} active={priorities.includes(m)} onPress={() => toggle(priorities, setPriorities, m)} />
          ))}
        </ChipRow>

        <Label>Leave out · optional</Label>
        <Hint style={{ marginBottom: 8 }}>No exercises mainly for these muscles. Compound lifts may still work them a little.</Hint>
        <ChipRow>
          {PRIORITY_OPTIONS.map((m) => (
            <Chip key={m} label={m} tone="danger" active={exclude.includes(m)}
              onPress={() => { toggle(exclude, setExclude, m); setPriorities((p) => p.filter((x) => x !== m)); }} />
          ))}
        </ChipRow>

        <View style={[styles.limitBox, { marginTop: 16 }]}>
          <Text style={styles.small}>Prefer my custom exercises</Text>
          <Switch value={preferCustom} onValueChange={setPreferCustom} trackColor={{ true: colors.brand }} />
        </View>

        <ErrorText>{error}</ErrorText>
        <Button icon={Sparkles} title={busy ? 'Generating…' : 'Generate'} onPress={() => generate()} loading={busy} disabled={equipment.length === 0} style={{ marginTop: 16, marginBottom: 32 }} />
      </ScrollView>
    );
  }

  // ── Preview ────────────────────────────────────────────────────────────────
  const templates = [];
  for (const d of result.plan.days) {
    const t = templates.find((x) => x.label === d.label);
    if (t) t.days.push(d.dayOfWeek); else templates.push({ label: d.label, days: [d.dayOfWeek], exercises: d.exercises });
  }
  const required = result.analysis.units.filter((u) => u.required);
  const low = required.filter((u) => u.wns < u.target);
  const losing = required.filter((u) => u.wns < 0);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.planName}>{result.plan.name}</Text>
      <Hint style={{ marginBottom: 12 }}>{result.plan.description}</Hint>

      {result.plan.schedule === 'rotation' && (
        <Card style={{ backgroundColor: colors.inset }}>
          <Text style={styles.small}>
            Rotation: {templates.map((t) => t.label).join(' → ')}, then repeat —{' '}
            {result.plan.rotation?.everyDays
              ? `one workout every ${result.plan.rotation.everyDays === 2 ? 'other day' : `${result.plan.rotation.everyDays} days`}`
              : `on ${result.plan.rotation?.weekdays?.map((d) => DAY_NAMES[d]).join(', ')}`}.
            {' '}A muscle trained in only one of them still gets it about 1.5–1.75× a week.
          </Text>
        </Card>
      )}

      {templates.map((t) => (
        <Card key={t.label}>
          <View style={styles.row}>
            <Text style={styles.cardTitle}>{t.label}</Text>
            <Text style={[styles.small, { flexShrink: 1, textAlign: 'right' }]}>
              {result.plan.schedule === 'rotation' ? `Workout ${t.days[0] + 1}` : t.days.map((d) => DAY_NAMES[d]).join(', ')} · {result.analysis.setsByLabel?.[t.label]} sets · ~{result.analysis.minutesByLabel[t.label]} min
            </Text>
          </View>
          {t.exercises.map((e) => {
            const isSwapping = swapping?.label === t.label && swapping?.exerciseId === e.exercise._id;
            return (
              <View key={e.exercise._id} style={styles.exRow}>
                <View style={styles.row}>
                  <Text style={styles.exName} numberOfLines={2}>
                    {e.exercise.name}
                    {e.exercise.laterality === 'unilateral' ? <Text style={styles.tag}>  each side</Text> : null}
                    {e.exercise.isCustom ? <Text style={styles.tag}>  custom</Text> : null}
                  </Text>
                  <Text style={styles.small}>
                    {e.targetSets} × {e.targetReps}{e.targetRepsMax ? `–${e.targetRepsMax}` : ''}
                    {e.targetRir && e.targetRir !== '1–2' ? <Text style={{ color: colors.warning }}> {e.targetRir} RIR</Text> : null}
                  </Text>
                  <TouchableOpacity hitSlop={8} onPress={() => setSwapping(isSwapping ? null : { label: t.label, exerciseId: e.exercise._id })}>
                    <View style={styles.swap}><ArrowLeftRight size={17} color={isSwapping ? colors.brand : colors.textMuted} /></View>
                  </TouchableOpacity>
                </View>
                {isSwapping && (
                  <View style={{ marginTop: 6 }}>
                    <SimilarExercises exerciseId={e.exercise._id} equipment={equipment}
                      onPick={(ex) => replaceExercise(t.label, e.exercise._id, ex)} onClose={() => setSwapping(null)} />
                  </View>
                )}
              </View>
            );
          })}
        </Card>
      ))}

      <Card>
        <Text style={styles.cardTitle}>Weekly net stimulus & recovery</Text>
        <Hint style={{ marginBottom: 8 }}>
          Recovery demand is kept at low/medium for every muscle, and up to high for priority muscles. Sets are programmed at
          1–2 reps in reserve; a priority muscle with low recovery demand can go to 0–2 (shown in amber). Tap a muscle to see its regions.
        </Hint>

        {losing.length > 0 && (
          <View style={styles.alert}>
            <Text style={[styles.small, { color: colors.danger }]}>
              {losing.length} muscle{losing.length !== 1 ? 's' : ''} would still lose ground (negative WNS): {losing.map((u) => unitLabel(u.unit)).join(', ')}.
              There isn't enough time or frequency to reach them without going over recovery limits elsewhere.
            </Text>
            {result.analysis.suggestions?.length > 0 && (
              <ChipRow style={{ marginTop: 8, gap: 6 }}>
                <Text style={[styles.small, { color: colors.danger }]}>Try:</Text>
                {result.analysis.suggestions.map((sug) => (
                  <Chip key={sug.label} small disabled={busy} onPress={() => generate(sug.change)}
                    label={`${sug.label}${sug.losing === 0 ? ' — fixes it' : ` — ${sug.losing} left`}`} style={{ borderColor: colors.dangerBorder }} />
                ))}
              </ChipRow>
            )}
          </View>
        )}
        {low.length > 0 ? (
          <Text style={[styles.small, { color: colors.warning, marginBottom: 8 }]}>
            {low.length} muscle{low.length !== 1 ? 's are' : ' is'} under target. Usually the recovery limit of muscles trained alongside them
            is holding them back. More days, a priority, or isolation exercises (including your own) help.
          </Text>
        ) : (
          <Text style={[styles.small, { color: colors.success, marginBottom: 8 }]}>Every muscle reaches its target.</Text>
        )}
        {result.analysis.skippedForLevel?.length > 0 && (
          <Hint style={{ marginBottom: 6 }}>Not trained directly at beginner level: {result.analysis.skippedForLevel.map(unitLabel).join(', ')}. Add them as a priority to include them.</Hint>
        )}
        {result.analysis.unreachable.length > 0 && (
          <Hint style={{ marginBottom: 6 }}>No exercise for {result.analysis.unreachable.map(unitLabel).join(', ')} with this equipment.</Hint>
        )}

        <StimulusTable units={required} />
      </Card>

      <ErrorText>{error}</ErrorText>
      <View style={[styles.row, { gap: 10, marginBottom: 32 }]}>
        <Button icon={RefreshCw} title="Change options" variant="secondary" onPress={() => setResult(null)} style={{ flex: 1 }} />
        <Button title="Save plan" onPress={save} loading={busy} style={{ flex: 1 }} />
      </View>
    </ScrollView>
  );
}

const styles = makeStyles(() => ({
  root:      { flex: 1, backgroundColor: colors.bg },
  content:   { padding: 16 },
  row:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  small:     { fontSize: 12, color: colors.textSecondary },
  planName:  { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 },
  limits:    { gap: 8 },
  limitBox:  { flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: colors.border },
  exRow:     { paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.subtle },
  exName:    { flex: 1, fontSize: 14, color: colors.textPrimary },
  tag:       { fontSize: 11, color: colors.brand },
  swap:      { paddingLeft: 6 },
  alert:     { backgroundColor: colors.dangerLight, borderRadius: 10, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: colors.dangerBorder },
}));
