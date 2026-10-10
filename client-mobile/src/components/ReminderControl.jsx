/**
 * A reminder's on/off switch and time, saved to the user (reminders.workout /
 * reminders.supplements) and re-planned as phone notifications. Used on the
 * active plan and the Supplements page.
 */
import React, { useState } from 'react';
import { View, TouchableOpacity, Switch } from 'react-native';
import { Text } from './AppText';
import { Bell, Clock } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { userAPI } from '../api';
import { colors, makeStyles } from './tokens';
import { Sheet, Chip, Label } from './ui';
import { Button } from './index';
import { remindersOf, formatTime, parseTime } from '../../../client-web/src/utils/reminders';
import { askPermission, syncReminders } from '../utils/notifications';

const pad = (n) => String(n).padStart(2, '0');

/** Pick a time of day: the hour, then the minutes in 5-minute steps. */
export function TimeSheet({ visible, value, onPick, onClose, title }) {
  const [hm, setHm] = useState(() => parseTime(value));
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

/** Saves a reminder setting and re-plans the notifications. Returns a message to show, or ''. */
export async function saveReminder(updateUser, kind, change) {
  let notice = '';
  if (change.enabled && !(await askPermission())) {
    notice = "FitTrack isn't allowed to send notifications. Turn them on for FitTrack in your phone's Settings.";
  }
  const { data } = await userAPI.updateMe({ reminders: { [kind]: change } });
  updateUser(data);
  syncReminders();
  return notice;
}

/** Switch + time for one reminder. */
export default function ReminderControl({ kind, title, hint }) {
  const { user, updateUser } = useAuth();
  const r = remindersOf(user)[kind];
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(0); // > 0 while the time sheet is open (remounts it each time)
  const [notice, setNotice] = useState('');
  const change = async (c) => {
    setBusy(true);
    try { setNotice(await saveReminder(updateUser, kind, c)); } catch { setNotice('Could not save the reminder'); } finally { setBusy(false); }
  };
  return (
    <View>
      <View style={styles.row}>
        <Bell size={15} color={r.enabled ? colors.brand : colors.textMuted} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        </View>
        {r.enabled ? (
          <TouchableOpacity onPress={() => setPicking((n) => n + 1)} style={styles.time} hitSlop={6}>
            <Clock size={13} color={colors.brand} /><Text style={styles.timeText}>{formatTime(r.time)}</Text>
          </TouchableOpacity>
        ) : null}
        <Switch value={r.enabled} disabled={busy} onValueChange={(v) => change({ enabled: v })} trackColor={{ true: colors.brand }} />
      </View>
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {picking > 0 ? (
        <TimeSheet key={picking} visible title={title} value={r.time} onClose={() => setPicking(0)}
          onPick={(time) => { setPicking(0); change({ time }); }} />
      ) : null}
    </View>
  );
}

const styles = makeStyles(() => ({
  row:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title:    { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  hint:     { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  time:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeText: { fontSize: 14, fontWeight: '600', color: colors.brand },
  notice:   { fontSize: 12, color: colors.danger, marginTop: 6 },
  grid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  gridChip: { minWidth: 46 },
}));
