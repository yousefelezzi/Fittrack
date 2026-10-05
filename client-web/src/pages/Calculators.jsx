import { NavLink, Navigate, useParams } from 'react-router-dom';
import { Calculator, Activity, Gauge } from 'lucide-react';
import FFMICalculator from './FFMICalculator';
import TDEECalculator from './TDEECalculator';
import WNSCalculator from './WNSCalculator';

// Each calculator keeps its own URL (/calculators/ffmi etc.) so tabs can be
// linked to, bookmarked, and survive a refresh.
const CALCULATORS = [
  { key: 'ffmi', label: 'FFMI',       icon: Calculator, component: FFMICalculator },
  { key: 'tdee', label: 'BMR & TDEE', icon: Activity,   component: TDEECalculator },
  { key: 'wns',  label: 'WNS',        icon: Gauge,      component: WNSCalculator },
];

export default function Calculators() {
  const { calc } = useParams();
  const active = CALCULATORS.find((c) => c.key === calc);
  if (!active) return <Navigate to="/calculators/ffmi" replace />;
  const Active = active.component;

  return (
    <div className="space-y-5">
      <div className="max-w-2xl mx-auto space-y-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Calculators</h1>
        <div className="grid grid-cols-3 gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
          {CALCULATORS.map(({ key, label, icon: Icon }) => (
            <NavLink
              key={key}
              to={`/calculators/${key}`}
              replace
              className={({ isActive }) =>
                `flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  isActive
                    ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`
              }
            >
              <Icon size={15} className="shrink-0" /> <span className="truncate">{label}</span>
            </NavLink>
          ))}
        </div>
      </div>
      <Active />
    </div>
  );
}
