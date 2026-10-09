/**
 * Cardio: start a timed session (switch intensity as you go, report at the
 * end) or log one you've already done, for the built-in activities and your
 * own. With the dynamic calorie goal active, a day's cardio adds to that day's goal.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, startOfWeek } from 'date-fns';
import { Flame, Trash2, Check, Play, Pause, Square, Plus, X, HeartPulse } from 'lucide-react-native';
import { cardioAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Segmented, Label, Hint, Chip, Sheet, colors, makeStyles, confirm } from '../components';
import {
  CARDIO_ACTIVITIES, INTENSITIES, activityOf, cardioCalories, distanceUnit, toKm, fromKm, paceText, cardioSteps, STEP_OVERLAP_NOTE,
  startLive, liveSeconds, pauseLive, resumeLive, setLiveIntensity, finishLive, formatClock, previousSession, cardioReport, formatPace,
} from '../../../client-web/src/utils/cardio';

const STORE = 'fittrack.cardioSession'; // { live } or { finished }, so closing the app keeps the session
const ROSE = '#f43f5e';
const nameOf = (s) => s.customName || activityOf(s.activity).label;
const signed = (n, f) => (n == null || Math.round(n) === 0 ? '±0' : `${n > 0 ? '+' : '−'}${f(Math.abs(n))}`);
const num = (v) => Number(String(v).replace(',', '.'));

function ActivityPicker({ value, onChange, mine, setMine }) {
  const [adding, setAdding] = useState(false);
  const [managing, setManaging] = useState(false);
  const [form, setForm] = useState({ name: '', base: 'running' });
  const [error, setError] = useState('');
  const add = async () => {
    try {
      const { data } = await cardioAPI.addActivity({ name: form.name.trim(), base: form.base });
      setMine((m) => [...m, data].sort((a, b) => a.name.localeCompare(b.name)));
      onChange({ activity: data.base, customActivity: data._id, name: data.name });
      setForm({ name: '', base: 'running' });
      setAdding(false);
      setError('');
    } catch (err) { setError(err.response?.data?.errors?.[0]?.message || err.response?.data?.message || 'Could not add that'); }
  };
  const remove = async (a) => {
    if (!(await confirm(`Remove "${a.name}"?`, 'Sessions you logged keep it.', 'Remove', true))) return;
    try {
      await cardioAPI.deleteActivity(a._id);
      setMine((m) => m.filter((x) => x._id !== a._id));
      if (String(value.customActivity) === String(a._id)) onChange({ activity: a.base, customActivity: null, name: activityOf(a.base).label });
    } catch { setError('Could not remove that'); }
  };
  return (
    <View>
      <View style={styles.wrap}>
        {CARDIO_ACTIVITIES.map((a) => <Chip key={a.key} small label={a.label} active={!value.customActivity && value.activity === a.key}
          onPress={() => onChange({ activity: a.key, customActivity: null, name: a.label })} />)}
      </View>
      {mine.length > 0 ? <Text style={styles.group}>YOUR ACTIVITIES</Text> : null}
      <View style={[styles.wrap, { marginTop: 6 }]}>
        {mine.map((a) => (
          <View key={a._id} style={styles.row}>
            <Chip small label={a.name} active={String(value.customActivity) === String(a._id)} onPress={() => onChange({ activity: a.base, customActivity: a._id, name: a.name })} />
            {managing ? <TouchableOpacity onPress={() => remove(a)} hitSlop={8}><X size={14} color={colors.textMuted} /></TouchableOpacity> : null}
          </View>
        ))}
        <TouchableOpacity onPress={() => setAdding(true)} style={styles.row} hitSlop={6}><Plus size={14} color={ROSE} /><Text style={[styles.link, { color: ROSE }]}>Add your own</Text></TouchableOpacity>
        {mine.length ? <TouchableOpacity onPress={() => setManaging(!managing)} hitSlop={6}><Text style={styles.muted}>{managing ? 'Done' : 'Manage'}</Text></TouchableOpacity> : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Sheet visible={adding} title="Your own activity" subtitle="Its calories are worked out like the activity it's most like." onClose={() => setAdding(false)}
        footer={<Button title="Add" onPress={add} disabled={!form.name.trim()} />}>
        <Label>Name</Label>
        <TextInput style={styles.input} maxLength={40} placeholder="e.g. Incline treadmill" placeholderTextColor={colors.textMuted} value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
        <Label style={{ marginTop: 12 }}>Most like</Label>
        <View style={styles.wrap}>
          {CARDIO_ACTIVITIES.map((a) => <Chip key={a.key} small label={a.label} active={form.base === a.key} onPress={() => setForm({ ...form, base: a.key })} />)}
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Sheet>
    </View>
  );
}

function LiveCardio({ live, setLive, kg, onFinish, onCancel }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  const seconds = liveSeconds(live, now);
  const calories = cardioCalories({ activity: live.activity, segments: finishLive(live, now) }, kg);
  return (
    <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
      <Text style={styles.liveName}>{live.name.toUpperCase()}</Text>
      <Text style={[styles.clock, !live.running && { color: colors.textMuted }]}>{formatClock(seconds)}</Text>
      <View style={styles.row}><Flame size={14} color={colors.warning} /><Text style={styles.muted}>~{calories.toLocaleString()} kcal{!live.running ? ' · paused' : ''}</Text></View>
      <View style={{ alignSelf: 'stretch', marginTop: 20 }}>
        <Segmented value={live.intensity} onChange={(k) => setLive(setLiveIntensity(live, k))} options={INTENSITIES.map(([k, l]) => [k, l])} />
        <Hint style={{ textAlign: 'center', marginTop: 4 }}>{INTENSITIES.find(([k]) => k === live.intensity)[2]}. Switch as you go.</Hint>
      </View>
      <View style={[styles.row, { marginTop: 20, gap: 12 }]}>
        <Button icon={live.running ? Pause : Play} title={live.running ? 'Pause' : 'Resume'} variant="secondary" style={{ paddingHorizontal: 18 }}
          onPress={() => setLive(live.running ? pauseLive(live) : resumeLive(live))} />
        <Button icon={Square} title="Finish" disabled={seconds < 1} style={{ paddingHorizontal: 18 }} onPress={() => onFinish(finishLive(live))} />
      </View>
      <TouchableOpacity onPress={onCancel} style={{ marginTop: 16 }}><Text style={styles.muted}>Cancel session</Text></TouchableOpacity>
    </Card>
  );
}

function CardioReport({ finished, previous, kg, unit, onSave, onDiscard, saving, error }) {
  const [distance, setDistance] = useState('');
  const [notes, setNotes] = useState('');
  const activity = activityOf(finished.activity);
  const report = cardioReport({ activity: finished.activity, segments: finished.segments, distanceKm: distance === '' ? null : toKm(num(distance), unit) }, previous, kg, unit);
  const c = report.change;
  const change = (value, text) => (value == null ? null
    : <Text style={[styles.change, { color: Math.round(value) === 0 ? colors.textMuted : value > 0 ? colors.success : colors.danger }]}> {text}</Text>);
  const tiles = [
    ['Time', formatClock(report.seconds), c && change(c.seconds, signed(c.seconds, formatClock))],
    ...(activity.hasDistance ? [
      [`Distance (${unit})`, report.distance ?? '–', c?.distance != null ? change(c.distance, `${signed(c.distance, (v) => v)}`) : null],
      [`Pace (/${unit})`, report.pace ? formatPace(report.pace) : '–', c?.pace != null ? change(-c.pace, `${Math.abs(Math.round(c.pace))}s ${c.pace < 0 ? 'faster' : 'slower'}`) : null],
    ] : []),
    ['Calories', `~${report.calories.toLocaleString()}`, c && change(c.calories, signed(c.calories, (v) => `${Math.round(v)}`))],
  ];
  const COLORS = { easy: '#34d399', moderate: '#fbbf24', hard: ROSE };
  const steps = cardioSteps({ activity: finished.activity, segments: finished.segments });
  return (
    <Card>
      <View style={{ alignItems: 'center' }}>
        <HeartPulse size={30} color={ROSE} />
        <Text style={styles.title}>{finished.name} done!</Text>
        <Hint style={{ textAlign: 'center' }}>{previous ? `Compared with your last ${finished.name.toLowerCase()}, ${format(new Date(previous.date), 'MMM d')}` : 'Your first one to compare against next time.'}</Hint>
      </View>
      <View style={styles.tiles}>
        {tiles.map(([label, value, ch]) => (
          <View key={label} style={styles.tile}>
            <Text style={styles.tileLabel}>{label}</Text>
            <Text style={styles.tileValue}>{value}{ch}</Text>
          </View>
        ))}
      </View>
      {report.byIntensity.length ? (
        <View style={{ marginTop: 12 }}>
          <View style={styles.bar}>{report.byIntensity.map((x) => <View key={x.intensity} style={{ flex: x.pct || 1, backgroundColor: COLORS[x.intensity] }} />)}</View>
          <View style={[styles.wrap, { marginTop: 6 }]}>
            {report.byIntensity.map((x) => <Text key={x.intensity} style={styles.muted}>{x.label} {formatClock(x.seconds)} ({x.pct}%)</Text>)}
          </View>
        </View>
      ) : null}
      {activity.hasDistance ? (
        <>
          <Label style={{ marginTop: 12 }}>Distance ({unit})</Label>
          <TextInput style={styles.input} keyboardType="decimal-pad" placeholder="optional" placeholderTextColor={colors.textMuted} value={distance} onChangeText={setDistance} />
        </>
      ) : null}
      <Label style={{ marginTop: 12 }}>Notes</Label>
      <TextInput style={styles.input} maxLength={300} placeholder="Optional" placeholderTextColor={colors.textMuted} value={notes} onChangeText={setNotes} />
      {steps > 0 ? <Hint style={{ marginTop: 8 }}>{STEP_OVERLAP_NOTE(steps)}</Hint> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={[styles.row, { marginTop: 14, gap: 10 }]}>
        <Button title="Discard" variant="secondary" onPress={onDiscard} style={{ paddingHorizontal: 16 }} />
        <Button title={saving ? 'Saving…' : 'Save session'} loading={saving} disabled={saving} style={{ flex: 1 }}
          onPress={() => onSave({ distanceKm: distance === '' ? null : toKm(num(distance), unit), notes })} />
      </View>
    </Card>
  );
}

export default function LogCardioScreen() {
  const { user } = useAuth();
  const unit = distanceUnit(user);
  const kg = user?.weight;
  const [stored, setStored] = useState(null); // null while loading
  const [list, setList] = useState(null);
  const [mine, setMine] = useState([]);
  const [pick, setPick] = useState({ activity: 'running', customActivity: null, name: 'Running' });
  const [startIntensity, setStartIntensity] = useState('moderate');
  const [past, setPast] = useState({ intensity: 'moderate', minutes: '', distance: '', daysAgo: '0', notes: '' });
  const [pastOpen, setPastOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  useEffect(() => {
    AsyncStorage.getItem(STORE).then((v) => setStored(v ? JSON.parse(v) : {})).catch(() => setStored({}));
    cardioAPI.getAll().then(({ data }) => setList(data)).catch(() => setList([]));
    cardioAPI.activities().then(({ data }) => setMine(data)).catch(() => {});
  }, []);
  const save = useCallback((v) => {
    setStored(v || {});
    (v ? AsyncStorage.setItem(STORE, JSON.stringify(v)) : AsyncStorage.removeItem(STORE)).catch(() => {});
  }, []);
  const which = (p) => (p.customActivity ? { customActivity: p.customActivity } : { activity: p.activity });

  const create = async (body, name) => {
    setSaving(true);
    setError('');
    try {
      const { data } = await cardioAPI.create(body);
      setList((l) => [data, ...(l || [])].sort((a, b) => new Date(b.date) - new Date(a.date)));
      setSaved(`${name} saved. About ${data.calories.toLocaleString()} kcal burned.`);
      return true;
    } catch (err) {
      setError(err.response?.data?.errors?.[0]?.message || err.response?.data?.message || 'Could not save that');
      return false;
    } finally {
      setSaving(false);
    }
  };

  if (stored === null) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  const wrapper = (child) => (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">{child}</ScrollView>
    </KeyboardAvoidingView>
  );

  if (stored.finished) {
    const f = stored.finished;
    return wrapper(
      <CardioReport finished={f} previous={previousSession(list || [], f)} kg={kg} unit={unit} saving={saving} error={error}
        onDiscard={async () => { if (await confirm('Discard this session?', '', 'Discard', true)) save(null); }}
        onSave={async ({ distanceKm, notes }) => {
          const ok = await create({ ...which(f), segments: f.segments, date: new Date(f.startedAt).toISOString(), notes: notes.trim(),
            ...(distanceKm != null && activityOf(f.activity).hasDistance && { distanceKm: Math.round(distanceKm * 1000) / 1000 }) }, f.name);
          if (ok) save(null);
        }} />,
    );
  }
  if (stored.live) {
    return wrapper(
      <LiveCardio live={stored.live} setLive={(live) => save({ live })} kg={kg}
        onCancel={async () => { if (await confirm('Cancel this session?', 'Nothing is saved.', 'Cancel session', true)) save(null); }}
        onFinish={(segments) => save({ finished: { ...stored.live, segments } })} />,
    );
  }

  const minutes = num(past.minutes) || 0;
  const estimate = minutes > 0 ? cardioCalories({ activity: pick.activity, intensity: past.intensity, minutes }, kg) : 0;
  const savePast = async () => {
    if (!(minutes >= 1 && minutes <= 600)) { setError('Enter how many minutes (1 to 600).'); return; }
    const date = new Date();
    if (past.daysAgo !== '0') { date.setDate(date.getDate() - Number(past.daysAgo)); date.setHours(12, 0, 0, 0); }
    const ok = await create({
      ...which(pick), intensity: past.intensity, minutes: Math.round(minutes), date: date.toISOString(), notes: past.notes.trim(),
      ...(activityOf(pick.activity).hasDistance && past.distance !== '' && { distanceKm: Math.round(toKm(num(past.distance), unit) * 1000) / 1000 }),
    }, pick.name);
    if (ok) setPast((p) => ({ ...p, minutes: '', distance: '', notes: '' }));
  };
  const remove = async (id) => {
    if (!(await confirm('Delete this cardio session?', '', 'Delete', true))) return;
    try { await cardioAPI.delete(id); setList((l) => l.filter((s) => s._id !== id)); } catch { setError('Could not delete that'); }
  };
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const thisWeek = (list || []).filter((s) => new Date(s.date) >= weekStart);

  return wrapper(
    <>
      <Card>
        <ActivityPicker value={pick} onChange={(v) => { setPick(v); setError(''); setSaved(''); }} mine={mine} setMine={setMine} />
        <Label style={{ marginTop: 14 }}>Start at</Label>
        <Segmented value={startIntensity} onChange={setStartIntensity} options={INTENSITIES.map(([k, l]) => [k, l])} />
        <Button icon={Play} title={`Start ${pick.name.toLowerCase()}`} style={{ marginTop: 12 }}
          onPress={() => { setSaved(''); save({ live: startLive({ ...pick, intensity: startIntensity }) }); }} />
        {saved ? <View style={[styles.row, { marginTop: 8 }]}><Check size={15} color={colors.success} /><Text style={[styles.text, { color: colors.success, flex: 1 }]}>{saved}</Text></View> : null}

        <TouchableOpacity onPress={() => setPastOpen(!pastOpen)} style={styles.pastToggle}>
          <Text style={styles.text}>Log one you've already done</Text><Text style={styles.muted}>{pastOpen ? '▴' : '▾'}</Text>
        </TouchableOpacity>
        {pastOpen ? (
          <>
            <View style={[styles.row, { gap: 10 }]}>
              <View style={{ flex: 1 }}>
                <Label>Minutes</Label>
                <TextInput style={styles.input} keyboardType="number-pad" placeholder="e.g. 30" placeholderTextColor={colors.textMuted} value={past.minutes} onChangeText={(v) => setPast({ ...past, minutes: v })} />
              </View>
              {activityOf(pick.activity).hasDistance ? (
                <View style={{ flex: 1 }}>
                  <Label>Distance ({unit})</Label>
                  <TextInput style={styles.input} keyboardType="decimal-pad" placeholder="optional" placeholderTextColor={colors.textMuted} value={past.distance} onChangeText={(v) => setPast({ ...past, distance: v })} />
                </View>
              ) : null}
            </View>
            <Label style={{ marginTop: 10 }}>Intensity</Label>
            <Segmented value={past.intensity} onChange={(v) => setPast({ ...past, intensity: v })} options={INTENSITIES.map(([k, l]) => [k, l])} />
            <Label style={{ marginTop: 10 }}>When</Label>
            <Segmented value={past.daysAgo} onChange={(v) => setPast({ ...past, daysAgo: v })} options={[['0', 'Today'], ['1', 'Yesterday'], ['2', '2 days ago']]} />
            <Label style={{ marginTop: 10 }}>Notes</Label>
            <TextInput style={styles.input} maxLength={300} placeholder="Optional" placeholderTextColor={colors.textMuted} value={past.notes} onChangeText={(v) => setPast({ ...past, notes: v })} />
            <View style={[styles.row, { marginTop: 12 }]}>
              <Flame size={15} color={colors.warning} />
              <Text style={[styles.text, { flex: 1 }]}>{estimate ? `About ${estimate.toLocaleString()} kcal` : 'Enter the minutes to see the calories'}</Text>
            </View>
            {estimate > 0 && cardioSteps({ activity: pick.activity, intensity: past.intensity, minutes }) > 0
              ? <Hint style={{ marginTop: 4 }}>{STEP_OVERLAP_NOTE(cardioSteps({ activity: pick.activity, intensity: past.intensity, minutes }))}</Hint> : null}
            <Button title={saving ? 'Saving…' : 'Save'} loading={saving} disabled={saving} variant="secondary" style={{ marginTop: 10 }} onPress={savePast} />
          </>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Card>

      <Card>
        <View style={[styles.row, { justifyContent: 'space-between', marginBottom: 6 }]}>
          <Text style={styles.cardTitle}>Recent cardio</Text>
          {thisWeek.length ? <Text style={styles.muted}>This week: {thisWeek.reduce((n, s) => n + s.minutes, 0)} min · ~{thisWeek.reduce((n, s) => n + s.calories, 0).toLocaleString()} kcal</Text> : null}
        </View>
        {list === null ? <Hint>Loading…</Hint> : list.length === 0 ? <Hint>No cardio in the last 60 days.</Hint> : list.map((s) => {
          const pace = paceText(s.seconds ? s.seconds / 60 : s.minutes, s.distanceKm, unit);
          return (
            <View key={s._id} style={styles.item}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{nameOf(s)} <Text style={styles.muted}>· {s.segments?.length > 1 ? 'mixed' : s.intensity}</Text></Text>
                <Text style={styles.muted}>
                  {format(new Date(s.date), 'EEE, MMM d · HH:mm')} · {s.seconds ? formatClock(s.seconds) : `${s.minutes} min`}{s.distanceKm ? ` · ${fromKm(s.distanceKm, unit)} ${unit}` : ''}{pace ? ` · ${pace}` : ''} · ~{s.calories.toLocaleString()} kcal
                </Text>
                {s.notes ? <Text style={styles.muted} numberOfLines={1}>{s.notes}</Text> : null}
              </View>
              <TouchableOpacity onPress={() => remove(s._id)} hitSlop={8}><Trash2 size={16} color={colors.textMuted} /></TouchableOpacity>
            </View>
          );
        })}
        <Hint style={{ marginTop: 8 }}>Calories are estimated from the activity, intensity, time and your weight.</Hint>
      </Card>
    </>,
  );
}

const styles = makeStyles(() => ({
  wrap:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  row:       { flexDirection: 'row', alignItems: 'center', gap: 6 },
  group:     { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5, marginTop: 12 },
  link:      { fontSize: 13, fontWeight: '600' },
  input:     { height: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, fontSize: 15, color: colors.textPrimary, backgroundColor: colors.surface },
  text:      { fontSize: 14, color: colors.textPrimary },
  muted:     { fontSize: 12, color: colors.textSecondary },
  error:     { fontSize: 13, color: colors.danger, marginTop: 6 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  name:      { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  item:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.subtle },
  pastToggle:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.subtle, marginBottom: 8 },
  liveName:  { fontSize: 13, fontWeight: '700', color: ROSE, letterSpacing: 1 },
  clock:     { fontSize: 60, fontWeight: '700', color: colors.textPrimary, fontVariant: ['tabular-nums'], marginVertical: 6 },
  title:     { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginTop: 4 },
  tiles:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  tile:      { width: '48%', backgroundColor: colors.subtle, borderRadius: 12, padding: 10 },
  tileLabel: { fontSize: 11, color: colors.textSecondary },
  tileValue: { fontSize: 19, fontWeight: '700', color: colors.textPrimary, marginTop: 2 },
  change:    { fontSize: 12, fontWeight: '700' },
  bar:       { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden' },
}));
