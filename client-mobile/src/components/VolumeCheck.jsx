import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { workoutAPI } from '../api';
import { wnsFromSessions, WNS_DEFAULTS } from '../../../client-web/src/utils/wnsCalculations';
import { unitLabel as label } from '../../../client-web/src/utils/planAnalysis';
import { colors, makeStyles, cardSurface } from './tokens';
import { Segmented, Hint, LinkText } from './ui';
import { TriangleAlert, Settings } from 'lucide-react-native';

// Muscles trained in this lookback are checked; ones you never train aren't flagged.
const LOOKBACK_DAYS = 56;
const SETTINGS_KEY = 'fittrack.wnsSettings';

/**
 * Runs the WNS model on each muscle (and sub-region) you train, using your
 * logged workouts, and warns about any that are losing ground.
 * `compact` shows a short summary (dashboard) that opens Progress; otherwise
 * the full list with model settings.
 */
export default function VolumeCheck({ compact = false, onOpen, onOpenCalculator }) {
  const [sessions, setSessions] = useState(null);
  const [settings, setSettings] = useState({ ...WNS_DEFAULTS });
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_KEY).then((s) => s && setSettings({ ...WNS_DEFAULTS, ...JSON.parse(s) })).catch(() => {});
    workoutAPI.getMuscleSessions({ days: LOOKBACK_DAYS })
      .then(({ data }) => setSessions(data))
      .catch(() => setSessions([]));
  }, []);

  const update = (key, value) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next)).catch(() => {});
  };

  const results = useMemo(() => {
    if (!sessions) return null;
    const muscles = new Set(sessions.flatMap((s) => Object.keys(s.sets)));
    return [...muscles]
      .map((key) => ({
        key,
        ...wnsFromSessions(sessions.map((s) => ({ date: s.date, sets: s.sets[key] || 0 })), {
          dataset: settings.dataset,
          maintenance: Number(settings.maintenance) || WNS_DEFAULTS.maintenance,
          stimHours: Number(settings.stimHours) || WNS_DEFAULTS.stimHours,
          windowDays: WNS_DEFAULTS.windowDays,
        }),
      }))
      .sort((a, b) => a.wns - b.wns);
  }, [sessions, settings]);

  if (!results) return null;
  const negatives = results.filter((r) => r.wns < 0);
  const weeks = WNS_DEFAULTS.windowDays / 7;

  if (compact) {
    if (results.length === 0 || negatives.length === 0) return null;
    return (
      <TouchableOpacity onPress={onOpen} activeOpacity={0.7} style={[styles.card, styles.compact]}>
        <TriangleAlert size={18} color={colors.warning} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{negatives.length} muscle{negatives.length !== 1 ? 's' : ''} not getting enough volume</Text>
          <Text style={styles.small} numberOfLines={1}>{negatives.slice(0, 4).map((r) => label(r.key)).join(', ')}{negatives.length > 4 ? '…' : ''}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  const numField = (key, min, max, step) => (
    <TextInput style={styles.input} keyboardType="decimal-pad" defaultValue={String(settings[key])}
      onEndEditing={(e) => update(key, Math.min(max, Math.max(min, Number(e.nativeEvent.text) || min)))} />
  );

  return (
    <View style={styles.card}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heading}>Volume check</Text>
          <Hint>Weekly net stimulus from your last {weeks} weeks. Negative means sets or frequency are too low to beat atrophy.</Hint>
        </View>
        <TouchableOpacity onPress={() => setShowSettings((v) => !v)} hitSlop={8}>
          <Settings size={18} color={showSettings ? colors.brand : colors.textMuted} />
        </TouchableOpacity>
      </View>

      {showSettings && (
        <View style={styles.settings}>
          <Text style={styles.small}>Dataset</Text>
          <Segmented value={settings.dataset} onChange={(v) => update('dataset', v)} options={[['S', 'Schoenfeld'], ['P', 'Pelland'], ['A', 'Average']]} />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
            <View style={{ flex: 1 }}><Text style={styles.small}>Maintenance sets</Text>{numField('maintenance', 1, 5)}</View>
            <View style={{ flex: 1 }}><Text style={styles.small}>Stimulus (hours)</Text>{numField('stimHours', 12, 72)}</View>
          </View>
          <LinkText style={{ marginTop: 8 }} onPress={() => { setSettings({ ...WNS_DEFAULTS }); AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(WNS_DEFAULTS)).catch(() => {}); setShowSettings(false); }}>
            Reset to defaults (Schoenfeld · 3 sets · 48 h)
          </LinkText>
        </View>
      )}

      {results.length === 0 ? (
        <Text style={[styles.small, { marginTop: 8 }]}>Log a few workouts to see how each muscle is doing.</Text>
      ) : negatives.length === 0 ? (
        <Text style={[styles.small, { color: colors.success, marginTop: 8 }]}>✓ Every muscle you train is getting enough volume.</Text>
      ) : (
        <View style={{ marginTop: 6 }}>
          {negatives.map((r) => (
            <View key={r.key} style={styles.row}>
              <TriangleAlert size={16} color={colors.warning} />
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{label(r.key)}</Text>
                <Hint>
                  {r.sessions === 0
                    ? `Not trained in the last ${weeks} weeks`
                    : `${r.sets} set${r.sets !== 1 ? 's' : ''} over ${r.sessions} workout${r.sessions !== 1 ? 's' : ''} in ${weeks} weeks`}
                </Hint>
              </View>
              <Text style={styles.neg}>{r.wns.toFixed(2)}</Text>
            </View>
          ))}
          <Hint style={{ marginTop: 6 }}>
            {results.length - negatives.length} other muscle{results.length - negatives.length !== 1 ? 's are' : ' is'} fine.
            More sets per workout or training a muscle more often both help.
          </Hint>
          {onOpenCalculator ? <LinkText style={{ marginTop: 4 }} onPress={onOpenCalculator}>Try it in the WNS calculator</LinkText> : null}
        </View>
      )}
    </View>
  );
}

const styles = makeStyles(() => ({
  card:     { backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2, ...cardSurface() },
  compact:  { flexDirection: 'row', alignItems: 'center', gap: 10, borderLeftWidth: 4, borderLeftColor: colors.warning, paddingVertical: 12 },
  heading:  { fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: 2 },
  title:    { fontSize: 14, fontWeight: '500', color: colors.textPrimary },
  small:    { fontSize: 12, color: colors.textSecondary, marginBottom: 4 },
  settings: { backgroundColor: colors.inset, borderRadius: 12, padding: 10, marginTop: 10 },
  input:    { height: 36, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, fontSize: 14, color: colors.textPrimary, backgroundColor: colors.surface },
  row:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.subtle },
  neg:      { fontSize: 14, fontWeight: '700', color: colors.danger, fontVariant: ['tabular-nums'] },
}));
