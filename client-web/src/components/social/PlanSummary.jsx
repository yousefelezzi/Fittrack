import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, ChevronDown, ChevronUp, BookmarkPlus, Check } from 'lucide-react';
import { planAPI } from '../../api';
import { typeOf } from '../../utils/exerciseTypes';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dayName = (plan, d) => d.label || (plan.schedule === 'rotation' ? `Workout ${d.dayOfWeek + 1}` : DAYS[d.dayOfWeek]);
const target = (e) => {
  const type = typeOf(e.exercise);
  const amount = type === 'yielding' ? `${e.targetReps}s` : type === 'overcoming' ? `${e.targetReps} bursts` : `${e.targetReps}${e.targetRepsMax ? `–${e.targetRepsMax}` : ''}`;
  return `${e.targetSets} × ${amount}`;
};

/**
 * A shared workout plan (every day of it): tap to see each day's exercises.
 * With `source` ({ postId } / { messageId }) it can be saved to your plans.
 */
export default function PlanSummary({ plan, source }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState('idle'); // idle | saving | saved | error
  const [error, setError] = useState('');
  if (!plan) return null;
  const days = [...(plan.days || [])].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  const exerciseCount = days.reduce((n, d) => n + (d.exercises?.length || 0), 0);

  const save = async () => {
    setState('saving');
    try {
      await planAPI.fromShared({ planId: plan._id, ...source });
      setState('saved');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save it');
      setState('error');
    }
  };

  return (
    <div className="rounded-xl border border-violet-100 dark:border-violet-900/50 bg-violet-50/60 dark:bg-violet-900/20 overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 p-3 text-left">
        <div className="w-9 h-9 rounded-lg bg-violet-600 text-white flex items-center justify-center shrink-0"><ClipboardList size={16} /></div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{plan.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Plan · {days.length} workout{days.length !== 1 ? 's' : ''} · {exerciseCount} exercises · {plan.schedule === 'rotation' ? 'rotation' : 'weekly'}
          </p>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>
      {open && (
        <div className="border-t border-violet-100 dark:border-violet-900/50 px-3 py-2 space-y-2">
          {plan.description && <p className="text-xs text-gray-500 dark:text-gray-400">{plan.description}</p>}
          {days.map((d) => (
            <div key={d.dayOfWeek}>
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{dayName(plan, d)}</p>
              {(d.exercises || []).length === 0 ? <p className="text-xs text-gray-400">Rest / no exercises</p> : (
                <ul className="text-xs text-gray-500 dark:text-gray-400">
                  {d.exercises.filter((e) => e.exercise).map((e, i) => (
                    <li key={i} className="flex justify-between gap-2"><span className="truncate">{e.exercise.name}</span><span className="shrink-0">{target(e)}</span></li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
      {source && (
        state === 'saved' ? (
          <p className="flex items-center gap-1.5 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400 border-t border-violet-100 dark:border-violet-900/50">
            <Check size={13} /> Saved to your plans · <Link to="/plans" className="underline">Plans</Link>
          </p>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 border-t border-violet-100 dark:border-violet-900/50">
            <button type="button" onClick={save} disabled={state === 'saving'} className="flex items-center gap-1.5 text-xs font-medium text-violet-600 hover:text-violet-700 disabled:opacity-50">
              <BookmarkPlus size={14} /> {state === 'saving' ? 'Saving…' : 'Save plan to my plans'}
            </button>
            {state === 'error' && <span className="text-xs text-red-500">{error}</span>}
          </div>
        )
      )}
    </div>
  );
}
