import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import AppNavigator from './src/navigation';
import { colors } from './src/components';
import { View, Image } from 'react-native';
import logo from './assets/logo.png';

function Shell() {
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <View style={{ alignItems: 'center', paddingVertical: 12 }}>
        <Image source={logo} style={{ width: 120, height: 40 }} />
      </View>
      {/* Remounted when the theme changes so every screen redraws in its colors. */}
      <AppNavigator key={theme} />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <Shell />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
