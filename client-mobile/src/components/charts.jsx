/**
 * Small charts for the mobile screens. Bars are plain Views; the line chart
 * uses react-native-svg.
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Svg, { Polyline, Line as SvgLine, Circle } from 'react-native-svg';
import { colors, makeStyles } from './tokens';

const LABEL_H = 16;
const shortNum = (v) => (v >= 1000 ? `${+(v / 1000).toFixed(1)}k` : `${Math.round(v * 10) / 10}`);

/**
 * Vertical bars. data: [{ key, label, value, color? }]. Optional dashed `goal`
 * line, `selectedKey` outline, and `onPress(item)`. Labels show every
 * `labelEvery`-th bar so long ranges stay readable.
 */
export function BarChart({ data, height = 140, goal, onPress, selectedKey, color = colors.brand, labelEvery = 1, showValues = false }) {
  const max = Math.max(goal || 0, ...data.map((d) => d.value), 1);
  return (
    <View>
      <View style={{ height: height + LABEL_H, flexDirection: 'row', alignItems: 'flex-end' }}>
        {goal ? <View style={[styles.goalLine, { bottom: LABEL_H + (goal / max) * height }]} /> : null}
        {data.map((d, i) => (
          <TouchableOpacity key={d.key ?? i} disabled={!onPress} onPress={() => onPress?.(d)} activeOpacity={0.7}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
            {showValues && d.value > 0 ? <Text style={styles.barValue}>{shortNum(d.value)}</Text> : null}
            <View style={[
              styles.bar,
              { height: Math.max(d.value > 0 ? 3 : 1, (d.value / max) * height), backgroundColor: d.color || color },
              selectedKey != null && d.key === selectedKey && styles.barSelected,
            ]} />
            <Text style={[styles.axis, selectedKey != null && d.key === selectedKey && { color: colors.brand, fontWeight: '700' }]} numberOfLines={1}>
              {i % labelEvery === 0 ? d.label : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

/**
 * Line chart. data: [{ label, [seriesKey]: number }]; series: [{ key, label, color, dots?, line? }]
 * (dots: draw each point; line: false for dots only).
 * Tap anywhere on the chart to read the nearest point's values.
 */
export function LineChart({ data, series, height = 160 }) {
  const [width, setWidth] = useState(0);
  const [tapped, setActive] = useState(null);
  // The tapped point, if it's still in the data (switching ranges can shorten it).
  const active = tapped != null && tapped < data.length ? tapped : null;
  const values = data.flatMap((d) => series.map((s) => d[s.key])).filter((v) => Number.isFinite(v));
  if (!values.length) return null;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = (hi - lo) * 0.1 || hi * 0.1 || 1;
  const min = Math.max(0, lo - pad);
  const max = hi + pad;
  const AXIS_W = 34;
  // Points stay INSET inside the edges so dots at the ends aren't cut off.
  const INSET = 5;
  const plotW = Math.max(0, width - AXIS_W - INSET * 2);
  const x = (i) => AXIS_W + INSET + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
  const y = (v) => height - INSET - ((v - min) / (max - min)) * (height - INSET * 2);
  const pick = (px) => {
    if (!data.length || plotW <= 0) return;
    const i = data.length === 1 ? 0 : Math.round(((px - AXIS_W - INSET) / plotW) * (data.length - 1));
    setActive(Math.min(data.length - 1, Math.max(0, i)));
  };

  return (
    <View>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onResponderGrant={(e) => pick(e.nativeEvent.locationX)}
        onResponderMove={(e) => pick(e.nativeEvent.locationX)}>
        {width > 0 && (
          <Svg width={width} height={height}>
            {[0, 0.5, 1].map((f) => (
              <SvgLine key={f} x1={AXIS_W} x2={width} y1={height * f} y2={height * f} stroke={colors.border} strokeDasharray="3,3" />
            ))}
            {series.map((s) => {
              const pts = data.map((d, i) => (Number.isFinite(d[s.key]) ? [x(i), y(d[s.key])] : null)).filter(Boolean);
              // `dots: true` draws each point (e.g. weigh-ins); a line with one point is drawn as a dot too.
              const showDots = s.dots || pts.length === 1;
              return (
                <React.Fragment key={s.key}>
                  {s.line !== false && pts.length > 1 ? <Polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={s.color} strokeWidth={2} /> : null}
                  {showDots ? pts.map(([cx, cy], i) => <Circle key={i} cx={cx} cy={cy} r={3.5} fill={s.color} />) : null}
                </React.Fragment>
              );
            })}
            {active != null && (
              <>
                <SvgLine x1={x(active)} x2={x(active)} y1={0} y2={height} stroke={colors.textMuted} strokeWidth={1} />
                {series.map((s) => Number.isFinite(data[active][s.key]) && (
                  <Circle key={s.key} cx={x(active)} cy={y(data[active][s.key])} r={4} fill={s.color} />
                ))}
              </>
            )}
          </Svg>
        )}
        <Text style={[styles.yLabel, { top: -6 }]}>{shortNum(max)}</Text>
        <Text style={[styles.yLabel, { top: height - 8 }]}>{shortNum(min)}</Text>
      </View>
      <View style={styles.xAxis}>
        <Text style={styles.axis}>{data[0]?.label}</Text>
        {data.length > 1 ? <Text style={styles.axis}>{data[data.length - 1]?.label}</Text> : null}
      </View>
      <View style={styles.legend}>
        {active != null ? <Text style={[styles.axis, { color: colors.textPrimary }]}>{data[active].label}: </Text> : null}
        {series.map((s) => (
          <View key={s.key} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: s.color }]} />
            <Text style={styles.axis}>{s.label}{active != null && Number.isFinite(data[active][s.key]) ? ` ${data[active][s.key]}` : ''}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Horizontal bars, one per row. data: [{ key, label, value, color?, sub? (shown under) }] */
export function HBarList({ data, unit = '', onPress, expandedKey }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <View style={{ gap: 8 }}>
      {data.map((d) => (
        <TouchableOpacity key={d.key} disabled={!onPress} onPress={() => onPress?.(d)} activeOpacity={0.7}>
          <View style={styles.hRow}>
            <Text style={styles.hLabel} numberOfLines={1}>{d.label}</Text>
            <View style={styles.hTrack}>
              <View style={[styles.hFill, { width: `${(d.value / max) * 100}%`, backgroundColor: d.color || colors.brand }]} />
            </View>
            <Text style={styles.hValue}>{d.value}{unit}</Text>
          </View>
          {expandedKey === d.key && d.sub ? <View style={{ paddingLeft: 92, paddingTop: 4 }}>{d.sub}</View> : null}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = makeStyles(() => ({
  bar:        { width: '62%', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  barSelected:{ borderWidth: 2, borderColor: colors.brandDark },
  barValue:   { fontSize: 9, color: colors.textMuted, marginBottom: 2 },
  goalLine:   { position: 'absolute', left: 0, right: 0, borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.success },
  axis:       { fontSize: 10, color: colors.textMuted, height: LABEL_H, lineHeight: LABEL_H, textTransform: 'capitalize' },
  yLabel:     { position: 'absolute', left: 0, fontSize: 9, color: colors.textMuted },
  xAxis:      { flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 34, marginTop: 2 },
  legend:     { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot:        { width: 8, height: 8, borderRadius: 4 },
  hRow:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hLabel:     { width: 84, fontSize: 12, color: colors.textSecondary, textTransform: 'capitalize' },
  hTrack:     { flex: 1, height: 10, backgroundColor: colors.subtle, borderRadius: 999, overflow: 'hidden' },
  hFill:      { height: '100%', borderRadius: 999 },
  hValue:     { width: 40, textAlign: 'right', fontSize: 12, color: colors.textSecondary },
}));
