import { useState, useEffect, useRef } from 'react';
import { workoutAPI, exerciseAPI } from '../api';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { format } from 'date-fns';
import { Search, Clock, X } from 'lucide-react';
import VolumeCheck from '../components/VolumeCheck';

const COLORS = ['#0ea5e9','#8b5cf6','#10b981','#f59e0b','#ef4444','#ec4899','#14b8a6','#f97316'];

// Muscle pie: slices go around the body in order — upper body, then core, then
// legs — so neighbouring slices are neighbouring muscles. Upper body uses blues
// and purples, core yellows, legs greens and oranges.
const MUSCLE_ORDER = [
  // upper body
  ['pecs', '#0ea5e9'], ['anterior delt', '#38bdf8'], ['middle delt', '#6366f1'], ['posterior delt', '#818cf8'],
  ['triceps', '#8b5cf6'], ['elbow flexors', '#a78bfa'], ['forearms', '#c084fc'], ['lats', '#2563eb'], ['trapezius', '#3b82f6'],
  // core
  ['abs', '#f59e0b'], ['erectors', '#fbbf24'],
  // legs
  ['hip flexors', '#14b8a6'], ['glutes', '#10b981'], ['adductors', '#34d399'], ['quads', '#22c55e'],
  ['hamstrings', '#f97316'], ['calves', '#fb923c'],
];
const MUSCLE_POS = Object.fromEntries(MUSCLE_ORDER.map(([m], i) => [m, i]));
const MUSCLE_COLOR = Object.fromEntries(MUSCLE_ORDER);

