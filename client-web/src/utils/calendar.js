/**
 * Month grid for the day pickers (web and mobile; mobile imports it through
 * its Metro config). Pure JS only. Weeks start on Monday.
 */
import { format, addDays, startOfMonth, startOfWeek, isSameMonth } from 'date-fns';

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** The weeks shown for `month` (any date in it): [[{ key, day, inMonth }, ×7], …]. */
export function monthWeeks(month) {
  const m = startOfMonth(month);
  const first = startOfWeek(m, { weekStartsOn: 1 });
  const weeks = [];
  for (let w = 0; w < 6; w++) {
    const week = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(first, w * 7 + i);
      return { key: format(d, 'yyyy-MM-dd'), day: d.getDate(), inMonth: isSameMonth(d, m) };
    });
    if (week.some((d) => d.inMonth)) weeks.push(week);
  }
  return weeks;
}
