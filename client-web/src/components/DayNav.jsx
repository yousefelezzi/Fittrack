import { format, addDays, parseISO, isToday, isYesterday } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const key = (d) => format(d, 'yyyy-MM-dd');

/** ‹ Today › — step through days (YYYY-MM-DD), never past today. */
export default function DayNav({ date, onChange }) {
  const d = parseISO(date);
  const label = isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'EEE, MMM d');
  return (
    <div className="flex items-center gap-1">
      <button onClick={() => onChange(key(addDays(d, -1)))} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Previous day">
        <ChevronLeft size={18} />
      </button>
      <span className="min-w-[7rem] text-center text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
      <button onClick={() => onChange(key(addDays(d, 1)))} disabled={isToday(d)} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30" aria-label="Next day">
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
