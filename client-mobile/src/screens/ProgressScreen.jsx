import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { format } from 'date-fns';
import { workoutAPI, exerciseAPI } from '../api';
import { Card, Spinner, colors, makeStyles, BarChart, LineChart, HBarList, ExercisePicker, Hint, SectionTitle } from '../components';
import VolumeCheck from '../components/VolumeCheck';
import { X, ChevronDown } from 'lucide-react-native';

// Muscles in body order — upper body, core, legs — with the same colours as the web pie.
const MUSCLE_ORDER = [
  ['pecs', '#0ea5e9'], ['anterior delt', '#38bdf8'], ['middle delt', '#6366f1'], ['posterior delt', '#818cf8'],
  ['triceps', '#8b5cf6'], ['elbow flexors', '#a78bfa'], ['forearms', '#c084fc'], ['lats', '#2563eb'], ['trapezius', '#3b82f6'],
  ['abs', '#f59e0b'], ['erectors', '#fbbf24'],
  ['hip flexors', '#14b8a6'], ['glutes', '#10b981'], ['adductors', '#34d399'], ['quads', '#22c55e'],
  ['hamstrings', '#f97316'], ['calves', '#fb923c'],
];
const MUSCLE_POS = Object.fromEntries(MUSCLE_ORDER.map(([m], i) => [m, i]));
const MUSCLE_COLOR = Object.fromEntries(MUSCLE_ORDER);

function buildWeeklyData(workouts) {
  const weeks = {};
  workouts.forEach((w) => {
    const d = new Date(w.date);
    const start = new Date(d);
    start.setDate(d.getDate() - d.getDay());
    start.setHours(0, 0, 0, 0);
    weeks[start.getTime()] = (weeks[start.getTime()] || 0) + 1;
  });
  return Object.entries(weeks)
    .sort(([a], [b]) => a - b)
    .slice(-12)
    .map(([t, count]) => ({ key: t, label: format(new Date(Number(t)), 'MMM d'), value: count }));
}

export default function ProgressScreen({ navigation }) {
  const [stats, setStats] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [selected, setSelected] = useState(null);
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [expandedMuscle, setExpandedMuscle] = useState(null);

  const load = () => Promise.all([workoutAPI.getStats(), exerciseAPI.getAll()])
    // Overcoming isometrics have no load or reps to track, so they aren't listed.
    .then(([s, e]) => { setStats(s.data); setExercises(e.data.filter((x) => x.type !== 'overcoming')); })
    .catch(console.error)
    .finally(() => { setLoading(false); setRefreshing(false); });
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!selected) return;
    workoutAPI.getProgress(selected._id).then(({ data }) => setProgress(data)).catch(console.error);
  }, [selected]);

  if (loading) return <View style={styles.centered}><Spinner /></View>;

  const weekly = buildWeeklyData(stats?.recentWorkouts || []);
  const muscles = (stats?.muscleGroupStats || [])
    .map((m) => ({
      key: m._id, label: m._id.replace('_', ' '), value: m.count, color: MUSCLE_COLOR[m._id],
      sub: m.subregions?.length ? (
        <View>{m.subregions.map((s) => <Text key={s.name} style={styles.sub}>{s.name}: {s.count}</Text>)}</View>
      ) : null,
    }))
    .sort((a, b) => (MUSCLE_POS[a.key] ?? 99) - (MUSCLE_POS[b.key] ?? 99) || b.value - a.value);

  // Recently done exercises first in the picker.
  const recentIds = [];
  [...(stats?.recentWorkouts || [])]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .forEach((w) => (w.exercises || []).forEach((e) => {
      const id = e.exercise?._id || e.exercise;
      if (id && !recentIds.includes(id)) recentIds.push(id);
    }));
  const pickerList = [
    ...recentIds.map((id) => exercises.find((ex) => ex._id === id)).filter(Boolean),
    ...exercises.filter((ex) => !recentIds.includes(ex._id)).sort((a, b) => a.name.localeCompare(b.name)),
  ];

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}>
      <Card>
        <SectionTitle>Workouts per week</SectionTitle>
        {weekly.length === 0 ? <Text style={styles.empty}>No data yet</Text>
          : <BarChart data={weekly} height={130} showValues labelEvery={weekly.length > 6 ? 2 : 1} />}
      </Card>

      <VolumeCheck onOpenCalculator={() => navigation.navigate('Calculators', { calc: 'wns' })} />

      <Card>
        <SectionTitle>Muscle groups trained · sets</SectionTitle>
        {muscles.length === 0 ? <Text style={styles.empty}>No data yet</Text> : (
          <>
            <HBarList data={muscles} expandedKey={expandedMuscle} onPress={(m) => setExpandedMuscle(expandedMuscle === m.key ? null : m.key)} />
            <Hint style={{ marginTop: 8 }}>Tap a muscle with regions (pecs, triceps, quads…) to see the sets per region.</Hint>
          </>
        )}
      </Card>

      <Card>
        <SectionTitle>Exercise progress</SectionTitle>
        <TouchableOpacity style={styles.picker} onPress={() => setPickerOpen(true)}>
          <Text style={[styles.pickerText, !selected && { color: colors.textMuted }]}>{selected?.name || 'Choose an exercise…'}</Text>
          {selected ? <TouchableOpacity onPress={() => { setSelected(null); setProgress([]); }} hitSlop={8}><X size={16} color={colors.textMuted} /></TouchableOpacity> : <ChevronDown size={16} color={colors.textMuted} />}
        </TouchableOpacity>
        {selected?.type === 'yielding' ? <Hint style={{ marginBottom: 6 }}>Holds are tracked as reps: every 2 seconds held counts as 1 rep, and every 2 seconds in reserve as 1 RIR (16s @ 2s in reserve = 8 reps @ 1 RIR).</Hint> : null}
        {selected && progress.length > 0 ? (
          <LineChart
            data={progress.map((p) => ({ label: format(new Date(p.date), 'MMM d'), oneRM: p.oneRM, maxWeight: p.maxWeight }))}
            series={[{ key: 'oneRM', label: 'Est. 1RM (kg)', color: '#0ea5e9' }, { key: 'maxWeight', label: 'Max weight (kg)', color: '#8b5cf6' }]}
          />
        ) : selected ? <Text style={styles.empty}>No data for this exercise yet.</Text> : null}
      </Card>

      <ExercisePicker visible={pickerOpen} title="Exercise progress" exercises={pickerList}
        onPick={(ex) => { setSelected(ex); setPickerOpen(false); }} onClose={() => setPickerOpen(false)} />
    </ScrollView>
  );
}

const styles = makeStyles(() => ({
  root:       { flex: 1, backgroundColor: colors.bg },
  content:    { padding: 16 },
  centered:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty:      { textAlign: 'center', color: colors.textMuted, paddingVertical: 20 },
  sub:        { fontSize: 11, color: colors.textSecondary },
  picker:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, height: 42, marginBottom: 12 },
  pickerText: { fontSize: 14, color: colors.textPrimary, flex: 1 },
}));
