import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text } from './AppText';
import { format } from 'date-fns';
import { userAPI } from '../api';
import { colors, makeStyles, cardSurface } from './tokens';
import { Hint, LinkText, ErrorText } from './ui';
import { Flame, Footprints, Ruler, CalendarDays, Trophy, Globe, Lock } from 'lucide-react-native';
import { oneRepMaxSourceLabel } from '../../../client-web/src/utils/workoutSummary';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FIELD_LABELS = { height: 'height', weight: 'weight', bodyFat: 'body fat %' };

function StatCard({ icon, title, statKey, owner, children }) {
  const isPublic = owner?.visibility[statKey];
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={[styles.row, { flex: 1 }]}>
          {React.createElement(icon, { size: 16, color: colors.brand })}
          <Text style={styles.title}>{title}</Text>
        </View>
        {owner && (
          <TouchableOpacity disabled={owner.busyKey === statKey} onPress={() => owner.onToggle(statKey)}
            style={[styles.toggle, isPublic && styles.togglePublic, owner.busyKey === statKey && { opacity: 0.5 }]}>
            <View style={styles.row}>
              {isPublic ? <Globe size={12} color={colors.success} /> : <Lock size={12} color={colors.textSecondary} />}
              <Text style={[styles.toggleText, isPublic && { color: colors.success }]}>{isPublic ? 'Public' : 'Private'}</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>
      {children}
    </View>
  );
}
const Empty = ({ children }) => <Text style={styles.muted}>{children}</Text>;
const Big = ({ value, unit }) => <Text style={styles.big}>{value} <Text style={styles.unit}>{unit}</Text></Text>;

/**
 * Stats section for a profile: average calories and steps, FFMI, split and 1RMs.
 * The owner sees everything and can make each one public; visitors only get public ones.
 */
export default function ProfileStats({ userId, refreshKey, onEditProfile, onNavigate }) {
  const [data, setData] = useState(null);
  const [busyKey, setBusyKey] = useState(null);
  const [error, setError] = useState('');
  const [showAllMaxes, setShowAllMaxes] = useState(false);

  useEffect(() => {
    if (!userId) return;
    userAPI.getStats(userId).then((res) => setData(res.data)).catch(() => setData(null));
  }, [userId, refreshKey]);

  const toggle = async (key) => {
    setBusyKey(key);
    setError('');
    try {
      const { data: user } = await userAPI.updateMe({ statsVisibility: { [key]: !data.visibility[key] } });
      setData((d) => ({ ...d, visibility: { ...d.visibility, ...user.statsVisibility } }));
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update visibility');
    } finally {
      setBusyKey(null);
    }
  };

  if (!data) return null;
  const { isOwner, stats } = data;
  if (!isOwner && Object.keys(stats).length === 0) return null;
  const owner = isOwner ? { visibility: data.visibility, busyKey, onToggle: toggle } : null;
  const s = stats;

  return (
    <View>
      <View style={styles.sectionHead}>
        <Text style={styles.section}>Stats</Text>
        {isOwner && <Hint>Private stats are only visible to you</Hint>}
      </View>
      <ErrorText>{error}</ErrorText>

      {'avgCalories' in s && (
        <StatCard icon={Flame} title="Average Calories" statKey="avgCalories" owner={owner}>
          {!s.avgCalories ? <Empty>{isOwner ? 'No meals logged in the last 30 days.' : 'No meals logged recently.'}</Empty> : (
            <>
              <Big value={s.avgCalories.average.toLocaleString()} unit="kcal/day" />
              <Hint>Average of {s.avgCalories.daysLogged} logged day{s.avgCalories.daysLogged !== 1 ? 's' : ''} in the last {s.avgCalories.periodDays} days</Hint>
            </>
          )}
        </StatCard>
      )}

      {'avgSteps' in s && (
        <StatCard icon={Footprints} title="Average Steps" statKey="avgSteps" owner={owner}>
          {!s.avgSteps ? (
            <Empty>{isOwner ? <>No steps logged in the last 30 days. <Text style={styles.link} onPress={() => onNavigate?.('Steps')}>Log some</Text>.</> : 'No steps logged recently.'}</Empty>
          ) : (
            <>
              <Big value={s.avgSteps.average.toLocaleString()} unit="steps/day" />
              <Hint>Goal of {s.avgSteps.goal.toLocaleString()} reached on {s.avgSteps.daysAtGoal} of {s.avgSteps.daysLogged} logged day{s.avgSteps.daysLogged !== 1 ? 's' : ''} in the last {s.avgSteps.periodDays} days</Hint>
            </>
          )}
        </StatCard>
      )}

      {'ffmi' in s && (
        <StatCard icon={Ruler} title="FFMI" statKey="ffmi" owner={owner}>
          {!s.ffmi ? <Empty>Not available.</Empty> : s.ffmi.missing ? (
            <Empty>Add your {s.ffmi.missing.map((m) => FIELD_LABELS[m]).join(', ')} to your profile to see your FFMI. <Text style={styles.link} onPress={onEditProfile}>Edit profile</Text></Empty>
          ) : (
            <>
              <Big value={s.ffmi.normalizedFfmi.toFixed(1)} unit="normalized" />
              <View style={[styles.head, { justifyContent: 'flex-start', marginTop: 4 }]}>
                <Text style={styles.badge}>{s.ffmi.category}</Text>
                <Hint>Raw FFMI {s.ffmi.ffmi.toFixed(1)}</Hint>
              </View>
              {isOwner && <Hint style={{ marginTop: 6 }}>Your weight and body fat % are never shown to others, only the index.</Hint>}
            </>
          )}
        </StatCard>
      )}

      {'split' in s && (
        <StatCard icon={CalendarDays} title="Workout Split" statKey="split" owner={owner}>
          {!s.split ? <Empty>{isOwner ? 'No active plan or recent workouts.' : 'No recent training.'}</Empty> : (
            <View style={{ gap: 8 }}>
              {s.split.plan && (
                <View>
                  <Text style={styles.title}>{s.split.plan.name}</Text>
                  <View style={styles.tags}>
                    {s.split.plan.days.map((d, i) => <Text key={i} style={styles.tag}><Text style={{ fontWeight: '700' }}>{DAY_NAMES[d.dayOfWeek] ?? '—'}</Text>{d.label ? ` · ${d.label}` : ''}</Text>)}
                  </View>
                </View>
              )}
              <Hint>{s.split.workoutsPerWeek} workouts/week · {s.split.totalSets} sets in the last {s.split.periodDays} days</Hint>
              {s.split.breakdown.map((b) => (
                <View key={b.region} style={styles.barRow}>
                  <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.muted, { width: 72 }]}>{b.region}</Text>
                  <View style={styles.track}><View style={[styles.fill, { width: `${b.percent}%` }]} /></View>
                  <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.muted, { width: 36, textAlign: 'right' }]}>{b.percent}%</Text>
                </View>
              ))}
            </View>
          )}
        </StatCard>
      )}

      {'oneRepMaxes' in s && (
        <StatCard icon={Trophy} title="1 Rep Maxes" statKey="oneRepMaxes" owner={owner}>
          {!s.oneRepMaxes ? <Empty>{isOwner ? 'Log some weighted sets of 12 reps or fewer to see your 1RMs.' : 'No lifts logged yet.'}</Empty> : (
            <>
              {(showAllMaxes ? s.oneRepMaxes : s.oneRepMaxes.slice(0, 5)).map((m) => (
                <View key={m.exerciseId} style={styles.maxRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.small} numberOfLines={1}>{m.name}</Text>
                    <Hint>
                      {m.isEstimate ? `Est. from ${oneRepMaxSourceLabel(m.fromSet)}` : 'Actual single'}
                      {m.fromSet.side ? ` (${m.fromSet.side})` : ''} · {format(new Date(m.date), 'MMM d, yyyy')}
                      {m.best ? `\nBest: ${m.best.oneRepMax} kg on ${format(new Date(m.best.date), 'MMM d')}` : ''}
                    </Hint>
                  </View>
                  <Text style={styles.title}>{m.oneRepMax} kg</Text>
                </View>
              ))}
              {s.oneRepMaxes.length > 5 && <LinkText style={{ marginTop: 6 }} onPress={() => setShowAllMaxes(!showAllMaxes)}>{showAllMaxes ? 'Show less' : `Show all ${s.oneRepMaxes.length}`}</LinkText>}
            </>
          )}
        </StatCard>
      )}
    </View>
  );
}

