import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Dumbbell, ShieldCheck, KeyRound } from 'lucide-react';
import { authAPI } from '../api';

export default function Login() {
  const { login, verifyLogin } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [twoFactor, setTwoFactor] = useState(null); // { challenge, email } while waiting for the emailed code
  const [forgot, setForgot] = useState(null);       // { login, sent } on "Forgot password?"

  const sendReset = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await authAPI.forgotPassword(forgot.login.trim());
      setForgot((f) => ({ ...f, sent: data.message }));
    } catch (err) {
      setError(err.response?.data?.errors?.[0]?.message || err.response?.data?.message || 'Could not send the email');
    } finally {
      setLoading(false);
    }
  };
  const [code, setCode] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(form);
      if (result?.twoFactor) { setTwoFactor(result.twoFactor); setCode(''); setNotice(''); return; }
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const submitCode = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await verifyLogin(twoFactor.challenge, code);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.errors?.[0]?.message || err.response?.data?.message || 'Could not sign in');
      if (err.response?.status === 400 && /expired. Sign in again/.test(err.response?.data?.message || '')) setTwoFactor(null);
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setError('');
    setNotice('');
    try { setNotice((await authAPI.resendLoginCode(twoFactor.challenge)).data.message); } catch (err) { setError(err.response?.data?.message || 'Could not send a new code'); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-brand-600 text-white flex items-center justify-center"><Dumbbell size={28} /></div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Welcome back</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Sign in to FitTrack</p>
        </div>
        <div className="card">
          {error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm rounded-lg">{error}</div>}
          {forgot ? (
            <form onSubmit={sendReset} className="space-y-4">
              <div className="flex items-start gap-3">
                <KeyRound size={22} className="text-brand-600 shrink-0 mt-0.5" />
                <p className="text-sm text-gray-600 dark:text-gray-300">Enter your email or username and we'll email you a link to choose a new password.</p>
              </div>
              {forgot.sent ? (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 text-sm rounded-lg">{forgot.sent}</div>
              ) : (
                <>
                  <input className="input" type="text" autoComplete="username" autoCapitalize="none" autoFocus placeholder="you@example.com or yourname"
                    value={forgot.login} onChange={(e) => { setForgot({ ...forgot, login: e.target.value }); setError(''); }} />
                  <button type="submit" disabled={loading || !forgot.login.trim()} className="btn-primary w-full justify-center">
                    {loading ? 'Sending…' : 'Email me a link'}
                  </button>
                </>
              )}
              <button type="button" onClick={() => { setForgot(null); setError(''); }} className="text-sm text-gray-500 hover:underline">Back to sign in</button>
            </form>
          ) : twoFactor ? (
            <form onSubmit={submitCode} className="space-y-4">
              <div className="flex items-start gap-3">
                <ShieldCheck size={22} className="text-brand-600 shrink-0 mt-0.5" />
                <p className="text-sm text-gray-600 dark:text-gray-300">We emailed a 6-digit code to <span className="font-medium">{twoFactor.email}</span>. Enter it to finish signing in.</p>
              </div>
              <input className="input text-center text-2xl tracking-[0.5em] font-semibold" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus
                placeholder="••••••" value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }} aria-label="Sign-in code" />
              {notice && <p className="text-sm text-emerald-600 dark:text-emerald-400">{notice}</p>}
              <button type="submit" disabled={loading || code.length !== 6} className="btn-primary w-full justify-center">
                {loading ? 'Checking…' : 'Sign in'}
              </button>
              <div className="flex justify-between text-sm">
                <button type="button" onClick={() => { setTwoFactor(null); setError(''); }} className="text-gray-500 hover:underline">Back</button>
                <button type="button" onClick={resend} className="text-brand-600 font-medium hover:underline">Send a new code</button>
              </div>
            </form>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email or username</label>
              <input className="input" type="text" autoComplete="username" autoCapitalize="none" placeholder="you@example.com or yourname" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                <button type="button" onClick={() => { setForgot({ login: form.email, sent: '' }); setError(''); }} className="text-xs text-brand-600 font-medium hover:underline">Forgot password?</button>
              </div>
              <input className="input" type="password" placeholder="••••••••" value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          )}
          <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
            No account?{' '}
            <Link to="/register" className="text-brand-600 font-medium hover:underline">Create one</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
