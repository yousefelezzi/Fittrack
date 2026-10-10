import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { Text, TextInput } from '../components/AppText';
import { format } from 'date-fns';
import { Trash2 } from 'lucide-react-native';
import { weightAPI, userAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { Card, Button, LineChart, Segmented, colors, makeStyles, Hint, ErrorText } from '../components';
import DayNav from '../components/DayNav';
import { kgTo, toKgFrom, formatBodyWeight, weightSeries } from '../../../client-web/src/utils/bodyUnits';

const key = (d) => format(d, 'yyyy-MM-dd');
const RANGES = [[30, '30 days'], [90, '90 days'], [180, '6 months']];

/**
 * Body weight: a weigh-in per day. The profile weight (calorie targets, FFMI,
 * water goal) is the 7-day average; a day without a weigh-in uses the day before's.
 */
export default function WeightScreen() {
  const { user, updateUser } = useAuth();
  const unit = user?.bodyWeightUnit === 'lb' ? 'lb' : 'kg';
  const [date, setDate] = useState(key(new Date()));
  const [days, setDays] = useState(90);
  const [data, setData] = useState(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => weightAPI.list(days).then(({ data: d }) => setData(d)).catch(() => setError('Could not load your weigh-ins')), [days]);
  useEffect(() => { load(); }, [load]);

  const onDay = data?.entries.find((e) => e.date.slice(0, 10) === date);
  useEffect(() => { setInput(onDay ? String(kgTo(onDay.weight, unit)) : ''); }, [onDay?._id, unit]);

  const setUnit = async (u) => {
    try { updateUser((await userAPI.updateMe({ bodyWeightUnit: u })).data); } catch { setError('Could not save that'); }
  };
  const save = async () => {
    const kg = toKgFrom(input, unit);
    if (!(kg >= 20 && kg <= 400)) { setError(`Enter a weight between ${kgTo(20, unit)} and ${kgTo(400, unit)} ${unit}.`); return; }
    setBusy(true); setError('');
    try {
      const { data: res } = await weightAPI.log(date, kg);
      updateUser({ weight: res.average });
      load();
    } catch (err) {
      setError(err.response?.data?.errors?.[0]?.message || err.response?.data?.message || 'Could not save that');
    } finally { setBusy(false); }
  };
  const remove = async (id) => {
    try { const { data: res } = await weightAPI.delete(id); if (res.average != null) updateUser({ weight: res.average }); load(); }
    catch { setError('Could not remove that'); }
  };

  const series = data ? weightSeries(data.entries, data.before, days).map((p) => ({
    label: format(new Date(`${p.date}T00:00`), 'MMM d'),
    weight: p.weight == null ? null : kgTo(p.weight, unit),
    average: p.average == null ? null : kgTo(p.average, unit),
  })) : [];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      <Segmented value={unit} onChange={(u) => u !== unit && setUnit(u)} options={[['kg', 'kg'], ['lb', 'lb']]} style={{ marginBottom: 12, width: 120, alignSelf: 'flex-end' }} />
      <ErrorText>{error}</ErrorText>
      <Card>
        <Text style={styles.cap}>7-day average</Text>
        <Text style={styles.big}>{data?.average != null ? formatBodyWeight(data.average, unit) : '–'}</Text>
        <Hint>This is your profile weight, used for your calorie targets, FFMI and water goal. A day you don't weigh in counts as the day before's weight.</Hint>
      </Card>

      <Card>
        <Text style={styles.title}>Weigh-in</Text>
        <DayNav date={date} onChange={setDate} />
        <View style={styles.row}>
          <TextInput style={[styles.input, { flex: 1 }]} keyboardType="decimal-pad" placeholder={unit === 'lb' ? '176.4' : '80.0'} placeholderTextColor={colors.textMuted}
            value={input} onChangeText={setInput} />
          <Text style={styles.cap}>{unit}</Text>
          <Button title={onDay ? 'Update' : 'Save'} onPress={save} disabled={busy || !input} style={{ paddingHorizontal: 18 }} />
        </View>
        <Hint style={{ marginTop: 6 }}>Weigh at the same time each day, e.g. in the morning before eating.</Hint>
      </Card>

      <Card>
        <Text style={styles.title}>Trend</Text>
        <Segmented value={days} onChange={setDays} options={RANGES} style={{ marginBottom: 10 }} />
        {!data ? <Hint>Loading…</Hint> : series.every((p) => p.average == null) ? <Hint>Log your first weigh-in to see your trend.</Hint> : (
          <LineChart data={series} height={220} series={[
            { key: 'average', label: '7-day average', color: colors.brand },
            { key: 'weight', label: 'Weigh-ins', color: '#94a3b8', dots: true, line: false },
          ]} />
        )}
      </Card>

      {data?.entries?.length > 0 ? (
        <Card>
          <Text style={styles.title}>Weigh-ins</Text>
          {[...data.entries].reverse().map((e) => (
            <View key={e._id} style={styles.entry}>
              <Text style={[styles.cap, { flex: 1, color: colors.textPrimary }]}>{format(new Date(`${e.date.slice(0, 10)}T00:00`), 'EEE, MMM d')}</Text>
              <Text style={styles.value}>{formatBodyWeight(e.weight, unit)}</Text>
              <TouchableOpacity onPress={() => remove(e._id)} hitSlop={8}><Trash2 size={16} color={colors.textMuted} /></TouchableOpacity>
            </View>
          ))}
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = makeStyles(() => ({
  cap:   { fontSize: 13, color: colors.textSecondary },
  big:   { fontSize: 30, fontWeight: '700', color: colors.textPrimary, marginVertical: 4 },
  title: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 },
  row:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, fontSize: 16, color: colors.textPrimary, backgroundColor: colors.surface },
  entry: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, borderTopWidth: 1, borderTopColor: colors.subtle },
  value: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
}));
