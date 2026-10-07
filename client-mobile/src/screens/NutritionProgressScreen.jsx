import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { format } from 'date-fns';
import { nutritionAPI } from '../api';
import { Card, BarChart, Segmented, colors, makeStyles, Hint, ErrorText, Spinner } from '../components';
import {
  NUTRITION_METRICS, NUTRITION_RANGES, rangeDates, dailySeries, seriesStats, TARGET_RULE, formatMl,
} from '../../../client-web/src/utils/nutritionProgress';

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
}));
