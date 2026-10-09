import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, KeyboardAvoidingView,
  Platform, ScrollView, } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { errorMessage, authAPI } from '../api';
import { Button, Input, colors, makeStyles, cardSurface } from '../components';
import { Dumbbell } from 'lucide-react-native';
import { USERNAME_HINT, cleanUsername, useUsernameCheck } from '../../../client-web/src/utils/username';

function UsernameStatus({ check }) {
  const color = check.status === 'ok' ? colors.success : check.status === 'bad' ? colors.danger : colors.textMuted;
  return <Text style={{ fontSize: 12, color, marginTop: -6, marginBottom: 10 }}>{check.status === 'idle' ? USERNAME_HINT : check.message}</Text>;
}

export default function RegisterScreen({ navigation }) {
  const { register } = useAuth();
  const [form, setForm]       = useState({ name: '', username: '', email: '', password: '', confirm: '' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const check = useUsernameCheck(form.username, authAPI.usernameAvailable);

  const handleRegister = async () => {
    setError('');
    if (!form.name || !form.username || !form.email || !form.password) { setError('Please fill in all fields'); return; }
    if (form.username.length < 3) { setError('Usernames are 3 to 20 characters'); return; }
    if (check.status === 'bad') { setError(check.message); return; }
    if (form.password !== form.confirm) { setError('Passwords do not match'); return; }
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return; }
    const pwRe = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/;
    if (!pwRe.test(form.password)) {
      setError('Password needs uppercase, lowercase, number, and special character');
      return;
    }
    setLoading(true);
    try {
      await register({ name: form.name, username: form.username, email: form.email, password: form.password });
    } catch (err) {
      setError(errorMessage(err, 'Registration failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.logo}><Dumbbell size={30} color="#fff" /></View>
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Start your fitness journey</Text>

        <View style={styles.card}>
          {error ? (
            <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>
          ) : null}

          <Input label="Name" placeholder="Your name" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} autoComplete="name" />
          <Input label="Username" placeholder="yourname" value={form.username} onChangeText={(v) => setForm({ ...form, username: cleanUsername(v) })}
            autoCapitalize="none" autoCorrect={false} autoComplete="username-new" textContentType="username" />
          <UsernameStatus check={check} />
          <Input label="Email" placeholder="you@example.com" value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
          <Input label="Password" placeholder="Min 8 chars, Aa1@…" value={form.password} onChangeText={(v) => setForm({ ...form, password: v })} secureTextEntry />
          <Input label="Confirm password" placeholder="••••••••" value={form.confirm} onChangeText={(v) => setForm({ ...form, confirm: v })} secureTextEntry />

          <Button title="Create account" onPress={handleRegister} loading={loading} style={{ marginTop: 4 }} />
        </View>

        <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.link}>
          <Text style={styles.linkText}>Already have an account? <Text style={styles.linkBold}>Sign in</Text></Text>
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