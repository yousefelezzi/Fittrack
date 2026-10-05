import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, RefreshControl, TextInput, TouchableOpacity, } from 'react-native';
import { stepsAPI } from '../api';
import { Card, Button, Spinner, colors, makeStyles } from '../components';
import StepSources from '../components/StepSources';
import { syncIfStale } from '../utils/stepSync';

const RANGE_DAYS = 14;
const QUICK_ADD = [1000, 2500, 5000];
const CHART_HEIGHT = 120;
const LABEL_HEIGHT = 18; // day letter under each bar

// yyyy-MM-dd in local time (toISOString would give tomorrow's date late in the evening west of UTC).
const dateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
const fmt = (n) => n.toLocaleString();

/** Daily step tracking: log a day's steps, see the goal, the last two weeks and the calories they add. */
export default function StepsScreen({ navigation }) {
  const [data, setData]           = useState(null); // { goal, baseline, canAdjustCalories, days }
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [date, setDate]           = useState(dateKey(new Date()));
  const [input, setInput]         = useState('');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');
  const [liveExtra, setLiveExtra] = useState(0); // counted by the phone since the last save

  const load = useCallback(async () => {
    try {
      const { data: res } = await stepsAPI.getRange(dateKey(daysAgo(RANGE_DAYS - 1)), dateKey(new Date()));
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  // Loads on first view and again whenever the screen comes back into focus
  // (e.g. after changing the goal in the profile), pulling in the phone's /
  // health app's steps first if they haven't been synced in the last few minutes.
  useEffect(() => navigation.addListener('focus', () => { load(); syncIfStale(2).then((res) => res && load()); }), [navigation, load]);

  // Days are stored at UTC midnight of the date sent, so the date part is the day.
  const byDate = new Map((data?.days ?? []).map((d) => [d.date.slice(0, 10), d]));
  const selected = byDate.get(date);
  useEffect(() => { setInput(selected ? String(selected.steps) : ''); }, [date, selected?.steps]);

  const save = async (steps) => {
    if (!(steps >= 0) || steps > 200000) { setError('Enter a number of steps from 0 to 200,000'); return; }
    setSaving(true);
    setError('');
    try {
      await stepsAPI.set(date, Math.round(steps));
      await load();
    } catch (e) {
      setError(e.response?.data?.message || 'Could not save your steps');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View style={styles.centered}><Spinner /></View>;
  if (!data) return <View style={styles.centered}><Text style={styles.muted}>Could not load your steps.</Text></View>;

  const { goal, baseline, canAdjustCalories } = data;
  const todayKey = dateKey(new Date());
  const today = byDate.get(todayKey);
  const savedToday = today?.steps ?? 0;
  const todaySteps = savedToday + liveExtra;
  const pct = Math.min(100, Math.round((todaySteps / goal) * 100));

  const chart = Array.from({ length: RANGE_DAYS }, (_, i) => {
    const d = daysAgo(RANGE_DAYS - 1 - i);
    return { key: dateKey(d), day: d.toLocaleDateString(undefined, { weekday: 'narrow' }), steps: byDate.get(dateKey(d))?.steps ?? 0 };
  });
  const max = Math.max(goal, ...chart.map((d) => d.steps));
  const logged7 = chart.slice(-7).filter((d) => d.steps > 0);
  const avg7 = logged7.length ? Math.round(logged7.reduce((s, d) => s + d.steps, 0) / logged7.length) : 0;
  const atGoal = chart.filter((d) => d.steps >= goal).length;
  const isTodaySelected = date === todayKey;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}
    >
      {/* Today */}
      <Card>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Today</Text>
          <TouchableOpacity onPress={() => navigation.popTo('Tabs', { screen: 'Profile' })}>
            <Text style={styles.muted}>Goal {fmt(goal)} · <Text style={styles.link}>change</Text></Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.big}>{fmt(todaySteps)} <Text style={styles.bigUnit}>steps</Text></Text>
        <View style={styles.barBg}>
          <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: pct >= 100 ? colors.success : colors.brand }]} />
        </View>
        <Text style={styles.small}>{pct >= 100 ? 'Goal reached' : `${fmt(goal - todaySteps)} to go (${pct}%)`}</Text>
        <Text style={[styles.small, { marginTop: 8 }]}>
          {!canAdjustCalories
            ? 'Add your weight to your profile so extra steps can raise your calorie target.'
            : `${today?.burned > 0 ? `About ${fmt(today.burned)} kcal burned walking today. ` : ''}${today?.calories > 0
              ? `+${today.calories} kcal of that is added to today's calorie target; the first ${fmt(baseline)} are everyday movement that's already in your maintenance.`
              : `Steps beyond ${fmt(baseline)} (everyday movement, already in your maintenance) raise your calorie target for the day.`}`}
        </Text>
      </Card>

      <StepSources todaySteps={savedToday} onChanged={load} onLiveExtra={setLiveExtra} />

      {/* Log */}
      <Card>
        <Text style={[styles.cardTitle, { marginBottom: 4 }]}>
          Log steps · {isTodaySelected ? 'today' : new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
        </Text>
        {!isTodaySelected && (
          <TouchableOpacity onPress={() => setDate(todayKey)}><Text style={styles.link}>Back to today</Text></TouchableOpacity>
        )}
        <TextInput
          style={styles.field}
          value={input}
          onChangeText={setInput}
          keyboardType="number-pad"
          placeholder="8000"
          returnKeyType="done"
          onSubmitEditing={() => input !== '' && save(Number(input))}
        />
        <View style={styles.quickRow}>
          {QUICK_ADD.map((n) => (
            <TouchableOpacity key={n} disabled={saving} onPress={() => save((selected?.steps ?? 0) + n)} style={styles.chip}>
              <Text style={styles.chipText}>+{fmt(n)}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button title={saving ? 'Saving…' : selected ? 'Update' : 'Save'} onPress={() => save(Number(input))} loading={saving} disabled={input === ''} />
        <Text style={[styles.small, { marginTop: 6 }]}>
          {isTodaySelected ? 'Copy the count from your phone or watch. You can update it as the day goes on.' : 'Save 0 to remove this day.'}
        </Text>
      </Card>

      {/* Last 14 days */}
      <Card>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Last {RANGE_DAYS} days</Text>
          <Text style={[styles.muted, { flexShrink: 1, textAlign: 'right' }]}>avg {fmt(avg7)} (7d) · {atGoal} at goal</Text>
        </View>
        <View style={styles.chart}>
          <View style={[styles.goalLine, { bottom: LABEL_HEIGHT + (goal / max) * CHART_HEIGHT }]} />
          {chart.map((d) => (
            <TouchableOpacity key={d.key} style={styles.barCol} onPress={() => setDate(d.key)} activeOpacity={0.7}>
              <View style={[
                styles.bar,
                { height: Math.max(2, (d.steps / max) * CHART_HEIGHT), backgroundColor: d.steps >= goal ? colors.success : colors.brand },
                d.key === date && styles.barSelected,
              ]} />
              <Text style={[styles.barLabel, d.key === date && { color: colors.brand, fontWeight: '700' }]}>{d.day}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.small}>Dashed line is your goal. Tap a day to edit it.</Text>
      </Card>
    </ScrollView>
  );
}

const styles = makeStyles(() => ({
  root:       { flex: 1, backgroundColor: colors.bg },
  content:    { padding: 16 },
  centered:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title:      { fontSize: 22, fontWeight: '700', color: colors.textPrimary, marginBottom: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardTitle:  { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  muted:      { fontSize: 12, color: colors.textMuted },
  link:       { fontSize: 12, color: colors.brand, fontWeight: '500' },
  small:      { fontSize: 12, color: colors.textSecondary },
  big:        { fontSize: 30, fontWeight: '800', color: colors.textPrimary },
  bigUnit:    { fontSize: 14, fontWeight: '400', color: colors.textMuted },
  barBg:      { height: 10, backgroundColor: colors.subtle, borderRadius: 999, overflow: 'hidden', marginTop: 8, marginBottom: 4 },
  barFill:    { height: '100%', borderRadius: 999 },
  field: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10, marginTop: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: colors.textPrimary,
  },
  quickRow:   { flexDirection: 'row', gap: 8, marginVertical: 10 },
  chip:       { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipText:   { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  error:      { color: colors.danger, fontSize: 13, marginBottom: 8 },
  chart:      { height: CHART_HEIGHT + LABEL_HEIGHT, flexDirection: 'row', alignItems: 'flex-end', marginBottom: 8 },
  goalLine:   { position: 'absolute', left: 0, right: 0, borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.success },
  barCol:     { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar:        { width: '60%', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  barSelected:{ borderWidth: 2, borderColor: colors.brandDark },
  barLabel:   { fontSize: 10, color: colors.textMuted, marginTop: 4, height: 14 },
}));
