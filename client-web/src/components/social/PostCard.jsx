import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Heart, MessageCircle, Trash2, Send, UserPlus, Check, Pencil, CornerDownRight } from 'lucide-react';
import Avatar from '../Avatar';
import WorkoutSummary from './WorkoutSummary';
import PlanSummary from './PlanSummary';

const idOf = (x) => String(x?._id ?? x);
const ago = (date) => formatDistanceToNow(new Date(date), { addSuffix: true });

/** Text box with Save / Cancel, for editing a post or comment, or writing a reply. */
function InlineEditor({ initial = '', placeholder, onSave, onCancel, rows = 1, saveLabel = 'Save' }) {
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    try { await onSave(text.trim()); } finally { setBusy(false); }
  };
  return (
    <div className="flex gap-2 items-start">
      <textarea autoFocus rows={rows} maxLength={500} placeholder={placeholder} value={text}
        className="input text-sm flex-1 resize-none" onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && rows === 1) { e.preventDefault(); submit(); } if (e.key === 'Escape') onCancel(); }} />
      <div className="flex flex-col gap-1">
        <button onClick={submit} disabled={busy || !text.trim()} className="btn-primary py-1.5 px-3 text-xs">{busy ? '…' : saveLabel}</button>
        <button onClick={onCancel} className="btn-secondary py-1.5 px-3 text-xs">Cancel</button>
      </div>
    </div>
  );
}

