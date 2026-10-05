import { useState } from 'react';
import { format, addDays, parseISO } from 'date-fns';
import { nutritionAPI } from '../api';

const randomSeed = () => Math.floor(Math.random() * 1e6);

/**
 * Meal plan state for the planner modal: the options, the plan the server made
 * from them, the day being looked at, and which days have been added to the log.
 * Day i of the plan is for `startDate` + i days.
 */
export function useMealPlan(startDate) {
  const [options, setOptions] = useState({ mealsPerDay: 4, diet: 'any', days: 1 });
  const [seed, setSeed] = useState(randomSeed);
  const [plan, setPlan] = useState(null);
  const [dayIndex, setDayIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [addedDates, setAddedDates] = useState({}); // day index → date it was added to

  const dateFor = (index) => format(addDays(parseISO(startDate), index), 'yyyy-MM-dd');
  const setOption = (key, value) => setOptions((current) => ({ ...current, [key]: value }));

  // Runs a request with the busy flag set; a failure becomes `error`.
  const request = async (send, toError) => {
    setBusy(true);
    setError(null);
    try {
      return await send();
    } catch (err) {
      setError(toError(err.response?.data));
      return null;
    } finally {
      setBusy(false);
    }
  };

  /** Make a plan from the current options. The same seed gives the same plan. */
  const generate = (planSeed = seed) => request(async () => {
    const { data } = await nutritionAPI.mealPlan({ ...options, seed: planSeed });
    setPlan(data);
    setDayIndex(0);
    setAddedDates({});
  }, (data) => data || { message: 'Could not make a plan' });

  /** A different plan with the same options. */
  const regenerate = () => {
    const next = randomSeed();
    setSeed(next);
    return generate(next);
  };

  /** Add one day of the plan to the log. Returns { date, log }, or null if it failed. */
  const addDayToLog = (index) => request(async () => {
    const date = dateFor(index);
    const { data } = await nutritionAPI.applyPlan({ date, meals: toLogMeals(plan.days[index]) });
    setAddedDates((current) => ({ ...current, [index]: date }));
    return { date, log: data };
  }, (data) => ({ message: data?.message || 'Could not add to the log' }));

  return {
    options, setOption,
    plan, clearPlan: () => setPlan(null),
    dayIndex, setDayIndex,
    busy, error, addedDates, dateFor,
    generate, regenerate, addDayToLog,
  };
}

// Only food ids and grams go to the server; it works out the nutrition itself.
function toLogMeals(day) {
  return day.meals.map((meal) => ({
    mealType: meal.mealType,
    foods: meal.foods.map((f) => ({ foodId: f.food._id, grams: f.grams })),
  }));
}
