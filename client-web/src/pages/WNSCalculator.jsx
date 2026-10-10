import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Gauge } from 'lucide-react';
import {
  computeWNSResult,
  validateFreqValue,
  validateMaintValue,
  validateSetsValue,
  validateStimValue,
  validateRepsValue,
  validateRirValue,
  effectiveSetFactor,
} from '../utils/wnsCalculations';

const DEFAULT_PROGRAM = { unit: 'T', freq: '', sets: '', reps: '', rir: '' };

// Best (veryHigh) → worst (veryBad) stimulus outcome: the more stimulus, the
// greener (lime → green → very green), then yellow, orange and red.
const RESULT_TONE = {
  veryHigh: 'bg-green-300 dark:bg-green-500/40 text-green-950 dark:text-green-400 border-green-500 dark:border-green-400/80',
  High:     'bg-green-200 dark:bg-green-500/15 text-green-900 dark:text-green-300 border-green-400 dark:border-green-500/40',
  Low:      'bg-lime-200 dark:bg-lime-500/15 text-lime-900 dark:text-lime-300 border-lime-400 dark:border-lime-500/50',
  veryLow:  'bg-yellow-200 dark:bg-yellow-500/15 text-yellow-900 dark:text-yellow-300 border-yellow-400 dark:border-yellow-500/50',
  Medium:   'bg-orange-200 dark:bg-orange-500/15 text-orange-900 dark:text-orange-300 border-orange-400 dark:border-orange-500/50',
  Bad:      'bg-red-200 dark:bg-red-500/15 text-red-900 dark:text-red-300 border-red-400 dark:border-red-500/50',
  veryBad:  'bg-red-300 dark:bg-red-600/30 text-red-950 dark:text-red-200 border-red-500 dark:border-red-400/70',
};
const NEUTRAL_TONE = 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-400 border-gray-300 dark:border-gray-700';

// Best (veryLow demand) → worst (veryHigh demand) recovery warning.
const WARNING_TONE = {
  veryHigh: 'bg-red-200 dark:bg-red-500/15 text-red-900 dark:text-red-300 border-red-400 dark:border-red-500/50',
  High:     'bg-orange-200 dark:bg-orange-500/15 text-orange-900 dark:text-orange-300 border-orange-400 dark:border-orange-500/50',
  Medium:   'bg-yellow-200 dark:bg-yellow-500/15 text-yellow-900 dark:text-yellow-300 border-yellow-400 dark:border-yellow-500/50',
  Low:      'bg-lime-200 dark:bg-lime-500/15 text-lime-900 dark:text-lime-300 border-lime-400 dark:border-lime-500/50',
  veryLow:  'bg-green-200 dark:bg-green-500/15 text-green-900 dark:text-green-400 border-green-400 dark:border-green-500/50',
};

