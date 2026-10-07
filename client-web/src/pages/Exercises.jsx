import { useState, useEffect, useCallback } from 'react';
import { exerciseAPI } from '../api';
import Modal from '../components/Modal';
import { Search, Plus, ChevronDown, ChevronUp, X, Pencil, Trash2 } from 'lucide-react';
import ExerciseImage from '../components/ExerciseImage';
import { EXERCISE_TYPES, TYPE_LABEL, typeOf } from '../utils/exerciseTypes';
import { coveringMuscle, toggleMuscleTag } from '../utils/exerciseFilters';

const MUSCLES = ['pecs','clavicular pecs','sternal pecs','costal pecs','lats','trapezius','posterior delt','middle delt','anterior delt','elbow flexors','biceps','brachialis/brachioradialis','triceps','medial/lateral triceps','triceps long head','forearms','abs','erectors','glutes','adductors','hip flexors','quads','vastus quads','rectus femoris','hamstrings','biarticular hamstrings','hamstrings short head','calves','soleus'];
const EQUIPMENT = ['barbell','dumbbell','machine','cable','bodyweight','kettlebell','resistance_band','other'];
const CATEGORIES = [
  ['strength', 'Strength'],
  ['cardio', 'Cardio'],
];

const EMPTY_FORM = {
  secondaryMuscles: [],
  name: '',
  muscleGroups: [],
  equipment: 'bodyweight',
  category: 'strength',
  laterality: 'bilateral',
  type: 'dynamic',
  instructions: [''],
};

// Names that mean one arm/leg at a time (same as server/utils/laterality.js).
const UNILATERAL_NAME_PATTERN =
  /\b(single|one)[\s-]*(arm|leg|hand)\b|\bunilateral\b|\bcable lateral raise\b|\bdumbbell preacher curl\b/i;

