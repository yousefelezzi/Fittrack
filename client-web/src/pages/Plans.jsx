import { useState, useEffect } from 'react';
import { planAPI, exerciseAPI } from '../api';
import ExerciseCombobox from '../components/ExerciseCombobox';
import { formatPlanWeight } from '../utils/planAnalysis';
import PlanGenerator from '../components/PlanGenerator';
import SimilarExercises from '../components/SimilarExercises';
import { Plus, Trash2, ChevronDown, ChevronUp, Zap, Check, Pencil, Sparkles, Repeat, ClipboardList } from 'lucide-react';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function PlanCard({ plan, onActivate, onDelete, onStart, onEdit }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`card border-2 transition-colors ${plan.isActive ? 'border-brand-500' : 'border-transparent dark:border-transparent'}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 cursor-pointer" onClick={() => setOpen(!open)}>
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-900 dark:text-gray-100">{plan.name}</p>
            {plan.isActive && (
              <span className="badge bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-400 text-xs">Active</span>
            )}
          </div>
          {plan.description && (
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{plan.description}</p>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{plan.days.length} day{plan.days.length !== 1 ? 's' : ''} configured</p>
        </div>
        <div className="flex items-center gap-2 ml-3">
          {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </div>

      {open && (
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 space-y-3">
          {plan.days.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">No days configured yet.</p>
          ) : (
            <>
            {plan.schedule === 'rotation' && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Rotation — {plan.rotation?.everyDays
                  ? (plan.rotation.everyDays === 2 ? 'every other day' : `every ${plan.rotation.everyDays} days`)
                  : `on ${(plan.rotation?.weekdays || []).map((d) => DAYS[d]?.slice(0, 3)).join(', ')}`}: do the workouts in order, then repeat.
              </p>
            )}
            {plan.days.map((day) => (
              <div key={day.dayOfWeek} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {plan.schedule === 'rotation' ? `Workout ${day.dayOfWeek + 1}` : DAYS[day.dayOfWeek]} {day.label ? `— ${day.label}` : ''}
                </p>
                <ul className="space-y-1">
                  {day.exercises.map((e, i) => (
                    <li key={i} className="text-xs text-gray-500 dark:text-gray-400 flex justify-between">
                      <span>{e.exercise?.name ?? 'Unknown'}</span>
                      <span className="text-gray-400 dark:text-gray-500">{e.targetSets}×{e.targetReps}{e.targetRepsMax ? `–${e.targetRepsMax}` : ''} @ {formatPlanWeight(e)}{e.targetRir ? ` · ${e.targetRir} RIR` : ''}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            </>
          )}

          <div className="flex gap-2 pt-1">
            {!plan.isActive && (
              <button onClick={() => onActivate(plan._id)} className="btn-secondary text-xs py-1.5 flex-1 justify-center">
                <Check size={13} /> Set Active
              </button>
            )}
            <button onClick={() => onStart(plan._id)} className="btn-primary text-xs py-1.5 flex-1 justify-center">
              <Zap size={13} /> Start Today
            </button>
            <button onClick={() => onEdit(plan)} className="btn-secondary text-xs py-1.5 px-3">
              <Pencil size={13} />
            </button>
            <button onClick={() => onDelete(plan._id)} className="btn-danger text-xs py-1.5 px-3">
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Small label above each box in the plan editor.
const fieldLabel = 'block text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-0.5 whitespace-nowrap';

const emptyDay = () => ({ dayOfWeek: 1, label: '', exercises: [] });
const emptyExercise = (weightUnit = 'kg') => ({ exercise: '', targetSets: 3, targetReps: 10, targetWeight: 0, weightUnit });

export default function Plans() {
  const [plans, setPlans] = useState([]);
  const [genOpen, setGenOpen] = useState(false);
  const [similarFor, setSimilarFor] = useState(null); // "day-exercise" row showing similar exercises
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState(null); // null = creating new, otherwise _id of plan being edited
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', description: '', days: [] });

  useEffect(() => {
    Promise.all([planAPI.getAll(), exerciseAPI.getAll()])
      .then(([p, e]) => { setPlans(p.data); setExercises(e.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const closeModal = () => {
    setCreating(false);
    setEditingId(null);
    setForm({ name: '', description: '', days: [] });
    setError('');
  };

  const openCreate = () => {
    setForm({ name: '', description: '', days: [] });
    setEditingId(null);
    setError('');
    setCreating(true);
  };

  const openEdit = (plan) => {
    setForm({
      name: plan.name,
      description: plan.description || '',
      // Keep a rotation plan a rotation when it's saved again.
      schedule: plan.schedule || 'weekly',
      ...(plan.rotation && { rotation: plan.rotation }),
      // exercises come back populated (e.exercise is the full Exercise doc) —
      // the exercise picker just needs the id, so unwrap it back down to a string
      days: plan.days.map((d) => ({
        dayOfWeek: d.dayOfWeek,
        label: d.label || '',
        exercises: d.exercises.map((e) => ({
          exercise: e.exercise?._id || e.exercise || '',
          targetSets: e.targetSets,
          targetReps: e.targetReps,
          targetWeight: e.targetWeight,
          weightUnit: e.weightUnit || 'kg',
          targetRepsMax: e.targetRepsMax ?? '',
          targetRir: e.targetRir || '', // keep the generator's RIR target when editing
        })),
      })),
    });
    setEditingId(plan._id);
    setError('');
    setCreating(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Plan name is required'); return; }
    setError('');
    setSaving(true);
    // In a rotation, a workout's position is its order.
    const payload = form.schedule === 'rotation'
      ? { ...form, days: form.days.map((d, i) => ({ ...d, dayOfWeek: i })) }
      : form;
    try {
      if (editingId) {
        const { data } = await planAPI.update(editingId, payload);
        setPlans((prev) => prev.map((p) => (p._id === editingId ? data : p)));
      } else {
        const { data } = await planAPI.create(payload);
        setPlans((prev) => [data, ...prev]);
      }
      closeModal();
    } catch (err) {
      setError(err.response?.data?.message || `Failed to ${editingId ? 'save' : 'create'} plan`);
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async (id) => { const { data } = await planAPI.activate(id); setPlans((prev) => prev.map((p) => ({ ...p, isActive: p._id === data._id }))); };
  const handleDelete  = async (id) => { if (!window.confirm('Delete this plan?')) return; await planAPI.delete(id); setPlans((prev) => prev.filter((p) => p._id !== id)); };
  const handleStart   = async (id) => { try { await planAPI.start(id, new Date().getDay()); alert("Today's workout session created! Head to Log Workout to continue."); } catch (err) { alert(err.response?.data?.message || 'Could not start plan for today'); } };

  const addDay    = () => setForm((f) => ({ ...f, days: [...f.days, emptyDay()] }));
  const removeDay = (i) => setForm((f) => ({ ...f, days: f.days.filter((_, di) => di !== i) }));
  const updateDay = (i, field, val) => setForm((f) => ({ ...f, days: f.days.map((d, di) => di !== i ? d : { ...d, [field]: val }) }));

  // A new exercise starts in the same unit as the one above it.
  const addExToDay      = (di)          => setForm((f) => ({ ...f, days: f.days.map((d, i) => i !== di ? d : { ...d, exercises: [...d.exercises, emptyExercise(d.exercises.at(-1)?.weightUnit)] }) }));
  const removeExFromDay = (di, ei)      => setForm((f) => ({ ...f, days: f.days.map((d, i) => i !== di ? d : { ...d, exercises: d.exercises.filter((_, j) => j !== ei) }) }));
  // An exercise can only be in a day once, so picking one that's already there is ignored.
  const updateDayEx     = (di, ei, field, val) => setForm((f) => {
    if (field === 'exercise' && val && f.days[di].exercises.some((e, j) => j !== ei && e.exercise === val)) return f;
    return { ...f, days: f.days.map((d, i) => i !== di ? d : { ...d, exercises: d.exercises.map((e, j) => j !== ei ? e : { ...e, [field]: field === 'exercise' || field === 'weightUnit' ? val : field === 'targetRepsMax' && val === '' ? '' : Number(val) }) }) };
  });
  // The day's other exercises, which can't be picked again.
  const othersInDay = (day, ei) => day.exercises.filter((_, j) => j !== ei).map((e) => e.exercise).filter(Boolean);

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Workout Plans</h1>
        <div className="flex gap-2">
          <button onClick={() => setGenOpen(true)} className="btn-secondary">
            <Sparkles size={16} /> Planner
          </button>
          <button onClick={openCreate} className="btn-primary">
            <Plus size={16} /> New Plan
          </button>
        </div>
      </div>

      {plans.length === 0 && !creating && (
        <div className="card text-center py-12 text-gray-400 dark:text-gray-500">
          <ClipboardList size={36} strokeWidth={1.5} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="font-medium text-gray-600 dark:text-gray-400">No plans yet</p>
          <p className="text-sm mt-1">Create a structured weekly workout plan to stay consistent.</p>
        </div>
      )}

      {plans.map((plan) => (
        <PlanCard key={plan._id} plan={plan} onActivate={handleActivate} onDelete={handleDelete} onStart={handleStart} onEdit={openEdit} />
      ))}

      {creating && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 dark:bg-black/50 px-4 overflow-y-auto py-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-2xl shadow-xl p-5 space-y-4 my-auto">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-lg">{editingId ? 'Edit Plan' : 'New Plan'}</h2>
            {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded-lg p-3">{error}</p>}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
              <input className="input" placeholder="e.g. Push/Pull/Legs" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description (optional)</label>
              <input className="input" placeholder="Brief description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Days</label>
                <button onClick={addDay} className="text-xs text-brand-600 font-medium hover:underline">+ Add day</button>
              </div>
              <div className="space-y-3">
                {form.days.map((day, di) => (
                  <div key={di} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      {form.schedule === 'rotation' ? (
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-300 px-2">Workout {di + 1}</span>
                      ) : (
                      <select className="input text-sm" value={day.dayOfWeek} onChange={(e) => updateDay(di, 'dayOfWeek', Number(e.target.value))}>
                        {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                      </select>
                      )}
                      <input className="input text-sm" placeholder="Label (e.g. Push)" value={day.label} onChange={(e) => updateDay(di, 'label', e.target.value)} />
                      <button onClick={() => removeDay(di)} className="p-1.5 text-red-400 hover:text-red-600 shrink-0"><Trash2 size={14} /></button>
                    </div>
                    {/* One row of labels per day, lined up with the boxes below. */}
                    {day.exercises.length > 0 && (
                      <div className="flex items-end gap-1.5">
                        <span className={`flex-1 min-w-0 ${fieldLabel}`}>Exercise</span>
                        <span className={`w-14 shrink-0 text-center ${fieldLabel}`}>Sets</span>
                        <span className={`w-[7.5rem] shrink-0 text-center ${fieldLabel}`}>Weight</span>
                        <span className={`w-14 shrink-0 text-center ${fieldLabel}`}>Reps</span>
                        <span className="w-[3.25rem] shrink-0" />
                      </div>
                    )}
                    {day.exercises.map((ex, ei) => (
                      <div key={ei}>
                      <div className="flex items-center gap-1.5">
                        <ExerciseCombobox
                          className="flex-1 min-w-0"
                          exercises={exercises}
                          excludeIds={othersInDay(day, ei)}
                          value={ex.exercise}
                          onChange={(id) => updateDayEx(di, ei, 'exercise', id)}
                        />
                        <input type="number" min={1} aria-label="Sets" className="input text-xs text-center w-14 shrink-0" value={ex.targetSets} onChange={(e) => updateDayEx(di, ei, 'targetSets', e.target.value)} />
                        <div className="w-[7.5rem] shrink-0 flex items-center gap-1">
                          <input type="number" min={0} step="any" aria-label="Weight" className="input text-xs text-center flex-1 min-w-0" value={ex.targetWeight} onChange={(e) => updateDayEx(di, ei, 'targetWeight', e.target.value)} />
                          {/* Each exercise's weight can be in kg or lb. */}
                          <div className="flex shrink-0 rounded-md border border-gray-300 dark:border-gray-600 overflow-hidden text-[10px] font-medium">
                            {['kg', 'lb'].map((u) => (
                              <button key={u} type="button" onClick={() => updateDayEx(di, ei, 'weightUnit', u)}
                                className={`px-1.5 py-1 ${(ex.weightUnit || 'kg') === u ? 'bg-brand-600 text-white' : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400'}`}>{u}</button>
                            ))}
                          </div>
                        </div>
                        <input type="number" min={1} aria-label="Reps" className="input text-xs text-center w-14 shrink-0" value={ex.targetReps} onChange={(e) => updateDayEx(di, ei, 'targetReps', e.target.value)} />
                        <button onClick={() => setSimilarFor(similarFor === `${di}-${ei}` ? null : `${di}-${ei}`)} disabled={!ex.exercise}
                          title="Replace with a similar exercise" className="p-1 text-gray-400 hover:text-brand-600 shrink-0 disabled:opacity-30">
                          <Repeat size={12} />
                        </button>
                        <button onClick={() => removeExFromDay(di, ei)} className="p-1 text-red-400 hover:text-red-600 shrink-0"><Trash2 size={12} /></button>
                      </div>
                      {similarFor === `${di}-${ei}` && ex.exercise && (
                        <div className="mt-1.5 mb-2">
                          <SimilarExercises exerciseId={ex.exercise} compact excludeIds={othersInDay(day, ei)}
                            onPick={(picked) => { updateDayEx(di, ei, 'exercise', picked._id); setSimilarFor(null); }}
                            onClose={() => setSimilarFor(null)} />
                        </div>
                      )}
                      </div>
                    ))}
                    <button onClick={() => addExToDay(di)} className="text-xs text-brand-600 hover:underline mt-1">+ Add exercise</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={closeModal} className="btn-secondary flex-1 justify-center">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center">
                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Plan'}
              </button>
            </div>
          </div>
        </div>
      )}
      <PlanGenerator open={genOpen} onClose={() => setGenOpen(false)} onSaved={(plan) => setPlans((prev) => [plan, ...prev])} />
    </div>
  );
}
