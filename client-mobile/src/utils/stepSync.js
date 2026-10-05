/**
 * Steps from the phone: its own motion sensor (pedometer) and its health app
 * (Apple Health on iOS, Health Connect on Android), synced to the server.
 *
 * Sources, best first:
 *   health  — Apple Health / Health Connect: every day, from the phone, a watch
 *             and other apps. Needs a development build (native code), so it's
 *             unavailable in Expo Go.
 *   phone   — the motion sensor. On iOS it has the last 7 days; on Android it
 *             can only count while the app is open (see useLiveSteps).
 *
 * The first sync after connecting a health app imports its whole history;
 * later ones re-read the last couple of weeks (a watch can sync late).
 * Syncing only ever raises a day's count on the server, so a higher number
 * typed in by hand (or from another device) is never lowered.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pedometer } from 'expo-sensors';
import { stepsAPI } from '../api';

const SETTINGS_KEY = 'fittrack.stepSync';
const RECENT_DAYS = 14;        // what a routine sync re-reads
const PHONE_HISTORY_DAYS = 7;  // iOS keeps motion data for about a week (an Apple limit)
// Earliest day a full import looks at (Apple Health arrived in 2014, Health Connect later).
const HISTORY_START = new Date(2014, 0, 1);
const UPLOAD_BATCH = 365;      // the server takes up to 400 days per request

export const isExpoGo = Constants.executionEnvironment === 'storeClient';

const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const daysAgo = (n) => { const d = startOfDay(new Date()); d.setDate(d.getDate() - n); return d; };

// ── Settings ─────────────────────────────────────────────────────────────────
export async function loadSyncSettings() {
  try { return { healthEnabled: false, lastSync: null, ...JSON.parse((await AsyncStorage.getItem(SETTINGS_KEY)) || '{}') }; }
  catch { return { healthEnabled: false, lastSync: null }; }
}
async function saveSyncSettings(patch) {
  const next = { ...(await loadSyncSettings()), ...patch };
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next)).catch(() => {});
  return next;
}

// ── Health app ───────────────────────────────────────────────────────────────
// Native modules are required lazily: in Expo Go they don't exist and
// importing them at the top would crash the app.
function healthKit() {
  if (Platform.OS !== 'ios' || isExpoGo) return null;
  try { return require('@kingstinct/react-native-healthkit'); } catch { return null; }
}
function healthConnect() {
  if (Platform.OS !== 'android' || isExpoGo) return null;
  try { return require('react-native-health-connect'); } catch { return null; }
}

/** The health app on this phone: { name, available, reason? }. */
export async function healthAppInfo() {
  const name = Platform.OS === 'ios' ? 'Apple Health' : 'Health Connect';
  if (isExpoGo) return { name, available: false, reason: `${name} sync needs the development build of the app — it isn't available in Expo Go.` };
  if (Platform.OS === 'ios') {
    const hk = healthKit();
    if (!hk) return { name, available: false, reason: 'Apple Health isn’t included in this build.' };
    const ok = await hk.isHealthDataAvailableAsync().catch(() => false);
    return ok ? { name, available: true } : { name, available: false, reason: 'Apple Health isn’t available on this device.' };
  }
  const hc = healthConnect();
  if (!hc) return { name, available: false, reason: 'Health Connect isn’t included in this build.' };
  const status = await hc.getSdkStatus().catch(() => 1);
  if (status === hc.SdkAvailabilityStatus.SDK_AVAILABLE) return { name, available: true };
  return {
    name, available: false,
    reason: status === hc.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED
      ? 'Health Connect needs an update from the Play Store.'
      : 'Health Connect isn’t installed. Install it from the Play Store, then try again.',
  };
}

/** Ask for permission to read steps. Resolves true when sync can go ahead. */
export async function connectHealthApp() {
  if (Platform.OS === 'ios') {
    const hk = healthKit();
    if (!hk) return false;
    // iOS never says whether reading was refused; a refused app just sees no data.
    await hk.requestAuthorization({ toRead: ['HKQuantityTypeIdentifierStepCount'] });
  } else {
    const hc = healthConnect();
    if (!hc) return false;
    await hc.initialize();
    // Without the history permission, Health Connect only shares the 30 days
    // before access was granted.
    const granted = await hc.requestPermission([
      { accessType: 'read', recordType: 'Steps' },
      { accessType: 'read', recordType: 'ReadHealthDataHistory' },
    ]);
    if (!granted.some((p) => p.recordType === 'Steps')) return false;
  }
  // historyImported false → the next sync imports everything.
  await saveSyncSettings({ healthEnabled: true, historyImported: false });
  return true;
}

