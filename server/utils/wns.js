/**
 * Weekly Net Stimulus model (server copy). Same curves and maths as
 * client-web/src/utils/wnsCalculations.js — keep the two in sync.
 */
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

function stimulus(sets, dataset = 'S') {
  const s = schoenfeld(sets);
  const p = pelland(sets);
  if (dataset === 'P') return p;
  if (dataset === 'A') return (p + s) / 2;
  return s;
}

/**
 * How much of a set counts as stimulus. Only the last 5 reps before failure
 * are stimulating, so a set of `reps` stopped `rir` reps short of failure
 * counts min(reps, 5 − rir) / 5: 10 reps at 0 RIR = 1, at 2 RIR = 0.6;
 * 3 reps at 0 RIR = 0.6. Missing reps or RIR count as a full set's worth.
 * Same formula as the WNS calculator (client-web/src/utils/wnsCalculations.js).
 */
function effectiveSets(reps, rir) {
  const r = Number.isFinite(Number(rir)) && rir !== '' && rir != null ? Math.max(0, Number(rir)) : 0;
  const n = Number(reps) > 0 ? Number(reps) : 5;
  return Math.min(n, Math.max(0, 5 - r)) / 5;
}

/** A planned RIR as a number: "1–2" → 1.5, "2" → 2, "" or missing → null. */
function rirValue(text) {
  if (text == null || text === '') return null;
  const nums = String(text).split(/[–-]/).map(Number).filter(Number.isFinite);
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

/**
 * WNS for one muscle over a repeating cycle, per week. The cycle is normally a
 * 7-day week; rotations use longer or shorter ones (A/B alternating over two
 * weeks = 14 days, every other day A/B = 4 days).
 * @param sessions [{ day: offset in the cycle, sets }]
 */
function weeklyNet(sessions, { dataset = 'S', maintenance = 3, stimHours = 48, cycleDays = 7 } = {}) {
  const L = cycleDays;
  const stimDays = Math.min(stimHours / 24, L);
  const active = sessions.filter((s) => s.sets > 0);
  const intervals = [];
  for (const { day } of active) {
    const end = day + stimDays;
    if (end <= L) intervals.push([day, end]);
    else { intervals.push([day, L]); intervals.push([0, end - L]); }
  }
  intervals.sort((a, b) => a[0] - b[0]);
  let covered = 0;
  let cur = null;
  for (const [a, b] of intervals) {
    if (!cur || a > cur[1]) { if (cur) covered += cur[1] - cur[0]; cur = [a, b]; }
    else cur[1] = Math.max(cur[1], b);
  }
  if (cur) covered += cur[1] - cur[0];

  const total = active.reduce((sum, s) => sum + stimulus(s.sets, dataset), 0);
  const ratePerDay = stimulus(maintenance, dataset) / (7 - Math.min(stimDays, 7));
  return (total - (L - covered) * ratePerDay) * (7 / L);
}

// Max sets per session a muscle can recover from at a given weekly frequency.
function maxRecoverableVolume(freq) {
  if (freq <= 0) return Infinity;
  if (freq < 2) return 12 / freq;
  if (freq > 3.5) return 7 / freq;
  return 10.5 / freq;
}

/**
 * Recovery demand for one muscle over a repeating week, as in the calculator:
 * sets per session ÷ what's recoverable at that frequency, +0.25 if sessions
 * come back before the previous stimulus is over. Uses the biggest session.
 * @param sessions [{ day: 0–6, sets }]
 * @returns {{ value: number, level: 'none'|'veryLow'|'low'|'medium'|'high'|'extreme'|'unrecoverable' }}
 */
function recoveryDemand(sessions, { stimHours = 48, cycleDays = 7 } = {}) {
  const L = cycleDays;
  const active = sessions.filter((s) => s.sets > 0).sort((a, b) => a.day - b.day);
  if (active.length === 0) return { value: 0, level: 'none' };
  const stimDays = stimHours / 24;
  let overlap = false;
  if (active.length > 1) {
    for (let i = 0; i < active.length; i++) {
      const next = active[(i + 1) % active.length];
      const gap = (next.day - active[i].day + L) % L || L;
      if (gap < stimDays - 1e-9) overlap = true;
    }
  } else if (L < stimDays - 1e-9) {
    overlap = true; // e.g. the same workout every day
  }
  const perWeek = active.length * (7 / L); // e.g. 1 session every 2 days = 3.5×/week
  const perSession = Math.max(...active.map((s) => s.sets));
  const value = perSession / maxRecoverableVolume(perWeek) + (overlap ? 0.25 : 0);
  const level = value > 1.25 ? 'unrecoverable' : value > 1 ? 'extreme' : value > 0.75 ? 'high'
    : value > 0.5 ? 'medium' : value > 0.25 ? 'low' : 'veryLow';
  return { value, level };
}

module.exports = { stimulus, weeklyNet, recoveryDemand, effectiveSets, rirValue };
