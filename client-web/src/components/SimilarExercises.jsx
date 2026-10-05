import { useEffect, useState } from 'react';
import { exerciseAPI } from '../api';
import ExerciseImage from './ExerciseImage';

// "triceps › Long head" → "long head"; "lats" → "lats"
const short = (unit) => (unit.includes(' › ') ? unit.split(' › ')[1].toLowerCase() : unit);

/**
 * Suggestions to replace an exercise with a similar one (same main muscle /
 * overlapping muscles), best match first. Renders a compact list; `onPick`
 * gets the chosen exercise.
 */
// `excludeIds`: exercises not to suggest (e.g. already in the same plan day).
export default function SimilarExercises({ exerciseId, equipment, onPick, onClose, compact = false, excludeIds = [] }) {
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
    <div className={`rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 ${compact ? 'p-2' : 'p-3'} space-y-1.5`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Replace with a similar exercise</p>
        {onClose && <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">Close</button>}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      {!list && !error && <p className="text-xs text-gray-400 py-1">Finding similar exercises…</p>}
      {list && list.length === 0 && <p className="text-xs text-gray-400 py-1">No similar exercises found.</p>}
      {list?.map((ex) => (
        <button key={ex._id} type="button" onClick={() => onPick(ex)}
          className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2">
          <ExerciseImage images={ex.images} name={ex.name} className="w-10 h-8 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-900 dark:text-gray-100 truncate">
              {ex.name}
              {ex.laterality === 'unilateral' && <span className="text-[10px] text-brand-600 dark:text-brand-400 ml-1">each side</span>}
              {ex.isCustom && <span className="text-[10px] ml-1.5 px-1 rounded bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300">custom</span>}
            </p>
            {ex.shared?.length > 0 && (
              <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate capitalize">{ex.shared.map(short).join(', ')}</p>
            )}
          </div>
          {ex.match != null && <span className="text-[11px] tabular-nums text-gray-400 dark:text-gray-500 shrink-0">{ex.match}%</span>}
        </button>
      ))}
    </div>
  );
}
