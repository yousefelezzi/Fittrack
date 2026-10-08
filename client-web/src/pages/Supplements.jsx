import { useCallback, useEffect, useState } from 'react';
import { format, subDays, parseISO } from 'date-fns';
import { Pill, Plus, Trash2, Pencil, X, Search, Sun, Copy, Layers } from 'lucide-react';
import { supplementAPI, nutritionAPI } from '../api';
import DayNav from '../components/DayNav';
import { microsText, SUPPLEMENT_MICROS } from '../utils/foodLogic';

const key = (d) => format(d, 'yyyy-MM-dd');
const EMPTY = { name: '', dose: '', timing: '' };

const SUN_NOTE = 'Roughly 1,000 IU of vitamin D per 15 minutes of midday summer sun with arms and legs bare, for lighter skin. Much less in winter, early or late in the day, with darker skin or sunscreen.';

/**
 * Pick a supplement: `mine` (ones you've used before) first, then the built-in
 * list, searchable and grouped by category. Or add your own.
 */
function CatalogPicker({ mine = [], mineLabel = 'Your supplements', onPickMine, onPick, onCustom, onCancel }) {
  const [catalog, setCatalog] = useState(null);
  const [q, setQ] = useState('');
  useEffect(() => { supplementAPI.catalog().then(({ data }) => setCatalog(data)).catch(() => setCatalog([])); }, []);
  const term = q.trim().toLowerCase();
  const shown = (catalog || []).filter((c) => !term || c.name.toLowerCase().includes(term) || c.category.includes(term));
  const groups = [...new Set(shown.map((c) => c.category))];
  const myShown = mine.filter((m) => !term || m.name.toLowerCase().includes(term));
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
        {myShown.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mt-1">{mineLabel}</p>
            {myShown.map((m) => (
              <button key={m._id} type="button" onClick={() => onPickMine(m)} className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                <p className="text-sm text-gray-900 dark:text-gray-100">{m.name} <span className="text-xs text-gray-400">· {detailText(m)}{m.inStack ? ' · in your stack' : ''}</span></p>
              </button>
            ))}
          </div>
        )}
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
      <p className="text-[11px] text-gray-400 dark:text-gray-500">Amounts are typical label doses; set the servings you take. Their vitamins and minerals count toward the Food Log's micronutrients on the days you take them.</p>
    </div>
  );
}

/**
 * Name / dose / servings / timing, for adding or editing a supplement. Your own
 * ones (`withMicros`) can list their vitamins and minerals per serving.
 */
