import React, { useMemo, useState } from 'react';
import { View, TouchableOpacity, FlatList, ScrollView } from 'react-native';
import { Text, TextInput } from './AppText';
import { Sheet, Chip } from './ui';
import { MUSCLE_FILTERS, filterByMuscle } from '../../../client-web/src/utils/exerciseFilters';
import ExerciseImage from './ExerciseImage';
import { colors, makeStyles } from './tokens';
import { Check, Plus } from 'lucide-react-native';

/**
 * Searchable exercise list in a bottom sheet. `selectedIds` get a check mark;
 * `onPick` gets the chosen exercise. `header` renders above the list (e.g.
 * similar exercises when swapping). `muscleFilter` adds a row of muscle chips
 * that narrow the list to exercises training that muscle. `disabledIds` are
 * shown greyed out as already added and can't be picked. With `onCreate`, a
 * row at the top makes a custom exercise (it gets the search text as its name).
 */
export default function ExercisePicker({ visible, title = 'Add Exercise', exercises, selectedIds = [], disabledIds = [], onPick, onClose, header, muscleFilter = false, onCreate }) {
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState('');
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = filterByMuscle(exercises, muscle);
    return t ? list.filter((e) => e.name.toLowerCase().includes(t) || e.muscleGroups?.some((m) => m.includes(t))) : list;
  }, [q, exercises, muscle]);

  const close = () => { setQ(''); setMuscle(''); onClose(); };

  return (
    <Sheet visible={visible} title={title} onClose={close} scroll={false}>
      {header}
      <TextInput style={styles.search} placeholder="Search exercises or muscles…" placeholderTextColor={colors.textMuted}
        value={q} onChangeText={setQ} autoCorrect={false} />
      {muscleFilter && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 8 }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Chip small label="All" active={!muscle} onPress={() => setMuscle('')} />
            {MUSCLE_FILTERS.map(([key, label]) => (
              <Chip key={key} small label={label} active={muscle === key} onPress={() => setMuscle(muscle === key ? '' : key)} />
            ))}
          </View>
        </ScrollView>
      )}
      {onCreate ? (
        <TouchableOpacity style={styles.create} onPress={() => { const name = q.trim(); setQ(''); setMuscle(''); onCreate(name); }}>
          <Plus size={16} color={colors.brand} />
          <Text style={styles.createText} numberOfLines={1}>{q.trim() ? `Create “${q.trim()}” as a custom exercise` : 'Create a custom exercise'}</Text>
        </TouchableOpacity>
      ) : null}
      <FlatList
        data={shown}
        keyExtractor={(e) => e._id}
        keyboardShouldPersistTaps="handled"
        style={{ maxHeight: 420 }}
        initialNumToRender={20}
        renderItem={({ item: ex }) => {
          const added = disabledIds.includes(ex._id);
          return (
          <TouchableOpacity style={[styles.row, added && { opacity: 0.45 }]} disabled={added} onPress={() => { onPick(ex); setQ(''); }}>
            <ExerciseImage images={ex.images} style={styles.thumb} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>
                {ex.name}
                {ex.laterality === 'unilateral' ? <Text style={styles.tag}>  each side</Text> : null}
                {ex.isCustom ? <Text style={styles.tag}>  custom</Text> : null}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>{added ? 'Already added' : ex.muscleGroups?.join(', ')}</Text>
            </View>
            {(added || selectedIds.includes(ex._id)) && <Check size={18} color={colors.brand} />}
          </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>No exercises found.</Text>}
      />
    </Sheet>
  );
}

const styles = makeStyles(() => ({
  search: { minHeight: 42, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, fontSize: 14, color: colors.textPrimary, marginBottom: 8 },
  row:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.subtle, gap: 10 },
  thumb:  { width: 46, height: 36 },
  name:   { fontSize: 14, fontWeight: '500', color: colors.textPrimary },
  tag:    { fontSize: 11, color: colors.brand, fontWeight: '400' },
  meta:   { fontSize: 12, color: colors.textMuted, textTransform: 'capitalize', marginTop: 1 },
  empty:  { textAlign: 'center', color: colors.textMuted, paddingVertical: 24 },
  create: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.subtle },
  createText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.brand },
}));
