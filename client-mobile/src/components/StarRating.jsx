import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text } from './AppText';
import { Star } from 'lucide-react-native';
import { colors, makeStyles } from './tokens';

const AMBER = '#f59e0b';

/** "★ 4.3 (12)" for an exercise's ratings, or "No ratings yet". */
export function RatingSummary({ rating, style }) {
  if (!rating?.count) return <Text style={[styles.muted, style]}>No ratings yet</Text>;
  return (
    <View style={[styles.row, style]}>
      <Star size={12} color={AMBER} fill={AMBER} />
      <Text style={styles.avg}>{rating.avg.toFixed(1)}</Text>
      <Text style={styles.muted}>({rating.count})</Text>
    </View>
  );
}

/** Five stars to rate with; tapping your current rating again takes it back (onChange(0)). */
export default function StarRating({ value = 0, onChange, size = 24, disabled }) {
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((n) => (
        <TouchableOpacity key={n} disabled={disabled} onPress={() => onChange(n === value ? 0 : n)} hitSlop={4} style={{ padding: 2 }}
          accessibilityLabel={n === value ? `Remove your ${n}-star rating` : `Rate ${n} star${n > 1 ? 's' : ''}`}>
          <Star size={size} color={n <= value ? AMBER : colors.border} fill={n <= value ? AMBER : 'transparent'} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = makeStyles(() => ({
  row:   { flexDirection: 'row', alignItems: 'center', gap: 3 },
  avg:   { fontSize: 12, fontWeight: '700', color: colors.textPrimary },
  muted: { fontSize: 12, color: colors.textMuted },
}));
