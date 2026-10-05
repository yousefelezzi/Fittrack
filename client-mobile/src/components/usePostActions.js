import { postAPI } from '../api';
import { confirm } from './ui';

const idOf = (x) => String(x?._id ?? x);

/**
 * Like, comment (and reply), edit and delete handlers for a list of posts kept
 * in `setPosts`. Used by the Community feed and the profile so both behave the
 * same (same as the web's usePostActions).
 */
export function usePostActions(setPosts, me) {
  const update = (id, fn) => setPosts((prev) => prev.map((p) => (p._id === id ? fn(p) : p)));
  return {
    onLike: async (id) => { await postAPI.like(id); update(id, (p) => ({ ...p, likes: [...(p.likes || []), me._id] })); },
    onUnlike: async (id) => { await postAPI.unlike(id); update(id, (p) => ({ ...p, likes: (p.likes || []).filter((l) => idOf(l) !== idOf(me._id)) })); },
    onDelete: async (id) => {
      if (!(await confirm('Delete this post?', '', 'Delete', true))) return;
      await postAPI.delete(id);
      setPosts((prev) => prev.filter((p) => p._id !== id));
    },
    onEdit: async (id, caption) => { const { data } = await postAPI.edit(id, caption); update(id, () => data); },
    // The server sends the post's comments back after each change.
    onComment: async (id, text, parentId) => { const { data: comments } = await postAPI.addComment(id, text, parentId); update(id, (p) => ({ ...p, comments })); },
    onEditComment: async (id, commentId, text) => { const { data: comments } = await postAPI.editComment(id, commentId, text); update(id, (p) => ({ ...p, comments })); },
    onDeleteComment: async (id, commentId) => {
      await postAPI.deleteComment(id, commentId);
      // A comment's replies go with it.
      update(id, (p) => ({ ...p, comments: p.comments.filter((c) => c._id !== commentId && String(c.parent) !== String(commentId)) }));
    },
  };
}
