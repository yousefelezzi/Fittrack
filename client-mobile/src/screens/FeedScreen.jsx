import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, FlatList, RefreshControl } from 'react-native';
import { postAPI, userAPI, messageAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { Spinner, Button, colors, Segmented, Chip, ChipRow, EmptyState } from '../components';
import { PostCard, Composer, People, Messages } from '../components/social';
import { usePostActions } from '../components/usePostActions';
import { Users } from 'lucide-react-native';

const idOf = (x) => String(x?._id ?? x);

/**
 * Community: posts (from people you follow, or everyone), finding people to
 * follow, and direct messages. Params: shareWorkout (a workout to post, from
 * History) and messageUser (a user to open a chat with, from a profile).
 */
export default function FeedScreen({ navigation, route }) {
  const { user, updateUser } = useAuth();
  const [tab, setTab] = useState('posts');
  const [scope, setScope] = useState('following');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [composing, setComposing] = useState(false);
  const [shareWorkout, setShareWorkout] = useState(null);
  const [unread, setUnread] = useState(0);
  const [openWith, setOpenWith] = useState(null);
  const [requested, setRequested] = useState(() => new Set()); // private accounts asked to follow this visit
  const [followRequests, setFollowRequests] = useState([]); // people asking to follow you

  const following = useMemo(() => new Set((user?.following || []).map(idOf)), [user?.following]);
  const followers = useMemo(() => new Set((user?.followers || []).map(idOf)), [user?.followers]);

  const fetchPosts = useCallback(async (pg = 1, replace = false) => {
    try {
      const { data } = await postAPI.getFeed({ page: pg, limit: 10, scope });
      setPosts((prev) => (replace ? data.posts : [...prev, ...data.posts.filter((p) => !prev.some((x) => x._id === p._id))]));
      setHasMore(pg < data.pages);
      setPage(pg);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [scope]);

  useEffect(() => { if (tab === 'posts') { setLoading(true); fetchPosts(1, true); } }, [tab, fetchPosts]);

  // People asking to follow you (private accounts), shown at the top of People.
  const loadRequests = useCallback(() => userAPI.followRequests().then(({ data }) => setFollowRequests(data)).catch(() => {}), []);
  useEffect(() => { loadRequests(); }, [loadRequests, tab]);
  const answerRequest = async (id, accept) => {
    if (accept) await userAPI.acceptRequest(id); else await userAPI.declineRequest(id);
    setFollowRequests((list) => list.filter((u) => u._id !== id));
    if (accept) updateUser({ followers: [...(user.followers || []), id] });
  };

  useEffect(() => {
    const check = () => messageAPI.unread().then(({ data }) => setUnread(data.count)).catch(() => {});
    check();
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, []);

  // Arriving with a workout to share or a person to message.
  useEffect(() => {
    const p = route?.params || {};
    if (p.shareWorkout) { setTab('posts'); setShareWorkout(p.shareWorkout); setComposing(true); navigation.setParams({ shareWorkout: undefined }); }
    if (p.messageUser) { setTab('messages'); setOpenWith(p.messageUser); navigation.setParams({ messageUser: undefined }); }
  }, [route?.params?.shareWorkout, route?.params?.messageUser]);

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
  const openProfile = (id) => navigation.navigate('UserProfile', { userId: id });

  const handlers = usePostActions(setPosts, user);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: 16, paddingBottom: 8 }}>
        <Segmented value={tab} onChange={setTab}
          options={[['posts', 'Posts'], ['people', followRequests.length ? `People (${followRequests.length})` : 'People'], ['messages', unread > 0 ? `Messages (${unread})` : 'Messages']]} />
      </View>

      {tab === 'posts' && (
        <FlatList
          data={loading ? [] : posts}
          keyExtractor={(p) => p._id}
          contentContainerStyle={{ padding: 16, paddingTop: 4 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPosts(1, true); }} tintColor={colors.brand} />}
          onEndReached={() => hasMore && fetchPosts(page + 1)}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={(
            <View style={{ marginBottom: 10 }}>
              {composing ? (
                <Composer me={user} initialWorkout={shareWorkout}
                  onPosted={(post) => { setComposing(false); setShareWorkout(null); setPosts((prev) => [post, ...prev]); }}
                  onCancel={() => { setComposing(false); setShareWorkout(null); }} />
              ) : <Button title="+ New post" onPress={() => setComposing(true)} style={{ marginBottom: 10 }} />}
              <ChipRow>
                <Chip label="Following" active={scope === 'following'} onPress={() => setScope('following')} />
                <Chip label="Discover" active={scope === 'discover'} onPress={() => setScope('discover')} />
              </ChipRow>
            </View>
          )}
          renderItem={({ item }) => <PostCard post={item} me={user} following={following} requested={requested} onFollow={follow} onOpenProfile={openProfile} {...handlers} />}
          ListEmptyComponent={loading ? <Spinner /> : (
            <EmptyState icon={Users}
              title={scope === 'following' ? 'Nothing from people you follow yet' : 'No posts yet'}
              subtitle={scope === 'following' ? 'Check Discover, or find people in the People tab.' : 'Share the first one!'} />
          )}
        />
      )}

      {tab === 'people' && (
        <People me={user} following={following} followers={followers} requested={requested} followRequests={followRequests} onAnswerRequest={answerRequest} onFollow={follow} onUnfollow={unfollow} onMessage={message} onOpenProfile={openProfile} />
      )}

      {tab === 'messages' && <Messages me={user} openWith={openWith} onUnreadChange={setUnread} onOpenProfile={openProfile} />}
    </View>
  );
}
