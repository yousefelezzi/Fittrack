import { format, parseISO } from 'date-fns';
import { RefreshCw, Check } from 'lucide-react';
import { formatServing } from '../../utils/servings';
import PlanTotals from './PlanTotals';
import { pill } from './pill';

// "… to lose weight (20% deficit, …)": the plan's fitness goal as a phrase.
const GOAL_PHRASES = { lose_weight: 'lose weight', build_muscle: 'build muscle', improve_endurance: 'improve endurance', stay_active: 'stay active', other: 'your goal' };
const round = Math.round;
const showDate = (date, pattern) => format(parseISO(date), pattern);

function PlanTargets({ targets, basis }) {
  return (
    <p className="text-xs text-gray-500 dark:text-gray-400">
      Daily target: <span className="font-medium text-gray-700 dark:text-gray-300">{round(targets.calories)} kcal</span>
      {' '}· P {round(targets.protein)}g · C {round(targets.carbs)}g · F {round(targets.fat)}g
      {basis && <> — to {GOAL_PHRASES[basis.goal] || 'reach your goal'} ({basis.adjustment}, maintenance ≈ {basis.maintenance} kcal)</>}
    </p>
  );
}

function PlannedMeal({ meal }) {
  const { totals } = meal;
  return (
    <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-3">
      <div className="flex items-baseline justify-between mb-1.5">
        <p className="text-sm font-semibold capitalize text-gray-900 dark:text-gray-100">{meal.mealType}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">{round(totals.calories)} kcal · P {round(totals.protein)} · C {round(totals.carbs)} · F {round(totals.fat)}</p>
      </div>
      <ul className="space-y-0.5">
        {meal.foods.map((f, i) => (
          <li key={i} className="flex justify-between gap-3 text-sm">
            <span className="text-gray-800 dark:text-gray-200 truncate">{f.food.name}</span>
            <span className="text-gray-500 dark:text-gray-400 shrink-0 tabular-nums">{formatServing(f.food, f.grams)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The planner's second screen: one day of the plan at a time, with a button to add it to the log. */
export default function MealPlanView({ plan, dayIndex, onSelectDay, dateFor, addedDates, busy, error, onShowOptions, onRegenerate, onAddDay }) {
  const day = plan.days[dayIndex];
  const addedTo = addedDates[dayIndex];
  return (
    <div className="space-y-4">
      <PlanTargets targets={plan.targets} basis={plan.basis} />

      {plan.days.length > 1 && (
        <div className="flex gap-1 flex-wrap">
          {plan.days.map((d, i) => (
            <button key={d.day} onClick={() => onSelectDay(i)} className={pill(dayIndex === i)}>
              {showDate(dateFor(i), 'EEE d')}{addedDates[i] ? ' ✓' : ''}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {day.meals.map((meal, i) => <PlannedMeal key={i} meal={meal} />)}
      </div>

      <PlanTotals totals={day.totals} targets={plan.targets} />

      {error && <p className="text-sm text-red-500">{error.message}</p>}
      <div className="flex flex-wrap gap-2">
        <button onClick={onShowOptions} className="btn-secondary">Options</button>
        <button onClick={onRegenerate} disabled={busy} className="btn-secondary"><RefreshCw size={15} /> New plan</button>
        <button onClick={() => onAddDay(dayIndex)} disabled={busy || !!addedTo} className="btn-primary flex-1 justify-center">
          {addedTo
            ? <><Check size={15} /> Added to {showDate(addedTo, 'EEE, MMM d')}</>
            : `Add to log for ${showDate(dateFor(dayIndex), 'EEE, MMM d')}`}
        </button>
      </div>
      <p className="text-[11px] text-gray-400 dark:text-gray-500">
        Each food is added as its own entry, so you can change portions or delete anything afterwards like any other meal.
      </p>
    </div>
  );
}
