import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { format, subDays, parseISO } from 'date-fns';
import { Pill, Trash2, Pencil, Plus, Minus, Sun, Copy, Layers, X, Check, CheckCheck } from 'lucide-react-native';
import { supplementAPI, nutritionAPI } from '../api';
import { Card, Button, Sheet, colors, makeStyles, Hint, ErrorText, LinkText, confirm } from '../components';
import DayNav, { useDaySwipe } from '../components/DayNav';
import { syncReminders } from '../utils/notifications';
import ReminderControl from '../components/ReminderControl';
import { microsText, SUPPLEMENT_MICROS } from '../../../client-web/src/utils/foodLogic';

const SUN_NOTE = 'Sun is an estimate: roughly 1,000 IU of vitamin D per 15 minutes of midday summer sun with arms and legs bare, for lighter skin. Much less in winter, early or late in the day, with darker skin or sunscreen.';

/**
 * Pick a supplement: `mine` (ones you've used before) first, then the built-in
 * list, searchable and grouped by category. Or add your own.
 */
function CatalogList({ mine = [], mineLabel = 'YOUR SUPPLEMENTS', onPickMine, onPick, onCustom }) {
  const [catalog, setCatalog] = useState(null);
  const [q, setQ] = useState('');
  useEffect(() => { supplementAPI.catalog().then(({ data }) => setCatalog(data)).catch(() => setCatalog([])); }, []);
  const term = q.trim().toLowerCase();
  const shown = (catalog || []).filter((c) => !term || c.name.toLowerCase().includes(term) || c.category.includes(term));
  const groups = [...new Set(shown.map((c) => c.category))];
  const myShown = mine.filter((m) => !term || m.name.toLowerCase().includes(term));
  return (
    <>
      <TextInput style={styles.input} placeholder="Search supplements…" placeholderTextColor={colors.textMuted} value={q} onChangeText={setQ} />
      {myShown.length > 0 ? (
        <View style={{ marginTop: 10 }}>
          <Text style={styles.group}>{mineLabel}</Text>
          {myShown.map((m) => (
            <TouchableOpacity key={m._id} onPress={() => onPickMine(m)} style={styles.catRow}>
              <Text style={styles.name}>{m.name}</Text>
              <Text style={styles.small}>{detailText(m)}{m.inStack ? ' · in your stack' : ''}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
      {catalog === null ? <Hint style={{ marginTop: 8 }}>Loading…</Hint> : groups.map((g) => (
        <View key={g} style={{ marginTop: 10 }}>
          <Text style={styles.group}>{g.toUpperCase()}</Text>
          {shown.filter((c) => c.category === g).map((c) => (
            <TouchableOpacity key={c._id} onPress={() => onPick(c)} style={styles.catRow}>
              <View style={styles.row}>
                {c.category === 'sun' ? <Sun size={14} color={colors.warning} /> : null}
                <Text style={styles.name}>{c.name}</Text>
              </View>
              <Text style={styles.small}>{c.serving}</Text>
              {microsText(c.micros) ? <Text style={styles.micros}>{microsText(c.micros)}</Text> : null}
            </TouchableOpacity>
          ))}
        </View>
      ))}
      <LinkText onPress={onCustom} style={{ marginTop: 14 }}>+ Add your own instead</LinkText>
    </>
  );
}

const detailText = (s, servings = s.servings) => [servings && servings !== 1 ? `${servings} ×` : '', s.dose, s.timing].filter(Boolean).join(' · ') || '1 serving';
const microsOf = (s) => (s.catalog ? s.catalog.micros : s.micros);

/** One supplement's name, serving and micros (for `servings`). */
function SupplementInfo({ s, servings, taken = false }) {
  const micros = microsText(microsOf(s), servings || 1);
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.row}>
        {s.catalog?.category === 'sun' ? <Sun size={14} color={colors.warning} /> : <Pill size={14} color={colors.textMuted} />}
        <Text style={[styles.name, { flexShrink: 1 }, taken && { color: colors.textMuted }]}>{s.name}</Text>
      </View>
      {s.dose || s.timing ? <Text style={styles.small}>{[s.dose, s.timing].filter(Boolean).join(' · ')}</Text> : null}
      {micros ? <Text style={styles.micros}>{micros}{s.catalog?.category === 'sun' ? ' (estimate)' : ''}</Text> : null}
    </View>
  );
}

/** − servings + for one day's entry. */
function ServingsStepper({ value, onChange }) {
  const step = (d) => onChange(Math.min(20, Math.max(0.25, Math.round((value + d) * 4) / 4)));
  return (
    <View style={styles.row}>
      <TouchableOpacity onPress={() => step(value > 1 ? -1 : -0.25)} disabled={value <= 0.25} style={[styles.stepBtn, value <= 0.25 && { opacity: 0.3 }]} hitSlop={4}>
        <Minus size={13} color={colors.textSecondary} />
      </TouchableOpacity>
      <Text style={[styles.small, { minWidth: 34, textAlign: 'center' }]}>{value} ×</Text>
      <TouchableOpacity onPress={() => step(value >= 1 ? 1 : 0.25)} disabled={value >= 20} style={[styles.stepBtn, value >= 20 && { opacity: 0.3 }]} hitSlop={4}>
        <Plus size={13} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

/** Your stack in a sheet: what you usually take, loaded onto a day in one go. */
function StackSheet({ visible, list, run, reload, onStackChange, onClose }) {
  const [adding, setAdding] = useState(false); // false | 'catalog' | 'custom'
  const [editing, setEditing] = useState(null);
  const stack = list.filter((s) => s.inStack);
  const others = list.filter((s) => !s.inStack);
  const close = () => { setAdding(false); setEditing(null); onClose(); };
  const create = (body) => run(async () => {
    const { data } = await supplementAPI.create({ ...body, inStack: true });
    setAdding(false); await reload(); await onStackChange(data._id, true);
  }, 'Could not add that supplement');
  const setInStack = (s, inStack) => run(async () => {
    await supplementAPI.update(s._id, { inStack });
    setAdding(false); await reload(); await onStackChange(s._id, inStack);
  }, 'Could not update your stack');
  const update = (id, body) => run(async () => { await supplementAPI.update(id, body); setEditing(null); reload(); }, 'Could not save that');
  const removeFromStack = async (s) => {
    if (!(await confirm(`Take ${s.name} out of your stack?`, 'Days before today keep it.', 'Remove', true))) return;
    setInStack(s, false);
  };
  return (
    <Sheet visible={visible} title={adding ? 'Add to your stack' : 'My stack'} onClose={close}
      subtitle={adding ? null : 'What you usually take. It\'s put on every day for you to tick off; changing it only affects today and later days.'}>
      {adding === 'catalog' ? (
        <>
          <LinkText onPress={() => setAdding(false)} style={{ marginBottom: 8 }}>‹ Back to my stack</LinkText>
          <CatalogList mine={others} mineLabel="USED BEFORE" onPickMine={(s) => setInStack(s, true)}
            onPick={(c) => create({ catalogId: c._id, ...(c.category === 'sun' && { timing: 'Midday' }) })} onCustom={() => setAdding('custom')} />
        </>
      ) : adding === 'custom' ? (
        <SupplementForm saveLabel="Add" withMicros onSave={create} onCancel={() => setAdding(false)} />
      ) : (
        <>
          <TouchableOpacity onPress={() => setAdding('catalog')} style={[styles.stackBtn, { alignSelf: 'flex-start' }]}>
            <Plus size={14} color={colors.brand} /><Text style={styles.link}>Add to stack</Text>
          </TouchableOpacity>
          {stack.length === 0 ? <Hint style={{ marginTop: 10 }}>Your stack is empty.</Hint> : stack.map((s) => (editing === s._id ? (
            <SupplementForm key={s._id} initial={{ name: s.name, dose: s.dose, timing: s.timing, servings: String(s.servings ?? 1), micros: s.micros }} withMicros={!s.catalog} saveLabel="Save"
              onSave={(body) => update(s._id, body)} onCancel={() => setEditing(null)} />
          ) : (
            <View key={s._id} style={styles.item}>
              <SupplementInfo s={s} servings={s.servings} />
              {s.servings && s.servings !== 1 ? <Text style={styles.small}>{s.servings} ×</Text> : null}
              <TouchableOpacity onPress={() => setEditing(s._id)} hitSlop={8}><Pencil size={15} color={colors.textMuted} /></TouchableOpacity>
              <TouchableOpacity onPress={() => removeFromStack(s)} hitSlop={8}><Trash2 size={15} color={colors.textMuted} /></TouchableOpacity>
            </View>
          )))}
        </>
      )}
    </Sheet>
  );
}

const key = (d) => format(d, 'yyyy-MM-dd');
const EMPTY = { name: '', dose: '', timing: '' };

/**
 * Name / serving / servings / timing, for adding or editing a supplement. Your
 * own ones (`withMicros`) can list their vitamins and minerals per serving.
 */
function SupplementForm({ initial = EMPTY, onSave, onCancel, saveLabel, withMicros }) {
  const [form, setForm] = useState({ servings: '1', ...initial });
  const [micros, setMicros] = useState(() => Object.fromEntries(Object.entries(initial.micros || {}).map(([k, v]) => [k, String(v)])));
  const [showMicros, setShowMicros] = useState(Object.keys(initial.micros || {}).length > 0);
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = async () => {
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      await onSave({
        name: form.name.trim(), dose: form.dose.trim(), timing: form.timing.trim(), servings: Number(form.servings) || 1,
        ...(withMicros && { micros: Object.fromEntries(Object.entries(micros).filter(([, v]) => Number(v) > 0).map(([k, v]) => [k, Number(v)])) }),
      });
    } finally { setBusy(false); }
  };
  const field = (k, placeholder, max) => (
    <TextInput style={styles.input} maxLength={max} placeholder={placeholder} placeholderTextColor={colors.textMuted} value={form[k]} onChangeText={set(k)} />
  );
  return (
    <View style={{ gap: 6, paddingVertical: 6 }}>
      {field('name', 'Name, e.g. Creatine', 60)}
      <View style={styles.row}>
        <View style={{ flex: 1 }}>{field('dose', 'Serving, e.g. 1 capsule', 40)}</View>
        <View style={{ flex: 1 }}>{field('timing', 'When, e.g. Morning', 40)}</View>
      </View>
      <View style={styles.row}>
        <Text style={styles.small}>Servings you take</Text>
        <TextInput style={[styles.input, { width: 70 }]} keyboardType="decimal-pad" value={String(form.servings)} onChangeText={set('servings')} />
      </View>
      {withMicros ? (
        <>
          <LinkText onPress={() => setShowMicros(!showMicros)}>{showMicros ? 'Hide' : 'Add'} vitamins & minerals per serving (from the label)</LinkText>
          {showMicros ? (
            <View style={styles.microGrid}>
              {SUPPLEMENT_MICROS.map((c) => (
                <View key={c.key} style={styles.microCell}>
                  <Text style={styles.small}>{c.label} ({c.unit})</Text>
                  <TextInput style={styles.input} keyboardType="decimal-pad" value={micros[c.key] ?? ''}
                    onChangeText={(v) => setMicros((m) => ({ ...m, [c.key]: v }))} />
                </View>
              ))}
            </View>
          ) : null}
        </>
      ) : null}
      <View style={[styles.row, { justifyContent: 'flex-end' }]}>
        <LinkText onPress={onCancel}>Cancel</LinkText>
        <Button title={saveLabel} onPress={submit} disabled={busy || !form.name.trim()} style={{ paddingHorizontal: 18, minHeight: 38 }} />
      </View>
    </View>
  );
}

/** Supplements: each day's list (your stack, put on automatically, plus extras), ticked off as you take them. */
export default function SupplementsScreen() {
  const [date, setDate] = useState(key(new Date()));
  const swipe = useDaySwipe(date, setDate);
  const [list, setList] = useState(null);   // every supplement you've used
  const [day, setDay] = useState(null);     // [{ supplement, servings }] for the day
  const [adding, setAdding] = useState(false); // false | 'catalog' | 'custom'
  const [stackOpen, setStackOpen] = useState(false);
  const [error, setError] = useState('');

  const loadList = useCallback(() => supplementAPI.getAll().then(({ data }) => setList(data)).catch(() => setList([])), []);
  const fromLog = (log) => setDay(log?.supplementsTaken || []);
  const loadDay = useCallback(() => { setDay(null); nutritionAPI.supplementDay(date).then(({ data }) => fromLog(data)).catch(() => setDay([])); }, [date]);
  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => { loadDay(); }, [loadDay]);
  // Ticking everything off today cancels tonight's reminder (and unticking brings it back).
  useEffect(() => { if (day && date === key(new Date())) syncReminders(); }, [day, date]);

  const run = async (fn, fallback) => {
    setError('');
    try { await fn(); } catch (err) { setError(err.response?.data?.errors?.[0]?.message || err.response?.data?.message || fallback); }
  };
  const byId = new Map((list || []).map((s) => [String(s._id), s]));
  const onDay = new Set((day || []).map((t) => String(t.supplement)));
  const stack = (list || []).filter((s) => s.inStack);
  const takenCount = (day || []).filter((t) => t.taken !== false).length;
  const unticked = (day || []).filter((t) => t.taken === false).map((t) => t.supplement);
  const editable = date >= key(new Date()); // stack changes also apply to today and later days

  // Only this day changes.
  const addToDay = (s) => run(async () => { fromLog((await nutritionAPI.toggleSupplement(date, s._id)).data); setAdding(false); }, 'Could not add that');
  const removeFromDay = (id) => run(async () => fromLog((await nutritionAPI.toggleSupplement(date, id)).data), 'Could not remove that');
  const tick = (id) => run(async () => fromLog((await nutritionAPI.tickSupplement(date, id)).data), 'Could not update that');
  const tickAll = () => run(async () => fromLog((await nutritionAPI.takeSupplements(date, { supplementIds: unticked })).data), 'Could not tick them off');
  // A stack change shows on the day being viewed if it's today or later (unticked ones only).
  const onStackChange = async (id, inStack) => {
    if (!editable) return;
    const entry = (day || []).find((t) => String(t.supplement) === String(id));
    if (inStack ? !entry : entry && entry.taken === false) fromLog((await nutritionAPI.toggleSupplement(date, id)).data);
  };
  const setServings = (id, servings) => run(async () => fromLog((await nutritionAPI.setSupplementServings(date, id, servings)).data), 'Could not change the servings');
  // Something new for this day only (not added to the stack).
  const createForDay = (body) => run(async () => {
    const { data } = await supplementAPI.create({ ...body, inStack: false });
    await loadList();
    if (!onDay.has(String(data._id))) fromLog((await nutritionAPI.toggleSupplement(date, data._id)).data);
    setAdding(false);
  }, 'Could not add that supplement');
  const sameAsDayBefore = () => run(async () => {
    fromLog((await nutritionAPI.takeSupplements(date, { copyFrom: format(subDays(parseISO(date), 1), 'yyyy-MM-dd') })).data);
  }, 'Could not copy the day before');

  const available = (list || []).filter((s) => !onDay.has(String(s._id))).sort((a, b) => Number(b.inStack) - Number(a.inStack));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }} {...swipe}>
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      <DayNav date={date} onChange={setDate}
        right={<TouchableOpacity onPress={() => setStackOpen(true)} style={styles.stackBtn}><Layers size={14} color={colors.brand} /><Text style={styles.link}>My stack{list ? ` (${stack.length})` : ''}</Text></TouchableOpacity>} />
      <ErrorText>{error}</ErrorText>
      <Card>
        <View style={[styles.row, { justifyContent: 'space-between' }]}>
          <Text style={styles.small}>{day?.length ? <Text><Text style={styles.bold}>{takenCount} of {day.length}</Text> taken</Text> : 'No supplements on this day.'}</Text>
          {!adding ? (
            <TouchableOpacity onPress={() => setAdding('catalog')} style={styles.row} hitSlop={6}>
              <Plus size={16} color={colors.brand} /><Text style={styles.link}>Add</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={[styles.row, { flexWrap: 'wrap', marginTop: 8 }]}>
          {unticked.length > 0 ? (
            <TouchableOpacity onPress={tickAll} style={styles.stackBtn}><CheckCheck size={14} color={colors.brand} /><Text style={styles.link}>Tick all</Text></TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={sameAsDayBefore} style={styles.stackBtn}><Copy size={14} color={colors.brand} /><Text style={styles.link}>Same as day before</Text></TouchableOpacity>
        </View>
        {list && stack.length === 0 && !day?.length ? (
          <Hint style={{ marginTop: 8 }}>Tip: put what you take every day in <Text style={styles.link} onPress={() => setStackOpen(true)}>My stack</Text> and it'll be here each day, ready to tick off.</Hint>
        ) : null}
        {adding === 'custom' ? <SupplementForm saveLabel="Add" withMicros onSave={createForDay} onCancel={() => setAdding(false)} /> : null}

        {day === null || list === null ? <Hint style={{ marginTop: 8 }}>Loading…</Hint> : day.map((t) => {
          const s = byId.get(String(t.supplement));
          const servings = t.servings || s?.servings || 1;
          const isTaken = t.taken !== false;
          return (
            <View key={String(t.supplement)} style={styles.item}>
              <TouchableOpacity onPress={() => tick(t.supplement)} hitSlop={8} style={[styles.check, isTaken && styles.checkOn]}
                accessibilityLabel={`${isTaken ? 'Untick' : 'Tick off'} ${s?.name || 'supplement'}`}>
                {isTaken ? <Check size={14} color="#fff" /> : null}
              </TouchableOpacity>
              {s ? <SupplementInfo s={s} servings={servings} taken={isTaken} /> : <Text style={[styles.small, { flex: 1 }]}>A removed supplement</Text>}
              {s ? <ServingsStepper value={servings} onChange={(v) => setServings(s._id, v)} /> : null}
              <TouchableOpacity onPress={() => removeFromDay(t.supplement)} hitSlop={8} accessibilityLabel="Remove from this day"><X size={16} color={colors.textMuted} /></TouchableOpacity>
            </View>
          );
        })}
      </Card>
      <Card>
        <ReminderControl kind="supplements" title="Supplement reminder" hint="Every day; skipped once everything's ticked off." />
      </Card>
      <Hint style={{ textAlign: 'center' }}>Ticked supplements add their vitamins and minerals to that day's micronutrients in the Food Log. Adding, removing or changing servings here only changes this day. {SUN_NOTE}</Hint>
      <Sheet visible={adding === 'catalog'} title="Add to this day" subtitle="Amounts are typical label doses; change the servings after adding it." onClose={() => setAdding(false)}>
        <CatalogList mine={available} onPickMine={addToDay}
          onPick={(c) => createForDay({ catalogId: c._id, ...(c.category === 'sun' && { timing: 'Midday' }) })} onCustom={() => setAdding('custom')} />
      </Sheet>
      {list ? <StackSheet visible={stackOpen} list={list} run={run} reload={loadList} onStackChange={onStackChange} onClose={() => setStackOpen(false)} /> : null}
    </ScrollView>
    </View>
  );
}

const styles = makeStyles(() => ({
  row:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  small:   { fontSize: 12, color: colors.textSecondary },
  bold:    { fontWeight: '700', color: colors.textPrimary },
  link:    { fontSize: 14, fontWeight: '600', color: colors.brand },
  input:   { height: 40, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 10, fontSize: 14, color: colors.textPrimary, backgroundColor: colors.surface },
  item:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderTopWidth: 1, borderTopColor: colors.subtle },
  name:    { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  micros:  { fontSize: 11, color: '#0ea5e9', marginTop: 1 },
  microGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  microCell: { width: '47%' },
  stackBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  check:   { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.success, borderColor: colors.success },
  stepBtn: { width: 24, height: 24, borderRadius: 6, backgroundColor: colors.subtle, alignItems: 'center', justifyContent: 'center' },
  group:   { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5 },
  catRow:  { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.subtle },
}));
