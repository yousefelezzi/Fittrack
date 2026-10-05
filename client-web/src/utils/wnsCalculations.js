/**
 * Weekly Net Stimulus (WNS) calculator — ported from the original
 * vanilla-JS implementation. Pure functions only; no DOM access.
 *
 * Model: Chris Beardsley's Weekly Net Stimulus model, using either the
 * Schoenfeld or Pelland dose-response datasets (or their average).
 */

export function isValidNumber(str) {
  return /^[-+]?\d+(\.\d+)?$/.test(str);
}

// ── Dose-response curves ─────────────────────────────────────────────────

function pelland(x) {
  if (x < 1) return x;
  if (x < 2) return 1 + 0.82 * (x - 1);
  if (x < 3) return 1.82 + 0.68 * (x - 2);
  if (x < 4) return 2.50 + 0.57 * (x - 3);
  if (x < 5) return 3.07 + 0.49 * (x - 4);
  if (x < 6) return 3.56 + 0.44 * (x - 5);
  if (x < 7) return 4.00 + 0.40 * (x - 6);
  if (x < 8) return 4.40 + 0.38 * (x - 7);
  if (x < 9) return 4.78 + 0.38 * (x - 8);
  if (x < 10) return 5.16 + 0.24 * (x - 9);
  if (x < 11) return 5.40 + 0.16 * (x - 10);
  return 5.56 + 0.05 * (x - 11);
}

function schoenfeld(x) {
  if (x < 1) return x;
  if (x < 2) return 1 + 0.39 * (x - 1);
  if (x < 3) return 1.39 + 0.22 * (x - 2);
  if (x < 4) return 1.61 + 0.16 * (x - 3);
  if (x < 5) return 1.77 + 0.13 * (x - 4);
  if (x < 6) return 1.90 + 0.10 * (x - 5);
  if (x < 7) return 2.00 + 0.09 * (x - 6);
  if (x < 8) return 2.09 + 0.07 * (x - 7);
  if (x < 9) return 2.16 + 0.07 * (x - 8);
  if (x < 10) return 2.23 + 0.05 * (x - 9);
  if (x < 11) return 2.28 + 0.05 * (x - 10);
  return 2.31 + 0.02 * (x - 11);
}

function stimulus(sets, dataset) {
  const s = schoenfeld(sets);
  const p = pelland(sets);
  if (dataset === 'P') return +p.toFixed(3);
  if (dataset === 'A') return +((p + s) / 2).toFixed(3);
  return +s.toFixed(3);
}

function weeklyTotalStimulus(freq, sets, dataset) {
  return stimulus(sets, dataset) * freq;
}

function atrophyDays(unit, frequency, stimDuration) {
  if (frequency === 0) return [7.0, false];
  const interval = 7 / frequency;
  if (unit === 'T' && Number.isInteger(frequency) && 2 <= frequency && frequency <= 6) {
    const starts = [];
    for (let i = 0; i < frequency; i++) starts.push(i * Math.round(interval));
    const intervals = starts.map((s) => [s, Math.min(s + stimDuration, 7.0)]);
    const merged = [];
    let overlap = false;
    for (const [s, e] of intervals) {
      if (!merged.length || s > merged[merged.length - 1][1]) {
        merged.push([s, e]);
      } else {
        if (s < merged[merged.length - 1][1]) overlap = true;
        merged[merged.length - 1][1] = e;
      }
      if (s + stimDuration > 7.0) overlap = true;
    }
    const covered = merged.reduce((sum, [s, e]) => sum + (e - s), 0);
    return [+(7.0 - covered).toFixed(3), overlap];
  }
  return [+(Math.max(0, interval - stimDuration) * frequency).toFixed(3), interval + 1e-6 < stimDuration];
}

function atrophyRate(maintenance, stimPeriod, dataset) {
  return stimulus(maintenance, dataset) / atrophyDays('T', 1.0, stimPeriod)[0];
}

function weeklyAtrophy(unit, freq, maintenance, stimPeriod, dataset) {
  return atrophyDays(unit, freq, stimPeriod)[0] * atrophyRate(maintenance, stimPeriod, dataset);
}