export default function WNSCalculator() {
  const [dataset, setDataset] = useState('S');
  const [maintenance, setMaintenance] = useState('');
  const [stimDuration, setStimDuration] = useState('');
  const [compareMode, setCompareMode] = useState(false);
  const [openTooltip, setOpenTooltip] = useState(null);

  const [programs, setPrograms] = useState({ A: { ...DEFAULT_PROGRAM }, B: { ...DEFAULT_PROGRAM } });
  const [errors, setErrors] = useState({});
  const [results, setResults] = useState({ A: null, B: null });

  // Close any open tooltip on an outside click.
  useEffect(() => {
    const handler = () => setOpenTooltip(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const updateProgram = (id, field, value) => {
    setPrograms((p) => ({ ...p, [id]: { ...p[id], [field]: value } }));
    setErrors((e) => ({ ...e, [`${field}${id}`]: null }));
  };

  const handleFreqBlur = (id) => {
    setErrors((e) => ({ ...e, [`freq${id}`]: validateFreqValue(programs[id].freq, programs[id].unit) }));
  };
  const handleSetsBlur = (id) => {
    setErrors((e) => ({ ...e, [`sets${id}`]: validateSetsValue(programs[id].sets) }));
  };
  const handleMaintBlur = () => setErrors((e) => ({ ...e, maintenance: validateMaintValue(maintenance) }));
  const handleStimBlur = () => setErrors((e) => ({ ...e, stim_duration: validateStimValue(stimDuration) }));

  const calculate = (id) => {
    const p = programs[id];
    const freqMsg = validateFreqValue(p.freq, p.unit);
    const setsMsg = validateSetsValue(p.sets);
    const maintMsg = validateMaintValue(maintenance);
    const stimMsg = validateStimValue(stimDuration);
    const repsMsg = validateRepsValue(p.reps);
    const rirMsg = validateRirValue(p.rir);

    setErrors((e) => ({
      ...e,
      [`freq${id}`]: freqMsg,
      [`sets${id}`]: setsMsg,
      [`reps${id}`]: repsMsg,
      [`rir${id}`]: rirMsg,
      maintenance: maintMsg,
      stim_duration: stimMsg,
    }));

    if (freqMsg || setsMsg || repsMsg || rirMsg || maintMsg || stimMsg) {
      setResults((r) => ({ ...r, [id]: null }));
      return;
    }

    // Only the last 5 reps before failure count, so sets short of failure (or
    // under 5 reps) count as part of a set.
    const factor = effectiveSetFactor(p.reps, p.rir);
    const effective = Math.round(parseFloat(p.sets) * factor * 100) / 100;
    const result = computeWNSResult({
      unit: p.unit,
      freq: p.freq,
      sets: String(effective),
      maintenance,
      stimHours: stimDuration,
      dataset,
    });
    setResults((r) => ({ ...r, [id]: { ...result, effective, factor, sets: parseFloat(p.sets) } }));
  };

  const toggleCompare = () => {
    setResults((r) => ({ ...r, B: null }));
    setErrors((e) => ({ ...e, freqB: null, setsB: null }));
    setPrograms((p) => ({ ...p, B: { ...DEFAULT_PROGRAM } }));
    setCompareMode((c) => !c);
  };

  const sharedProps = {
    errors,
    onFieldChange: updateProgram,
    onFreqBlur: handleFreqBlur,
    onSetsBlur: handleSetsBlur,
    onCalculate: calculate,
    openTooltip,
    setOpenTooltip,
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Gauge size={22} className="text-brand-600" /> Weekly Net Stimulus Calculator
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Estimate the weekly hypertrophy effect of a training program by balancing training stimulus against atrophy.
        </p>
      </div>

      <div className="card space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Training parameters</h2>
          <button
            type="button"
            onClick={toggleCompare}
            className="text-xs font-semibold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/30 hover:bg-brand-100 dark:hover:bg-brand-900/50 px-3 py-1.5 rounded-lg transition-colors"
          >
            {compareMode ? 'Close Comparison' : 'Compare Programs'}
          </button>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <InfoTooltip id="dataset" openTooltip={openTooltip} setOpenTooltip={setOpenTooltip}>
                The reference dataset for the volume-stimulus relationship.
                <div className="mt-2 space-y-1.5">
                  <div>
                    <a href="https://doi.org/10.1080/02640414.2016.1210197" target="_blank" rel="noreferrer" className="text-brand-600 dark:text-brand-400 underline hover:text-brand-700 dark:hover:text-brand-300">Schoenfeld:</a>{' '}
                    <span className="text-gray-400 dark:text-gray-500">Shows pronouncedly diminishing returns. (6 sets = 2x stimulus of 1 set)</span>
                  </div>
                  <div>
                    <a href="https://doi.org/10.51224/SRXIV.460" target="_blank" rel="noreferrer" className="text-brand-600 dark:text-brand-400 underline hover:text-brand-700 dark:hover:text-brand-300">Pelland:</a>{' '}
                    <span className="text-gray-400 dark:text-gray-500">Shows subtly diminishing returns. (6 sets = 4x stimulus of 1 set)</span>
                  </div>
                </div>
              </InfoTooltip>
              <label htmlFor="dataset" className="text-sm font-medium text-gray-700 dark:text-gray-300">Dataset</label>
            </div>
            <select id="dataset" className="input h-10" value={dataset} onChange={(e) => setDataset(e.target.value)}>
              <option value="S">Schoenfeld</option>
              <option value="P">Pelland</option>
              <option value="A">Average</option>
            </select>
          </div>

          <div>
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <InfoTooltip id="maintenance" openTooltip={openTooltip} setOpenTooltip={setOpenTooltip}>
                Number of sets per week (1x frequency) to maintain a muscle.
                <div className="mt-2 space-y-1.5">
                  <a href="https://journals.lww.com/acsm-msse/fulltext/2011/07000/exercise_dosing_to_retain_resistance_training.7.aspx" target="_blank" rel="noreferrer" className="block text-brand-600 dark:text-brand-400 underline hover:text-brand-700 dark:hover:text-brand-300">This study finds maintenance is at 3 sets.</a>
                  <a href="https://doi.org/10.3390/sports12070198" target="_blank" rel="noreferrer" className="block text-brand-600 dark:text-brand-400 underline hover:text-brand-700 dark:hover:text-brand-300">This study finds maintenance is at 4 sets.</a>
                </div>
              </InfoTooltip>
              <label htmlFor="maintenance" className="text-sm font-medium text-gray-700 dark:text-gray-300">Maintenance volume</label>
              {errors.maintenance && <span className="text-xs text-red-500 dark:text-red-400">{errors.maintenance}</span>}
            </div>
            <input
              type="text"
              id="maintenance"
              className={`input h-10 ${errors.maintenance ? 'border-red-300 dark:border-red-700' : ''}`}
              placeholder="1-5 sets, 1x/week"
              value={maintenance}
              onChange={(e) => { setMaintenance(e.target.value); setErrors((er) => ({ ...er, maintenance: null })); }}
              onBlur={handleMaintBlur}
            />
          </div>

          <div>
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <InfoTooltip id="stim_duration" openTooltip={openTooltip} setOpenTooltip={setOpenTooltip}>
                How long the stimulus period lasts before atrophy begins.
                <div className="mt-2">
                  <a href="https://www.instagram.com/p/DKRS63yskPg/?utm_source=ig_web_copy_link&igsh=NWxxZHNjd29tcHZv" target="_blank" rel="noreferrer" className="text-brand-600 dark:text-brand-400 underline hover:text-brand-700 dark:hover:text-brand-300">Research shows it likely lasts 36-48 hours.</a>
                </div>
              </InfoTooltip>
              <label htmlFor="stim_duration" className="text-sm font-medium text-gray-700 dark:text-gray-300">Stimulus duration</label>
              {errors.stim_duration && <span className="text-xs text-red-500 dark:text-red-400">{errors.stim_duration}</span>}
            </div>
            <input
              type="text"
              id="stim_duration"
              className={`input h-10 ${errors.stim_duration ? 'border-red-300 dark:border-red-700' : ''}`}
              placeholder="12-72 hours"
              value={stimDuration}
              onChange={(e) => { setStimDuration(e.target.value); setErrors((er) => ({ ...er, stim_duration: null })); }}
              onBlur={handleStimBlur}
            />
          </div>
        </div>

        {compareMode ? (
          <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-gray-100 dark:border-gray-800">
            <ProgramForm id="A" boxed program={programs.A} result={results.A} {...sharedProps} />
            <ProgramForm id="B" boxed program={programs.B} result={results.B} {...sharedProps} />
          </div>
        ) : (
          <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
            <ProgramForm id="A" program={programs.A} result={results.A} {...sharedProps} />
          </div>
        )}
      </div>

      <div className="card text-sm text-gray-500 dark:text-gray-400 space-y-2">
        <p>
          <strong className="text-gray-700 dark:text-gray-300">Weekly Net Stimulus</strong> weighs the hypertrophy stimulus from your training against the muscle lost to atrophy between sessions, so a program with more volume isn't automatically scored higher if it's poorly timed.
        </p>
        <p>
          A result of N/A means the recovery demand warning found the program unrecoverable before a score could be calculated.
        </p>
        <p className="pt-1 flex items-center gap-3">
          <Link to="/calculators/wns/about" className="font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300">
            Read more about how this works →
          </Link>
          <span className="text-gray-300 dark:text-gray-700">•</span>
          <a href="https://payhip.com/b/NeuDm" target="_blank" rel="noreferrer" className="font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300">
            Full Training Program Guide
          </a>
        </p>
      </div>
    </div>
  );
}

// `align="right"` opens the box leftwards, for icons near the right edge.
function InfoTooltip({ id, openTooltip, setOpenTooltip, align = 'left', children }) {
  const isOpen = openTooltip === id;
  return (
    <span
      className="relative inline-flex group"
      onClick={(e) => {
        if (e.target.closest('a')) return;
        e.stopPropagation();
        setOpenTooltip(isOpen ? null : id);
      }}
    >
      <span
        className="w-4 h-4 rounded-full border border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 group-hover:border-brand-500 group-hover:text-brand-600 dark:group-hover:border-brand-400 dark:group-hover:text-brand-400 flex items-center justify-center shrink-0 text-[10px] font-bold leading-none cursor-pointer transition-colors"
        role="button"
        tabIndex={0}
        aria-label="Info"
      >
        i
      </span>
      <span
        className={`absolute z-30 top-full ${align === 'right' ? 'right-0' : 'left-0'} pt-1.5 w-64 max-w-[75vw] ${isOpen ? 'block' : 'hidden group-hover:block'}`}
      >
        <span className="block p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg text-xs leading-relaxed font-normal text-gray-600 dark:text-gray-300 whitespace-normal break-words text-left">
          {children}
        </span>
      </span>
    </span>
  );
}

function ProgramForm({
  id, boxed, program, errors, onFieldChange,
  onFreqBlur, onSetsBlur, onCalculate, result,
  openTooltip, setOpenTooltip,
}) {
  const freqErr = errors[`freq${id}`];
  const setsErr = errors[`sets${id}`];

  const body = (
    <>
      {boxed && <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Program {id}</h4>}

      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <InfoTooltip id={`unit${id}`} openTooltip={openTooltip} setOpenTooltip={setOpenTooltip}>
              Specifies the format used for training frequency.
              <div className="mt-2 space-y-1 text-gray-400 dark:text-gray-500">
                <div>x times per week: traditional workout routines.</div>
                <div>every x days/hours: evenly spaced workouts.</div>
              </div>
            </InfoTooltip>
            <label htmlFor={`unit${id}`} className="text-sm font-medium text-gray-700 dark:text-gray-300">Frequency Unit</label>
          </div>
          <select
            id={`unit${id}`}
            className="input h-10"
            value={program.unit}
            onChange={(e) => onFieldChange(id, 'unit', e.target.value)}
          >
            <option value="T">x times per week</option>
            <option value="D">every x days</option>
            <option value="H">every x hours</option>
          </select>
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <InfoTooltip id={`freq${id}`} openTooltip={openTooltip} setOpenTooltip={setOpenTooltip}>
              How often a muscle is trained (3x per week, every 48 hours, etc.)
              <div className="mt-1 text-gray-400 dark:text-gray-500">Choose the appropriate frequency unit.</div>
            </InfoTooltip>
            <label htmlFor={`freq${id}`} className="text-sm font-medium text-gray-700 dark:text-gray-300">Frequency</label>
            {freqErr && <span className="text-xs text-red-500 dark:text-red-400">{freqErr}</span>}
          </div>
          <input
            type="text"
            id={`freq${id}`}
            className={`input h-10 ${freqErr ? 'border-red-300 dark:border-red-700' : ''}`}
            placeholder="Training frequency"
            value={program.freq}
            onChange={(e) => onFieldChange(id, 'freq', e.target.value)}
            onBlur={() => onFreqBlur(id)}
          />
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <InfoTooltip id={`sets${id}`} openTooltip={openTooltip} setOpenTooltip={setOpenTooltip}>
              Number of effective sets per workout per muscle.
              <div className="mt-1 text-gray-400 dark:text-gray-500">If set number varies by session, enter the average (2 one day, 3 another = 2.5)</div>
              <div className="mt-2 space-y-1">
                <a href="https://www.patreon.com/posts/strength-102633917" target="_blank" rel="noreferrer" className="block text-brand-600 dark:text-brand-400 underline hover:text-brand-700 dark:hover:text-brand-300">See volume recovery data here.</a>
              </div>
            </InfoTooltip>
            <label htmlFor={`sets${id}`} className="text-sm font-medium text-gray-700 dark:text-gray-300">Sets per workout</label>
            {setsErr && <span className="text-xs text-red-500 dark:text-red-400">{setsErr}</span>}
          </div>
          <input
            type="text"
            id={`sets${id}`}
            className={`input h-10 ${setsErr ? 'border-red-300 dark:border-red-700' : ''}`}
            placeholder="Sets per workout"
            value={program.sets}
            onChange={(e) => onFieldChange(id, 'sets', e.target.value)}
            onBlur={() => onSetsBlur(id)}
          />
        </div>

        {/* Reps and RIR side by side, also in the narrow compare boxes: short labels, errors under the box. */}
        <div className="grid grid-cols-2 gap-3">
          {[
            ['reps', 'Reps', 'Optional, e.g. 10', <>
              How many reps you do in each set.
              <div className="mt-1 text-gray-400 dark:text-gray-500">Very low-rep sets (under 5) count for a little less than a full set. Leave blank to count every set in full.</div>
            </>],
            ['rir', 'RIR', 'Optional, e.g. 1', <>
              Reps in reserve: how many more reps you could have done before reaching failure.
              <div className="mt-1 text-gray-400 dark:text-gray-500">The closer to failure, the more a set counts. Sets stopped far from failure barely count. Leave blank if you train to failure.</div>
            </>],
          ].map(([field, text, ph, info]) => (
            <div key={field}>
              <div className="flex items-center gap-1.5 mb-1 whitespace-nowrap">
                <InfoTooltip id={`${field}${id}`} openTooltip={openTooltip} setOpenTooltip={setOpenTooltip} align={field === 'rir' ? 'right' : 'left'}>{info}</InfoTooltip>
                <label htmlFor={`${field}${id}`} className="text-sm font-medium text-gray-700 dark:text-gray-300">{text}</label>
              </div>
              <input type="text" id={`${field}${id}`} inputMode="decimal" placeholder={ph}
                className={`input h-10 ${errors[`${field}${id}`] ? 'border-red-300 dark:border-red-700' : ''}`}
                value={program[field]} onChange={(e) => onFieldChange(id, field, e.target.value)} />
              {errors[`${field}${id}`] && <p className="text-xs text-red-500 dark:text-red-400 mt-1">{errors[`${field}${id}`]}</p>}
            </div>
          ))}
        </div>
      </div>

      <button type="button" className="btn-primary mt-4" onClick={() => onCalculate(id)}>Calculate</button>

      {result && (
        <div className="mt-3 space-y-2">
          {result.factor < 1 && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Counts as <span className="font-semibold">{result.effective} effective set{result.effective !== 1 ? 's' : ''}</span> per workout
            </p>
          )}
          <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${RESULT_TONE[result.resultClass] ?? NEUTRAL_TONE}`}>
            {result.text}
          </div>
          {result.warning && (
            <div className={`rounded-xl border px-4 py-2.5 text-xs font-semibold ${WARNING_TONE[result.warning.className]}`}>
              {result.warning.text}
            </div>
          )}
        </div>
      )}
    </>
  );

  if (!boxed) return <div>{body}</div>;
  return <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/30 p-4">{body}</div>;
}
