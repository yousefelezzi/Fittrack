import React, { useCallback, useEffect, useState } from 'react';
import { View, TouchableOpacity, FlatList, RefreshControl } from 'react-native';
import { Text, TextInput } from '../components/AppText';
import { format } from 'date-fns';
import { workoutAPI, nutritionAPI } from '../api';
import { MEAL_TYPES } from '../../../client-web/src/constants/nutrition';
import { setLabel, workingSetCount } from '../../../client-web/src/utils/workoutSummary';
import { Card, Button, Spinner, colors, makeStyles, Segmented, Sheet, ErrorText, EmptyState, confirm } from '../components';
import { Share2, Trash2, X, Dumbbell, Salad } from 'lucide-react-native';
import { loggedWorkoutTotals } from '../../../client-web/src/utils/sessionReport';
import { formatRest } from '../../../client-web/src/utils/workoutCalories';
import { useAuth } from '../context/AuthContext';

const PAGE_SIZE = 10;
const fmtRest = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
const r = (n) => Math.round(n || 0);

/** Typed confirmation for wiping a whole history — it can't be undone. */
function ClearAllSheet({ visible, title, description, onConfirm, onClose, busy }) {
  const [text, setText] = useState('');
  useEffect(() => { if (visible) setText(''); }, [visible]);
  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      <Text style={styles.small}>{description}</Text>
      <Text style={[styles.small, { marginTop: 12 }]}>Type DELETE to confirm</Text>
      <TextInput style={styles.field} value={text} onChangeText={setText} autoCapitalize="characters" autoFocus />
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
        <Button title="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
        <Button title={busy ? 'Deleting…' : 'Delete all'} variant="danger" onPress={onConfirm} disabled={text !== 'DELETE' || busy} style={{ flex: 1 }} />
      </View>
    </Sheet>
  );
}

/**
 * Infinite list with delete-one and clear-all, shared by both tabs.
 * `fetchPage(page)` resolves to { items, total, pages }.
 */
function usePagedHistory(fetchPage) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (p, replace) => {
    setLoading(true);
    try {
      const res = await fetchPage(p);
      setItems((prev) => (replace ? res.items : [...prev, ...res.items.filter((it) => !prev.some((x) => x._id === it._id))]));
      setTotal(res.total);
      setPages(Math.max(1, res.pages));
      setPage(p);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load history');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchPage]);

  useEffect(() => { load(1, true); }, [load]);

  return {
    items, total, loading, refreshing, error, setError,
    loadMore: () => { if (!loading && page < pages) load(page + 1); },
    refresh: () => { setRefreshing(true); load(1, true); },
    remove: (id) => { setItems((prev) => prev.filter((x) => x._id !== id)); setTotal((t) => t - 1); },
    replace: (item) => setItems((prev) => prev.map((x) => (x._id === item._id ? item : x))),
    reset: () => { setItems([]); setTotal(0); setPages(1); setPage(1); },
  };
}

function HistoryList({ h, renderItem, countLabel, onClearAll, empty }) {
  return (
    <FlatList
      data={h.items}
      keyExtractor={(x) => x._id}
      renderItem={renderItem}
      contentContainerStyle={{ padding: 16, paddingTop: 8 }}
      onEndReached={h.loadMore}
      onEndReachedThreshold={0.4}
      refreshControl={<RefreshControl refreshing={h.refreshing} onRefresh={h.refresh} tintColor={colors.brand} />}
      ListHeaderComponent={(
        <View>
          <View style={styles.header}>
            <Text style={styles.small}>{countLabel}</Text>
            {h.total > 0 && <TouchableOpacity onPress={onClearAll}><Text style={styles.danger}>Clear all</Text></TouchableOpacity>}
          </View>
          <ErrorText>{h.error}</ErrorText>
        </View>
      )}
      ListEmptyComponent={h.loading ? <Spinner /> : empty}
      ListFooterComponent={h.loading && h.items.length > 0 ? <Spinner size="small" /> : null}
    />
  );
}

// ── Workouts ────────────────────────────────────────────────────────────────

function WorkoutRow({ workout, onDelete, onShare }) {
  const [open, setOpen] = useState(false);
  const totalSets = workingSetCount(workout);
  const { user } = useAuth();
  const burn = loggedWorkoutTotals(workout, user?.weight); // estimated calories and recorded rest
  return (
    <Card style={{ marginBottom: 10 }}>
      <View style={styles.row}>
        <TouchableOpacity style={{ flex: 1 }} onPress={() => setOpen(!open)}>
          <Text style={styles.title} numberOfLines={1}>{workout.name}</Text>
          <Text style={styles.meta}>
            {format(new Date(workout.date), 'EEE, MMM d, yyyy')} · {workout.exercises.length} exercise{workout.exercises.length !== 1 ? 's' : ''} · {totalSets} set{totalSets !== 1 ? 's' : ''} · {workout.duration}min{burn.restSeconds ? ` · ${formatRest(burn.restSeconds)} rest` : ''} · ~{burn.calories.toLocaleString()} kcal
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onShare(workout)} hitSlop={6} style={styles.icon}><Share2 size={17} color={colors.textMuted} /></TouchableOpacity>
        <TouchableOpacity onPress={() => onDelete(workout)} hitSlop={6} style={styles.icon}><Trash2 size={17} color={colors.danger} /></TouchableOpacity>
      </View>
      {open && (
        <View style={styles.detail}>
          {workout.exercises.map((ex, i) => (
            <View key={i} style={{ marginBottom: 6 }}>
              <Text style={styles.exName}>{ex.exercise?.name ?? 'Deleted exercise'}</Text>
              <Text style={styles.meta}>
                {ex.sets.map((s) => `${setLabel(s, ex.weightUnit, ex.exercise)}${s.restTime != null ? ` (rest ${fmtRest(s.restTime)})` : ''}`).join(' · ')}
              </Text>
            </View>
          ))}
          {workout.notes ? <Text style={[styles.meta, { fontStyle: 'italic' }]}>“{workout.notes}”</Text> : null}
        </View>
      )}
    </Card>
  );
}

