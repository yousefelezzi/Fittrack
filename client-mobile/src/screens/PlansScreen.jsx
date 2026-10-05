import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, RefreshControl } from 'react-native';
import { planAPI, exerciseAPI } from '../api';
import {
  Card, Button, Spinner, Badge, colors, makeStyles, Sheet, Chip, ChipRow, Label, Hint, ErrorText, LinkText, EmptyState, ExercisePicker, SimilarExercises, confirm,
} from '../components';
import { formatPlanWeight } from '../../../client-web/src/utils/planAnalysis';
import { ArrowLeftRight, X, Sparkles, ClipboardList } from 'lucide-react-native';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dayName = (plan, day) => (plan.schedule === 'rotation' ? `Workout ${day.dayOfWeek + 1}` : DAYS[day.dayOfWeek]);

function PlanCard({ plan, onActivate, onDelete, onStart, onEdit }) {
  const [open, setOpen] = useState(false);
  return (
    <Card style={plan.isActive && { borderWidth: 2, borderColor: colors.brand }}>
      <TouchableOpacity onPress={() => setOpen(!open)} activeOpacity={0.7}>
        <View style={styles.row}>
          <Text style={styles.planName}>{plan.name}</Text>
          {plan.isActive && <Badge label="Active" />}
          <Text style={styles.chev}>{open ? '▴' : '▾'}</Text>
        </View>
        {plan.description ? <Text style={styles.desc} numberOfLines={open ? undefined : 2}>{plan.description}</Text> : null}
        <Hint style={{ marginTop: 4 }}>{plan.days.length} day{plan.days.length !== 1 ? 's' : ''} configured</Hint>
      </TouchableOpacity>

      {open && (
        <View style={styles.openBody}>
          {plan.schedule === 'rotation' && (
            <Hint style={{ marginBottom: 8 }}>
              Rotation — {plan.rotation?.everyDays
                ? (plan.rotation.everyDays === 2 ? 'every other day' : `every ${plan.rotation.everyDays} days`)
                : `on ${(plan.rotation?.weekdays || []).map((d) => DAYS[d]).join(', ')}`}: do the workouts in order, then repeat.
            </Hint>
          )}
          {plan.days.length === 0 && <Text style={styles.empty}>No days configured yet.</Text>}
          {plan.days.map((day) => (
            <View key={day.dayOfWeek} style={styles.dayBox}>
              <Text style={styles.dayTitle}>{dayName(plan, day)}{day.label ? ` — ${day.label}` : ''}</Text>
              {day.exercises.map((e, i) => (
                <View key={i} style={styles.exLine}>
                  <Text style={styles.exLineName} numberOfLines={1}>{e.exercise?.name ?? 'Unknown'}</Text>
                  <Text style={styles.exLineMeta}>
                    {e.targetSets}×{e.targetReps}{e.targetRepsMax ? `–${e.targetRepsMax}` : ''}{e.targetWeight ? ` @ ${formatPlanWeight(e)}` : ''}{e.targetRir ? ` · ${e.targetRir} RIR` : ''}
                  </Text>
                </View>
              ))}
              {day.exercises.length > 0 && <LinkText onPress={() => onStart(plan, day)} style={{ marginTop: 6 }}>▶ Start this workout</LinkText>}
            </View>
          ))}
          <View style={styles.actions}>
            {!plan.isActive && <Button title="Set Active" variant="secondary" onPress={() => onActivate(plan._id)} style={styles.actionBtn} />}
            <Button title="Edit" variant="secondary" onPress={() => onEdit(plan)} style={styles.actionBtn} />
            <Button title="Delete" variant="danger" onPress={() => onDelete(plan._id)} style={styles.actionBtn} />
          </View>
        </View>
      )}
    </Card>
  );
}

// Widths shared by the label row and the boxes so they line up.
const NUM_W = 46;
const UNIT_W = 54;
const WEIGHT_W = 128;

const emptyDay = () => ({ dayOfWeek: 1, label: '', exercises: [] });
const emptyExercise = (weightUnit = 'kg') => ({ exercise: '', targetSets: 3, targetReps: 10, targetWeight: 0, targetRepsMax: '', weightUnit });