const styles = makeStyles(() => ({
  sectionHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', columnGap: 10, marginBottom: 8, marginTop: 4 },
  section:     { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  card:        { backgroundColor: colors.surface, borderRadius: 16, padding: 14, marginBottom: 10, gap: 6, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2, ...cardSurface() },
  head:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  row:         { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title:       { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  toggle:      { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: colors.subtle },
  togglePublic:{ backgroundColor: colors.successLight },
  toggleText:  { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  muted:       { fontSize: 12, color: colors.textMuted },
  small:       { fontSize: 13, color: colors.textPrimary },
  link:        { color: colors.brand, fontWeight: '500' },
  big:         { fontSize: 24, fontWeight: '800', color: colors.textPrimary },
  unit:        { fontSize: 13, fontWeight: '400', color: colors.textMuted },
  badge:       { fontSize: 11, fontWeight: '600', color: colors.brand, backgroundColor: colors.brandLight, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
  tags:        { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  tag:         { fontSize: 11, color: colors.textSecondary, backgroundColor: colors.subtle, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, overflow: 'hidden' },
  barRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track:       { flex: 1, height: 8, backgroundColor: colors.subtle, borderRadius: 999, overflow: 'hidden' },
  fill:        { height: '100%', backgroundColor: colors.brand, borderRadius: 999 },
  maxRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.subtle },
}));