function weeklyNetStimulus(unit, freq, sets, maintenance, stimPeriod, dataset) {
  const totalStim = weeklyTotalStimulus(freq, sets, dataset);
  const totalAtrophy = weeklyAtrophy(unit, freq, maintenance, stimPeriod, dataset);
  return (totalStim - totalAtrophy).toFixed(2);
}

function maxRecoverableVolume(freq) {
  if (freq <= 0) return Infinity;
  if (freq < 2) return 12 / freq;
  if (freq > 3.5) return 7 / freq;
  return 10.5 / freq;
}

// ── Effective sets ───────────────────────────────────────────────────────

/**
 * How much of a set counts as stimulus. Only the last 5 reps before failure
 * are stimulating, so a set of `reps` stopped `rir` reps short of failure
 * counts min(reps, 5 − rir) / 5: 10 reps at 0 RIR = 1, at 2 RIR = 0.6;
 * 3 reps at 0 RIR = 0.6. Blank reps or RIR count as a full set's worth.
 * Same formula as the server (server/utils/wns.js).
 */
export function effectiveSetFactor(reps, rir) {
  const r = rir === '' || rir == null || !Number.isFinite(Number(rir)) ? 0 : Math.max(0, Number(rir));
  const n = Number(reps) > 0 ? Number(reps) : 5;
  return Math.min(n, Math.max(0, 5 - r)) / 5;
}

// ── Field validation (returns an error message or null) ─────────────────

/** Reps per set: optional, a whole number from 1 to 100. */
export function validateRepsValue(value) {
  const v = String(value ?? '').trim();
  if (v === '') return null;
  if (!/^\d+$/.test(v) || Number(v) < 1 || Number(v) > 100) return 'Whole number, 1–100';
  return null;
}

/** Reps in reserve: optional, 0 to 10 (halves allowed, e.g. 1.5). */
export function validateRirValue(value) {
  const v = String(value ?? '').trim();
  if (v === '') return null;
  if (!isValidNumber(v) || Number(v) < 0 || Number(v) > 10) return '0–10';
  return null;
}

export function validateSetsValue(value) {
  const v = (value ?? '').trim();
  if (v !== '' && !isValidNumber(v)) return 'Invalid input';
  if (v === '') return 'Required field';
  if (parseFloat(v) < 0) return 'Value must not be negative';
  return null;
}

export function validateFreqValue(value, unit) {
  const v = (value ?? '').trim();
  if (v !== '' && !isValidNumber(v)) return 'Invalid input';
  if (v === '') return 'Required field';
  let num = parseFloat(v);
  if (unit === 'H') num = num !== 0 ? 168 / num : Infinity;
  if (unit === 'D') num = num !== 0 ? 7 / num : Infinity;
  if (num < 1 || num > 7) return 'Value must be in range';
  return null;
}

export function validateMaintValue(value) {
  const v = (value ?? '').trim();
  if (v !== '' && !isValidNumber(v)) return 'Invalid input';
  if (v === '') return 'Required field';
  const num = parseFloat(v);
  if (num < 1 || num > 5) return 'Value must be in range';
  return null;
}

export function validateStimValue(value) {
  const v = (value ?? '').trim();
  if (v !== '' && !isValidNumber(v)) return 'Invalid input';
  if (v === '') return 'Required field';
  const num = parseFloat(v);
  if (num < 12 || num > 72) return 'Value must be in range';
  return null;
}

// ── Main result computation ──────────────────────────────────────────────

/**
 * @returns {{ text: string, resultClass: string|null, warning: {text:string, className:string}|null }}
 */
