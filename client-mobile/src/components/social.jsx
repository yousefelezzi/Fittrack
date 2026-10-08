/**
 * Community pieces for the mobile Feed screen: workout summaries, post cards,
 * the post composer, the people finder and direct messages.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image, FlatList, ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { format, isToday, formatDistanceToNow, formatDistanceToNowStrict } from 'date-fns';
import { messageAPI, workoutAPI, userAPI, postAPI, planAPI, exerciseAPI, foodAPI, uploadUrl } from '../api';
import { exerciseSummary, foodServing, isRecipe } from '../../../client-web/src/utils/sharedItems';
import { summarizeWorkout } from '../../../client-web/src/utils/workoutSummary';
import { colors, makeStyles, cardSurface } from './tokens';
import { Hint, ErrorText, LinkText, Chip, ChipRow, confirm } from './ui';
import ExerciseImage from './ExerciseImage';
import {
  Heart, MessageCircle, Pencil, Trash2, Send, Dumbbell, Check, ChevronLeft, Users, UserPlus, LogOut, Image as ImageIcon,
  BookmarkPlus,
  ClipboardList,
  Utensils,
} from 'lucide-react-native';
import { typeOf } from '../../../client-web/src/utils/exerciseTypes';

const idOf = (x) => String(x?._id ?? x);

function Avatar({ user, size = 36 }) {
  if (user?.avatar) return <Image source={{ uri: uploadUrl(user.avatar) }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.brandLight, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.brand, fontWeight: '700', fontSize: size * 0.38 }}>{user?.name?.charAt(0)?.toUpperCase() ?? '?'}</Text>
    </View>
  );
}

function SmallBtn({ title, onPress, primary, disabled }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} style={[styles.smallBtn, primary && styles.smallBtnPrimary, disabled && { opacity: 0.4 }]}>
      <Text style={[styles.smallBtnText, primary && { color: '#fff' }]}>{title}</Text>
    </TouchableOpacity>
  );
}

/** A shared workout: name, date, duration, sets and volume; tap to see each exercise. */
/**
 * "Save as template": copies the workout into your plans. `source` says where
 * you saw it ({ postId } or { messageId }) so the server can check you may.
 */
