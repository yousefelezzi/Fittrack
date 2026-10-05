/**
 * Building blocks shared by the screens: bottom sheets, chips, segmented
 * controls, steppers, labels. Plain React Native, styled with the tokens in
 * ./index.js.
 */
import React from 'react';
import {
  View, Text, TouchableOpacity, Modal, ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { colors, makeStyles } from './tokens';
import { X, ChevronRight } from 'lucide-react-native';

/** Bottom sheet with a title bar. `footer` stays pinned under the scrolling body. */
export function Sheet({ visible, title, subtitle, onClose, children, footer, scroll = true }) {
  const Body = scroll ? ScrollView : View;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle}>{title}</Text>
              {subtitle ? <Text style={styles.hint}>{subtitle}</Text> : null}
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.close}><X size={20} color={colors.textMuted} /></TouchableOpacity>
          </View>
          <Body
            style={scroll ? { flexGrow: 0 } : { flexShrink: 1 }}
            contentContainerStyle={scroll ? styles.sheetBody : undefined}
            keyboardShouldPersistTaps="handled"
          >
            {scroll ? children : <View style={[styles.sheetBody, { flexShrink: 1 }]}>{children}</View>}
          </Body>
          {footer ? <View style={styles.sheetFooter}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Pill button; `tone="danger"` shows an excluded/struck-through state. */
export function Chip({ label, active, onPress, tone, small, disabled, style }) {
  const danger = tone === 'danger' && active;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={[
        styles.chip, small && styles.chipSmall,
        active && !danger && styles.chipActive,
        danger && styles.chipDanger,
        disabled && { opacity: 0.4 },
        style,
      ]}
    >
      <Text style={[
        styles.chipText, small && { fontSize: 11 },
        active && !danger && { color: '#fff' },
        danger && { color: colors.danger, textDecorationLine: 'line-through' },
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function ChipRow({ children, style }) {
  return <View style={[styles.chipRow, style]}>{children}</View>;
}

/** Segmented control: options are [value, label, hint?]. */
export function Segmented({ options, value, onChange, style }) {
  return (
    <View style={[styles.segmented, style]}>
      {options.map(([v, label, hint]) => (
        <TouchableOpacity key={String(v)} onPress={() => onChange(v)} style={[styles.segment, value === v && styles.segmentActive]}>
          <Text style={[styles.segmentText, value === v && { color: colors.textPrimary }]}>{label}</Text>
          {hint ? <Text style={styles.segmentHint}>{hint}</Text> : null}
        </TouchableOpacity>
      ))}
    </View>
  );
}

/** − value + */
export function Stepper({ value, onChange, min = 0, max = Infinity, step = 1, format = (v) => v }) {
  return (
    <View style={styles.stepper}>
      <TouchableOpacity disabled={value <= min} onPress={() => onChange(Math.max(min, value - step))} style={[styles.stepBtn, value <= min && { opacity: 0.35 }]}>
        <Text style={styles.stepBtnText}>−</Text>
      </TouchableOpacity>
      <Text style={styles.stepValue}>{format(value)}</Text>
      <TouchableOpacity disabled={value >= max} onPress={() => onChange(Math.min(max, value + step))} style={[styles.stepBtn, value >= max && { opacity: 0.35 }]}>
        <Text style={styles.stepBtnText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

export const Label = ({ children, style }) => <Text style={[styles.label, style]}>{children}</Text>;
export const Hint = ({ children, style }) => <Text style={[styles.hint, style]}>{children}</Text>;
export const Title = ({ children, style }) => <Text style={[styles.title, style]}>{children}</Text>;
export const SectionTitle = ({ children, style }) => <Text style={[styles.sectionTitle, style]}>{children}</Text>;
export const ErrorText = ({ children }) => (children ? <Text style={styles.error}>{children}</Text> : null);

/** Small text link. */
export function LinkText({ children, onPress, style, danger }) {
  return (
    <TouchableOpacity onPress={onPress} hitSlop={8}>
      <Text style={[styles.link, danger && { color: colors.danger }, style]}>{children}</Text>
    </TouchableOpacity>
  );
}

/** Row in a settings-style list: icon (a lucide component), title, subtitle, chevron. */
export function ListRow({ icon, title, subtitle, onPress, right, last }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={!onPress} activeOpacity={0.6} style={[styles.listRow, last && { borderBottomWidth: 0 }]}>
      {icon ? <View style={styles.listIcon}>{React.isValidElement(icon) ? icon : React.createElement(icon, { size: 20, color: colors.brand })}</View> : null}
      <View style={{ flex: 1 }}>
        <Text style={styles.listTitle}>{title}</Text>
        {subtitle ? <Text style={styles.hint}>{subtitle}</Text> : null}
      </View>
      {right ?? (onPress ? <ChevronRight size={18} color={colors.textMuted} /> : null)}
    </TouchableOpacity>
  );
}

/** Yes/no dialog as a promise. */
export const confirm = (title, message = '', confirmText = 'OK', destructive = false) => new Promise((resolve) => {
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
    { text: confirmText, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
  ], { cancelable: true, onDismiss: () => resolve(false) });
});

const styles = makeStyles(() => ({
  overlay:      { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet:        { backgroundColor: colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '90%', paddingBottom: 24 },
  sheetHeader:  { flexDirection: 'row', alignItems: 'flex-start', padding: 18, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  sheetTitle:   { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  sheetBody:    { padding: 18 },
  sheetFooter:  { paddingHorizontal: 18, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  close:        { paddingLeft: 12 },
  chip:         { maxWidth: '100%', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipSmall:    { paddingHorizontal: 9, paddingVertical: 4 },
  chipActive:   { backgroundColor: colors.brand, borderColor: colors.brand },
  chipDanger:   { backgroundColor: colors.dangerLight, borderColor: colors.dangerBorder },
  chipText:     { flexShrink: 1, fontSize: 12, fontWeight: '500', color: colors.textSecondary, textTransform: 'capitalize' },
  chipRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  segmented:    { flexDirection: 'row', backgroundColor: colors.subtle, borderRadius: 12, padding: 3, gap: 3 },
  segment:      { flex: 1, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 9, alignItems: 'center' },
  segmentActive:{ backgroundColor: colors.surface, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 3, elevation: 1 },
  segmentText:  { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  segmentHint:  { fontSize: 10, color: colors.textMuted, marginTop: 1, textAlign: 'center' },
  stepper:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn:      { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.subtle, alignItems: 'center', justifyContent: 'center' },
  stepBtnText:  { fontSize: 18, color: colors.textPrimary },
  stepValue:    { minWidth: 30, textAlign: 'center', fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  label:        { fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 6, marginTop: 14 },
  hint:         { fontSize: 11, color: colors.textMuted, lineHeight: 15 },
  title:        { fontSize: 22, fontWeight: '700', color: colors.textPrimary, marginBottom: 14 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: 10 },
  error:        { color: colors.danger, fontSize: 13, marginVertical: 6 },
  link:         { fontSize: 13, color: colors.brand, fontWeight: '500' },
  listRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.subtle, gap: 12 },
  listIcon:     { width: 28, alignItems: 'center' },
  listTitle:    { fontSize: 15, fontWeight: '500', color: colors.textPrimary },
  chevron:      { fontSize: 22, color: colors.textMuted },
}));