function ExerciseCard({ ex, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3 cursor-pointer" onClick={() => setOpen(!open)}>
        {!open && <ExerciseImage images={ex.images} name={ex.name} className="w-16 h-12 shrink-0" />}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 dark:text-gray-100">{ex.name}</p>
          <div className="flex flex-wrap gap-1 mt-1">
            {ex.muscleGroups.map(m => (
              <span key={m} title={ex.secondaryMuscles?.includes(m) ? 'Secondary: counts up to half a set (less the more trained you are)' : undefined}
                className={`badge capitalize ${ex.secondaryMuscles?.includes(m)
                  ? 'bg-blue-50/50 text-blue-500 dark:bg-blue-900/20 dark:text-blue-400/70'
                  : 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'}`}>
                {m.replace('_', ' ')}
              </span>
            ))}
            <span className="badge bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 capitalize">{ex.equipment}</span>
            {ex.laterality === 'unilateral' && (
              <span className="badge bg-purple-50 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400">Unilateral</span>
            )}
            {typeOf(ex) !== 'dynamic' && (
              <span className="badge bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">{TYPE_LABEL[typeOf(ex)]}</span>
            )}
          </div>
        </div>
        {open
          ? <ChevronUp  size={18} className="text-gray-400 shrink-0 ml-2 mt-1" />
          : <ChevronDown size={18} className="text-gray-400 shrink-0 ml-2 mt-1" />
        }
      </div>
      {/* Start and end positions */}
      {open && ex.images?.length > 0 && (
        <ExerciseImage images={ex.images} name={ex.name} both className="mt-3 h-32 sm:h-36" />
      )}
      {open && ex.instructions?.length > 0 && (
        <ol className="mt-3 space-y-1 text-sm text-gray-600 dark:text-gray-400 list-decimal list-inside border-t border-gray-100 dark:border-gray-800 pt-3">
          {ex.instructions.map((step, i) => <li key={i}>{step}</li>)}
        </ol>
      )}
      {/* Only your own custom exercises can be changed. */}
      {ex.isCustom && (
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <span className="badge bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">Custom</span>
          <button onClick={() => onEdit(ex)} className="ml-auto flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-brand-600">
            <Pencil size={13} /> Edit
          </button>
          <button onClick={() => onDelete(ex)} className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-red-500">
            <Trash2 size={13} /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

/** Create a custom exercise, or edit one when `exercise` is passed. */
function ExerciseModal({ open, exercise, onClose, onSaved }) {
  const [form, setForm]     = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  // Until the user picks a type themselves, suggest one from the name.
  const [typeChosen, setTypeChosen] = useState(false);

  // `exercise` with isNew is just starting values for a new one (e.g. its category).
  const isEdit = !!exercise && !exercise.isNew;

  useEffect(() => {
    if (!open) return;
    setError('');
    setTypeChosen(isEdit);
    setForm(exercise?.isNew ? { ...EMPTY_FORM, category: exercise.category } : exercise
      ? {
          name: exercise.name,
          muscleGroups: exercise.muscleGroups || [],
          secondaryMuscles: exercise.secondaryMuscles || [],
          equipment: exercise.equipment || 'bodyweight',
          category: exercise.category || 'strength',
          laterality: exercise.laterality || 'bilateral',
          type: typeOf(exercise),
          instructions: exercise.instructions?.length ? exercise.instructions : [''],
        }
      : EMPTY_FORM);
  }, [open, exercise, isEdit]);

  const setName = (name) => setForm(f => ({
    ...f, name,
    ...(!typeChosen && { laterality: UNILATERAL_NAME_PATTERN.test(name) ? 'unilateral' : 'bilateral' }),
  }));

  // Clicking a muscle adds it (as primary); removing it also drops it from
  // secondary. A whole muscle replaces its regions, which then can't be picked.
  const toggleMuscle = (m) => setForm(f => toggleMuscleTag(f, m));
  const toggleSecondary = (m) =>
    setForm(f => ({
      ...f,
      secondaryMuscles: (f.secondaryMuscles || []).includes(m)
        ? f.secondaryMuscles.filter(x => x !== m)
        : [...(f.secondaryMuscles || []), m],
    }));

  const setStep    = (i, val) => setForm(f => { const s = [...f.instructions]; s[i] = val; return { ...f, instructions: s }; });
  const addStep    = () => setForm(f => ({ ...f, instructions: [...f.instructions, ''] }));
  const removeStep = (i) => setForm(f => ({ ...f, instructions: f.instructions.filter((_, idx) => idx !== i) }));

  const handleSubmit = async () => {
    setError('');
    if (!form.name.trim())              return setError('Exercise name is required.');
    if (form.category !== 'cardio' && form.muscleGroups.length === 0) return setError('Select at least one muscle group.');
    setSaving(true);
    try {
      const payload = { ...form, name: form.name.trim(), instructions: form.instructions.map(s => s.trim()).filter(Boolean) };
      const { data } = isEdit
        ? await exerciseAPI.update(exercise._id, payload)
        : await exerciseAPI.create(payload);
      onSaved(data, isEdit);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Exercise' : 'Add Custom Exercise'} maxWidth="max-w-xl">
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
          <input className="input" placeholder="e.g. Reverse Nordic Curl" value={form.name}
            onChange={e => setName(e.target.value)} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
          <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg w-fit">
            {CATEGORIES.map(([v, label]) => (
              <button key={v} type="button" onClick={() => setForm(f => ({ ...f, category: v }))}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${form.category === v
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Muscle Groups {form.category === 'cardio' ? <span className="font-normal text-gray-400">· optional</span> : '*'}
          </label>
          <div className="flex flex-wrap gap-2">
            {MUSCLES.map(m => {
              const coveredBy = coveringMuscle(m, form.muscleGroups);
              return (
                <button key={m} type="button" onClick={() => toggleMuscle(m)} disabled={!!coveredBy}
                  title={coveredBy ? `Already included in ${coveredBy}` : undefined}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors disabled:opacity-35 disabled:cursor-not-allowed ${
                    form.muscleGroups.includes(m)
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-brand-400'
                  }`}>
                  {m.replace('_', ' ')}
                </button>
              );
            })}
          </div>
          {form.muscleGroups.length > 0 && (
            <div className="mt-3 rounded-xl bg-gray-50 dark:bg-gray-800 p-3 space-y-1.5">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-300">How much each set counts</p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-1">
                Primary muscles count a full set; secondary ones (helpers, like the triceps in a bench press) count half for beginners, a quarter for intermediates and nothing for advanced lifters (from your FFMI).
                The first muscle is the exercise's main one.
              </p>
              {form.muscleGroups.map((m, i) => {
                const secondary = (form.secondaryMuscles || []).includes(m);
                return (
                  <div key={m} className="flex items-center justify-between gap-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{m}{i === 0 && <span className="text-[10px] text-gray-400 ml-1.5 normal-case">main</span>}</span>
                    <div className="flex gap-1 p-0.5 bg-white dark:bg-gray-900 rounded-md">
                      {[[false, 'Primary'], [true, 'Secondary']].map(([sec, label]) => (
                        <button key={label} type="button" onClick={() => secondary !== sec && toggleSecondary(m)}
                          className={`px-2 py-0.5 text-[11px] font-medium rounded ${secondary === sec
                            ? 'bg-brand-600 text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Equipment</label>
          <select className="input sm:w-1/2" value={form.equipment} onChange={e => setForm(f => ({ ...f, equipment: e.target.value }))}>
            {EQUIPMENT.map(e => <option key={e} value={e} className="capitalize">{e.replace('_', ' ')}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sides</label>
          <div className="grid grid-cols-2 gap-2">
            {[['bilateral', 'Bilateral', 'Both sides together'], ['unilateral', 'Unilateral', 'One arm or leg at a time']].map(([v, label, hint]) => (
              <button key={v} type="button" onClick={() => { setTypeChosen(true); setForm(f => ({ ...f, laterality: v })); }}
                className={`px-3 py-2 rounded-lg border text-left transition-colors ${form.laterality === v
                  ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/30'
                  : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-brand-400'}`}>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</p>
                <p className="text-[11px] text-gray-400 dark:text-gray-500">{hint}</p>
              </button>
            ))}
          </div>
          {form.laterality === 'unilateral' && (
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
              Sets are logged separately for the left and right side.
              {isEdit && exercise.laterality === 'bilateral' && ' Sets you already logged will be split into matching left and right sets.'}
            </p>
          )}
          {isEdit && exercise.laterality === 'unilateral' && form.laterality === 'bilateral' && (
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">Sets you already logged per side stay as left and right.</p>
          )}
        </div>

        {form.category !== 'cardio' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Exercise type</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {EXERCISE_TYPES.map(([v, label, hint]) => (
                <button key={v} type="button" onClick={() => setForm(f => ({ ...f, type: v }))}
                  className={`px-3 py-2 rounded-lg border text-left transition-colors ${form.type === v
                    ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/30'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-brand-400'}`}>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</p>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500">{hint}</p>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
              {form.type === 'yielding' ? 'Sets are logged as seconds held, weight and seconds in reserve. Live sessions use a stopwatch.'
                : form.type === 'overcoming' ? 'Sets are logged as bursts, seconds per burst and rest between bursts. Live sessions guide each burst with a timer.'
                  : 'Sets are logged as reps, weight and reps in reserve.'}
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Instructions <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <div className="space-y-2">
            {form.instructions.map((step, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-5 text-right shrink-0">{i + 1}.</span>
                <input className="input" placeholder={`Step ${i + 1}`} value={step}
                  onChange={e => setStep(i, e.target.value)} />
                {form.instructions.length > 1 && (
                  <button type="button" onClick={() => removeStep(i)}
                    className="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors shrink-0">
                    <X size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button type="button" onClick={addStep} className="mt-2 text-sm text-brand-600 hover:text-brand-700 font-medium">
            + Add step
          </button>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-3 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Exercise'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function Exercises() {
  const [exercises, setExercises] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [muscle,    setMuscle]    = useState('');
  const [equipment, setEquipment] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing,   setEditing]   = useState(null); // exercise being edited, or null for "add"
  const [tab,       setTab]       = useState('strength'); // strength | cardio

  const fetchExercises = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await exerciseAPI.getAll({ search, muscle, equipment });
      setExercises(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, muscle, equipment]);

  useEffect(() => {
    const t = setTimeout(fetchExercises, 300);
    return () => clearTimeout(t);
  }, [fetchExercises]);

  const handleSaved = (saved, wasEdit) => setExercises(prev => (wasEdit
    ? prev.map(e => (e._id === saved._id ? saved : e))
    : [saved, ...prev]));

  // A new exercise starts in the section you're looking at.
  const openAdd  = () => { setEditing({ ...EMPTY_FORM, category: tab, isNew: true }); setShowModal(true); };
  const byCategory = (cat) => exercises.filter(e => (e.category || 'strength') === cat);
  const shown = byCategory(tab);
  const openEdit = (ex) => { setEditing(ex); setShowModal(true); };

  const handleDelete = async (ex) => {
    if (!window.confirm(`Delete "${ex.name}"? Workouts that used it will show it as a deleted exercise, and plans that include it will show it as Unknown.`)) return;
    try {
      await exerciseAPI.delete(ex._id);
      setExercises(prev => prev.filter(e => e._id !== ex._id));
    } catch (err) {
      window.alert(err.response?.data?.message || 'Could not delete this exercise.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Exercise Library</h1>
        <button className="btn-primary" onClick={openAdd}>
          <Plus size={16} /> Add Custom
        </button>
      </div>

      {/* Strength and cardio are separate sections */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
        {CATEGORIES.map(([v, label]) => (
          <button key={v} onClick={() => { setTab(v); if (v === 'cardio') setMuscle(''); }}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${tab === v
              ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
            {label} <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">{byCategory(v).length}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Search exercises…" value={search}
            onChange={e => setSearch(e.target.value)} />
        </div>
        {tab === 'strength' && (
          <select className="input sm:w-44" value={muscle} onChange={e => setMuscle(e.target.value)}>
            <option value="">All muscles</option>
            {MUSCLES.map(m => <option key={m} value={m} className="capitalize">{m.replace('_', ' ')}</option>)}
          </select>
        )}
        <select className="input sm:w-44" value={equipment} onChange={e => setEquipment(e.target.value)}>
          <option value="">All equipment</option>
          {EQUIPMENT.map(e => <option key={e} value={e} className="capitalize">{e}</option>)}
        </select>
      </div>

      {loading
        ? <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
        : shown.length === 0
          ? <p className="text-center text-gray-400 dark:text-gray-500 py-16">No {tab} exercises found.</p>
          : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {shown.map(ex => <ExerciseCard key={ex._id} ex={ex} onEdit={openEdit} onDelete={handleDelete} />)}
            </div>
      }

      <ExerciseModal open={showModal} exercise={editing} onClose={() => setShowModal(false)} onSaved={handleSaved} />
    </div>
  );
}
