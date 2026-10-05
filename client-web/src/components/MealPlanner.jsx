import Modal from './Modal';
import MealPlanOptions from './mealPlan/MealPlanOptions';
import MealPlanView from './mealPlan/MealPlanView';
import { useMealPlan } from '../hooks/useMealPlan';

/**
 * Meal plan to the user's calorie and macro targets (from their profile: BMR ×
 * activity, adjusted for their fitness goal). Each day can be added to the log;
 * `onApplied(date, log)` is called when one is.
 */
export default function MealPlanner({ open, onClose, startDate, onApplied }) {
  const planner = useMealPlan(startDate);

  const addDay = async (index) => {
    const added = await planner.addDayToLog(index);
    if (added) onApplied?.(added.date, added.log);
  };

  return (
    <Modal open={open} onClose={onClose} title="Meal plan" maxWidth="max-w-2xl">
      {planner.plan ? (
        <MealPlanView
          plan={planner.plan}
          dayIndex={planner.dayIndex}
          onSelectDay={planner.setDayIndex}
          dateFor={planner.dateFor}
          addedDates={planner.addedDates}
          busy={planner.busy}
          error={planner.error}
          onShowOptions={planner.clearPlan}
          onRegenerate={planner.regenerate}
          onAddDay={addDay}
        />
      ) : (
        <MealPlanOptions
          options={planner.options}
          setOption={planner.setOption}
          busy={planner.busy}
          error={planner.error}
          onGenerate={() => planner.generate()}
        />
      )}
    </Modal>
  );
}
