import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { format, addDays, subDays, parseISO, isToday } from 'date-fns';
import { nutritionAPI, foodAPI } from '../api';
import { Card, Spinner, colors, makeStyles, Sheet, Chip, ChipRow, Hint, ErrorText, LinkText, confirm } from '../components';
import {
  FoodSearch, PortionSelector, ManualEntry, CustomFoodForm, RecipeBuilder, RecipeEditor, RecipeMealEditor, QuickAddEditor, Btn,
} from '../components/nutrition/FoodForms';
import { MEAL_TYPES, DIETS, PROFILE_FIELD_NAMES } from '../../../client-web/src/constants/nutrition';
import { MACRO_COLORS, MICRO_CONFIG, sumMicros, addMicros, r, r0, GOAL_NAMES } from '../../../client-web/src/utils/foodLogic';
import { formatServing } from '../../../client-web/src/utils/servings';
import { ChefHat, Plus, Sparkles, RefreshCw, Salad, X } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { adaptiveText } from '../../../client-web/src/utils/nutritionProgress';

const ymd = (d) => format(d, 'yyyy-MM-dd');

// ── Macro donut + micronutrients ────────────────────────────────────────────
function MacroDonut({ totals }) {
  // Split by calories, not grams: fat is 9 kcal/g, protein and carbs 4.
  const data = [['protein', totals.protein * 4], ['carbs', totals.carbs * 4], ['fat', totals.fat * 9]].filter(([, v]) => v > 0);
  const total = data.reduce((s, [, v]) => s + v, 0);
  const R = 34;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <Svg width={90} height={90} viewBox="0 0 90 90">
      <Circle cx={45} cy={45} r={R} stroke={colors.subtle} strokeWidth={14} fill="none" />
      {data.map(([k, v]) => {
        const len = (v / total) * C;
        const el = (
          <Circle key={k} cx={45} cy={45} r={R} stroke={MACRO_COLORS[k]} strokeWidth={14} fill="none"
            strokeDasharray={`${Math.max(0, len - 2)} ${C}`} strokeDashoffset={-offset} rotation={-90} origin="45, 45" />
        );
        offset += len;
        return el;
      })}
    </Svg>
  );
}

