import React, { useMemo, useRef, useState } from 'react';
import { View, TouchableOpacity, PanResponder } from 'react-native';
import { Text } from './AppText';
import { format, addDays, addMonths, parseISO, isToday, isYesterday, isTomorrow, startOfMonth } from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react-native';
import { colors, makeStyles, cardSurface } from './tokens';
import { WEEKDAYS, monthWeeks } from '../../../client-web/src/utils/calendar';

const key = (d) => format(d, 'yyyy-MM-dd');

/**
 * ‹ Today › with a calendar to jump to any day (YYYY-MM-DD). Never past today
 * unless `allowFuture` (the food log, for planning meals ahead). The label
 * jumps back to today. `right` sits at the end of the row (e.g. a button).
 */
export default function DayNav({ date, onChange, allowFuture = false, right = null, style }) {
  const [open, setOpen] = useState(false);
  const d = parseISO(date);
  const today = key(new Date());
  const label = isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : isTomorrow(d) ? 'Tomorrow' : format(d, 'EEE, MMM d');
  const atEnd = !allowFuture && date >= today;
  return (
    <View style={[{ marginBottom: 12 }, style]}>
      <View style={[styles.row, right && { justifyContent: 'flex-start' }]}>
        <TouchableOpacity onPress={() => onChange(key(addDays(d, -1)))} hitSlop={10}><ChevronLeft size={22} color={colors.textSecondary} /></TouchableOpacity>
        <TouchableOpacity onPress={() => onChange(today)} disabled={date === today}>
          <Text style={[styles.label, right && { minWidth: 96 }]}>{label}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onChange(key(addDays(d, 1)))} disabled={atEnd} hitSlop={10} style={atEnd && { opacity: 0.3 }}>
          <ChevronRight size={22} color={colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setOpen(!open)} hitSlop={10} accessibilityLabel={open ? 'Close calendar' : 'Pick a day'}
          style={[styles.calBtn, open && { backgroundColor: colors.brandLight }]}>
          <CalendarDays size={20} color={open ? colors.brand : colors.textSecondary} />
        </TouchableOpacity>
        {right ? <><View style={{ flex: 1 }} />{right}</> : null}
      </View>
      {open ? <MonthPicker date={date} allowFuture={allowFuture} onPick={(k) => { setOpen(false); onChange(k); }} /> : null}
    </View>
  );
}

/** The calendar panel under the day switcher (the calendar button closes it). */
function MonthPicker({ date, allowFuture, onPick }) {
  const [month, setMonth] = useState(() => startOfMonth(parseISO(date)));
  const today = key(new Date());
  const nextBlocked = !allowFuture && key(addMonths(month, 1)) > today;
  return (
    <View style={styles.panel}>
      <View style={styles.monthRow}>
        <TouchableOpacity onPress={() => setMonth(addMonths(month, -1))} hitSlop={10}><ChevronLeft size={22} color={colors.textSecondary} /></TouchableOpacity>
        <Text style={styles.month}>{format(month, 'MMMM yyyy')}</Text>
        <TouchableOpacity onPress={() => setMonth(addMonths(month, 1))} disabled={nextBlocked} hitSlop={10} style={nextBlocked && { opacity: 0.3 }}>
          <ChevronRight size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
      <View style={styles.week}>{WEEKDAYS.map((w) => <Text key={w} style={styles.weekday}>{w}</Text>)}</View>
      {monthWeeks(month).map((week) => (
        <View key={week[0].key} style={styles.week}>
          {week.map(({ key: k, day, inMonth }) => {
            const blocked = !allowFuture && k > today;
            const selected = k === date;
            return (
              <TouchableOpacity key={k} style={styles.cell} disabled={blocked} onPress={() => onPick(k)}>
                <View style={[styles.dayDot, selected && { backgroundColor: colors.brand }, !selected && k === today && styles.todayRing]}>
                  <Text style={[styles.day, !inMonth && { color: colors.textMuted }, blocked && { opacity: 0.3 }, selected && { color: '#fff', fontWeight: '700' }]}>
                    {day}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
      <TouchableOpacity onPress={() => onPick(today)} style={{ alignSelf: 'center', marginTop: 8 }} hitSlop={8}>
        <Text style={styles.todayLink}>Today</Text>
      </TouchableOpacity>
    </View>
  );
}

/**
 * Swipe left/right anywhere on a day page to go to the next/previous day.
 * Spread the result on the page's outer View. Only clearly horizontal swipes
 * count, so vertical scrolling and horizontal chip rows keep working.
 */
export function useDaySwipe(date, onChange, { allowFuture = false } = {}) {
  const latest = useRef({ date, onChange, allowFuture });
  latest.current = { date, onChange, allowFuture };
  return useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 24 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
    onPanResponderTerminationRequest: () => true,
    onPanResponderRelease: (_, g) => {
      if (Math.abs(g.dx) < 60 && Math.abs(g.vx) < 0.5) return;
      if (Math.abs(g.dx) < Math.abs(g.dy) * 1.5) return;
      const { date: current, onChange: change, allowFuture: future } = latest.current;
      const next = key(addDays(parseISO(current), g.dx < 0 ? 1 : -1));
      if (!future && next > key(new Date())) return;
      change(next);
    },
  }).panHandlers, []);
}

const styles = makeStyles(() => ({
  row:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  calBtn:   { padding: 4, borderRadius: 8 },
  panel:    { ...cardSurface(), borderRadius: 14, padding: 12, marginTop: 10 },
  label:    { minWidth: 120, textAlign: 'center', fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  month:    { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  week:     { flexDirection: 'row' },
  weekday:  { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600', color: colors.textMuted, paddingBottom: 6 },
  cell:     { flex: 1, alignItems: 'center', paddingVertical: 3 },
  dayDot:   { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  todayRing:{ borderWidth: 1.5, borderColor: colors.brand },
  day:      { fontSize: 14, color: colors.textPrimary },
  todayLink:{ fontSize: 14, fontWeight: '600', color: colors.brand },
}));
