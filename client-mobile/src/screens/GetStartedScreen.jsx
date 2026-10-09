/**
 * Get Started: right after signing up, the new user enters their body stats,
 * body fat estimate, activity level and goal (used for calorie goals, FFMI and
 * training level). Each can be changed later in the profile. Shown instead of
 * the tabs until it's finished or skipped.
 */
import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { Check, ChevronLeft } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { userAPI } from '../api';
import { Card, Button, Segmented, Label, Hint, colors, makeStyles } from '../components';
import { ftInToCm, toKgFrom } from '../../../client-web/src/utils/bodyUnits';
import { ACTIVITY_LEVELS } from '../../../client-web/src/utils/calculators';
import { GOALS, STEPS, bodyFatOptions, checkBasics } from '../../../client-web/src/utils/onboarding';

const pad = (n) => String(n).padStart(2, '0');

function Choice({ active, onPress, title, hint }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={[styles.choice, active && styles.choiceOn]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.choiceTitle, active && { color: colors.brand }]}>{title}</Text>
        {hint ? <Text style={styles.choiceHint}>{hint}</Text> : null}
      </View>
      {active ? <Check size={18} color={colors.brand} /> : null}
    </TouchableOpacity>
  );
}

export default function GetStartedScreen() {
  const { user, updateUser } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    sex: '', day: '', month: '', year: '',
    heightUnit: 'cm', height: '', heightFt: '', heightIn: '',
    weightUnit: 'kg', weight: '',
    bodyFat: null, bodyFatExact: '', exact: false,
    activityLevel: null, fitnessGoal: null,
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setError(''); };
  const num = (v) => String(v).replace(',', '.');

  const dateOfBirth = form.year.length === 4 && form.month && form.day ? `${form.year}-${pad(form.month)}-${pad(form.day)}` : '';
  const heightCm = form.heightUnit === 'ft'
    ? (form.heightFt !== '' || form.heightIn !== '' ? ftInToCm(form.heightFt, form.heightIn) : 0)
    : Number(num(form.height)) || 0;
  const weightKg = form.weight === '' ? 0 : toKgFrom(num(form.weight), form.weightUnit);
  const bodyFat = form.exact ? (form.bodyFatExact === '' ? null : Number(num(form.bodyFatExact))) : form.bodyFat;

  const finish = async (payload) => {
    setSaving(true);
    setError('');
    try {
      const { data } = await userAPI.updateMe({ ...payload, onboarded: true });
      updateUser(data); // onboardedAt set: the app switches to the tabs
    } catch (err) {
      setError(err.response?.data?.errors?.[0]?.message || err.response?.data?.message || 'Could not save that');
      setSaving(false);
    }
  };

  const next = () => {
    if (step === 0) {
      const validDate = dateOfBirth && new Date(`${dateOfBirth}T00:00`).getDate() === Number(form.day);
      const problem = checkBasics({ sex: form.sex, dateOfBirth: validDate ? dateOfBirth : '', heightCm, weightKg });
      if (problem) { setError(problem); return; }
    }
    if (step === 1 && form.exact && form.bodyFatExact !== '' && !(bodyFat >= 3 && bodyFat <= 70)) { setError('Body fat must be between 3 and 70%.'); return; }
    if (step === 2 && !form.activityLevel) { setError('Pick the one closest to your week.'); return; }
    if (step < STEPS.length - 1) { setStep(step + 1); setError(''); return; }
    if (!form.fitnessGoal) { setError('Pick a goal.'); return; }
    finish({
      sex: form.sex,
      dateOfBirth,
      height: Math.round(heightCm * 10) / 10,
      heightUnit: form.heightUnit,
      weight: Math.round(weightKg * 100) / 100,
      weightDate: format(new Date(), 'yyyy-MM-dd'),
      bodyWeightUnit: form.weightUnit,
      bodyFat,
      activityLevel: form.activityLevel,
      fitnessGoal: form.fitnessGoal,
    });
  };

  const input = (k, placeholder, opts = {}) => (
    <TextInput style={[styles.input, opts.style]} value={form[k]} onChangeText={(v) => set(k, v)} placeholder={placeholder}
      placeholderTextColor={colors.textMuted} keyboardType={opts.keyboardType || 'decimal-pad'} maxLength={opts.maxLength} />
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Let's get you started{user?.name ? `, ${user.name.split(' ')[0]}` : ''}</Text>
          <Text style={styles.subtitle}>A few details to set your calorie goals and training level. You can change them later.</Text>

          <View style={styles.progress}>
            {STEPS.map((s, i) => (
              <View key={s} style={{ flex: 1 }}>
                <View style={[styles.bar, i <= step && { backgroundColor: colors.brand }]} />
                <Text style={[styles.stepLabel, i === step && { color: colors.brand, fontWeight: '700' }]}>{s}</Text>
              </View>
            ))}
          </View>

          <Card>
            {step === 0 ? (
              <>
                <Label>Sex</Label>
                <View style={styles.row}>
                  {[['male', 'Male'], ['female', 'Female']].map(([v, l]) => (
                    <View key={v} style={{ flex: 1 }}><Choice active={form.sex === v} onPress={() => set('sex', v)} title={l} /></View>
                  ))}
                </View>
                <Label style={{ marginTop: 10 }}>Date of birth</Label>
                <View style={styles.row}>
                  {input('day', 'Day', { keyboardType: 'number-pad', maxLength: 2, style: { flex: 1 } })}
                  {input('month', 'Month', { keyboardType: 'number-pad', maxLength: 2, style: { flex: 1 } })}
                  {input('year', 'Year', { keyboardType: 'number-pad', maxLength: 4, style: { flex: 1.4 } })}
                </View>
                <View style={[styles.row, styles.between, { marginTop: 10 }]}>
                  <Label>Height</Label>
                  <Segmented value={form.heightUnit} onChange={(v) => set('heightUnit', v)} options={[['cm', 'cm'], ['ft', 'ft-in']]} style={{ width: 130 }} />
                </View>
                {form.heightUnit === 'ft' ? (
                  <View style={styles.row}>
                    {input('heightFt', 'ft, e.g. 5', { keyboardType: 'number-pad', style: { flex: 1 } })}
                    {input('heightIn', 'in, e.g. 10.5', { style: { flex: 1 } })}
                  </View>
                ) : input('height', 'e.g. 175')}
                <View style={[styles.row, styles.between, { marginTop: 10 }]}>
                  <Label>Weight</Label>
                  <Segmented value={form.weightUnit} onChange={(v) => set('weightUnit', v)} options={[['kg', 'kg'], ['lb', 'lb']]} style={{ width: 130 }} />
                </View>
                {input('weight', form.weightUnit === 'lb' ? 'e.g. 165' : 'e.g. 75')}
              </>
            ) : null}

            {step === 1 ? (
              <>
                <Text style={styles.question}>Roughly how much body fat do you have?</Text>
                <Hint style={{ marginBottom: 10 }}>A guess is fine. It's used for your FFMI and training level, and never shown to others.</Hint>
                {!form.exact ? bodyFatOptions(form.sex).map(([v, l, h]) => (
                  <Choice key={v} active={form.bodyFat === v} onPress={() => set('bodyFat', form.bodyFat === v ? null : v)} title={l} hint={h} />
                )) : (
                  <>
                    <Label>Body fat (%)</Label>
                    {input('bodyFatExact', 'e.g. 18')}
                  </>
                )}
                <View style={[styles.row, styles.between, { marginTop: 8 }]}>
                  <TouchableOpacity onPress={() => set('exact', !form.exact)} hitSlop={6}>
                    <Text style={styles.link}>{form.exact ? 'Pick a rough level instead' : 'I know my exact %'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setForm((f) => ({ ...f, bodyFat: null, bodyFatExact: '', exact: false })); setStep(2); setError(''); }} hitSlop={6}>
                    <Text style={styles.muted}>Not sure, skip</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <Text style={[styles.question, { marginBottom: 10 }]}>How active is your usual week?</Text>
                {ACTIVITY_LEVELS.map((a) => <Choice key={a.value} active={form.activityLevel === a.value} onPress={() => set('activityLevel', a.value)} title={a.label} hint={a.hint} />)}
                <Hint>Count workouts here; steps you log are added on top each day.</Hint>
              </>
            ) : null}

            {step === 3 ? (
              <>
                <Text style={[styles.question, { marginBottom: 10 }]}>What's your main goal?</Text>
                {GOALS.map(([v, l, h]) => <Choice key={v} active={form.fitnessGoal === v} onPress={() => set('fitnessGoal', v)} title={l} hint={h} />)}
              </>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={[styles.row, { marginTop: 14 }]}>
              {step > 0 ? (
                <TouchableOpacity onPress={() => { setStep(step - 1); setError(''); }} style={styles.back}>
                  <ChevronLeft size={18} color={colors.textSecondary} /><Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
              ) : null}
              <Button title={saving ? 'Saving…' : step === STEPS.length - 1 ? 'Finish' : 'Next'} onPress={next} loading={saving} disabled={saving} style={{ flex: 1 }} />
            </View>
          </Card>

          <TouchableOpacity onPress={() => finish({})} disabled={saving} style={{ alignSelf: 'center', marginTop: 8 }} hitSlop={8}>
            <Text style={styles.muted}>Skip for now</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = makeStyles(() => ({
  container:  { padding: 20, paddingBottom: 40 },
  title:      { fontSize: 24, fontWeight: '700', color: colors.textPrimary, marginTop: 8 },
  subtitle:   { fontSize: 14, color: colors.textSecondary, marginTop: 4, marginBottom: 16, lineHeight: 20 },
  progress:   { flexDirection: 'row', gap: 6, marginBottom: 12 },
  bar:        { height: 5, borderRadius: 3, backgroundColor: colors.subtle },
  stepLabel:  { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  row:        { flexDirection: 'row', alignItems: 'center', gap: 8 },
  between:    { justifyContent: 'space-between', marginBottom: 6 },
  input:      { height: 46, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, fontSize: 15, color: colors.textPrimary, backgroundColor: colors.surface },
  choice:     { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 2, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 8 },
  choiceOn:   { borderColor: colors.brand, backgroundColor: colors.brandLight },
  choiceTitle:{ fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  choiceHint: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  question:   { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  link:       { fontSize: 14, fontWeight: '600', color: colors.brand },
  muted:      { fontSize: 14, color: colors.textMuted },
  error:      { fontSize: 13, color: colors.danger, marginTop: 10 },
  back:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 10 },
  backText:   { fontSize: 15, color: colors.textSecondary, fontWeight: '600' },
}));
