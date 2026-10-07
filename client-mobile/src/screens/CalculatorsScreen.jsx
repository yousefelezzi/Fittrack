import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, Linking } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Card, Button, colors, makeStyles, Segmented, Chip, Label, Hint, LinkText, isDark } from '../components';
import { calcFFMI, ffmiCategory, calcBMR, calcTDEE, ACTIVITY_LEVELS, calcOneRepMax, repMaxTable, ONE_RM_MAX_REPS } from '../../../client-web/src/utils/calculators';
import { UNITS } from '../../../client-web/src/utils/weightUnits';
import {
  computeWNSResult, validateFreqValue, validateMaintValue, validateSetsValue, validateStimValue,
  validateRepsValue, validateRirValue, effectiveSetFactor,
} from '../../../client-web/src/utils/wnsCalculations';

function Field({ label, value, onChange, placeholder, error, onBlur, keyboardType = 'decimal-pad' }) {
  return (
    <View style={{ flex: 1 }}>
      <Label>{label}{error ? <Text style={styles.err}>  {error}</Text> : null}</Label>
      <TextInput style={[styles.field, error && { borderColor: colors.danger }]} value={value === '' || value == null ? '' : String(value)}
        onChangeText={onChange} onBlur={onBlur} placeholder={placeholder} placeholderTextColor={colors.textMuted} keyboardType={keyboardType} />
    </View>
  );
}

/** Info text that opens on tap (the web shows these as tooltips). */
function Info({ title, children }) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <TouchableOpacity onPress={() => setOpen(!open)} hitSlop={6}><Text style={styles.infoBtn}>ⓘ {title}</Text></TouchableOpacity>
      {open ? <View style={styles.infoBox}>{children}</View> : null}
    </View>
  );
}
const ExtLink = ({ url, children }) => <Text style={styles.extLink} onPress={() => Linking.openURL(url)}>{children}</Text>;

// ── FFMI ──────────────────────────────────────────────────────────────────────
const SCALE_MIN = 14;
const SCALE_MAX = 30;
const SCALE_COLORS = ['#38bdf8', '#22c55e', '#a3e635', '#eab308', '#f97316', '#ef4444'];

