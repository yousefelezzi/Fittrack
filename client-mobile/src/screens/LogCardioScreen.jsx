/**
 * Log Cardio: runs, rides, swims and other cardio, with an estimated calorie
 * burn. With the dynamic calorie goal on, a day's cardio adds to that day's goal.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { format, startOfWeek } from 'date-fns';
import { Flame, Trash2, Check } from 'lucide-react-native';
import { cardioAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Segmented, Label, Hint, Chip, colors, makeStyles, confirm } from '../components';
import {
  CARDIO_ACTIVITIES, INTENSITIES, activityOf, cardioCalories, distanceUnit, toKm, fromKm, paceText,
} from '../../../client-web/src/utils/cardio';

const EMPTY = { activity: 'running', intensity: 'moderate', minutes: '', distance: '', daysAgo: '0', notes: '' };

export default function LogCardioScreen() {
  const { user } = useAuth();
  const unit = distanceUnit(user);
  const [form, setForm] = useState(EMPTY);
  const [list, setList] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setError(''); setSaved(''); };
  const num = (v) => Number(String(v).replace(',', '.'));

  useEffect(() => { cardioAPI.getAll().then(({ data }) => setList(data)).catch(() => setList([])); }, []);

  const activity = activityOf(form.activity);
  const minutes = num(form.minutes) || 0;
  const estimate = minutes > 0 ? cardioCalories({ ...form, minutes }, user?.weight) : 0;

  const save = async () => {
    if (!(minutes >= 1 && minutes <= 600)) { setError('Enter how many minutes (1 to 600).'); return; }
    setSaving(true);
    try {
      // Today: now. Earlier days: midday.
      const date = new Date();
      if (form.daysAgo !== '0') { date.setDate(date.getDate() - Number(form.daysAgo)); date.setHours(12, 0, 0, 0); }
      const { data } = await cardioAPI.create({
        activity: form.activity, intensity: form.intensity, minutes: Math.round(minutes), date: date.toISOString(),
        ...(activity.hasDistance && form.distance !== '' && { distanceKm: Math.round(toKm(num(form.distance), unit) * 1000) / 1000 }),
        notes: form.notes.trim(),
      });
      setList((l) => [data, ...(l || [])].sort((a, b) => new Date(b.date) - new Date(a.date)));
      setForm((f) => ({ ...EMPTY, activity: f.activity, intensity: f.intensity }));
      setSaved(`${activity.label} saved. About ${data.calories.toLocaleString()} kcal burned.`);
    } catch (err) {
      setError(err.response?.data?.errors?.[0]?.message || err.response?.data?.message || 'Could not save that');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!(await confirm('Delete this cardio session?', '', 'Delete', true))) return;
    try { await cardioAPI.delete(id); setList((l) => l.filter((s) => s._id !== id)); } catch { setError('Could not delete that'); }
  };

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const thisWeek = (list || []).filter((s) => new Date(s.date) >= weekStart);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Card>
          <Label>Activity</Label>
          <View style={styles.wrap}>
            {CARDIO_ACTIVITIES.map((a) => <Chip key={a.key} small label={a.label} active={form.activity === a.key} onPress={() => set('activity', a.key)} />)}
          </View>

          <View style={[styles.row, { marginTop: 12 }]}>
            <View style={{ flex: 1 }}>
              <Label>Minutes</Label>
              <TextInput style={styles.input} keyboardType="number-pad" placeholder="e.g. 30" placeholderTextColor={colors.textMuted} value={form.minutes} onChangeText={(v) => set('minutes', v)} />
            </View>
            {activity.hasDistance ? (
              <View style={{ flex: 1 }}>
                <Label>Distance ({unit})</Label>
                <TextInput style={styles.input} keyboardType="decimal-pad" placeholder="optional" placeholderTextColor={colors.textMuted} value={form.distance} onChangeText={(v) => set('distance', v)} />
              </View>
            ) : null}
          </View>

          <Label style={{ marginTop: 12 }}>Intensity</Label>
          <Segmented value={form.intensity} onChange={(v) => set('intensity', v)} options={INTENSITIES.map(([k, l]) => [k, l])} />
          <Hint style={{ marginTop: 4 }}>{INTENSITIES.find(([k]) => k === form.intensity)[2]}</Hint>

          <Label style={{ marginTop: 12 }}>When</Label>
          <Segmented value={form.daysAgo} onChange={(v) => set('daysAgo', v)} options={[['0', 'Today'], ['1', 'Yesterday'], ['2', '2 days ago']]} />

          <Label style={{ marginTop: 12 }}>Notes</Label>
          <TextInput style={styles.input} maxLength={300} placeholder="Optional" placeholderTextColor={colors.textMuted} value={form.notes} onChangeText={(v) => set('notes', v)} />

          <View style={[styles.row, { marginTop: 14 }]}>
            <Flame size={15} color={colors.warning} />
            <Text style={[styles.text, { flex: 1 }]}>
              {estimate ? `About ${estimate.toLocaleString()} kcal${!user?.weight ? ' (add your weight to your profile for a better estimate)' : ''}` : 'Enter the minutes to see the calories'}
            </Text>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {saved ? <View style={[styles.row, { marginTop: 6 }]}><Check size={15} color={colors.success} /><Text style={[styles.text, { color: colors.success, flex: 1 }]}>{saved}</Text></View> : null}
          <Button title={saving ? 'Saving…' : 'Save cardio'} onPress={save} loading={saving} disabled={saving} style={{ marginTop: 12 }} />
        </Card>

        <Card>
          <View style={[styles.row, { justifyContent: 'space-between', marginBottom: 6 }]}>
            <Text style={styles.title}>Recent cardio</Text>
            {thisWeek.length ? <Text style={styles.muted}>This week: {thisWeek.reduce((n, s) => n + s.minutes, 0)} min · ~{thisWeek.reduce((n, s) => n + s.calories, 0).toLocaleString()} kcal</Text> : null}
          </View>
          {list === null ? <Hint>Loading…</Hint> : list.length === 0 ? <Hint>No cardio in the last 60 days.</Hint> : list.map((s) => {
            const pace = paceText(s.minutes, s.distanceKm, unit);
            return (
              <View key={s._id} style={styles.item}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{activityOf(s.activity).label} <Text style={styles.muted}>· {s.intensity}</Text></Text>
                  <Text style={styles.muted}>
                    {format(new Date(s.date), 'EEE, MMM d · HH:mm')} · {s.minutes} min{s.distanceKm ? ` · ${fromKm(s.distanceKm, unit)} ${unit}` : ''}{pace ? ` · ${pace}` : ''} · ~{s.calories.toLocaleString()} kcal
                  </Text>
                  {s.notes ? <Text style={styles.muted} numberOfLines={1}>{s.notes}</Text> : null}
                </View>
                <TouchableOpacity onPress={() => remove(s._id)} hitSlop={8}><Trash2 size={16} color={colors.textMuted} /></TouchableOpacity>
              </View>
            );
          })}
          <Hint style={{ marginTop: 8 }}>Calories are estimated from the activity, intensity, time and your weight. With the dynamic calorie goal on, a day's cardio adds to that day's goal.</Hint>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = makeStyles(() => ({
  wrap:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  row:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { height: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, fontSize: 15, color: colors.textPrimary, backgroundColor: colors.surface },
  text:  { fontSize: 14, color: colors.textPrimary },
  muted: { fontSize: 12, color: colors.textSecondary },
  title: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  name:  { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  item:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.subtle },
  error: { fontSize: 13, color: colors.danger, marginTop: 6 },
}));
