import React, { createContext, useContext, useEffect, useState } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { applyTheme } from '../components/tokens';

const KEY = 'themePreference';
const ThemeContext = createContext(null);

/**
 * Light / dark mode. The preference ('system' | 'light' | 'dark') is kept on
 * this device; 'system' follows the phone's setting. The palette is applied
 * before anything below renders, so every screen draws in the right colors.
 */
export function ThemeProvider({ children }) {
  const [preference, setPreferenceState] = useState(null); // null while loading
  const [systemScheme, setSystemScheme] = useState(Appearance.getColorScheme());

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => setPreferenceState(['light', 'dark', 'system'].includes(v) ? v : 'system'))
      .catch(() => setPreferenceState('system'));
    const sub = Appearance.addChangeListener(({ colorScheme }) => setSystemScheme(colorScheme));
    return () => sub.remove();
  }, []);

  const theme = (preference === 'system' ? systemScheme : preference) === 'dark' ? 'dark' : 'light';
  applyTheme(theme); // swaps the shared tokens; does nothing if unchanged

  const setPreference = (value) => {
    setPreferenceState(value);
    AsyncStorage.setItem(KEY, value).catch(() => {});
  };

  if (preference === null) return null;
  return <ThemeContext.Provider value={{ preference, theme, setPreference }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
