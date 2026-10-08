/**
 * Wording for the plateau detector (GET /workouts/plateaus). Shared by the web
 * and mobile clients (mobile imports it through its Metro config). Pure JS only.
 */
import { formatWeight } from './weightUnits';

const shortDate = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/** "Est. 1RM stuck at 130 kg since Sep 10 · 4 sessions". e1RM is in kg; `unit` is the user's lifting unit. */
export function plateauLine(p, unit = 'kg') {
  const best = p.kind === 'e1rm' ? `est. 1RM stuck at ${formatWeight(p.best, unit)}`
    : p.kind === 'seconds' ? `best hold stuck at ${p.best}s` : `best set stuck at ${p.best} reps`;
  return `${best.charAt(0).toUpperCase()}${best.slice(1)} since ${shortDate(p.since)} · ${p.sessions} sessions`;
}

/** Ways to break a plateau, shown under the list. */
export const PLATEAU_TIPS = [
  'Add a rep before adding weight: aim to beat last time by one rep at the same load.',
  'Take sets closer to failure (0–1 RIR on the last set), or add one set a week.',
  'Change the rep range for a few weeks (e.g. 6–8 instead of 10–12).',
  'Swap to a similar exercise for a block, then come back to it.',
  'Check recovery: sleep, enough calories and protein, or take a lighter deload week.',
];