/** Create or edit a plan: days, each with exercises and targets. */
function PlanEditor({ visible, initial, editingId, exercises, onClose, onSaved }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [picking, setPicking] = useState(null); // { di, ei } choosing an exercise
  const [similarFor, setSimilarFor] = useState(null); // "di-ei"

  useEffect(() => { if (visible) { setForm(initial); setError(''); } }, [visible, initial]);

  const byId = (id) => exercises.find((e) => e._id === id);
  const addDay = () => setForm((f) => ({ ...f, days: [...f.days, emptyDay()] }));
  const removeDay = (i) => setForm((f) => ({ ...f, days: f.days.filter((_, di) => di !== i) }));
  const updateDay = (i, field, val) => setForm((f) => ({ ...f, days: f.days.map((d, di) => (di !== i ? d : { ...d, [field]: val })) }));
  // A new exercise starts in the same unit as the one above it.
  const addEx = (di) => setForm((f) => ({ ...f, days: f.days.map((d, i) => (i !== di ? d : { ...d, exercises: [...d.exercises, emptyExercise(d.exercises.at(-1)?.weightUnit)] })) }));
  const removeEx = (di, ei) => setForm((f) => ({ ...f, days: f.days.map((d, i) => (i !== di ? d : { ...d, exercises: d.exercises.filter((_, j) => j !== ei) })) }));
  // An exercise can only be in a day once, so picking one that's already there is ignored.
  const othersInDay = (day, ei) => (day?.exercises || []).filter((_, j) => j !== ei).map((e) => e.exercise).filter(Boolean);
  const updateEx = (di, ei, field, val) => setForm((f) => (field === 'exercise' && val && othersInDay(f.days[di], ei).includes(val) ? f : {
    ...f,
    days: f.days.map((d, i) => (i !== di ? d : {
      ...d,
      exercises: d.exercises.map((e, j) => (j !== ei ? e : { ...e, [field]: field === 'exercise' || field === 'weightUnit' || val === '' ? val : Number(val) })),
    })),
  }));

  const save = async () => {
    if (!form.name.trim()) { setError('Plan name is required'); return; }
    if (form.days.some((d) => d.exercises.some((e) => !e.exercise))) { setError('Pick an exercise for every row, or remove the empty ones.'); return; }
    setError('');
    setSaving(true);
    // In a rotation, a workout's position is its order. Blank numbers fall back to defaults.
    const days = form.days.map((d, i) => ({
      ...d,
      ...(form.schedule === 'rotation' && { dayOfWeek: i }),
      exercises: d.exercises.map((e) => ({
        ...e,
        targetSets: Number(e.targetSets) || 1,
        targetReps: Number(e.targetReps) || 1,
        targetWeight: Number(e.targetWeight) || 0,
        targetRepsMax: e.targetRepsMax === '' ? undefined : Number(e.targetRepsMax),
      })),
    }));
    try {
      const { data } = editingId ? await planAPI.update(editingId, { ...form, days }) : await planAPI.create({ ...form, days });
      onSaved(data, !!editingId);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || `Failed to ${editingId ? 'save' : 'create'} plan`);
    } finally {
      setSaving(false);
    }
  };

  const num = (di, ei, field, label, width = NUM_W) => (
    <View style={{ alignItems: 'center' }}>
      <TextInput accessibilityLabel={label} style={[styles.numBox, { width }]} keyboardType="number-pad" placeholder="–" placeholderTextColor={colors.textMuted}
        value={form.days[di].exercises[ei][field] === '' || form.days[di].exercises[ei][field] == null ? '' : String(form.days[di].exercises[ei][field])}
        onChangeText={(v) => updateEx(di, ei, field, v.replace(/[^0-9.]/g, ''))} />
    </View>
  );

  return (
    <Sheet visible={visible} title={editingId ? 'Edit Plan' : 'New Plan'} onClose={onClose}
      footer={<View style={{ flexDirection: 'row', gap: 10 }}>
        <Button title="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
        <Button title={editingId ? 'Save Changes' : 'Create Plan'} onPress={save} loading={saving} style={{ flex: 1 }} />
      </View>}>
      <ErrorText>{error}</ErrorText>
      <Label style={{ marginTop: 0 }}>Name</Label>
      <TextInput style={styles.field} placeholder="e.g. Push/Pull/Legs" placeholderTextColor={colors.textMuted}
        value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
      <Label>Description (optional)</Label>
      <TextInput style={styles.field} placeholder="Brief description" placeholderTextColor={colors.textMuted}
        value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} />

      <View style={[styles.row, { marginTop: 16, marginBottom: 6 }]}>
        <Text style={[styles.planName, { fontSize: 14 }]}>Days</Text>
        <LinkText onPress={addDay}>+ Add day</LinkText>
      </View>
      {form.days.map((day, di) => (
        <View key={di} style={styles.dayBox}>
          <View style={styles.row}>
            <Text style={styles.dayTitle}>{form.schedule === 'rotation' ? `Workout ${di + 1}` : 'Day'}</Text>
            <LinkText danger onPress={() => removeDay(di)}>Remove day</LinkText>
          </View>
          {form.schedule !== 'rotation' && (
            <ChipRow style={{ marginBottom: 8, gap: 6 }}>
              {DAYS.map((d, i) => <Chip key={d} small label={d} active={day.dayOfWeek === i} onPress={() => updateDay(di, 'dayOfWeek', i)} />)}
            </ChipRow>
          )}
          <TextInput style={[styles.field, { marginBottom: 8 }]} placeholder="Label (e.g. Push)" placeholderTextColor={colors.textMuted}
            value={day.label} onChangeText={(v) => updateDay(di, 'label', v)} />
          {/* One row of labels per day, lined up with each exercise's boxes. */}
          {day.exercises.length > 0 && (
            <View style={styles.capRow}>
              <Text style={[styles.cap, { width: NUM_W }]}>Sets</Text>
              <Text style={[styles.cap, { width: WEIGHT_W }]}>Weight</Text>
              <Text style={[styles.cap, { width: NUM_W }]}>Reps</Text>
            </View>
          )}
          {day.exercises.map((ex, ei) => (
            <View key={ei} style={styles.exEdit}>
              <View style={styles.row}>
                <TouchableOpacity style={styles.exPick} onPress={() => setPicking({ di, ei })}>
                  <Text style={[styles.exLineName, !ex.exercise && { color: colors.textMuted }]} numberOfLines={1}>
                    {byId(ex.exercise)?.name || 'Choose exercise…'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity disabled={!ex.exercise} onPress={() => setSimilarFor(similarFor === `${di}-${ei}` ? null : `${di}-${ei}`)} hitSlop={6}>
                  <View style={[styles.icon, !ex.exercise && { opacity: 0.3 }]}><ArrowLeftRight size={17} color={colors.textMuted} /></View>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removeEx(di, ei)} hitSlop={6} style={styles.icon}><X size={17} color={colors.danger} /></TouchableOpacity>
              </View>
              <View style={[styles.row, { justifyContent: 'flex-start', gap: 8, marginTop: 6 }]}>
                {num(di, ei, 'targetSets', 'Sets')}
                <View style={[styles.row, { width: WEIGHT_W, gap: 4 }]}>
                  {num(di, ei, 'targetWeight', 'Weight', WEIGHT_W - UNIT_W - 4)}
                  {/* Each exercise's weight can be in kg or lb. */}
                  <View style={styles.unitToggle}>
                    {['kg', 'lb'].map((u) => (
                      <TouchableOpacity key={u} onPress={() => updateEx(di, ei, 'weightUnit', u)}
                        style={[styles.unitBtn, (ex.weightUnit || 'kg') === u && styles.unitBtnActive]}>
                        <Text style={[styles.unitText, (ex.weightUnit || 'kg') === u && { color: '#fff' }]}>{u}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                {num(di, ei, 'targetReps', 'Reps')}
              </View>
              {similarFor === `${di}-${ei}` && ex.exercise ? (
                <View style={{ marginTop: 8 }}>
                  <SimilarExercises exerciseId={ex.exercise} excludeIds={othersInDay(day, ei)} onPick={(p) => { updateEx(di, ei, 'exercise', p._id); setSimilarFor(null); }} onClose={() => setSimilarFor(null)} />
                </View>
              ) : null}
            </View>
          ))}
          <LinkText onPress={() => addEx(di)} style={{ marginTop: 6 }}>+ Add exercise</LinkText>
        </View>
      ))}
      <ExercisePicker visible={!!picking} title="Choose exercise" exercises={exercises}
        selectedIds={picking ? [form.days[picking.di]?.exercises[picking.ei]?.exercise] : []}
        disabledIds={picking ? othersInDay(form.days[picking.di], picking.ei) : []}
        onPick={(ex) => { updateEx(picking.di, picking.ei, 'exercise', ex._id); setPicking(null); }}
        onClose={() => setPicking(null)} />
    </Sheet>
  );
}

export default function PlansScreen({ navigation, route }) {
  const [plans, setPlans] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editor, setEditor] = useState(null); // { initial, editingId }

  const load = useCallback(() => Promise.all([planAPI.getAll(), exerciseAPI.getAll()])
    .then(([p, e]) => { setPlans(p.data); setExercises(e.data); })
    .catch(console.error)
    .finally(() => { setLoading(false); setRefreshing(false); }), []);
  useEffect(() => { load(); }, [load]);

  // A plan saved from the generator comes back as a param.
  useEffect(() => {
    const saved = route?.params?.savedPlan;
    if (saved) { setPlans((prev) => [saved, ...prev.filter((p) => p._id !== saved._id)]); navigation.setParams({ savedPlan: undefined }); }
  }, [route?.params?.savedPlan]);

  const openCreate = () => setEditor({ initial: { name: '', description: '', days: [] }, editingId: null });
  const openEdit = (plan) => setEditor({
    editingId: plan._id,
    initial: {
      name: plan.name,
      description: plan.description || '',
      // Keep a rotation plan a rotation when it's saved again.
      schedule: plan.schedule || 'weekly',
      ...(plan.rotation && { rotation: plan.rotation }),
      days: plan.days.map((d) => ({
        dayOfWeek: d.dayOfWeek,
        label: d.label || '',
        exercises: d.exercises.map((e) => ({
          exercise: e.exercise?._id || e.exercise || '',
          targetSets: e.targetSets, targetReps: e.targetReps, targetWeight: e.targetWeight, weightUnit: e.weightUnit || 'kg',
          targetRepsMax: e.targetRepsMax ?? '',
          targetRir: e.targetRir || '',
        })),
      })),
    },
  });

  const handleActivate = async (id) => {
    const { data } = await planAPI.activate(id);
    setPlans((prev) => prev.map((p) => ({ ...p, isActive: p._id === data._id })));
  };
  const handleDelete = async (id) => {
    if (!(await confirm('Delete this plan?', '', 'Delete', true))) return;
    await planAPI.delete(id);
    setPlans((prev) => prev.filter((p) => p._id !== id));
  };
  // Open Log Workout pre-filled with that day.
  const handleStart = (plan, day) => navigation.navigate('LogWorkout', { template: { plan, day } });

  if (loading) return <View style={styles.centered}><Spinner /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}>
        <View style={[styles.row, { gap: 10, marginBottom: 14 }]}>
          <Button icon={Sparkles} title="Planner" variant="secondary" onPress={() => navigation.navigate('PlanGenerator')} style={{ flex: 1 }} />
          <Button title="+ New Plan" onPress={openCreate} style={{ flex: 1 }} />
        </View>
        {plans.length === 0 && <EmptyState icon={ClipboardList} title="No plans yet" subtitle="Create a structured weekly plan to stay consistent, or let the generator build one." />}
        {plans.map((plan) => (
          <PlanCard key={plan._id} plan={plan} onActivate={handleActivate} onDelete={handleDelete} onStart={handleStart} onEdit={openEdit} />
        ))}
      </ScrollView>
      {editor && (
        <PlanEditor visible={!!editor} initial={editor.initial} editingId={editor.editingId} exercises={exercises}
          onClose={() => setEditor(null)}
          onSaved={(data, wasEdit) => setPlans((prev) => (wasEdit ? prev.map((p) => (p._id === data._id ? data : p)) : [data, ...prev]))} />
      )}
    </View>
  );
}