const fetchWorkouts = async (page) => {
  const { data } = await workoutAPI.getAll({ page, limit: PAGE_SIZE });
  return { items: data.workouts, total: data.total, pages: data.pages };
};

function WorkoutHistory({ navigation }) {
  const h = usePagedHistory(fetchWorkouts);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const handleDelete = async (w) => {
    if (!(await confirm(`Delete "${w.name}"?`, `From ${format(new Date(w.date), 'MMM d, yyyy')}. This can't be undone.`, 'Delete', true))) return;
    h.setError('');
    try { await workoutAPI.delete(w._id); h.remove(w._id); }
    catch (err) { h.setError(err.response?.data?.message || 'Failed to delete workout'); }
  };
  const handleClearAll = async () => {
    setClearing(true);
    try { await workoutAPI.deleteAll(); h.reset(); setClearOpen(false); }
    catch (err) { h.setError(err.response?.data?.message || 'Failed to clear history'); }
    finally { setClearing(false); }
  };

  return (
    <>
      <HistoryList h={h} countLabel={`${h.total} workout${h.total !== 1 ? 's' : ''} logged`} onClearAll={() => setClearOpen(true)}
        renderItem={({ item }) => <WorkoutRow workout={item} onDelete={handleDelete} onShare={(w) => navigation.popTo('Tabs', { screen: 'Feed', params: { shareWorkout: w } })} />}
        empty={<EmptyState icon={Dumbbell} title="No workouts logged" subtitle="Log a workout to start building your history." />} />
      <ClearAllSheet visible={clearOpen} busy={clearing} onConfirm={handleClearAll} onClose={() => setClearOpen(false)}
        title="Delete all workout history?"
        description={`This permanently deletes all ${h.total} logged workout${h.total !== 1 ? 's' : ''}, and resets your stats and progress charts. Your plans and exercises are kept.`} />
    </>
  );
}

// ── Nutrition ───────────────────────────────────────────────────────────────

const sumMeals = (meals) => meals.reduce(
  (t, m) => ({ calories: t.calories + (m.calories || 0), protein: t.protein + (m.protein || 0), carbs: t.carbs + (m.carbs || 0), fat: t.fat + (m.fat || 0) }),
  { calories: 0, protein: 0, carbs: 0, fat: 0 },
);

