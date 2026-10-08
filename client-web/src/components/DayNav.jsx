import { useEffect, useRef, useState } from 'react';
import { format, addDays, addMonths, parseISO, isToday, isYesterday, isTomorrow, startOfMonth } from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { WEEKDAYS, monthWeeks } from '../utils/calendar';

const key = (d) => format(d, 'yyyy-MM-dd');

/**
 * ‹ Today › with a calendar to jump to any day (YYYY-MM-DD). Never past today
 * unless `allowFuture` (the food log, for planning meals ahead). The label
 * jumps back to today; the calendar button opens and closes the calendar.
 */
export default function DayNav({ date, onChange, allowFuture = false }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const d = parseISO(date);
  const today = key(new Date());
  const label = isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : isTomorrow(d) ? 'Tomorrow' : format(d, 'EEE, MMM d');
  const atEnd = !allowFuture && date >= today;

  // A click anywhere else, or Escape, closes the calendar.
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  return (
    <div ref={box} className="relative flex items-center gap-1">
      <button onClick={() => onChange(key(addDays(d, -1)))} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Previous day">
        <ChevronLeft size={18} />
      </button>
      <button onClick={() => onChange(today)} disabled={date === today} title={date === today ? undefined : 'Back to today'}
        className="min-w-[7rem] text-center text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg py-1 enabled:hover:bg-gray-100 dark:enabled:hover:bg-gray-800">
        {label}
      </button>
      <button onClick={() => onChange(key(addDays(d, 1)))} disabled={atEnd} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30" aria-label="Next day">
        <ChevronRight size={18} />
      </button>
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? 'Close calendar' : 'Pick a day'} title={open ? 'Close calendar' : 'Pick a day'}
        className={`p-1.5 rounded-lg ${open ? 'text-brand-600 bg-brand-50 dark:bg-brand-900/30' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
        <CalendarDays size={18} />
      </button>
      {open && (
        <MonthPicker date={date} allowFuture={allowFuture} onPick={(k) => { onChange(k); setOpen(false); }} />
      )}
    </div>
  );
}

/** The calendar panel under the day switcher. */
function MonthPicker({ date, allowFuture, onPick }) {
  const [month, setMonth] = useState(() => startOfMonth(parseISO(date)));
  const today = key(new Date());
  const nextBlocked = !allowFuture && key(addMonths(month, 1)) > today;
  return (
    <div className="absolute right-0 top-full mt-2 z-30 w-72 p-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-lg">
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => setMonth(addMonths(month, -1))} className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Previous month">
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{format(month, 'MMMM yyyy')}</span>
        <button onClick={() => setMonth(addMonths(month, 1))} disabled={nextBlocked} className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30" aria-label="Next month">
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] font-medium text-gray-400 mb-1">
        {WEEKDAYS.map((w) => <span key={w}>{w}</span>)}
      </div>
      {monthWeeks(month).map((week) => (
        <div key={week[0].key} className="grid grid-cols-7">
          {week.map(({ key: k, day, inMonth }) => {
            const selected = k === date;
            return (
              <button key={k} onClick={() => onPick(k)} disabled={!allowFuture && k > today}
                className={`h-9 m-0.5 rounded-full text-sm disabled:opacity-30 ${selected
                  ? 'bg-brand-600 text-white font-semibold'
                  : `${inMonth ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 dark:text-gray-600'} ${k === today ? 'ring-1 ring-brand-500' : ''} enabled:hover:bg-gray-100 dark:enabled:hover:bg-gray-800`}`}>
                {day}
              </button>
            );
          })}
        </div>
      ))}
      <button onClick={() => onPick(today)} className="w-full mt-2 text-sm font-medium text-brand-600 hover:underline">Today</button>
    </div>
  );
}
