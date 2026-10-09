/**
 * Phone notifications for workout days (the active plan's days; turned on when
 * a plan is set active) and supplements (turned on on the Supplements page). Scheduled as one-off notifications for the next week
 * and re-planned whenever the app opens or something relevant changes, so
 * today's are skipped once you've trained or ticked off every supplement.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { reminderAPI } from '../api';
import { remindersOf, todayParams, parseTime } from '../../../client-web/src/utils/reminders';

const KIND = 'fittrack-reminder';
const DAYS_AHEAD = 7;
const CHANNEL = 'reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

/** Asks for permission to notify, if not already given. Returns whether it's allowed. */
export async function askPermission() {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

let running = null;
let again = false;

/** Re-plans the reminders from the server's view of today. Safe to call often. */
export function syncReminders() {
  if (running) { again = true; return running; }
  running = plan().catch(() => {}).finally(() => {
    running = null;
    if (again) { again = false; syncReminders(); }
  });
  return running;
}

async function plan() {
  const { data: status } = await reminderAPI.today(todayParams());
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(scheduled.filter((n) => n.content.data?.kind === KIND)
    .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));

  const r = remindersOf(status);
  if (!r.workout.enabled && !r.supplements.enabled) return;
  if (!(await Notifications.getPermissionsAsync()).granted) return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, { name: 'Reminders', importance: Notifications.AndroidImportance.DEFAULT });
  }

  const now = new Date();
  const at = (offset, time) => {
    const { hour, minute } = parseTime(time);
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    d.setHours(hour, minute, 0, 0);
    return d;
  };
  const schedule = (date, title, body, screen) => (date > now ? Notifications.scheduleNotificationAsync({
    content: { title, body, data: { kind: KIND, screen } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, ...(Platform.OS === 'android' && { channelId: CHANNEL }) },
  }) : null);

  const { total, taken } = status.supplements;
  const jobs = [];
  for (let i = 0; i < DAYS_AHEAD; i++) {
    if (r.workout.enabled && status.workoutOffsets.includes(i) && !(i === 0 && status.workedOut)) {
      jobs.push(schedule(at(i, r.workout.time), 'Workout day', "Today's a training day. Open FitTrack to start your session.", 'Train'));
    }
    // No supplements on today's list means no stack either, so nothing to remind about.
    if (r.supplements.enabled && total > 0 && !(i === 0 && taken >= total)) {
      jobs.push(schedule(at(i, r.supplements.time), 'Supplements',
        i === 0 ? `${total - taken} supplement${total - taken === 1 ? '' : 's'} left to tick off today.` : "Don't forget to tick off today's supplements.",
        'Supplements'));
    }
  }
  await Promise.all(jobs);
}

/** Calls `open(screen)` when a reminder is tapped (also when it opened the app). Returns an unsubscribe. */
export function onReminderTap(open) {
  const handle = (response) => {
    const data = response?.notification?.request?.content?.data;
    if (data?.kind === KIND) open(data.screen);
  };
  Notifications.getLastNotificationResponseAsync().then(handle).catch(() => {});
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();
}
