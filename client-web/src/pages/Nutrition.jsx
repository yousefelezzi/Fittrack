import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { nutritionAPI, foodAPI } from '../api';
import MealPlanner from '../components/MealPlanner';
import DayNav from '../components/DayNav';
import { MEAL_TYPES, PROFILE_FIELD_NAMES } from '../constants/nutrition';
import { format, subDays, parseISO, isToday } from 'date-fns';
import { Plus, Trash2, Search, X, ChevronDown, ChefHat, Pencil, Check, Sparkles, Salad } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import {
  MACRO_COLORS, r, r0, servingText, scale, MICRO_CONFIG, sumMicros, addMicros,
  canPickState, storedStateOf, stateOf, stateLabel, foodInState, nameInState, yieldHint,
  portionIngredients, isEditableCustomFood, LABEL_FIELDS, EXTRA_FIELDS, customFoodInitial,
  sumIngredients, ingredientPayload, useRecipeServing, GOAL_NAMES,
  buildVirtualRecipe, customFoodDraft, fmtCount,
} from '../utils/foodLogic';
import { useAuth } from '../context/AuthContext';
import { adaptiveText } from '../utils/nutritionProgress';

const SATURATED_LIMIT = 20; // g a day (FDA daily value)

// ── Macro Pie + Micronutrient hover card ─────────────────────────────────────
// `supplementMicros` / `waterMicros`: vitamins and minerals from the supplements
// ticked off today and the water drunk.
function MacroCard({ totals, meals, supplementMicros, waterMicros }) {
  const [hovered, setHovered] = useState(false);
  const microTotals = sumMicros(meals, addMicros(supplementMicros, waterMicros));
  const fromSupplements = Object.values(supplementMicros || {}).some((v) => v > 0);
  const fromWater = Object.values(waterMicros || {}).some((v) => v > 0);
  const extraNote = [fromSupplements && 'supplements', fromWater && 'water'].filter(Boolean).join(' and ');

  // Split by calories, not grams: a gram of fat is 9 kcal, protein and carbs 4.
  // `value` drives the pie, so the slices show each macro's share of calories.
  const macroData = [
    { name: 'Protein', grams: r0(totals.protein), value: totals.protein * 4, key: 'protein' },
    { name: 'Carbs',   grams: r0(totals.carbs),   value: totals.carbs   * 4, key: 'carbs'   },
    { name: 'Fat',     grams: r0(totals.fat),     value: totals.fat     * 9, key: 'fat'     },
  ].filter(d => d.value > 0);
  const total = macroData.reduce((sum, d) => sum + d.value, 0);

  const hasData = macroData.length > 0;

  // Micros with a value (creatine is always listed)
  const activeMicros = MICRO_CONFIG.filter(cfg => cfg.alwaysShow || (microTotals[cfg.key] || 0) > 0);

  return (
    <div
      className="card relative overflow-hidden cursor-default select-none"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* ── Normal view: Pie left, legend right ── */}
      <div className={`transition-opacity duration-200 ${hovered && hasData && activeMicros.length > 0 ? 'opacity-0' : 'opacity-100'}`}>
        {hasData ? (
          <div className="flex items-center gap-3">
            {/* Pie chart pinned left */}
            <div className="w-28 h-28 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={macroData}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                    innerRadius={28}
                    outerRadius={52}
                    paddingAngle={2}
                    startAngle={90}
                    endAngle={-270}
                  >
                    {macroData.map((d) => (
                      <Cell key={d.key} fill={MACRO_COLORS[d.key]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legend: color dot, name, grams, % of calories */}
            <div className="flex flex-col gap-1.5 min-w-0">
              {macroData.map((d) => {
                const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
                return (
                  <div key={d.key} className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: MACRO_COLORS[d.key] }}
                    />
                    <span className="text-xs text-gray-600 dark:text-gray-400 w-12 shrink-0">{d.name}</span>
                    <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">{d.grams}g</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-28">
            <p className="text-sm text-gray-300 dark:text-gray-600">Add meals to see breakdown</p>
          </div>
        )}

        {hasData && activeMicros.length > 0 && (
          <p className="text-xs text-gray-300 dark:text-gray-600 text-center mt-2">
            Hover for micronutrients
          </p>
        )}
      </div>

      {/* ── Hover overlay: micronutrient totals ── */}
      {hovered && hasData && activeMicros.length > 0 && (
        <div className="absolute inset-0 bg-white dark:bg-gray-900 p-3 overflow-y-auto">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            Micronutrients today
            {extraNote && <span className="normal-case font-normal text-gray-400"> · includes {extraNote}</span>}
          </p>
          <div className="space-y-1.5">
            {activeMicros.map(({ key, label, unit, dv }) => {
              const val = microTotals[key] || 0;
              const pct = dv ? Math.min(100, Math.round((val / dv) * 100)) : null;
              return (
                <div key={key}>
                  <div className="flex justify-between items-baseline mb-0.5">
                    <span className="text-xs text-gray-600 dark:text-gray-400">{label}</span>
                    <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                      {val}{unit}{pct !== null ? <span className="text-gray-400 dark:text-gray-500 font-normal ml-1">({pct}% DV)</span> : null}
                    </span>
                  </div>
                  {pct !== null && (
                    <div className="h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          background: pct >= 100 ? '#10b981' : pct >= 50 ? '#0ea5e9' : '#f59e0b',
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Food Search Picker ────────────────────────────────────────────────────────
function FoodPicker({ onSelect }) {
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [mine,    setMine]    = useState([]); // your custom foods/recipes and saved ones
  const inputRef = useRef(null);
  const timerRef = useRef(null);
  useEffect(() => { foodAPI.mine().then(({ data }) => setMine(data)).catch(() => {}); }, []);

  const search = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const { data } = await foodAPI.search(q);
      setResults(data);
    } catch { setResults([]); }
    finally   { setLoading(false); }
  }, []);

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(query), 280);
    return () => clearTimeout(timerRef.current);
  }, [query, search]);

  const handleSelect = (food) => {
    onSelect(food);
    setQuery('');
    setResults([]);
    inputRef.current?.blur();
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          ref={inputRef}
          className="input pl-9 pr-8"
          placeholder="Search food database…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          autoComplete="off"
        />
        {query && (
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            onClick={() => { setQuery(''); setResults([]); }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Before typing: your own and saved foods and recipes. */}
      {focused && query.length === 0 && mine.length > 0 && (
        <div className="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg">
          <p className="px-4 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Your foods</p>
          {mine.map((food) => (
            <button key={food._id} onMouseDown={() => handleSelect(food)}
              className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-50 dark:border-gray-700 last:border-0 transition-colors">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {food.name}
                <span className="ml-1.5 text-[11px] font-normal text-gray-400">{food.ingredients?.length ? 'recipe' : 'custom'}{food.saved && !food.mine ? ' · saved' : ''}</span>
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                per 100g — {food.per100g.calories} kcal · P {food.per100g.protein}g · C {food.per100g.carbs}g · F {food.per100g.fat}g
              </p>
            </button>
          ))}
        </div>
      )}

      {focused && query.length > 0 && (
        <div className="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg">
          {loading && <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-3">Searching…</p>}
          {!loading && results.length === 0 && query.length > 1 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-3">No results for "{query}"</p>
          )}
          {results.map((food) => (
            <button
              key={food._id}
              onMouseDown={() => handleSelect(food)}
              className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-50 dark:border-gray-700 last:border-0 transition-colors"
            >
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{food.name}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                per 100g — {food.per100g.calories} kcal · P {food.per100g.protein}g · C {food.per100g.carbs}g · F {food.per100g.fat}g
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Portion Selector ─────────────────────────────────────────────────────────
// ── Raw vs cooked ────────────────────────────────────────────────────────────
function StateToggle({ food, state, onChange, small }) {
  const current = stateOf(food, state);
  return (
    <div className={`flex gap-${small ? 1 : 2}`}>
      {['uncooked', 'cooked'].map((k) => (
        <button key={k} type="button" onClick={() => onChange(k)}
          className={small
            ? `px-2 py-0.5 rounded-md text-[11px] font-medium capitalize transition-colors ${current === k
                ? 'bg-brand-600 text-white' : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700'}`
            : `flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors capitalize ${current === k
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600'}`}>
          {stateLabel(food, k)}
        </button>
      ))}
    </div>
  );
}

/**
 * `initial` ({ grams, state, mealType }) pre-fills it when editing a logged meal.
 */
function PortionSelector({ food: baseFood, onConfirm, onCancel, onEditIngredients, onEditFood, initial, confirmLabel = 'Add to log', cancelLabel = 'Back' }) {
  // Foods with a cooking yield can be logged by cooked or raw/dry weight.
  const pickable = canPickState(baseFood);
  const [cookState, setCookState] = useState(stateOf(baseFood, initial?.state));
  const food = foodInState(baseFood, cookState);
  const loggedName = nameInState(baseFood, cookState); // e.g. "Chicken Breast (raw)"
  const inStoredState = stateOf(baseFood, cookState) === storedStateOf(baseFood);

  // Common servings describe the food as stored (e.g. "1 breast" is cooked),
  // so the other state is logged by grams only.
  const allServings = baseFood.servings || [];
  const hasServings = allServings.length > 0 && inStoredState;
  // Default to a "medium" size when the food has sizes, otherwise the first serving.
  const defaultIdx = Math.max(0, allServings.findIndex((sv) => /\bmedium\b/i.test(sv.label)));
  // When editing, start from the logged grams (whatever serving it came from).
  const [mode,     setMode]     = useState(allServings.length > 0 && !initial ? 'serving' : 'grams');
  const [servIdx,  setServIdx]  = useState(defaultIdx);
  const [qty,      setQty]      = useState(1); // how many of the chosen serving
  const [grams,    setGrams]    = useState(initial?.grams ?? (allServings.length > 0 ? allServings[defaultIdx].grams : 100));
  const [mealType, setMealType] = useState(initial?.mealType ?? 'snack');

  const pickState = (next) => {
    setCookState(next);
    if (next !== storedStateOf(baseFood)) setMode('grams');
  };

  const effectiveGrams = mode === 'serving' && hasServings
    ? (food.servings[servIdx]?.grams ?? 100) * (Number(qty) || 0)
    : grams;
  const scaled = scale(food, effectiveGrams);

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-gray-900 dark:text-gray-100">{loggedName}</p>
          {food.ingredients?.length > 0 && onEditIngredients && (
            <button onClick={onEditIngredients}
              className="text-xs text-brand-600 dark:text-brand-400 font-medium hover:underline whitespace-nowrap">
              Edit ingredients
            </button>
          )}
          {/* Single custom foods: edit the label values (macros). Database foods can't be edited. */}
          {isEditableCustomFood(baseFood) && onEditFood && (
            <button onClick={onEditFood}
              className="text-xs text-brand-600 dark:text-brand-400 font-medium hover:underline whitespace-nowrap">
              Edit food
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          per 100g: {food.per100g.calories} kcal · P {food.per100g.protein}g · C {food.per100g.carbs}g · F {food.per100g.fat}g
        </p>
      </div>

      {pickable && (
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Weighed</label>
          <StateToggle food={baseFood} state={cookState} onChange={pickState} />
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">{yieldHint(baseFood)}</p>
        </div>
      )}

      <div className="flex gap-2">
        {hasServings && (
          <button onClick={() => setMode('serving')}
            className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              mode === 'serving' ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600'}`}>
            Common serving
          </button>
        )}
        <button onClick={() => setMode('grams')}
          className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
            mode === 'grams' ? 'bg-brand-600 text-white border-brand-600'
              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600'}`}>
          By grams
        </button>
      </div>

      {mode === 'serving' && hasServings ? (
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Serving size</label>
          <div className="flex gap-2">
            <input className="input w-20" type="number" min={0.25} step={0.5} value={qty} title="Number of servings"
              onChange={(e) => setQty(e.target.value)} />
            <div className="relative flex-1">
              <select className="input appearance-none pr-8" value={servIdx}
                onChange={(e) => { const i = Number(e.target.value); setServIdx(i); setGrams(food.servings[i].grams); }}>
                {food.servings.map((s, i) => <option key={i} value={i}>{servingText(s.label, s.grams)}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
          {Number(qty) !== 1 && Number(qty) > 0 && <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">= {r(effectiveGrams)} g</p>}
        </div>
      ) : (
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Amount (grams)</label>
          <input className="input" type="number" min={1} step={5} value={grams}
            onChange={(e) => setGrams(Number(e.target.value))} />
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Meal type</label>
        <div className="flex gap-2 flex-wrap">
          {MEAL_TYPES.map((t) => (
            <button key={t} onClick={() => setMealType(t)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors capitalize ${
                mealType === t ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Live macro preview */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 grid grid-cols-4 gap-2 text-center">
        {[
          { label: 'Calories', value: scaled.calories, unit: 'kcal' },
          { label: 'Protein',  value: scaled.protein,  unit: 'g' },
          { label: 'Carbs',    value: scaled.carbs,    unit: 'g' },
          { label: 'Fat',      value: scaled.fat,      unit: 'g' },
        ].map(({ label, value }) => (
          <div key={label}>
            <p className="text-base font-bold text-gray-900 dark:text-gray-100">{r0(value)}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button onClick={onCancel} className="btn-secondary flex-1 justify-center">{cancelLabel}</button>
        <button
          onClick={() => onConfirm({
            name: loggedName, mealType, ...scaled,
            // Remember how it was logged so the portion can be edited later.
            food: baseFood._id,
            grams: r(effectiveGrams),
            state: baseFood.isVirtual ? null : stateOf(baseFood, cookState),
            // A recipe used with changed ingredients (not saved): keep this
            // portion's share of each ingredient, so they can be edited later.
            ...(baseFood.isVirtual && { ingredients: portionIngredients(baseFood, effectiveGrams) }),
          })}
          disabled={effectiveGrams <= 0}
          className="btn-primary flex-1 justify-center"
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}

// ── Manual Entry ─────────────────────────────────────────────────────────────
function ManualEntry({ onConfirm, onCancel }) {
  const [meal, setMeal] = useState({ name: '', calories: 0, protein: 0, carbs: 0, fat: 0, mealType: 'snack' });
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">Enter nutritional info manually.</p>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Food name</label>
        <input className="input" placeholder="e.g. Homemade Lasagne" value={meal.name}
          onChange={(e) => setMeal({ ...meal, name: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {['calories', 'protein', 'carbs', 'fat'].map((field) => (
          <div key={field}>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 capitalize">
              {field} {field === 'calories' ? '(kcal)' : '(g)'}
            </label>
            <input className="input" type="number" min={0} value={meal[field]}
              onChange={(e) => setMeal({ ...meal, [field]: Number(e.target.value) })} />
          </div>
        ))}
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Meal type</label>
        <div className="flex gap-2 flex-wrap">
          {MEAL_TYPES.map((t) => (
            <button key={t} onClick={() => setMeal({ ...meal, mealType: t })}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors capitalize ${
                meal.mealType === t ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={onCancel} className="btn-secondary flex-1 justify-center">Back</button>
        <button onClick={() => onConfirm(meal)} disabled={!meal.name.trim()} className="btn-primary flex-1 justify-center">
          Add to log
        </button>
      </div>
    </div>
  );
}

// ── Custom Food (a single food, e.g. from a nutrition label) ─────────────────
/** Create a custom food, or edit one when `food` is passed. */
function CustomFoodForm({ food: editing, onSaved, onCancel }) {
  const init = customFoodInitial(editing);
  const [name, setName]               = useState(init?.name ?? '');
  const [brand, setBrand]             = useState(init?.brand ?? '');
  const [servingLabel, setServingLabel] = useState(init?.servingLabel ?? '');
  const [servingGrams, setServingGrams] = useState(init?.servingGrams ?? '');
  const [basis, setBasis]             = useState(init?.basis ?? 'serving'); // are the numbers per serving or per 100 g?
  const [values, setValues]           = useState(init?.values ?? {});
  const [showExtras, setShowExtras]   = useState(init?.showExtras ?? false);
  // Raw vs cooked (optional): what state the label describes, and how much
  // 100 g raw/dry weighs once cooked.
  const [cookMode, setCookMode]       = useState(init?.cookMode ?? 'none'); // none | raw | dry | cooked
  const [cookedFrom, setCookedFrom]   = useState(init?.cookedFrom ?? 'raw');  // when cookMode is 'cooked'
  const [cookedPer100, setCookedPer100] = useState(init?.cookedPer100 ?? '');
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');

  const { grams, num, toPer100, toServing, label, valid, rawWord, body } = customFoodDraft({
    name, brand, servingLabel, servingGrams, basis, values, cookMode, cookedFrom, cookedPer100, editing,
  });

  const handleSave = async () => {
    if (!valid) return;
    setSaving(true);
    setError('');
    try {
      const { data } = editing
        ? await foodAPI.update(editing._id, body)
        : await foodAPI.create({ ...body, category: 'custom' });
      onSaved(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save this food.');
    } finally {
      setSaving(false);
    }
  };

  const numberInput = (f) => (
    <div key={f.key}>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
        {f.label} ({f.unit}){f.required && ' *'}
      </label>
      <input className="input" type="number" min={0} step="any" value={values[f.key] ?? ''}
        onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {editing
          ? 'Changes apply the next time you log this food. Meals you already logged keep their numbers.'
          : 'Add a food from its nutrition label. It\'s saved so you can find it in search next time.'}
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Food name *</label>
          <input className="input" placeholder="e.g. Protein Bar" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Brand <span className="font-normal text-gray-400">· optional</span></label>
          <input className="input" placeholder="e.g. Grenade" value={brand} onChange={(e) => setBrand(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Serving size *</label>
          <input className="input" maxLength={30} placeholder="e.g. 1 bar, 2 slices" value={servingLabel} onChange={(e) => setServingLabel(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Serving weight (g) *</label>
          <input className="input" type="number" min={1} step="any" placeholder="60" value={servingGrams} onChange={(e) => setServingGrams(e.target.value)} />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Nutrition</label>
          <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
            {[['serving', 'Per serving'], ['100g', 'Per 100 g']].map(([k, t]) => (
              <button key={k} type="button" onClick={() => setBasis(k)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${basis === k
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">{LABEL_FIELDS.map(numberInput)}</div>
        <button type="button" onClick={() => setShowExtras(!showExtras)} className="text-xs text-brand-600 font-medium mt-2">
          {showExtras ? 'Hide' : 'Add'} fiber, sugar & sodium
        </button>
        {showExtras && <div className="grid grid-cols-3 gap-3 mt-2">{EXTRA_FIELDS.map(numberInput)}</div>}
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          Raw or cooked? <span className="font-normal text-gray-400">· optional</span>
        </label>
        <div className="flex gap-1 flex-wrap">
          {[['none', 'Doesn’t apply'], ['raw', 'Raw'], ['dry', 'Dry'], ['cooked', 'Cooked']].map(([k, t]) => (
            <button key={k} type="button" onClick={() => setCookMode(k)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${cookMode === k
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600'}`}>
              {t}
            </button>
          ))}
        </div>
        {cookMode !== 'none' && (
          <div className="mt-2 space-y-2">
            {cookMode === 'cooked' && (
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                Before cooking it’s
                <select className="input w-24 py-1 text-sm" value={cookedFrom} onChange={(e) => setCookedFrom(e.target.value)}>
                  <option value="raw">raw</option>
                  <option value="dry">dry</option>
                </select>
              </div>
            )}
            <div className="flex items-center gap-2 flex-wrap text-sm text-gray-500 dark:text-gray-400">
              100 g {rawWord} makes
              <input className="input w-20 py-1" type="number" min={10} max={1000} step={1} value={cookedPer100}
                placeholder={rawWord === 'dry' ? '280' : '75'} onChange={(e) => setCookedPer100(e.target.value)} />
              g cooked
            </div>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">
              e.g. meat usually shrinks to about 75 g; dry rice or pasta swells to 230–330 g. With this set, you can log the
              food by {rawWord} or cooked weight.
            </p>
          </div>
        )}
      </div>

      {grams > 0 && values.calories !== undefined && values.calories !== '' && (
        <p className="text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2">
          {basis === 'serving'
            ? <>Per 100 g: {r(num('calories') * toPer100)} kcal · P {r(num('protein') * toPer100)}g · C {r(num('carbs') * toPer100)}g · F {r(num('fat') * toPer100)}g</>
            : <>Per {servingText(label || 'serving', grams)}: {r(num('calories') * toServing)} kcal · P {r(num('protein') * toServing)}g · C {r(num('carbs') * toServing)}g · F {r(num('fat') * toServing)}g</>}
        </p>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-3">
        <button onClick={onCancel} className="btn-secondary flex-1 justify-center">Back</button>
        <button onClick={handleSave} disabled={!valid || saving} className="btn-primary flex-1 justify-center">
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Save food'}
        </button>
      </div>
    </div>
  );
}

// ── Recipe ingredients (shared by the builder and the editor) ────────────────
function IngredientRow({ ing, onGrams, onState, onRemove }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2">
      <div className="flex items-center gap-2">
        <p className="flex-1 text-sm text-gray-900 dark:text-gray-100 truncate">{nameInState(ing.food, ing.state)}</p>
        <input className="input w-20 text-sm py-1" type="number" min={0} step={5} value={ing.grams}
          onChange={(e) => onGrams(Number(e.target.value))} />
        <span className="text-xs text-gray-400 dark:text-gray-500">g</span>
        <button onClick={onRemove} className="p-1 text-gray-300 dark:text-gray-600 hover:text-red-400 dark:hover:text-red-400">
          <Trash2 size={14} />
        </button>
      </div>
      {canPickState(ing.food) && (
        <div className="flex items-center gap-1 mt-1.5">
          <span className="text-[11px] text-gray-400 dark:text-gray-500 mr-1">Weighed</span>
          <StateToggle food={ing.food} state={ing.state} onChange={onState} small />
        </div>
      )}
    </div>
  );
}

// ── Custom Food Builder (recipe from existing ingredients) ───────────────────
// ── Recipe serving size (shared by the builder and the editor) ───────────────
function RecipeServingFields({ sv }) {
  const tab = (key, text) => (
    <button type="button" onClick={() => sv.setMode(key)}
      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${sv.mode === key
        ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm'
        : 'text-gray-500 dark:text-gray-400'}`}>
      {text}
    </button>
  );

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Finished weight (g) <span className="font-normal text-gray-400">· optional</span></label>
        <input className="input w-32" type="number" min={1} step={1} value={sv.totalWeight}
          placeholder={sv.rawGrams > 0 ? String(Math.round(sv.rawGrams)) : 'e.g. 800'}
          onChange={(e) => sv.setTotalWeight(e.target.value)} />
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
          Estimated at {Math.round(sv.rawGrams)} g from the ingredients (raw/dry ones counted at their cooked weight). For accuracy, weigh the finished dish and enter it here.
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Serving size</label>
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg w-fit mb-2">
          {tab('count', 'Number of servings')}
          {tab('weight', 'Weight per serving')}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {sv.mode === 'count' ? (
            <>
              <span className="text-sm text-gray-500 dark:text-gray-400">Makes</span>
              <input className="input w-20" type="number" min={1} step={1} value={sv.numServings}
                onChange={(e) => sv.setNumServings(e.target.value === '' ? '' : Math.max(1, Number(e.target.value)))} />
              <span className="text-sm text-gray-500 dark:text-gray-400">servings of {Math.round(sv.gramsPerServing) || 0} g</span>
            </>
          ) : (
            <>
              <input className="input w-24" type="number" min={1} step={1} value={sv.servingGrams} placeholder="250"
                onChange={(e) => sv.setServingGrams(e.target.value)} />
              <span className="text-sm text-gray-500 dark:text-gray-400">
                g per serving{Number(sv.servingGrams) > 0 && sv.effTotal > 0 ? ` · makes ${fmtCount(Math.round(sv.count * 10) / 10)} servings` : ''}
              </span>
            </>
          )}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Serving name <span className="font-normal text-gray-400">· optional</span></label>
        <input className="input" maxLength={30} placeholder="e.g. bowl, slice, plate" value={sv.servingName}
          onChange={(e) => sv.setServingName(e.target.value)} />
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">Shown when logging: “{servingText(sv.label, Math.round(sv.gramsPerServing) || 0)}”</p>
      </div>
    </div>
  );
}

function CustomFoodBuilder({ onSaved, onCancel }) {
  const [name, setName]             = useState('');
  const [ingredients, setIngredients] = useState([]); // [{ food, grams }]
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  const addIngredient = (food) => {
    setIngredients((prev) => [...prev, { food, grams: 100 }]);
  };
  const updateGrams = (idx, grams) => {
    setIngredients((prev) => prev.map((ing, i) => (i === idx ? { ...ing, grams } : ing)));
  };
  const removeIngredient = (idx) => {
    setIngredients((prev) => prev.filter((_, i) => i !== idx));
  };
  const updateState = (idx, state) =>
    setIngredients((prev) => prev.map((ing, i) => (i === idx ? { ...ing, state } : ing)));

  const totals = sumIngredients(ingredients);

  const sv = useRecipeServing(totals.grams);
  const perServing = {
    calories: r(totals.calories / sv.count),
    protein:  r(totals.protein  / sv.count),
    carbs:    r(totals.carbs    / sv.count),
    fat:      r(totals.fat      / sv.count),
  };

  const handleSave = async () => {
    if (!name.trim() || ingredients.length === 0 || !sv.valid) return;
    setSaving(true);
    setError('');
    try {
      const { data } = await foodAPI.create({
        name: name.trim(),
        ...sv.payload,
        ingredients: ingredients.map(ingredientPayload),
      });
      onSaved(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save this recipe.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Build a custom food from ingredients already in the database — like a recipe.
      </p>

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Recipe name</label>
        <input className="input" placeholder="e.g. Chicken Stir-fry" value={name}
          onChange={(e) => setName(e.target.value)} />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Add ingredients</label>
        <FoodPicker onSelect={addIngredient} />
      </div>

      {ingredients.length > 0 && (
        <div className="space-y-2">
          {ingredients.map((ing, idx) => (
            <IngredientRow key={idx} ing={ing}
              onGrams={(g) => updateGrams(idx, g)} onState={(st) => updateState(idx, st)} onRemove={() => removeIngredient(idx)} />
          ))}
        </div>
      )}

      {ingredients.length > 0 && <RecipeServingFields sv={sv} />}

      {ingredients.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 grid grid-cols-4 gap-2 text-center">
          {[
            { label: 'Calories', value: perServing.calories },
            { label: 'Protein',  value: perServing.protein },
            { label: 'Carbs',    value: perServing.carbs },
            { label: 'Fat',      value: perServing.fat },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-base font-bold text-gray-900 dark:text-gray-100">{r0(value)}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">{label} / serving</p>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-3">
        <button onClick={onCancel} className="btn-secondary flex-1 justify-center">Back</button>
        <button
          onClick={handleSave}
          disabled={!name.trim() || ingredients.length === 0 || !sv.valid || saving}
          className="btn-primary flex-1 justify-center"
        >
          {saving ? 'Saving…' : 'Save recipe'}
        </button>
      </div>
    </div>
  );
}

// ── Recipe Editor (adjust an existing recipe's ingredients before logging) ───
function RecipeEditor({ foodId, foodName, onUse, onCancel }) {
  const [loading, setLoading]         = useState(true);
  const [ingredients, setIngredients] = useState([]); // [{ food: {_id,name,per100g}, grams }]
  const [initialServing, setInitialServing] = useState(null); // saved serving settings, once loaded
  const [unavailable, setUnavailable] = useState(false);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await foodAPI.getById(foodId);
        if (!active) return;
        const list = data.ingredients || [];
        const missing = list.some((ing) => !ing.food);
        if (list.length === 0 || missing) {
          setUnavailable(true);
        } else {
          setIngredients(list.map((ing) => ({ food: ing.food, grams: ing.grams, state: ing.state || undefined })));
          setInitialServing({
            numServings: data.servingGrams ? undefined : Math.max(1, Math.round(data.numServings || 1)),
            servingGrams: data.servingGrams || '',
            totalWeight: data.totalWeight || '',
            servingName: data.servingName || '',
          });
        }
      } catch {
        setUnavailable(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [foodId]);

  const addIngredient = (food) => setIngredients((prev) => [...prev, { food, grams: 100 }]);
  const updateGrams = (idx, grams) =>
    setIngredients((prev) => prev.map((ing, i) => (i === idx ? { ...ing, grams } : ing)));
  const removeIngredient = (idx) =>
    setIngredients((prev) => prev.filter((_, i) => i !== idx));
  const updateState = (idx, state) =>
    setIngredients((prev) => prev.map((ing, i) => (i === idx ? { ...ing, state } : ing)));

  const totals = sumIngredients(ingredients);

  const sv = useRecipeServing(totals.grams, initialServing);
  const perServing = {
    calories: r(totals.calories / sv.count),
    protein:  r(totals.protein  / sv.count),
    carbs:    r(totals.carbs    / sv.count),
    fat:      r(totals.fat      / sv.count),
  };

  // A food-shaped object from the edited ingredients, so the normal
  // PortionSelector can log it — no save needed.
  const buildVirtualFood = () => buildVirtualRecipe({ foodId, foodName, ingredients, sv });

  const handleUse = () => {
    if (ingredients.length === 0 || !sv.valid) return;
    onUse(buildVirtualFood());
  };

  const handleSaveChanges = async () => {
    if (ingredients.length === 0) return;
    setSaving(true);
    setError('');
    try {
      const { data } = await foodAPI.update(foodId, {
        ingredients: ingredients.map(ingredientPayload),
        ...sv.payload,
      });
      onUse(data); // proceed to portion selection with the saved version
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save changes to this recipe.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-gray-300 dark:text-gray-600 text-center py-4">Loading ingredients…</p>;
  }

  if (unavailable) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          This food's ingredients aren't available to edit — one or more may no longer be in the database.
        </p>
        <button onClick={onCancel} className="btn-secondary w-full justify-center">Back</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Adjust the ingredients for this log. "Continue" uses your changes just for this entry —
        "Save to recipe" also updates the saved food for next time.
      </p>

      <div className="space-y-2">
        {ingredients.map((ing, idx) => (
          <IngredientRow key={idx} ing={ing}
            onGrams={(g) => updateGrams(idx, g)} onState={(st) => updateState(idx, st)} onRemove={() => removeIngredient(idx)} />
        ))}
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Add another ingredient</label>
        <FoodPicker onSelect={addIngredient} />
      </div>

      <RecipeServingFields sv={sv} />

      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 grid grid-cols-4 gap-2 text-center">
        {[
          { label: 'Calories', value: perServing.calories },
          { label: 'Protein',  value: perServing.protein },
          { label: 'Carbs',    value: perServing.carbs },
          { label: 'Fat',      value: perServing.fat },
        ].map(({ label, value }) => (
          <div key={label}>
            <p className="text-base font-bold text-gray-900 dark:text-gray-100">{r0(value)}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">{label} / serving</p>
          </div>
        ))}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-2">
        <button onClick={onCancel} className="btn-secondary flex-1 justify-center">Back</button>
        <button onClick={handleSaveChanges} disabled={saving || ingredients.length === 0 || !sv.valid}
          className="btn-secondary flex-1 justify-center text-sm">
          {saving ? 'Saving…' : 'Save to recipe'}
        </button>
        <button onClick={handleUse} disabled={ingredients.length === 0 || !sv.valid}
          className="btn-primary flex-1 justify-center">
          Continue
        </button>
      </div>
    </div>
  );
}

// ── Edit Meal ────────────────────────────────────────────────────────────────
// What can be edited on a logged meal depends on where it came from:
//   • database food → portion size and raw/cooked
//   • custom food   → portion size and raw/cooked, plus the food's own macros
//   • recipe        → the amount of each ingredient in this meal
//   • quick add (no food behind it) → its name and numbers
// Nutrition for food and recipe meals is always recalculated on the server.

const pill = (active) => `px-3 py-1 rounded-full text-xs font-medium border transition-colors capitalize ${
  active ? 'bg-brand-600 text-white border-brand-600'
    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600'}`;

function MealTypePicker({ value, onChange }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Meal type</label>
      <div className="flex gap-2 flex-wrap">
        {MEAL_TYPES.map((t) => <button key={t} onClick={() => onChange(t)} className={pill(value === t)}>{t}</button>)}
      </div>
    </div>
  );
}

function MacroPreview({ values }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 grid grid-cols-4 gap-2 text-center">
      {[['Calories', values.calories], ['Protein', values.protein], ['Carbs', values.carbs], ['Fat', values.fat]].map(([label, v]) => (
        <div key={label}>
          <p className="text-base font-bold text-gray-900 dark:text-gray-100">{r0(v)}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">{label}</p>
        </div>
      ))}
    </div>
  );
}

/** Recipe meal: change how much of each ingredient was in this portion. */
function RecipeMealEditor({ meal, recipe, foods, onSave, onCancel, saving }) {
  const [items, setItems] = useState(() => {
    // This meal's own amounts if it has them (edited before, or logged from a
    // changed recipe); otherwise its share of the saved recipe.
    if (meal.ingredients?.length) {
      return meal.ingredients
        .filter((ing) => foods[String(ing.food)])
        .map((ing) => ({ food: foods[String(ing.food)], state: ing.state || undefined, grams: r(ing.grams) }));
    }
    const base = (recipe.ingredients || []).filter((ing) => ing.food && typeof ing.food === 'object');
    const whole = recipe.servings?.find((sv) => sv.label === 'Whole recipe')?.grams
      || sumIngredients(base).grams || 1;
    const share = meal.grams ? meal.grams / whole : 1;
    return base.map((ing) => ({ food: ing.food, state: ing.state || undefined, grams: r((ing.grams || 0) * share) }));
  });
  const [mealType, setMealType] = useState(meal.mealType);
  const totals = sumIngredients(items);

  const setGrams = (idx, g) => setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, grams: g } : it)));
  const setState = (idx, st) => setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, state: st } : it)));
  const remove   = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx));
  const add      = (f) => setItems((prev) => [...prev, { food: f, grams: 100 }]);

  return (
    <div className="space-y-4">
      <div>
        <p className="font-semibold text-gray-900 dark:text-gray-100">{meal.name}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Ingredients in this meal. Changes only apply to this meal; the saved recipe isn't changed.
        </p>
      </div>
      <div className="space-y-2">
        {items.length === 0 && (
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-2">No ingredients. Add at least one below.</p>
        )}
        {items.map((it, idx) => (
          <IngredientRow key={idx} ing={it}
            onGrams={(g) => setGrams(idx, g)} onState={(st) => setState(idx, st)} onRemove={() => remove(idx)} />
        ))}
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Add an ingredient</label>
        <FoodPicker onSelect={add} />
      </div>
      <MealTypePicker value={mealType} onChange={setMealType} />
      <MacroPreview values={totals} />
      <div className="flex gap-3">
        <button onClick={onCancel} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button
          onClick={() => onSave({ mealType, ingredients: items.map(ingredientPayload) })}
          disabled={saving || items.every((it) => !(Number(it.grams) > 0)) || items.some((it) => Number(it.grams) < 0)}
          className="btn-primary flex-1 justify-center">
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}

/** Quick-add entries (no food behind them): edit the name and numbers. */
function QuickAddEditor({ meal, onSave, onCancel, saving }) {
  const [name, setName]         = useState(meal.name);
  const [mealType, setMealType] = useState(meal.mealType);
  const [values, setValues]     = useState(() => ({
    calories: r(meal.calories), protein: r(meal.protein), carbs: r(meal.carbs), fat: r(meal.fat),
  }));
  const valid = name.trim() && Object.values(values).every((v) => v !== '' && Number(v) >= 0);

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-400 dark:text-gray-500">
        This was added with Quick add, so it isn't linked to a food and its numbers are edited directly.
      </p>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Food name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[['calories', 'Calories (kcal)'], ['protein', 'Protein (g)'], ['carbs', 'Carbs (g)'], ['fat', 'Fat (g)']].map(([key, label]) => (
          <div key={key}>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
            <input className="input" type="number" min={0} step="any" value={values[key]}
              onChange={(e) => setValues({ ...values, [key]: e.target.value })} />
          </div>
        ))}
      </div>
      <MealTypePicker value={mealType} onChange={setMealType} />
      <div className="flex gap-3">
        <button onClick={onCancel} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button
          onClick={() => onSave({ name: name.trim(), mealType, ...Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Number(v)])) })}
          disabled={!valid || saving} className="btn-primary flex-1 justify-center">
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}

function EditMealModal({ meal, onClose, onSave }) {
  const [food, setFood]       = useState(null);
  const [ingFoods, setIngFoods] = useState({}); // id → food, for recipe meals
  const [view, setView]       = useState('loading'); // loading | portion | edit-food | recipe | quick | missing
  const [foodEdited, setFoodEdited] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (!meal) return;
    setError('');
    setFoodEdited(false);
    if (!meal.food) { setView('quick'); return; }
    setView('loading');
    let cancelled = false;
    foodAPI.getById(meal.food)
      .then(async ({ data }) => {
        if (cancelled) return;
        const isRecipe = data.ingredients?.length > 0;
        if (isRecipe) {
          // Ingredient foods: from the recipe, plus any this meal has that the recipe doesn't.
          const map = {};
          for (const ing of data.ingredients) if (ing.food && typeof ing.food === 'object') map[String(ing.food._id)] = ing.food;
          const missing = (meal.ingredients || []).map((ing) => String(ing.food)).filter((id) => !map[id]);
          const fetched = await Promise.all(missing.map((id) => foodAPI.getById(id).then((r2) => r2.data).catch(() => null)));
          fetched.forEach((f) => { if (f) map[String(f._id)] = f; });
          if (cancelled) return;
          setIngFoods(map);
        }
        setFood(data);
        setView(isRecipe ? 'recipe' : 'portion');
      })
      .catch(() => { if (!cancelled) setView('missing'); });
    return () => { cancelled = true; };
  }, [meal]);

  if (!meal) return null;

  const save = async (update) => {
    setSaving(true);
    setError('');
    try { await onSave(meal._id, update); onClose(); }
    catch (err) { setError(err.response?.data?.message || 'Could not save changes'); }
    finally { setSaving(false); }
  };

  const title = view === 'edit-food' ? 'Edit Food' : view === 'recipe' ? 'Edit Ingredients'
    : view === 'quick' ? 'Edit Quick Add' : 'Edit Portion';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 dark:bg-black/50 px-4 py-4">
      <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl shadow-xl p-5 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X size={18} /></button>
        </div>

        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

        {view === 'loading' && (
          <div className="flex justify-center py-10"><div className="w-6 h-6 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
        )}

        {view === 'portion' && food && (
          <div className="space-y-3">
            {foodEdited && (
              <p className="text-xs text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-900/30 rounded-lg px-3 py-2">
                Food updated. Save to apply the new values to this meal.
              </p>
            )}
            <PortionSelector
              key={food.updatedAt || food._id}
              food={food}
              initial={{ grams: meal.grams, state: meal.state, mealType: meal.mealType }}
              confirmLabel={saving ? 'Saving…' : 'Save changes'}
              cancelLabel="Cancel"
              // Only the portion is sent; the server recalculates from the food.
              onConfirm={({ grams, state, mealType }) => save({ grams, state, mealType })}
              onCancel={onClose}
              onEditFood={() => setView('edit-food')}
            />
          </div>
        )}

        {view === 'edit-food' && food && (
          <CustomFoodForm
            food={food}
            onSaved={(updated) => { setFood(updated); setFoodEdited(true); setView('portion'); }}
            onCancel={() => setView('portion')}
          />
        )}

        {view === 'recipe' && food && (
          <RecipeMealEditor meal={meal} recipe={food} foods={ingFoods} saving={saving} onSave={save} onCancel={onClose} />
        )}

        {view === 'quick' && (
          <QuickAddEditor meal={meal} saving={saving} onSave={save} onCancel={onClose} />
        )}

        {view === 'missing' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              The food this meal was logged from has been deleted, so it can't be edited. You can delete the meal and log it again.
            </p>
            <button onClick={onClose} className="btn-secondary w-full justify-center">Close</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Add Meal Modal ────────────────────────────────────────────────────────────
function AddMealModal({ open, onClose, onAdd }) {
  const [step, setStep]         = useState('search');
  const [selectedFood, setFood] = useState(null);

  useEffect(() => { if (open) { setStep('search'); setFood(null); } }, [open]);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 dark:bg-black/50 px-4 py-4">
      <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl shadow-xl p-5 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            {step === 'search' ? 'Add Food'
              : step === 'portion' ? 'Set Portion'
              : step === 'custom' ? 'Create a Recipe'
              : step === 'custom-food' ? 'Create a Custom Food'
              : step === 'edit-ingredients' ? 'Edit Ingredients'
              : step === 'edit-food' ? 'Edit Food'
              : 'Quick Add'}
          </h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X size={18} /></button>
        </div>

        {step === 'search' && (
          <div className="space-y-4">
            <FoodPicker onSelect={(food) => { setFood(food); setStep('portion'); }} />
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
              <span className="text-xs text-gray-400 dark:text-gray-500">or</span>
              <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
            </div>
            <button onClick={() => setStep('custom-food')} className="btn-secondary w-full justify-center text-sm">
              <Plus size={14} /> Create a custom food
            </button>
            <button onClick={() => setStep('custom')} className="btn-secondary w-full justify-center text-sm">
              <ChefHat size={14} /> Create a recipe from ingredients
            </button>
            <button onClick={() => setStep('manual')} className="btn-secondary w-full justify-center text-sm">
              <Plus size={14} /> Quick add (log once, not saved)
            </button>
          </div>
        )}

        {step === 'portion' && selectedFood && (
          <PortionSelector
            food={selectedFood}
            onConfirm={(mealData) => { onAdd(mealData); onClose(); }}
            onCancel={() => setStep('search')}
            onEditIngredients={selectedFood.ingredients?.length ? () => setStep('edit-ingredients') : undefined}
            onEditFood={() => setStep('edit-food')}
          />
        )}

        {step === 'edit-food' && selectedFood && (
          <CustomFoodForm
            food={selectedFood}
            onSaved={(food) => { setFood(food); setStep('portion'); }}
            onCancel={() => setStep('portion')}
          />
        )}

        {step === 'edit-ingredients' && selectedFood && (
          <RecipeEditor
            foodId={selectedFood._id}
            foodName={selectedFood.name}
            onUse={(virtualFood) => { setFood(virtualFood); setStep('portion'); }}
            onCancel={() => setStep('portion')}
          />
        )}

        {step === 'custom-food' && (
          <CustomFoodForm
            onSaved={(food) => { setFood(food); setStep('portion'); }}
            onCancel={() => setStep('search')}
          />
        )}

        {step === 'custom' && (
          <CustomFoodBuilder
            onSaved={(food) => { setFood(food); setStep('portion'); }}
            onCancel={() => setStep('search')}
          />
        )}

        {step === 'manual' && (
          <ManualEntry
            onConfirm={(mealData) => { onAdd(mealData); onClose(); }}
            onCancel={() => setStep('search')}
          />
        )}
      </div>
    </div>
  );
}

// ── Goal explanation ─────────────────────────────────────────────────────────
function GoalInfo({ info }) {
  const { user } = useAuth();
  if (!info) return null;
  if (!info.targets) {
    const list = info.missing.map((m) => PROFILE_FIELD_NAMES[m]);
    const text = list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list.at(-1)}` : list[0];
    return (
      <div className="card !py-3 text-sm text-gray-500 dark:text-gray-400">
        Add your {text} to your <Link to="/profile" className="text-brand-600 font-medium">profile</Link> to get calorie and macro goals based on your fitness goal.
      </div>
    );
  }
  const { basis } = info;
  return (
    <div className="card !py-3 text-sm text-gray-500 dark:text-gray-400 space-y-0.5">
      <p>
        Goals set for <span className="font-medium text-gray-700 dark:text-gray-300">{GOAL_NAMES[basis.goal]}</span>:{' '}
        {basis.adjustment === 'maintenance'
          ? <>maintenance, about {basis.maintenance.toLocaleString()} kcal.</>
          : <>{basis.adjustment} from about {basis.maintenance.toLocaleString()} kcal maintenance.</>}
      </p>
      {basis.stepCalories > 0 && (
        <p className="text-xs">Includes +{basis.stepCalories} kcal for today's {basis.steps.toLocaleString()} <Link to="/steps" className="text-brand-600">steps</Link>.</p>
      )}
      {basis.workoutCalories > 0 && (
        <p className="text-xs">Includes +{basis.workoutCalories} kcal for today's workouts and cardio.</p>
      )}
      {adaptiveText(basis.adaptive, user?.bodyWeightUnit) && (
        <p className={`text-xs ${basis.adaptive?.reason ? '' : 'text-sky-700 dark:text-sky-300'}`}>
          {adaptiveText(basis.adaptive, user?.bodyWeightUnit)} <Link to="/nutrition/weight" className="text-brand-600">Weight log</Link>
        </p>
      )}
      {basis.floored && <p className="text-xs">Raised to the minimum recommended intake rather than going lower.</p>}
      {basis.activityAssumed && !basis.dynamic && (
        <p className="text-xs">Assuming you're moderately active. <Link to="/profile" className="text-brand-600">Set your activity level</Link> for a more accurate goal.</p>
      )}
      <p className="text-xs">
        {basis.dynamic
          ? <>Dynamic goal on: worked out from your weight change, steps and workouts. Turn it off in <Link to="/settings" className="text-brand-600">Settings</Link> to use your activity level instead.</>
          : <>Worked out from your profile and activity level{basis.dynamicPending ? ' (the dynamic goal takes over after 2 weeks of data)' : ''}. Change them in your <Link to="/profile" className="text-brand-600">profile</Link> and today's goals update automatically.</>}
      </p>
    </div>
  );
}

// ── Copy meals from an earlier day ───────────────────────────────────────────
/**
 * "Add yesterday's breakfast" etc.: chips for each meal type logged on an
 * earlier day (yesterday by default, or any of the last 7 days), plus "All".
 */
function CopyFromDay({ date, onCopied }) {
  const [daysBack, setDaysBack] = useState(1);
  const [source, setSource]     = useState(null);
  const [busy, setBusy]         = useState(null);
  const [done, setDone]         = useState({}); // what's been added this visit
  const [error, setError]       = useState('');

  const fromDate = format(subDays(parseISO(date), daysBack), 'yyyy-MM-dd');

  useEffect(() => {
    let cancelled = false;
    setSource(null);
    setDone({});
    setError('');
    nutritionAPI.getByDate(fromDate)
      .then(({ data }) => { if (!cancelled) setSource(data); })
      .catch(() => { if (!cancelled) setSource(null); });
    return () => { cancelled = true; };
  }, [fromDate]);

  const meals = source?.meals || [];
  const groups = MEAL_TYPES
    .map((type) => {
      const list = meals.filter((m) => m.mealType === type);
      return { type, count: list.length, kcal: list.reduce((sum, m) => sum + (m.calories || 0), 0) };
    })
    .filter((g) => g.count > 0);

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

  const dayName = daysBack === 1 ? (isToday(parseISO(date)) ? 'yesterday' : 'the day before') : format(parseISO(fromDate), 'EEE, MMM d');
  const chip = (active) => `inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors disabled:opacity-60 ${
    active ? 'border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:border-brand-400'}`;

  return (
    <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 px-3 py-2.5 space-y-2">
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <span>Add meals from</span>
        <select className="bg-transparent font-medium text-gray-700 dark:text-gray-200 outline-none cursor-pointer"
          value={daysBack} onChange={(e) => setDaysBack(Number(e.target.value))}>
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <option key={n} value={n}>
              {n === 1 ? (isToday(parseISO(date)) ? 'yesterday' : 'the day before') : format(subDays(parseISO(date), n), 'EEE, MMM d')}
            </option>
          ))}
        </select>
      </div>
      {source === null ? null : groups.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500">Nothing logged {dayName}.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {groups.map((g) => (
            <button key={g.type} onClick={() => copy(g.type, [g.type])} disabled={!!busy || done[g.type]}
              className={chip(done[g.type])} title={`Add ${dayName}'s ${g.type} (${g.count} item${g.count !== 1 ? 's' : ''})`}>
              {done[g.type] ? <Check size={12} /> : <Plus size={12} />}
              <span className="capitalize">{g.type}</span>
              <span className="text-gray-400 dark:text-gray-500 font-normal">{Math.round(g.kcal)} kcal</span>
            </button>
          ))}
          {groups.length > 1 && (
            <button onClick={() => copy('all')} disabled={!!busy || done.all} className={chip(done.all)}>
              {done.all ? <Check size={12} /> : <Plus size={12} />} All
            </button>
          )}
        </div>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Nutrition() {
  const [date,      setDate]      = useState(format(new Date(), 'yyyy-MM-dd'));
  const [log,       setLog]       = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState(null);
  const [goalInfo,  setGoalInfo]  = useState(null);
  const [plannerOpen, setPlannerOpen] = useState(false);

  useEffect(() => {
    nutritionAPI.getTargets().then((res) => setGoalInfo(res.data)).catch(() => setGoalInfo(null));
  }, []);

  const fetchLog = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await nutritionAPI.getByDate(date);
      setLog(data);
    } catch { setLog(null); }
    finally   { setLoading(false); }
  }, [date]);

  useEffect(() => { fetchLog(); }, [fetchLog]);

  const saturated = (log?.meals || []).reduce((n, m) => n + (m.micros?.saturatedFat || 0), 0);
  const totals = log?.meals?.reduce(
    (acc, m) => ({
      calories: acc.calories + m.calories,
      protein:  acc.protein  + m.protein,
      carbs:    acc.carbs    + m.carbs,
      fat:      acc.fat      + m.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  ) || { calories: 0, protein: 0, carbs: 0, fat: 0 };

  const handleAdd = async (mealData) => {
    try {
      let currentLog = log;
      if (!currentLog) {
        const { data } = await nutritionAPI.upsert({ date });
        currentLog = data;
      }
      const { data } = await nutritionAPI.addMeal(currentLog._id, mealData);
      setLog(data);
    } catch (err) { console.error(err); }
  };

  const handleUpdate = async (mealId, update) => {
    const { data } = await nutritionAPI.updateMeal(log._id, mealId, update);
    setLog(data);
  };

  const handleDelete = async (mealId) => {
    try {
      const { data } = await nutritionAPI.deleteMeal(log._id, mealId);
      setLog(data);
    } catch (err) { console.error(err); }
  };

  // A day's own goals win (past days keep what applied then); otherwise use the
  // current personalized targets.
  const goals = log?.dailyGoals ?? goalInfo?.targets ?? null;
  const isPast = date < format(new Date(), 'yyyy-MM-dd');

  const mealsByType = MEAL_TYPES.reduce((acc, type) => {
    const meals = log?.meals?.filter((m) => m.mealType === type) || [];
    if (meals.length) acc[type] = meals;
    return acc;
  }, {});

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Nutrition</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setPlannerOpen(true)} className="btn-secondary text-sm"><Sparkles size={15} /> Meal plan</button>
          <DayNav date={date} onChange={setDate} allowFuture />
        </div>
      </div>

      {!isPast && <GoalInfo info={goalInfo} />}

      {/* Summary row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Calorie card */}
        <div className="card flex flex-col items-center justify-center py-5">
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{r0(totals.calories)}</p>
          <p className="text-sm text-gray-400 dark:text-gray-500">kcal consumed</p>
          {goals?.calories && (
            <div className="w-full mt-3 px-2">
              <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-brand-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.round((totals.calories / goals.calories) * 100))}%` }} />
              </div>
              <p className="text-xs text-gray-300 dark:text-gray-600 mt-1 text-center">
                Goal: {r0(goals.calories).toLocaleString()} kcal
              </p>
            </div>
          )}
        </div>

        {/* Macro pie + micro hover */}
        <MacroCard totals={totals} meals={log?.meals || []} supplementMicros={log?.supplementMicros} waterMicros={log?.waterMicros} />
      </div>

      {/* Macro progress bars */}
      {['protein', 'carbs', 'fat'].map((macro) => {
        const val  = r0(totals[macro]);
        const goal = r0(goals?.[macro]) || (macro === 'protein' ? 150 : macro === 'carbs' ? 200 : 65);
        const pct  = Math.min(100, Math.round((val / goal) * 100));
        return (
          <div key={macro}>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400 capitalize w-16">{macro}</span>
              <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: MACRO_COLORS[macro] }} />
              </div>
              <span className="text-xs text-gray-400 dark:text-gray-500 w-20 text-right">{val}g / {goal}g</span>
            </div>
            {/* Like a nutrition label: the saturated part of the fat, against the 20 g daily limit. */}
            {macro === 'fat' && (
              <p className={`text-xs ml-[76px] mt-0.5 ${saturated > SATURATED_LIMIT ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400 dark:text-gray-500'}`}>
                of which saturated: {r(saturated)}g (limit {SATURATED_LIMIT}g)
              </p>
            )}
          </div>
        );
      })}

      {/* Meal log */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Today's meals</h2>
          <button onClick={() => setModalOpen(true)} className="btn-primary py-1.5 text-xs">
            <Plus size={14} /> Add food
          </button>
        </div>

        <CopyFromDay key={date} date={date} onCopied={setLog} />

        {loading ? (
          <p className="text-sm text-gray-300 dark:text-gray-600 text-center py-4">Loading…</p>
        ) : !log?.meals?.length ? (
          <div className="text-center py-8">
            <Salad size={28} strokeWidth={1.5} className="mx-auto mb-2 text-gray-300 dark:text-gray-600" />
            <p className="text-sm text-gray-400 dark:text-gray-500">No meals logged yet.</p>
            <button onClick={() => setModalOpen(true)} className="btn-primary mt-3 text-sm">
              <Plus size={14} /> Add your first meal
            </button>
          </div>
        ) : (
          Object.entries(mealsByType).map(([type, meals]) => (
            <div key={type}>
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">{type}</p>
              <div className="space-y-1">
                {meals.map((m) => (
                  <div key={m._id}
                    className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
                  >
                    <button onClick={() => setEditingMeal(m)} className="flex-1 min-w-0 text-left" title="Edit portion">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{m.name}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {m.grams ? `${r(m.grams)} g · ` : ''}{r0(m.calories)} kcal · P {r0(m.protein)}g · C {r0(m.carbs)}g · F {r0(m.fat)}g
                      </p>
                    </button>
                    <button onClick={() => setEditingMeal(m)} title="Edit portion"
                      className="p-1.5 text-gray-300 dark:text-gray-600 hover:text-brand-500 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity ml-2">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDelete(m._id)}
                      className="p-1.5 text-gray-200 dark:text-gray-700 hover:text-red-400 dark:hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity ml-2">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <AddMealModal open={modalOpen} onClose={() => setModalOpen(false)} onAdd={handleAdd} />
      <EditMealModal meal={editingMeal} onClose={() => setEditingMeal(null)} onSave={handleUpdate} />
      {/* Adding a planned day for the date on screen refreshes it */}
      <MealPlanner open={plannerOpen} onClose={() => setPlannerOpen(false)} startDate={date}
        onApplied={(d, log) => { if (d === date) setLog(log); }} />
    </div>
  );
}
