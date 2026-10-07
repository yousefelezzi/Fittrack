import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { format, addDays, parseISO, isToday, isYesterday } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { colors, makeStyles } from './tokens';

const key = (d) => format(d, 'yyyy-MM-dd');

/** ‹ Today › — step through days (YYYY-MM-DD), never past today. */
export default function DayNav({ date, onChange }) {
  const d = parseISO(date);
  const label = isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'EEE, MMM d');
  return (
    <View style={styles.row}>
      <TouchableOpacity onPress={() => onChange(key(addDays(d, -1)))} hitSlop={10}><ChevronLeft size={22} color={colors.textSecondary} /></TouchableOpacity>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity onPress={() => onChange(key(addDays(d, 1)))} disabled={isToday(d)} hitSlop={10} style={isToday(d) && { opacity: 0.3 }}>
        <ChevronRight size={22} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = makeStyles(() => ({
  row:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 12 },
  label: { minWidth: 120, textAlign: 'center', fontSize: 15, fontWeight: '600', color: colors.textPrimary },
}));
