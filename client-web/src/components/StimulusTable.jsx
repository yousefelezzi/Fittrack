import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { RECOVERY_LABELS, unitLabel, regionLabel, wnsStatus, groupUnits } from '../utils/planAnalysis';

const RECOVERY_CLASS = {
  veryLow: 'text-emerald-600 dark:text-emerald-400',
  low:     'text-emerald-600 dark:text-emerald-400',
  medium:  'text-sky-600 dark:text-sky-400',
  high:    'text-amber-600 dark:text-amber-400',
  extreme: 'text-red-600 dark:text-red-400',
  unrecoverable: 'text-red-600 dark:text-red-400',
};
const recoveryStyle = (level) => (RECOVERY_LABELS[level] ? [RECOVERY_LABELS[level], RECOVERY_CLASS[level]] : ['–', 'text-gray-400']);
const STATUS_CLASS = {
  losing: 'text-red-600 dark:text-red-400',
  low:    'text-amber-600 dark:text-amber-400',
  ok:     'text-emerald-600 dark:text-emerald-400',
};
const wnsClass = (wns, target) => STATUS_CLASS[wnsStatus(wns, target)];

/**
 * Weekly net stimulus, sets and recovery per muscle group; groups with regions
 * (pecs, delts, triceps…) open to show each region. `units` are the plan's
 * required units from /plans/generate or /plans/analyze.
 */
export default function StimulusTable({ units }) {
  const [openGroups, setOpenGroups] = useState([]);
  const toggle = (g) => setOpenGroups((list) => (list.includes(g) ? list.filter((x) => x !== g) : [...list, g]));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-gray-400 dark:text-gray-500">
            <th className="font-medium pb-1">Muscle</th>
            <th className="font-medium pb-1 text-right">WNS</th>
            <th className="font-medium pb-1 text-right">Sets/wk</th>
            <th className="font-medium pb-1 text-right">Recovery</th>
          </tr>
        </thead>
        {groupUnits(units).map((g) => {
          const [recLabel, recClass] = recoveryStyle(g.recovery?.level);
          const canOpen = g.regions.length > 0;
          const isOpen = canOpen && openGroups.includes(g.group);
          return (
            <tbody key={g.group}>
              <tr onClick={canOpen ? () => toggle(g.group) : undefined}
                className={`border-t border-gray-50 dark:border-gray-800 ${canOpen ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60' : ''}`}>
                <td className={`py-0.5 pr-2 ${g.priority ? 'font-semibold' : ''} text-gray-600 dark:text-gray-300`}>
                  <span className="inline-flex items-center gap-0.5">
                    {canOpen
                      ? <ChevronRight size={12} className={`shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                      : <span className="w-3 shrink-0" />}
                    {unitLabel(g.group)}
                    {canOpen && <span className="ml-1 font-normal text-gray-400 dark:text-gray-500">({g.regions.length})</span>}
                  </span>
                  {g.priority && g.recommendedRir && <span className="ml-1 font-normal text-amber-600 dark:text-amber-400">· {g.recommendedRir} RIR</span>}
                </td>
                <td className={`py-0.5 text-right tabular-nums ${STATUS_CLASS[g.status]}`}
                  title={canOpen ? 'Average of its regions; colour shows the weakest region' : undefined}>{g.wns.toFixed(1)}</td>
                <td className="py-0.5 text-right tabular-nums text-gray-500 dark:text-gray-400">{+g.setsPerWeek.toFixed(1)} · {g.sessionsPerWeek}×</td>
                <td className={`py-0.5 text-right ${recClass}`}>{recLabel}</td>
              </tr>
              {isOpen && g.regions.map((u) => {
                const [rLabel, rClass] = recoveryStyle(u.recovery?.level);
                return (
                  <tr key={u.unit} className="bg-gray-50/60 dark:bg-gray-800/40">
                    <td className="py-0.5 pr-2 pl-5 text-gray-500 dark:text-gray-400">
                      {regionLabel(u.unit)}{u.priority && u.recommendedRir && <span className="ml-1 text-amber-600 dark:text-amber-400">· {u.recommendedRir} RIR</span>}
                    </td>
                    <td className={`py-0.5 text-right tabular-nums ${wnsClass(u.wns, u.target)}`}>{u.wns.toFixed(1)}</td>
                    <td className="py-0.5 text-right tabular-nums text-gray-500 dark:text-gray-400">{u.setsPerWeek} · {u.sessionsPerWeek}×</td>
                    <td className={`py-0.5 text-right ${rClass}`}>{rLabel}</td>
                  </tr>
                );
              })}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}
