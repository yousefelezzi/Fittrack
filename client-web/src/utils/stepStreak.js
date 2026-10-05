/**
 * Days in a row the step goal was reached, counting back from today. Today
 * only adds once it's reached; not reaching it yet doesn't break the streak.
 * Shared by the web and mobile clients.
 *
 * @param days [{ date, steps }] from GET /steps (dates are UTC midnight of the day)
 */
export function stepStreak(days, goal, now = new Date()) {
  const byDay = new Map((days || []).map((d) => [String(d.date).slice(0, 10), d.steps]));
  const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  let streak = 0;
  const day = new Date(now);
  for (let i = 0; i < 400; i++) {
    const reached = (byDay.get(key(day)) || 0) >= goal;
    if (reached) streak++;
    else if (i > 0) break; // today not reached yet is fine
    day.setDate(day.getDate() - 1);
  }
  return streak;
}
