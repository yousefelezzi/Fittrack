import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { format } from 'date-fns';
import { Pill, Trash2, Pencil, Check, Plus } from 'lucide-react-native';
import { supplementAPI, nutritionAPI } from '../api';
import { Card, Button, colors, makeStyles, Hint, ErrorText, LinkText, confirm } from '../components';
import DayNav from '../components/DayNav';

const key = (d) => format(d, 'yyyy-MM-dd');
const EMPTY = { name: '', dose: '', timing: '' };

/** Name / dose / timing fields, for adding or editing a supplement. */
function SupplementForm({ initial = EMPTY, onSave, onCancel, saveLabel }) {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = async () => {
    if (!form.name.trim()) return;
    setBusy(true);
    try { await onSave({ name: form.name.trim(), dose: form.dose.trim(), timing: form.timing.trim() }); } finally { setBusy(false); }
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
            <TouchableOpacity onPress={() => setAdding(true)} style={styles.row} hitSlop={6}>
              <Plus size={16} color={colors.brand} /><Text style={styles.link}>Add</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {adding ? <SupplementForm saveLabel="Add" onSave={create} onCancel={() => setAdding(false)} /> : null}

        {list === null ? <Hint>Loading…</Hint> : list.map((s) => {
          const isTaken = taken.has(String(s._id));
          return editing === s._id ? (
            <SupplementForm key={s._id} initial={{ name: s.name, dose: s.dose, timing: s.timing }} saveLabel="Save"
              onSave={(body) => update(s._id, body)} onCancel={() => setEditing(null)} />
          ) : (
            <View key={s._id} style={styles.item}>
              <TouchableOpacity onPress={() => toggle(s._id)} hitSlop={8} style={[styles.check, isTaken && styles.checkOn]}>
                {isTaken ? <Check size={14} color="#fff" /> : null}
              </TouchableOpacity>
              <Pill size={16} color={colors.textMuted} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, isTaken && styles.done]}>{s.name}</Text>
                {s.dose || s.timing ? <Text style={styles.small}>{[s.dose, s.timing].filter(Boolean).join(' · ')}</Text> : null}
              </View>
              <TouchableOpacity onPress={() => setEditing(s._id)} hitSlop={8}><Pencil size={15} color={colors.textMuted} /></TouchableOpacity>
              <TouchableOpacity onPress={() => remove(s)} hitSlop={8}><Trash2 size={15} color={colors.textMuted} /></TouchableOpacity>
            </View>
          );
        })}
      </Card>
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
}));
