// Design tokens shared by every component and screen, for light and dark mode.
//
// `colors` is one object whose values are swapped when the theme changes
// (applyTheme), so code reads colors.x at render time and stays current.
// Styles made with makeStyles are rebuilt on the next read after a change;
// the app remounts its tree when the theme changes (see App.jsx).
import { StyleSheet } from 'react-native';

const LIGHT = {
  brand:        '#0284c7',
  brandLight:   '#e0f2fe',
  brandDark:    '#0369a1',
  bg:           '#f8fafc',
  surface:      '#ffffff', // solid: sheets, pop-ups, inputs, bars
  card:         '#ffffff', // containers on the page
  cardBorder:   'transparent',
  inset:        '#f8fafc', // panels inside a card
  subtle:       '#f1f5f9', // dividers, chips, tracks
  border:       '#e2e8f0',
  textPrimary:  '#111827',
  textSecondary:'#6b7280',
  textMuted:    '#9ca3af',
  danger:       '#ef4444',
  dangerLight:  '#fee2e2',
  dangerBorder: '#fecaca',
  success:      '#10b981',
  successLight: '#ecfdf5',
  warning:      '#f59e0b',
  warningLight: '#fffbeb',
  infoBg:       '#f0f9ff', // shared-workout cards
  infoBorder:   '#bae6fd',
  overlay:      'rgba(0,0,0,0.4)',
};

const DARK = {
  brand:        '#0ea5e9',
  brandLight:   '#0c4a6e',
  brandDark:    '#38bdf8',
  bg:           '#0b1120',
  surface:      '#151c2c',
  // Containers are see-through in dark mode: a faint white wash and a thin edge.
  card:         'rgba(255,255,255,0.05)',
  cardBorder:   'rgba(255,255,255,0.09)',
  inset:        'rgba(255,255,255,0.05)',
  subtle:       'rgba(255,255,255,0.08)',
  border:       'rgba(255,255,255,0.14)',
  textPrimary:  '#f3f4f6',
  textSecondary:'#9ca3af',
  textMuted:    '#6b7280',
  danger:       '#f87171',
  dangerLight:  '#450a0a',
  dangerBorder: '#7f1d1d',
  success:      '#34d399',
  successLight: '#052e16',
  warning:      '#fbbf24',
  warningLight: '#422006',
  infoBg:       '#082f49',
  infoBorder:   '#0c4a6e',
  overlay:      'rgba(0,0,0,0.6)',
};

export const colors = { ...LIGHT };

let current = 'light';
let version = 0;

/** 'light' | 'dark' */
export const currentTheme = () => current;
export const isDark = () => current === 'dark';

/** Switch every token to the light or dark palette. */
export function applyTheme(theme) {
  const next = theme === 'dark' ? 'dark' : 'light';
  if (next === current) return;
  current = next;
  Object.assign(colors, next === 'dark' ? DARK : LIGHT);
  version++;
}

/**
 * Background for a container card. In dark mode it's see-through with a thin
 * border and no shadow (a shadow would show through the translucent fill).
 * Spread it last in a card's style.
 */
export const cardSurface = () => (current === 'dark'
  ? { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, shadowOpacity: 0, elevation: 0 }
  : { backgroundColor: colors.card });

/**
 * StyleSheet.create for styles that use `colors`: built from `fn` on first use
 * and again after the theme changes.
 */
export function makeStyles(fn) {
  let builtFor = -1;
  let sheet;
  return new Proxy({}, {
    get(_, key) {
      if (builtFor !== version) { sheet = StyleSheet.create(fn()); builtFor = version; }
      return sheet[key];
    },
  });
}