function Comment({ comment, me, postOwner, onReply, onEdit, onDelete, isReply }) {
  const [editing, setEditing] = useState(false);
  const mine = idOf(comment.user) === idOf(me);
  return (
    <div className="flex items-start gap-2">
      <Avatar user={comment.user} size="xs" className="mt-1" />
      <div className="flex-1 min-w-0">
        {editing ? (
          <InlineEditor initial={comment.text} onCancel={() => setEditing(false)}
            onSave={async (text) => { await onEdit(comment._id, text); setEditing(false); }} />
        ) : (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2">
            <Link to={`/profile/${idOf(comment.user)}`} className="text-xs font-medium text-gray-700 dark:text-gray-300 hover:underline">{comment.user?.name}</Link>
            <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line break-words">{comment.text}</p>
          </div>
        )}
        {!editing && (
          <div className="flex items-center gap-3 mt-0.5 px-1 text-[11px] text-gray-400 dark:text-gray-500">
            <span>{ago(comment.createdAt)}{comment.editedAt ? ' · edited' : ''}</span>
            {!isReply && <button onClick={() => onReply(comment)} className="font-medium hover:text-brand-600">Reply</button>}
            {mine && <button onClick={() => setEditing(true)} className="font-medium hover:text-brand-600">Edit</button>}
            {(mine || postOwner) && <button onClick={() => onDelete(comment._id)} className="font-medium hover:text-red-500">Delete</button>}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * A post with likes, threaded comments (one level of replies) and editing of
 * your own post and comments. Handlers come from usePostActions.
 */
export default function PostCard({ post, me, following, requested, onFollow, onLike, onUnlike, onDelete, onEdit, onComment, onEditComment, onDeleteComment }) {
  const liked = post.likes?.some((l) => idOf(l) === idOf(me));
  const mine = idOf(post.user) === idOf(me);
  const isFollowing = following?.has(idOf(post.user));
  const [commentText, setCommentText] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [replyTo, setReplyTo] = useState(null); // top-level comment being replied to

  const comments = post.comments || [];
  const threads = comments.filter((c) => !c.parent);
  const repliesOf = (c) => comments.filter((r) => String(r.parent) === String(c._id));

  const handleComment = async () => {
    if (!commentText.trim()) return;
    setSubmitting(true);
    try {
      await onComment(post._id, commentText.trim());
      setCommentText('');
      setShowComments(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Link to={`/profile/${idOf(post.user)}`} className="flex items-center gap-2 hover:opacity-80 min-w-0">
          <Avatar user={post.user} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{post.user?.name}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">{ago(post.createdAt)}{post.editedAt ? ' · edited' : ''}</p>
          </div>
        </Link>
        {mine ? (
          <div className="flex items-center gap-1 shrink-0">
            {onEdit && (
              <button onClick={() => setEditing(true)} title="Edit post" className="p-1.5 text-gray-300 dark:text-gray-600 hover:text-brand-600 transition-colors">
                <Pencil size={14} />
              </button>
            )}
            <button onClick={() => onDelete(post._id)} title="Delete post" className="p-1.5 text-gray-300 dark:text-gray-600 hover:text-red-400 transition-colors">
              <Trash2 size={14} />
            </button>
          </div>
        ) : !onFollow || isFollowing ? (
          onFollow ? <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 shrink-0"><Check size={12} /> Following</span> : null
        ) : requested?.has(idOf(post.user)) ? (
          <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">Requested</span>
        ) : (
          <button onClick={() => onFollow(idOf(post.user))} className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 shrink-0">
            <UserPlus size={13} /> Follow
          </button>
        )}
      </div>

      {editing ? (
        <InlineEditor initial={post.caption} rows={3} placeholder="Write something…" onCancel={() => setEditing(false)}
          onSave={async (caption) => { await onEdit(post._id, caption); setEditing(false); }} />
      ) : post.caption && <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-line">{post.caption}</p>}
      {post.workoutSession && <WorkoutSummary workout={post.workoutSession} source={{ postId: post._id }} />}
      {post.workoutPlan && <PlanSummary plan={post.workoutPlan} source={{ postId: post._id }} />}
      {post.image && <img src={post.image} alt="" className="w-full rounded-xl object-cover max-h-96" />}

      <div className="flex items-center gap-4 pt-1 border-t border-gray-50 dark:border-gray-800">
        <button
          onClick={() => (liked ? onUnlike(post._id) : onLike(post._id))}
          className={`flex items-center gap-1.5 text-sm transition-colors ${liked ? 'text-red-500' : 'text-gray-400 hover:text-red-400'}`}
        >
          <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
          <span>{post.likes?.length ?? 0}</span>
        </button>
        <button onClick={() => setShowComments(!showComments)} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-brand-500 transition-colors">
          <MessageCircle size={16} />
          <span>{comments.length}</span>
        </button>
      </div>

      {showComments && (
        <div className="space-y-3 pt-1">
          {threads.map((c) => (
            <div key={c._id} className="space-y-2">
              <Comment comment={c} me={me} postOwner={mine} onReply={setReplyTo}
                onEdit={(cid, text) => onEditComment(post._id, cid, text)} onDelete={(cid) => onDeleteComment(post._id, cid)} />
              {(repliesOf(c).length > 0 || replyTo?._id === c._id) && (
                <div className="pl-8 space-y-2">
                  {repliesOf(c).map((r) => (
                    <Comment key={r._id} comment={r} me={me} postOwner={mine} isReply
                      onEdit={(cid, text) => onEditComment(post._id, cid, text)} onDelete={(cid) => onDeleteComment(post._id, cid)} />
                  ))}
                  {replyTo?._id === c._id && (
                    <div className="flex items-start gap-2">
                      <CornerDownRight size={14} className="text-gray-300 mt-2.5 shrink-0" />
                      <div className="flex-1">
                        <InlineEditor placeholder={`Reply to ${c.user?.name ?? 'comment'}…`} saveLabel="Reply" onCancel={() => setReplyTo(null)}
                          onSave={async (text) => { await onComment(post._id, text, c._id); setReplyTo(null); }} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          <div className="flex gap-2">
            <input className="input text-sm flex-1" placeholder="Add a comment…" maxLength={500} value={commentText}
              onChange={(e) => setCommentText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleComment()} />
            <button onClick={handleComment} disabled={submitting || !commentText.trim()} className="btn-primary py-2 px-3">
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
