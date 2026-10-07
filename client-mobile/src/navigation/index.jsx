import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { useAuth } from '../context/AuthContext';
import { colors, isDark } from '../components';
import { syncIfStale } from '../utils/stepSync';

// ── Auth screens ──────────────────────────────────────────────────────────────
import LoginScreen    from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';

// ── App screens ───────────────────────────────────────────────────────────────
import DashboardScreen     from '../screens/DashboardScreen';
import TrainScreen         from '../screens/TrainScreen';
import NutritionScreen     from '../screens/NutritionScreen';
import NutritionHubScreen  from '../screens/NutritionHubScreen';
import HydrationScreen     from '../screens/HydrationScreen';
import SupplementsScreen   from '../screens/SupplementsScreen';
import NutritionProgressScreen from '../screens/NutritionProgressScreen';
import FeedScreen          from '../screens/FeedScreen';
import ProfileScreen       from '../screens/ProfileScreen';
import LogWorkoutScreen    from '../screens/LogWorkoutScreen';
import PlansScreen         from '../screens/PlansScreen';
import PlanGeneratorScreen from '../screens/PlanGeneratorScreen';
import ExercisesScreen     from '../screens/ExercisesScreen';
import ProgressScreen      from '../screens/ProgressScreen';
import HistoryScreen       from '../screens/HistoryScreen';
import StepsScreen         from '../screens/StepsScreen';
import CalculatorsScreen   from '../screens/CalculatorsScreen';
import AboutWNSScreen      from '../screens/AboutWNSScreen';
import SettingsScreen      from '../screens/SettingsScreen';
import { House, Dumbbell, Salad, Users, User } from 'lucide-react-native';

// ── Stack / Tab navigators ────────────────────────────────────────────────────
// Five tabs; everything else opens on top of them in the root stack, with a
// back button. A stacked screen returns to a tab (or to an earlier screen)
// with popTo('Tabs', { screen: 'Feed', params }), since in React Navigation 7
// navigate() pushes a new copy instead of going back.
const AuthStack = createNativeStackNavigator();
const AppTab    = createBottomTabNavigator();
const RootStack = createNativeStackNavigator();

const TABS = [
  ['Dashboard', DashboardScreen, 'Home', House],
  ['Train', TrainScreen, 'Train', Dumbbell],
  ['Nutrition', NutritionHubScreen, 'Nutrition', Salad],
  ['Feed', FeedScreen, 'Community', Users],
  ['Profile', ProfileScreen, 'Me', User],
];

function AppTabs() {
  return (
    <AppTab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor:   colors.brand,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingBottom: 6,
          height: 62,
        },
        tabBarLabelStyle: { fontSize: 11, marginTop: 2 },
      }}
    >
      {TABS.map(([name, component, title, Icon]) => (
        <AppTab.Screen key={name} name={name} component={component}
          options={{ title, tabBarIcon: ({ color, focused }) => <Icon size={22} color={color} strokeWidth={focused ? 2.2 : 1.8} /> }} />
      ))}
    </AppTab.Navigator>
  );
}

// Screens opened on top of the tabs: [route name, component, header title].
const STACK_SCREENS = [
  ['LogWorkout', LogWorkoutScreen, 'Log Workout'],
  ['FoodLog', NutritionScreen, 'Food Log'],
  ['Hydration', HydrationScreen, 'Hydration'],
  ['Supplements', SupplementsScreen, 'Supplements'],
  ['NutritionProgress', NutritionProgressScreen, 'Nutrition Progress'],
  ['Plans', PlansScreen, 'Workout Plans'],
  ['PlanGenerator', PlanGeneratorScreen, 'Workout Planner'],
  ['Exercises', ExercisesScreen, 'Exercise Library'],
  ['Progress', ProgressScreen, 'Progress'],
  ['History', HistoryScreen, 'History'],
  ['Steps', StepsScreen, 'Steps'],
  ['Calculators', CalculatorsScreen, 'Calculators'],
  ['AboutWNS', AboutWNSScreen, 'About the WNS Calculator'],
  ['UserProfile', ProfileScreen, 'Profile'],
  ['Settings', SettingsScreen, 'Settings'],
];

function AppStack() {
  // Pull steps from the phone / health app when the app opens or comes back to the front.
  useEffect(() => {
    syncIfStale();
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') syncIfStale(); });
    return () => sub.remove();
  }, []);

  return (
    <RootStack.Navigator screenOptions={{ headerTintColor: colors.brand, headerTitleStyle: { color: colors.textPrimary }, headerBackTitle: 'Back' }}>
      <RootStack.Screen name="Tabs" component={AppTabs} options={{ headerShown: false }} />
      {STACK_SCREENS.map(([name, component, title]) => (
        <RootStack.Screen key={name} name={name} component={component} options={{ title }} />
      ))}
    </RootStack.Navigator>
  );
}

function AuthStackNav() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login"    component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
}

function LoadingScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
      <View style={{ marginBottom: 16 }}><Dumbbell size={40} color={colors.brand} /></View>
      <ActivityIndicator size="large" color={colors.brand} />
    </View>
  );
}

// Where the user was, so switching light/dark (which remounts the navigator)
// keeps them on the same screen.
let savedNavState;

export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) savedNavState = undefined; // a new sign-in starts fresh

  const base = isDark() ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, primary: colors.brand, background: colors.bg, card: colors.surface, text: colors.textPrimary, border: colors.border },
  };

  return (
    <NavigationContainer theme={navTheme} initialState={user ? savedNavState : undefined}
      onStateChange={(state) => { savedNavState = state; }}>
      {user ? <AppStack /> : <AuthStackNav />}
    </NavigationContainer>
  );
}