import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Trophy } from 'lucide-react';
import { calcOneRepMax, repMaxTable, ONE_RM_MAX_REPS } from '../utils/calculators';
import { UNITS } from '../utils/weightUnits';

const round = (n, unit) => {
  const step = unit === 'lb' ? 5 : 2.5; // what you can actually load
  return Math.round(n / step) * step;
};

/** One-rep max from a set: weight × reps (and reps in reserve), plus what you could do for 1–12 reps. */
export default function OneRepMaxCalculator() {
  const { user } = useAuth();
  const [unit, setUnit] = useState(user?.weightUnit === 'lb' ? 'lb' : 'kg');
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [rir, setRir] = useState('');

  const oneRm = useMemo(() => calcOneRepMax(weight, reps, rir), [weight, reps, rir]);
  const effective = (Number(reps) || 0) + (Number(rir) || 0);
  const table = oneRm ? repMaxTable(oneRm) : [];
  const pill = (active) => `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${active
    ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Trophy size={22} className="text-brand-600" /> One-Rep Max Calculator
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Estimates the most you could lift for one rep from a set you've done. Reps in reserve count as reps, so 5 reps with 1 left in the tank counts like a 6-rep max. It's the same estimate your progress charts use.
        </p>
      </div>

      <div className="card space-y-4">
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg w-fit">
          {UNITS.map((u) => <button key={u} type="button" onClick={() => setUnit(u)} className={pill(unit === u)}>{u}</button>)}
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Weight ({unit})</label>
            <input className="input" type="number" min="0" step="0.5" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder={unit === 'lb' ? '225' : '100'} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reps</label>
            <input className="input" type="number" min="1" step="1" value={reps} onChange={(e) => setReps(e.target.value)} placeholder="5" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" title="How many more reps you could have done">
              Reps in reserve <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input className="input" type="number" min="0" max="10" step="1" value={rir} onChange={(e) => setRir(e.target.value)} placeholder="0" />
          </div>
        </div>

        {oneRm ? (
          <div className="rounded-xl bg-brand-50 dark:bg-brand-900/30 p-4 text-center">
            <p className="text-xs font-medium text-brand-700 dark:text-brand-300 uppercase tracking-wide">Estimated 1RM</p>
            <p className="text-4xl font-bold text-gray-900 dark:text-gray-100 mt-1">{Math.round(oneRm * 10) / 10} {unit}</p>
            {effective > ONE_RM_MAX_REPS && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                With {effective} reps to failure this is a rough guess. Estimates are most accurate from sets of {ONE_RM_MAX_REPS} reps or fewer.
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400 dark:text-gray-500">Enter the weight and reps of a set to see your estimated one-rep max.</p>
        )}
      </div>

      {oneRm && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Rep maxes</h3>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">What you could lift for each number of reps to failure, rounded to the nearest {unit === 'lb' ? '5 lb' : '2.5 kg'}.</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 dark:text-gray-500 uppercase">
                <th className="text-left pb-1">Reps</th><th className="text-right pb-1">Weight</th><th className="text-right pb-1">% of 1RM</th>
              </tr>
            </thead>
            <tbody>
              {table.map((row) => (
                <tr key={row.reps} className="border-t border-gray-50 dark:border-gray-800">
                  <td className="py-1.5 text-gray-700 dark:text-gray-300">{row.reps}</td>
                  <td className="py-1.5 text-right font-medium text-gray-900 dark:text-gray-100">{round(row.weight, unit)} {unit}</td>
                  <td className="py-1.5 text-right text-gray-400">{row.percent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
