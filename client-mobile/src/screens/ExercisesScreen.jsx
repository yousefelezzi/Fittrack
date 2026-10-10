import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Alert } from 'react-native';
import { exerciseAPI } from '../api';
import {
  Card, Button, Spinner, colors, makeStyles, Sheet, Chip, ChipRow, Segmented, Label, Hint, ErrorText, LinkText, ExerciseImage, confirm,
} from '../components';
import { X } from 'lucide-react-native';
import { EXERCISE_TYPES, TYPE_LABEL, typeOf } from '../../../client-web/src/utils/exerciseTypes';
import { coveringMuscle, toggleMuscleTag } from '../../../client-web/src/utils/exerciseFilters';
import StarRating, { RatingSummary } from '../components/StarRating';

const MUSCLES = ['pecs','clavicular pecs','sternal pecs','costal pecs','lats','trapezius','posterior delt','middle delt','anterior delt','elbow flexors','biceps','brachialis/brachioradialis','triceps','medial/lateral triceps','triceps long head','forearms','abs','erectors','glutes','adductors','hip flexors','quads','vastus quads','rectus femoris','hamstrings','biarticular hamstrings','hamstrings short head','calves','gastrocnemius','soleus'];
const EQUIPMENT = ['barbell','dumbbell','machine','cable','bodyweight','kettlebell','resistance_band','other'];
const EMPTY_FORM = { name: '', muscleGroups: [], secondaryMuscles: [], equipment: 'bodyweight', category: 'strength', laterality: 'bilateral', type: 'dynamic', instructions: [''] };
// Names that mean one arm/leg at a time (same as server/utils/laterality.js).
const UNILATERAL_NAME_PATTERN = /\b(single|one)[\s-]*(arm|leg|hand)\b|\bunilateral\b|\bcable lateral raise\b|\bdumbbell preacher curl\b/i;
const pretty = (s) => s.replace('_', ' ');

