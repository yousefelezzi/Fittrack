import { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { calcFFMI, ffmiCategory } from '../utils/calculators';
import { Calculator } from 'lucide-react';

export default function FFMICalculator() {
  const { user } = useAuth();

  const [weight, setWeight] = useState(user?.weight ?? '');
  const [height, setHeight] = useState(user?.height ?? '');
  const [bodyFat, setBodyFat] = useState('');

  const result = useMemo(() => {
    const w = Number(weight), h = Number(height), bf = Number(bodyFat);
    if (!w || !h || bodyFat === '' || isNaN(bf) || w <= 0 || h <= 0 || bf < 0 || bf >= 100) return null;
    return calcFFMI(w, h, bf);
  }, [weight, height, bodyFat]);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Calculator size={22} className="text-brand-600" /> FFMI Calculator
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Fat-Free Mass Index estimates how much muscle you carry relative to your height, adjusted so it can be compared across different heights.
        </p>
      </div>

      <div className="card space-y-4">
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Weight (kg)</label>
            <input className="input" type="number" min="0" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="70" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Height (cm)</label>
            <input className="input" type="number" min="0" step="0.1" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="175" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Body fat (%)</label>
            <input className="input" type="number" min="0" max="99" step="0.1" value={bodyFat} onChange={(e) => setBodyFat(e.target.value)} placeholder="15" />
          </div>
        </div>

        {result ? (
          <div className="pt-4 border-t border-gray-100 dark:border-gray-800 space-y-5">
            <div className="grid sm:grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">Fat-free mass</p>
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{result.ffm.toFixed(1)} kg</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">FFMI</p>
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{result.ffmi.toFixed(1)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">Normalized FFMI</p>
                <p className="text-xl font-bold text-brand-600">{result.normalizedFfmi.toFixed(1)}</p>
                <span className="badge bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 mt-1">{ffmiCategory(result.normalizedFfmi)}</span>
              </div>
            </div>

            <FFMIScale value={result.normalizedFfmi} />
          </div>
        ) : (
          <p className="text-sm text-gray-400 dark:text-gray-500 pt-2">Enter your weight, height and body fat % to see your FFMI.</p>
        )}
      </div>

      <div className="card text-sm text-gray-500 dark:text-gray-400 space-y-2">
        <p><strong className="text-gray-700 dark:text-gray-300">Normalized FFMI</strong> adjusts for height so people of different heights can be compared on the same scale. The category guide below is calibrated for men; for women, subtract roughly 4–5 points from each threshold.</p>
        <p>Most natural lifters top out around 25. Values well above that are unusual without pharmaceutical assistance — treat FFMI as a rough guide, not a verdict.</p>
      </div>
    </div>
  );
}

// Visual scale: a color gradient from "below average" (cool blue) through
// "average/superior" (green → orange) to "very unlikely natural" (red),
// with a marker showing where the current normalized FFMI falls.
const SCALE_MIN = 14;
const SCALE_MAX = 30;
const SCALE_MARKS = [14, 18, 22, 26, 30];

function FFMIScale({ value }) {
  const pct = Math.min(100, Math.max(0, ((value - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100));

  return (
    <div>
      <div className="relative pt-5">
        {/* Marker */}
        <div
          className="absolute top-0 -translate-x-1/2 flex flex-col items-center"
          style={{ left: `${pct}%` }}
        >
          <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200 whitespace-nowrap mb-0.5">
            {value.toFixed(1)}
          </span>
          <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-gray-700 dark:border-t-gray-200" />
        </div>

        {/* Gradient bar */}
        <div
          className="h-3 rounded-full ring-1 ring-black/5 dark:ring-white/10"
          style={{
            background: 'linear-gradient(to right, #38bdf8 0%, #22c55e 25%, #a3e635 40%, #eab308 55%, #f97316 75%, #ef4444 100%)',
          }}
        />
      </div>

      {/* Scale labels */}
      <div className="relative h-4 mt-1">
        {SCALE_MARKS.map((v) => (
          <span
            key={v}
            className="absolute text-[10px] text-gray-400 dark:text-gray-500 -translate-x-1/2 first:translate-x-0 last:-translate-x-full"
            style={{ left: `${((v - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100}%` }}
          >
            {v}
          </span>
        ))}
      </div>
    </div>
  );
}