// `supplementMicros` / `waterMicros`: vitamins and minerals from the supplements
// ticked off today and the water drunk.
function MacroCard({ totals, meals, supplementMicros, waterMicros }) {
  const [showMicros, setShowMicros] = useState(false);
  const micros = sumMicros(meals, addMicros(supplementMicros, waterMicros));
  const extraNote = [
    Object.values(supplementMicros || {}).some((v) => v > 0) && 'the supplements you ticked off',
    Object.values(waterMicros || {}).some((v) => v > 0) && 'the minerals in your water',
  ].filter(Boolean).join(' and ');
  const active = MICRO_CONFIG.filter((c) => (micros[c.key] || 0) > 0);
  const kcal = { protein: totals.protein * 4, carbs: totals.carbs * 4, fat: totals.fat * 9 };
  const kcalTotal = kcal.protein + kcal.carbs + kcal.fat;
  if (kcalTotal === 0) return <Card><Text style={styles.muted}>Add meals to see the macro breakdown.</Text></Card>;

  return (
    <Card>
      {!showMicros ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <MacroDonut totals={totals} />
          <View style={{ flex: 1, gap: 6 }}>
            {['protein', 'carbs', 'fat'].map((k) => (
              <View key={k} style={styles.legendRow}>
                <View style={[styles.dot, { backgroundColor: MACRO_COLORS[k] }]} />
                <Text style={[styles.small, { width: 56, textTransform: 'capitalize' }]}>{k}</Text>
                <Text style={styles.bold}>{r0(totals[k])}g</Text>
                <Text style={[styles.muted, { marginLeft: 'auto' }]}>{Math.round((kcal[k] / kcalTotal) * 100)}%</Text>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <View style={{ gap: 6 }}>
          <Text style={styles.capsLabel}>MICRONUTRIENTS</Text>
          {active.map(({ key, label, unit, dv }) => {
            const val = micros[key] || 0;
            const pct = dv ? Math.min(100, Math.round((val / dv) * 100)) : null;
            return (
              <View key={key}>
                <View style={styles.rowBetween}>
                  <Text style={styles.small}>{label}</Text>
                  <Text style={styles.small}>{val}{unit}{pct !== null ? <Text style={styles.muted}> ({pct}% DV)</Text> : null}</Text>
                </View>
                {pct !== null && (
                  <View style={styles.thinTrack}>
                    <View style={{ height: '100%', width: `${pct}%`, borderRadius: 999, backgroundColor: pct >= 100 ? '#10b981' : pct >= 50 ? '#0ea5e9' : '#f59e0b' }} />
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
      {showMicros && extraNote ? <Text style={[styles.muted, { marginTop: 6 }]}>Includes {extraNote} today.</Text> : null}
      {active.length > 0 && <LinkText style={{ marginTop: 10, alignSelf: 'center' }} onPress={() => setShowMicros(!showMicros)}>{showMicros ? 'Show macros' : 'Show micronutrients'}</LinkText>}
    </Card>
  );
}

// ── Goal explanation ─────────────────────────────────────────────────────────
function GoalInfo({ info, onProfile, onSteps, onWeight }) {
  const { user } = useAuth();
  if (!info) return null;
  if (!info.targets) {
    const list = info.missing.map((m) => PROFILE_FIELD_NAMES[m]);
    const text = list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list.at(-1)}` : list[0];
    return <Card><Text style={styles.small}>Add your {text} to your <Text style={styles.link} onPress={onProfile}>profile</Text> to get calorie and macro goals based on your fitness goal.</Text></Card>;
  }
  const { basis } = info;
  return (
    <Card style={{ gap: 3 }}>
      <Text style={styles.small}>
        Goals set for <Text style={styles.bold}>{GOAL_NAMES[basis.goal]}</Text>:{' '}
        {basis.adjustment === 'maintenance' ? `maintenance, about ${basis.maintenance.toLocaleString()} kcal.` : `${basis.adjustment} from about ${basis.maintenance.toLocaleString()} kcal maintenance.`}
      </Text>
      {basis.stepCalories > 0 && <Hint>Includes +{basis.stepCalories} kcal for today's {basis.steps.toLocaleString()} <Text style={styles.link} onPress={onSteps}>steps</Text>.</Hint>}
      {adaptiveText(basis.adaptive, user?.bodyWeightUnit) ? (
        <Hint style={basis.adaptive?.reason ? null : { color: '#0ea5e9' }}>
          {adaptiveText(basis.adaptive, user?.bodyWeightUnit)} <Text style={styles.link} onPress={onWeight}>Weight log</Text>
        </Hint>
      ) : null}
      {basis.floored && <Hint>Raised to the minimum recommended intake rather than going lower.</Hint>}
      {basis.activityAssumed && <Hint>Assuming you're moderately active. <Text style={styles.link} onPress={onProfile}>Set your activity level</Text> for a more accurate goal.</Hint>}
      <Hint>Change your goal, weight or activity level in your <Text style={styles.link} onPress={onProfile}>profile</Text> and today's goals update automatically.</Hint>
    </Card>
  );
}

// ── Copy meals from an earlier day ───────────────────────────────────────────
function CopyFromDay({ date, onCopied }) {
  const [daysBack, setDaysBack] = useState(1);
  const [source, setSource] = useState(null);
  const [busy, setBusy] = useState(null);
  const [done, setDone] = useState({});
  const [error, setError] = useState('');
  const fromDate = ymd(subDays(parseISO(date), daysBack));

  useEffect(() => {
    let cancelled = false;
    setSource(null); setDone({}); setError('');
    nutritionAPI.getByDate(fromDate).then(({ data }) => !cancelled && setSource(data)).catch(() => !cancelled && setSource(null));
    return () => { cancelled = true; };
  }, [fromDate]);

  const meals = source?.meals || [];
  const groups = MEAL_TYPES.map((type) => {
    const list = meals.filter((m) => m.mealType === type);
    return { type, count: list.length, kcal: list.reduce((s, m) => s + (m.calories || 0), 0) };
  }).filter((g) => g.count > 0);

  const copy = async (key, mealTypes) => {
    setBusy(key);
    setError('');
    try {
      const { data } = await nutritionAPI.copyMeals({ fromDate, toDate: date, ...(mealTypes && { mealTypes }) });
      onCopied(data);
      setDone((d) => ({ ...d, [key]: true, ...(key === 'all' && Object.fromEntries(groups.map((g) => [g.type, true]))) }));
    } catch (err) {
      setError(err.response?.data?.message || 'Could not add those meals');
    } finally {
      setBusy(null);
    }
  };
  const dayLabel = (n) => (n === 1 ? (isToday(parseISO(date)) ? 'yesterday' : 'the day before') : format(subDays(parseISO(date), n), 'EEE d'));

  return (
    <View style={styles.copyBox}>
      <Text style={styles.small}>Add meals from</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
        <ChipRow style={{ flexWrap: 'nowrap', gap: 6 }}>
          {[1, 2, 3, 4, 5, 6, 7].map((n) => <Chip key={n} small label={dayLabel(n)} active={daysBack === n} onPress={() => setDaysBack(n)} />)}
        </ChipRow>
      </ScrollView>
      {source === null ? null : groups.length === 0 ? <Hint>Nothing logged {dayLabel(daysBack)}.</Hint> : (
        <ChipRow style={{ gap: 6 }}>
          {groups.map((g) => (
            <Chip key={g.type} small disabled={!!busy || done[g.type]} active={done[g.type]}
              label={`${done[g.type] ? '✓' : '+'} ${g.type} · ${Math.round(g.kcal)} kcal`} onPress={() => copy(g.type, [g.type])} />
          ))}
          {groups.length > 1 && <Chip small disabled={!!busy || done.all} active={done.all} label={`${done.all ? '✓' : '+'} All`} onPress={() => copy('all')} />}
        </ChipRow>
      )}
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

// ── Add meal ─────────────────────────────────────────────────────────────────
const ADD_TITLES = {
  search: 'Add Food', portion: 'Set Portion', recipe: 'Create a Recipe', 'custom-food': 'Create a Custom Food',
  'edit-ingredients': 'Edit Ingredients', 'edit-food': 'Edit Food', manual: 'Quick Add',
};

function AddMealSheet({ visible, onClose, onAdd }) {
  const [step, setStep] = useState('search');
  const [food, setFood] = useState(null);
  useEffect(() => { if (visible) { setStep('search'); setFood(null); } }, [visible]);
  const toPortion = (f) => { setFood(f); setStep('portion'); };
  const add = (meal) => { onAdd(meal); onClose(); };

  return (
    <Sheet visible={visible} title={ADD_TITLES[step]} onClose={onClose}>
      {step === 'search' && (
        <View style={{ gap: 10 }}>
          <FoodSearch onSelect={toPortion} autoFocus />
          <Text style={[styles.muted, { textAlign: 'center' }]}>or</Text>
          <Btn icon={Plus} title="Create a custom food" variant="secondary" onPress={() => setStep('custom-food')} />
          <Btn icon={ChefHat} title="Create a recipe from ingredients" variant="secondary" onPress={() => setStep('recipe')} />
          <Btn title="+ Quick add (log once, not saved)" variant="secondary" onPress={() => setStep('manual')} />
        </View>
      )}
      {step === 'portion' && food && (
        <PortionSelector food={food} onConfirm={add} onCancel={() => setStep('search')}
          onEditIngredients={food.ingredients?.length ? () => setStep('edit-ingredients') : undefined}
          onEditFood={() => setStep('edit-food')} />
      )}
      {step === 'edit-food' && food && <CustomFoodForm food={food} onSaved={toPortion} onCancel={() => setStep('portion')} />}
      {step === 'edit-ingredients' && food && <RecipeEditor foodId={food._id} foodName={food.name} onUse={toPortion} onCancel={() => setStep('portion')} />}
      {step === 'custom-food' && <CustomFoodForm onSaved={toPortion} onCancel={() => setStep('search')} />}
      {step === 'recipe' && <RecipeBuilder onSaved={toPortion} onCancel={() => setStep('search')} />}
      {step === 'manual' && <ManualEntry onConfirm={add} onCancel={() => setStep('search')} />}
    </Sheet>
  );
}

// ── Edit a logged meal ───────────────────────────────────────────────────────
// Database/custom food → portion and raw/cooked (custom foods also their macros);
// recipe → ingredient amounts in this meal; quick add → name and numbers.
function EditMealSheet({ meal, onClose, onSave }) {
  const [food, setFood] = useState(null);
  const [ingFoods, setIngFoods] = useState({});
  const [view, setView] = useState('loading');
  const [foodEdited, setFoodEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!meal) return;
    setError('');
    setFoodEdited(false);
    if (!meal.food) { setView('quick'); return; }
    setView('loading');
    let cancelled = false;
    foodAPI.getById(meal.food).then(async ({ data }) => {
      if (cancelled) return;
      const isRecipe = data.ingredients?.length > 0;
      if (isRecipe) {
        const map = {};
        for (const ing of data.ingredients) if (ing.food && typeof ing.food === 'object') map[String(ing.food._id)] = ing.food;
        const missing = (meal.ingredients || []).map((ing) => String(ing.food)).filter((id) => !map[id]);
        const fetched = await Promise.all(missing.map((id) => foodAPI.getById(id).then((x) => x.data).catch(() => null)));
        fetched.forEach((f) => { if (f) map[String(f._id)] = f; });
        if (cancelled) return;
        setIngFoods(map);
      }
      setFood(data);
      setView(isRecipe ? 'recipe' : 'portion');
    }).catch(() => !cancelled && setView('missing'));
    return () => { cancelled = true; };
  }, [meal]);

  const save = async (update) => {
    setSaving(true);
    setError('');
    try { await onSave(meal._id, update); onClose(); }
    catch (err) { setError(err.response?.data?.message || 'Could not save changes'); }
    finally { setSaving(false); }
  };
  const title = view === 'edit-food' ? 'Edit Food' : view === 'recipe' ? 'Edit Ingredients' : view === 'quick' ? 'Edit Quick Add' : 'Edit Portion';

  return (
    <Sheet visible={!!meal} title={title} onClose={onClose}>
      {/* Saving clears `meal` while the sheet is still closing, so nothing below may assume it. */}
      {meal ? (
      <>
      <ErrorText>{error}</ErrorText>
      {view === 'loading' && <Spinner />}
      {view === 'portion' && food && (
        <>
          {foodEdited && <Text style={styles.notice}>Food updated. Save to apply the new values to this meal.</Text>}
          <PortionSelector key={food.updatedAt || food._id} food={food} initial={{ grams: meal.grams, state: meal.state, mealType: meal.mealType }}
            confirmLabel={saving ? 'Saving…' : 'Save changes'} cancelLabel="Cancel"
            onConfirm={({ grams, state, mealType }) => save({ grams, state, mealType })} onCancel={onClose} onEditFood={() => setView('edit-food')} />
        </>
      )}
      {view === 'edit-food' && food && (
        <CustomFoodForm food={food} onSaved={(f) => { setFood(f); setFoodEdited(true); setView('portion'); }} onCancel={() => setView('portion')} />
      )}
      {view === 'recipe' && food && <RecipeMealEditor meal={meal} recipe={food} foods={ingFoods} saving={saving} onSave={save} onCancel={onClose} />}
      {view === 'quick' && <QuickAddEditor meal={meal} saving={saving} onSave={save} onCancel={onClose} />}
      {view === 'missing' && (
        <View>
          <Text style={styles.small}>The food this meal was logged from has been deleted, so it can't be edited. You can delete the meal and log it again.</Text>
          <Btn title="Close" variant="secondary" onPress={onClose} style={{ marginTop: 14 }} />
        </View>
      )}
      </>
      ) : null}
    </Sheet>
  );
}

// ── Meal planner ─────────────────────────────────────────────────────────────
const MEALS_PER_DAY = [[3, '3 meals'], [4, '3 meals + snack'], [5, '3 meals + 2 snacks']];
const PLAN_LENGTHS = [[1, '1 day'], [3, '3 days'], [7, 'A week']];
const GOAL_PHRASES = { lose_weight: 'lose weight', build_muscle: 'build muscle', improve_endurance: 'improve endurance', stay_active: 'stay active', other: 'your goal' };
const randomSeed = () => Math.floor(Math.random() * 1e6);

/** Same flow as the web's MealPlanner/useMealPlan: options → plan → add days to the log. */
function MealPlannerSheet({ visible, onClose, startDate, onApplied, onProfile }) {
  const [options, setOptions] = useState({ mealsPerDay: 4, diet: 'any', days: 1 });
  const [plan, setPlan] = useState(null);
  const [dayIndex, setDayIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [added, setAdded] = useState({});
  const dateFor = (i) => ymd(addDays(parseISO(startDate), i));
  const setOption = (k, v) => setOptions((o) => ({ ...o, [k]: v }));

  const generate = async (seed = randomSeed()) => {
    setBusy(true); setError(null);
    try {
      const { data } = await nutritionAPI.mealPlan({ ...options, seed });
      setPlan(data); setDayIndex(0); setAdded({});
    } catch (err) { setError(err.response?.data || { message: 'Could not make a plan' }); }
    finally { setBusy(false); }
  };
  const addDay = async (i) => {
    setBusy(true); setError(null);
    try {
      const date = dateFor(i);
      const meals = plan.days[i].meals.map((m) => ({ mealType: m.mealType, foods: m.foods.map((f) => ({ foodId: f.food._id, grams: f.grams })) }));
      const { data } = await nutritionAPI.applyPlan({ date, meals });
      setAdded((a) => ({ ...a, [i]: date }));
      onApplied(date, data);
    } catch (err) { setError({ message: err.response?.data?.message || 'Could not add to the log' }); }
    finally { setBusy(false); }
  };

  const day = plan?.days[dayIndex];
  return (
    <Sheet visible={visible} title="Meal plan" onClose={onClose}>
      {!plan ? (
        <View style={{ gap: 4 }}>
          <Hint>Builds meals to your daily calorie and macro targets, worked out from your BMR, activity level and fitness goal. Portions are sized so each day lands on your targets.</Hint>
          {[['Meals per day', 'mealsPerDay', MEALS_PER_DAY], ['Diet', 'diet', DIETS.map((d) => [d.value, d.label])], ['Days', 'days', PLAN_LENGTHS]].map(([label, key, choices]) => (
            <View key={key}>
              <Text style={[styles.bold, { marginTop: 12, marginBottom: 6 }]}>{label}</Text>
              <ChipRow>{choices.map(([v, l]) => <Chip key={String(v)} label={l} active={options[key] === v} onPress={() => setOption(key, v)} />)}</ChipRow>
            </View>
          ))}
          {error && (
            <Text style={[styles.small, { color: colors.danger, marginTop: 8 }]}>
              {error.message}{error.missing ? <> — add your {error.missing.map((m) => PROFILE_FIELD_NAMES[m] || m).join(', ')} in your <Text style={styles.link} onPress={onProfile}>profile</Text>.</> : null}
            </Text>
          )}
          <Btn icon={busy ? undefined : Sparkles} title={busy ? 'Planning…' : 'Make a plan'} disabled={busy} onPress={() => generate()} style={{ marginTop: 16 }} />
        </View>
      ) : (
        <View>
          <Text style={styles.small}>
            Daily target: <Text style={styles.bold}>{r0(plan.targets.calories)} kcal</Text> · P {r0(plan.targets.protein)}g · C {r0(plan.targets.carbs)}g · F {r0(plan.targets.fat)}g
            {plan.basis ? ` — to ${GOAL_PHRASES[plan.basis.goal] || 'reach your goal'} (${plan.basis.adjustment}, maintenance ≈ ${plan.basis.maintenance} kcal)` : ''}
          </Text>
          {plan.days.length > 1 && (
            <ChipRow style={{ marginTop: 10, gap: 6 }}>
              {plan.days.map((d, i) => <Chip key={d.day} small label={`${format(parseISO(dateFor(i)), 'EEE d')}${added[i] ? ' ✓' : ''}`} active={dayIndex === i} onPress={() => setDayIndex(i)} />)}
            </ChipRow>
          )}
          {day.meals.map((meal, i) => (
            <View key={i} style={styles.planMeal}>
              <View style={styles.rowBetween}>
                <Text style={[styles.bold, { textTransform: 'capitalize' }]}>{meal.mealType}</Text>
                <Text style={[styles.muted, { flexShrink: 1, textAlign: 'right' }]}>{r0(meal.totals.calories)} kcal · P {r0(meal.totals.protein)} · C {r0(meal.totals.carbs)} · F {r0(meal.totals.fat)}</Text>
              </View>
              {meal.foods.map((f, j) => (
                <View key={j} style={[styles.rowBetween, { marginTop: 3 }]}>
                  <Text style={[styles.small, { flex: 1 }]} numberOfLines={1}>{f.food.name}</Text>
                  <Text style={styles.muted}>{formatServing(f.food, f.grams)}</Text>
                </View>
              ))}
            </View>
          ))}
          <View style={[styles.rowBetween, { marginTop: 10 }]}>
            {[['kcal', 'calories', ''], ['Protein', 'protein', 'g'], ['Carbs', 'carbs', 'g'], ['Fat', 'fat', 'g']].map(([l, k, u]) => {
              const off = (day.totals[k] - plan.targets[k]) / plan.targets[k];
              return (
                <View key={k} style={styles.totalBox}>
                  <Text style={styles.bold}>{r0(day.totals[k])}{u}</Text>
                  <Text style={styles.tiny}>{l} / {r0(plan.targets[k])}{u}</Text>
                  {Math.abs(off) > 0.1 && <Text style={[styles.tiny, { color: colors.warning }]}>{off > 0 ? '+' : ''}{Math.round(off * 100)}%</Text>}
                </View>
              );
            })}
          </View>
          <ErrorText>{error?.message}</ErrorText>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Btn title="Options" variant="secondary" onPress={() => setPlan(null)} />
            <Btn icon={RefreshCw} title="New" variant="secondary" disabled={busy} onPress={() => generate()} />
            <Btn style={{ flex: 1 }} disabled={busy || !!added[dayIndex]} onPress={() => addDay(dayIndex)}
              title={added[dayIndex] ? `✓ Added to ${format(parseISO(added[dayIndex]), 'EEE, MMM d')}` : `Add to ${format(parseISO(dateFor(dayIndex)), 'EEE, MMM d')}`} />
          </View>
          <Hint style={{ marginTop: 8 }}>Each food is added as its own entry, so you can change portions or delete anything afterwards like any other meal.</Hint>
        </View>
      )}
    </Sheet>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────
export default function NutritionScreen({ navigation }) {
  const [date, setDate] = useState(ymd(new Date()));
  const [log, setLog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState(null);
  const [goalInfo, setGoalInfo] = useState(null);
  const [plannerOpen, setPlannerOpen] = useState(false);

  const loadTargets = () => nutritionAPI.getTargets().then((res) => setGoalInfo(res.data)).catch(() => setGoalInfo(null));
  const fetchLog = useCallback(async () => {
    try { const { data } = await nutritionAPI.getByDate(date); setLog(data); }
    catch { setLog(null); }
    finally { setLoading(false); setRefreshing(false); }
  }, [date]);

  useEffect(() => { setLoading(true); fetchLog(); }, [fetchLog]);
  // Goals depend on the profile and today's steps, which change on other screens.
  useEffect(() => navigation.addListener('focus', () => { loadTargets(); fetchLog(); }), [navigation, fetchLog]);

  const meals = log?.meals || [];
  const totals = meals.reduce((a, m) => ({ calories: a.calories + m.calories, protein: a.protein + m.protein, carbs: a.carbs + m.carbs, fat: a.fat + m.fat }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const handleAdd = async (mealData) => {
    try {
      let current = log;
      if (!current) current = (await nutritionAPI.upsert({ date })).data;
      const { data } = await nutritionAPI.addMeal(current._id, mealData);
      setLog(data);
    } catch (err) { Alert.alert('Error', err.response?.data?.message || 'Could not add meal'); }
  };
  const handleUpdate = async (mealId, update) => {
    const { data } = await nutritionAPI.updateMeal(log._id, mealId, update);
    setLog(data);
  };
  const handleDelete = async (meal) => {
    if (!(await confirm(`Delete "${meal.name}"?`, '', 'Delete', true))) return;
    try { const { data } = await nutritionAPI.deleteMeal(log._id, meal._id); setLog(data); }
    catch { Alert.alert('Error', 'Could not delete meal'); }
  };

  // A day's own goals win (past days keep what applied then); otherwise current targets.
  const goals = log?.dailyGoals ?? goalInfo?.targets ?? null;
  const today = ymd(new Date());
  const isPast = date < today;
  const shift = (n) => setDate(ymd(addDays(parseISO(date), n)));
  const toProfile = () => navigation.navigate('Tabs', { screen: 'Profile' });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadTargets(); fetchLog(); }} tintColor={colors.brand} />}>
        <View style={styles.dateRow}>
          <TouchableOpacity onPress={() => shift(-1)} hitSlop={10}><Text style={styles.arrow}>‹</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setDate(today)}>
            <Text style={styles.dateLabel}>{date === today ? 'Today' : format(parseISO(date), 'EEE, MMM d')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => shift(1)} hitSlop={10}><Text style={styles.arrow}>›</Text></TouchableOpacity>
          <View style={{ flex: 1 }} />
          <Btn icon={Sparkles} title="Meal plan" variant="secondary" onPress={() => setPlannerOpen(true)} style={{ minHeight: 36 }} />
        </View>

        {!isPast && <GoalInfo info={goalInfo} onProfile={toProfile} onSteps={() => navigation.navigate('Steps')} onWeight={() => navigation.navigate('Weight')} />}

        <Card style={{ alignItems: 'center' }}>
          <Text style={styles.bigNum}>{r0(totals.calories)}</Text>
          <Text style={styles.muted}>kcal consumed</Text>
          {goals?.calories ? (
            <View style={{ alignSelf: 'stretch', marginTop: 10 }}>
              <View style={styles.track}><View style={[styles.fill, { width: `${Math.min(100, Math.round((totals.calories / goals.calories) * 100))}%`, backgroundColor: colors.brand }]} /></View>
              <Text style={[styles.muted, { textAlign: 'center', marginTop: 4 }]}>Goal: {r0(goals.calories).toLocaleString()} kcal</Text>
            </View>
          ) : null}
          <View style={{ alignSelf: 'stretch', marginTop: 12, gap: 8 }}>
            {['protein', 'carbs', 'fat'].map((m) => {
              const val = r0(totals[m]);
              const goal = r0(goals?.[m]) || (m === 'protein' ? 150 : m === 'carbs' ? 200 : 65);
              return (
                <View key={m} style={styles.legendRow}>
                  <Text style={[styles.small, { width: 56, textTransform: 'capitalize' }]}>{m}</Text>
                  <View style={[styles.track, { flex: 1 }]}><View style={[styles.fill, { width: `${Math.min(100, Math.round((val / goal) * 100))}%`, backgroundColor: MACRO_COLORS[m] }]} /></View>
                  <Text style={[styles.muted, { width: 78, textAlign: 'right' }]}>{val}g / {goal}g</Text>
                </View>
              );
            })}
          </View>
        </Card>

        <MacroCard totals={totals} meals={meals} supplementMicros={log?.supplementMicros} waterMicros={log?.waterMicros} />

        <Card>
          <View style={[styles.rowBetween, { marginBottom: 10 }]}>
            <Text style={styles.cardTitle}>{date === today ? "Today's meals" : 'Meals'}</Text>
            <Btn title="+ Add food" onPress={() => setAddOpen(true)} style={{ minHeight: 34 }} />
          </View>
          <CopyFromDay key={date} date={date} onCopied={setLog} />
          {loading ? <Spinner /> : meals.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 20 }}>
              <Salad size={30} color={colors.textMuted} strokeWidth={1.5} />
              <Text style={styles.muted}>No meals logged yet.</Text>
            </View>
          ) : MEAL_TYPES.map((type) => {
            const list = meals.filter((m) => m.mealType === type);
            if (!list.length) return null;
            return (
              <View key={type} style={{ marginTop: 10 }}>
                <Text style={styles.capsLabel}>{type.toUpperCase()}</Text>
                {list.map((m) => (
                  <View key={m._id} style={styles.mealRow}>
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => setEditingMeal(m)}>
                      <Text style={styles.mealName} numberOfLines={1}>{m.name}</Text>
                      <Text style={styles.muted}>{m.grams ? `${r(m.grams)} g · ` : ''}{r0(m.calories)} kcal · P {r0(m.protein)}g · C {r0(m.carbs)}g · F {r0(m.fat)}g</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(m)} hitSlop={8}><X size={18} color={colors.textMuted} /></TouchableOpacity>
                  </View>
                ))}
              </View>
            );
          })}
          {meals.length > 0 && <Hint style={{ marginTop: 8 }}>Tap a meal to change its portion.</Hint>}
        </Card>
      </ScrollView>

      <AddMealSheet visible={addOpen} onClose={() => setAddOpen(false)} onAdd={handleAdd} />
      <EditMealSheet meal={editingMeal} onClose={() => setEditingMeal(null)} onSave={handleUpdate} />
      <MealPlannerSheet visible={plannerOpen} onClose={() => setPlannerOpen(false)} startDate={date} onProfile={() => { setPlannerOpen(false); toProfile(); }}
        onApplied={(d, l) => { if (d === date) setLog(l); }} />
    </View>
  );
}

const styles = makeStyles(() => ({
  dateRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  arrow:     { fontSize: 28, color: colors.brand, fontWeight: '300', paddingHorizontal: 4 },
  dateLabel: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  bigNum:    { fontSize: 32, fontWeight: '800', color: colors.textPrimary },
  track:     { height: 7, backgroundColor: colors.subtle, borderRadius: 999, overflow: 'hidden' },
  thinTrack: { height: 4, backgroundColor: colors.subtle, borderRadius: 999, overflow: 'hidden', marginTop: 2 },
  fill:      { height: '100%', borderRadius: 999 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot:       { width: 10, height: 10, borderRadius: 5 },
  rowBetween:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  small:     { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  muted:     { fontSize: 12, color: colors.textMuted },
  tiny:      { fontSize: 10, color: colors.textMuted },
  bold:      { fontWeight: '700', color: colors.textPrimary },
  link:      { color: colors.brand, fontWeight: '500' },
  capsLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5, marginBottom: 4 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  mealRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.subtle },
  mealName:  { fontSize: 14, fontWeight: '500', color: colors.textPrimary },
  copyBox:   { backgroundColor: colors.inset, borderRadius: 12, padding: 10 },
  notice:    { fontSize: 12, color: colors.brandDark, backgroundColor: colors.brandLight, borderRadius: 8, padding: 8, marginBottom: 10 },
  planMeal:  { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 10, marginTop: 10 },
  totalBox:  { flex: 1, alignItems: 'center', backgroundColor: colors.inset, borderRadius: 10, paddingVertical: 6 },
}));
