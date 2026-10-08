import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { format } from 'date-fns';
import { Utensils, GlassWater, Pill, ChartLine, History, Scale } from 'lucide-react-native';
import { nutritionAPI } from '../api';
import { Card, ListRow, colors, makeStyles, Title } from '../components';
import { formatMl } from '../../../client-web/src/utils/nutritionProgress';
import { MACRO_COLORS } from '../../../client-web/src/utils/foodLogic';
import { formatBodyWeight } from '../../../client-web/src/utils/bodyUnits';
import { useAuth } from '../context/AuthContext';

const today = () => format(new Date(), 'yyyy-MM-dd');

/** Everything about nutrition in one place, like Train: today at a glance, then the sections. */
export default function NutritionHubScreen({ navigation }) {
  const { user } = useAuth();
  const [log, setLog] = useState(null);
  const [waterGoal, setWaterGoal] = useState(2500);
  const [supDay, setSupDay] = useState([]); // today's supplements (the stack is put on automatically)
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    const d = today();
    nutritionAPI.getByDate(d).then(({ data }) => setLog(data)).catch(() => {});
    nutritionAPI.summary(d, d).then(({ data }) => setWaterGoal(data.waterGoal)).catch(() => {});
    nutritionAPI.supplementDay(d).then(({ data }) => setSupDay(data.supplementsTaken || [])).catch(() => {});
  }, []);
  useEffect(() => navigation.addListener('focus', load), [navigation, load]);

  const totals = (log?.meals || []).reduce((t, m) => ({
    calories: t.calories + (m.calories || 0), protein: t.protein + (m.protein || 0), carbs: t.carbs + (m.carbs || 0), fat: t.fat + (m.fat || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
  const goals = log?.dailyGoals || {};
  const water = (log?.water || []).reduce((n, w) => n + w.amount, 0);
  const taken = supDay.filter((t) => t.taken !== false).length;
  const unticked = supDay.filter((t) => t.taken === false).map((t) => t.supplement);

  // Tick off all of today's supplements in one tap.
  const tickAll = async () => {
    setBusy(true);
    try { setSupDay((await nutritionAPI.takeSupplements(today(), { supplementIds: unticked })).data.supplementsTaken || []); } catch { /* shown on next load */ } finally { setBusy(false); }
  };
  const bar = (value, goal, color) => (
    <View style={styles.track}><View style={[styles.fill, { width: `${Math.min(100, goal ? (value / goal) * 100 : 0)}%`, backgroundColor: color }]} /></View>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <Title>Nutrition</Title>
      <Card>
        <Text style={styles.cap}>TODAY</Text>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Calories</Text>
          <Text style={styles.statValue}>{Math.round(totals.calories)} / {Math.round(goals.calories || 0)} kcal</Text>
        </View>
        {bar(totals.calories, goals.calories, '#f97316')}
        {[['protein', 'Protein'], ['carbs', 'Carbs'], ['fat', 'Fat']].map(([k, label]) => (
          <View key={k}>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>{label}</Text>
              <Text style={styles.statValue}>{Math.round(totals[k])} / {Math.round(goals[k] || 0)} g</Text>
            </View>
            {bar(totals[k], goals[k], MACRO_COLORS[k])}
          </View>
        ))}
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Water</Text>
          <Text style={styles.statValue}>{formatMl(water)} / {formatMl(waterGoal)}</Text>
        </View>
        {bar(water, waterGoal, '#06b6d4')}
        {supDay.length > 0 ? (
          <View style={[styles.statRow, { marginTop: 10 }]}>
            <Text style={styles.statLabel}>Supplements: <Text style={styles.statValue}>{taken} of {supDay.length} taken</Text></Text>
            {unticked.length ? (
              <TouchableOpacity disabled={busy} onPress={tickAll} hitSlop={6}><Text style={styles.quickText}>Tick all</Text></TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </Card>

      <Card style={{ paddingVertical: 4 }}>
        <ListRow icon={Utensils} title="Food Log" subtitle="Meals, macros, the meal planner and recipes" onPress={() => navigation.navigate('FoodLog')} />
        <ListRow icon={GlassWater} title="Hydration" subtitle="Water through the day against your goal" onPress={() => navigation.navigate('Hydration')} />
        <ListRow icon={Pill} title="Supplements" subtitle="Your stack, ticked off each day" onPress={() => navigation.navigate('Supplements')} />
        <ListRow icon={Scale} title="Weight" subtitle={user?.weight ? `${formatBodyWeight(user.weight, user.bodyWeightUnit)} · 7-day average` : 'Daily weigh-ins and your 7-day average'} onPress={() => navigation.navigate('Weight')} />
        <ListRow icon={ChartLine} title="Progress" subtitle="Daily calories, macros and water over time" onPress={() => navigation.navigate('NutritionProgress')} />
        <ListRow icon={History} title="History" subtitle="Past days' meals" onPress={() => navigation.navigate('History', { tab: 'nutrition' })} last />
      </Card>
    </ScrollView>
  );
}

const styles = makeStyles(() => ({
  cap:       { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5, marginBottom: 6 },
  statRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 6 },
  statLabel: { fontSize: 13, color: colors.textSecondary },
  statValue: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  track:     { height: 7, backgroundColor: colors.subtle, borderRadius: 999, overflow: 'hidden', marginTop: 4 },
  fill:      { height: '100%', borderRadius: 999 },
  quickText: { fontSize: 12, fontWeight: '600', color: colors.brand },
}));
