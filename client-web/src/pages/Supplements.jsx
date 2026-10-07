import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Pill, Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import { supplementAPI, nutritionAPI } from '../api';
import DayNav from '../components/DayNav';

const key = (d) => format(d, 'yyyy-MM-dd');
const EMPTY = { name: '', dose: '', timing: '' };

/** Name / dose / timing fields, for adding or editing a supplement. */
function SupplementForm({ initial = EMPTY, onSave, onCancel, saveLabel }) {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true);
    try { await onSave({ name: form.name.trim(), dose: form.dose.trim(), timing: form.timing.trim() }); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-[1fr_7rem_8rem_auto] gap-2 items-center">
      <input className="input text-sm" maxLength={60} placeholder="Name, e.g. Creatine" value={form.name} onChange={set('name')} autoFocus />
      <input className="input text-sm" maxLength={40} placeholder="Dose, e.g. 5 g" value={form.dose} onChange={set('dose')} />
      <input className="input text-sm" maxLength={40} placeholder="When, e.g. Morning" value={form.timing} onChange={set('timing')} />
      <div className="flex gap-1">
        <button type="submit" disabled={busy || !form.name.trim()} className="btn-primary py-2 px-3 text-sm">{saveLabel}</button>
        {onCancel && <button type="button" onClick={onCancel} className="btn-secondary py-2 px-3 text-sm"><X size={14} /></button>}
      </div>
    </form>
  );
}

/** Supplements: your list, ticked off day by day. */
export default function Supplements() {
  const [date, setDate] = useState(key(new Date()));
  const [list, setList] = useState(null);
  const [taken, setTaken] = useState(new Set());
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');

  const loadList = useCallback(() => supplementAPI.getAll().then(({ data }) => setList(data)).catch(() => setList([])), []);
  const loadDay = useCallback(() => nutritionAPI.getByDate(date)
    .then(({ data }) => setTaken(new Set((data?.supplementsTaken || []).map((t) => String(t.supplement)))))
    .catch(() => setTaken(new Set())), [date]);
  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => { loadDay(); }, [loadDay]);

  const run = async (fn, fallback) => {
    setError('');
    try { await fn(); } catch (err) { setError(err.response?.data?.errors?.[0]?.message || err.response?.data?.message || fallback); }
  };
  const toggle = (id) => run(async () => {
    const { data } = await nutritionAPI.toggleSupplement(date, id);
    setTaken(new Set((data.supplementsTaken || []).map((t) => String(t.supplement))));
  }, 'Could not update that');
  const create = (body) => run(async () => { await supplementAPI.create(body); setAdding(false); loadList(); }, 'Could not add that supplement');
  const update = (id, body) => run(async () => { await supplementAPI.update(id, body); setEditing(null); loadList(); }, 'Could not save that');
  const remove = (s) => {
    if (!window.confirm(`Remove ${s.name}? Days you already ticked stay ticked.`)) return;
    run(async () => { await supplementAPI.delete(s._id); loadList(); }, 'Could not remove that');
  };

  const takenCount = (list || []).filter((s) => taken.has(String(s._id))).length;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Supplements</h1>
        <DayNav date={date} onChange={setDate} />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {list?.length ? <><span className="font-semibold text-gray-900 dark:text-gray-100">{takenCount} of {list.length}</span> taken</> : 'Add the supplements you take to tick them off each day.'}
          </p>
          {!adding && <button onClick={() => setAdding(true)} className="btn-secondary text-sm py-1.5"><Plus size={14} /> Add</button>}
        </div>
        {adding && <SupplementForm saveLabel="Add" onSave={create} onCancel={() => setAdding(false)} />}

        {list === null ? <p className="text-sm text-gray-400 py-2">Loading…</p> : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {list.map((s) => {
              const isTaken = taken.has(String(s._id));
              return (
                <li key={s._id} className="py-2.5">
                  {editing === s._id ? (
                    <SupplementForm initial={{ name: s.name, dose: s.dose, timing: s.timing }} saveLabel="Save" onSave={(body) => update(s._id, body)} onCancel={() => setEditing(null)} />
                  ) : (
                    <div className="flex items-center gap-3">
                      <button onClick={() => toggle(s._id)} aria-pressed={isTaken} aria-label={`${isTaken ? 'Untick' : 'Tick off'} ${s.name}`}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${isTaken ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 dark:border-gray-600 hover:border-emerald-400'}`}>
                        {isTaken && <Check size={14} />}
                      </button>
                      <Pill size={16} className="text-gray-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${isTaken ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-gray-100'}`}>{s.name}</p>
                        {(s.dose || s.timing) && <p className="text-xs text-gray-400 dark:text-gray-500">{[s.dose, s.timing].filter(Boolean).join(' · ')}</p>}
                      </div>
                      <button onClick={() => setEditing(s._id)} className="p-1 text-gray-300 hover:text-brand-600" aria-label={`Edit ${s.name}`}><Pencil size={14} /></button>
                      <button onClick={() => remove(s)} className="p-1 text-gray-300 hover:text-red-500" aria-label={`Remove ${s.name}`}><Trash2 size={14} /></button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
