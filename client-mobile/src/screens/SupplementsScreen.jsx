import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { format } from 'date-fns';
import { Pill, Trash2, Pencil, Check, Plus, Sun } from 'lucide-react-native';
import { supplementAPI, nutritionAPI } from '../api';
import { Card, Button, Sheet, colors, makeStyles, Hint, ErrorText, LinkText, confirm } from '../components';
import DayNav from '../components/DayNav';
import { microsText } from '../../../client-web/src/utils/foodLogic';

const SUN_NOTE = 'Sun is an estimate: roughly 1,000 IU of vitamin D per 15 minutes of midday summer sun with arms and legs bare, for lighter skin. Much less in winter, early or late in the day, with darker skin or sunscreen.';

/** The built-in list in a sheet: search, grouped by category; pick one to add it. Or add your own. */
function CatalogSheet({ visible, onPick, onCustom, onClose }) {
  const [catalog, setCatalog] = useState(null);
  const [q, setQ] = useState('');
  useEffect(() => { if (visible && !catalog) supplementAPI.catalog().then(({ data }) => setCatalog(data)).catch(() => setCatalog([])); }, [visible, catalog]);
  const term = q.trim().toLowerCase();
  const shown = (catalog || []).filter((c) => !term || c.name.toLowerCase().includes(term) || c.category.includes(term));
  const groups = [...new Set(shown.map((c) => c.category))];
  return (
    <Sheet visible={visible} title="Add a supplement" subtitle="Amounts are typical label doses; set the servings you take after adding it." onClose={onClose}>
      <TextInput style={styles.input} placeholder="Search supplements…" placeholderTextColor={colors.textMuted} value={q} onChangeText={setQ} />
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
    </Sheet>
  );
}

const key = (d) => format(d, 'yyyy-MM-dd');
const EMPTY = { name: '', dose: '', timing: '' };

/** Name / dose / timing (and servings for built-in ones), for adding or editing a supplement. */
function SupplementForm({ initial = EMPTY, onSave, onCancel, saveLabel, withServings }) {
  const [form, setForm] = useState({ servings: '1', ...initial });
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = async () => {
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      await onSave({ name: form.name.trim(), dose: form.dose.trim(), timing: form.timing.trim(), ...(withServings && { servings: Number(form.servings) || 1 }) });
    } finally { setBusy(false); }
  };
  const field = (k, placeholder, max) => (
    <TextInput style={styles.input} maxLength={max} placeholder={placeholder} placeholderTextColor={colors.textMuted} value={form[k]} onChangeText={set(k)} />
  );
  return (
    <View style={{ gap: 6, paddingVertical: 6 }}>
      {field('name', 'Name, e.g. Creatine', 60)}
      <View style={styles.row}>
        <View style={{ flex: 1 }}>{field('dose', 'Dose, e.g. 5 g', 40)}</View>
        <View style={{ flex: 1 }}>{field('timing', 'When, e.g. Morning', 40)}</View>
      </View>
      {withServings ? (
        <View style={styles.row}>
          <Text style={styles.small}>Servings</Text>
          <TextInput style={[styles.input, { width: 70 }]} keyboardType="decimal-pad" value={String(form.servings)} onChangeText={set('servings')} />
        </View>
      ) : null}
      <View style={[styles.row, { justifyContent: 'flex-end' }]}>
        <LinkText onPress={onCancel}>Cancel</LinkText>
        <Button title={saveLabel} onPress={submit} disabled={busy || !form.name.trim()} style={{ paddingHorizontal: 18, minHeight: 38 }} />
      </View>
    </View>
  );
}

/** Supplements: your list, ticked off day by day. */
export default function SupplementsScreen() {
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
  const remove = async (s) => {
    if (!(await confirm(`Remove ${s.name}?`, 'Days you already ticked stay ticked.', 'Remove', true))) return;
    run(async () => { await supplementAPI.delete(s._id); loadList(); }, 'Could not remove that');
  };

  const takenCount = (list || []).filter((s) => taken.has(String(s._id))).length;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      <DayNav date={date} onChange={setDate} />
      <ErrorText>{error}</ErrorText>
      <Card>
        <View style={[styles.row, { justifyContent: 'space-between' }]}>
          <Text style={styles.small}>
            {list?.length ? <Text><Text style={styles.bold}>{takenCount} of {list.length}</Text> taken</Text> : 'Add the supplements you take to tick them off each day.'}
          </Text>
          {!adding ? (
            <TouchableOpacity onPress={() => setAdding('catalog')} style={styles.row} hitSlop={6}>
              <Plus size={16} color={colors.brand} /><Text style={styles.link}>Add</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {adding === 'custom' ? <SupplementForm saveLabel="Add" onSave={create} onCancel={() => setAdding(false)} /> : null}

        {list === null ? <Hint>Loading…</Hint> : list.map((s) => {
          const isTaken = taken.has(String(s._id));
          return editing === s._id ? (
            <SupplementForm key={s._id} initial={{ name: s.name, dose: s.dose, timing: s.timing, servings: String(s.servings ?? 1) }} withServings={!!s.catalog} saveLabel="Save"
              onSave={(body) => update(s._id, body)} onCancel={() => setEditing(null)} />
          ) : (
            <View key={s._id} style={styles.item}>
              <TouchableOpacity onPress={() => toggle(s._id)} hitSlop={8} style={[styles.check, isTaken && styles.checkOn]}>
                {isTaken ? <Check size={14} color="#fff" /> : null}
              </TouchableOpacity>
              <Pill size={16} color={colors.textMuted} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, isTaken && styles.done]}>{s.name}</Text>
                {s.dose || s.timing || s.servings !== 1 ? (
                  <Text style={styles.small}>{[s.servings && s.servings !== 1 ? `${s.servings} ×` : '', s.dose, s.timing].filter(Boolean).join(' · ')}</Text>
                ) : null}
                {s.catalog && microsText(s.catalog.micros, s.servings || 1) ? (
                  <Text style={styles.micros}>{microsText(s.catalog.micros, s.servings || 1)}{s.catalog.category === 'sun' ? ' (estimate)' : ''}</Text>
                ) : null}
              </View>
              <TouchableOpacity onPress={() => setEditing(s._id)} hitSlop={8}><Pencil size={15} color={colors.textMuted} /></TouchableOpacity>
              <TouchableOpacity onPress={() => remove(s)} hitSlop={8}><Trash2 size={15} color={colors.textMuted} /></TouchableOpacity>
            </View>
          );
        })}
      </Card>
      <Hint style={{ textAlign: 'center' }}>Supplements from the list add their vitamins and minerals to the Food Log's micronutrients on days you tick them off. {SUN_NOTE}</Hint>
      <CatalogSheet visible={adding === 'catalog'} onPick={addFromCatalog} onCustom={() => setAdding('custom')} onClose={() => setAdding(false)} />
    </ScrollView>
  );
}

const styles = makeStyles(() => ({
  row:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  small:   { fontSize: 12, color: colors.textSecondary },
  bold:    { fontWeight: '700', color: colors.textPrimary },
  link:    { fontSize: 14, fontWeight: '600', color: colors.brand },
  input:   { height: 40, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 10, fontSize: 14, color: colors.textPrimary, backgroundColor: colors.surface },
  item:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderTopWidth: 1, borderTopColor: colors.subtle },
  check:   { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.success, borderColor: colors.success },
  name:    { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  done:    { color: colors.textMuted, textDecorationLine: 'line-through' },
  micros:  { fontSize: 11, color: '#0ea5e9', marginTop: 1 },
  group:   { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5 },
  catRow:  { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.subtle },
}));
