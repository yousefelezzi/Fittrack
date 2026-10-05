import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, UserPlus, UserMinus, MessageSquare, Check, X } from 'lucide-react';
import Avatar from '../Avatar';
import { userAPI } from '../../api';

function PersonRow({ person, isFollowing, isRequested, followsMe, onFollow, onUnfollow, onMessage, note }) {
  const canMessage = isFollowing || followsMe;
  return (
    <li className="flex items-center gap-3 py-2.5">
      <Link to={`/profile/${person._id}`} className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80">
        <Avatar user={person} size="md" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{person.name}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{note || person.bio || (followsMe ? 'Follows you' : '')}</p>
        </div>
      </Link>
      <button onClick={() => onMessage(person)} disabled={!canMessage}
        title={canMessage ? 'Message' : 'Follow them (or have them follow you) to message'}
        className="p-2 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-30 disabled:hover:bg-transparent">
        <MessageSquare size={16} />
      </button>
      {isFollowing ? (
        <button onClick={() => onUnfollow(person._id)} className="btn-secondary py-1.5 px-3 text-xs"><UserMinus size={13} /> Unfollow</button>
      ) : isRequested ? (
        <button onClick={() => onUnfollow(person._id)} title="Cancel your follow request" className="btn-secondary py-1.5 px-3 text-xs">Requested</button>
      ) : (
        <button onClick={() => onFollow(person._id)} className="btn-primary py-1.5 px-3 text-xs"><UserPlus size={13} /> Follow</button>
      )}
    </li>
  );
}

/** People asking to follow you (private accounts): approve or decline. */
function FollowRequests({ requests, onAnswer }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const answer = async (id, accept) => {
    setBusy(id);
    setError('');
    try { await onAnswer(id, accept); } catch (err) {
      setError(err.response?.data?.message || 'Could not update that request');
    } finally { setBusy(null); }
  };
  return (
    <div className="card !py-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 pt-2">Follow requests · {requests.length}</p>
      {requests.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 py-3">No one is waiting. Requests show up here when your account is private.</p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {requests.map((u) => (
            <li key={u._id} className="flex items-center gap-3 py-2.5">
              <Link to={`/profile/${u._id}`} className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80">
                <Avatar user={u} size="md" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{u.name}</p>
                  {u.bio && <p className="text-xs text-gray-400 truncate">{u.bio}</p>}
                </div>
              </Link>
              <button onClick={() => answer(u._id, true)} disabled={busy === u._id} className="btn-primary py-1.5 px-3 text-xs"><Check size={13} /> Approve</button>
              <button onClick={() => answer(u._id, false)} disabled={busy === u._id} className="btn-secondary py-1.5 px-3 text-xs"><X size={13} /> Decline</button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-xs text-red-500 pb-2">{error}</p>}
    </div>
  );
}

/** Find people: follow requests, search, suggestions, and the people you follow. */
export default function People({ me, following, followers, requested, followRequests = [], onAnswerRequest, onFollow, onUnfollow, onMessage }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [myFollowing, setMyFollowing] = useState([]);

  useEffect(() => {
    userAPI.suggestions().then(({ data }) => setSuggestions(data)).catch(() => {});
    if (me?._id) userAPI.getFollowing(me._id).then(({ data }) => setMyFollowing(data)).catch(() => {});
  }, [me?._id]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults(null); return; }
    const id = setTimeout(() => {
      userAPI.search(term).then(({ data }) => setResults(data)).catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(id);
  }, [q]);

  const row = (p, note) => (
    <PersonRow key={p._id} person={p} note={note}
      isFollowing={following.has(String(p._id))} isRequested={requested?.has(String(p._id))} followsMe={followers.has(String(p._id))}
      onFollow={onFollow} onUnfollow={onUnfollow} onMessage={onMessage} />
  );

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="input pl-9" placeholder="Search people by name (or exact email)…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {!results && <FollowRequests requests={followRequests} onAnswer={onAnswerRequest} />}

      {results ? (
        <div className="card !py-2">
          {results.length === 0
            ? <p className="text-sm text-gray-400 dark:text-gray-500 py-3 text-center">No one found for “{q.trim()}”.</p>
            : <ul className="divide-y divide-gray-100 dark:divide-gray-800">{results.map((p) => row(p))}</ul>}
        </div>
      ) : (
        <>
          {suggestions.filter((s) => !following.has(String(s._id))).length > 0 && (
            <div className="card !py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 pt-2">Suggested for you</p>
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {suggestions.filter((s) => !following.has(String(s._id))).map((p) =>
                  row(p, p.mutual ? `Followed by ${p.mutual} you follow` : undefined))}
              </ul>
            </div>
          )}
          <div className="card !py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 pt-2">Following · {following.size}</p>
            {myFollowing.length === 0
              ? <p className="text-sm text-gray-400 dark:text-gray-500 py-3">You're not following anyone yet.</p>
              : <ul className="divide-y divide-gray-100 dark:divide-gray-800">{myFollowing.map((p) => row(p))}</ul>}
          </div>
        </>
      )}
    </div>
  );
}