export async function disconnectHealthApp() {
  await saveSyncSettings({ healthEnabled: false, historyImported: false });
}

/** Daily totals from the health app between two dates, a year at a time: [{ date: 'yyyy-MM-dd', steps }]. */
async function readHealthRange(from, to) {
  const out = [];
  for (let start = startOfDay(from); start < to;) {
    const end = new Date(start);
    end.setFullYear(end.getFullYear() + 1);
    const chunkEnd = end < to ? end : to;
    // A year that can't be read (e.g. older than the health app allows) is skipped.
    out.push(...await readHealthChunk(start, chunkEnd).catch(() => []));
    start = end;
  }
  return out;
}

async function readHealthChunk(from, now) {
  if (Platform.OS === 'ios') {
    const hk = healthKit();
    const buckets = await hk.queryStatisticsCollectionForQuantity(
      'HKQuantityTypeIdentifierStepCount', ['cumulativeSum'], from, { day: 1 },
      { filter: { date: { startDate: from, endDate: now } }, unit: 'count' },
    );
    return buckets
      .filter((b) => b.startDate && b.sumQuantity?.quantity > 0)
      .map((b) => ({ date: dayKey(new Date(b.startDate)), steps: Math.round(b.sumQuantity.quantity) }));
  }
  const hc = healthConnect();
  await hc.initialize();
  const groups = await hc.aggregateGroupByPeriod({
    recordType: 'Steps',
    timeRangeFilter: { operator: 'between', startTime: from.toISOString(), endTime: now.toISOString() },
    timeRangeSlicer: { period: 'DAYS', length: 1 },
  });
  return groups
    .filter((g) => g.result?.COUNT_TOTAL > 0)
    .map((g) => ({ date: dayKey(new Date(g.startTime)), steps: Math.round(g.result.COUNT_TOTAL) }));
}

// ── Phone sensor ─────────────────────────────────────────────────────────────
export async function pedometerAvailable() {
  try { return await Pedometer.isAvailableAsync(); } catch { return false; }
}

/** iOS only: daily totals from the motion sensor for the last week. */
async function readPhoneDays(days) {
  if (Platform.OS !== 'ios') return [];
  const perm = await Pedometer.requestPermissionsAsync().catch(() => ({ granted: false }));
  if (!perm.granted) return [];
  const out = [];
  for (let i = Math.min(days, PHONE_HISTORY_DAYS) - 1; i >= 0; i--) {
    const start = daysAgo(i);
    const end = i === 0 ? new Date() : daysAgo(i - 1);
    const { steps } = await Pedometer.getStepCountAsync(start, end).catch(() => ({ steps: 0 }));
    if (steps > 0) out.push({ date: dayKey(start), steps });
  }
  return out;
}

/** Save days to the server in batches it accepts. */
async function upload(list) {
  for (let i = 0; i < list.length; i += UPLOAD_BATCH) await stepsAPI.sync(list.slice(i, i + UPLOAD_BATCH));
}

/**
 * Read steps from the best source and save them. With a health app, the first
 * sync (or `full: true`) imports its whole history; otherwise the last `days`.
 * Returns { source: 'health' | 'phone' | null, days: number, full: boolean }.
 */
export async function syncSteps({ days = RECENT_DAYS, full = false } = {}) {
  const settings = await loadSyncSettings();
  let source = null;
  let list = [];
  let imported = false;
  if (settings.healthEnabled && (await healthAppInfo()).available) {
    imported = full || !settings.historyImported;
    list = await readHealthRange(imported ? HISTORY_START : daysAgo(days - 1), new Date());
    source = 'health';
  } else if (Platform.OS === 'ios' && (await pedometerAvailable())) {
    list = await readPhoneDays(days);
    source = 'phone';
  }
  if (list.length) await upload(list);
  await saveSyncSettings({
    lastSync: new Date().toISOString(),
    lastSource: source,
    ...(imported && { historyImported: true, historyDays: list.length }),
  });
  return { source, days: list.length, full: imported };
}

/** Sync if it hasn't happened in the last `minutes` (used when the app comes to the front). */
export async function syncIfStale(minutes = 15) {
  const { lastSync } = await loadSyncSettings();
  if (lastSync && Date.now() - new Date(lastSync).getTime() < minutes * 60000) return null;
  return syncSteps().catch(() => null);
}
