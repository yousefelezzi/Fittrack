import React, { useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text } from './AppText';
import { colors, makeStyles } from './tokens';
import { Hint } from './ui';
import { RECOVERY_LABELS, unitLabel, regionLabel, wnsStatus, groupUnits } from '../../../client-web/src/utils/planAnalysis';

// Token names, read from `colors` at render time so they follow the theme.
const STATUS_COLOR = { losing: 'danger', low: 'warning', ok: 'success' };
const RECOVERY_COLOR = {
  veryLow: 'success', low: 'success', medium: 'brand', high: 'warning', extreme: 'danger', unrecoverable: 'danger',
};

/** One row of the stimulus table. */
function StimRow({ label, wns, color, sets, sessions, recovery, bold, rir, indent, onPress, open, count }) {
  return (
    <TouchableOpacity disabled={!onPress} onPress={onPress} activeOpacity={0.6}
      style={[styles.tRow, indent && { backgroundColor: colors.inset, paddingLeft: 22 }]}>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
        {onPress ? <Text style={[styles.chev, open && { transform: [{ rotate: '90deg' }] }]}>›</Text> : !indent ? <View style={{ width: 12 }} /> : null}
        <Text style={[styles.tCell, bold && { fontWeight: '700' }, indent && { color: colors.textSecondary }]}>{label}</Text>
        {count ? <Text style={styles.tMuted}> ({count})</Text> : null}
        {rir ? <Text style={[styles.tMuted, { color: colors.warning }]}> · {rir} RIR</Text> : null}
      </View>
      <Text style={[styles.tNum, { color }]}>{wns.toFixed(1)}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.tNum, { width: 70, color: colors.textSecondary }]}>{+sets.toFixed(1)} · {sessions}×</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.tNum, { width: 64, color: colors[RECOVERY_COLOR[recovery?.level]] || colors.textMuted }]}>{RECOVERY_LABELS[recovery?.level] || '–'}</Text>
    </TouchableOpacity>
  );
}

/**
 * Weekly net stimulus, sets and recovery per muscle group; tap a group with
 * regions (pecs, delts, triceps…) to see each one. `units` are the plan's
 * required units from /plans/generate or /plans/analyze.
 */
export default function StimulusTable({ units }) {
  const [openGroups, setOpenGroups] = useState([]);
  const toggle = (g) => setOpenGroups((list) => (list.includes(g) ? list.filter((x) => x !== g) : [...list, g]));
  return (
    <View>
  <View style={[styles.tRow, { borderTopWidth: 0 }]}>
    <Text style={[styles.tHead, { flex: 1 }]}>Muscle</Text>
    <Text style={[styles.tHead, styles.tNumW]}>WNS</Text>
    <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.tHead, { width: 70, textAlign: 'right' }]}>Sets/wk</Text>
    <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.tHead, { width: 64, textAlign: 'right' }]}>Recovery</Text>
  </View>
  {groupUnits(units).map((g) => {
    const canOpen = g.regions.length > 0;
    const isOpen = canOpen && openGroups.includes(g.group);
    return (
      <View key={g.group}>
        <StimRow label={unitLabel(g.group)} count={canOpen ? g.regions.length : null} bold={g.priority}
          rir={g.priority ? g.recommendedRir : null} wns={g.wns} color={colors[STATUS_COLOR[g.status]]}
          sets={g.setsPerWeek} sessions={g.sessionsPerWeek} recovery={g.recovery}
          open={isOpen} onPress={canOpen ? () => toggle(g.group) : undefined} />
        {isOpen && g.regions.map((u) => (
          <StimRow key={u.unit} indent label={regionLabel(u.unit)} rir={u.priority ? u.recommendedRir : null}
            wns={u.wns} color={colors[STATUS_COLOR[wnsStatus(u.wns, u.target)]]} sets={u.setsPerWeek} sessions={u.sessionsPerWeek} recovery={u.recovery} />
        ))}
      </View>
    );
  })}
  <Hint style={{ marginTop: 6 }}>A group's WNS is its regions' average; its colour shows the weakest region.</Hint>
    </View>
  );
}

const styles = makeStyles(() => ({
  tRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingRight: 2, borderTopWidth: 1, borderTopColor: colors.subtle },
  tHead:     { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  tNumW:     { width: 40, textAlign: 'right' },
  tCell:     { fontSize: 13, color: colors.textPrimary },
  tMuted:    { fontSize: 11, color: colors.textMuted },
  tNum:      { width: 40, textAlign: 'right', fontSize: 12, fontVariant: ['tabular-nums'] },
  chev:      { width: 12, fontSize: 15, color: colors.textMuted },
}));
