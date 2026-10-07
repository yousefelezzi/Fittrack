import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { ImagePlus, X, Dumbbell, ClipboardList } from 'lucide-react';
import Avatar from '../Avatar';
import WorkoutSummary from './WorkoutSummary';
import PlanSummary from './PlanSummary';
import { postAPI, workoutAPI, planAPI } from '../../api';

/** New post: text, an optional workout from your history and/or one of your plans, and an optional photo. */
export default function Composer({ me, initialWorkoutId, onPosted, onCancel }) {
  const [caption, setCaption] = useState('');
  const [workouts, setWorkouts] = useState([]);
  const [workoutId, setWorkoutId] = useState(initialWorkoutId || '');
  const [plans, setPlans] = useState([]);
  const [planId, setPlanId] = useState('');
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef();

  useEffect(() => {
    workoutAPI.getAll({ limit: 15 }).then(({ data }) => setWorkouts(data.workouts || [])).catch(() => setWorkouts([]));
    planAPI.getAll().then(({ data }) => setPlans(data)).catch(() => setPlans([]));
  }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const pickPhoto = (file) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError('Photo must be JPG, PNG or WebP'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Photo must be under 5 MB'); return; }
    setError('');
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  };

  const selected = workouts.find((w) => w._id === workoutId);
  const selectedPlan = plans.find((p) => p._id === planId);
  const canPost = caption.trim() || workoutId || planId || photo;

  const submit = async () => {
    if (!canPost) return;
    setPosting(true);
    setError('');
    try {
      const form = new FormData();
      form.append('caption', caption.trim());
      if (workoutId) form.append('workoutSession', workoutId);
      if (planId) form.append('workoutPlan', planId);
      if (photo) form.append('image', photo);
      const { data } = await postAPI.create(form);
      onPosted(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not post');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-2">
        <Avatar user={me} />
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{me?.name}</p>
      </div>
      <textarea className="input resize-none" rows={3} maxLength={500} autoFocus
        placeholder={workoutId ? 'How did it go?' : 'Share a workout, progress or motivation…'}
        value={caption} onChange={(e) => setCaption(e.target.value)} />

      <div>
        <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
          <Dumbbell size={13} /> Attach a workout
        </label>
        <select className="input text-sm" value={workoutId} onChange={(e) => setWorkoutId(e.target.value)}>
          <option value="">None</option>
          {workouts.map((w) => (
            <option key={w._id} value={w._id}>{w.name} — {format(new Date(w.date), 'MMM d')}</option>
          ))}
        </select>
        {selected && <div className="mt-2"><WorkoutSummary workout={selected} /></div>}
      </div>

      {plans.length > 0 && (
        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            <ClipboardList size={13} /> Attach a plan (all its days)
          </label>
          <select className="input text-sm" value={planId} onChange={(e) => setPlanId(e.target.value)}>
            <option value="">None</option>
            {plans.map((p) => <option key={p._id} value={p._id}>{p.name} — {p.days.length} workout{p.days.length !== 1 ? 's' : ''}</option>)}
          </select>
          {selectedPlan && <div className="mt-2"><PlanSummary plan={selectedPlan} /></div>}
        </div>
      )}

      {preview ? (
        <div className="relative">
          <img src={preview} alt="" className="w-full max-h-64 object-cover rounded-xl" />
          <button onClick={() => { setPhoto(null); setPreview(''); }} title="Remove photo"
            className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white"><X size={14} /></button>
        </div>
      ) : (
        <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-brand-600">
          <ImagePlus size={16} /> Add a photo
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => pickPhoto(e.target.files?.[0])} />

      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="btn-secondary py-1.5 text-sm">Cancel</button>
        <button onClick={submit} disabled={posting || !canPost} className="btn-primary py-1.5 text-sm">{posting ? 'Posting…' : 'Share'}</button>
      </div>
    </div>
  );
}