function ExerciseCard({ ex, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(ex.rating || { avg: null, count: 0, mine: null });
  const rate = async (stars) => {
    try { setRating((await exerciseAPI.rate(ex._id, stars)).data); } catch { /* stays as it was */ }
  };
  return (
    <Card style={{ marginBottom: 10 }}>
      <TouchableOpacity onPress={() => setOpen(!open)} activeOpacity={0.7} style={styles.cardHead}>
        {!open && <ExerciseImage images={ex.images} style={{ width: 60, height: 46 }} />}
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{ex.name}</Text>
          <View style={styles.badges}>
            {ex.muscleGroups.map((m) => (
              <Text key={m} style={[styles.badge, ex.secondaryMuscles?.includes(m) && styles.badgeSecondary]}>{pretty(m)}</Text>
            ))}
            <Text style={[styles.badge, styles.badgeGray]}>{pretty(ex.equipment)}</Text>
            {ex.laterality === 'unilateral' && <Text style={[styles.badge, styles.badgePurple]}>Unilateral</Text>}
            {typeOf(ex) !== 'dynamic' && <Text style={[styles.badge, styles.badgeAmber]}>{TYPE_LABEL[typeOf(ex)]}</Text>}
          </View>
          <RatingSummary rating={rating} style={{ marginTop: 6 }} />
        </View>
        <Text style={styles.chev}>{open ? '▴' : '▾'}</Text>
      </TouchableOpacity>
      {open && ex.images?.length > 0 && <ExerciseImage images={ex.images} both style={{ height: 140, marginTop: 10 }} />}
      {open && ex.instructions?.length > 0 && (
        <View style={styles.steps}>
          {ex.instructions.map((step, i) => <Text key={i} style={styles.step}>{i + 1}. {step}</Text>)}
        </View>
      )}
      {open && ex.secondaryMuscles?.length > 0 && <Hint style={{ marginTop: 6 }}>Lighter tags are secondary muscles: they count up to half a set (less the more trained you are).</Hint>}
      {open ? (
        <View style={styles.rateRow}>
          <Text style={styles.rateLabel}>{rating.mine ? 'Your rating' : 'Rate this exercise'}</Text>
          <StarRating value={rating.mine || 0} onChange={rate} />
        </View>
      ) : null}
      {ex.isCustom && (
        <View style={styles.customRow}>
          <Text style={[styles.badge, { marginRight: 'auto' }]}>Custom</Text>
          <LinkText onPress={() => onEdit(ex)}>Edit</LinkText>
          <LinkText danger onPress={() => onDelete(ex)}>Delete</LinkText>
        </View>
      )}
    </Card>
  );
}

/** Create a custom exercise, or edit one when `exercise` has an _id. */
export function ExerciseEditor({ visible, exercise, onClose, onSaved }) {
  const isEdit = !!exercise?._id;
  const [form, setForm] = useState(EMPTY_FORM);
  const [typeChosen, setTypeChosen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setError('');
    setTypeChosen(isEdit);
    setForm(isEdit ? {
      name: exercise.name,
      muscleGroups: exercise.muscleGroups || [],
      secondaryMuscles: exercise.secondaryMuscles || [],
      equipment: exercise.equipment || 'bodyweight',
      category: exercise.category || 'strength',
      laterality: exercise.laterality || 'bilateral',
      type: typeOf(exercise),
      instructions: exercise.instructions?.length ? exercise.instructions : [''],
    } : { ...EMPTY_FORM, name: exercise?.name || '' }); // a new one can start with a name (e.g. typed in a search)
  }, [visible, exercise]);

  // Until the user picks a type themselves, suggest one from the name.
  const setName = (name) => setForm((f) => ({ ...f, name, ...(!typeChosen && { laterality: UNILATERAL_NAME_PATTERN.test(name) ? 'unilateral' : 'bilateral' }) }));
  // A whole muscle replaces its regions, which then can't be picked.
  const toggleMuscle = (m) => setForm((f) => toggleMuscleTag(f, m));
  const setSecondary = (m, sec) => setForm((f) => ({
    ...f, secondaryMuscles: sec ? [...new Set([...f.secondaryMuscles, m])] : f.secondaryMuscles.filter((x) => x !== m),
  }));
  const setStep = (i, v) => setForm((f) => ({ ...f, instructions: f.instructions.map((s, j) => (j === i ? v : s)) }));

  const submit = async () => {
    setError('');
    if (!form.name.trim()) return setError('Exercise name is required.');
    if (form.muscleGroups.length === 0) return setError('Select at least one muscle group.');
    setSaving(true);
    try {
      const payload = { ...form, name: form.name.trim(), instructions: form.instructions.map((s) => s.trim()).filter(Boolean) };
      const { data } = isEdit ? await exerciseAPI.update(exercise._id, payload) : await exerciseAPI.create(payload);
      onSaved(data, isEdit);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={visible} title={isEdit ? 'Edit Exercise' : 'Add Custom Exercise'} onClose={onClose}
      footer={<Button title={isEdit ? 'Save Changes' : 'Create Exercise'} onPress={submit} loading={saving} />}>
      <ErrorText>{error}</ErrorText>
      <Label style={{ marginTop: 0 }}>Name *</Label>
      <TextInput style={styles.field} placeholder="e.g. Reverse Nordic Curl" placeholderTextColor={colors.textMuted} value={form.name} onChangeText={setName} />

      <Label>Muscle groups *</Label>
      <ChipRow style={{ gap: 6 }}>
        {MUSCLES.map((m) => <Chip key={m} small label={m} active={form.muscleGroups.includes(m)} disabled={!!coveringMuscle(m, form.muscleGroups)} onPress={() => toggleMuscle(m)} />)}
      </ChipRow>
      {MUSCLES.some((m) => coveringMuscle(m, form.muscleGroups)) ? <Hint style={{ marginTop: 4 }}>Greyed-out regions are already included in a whole muscle you picked.</Hint> : null}
      {form.muscleGroups.length > 0 && (
        <View style={styles.weightBox}>
          <Text style={[styles.small, { fontWeight: '600' }]}>How much each set counts</Text>
          <Hint style={{ marginBottom: 6 }}>Primary muscles count a full set; secondary ones (helpers, like the triceps in a bench press) count half for beginners, a quarter for intermediates and nothing for advanced lifters (from your FFMI). The first muscle is the exercise's main one.</Hint>
          {form.muscleGroups.map((m, i) => (
            <View key={m} style={styles.weightRow}>
              <Text style={[styles.small, { flex: 1, textTransform: 'capitalize' }]}>{m}{i === 0 ? '  (main)' : ''}</Text>
              <Segmented style={{ width: 170 }} value={form.secondaryMuscles.includes(m)} onChange={(sec) => setSecondary(m, sec)}
                options={[[false, 'Primary'], [true, 'Secondary']]} />
            </View>
          ))}
        </View>
      )}

      <Label>Equipment</Label>
      <ChipRow style={{ gap: 6 }}>
        {EQUIPMENT.map((e) => <Chip key={e} small label={pretty(e)} active={form.equipment === e} onPress={() => setForm((f) => ({ ...f, equipment: e }))} />)}
      </ChipRow>

      <Label>Sides</Label>
      <Segmented value={form.laterality} onChange={(v) => { setTypeChosen(true); setForm((f) => ({ ...f, laterality: v })); }}
        options={[['bilateral', 'Bilateral', 'Both sides together'], ['unilateral', 'Unilateral', 'One arm or leg at a time']]} />
      {form.laterality === 'unilateral' && (
        <Hint style={{ marginTop: 4 }}>
          Sets are logged separately for the left and right side.
          {isEdit && exercise.laterality === 'bilateral' ? ' Sets you already logged will be split into matching left and right sets.' : ''}
        </Hint>
      )}
      {isEdit && exercise.laterality === 'unilateral' && form.laterality === 'bilateral' && (
        <Hint style={{ marginTop: 4 }}>Sets you already logged per side stay as left and right.</Hint>
      )}

      {(
        <>
          <Label>Exercise type</Label>
          <View style={{ gap: 6 }}>
            {EXERCISE_TYPES.map(([v, label, hint]) => (
              <TouchableOpacity key={v} onPress={() => setForm((f) => ({ ...f, type: v }))} style={[styles.typeOption, form.type === v && styles.typeOptionOn]}>
                <Text style={[styles.typeLabel, form.type === v && { color: colors.brand }]}>{label}</Text>
                <Text style={styles.typeHint}>{hint}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Hint style={{ marginTop: 4 }}>
            {form.type === 'yielding' ? 'Sets are logged as seconds held, weight and seconds in reserve. Live sessions use a stopwatch.'
              : form.type === 'overcoming' ? 'Sets are logged as bursts, seconds per burst and rest between bursts. Live sessions guide each burst with a timer.'
                : 'Sets are logged as reps, weight and reps in reserve.'}
          </Hint>
        </>
      )}

      <Label>Instructions (optional)</Label>
      {form.instructions.map((step, i) => (
        <View key={i} style={styles.stepRow}>
          <Text style={styles.small}>{i + 1}.</Text>
          <TextInput style={[styles.field, { flex: 1 }]} placeholder={`Step ${i + 1}`} placeholderTextColor={colors.textMuted} value={step} onChangeText={(v) => setStep(i, v)} />
          {form.instructions.length > 1 && (
            <TouchableOpacity onPress={() => setForm((f) => ({ ...f, instructions: f.instructions.filter((_, j) => j !== i) }))} hitSlop={6}>
              <X size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      ))}
      <LinkText onPress={() => setForm((f) => ({ ...f, instructions: [...f.instructions, ''] }))}>+ Add step</LinkText>
    </Sheet>
  );
}

export default function ExercisesScreen() {
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [muscle, setMuscle] = useState('');
  const [equipment, setEquipment] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [editing, setEditing] = useState(null); // exercise, or { category } for a new one

  const fetchExercises = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await exerciseAPI.getAll({ search, muscle, equipment });
      setExercises(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, muscle, equipment]);

  useEffect(() => {
    const t = setTimeout(fetchExercises, 300);
    return () => clearTimeout(t);
  }, [fetchExercises]);

  // Strength only: cardio has its own page.
  const shown = exercises.filter((e) => (e.category || 'strength') === 'strength');

  const handleSaved = (saved, wasEdit) => setExercises((prev) => (wasEdit ? prev.map((e) => (e._id === saved._id ? saved : e)) : [saved, ...prev]));
  const handleDelete = async (ex) => {
    if (!(await confirm(`Delete "${ex.name}"?`, 'Workouts that used it will show it as a deleted exercise, and plans that include it will show it as Unknown.', 'Delete', true))) return;
    try {
      await exerciseAPI.delete(ex._id);
      setExercises((prev) => prev.filter((e) => e._id !== ex._id));
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not delete this exercise.');
    }
  };

  const filterCount = (muscle ? 1 : 0) + (equipment ? 1 : 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.top}>
        <View style={styles.cardHead}>
          <TextInput style={[styles.field, { flex: 1 }]} placeholder="Search exercises…" placeholderTextColor={colors.textMuted}
            value={search} onChangeText={setSearch} autoCorrect={false} />
          <Button title={filterCount ? `Filters (${filterCount})` : 'Filters'} variant="secondary" onPress={() => setFiltersOpen(true)} style={{ minHeight: 42, paddingHorizontal: 12 }} />
          <Button title="+" onPress={() => setEditing({})} style={{ minHeight: 42, width: 46, paddingHorizontal: 0 }} />
        </View>
      </View>

      {loading ? <View style={styles.centered}><Spinner /></View> : (
        <FlatList
          data={shown}
          keyExtractor={(e) => e._id}
          contentContainerStyle={{ padding: 16, paddingTop: 4 }}
          renderItem={({ item }) => <ExerciseCard ex={item} onEdit={setEditing} onDelete={handleDelete} />}
          ListEmptyComponent={<Text style={styles.empty}>No exercises found.</Text>}
        />
      )}

      <Sheet visible={filtersOpen} title="Filters" onClose={() => setFiltersOpen(false)}
        footer={<View style={{ flexDirection: 'row', gap: 10 }}>
          <Button title="Clear" variant="secondary" onPress={() => { setMuscle(''); setEquipment(''); }} style={{ flex: 1 }} />
          <Button title="Done" onPress={() => setFiltersOpen(false)} style={{ flex: 1 }} />
        </View>}>
        {(
          <>
            <Label style={{ marginTop: 0 }}>Muscle</Label>
            <ChipRow style={{ gap: 6 }}>
              {MUSCLES.map((m) => <Chip key={m} small label={m} active={muscle === m} onPress={() => setMuscle(muscle === m ? '' : m)} />)}
            </ChipRow>
          </>
        )}
        <Label>Equipment</Label>
        <ChipRow style={{ gap: 6 }}>
          {EQUIPMENT.map((e) => <Chip key={e} small label={pretty(e)} active={equipment === e} onPress={() => setEquipment(equipment === e ? '' : e)} />)}
        </ChipRow>
      </Sheet>

      <ExerciseEditor visible={!!editing} exercise={editing} onClose={() => setEditing(null)} onSaved={handleSaved} />
    </View>
  );
}

const styles = makeStyles(() => ({
  top:        { padding: 16, paddingBottom: 8 },
  centered:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cardHead:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name:       { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  chev:       { fontSize: 14, color: colors.textMuted },
  badges:     { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 5 },
  badge:      { fontSize: 11, color: colors.brand, backgroundColor: colors.brandLight, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden', textTransform: 'capitalize' },
  badgeSecondary: { color: colors.brand, backgroundColor: colors.inset },
  badgeGray:  { color: colors.textSecondary, backgroundColor: colors.subtle },
  badgePurple:{ color: '#7e22ce', backgroundColor: '#faf5ff' },
  badgeAmber: { color: colors.warning, backgroundColor: colors.warningLight },
  typeOption: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  typeOptionOn: { borderColor: colors.brand, backgroundColor: colors.brandLight },
  typeLabel:  { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  typeHint:   { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  steps:      { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border, gap: 4 },
  step:       { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  customRow:  { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  field:      { height: 42, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, fontSize: 14, color: colors.textPrimary, backgroundColor: colors.surface },
  empty:      { textAlign: 'center', color: colors.textMuted, paddingVertical: 40 },
  small:      { fontSize: 12, color: colors.textSecondary },
  weightBox:  { backgroundColor: colors.inset, borderRadius: 12, padding: 10, marginTop: 10, gap: 6 },
  weightRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  rateRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.subtle },
  rateLabel: { fontSize: 13, color: colors.textSecondary },
}));
