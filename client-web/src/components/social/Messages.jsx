import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, isToday, formatDistanceToNowStrict } from 'date-fns';
import { ArrowLeft, Send, Dumbbell, Users, UserPlus, Pencil, LogOut, Check, Hand } from 'lucide-react';
import Avatar from '../Avatar';
import WorkoutSummary from './WorkoutSummary';
import PlanSummary from './PlanSummary';
import { messageAPI, workoutAPI, userAPI, planAPI } from '../../api';

const POLL_MS = 5000; // new messages show up within a few seconds

const chatTitle = (c) => (c.isGroup ? c.name || 'Group' : c.other?.name ?? 'Deleted user');

/** Two overlapping avatars for a group, one for a person. */
function ChatAvatar({ convo, size = 'md' }) {
  if (!convo.isGroup) return <Avatar user={convo.other} size={size} />;
  const [a, b] = convo.members || [];
  return (
    <div className={`relative shrink-0 ${size === 'md' ? 'w-10 h-10' : 'w-8 h-8'}`}>
      <Avatar user={a} size="xs" className="absolute top-0 left-0 ring-2 ring-white dark:ring-gray-900" />
      <Avatar user={b || { name: '+' }} size="xs" className="absolute bottom-0 right-0 ring-2 ring-white dark:ring-gray-900" />
    </div>
  );
}

/**
 * Pick people to add to a group: anyone you follow or who follows you. Whether
 * they accept messages from you is checked by the server when you save.
 */
