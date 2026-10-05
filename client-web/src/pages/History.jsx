import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { workoutAPI, nutritionAPI } from '../api';
import { MEAL_TYPES } from '../constants/nutrition';
import { setLabel, workingSetCount } from '../utils/workoutSummary';
import { Trash2, ChevronDown, ChevronUp, AlertTriangle, X, Dumbbell, Apple, Share2, Salad } from 'lucide-react';

const PAGE_SIZE = 10;
const fmtRest = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

// ── Shared pieces ───────────────────────────────────────────────────────────

const Spinner = () => (
  <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
);

const ErrorBox = ({ children }) => (
  <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm rounded-lg">{children}</div>
);

function Pager({ page, pages, loading, setPage }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between">
      <button onClick={() => setPage((p) => p - 1)} disabled={page <= 1 || loading} className="btn-secondary text-sm disabled:opacity-40">Previous</button>
      <span className="text-sm text-gray-500 dark:text-gray-400">Page {page} of {pages}</span>
      <button onClick={() => setPage((p) => p + 1)} disabled={page >= pages || loading} className="btn-secondary text-sm disabled:opacity-40">Next</button>
    </div>
  );
}

// Typed confirmation for wiping a whole history — it can't be undone.
function ClearAllModal({ title, description, onConfirm, onClose, busy }) {
  const [text, setText] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 dark:bg-black/50 px-4">
      <div className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-2xl shadow-xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle size={22} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-gray-900 dark:text-gray-100">{title}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Type <span className="font-mono font-semibold">DELETE</span> to confirm</label>
          <input autoFocus className="input" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={onConfirm} disabled={text !== 'DELETE' || busy} className="btn-danger flex-1 justify-center disabled:opacity-40">
            {busy ? 'Deleting…' : 'Delete all'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Paginated list + delete-one + clear-all, shared by both tabs.
 * `fetchPage(page)` must resolve to { items, total, pages }.
 */
function usePagedHistory(fetchPage) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (p) => {
    setLoading(true);
    try {
      const res = await fetchPage(p);
      // If the last item on a page was deleted, step back a page.
      if (res.items.length === 0 && p > 1) { setPage(p - 1); return; }
      setItems(res.items);
      setTotal(res.total);
      setPages(Math.max(1, res.pages));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);

  useEffect(() => { load(page); }, [page, load]);

  const reset = () => { setItems([]); setTotal(0); setPages(1); setPage(1); };
  return { items, total, page, pages, loading, error, setError, setPage, reload: () => load(page), reset };
}

function HistoryHeader({ countLabel, onClearAll, canClear }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-gray-400 dark:text-gray-500">{countLabel}</p>
      {canClear && (
        <button onClick={onClearAll} className="btn-danger text-sm">
          <Trash2 size={15} /> Clear all
        </button>
      )}
    </div>
  );
}

// ── Workouts ────────────────────────────────────────────────────────────────

function WorkoutRow({ workout, onDelete, deleting }) {
  const [open, setOpen] = useState(false);
  const totalSets = workingSetCount(workout);

  return (
    <li className="card !p-4">
      <div className="flex items-center gap-3">
        <button onClick={() => setOpen(!open)} className="flex-1 text-left min-w-0">
          <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{workout.name}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {format(new Date(workout.date), 'EEE, MMM d, yyyy')} · {workout.exercises.length} exercise{workout.exercises.length !== 1 ? 's' : ''} · {totalSets} set{totalSets !== 1 ? 's' : ''} · {workout.duration}min
          </p>
        </button>
        {open ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
        <Link to={`/feed?share=${workout._id}`} className="p-1.5 text-gray-400 hover:text-brand-600 shrink-0" title="Share to the community">
          <Share2 size={16} />
        </Link>
        <button onClick={() => onDelete(workout)} disabled={deleting} className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 disabled:opacity-40 shrink-0" title="Delete workout">
          <Trash2 size={16} />
        </button>
      </div>

      {open && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 space-y-2">
          {workout.exercises.map((ex, i) => (
            <div key={i}>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{ex.exercise?.name ?? 'Deleted exercise'}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {ex.sets.map((s) => `${setLabel(s, ex.weightUnit)}${s.restTime != null ? ` (rest ${fmtRest(s.restTime)})` : ''}`).join(' · ')}
              </p>
            </div>
          ))}
          {workout.notes && <p className="text-xs italic text-gray-400 dark:text-gray-500 pt-1">“{workout.notes}”</p>}
        </div>
      )}
    </li>
  );
}

const fetchWorkouts = async (page) => {
  const { data } = await workoutAPI.getAll({ page, limit: PAGE_SIZE });
  return { items: data.workouts, total: data.total, pages: data.pages };
};

function WorkoutHistory() {
  const h = usePagedHistory(fetchWorkouts);
  const [deletingId, setDeletingId] = useState(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const handleDelete = async (w) => {
    if (!window.confirm(`Delete "${w.name}" from ${format(new Date(w.date), 'MMM d, yyyy')}? This can't be undone.`)) return;
    setDeletingId(w._id);
    h.setError('');
    try { await workoutAPI.delete(w._id); await h.reload(); }
    catch (err) { h.setError(err.response?.data?.message || 'Failed to delete workout'); }
    finally { setDeletingId(null); }
  };

  const handleClearAll = async () => {
    setClearing(true);
    h.setError('');
    try { await workoutAPI.deleteAll(); h.reset(); setClearOpen(false); }
    catch (err) { h.setError(err.response?.data?.message || 'Failed to clear history'); }
    finally { setClearing(false); }
  };

  return (
    <div className="space-y-4">
      <HistoryHeader countLabel={`${h.total} workout${h.total !== 1 ? 's' : ''} logged`} canClear={h.total > 0} onClearAll={() => setClearOpen(true)} />
      {h.error && <ErrorBox>{h.error}</ErrorBox>}

      {h.loading && h.items.length === 0 ? <Spinner /> : h.items.length === 0 ? (
        <div className="card text-center py-12 text-gray-400 dark:text-gray-500">
          <Dumbbell size={36} strokeWidth={1.5} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="font-medium text-gray-600 dark:text-gray-400">No workouts logged</p>
          <p className="text-sm mt-1"><Link to="/log" className="text-brand-600">Log a workout</Link> to start building your history.</p>
        </div>
      ) : (
        <>
          <ul className={`space-y-3 ${h.loading ? 'opacity-60' : ''}`}>
            {h.items.map((w) => <WorkoutRow key={w._id} workout={w} onDelete={handleDelete} deleting={deletingId === w._id} />)}
          </ul>
          <Pager page={h.page} pages={h.pages} loading={h.loading} setPage={h.setPage} />
        </>
      )}

      {clearOpen && (
        <ClearAllModal
          title="Delete all workout history?"
          description={`This permanently deletes all ${h.total} logged workout${h.total !== 1 ? 's' : ''}, and resets your stats and progress charts. Your plans and exercises are kept.`}
          busy={clearing}
          onConfirm={handleClearAll}
          onClose={() => setClearOpen(false)}
        />
      )}
    </div>
  );
}

// ── Nutrition ───────────────────────────────────────────────────────────────

const r = (n) => Math.round(n || 0);

function sumMeals(meals) {
  return meals.reduce(
    (t, m) => ({ calories: t.calories + (m.calories || 0), protein: t.protein + (m.protein || 0), carbs: t.carbs + (m.carbs || 0), fat: t.fat + (m.fat || 0) }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

function NutritionRow({ log, onDeleteDay, onDeleteMeal, busy }) {
  const [open, setOpen] = useState(false);
  const t = sumMeals(log.meals);
  const goal = log.dailyGoals?.calories;
  const meals = [...log.meals].sort((a, b) => MEAL_TYPES.indexOf(a.mealType) - MEAL_TYPES.indexOf(b.mealType));

  return (
    <li className="card !p-4">
      <div className="flex items-center gap-3">
        <button onClick={() => setOpen(!open)} className="flex-1 text-left min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <p className="font-medium text-gray-900 dark:text-gray-100">{format(new Date(log.date), 'EEE, MMM d, yyyy')}</p>
            <p className="text-sm font-semibold text-brand-600">{r(t.calories).toLocaleString()} kcal</p>
            {goal ? <p className="text-xs text-gray-400 dark:text-gray-500">/ {r(goal).toLocaleString()} goal</p> : null}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            P {r(t.protein)}g · C {r(t.carbs)}g · F {r(t.fat)}g · {log.meals.length} meal{log.meals.length !== 1 ? 's' : ''}
          </p>
        </button>
        {open ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
        <button onClick={() => onDeleteDay(log)} disabled={busy} className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 disabled:opacity-40 shrink-0" title="Delete this day">
          <Trash2 size={16} />
        </button>
      </div>

      {open && (
        <ul className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 space-y-2">
          {meals.map((m) => (
            <li key={m._id} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
                  <span className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 mr-1.5">{m.mealType}</span>
                  {m.name}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">{r(m.calories)} kcal · P {r(m.protein)}g · C {r(m.carbs)}g · F {r(m.fat)}g</p>
              </div>
              <button onClick={() => onDeleteMeal(log, m)} disabled={busy} className="p-1 text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 disabled:opacity-40 shrink-0" title="Delete meal">
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

const fetchNutrition = async (page) => {
  const { data } = await nutritionAPI.getHistory({ page, limit: PAGE_SIZE });
  return { items: data.logs, total: data.total, pages: data.pages };
};

function NutritionHistory() {
  const h = usePagedHistory(fetchNutrition);
  const [busyId, setBusyId] = useState(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const run = async (logId, action, failMsg) => {
    setBusyId(logId);
    h.setError('');
    try { await action(); await h.reload(); }
    catch (err) { h.setError(err.response?.data?.message || failMsg); }
    finally { setBusyId(null); }
  };

  const handleDeleteDay = (log) => {
    if (!window.confirm(`Delete all ${log.meals.length} meal${log.meals.length !== 1 ? 's' : ''} from ${format(new Date(log.date), 'MMM d, yyyy')}? This can't be undone.`)) return;
    run(log._id, () => nutritionAPI.deleteLog(log._id), 'Failed to delete day');
  };

  const handleDeleteMeal = (log, meal) => {
    if (!window.confirm(`Delete "${meal.name}" from ${format(new Date(log.date), 'MMM d')}?`)) return;
    // Removing the last meal leaves an empty day, which drops out of the history on reload.
    run(log._id, () => nutritionAPI.deleteMeal(log._id, meal._id), 'Failed to delete meal');
  };

  const handleClearAll = async () => {
    setClearing(true);
    h.setError('');
    try { await nutritionAPI.deleteAll(); h.reset(); setClearOpen(false); }
    catch (err) { h.setError(err.response?.data?.message || 'Failed to clear history'); }
    finally { setClearing(false); }
  };

  return (
    <div className="space-y-4">
      <HistoryHeader countLabel={`${h.total} day${h.total !== 1 ? 's' : ''} logged`} canClear={h.total > 0} onClearAll={() => setClearOpen(true)} />
      {h.error && <ErrorBox>{h.error}</ErrorBox>}

      {h.loading && h.items.length === 0 ? <Spinner /> : h.items.length === 0 ? (
        <div className="card text-center py-12 text-gray-400 dark:text-gray-500">
          <Salad size={36} strokeWidth={1.5} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="font-medium text-gray-600 dark:text-gray-400">No meals logged</p>
          <p className="text-sm mt-1"><Link to="/nutrition" className="text-brand-600">Log a meal</Link> to start building your history.</p>
        </div>
      ) : (
        <>
          <ul className={`space-y-3 ${h.loading ? 'opacity-60' : ''}`}>
            {h.items.map((log) => (
              <NutritionRow key={log._id} log={log} onDeleteDay={handleDeleteDay} onDeleteMeal={handleDeleteMeal} busy={busyId === log._id} />
            ))}
          </ul>
          <Pager page={h.page} pages={h.pages} loading={h.loading} setPage={h.setPage} />
        </>
      )}

      {clearOpen && (
        <ClearAllModal
          title="Delete all nutrition history?"
          description={`This permanently deletes every meal from all ${h.total} logged day${h.total !== 1 ? 's' : ''}, and resets your average calories stat. The food database is kept.`}
          busy={clearing}
          onConfirm={handleClearAll}
          onClose={() => setClearOpen(false)}
        />
      )}
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'workouts',  label: 'Workouts',  icon: Dumbbell },
  { key: 'nutrition', label: 'Nutrition', icon: Apple },
];

export default function History() {
  // Tab lives in the URL (?tab=nutrition) so it survives refreshes and can be linked to.
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'nutrition' ? 'nutrition' : 'workouts';

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">History</h1>

      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setParams(key === 'workouts' ? {} : { tab: key }, { replace: true })}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              tab === key
                ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {tab === 'workouts' ? <WorkoutHistory /> : <NutritionHistory />}
    </div>
  );
}
