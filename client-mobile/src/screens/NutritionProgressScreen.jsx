import React, { useEffect, useState } from 'react';
import { View, ScrollView } from 'react-native';
import { Text } from '../components/AppText';
import { format } from 'date-fns';
import { nutritionAPI } from '../api';
import { Card, BarChart, MacroDonut, Segmented, colors, makeStyles, Hint, ErrorText, Spinner } from '../components';
import {
  NUTRITION_METRICS, NUTRITION_RANGES, rangeDates, dailySeries, seriesStats, TARGET_RULE, formatMl, averageMacros,
} from '../../../client-web/src/utils/nutritionProgress';
import { MACRO_COLORS } from '../../../client-web/src/utils/foodLogic';

const COLORS = { calories: '#f97316', protein: '#0ea5e9', carbs: '#eab308', fat: '#a855f7', water: '#06b6d4' };

/** Charts of daily calories, macros and water over 7 / 30 / 90 days, against your goals. */
export default function NutritionProgressScreen() {
  const [metric, setMetric] = useState('calories');
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const { from, to } = rangeDates(days);
    setSummary(null);
    setSelected(null);
    nutritionAPI.summary(from, to).then(({ data }) => setSummary(data)).catch(() => setError('Could not load your nutrition history'));
  }, [days]);

  const [, label, unit] = NUTRITION_METRICS.find(([k]) => k === metric);
  const series = summary ? dailySeries(summary, metric, days) : [];
  const stats = seriesStats(series, metric);
  const fmt = (v) => (v == null ? '–' : metric === 'water' ? formatMl(v) : `${Math.round(v).toLocaleString()} ${unit}`);
  // The goal line: the most recent day's goal.
  const goal = [...series].reverse().find((p) => p.target)?.target || null;
  const bars = series.map((p) => ({ key: p.date, label: format(new Date(`${p.date}T00:00`), days > 7 ? 'd' : 'EEE'), value: p.value || 0, raw: p }));
  const pick = selected && series.find((p) => p.date === selected);
  const macros = averageMacros(summary);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <ErrorText>{error}</ErrorText>
      <Segmented value={metric} onChange={(m) => { setMetric(m); setSelected(null); }} options={NUTRITION_METRICS.map(([k, l]) => [k, l])} style={{ marginBottom: 8 }} />
      <Segmented value={days} onChange={setDays} options={NUTRITION_RANGES} style={{ marginBottom: 12 }} />

      <View style={styles.stats}>
        <Card style={styles.stat}><Text style={styles.cap}>Daily average</Text><Text style={styles.value}>{fmt(stats.average)}</Text></Card>
        <Card style={styles.stat}><Text style={styles.cap}>Days logged</Text><Text style={styles.value}>{stats.daysLogged}<Text style={styles.cap}> / {days}</Text></Text></Card>
        <Card style={styles.stat}><Text style={styles.cap}>On target</Text><Text style={styles.value}>{stats.onTarget}<Text style={styles.cap}> / {stats.daysWithTarget}</Text></Text></Card>
      </View>

      <Card>
        <Text style={styles.title}>{label} per day</Text>
        <Hint style={{ marginBottom: 10 }}>The dashed line is your goal; a day is on target when it's {TARGET_RULE[metric]}. Tap a bar to see that day.</Hint>
        {!summary ? <Spinner /> : stats.daysLogged === 0 ? <Hint>Nothing logged in the last {days} days.</Hint> : (
          <>
            <BarChart data={bars} goal={goal} color={COLORS[metric]} height={150} selectedKey={selected}
              labelEvery={days > 30 ? 15 : days > 7 ? 5 : 1} onPress={(b) => setSelected(selected === b.key ? null : b.key)} />
            {pick ? (
              <Text style={[styles.cap, { marginTop: 8, textAlign: 'center' }]}>
                {format(new Date(`${pick.date}T00:00`), 'EEE, MMM d')}: <Text style={styles.valueSmall}>{fmt(pick.value)}</Text>{pick.target ? ` · goal ${fmt(pick.target)}` : ''}
              </Text>
            ) : null}
          </>
        )}
      </Card>

      <Card>
        <Text style={styles.title}>Average macros</Text>
        <Hint style={{ marginBottom: 10 }}>Where your calories came from on an average logged day in the last {days} days.</Hint>
        {!summary ? <Spinner /> : macros.daysLogged === 0 ? <Hint>Nothing logged in the last {days} days.</Hint> : (
          <View style={styles.macroRow}>
            <View>
              <MacroDonut grams={Object.fromEntries(macros.slices.map((m) => [m.key, m.grams]))} size={120} />
              <View style={styles.donutCenter} pointerEvents="none">
                <Text style={styles.value}>{macros.kcal.toLocaleString()}</Text>
                <Text style={styles.cap}>kcal / day</Text>
              </View>
            </View>
            <View style={{ flex: 1, gap: 8 }}>
              {macros.slices.map((m, i) => (
                <View key={m.key}>
                  <View style={styles.legendRow}>
                    <View style={[styles.dot, { backgroundColor: MACRO_COLORS[m.key] }]} />
                    <Text style={[styles.valueSmall, { flex: 1 }]}>{m.label}</Text>
                    <Text style={styles.valueSmall}>{m.pct}%</Text>
                  </View>
                  <Text style={[styles.cap, { marginLeft: 16 }]}>
                    {Math.round(m.grams)} g · {Math.round(m.kcal)} kcal{macros.goal ? ` · goal ${macros.goal[i].pct}%` : ''}
                  </Text>
                  {m.key === 'fat' ? (
                    <View style={{ marginLeft: 16, marginTop: 4 }}>
                      <View style={styles.legendRow}>
                        <View style={[styles.dot, { backgroundColor: MACRO_COLORS.saturatedFat }]} />
                        <Text style={[styles.cap, { flex: 1, color: colors.textPrimary }]}>Saturated</Text>
                        <Text style={styles.cap}>{macros.saturated.pct}%</Text>
                      </View>
                      <Text style={[styles.cap, { marginLeft: 16 }, macros.saturated.grams > 20 && { color: colors.warning }]}>
                        {Math.round(macros.saturated.grams * 10) / 10} g · limit 20 g
                      </Text>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        )}
      </Card>
    </ScrollView>
  );
}

const styles = makeStyles(() => ({
  stats:      { flexDirection: 'row', gap: 8 },
  stat:       { flex: 1, padding: 12 },
  cap:        { fontSize: 11, color: colors.textSecondary },
  value:      { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginTop: 2 },
  valueSmall: { fontWeight: '700', color: colors.textPrimary },
  title:      { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  macroRow:   { flexDirection: 'row', alignItems: 'center', gap: 16 },
  donutCenter:{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  legendRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot:        { width: 8, height: 8, borderRadius: 4 },
}));
