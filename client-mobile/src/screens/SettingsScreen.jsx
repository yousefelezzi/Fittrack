import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, Switch, TouchableOpacity } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { userAPI, authAPI } from '../api';
import { Card, Button, Label, colors, makeStyles, Hint, ErrorText, confirm, Segmented } from '../components';
import { Lock, MessageCircle, KeyRound, LogOut, Moon, Salad, Mail, ShieldCheck } from 'lucide-react-native';

const MESSAGE_OPTIONS = [
  ['connections', 'People I follow or who follow me'],
  ['following', 'Only people I follow'],
  ['nobody', 'No one'],
];

function SectionHead({ icon: Icon, children }) {
  return (
    <View style={styles.sectionRow}>
      <Icon size={15} color={colors.brand} />
      <Text style={styles.section}>{children}</Text>
    </View>
  );
}

function Row({ title, hint, children, last }) {
  return (
    <View style={[styles.row, last && { borderBottomWidth: 0 }]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {hint ? <Hint style={{ marginTop: 2 }}>{hint}</Hint> : null}
      </View>
      {children}
    </View>
  );
}

/** Emails a link to choose a new password (the change happens on that page). */
function ChangePassword({ email }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { ok, text }
  const send = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const { data } = await authAPI.requestPasswordChange();
      setMessage({ ok: true, text: data.message });
    } catch (err) {
      setMessage({ ok: false, text: err.response?.data?.message || 'Could not send the email' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ paddingVertical: 10 }}>
      <Hint style={{ marginBottom: 10 }}>We'll email a link to {email}. Open it to choose your new password. You'll then be signed out everywhere.</Hint>
      {message ? <Text style={[styles.message, { color: message.ok ? colors.success : colors.danger }]}>{message.text}</Text> : null}
      <Button title={busy ? 'Sending…' : 'Email me a link'} loading={busy} disabled={busy} onPress={send} />
    </View>
  );
}

/** New email + password; a link sent to the new address confirms it. */
function ChangeEmail({ user, updateUser }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { ok, text }
  const set = (k) => (v) => { setForm((f) => ({ ...f, [k]: v })); setMessage(null); };
  const submit = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const { data } = await authAPI.requestEmailChange(form.email.trim(), form.password);
      updateUser({ ...user, pendingEmail: data.pendingEmail });
      setForm({ email: '', password: '' });
      setMessage({ ok: true, text: data.message });
    } catch (err) {
      setMessage({ ok: false, text: err.response?.data?.errors?.[0]?.message || err.response?.data?.message || 'Could not send the email' });
    } finally {
      setBusy(false);
    }
  };
  const cancel = async () => {
    try { await authAPI.cancelEmailChange(); updateUser({ ...user, pendingEmail: null }); setMessage(null); } catch { /* stays pending */ }
  };
  return (
    <View style={{ paddingVertical: 10 }}>
      <Hint style={{ marginBottom: 10 }}>You sign in with {user?.email}.</Hint>
      {user?.pendingEmail ? (
        <View style={styles.pending}>
          <Text style={[styles.pendingText, { flex: 1 }]}>Waiting for you to confirm {user.pendingEmail} from the link we sent there.</Text>
          <TouchableOpacity onPress={cancel} hitSlop={8}><Text style={[styles.pendingText, { fontWeight: '700', textDecorationLine: 'underline' }]}>Cancel</Text></TouchableOpacity>
        </View>
      ) : null}
      <View style={{ marginBottom: 8 }}>
        <Label>New email</Label>
        <TextInput style={styles.input} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email"
          textContentType="emailAddress" value={form.email} onChangeText={set('email')} />
      </View>
      <View style={{ marginBottom: 8 }}>
        <Label>Your password</Label>
        <TextInput style={styles.input} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="current-password"
          textContentType="password" value={form.password} onChangeText={set('password')} />
      </View>
      {message ? <Text style={[styles.message, { color: message.ok ? colors.success : colors.danger }]}>{message.text}</Text> : null}
      <Button title={busy ? 'Sending…' : 'Send confirmation link'} loading={busy} disabled={busy || !form.email.trim() || !form.password} onPress={submit} />
    </View>
  );
}

