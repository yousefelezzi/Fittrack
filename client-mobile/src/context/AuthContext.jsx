import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI, setSessionEndedHandler } from '../api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = await AsyncStorage.getItem('accessToken');
    if (!token) { setLoading(false); return; }
    try {
      const { data } = await authAPI.getMe();
      setUser(data);
    } catch {
      await AsyncStorage.multiRemove(['accessToken', 'refreshToken']);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUser(); }, [loadUser]);
  // Signed out when the session ends (e.g. the password was changed).
  useEffect(() => setSessionEndedHandler(() => setUser(null)), []);

  const signedIn = async (data) => {
    await AsyncStorage.multiSet([
      ['accessToken',  data.accessToken],
      ['refreshToken', data.refreshToken],
    ]);
    setUser(data.user);
    return data.user;
  };

  // With two-step sign-in on, this returns { twoFactor: { challenge, email } }
  // instead of signing in; finish with verifyLogin and the emailed code.
  const login = async (credentials) => {
    const { data } = await authAPI.login(credentials);
    if (data.twoFactorRequired) return { twoFactor: { challenge: data.challenge, email: data.email } };
    return signedIn(data);
  };

  const verifyLogin = async (challenge, code) => signedIn((await authAPI.verifyLogin(challenge, code)).data);

  const register = async (formData) => {
    const { data } = await authAPI.register(formData);
    await AsyncStorage.multiSet([
      ['accessToken',  data.accessToken],
      ['refreshToken', data.refreshToken],
    ]);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try { await authAPI.logout(); } catch { /* ignore */ }
    await AsyncStorage.multiRemove(['accessToken', 'refreshToken']);
    setUser(null);
  };

  const updateUser = (updates) => setUser((prev) => ({ ...prev, ...updates }));

  return (
    <AuthContext.Provider value={{ user, loading, login, verifyLogin, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};