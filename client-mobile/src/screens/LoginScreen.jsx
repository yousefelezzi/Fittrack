import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, KeyboardAvoidingView,
  Platform, ScrollView, } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { errorMessage } from '../api';
import { Button, Input, colors, makeStyles, cardSurface } from '../components';
import { Dumbbell } from 'lucide-react-native';

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [form, setForm]       = useState({ email: '', password: '' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError('');
    if (!form.email || !form.password) { setError('Please fill in all fields'); return; }
    setLoading(true);
    try {
      await login(form);
      // Navigation is driven by AuthContext — no explicit navigate needed
    } catch (err) {
      setError(errorMessage(err, 'Login failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.logo}><Dumbbell size={30} color="#fff" /></View>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to FitTrack</Text>

        <View style={styles.card}>
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Input
            label="Email"
            placeholder="you@example.com"
            value={form.email}
            onChangeText={(v) => setForm({ ...form, email: v })}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <Input
            label="Password"
            placeholder="••••••••"
            value={form.password}
            onChangeText={(v) => setForm({ ...form, password: v })}
            secureTextEntry
            autoComplete="password"
          />

          <Button title="Sign in" onPress={handleLogin} loading={loading} style={{ marginTop: 4 }} />
        </View>

        <TouchableOpacity onPress={() => navigation.navigate('Register')} style={styles.link}>
          <Text style={styles.linkText}>No account? <Text style={styles.linkBold}>Create one</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = makeStyles(() => ({
  container:   { flexGrow: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: 24 },
  logo:        { width: 60, height: 60, borderRadius: 16, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', marginBottom: 12, alignSelf: 'center' },
  title:       { fontSize: 26, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  subtitle:    { fontSize: 15, color: colors.textSecondary, marginBottom: 28 },
  card: {
    width: '100%', backgroundColor: colors.surface, borderRadius: 20,
    padding: 20, shadowColor: '#000', shadowOpacity: 0.07,
    shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3,
    ...cardSurface(),
  },
  errorBox:  { backgroundColor: colors.dangerLight, borderRadius: 10, padding: 10, marginBottom: 12 },
  errorText: { color: colors.danger, fontSize: 13 },
  link:      { marginTop: 20 },
  linkText:  { fontSize: 14, color: colors.textSecondary },
  linkBold:  { color: colors.brand, fontWeight: '600' },
}));