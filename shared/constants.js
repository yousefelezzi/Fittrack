/**
 * shared/constants.js
 *
 * Single source of truth for values that must stay in sync across
 * the server, web client, and mobile client.
 *
 * Node: const { MUSCLE_GROUPS } = require('../shared/constants');
 * Web / Mobile (ESM): import { MUSCLE_GROUPS } from '../../shared/constants';
 */

// ── Muscle groups ────────────────────────────────────────────────────────────

/** Allowed values for Exercise.muscleGroups */
const MUSCLE_GROUPS = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'core',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'full_body',
  'cardio',
];

/** Human-readable labels keyed by MUSCLE_GROUPS value */
const MUSCLE_GROUP_LABELS = {
  chest:        'Chest',
  back:         'Back',
  shoulders:    'Shoulders',
  biceps:       'Biceps',
  triceps:      'Triceps',
  forearms:     'Forearms',
  core:         'Core',
  quads:        'Quads',
  hamstrings:   'Hamstrings',
  glutes:       'Glutes',
  calves:       'Calves',
  full_body:    'Full Body',
  cardio:       'Cardio',
};

// ── Equipment ────────────────────────────────────────────────────────────────

const EQUIPMENT_TYPES = [
  'barbell',
  'dumbbell',
  'kettlebell',
  'machine',
  'cable',
  'resistance_band',
  'bodyweight',
  'other',
];

const EQUIPMENT_LABELS = {
  barbell:          'Barbell',
  dumbbell:         'Dumbbell',
  kettlebell:       'Kettlebell',
  machine:          'Machine',
  cable:            'Cable',
  resistance_band:  'Resistance Band',
  bodyweight:       'Bodyweight',
  other:            'Other',
};

// ── Fitness goals ────────────────────────────────────────────────────────────

const FITNESS_GOALS = [
  'lose_weight',
  'build_muscle',
  'improve_endurance',
  'stay_active',
  'other',
];

const FITNESS_GOAL_LABELS = {
  lose_weight:        'Lose Weight',
  build_muscle:       'Build Muscle',
  improve_endurance:  'Improve Endurance',
  stay_active:        'Stay Active',
  other:              'Other',
};

// ── Nutrition macros ─────────────────────────────────────────────────────────

/** Keys present on every meal / nutrition log document */
const MACRO_KEYS = ['calories', 'protein', 'carbs', 'fat'];

/** Units displayed next to each macro value */
const MACRO_UNITS = {
  calories: 'kcal',
  protein:  'g',
  carbs:    'g',
  fat:      'g',
};

// ── Default daily macro goals ────────────────────────────────────────────────

const DEFAULT_DAILY_GOALS = {
  calories: 2000,
  protein:  150,
  carbs:    250,
  fat:      65,
};

// ── Password rules (mirrored in auth.routes.js validation) ──────────────────

/** Regex the server's express-validator also enforces */
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/;

const PASSWORD_RULES = {
  minLength: 8,
  regex:     PASSWORD_REGEX,
  hint:      'Min 8 characters with uppercase, lowercase, number, and special character (@$!%*?&)',
};

// ── Pagination defaults ──────────────────────────────────────────────────────

const PAGINATION = {
  defaultPage:  1,
  defaultLimit: 10,
  maxLimit:     100,
};

// ── API base URL helper ──────────────────────────────────────────────────────

/** Server port used in docker-compose and local dev */
const SERVER_PORT = 5000;

module.exports = {
  MUSCLE_GROUPS,
  MUSCLE_GROUP_LABELS,
  EQUIPMENT_TYPES,
  EQUIPMENT_LABELS,
  FITNESS_GOALS,
  FITNESS_GOAL_LABELS,
  MACRO_KEYS,
  MACRO_UNITS,
  DEFAULT_DAILY_GOALS,
  PASSWORD_REGEX,
  PASSWORD_RULES,
  PAGINATION,
  SERVER_PORT,
};