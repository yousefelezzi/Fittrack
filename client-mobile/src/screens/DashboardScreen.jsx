import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, RefreshControl, TouchableOpacity,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { workoutAPI, nutritionAPI, stepsAPI } from '../api';
import { Card, Spinner, MacroBar, colors, makeStyles, cardSurface } from '../components';
import VolumeCheck from '../components/VolumeCheck';
import { stepStreak } from '../../../client-web/src/utils/stepStreak';
import { getGreeting, formatDuration, sumMacro } from '../../../shared/formatters';
import { Dumbbell, Calendar, Flame, Footprints } from 'lucide-react-native';

/** Same as the web dashboard: a colored icon tile, the label and the value. */
function StatCard({ icon: Icon, label, value, color }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: color }]}><Icon size={18} color="#fff" /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
        <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

// yyyy-MM-dd in local time.
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };

export default function DashboardScreen({ navigation }) {
  const { user } = useAuth();
  const [stats, setStats]                 = useState(null);
  const [recentWorkouts, setRecentWorkouts] = useState([]);
  const [todayNutrition, setTodayNutrition] = useState(null);
  const [steps, setSteps]                 = useState(null); // { goal, days: [today?] }
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);

  const load = async () => {
    try {
      // Local date (a UTC date would be tomorrow late in the evening west of UTC).
      const today = dayKey(new Date());
      const [sRes, wRes, nRes, stRes] = await Promise.all([
        workoutAPI.getStats(),
        workoutAPI.getAll({ limit: 4 }),
        nutritionAPI.getByDate(today),
        // 60 days for the step streak; today's entry is in there too.
        stepsAPI.getRange(dayKey(daysAgo(59)), today).catch(() => null),
      ]);
      setSteps(stRes?.data ?? null);
      setStats(sRes.data);
      setRecentWorkouts(wRes.data.workouts ?? []);
      setTodayNutrition(nRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Loads on first view and again whenever the tab comes back into focus
  // (steps are often logged on the Steps tab).
  useEffect(() => navigation.addListener('focus', load), [navigation]);

  if (loading) return <View style={styles.centered}><Spinner /></View>;

  const totalCals = Math.round(sumMacro(todayNutrition?.meals ?? [], 'calories'));
  const stepsToday = steps?.days?.find((d) => d.date.slice(0, 10) === dayKey(new Date()));
  const streak     = steps ? stepStreak(steps.days, steps.goal) : 0;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}
    >
      {/* Greeting */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Good {getGreeting()}, {user?.name?.split(' ')[0]}</Text>
        <Text style={styles.dateStr}>{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
      </View>

      {/* Stat row */}
      <View style={styles.statGrid}>
        <StatCard icon={Dumbbell}   label="Total Workouts" value={stats?.totalWorkouts ?? 0} color={colors.brand} />
        <StatCard icon={Calendar}   label="This Week"      value={stats?.recentWorkouts?.filter((w) => {
          const d = new Date(w.date); const now = new Date();
          const start = new Date(now); start.setDate(now.getDate() - now.getDay()); start.setHours(0,0,0,0);
          return d >= start;
        }).length ?? 0} color="#8b5cf6" />
        <StatCard icon={Flame}      label="Calories Today" value={totalCals} color="#f97316" />
        <StatCard icon={Footprints} label="Steps Streak"   value={`${streak}d`} color="#10b981" />
      </View>

      {/* Only shows when some muscle is below maintenance; opens Progress */}
      <VolumeCheck compact onOpen={() => navigation.navigate('Progress')} />

      {/* Recent workouts */}
      <Card>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Recent Workouts</Text>
          <View style={{ flexDirection: 'row', gap: 14 }}>
            <TouchableOpacity onPress={() => navigation.navigate('History')}>
              <Text style={[styles.cardAction, { color: colors.textSecondary }]}>View all</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('LogWorkout')}>
              <Text style={styles.cardAction}>+ Log</Text>
            </TouchableOpacity>
          </View>
        </View>
        {recentWorkouts.length === 0
          ? <Text style={styles.empty}>No workouts yet.</Text>
          : recentWorkouts.map((w) => (
              <View key={w._id} style={styles.workoutRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.workoutName}>{w.name}</Text>
                  <Text style={styles.workoutMeta}>
                    {new Date(w.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {w.exercises?.length ?? 0} exercises
                  </Text>
                </View>
                <Text style={styles.workoutDuration}>{formatDuration(w.duration)}</Text>
              </View>
            ))
        }
      </Card>

      {/* Today's macros */}
      <Card>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Today's Nutrition</Text>
          <View style={{ flexDirection: 'row', gap: 14 }}>
            <TouchableOpacity onPress={() => navigation.navigate('History', { tab: 'nutrition' })}>
              <Text style={[styles.cardAction, { color: colors.textSecondary }]}>History</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('FoodLog')}>
              <Text style={styles.cardAction}>Track</Text>
            </TouchableOpacity>
          </View>
        </View>
        {!todayNutrition
          ? <Text style={styles.empty}>No meals logged today.</Text>
          : ['calories', 'protein', 'carbs', 'fat'].map((macro) => {
              const val  = sumMacro(todayNutrition.meals, macro);
              const goal = todayNutrition.dailyGoals?.[macro] ?? 0;
              return <MacroBar key={macro} label={macro} current={val} goal={goal} unit={macro === 'calories' ? 'kcal' : 'g'} />;
            })
        }
      </Card>

      {/* Today's steps */}
      {steps && (
        <Card>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Today's Steps</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Steps')}>
              <Text style={styles.cardAction}>{stepsToday ? 'Update' : '+ Log'}</Text>
            </TouchableOpacity>
          </View>
          <MacroBar
            label={stepsToday?.burned > 0 ? `≈${stepsToday.burned} kcal burned${stepsToday.calories > 0 ? ` · +${stepsToday.calories} to target` : ''}` : 'steps'}
            current={stepsToday?.steps ?? 0}
            goal={steps.goal}
            unit=""
            color={(stepsToday?.steps ?? 0) >= steps.goal ? colors.success : colors.brand}
          />
        </Card>
      )}
    </ScrollView>
  );
}

const styles = makeStyles(() => ({
  root:        { flex: 1, backgroundColor: colors.bg },
  content:     { padding: 16 },
  centered:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:      { marginBottom: 20 },
  greeting:    { fontSize: 22, fontWeight: '700', color: colors.textPrimary },
  dateStr:     { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  statGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statCard:    {
    width: '48%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12,
    backgroundColor: colors.surface, borderRadius: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
    ...cardSurface(),
  },
  statIcon:    { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  statValue:   { fontSize: 19, fontWeight: '700', color: colors.textPrimary },
  statLabel:   { fontSize: 11, color: colors.textSecondary },
  cardHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle:   { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  cardAction:  { fontSize: 13, color: colors.brand, fontWeight: '500' },
  empty:       { fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingVertical: 12 },
  workoutRow:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.subtle },
  workoutName: { fontSize: 14, fontWeight: '500', color: colors.textPrimary },
  workoutMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  workoutDuration: { fontSize: 13, color: colors.textSecondary },
}));