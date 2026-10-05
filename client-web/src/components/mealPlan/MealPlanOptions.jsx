import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { DIETS, PROFILE_FIELD_NAMES } from '../../constants/nutrition';
import { pill } from './pill';

const MEALS_PER_DAY = [{ value: 3, label: '3 meals' }, { value: 4, label: '3 meals + snack' }, { value: 5, label: '3 meals + 2 snacks' }];
const PLAN_LENGTHS = [{ value: 1, label: '1 day' }, { value: 3, label: '3 days' }, { value: 7, label: 'A week' }];

function Choice({ label, choices, value, onChange }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {choices.map((choice) => (
          <button key={choice.value} type="button" onClick={() => onChange(choice.value)} className={pill(value === choice.value)}>{choice.label}</button>
        ))}
      </div>
    </div>
  );
}

/** The planner's first screen: meals per day, diet and length, then "Make a plan". */
export default function MealPlanOptions({ options, setOption, busy, error, onGenerate }) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Builds meals to your daily calorie and macro targets, worked out from your BMR, activity level and fitness goal.
        Portions are sized so each day lands on your targets.
      </p>
      <Choice label="Meals per day" choices={MEALS_PER_DAY} value={options.mealsPerDay} onChange={(v) => setOption('mealsPerDay', v)} />
      <Choice label="Diet" choices={DIETS} value={options.diet} onChange={(v) => setOption('diet', v)} />
      <Choice label="Days" choices={PLAN_LENGTHS} value={options.days} onChange={(v) => setOption('days', v)} />
      {error && (
        <p className="text-sm text-red-500">
          {error.message}
          {error.missing && <> — add your {error.missing.map((m) => PROFILE_FIELD_NAMES[m] || m).join(', ')} in your <Link to="/profile" className="underline">profile</Link>.</>}
        </p>
      )}
      <button onClick={onGenerate} disabled={busy} className="btn-primary w-full justify-center py-2.5">
        <Sparkles size={16} /> {busy ? 'Planning…' : 'Make a plan'}
      </button>
    </div>
  );
}
