import { useState } from 'react';
import { Sparkles, RefreshCw, AlertTriangle, Repeat } from 'lucide-react';
import SimilarExercises from './SimilarExercises';
import Modal from './Modal';
import { planAPI } from '../api';

import { SPLIT_OPTIONS, EQUIPMENT_OPTIONS as EQUIPMENT, PRIORITY_OPTIONS, unitLabel } from '../utils/planAnalysis';
import StimulusTable from './StimulusTable';
import ManualPlanBuilder from './ManualPlanBuilder';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const pill = (active) => `px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
  active ? 'bg-brand-600 text-white border-brand-600'
    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-brand-400'}`;

/**
 * Generates a low-volume, high-frequency full-body plan on the server, shows a
 * preview with the weekly net stimulus per muscle, and saves it as a plan.
 */
export default function PlanGenerator({ open, onClose, onSaved }) {
  const [mode, setMode]             = useState('generate'); // 'generate' | 'manual'
  const [days, setDays]             = useState(4);
  const [split, setSplit]           = useState('ul');
  const [preferCustom, setPreferCustom] = useState(true);
  const [variation, setVariation]   = useState('ab'); // 'ab' | 'repeat'
  const [level, setLevel]           = useState('intermediate');
  const [exclude, setExclude]       = useState([]);
  const [maxSets, setMaxSets]       = useState(16); // working sets per session
  const [maxExercises, setMaxExercises] = useState(6);
  const [equipment, setEquipment]   = useState(EQUIPMENT.map(([k]) => k));
  const [priorities, setPriorities] = useState([]);
  const [result, setResult]         = useState(null);
  const [busy, setBusy]             = useState(false);
  const [error, setError]           = useState('');
  const [swapping, setSwapping]     = useState(null); // { label, exerciseId } being replaced

  const toggle = (list, setList, v) => setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  // `change` applies a suggested fix (e.g. { variation: 'repeat' }) and regenerates.
  const generate = async (change = {}) => {
    if (change.variation) setVariation(change.variation);
    if (change.maxSets) setMaxSets(change.maxSets);
    if (change.maxExercises) setMaxExercises(change.maxExercises);
    if (change.daysPerWeek) { setDays(change.daysPerWeek); setSplit(SPLIT_OPTIONS[change.daysPerWeek][0][0]); }
    if (change.priorities) setPriorities(change.priorities);
    setBusy(true);
    setError('');
    try {
      const { data } = await planAPI.generate({
        daysPerWeek: days, split, variation, level, exclude, maxSets, maxExercises, equipment, priorities, preferCustom,
        ...change,
        ...(change.daysPerWeek && { split: SPLIT_OPTIONS[change.daysPerWeek][0][0] }),
      });
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not generate a plan');
    } finally {
      setBusy(false);
    }
  };

  // Replace an exercise in every day of that session (e.g. both "Upper A" days),
  // keeping its sets, reps and RIR, then re-check WNS and recovery.
  const replaceExercise = async (label, oldId, ex) => {
    const plan = {
      ...result.plan,
      days: result.plan.days.map((d) => (d.label !== label ? d : {
        ...d,
        exercises: d.exercises.map((e) => (String(e.exercise._id) === String(oldId) ? { ...e, exercise: ex } : e)),
      })),
    };
    setResult((r) => ({ ...r, plan }));
    setSwapping(null);
    try {
      const { data } = await planAPI.analyze({
        days: plan.days.map((d) => ({ dayOfWeek: d.dayOfWeek, exercises: d.exercises.map((e) => ({ exercise: e.exercise._id, targetSets: e.targetSets, targetReps: e.targetReps, targetRir: e.targetRir })) })),
        schedule: plan.schedule,
        rotation: plan.rotation,
        priorities,
        level,
      });
      setResult((r) => ({ ...r, analysis: { ...r.analysis, units: data.units } }));
    } catch {
      // keep the old numbers if the check fails; the swap itself still stands
    }
  };

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const { plan } = result;
      const { data } = await planAPI.create({
        name: plan.name,
        description: plan.description,
        days: plan.days.map((d) => ({ ...d, exercises: d.exercises.map((e) => ({ ...e, exercise: e.exercise._id })) })),
        schedule: plan.schedule || 'weekly',
        ...(plan.rotation && { rotation: plan.rotation }),
      });
      onSaved(data);
      setResult(null);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save the plan');
    } finally {
      setBusy(false);
    }
  };

  // Show each template once, with the days it runs on.
  const templates = [];
  for (const d of result?.plan.days || []) {
    const t = templates.find((x) => x.label === d.label);
    if (t) t.days.push(d.dayOfWeek); else templates.push({ label: d.label, days: [d.dayOfWeek], exercises: d.exercises });
  }
  const units = result?.analysis.units || [];
  const required = units.filter((u) => u.required);
  const low = required.filter((u) => u.wns < u.target);
  const losing = required.filter((u) => u.wns < 0);

  return (
    <Modal open={open} onClose={onClose} title="Workout planner" maxWidth="max-w-2xl">
      <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl mb-5">
        {[['generate', 'Generate for me', 'Picks exercises and sets'], ['manual', 'Build my own', 'You choose; stimulus updates live']].map(([k, label, hint]) => (
          <button key={k} type="button" onClick={() => setMode(k)}
            className={`px-3 py-2 rounded-lg text-left transition-colors ${mode === k ? 'bg-white dark:bg-gray-900 shadow-sm' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}>
            <p className={`text-sm font-medium ${mode === k ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}>{label}</p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">{hint}</p>
          </button>
        ))}
      </div>
      {mode === 'manual' ? (
        <ManualPlanBuilder onSaved={(plan) => { onSaved(plan); onClose(); }} />
      ) : !result ? (
        <div className="space-y-5">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Builds a low-volume, high-frequency plan. It picks compound exercises that overlap several muscles
            (e.g. an incline press and a pullover cover chest, front delts and both triceps heads), then adds sets where they
            raise weekly net stimulus the most. Schoenfeld dose-response, 3 maintenance sets, 48 h stimulus.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Experience</label>
            <div className="flex flex-wrap gap-2">
              {[['beginner', 'Beginner'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']].map(([k, label]) => (
                <button key={k} type="button" onClick={() => setLevel(k)} className={pill(level === k)}>{label}</button>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
              {level === 'beginner' && 'Full-body days of 6–7 compound lifts with more sets each. Muscles only isolation work reaches (e.g. biceps, calves, abs) are left out unless you prioritise them.'}
              {level === 'intermediate' && 'A balance of compound lifts and isolation work.'}
              {level === 'advanced' && 'More exercises with fewer sets each, with extra isolation work.'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Days per week</label>
            <div className="flex gap-2">
              {[2, 3, 4, 5, 6].map((n) => (
                <button key={n} type="button" onClick={() => { setDays(n); setSplit(SPLIT_OPTIONS[n][0][0]); }} className={pill(days === n)}>{n}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Split</label>
            <div className="flex flex-wrap gap-2">
              {SPLIT_OPTIONS[days].map(([k, label]) => (
                <button key={k} type="button" onClick={() => setSplit(k)} className={pill(split === k)}>{label}</button>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">Days are spaced so each muscle gets about 48–72 h between sessions.</p>
          </div>

          {/* Only matters when a session comes round more than once a week (every split except 5 days) */}
          {days !== 5 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Repeated sessions</label>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setVariation('ab')} className={pill(variation === 'ab')}>A/B days (alternate exercises)</button>
                <button type="button" onClick={() => setVariation('repeat')} className={pill(variation === 'repeat')}>Same workout each time</button>
              </div>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                {variation === 'ab'
                  ? 'Two versions of each session alternate, e.g. Upper A uses a barbell bench, Upper B a decline press.'
                  : 'Each session is identical every time, so you repeat the same lifts and can track them week to week.'}
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Per session, at most</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Working sets', maxSets, setMaxSets, 4, 40],
                ['Exercises', maxExercises, setMaxExercises, 2, 12],
              ].map(([label, value, set, min, max]) => (
                <div key={label} className="flex items-center justify-between gap-2 rounded-xl bg-gray-50 dark:bg-gray-800 px-3 py-2">
                  <span className="text-sm text-gray-600 dark:text-gray-300">{label}</span>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => set(Math.max(min, value - 1))} disabled={value <= min}
                      className="w-7 h-7 rounded-lg bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 disabled:opacity-40">−</button>
                    <span className="w-6 text-center text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{value}</span>
                    <button type="button" onClick={() => set(Math.min(max, value + 1))} disabled={value >= max}
                      className="w-7 h-7 rounded-lg bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 disabled:opacity-40">+</button>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">Warm-up sets don't count. The plan may use fewer if recovery limits are reached first.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Equipment you have</label>
            <div className="flex flex-wrap gap-2">
              {EQUIPMENT.map(([k, label]) => (
                <button key={k} type="button" onClick={() => toggle(equipment, setEquipment, k)} className={pill(equipment.includes(k))}>{label}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Priorities <span className="font-normal text-gray-400">· optional</span>
            </label>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-2">
              Prioritised muscles get a higher target and a slightly higher volume ceiling per session. For muscles with regions (pecs, triceps, quads, calves), each region gets an exercise aimed at it, e.g. incline for upper chest and a pullover for the lower chest.
            </p>
            <div className="flex flex-wrap gap-2">
              {PRIORITY_OPTIONS.filter((m) => !exclude.includes(m)).map((m) => (
                <button key={m} type="button" onClick={() => toggle(priorities, setPriorities, m)} className={`${pill(priorities.includes(m))} capitalize`}>{m}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Leave out <span className="font-normal text-gray-400">· optional</span>
            </label>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-2">
              No exercises mainly for these muscles (e.g. no crunches without abs). Compound lifts may still work them a little.
            </p>
            <div className="flex flex-wrap gap-2">
              {PRIORITY_OPTIONS.map((m) => (
                <button key={m} type="button"
                  onClick={() => { toggle(exclude, setExclude, m); setPriorities((p) => p.filter((x) => x !== m)); }}
                  className={`${exclude.includes(m)
                    ? 'px-3 py-1 rounded-full text-xs font-medium border bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-300 dark:border-red-800 line-through'
                    : pill(false)} capitalize`}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
            <input type="checkbox" checked={preferCustom} onChange={(e) => setPreferCustom(e.target.checked)} className="accent-brand-600" />
            Prefer my custom exercises
          </label>

          {error && <p className="text-sm text-red-500">{error}</p>}
          <button onClick={() => generate()} disabled={busy || equipment.length === 0} className="btn-primary w-full justify-center py-2.5">
            <Sparkles size={16} /> {busy ? 'Generating…' : 'Generate'}
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          <div>
            <p className="font-semibold text-gray-900 dark:text-gray-100">{result.plan.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{result.plan.description}</p>
          </div>

          {result.plan.schedule === 'rotation' && (
            <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
              Rotation: {templates.map((t) => t.label).join(' → ')}, then repeat —{' '}
              {result.plan.rotation?.everyDays
                ? `one workout every ${result.plan.rotation.everyDays === 2 ? 'other' : result.plan.rotation.everyDays} day${result.plan.rotation.everyDays === 2 ? '' : 's'}`
                : `on ${result.plan.rotation?.weekdays?.map((d) => DAY_NAMES[d]).join(', ')}`}.
              {' '}A muscle trained in only one of them still gets it about 1.5–1.75× a week.
            </p>
          )}
          {templates.map((t) => (
            <div key={t.label} className="rounded-xl border border-gray-100 dark:border-gray-800 p-3">
              <div className="flex items-baseline justify-between mb-2">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t.label}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {result.plan.schedule === 'rotation' ? `Workout ${t.days[0] + 1}` : t.days.map((d) => DAY_NAMES[d]).join(', ')} · {result.analysis.setsByLabel?.[t.label]} sets · ~{result.analysis.minutesByLabel[t.label]} min
                </p>
              </div>
              <ul className="space-y-1">
                {t.exercises.map((e) => (
                  <li key={e.exercise._id} className="text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-gray-800 dark:text-gray-200 truncate">
                      {e.exercise.name}
                      {e.exercise.laterality === 'unilateral' && <span className="text-[11px] text-brand-600 dark:text-brand-400 ml-1">each side</span>}
                      {e.exercise.isCustom && <span className="text-[10px] ml-1.5 px-1.5 py-0.5 rounded bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300">custom</span>}
                    </span>
                    <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400 shrink-0">
                      {e.targetSets} × {e.targetReps}{e.targetRepsMax ? `–${e.targetRepsMax}` : ''}
                      {e.targetRir && e.targetRir !== '1–2' && <span className="ml-1.5 text-amber-600 dark:text-amber-400">{e.targetRir} RIR</span>}
                      <button type="button" title="Replace with a similar exercise"
                        onClick={() => setSwapping(swapping?.label === t.label && swapping?.exerciseId === e.exercise._id ? null : { label: t.label, exerciseId: e.exercise._id })}
                        className="ml-2 p-0.5 text-gray-400 hover:text-brand-600 align-middle">
                        <Repeat size={13} />
                      </button>
                    </span>
                  </div>
                  {swapping?.label === t.label && swapping?.exerciseId === e.exercise._id && (
                    <div className="mt-1.5">
                      <SimilarExercises exerciseId={e.exercise._id} equipment={equipment} compact
                        onPick={(ex) => replaceExercise(t.label, e.exercise._id, ex)} onClose={() => setSwapping(null)} />
                    </div>
                  )}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Weekly net stimulus &amp; recovery</p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-2">
              Recovery demand is kept at low/medium for every muscle, and up to high for priority muscles. Sets are
              programmed at 1–2 reps in reserve; a priority muscle with low recovery demand can go to 0–2 (shown in amber).
            </p>
            {losing.length > 0 && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 px-3 py-2 mb-2 space-y-1.5">
                <p className="text-xs text-red-700 dark:text-red-400">
                  {losing.length} muscle{losing.length !== 1 ? 's' : ''} would still lose ground (negative WNS):{' '}
                  {losing.map((u) => unitLabel(u.unit)).join(', ')}. There isn't enough time or frequency to reach them without
                  going over recovery limits elsewhere.
                </p>
                {result.analysis.suggestions?.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-red-600 dark:text-red-400">Try:</span>
                    {result.analysis.suggestions.map((sug) => (
                      <button key={sug.label} type="button" onClick={() => generate(sug.change)} disabled={busy}
                        className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-white dark:bg-gray-900 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40">
                        {sug.label}{sug.losing === 0 ? ' — fixes it' : ` — ${sug.losing} left`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {low.length > 0 ? (
              <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400 mb-2">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                {low.length} muscle{low.length !== 1 ? 's are' : ' is'} under target. Usually the recovery limit of muscles
                trained alongside them is holding them back. More days, a priority, or isolation exercises (including your own) help.
              </p>
            ) : (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-2">Every muscle reaches its target.</p>
            )}
            {result.analysis.skippedForLevel?.length > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Not trained directly at beginner level: {result.analysis.skippedForLevel.map(unitLabel).join(', ')}. Add them as a priority to include them.
              </p>
            )}
            {result.analysis.unreachable.length > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                No exercise for {result.analysis.unreachable.map(unitLabel).join(', ')} with this equipment.
              </p>
            )}
            <StimulusTable units={required} />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3">
            <button onClick={() => setResult(null)} className="btn-secondary flex-1 justify-center"><RefreshCw size={15} /> Change options</button>
            <button onClick={save} disabled={busy} className="btn-primary flex-1 justify-center">{busy ? 'Saving…' : 'Save plan'}</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
