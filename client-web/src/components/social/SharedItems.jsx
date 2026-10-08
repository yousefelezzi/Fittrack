import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Dumbbell, Utensils, ChevronDown, ChevronUp, BookmarkPlus, Check } from 'lucide-react';
import ExerciseImage from '../ExerciseImage';
import { exerciseAPI, foodAPI } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { exerciseSummary, foodServing, isRecipe } from '../../utils/sharedItems';

/** Save button with saving / saved / error states. */
function SaveRow({ label, savedLabel, link, onSave, tone }) {
  const [state, setState] = useState('idle');
  const [error, setError] = useState('');
  const save = async () => {
    setState('saving');
    try { await onSave(); setState('saved'); } catch (err) { setError(err.response?.data?.message || 'Could not save it'); setState('error'); }
  };
  return state === 'saved' ? (
    <p className="flex items-center gap-1.5 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400 border-t border-gray-100 dark:border-gray-800">
      <Check size={13} /> {savedLabel} · <Link to={link} className="underline">Open</Link>
    </p>
  ) : (
    <div className="flex items-center gap-2 px-3 py-2 border-t border-gray-100 dark:border-gray-800">
      <button type="button" onClick={save} disabled={state === 'saving'} className={`flex items-center gap-1.5 text-xs font-medium ${tone} disabled:opacity-50`}>
        <BookmarkPlus size={14} /> {state === 'saving' ? 'Saving…' : label}
      </button>
      {state === 'error' && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}

/**
 * Someone's custom exercise in a post or message. With `source`
 * ({ postId } / { messageId }) it can be saved to your exercises.
 */
export function SharedExercise({ exercise, source }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  if (!exercise) return null;
  const mine = String(exercise.createdBy) === String(user?._id);
  return (
    <div className="rounded-xl border border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-900/15 overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 p-3 text-left">
        {exercise.images?.length ? <ExerciseImage images={exercise.images} name={exercise.name} className="w-12 h-9 shrink-0" />
          : <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0"><Dumbbell size={16} /></div>}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{exercise.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 capitalize truncate">Exercise · {exerciseSummary(exercise)}</p>
        </div>
        {exercise.instructions?.length > 0 && (open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />)}
      </button>
      {open && exercise.instructions?.length > 0 && (
        <ol className="list-decimal pl-8 pr-3 pb-2 space-y-0.5 text-xs text-gray-600 dark:text-gray-400">
          {exercise.instructions.map((step, i) => <li key={i}>{step}</li>)}
        </ol>
      )}
      {source && !mine && (
        <SaveRow label="Save to my exercises" savedLabel="Saved to your exercises" link="/exercises" tone="text-emerald-600 hover:text-emerald-700"
          onSave={() => exerciseAPI.fromShared({ exerciseId: exercise._id, ...source })} />
      )}
    </div>
  );
}

/**
 * A custom food or recipe in a post or message. With `source` it can be saved
 * to your foods (it then shows under "Your foods" when you log food).
 */
export function SharedFood({ food, source }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  if (!food) return null;
  const sv = foodServing(food);
  const recipe = isRecipe(food);
  const mine = String(food.createdBy) === String(user?._id);
  return (
    <div className="rounded-xl border border-orange-100 dark:border-orange-900/50 bg-orange-50/50 dark:bg-orange-900/15 overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 p-3 text-left">
        <div className="w-9 h-9 rounded-lg bg-orange-500 text-white flex items-center justify-center shrink-0"><Utensils size={16} /></div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{food.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {recipe ? `Recipe · ${food.ingredients.length} ingredients` : 'Food'} · {sv.label}: {sv.kcal} kcal · P {sv.p}g · C {sv.c}g · F {sv.f}g
          </p>
        </div>
        {recipe && (open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />)}
      </button>
      {open && recipe && (
        <ul className="px-3 pb-2 space-y-0.5 text-xs text-gray-600 dark:text-gray-400">
          {food.ingredients.map((ing, i) => (
            <li key={i} className="flex justify-between gap-2"><span className="truncate">{ing.name}</span><span className="shrink-0">{Math.round(ing.grams)} g</span></li>
          ))}
        </ul>
      )}
      {source && !mine && (
        <SaveRow label="Save to my foods" savedLabel="Saved to your foods" link="/nutrition" tone="text-orange-600 hover:text-orange-700"
          onSave={() => foodAPI.save({ foodId: food._id, ...source })} />
      )}
    </div>
  );
}