function FFMIScale({ value }) {
  const pct = Math.min(100, Math.max(0, ((value - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100));
  return (
    <View style={{ marginTop: 16 }}>
      <View style={{ height: 18 }}>
        <Text style={[styles.marker, { left: `${pct}%` }]}>▼ {value.toFixed(1)}</Text>
      </View>
      <View style={styles.scaleBar}>
        {SCALE_COLORS.map((c) => <View key={c} style={{ flex: 1, backgroundColor: c }} />)}
      </View>
      <View style={styles.scaleLabels}>{[14, 18, 22, 26, 30].map((v) => <Text key={v} style={styles.hintText}>{v}</Text>)}</View>
    </View>
  );
}

function FFMI({ user }) {
  const [weight, setWeight] = useState(user?.weight ?? '');
  const [height, setHeight] = useState(user?.height ?? '');
  const [bodyFat, setBodyFat] = useState(user?.bodyFat ?? '');
  const result = useMemo(() => {
    const w = Number(weight), h = Number(height), bf = Number(bodyFat);
    if (!w || !h || bodyFat === '' || isNaN(bf) || w <= 0 || h <= 0 || bf < 0 || bf >= 100) return null;
    return calcFFMI(w, h, bf);
  }, [weight, height, bodyFat]);

  return (
    <>
      <Hint style={{ marginBottom: 8 }}>Fat-Free Mass Index estimates how much muscle you carry relative to your height, adjusted so it can be compared across heights.</Hint>
      <Card>
        <View style={styles.row}>
          <Field label="Weight (kg)" value={weight} onChange={setWeight} placeholder="70" />
          <Field label="Height (cm)" value={height} onChange={setHeight} placeholder="175" />
          <Field label="Body fat %" value={bodyFat} onChange={setBodyFat} placeholder="15" />
        </View>
        {result ? (
          <View style={styles.result}>
            <View style={styles.row}>
              <View style={styles.stat}><Text style={styles.statCap}>FAT-FREE MASS</Text><Text style={styles.statVal}>{result.ffm.toFixed(1)} kg</Text></View>
              <View style={styles.stat}><Text style={styles.statCap}>FFMI</Text><Text style={styles.statVal}>{result.ffmi.toFixed(1)}</Text></View>
              <View style={styles.stat}><Text style={styles.statCap}>NORMALIZED</Text><Text style={[styles.statVal, { color: colors.brand }]}>{result.normalizedFfmi.toFixed(1)}</Text></View>
            </View>
            <Text style={styles.category}>{ffmiCategory(result.normalizedFfmi)}</Text>
            <FFMIScale value={result.normalizedFfmi} />
          </View>
        ) : <Hint style={{ marginTop: 12 }}>Enter your weight, height and body fat % to see your FFMI.</Hint>}
      </Card>
      <Card>
        <Text style={styles.body}><Text style={styles.bold}>Normalized FFMI</Text> adjusts for height so people of different heights can be compared on the same scale. The categories are calibrated for men; for women, subtract roughly 4–5 points from each threshold.</Text>
        <Text style={[styles.body, { marginTop: 8 }]}>Most natural lifters top out around 25. Values well above that are unusual without pharmaceutical assistance — treat FFMI as a rough guide, not a verdict.</Text>
      </Card>
    </>
  );
}

// ── BMR & TDEE ───────────────────────────────────────────────────────────────
function TDEE({ user }) {
  const defaultAge = user?.dateOfBirth ? Math.floor((Date.now() - new Date(user.dateOfBirth)) / (365.25 * 86400000)) : '';
  const [weight, setWeight] = useState(user?.weight ?? '');
  const [height, setHeight] = useState(user?.height ?? '');
  const [age, setAge] = useState(defaultAge);
  const [sex, setSex] = useState(user?.sex || 'male');
  const [activity, setActivity] = useState(user?.activityLevel || ACTIVITY_LEVELS[2].value);
  const { bmr, tdee } = useMemo(() => {
    const w = Number(weight), h = Number(height), a = Number(age);
    if (!w || !h || !a || w <= 0 || h <= 0 || a <= 0) return {};
    const b = calcBMR(w, h, a, sex);
    return { bmr: b, tdee: calcTDEE(b, Number(activity)) };
  }, [weight, height, age, sex, activity]);

  return (
    <>
      <Hint style={{ marginBottom: 8 }}>BMR is roughly how many calories your body burns at complete rest. TDEE adds your activity on top to give your maintenance calories.</Hint>
      <Card>
        <View style={styles.row}>
          <Field label="Weight (kg)" value={weight} onChange={setWeight} placeholder="70" />
          <Field label="Height (cm)" value={height} onChange={setHeight} placeholder="175" />
          <Field label="Age" value={age} onChange={setAge} placeholder="30" keyboardType="number-pad" />
        </View>
        <Label>Sex</Label>
        <Segmented value={sex} onChange={setSex} options={[['male', 'Male'], ['female', 'Female']]} />
        <Label>Activity level</Label>
        {ACTIVITY_LEVELS.map((lvl) => (
          <TouchableOpacity key={lvl.value} onPress={() => setActivity(lvl.value)} style={[styles.option, activity === lvl.value && styles.optionActive]}>
            <Text style={[styles.optionText, activity === lvl.value && { color: colors.brand, fontWeight: '600' }]}>{lvl.label}</Text>
            <Text style={styles.hintText}>{lvl.hint}</Text>
          </TouchableOpacity>
        ))}
        {tdee ? (
          <View style={styles.result}>
            <Text style={[styles.statCap, { textAlign: 'center' }]}>MAINTENANCE (TDEE)</Text>
            <Text style={styles.big}>{Math.round(tdee)} <Text style={styles.bigUnit}>kcal/day</Text></Text>
            <Text style={[styles.hintText, { textAlign: 'center' }]}>BMR: {Math.round(bmr)} kcal/day</Text>
            <View style={[styles.row, { marginTop: 12 }]}>
              {[['Mild loss', tdee - 250, '~0.25 kg/wk'], ['Maintain', tdee, '±0 kg/wk'], ['Mild gain', tdee + 250, '~0.25 kg/wk']].map(([l, v, s]) => (
                <View key={l} style={styles.box}><Text style={styles.hintText}>{l}</Text><Text style={styles.boxVal}>{Math.round(v)}</Text><Text style={styles.hintText}>{s}</Text></View>
              ))}
            </View>
          </View>
        ) : <Hint style={{ marginTop: 12 }}>Fill in your details to see your TDEE.</Hint>}
      </Card>
      <Card>
        <Text style={styles.body}>BMR uses the <Text style={styles.bold}>Mifflin-St Jeor equation</Text>, which most dietitians consider the most accurate for the general population. TDEE = BMR × activity multiplier.</Text>
        <Text style={[styles.body, { marginTop: 8 }]}>The loss/gain estimates assume roughly 3,500 kcal per 0.45 kg (1 lb) of body weight, so treat them as a starting point to adjust from based on real-world results.</Text>
      </Card>
    </>
  );
}

// ── WNS ───────────────────────────────────────────────────────────────────────
const DEFAULT_PROGRAM = { unit: 'T', freq: '', sets: '', reps: '', rir: '' };
// A scale from very green (best) through lime, yellow and orange to red (worst).
// Light mode: pastel fill, dark text. Dark mode: see-through tint, bright text.
const TONES = {
  deepGreen: { light: ['#86efac', '#052e16', '#22c55e'], dark: ['rgba(34,197,94,0.38)', '#4ade80', 'rgba(74,222,128,0.85)'] },
  green:     { light: ['#bbf7d0', '#14532d', '#4ade80'], dark: ['rgba(34,197,94,0.14)', '#86efac', 'rgba(34,197,94,0.4)'] },
  lime:      { light: ['#d9f99d', '#365314', '#a3e635'], dark: ['rgba(132,204,22,0.16)', '#bef264', 'rgba(132,204,22,0.5)'] },
  yellow:    { light: ['#fef08a', '#713f12', '#facc15'], dark: ['rgba(234,179,8,0.16)', '#fde047', 'rgba(234,179,8,0.5)'] },
  orange:    { light: ['#fed7aa', '#7c2d12', '#fb923c'], dark: ['rgba(249,115,22,0.16)', '#fdba74', 'rgba(249,115,22,0.5)'] },
  red:       { light: ['#fecaca', '#7f1d1d', '#f87171'], dark: ['rgba(239,68,68,0.16)', '#fca5a5', 'rgba(239,68,68,0.5)'] },
  deepRed:   { light: ['#fca5a5', '#450a0a', '#ef4444'], dark: ['rgba(220,38,38,0.32)', '#fecaca', 'rgba(248,113,113,0.7)'] },
  neutral:   { light: ['#e5e7eb', '#374151', '#d1d5db'], dark: ['rgba(255,255,255,0.06)', '#9ca3af', 'rgba(255,255,255,0.14)'] },
};
// Best → worst stimulus: the more stimulus, the greener (lime → green → very green).
const RESULT_TONE = { veryHigh: 'deepGreen', High: 'green', Low: 'lime', veryLow: 'yellow', Medium: 'orange', Bad: 'red', veryBad: 'deepRed' };
// Lowest → highest recovery demand.
const WARNING_TONE = { veryLow: 'green', Low: 'lime', Medium: 'yellow', High: 'orange', veryHigh: 'red' };
const toneStyle = (name) => {
  const [backgroundColor, color, borderColor] = (TONES[name] || TONES.neutral)[isDark() ? 'dark' : 'light'];
  return { backgroundColor, color, borderColor };
};

function Program({ id, program, errors, onChange, onBlur, onCalculate, result, boxed }) {
  return (
    <View style={boxed && styles.programBox}>
      {boxed ? <Text style={styles.bold}>Program {id}</Text> : null}
      <Label>Frequency unit</Label>
      <Segmented value={program.unit} onChange={(v) => onChange(id, 'unit', v)} options={[['T', '× / week'], ['D', 'every x days'], ['H', 'every x hours']]} />
      <View style={styles.row}>
        <Field label="Frequency" value={program.freq} onChange={(v) => onChange(id, 'freq', v)} placeholder="e.g. 2" error={errors[`freq${id}`]} onBlur={() => onBlur(id, 'freq')} />
        <Field label="Sets per workout" value={program.sets} onChange={(v) => onChange(id, 'sets', v)} placeholder="e.g. 3" error={errors[`sets${id}`]} onBlur={() => onBlur(id, 'sets')} />
      </View>
      <View style={styles.row}>
        <Field label="Reps" value={program.reps} onChange={(v) => onChange(id, 'reps', v)} placeholder="Optional, e.g. 10" error={errors[`reps${id}`]} keyboardType="number-pad" />
        <Field label="RIR" value={program.rir} onChange={(v) => onChange(id, 'rir', v)} placeholder="Optional, e.g. 1" error={errors[`rir${id}`]} />
      </View>
      <Info title="About reps and RIR">
        <Text style={styles.hintText}><Text style={styles.bold}>Reps:</Text> how many reps you do in each set. Very low-rep sets (under 5) count for a little less than a full set.</Text>
        <Text style={styles.hintText}><Text style={styles.bold}>RIR</Text> (reps in reserve): how many more reps you could have done before reaching failure. The closer to failure, the more a set counts; sets stopped far from failure barely count.</Text>
        <Text style={styles.hintText}>Leave both blank to count every set in full.</Text>
      </Info>
      <Button title="Calculate" onPress={() => onCalculate(id)} style={{ marginTop: 12 }} />
      {result && (
        <View style={{ marginTop: 10, gap: 6 }}>
          {result.factor < 1 && (
            <Text style={styles.body}>Counts as <Text style={styles.bold}>{result.effective} effective set{result.effective !== 1 ? 's' : ''}</Text> per workout</Text>
          )}
          <Text style={[styles.resultPill, toneStyle(RESULT_TONE[result.resultClass])]}>{result.text}</Text>
          {result.warning && <Text style={[styles.resultPill, { fontSize: 12 }, toneStyle(WARNING_TONE[result.warning.className])]}>{result.warning.text}</Text>}
        </View>
      )}
    </View>
  );
}

function WNS({ onAbout }) {
  const [dataset, setDataset] = useState('S');
  const [maintenance, setMaintenance] = useState('');
  const [stim, setStim] = useState('');
  const [compare, setCompare] = useState(false);
  const [programs, setPrograms] = useState({ A: { ...DEFAULT_PROGRAM }, B: { ...DEFAULT_PROGRAM } });
  const [errors, setErrors] = useState({});
  const [results, setResults] = useState({ A: null, B: null });

  const onChange = (id, field, value) => {
    setPrograms((p) => ({ ...p, [id]: { ...p[id], [field]: value } }));
    setErrors((e) => ({ ...e, [`${field}${id}`]: null }));
  };
  const onBlur = (id, field) => setErrors((e) => ({
    ...e, [`${field}${id}`]: field === 'freq' ? validateFreqValue(programs[id].freq, programs[id].unit) : validateSetsValue(programs[id].sets),
  }));
  const calculate = (id) => {
    const p = programs[id];
    const msgs = {
      [`freq${id}`]: validateFreqValue(p.freq, p.unit),
      [`sets${id}`]: validateSetsValue(p.sets),
      [`reps${id}`]: validateRepsValue(p.reps),
      [`rir${id}`]: validateRirValue(p.rir),
      maintenance: validateMaintValue(maintenance),
      stim: validateStimValue(stim),
    };
    setErrors((e) => ({ ...e, ...msgs }));
    if (Object.values(msgs).some(Boolean)) { setResults((r) => ({ ...r, [id]: null })); return; }
    // Only the last 5 reps before failure count, so sets short of failure count as part of a set.
    const factor = effectiveSetFactor(p.reps, p.rir);
    const effective = Math.round(parseFloat(p.sets) * factor * 100) / 100;
    const result = computeWNSResult({ unit: p.unit, freq: p.freq, sets: String(effective), maintenance, stimHours: stim, dataset });
    setResults((r) => ({ ...r, [id]: { ...result, effective, factor, sets: parseFloat(p.sets) } }));
  };
  const toggleCompare = () => {
    setResults((r) => ({ ...r, B: null }));
    setPrograms((p) => ({ ...p, B: { ...DEFAULT_PROGRAM } }));
    setCompare((c) => !c);
  };
  const shared = { errors, onChange, onBlur, onCalculate: calculate };

  return (
    <>
      <Hint style={{ marginBottom: 8 }}>Estimate the weekly hypertrophy effect of a training program by balancing training stimulus against atrophy.</Hint>
      <Card>
        <View style={[styles.row, { alignItems: 'center', justifyContent: 'space-between' }]}>
          <Text style={styles.bold}>Training parameters</Text>
          <Chip small label={compare ? 'Close comparison' : 'Compare programs'} active={compare} onPress={toggleCompare} />
        </View>
        <Label>Dataset</Label>
        <Segmented value={dataset} onChange={setDataset} options={[['S', 'Schoenfeld'], ['P', 'Pelland'], ['A', 'Average']]} />
        <Info title="About the datasets">
          <Text style={styles.hintText}>The reference dataset for the volume–stimulus relationship.</Text>
          <Text style={styles.hintText}><ExtLink url="https://doi.org/10.1080/02640414.2016.1210197">Schoenfeld</ExtLink>: pronouncedly diminishing returns (6 sets = 2× the stimulus of 1 set).</Text>
          <Text style={styles.hintText}><ExtLink url="https://doi.org/10.51224/SRXIV.460">Pelland</ExtLink>: subtly diminishing returns (6 sets = 4× the stimulus of 1 set).</Text>
        </Info>
        <View style={styles.row}>
          <Field label="Maintenance" value={maintenance} onChange={(v) => { setMaintenance(v); setErrors((e) => ({ ...e, maintenance: null })); }}
            placeholder="1–5 sets, 1×/wk" error={errors.maintenance} onBlur={() => setErrors((e) => ({ ...e, maintenance: validateMaintValue(maintenance) }))} />
          <Field label="Stimulus (h)" value={stim} onChange={(v) => { setStim(v); setErrors((e) => ({ ...e, stim: null })); }}
            placeholder="12–72 hours" error={errors.stim} onBlur={() => setErrors((e) => ({ ...e, stim: validateStimValue(stim) }))} />
        </View>
        <Info title="About these inputs">
          <Text style={styles.hintText}>Maintenance: sets per week (once a week) to maintain a muscle. Studies find <ExtLink url="https://journals.lww.com/acsm-msse/fulltext/2011/07000/exercise_dosing_to_retain_resistance_training.7.aspx">3 sets</ExtLink> or <ExtLink url="https://doi.org/10.3390/sports12070198">4 sets</ExtLink>.</Text>
          <Text style={styles.hintText}>Stimulus duration: how long growth lasts before atrophy begins; research suggests 36–48 hours.</Text>
          <Text style={styles.hintText}>Sets per workout are per muscle; if they vary, enter the average (2 one day, 3 another = 2.5).</Text>
        </Info>

        <View style={{ marginTop: 10, gap: 12 }}>
          <Program id="A" boxed={compare} program={programs.A} result={results.A} {...shared} />
          {compare && <Program id="B" boxed program={programs.B} result={results.B} {...shared} />}
        </View>
      </Card>
      <Card>
        <Text style={styles.body}><Text style={styles.bold}>Weekly Net Stimulus</Text> weighs the hypertrophy stimulus from your training against the muscle lost to atrophy between sessions, so a program with more volume isn't automatically scored higher if it's poorly timed.</Text>
        <Text style={[styles.body, { marginTop: 8 }]}>A result of N/A means the program was found unrecoverable before a score could be calculated.</Text>
        <View style={[styles.row, { marginTop: 10, gap: 16 }]}>
          <LinkText onPress={onAbout}>How this works →</LinkText>
          <LinkText onPress={() => Linking.openURL('https://payhip.com/b/NeuDm')}>Full Training Program Guide</LinkText>
        </View>
      </Card>
    </>
  );
}

// ── One-rep max ──────────────────────────────────────────────────────────────
const roundToPlates = (n, unit) => { const step = unit === 'lb' ? 5 : 2.5; return Math.round(n / step) * step; };

/** One-rep max from a set (weight × reps, plus reps in reserve), and what you could do for 1–12 reps. */
function OneRepMax({ user }) {
  const [unit, setUnit] = useState(user?.weightUnit === 'lb' ? 'lb' : 'kg');
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [rir, setRir] = useState('');
  const oneRm = calcOneRepMax(weight, reps, rir);
  const effective = (Number(reps) || 0) + (Number(rir) || 0);
  return (
    <>
      <Card>
        <Text style={styles.body}>Estimates the most you could lift for one rep from a set you've done. Reps in reserve count as reps, so 5 reps with 1 left in the tank counts like a 6-rep max. It's the same estimate your progress charts use.</Text>
        <Segmented value={unit} onChange={setUnit} options={UNITS.map((u) => [u, u])} style={{ marginTop: 12, width: 120 }} />
        <View style={styles.row}>
          <Field label={`Weight (${unit})`} value={weight} onChange={setWeight} placeholder={unit === 'lb' ? '225' : '100'} />
          <Field label="Reps" value={reps} onChange={setReps} placeholder="5" keyboardType="number-pad" />
          <Field label="RIR (optional)" value={rir} onChange={setRir} placeholder="0" keyboardType="number-pad" />
        </View>
        {oneRm ? (
          <View style={styles.result}>
            <Text style={[styles.statCap, { textAlign: 'center' }]}>ESTIMATED 1RM</Text>
            <Text style={[styles.statVal, { fontSize: 32, textAlign: 'center' }]}>{Math.round(oneRm * 10) / 10} {unit}</Text>
            {effective > ONE_RM_MAX_REPS ? (
              <Hint style={{ marginTop: 6, textAlign: 'center', color: colors.warning }}>
                With {effective} reps to failure this is a rough guess. Estimates are most accurate from sets of {ONE_RM_MAX_REPS} reps or fewer.
              </Hint>
            ) : null}
          </View>
        ) : <Hint style={{ marginTop: 12 }}>Enter the weight and reps of a set to see your estimated one-rep max.</Hint>}
      </Card>
      {oneRm ? (
        <Card>
          <Text style={styles.bold}>Rep maxes</Text>
          <Hint style={{ marginBottom: 6 }}>What you could lift for each number of reps to failure, rounded to the nearest {unit === 'lb' ? '5 lb' : '2.5 kg'}.</Hint>
          {repMaxTable(oneRm).map((row) => (
            <View key={row.reps} style={styles.repRow}>
              <Text style={[styles.body, { width: 60 }]}>{row.reps} rep{row.reps !== 1 ? 's' : ''}</Text>
              <Text style={[styles.bold, { flex: 1, textAlign: 'right' }]}>{roundToPlates(row.weight, unit)} {unit}</Text>
              <Text style={[styles.hintText, { width: 50, textAlign: 'right' }]}>{row.percent}%</Text>
            </View>
          ))}
        </Card>
      ) : null}
    </>
  );
}

export default function CalculatorsScreen({ navigation, route }) {
  const { user } = useAuth();
  const [tab, setTab] = useState(route?.params?.calc || 'ffmi');
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Segmented value={tab} onChange={setTab} style={{ marginBottom: 12 }} options={[['ffmi', 'FFMI'], ['tdee', 'BMR & TDEE'], ['wns', 'WNS'], ['1rm', '1RM']]} />
        {tab === 'ffmi' && <FFMI user={user} />}
        {tab === 'tdee' && <TDEE user={user} />}
        {tab === 'wns' && <WNS onAbout={() => navigation.navigate('AboutWNS')} />}
        {tab === '1rm' && <OneRepMax user={user} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = makeStyles(() => ({
  row:        { flexDirection: 'row', gap: 10 },
  repRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.subtle },
  field:      { height: 42, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 10, fontSize: 15, color: colors.textPrimary },
  err:        { fontSize: 11, color: colors.danger, fontWeight: '400' },
  result:     { marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border },
  stat:       { flex: 1, alignItems: 'center' },
  statCap:    { fontSize: 10, color: colors.textMuted, letterSpacing: 0.5 },
  statVal:    { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginTop: 2 },
  category:   { alignSelf: 'center', marginTop: 10, fontSize: 12, fontWeight: '600', color: colors.brand, backgroundColor: colors.brandLight, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  marker:     { position: 'absolute', fontSize: 11, fontWeight: '700', color: colors.textPrimary, transform: [{ translateX: -6 }] },
  scaleBar:   { height: 12, borderRadius: 999, overflow: 'hidden', flexDirection: 'row' },
  scaleLabels:{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 },
  hintText:   { fontSize: 11, color: colors.textMuted, lineHeight: 16 },
  body:       { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  bold:       { fontWeight: '700', color: colors.textPrimary },
  option:     { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, marginBottom: 6 },
  optionActive:{ borderColor: colors.brand, backgroundColor: colors.brandLight },
  optionText: { fontSize: 14, color: colors.textPrimary },
  big:        { fontSize: 30, fontWeight: '800', color: colors.brand, textAlign: 'center' },
  bigUnit:    { fontSize: 14, fontWeight: '500', color: colors.textMuted },
  box:        { flex: 1, alignItems: 'center', backgroundColor: colors.inset, borderRadius: 12, padding: 10 },
  boxVal:     { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  programBox: { backgroundColor: colors.inset, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border },
  resultPill: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontWeight: '700', overflow: 'hidden' },
  infoBtn:    { fontSize: 12, color: colors.brand, marginTop: 8 },
  infoBox:    { backgroundColor: colors.inset, borderRadius: 10, padding: 10, marginTop: 6, gap: 4 },
  extLink:    { color: colors.brand, textDecorationLine: 'underline' },
}));
