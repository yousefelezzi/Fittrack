import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Pill, Plus, Trash2, Pencil, Check, X, Search, Sun } from 'lucide-react';
import { supplementAPI, nutritionAPI } from '../api';
import DayNav from '../components/DayNav';
import { microsText } from '../utils/foodLogic';

const key = (d) => format(d, 'yyyy-MM-dd');
const EMPTY = { name: '', dose: '', timing: '' };

const SUN_NOTE = 'Roughly 1,000 IU of vitamin D per 15 minutes of midday summer sun with arms and legs bare, for lighter skin. Much less in winter, early or late in the day, with darker skin or sunscreen.';

/** The built-in list: search, grouped by category; pick one to add it. Or add your own. */
function CatalogPicker({ onPick, onCustom, onCancel }) {
  const [catalog, setCatalog] = useState(null);
  const [q, setQ] = useState('');
  useEffect(() => { supplementAPI.catalog().then(({ data }) => setCatalog(data)).catch(() => setCatalog([])); }, []);
  const term = q.trim().toLowerCase();
  const shown = (catalog || []).filter((c) => !term || c.name.toLowerCase().includes(term) || c.category.includes(term));
  const groups = [...new Set(shown.map((c) => c.category))];
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9 text-sm" placeholder="Search supplements…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        </div>
        <button onClick={onCancel} className="btn-secondary py-2 px-3 text-sm"><X size={14} /></button>
      </div>
      <div className="max-h-80 overflow-y-auto space-y-2">
        {catalog === null && <p className="text-sm text-gray-400 py-2">Loading…</p>}
        {groups.map((g) => (
          <div key={g}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mt-1">{g}</p>
            {shown.filter((c) => c.category === g).map((c) => (
              <button key={c._id} type="button" onClick={() => onPick(c)} className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                <p className="text-sm text-gray-900 dark:text-gray-100 flex items-center gap-1.5">{c.category === 'sun' && <Sun size={14} className="text-amber-500" />}{c.name} <span className="text-xs text-gray-400">· {c.serving}</span></p>
                {microsText(c.micros) && <p className="text-[11px] text-gray-400 dark:text-gray-500">{microsText(c.micros)}</p>}
              </button>
            ))}
          </div>
        ))}
      </div>
      <button type="button" onClick={onCustom} className="text-sm font-medium text-brand-600 hover:underline">+ Add your own instead</button>
      <p className="text-[11px] text-gray-400 dark:text-gray-500">Amounts are typical label doses; set the servings you take. Their vitamins and minerals count toward the Food Log's micronutrients on days you tick them off.</p>
    </div>
  );
}

/** Name / dose / timing (and servings for built-in ones), for adding or editing a supplement. */
function SupplementForm({ initial = EMPTY, onSave, onCancel, saveLabel, withServings }) {
  const [form, setForm] = useState({ servings: 1, ...initial });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      await onSave({ name: form.name.trim(), dose: form.dose.trim(), timing: form.timing.trim(), ...(withServings && { servings: Number(form.servings) || 1 }) });
    } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className={`grid grid-cols-1 gap-2 items-center ${withServings ? 'sm:grid-cols-[1fr_7rem_5rem_7rem_auto]' : 'sm:grid-cols-[1fr_7rem_8rem_auto]'}`}>
      <input className="input text-sm" maxLength={60} placeholder="Name, e.g. Creatine" value={form.name} onChange={set('name')} autoFocus />
      <input className="input text-sm" maxLength={40} placeholder="Dose, e.g. 5 g" value={form.dose} onChange={set('dose')} />
      {withServings && (
        <input className="input text-sm" type="number" min={0.25} max={20} step={0.25} title="Servings you take" placeholder="×" value={form.servings} onChange={set('servings')} />
      )}
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
  const [adding, setAdding] = useState(false); // false | 'catalog' | 'custom'
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
  const addFromCatalog = (c) => create({ catalogId: c._id, ...(c.category === 'sun' && { timing: 'Midday' }) });
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
          {!adding && <button onClick={() => setAdding('catalog')} className="btn-secondary text-sm py-1.5"><Plus size={14} /> Add</button>}
        </div>
        {adding === 'catalog' && <CatalogPicker onPick={addFromCatalog} onCustom={() => setAdding('custom')} onCancel={() => setAdding(false)} />}
        {adding === 'custom' && <SupplementForm saveLabel="Add" onSave={create} onCancel={() => setAdding(false)} />}

        {list === null ? <p className="text-sm text-gray-400 py-2">Loading…</p> : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {list.map((s) => {
              const isTaken = taken.has(String(s._id));
              return (
                <li key={s._id} className="py-2.5">
                  {editing === s._id ? (
                    <SupplementForm initial={{ name: s.name, dose: s.dose, timing: s.timing, servings: s.servings ?? 1 }} withServings={!!s.catalog}
                      saveLabel="Save" onSave={(body) => update(s._id, body)} onCancel={() => setEditing(null)} />
                  ) : (
                    <div className="flex items-center gap-3">
                      <button onClick={() => toggle(s._id)} aria-pressed={isTaken} aria-label={`${isTaken ? 'Untick' : 'Tick off'} ${s.name}`}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${isTaken ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 dark:border-gray-600 hover:border-emerald-400'}`}>
                        {isTaken && <Check size={14} />}
                      </button>
                      <Pill size={16} className="text-gray-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${isTaken ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-gray-100'}`}>{s.name}</p>
                        {(s.dose || s.timing || s.servings !== 1) && (
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            {[s.servings && s.servings !== 1 ? `${s.servings} ×` : '', s.dose, s.timing].filter(Boolean).join(' · ')}
                          </p>
                        )}
                        {s.catalog && microsText(s.catalog.micros, s.servings || 1) && (
                          <p className="text-[11px] text-sky-600 dark:text-sky-400" title={s.catalog.category === 'sun' ? SUN_NOTE : undefined}>
                            {microsText(s.catalog.micros, s.servings || 1)}{s.catalog.category === 'sun' ? ' (estimate)' : ''}
                          </p>
                        )}
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