// Hover box for the muscle pie: total sets, plus sub-regions where the muscle has them.
function MuscleTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border px-3 py-2 text-xs shadow-sm"
      style={{ backgroundColor: 'var(--tooltip-bg, #fff)', borderColor: 'var(--tooltip-border, #e5e7eb)', color: 'var(--tooltip-text, #111)' }}>
      <p className="font-semibold capitalize">{d.name}: {d.value} set{d.value !== 1 ? 's' : ''}</p>
      {d.subregions?.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {d.subregions.map((sub) => (
            <li key={sub.name} className="flex justify-between gap-4">
              <span className="opacity-80">{sub.name}</span>
              <span className="tabular-nums">{sub.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Progress() {
  const [stats, setStats] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [selectedEx, setSelectedEx] = useState('');
  const [selectedExName, setSelectedExName] = useState('');
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const pickerRef = useRef(null);

  useEffect(() => {
    Promise.all([workoutAPI.getStats(), exerciseAPI.getAll()])
      // Overcoming isometrics have no load or reps to track, so they aren't listed.
      .then(([s, e]) => { setStats(s.data); setExercises(e.data.filter((x) => x.type !== 'overcoming')); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedEx) return;
    workoutAPI.getProgress(selectedEx).then(({ data }) => setProgress(data)).catch(console.error);
  }, [selectedEx]);

  // Close the dropdown when clicking outside of it
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>;

  const weeklyData = buildWeeklyData(stats?.recentWorkouts || []);
  // Sets per muscle. Pecs, calves and triceps carry a per-sub-region breakdown for the tooltip.
  const muscleData = (stats?.muscleGroupStats || [])
    .map(m => ({ key: m._id, name: m._id.replace('_', ' '), value: m.count, subregions: m.subregions }))
    // Body order (upper → core → legs); anything unknown goes last, biggest first.
    .sort((a, b) => (MUSCLE_POS[a.key] ?? 99) - (MUSCLE_POS[b.key] ?? 99) || b.value - a.value);

  // Exercise ids from recent workouts, most recent first, deduped
  const recentIds = [];
  [...(stats?.recentWorkouts || [])]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .forEach((w) => (w.exercises || []).forEach((e) => {
      const id = e.exercise?._id || e.exercise;
      if (id && !recentIds.includes(id)) recentIds.push(id);
    }));
  const recentExercises = recentIds.map((id) => exercises.find((ex) => ex._id === id)).filter(Boolean);

  const query = search.trim().toLowerCase();
  const matches = query ? exercises.filter((ex) => ex.name.toLowerCase().includes(query)) : [];
  // When searching, bubble recently-done matches to the top
  const searchResults = [...matches].sort((a, b) => {
    const aIdx = recentIds.indexOf(a._id);
    const bIdx = recentIds.indexOf(b._id);
    if (aIdx === -1 && bIdx === -1) return a.name.localeCompare(b.name);
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    return aIdx - bIdx;
  });
  const otherExercises = exercises
    .filter((ex) => !recentIds.includes(ex._id))
    .sort((a, b) => a.name.localeCompare(b.name));

  const selectExercise = (ex) => {
    setSelectedEx(ex._id);
    setSelectedExName(ex.name);
    setSearch('');
    setDropdownOpen(false);
  };

  const clearExercise = () => {
    setSelectedEx('');
    setSelectedExName('');
    setSearch('');
    setProgress([]);
  };

  const inputValue = dropdownOpen ? search : selectedExName;

  // Shared dark-friendly chart props
  const gridColor = 'var(--chart-grid, #e2e8f0)';
  const tickStyle = { fontSize: 11, fill: 'var(--chart-tick, #6b7280)' };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Progress</h1>

      {/* Weekly Frequency */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Workouts per Week (last 12 weeks)</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={weeklyData}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis dataKey="week" tick={tickStyle} />
            <YAxis allowDecimals={false} tick={tickStyle} />
            <Tooltip contentStyle={{ backgroundColor: 'var(--tooltip-bg, #fff)', borderColor: 'var(--tooltip-border, #e5e7eb)', color: 'var(--tooltip-text, #111)' }} />
            <Bar dataKey="count" fill="#0ea5e9" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <VolumeCheck />

      <div className="grid md:grid-cols-2 gap-6">
        {/* Muscle Group Breakdown */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Muscle Groups Trained <span className="text-xs font-normal text-gray-400 dark:text-gray-500">· sets</span></h2>
          {muscleData.length === 0
            ? <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-8">No data yet</p>
            : <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={muscleData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                    startAngle={90} endAngle={-270}
                    label={({ name }) => name}
                    labelLine={{ stroke: 'var(--chart-tick, #6b7280)' }}>
                    {muscleData.map((d, i) => <Cell key={d.key} fill={MUSCLE_COLOR[d.key] || COLORS[i % COLORS.length]} />)}
                  </Pie>
                  {/* Custom content: shows sub-regions (e.g. clavicular/sternal/costal pecs) */}
                  <Tooltip content={<MuscleTooltip />} />
                </PieChart>
              </ResponsiveContainer>
          }
        </div>

        {/* Exercise Progress */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Exercise Progress</h2>
          <div className="relative mb-4" ref={pickerRef}>
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-9 pr-8"
              placeholder="Search exercises…"
              value={inputValue}
              onFocus={() => { setDropdownOpen(true); setSearch(''); }}
              onChange={e => setSearch(e.target.value)}
            />
            {inputValue && (
              <button
                onClick={clearExercise}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={14} />
              </button>
            )}

            {dropdownOpen && (
              <ul className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl shadow-lg max-h-72 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800">
                {query ? (
                  searchResults.length === 0
                    ? <li className="px-4 py-3 text-sm text-gray-400 dark:text-gray-500">No exercises found.</li>
                    : searchResults.map(ex => (
                        <li key={ex._id}>
                          <button onClick={() => selectExercise(ex)} className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{ex.name}</p>
                              <p className="text-xs text-gray-400 dark:text-gray-500 capitalize">{ex.muscleGroups?.join(', ')}</p>
                            </div>
                            {recentIds.includes(ex._id) && <Clock size={14} className="text-brand-500 shrink-0 ml-2" />}
                          </button>
                        </li>
                      ))
                ) : (
                  <>
                    {recentExercises.length > 0 && (
                      <li className="px-4 pt-2 pb-1 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide bg-gray-50/60 dark:bg-gray-800/40">
                        Recently done
                      </li>
                    )}
                    {recentExercises.map(ex => (
                      <li key={ex._id}>
                        <button onClick={() => selectExercise(ex)} className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{ex.name}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 capitalize">{ex.muscleGroups?.join(', ')}</p>
                          </div>
                          <Clock size={14} className="text-brand-500 shrink-0 ml-2" />
                        </button>
                      </li>
                    ))}
                    {otherExercises.length > 0 && (
                      <li className="px-4 pt-2 pb-1 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide bg-gray-50/60 dark:bg-gray-800/40">
                        All exercises
                      </li>
                    )}
                    {otherExercises.map(ex => (
                      <li key={ex._id}>
                        <button onClick={() => selectExercise(ex)} className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{ex.name}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 capitalize">{ex.muscleGroups?.join(', ')}</p>
                        </button>
                      </li>
                    ))}
                  </>
                )}
              </ul>
            )}
          </div>
          {exercises.find((x) => x._id === selectedEx)?.type === 'yielding' && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Holds are tracked as reps: every 2 seconds held counts as 1 rep, and every 2 seconds in reserve as 1 RIR (16s @ 2s in reserve = 8 reps @ 1 RIR).</p>
          )}
          {selectedEx && progress.length > 0
            ? <ResponsiveContainer width="100%" height={160}>
                <LineChart data={progress.map(p => ({ ...p, date: format(new Date(p.date), 'MMM d') }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="date" tick={tickStyle} />
                  <YAxis tick={tickStyle} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--tooltip-bg, #fff)', borderColor: 'var(--tooltip-border, #e5e7eb)', color: 'var(--tooltip-text, #111)' }} />
                  <Line type="monotone" dataKey="oneRM" stroke="#0ea5e9" strokeWidth={2} dot={false} name="Est. 1RM (kg)" />
                  <Line type="monotone" dataKey="maxWeight" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Max Weight (kg)" />
                </LineChart>
              </ResponsiveContainer>
            : selectedEx
              ? <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-6">No data for this exercise yet.</p>
              : null
          }
        </div>
      </div>
    </div>
  );
}

function buildWeeklyData(workouts) {
  const weeks = {};
  workouts.forEach(w => {
    const d = new Date(w.date);
    const startOfWeek = new Date(d);
    startOfWeek.setDate(d.getDate() - d.getDay());
    const key = format(startOfWeek, 'MMM d');
    weeks[key] = (weeks[key] || 0) + 1;
  });
  return Object.entries(weeks).map(([week, count]) => ({ week, count })).slice(-12);
}
