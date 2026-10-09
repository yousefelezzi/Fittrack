import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Dumbbell } from 'lucide-react';
import { authAPI } from '../api';
import { USERNAME_HINT, cleanUsername, useUsernameCheck } from '../utils/username';

function UsernameStatus({ check }) {
  if (check.status === 'idle') return <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{USERNAME_HINT}</p>;
  const color = check.status === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : check.status === 'bad' ? 'text-red-500' : 'text-gray-400';
  return <p className={`text-xs mt-1 ${color}`}>{check.message}</p>;
}

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const check = useUsernameCheck(form.username, authAPI.usernameAvailable);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (check.status === 'bad') { setError(check.message); return; }
    setLoading(true);
    try {
      await register(form);
      navigate('/get-started');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-brand-600 text-white flex items-center justify-center"><Dumbbell size={28} /></div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Create your account</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Start tracking your fitness journey</p>
        </div>
        <div className="card">
          {error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm rounded-lg">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full name</label>
              <input className="input" placeholder="John Doe" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">@</span>
                <input className="input pl-7" placeholder="yourname" autoComplete="username" autoCapitalize="none" value={form.username}
                  onChange={(e) => setForm({ ...form, username: cleanUsername(e.target.value) })} required minLength={3} />
              </div>
              <UsernameStatus check={check} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
              <input className="input" type="email" placeholder="you@example.com" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
              <input className="input" type="password" placeholder="Min. 6 characters" value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>
          <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-600 font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
