import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, ScrollView } from 'react-native';
import { Sheet, Chip } from './ui';
import { MUSCLE_FILTERS, filterByMuscle } from '../../../client-web/src/utils/exerciseFilters';
import ExerciseImage from './ExerciseImage';
import { colors, makeStyles } from './tokens';
import { Check } from 'lucide-react-native';

/**
 * Searchable exercise list in a bottom sheet. `selectedIds` get a check mark;
 * `onPick` gets the chosen exercise. `header` renders above the list (e.g.
 * similar exercises when swapping). `muscleFilter` adds a row of muscle chips
 * that narrow the list to exercises training that muscle.
 */
export default function ExercisePicker({ visible, title = 'Add Exercise', exercises, selectedIds = [], onPick, onClose, header, muscleFilter = false }) {
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
      <FlatList
        data={shown}
        keyExtractor={(e) => e._id}
        keyboardShouldPersistTaps="handled"
        style={{ maxHeight: 420 }}
        initialNumToRender={20}
        renderItem={({ item: ex }) => (
          <TouchableOpacity style={styles.row} onPress={() => { onPick(ex); setQ(''); }}>
            <ExerciseImage images={ex.images} style={styles.thumb} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>
                {ex.name}
                {ex.laterality === 'unilateral' ? <Text style={styles.tag}>  each side</Text> : null}
                {ex.isCustom ? <Text style={styles.tag}>  custom</Text> : null}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>{ex.muscleGroups?.join(', ')}</Text>
            </View>
            {selectedIds.includes(ex._id) && <Check size={18} color={colors.brand} />}
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No exercises found.</Text>}
      />
    </Sheet>
  );
}

const styles = makeStyles(() => ({
  search: { height: 42, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, fontSize: 14, color: colors.textPrimary, marginBottom: 8 },
  row:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.subtle, gap: 10 },
  thumb:  { width: 46, height: 36 },
  name:   { fontSize: 14, fontWeight: '500', color: colors.textPrimary },
  tag:    { fontSize: 11, color: colors.brand, fontWeight: '400' },
  meta:   { fontSize: 12, color: colors.textMuted, textTransform: 'capitalize', marginTop: 1 },
  empty:  { textAlign: 'center', color: colors.textMuted, paddingVertical: 24 },
}));
