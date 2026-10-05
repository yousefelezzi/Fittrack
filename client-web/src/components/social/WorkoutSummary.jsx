import { useState } from 'react';
import { format } from 'date-fns';
import { Dumbbell, ChevronDown, ChevronUp } from 'lucide-react';
import ExerciseImage from '../ExerciseImage';
import { summarizeWorkout } from '../../utils/workoutSummary';

export { summarizeWorkout };

/** A shared workout: name, date, duration, sets and volume; tap to see each exercise. */
export default function WorkoutSummary({ workout, compact = false }) {
  const [open, setOpen] = useState(false);
  if (!workout) return null;
  const { exercises, volume, sets } = summarizeWorkout(workout);

  return (
    <div className="rounded-xl border border-brand-100 dark:border-brand-900/50 bg-brand-50/60 dark:bg-brand-900/20 overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 p-3 text-left">
        <div className="w-9 h-9 rounded-lg bg-brand-600 text-white flex items-center justify-center shrink-0">
          <Dumbbell size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{workout.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {workout.date ? `${format(new Date(workout.date), 'MMM d')} · ` : ''}
            {exercises.length} exercise{exercises.length !== 1 ? 's' : ''} · {sets} sets
            {workout.duration ? ` · ${workout.duration} min` : ''}
            {volume ? ` · ${volume.toLocaleString()} kg volume` : ''}
          </p>
        </div>
        {!compact && (open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />)}
      </button>
      {open && !compact && (
        <ul className="border-t border-brand-100 dark:border-brand-900/50 divide-y divide-brand-100/60 dark:divide-brand-900/40">
          {exercises.map((e, i) => (
            <li key={i} className="flex items-center gap-3 px-3 py-2">
              <ExerciseImage images={e.images} name={e.name} className="w-10 h-8 shrink-0" />
              <span className="flex-1 min-w-0 text-sm text-gray-800 dark:text-gray-200 truncate">{e.name}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
                {e.sets} set{e.sets !== 1 ? 's' : ''}{e.bestLabel ? ` · best ${e.bestLabel}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
