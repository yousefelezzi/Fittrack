import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { format, subDays } from 'date-fns';
import { GlassWater, Trash2, Pencil } from 'lucide-react-native';
import { nutritionAPI, userAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { Card, Button, BarChart, colors, makeStyles, Hint, ErrorText, LinkText } from '../components';
import DayNav from '../components/DayNav';
import { WATER_PRESETS, formatMl, dailySeries } from '../../../client-web/src/utils/nutritionProgress';

const key = (d) => format(d, 'yyyy-MM-dd');

/** Water: log drinks for a day against a daily goal, and see the last 7 days. */
export default function HydrationScreen() {
  const { updateUser } = useAuth();
  const [date, setDate] = useState(key(new Date()));
  const [log, setLog] = useState(null);
  const [summary, setSummary] = useState(null);
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [goalInput, setGoalInput] = useState(null); // string while editing

  const load = useCallback(async () => {
    try {
      const [l, s] = await Promise.all([nutritionAPI.getByDate(date), nutritionAPI.summary(key(subDays(new Date(), 6)), key(new Date()))]);
      setLog(l.data);
      setSummary(s.data);
    } catch {
      setError('Could not load your water log');
    }
  }, [date]);
  useEffect(() => { load(); }, [load]);

  const drinks = log?.water || [];
  const total = drinks.reduce((n, w) => n + w.amount, 0);
  const goal = summary?.waterGoal || 2500;
  const pct = Math.min(100, Math.round((total / goal) * 100));

  const add = async (amount) => {
    const ml = Math.round(Number(amount));
    if (!(ml >= 1 && ml <= 5000)) { setError('Enter an amount between 1 and 5000 ml.'); return; }
    setBusy(true); setError('');
    try { setLog((await nutritionAPI.addWater(date, ml)).data); setCustom(''); load(); }
    catch (err) { setError(err.response?.data?.message || 'Could not log that'); }
    finally { setBusy(false); }
  };
  const remove = async (id) => {
    try { setLog((await nutritionAPI.deleteWater(id)).data); load(); } catch { setError('Could not remove that drink'); }
  };
  // The kind of water sets the minerals it adds to the day's micronutrients.
  const setWaterType = async (waterType) => {
    try { updateUser((await userAPI.updateMe({ waterType })).data); load(); } catch { setError('Could not save that'); }
  };
  const waterType = summary?.waterType || 'tap';
  const types = summary?.waterTypes || {};
  const minerals = Object.entries(log?.waterMicros || {}).filter(([, v]) => v > 0);
  const perLitre = (t) => Object.entries(types[t]?.perLitre || {}).filter(([, v]) => v > 0).map(([k, v]) => `${k} ${v} mg`).join(' · ');

  const saveGoal = async (value) => {
    try {
      const { data } = await userAPI.updateMe({ waterGoal: value });
      updateUser(data);
      setGoalInput(null);
      load();
    } catch (err) {
      setError(err.response?.data?.errors?.[0]?.message || err.response?.data?.message || 'Could not save your goal');
    }
  };

  const week = dailySeries(summary, 'water', 7).map((p) => ({
    key: p.date, label: format(new Date(`${p.date}T00:00`), 'EEE'), value: p.value || 0, color: (p.value || 0) >= goal ? colors.success : '#0ea5e9',
  }));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      <DayNav date={date} onChange={setDate} />
      <ErrorText>{error}</ErrorText>
      <Card>
        <View style={styles.between}>
          <View>
            <Text style={styles.cap}>Drunk</Text>
            <Text style={styles.big}>{formatMl(total)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.cap}>Daily goal</Text>
            {goalInput == null ? (
              <TouchableOpacity onPress={() => setGoalInput(String(goal))} style={styles.row} hitSlop={6}>
                <Text style={styles.goal}>{formatMl(goal)}</Text><Pencil size={13} color={colors.textMuted} />
              </TouchableOpacity>
            ) : (
              <View style={styles.row}>
                <TextInput style={styles.input} keyboardType="number-pad" value={goalInput} onChangeText={setGoalInput} placeholder="ml" placeholderTextColor={colors.textMuted} autoFocus />
                <LinkText onPress={() => saveGoal(Number(goalInput))}>Save</LinkText>
              </View>
            )}
          </View>
        </View>
        <View style={styles.track}><View style={[styles.fill, { width: `${pct}%`, backgroundColor: pct >= 100 ? colors.success : '#0ea5e9' }]} /></View>
        <Hint>{pct >= 100 ? 'Goal reached.' : `${formatMl(goal - total)} to go (${pct}%).`}</Hint>
        {goalInput != null ? <LinkText onPress={() => saveGoal(null)} style={{ marginTop: 4 }}>Use suggested (35 ml per kg)</LinkText> : null}

        <View style={[styles.row, { flexWrap: 'wrap', marginTop: 12 }]}>
          {WATER_PRESETS.map((ml) => (
            <TouchableOpacity key={ml} disabled={busy} onPress={() => add(ml)} style={styles.quick}>
              <GlassWater size={14} color={colors.brand} /><Text style={styles.quickText}>+{formatMl(ml)}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={[styles.row, { marginTop: 8 }]}>
          <TextInput style={[styles.input, { flex: 1 }]} keyboardType="number-pad" placeholder="Other amount (ml)" placeholderTextColor={colors.textMuted} value={custom} onChangeText={setCustom} />
          <Button title="Add" onPress={() => add(custom)} disabled={busy || !custom} style={{ paddingHorizontal: 18 }} />
        </View>
      </Card>

      <Card>
        <Text style={styles.title}>Drinks</Text>
        {drinks.length === 0 ? <Hint>Nothing logged{date === key(new Date()) ? ' yet today' : ''}.</Hint> : [...drinks].reverse().map((w) => (
          <View key={w._id} style={styles.drink}>
            <GlassWater size={16} color="#0ea5e9" />
            <Text style={[styles.goal, { flex: 1, fontSize: 14 }]}>{formatMl(w.amount)}</Text>
            <Text style={styles.cap}>{format(new Date(w.at), 'HH:mm')}</Text>
            <TouchableOpacity onPress={() => remove(w._id)} hitSlop={8}><Trash2 size={16} color={colors.textMuted} /></TouchableOpacity>
          </View>
        ))}
      </Card>

      <Card>
        <Text style={styles.title}>Your water</Text>
        <Hint style={{ marginBottom: 8 }}>Water has minerals too: they're added to the Food Log's micronutrients. Values are typical per litre; tap water varies by area and mineral waters list theirs on the label.</Hint>
        {Object.entries(types).map(([k, t]) => (
          <TouchableOpacity key={k} onPress={() => k !== waterType && setWaterType(k)} style={[styles.typeOption, waterType === k && styles.typeOptionOn]}>
            <Text style={[styles.goal, { fontSize: 14 }, waterType === k && { color: colors.brand }]}>{t.label}</Text>
            <Text style={styles.cap}>{perLitre(k)} per L</Text>
          </TouchableOpacity>
        ))}
        {minerals.length > 0 ? (
          <Text style={[styles.cap, { color: '#0ea5e9', marginTop: 6 }]}>From your water {date === key(new Date()) ? 'today' : 'this day'}: {minerals.map(([k, v]) => `${k} ${v} mg`).join(' · ')}</Text>
        ) : null}
      </Card>

      <Card>
        <Text style={styles.title}>Last 7 days</Text>
        <BarChart data={week} goal={goal} height={120} />
      </Card>
    </ScrollView>
  );
}

const styles = makeStyles(() => ({
  between:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 },
  row:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cap:       { fontSize: 12, color: colors.textSecondary },
  big:       { fontSize: 28, fontWeight: '700', color: colors.textPrimary },
  goal:      { fontSize: 17, fontWeight: '600', color: colors.textPrimary },
  title:     { fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 },
  track:     { height: 10, backgroundColor: colors.subtle, borderRadius: 999, overflow: 'hidden', marginBottom: 6 },
  fill:      { height: '100%', borderRadius: 999 },
  quick:     { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  quickText: { fontSize: 13, fontWeight: '600', color: colors.brand },
  input:     { minWidth: 80, height: 40, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 10, fontSize: 14, color: colors.textPrimary, backgroundColor: colors.surface },
  typeOption:   { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 6 },
  typeOptionOn: { borderColor: colors.brand, backgroundColor: colors.brandLight },
  drink:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.subtle },
}));
