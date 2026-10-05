import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { workoutAPI, nutritionAPI, stepsAPI } from '../api';
import { format, subDays } from 'date-fns';
import { stepStreak } from '../utils/stepStreak';
import { Dumbbell, Flame, Calendar, Footprints } from 'lucide-react';
import VolumeCheck from '../components/VolumeCheck';

const StatCard = ({ icon: Icon, label, value, color }) => (
  <div className="card flex items-center gap-4">
    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
      <Icon size={20} className="text-white" />
    </div>
    <div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  </div>
);

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentWorkouts, setRecentWorkouts] = useState([]);
  const [todayNutrition, setTodayNutrition] = useState(null);
  const [steps, setSteps] = useState(null); // { goal, days: [today?] }
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const today = format(new Date(), 'yyyy-MM-dd');
        const [statsRes, workoutsRes, nutritionRes, stepsRes] = await Promise.all([
          workoutAPI.getStats(),
          workoutAPI.getAll({ limit: 5 }),
          nutritionAPI.getByDate(today),
          // 60 days for the step streak; today's entry is in there too.
          stepsAPI.getRange(format(subDays(new Date(), 59), 'yyyy-MM-dd'), today).catch(() => null),
        ]);
        setStats(statsRes.data);
        setRecentWorkouts(workoutsRes.data.workouts);
        setTodayNutrition(nutritionRes.data);
        setSteps(stepsRes?.data ?? null);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const totalCaloriesToday = Math.round(todayNutrition?.meals?.reduce((sum, m) => sum + m.calories, 0) ?? 0);
  const stepsToday = steps?.days?.find((d) => d.date.slice(0, 10) === format(new Date(), 'yyyy-MM-dd'));

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Good {getGreeting()}, {user?.name?.split(' ')[0]}</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{format(new Date(), 'EEEE, MMMM d')}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Dumbbell}   label="Total Workouts" value={stats?.totalWorkouts ?? 0} color="bg-brand-600" />
        <StatCard icon={Calendar}   label="This Week"      value={stats?.recentWorkouts?.filter(w => isThisWeek(w.date)).length ?? 0} color="bg-violet-500" />
        <StatCard icon={Flame}      label="Calories Today" value={totalCaloriesToday} color="bg-orange-500" />
        <StatCard icon={Footprints} label="Step Streak"    value={`${steps ? stepStreak(steps.days, steps.goal) : 0}d`} color="bg-emerald-500" />
      </div>

      {/* Only shows when some muscle is below maintenance; links to Progress */}
      <VolumeCheck compact />

      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent Workouts */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Recent Workouts</h2>
            <div className="flex items-center gap-3">
              <Link to="/history" className="text-sm text-gray-500 dark:text-gray-400 font-medium hover:underline">View all</Link>
              <Link to="/log" className="text-sm text-brand-600 font-medium hover:underline">+ Log</Link>
            </div>
          </div>
          {recentWorkouts.length === 0
            ? <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">No workouts yet. <Link to="/log" className="text-brand-600">Log your first!</Link></p>
            : <ul className="space-y-3">
                {recentWorkouts.map((w) => (
                  <li key={w._id} className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-800 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{w.name}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">{format(new Date(w.date), 'MMM d')} · {w.exercises.length} exercises</p>
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-500">{w.duration}min</span>
                  </li>
                ))}
              </ul>
          }
        </div>

        {/* Today's Nutrition */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Today's Nutrition</h2>
            <div className="flex items-center gap-3">
              <Link to="/history?tab=nutrition" className="text-sm text-gray-500 dark:text-gray-400 font-medium hover:underline">History</Link>
              <Link to="/nutrition" className="text-sm text-brand-600 font-medium hover:underline">Track</Link>
            </div>
          </div>
          {!todayNutrition
            ? <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">No meals logged today. <Link to="/nutrition" className="text-brand-600">Add one!</Link></p>
            : <div className="space-y-3">
                {['calories','protein','carbs','fat'].map((macro) => {
                  const val = todayNutrition.meals.reduce((s,m) => s + (m[macro] || 0), 0);
                  const goal = Math.round(todayNutrition.dailyGoals?.[macro] || 1);
                  const pct = Math.min(100, Math.round((val / goal) * 100));
                  const displayVal = Math.round(val);
                  return (
                    <div key={macro}>
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                        <span className="capitalize">{macro}</span>
                        <span>{displayVal} / {goal}{macro === 'calories' ? ' kcal' : 'g'}</span>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
          }
        </div>

        {/* Today's Steps */}
        {steps && (
          <div className="card md:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h2 className="flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100"><Footprints size={16} className="text-brand-600" /> Today's Steps</h2>
              <Link to="/steps" className="text-sm text-brand-600 font-medium hover:underline">{stepsToday ? 'Update' : '+ Log'}</Link>
            </div>
            {(() => {
              const n = stepsToday?.steps || 0;
              const pct = Math.min(100, Math.round((n / steps.goal) * 100));
              return (
                <div>
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                    <span><span className="text-base font-bold text-gray-900 dark:text-gray-100">{n.toLocaleString()}</span> / {steps.goal.toLocaleString()} steps</span>
                    <span>{stepsToday?.burned > 0 ? `≈${stepsToday.burned} kcal burned${stepsToday.calories > 0 ? ` · +${stepsToday.calories} to target` : ''}` : `${pct}%`}</span>
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-emerald-500' : 'bg-brand-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

function isThisWeek(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0,0,0,0);
  return d >= startOfWeek;
}
