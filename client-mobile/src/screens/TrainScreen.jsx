import React, { useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { planAPI } from '../api';
import { Card, Button, ListRow, colors, makeStyles, Title, Hint } from '../components';
import { CirclePlus, ClipboardList, Dumbbell, ChartColumn, History, Calculator, HeartPulse } from 'lucide-react-native';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Everything about training in one place (the web app's "Workouts" menu). */
export default function TrainScreen({ navigation }) {
  const [active, setActive] = useState(null);

  // The active plan's workout for today, to start it in one tap.
  useEffect(() => navigation.addListener('focus', () => {
    planAPI.getAll().then(({ data }) => setActive(data.find((p) => p.isActive) || null)).catch(() => {});
  }), [navigation]);

  const today = active?.schedule !== 'rotation' ? active?.days.find((d) => d.dayOfWeek === new Date().getDay()) : null;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <Title>Train</Title>
      {today && today.exercises.length > 0 && (
        <Card>
          <Text style={styles.cap}>TODAY · {active.name}</Text>
          <Text style={styles.big}>{today.label || DAYS[today.dayOfWeek]}</Text>
          <Hint style={{ marginBottom: 10 }}>{today.exercises.length} exercises · {today.exercises.reduce((n, e) => n + (e.targetSets || 0), 0)} sets</Hint>
          <Button title="▶ Start today's workout" onPress={() => navigation.navigate('LogWorkout', { template: { plan: active, day: today } })} />
        </Card>
      )}
      <Card style={{ paddingVertical: 4 }}>
        <ListRow icon={CirclePlus} title="Log Workout" subtitle="Live session with rest timer, or one you've already done" onPress={() => navigation.navigate('LogWorkout')} />
        <ListRow icon={HeartPulse} title="Log Cardio" subtitle="Runs, rides, swims and more, with calories burned" onPress={() => navigation.navigate('LogCardio')} />
        <ListRow icon={ClipboardList} title="Plans" subtitle="Your plans, the plan generator and the plan builder" onPress={() => navigation.navigate('Plans')} />
        <ListRow icon={Dumbbell} title="Exercises" subtitle="Library and your custom exercises" onPress={() => navigation.navigate('Exercises')} />
        <ListRow icon={ChartColumn} title="Progress" subtitle="Volume check, muscles trained, lift progress" onPress={() => navigation.navigate('Progress')} />
        <ListRow icon={History} title="History" subtitle="Past workouts and meals" onPress={() => navigation.navigate('History')} last />
      </Card>
      <Card style={{ paddingVertical: 4 }}>
        <ListRow icon={Calculator} title="Calculators" subtitle="FFMI, BMR & TDEE, Weekly Net Stimulus, one-rep max" onPress={() => navigation.navigate('Calculators')} last />
      </Card>
    </ScrollView>
  );
}

const styles = makeStyles(() => ({
  cap: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5 },
  big: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginTop: 2 },
}));
