/**
 * Get Started: right after signing up, the new user enters their body stats,
 * body fat estimate, activity level and goal (used for calorie goals, FFMI and
 * training level). Each can be changed later in the profile.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Dumbbell, ChevronLeft, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { userAPI } from '../api';
import { ftInToCm, toKgFrom } from '../utils/bodyUnits';
import { ACTIVITY_LEVELS } from '../utils/calculators';
import { GOALS, STEPS, bodyFatOptions, checkBasics } from '../utils/onboarding';

const pill = (on) => `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${on
  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`;

function Choice({ active, onClick, title, hint }) {
  return (
    <button type="button" onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-colors ${active
        ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}>
      <span className="flex items-center justify-between gap-3">
        <span>
          <span className={`block text-sm font-semibold ${active ? 'text-brand-700 dark:text-brand-300' : 'text-gray-900 dark:text-gray-100'}`}>{title}</span>
          {hint && <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">{hint}</span>}
        </span>
        {active && <Check size={18} className="text-brand-600 shrink-0" />}
      </span>
    </button>
  );
}

const Label = ({ children }) => <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{children}</label>;

export default function GetStarted() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    sex: '', dateOfBirth: '',
    heightUnit: 'cm', height: '', heightFt: '', heightIn: '',
    weightUnit: 'kg', weight: '',
    bodyFat: null, bodyFatExact: '', exact: false,
    activityLevel: null, fitnessGoal: null,
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setError(''); };

  const heightCm = form.heightUnit === 'ft'
    ? (form.heightFt !== '' || form.heightIn !== '' ? ftInToCm(form.heightFt, form.heightIn) : 0)
    : Number(form.height) || 0;
  const weightKg = form.weight === '' ? 0 : toKgFrom(form.weight, form.weightUnit);
  const bodyFat = form.exact ? (form.bodyFatExact === '' ? null : Number(form.bodyFatExact)) : form.bodyFat;

  const finish = async (payload) => {
    setSaving(true);
    setError('');
    try {
      const { data } = await userAPI.updateMe({ ...payload, onboarded: true });
      updateUser(data);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.errors?.[0]?.message || err.response?.data?.message || 'Could not save that');
      setSaving(false);
    }
  };

  const next = () => {
    if (step === 0) {
      const problem = checkBasics({ sex: form.sex, dateOfBirth: form.dateOfBirth, heightCm, weightKg });
      if (problem) { setError(problem); return; }
    }
    if (step === 1 && form.exact && form.bodyFatExact !== '' && !(bodyFat >= 3 && bodyFat <= 70)) { setError('Body fat must be between 3 and 70%.'); return; }
    if (step === 2 && !form.activityLevel) { setError('Pick the one closest to your week.'); return; }
    if (step < STEPS.length - 1) { setStep(step + 1); setError(''); return; }
    if (!form.fitnessGoal) { setError('Pick a goal.'); return; }
    finish({
      sex: form.sex,
      dateOfBirth: form.dateOfBirth,
      height: Math.round(heightCm * 10) / 10,
      heightUnit: form.heightUnit,
      weight: Math.round(weightKg * 100) / 100,
      weightDate: format(new Date(), 'yyyy-MM-dd'),
      bodyWeightUnit: form.weightUnit,
      bodyFat,
      activityLevel: form.activityLevel,
      fitnessGoal: form.fitnessGoal,
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-brand-600 text-white flex items-center justify-center"><Dumbbell size={28} /></div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Let's get you started{user?.name ? `, ${user.name.split(' ')[0]}` : ''}</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">A few details to set your calorie goals and training level. You can change them later.</p>
        </div>

        {/* Progress */}
        <div className="flex gap-1.5 mb-4">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1">
              <div className={`h-1.5 rounded-full ${i <= step ? 'bg-brand-500' : 'bg-gray-200 dark:bg-gray-800'}`} />
              <p className={`text-[11px] mt-1 ${i === step ? 'text-brand-600 font-semibold' : 'text-gray-400'}`}>{s}</p>
            </div>
          ))}
        </div>

        <div className="card space-y-5">
          {step === 0 && (
            <>
              <div>
                <Label>Sex</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[['male', 'Male'], ['female', 'Female']].map(([v, l]) => <Choice key={v} active={form.sex === v} onClick={() => set('sex', v)} title={l} />)}
                </div>
              </div>
              <div>
                <Label>Date of birth</Label>
                <input type="date" className="input" value={form.dateOfBirth} max={format(new Date(), 'yyyy-MM-dd')} onChange={(e) => set('dateOfBirth', e.target.value)} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Height</Label>
                  <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
                    {[['cm', 'cm'], ['ft', 'ft-in']].map(([v, l]) => <button key={v} type="button" onClick={() => set('heightUnit', v)} className={pill(form.heightUnit === v)}>{l}</button>)}
                  </div>
                </div>
                {form.heightUnit === 'ft' ? (
                  <div className="grid grid-cols-2 gap-2">
                    <input className="input" type="number" min={3} max={8} placeholder="ft, e.g. 5" value={form.heightFt} onChange={(e) => set('heightFt', e.target.value)} />
                    <input className="input" type="number" min={0} max={11.9} step={0.1} placeholder="in, e.g. 10.5" value={form.heightIn} onChange={(e) => set('heightIn', e.target.value)} />
                  </div>
                ) : (
                  <input className="input" type="number" min={100} max={250} step={0.1} placeholder="e.g. 175" value={form.height} onChange={(e) => set('height', e.target.value)} />
                )}
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Weight</Label>
                  <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
                    {[['kg', 'kg'], ['lb', 'lb']].map(([v, l]) => <button key={v} type="button" onClick={() => set('weightUnit', v)} className={pill(form.weightUnit === v)}>{l}</button>)}
                  </div>
                </div>
                <input className="input" type="number" step={0.1} placeholder={form.weightUnit === 'lb' ? 'e.g. 165' : 'e.g. 75'} value={form.weight} onChange={(e) => set('weight', e.target.value)} />
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Roughly how much body fat do you have?</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">A guess is fine. It's used for your FFMI and training level, and never shown to others.</p>
              </div>
              {!form.exact ? (
                <div className="space-y-2">
                  {bodyFatOptions(form.sex).map(([v, l, h]) => <Choice key={v} active={form.bodyFat === v} onClick={() => set('bodyFat', form.bodyFat === v ? null : v)} title={l} hint={h} />)}
                </div>
              ) : (
                <div>
                  <Label>Body fat (%)</Label>
                  <input className="input" type="number" min={3} max={70} step={0.1} placeholder="e.g. 18" value={form.bodyFatExact} onChange={(e) => set('bodyFatExact', e.target.value)} autoFocus />
                </div>
              )}
              <div className="flex justify-between text-sm">
                <button type="button" onClick={() => set('exact', !form.exact)} className="text-brand-600 font-medium hover:underline">{form.exact ? 'Pick a rough level instead' : 'I know my exact %'}</button>
                <button type="button" onClick={() => { setForm((f) => ({ ...f, bodyFat: null, bodyFatExact: '', exact: false })); setStep(2); setError(''); }} className="text-gray-500 hover:underline">Not sure, skip</button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">How active is your usual week?</p>
              <div className="space-y-2">
                {ACTIVITY_LEVELS.map((a) => <Choice key={a.value} active={form.activityLevel === a.value} onClick={() => set('activityLevel', a.value)} title={a.label} hint={a.hint} />)}
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500">Count workouts here; steps you log are added on top each day.</p>
            </>
          )}

          {step === 3 && (
            <>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">What's your main goal?</p>
              <div className="space-y-2">
                {GOALS.map(([v, l, h]) => <Choice key={v} active={form.fitnessGoal === v} onClick={() => set('fitnessGoal', v)} title={l} hint={h} />)}
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex items-center gap-2 pt-1">
            {step > 0 && (
              <button type="button" onClick={() => { setStep(step - 1); setError(''); }} className="btn-secondary"><ChevronLeft size={16} /> Back</button>
            )}
            <button type="button" onClick={next} disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? 'Saving…' : step === STEPS.length - 1 ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>

        <button type="button" onClick={() => finish({})} disabled={saving} className="block mx-auto mt-4 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          Skip for now
        </button>
      </div>
    </div>
  );
}
