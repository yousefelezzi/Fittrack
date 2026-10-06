import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, MessageSquare, Search, KeyRound, LogOut } from 'lucide-react';
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

// Same rule as sign-up (server/routes/auth.routes.js).
const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&#]+$/;

function ChangePassword() {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { ok, text }
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setMessage(null); };

  const submit = async (e) => {
    e.preventDefault();
    if (form.next.length < 8 || !PASSWORD_RULE.test(form.next)) {
      setMessage({ ok: false, text: 'Use at least 8 characters with an uppercase letter, a lowercase letter, a number and a symbol (@$!%*?&).' });
      return;
    }
    if (form.next !== form.confirm) { setMessage({ ok: false, text: "The new passwords don't match." }); return; }
    setBusy(true);
    try {
      await authAPI.changePassword(form.current, form.next);
      setForm({ current: '', next: '', confirm: '' });
      setMessage({ ok: true, text: 'Password changed.' });
    } catch (err) {
      setMessage({ ok: false, text: err.response?.data?.message || 'Could not change your password' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 pt-2">
      {[['current', 'Current password', 'current-password'], ['next', 'New password', 'new-password'], ['confirm', 'Confirm new password', 'new-password']].map(([k, label, auto]) => (
        <div key={k}>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
          <input type="password" className="input" autoComplete={auto} value={form[k]} onChange={set(k)} />
        </div>
      ))}
      {message && <p className={`text-sm ${message.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>{message.text}</p>}
      <button type="submit" disabled={busy || !form.current || !form.next || !form.confirm} className="btn-primary">
        {busy ? 'Changing…' : 'Change password'}
      </button>
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

      <Section icon={KeyRound} title="Password">
        <ChangePassword />
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
