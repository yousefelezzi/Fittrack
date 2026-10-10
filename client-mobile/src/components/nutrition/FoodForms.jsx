/**
 * The food-logging forms used by the Nutrition screen: search, portion,
 * quick add, custom food, recipe builder/editor and the logged-meal editors.
 * The maths lives in client-web/src/utils/foodLogic.js, shared with the web app.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { foodAPI } from '../../api';
import { colors, makeStyles } from '../tokens';
import { Chip, ChipRow, Segmented, Label, Hint, ErrorText, LinkText } from '../ui';
import { MEAL_TYPES } from '../../../../client-web/src/constants/nutrition';
import {
  r, r0, servingText, scale, canPickState, storedStateOf, stateOf, stateLabel, foodInState, nameInState, yieldHint,
  portionIngredients, isEditableCustomFood, LABEL_FIELDS, EXTRA_GROUPS, customFoodInitial,
  sumIngredients, ingredientPayload, fmtCount, useRecipeServing, buildVirtualRecipe, customFoodDraft,
} from '../../../../client-web/src/utils/foodLogic';
import { X } from 'lucide-react-native';

// Button sized for the forms in a sheet.
function Btn({ title, icon: Icon, onPress, variant = 'primary', disabled, style }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.75}
      style={[styles.btn, variant === 'primary' ? styles.btnPrimary : styles.btnSecondary, disabled && { opacity: 0.5 }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        {Icon ? <Icon size={16} color={variant === 'primary' ? '#fff' : colors.brand} /> : null}
        <Text style={[styles.btnText, variant !== 'primary' && { color: colors.textPrimary }, { flexShrink: 1 }]}>{title}</Text>
      </View>
    </TouchableOpacity>
  );
}
export function ButtonRow({ children }) {
  return <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>{children}</View>;
}
export { Btn };

function NumInput({ value, onChange, placeholder, style }) {
  return (
    <TextInput style={[styles.field, style]} keyboardType="decimal-pad" placeholder={placeholder} placeholderTextColor={colors.textMuted}
      value={value === '' || value == null ? '' : String(value)} onChangeText={onChange} selectTextOnFocus />
  );
}

export function MealTypePicker({ value, onChange }) {
  return (
    <>
      <Label>Meal type</Label>
      <ChipRow>{MEAL_TYPES.map((t) => <Chip key={t} label={t} active={value === t} onPress={() => onChange(t)} />)}</ChipRow>
    </>
  );
}

export function MacroPreview({ values, suffix = '' }) {
  return (
    <View style={styles.preview}>
      {[['Calories', values.calories], ['Protein', values.protein], ['Carbs', values.carbs], ['Fat', values.fat]].map(([l, v]) => (
        <View key={l} style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.previewVal}>{r0(v)}</Text>
          <Text style={styles.hintText}>{l}{suffix}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Food search ──────────────────────────────────────────────────────────────
export function FoodSearch({ onSelect, autoFocus }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mine, setMine] = useState([]); // your custom foods/recipes and saved ones
  const timer = useRef(null);
  useEffect(() => { foodAPI.mine().then(({ data }) => setMine(data)).catch(() => {}); }, []);

  const search = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try { const { data } = await foodAPI.search(q); setResults(data); }
    catch { setResults([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => search(query), 280);
    return () => clearTimeout(timer.current);
  }, [query, search]);

  return (
    <View>
      <TextInput style={styles.field} placeholder="Search food database…" placeholderTextColor={colors.textMuted}
        value={query} onChangeText={setQuery} autoCorrect={false} autoFocus={autoFocus} />
      {/* Before typing: your own and saved foods and recipes. */}
      {query.length === 0 && mine.length > 0 ? (
        <View style={styles.results}>
          <Text style={[styles.hintText, { paddingHorizontal: 12, paddingTop: 8, fontWeight: '700' }]}>YOUR FOODS</Text>
          {mine.map((food) => (
            <TouchableOpacity key={food._id} style={styles.resultRow} onPress={() => onSelect(food)}>
              <Text style={styles.name} numberOfLines={1}>
                {food.name}<Text style={styles.hintText}>  {food.ingredients?.length ? 'recipe' : 'custom'}{food.saved && !food.mine ? ' · saved' : ''}</Text>
              </Text>
              <Text style={styles.hintText}>per 100g — {food.per100g.calories} kcal · P {food.per100g.protein}g · C {food.per100g.carbs}g · F {food.per100g.fat}g</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
      {query.length > 0 && (
        <View style={styles.results}>
          {loading && <Text style={styles.empty}>Searching…</Text>}
          {!loading && results.length === 0 && query.length > 1 && <Text style={styles.empty}>No results for "{query}"</Text>}
          {results.map((food) => (
            <TouchableOpacity key={food._id} style={styles.resultRow} onPress={() => { onSelect(food); setQuery(''); setResults([]); }}>
              <Text style={styles.name} numberOfLines={1}>{food.name}</Text>
              <Text style={styles.hintText}>per 100g — {food.per100g.calories} kcal · P {food.per100g.protein}g · C {food.per100g.carbs}g · F {food.per100g.fat}g</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

export function StateToggle({ food, state, onChange, small }) {
  const current = stateOf(food, state);
  return (
    <ChipRow style={{ gap: 6 }}>
      {['uncooked', 'cooked'].map((k) => <Chip key={k} small={small} label={stateLabel(food, k)} active={current === k} onPress={() => onChange(k)} />)}
    </ChipRow>
  );
}

// ── Portion ──────────────────────────────────────────────────────────────────
/** `initial` ({ grams, state, mealType }) pre-fills it when editing a logged meal. */
export function PortionSelector({ food: baseFood, onConfirm, onCancel, onEditIngredients, onEditFood, initial, confirmLabel = 'Add to log', cancelLabel = 'Back' }) {
  const pickable = canPickState(baseFood);
  const [cookState, setCookState] = useState(stateOf(baseFood, initial?.state));
  const food = foodInState(baseFood, cookState);
  const loggedName = nameInState(baseFood, cookState);
  const inStoredState = stateOf(baseFood, cookState) === storedStateOf(baseFood);
  const allServings = baseFood.servings || [];
  const hasServings = allServings.length > 0 && inStoredState;
  const defaultIdx = Math.max(0, allServings.findIndex((sv) => /\bmedium\b/i.test(sv.label)));
  const [mode, setMode] = useState(allServings.length > 0 && !initial ? 'serving' : 'grams');
  const [servIdx, setServIdx] = useState(defaultIdx);
  const [qty, setQty] = useState('1');
  const [grams, setGrams] = useState(String(initial?.grams ?? (allServings.length > 0 ? allServings[defaultIdx].grams : 100)));
  const [mealType, setMealType] = useState(initial?.mealType ?? 'snack');

  const pickState = (next) => { setCookState(next); if (next !== storedStateOf(baseFood)) setMode('grams'); };
  const effectiveGrams = mode === 'serving' && hasServings ? (food.servings[servIdx]?.grams ?? 100) * (Number(qty) || 0) : Number(grams) || 0;
  const scaled = scale(food, effectiveGrams);

  return (
    <View>
      <View style={styles.rowBetween}>
        <Text style={[styles.title, { flex: 1 }]}>{loggedName}</Text>
        {food.ingredients?.length > 0 && onEditIngredients ? <LinkText onPress={onEditIngredients}>Edit ingredients</LinkText> : null}
        {isEditableCustomFood(baseFood) && onEditFood ? <LinkText onPress={onEditFood}>Edit food</LinkText> : null}
      </View>
      <Hint>per 100g: {food.per100g.calories} kcal · P {food.per100g.protein}g · C {food.per100g.carbs}g · F {food.per100g.fat}g</Hint>

      {pickable && (
        <>
          <Label>Weighed</Label>
          <StateToggle food={baseFood} state={cookState} onChange={pickState} />
          <Hint style={{ marginTop: 4 }}>{yieldHint(baseFood)}</Hint>
        </>
      )}

      {hasServings && (
        <Segmented style={{ marginTop: 14 }} value={mode} onChange={setMode} options={[['serving', 'Common serving'], ['grams', 'By grams']]} />
      )}
      {mode === 'serving' && hasServings ? (
        <>
          <Label>Serving size</Label>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <NumInput value={qty} onChange={setQty} style={{ width: 64 }} />
            <Text style={styles.small}>×</Text>
          </View>
          <ChipRow style={{ marginTop: 8, gap: 6 }}>
            {food.servings.map((s, i) => (
              <Chip key={i} small label={servingText(s.label, s.grams)} active={servIdx === i}
                onPress={() => { setServIdx(i); setGrams(String(food.servings[i].grams)); }} style={{ maxWidth: '100%' }} />
            ))}
          </ChipRow>
          {Number(qty) !== 1 && Number(qty) > 0 ? <Hint style={{ marginTop: 4 }}>= {r(effectiveGrams)} g</Hint> : null}
        </>
      ) : (
        <>
          <Label>Amount (grams)</Label>
          <NumInput value={grams} onChange={setGrams} />
        </>
      )}

      <MealTypePicker value={mealType} onChange={setMealType} />
      <MacroPreview values={scaled} />
      <ButtonRow>
        <Btn title={cancelLabel} variant="secondary" onPress={onCancel} style={{ flex: 1 }} />
        <Btn title={confirmLabel} disabled={effectiveGrams <= 0} style={{ flex: 1 }} onPress={() => onConfirm({
          name: loggedName, mealType, ...scaled,
          food: baseFood._id,
          grams: r(effectiveGrams),
          state: baseFood.isVirtual ? null : stateOf(baseFood, cookState),
          ...(baseFood.isVirtual && { ingredients: portionIngredients(baseFood, effectiveGrams) }),
        })} />
      </ButtonRow>
    </View>
  );
}

// ── Quick add ────────────────────────────────────────────────────────────────
export function ManualEntry({ onConfirm, onCancel }) {
  const [meal, setMeal] = useState({ name: '', calories: '', protein: '', carbs: '', fat: '', mealType: 'snack' });
  return (
    <View>
      <Hint>Enter nutritional info manually. It's logged once and not saved as a food.</Hint>
      <Label>Food name</Label>
      <TextInput style={styles.field} placeholder="e.g. Homemade Lasagne" placeholderTextColor={colors.textMuted} value={meal.name} onChangeText={(v) => setMeal({ ...meal, name: v })} />
      <View style={styles.grid2}>
        {[['calories', 'Calories (kcal)'], ['protein', 'Protein (g)'], ['carbs', 'Carbs (g)'], ['fat', 'Fat (g)']].map(([k, l]) => (
          <View key={k} style={styles.cell2}><Label>{l}</Label><NumInput value={meal[k]} onChange={(v) => setMeal({ ...meal, [k]: v })} placeholder="0" /></View>
        ))}
      </View>
      <MealTypePicker value={meal.mealType} onChange={(t) => setMeal({ ...meal, mealType: t })} />
      <ButtonRow>
        <Btn title="Back" variant="secondary" onPress={onCancel} style={{ flex: 1 }} />
        <Btn title="Add to log" disabled={!meal.name.trim()} style={{ flex: 1 }}
          onPress={() => onConfirm({ ...meal, name: meal.name.trim(), calories: Number(meal.calories) || 0, protein: Number(meal.protein) || 0, carbs: Number(meal.carbs) || 0, fat: Number(meal.fat) || 0 })} />
      </ButtonRow>
    </View>
  );
}

// ── Custom food (from a nutrition label) ─────────────────────────────────────
export function CustomFoodForm({ food: editing, onSaved, onCancel }) {
  const init = customFoodInitial(editing);
  const [name, setName] = useState(init?.name ?? '');
  const [brand, setBrand] = useState(init?.brand ?? '');
  const [servingLabel, setServingLabel] = useState(init?.servingLabel ?? '');
  const [servingGrams, setServingGrams] = useState(init?.servingGrams ?? '');
  const [basis, setBasis] = useState(init?.basis ?? 'serving');
  const [values, setValues] = useState(init?.values ?? {});
  const [showExtras, setShowExtras] = useState(init?.showExtras ?? false);
  const [cookMode, setCookMode] = useState(init?.cookMode ?? 'none');
  const [cookedFrom, setCookedFrom] = useState(init?.cookedFrom ?? 'raw');
  const [cookedPer100, setCookedPer100] = useState(init?.cookedPer100 ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const d = customFoodDraft({ name, brand, servingLabel, servingGrams, basis, values, cookMode, cookedFrom, cookedPer100, editing });

  const save = async () => {
    if (!d.valid) return;
    setSaving(true);
    setError('');
    try {
      const { data } = editing ? await foodAPI.update(editing._id, d.body) : await foodAPI.create({ ...d.body, category: 'custom' });
      onSaved(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save this food.');
    } finally {
      setSaving(false);
    }
  };

  const numField = (f) => (
    <View key={f.key} style={styles.cell2}>
      <Label>{f.label} ({f.unit}){f.required ? ' *' : ''}</Label>
      <NumInput value={values[f.key] ?? ''} onChange={(v) => setValues({ ...values, [f.key]: v })} />
    </View>
  );

  return (
    <View>
      <Hint>{editing ? 'Changes apply the next time you log this food. Meals you already logged keep their numbers.' : "Add a food from its nutrition label. It's saved so you can find it in search next time."}</Hint>
      <Label>Food name *</Label>
      <TextInput style={styles.field} placeholder="e.g. Protein Bar" placeholderTextColor={colors.textMuted} value={name} onChangeText={setName} />
      <Label>Brand · optional</Label>
      <TextInput style={styles.field} placeholder="e.g. Grenade" placeholderTextColor={colors.textMuted} value={brand} onChangeText={setBrand} />
      <View style={styles.grid2}>
        <View style={styles.cell2}><Label>Serving size *</Label>
          <TextInput style={styles.field} maxLength={30} placeholder="e.g. 1 bar" placeholderTextColor={colors.textMuted} value={servingLabel} onChangeText={setServingLabel} /></View>
        <View style={styles.cell2}><Label>Serving weight (g) *</Label><NumInput value={servingGrams} onChange={setServingGrams} placeholder="60" /></View>
      </View>

      <View style={[styles.rowBetween, { marginTop: 14 }]}>
        <Text style={styles.labelText}>Nutrition</Text>
        <Segmented style={{ width: 200 }} value={basis} onChange={setBasis} options={[['serving', 'Per serving'], ['100g', 'Per 100 g']]} />
      </View>
      <View style={styles.grid2}>{LABEL_FIELDS.map(numField)}</View>
      <LinkText style={{ marginTop: 8 }} onPress={() => setShowExtras(!showExtras)}>{showExtras ? 'Hide' : 'Add'} saturated fat, fiber, vitamins & minerals (optional)</LinkText>
      {showExtras ? (
        <>
          {EXTRA_GROUPS.map(([title, fields]) => (
            <View key={title} style={{ marginTop: 10 }}>
              <Text style={styles.groupTitle}>{title.toUpperCase()}</Text>
              <View style={styles.grid2}>{fields.map(numField)}</View>
            </View>
          ))}
          <Hint style={{ marginTop: 4 }}>Fill in whatever the label lists; leave the rest empty.</Hint>
        </>
      ) : null}

      <Label>Raw or cooked? · optional</Label>
      <ChipRow style={{ gap: 6 }}>
        {[['none', 'Doesn’t apply'], ['raw', 'Raw'], ['dry', 'Dry'], ['cooked', 'Cooked']].map(([k, t]) => (
          <Chip key={k} small label={t} active={cookMode === k} onPress={() => setCookMode(k)} />
        ))}
      </ChipRow>
      {cookMode !== 'none' && (
        <View style={{ marginTop: 8, gap: 8 }}>
          {cookMode === 'cooked' && (
            <View style={styles.inline}>
              <Text style={styles.small}>Before cooking it’s</Text>
              <Segmented style={{ width: 120 }} value={cookedFrom} onChange={setCookedFrom} options={[['raw', 'raw'], ['dry', 'dry']]} />
            </View>
          )}
          <View style={styles.inline}>
            <Text style={styles.small}>100 g {d.rawWord} makes</Text>
            <NumInput value={cookedPer100} onChange={setCookedPer100} placeholder={d.rawWord === 'dry' ? '280' : '75'} style={{ width: 70 }} />
            <Text style={styles.small}>g cooked</Text>
          </View>
          <Hint>e.g. meat usually shrinks to about 75 g; dry rice or pasta swells to 230–330 g. With this set, you can log the food by {d.rawWord} or cooked weight.</Hint>
        </View>
      )}

      {d.grams > 0 && d.hasCalories ? (
        <Text style={styles.noteBox}>
          {basis === 'serving'
            ? `Per 100 g: ${r(d.num('calories') * d.toPer100)} kcal · P ${r(d.num('protein') * d.toPer100)}g · C ${r(d.num('carbs') * d.toPer100)}g · F ${r(d.num('fat') * d.toPer100)}g`
            : `Per ${servingText(d.label || 'serving', d.grams)}: ${r(d.num('calories') * d.toServing)} kcal · P ${r(d.num('protein') * d.toServing)}g · C ${r(d.num('carbs') * d.toServing)}g · F ${r(d.num('fat') * d.toServing)}g`}
        </Text>
      ) : null}
      <ErrorText>{error}</ErrorText>
      <ButtonRow>
        <Btn title="Back" variant="secondary" onPress={onCancel} style={{ flex: 1 }} />
        <Btn title={saving ? 'Saving…' : editing ? 'Save changes' : 'Save food'} disabled={!d.valid || saving} onPress={save} style={{ flex: 1 }} />
      </ButtonRow>
    </View>
  );
}

// ── Recipes ──────────────────────────────────────────────────────────────────
export function IngredientRow({ ing, onGrams, onState, onRemove }) {
  return (
    <View style={styles.ingRow}>
      <View style={styles.inline}>
        <Text style={[styles.name, { flex: 1 }]} numberOfLines={1}>{nameInState(ing.food, ing.state)}</Text>
        <NumInput value={ing.grams} onChange={(v) => onGrams(v === '' ? '' : Number(v))} style={{ width: 70, height: 34 }} />
        <Text style={styles.small}>g</Text>
        <TouchableOpacity onPress={onRemove} hitSlop={6}><X size={16} color={colors.textMuted} /></TouchableOpacity>
      </View>
      {canPickState(ing.food) && (
        <View style={[styles.inline, { marginTop: 6 }]}>
          <Text style={styles.hintText}>Weighed</Text>
          <StateToggle food={ing.food} state={ing.state} onChange={onState} small />
        </View>
      )}
    </View>
  );
}

function RecipeServingFields({ sv }) {
  return (
    <View>
      <Label>Finished weight (g) · optional</Label>
      <NumInput value={sv.totalWeight} onChange={sv.setTotalWeight} placeholder={sv.rawGrams > 0 ? String(Math.round(sv.rawGrams)) : 'e.g. 800'} style={{ width: 120 }} />
      <Hint style={{ marginTop: 4 }}>Estimated at {Math.round(sv.rawGrams)} g from the ingredients (raw/dry ones counted at their cooked weight). For accuracy, weigh the finished dish and enter it here.</Hint>
      <Label>Serving size</Label>
      <Segmented value={sv.mode} onChange={sv.setMode} options={[['count', 'Number of servings'], ['weight', 'Weight per serving']]} />
      <View style={[styles.inline, { marginTop: 8 }]}>
        {sv.mode === 'count' ? (
          <>
            <Text style={styles.small}>Makes</Text>
            <NumInput value={sv.numServings} onChange={(v) => sv.setNumServings(v === '' ? '' : Math.max(1, Number(v)))} style={{ width: 64 }} />
            <Text style={styles.small}>servings of {Math.round(sv.gramsPerServing) || 0} g</Text>
          </>
        ) : (
          <>
            <NumInput value={sv.servingGrams} onChange={sv.setServingGrams} placeholder="250" style={{ width: 80 }} />
            <Text style={[styles.small, { flex: 1 }]}>g per serving{Number(sv.servingGrams) > 0 && sv.effTotal > 0 ? ` · makes ${fmtCount(Math.round(sv.count * 10) / 10)} servings` : ''}</Text>
          </>
        )}
      </View>
      <Label>Serving name · optional</Label>
      <TextInput style={styles.field} maxLength={30} placeholder="e.g. bowl, slice, plate" placeholderTextColor={colors.textMuted} value={sv.servingName} onChangeText={sv.setServingName} />
      <Hint style={{ marginTop: 4 }}>Shown when logging: “{servingText(sv.label, Math.round(sv.gramsPerServing) || 0)}”</Hint>
    </View>
  );
}

function useIngredientList(initial = []) {
  const [items, setItems] = useState(initial);
  return {
    items, setItems,
    add: (food) => setItems((p) => [...p, { food, grams: 100 }]),
    setGrams: (i, g) => setItems((p) => p.map((x, j) => (j === i ? { ...x, grams: g } : x))),
    setState: (i, st) => setItems((p) => p.map((x, j) => (j === i ? { ...x, state: st } : x))),
    remove: (i) => setItems((p) => p.filter((_, j) => j !== i)),
  };
}

const perServingOf = (totals, count) => ({
  calories: totals.calories / count, protein: totals.protein / count, carbs: totals.carbs / count, fat: totals.fat / count,
});

/** New recipe from foods already in the database. */
export function RecipeBuilder({ onSaved, onCancel }) {
  const [name, setName] = useState('');
  const list = useIngredientList();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const totals = sumIngredients(list.items);
  const sv = useRecipeServing(totals.grams);

  const save = async () => {
    if (!name.trim() || list.items.length === 0 || !sv.valid) return;
    setSaving(true);
    setError('');
    try {
      const { data } = await foodAPI.create({ name: name.trim(), ...sv.payload, ingredients: list.items.map(ingredientPayload) });
      onSaved(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save this recipe.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View>
      <Hint>Build a custom food from ingredients already in the database — like a recipe.</Hint>
      <Label>Recipe name</Label>
      <TextInput style={styles.field} placeholder="e.g. Chicken Stir-fry" placeholderTextColor={colors.textMuted} value={name} onChangeText={setName} />
      <Label>Add ingredients</Label>
      <FoodSearch onSelect={list.add} />
      <View style={{ gap: 6, marginTop: 8 }}>
        {list.items.map((ing, i) => (
          <IngredientRow key={i} ing={ing} onGrams={(g) => list.setGrams(i, g)} onState={(st) => list.setState(i, st)} onRemove={() => list.remove(i)} />
        ))}
      </View>
      {list.items.length > 0 && <RecipeServingFields sv={sv} />}
      {list.items.length > 0 && <MacroPreview values={perServingOf(totals, sv.count)} suffix=" / serving" />}
      <ErrorText>{error}</ErrorText>
      <ButtonRow>
        <Btn title="Back" variant="secondary" onPress={onCancel} style={{ flex: 1 }} />
        <Btn title={saving ? 'Saving…' : 'Save recipe'} disabled={!name.trim() || list.items.length === 0 || !sv.valid || saving} onPress={save} style={{ flex: 1 }} />
      </ButtonRow>
    </View>
  );
}

/** Adjust an existing recipe's ingredients before logging it (optionally saving the changes). */
export function RecipeEditor({ foodId, foodName, onUse, onCancel }) {
  const [loading, setLoading] = useState(true);
  const list = useIngredientList();
  const [initialServing, setInitialServing] = useState(null);
  const [unavailable, setUnavailable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    foodAPI.getById(foodId).then(({ data }) => {
      if (!active) return;
      const ings = data.ingredients || [];
      if (ings.length === 0 || ings.some((ing) => !ing.food)) { setUnavailable(true); return; }
      list.setItems(ings.map((ing) => ({ food: ing.food, grams: ing.grams, state: ing.state || undefined })));
      setInitialServing({
        numServings: data.servingGrams ? undefined : Math.max(1, Math.round(data.numServings || 1)),
        servingGrams: data.servingGrams || '', totalWeight: data.totalWeight || '', servingName: data.servingName || '',
      });
    }).catch(() => active && setUnavailable(true)).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [foodId]);

  const totals = sumIngredients(list.items);
  const sv = useRecipeServing(totals.grams, initialServing);

  const saveChanges = async () => {
    setSaving(true);
    setError('');
    try {
      const { data } = await foodAPI.update(foodId, { ingredients: list.items.map(ingredientPayload), ...sv.payload });
      onUse(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save changes to this recipe.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Text style={styles.empty}>Loading ingredients…</Text>;
  if (unavailable) {
    return (
      <View>
        <Text style={styles.small}>This food's ingredients aren't available to edit — one or more may no longer be in the database.</Text>
        <ButtonRow><Btn title="Back" variant="secondary" onPress={onCancel} style={{ flex: 1 }} /></ButtonRow>
      </View>
    );
  }
  return (
    <View>
      <Hint>Adjust the ingredients for this log. "Continue" uses your changes just for this entry; "Save to recipe" also updates the saved food for next time.</Hint>
      <View style={{ gap: 6, marginTop: 8 }}>
        {list.items.map((ing, i) => (
          <IngredientRow key={i} ing={ing} onGrams={(g) => list.setGrams(i, g)} onState={(st) => list.setState(i, st)} onRemove={() => list.remove(i)} />
        ))}
      </View>
      <Label>Add another ingredient</Label>
      <FoodSearch onSelect={list.add} />
      <RecipeServingFields sv={sv} />
      <MacroPreview values={perServingOf(totals, sv.count)} suffix=" / serving" />
      <ErrorText>{error}</ErrorText>
      <ButtonRow>
        <Btn title="Back" variant="secondary" onPress={onCancel} style={{ flex: 1 }} />
        <Btn title={saving ? 'Saving…' : 'Save to recipe'} variant="secondary" disabled={saving || list.items.length === 0 || !sv.valid} onPress={saveChanges} style={{ flex: 1 }} />
        <Btn title="Continue" disabled={list.items.length === 0 || !sv.valid} style={{ flex: 1 }}
          onPress={() => onUse(buildVirtualRecipe({ foodId, foodName, ingredients: list.items, sv }))} />
      </ButtonRow>
    </View>
  );
}

// ── Editing logged meals ─────────────────────────────────────────────────────
/** Recipe meal: change how much of each ingredient was in this portion. */
export function RecipeMealEditor({ meal, recipe, foods, onSave, onCancel, saving }) {
  const list = useIngredientList((() => {
    if (meal.ingredients?.length) {
      return meal.ingredients.filter((ing) => foods[String(ing.food)])
        .map((ing) => ({ food: foods[String(ing.food)], state: ing.state || undefined, grams: r(ing.grams) }));
    }
    const base = (recipe.ingredients || []).filter((ing) => ing.food && typeof ing.food === 'object');
    const whole = recipe.servings?.find((s) => s.label === 'Whole recipe')?.grams || sumIngredients(base).grams || 1;
    const share = meal.grams ? meal.grams / whole : 1;
    return base.map((ing) => ({ food: ing.food, state: ing.state || undefined, grams: r((ing.grams || 0) * share) }));
  })());
  const [mealType, setMealType] = useState(meal.mealType);

  return (
    <View>
      <Text style={styles.title}>{meal.name}</Text>
      <Hint>Ingredients in this meal. Changes only apply to this meal; the saved recipe isn't changed.</Hint>
      <View style={{ gap: 6, marginTop: 8 }}>
        {list.items.length === 0 && <Text style={styles.empty}>No ingredients. Add at least one below.</Text>}
        {list.items.map((it, i) => (
          <IngredientRow key={i} ing={it} onGrams={(g) => list.setGrams(i, g)} onState={(st) => list.setState(i, st)} onRemove={() => list.remove(i)} />
        ))}
      </View>
      <Label>Add an ingredient</Label>
      <FoodSearch onSelect={list.add} />
      <MealTypePicker value={mealType} onChange={setMealType} />
      <MacroPreview values={sumIngredients(list.items)} />
      <ButtonRow>
        <Btn title="Cancel" variant="secondary" onPress={onCancel} style={{ flex: 1 }} />
        <Btn title={saving ? 'Saving…' : 'Save changes'} style={{ flex: 1 }}
          disabled={saving || list.items.every((it) => !(Number(it.grams) > 0)) || list.items.some((it) => Number(it.grams) < 0)}
          onPress={() => onSave({ mealType, ingredients: list.items.map(ingredientPayload) })} />
      </ButtonRow>
    </View>
  );
}

/** Quick-add entries (no food behind them): edit the name and numbers. */
export function QuickAddEditor({ meal, onSave, onCancel, saving }) {
  const [name, setName] = useState(meal.name);
  const [mealType, setMealType] = useState(meal.mealType);
  const [values, setValues] = useState({ calories: r(meal.calories), protein: r(meal.protein), carbs: r(meal.carbs), fat: r(meal.fat) });
  const valid = name.trim() && Object.values(values).every((v) => v !== '' && Number(v) >= 0);
  return (
    <View>
      <Hint>This was added with Quick add, so it isn't linked to a food and its numbers are edited directly.</Hint>
      <Label>Food name</Label>
      <TextInput style={styles.field} value={name} onChangeText={setName} />
      <View style={styles.grid2}>
        {[['calories', 'Calories (kcal)'], ['protein', 'Protein (g)'], ['carbs', 'Carbs (g)'], ['fat', 'Fat (g)']].map(([k, l]) => (
          <View key={k} style={styles.cell2}><Label>{l}</Label><NumInput value={values[k]} onChange={(v) => setValues({ ...values, [k]: v })} /></View>
        ))}
      </View>
      <MealTypePicker value={mealType} onChange={setMealType} />
      <ButtonRow>
        <Btn title="Cancel" variant="secondary" onPress={onCancel} style={{ flex: 1 }} />
        <Btn title={saving ? 'Saving…' : 'Save changes'} disabled={!valid || saving} style={{ flex: 1 }}
          onPress={() => onSave({ name: name.trim(), mealType, ...Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Number(v)])) })} />
      </ButtonRow>
    </View>
  );
}

const styles = makeStyles(() => ({
  btn:         { minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 8 },
  btnPrimary:  { backgroundColor: colors.brand },
  btnSecondary:{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  btnText:     { color: '#fff', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  field:       { height: 42, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, fontSize: 14, color: colors.textPrimary, backgroundColor: colors.surface },
  results:     { borderWidth: 1, borderColor: colors.border, borderRadius: 10, marginTop: 6, maxHeight: 300, overflow: 'hidden' },
  resultRow:   { paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.subtle },
  empty:       { textAlign: 'center', color: colors.textMuted, paddingVertical: 12, fontSize: 12 },
  name:        { fontSize: 14, fontWeight: '500', color: colors.textPrimary },
  title:       { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  small:       { fontSize: 13, color: colors.textSecondary },
  hintText:    { fontSize: 11, color: colors.textMuted },
  labelText:   { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  rowBetween:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  inline:      { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  grid2:       { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  cell2:       { width: '50%', paddingHorizontal: 5 },
  preview:     { flexDirection: 'row', backgroundColor: colors.inset, borderRadius: 12, padding: 10, marginTop: 14 },
  previewVal:  { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  ingRow:      { backgroundColor: colors.inset, borderRadius: 10, padding: 8 },
  noteBox:     { fontSize: 11, color: colors.textSecondary, backgroundColor: colors.inset, borderRadius: 10, padding: 10, marginTop: 12 },
  groupTitle: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5 },
}));
