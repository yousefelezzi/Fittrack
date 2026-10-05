import { useState, useMemo } from 'react';
import { differenceInYears } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { calcBMR, calcTDEE, ACTIVITY_LEVELS } from '../utils/calculators';
import { Activity } from 'lucide-react';

export default function TDEECalculator() {
  const { user } = useAuth();
  const defaultAge = user?.dateOfBirth ? differenceInYears(new Date(), new Date(user.dateOfBirth)) : '';

  const [weight, setWeight] = useState(user?.weight ?? '');
  const [height, setHeight] = useState(user?.height ?? '');
  const [age, setAge] = useState(defaultAge);
  const [sex, setSex] = useState('male');
  const [activity, setActivity] = useState(ACTIVITY_LEVELS[2].value);

  const { bmr, tdee } = useMemo(() => {
    const w = Number(weight), h = Number(height), a = Number(age);
    if (!w || !h || !a || w <= 0 || h <= 0 || a <= 0) return {};
    const b = calcBMR(w, h, a, sex);
    return { bmr: b, tdee: calcTDEE(b, Number(activity)) };
  }, [weight, height, age, sex, activity]);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Activity size={22} className="text-brand-600" /> BMR & TDEE Calculator
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          BMR is roughly how many calories your body burns at complete rest. TDEE adds your activity on top of that to give your maintenance calories.
        </p>
      </div>

      <div className="card space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Weight (kg)</label>
            <input className="input" type="number" min="0" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="70" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Height (cm)</label>
            <input className="input" type="number" min="0" step="0.1" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="175" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Age</label>
            <input className="input" type="number" min="0" step="1" value={age} onChange={(e) => setAge(e.target.value)} placeholder="30" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sex</label>
            <select className="input h-10" value={sex} onChange={(e) => setSex(e.target.value)}>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Activity level</label>
            <select className="input h-10" value={activity} onChange={(e) => setActivity(e.target.value)}>
              {ACTIVITY_LEVELS.map((lvl) => (
                <option key={lvl.value} value={lvl.value}>{lvl.label} — {lvl.hint}</option>
              ))}
            </select>
          </div>
        </div>

        {tdee ? (
          <div className="pt-4 border-t border-gray-100 dark:border-gray-800 space-y-4">
            <div className="text-center">
              <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">Maintenance (TDEE)</p>
              <p className="text-3xl font-bold text-brand-600">{Math.round(tdee)} <span className="text-base font-medium text-gray-400 dark:text-gray-500">kcal/day</span></p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">BMR: {Math.round(bmr)} kcal/day</p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-3">
                <p className="text-xs text-gray-400 dark:text-gray-500">Mild loss</p>
                <p className="font-semibold text-gray-900 dark:text-gray-100">{Math.round(tdee - 250)}</p>
                <p className="text-[11px] text-gray-400 dark:text-gray-500">~0.25 kg/wk</p>
              </div>
              <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-3">
                <p className="text-xs text-gray-400 dark:text-gray-500">Maintain</p>
                <p className="font-semibold text-gray-900 dark:text-gray-100">{Math.round(tdee)}</p>
                <p className="text-[11px] text-gray-400 dark:text-gray-500">±0 kg/wk</p>
              </div>
              <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-3">
                <p className="text-xs text-gray-400 dark:text-gray-500">Mild gain</p>
                <p className="font-semibold text-gray-900 dark:text-gray-100">{Math.round(tdee + 250)}</p>
                <p className="text-[11px] text-gray-400 dark:text-gray-500">~0.25 kg/wk</p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400 dark:text-gray-500 pt-2">Fill in your details to see your TDEE.</p>
        )}
      </div>

      <div className="card text-sm text-gray-500 dark:text-gray-400 space-y-2">
        <p>BMR is calculated with the <strong className="text-gray-700 dark:text-gray-300">Mifflin-St Jeor equation</strong>, the formula most dietitians consider the most accurate for the general population. TDEE = BMR × activity multiplier.</p>
        <p>The loss/gain estimates assume roughly 3,500 kcal per 0.45 kg (1 lb) of body weight, so treat them as a starting point to adjust from based on real-world results.</p>
      </div>
    </div>
  );
}
