/**
 * Shared primitive components for the FitTrack mobile app.
 * All components are plain React Native — no third-party UI library required.
 */
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  TextInput,
} from 'react-native';

import { colors, makeStyles, cardSurface } from './tokens';
import { uploadUrl } from '../api';
import { Dumbbell } from 'lucide-react-native';

/**
 * An icon prop: a lucide component (e.g. Dumbbell) is drawn with `props`;
 * an element is used as is.
 */
export const renderIcon = (icon, props) => (!icon ? null : React.isValidElement(icon) ? icon : React.createElement(icon, props));

export { colors, makeStyles };
export { applyTheme, isDark, currentTheme, cardSurface } from './tokens';
export * from './ui';
export { default as ExerciseImage } from './ExerciseImage';
export { default as ExercisePicker } from './ExercisePicker';
export { default as SimilarExercises } from './SimilarExercises';
export * from './charts';

// ── Spinner ───────────────────────────────────────────────────────────────────
export function Spinner({ size = 'large', color = colors.brand }) {
  return <ActivityIndicator size={size} color={color} />;
}

// ── Avatar ────────────────────────────────────────────────────────────────────
export function Avatar({ user, size = 40 }) {
  const initials = user?.name?.charAt(0)?.toUpperCase() ?? '?';
  if (user?.avatar) {
    return (
      <Image
        source={{ uri: uploadUrl(user.avatar) }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }
  return (
    <View
      style={[
        styles.avatarFallback,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.38 }]}>{initials}</Text>
    </View>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────
export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

// ── Button ────────────────────────────────────────────────────────────────────
export function Button({ title, icon, onPress, variant = 'primary', loading = false, disabled = false, style }) {
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}
      style={[
        styles.btn,
        variant === 'primary'   && styles.btnPrimary,
        variant === 'secondary' && styles.btnSecondary,
        variant === 'danger'    && styles.btnDanger,
        isDisabled && styles.btnDisabled,
        style,
      ]}
    >
      {loading
        ? <Spinner size="small" color={variant === 'secondary' ? colors.brand : '#fff'} />
        : (
          <View style={styles.btnRow}>
            {renderIcon(icon, { size: 16, color: variant === 'secondary' ? colors.brand : '#fff' })}
            <Text style={[styles.btnText, variant === 'secondary' && styles.btnTextSecondary, { flexShrink: 1 }]}>
              {title}
            </Text>
          </View>
        )
      }
    </TouchableOpacity>
  );
}

// ── Input ─────────────────────────────────────────────────────────────────────
export function Input({ label, error, style, ...props }) {
  return (
    <View style={{ marginBottom: 12 }}>
      {label ? <Text style={styles.inputLabel}>{label}</Text> : null}
      <TextInput
        style={[styles.input, error && styles.inputError, style]}
        placeholderTextColor={colors.textMuted}
        {...props}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────
export function Badge({ label, color = colors.brand, bg = colors.brandLight }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────────
export function Divider({ style }) {
  return <View style={[styles.divider, style]} />;
}

// ── Empty state ───────────────────────────────────────────────────────────────
export function EmptyState({ icon = Dumbbell, title, subtitle }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>{renderIcon(icon, { size: 40, color: colors.textMuted, strokeWidth: 1.5 })}</View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

// ── Macro progress bar ────────────────────────────────────────────────────────
export function MacroBar({ label, current, goal, unit = 'g', color = colors.brand }) {
  const pct = goal > 0 ? Math.min(100, Math.round((current / goal) * 100)) : 0;
  // Whole numbers with thousands separators, e.g. 1843.7 → "1,844".
  const show = (v) => Math.round(Number(v) || 0).toLocaleString();
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={styles.macroRow}>
        <Text style={styles.macroLabel}>{label}</Text>
        <Text style={styles.macroValue}>{show(current)} / {show(goal)} {unit}</Text>
      </View>
      <View style={styles.barBg}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = makeStyles(() => ({
  avatarFallback: {
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.brand,
    fontWeight: '700',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    ...cardSurface(),
  },
  // minHeight (not height) so a label that needs two lines grows the button
  // instead of being cut off.
  btn: {
    minHeight: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  btnPrimary:   { backgroundColor: colors.brand },
  btnSecondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  btnDanger:    { backgroundColor: colors.danger },
  btnDisabled:  { opacity: 0.5 },
  btnRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  btnText:      { color: '#fff', fontSize: 15, fontWeight: '600', textAlign: 'center' },
  btnTextSecondary: { color: colors.textPrimary },
  inputLabel:   { fontSize: 13, fontWeight: '500', color: colors.textSecondary, marginBottom: 4 },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  inputError:   { borderColor: colors.danger },
  errorText:    { fontSize: 12, color: colors.danger, marginTop: 3 },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText:    { fontSize: 12, fontWeight: '600' },
  divider:      { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  emptyState:   { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  emptyIcon:    { marginBottom: 12, opacity: 0.6 },
  emptyTitle:   { fontSize: 16, fontWeight: '600', color: colors.textPrimary, textAlign: 'center' },
  emptySubtitle:{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 6 },
  macroRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 8, marginBottom: 4 },
  macroLabel:   { flex: 1, fontSize: 13, color: colors.textSecondary, textTransform: 'capitalize' },
  macroValue:   { fontSize: 13, color: colors.textSecondary, flexShrink: 0 },
  barBg:        { height: 7, backgroundColor: colors.subtle, borderRadius: 999, overflow: 'hidden' },
  barFill:      { height: '100%', borderRadius: 999 },
}));