/**
 * Two-step sign-in: a code emailed at each sign-in. Turning it on needs the
 * password and a code (so we know the emails arrive); turning it off, the password.
 */
function TwoStep({ user, updateUser }) {
  const on = !!user?.twoFactorEnabled;
  const [step, setStep] = useState(null); // null | 'password' | 'code'
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { ok, text }
  const fail = (err, fallback) => setMessage({ ok: false, text: err.response?.data?.errors?.[0]?.message || err.response?.data?.message || fallback });
  const reset = () => { setStep(null); setPassword(''); setCode(''); };

  const submitPassword = async () => {
    setBusy(true);
    setMessage(null);
    try {
      if (on) {
        const { data } = await authAPI.disableTwoFactor(password);
        updateUser({ ...user, twoFactorEnabled: false });
        reset();
        setMessage({ ok: true, text: data.message });
      } else {
        const { data } = await authAPI.requestTwoFactor(password);
        setPassword('');
        setStep('code');
        setMessage({ ok: true, text: data.message });
      }
    } catch (err) { fail(err, 'Could not do that'); } finally { setBusy(false); }
  };
  const submitCode = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const { data } = await authAPI.confirmTwoFactor(code);
      updateUser({ ...user, twoFactorEnabled: true });
      reset();
      setMessage({ ok: true, text: data.message });
    } catch (err) { fail(err, 'Could not check the code'); } finally { setBusy(false); }
  };

  return (
    <View style={{ paddingVertical: 10 }}>
      <Text style={styles.rowTitle}>{on ? 'Two-step sign-in is on' : 'Two-step sign-in is off'}</Text>
      <Hint style={{ marginTop: 2, marginBottom: 10 }}>
        {on ? `When you sign in, we email a code to ${user?.email} to type in after your password.` : "Add a code emailed to you at each sign-in, so your password alone isn't enough."}
      </Hint>
      {step === 'password' ? (
        <View style={{ marginBottom: 8 }}>
          <Label>Your password</Label>
          <TextInput style={styles.input} secureTextEntry autoFocus autoCapitalize="none" autoCorrect={false} textContentType="password" value={password} onChangeText={setPassword} />
        </View>
      ) : null}
      {step === 'code' ? (
        <View style={{ marginBottom: 8 }}>
          <Label>Code from the email</Label>
          <TextInput style={[styles.input, { textAlign: 'center', fontSize: 20, letterSpacing: 6, fontWeight: '700' }]} autoFocus keyboardType="number-pad"
            textContentType="oneTimeCode" maxLength={6} value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} />
        </View>
      ) : null}
      {message ? <Text style={[styles.message, { color: message.ok ? colors.success : colors.danger }]}>{message.text}</Text> : null}
      {!step ? (
        <Button title={on ? 'Turn off' : 'Turn on'} variant={on ? 'secondary' : 'primary'} onPress={() => { setStep('password'); setMessage(null); }} />
      ) : (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button style={{ flex: 1 }} variant={on && step === 'password' ? 'danger' : 'primary'} loading={busy}
            disabled={busy || (step === 'password' ? !password : code.length !== 6)}
            title={step === 'code' ? 'Turn on' : on ? 'Turn off' : 'Email me a code'}
            onPress={step === 'code' ? submitCode : submitPassword} />
          <Button style={{ flex: 1 }} variant="secondary" title="Cancel" onPress={reset} />
        </View>
      )}
    </View>
  );
}

