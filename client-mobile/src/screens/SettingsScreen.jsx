import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, Switch, TouchableOpacity } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { userAPI, authAPI } from '../api';
import { Card, Button, Label, colors, makeStyles, Hint, ErrorText, confirm, Segmented, Sheet, Chip } from '../components';
import { Lock, MessageCircle, KeyRound, LogOut, Moon, Salad, Bell, Clock } from 'lucide-react-native';
import { WEEK, remindersOf, formatTime, parseTime } from '../../../client-web/src/utils/reminders';
import { askPermission, syncReminders } from '../utils/notifications';

const MESSAGE_OPTIONS = [
  ['connections', 'People I follow or who follow me'],
  ['following', 'Only people I follow'],
  ['nobody', 'No one'],
];

function SectionHead({ icon: Icon, children }) {
  return (
    <View style={styles.sectionRow}>
      <Icon size={15} color={colors.brand} />
      <Text style={styles.section}>{children}</Text>
    </View>
  );
}

function Row({ title, hint, children, last }) {
  return (
    <View style={[styles.row, last && { borderBottomWidth: 0 }]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {hint ? <Hint style={{ marginTop: 2 }}>{hint}</Hint> : null}
      </View>
      {children}
    </View>
  );
}

// Same rule as sign-up (server/routes/auth.routes.js).
const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&#]+$/;

function ChangePassword() {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { ok, text }
  const set = (k) => (v) => { setForm((f) => ({ ...f, [k]: v })); setMessage(null); };

  const submit = async () => {
    if (form.next.length < 8 || !PASSWORD_RULE.test(form.next)) {
      setMessage({ ok: false, text: 'Use at least 8 characters with an uppercase letter, a lowercase letter, a number and a symbol (@$!%*?&).' });
      return;
    }
    if (form.next !== form.confirm) { setMessage({ ok: false, text: "The new passwords don't match." }); return; }
    setBusy(true);
    try {
      await authAPI.changePassword(form.current, form.next);
      setForm({ current: '', next: '', confirm: '' });
      setMessage({ ok: true, text: 'Password changed.' });
    } catch (err) {
      setMessage({ ok: false, text: err.response?.data?.message || 'Could not change your password' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ paddingVertical: 10 }}>
      {[['current', 'Current password', 'current-password'], ['next', 'New password', 'new-password'], ['confirm', 'Confirm new password', 'new-password']].map(([k, label, auto]) => (
        <View key={k} style={{ marginBottom: 8 }}>
          <Label>{label}</Label>
          <TextInput style={styles.input} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete={auto}
            textContentType={k === 'current' ? 'password' : 'newPassword'} value={form[k]} onChangeText={set(k)} />
        </View>
      ))}
      {message ? <Text style={[styles.message, { color: message.ok ? colors.success : colors.danger }]}>{message.text}</Text> : null}
      <Button title={busy ? 'Changing…' : 'Change password'} loading={busy} disabled={busy || !form.current || !form.next || !form.confirm} onPress={submit} />
    </View>
  );
}

const pad = (n) => String(n).padStart(2, '0');

/** Pick a time of day: the hour, then the minutes in 5-minute steps. */
function TimeSheet({ visible, value, onPick, onClose, title }) {
  const [hm, setHm] = useState(parseTime(value));
  const [openedFor, setOpenedFor] = useState(null);
  if (visible && openedFor !== value) { setOpenedFor(value); setHm(parseTime(value)); }
  if (!visible && openedFor !== null) setOpenedFor(null);
  const time = `${pad(hm.hour)}:${pad(hm.minute)}`;
  return (
    <Sheet visible={visible} title={title} subtitle={formatTime(time)} onClose={onClose}
      footer={<Button title="Save" onPress={() => onPick(time)} />}>
      <Label>Hour</Label>
      <View style={styles.grid}>
        {Array.from({ length: 24 }, (_, h) => (
          <Chip key={h} small label={pad(h)} active={hm.hour === h} onPress={() => setHm((t) => ({ ...t, hour: h }))} style={styles.gridChip} />
        ))}
      </View>
      <Label style={{ marginTop: 12 }}>Minutes</Label>
      <View style={styles.grid}>
        {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
          <Chip key={m} small label={`:${pad(m)}`} active={hm.minute === m} onPress={() => setHm((t) => ({ ...t, minute: m }))} style={styles.gridChip} />
        ))}
      </View>
    </Sheet>
  );
}