function NutritionRow({ log, onDeleteDay, onDeleteMeal }) {
  const [open, setOpen] = useState(false);
  const t = sumMeals(log.meals);
  const meals = [...log.meals].sort((a, b) => MEAL_TYPES.indexOf(a.mealType) - MEAL_TYPES.indexOf(b.mealType));
  return (
    <Card style={{ marginBottom: 10 }}>
      <View style={styles.row}>
        <TouchableOpacity style={{ flex: 1 }} onPress={() => setOpen(!open)}>
          <Text style={styles.title}>
            {format(new Date(log.date), 'EEE, MMM d, yyyy')}  <Text style={{ color: colors.brand }}>{r(t.calories).toLocaleString()} kcal</Text>
            {log.dailyGoals?.calories ? <Text style={styles.meta}> / {r(log.dailyGoals.calories).toLocaleString()}</Text> : null}
          </Text>
          <Text style={styles.meta}>P {r(t.protein)}g · C {r(t.carbs)}g · F {r(t.fat)}g · {log.meals.length} meal{log.meals.length !== 1 ? 's' : ''}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onDeleteDay(log)} hitSlop={6} style={styles.icon}><Trash2 size={17} color={colors.danger} /></TouchableOpacity>
      </View>
      {open && (
        <View style={styles.detail}>
          {meals.map((m) => (
            <View key={m._id} style={[styles.row, { marginBottom: 6 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.exName} numberOfLines={1}><Text style={styles.mealType}>{m.mealType.toUpperCase()}  </Text>{m.name}</Text>
                <Text style={styles.meta}>{r(m.calories)} kcal · P {r(m.protein)}g · C {r(m.carbs)}g · F {r(m.fat)}g</Text>
              </View>
              <TouchableOpacity onPress={() => onDeleteMeal(log, m)} hitSlop={6}><X size={16} color={colors.textMuted} /></TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

const fetchNutrition = async (page) => {
  const { data } = await nutritionAPI.getHistory({ page, limit: PAGE_SIZE });
  return { items: data.logs, total: data.total, pages: data.pages };
};

function NutritionHistory() {
  const h = usePagedHistory(fetchNutrition);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const handleDeleteDay = async (log) => {
    if (!(await confirm(`Delete ${format(new Date(log.date), 'MMM d, yyyy')}?`, `All ${log.meals.length} meal${log.meals.length !== 1 ? 's' : ''} will be deleted. This can't be undone.`, 'Delete', true))) return;
    try { await nutritionAPI.deleteLog(log._id); h.remove(log._id); }
    catch (err) { h.setError(err.response?.data?.message || 'Failed to delete day'); }
  };
  const handleDeleteMeal = async (log, meal) => {
    if (!(await confirm(`Delete "${meal.name}"?`, `From ${format(new Date(log.date), 'MMM d')}.`, 'Delete', true))) return;
    try {
      const { data } = await nutritionAPI.deleteMeal(log._id, meal._id);
      // Removing the last meal leaves an empty day, which drops out of the history.
      if (data.meals.length === 0) h.remove(log._id); else h.replace(data);
    } catch (err) { h.setError(err.response?.data?.message || 'Failed to delete meal'); }
  };
  const handleClearAll = async () => {
    setClearing(true);
    try { await nutritionAPI.deleteAll(); h.reset(); setClearOpen(false); }
    catch (err) { h.setError(err.response?.data?.message || 'Failed to clear history'); }
    finally { setClearing(false); }
  };

  return (
    <>
      <HistoryList h={h} countLabel={`${h.total} day${h.total !== 1 ? 's' : ''} logged`} onClearAll={() => setClearOpen(true)}
        renderItem={({ item }) => <NutritionRow log={item} onDeleteDay={handleDeleteDay} onDeleteMeal={handleDeleteMeal} />}
        empty={<EmptyState icon={Salad} title="No meals logged" subtitle="Log a meal to start building your history." />} />
      <ClearAllSheet visible={clearOpen} busy={clearing} onConfirm={handleClearAll} onClose={() => setClearOpen(false)}
        title="Delete all nutrition history?"
        description={`This permanently deletes every meal from all ${h.total} logged day${h.total !== 1 ? 's' : ''}, and resets your average calories stat. The food database is kept.`} />
    </>
  );
}

export default function HistoryScreen({ navigation, route }) {
  const [tab, setTab] = useState(route?.params?.tab === 'nutrition' ? 'nutrition' : 'workouts');
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: 16, paddingBottom: 0 }}>
        <Segmented value={tab} onChange={setTab} options={[['workouts', 'Workouts'], ['nutrition', 'Nutrition']]} />
      </View>
      {tab === 'workouts' ? <WorkoutHistory navigation={navigation} /> : <NutritionHistory />}
    </View>
  );
}

const styles = makeStyles(() => ({
  header:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  row:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title:    { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  meta:     { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  exName:   { fontSize: 13, fontWeight: '500', color: colors.textPrimary },
  mealType: { fontSize: 10, color: colors.textMuted, letterSpacing: 0.5 },
  detail:   { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  icon:     { paddingHorizontal: 4 },
  small:    { fontSize: 13, color: colors.textSecondary },
  danger:   { fontSize: 13, color: colors.danger, fontWeight: '600' },
  field:    { minHeight: 42, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, fontSize: 15, color: colors.textPrimary, marginTop: 6 },
}));