/** Settings: appearance; privacy (private account, who can message you, search); password; sign out. */
export default function SettingsScreen() {
  const { user, updateUser, logout } = useAuth();
  const { preference, setPreference } = useTheme();
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');

  const privacy = { privateAccount: false, messages: 'connections', discoverable: true, ...(user?.privacy || {}) };

  // Saves one setting; the server sends the updated user back.
  const save = async (key, body) => {
    setBusy(key);
    setError('');
    try {
      const { data } = await userAPI.updateMe(body);
      updateUser(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save that setting');
    } finally {
      setBusy(null);
    }
  };


  const toggle = (key, value, body) => (
    <Switch value={value} disabled={busy === key} onValueChange={(v) => save(key, body(v))} trackColor={{ true: colors.brand }} />
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <ErrorText>{error}</ErrorText>

      <SectionHead icon={Moon}>Appearance</SectionHead>
      <Card>
        <Segmented value={preference} onChange={setPreference}
          options={[['system', 'System'], ['light', 'Light'], ['dark', 'Dark']]} />
        <Hint style={{ marginTop: 8 }}>System follows your phone's light or dark mode.</Hint>
      </Card>

      <SectionHead icon={Lock}>Account privacy</SectionHead>
      <Card style={{ paddingVertical: 4 }}>
        <Row title="Private account" hint="New followers need your approval (in Community → People). Only your followers see your posts, follower lists and public stats.">
          {toggle('privateAccount', privacy.privateAccount, (v) => ({ privacy: { privateAccount: v } }))}
        </Row>
        <Row title="Show me in search and suggestions" hint="When off, people can only find you through someone who follows you." last>
          {toggle('discoverable', privacy.discoverable, (v) => ({ privacy: { discoverable: v } }))}
        </Row>
      </Card>

      <SectionHead icon={Salad}>Nutrition</SectionHead>
      <Card style={{ paddingVertical: 4 }}>
        <Row title="Adjust my calorie goal from my weight trend" last
          hint="Compares what you ate with how your weight moved over the last 2 weeks and corrects your maintenance. Needs food logged on 10 of 14 days and a couple of weigh-ins each week.">
          {toggle('adaptiveCalories', user?.adaptiveCalories !== false, (v) => ({ adaptiveCalories: v }))}
        </Row>
      </Card>

      <SectionHead icon={MessageCircle}>Who can message you</SectionHead>
      <Card style={{ paddingVertical: 4 }}>
        {MESSAGE_OPTIONS.map(([value, label], i) => (
          <TouchableOpacity key={value} disabled={busy === 'messages'} onPress={() => save('messages', { privacy: { messages: value } })}
            style={[styles.row, i === MESSAGE_OPTIONS.length - 1 && { borderBottomWidth: 0 }]}>
            <Text style={[styles.rowTitle, { flex: 1 }]}>{label}</Text>
            <View style={[styles.radio, privacy.messages === value && styles.radioOn]}>
              {privacy.messages === value ? <View style={styles.radioDot} /> : null}
            </View>
          </TouchableOpacity>
        ))}
      </Card>
      <Hint style={{ marginTop: -4, marginBottom: 8 }}>Applies to new chats and to sending in existing ones.</Hint>

      <SectionHead icon={Mail}>Email</SectionHead>
      <Card>
        <ChangeEmail user={user} updateUser={updateUser} />
      </Card>

      <SectionHead icon={KeyRound}>Password</SectionHead>
      <Card>
        <ChangePassword email={user?.email} />
      </Card>

      <SectionHead icon={ShieldCheck}>Two-step sign-in</SectionHead>
      <Card>
        <TwoStep user={user} updateUser={updateUser} />
      </Card>

      <Card style={styles.signOutCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>Signed in as {user?.name}</Text>
          {user?.email ? <Hint>{user.email}</Hint> : null}
        </View>
        <Button icon={LogOut} title="Sign out" variant="danger" style={{ paddingHorizontal: 16 }}
          onPress={async () => { if (await confirm('Sign out?', '', 'Sign out', true)) logout(); }} />
      </Card>

      <Hint style={{ textAlign: 'center', marginTop: 4 }}>Your height, weight, body fat, sex and activity level are never shown to others.</Hint>
    </ScrollView>
  );
}

const styles = makeStyles(() => ({
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, marginBottom: 6 },
  section:  { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  row:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.subtle },
  rowTitle: { fontSize: 14, fontWeight: '500', color: colors.textPrimary, flexShrink: 1 },
  person:   { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  smallBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  smallBtnPrimary: { backgroundColor: colors.brand, borderColor: colors.brand },
  smallBtnText: { fontSize: 12, fontWeight: '600', color: colors.textPrimary },
  radio:    { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioOn:  { borderColor: colors.brand },
  input:    { minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, fontSize: 15, color: colors.textPrimary, backgroundColor: colors.surface },
  message:  { fontSize: 13, marginBottom: 10 },
  signOutCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand },
  pending:  { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, backgroundColor: colors.warningLight, marginBottom: 10 },
  pendingText: { fontSize: 13, color: colors.warning },
}));