/** Settings: appearance; privacy (private account, who can message you, search); password; sign out. */
export default function SettingsScreen() {
  const { user, updateUser, logout } = useAuth();
  const { preference, setPreference } = useTheme();
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');

  const privacy = { privateAccount: false, messages: 'connections', discoverable: true, ...(user?.privacy || {}) };
  const reminders = remindersOf(user);
  const workoutDays = user?.workoutDays || [];
  const [timeFor, setTimeFor] = useState(null); // 'workout' | 'supplements' while picking a time
  const [notice, setNotice] = useState('');


  // Saves one setting; the server sends the updated user back.
  const save = async (key, body) => {
    setBusy(key);
    setError('');
    try {
      const { data } = await userAPI.updateMe(body);
      updateUser(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save that setting');
    } finally {
      setBusy(null);
    }
  };


  // Reminder settings, then the phone's notifications are re-planned.
  const saveReminder = async (key, body) => { await save(key, body); syncReminders(); };
  const setReminderOn = async (kind, on) => {
    setNotice('');
    if (on && !(await askPermission())) {
      setNotice("FitTrack isn't allowed to send notifications. Turn them on for FitTrack in your phone's Settings, then come back.");
    }
    saveReminder(kind, { reminders: { [kind]: { enabled: on } } });
  };
  const toggleDay = (d) => saveReminder('workoutDays', {
    workoutDays: workoutDays.includes(d) ? workoutDays.filter((x) => x !== d) : [...workoutDays, d],
  });

  const toggle = (key, value, body) => (
    <Switch value={value} disabled={busy === key} onValueChange={(v) => save(key, body(v))} trackColor={{ true: colors.brand }} />
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <ErrorText>{error}</ErrorText>

      <SectionHead icon={Moon}>Appearance</SectionHead>
      <Card>
        <Segmented value={preference} onChange={setPreference}
          options={[['system', 'System'], ['light', 'Light'], ['dark', 'Dark']]} />
        <Hint style={{ marginTop: 8 }}>System follows your phone's light or dark mode.</Hint>
      </Card>

      <SectionHead icon={Lock}>Account privacy</SectionHead>
      <Card style={{ paddingVertical: 4 }}>
        <Row title="Private account" hint="New followers need your approval (in Community → People). Only your followers see your posts, follower lists and public stats.">
          {toggle('privateAccount', privacy.privateAccount, (v) => ({ privacy: { privateAccount: v } }))}
        </Row>
        <Row title="Show me in search and suggestions" hint="When off, people can only find you through someone who follows you." last>
          {toggle('discoverable', privacy.discoverable, (v) => ({ privacy: { discoverable: v } }))}
        </Row>
      </Card>

      <SectionHead icon={Bell}>Reminders</SectionHead>
      <Card style={{ paddingVertical: 4 }}>
        <View style={[styles.row, { flexDirection: 'column', alignItems: 'stretch' }]}>
          <Text style={styles.rowTitle}>My workout days</Text>
          <View style={[styles.grid, { marginTop: 8 }]}>
            {WEEK.map(([d, label]) => (
              <Chip key={d} small label={label} active={workoutDays.includes(d)} disabled={busy === 'workoutDays'} onPress={() => toggleDay(d)} style={{ minWidth: 42 }} />
            ))}
          </View>
        </View>
        <Row title="Remind me on workout days" hint={workoutDays.length ? 'Skipped once you\'ve logged a workout that day.' : 'Pick your workout days above.'}>
          <Switch value={reminders.workout.enabled} disabled={busy === 'workout'} onValueChange={(v) => setReminderOn('workout', v)} trackColor={{ true: colors.brand }} />
        </Row>
        {reminders.workout.enabled ? (
          <TouchableOpacity onPress={() => setTimeFor('workout')} style={styles.row}>
            <Clock size={15} color={colors.textMuted} />
            <Text style={[styles.rowTitle, { flex: 1 }]}>Workout reminder time</Text>
            <Text style={styles.timeText}>{formatTime(reminders.workout.time)}</Text>
          </TouchableOpacity>
        ) : null}
        <Row title="Remind me to tick off supplements" hint="Skipped once everything's ticked off for the day." last={!reminders.supplements.enabled}>
          <Switch value={reminders.supplements.enabled} disabled={busy === 'supplements'} onValueChange={(v) => setReminderOn('supplements', v)} trackColor={{ true: colors.brand }} />
        </Row>
        {reminders.supplements.enabled ? (
          <TouchableOpacity onPress={() => setTimeFor('supplements')} style={[styles.row, { borderBottomWidth: 0 }]}>
            <Clock size={15} color={colors.textMuted} />
            <Text style={[styles.rowTitle, { flex: 1 }]}>Supplement reminder time</Text>
            <Text style={styles.timeText}>{formatTime(reminders.supplements.time)}</Text>
          </TouchableOpacity>
        ) : null}
      </Card>
      {notice ? <Text style={[styles.message, { color: colors.danger, marginTop: -4 }]}>{notice}</Text> : null}
      <TimeSheet visible={timeFor !== null} value={timeFor ? reminders[timeFor].time : '08:00'}
        title={timeFor === 'workout' ? 'Workout reminder' : 'Supplement reminder'} onClose={() => setTimeFor(null)}
        onPick={(time) => { const kind = timeFor; setTimeFor(null); saveReminder(kind, { reminders: { [kind]: { time } } }); }} />

      <SectionHead icon={Salad}>Nutrition</SectionHead>
      <Card style={{ paddingVertical: 4 }}>
        <Row title="Adjust my calorie goal from my weight trend" last
          hint="Compares what you ate with how your weight moved over the last 2 weeks and corrects your maintenance. Needs food logged on 10 of 14 days and a couple of weigh-ins each week.">
          {toggle('adaptiveCalories', user?.adaptiveCalories !== false, (v) => ({ adaptiveCalories: v }))}
        </Row>
      </Card>

      <SectionHead icon={MessageCircle}>Who can message you</SectionHead>
      <Card style={{ paddingVertical: 4 }}>
        {MESSAGE_OPTIONS.map(([value, label], i) => (
          <TouchableOpacity key={value} disabled={busy === 'messages'} onPress={() => save('messages', { privacy: { messages: value } })}
            style={[styles.row, i === MESSAGE_OPTIONS.length - 1 && { borderBottomWidth: 0 }]}>
            <Text style={[styles.rowTitle, { flex: 1 }]}>{label}</Text>
            <View style={[styles.radio, privacy.messages === value && styles.radioOn]}>
              {privacy.messages === value ? <View style={styles.radioDot} /> : null}
            </View>
          </TouchableOpacity>
        ))}
      </Card>
      <Hint style={{ marginTop: -4, marginBottom: 8 }}>Applies to new chats and to sending in existing ones.</Hint>

      <SectionHead icon={KeyRound}>Password</SectionHead>
      <Card>
        <ChangePassword />
      </Card>

      <Card style={styles.signOutCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>Signed in as {user?.name}</Text>
          {user?.email ? <Hint>{user.email}</Hint> : null}
        </View>
        <Button icon={LogOut} title="Sign out" variant="danger" style={{ paddingHorizontal: 16 }}
          onPress={async () => { if (await confirm('Sign out?', '', 'Sign out', true)) logout(); }} />
      </Card>

      <Hint style={{ textAlign: 'center', marginTop: 4 }}>Your height, weight, body fat, sex and activity level are never shown to others.</Hint>
    </ScrollView>
  );
}

const styles = makeStyles(() => ({
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, marginBottom: 6 },
  section:  { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  row:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.subtle },
  rowTitle: { fontSize: 14, fontWeight: '500', color: colors.textPrimary, flexShrink: 1 },
  person:   { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  smallBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  smallBtnPrimary: { backgroundColor: colors.brand, borderColor: colors.brand },
  smallBtnText: { fontSize: 12, fontWeight: '600', color: colors.textPrimary },
  radio:    { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioOn:  { borderColor: colors.brand },
  input:    { minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, fontSize: 15, color: colors.textPrimary, backgroundColor: colors.surface },
  message:  { fontSize: 13, marginBottom: 10 },
  signOutCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand },
  grid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  gridChip: { minWidth: 46 },
  timeText: { fontSize: 14, fontWeight: '600', color: colors.brand },
}));