export function computeWNSResult({ unit, freq: freqRaw, sets: setsRaw, maintenance: maintRaw, stimHours: stimRaw, dataset }) {
  let freq = parseFloat(freqRaw);
  const sets = parseFloat(setsRaw);
  const maintenance = parseFloat(maintRaw);
  const stimHours = parseFloat(stimRaw);

  if (unit === 'H') freq = 168 / freq;
  if (unit === 'D') freq = 7 / freq;
  if (sets === 0) freq = 0;

  const stimPeriod = stimHours / 24;
  const wns = weeklyNetStimulus(unit, freq, sets, maintenance, stimPeriod, dataset);

  let recovery = sets / maxRecoverableVolume(freq);
  if (atrophyDays(unit, freq, stimPeriod)[1]) recovery += 0.25;

  if (recovery > 1.25) {
    return {
      text: 'Weekly net stimulus: N/A',
      resultClass: null,
      warning: { text: 'Not recoverable!', className: 'veryHigh' },
    };
  }

  const mid = 0;
  let min = -3;
  let max = 2.5;
  if (dataset === 'P') max = 5;
  else if (dataset === 'A') max = 3.5;

  let resultClass;
  if (wns >= max) resultClass = 'veryHigh';
  else if (wns >= 0.7 * max) resultClass = 'High';
  else if (wns >= 0.5 * max) resultClass = 'Low';
  else if (wns >= 0.2 * max) resultClass = 'veryLow';
  else if (wns >= mid) resultClass = 'Medium';
  else if (wns >= 0.5 * min) resultClass = 'Bad';
  else resultClass = 'veryBad';

  let warning = null;
  if (recovery > 1) warning = { text: 'Recovery demand: Extremely high', className: 'veryHigh' };
  else if (recovery > 0.75) warning = { text: 'Recovery demand: High', className: 'High' };
  else if (recovery > 0.5) warning = { text: 'Recovery demand: Medium', className: 'Medium' };
  else if (recovery > 0.25) warning = { text: 'Recovery demand: Low', className: 'Low' };
  else if (recovery > 0) warning = { text: 'Recovery demand: Very low', className: 'veryLow' };

  return {
    text: `Weekly net stimulus: ${(wns >= 0 ? '+' : '') + wns} a.u.`,
    resultClass,
    warning,
  };
}

// ── WNS from logged workouts ─────────────────────────────────────────────

export const WNS_DEFAULTS = { dataset: 'S', maintenance: 3, stimHours: 48, windowDays: 14 };

/**
 * Weekly net stimulus for one muscle from real workout dates, using the same
 * model as the calculator: each workout adds stimulus(sets) and keeps the muscle
 * growing for `stimHours`; any time not covered by a workout counts as atrophy,
 * at the rate where `maintenance` sets once a week breaks even.
 *
 * The last `windowDays` are treated as a repeating cycle (like the calculator's
 * repeating week): a recent workout's stimulus that runs past today wraps round
 * to the start of the window. Scaled to a week, evenly spaced workouts give the
 * same number as the calculator.
 *
 * @param sessions [{ date, sets }] sets for this muscle in each workout (any order)
 * @returns {{ wns: number, sessions: number, sets: number }} over the window
 */
export function wnsFromSessions(sessions, {
  dataset = WNS_DEFAULTS.dataset,
  maintenance = WNS_DEFAULTS.maintenance,
  stimHours = WNS_DEFAULTS.stimHours,
  windowDays = WNS_DEFAULTS.windowDays,
  now = new Date(),
} = {}) {
  const DAY = 24 * 60 * 60 * 1000;
  const end = now.getTime();
  const len = windowDays * DAY;
  const start = end - len;
  const stimMs = Math.min(stimHours * 60 * 60 * 1000, len);

  const inWindow = sessions
    .map((s) => ({ t: new Date(s.date).getTime(), sets: Number(s.sets) || 0 }))
    .filter((s) => s.sets > 0 && s.t >= start && s.t <= end);

  // Stimulus intervals as offsets into the window, wrapping past the end.
  const intervals = [];
  for (const { t } of inWindow) {
    const a = t - start;
    const b = a + stimMs;
    if (b <= len) intervals.push([a, b]);
    else { intervals.push([a, len]); intervals.push([0, b - len]); }
  }
  intervals.sort((x, y) => x[0] - y[0]);
  let covered = 0;
  let cur = null;
  for (const [a, b] of intervals) {
    if (!cur || a > cur[1]) { if (cur) covered += cur[1] - cur[0]; cur = [a, b]; }
    else cur[1] = Math.max(cur[1], b);
  }
  if (cur) covered += cur[1] - cur[0];

  const totalStim = inWindow.reduce((sum, s) => sum + stimulus(s.sets, dataset), 0);
  const atrophyDaysInWindow = windowDays - covered / DAY;
  const ratePerDay = stimulus(maintenance, dataset) / (7 - stimHours / 24);
  const wns = (totalStim - atrophyDaysInWindow * ratePerDay) * (7 / windowDays);

  return {
    wns: +wns.toFixed(2),
    sessions: inWindow.length,
    sets: inWindow.reduce((sum, s) => sum + s.sets, 0),
  };
}
