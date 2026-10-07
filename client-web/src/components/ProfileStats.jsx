import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { userAPI } from '../api';
import { Flame, Gauge, CalendarDays, Trophy, Lock, Globe, Footprints } from 'lucide-react';
import { oneRepMaxSourceLabel } from '../utils/workoutSummary';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FIELD_LABELS = { height: 'height', weight: 'weight', bodyFat: 'body fat %' };

function VisibilityToggle({ isPublic, onToggle, busy }) {
  return (
    <button
      onClick={onToggle}
      disabled={busy}
      title={isPublic ? 'Visible to everyone — click to make private' : 'Only you can see this — click to make public'}
      className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full transition-colors disabled:opacity-50 ${
        isPublic
          ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
      }`}
    >
      {isPublic ? <Globe size={11} /> : <Lock size={11} />}
      {isPublic ? 'Public' : 'Private'}
    </button>
  );
}

function StatCard({ icon: Icon, title, statKey, owner, children }) {
  return (
    <div className="card !p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
          <Icon size={15} className="text-brand-600" /> {title}
        </h3>
        {owner && (
          <VisibilityToggle
            isPublic={owner.visibility[statKey]}
            busy={owner.busyKey === statKey}
            onToggle={() => owner.onToggle(statKey)}
          />
        )}
      </div>
      {children}
    </div>
  );
}

const Empty = ({ children }) => <p className="text-sm text-gray-400 dark:text-gray-500">{children}</p>;

function CaloriesBody({ data, isOwner }) {
  if (!data) return <Empty>{isOwner ? <>No meals logged in the last 30 days. <Link to="/nutrition" className="text-brand-600">Log some</Link>.</> : 'No meals logged recently.'}</Empty>;
  return (
    <div>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{data.average.toLocaleString()} <span className="text-sm font-normal text-gray-400">kcal/day</span></p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Average of {data.daysLogged} logged day{data.daysLogged !== 1 ? 's' : ''} in the last {data.periodDays} days</p>
    </div>
  );
}

function StepsBody({ data, isOwner }) {
  if (!data) return <Empty>{isOwner ? <>No steps logged in the last 30 days. <Link to="/steps" className="text-brand-600">Log some</Link>.</> : 'No steps logged recently.'}</Empty>;
  return (
    <div>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{data.average.toLocaleString()} <span className="text-sm font-normal text-gray-400">steps/day</span></p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
        Goal of {data.goal.toLocaleString()} reached on {data.daysAtGoal} of {data.daysLogged} logged day{data.daysLogged !== 1 ? 's' : ''} in the last {data.periodDays} days
      </p>
    </div>
  );
}

function FfmiBody({ data, isOwner, onEdit }) {
  if (!data) return <Empty>Not available.</Empty>;
  if (data.missing) {
    const list = data.missing.map((m) => FIELD_LABELS[m]).join(', ');
    return <Empty>Add your {list} to your profile to see your FFMI. <button onClick={onEdit} className="text-brand-600">Edit profile</button></Empty>;
  }
  return (
    <div>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{data.normalizedFfmi.toFixed(1)} <span className="text-sm font-normal text-gray-400">normalized</span></p>
      <div className="flex items-center gap-2 mt-1 flex-wrap">
        <span className="badge bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400">{data.category}</span>
        <span className="text-xs text-gray-400 dark:text-gray-500">Raw FFMI {data.ffmi.toFixed(1)}</span>
      </div>
      {isOwner && <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2">Your weight and body fat % are never shown to others, only the index.</p>}
    </div>
  );
}

function SplitBody({ data, isOwner }) {
  if (!data) return <Empty>{isOwner ? <>No active plan or recent workouts. <Link to="/plans" className="text-brand-600">Set up a plan</Link>.</> : 'No recent training.'}</Empty>;
  return (
    <div className="space-y-3">
      {data.plan && (
        <div>
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{data.plan.name}</p>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {data.plan.days.map((d, i) => (
              <span key={i} className="text-[11px] px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                <span className="font-semibold">{DAY_NAMES[d.dayOfWeek] ?? '—'}</span>{d.label ? ` · ${d.label}` : ''}
              </span>
            ))}
          </div>
        </div>
      )}
      <p className="text-xs text-gray-400 dark:text-gray-500">
        {data.workoutsPerWeek} workouts/week · {data.totalSets} sets in the last {data.periodDays} days
      </p>
      {data.breakdown.length > 0 && (
        <div className="space-y-1.5">
          {data.breakdown.map((b) => (
            <div key={b.region} className="flex items-center gap-2">
              <span className="text-xs text-gray-600 dark:text-gray-300 w-20 shrink-0">{b.region}</span>
              <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <div className="h-full bg-brand-500 rounded-full" style={{ width: `${b.percent}%` }} />
              </div>
              <span className="text-[11px] text-gray-400 dark:text-gray-500 w-9 text-right">{b.percent}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MaxesBody({ data, isOwner }) {
  const [showAll, setShowAll] = useState(false);
  if (!data) return <Empty>{isOwner ? 'Log some weighted sets of 12 reps or fewer to see your 1RMs.' : 'No lifts logged yet.'}</Empty>;
  const shown = showAll ? data : data.slice(0, 5);
  return (
    <div>
      <ul className="divide-y divide-gray-100 dark:divide-gray-800">
        {shown.map((m) => (
          <li key={m.exerciseId} className="flex items-center justify-between py-1.5 gap-3">
            <div className="min-w-0">
              <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{m.name}</p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500">
                {m.isEstimate ? `Est. from ${oneRepMaxSourceLabel(m.fromSet)}` : 'Actual single'}{m.fromSet.side ? ` (${m.fromSet.side})` : ''} · {format(new Date(m.date), 'MMM d, yyyy')}
              </p>
            </div>
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100 shrink-0">{m.oneRepMax} kg</p>
          </li>
        ))}
      </ul>
      {data.length > 5 && (
        <button onClick={() => setShowAll(!showAll)} className="text-xs text-brand-600 font-medium mt-2">
          {showAll ? 'Show less' : `Show all ${data.length}`}
        </button>
      )}
    </div>
  );
}

/**
 * Stats section for a profile. `userId` is whose profile it is; `refreshKey`
 * changes when the owner edits their profile (weight etc. affect FFMI).
 */
export default function ProfileStats({ userId, refreshKey, onEditProfile }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    userAPI.getStats(userId)
      .then((res) => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [userId, refreshKey]);

  const toggle = async (key) => {
    const next = !data.visibility[key];
    setBusyKey(key);
    setError('');
    try {
      const { data: user } = await userAPI.updateMe({ statsVisibility: { [key]: next } });
      setData((d) => ({ ...d, visibility: { ...d.visibility, ...user.statsVisibility } }));
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update visibility');
    } finally {
      setBusyKey(null);
    }
  };

  if (loading && !data) return null;
  if (!data) return null;

  const { isOwner, stats } = data;
  // Visitors only get the stats the owner made public; hide the section if none.
  if (!isOwner && Object.keys(stats).length === 0) return null;

  const owner = isOwner ? { visibility: data.visibility, busyKey, onToggle: toggle } : null;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">Stats</h2>
        {isOwner && <p className="text-xs text-gray-400 dark:text-gray-500">Private stats are only visible to you</p>}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="grid sm:grid-cols-2 gap-4">
        {'avgCalories' in stats && (
          <StatCard icon={Flame} title="Average Calories" statKey="avgCalories" owner={owner}>
            <CaloriesBody data={stats.avgCalories} isOwner={isOwner} />
          </StatCard>
        )}
        {'avgSteps' in stats && (
          <StatCard icon={Footprints} title="Average Steps" statKey="avgSteps" owner={owner}>
            <StepsBody data={stats.avgSteps} isOwner={isOwner} />
          </StatCard>
        )}
        {'ffmi' in stats && (
          <StatCard icon={Gauge} title="FFMI" statKey="ffmi" owner={owner}>
            <FfmiBody data={stats.ffmi} isOwner={isOwner} onEdit={onEditProfile} />
          </StatCard>
        )}
        {'split' in stats && (
          <StatCard icon={CalendarDays} title="Workout Split" statKey="split" owner={owner}>
            <SplitBody data={stats.split} isOwner={isOwner} />
          </StatCard>
        )}
        {'oneRepMaxes' in stats && (
          <StatCard icon={Trophy} title="1 Rep Maxes" statKey="oneRepMaxes" owner={owner}>
            <MaxesBody data={stats.oneRepMaxes} isOwner={isOwner} />
          </StatCard>
        )}
      </div>
    </div>
  );
}
