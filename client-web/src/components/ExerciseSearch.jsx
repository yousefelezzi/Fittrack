import { useMemo, useState } from 'react';
import ExerciseCombobox from './ExerciseCombobox';
import { MUSCLE_FILTERS, filterByMuscle } from '../utils/exerciseFilters';

/**
 * Exercise search with a muscle filter beside it: pick a muscle to narrow the
 * list to exercises that train it, then search by name. `onPick` gets the id.
 */
export default function ExerciseSearch({ exercises, onPick, placeholder = 'Search exercises', excludeIds = [] }) {
  const [muscle, setMuscle] = useState('');
  const shown = useMemo(
    () => filterByMuscle(exercises, muscle).filter((e) => !excludeIds.includes(e._id)),
    [exercises, muscle, excludeIds.join(',')],
  );
  return (
    <div className="flex gap-2">
      <select className="input text-sm !w-36 shrink-0" value={muscle} onChange={(e) => setMuscle(e.target.value)} aria-label="Filter by muscle">
        <option value="">All muscles</option>
        {MUSCLE_FILTERS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select>
      <ExerciseCombobox className="flex-1 min-w-0" exercises={shown} value="" onChange={onPick}
        placeholder={muscle ? `${placeholder} (${shown.length})` : placeholder} />
    </div>
  );
}
