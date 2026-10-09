import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, KeyboardAvoidingView,
  Platform, ScrollView, TextInput, } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { errorMessage, authAPI } from '../api';
import { Button, Input, colors, makeStyles, cardSurface } from '../components';
import { Dumbbell, ShieldCheck } from 'lucide-react-native';

export default function LoginScreen({ navigation }) {
  const { login, verifyLogin } = useAuth();
  const [form, setForm]       = useState({ email: '', password: '' });
  const [error, setError]     = useState('');
  const [notice, setNotice]   = useState('');
  const [loading, setLoading] = useState(false);
  const [twoFactor, setTwoFactor] = useState(null); // { challenge, email } while waiting for the emailed code
  const [code, setCode]       = useState('');

  const submitCode = async () => {
    setError('');
    setLoading(true);
    try {
      await verifyLogin(twoFactor.challenge, code);
    } catch (err) {
      const message = errorMessage(err, 'Could not sign in');
      setError(message);
      if (/expired. Sign in again/.test(message)) setTwoFactor(null);
    } finally {
      setLoading(false);
    }
  };
  const resend = async () => {
    setError('');
    setNotice('');
    try { setNotice((await authAPI.resendLoginCode(twoFactor.challenge)).data.message); } catch (err) { setError(errorMessage(err, 'Could not send a new code')); }
  };

  const handleLogin = async () => {
    setError('');
    if (!form.email || !form.password) { setError('Please fill in all fields'); return; }
    setLoading(true);
    try {
      const result = await login(form);
      if (result?.twoFactor) { setTwoFactor(result.twoFactor); setCode(''); setNotice(''); }
      // Otherwise navigation is driven by AuthContext — no explicit navigate needed
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

          {twoFactor ? (
            <>
              <View style={styles.codeIntro}>
                <ShieldCheck size={22} color={colors.brand} />
                <Text style={styles.codeText}>We emailed a 6-digit code to <Text style={{ fontWeight: '700' }}>{twoFactor.email}</Text>. Enter it to finish signing in.</Text>
              </View>
              <TextInput style={styles.codeInput} value={code} autoFocus keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code"
                maxLength={6} placeholder="••••••" placeholderTextColor={colors.textMuted}
                onChangeText={(v) => { setCode(v.replace(/\D/g, '').slice(0, 6)); setError(''); }} />
              {notice ? <Text style={styles.notice}>{notice}</Text> : null}
              <Button title="Sign in" onPress={submitCode} loading={loading} disabled={code.length !== 6} style={{ marginTop: 4 }} />
              <View style={styles.codeLinks}>
                <TouchableOpacity onPress={() => { setTwoFactor(null); setError(''); }} hitSlop={8}><Text style={styles.linkText}>Back</Text></TouchableOpacity>
                <TouchableOpacity onPress={resend} hitSlop={8}><Text style={styles.linkBold}>Send a new code</Text></TouchableOpacity>
              </View>
            </>
          ) : (
          <>
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
          </>
          )}
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
  codeIntro: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 14 },
  codeText:  { flex: 1, fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  codeInput: { height: 56, borderWidth: 1, borderColor: colors.border, borderRadius: 12, textAlign: 'center', fontSize: 26, fontWeight: '700', letterSpacing: 10, color: colors.textPrimary, backgroundColor: colors.surface, marginBottom: 10 },
  notice:    { fontSize: 13, color: colors.success, marginBottom: 6 },
  codeLinks: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
}));