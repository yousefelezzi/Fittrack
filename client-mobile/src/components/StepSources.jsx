import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Platform, Switch } from 'react-native';
import { Pedometer } from 'expo-sensors';
import { formatDistanceToNow } from 'date-fns';
import { stepsAPI } from '../api';
import { colors, makeStyles, cardSurface } from './tokens';
import { Hint, LinkText, ErrorText } from './ui';
import {
  healthAppInfo, connectHealthApp, disconnectHealthApp, loadSyncSettings, pedometerAvailable, syncSteps,
} from '../utils/stepSync';
import { Smartphone, Heart } from 'lucide-react-native';

const FLUSH_MS = 60000; // save counted steps about once a minute while the screen is open
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/**
 * Counts steps live with the phone's motion sensor while the screen is open.
 * Returns how many steps were taken since they were last saved; `flush` saves
 * them. On iOS (and with a health app connected) the real day total is read
 * back from the sensor/health app; on Android without one, the counted steps
 * are added to today's saved total — the only way to count without a health app.
 */
function useLiveSteps({ todaySteps, healthEnabled, onSaved }) {
  const [available, setAvailable] = useState(false);
  const [extra, setExtra] = useState(0);   // steps since the last save
  const counted = useRef(0);               // steps since subscribing
  const saved = useRef(0);                 // part of `counted` already saved
  const today = useRef(todaySteps);
  today.current = todaySteps;

  useEffect(() => {
    let sub;
    let cancelled = false;
    (async () => {
      if (!(await pedometerAvailable())) return;
      const perm = await Pedometer.requestPermissionsAsync().catch(() => ({ granted: false }));
      if (!perm.granted || cancelled) return;
      setAvailable(true);
      sub = Pedometer.watchStepCount(({ steps }) => {
        counted.current = steps;
        setExtra(steps - saved.current);
      });
    })();
    return () => { cancelled = true; sub?.remove(); };
  }, []);

  const flush = useCallback(async () => {
    const delta = counted.current - saved.current;
    if (delta <= 0) return;
    saved.current = counted.current;
    setExtra(0);
    try {
      if (Platform.OS === 'android' && !healthEnabled) {
        await stepsAPI.sync([{ date: todayKey(), steps: today.current + delta }]);
      } else {
        await syncSteps({ days: 1 });
      }
      onSaved();
    } catch {
      // keep counting; the next flush tries again with the larger total
      saved.current -= delta;
    }
  }, [healthEnabled, onSaved]);

  useEffect(() => {
    if (!available) return undefined;
    const id = setInterval(flush, FLUSH_MS);
    return () => { clearInterval(id); flush(); };
  }, [available, flush]);

  return { available, extra, flush };
}

/** "Phone & health app" card on the Steps screen. `onChanged` reloads the screen's numbers. */
export default function StepSources({ todaySteps, onChanged, onLiveExtra }) {
  const [health, setHealth] = useState(null);       // { name, available, reason }
  const [settings, setSettings] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    setHealth(await healthAppInfo());
    setSettings(await loadSyncSettings());
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const live = useLiveSteps({ todaySteps, healthEnabled: !!settings?.healthEnabled, onSaved: onChanged });
  useEffect(() => { onLiveExtra(live.extra); }, [live.extra]);

  const run = async (fn) => {
    setBusy(true);
    setError('');
    setMessage('');
    try { await fn(); } catch (e) { setError(e?.message || 'Something went wrong'); }
    finally { setBusy(false); refresh(); }
  };

  const daysText = (n) => `${n.toLocaleString()} day${n !== 1 ? 's' : ''}`;
  const sync = (full = false) => run(async () => {
    const res = await syncSteps({ full });
    setMessage(res.full ? `Imported ${daysText(res.days)} of history.` : res.days ? `Synced ${daysText(res.days)}.` : 'No new steps found.');
    onChanged();
  });
  const toggleHealth = (on) => run(async () => {
    if (!on) { await disconnectHealthApp(); return; }
    if (!(await connectHealthApp())) { setError(`${health.name} didn't give access to steps.`); return; }
    setMessage('Connected. Importing your step history…');
    const res = await syncSteps();
    setMessage(`Connected. Imported ${daysText(res.days)} of history.`);
    onChanged();
  });

  if (!health || !settings) return null;
  const isIOS = Platform.OS === 'ios';

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Phone & health app</Text>

      <View style={styles.row}>
        <View style={styles.icon}><Smartphone size={20} color={colors.brand} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Counting with this phone</Text>
          <Hint>
            {!live.available
              ? 'This phone’s step counter isn’t available, or motion access was refused (allow it in Settings).'
              : isIOS
                ? 'Your iPhone counts steps all day; today and the last 7 days are read from it automatically (iOS keeps no more than that — connect Apple Health for your full history).'
                : settings.healthEnabled
                  ? 'Steps you take with the app open show here live; Health Connect provides the day’s total.'
                  : 'Android only lets the app count while it’s open. Connect Health Connect to get your whole day.'}
          </Hint>
          {live.available && live.extra > 0 && <Text style={styles.live}>+{live.extra.toLocaleString()} counted just now</Text>}
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.icon}><Heart size={20} color={isIOS ? colors.danger : colors.success} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Sync with {health.name}</Text>
          <Hint>
            {health.available
              ? 'Includes steps from a watch and other apps. Imports your whole step history once, then keeps the last two weeks up to date when the app opens. A day is only ever raised, never lowered.'
              : health.reason}
          </Hint>
        </View>
        <Switch value={!!settings.healthEnabled && health.available} disabled={!health.available || busy}
          onValueChange={toggleHealth} trackColor={{ true: colors.brand }} />
      </View>

      <View style={[styles.row, { justifyContent: 'space-between', borderBottomWidth: 0 }]}>
        <Hint style={{ flex: 1 }}>
          {settings.lastSync ? `Last synced ${formatDistanceToNow(new Date(settings.lastSync), { addSuffix: true })}` : 'Not synced yet'}
          {settings.lastSource ? ` · from ${settings.lastSource === 'health' ? health.name : 'this phone'}` : ''}
        </Hint>
        {(isIOS || settings.healthEnabled) && <LinkText onPress={() => sync()}>{busy ? 'Syncing…' : 'Sync now'}</LinkText>}
      </View>
      {settings.healthEnabled && health.available && (
        <LinkText style={{ marginTop: 2 }} onPress={() => sync(true)}>Re-import all history</LinkText>
      )}
      {message ? <Text style={styles.ok}>{message}</Text> : null}
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

const styles = makeStyles(() => ({
  card:  { backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2, ...cardSurface() },
  title: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: 4 },
  row:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.subtle },
  icon:  { width: 26, alignItems: 'center', paddingTop: 2 },
  label: { fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 2 },
  live:  { fontSize: 12, color: colors.brand, fontWeight: '600', marginTop: 4 },
  ok:    { fontSize: 12, color: colors.success, marginTop: 4 },
}));
