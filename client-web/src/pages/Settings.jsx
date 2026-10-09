import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, MessageSquare, Search, KeyRound, LogOut, Apple, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { userAPI, authAPI } from '../api';

const MESSAGE_OPTIONS = [
  ['connections', 'People I follow or who follow me'],
  ['following', 'Only people I follow'],
  ['nobody', 'No one'],
];

function Toggle({ checked, onChange, disabled }) {
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}
      className={`relative w-10 h-6 rounded-full transition-colors shrink-0 disabled:opacity-50 ${checked ? 'bg-brand-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
    </button>
  );
}

function Row({ title, hint, children }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{title}</p>
        {hint && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <div className="card">
      <h2 className="flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100 mb-1"><Icon size={16} className="text-brand-600" /> {title}</h2>
      {children}
    </div>
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
    <div className="space-y-3 pt-2">
      <p className="text-sm text-gray-500 dark:text-gray-400">We'll email a link to <span className="font-medium text-gray-700 dark:text-gray-300">{email}</span>. Open it to choose your new password. You'll then be signed out everywhere.</p>
      {message && <p className={`text-sm ${message.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>{message.text}</p>}
      <button onClick={send} disabled={busy} className="btn-primary">{busy ? 'Sending…' : 'Email me a link'}</button>
    </div>
  );
}

/** New email + password; a link sent to the new address confirms it. */
function ChangeEmail({ user, updateUser }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { ok, text }
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setMessage(null); };
  const submit = async (e) => {
    e.preventDefault();
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
    <form onSubmit={submit} className="space-y-3 pt-2">
      <p className="text-sm text-gray-500 dark:text-gray-400">You sign in with <span className="font-medium text-gray-700 dark:text-gray-300">{user?.email}</span>.</p>
      {user?.pendingEmail && (
        <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-sm text-amber-800 dark:text-amber-300">
          <span>Waiting for you to confirm <span className="font-medium">{user.pendingEmail}</span> from the link we sent there.</span>
          <button type="button" onClick={cancel} className="text-xs font-medium underline shrink-0">Cancel</button>
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">New email</label>
        <input type="email" className="input" autoComplete="email" value={form.email} onChange={set('email')} />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Your password</label>
        <input type="password" className="input" autoComplete="current-password" value={form.password} onChange={set('password')} />
      </div>
      {message && <p className={`text-sm ${message.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>{message.text}</p>}
      <button type="submit" disabled={busy || !form.email.trim() || !form.password} className="btn-primary">{busy ? 'Sending…' : 'Send confirmation link'}</button>
    </form>
  );
}

/** Privacy settings: private account, who can message you, search, password; sign out. */
export default function Settings() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
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


  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <Link to="/profile" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 mb-2"><ArrowLeft size={16} /> Profile</Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}

      <Section icon={Lock} title="Account privacy">
        <Row title="Private account" hint="New followers need your approval (in Community → People). Only your followers see your posts, follower lists and public stats.">
          <Toggle checked={privacy.privateAccount} disabled={busy === 'privateAccount'} onChange={(v) => save('privateAccount', { privacy: { privateAccount: v } })} />
        </Row>
        <Row title="Show me in search and suggestions" hint="When off, people can only find you through someone who follows you.">
          <Toggle checked={privacy.discoverable} disabled={busy === 'discoverable'} onChange={(v) => save('discoverable', { privacy: { discoverable: v } })} />
        </Row>
      </Section>

      <Section icon={Apple} title="Nutrition">
        <Row title="Adjust my calorie goal from my weight trend"
          hint="Compares what you ate with how your weight moved over the last 2 weeks and corrects your maintenance. Needs food logged on 10 of 14 days and a couple of weigh-ins each week.">
          <Toggle checked={user?.adaptiveCalories !== false} disabled={busy === 'adaptiveCalories'} onChange={(v) => save('adaptiveCalories', { adaptiveCalories: v })} />
        </Row>
      </Section>

      <Section icon={MessageSquare} title="Who can message you">
        <div className="py-2 space-y-1">
          {MESSAGE_OPTIONS.map(([value, label]) => (
            <label key={value} className="flex items-center gap-3 py-1.5 cursor-pointer">
              <input type="radio" name="messages" className="accent-brand-600" checked={privacy.messages === value}
                disabled={busy === 'messages'} onChange={() => save('messages', { privacy: { messages: value } })} />
              <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
            </label>
          ))}
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">Applies to new chats and to sending in existing ones.</p>
      </Section>

      <Section icon={Mail} title="Email">
        <ChangeEmail user={user} updateUser={updateUser} />
      </Section>

      <Section icon={KeyRound} title="Password">
        <ChangePassword email={user?.email} />
      </Section>

      <div className="card flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Signed in as {user?.name}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{user?.email}</p>
        </div>
        <button onClick={async () => { await logout(); navigate('/login'); }}
          className="btn-secondary !text-red-600 dark:!text-red-400 shrink-0"><LogOut size={15} /> Sign out</button>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
        <Search size={12} /> Your height, weight, body fat, sex and activity level are never shown to others.
      </p>
    </div>
  );
}
