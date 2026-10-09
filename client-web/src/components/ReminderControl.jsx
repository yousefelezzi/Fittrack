import { useState } from 'react';
import { Bell } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { userAPI } from '../api';
import { remindersOf } from '../utils/reminders';

/** Saves a reminder setting (reminders.workout / reminders.supplements) and updates the signed-in user. */
export async function saveReminder(updateUser, kind, change) {
  const { data } = await userAPI.updateMe({ reminders: { [kind]: change } });
  updateUser(data);
}

/**
 * A reminder's on/off switch and time. On the web it shows as a card on the
 * dashboard once it's time; the phone app sends a notification.
 */
export default function ReminderControl({ kind, title, hint }) {
  const { user, updateUser } = useAuth();
  const r = remindersOf(user)[kind];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const change = async (c) => {
    setBusy(true);
    setError('');
    try { await saveReminder(updateUser, kind, c); } catch { setError('Could not save the reminder'); } finally { setBusy(false); }
  };
  return (
    <div>
      <div className="flex items-center gap-3">
        <Bell size={16} className={r.enabled ? 'text-brand-600 shrink-0' : 'text-gray-400 shrink-0'} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{title}</p>
          {hint && <p className="text-xs text-gray-400 dark:text-gray-500">{hint}</p>}
        </div>
        {r.enabled && (
          <input type="time" className="input w-auto py-1.5 text-sm" value={r.time} aria-label={`${title}: time`}
            onChange={(e) => e.target.value && change({ time: e.target.value })} />
        )}
        <button type="button" role="switch" aria-checked={r.enabled} aria-label={title} disabled={busy} onClick={() => change({ enabled: !r.enabled })}
          className={`relative w-10 h-6 rounded-full transition-colors shrink-0 disabled:opacity-50 ${r.enabled ? 'bg-brand-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${r.enabled ? 'translate-x-4' : ''}`} />
        </button>
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