function SaveAsTemplate({ workout, source }) {
  const [state, setState] = useState('idle'); // idle | saving | saved | error
  const [error, setError] = useState('');
  const save = async () => {
    setState('saving');
    try {
      await planAPI.fromWorkout({ workoutId: workout._id, ...source });
      setState('saved');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save it');
      setState('error');
    }
  };
  return (
    <View style={styles.workoutRow}>
      {state === 'saved' ? (
        <><Check size={14} color={colors.success} /><Text style={[styles.small, { color: colors.success }]}>Saved to your templates (Train → Plans)</Text></>
      ) : (
        <TouchableOpacity onPress={save} disabled={state === 'saving'} style={styles.row} hitSlop={6}>
          <BookmarkPlus size={15} color={colors.brand} />
          <Text style={styles.linkText}>{state === 'saving' ? 'Saving…' : 'Save as template'}</Text>
        </TouchableOpacity>
      )}
      {state === 'error' ? <Text style={[styles.small, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

/** Save button with saving / saved / error states, for shared exercises and foods. */
function SaveLine({ label, savedLabel, onSave, color }) {
  const [state, setState] = useState('idle');
  const [error, setError] = useState('');
  const save = async () => {
    setState('saving');
    try { await onSave(); setState('saved'); } catch (err) { setError(err.response?.data?.message || 'Could not save it'); setState('error'); }
  };
  return (
    <View style={styles.workoutRow}>
      {state === 'saved' ? (
        <><Check size={14} color={colors.success} /><Text style={[styles.small, { color: colors.success }]}>{savedLabel}</Text></>
      ) : (
        <TouchableOpacity onPress={save} disabled={state === 'saving'} style={styles.row} hitSlop={6}>
          <BookmarkPlus size={15} color={color} /><Text style={[styles.linkText, { color }]}>{state === 'saving' ? 'Saving…' : label}</Text>
        </TouchableOpacity>
      )}
      {state === 'error' ? <Text style={[styles.small, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

/** Someone's custom exercise in a post or message; with `source` it can be saved to your exercises. */
export function SharedExercise({ exercise, source, me }) {
  const [open, setOpen] = useState(false);
  if (!exercise) return null;
  const mine = String(exercise.createdBy) === String(me?._id);
  return (
    <View style={[styles.workout, { borderColor: '#a7f3d0' }]}>
      <TouchableOpacity style={styles.workoutHead} onPress={() => setOpen(!open)}>
        {exercise.images?.length ? <ExerciseImage images={exercise.images} style={{ width: 44, height: 34 }} />
          : <View style={[styles.workoutIcon, { backgroundColor: '#d1fae5' }]}><Dumbbell size={18} color="#059669" /></View>}
        <View style={{ flex: 1 }}>
          <Text style={styles.bold} numberOfLines={1}>{exercise.name}</Text>
          <Text style={[styles.muted, { textTransform: 'capitalize' }]} numberOfLines={2}>Exercise · {exerciseSummary(exercise)}</Text>
        </View>
        {exercise.instructions?.length ? <Text style={styles.muted}>{open ? '▴' : '▾'}</Text> : null}
      </TouchableOpacity>
      {open && (exercise.instructions || []).map((step, i) => (
        <Text key={i} style={[styles.small, { paddingHorizontal: 12, paddingBottom: 4 }]}>{i + 1}. {step}</Text>
      ))}
      {source && !mine ? <SaveLine label="Save to my exercises" savedLabel="Saved to your exercises" color="#059669"
        onSave={() => exerciseAPI.fromShared({ exerciseId: exercise._id, ...source })} /> : null}
    </View>
  );
}

/** A custom food or recipe in a post or message; with `source` it can be saved to your foods. */
export function SharedFood({ food, source, me }) {
  const [open, setOpen] = useState(false);
  if (!food) return null;
  const sv = foodServing(food);
  const recipe = isRecipe(food);
  const mine = String(food.createdBy) === String(me?._id);
  return (
    <View style={[styles.workout, { borderColor: '#fed7aa' }]}>
      <TouchableOpacity style={styles.workoutHead} onPress={() => setOpen(!open)}>
        <View style={[styles.workoutIcon, { backgroundColor: '#ffedd5' }]}><Utensils size={18} color="#ea580c" /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.bold} numberOfLines={1}>{food.name}</Text>
          <Text style={styles.muted} numberOfLines={2}>{recipe ? `Recipe · ${food.ingredients.length} ingredients` : 'Food'} · {sv.label}: {sv.kcal} kcal · P {sv.p}g · C {sv.c}g · F {sv.f}g</Text>
        </View>
        {recipe ? <Text style={styles.muted}>{open ? '▴' : '▾'}</Text> : null}
      </TouchableOpacity>
      {open && recipe && food.ingredients.map((ing, i) => (
        <View key={i} style={[styles.row, { justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 3 }]}>
          <Text style={[styles.small, { flex: 1 }]} numberOfLines={1}>{ing.name}</Text>
          <Text style={styles.muted}>{Math.round(ing.grams)} g</Text>
        </View>
      ))}
      {source && !mine ? <SaveLine label="Save to my foods" savedLabel="Saved: it's under Your foods when you log food" color="#ea580c"
        onSave={() => foodAPI.save({ foodId: food._id, ...source })} /> : null}
    </View>
  );
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const planDayName = (plan, d) => d.label || (plan.schedule === 'rotation' ? `Workout ${d.dayOfWeek + 1}` : DAY_NAMES[d.dayOfWeek]);
const planTarget = (e) => {
  const type = typeOf(e.exercise);
  const amount = type === 'yielding' ? `${e.targetReps}s` : type === 'overcoming' ? `${e.targetReps} bursts` : `${e.targetReps}${e.targetRepsMax ? `–${e.targetRepsMax}` : ''}`;
  return `${e.targetSets} × ${amount}`;
};

/**
 * A shared workout plan (every day of it): tap to see each day's exercises.
 * With `source` ({ postId } / { messageId }) it can be saved to your plans.
 */
export function PlanSummary({ plan, source }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState('idle'); // idle | saving | saved | error
  const [error, setError] = useState('');
  if (!plan) return null;
  const days = [...(plan.days || [])].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  const exerciseCount = days.reduce((n, d) => n + (d.exercises?.length || 0), 0);
  const save = async () => {
    setState('saving');
    try { await planAPI.fromShared({ planId: plan._id, ...source }); setState('saved'); } catch (err) {
      setError(err.response?.data?.message || 'Could not save it');
      setState('error');
    }
  };
  return (
    <View style={[styles.workout, styles.planCard]}>
      <TouchableOpacity style={styles.workoutHead} onPress={() => setOpen(!open)}>
        <View style={[styles.workoutIcon, { backgroundColor: '#ede9fe' }]}><ClipboardList size={18} color="#7c3aed" /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.bold} numberOfLines={1}>{plan.name}</Text>
          <Text style={styles.muted}>Plan · {days.length} workout{days.length !== 1 ? 's' : ''} · {exerciseCount} exercises · {plan.schedule === 'rotation' ? 'rotation' : 'weekly'}</Text>
        </View>
        <Text style={styles.muted}>{open ? '▴' : '▾'}</Text>
      </TouchableOpacity>
      {open && days.map((d) => (
        <View key={d.dayOfWeek} style={styles.workoutRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.small, { fontWeight: '700', color: colors.textPrimary }]}>{planDayName(plan, d)}</Text>
            {(d.exercises || []).filter((e) => e.exercise).length === 0 ? <Text style={styles.muted}>Rest / no exercises</Text>
              : d.exercises.filter((e) => e.exercise).map((e, i) => (
                <View key={i} style={[styles.row, { justifyContent: 'space-between' }]}>
                  <Text style={[styles.muted, { flex: 1 }]} numberOfLines={1}>{e.exercise.name}</Text>
                  <Text style={styles.muted}>{planTarget(e)}</Text>
                </View>
              ))}
          </View>
        </View>
      ))}
      {source ? (
        <View style={styles.workoutRow}>
          {state === 'saved' ? (
            <><Check size={14} color={colors.success} /><Text style={[styles.small, { color: colors.success }]}>Saved to your plans (Train → Plans)</Text></>
          ) : (
            <TouchableOpacity onPress={save} disabled={state === 'saving'} style={styles.row} hitSlop={6}>
              <BookmarkPlus size={15} color="#7c3aed" />
              <Text style={[styles.linkText, { color: '#7c3aed' }]}>{state === 'saving' ? 'Saving…' : 'Save plan to my plans'}</Text>
            </TouchableOpacity>
          )}
          {state === 'error' ? <Text style={[styles.small, { color: colors.danger }]}>{error}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * A shared workout: name, date, duration, sets and volume; tap to see each
 * exercise. With `source` ({ postId } / { messageId }) it can be saved as a template.
 */
export function WorkoutSummary({ workout, source }) {
  const [open, setOpen] = useState(false);
  if (!workout) return null;
  const { exercises, volume, sets } = summarizeWorkout(workout);
  return (
    <View style={styles.workout}>
      <TouchableOpacity style={styles.workoutHead} onPress={() => setOpen(!open)}>
        <View style={styles.workoutIcon}><Dumbbell size={18} color={colors.brand} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.bold} numberOfLines={1}>{workout.name}</Text>
          <Text style={styles.muted}>
            {workout.date ? `${format(new Date(workout.date), 'MMM d')} · ` : ''}{exercises.length} exercise{exercises.length !== 1 ? 's' : ''} · {sets} sets
            {workout.duration ? ` · ${workout.duration} min` : ''}{volume ? ` · ${volume.toLocaleString()} kg` : ''}
          </Text>
        </View>
        <Text style={styles.muted}>{open ? '▴' : '▾'}</Text>
      </TouchableOpacity>
      {open && exercises.map((e, i) => (
        <View key={i} style={styles.workoutRow}>
          <ExerciseImage images={e.images} style={{ width: 40, height: 32 }} />
          <Text style={[styles.small, { flex: 1 }]} numberOfLines={1}>{e.name}</Text>
          <Text style={styles.muted}>{e.sets} set{e.sets !== 1 ? 's' : ''}{e.bestLabel ? ` · ${e.bestLabel}` : ''}</Text>
        </View>
      ))}
      {source && workout._id ? <SaveAsTemplate workout={workout} source={source} /> : null}
    </View>
  );
}

/** Text box with Save / Cancel, for editing a post or comment, or writing a reply. */
function InlineEditor({ initial = '', placeholder, onSave, onCancel, multiline, saveLabel = 'Save' }) {
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    try { await onSave(text.trim()); } finally { setBusy(false); }
  };
  return (
    <View style={{ gap: 6 }}>
      <TextInput style={[styles.input, multiline && { minHeight: 70, textAlignVertical: 'top', paddingTop: 8 }]} autoFocus multiline={multiline}
        maxLength={500} placeholder={placeholder} placeholderTextColor={colors.textMuted} value={text} onChangeText={setText} />
      <View style={[styles.row, { justifyContent: 'flex-end' }]}>
        <SmallBtn title="Cancel" onPress={onCancel} />
        <SmallBtn title={busy ? '…' : saveLabel} primary disabled={busy || !text.trim()} onPress={submit} />
      </View>
    </View>
  );
}

function Comment({ comment, me, postOwner, onReply, onEdit, onDelete, onOpenProfile, isReply }) {
  const [editing, setEditing] = useState(false);
  const mine = idOf(comment.user) === idOf(me);
  return (
    <View style={[styles.row, { alignItems: 'flex-start' }]}>
      <TouchableOpacity onPress={() => onOpenProfile(idOf(comment.user))}><Avatar user={comment.user} size={isReply ? 22 : 26} /></TouchableOpacity>
      <View style={{ flex: 1 }}>
        {editing ? (
          <InlineEditor initial={comment.text} onCancel={() => setEditing(false)}
            onSave={async (text) => { await onEdit(comment._id, text); setEditing(false); }} />
        ) : (
          <>
            <View style={styles.commentBubble}>
              <Text style={[styles.muted, { fontWeight: '600', color: colors.textPrimary }]} onPress={() => onOpenProfile(idOf(comment.user))}>{comment.user?.name}</Text>
              <Text style={styles.small}>{comment.text}</Text>
            </View>
            <View style={styles.commentActions}>
              <Text style={styles.tiny}>{formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}{comment.editedAt ? ' · edited' : ''}</Text>
              {!isReply && <Text style={styles.commentAction} onPress={() => onReply(comment)}>Reply</Text>}
              {mine && <Text style={styles.commentAction} onPress={() => setEditing(true)}>Edit</Text>}
              {(mine || postOwner) && <Text style={[styles.commentAction, { color: colors.danger }]} onPress={() => onDelete(comment._id)}>Delete</Text>}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

/**
 * A post with likes, threaded comments (one level of replies) and editing of
 * your own post and comments. Handlers come from usePostActions.
 */
export function PostCard({ post, me, following, requested, onFollow, onLike, onUnlike, onDelete, onEdit, onComment, onEditComment, onDeleteComment, onOpenProfile }) {
  const liked = post.likes?.some((l) => idOf(l) === idOf(me));
  const mine = idOf(post.user) === idOf(me);
  const isFollowing = following?.has(idOf(post.user));
  const [text, setText] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [replyTo, setReplyTo] = useState(null); // top-level comment being replied to

  const comments = post.comments || [];
  const threads = comments.filter((c) => !c.parent);
  const repliesOf = (c) => comments.filter((r) => String(r.parent) === String(c._id));
  const commentProps = {
    me, postOwner: mine, onOpenProfile,
    onEdit: (cid, t) => onEditComment(post._id, cid, t),
    onDelete: (cid) => onDeleteComment(post._id, cid),
  };

  const comment = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    try { await onComment(post._id, text.trim()); setText(''); setShowComments(true); }
    finally { setSubmitting(false); }
  };

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <TouchableOpacity style={[styles.row, { flex: 1 }]} onPress={() => onOpenProfile(idOf(post.user))}>
          <Avatar user={post.user} />
          <View style={{ flex: 1 }}>
            <Text style={styles.bold} numberOfLines={1}>{post.user?.name}</Text>
            <Text style={styles.muted}>{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}{post.editedAt ? ' · edited' : ''}</Text>
          </View>
        </TouchableOpacity>
        {mine ? (
          <View style={styles.row}>
            {onEdit && <TouchableOpacity hitSlop={8} onPress={() => setEditing(true)}><Pencil size={16} color={colors.textMuted} /></TouchableOpacity>}
            <TouchableOpacity hitSlop={8} onPress={() => onDelete(post._id)}><Trash2 size={16} color={colors.textMuted} /></TouchableOpacity>
          </View>
        ) : !onFollow ? null
          : requested?.has(idOf(post.user)) ? <Text style={styles.muted}>Requested</Text>
            : !isFollowing ? <LinkText onPress={() => onFollow(idOf(post.user))}>+ Follow</LinkText>
              : <View style={styles.row}><Check size={13} color={colors.textMuted} /><Text style={styles.muted}>Following</Text></View>}
      </View>
      {editing ? (
        <View style={{ marginTop: 10 }}>
          <InlineEditor multiline initial={post.caption} placeholder="Write something…" onCancel={() => setEditing(false)}
            onSave={async (caption) => { await onEdit(post._id, caption); setEditing(false); }} />
        </View>
      ) : post.caption ? <Text style={styles.caption}>{post.caption}</Text> : null}
      {post.workoutSession ? <View style={{ marginTop: 8 }}><WorkoutSummary workout={post.workoutSession} source={{ postId: post._id }} /></View> : null}
      {post.workoutPlan ? <View style={{ marginTop: 8 }}><PlanSummary plan={post.workoutPlan} source={{ postId: post._id }} /></View> : null}
      {post.exercise ? <View style={{ marginTop: 8 }}><SharedExercise exercise={post.exercise} me={me} source={{ postId: post._id }} /></View> : null}
      {post.food ? <View style={{ marginTop: 8 }}><SharedFood food={post.food} me={me} source={{ postId: post._id }} /></View> : null}
      {post.image ? <Image source={{ uri: uploadUrl(post.image) }} style={styles.postImage} resizeMode="cover" /> : null}
      <View style={styles.actions}>
        <TouchableOpacity onPress={() => (liked ? onUnlike(post._id) : onLike(post._id))} style={styles.row} hitSlop={6}>
          <Heart size={18} color={liked ? colors.danger : colors.textMuted} fill={liked ? colors.danger : 'none'} />
          <Text style={[styles.muted, liked && { color: colors.danger }]}>{post.likes?.length ?? 0}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowComments(!showComments)} style={styles.row} hitSlop={6}>
          <MessageCircle size={18} color={colors.textMuted} />
          <Text style={styles.muted}>{comments.length}</Text>
        </TouchableOpacity>
      </View>
      {showComments && (
        <View style={{ gap: 10, marginTop: 10 }}>
          {threads.map((c) => (
            <View key={c._id} style={{ gap: 8 }}>
              <Comment comment={c} onReply={setReplyTo} {...commentProps} />
              {(repliesOf(c).length > 0 || replyTo?._id === c._id) && (
                <View style={{ paddingLeft: 34, gap: 8 }}>
                  {repliesOf(c).map((r) => <Comment key={r._id} comment={r} isReply {...commentProps} />)}
                  {replyTo?._id === c._id && (
                    <InlineEditor placeholder={`Reply to ${c.user?.name ?? 'comment'}…`} saveLabel="Reply" onCancel={() => setReplyTo(null)}
                      onSave={async (t) => { await onComment(post._id, t, c._id); setReplyTo(null); }} />
                  )}
                </View>
              )}
            </View>
          ))}
          <View style={styles.row}>
            <TextInput style={[styles.input, { flex: 1 }]} placeholder="Add a comment…" placeholderTextColor={colors.textMuted} maxLength={500}
              value={text} onChangeText={setText} onSubmitEditing={comment} returnKeyType="send" />
            <TouchableOpacity onPress={comment} disabled={submitting || !text.trim()} style={[styles.sendBtn, (submitting || !text.trim()) && { opacity: 0.4 }]}>
              <Send size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

/** New post: text, an optional workout from your history, and an optional photo. */
export function Composer({ me, initialWorkout, onPosted, onCancel }) {
  const [caption, setCaption] = useState('');
  const [workouts, setWorkouts] = useState(initialWorkout ? [initialWorkout] : []);
  const [workoutId, setWorkoutId] = useState(initialWorkout?._id || '');
  const [plans, setPlans] = useState([]);
  const [planId, setPlanId] = useState('');
  const [myExercises, setMyExercises] = useState([]);
  const [exerciseId, setExerciseId] = useState('');
  const [myFoods, setMyFoods] = useState([]);
  const [foodId, setFoodId] = useState('');
  const [photo, setPhoto] = useState(null); // { uri, mimeType }
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    workoutAPI.getAll({ limit: 15 }).then(({ data }) => {
      const list = data.workouts || [];
      setWorkouts(initialWorkout && !list.some((w) => w._id === initialWorkout._id) ? [initialWorkout, ...list] : list);
    }).catch(() => {});
    planAPI.getAll().then(({ data }) => setPlans(data)).catch(() => {});
    exerciseAPI.getAll().then(({ data }) => setMyExercises(data.filter((e) => e.isCustom && String(e.createdBy) === String(me?._id)))).catch(() => {});
    foodAPI.mine().then(({ data }) => setMyFoods(data)).catch(() => {});
  }, []);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Allow photo library access to add a photo.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (res.canceled) return;
    const asset = res.assets[0];
    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) { setError('Photo must be under 5 MB'); return; }
    setError('');
    setPhoto(asset);
  };

  const selected = workouts.find((w) => w._id === workoutId);
  const selectedPlan = plans.find((p) => p._id === planId);
  const selectedExercise = myExercises.find((e) => e._id === exerciseId);
  const selectedFood = myFoods.find((f) => f._id === foodId);
  const canPost = caption.trim() || workoutId || planId || exerciseId || foodId || photo;

  const submit = async () => {
    if (!canPost) return;
    setPosting(true);
    setError('');
    try {
      const form = new FormData();
      form.append('caption', caption.trim());
      if (workoutId) form.append('workoutSession', workoutId);
      if (planId) form.append('workoutPlan', planId);
      if (exerciseId) form.append('exercise', exerciseId);
      if (foodId) form.append('food', foodId);
      if (photo) {
        const type = photo.mimeType || 'image/jpeg';
        form.append('image', { uri: photo.uri, name: `photo.${type.split('/')[1] || 'jpg'}`, type });
      }
      const { data } = await postAPI.create(form);
      onPosted(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not post');
    } finally {
      setPosting(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.row}><Avatar user={me} /><Text style={styles.bold}>{me?.name}</Text></View>
      <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top', marginTop: 10, paddingTop: 8 }]} multiline maxLength={500} autoFocus
        placeholder={workoutId ? 'How did it go?' : 'Share a workout, progress or motivation…'} placeholderTextColor={colors.textMuted}
        value={caption} onChangeText={setCaption} />
      <View style={[styles.row, { marginTop: 10, marginBottom: 6, gap: 6 }]}><Dumbbell size={14} color={colors.textMuted} /><Text style={styles.muted}>Attach a workout</Text></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <ChipRow style={{ flexWrap: 'nowrap', gap: 6 }}>
          <Chip small label="None" active={!workoutId} onPress={() => setWorkoutId('')} />
          {workouts.map((w) => <Chip key={w._id} small label={`${w.name} — ${format(new Date(w.date), 'MMM d')}`} active={workoutId === w._id} onPress={() => setWorkoutId(w._id)} />)}
        </ChipRow>
      </ScrollView>
      {selected && <View style={{ marginTop: 8 }}><WorkoutSummary workout={selected} /></View>}
      {plans.length > 0 ? (
        <>
          <View style={[styles.row, { marginTop: 10, marginBottom: 6, gap: 6 }]}><ClipboardList size={14} color={colors.textMuted} /><Text style={styles.muted}>Attach a plan (all its days)</Text></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <ChipRow style={{ flexWrap: 'nowrap', gap: 6 }}>
              <Chip small label="None" active={!planId} onPress={() => setPlanId('')} />
              {plans.map((p) => <Chip key={p._id} small label={p.name} active={planId === p._id} onPress={() => setPlanId(p._id)} />)}
            </ChipRow>
          </ScrollView>
          {selectedPlan ? <View style={{ marginTop: 8 }}><PlanSummary plan={selectedPlan} /></View> : null}
        </>
      ) : null}
      {myExercises.length > 0 ? (
        <>
          <View style={[styles.row, { marginTop: 10, marginBottom: 6, gap: 6 }]}><Dumbbell size={14} color={colors.textMuted} /><Text style={styles.muted}>Share one of your exercises</Text></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <ChipRow style={{ flexWrap: 'nowrap', gap: 6 }}>
              <Chip small label="None" active={!exerciseId} onPress={() => setExerciseId('')} />
              {myExercises.map((e) => <Chip key={e._id} small label={e.name} active={exerciseId === e._id} onPress={() => setExerciseId(e._id)} />)}
            </ChipRow>
          </ScrollView>
          {selectedExercise ? <View style={{ marginTop: 8 }}><SharedExercise exercise={selectedExercise} me={me} /></View> : null}
        </>
      ) : null}
      {myFoods.length > 0 ? (
        <>
          <View style={[styles.row, { marginTop: 10, marginBottom: 6, gap: 6 }]}><Utensils size={14} color={colors.textMuted} /><Text style={styles.muted}>Share a food or recipe</Text></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <ChipRow style={{ flexWrap: 'nowrap', gap: 6 }}>
              <Chip small label="None" active={!foodId} onPress={() => setFoodId('')} />
              {myFoods.map((f) => <Chip key={f._id} small label={f.name} active={foodId === f._id} onPress={() => setFoodId(f._id)} />)}
            </ChipRow>
          </ScrollView>
          {selectedFood ? <View style={{ marginTop: 8 }}><SharedFood food={selectedFood} me={me} /></View> : null}
        </>
      ) : null}
      {photo ? (
        <View style={{ marginTop: 10 }}>
          <Image source={{ uri: photo.uri }} style={styles.postImage} resizeMode="cover" />
          <LinkText danger onPress={() => setPhoto(null)} style={{ marginTop: 4 }}>Remove photo</LinkText>
        </View>
      ) : (
        <TouchableOpacity onPress={pickPhoto} style={[styles.row, { marginTop: 10, gap: 6 }]} hitSlop={6}>
          <ImageIcon size={16} color={colors.brand} /><Text style={styles.linkText}>Add a photo</Text>
        </TouchableOpacity>
      )}
      <ErrorText>{error}</ErrorText>
      <View style={[styles.row, { justifyContent: 'flex-end', marginTop: 10 }]}>
        <SmallBtn title="Cancel" onPress={onCancel} />
        <SmallBtn title={posting ? 'Posting…' : 'Share'} primary disabled={posting || !canPost} onPress={submit} />
      </View>
    </View>
  );
}

function PersonRow({ person, isFollowing, isRequested, followsMe, onFollow, onUnfollow, onMessage, onOpenProfile, note }) {
  const canMessage = isFollowing || followsMe;
  return (
    <View style={styles.personRow}>
      <TouchableOpacity style={[styles.row, { flex: 1 }]} onPress={() => onOpenProfile(person._id)}>
        <Avatar user={person} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={styles.bold} numberOfLines={1}>{person.name}</Text>
          <Text style={styles.muted} numberOfLines={1}>{note || person.bio || (followsMe ? 'Follows you' : '')}</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity disabled={!canMessage} onPress={() => onMessage(person)} hitSlop={6} style={!canMessage && { opacity: 0.3 }}>
        <MessageCircle size={20} color={colors.brand} />
      </TouchableOpacity>
      {isFollowing ? <SmallBtn title="Unfollow" onPress={() => onUnfollow(person._id)} />
        : isRequested ? <SmallBtn title="Requested" onPress={() => onUnfollow(person._id)} />
          : <SmallBtn title="Follow" primary onPress={() => onFollow(person._id)} />}
    </View>
  );
}

/** Find people: search, suggestions, and the people you follow. */
/** People asking to follow you: approve or decline. */
function FollowRequests({ requests, onAnswer, onOpenProfile }) {
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
    <View style={styles.card}>
      <Text style={styles.caps}>FOLLOW REQUESTS · {requests.length}</Text>
      {requests.length === 0 ? <Text style={[styles.muted, { paddingVertical: 8 }]}>No one is waiting. Requests show up here when your account is private.</Text> : null}
      {requests.map((u) => (
        <View key={u._id} style={styles.personRow}>
          <TouchableOpacity style={[styles.row, { flex: 1 }]} onPress={() => onOpenProfile(u._id)}>
            <Avatar user={u} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={styles.bold} numberOfLines={1}>{u.name}</Text>
              {u.bio ? <Text style={styles.muted} numberOfLines={1}>{u.bio}</Text> : null}
            </View>
          </TouchableOpacity>
          <SmallBtn title="Approve" primary disabled={busy === u._id} onPress={() => answer(u._id, true)} />
          <SmallBtn title="Decline" disabled={busy === u._id} onPress={() => answer(u._id, false)} />
        </View>
      ))}
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

export function People({ me, following, followers, requested, followRequests = [], onAnswerRequest, onFollow, onUnfollow, onMessage, onOpenProfile }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [myFollowing, setMyFollowing] = useState([]);

  useEffect(() => {
    userAPI.suggestions().then(({ data }) => setSuggestions(data)).catch(() => {});
    if (me?._id) userAPI.getFollowing(me._id).then(({ data }) => setMyFollowing(data)).catch(() => {});
  }, [me?._id, following.size]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults(null); return undefined; }
    const id = setTimeout(() => userAPI.search(term).then(({ data }) => setResults(data)).catch(() => setResults([])), 300);
    return () => clearTimeout(id);
  }, [q]);

  const row = (p, note) => (
    <PersonRow key={p._id} person={p} note={note} isFollowing={following.has(String(p._id))} isRequested={requested?.has(String(p._id))} followsMe={followers.has(String(p._id))}
      onFollow={onFollow} onUnfollow={onUnfollow} onMessage={onMessage} onOpenProfile={onOpenProfile} />
  );
  const suggested = suggestions.filter((s) => !following.has(String(s._id)));

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
      <TextInput style={styles.input} placeholder="Search people by name (or exact email)…" placeholderTextColor={colors.textMuted}
        value={q} onChangeText={setQ} autoCapitalize="none" autoCorrect={false} />
      {!results && <FollowRequests requests={followRequests} onAnswer={onAnswerRequest} onOpenProfile={onOpenProfile} />}
      {results ? (
        <View style={styles.card}>
          {results.length === 0 ? <Text style={styles.empty}>No one found for “{q.trim()}”.</Text> : results.map((p) => row(p))}
        </View>
      ) : (
        <>
          {suggested.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.caps}>SUGGESTED FOR YOU</Text>
              {suggested.map((p) => row(p, p.mutual ? `Followed by ${p.mutual} you follow` : undefined))}
            </View>
          )}
          <View style={styles.card}>
            <Text style={styles.caps}>FOLLOWING · {following.size}</Text>
            {myFollowing.length === 0 ? <Text style={styles.empty}>You're not following anyone yet.</Text> : myFollowing.map((p) => row(p))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const POLL_MS = 5000;

const chatTitle = (c) => (c.isGroup ? c.name || 'Group' : c.other?.name ?? 'Deleted user');

/** One avatar for a person; two overlapping ones for a group. */
function ChatAvatar({ convo, size = 40 }) {
  if (!convo.isGroup) return <Avatar user={convo.other} size={size} />;
  const [a, b] = convo.members || [];
  const small = Math.round(size * 0.68);
  return (
    <View style={{ width: size, height: size }}>
      <View style={{ position: 'absolute', top: 0, left: 0 }}><Avatar user={a} size={small} /></View>
      <View style={[styles.avatarRing, { position: 'absolute', bottom: 0, right: 0, borderRadius: small }]}><Avatar user={b || { name: '+' }} size={small} /></View>
    </View>
  );
}

/**
 * Pick people for a group: anyone you follow or who follows you. Whether they
 * accept messages from you is checked by the server.
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
    <View>
      <TextInput style={styles.input} placeholder="Search people you follow or who follow you…" placeholderTextColor={colors.textMuted} value={q} onChangeText={setQ} />
      {people === null ? <Text style={styles.empty}>Loading…</Text>
        : shown.length === 0 ? <Text style={styles.empty}>No one to add.</Text>
          : shown.map((u) => {
            const on = selected.includes(u._id);
            return (
              <TouchableOpacity key={u._id} onPress={() => onToggle(u._id)} style={styles.personRow}>
                <Avatar user={u} size={34} />
                <Text style={[styles.small, { flex: 1, color: colors.textPrimary }]} numberOfLines={1}>{u.name}</Text>
                <View style={[styles.checkbox, on && styles.checkboxOn]}>{on ? <Check size={13} color="#fff" /> : null}</View>
              </TouchableOpacity>
            );
          })}
    </View>
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
    try { onCreated((await messageAPI.createGroup(name.trim(), selected)).data); } catch (err) {
      setError(err.response?.data?.message || 'Could not create the group');
    } finally { setBusy(false); }
  };
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <View style={[styles.row, { marginBottom: 10 }]}>
          <TouchableOpacity onPress={onCancel} hitSlop={10}><ChevronLeft size={22} color={colors.brand} /></TouchableOpacity>
          <Text style={styles.bold}>New group</Text>
        </View>
        <TextInput style={styles.input} maxLength={60} placeholder="Group name" placeholderTextColor={colors.textMuted} value={name} onChangeText={setName} />
        <Text style={[styles.muted, { marginVertical: 8 }]}>Add at least two people · {selected.length} selected</Text>
        <PeoplePicker me={me} selected={selected} onToggle={toggle} />
        <ErrorText>{error}</ErrorText>
        <View style={[styles.row, { justifyContent: 'flex-end', marginTop: 10 }]}>
          <SmallBtn title="Cancel" onPress={onCancel} />
          <SmallBtn title={busy ? 'Creating…' : 'Create group'} primary disabled={busy || !name.trim() || selected.length < 2} onPress={create} />
        </View>
      </View>
    </ScrollView>
  );
}

/** Group options: members, rename, add people, leave. */
function GroupMenu({ convo, me, onChange, onLeft, onOpenProfile }) {
  const [mode, setMode] = useState(null); // 'members' | 'rename' | 'add'
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
  const leave = async () => {
    if (!(await confirm(`Leave "${convo.name}"?`, "You won't get its messages any more.", 'Leave', true))) return;
    run(async () => { await messageAPI.leaveGroup(convo._id); onLeft(); });
  };
  const toggle = (m) => setMode(mode === m ? null : m);
  return (
    <ScrollView style={styles.groupMenu} contentContainerStyle={{ padding: 12, gap: 10 }} keyboardShouldPersistTaps="handled">
      <View style={[styles.row, { flexWrap: 'wrap' }]}>
        <MenuBtn icon={Users} title={`${convo.members.length + 1} members`} onPress={() => toggle('members')} />
        <MenuBtn icon={Pencil} title="Rename" onPress={() => { setName(convo.name); toggle('rename'); }} />
        <MenuBtn icon={UserPlus} title="Add people" onPress={() => toggle('add')} />
        <MenuBtn icon={LogOut} title="Leave" danger onPress={leave} />
      </View>
      {mode === 'members' && [me, ...convo.members].map((u) => (
        <TouchableOpacity key={u._id} style={styles.row} onPress={() => onOpenProfile(u._id)}>
          <Avatar user={u} size={26} /><Text style={styles.small}>{u._id === me._id ? 'You' : u.name}</Text>
        </TouchableOpacity>
      ))}
      {mode === 'rename' && (
        <View style={styles.row}>
          <TextInput style={[styles.input, { flex: 1 }]} maxLength={60} autoFocus value={name} onChangeText={setName} />
          <SmallBtn title="Save" primary disabled={busy || !name.trim()}
            onPress={() => run(async () => onChange((await messageAPI.renameGroup(convo._id, name.trim())).data))} />
        </View>
      )}
      {mode === 'add' && (
        <View>
          <PeoplePicker me={me} exclude={convo.members.map((u) => u._id)} selected={selected}
            onToggle={(id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))} />
          <View style={{ alignItems: 'flex-end', marginTop: 8 }}>
            <SmallBtn title={`Add ${selected.length || ''}`} primary disabled={busy || !selected.length}
              onPress={() => run(async () => onChange((await messageAPI.addMembers(convo._id, selected)).data))} />
          </View>
        </View>
      )}
      <ErrorText>{error}</ErrorText>
    </ScrollView>
  );
}

function MenuBtn({ icon: Icon, title, onPress, danger }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.smallBtn, styles.row, { gap: 5 }]}>
      <Icon size={14} color={danger ? colors.danger : colors.textSecondary} />
      <Text style={[styles.smallBtnText, danger && { color: colors.danger }]}>{title}</Text>
    </TouchableOpacity>
  );
}

function Chat({ convo: initialConvo, me, onBack, onActivity, onOpenProfile }) {
  const [convo, setConvo] = useState(initialConvo);
  const [messages, setMessages] = useState([]);
  const [people, setPeople] = useState({}); // id → { name, avatar } of everyone who sent a message
  const [hasMore, setHasMore] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [workouts, setWorkouts] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const listRef = useRef();
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
  const toggleWorkouts = async () => {
    if (workouts) { setWorkouts(null); return; }
    const [w, p, ex, fd] = await Promise.all([
      workoutAPI.getAll({ limit: 10 }).catch(() => ({ data: {} })),
      planAPI.getAll().catch(() => ({ data: [] })),
      exerciseAPI.getAll().catch(() => ({ data: [] })),
      foodAPI.mine().catch(() => ({ data: [] })),
    ]);
    setWorkouts({
      workouts: w.data.workouts || [], plans: p.data || [],
      exercises: (ex.data || []).filter((e) => e.isCustom && String(e.createdBy) === String(me._id)),
      foods: fd.data || [],
    });
  };
  // A group change (rename, new people) adds a note to the chat: reload it.
  const groupChanged = (updated) => { setConvo(updated); setShowMenu(false); load(); onActivity(); };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={120}>
      <View style={styles.chatHead}>
        <TouchableOpacity onPress={onBack} hitSlop={10}><ChevronLeft size={24} color={colors.brand} /></TouchableOpacity>
        {convo.isGroup ? (
          <TouchableOpacity style={[styles.row, { flex: 1 }]} onPress={() => setShowMenu(!showMenu)}>
            <ChatAvatar convo={convo} size={34} />
            <View style={{ flex: 1 }}>
              <Text style={styles.bold} numberOfLines={1}>{chatTitle(convo)}</Text>
              <Text style={styles.tiny}>{convo.members.length + 1} members · tap for options</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.row, { flex: 1 }]} onPress={() => convo.other && onOpenProfile(convo.other._id)}>
            <Avatar user={convo.other} size={32} />
            <Text style={styles.bold} numberOfLines={1}>{chatTitle(convo)}</Text>
          </TouchableOpacity>
        )}
      </View>
      {convo.isGroup && showMenu && <GroupMenu convo={convo} me={me} onChange={groupChanged} onLeft={onBack} onOpenProfile={onOpenProfile} />}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m._id}
        contentContainerStyle={{ padding: 12, gap: 8 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListHeaderComponent={hasMore ? <LinkText style={{ alignSelf: 'center', marginBottom: 8 }} onPress={loadEarlier}>Load earlier messages</LinkText> : null}
        ListEmptyComponent={<Text style={styles.empty}>Say hi</Text>}
        renderItem={({ item: m, index: i }) => {
          if (m.system) return <Text style={[styles.tiny, { textAlign: 'center', paddingVertical: 2 }]}>{m.text}</Text>;
          const mine = String(m.sender) === String(me._id);
          const sender = people[String(m.sender)];
          // In groups, name the sender above the first of their messages in a row.
          const prev = messages[i - 1];
          const showName = convo.isGroup && !mine && (!prev || prev.system || String(prev.sender) !== String(m.sender));
          const seenBy = (m.readBy || []).filter((id) => String(id) !== String(me._id)).length;
          return (
            <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', gap: 4 }}>
              {showName ? (
                <View style={styles.row}>
                  <Avatar user={sender || { name: '?' }} size={18} />
                  <Text style={styles.tiny}>{sender?.name ?? 'Former member'}</Text>
                </View>
              ) : null}
              {m.workoutSession ? <View style={{ width: 260 }}><WorkoutSummary workout={m.workoutSession} source={{ messageId: m._id }} /></View> : null}
              {m.workoutPlan ? <View style={{ width: 260 }}><PlanSummary plan={m.workoutPlan} source={{ messageId: m._id }} /></View> : null}
              {m.exercise ? <View style={{ width: 260 }}><SharedExercise exercise={m.exercise} me={me} source={{ messageId: m._id }} /></View> : null}
              {m.food ? <View style={{ width: 260 }}><SharedFood food={m.food} me={me} source={{ messageId: m._id }} /></View> : null}
              {m.text ? <Text style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>{m.text}</Text> : null}
              <Text style={styles.tiny}>
                {format(new Date(m.createdAt), isToday(new Date(m.createdAt)) ? 'HH:mm' : 'MMM d, HH:mm')}
                {mine && !convo.isGroup && m.readAt ? ' · Seen' : ''}
                {mine && convo.isGroup && seenBy > 0 ? ` · Seen by ${seenBy}` : ''}
              </Text>
            </View>
          );
        }}
      />
      {workouts && (
        <View style={styles.workoutPick}>
          <ScrollView style={{ maxHeight: 200 }}>
            <Hint>Share a workout</Hint>
            {workouts.workouts.length === 0 && <Hint>No workouts logged yet.</Hint>}
            {workouts.workouts.map((w) => (
              <TouchableOpacity key={w._id} disabled={sending} onPress={() => send({ workoutSession: w._id, text: text.trim() || undefined })} style={{ paddingVertical: 6 }}>
                <Text style={styles.small}>{w.name} <Text style={styles.muted}>· {format(new Date(w.date), 'MMM d')}</Text></Text>
              </TouchableOpacity>
            ))}
            {workouts.plans.length > 0 ? <Hint style={{ marginTop: 6 }}>Share a plan (all its days)</Hint> : null}
            {workouts.plans.map((p) => (
              <TouchableOpacity key={p._id} disabled={sending} onPress={() => send({ workoutPlan: p._id, text: text.trim() || undefined })} style={{ paddingVertical: 6 }}>
                <Text style={styles.small}>{p.name} <Text style={styles.muted}>· {p.days.length} workout{p.days.length !== 1 ? 's' : ''}</Text></Text>
              </TouchableOpacity>
            ))}
            {workouts.exercises.length > 0 ? <Hint style={{ marginTop: 6 }}>Share one of your exercises</Hint> : null}
            {workouts.exercises.map((e) => (
              <TouchableOpacity key={e._id} disabled={sending} onPress={() => send({ exercise: e._id, text: text.trim() || undefined })} style={{ paddingVertical: 6 }}>
                <Text style={styles.small}>{e.name}</Text>
              </TouchableOpacity>
            ))}
            {workouts.foods.length > 0 ? <Hint style={{ marginTop: 6 }}>Share a food or recipe</Hint> : null}
            {workouts.foods.map((f) => (
              <TouchableOpacity key={f._id} disabled={sending} onPress={() => send({ food: f._id, text: text.trim() || undefined })} style={{ paddingVertical: 6 }}>
                <Text style={styles.small}>{f.name} <Text style={styles.muted}>· {f.ingredients?.length ? 'recipe' : 'food'}</Text></Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
      <ErrorText>{error}</ErrorText>
      <View style={styles.composeRow}>
        <TouchableOpacity onPress={toggleWorkouts} hitSlop={6} style={{ paddingBottom: 8 }}>
          <Dumbbell size={22} color={workouts ? colors.brand : colors.textMuted} />
        </TouchableOpacity>
        <TextInput style={[styles.input, { flex: 1 }]} placeholder="Message…" placeholderTextColor={colors.textMuted} maxLength={2000} multiline
          value={text} onChangeText={setText} />
        <TouchableOpacity onPress={() => send({ text: text.trim() })} disabled={sending || !text.trim()} style={[styles.sendBtn, (sending || !text.trim()) && { opacity: 0.4 }]}>
          <Send size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

/** Inbox and chats. `openWith` (a user) opens or starts a chat with them. */
export function Messages({ me, openWith, onUnreadChange, onOpenProfile }) {
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
    messageAPI.open(openWith._id).then(({ data }) => setActive(data)).catch((err) => setError(err.response?.data?.message || 'Could not open the chat'));
  }, [openWith]);

  if (active) return <Chat key={active._id} convo={active} me={me} onBack={() => { setActive(null); refresh(); }} onActivity={refresh} onOpenProfile={onOpenProfile} />;
  if (creating) return <NewGroup me={me} onCancel={() => setCreating(false)} onCreated={(c) => { setCreating(false); setActive(c); refresh(); }} />;

  // "You: hi" for your own last message; "Sam: hi" in groups.
  const preview = (c) => {
    const lm = c.lastMessage || {};
    const who = String(lm.sender) === String(me._id) ? 'You: ' : c.isGroup && lm.senderName ? `${lm.senderName.split(' ')[0]}: ` : '';
    return `${who}${lm.text ?? ''}`;
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <ErrorText>{error}</ErrorText>
      <View style={{ alignItems: 'flex-end', marginBottom: 10 }}>
        <MenuBtn icon={Users} title="New group" onPress={() => setCreating(true)} />
      </View>
      <View style={styles.card}>
        {conversations === null ? <Text style={styles.empty}>Loading…</Text> : conversations.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 20 }}>
            <Text style={styles.bold}>No messages yet</Text>
            <Text style={[styles.muted, { textAlign: 'center', marginTop: 4 }]}>Message someone you follow from the People tab or their profile, or start a group.</Text>
          </View>
        ) : conversations.map((c) => (
          <TouchableOpacity key={c._id} onPress={() => setActive(c)} style={styles.personRow}>
            <ChatAvatar convo={c} />
            <View style={{ flex: 1 }}>
              <View style={[styles.row, { justifyContent: 'space-between' }]}>
                <Text style={[styles.small, { flexShrink: 1 }, c.unread ? styles.bold : { color: colors.textPrimary }]} numberOfLines={1}>{chatTitle(c)}</Text>
                {c.lastMessage?.sentAt ? <Text style={styles.tiny}>{formatDistanceToNowStrict(new Date(c.lastMessage.sentAt))}</Text> : null}
              </View>
              <Text style={[styles.muted, c.unread && { color: colors.textPrimary }]} numberOfLines={1}>{preview(c)}</Text>
            </View>
            {c.unread > 0 && <Text style={styles.badge}>{c.unread}</Text>}
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = makeStyles(() => ({
  card:          { backgroundColor: colors.surface, borderRadius: 16, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2, ...cardSurface() },
  row:           { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bold:          { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  small:         { fontSize: 13, color: colors.textSecondary },
  muted:         { fontSize: 12, color: colors.textMuted },
  tiny:          { fontSize: 10, color: colors.textMuted },
  caps:          { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5, marginBottom: 4 },
  empty:         { textAlign: 'center', color: colors.textMuted, paddingVertical: 16 },
  caption:       { fontSize: 14, color: colors.textPrimary, lineHeight: 20, marginTop: 10 },
  postImage:     { width: '100%', height: 220, borderRadius: 12, marginTop: 10 },
  actions:       { flexDirection: 'row', gap: 18, marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.subtle },
  commentBubble: { backgroundColor: colors.inset, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  commentActions:{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4, marginTop: 3 },
  commentAction: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  avatarRing:    { borderWidth: 2, borderColor: colors.surface },
  checkbox:      { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxOn:    { backgroundColor: colors.brand, borderColor: colors.brand },
  groupMenu:     { maxHeight: 320, flexGrow: 0, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  planCard:      { borderColor: '#ddd6fe', backgroundColor: colors.infoBg },
  linkText:      { fontSize: 14, fontWeight: '600', color: colors.brand },
  sendBtn:       { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  input:         { minHeight: 40, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: colors.textPrimary, backgroundColor: colors.surface },
  smallBtn:      { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: colors.surface },
  smallBtnPrimary:{ backgroundColor: colors.brand, borderColor: colors.brand },
  smallBtnText:  { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  workout:       { borderWidth: 1, borderColor: colors.infoBorder, backgroundColor: colors.infoBg, borderRadius: 12, overflow: 'hidden' },
  workoutHead:   { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 },
  workoutIcon:   { width: 34, height: 34, borderRadius: 8, backgroundColor: colors.brandLight, alignItems: 'center', justifyContent: 'center' },
  workoutRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.infoBorder },
  personRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.subtle },
  chatHead:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  bubble:        { maxWidth: '80%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, fontSize: 14, overflow: 'hidden' },
  bubbleMine:    { backgroundColor: colors.brand, color: '#fff' },
  bubbleTheirs:  { backgroundColor: colors.subtle, color: colors.textPrimary },
  workoutPick:   { padding: 10, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  composeRow:    { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  badge:         { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.brand, color: '#fff', fontSize: 11, fontWeight: '700', textAlign: 'center', lineHeight: 20, paddingHorizontal: 5, overflow: 'hidden' },
}));
