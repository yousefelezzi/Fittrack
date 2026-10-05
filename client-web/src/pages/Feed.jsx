import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Newspaper, Users, MessageSquare, Plus } from 'lucide-react';
import { postAPI, userAPI, messageAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import PostCard from '../components/social/PostCard';
import Composer from '../components/social/Composer';
import People from '../components/social/People';
import Messages from '../components/social/Messages';
import { usePostActions } from '../components/social/usePostActions';

const idOf = (x) => String(x?._id ?? x);

/**
 * Community: posts (from people you follow, or everyone), finding people to
 * follow, and direct messages. The tab lives in the URL (?tab=people|messages),
 * ?with=<userId> opens a chat, and ?share=<workoutId> starts a post with that workout.
 */
export default function Feed() {
  const { user, updateUser } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = ['people', 'messages'].includes(params.get('tab')) ? params.get('tab') : 'posts';
  const shareId = params.get('share');
  const withId = params.get('with');

  const [scope, setScope] = useState('following'); // following | discover
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [composing, setComposing] = useState(!!shareId);
  const [unread, setUnread] = useState(0);
  const [openWith, setOpenWith] = useState(null);
  const [requested, setRequested] = useState(() => new Set()); // private accounts asked to follow this visit

  const following = useMemo(() => new Set((user?.following || []).map(idOf)), [user?.following]);
  const followers = useMemo(() => new Set((user?.followers || []).map(idOf)), [user?.followers]);

  const setTab = (t, extra = {}) => setParams({ ...(t === 'posts' ? {} : { tab: t }), ...extra }, { replace: true });

  const fetchPosts = useCallback(async (pg = 1, replace = false) => {
    setLoading(replace);
    try {
      const { data } = await postAPI.getFeed({ page: pg, limit: 10, scope });
      setPosts((prev) => (replace ? data.posts : [...prev, ...data.posts]));
      setHasMore(pg < data.pages);
      setPage(pg);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => { if (tab === 'posts') fetchPosts(1, true); }, [tab, fetchPosts]);

  // Unread messages for the tab badge (the Messages tab keeps it current while open).
  useEffect(() => {
    const check = () => messageAPI.unread().then(({ data }) => setUnread(data.count)).catch(() => {});
    check();
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, []);

  // ?with=<userId>: open that chat (from a profile's Message button).
  useEffect(() => {
    if (tab === 'messages' && withId) userAPI.getById(withId).then(({ data }) => setOpenWith(data)).catch(() => {});
  }, [tab, withId]);

  // A private account gets a follow request instead of a follow.
  const follow = async (id) => {
    const { data } = await userAPI.follow(id);
    if (data.requested) setRequested((r) => new Set(r).add(String(id)));
    else updateUser({ following: [...(user.following || []), id] });
  };
  // Also cancels a pending request.
  const unfollow = async (id) => {
    await userAPI.unfollow(id);
    setRequested((r) => { const next = new Set(r); next.delete(String(id)); return next; });
    updateUser({ following: (user.following || []).filter((f) => idOf(f) !== String(id)) });
  };
  const message = (person) => { setOpenWith(person); setTab('messages'); };

  const postActions = usePostActions(setPosts, user);

  // People asking to follow you, shown at the top of People.
  const [followRequests, setFollowRequests] = useState([]);
  useEffect(() => { userAPI.followRequests().then(({ data }) => setFollowRequests(data)).catch(() => {}); }, [tab]);
  const answerRequest = async (id, accept) => {
    if (accept) await userAPI.acceptRequest(id); else await userAPI.declineRequest(id);
    setFollowRequests((list) => list.filter((u) => u._id !== id));
    if (accept) updateUser({ followers: [...(user.followers || []), id] });
  };

  const TABS = [
    { key: 'posts', label: 'Posts', icon: Newspaper },
    { key: 'people', label: 'People', icon: Users, badge: followRequests.length },
    { key: 'messages', label: 'Messages', icon: MessageSquare, badge: unread },
  ];

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Community</h1>
        {tab === 'posts' && !composing && (
          <button onClick={() => setComposing(true)} className="btn-primary"><Plus size={16} /> Post</button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
        {TABS.map(({ key, label, icon: Icon, badge }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`relative flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-lg transition-colors ${tab === key
              ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
            <Icon size={15} /> {label}
            {badge > 0 && <span className="ml-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-600 text-white text-[10px] font-semibold flex items-center justify-center">{badge}</span>}
          </button>
        ))}
      </div>

      {tab === 'posts' && (
        <>
          {composing && (
            <Composer me={user} initialWorkoutId={shareId}
              onPosted={(post) => { setComposing(false); setPosts((prev) => [post, ...prev]); if (shareId) setTab('posts'); }}
              onCancel={() => { setComposing(false); if (shareId) setTab('posts'); }} />
          )}

          <div className="flex gap-2">
            {[['following', 'Following'], ['discover', 'Discover']].map(([k, label]) => (
              <button key={k} onClick={() => setScope(k)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${scope === k
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600'}`}>
                {label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : posts.length === 0 ? (
            <div className="card text-center py-12">
              <Users size={36} strokeWidth={1.5} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
              <p className="font-medium text-gray-600 dark:text-gray-400">{scope === 'following' ? 'Nothing from people you follow yet' : 'No posts yet'}</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                {scope === 'following'
                  ? <>Check <button onClick={() => setScope('discover')} className="text-brand-600">Discover</button> or find people in the <button onClick={() => setTab('people')} className="text-brand-600">People</button> tab.</>
                  : 'Share the first one!'}
              </p>
            </div>
          ) : (
            <>
              {posts.map((post) => (
                <PostCard key={post._id} post={post} me={user} following={following} requested={requested} onFollow={follow}
                  {...postActions} />
              ))}
              {hasMore && <button onClick={() => fetchPosts(page + 1)} className="btn-secondary w-full justify-center">Load more</button>}
            </>
          )}
        </>
      )}

      {tab === 'people' && (
        <People me={user} following={following} followers={followers} requested={requested} followRequests={followRequests} onAnswerRequest={answerRequest} onFollow={follow} onUnfollow={unfollow} onMessage={message} />
      )}

      {tab === 'messages' && <Messages me={user} openWith={openWith} onUnreadChange={setUnread} />}
    </div>
  );
}