function PeoplePicker({ me, exclude = [], selected, onToggle }) {
  const [people, setPeople] = useState(null);
  const [q, setQ] = useState('');
  useEffect(() => {
    Promise.all([userAPI.getFollowing(me._id), userAPI.getFollowers(me._id)])
      .then(([a, b]) => {
        const byId = new Map([...a.data, ...b.data].map((u) => [u._id, u]));
        setPeople([...byId.values()].sort((x, y) => x.name.localeCompare(y.name)));
      })
      .catch(() => setPeople([]));
  }, [me._id]);

  const shown = (people || []).filter((u) => !exclude.includes(u._id) && u.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="space-y-2">
      <input className="input text-sm" placeholder="Search people you follow or who follow you…" value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="max-h-56 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800">
        {people === null && <li className="text-sm text-gray-400 py-3 text-center">Loading…</li>}
        {people && shown.length === 0 && <li className="text-sm text-gray-400 py-3 text-center">No one to add.</li>}
        {shown.map((u) => {
          const on = selected.includes(u._id);
          return (
            <li key={u._id}>
              <button type="button" onClick={() => onToggle(u._id)} className="w-full flex items-center gap-3 py-2 text-left">
                <Avatar user={u} />
                <span className="flex-1 text-sm text-gray-800 dark:text-gray-200 truncate">{u.name}</span>
                <span className={`w-5 h-5 rounded-full border flex items-center justify-center ${on ? 'bg-brand-600 border-brand-600 text-white' : 'border-gray-300 dark:border-gray-600'}`}>
                  {on && <Check size={12} />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function NewGroup({ me, onCancel, onCreated }) {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const create = async () => {
    setBusy(true);
    setError('');
    try {
      const { data } = await messageAPI.createGroup(name.trim(), selected);
      onCreated(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create the group');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={onCancel} className="p-1 -ml-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><ArrowLeft size={18} /></button>
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">New group</h3>
      </div>
      <input className="input" maxLength={60} placeholder="Group name" value={name} onChange={(e) => setName(e.target.value)} />
      <p className="text-xs text-gray-400 dark:text-gray-500">Add at least two people · {selected.length} selected</p>
      <PeoplePicker me={me} selected={selected} onToggle={toggle} />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button onClick={create} disabled={busy || !name.trim() || selected.length < 2} className="btn-primary w-full justify-center">
        {busy ? 'Creating…' : 'Create group'}
      </button>
    </div>
  );
}

/** Group header actions: rename, add people, leave. */
function GroupMenu({ convo, me, onChange, onLeft }) {
  const [mode, setMode] = useState(null); // 'rename' | 'add' | 'members'
  const [name, setName] = useState(convo.name);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (fn) => {
    setBusy(true);
    setError('');
    try { await fn(); setMode(null); setSelected([]); } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally { setBusy(false); }
  };
  const leave = () => {
    if (!window.confirm(`Leave "${convo.name}"? You won't get its messages any more.`)) return;
    run(async () => { await messageAPI.leaveGroup(convo._id); onLeft(); });
  };

  return (
    <div className="border-b border-gray-100 dark:border-gray-800 px-4 py-2 space-y-2">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setMode(mode === 'members' ? null : 'members')} className="btn-secondary text-xs py-1"><Users size={13} /> {convo.members.length + 1} members</button>
        <button onClick={() => { setName(convo.name); setMode(mode === 'rename' ? null : 'rename'); }} className="btn-secondary text-xs py-1"><Pencil size={13} /> Rename</button>
        <button onClick={() => setMode(mode === 'add' ? null : 'add')} className="btn-secondary text-xs py-1"><UserPlus size={13} /> Add people</button>
        <button onClick={leave} disabled={busy} className="btn-secondary text-xs py-1 !text-red-500"><LogOut size={13} /> Leave</button>
      </div>
      {mode === 'members' && (
        <ul className="space-y-1.5 max-h-48 overflow-y-auto">
          {[me, ...convo.members].map((u) => (
            <li key={u._id}>
              <Link to={`/profile/${u._id}`} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 hover:opacity-80">
                <Avatar user={u} size="xs" /> {u._id === me._id ? 'You' : u.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {mode === 'rename' && (
        <div className="flex gap-2">
          <input className="input text-sm flex-1" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <button disabled={busy || !name.trim()} className="btn-primary text-xs py-1.5 px-3"
            onClick={() => run(async () => onChange((await messageAPI.renameGroup(convo._id, name.trim())).data))}>Save</button>
        </div>
      )}
      {mode === 'add' && (
        <div className="space-y-2">
          <PeoplePicker me={me} exclude={convo.members.map((u) => u._id)} selected={selected}
            onToggle={(id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))} />
          <button disabled={busy || !selected.length} className="btn-primary text-xs py-1.5 px-3"
            onClick={() => run(async () => onChange((await messageAPI.addMembers(convo._id, selected)).data))}>
            Add {selected.length || ''}
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

function Chat({ convo: initialConvo, me, onBack, onActivity }) {
  const [convo, setConvo] = useState(initialConvo);
  const [messages, setMessages] = useState([]);
  const [people, setPeople] = useState({}); // id → { name, avatar } of everyone who sent a message
  const [hasMore, setHasMore] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [workouts, setWorkouts] = useState(null); // shown when attaching a workout
  const [showMenu, setShowMenu] = useState(false);
  const bottomRef = useRef();
  const lastCount = useRef(0);
  const firstLoad = useRef(true);

  const load = useCallback(async () => {
    try {
      const { data } = await messageAPI.messages(convo._id);
      setMessages((prev) => {
        // Keep older pages that were loaded with "Load earlier".
        const ids = new Set(data.messages.map((m) => m._id));
        const older = prev.filter((m) => !ids.has(m._id) && new Date(m.createdAt) < new Date(data.messages[0]?.createdAt || 0));
        return [...older, ...data.messages];
      });
      setPeople((p) => ({ ...p, ...data.people }));
      if (firstLoad.current) { setHasMore(data.hasMore); firstLoad.current = false; }
      if (data.unread > 0) {
        await messageAPI.markRead(convo._id);
        onActivity();
      }
    } catch {
      setError('Could not load messages');
    }
  }, [convo._id, onActivity]);

  useEffect(() => {
    setMessages([]);
    firstLoad.current = true;
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (messages.length !== lastCount.current) bottomRef.current?.scrollIntoView({ block: 'end' });
    lastCount.current = messages.length;
  }, [messages.length]);

  const loadEarlier = async () => {
    const { data } = await messageAPI.messages(convo._id, { before: messages[0]?.createdAt });
    setMessages((prev) => [...data.messages, ...prev]);
    setPeople((p) => ({ ...p, ...data.people }));
    setHasMore(data.hasMore);
  };

  const send = async (body) => {
    setSending(true);
    setError('');
    try {
      const { data } = await messageAPI.send(convo._id, body);
      setMessages((prev) => [...prev, data]);
      setText('');
      setWorkouts(null);
      onActivity();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send');
    } finally {
      setSending(false);
    }
  };

  // The attach panel: recent workouts and your plans (a plan is sent whole).
  const openWorkouts = async () => {
    if (workouts) { setWorkouts(null); return; }
    const [w, p] = await Promise.all([
      workoutAPI.getAll({ limit: 10 }).catch(() => ({ data: {} })),
      planAPI.getAll().catch(() => ({ data: [] })),
    ]);
    setWorkouts({ workouts: w.data.workouts || [], plans: p.data || [] });
  };

  // A group change (rename, new people) adds a note to the chat: reload it.
  const groupChanged = (updated) => { setConvo(updated); load(); onActivity(); };
  const memberCount = useMemo(() => (convo.members?.length || 0) + 1, [convo.members]);

  return (
    <div className="card !p-0 flex flex-col h-[70vh]">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <button onClick={onBack} className="p-1 -ml-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><ArrowLeft size={18} /></button>
        {convo.isGroup ? (
          <button onClick={() => setShowMenu(!showMenu)} className="flex items-center gap-2 hover:opacity-80 min-w-0 text-left">
            <ChatAvatar convo={convo} size="sm" />
            <div className="min-w-0">
              <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{chatTitle(convo)}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{memberCount} members · tap for options</p>
            </div>
          </button>
        ) : (
          <Link to={`/profile/${convo.other?._id}`} className="flex items-center gap-2 hover:opacity-80 min-w-0">
            <Avatar user={convo.other} />
            <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{chatTitle(convo)}</p>
          </Link>
        )}
      </div>
      {convo.isGroup && showMenu && <GroupMenu convo={convo} me={me} onChange={groupChanged} onLeft={onBack} />}

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {hasMore && <button onClick={loadEarlier} className="text-xs text-brand-600 block mx-auto mb-2">Load earlier messages</button>}
        {messages.length === 0 && (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-10 flex items-center justify-center gap-1.5"><Hand size={15} /> Say hi</p>
        )}
        {messages.map((m, i) => {
          if (m.system) {
            return <p key={m._id} className="text-center text-[11px] text-gray-400 dark:text-gray-500 py-1">{m.text}</p>;
          }
          const mine = String(m.sender) === String(me._id);
          const sender = people[String(m.sender)];
          // In groups, name the sender above the first of their messages in a row.
          const showName = convo.isGroup && !mine && (i === 0 || messages[i - 1].system || String(messages[i - 1].sender) !== String(m.sender));
          const seenBy = (m.readBy || []).filter((id) => String(id) !== String(me._id)).length;
          return (
            <div key={m._id} className={`flex gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>
              {convo.isGroup && !mine && (
                <div className="w-6 shrink-0 self-end mb-4">{showName && <Avatar user={sender || { name: '?' }} size="xs" />}</div>
              )}
              <div className={`max-w-[80%] space-y-1.5 ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                {showName && <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 px-1">{sender?.name ?? 'Former member'}</p>}
                {m.workoutSession && <div className="w-64"><WorkoutSummary workout={m.workoutSession} source={{ messageId: m._id }} /></div>}
                {m.workoutPlan && <div className="w-64"><PlanSummary plan={m.workoutPlan} source={{ messageId: m._id }} /></div>}
                {m.text && (
                  <p className={`px-3 py-2 rounded-2xl text-sm whitespace-pre-line break-words ${mine
                    ? 'bg-brand-600 text-white rounded-br-md' : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-md'}`}>
                    {m.text}
                  </p>
                )}
                <p className="text-[10px] text-gray-400 dark:text-gray-500 px-1">
                  {format(new Date(m.createdAt), isToday(new Date(m.createdAt)) ? 'HH:mm' : 'MMM d, HH:mm')}
                  {mine && !convo.isGroup && m.readAt ? ' · Seen' : ''}
                  {mine && convo.isGroup && seenBy > 0 ? ` · Seen by ${seenBy}` : ''}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {workouts && (
        <div className="border-t border-gray-100 dark:border-gray-800 max-h-48 overflow-y-auto px-3 py-2 space-y-1">
          <p className="text-xs text-gray-400 dark:text-gray-500">Share a workout</p>
          {workouts.workouts.length === 0 && <p className="text-xs text-gray-400">No workouts logged yet.</p>}
          {workouts.workouts.map((w) => (
            <button key={w._id} onClick={() => send({ workoutSession: w._id, text: text.trim() || undefined })} disabled={sending}
              className="w-full text-left text-sm px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200">
              {w.name} <span className="text-xs text-gray-400">· {format(new Date(w.date), 'MMM d')}</span>
            </button>
          ))}
          {workouts.plans.length > 0 && <p className="text-xs text-gray-400 dark:text-gray-500 pt-1">Share a plan (all its days)</p>}
          {workouts.plans.map((p) => (
            <button key={p._id} onClick={() => send({ workoutPlan: p._id, text: text.trim() || undefined })} disabled={sending}
              className="w-full text-left text-sm px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200">
              {p.name} <span className="text-xs text-gray-400">· {p.days.length} workout{p.days.length !== 1 ? 's' : ''}</span>
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-xs text-red-500 px-4">{error}</p>}
      <div className="flex items-end gap-2 p-3 border-t border-gray-100 dark:border-gray-800">
        <button onClick={openWorkouts} title="Share a workout or plan"
          className={`p-2 rounded-lg ${workouts ? 'text-brand-600 bg-brand-50 dark:bg-brand-900/30' : 'text-gray-400 hover:text-brand-600'}`}>
          <Dumbbell size={18} />
        </button>
        <textarea className="input resize-none flex-1 text-sm" rows={1} maxLength={2000} placeholder="Message…" value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (text.trim()) send({ text: text.trim() }); } }} />
        <button onClick={() => text.trim() && send({ text: text.trim() })} disabled={sending || !text.trim()} className="btn-primary py-2 px-3">
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}

/** Inbox and chats. `openWith` (a user) opens or starts a chat with them. */
export default function Messages({ me, openWith, onUnreadChange }) {
  const [conversations, setConversations] = useState(null);
  const [active, setActive] = useState(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const { data } = await messageAPI.conversations();
      setConversations(data);
      onUnreadChange?.(data.reduce((n, c) => n + c.unread, 0));
    } catch {
      setConversations([]);
    }
  }, [onUnreadChange]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15000);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    if (!openWith) return;
    setError('');
    messageAPI.open(openWith._id)
      .then(({ data }) => setActive(data))
      .catch((err) => setError(err.response?.data?.message || 'Could not open the chat'));
  }, [openWith]);

  if (active) {
    return <Chat key={active._id} convo={active} me={me} onBack={() => { setActive(null); refresh(); }} onActivity={refresh} />;
  }
  if (creating) {
    return <NewGroup me={me} onCancel={() => setCreating(false)} onCreated={(c) => { setCreating(false); setActive(c); refresh(); }} />;
  }

  // "You: hi" for your own last message; "Sam: hi" in groups.
  const preview = (c) => {
    const lm = c.lastMessage || {};
    const who = String(lm.sender) === String(me._id) ? 'You: ' : c.isGroup && lm.senderName ? `${lm.senderName.split(' ')[0]}: ` : '';
    return `${who}${lm.text ?? ''}`;
  };

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex justify-end">
        <button onClick={() => setCreating(true)} className="btn-secondary text-sm py-1.5"><Users size={15} /> New group</button>
      </div>
      <div className="card !py-2">
        {conversations === null ? (
          <p className="text-sm text-gray-400 py-6 text-center">Loading…</p>
        ) : conversations.length === 0 ? (
          <div className="text-center py-8">
            <p className="font-medium text-gray-600 dark:text-gray-400">No messages yet</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Message someone you follow from the People tab or their profile, or start a group.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {conversations.map((c) => (
              <li key={c._id}>
                <button onClick={() => setActive(c)} className="w-full flex items-center gap-3 py-3 text-left hover:opacity-90">
                  <ChatAvatar convo={c} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className={`text-sm truncate ${c.unread ? 'font-semibold text-gray-900 dark:text-gray-100' : 'font-medium text-gray-800 dark:text-gray-200'}`}>{chatTitle(c)}</p>
                      {c.lastMessage?.sentAt && <span className="text-[11px] text-gray-400 shrink-0">{formatDistanceToNowStrict(new Date(c.lastMessage.sentAt))}</span>}
                    </div>
                    <p className={`text-xs truncate ${c.unread ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'}`}>{preview(c)}</p>
                  </div>
                  {c.unread > 0 && <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-brand-600 text-white text-[11px] font-semibold flex items-center justify-center">{c.unread}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