function SupplementForm({ initial = EMPTY, onSave, onCancel, saveLabel, withMicros }) {
  const [form, setForm] = useState({ servings: 1, ...initial });
  const [micros, setMicros] = useState(() => Object.fromEntries(Object.entries(initial.micros || {}).map(([k, v]) => [k, String(v)])));
  const [showMicros, setShowMicros] = useState(Object.keys(initial.micros || {}).length > 0);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      await onSave({
        name: form.name.trim(), dose: form.dose.trim(), timing: form.timing.trim(), servings: Number(form.servings) || 1,
        ...(withMicros && { micros: Object.fromEntries(Object.entries(micros).filter(([, v]) => Number(v) > 0).map(([k, v]) => [k, Number(v)])) }),
      });
    } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="grid grid-cols-1 gap-2 items-center sm:grid-cols-[1fr_7rem_5rem_7rem_auto]">
        <input className="input text-sm" maxLength={60} placeholder="Name, e.g. Creatine" value={form.name} onChange={set('name')} autoFocus />
        <input className="input text-sm" maxLength={40} placeholder="Serving, e.g. 1 capsule" value={form.dose} onChange={set('dose')} />
        <input className="input text-sm" type="number" min={0.25} max={20} step={0.25} title="Servings you take" placeholder="×" value={form.servings} onChange={set('servings')} />
        <input className="input text-sm" maxLength={40} placeholder="When, e.g. Morning" value={form.timing} onChange={set('timing')} />
        <div className="flex gap-1">
          <button type="submit" disabled={busy || !form.name.trim()} className="btn-primary py-2 px-3 text-sm">{saveLabel}</button>
          {onCancel && <button type="button" onClick={onCancel} className="btn-secondary py-2 px-3 text-sm"><X size={14} /></button>}
        </div>
      </div>
      {withMicros && (
        <div>
          <button type="button" onClick={() => setShowMicros(!showMicros)} className="text-xs font-medium text-brand-600 hover:underline">
            {showMicros ? 'Hide' : 'Add'} vitamins & minerals per serving (from the label)
          </button>
          {showMicros && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
              {SUPPLEMENT_MICROS.map((c) => (
                <label key={c.key} className="text-[11px] text-gray-500 dark:text-gray-400">
                  {c.label} ({c.unit})
                  <input className="input text-sm py-1 mt-0.5" type="number" min={0} step="any" value={micros[c.key] ?? ''}
                    onChange={(e) => setMicros((m) => ({ ...m, [c.key]: e.target.value }))} />
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </form>
  );
}

const detailText = (s, servings = s.servings) => [servings && servings !== 1 ? `${servings} ×` : '', s.dose, s.timing].filter(Boolean).join(' · ') || '1 serving';
const microsOf = (s) => (s.catalog ? s.catalog.micros : s.micros);

/** One supplement's name, serving and micros (for `servings`). */
function SupplementInfo({ s, servings }) {
  const micros = microsText(microsOf(s), servings || 1);
  return (
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
        {s.catalog?.category === 'sun' ? <Sun size={14} className="text-amber-500" /> : <Pill size={14} className="text-gray-400" />}{s.name}
      </p>
      <p className="text-xs text-gray-400 dark:text-gray-500">{[s.dose, s.timing].filter(Boolean).join(' · ')}</p>
      {micros && (
        <p className="text-[11px] text-sky-600 dark:text-sky-400" title={s.catalog?.category === 'sun' ? SUN_NOTE : undefined}>
          {micros}{s.catalog?.category === 'sun' ? ' (estimate)' : ''}
        </p>
      )}
    </div>
  );
}

/** − servings + for one day's entry. */
function ServingsStepper({ value, onChange }) {
  const step = (d) => onChange(Math.min(20, Math.max(0.25, Math.round((value + d) * 4) / 4)));
  return (
    <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
      <button onClick={() => step(value > 1 ? -1 : -0.25)} disabled={value <= 0.25} className="w-6 h-6 rounded-md bg-gray-100 dark:bg-gray-800 disabled:opacity-30" aria-label="Fewer servings">−</button>
      <span className="w-10 text-center tabular-nums">{value} ×</span>
      <button onClick={() => step(value >= 1 ? 1 : 0.25)} disabled={value >= 20} className="w-6 h-6 rounded-md bg-gray-100 dark:bg-gray-800 disabled:opacity-30" aria-label="More servings">+</button>
    </div>
  );
}

/** Your stack: the supplements you usually take, loaded onto a day in one go. */
function StackPanel({ list, run, reload, onClose }) {
  const [adding, setAdding] = useState(false); // false | 'catalog' | 'custom'
  const [editing, setEditing] = useState(null);
  const stack = list.filter((s) => s.inStack);
  const others = list.filter((s) => !s.inStack);
  const create = (body) => run(async () => { await supplementAPI.create({ ...body, inStack: true }); setAdding(false); reload(); }, 'Could not add that supplement');
  const setInStack = (s, inStack) => run(async () => { await supplementAPI.update(s._id, { inStack }); setAdding(false); reload(); }, 'Could not update your stack');
  const update = (id, body) => run(async () => { await supplementAPI.update(id, body); setEditing(null); reload(); }, 'Could not save that');
  return (
    <div className="card space-y-3 ring-1 ring-brand-200 dark:ring-brand-900">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2"><Layers size={16} className="text-brand-600" /> My stack</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500">What you usually take. "Load my stack" adds these to a day; changing the stack doesn't change days already logged.</p>
        </div>
        <button onClick={onClose} className="btn-secondary py-1.5 px-2.5 text-sm" aria-label="Close my stack"><X size={14} /></button>
      </div>
      {!adding && <button onClick={() => setAdding('catalog')} className="btn-secondary text-sm py-1.5"><Plus size={14} /> Add to stack</button>}
      {adding === 'catalog' && (
        <CatalogPicker mine={others} mineLabel="Used before" onPickMine={(s) => setInStack(s, true)}
          onPick={(c) => create({ catalogId: c._id, ...(c.category === 'sun' && { timing: 'Midday' }) })}
          onCustom={() => setAdding('custom')} onCancel={() => setAdding(false)} />
      )}
      {adding === 'custom' && <SupplementForm saveLabel="Add" withMicros onSave={create} onCancel={() => setAdding(false)} />}
      {stack.length === 0 ? <p className="text-sm text-gray-400 py-1">Your stack is empty.</p> : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {stack.map((s) => (
            <li key={s._id} className="py-2.5">
              {editing === s._id ? (
                <SupplementForm initial={{ name: s.name, dose: s.dose, timing: s.timing, servings: s.servings ?? 1, micros: s.micros }} withMicros={!s.catalog}
                  saveLabel="Save" onSave={(body) => update(s._id, body)} onCancel={() => setEditing(null)} />
              ) : (
                <div className="flex items-center gap-3">
                  <SupplementInfo s={s} servings={s.servings} />
                  <span className="text-xs text-gray-400 shrink-0">{s.servings && s.servings !== 1 ? `${s.servings} ×` : ''}</span>
                  <button onClick={() => setEditing(s._id)} className="p-1 text-gray-300 hover:text-brand-600" aria-label={`Edit ${s.name}`}><Pencil size={14} /></button>
                  <button onClick={() => setInStack(s, false)} className="p-1 text-gray-300 hover:text-red-500" aria-label={`Remove ${s.name} from your stack`} title="Remove from stack"><Trash2 size={14} /></button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Supplements: each day's own list (like the Food Log), and your stack to load onto a day. */
export default function Supplements() {
  const [date, setDate] = useState(key(new Date()));
  const [list, setList] = useState(null);   // every supplement you've used
  const [day, setDay] = useState(null);     // [{ supplement, servings }] for the day
  const [adding, setAdding] = useState(false); // false | 'catalog' | 'custom'
  const [stackOpen, setStackOpen] = useState(false);
  const [error, setError] = useState('');

  const loadList = useCallback(() => supplementAPI.getAll().then(({ data }) => setList(data)).catch(() => setList([])), []);
  const fromLog = (log) => setDay(log?.supplementsTaken || []);
  const loadDay = useCallback(() => { setDay(null); nutritionAPI.getByDate(date).then(({ data }) => fromLog(data)).catch(() => setDay([])); }, [date]);
  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => { loadDay(); setAdding(false); }, [loadDay]);

  const run = async (fn, fallback) => {
    setError('');
    try { await fn(); } catch (err) { setError(err.response?.data?.errors?.[0]?.message || err.response?.data?.message || fallback); }
  };
  const byId = new Map((list || []).map((s) => [String(s._id), s]));
  const onDay = new Set((day || []).map((t) => String(t.supplement)));
  const stack = (list || []).filter((s) => s.inStack);
  const stackMissing = stack.filter((s) => !onDay.has(String(s._id))).length;

  // Only this day changes.
  const addToDay = (s) => run(async () => { fromLog((await nutritionAPI.toggleSupplement(date, s._id)).data); setAdding(false); }, 'Could not add that');
  const removeFromDay = (id) => run(async () => fromLog((await nutritionAPI.toggleSupplement(date, id)).data), 'Could not remove that');
  const setServings = (id, servings) => run(async () => fromLog((await nutritionAPI.setSupplementServings(date, id, servings)).data), 'Could not change the servings');
  // Something new for this day only (not added to the stack).
  const createForDay = (body) => run(async () => {
    const { data } = await supplementAPI.create({ ...body, inStack: false });
    await loadList();
    if (!onDay.has(String(data._id))) fromLog((await nutritionAPI.toggleSupplement(date, data._id)).data);
    setAdding(false);
  }, 'Could not add that supplement');
  const loadStack = () => run(async () => fromLog((await nutritionAPI.takeSupplements(date, { stack: true })).data), 'Could not load your stack');
  const sameAsDayBefore = () => run(async () => {
    fromLog((await nutritionAPI.takeSupplements(date, { copyFrom: format(subDays(parseISO(date), 1), 'yyyy-MM-dd') })).data);
  }, 'Could not copy the day before');

  const available = (list || []).filter((s) => !onDay.has(String(s._id))).sort((a, b) => Number(b.inStack) - Number(a.inStack));

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Supplements</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setStackOpen(!stackOpen)} aria-expanded={stackOpen}
            className={`btn-secondary text-sm py-1.5 ${stackOpen ? '!border-brand-500 !text-brand-600' : ''}`}>
            <Layers size={15} /> My stack{list ? ` (${stack.length})` : ''}
          </button>
          <DayNav date={date} onChange={setDate} />
        </div>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}

      {stackOpen && list && <StackPanel list={list} run={run} reload={loadList} onClose={() => setStackOpen(false)} />}

      <div className="card space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {day?.length ? <><span className="font-semibold text-gray-900 dark:text-gray-100">{day.length}</span> taken</> : 'Nothing logged for this day.'}
          </p>
          <div className="flex flex-wrap gap-2">
            {stack.length > 0 && stackMissing > 0 && (
              <button onClick={loadStack} className="btn-primary text-xs py-1.5"><Layers size={14} /> Load my stack</button>
            )}
            <button onClick={sameAsDayBefore} className="btn-secondary text-xs py-1.5"><Copy size={14} /> Same as the day before</button>
            {!adding && <button onClick={() => setAdding('catalog')} className="btn-secondary text-xs py-1.5"><Plus size={14} /> Add</button>}
          </div>
        </div>
        {list && stack.length === 0 && !day?.length && (
          <p className="text-xs text-gray-400 dark:text-gray-500">Tip: put what you take every day in <button onClick={() => setStackOpen(true)} className="text-brand-600 hover:underline">My stack</button>, then load it onto each day in one tap.</p>
        )}
        {adding === 'catalog' && (
          <CatalogPicker mine={available} onPickMine={addToDay}
            onPick={(c) => createForDay({ catalogId: c._id, ...(c.category === 'sun' && { timing: 'Midday' }) })}
            onCustom={() => setAdding('custom')} onCancel={() => setAdding(false)} />
        )}
        {adding === 'custom' && <SupplementForm saveLabel="Add" withMicros onSave={createForDay} onCancel={() => setAdding(false)} />}

        {day === null || list === null ? <p className="text-sm text-gray-400 py-2">Loading…</p> : day.length > 0 && (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {day.map((t) => {
              const s = byId.get(String(t.supplement));
              const servings = t.servings || s?.servings || 1;
              return (
                <li key={String(t.supplement)} className="py-2.5 flex items-center gap-3">
                  {s ? <SupplementInfo s={s} servings={servings} /> : <p className="flex-1 text-sm text-gray-400">A removed supplement</p>}
                  {s && <ServingsStepper value={servings} onChange={(v) => setServings(s._id, v)} />}
                  <button onClick={() => removeFromDay(t.supplement)} className="p-1 text-gray-300 hover:text-red-500" aria-label={`Remove ${s?.name || 'it'} from this day`} title="Remove from this day">
                    <X size={15} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <p className="text-xs text-center text-gray-400 dark:text-gray-500">Supplements add their vitamins and minerals to that day's micronutrients in the Food Log. Changing servings here only changes this day.</p>
    </div>
  );
}