const styles = makeStyles(() => ({
  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  planName:  { flex: 1, fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  chev:      { fontSize: 14, color: colors.textMuted },
  desc:      { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  openBody:  { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  dayBox:    { backgroundColor: colors.inset, borderRadius: 12, padding: 12, marginBottom: 8 },
  dayTitle:  { fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 },
  exLine:    { flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingVertical: 2 },
  exLineName:{ flex: 1, fontSize: 13, color: colors.textPrimary },
  exLineMeta:{ fontSize: 12, color: colors.textMuted },
  empty:     { textAlign: 'center', color: colors.textMuted, paddingVertical: 12 },
  actions:   { flexDirection: 'row', gap: 8, marginTop: 6 },
  actionBtn: { flex: 1, minHeight: 38, paddingHorizontal: 8 },
  field:     { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: colors.textPrimary, backgroundColor: colors.surface },
  exEdit:    { backgroundColor: colors.surface, borderRadius: 10, padding: 8, marginBottom: 6, borderWidth: 1, borderColor: colors.border },
  exPick:    { flex: 1, paddingVertical: 6 },
  icon:      { paddingHorizontal: 4 },
  cap:       { fontSize: 10, color: colors.textMuted, textAlign: 'center' },
  capRow:    { flexDirection: 'row', gap: 8, paddingHorizontal: 9, marginBottom: 2 },
  unitToggle:{ flexDirection: 'row', width: UNIT_W, borderWidth: 1, borderColor: colors.border, borderRadius: 8, overflow: 'hidden' },
  unitBtn:   { flex: 1, height: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  unitBtnActive: { backgroundColor: colors.brand },
  unitText:  { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  numBox:    { height: 34, borderWidth: 1, borderColor: colors.border, borderRadius: 8, textAlign: 'center', fontSize: 14, color: colors.textPrimary },
}));
