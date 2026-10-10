import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text } from './AppText';
import { exerciseAPI } from '../api';
import ExerciseImage from './ExerciseImage';
import { colors, makeStyles } from './tokens';

// "triceps › Long head" → "long head"; "lats" → "lats"
const short = (unit) => (unit.includes(' › ') ? unit.split(' › ')[1].toLowerCase() : unit);

/**
 * Suggestions to replace an exercise with a similar one (same main muscle /
 * overlapping muscles), best match first. `onPick` gets the chosen exercise.
 */
// `excludeIds`: exercises not to suggest (e.g. already in the same plan day).
export default function SimilarExercises({ exerciseId, equipment, onPick, onClose, selectedId, excludeIds = [] }) {
  const [list, setList] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!exerciseId) return;
    let cancelled = false;
    setList(null);
    setError('');
    exerciseAPI.similar(exerciseId, equipment?.length ? { equipment: equipment.join(',') } : undefined)
      .then(({ data }) => { if (!cancelled) setList(data.filter((e) => !excludeIds.includes(e._id))); })
      .catch(() => { if (!cancelled) setError('Could not load similar exercises'); });
    return () => { cancelled = true; };
  }, [exerciseId, equipment?.join(',')]);

  return (
    <View style={styles.box}>
      <View style={styles.header}>
        <Text style={styles.title}>Replace with a similar exercise</Text>
        {onClose ? <TouchableOpacity onPress={onClose}><Text style={styles.close}>Close</Text></TouchableOpacity> : null}
      </View>
      {error ? <Text style={[styles.muted, { color: colors.danger }]}>{error}</Text> : null}
      {!list && !error ? <Text style={styles.muted}>Finding similar exercises…</Text> : null}
      {list && list.length === 0 ? <Text style={styles.muted}>No similar exercises found.</Text> : null}
      {list?.map((ex) => (
        <TouchableOpacity key={ex._id} onPress={() => onPick(ex)} style={[styles.row, selectedId === ex._id && styles.rowActive]}>
          <ExerciseImage images={ex.images} style={{ width: 40, height: 32 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>
              {ex.name}{ex.laterality === 'unilateral' ? <Text style={styles.tag}>  each side</Text> : null}{ex.isCustom ? <Text style={styles.tag}>  custom</Text> : null}
            </Text>
            {ex.shared?.length > 0 ? <Text style={styles.muted} numberOfLines={1}>{ex.shared.map(short).join(', ')}</Text> : null}
          </View>
          {ex.match != null ? <Text style={styles.muted}>{ex.match}%</Text> : null}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = makeStyles(() => ({
  box:       { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 8, gap: 2, backgroundColor: colors.surface },
  header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  title:     { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  close:     { fontSize: 12, color: colors.textMuted },
  row:       { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 4, borderRadius: 8 },
  rowActive: { backgroundColor: colors.brandLight },
  name:      { fontSize: 13, color: colors.textPrimary },
  tag:       { fontSize: 10, color: colors.brand },
  muted:     { fontSize: 11, color: colors.textMuted, textTransform: 'capitalize' },
}));
