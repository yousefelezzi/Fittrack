import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { userAPI, postAPI } from '../api';
import ProfileStats from '../components/ProfileStats';
import AvatarCropper from '../components/AvatarCropper';
import PostCard from '../components/social/PostCard';
import { usePostActions } from '../components/social/usePostActions';
import { ACTIVITY_LEVELS } from '../utils/calculators';
import { Camera, Edit2, Check, X, UserPlus, UserMinus, MessageSquare, Settings as SettingsIcon, Lock, Clock } from 'lucide-react';
import { format, differenceInYears } from 'date-fns';
import { cmToFtIn, ftInToCm, kgTo, toKgFrom, formatHeight, formatBodyWeight } from '../utils/bodyUnits';

const GOAL_LABELS = {
  lose_weight:       'Lose Weight',
  build_muscle:      'Build Muscle',
  improve_endurance: 'Improve Endurance',
  stay_active:       'Stay Active',
  other:             'Other',
};

function Avatar({ user, size = 'lg' }) {
  const dim = size === 'lg' ? 'w-24 h-24 text-2xl' : 'w-8 h-8 text-xs';
  return user?.avatar
    ? <img src={user.avatar} alt="" className={`${dim} rounded-full object-cover`} />
    : <div className={`${dim} rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold`}>
        {user?.name?.[0] ?? '?'}
      </div>;
}

/** Small unit switch (kg | lb, cm | ft-in) next to a field label. */
function UnitPills({ value, options, onChange }) {
  return (
    <span className="inline-flex p-0.5 bg-gray-100 dark:bg-gray-800 rounded-md">
      {options.map(([k, l]) => (
        <button key={k} type="button" onClick={() => k !== value && onChange(k)}
          className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${value === k ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-400'}`}>
          {l}
        </button>
      ))}
    </span>
  );
}

function StatPill({ label, value, onClick }) {
  const base = 'text-center px-4 py-2';
  return onClick
    // Hover tint only; the focus ring shows for keyboard use, not after a click.
    ? <button onClick={onClick} className={`${base} flex-1 hover:bg-gray-50 dark:hover:bg-gray-800/60 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500`}>
        <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{value}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      </button>
    : <div className={`${base} flex-1`}>
        <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{value}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      </div>;
}


function FollowListModal({ title, users, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 px-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-2 max-h-80 overflow-y-auto">
          {users.length === 0
            ? <p className="text-sm text-gray-400 text-center py-8">Nobody here yet</p>
            : users.map((u) => (
                <Link
                  key={u._id}
                  to={`/profile/${u._id}`}
                  onClick={onClose}
                  className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:bg-gray-800 rounded-xl transition-colors"
                >
                  {u.avatar
                    ? <img src={u.avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
                    : <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-sm">{u.name?.[0]}</div>
                  }
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{u.name}</p>
                    {u.bio && <p className="text-xs text-gray-400 truncate max-w-[200px]">{u.bio}</p>}
                  </div>
                </Link>
              ))
          }
        </div>
      </div>
    </div>
  );
}

export default function Profile() {
  const { id } = useParams();
  const { user: me, updateUser } = useAuth();
  const navigate = useNavigate();

  const isOwn = !id || id === me?._id;
  const targetId = isOwn ? me?._id : id;

  const [profile, setProfile]   = useState(null);
  const [posts, setPosts]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [editing, setEditing]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [form, setForm]         = useState({});
  const [formErr, setFormErr]   = useState('');
  const [modal, setModal]       = useState(null); // 'followers' | 'following'
  const [modalUsers, setModalUsers] = useState([]);
  const [loadingModal, setLoadingModal] = useState(false);
  const [statsKey, setStatsKey] = useState(0); // bump to refetch stats after profile edits
  const avatarRef = useRef();
  const [cropSrc, setCropSrc] = useState(null); // picked photo being cropped
  const [uploading, setUploading] = useState(false);
  const [viewingAvatar, setViewingAvatar] = useState(false);

  // Load profile + posts
  useEffect(() => {
    if (!targetId) return;
    setLoading(true);
    Promise.all([
      userAPI.getById(targetId),
      postAPI.getUserPosts(targetId, { limit: 20 }),
    ])
      .then(([uRes, pRes]) => {
        setProfile(uRes.data);
        setPosts(pRes.data.posts ?? pRes.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [targetId]);

  const startEdit = () => {
    setForm({
      name:        profile.name ?? '',
      bio:         profile.bio ?? '',
      // Height and weight are typed in the user's units (cm or ft + in, kg or lb).
      heightUnit:  me?.heightUnit === 'ft' ? 'ft' : 'cm',
      height:      profile.height ?? '',
      heightFt:    profile.height ? cmToFtIn(profile.height).ft : '',
      heightIn:    profile.height ? cmToFtIn(profile.height).in : '',
      weightUnit:  me?.bodyWeightUnit === 'lb' ? 'lb' : 'kg',
      weight:      profile.weight ? String(kgTo(profile.weight, me?.bodyWeightUnit)) : '',
      weightShown: profile.weight ? String(kgTo(profile.weight, me?.bodyWeightUnit)) : '',
      dateOfBirth: profile.dateOfBirth ? format(new Date(profile.dateOfBirth), 'yyyy-MM-dd') : '',
      fitnessGoal: profile.fitnessGoal ?? 'stay_active',
      bodyFat:     profile.bodyFat ?? '',
      sex:         profile.sex ?? '',
      activityLevel: profile.activityLevel ?? '',
      stepGoal:    profile.stepGoal ?? 10000,
    });
    setFormErr('');
    setEditing(true);
  };

  const cancelEdit = () => setEditing(false);

  const saveEdit = async () => {
    if (!form.name?.trim()) { setFormErr('Name is required'); return; }
    const stepGoal = Number(form.stepGoal);
    if (!(stepGoal >= 1000 && stepGoal <= 50000)) { setFormErr('Step goal must be between 1,000 and 50,000'); return; }
    const heightCm = form.heightUnit === 'ft'
      ? (form.heightFt !== '' || form.heightIn !== '' ? ftInToCm(form.heightFt, form.heightIn) : null)
      : (form.height ? Number(form.height) : null);
    // The weight is only sent when it was changed: it's logged as today's
    // weigh-in, and the profile weight becomes the 7-day average.
    const weightChanged = form.weight !== '' && form.weight !== form.weightShown;
    setSaving(true);
    try {
      const payload = {
        name:        form.name.trim(),
        bio:         form.bio.trim(),
        fitnessGoal: form.fitnessGoal,
        ...(heightCm ? { height: heightCm } : {}),
        ...(weightChanged ? { weight: Math.round(toKgFrom(form.weight, form.weightUnit) * 100) / 100, weightDate: format(new Date(), 'yyyy-MM-dd') } : {}),
        heightUnit: form.heightUnit,
        bodyWeightUnit: form.weightUnit,
        ...(form.dateOfBirth ? { dateOfBirth: form.dateOfBirth }    : {}),
        // Empty clears it, so FFMI can be turned off again.
        bodyFat: form.bodyFat === '' ? null : Number(form.bodyFat),
        sex: form.sex || null,
        activityLevel: form.activityLevel === '' ? null : Number(form.activityLevel),
        stepGoal: Math.round(stepGoal),
      };
      const { data } = await userAPI.updateMe(payload);
      setProfile((p) => ({ ...p, ...data }));
      updateUser(data);
      setEditing(false);
      setStatsKey((k) => k + 1);
    } catch (err) {
      setFormErr(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // Picking a photo opens the cropper; the cropped square is what's uploaded.
  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // so the same file can be picked again
    if (file) setCropSrc(URL.createObjectURL(file));
  };
  const closeCropper = () => { if (cropSrc) URL.revokeObjectURL(cropSrc); setCropSrc(null); };
  const uploadAvatar = async (blob) => {
    const form = new FormData();
    form.append('avatar', blob, 'avatar.jpg');
    setUploading(true);
    try {
      const { data } = await userAPI.uploadAvatar(form);
      setProfile((p) => ({ ...p, avatar: data.avatar }));
      updateUser({ avatar: data.avatar });
      closeCropper();
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  // Follow, unfollow, or (for a private account) request / cancel the request.
  // Following or unfollowing can change what's visible, so the profile reloads.
  const toggleFollow = async () => {
    try {
      if (profile.isFollowing || profile.requested) {
        await userAPI.unfollow(profile._id);
        if (profile.isFollowing) updateUser({ following: (me.following || []).filter((f) => String(f?._id ?? f) !== String(profile._id)) });
      } else {
        const { data } = await userAPI.follow(profile._id);
        if (!data.requested) updateUser({ following: [...(me.following || []), profile._id] });
      }
      const [{ data: fresh }, posts] = await Promise.all([userAPI.getById(profile._id), postAPI.getUserPosts(profile._id)]);
      setProfile(fresh);
      setPosts(posts.data);
      setStatsKey((k) => k + 1);
    } catch (err) {
      console.error(err);
    }
  };

  const openModal = async (type) => {
    setModal(type);
    setLoadingModal(true);
    setModalUsers([]);
    try {
      const res = type === 'followers'
        ? await userAPI.getFollowers(profile._id)
        : await userAPI.getFollowing(profile._id);
      setModalUsers(res.data);
    } catch { setModalUsers([]); }
    finally { setLoadingModal(false); }
  };

  // Post interactions
  const postActions = usePostActions(setPosts, me);
  const myFollowing = new Set((me.following || []).map((f) => String(f?._id ?? f)));

  if (loading || !profile) return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const isFollowing = !!profile.isFollowing;
  const locked = !isOwn && profile.canView === false; // private account you don't follow
  const age = profile.dateOfBirth ? differenceInYears(new Date(), new Date(profile.dateOfBirth)) : null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header card */}
      <div className="card">
        <div className="flex items-start justify-between gap-4">
          {/* Avatar */}
          <div className="relative shrink-0">
            {/* Tap to see it full size; it's changed from Edit. */}
            <button type="button" onClick={() => profile.avatar && setViewingAvatar(true)} className={profile.avatar ? 'cursor-zoom-in' : 'cursor-default'} title={profile.avatar ? 'View photo' : undefined}>
              <Avatar user={profile} size="lg" />
            </button>
            {isOwn && editing && (
              <>
                <button
                  onClick={() => avatarRef.current?.click()} title="Change profile picture"
                  className="absolute bottom-0 right-0 w-7 h-7 bg-brand-600 text-white rounded-full flex items-center justify-center shadow hover:bg-brand-700 transition-colors"
                >
                  <Camera size={13} />
                </button>
                <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </>
            )}
          </div>

          {/* Name & bio */}
          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="space-y-3">
                {formErr && <p className="text-xs text-red-600">{formErr}</p>}
                <input
                  className="input text-lg font-bold"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Your name"
                />
                <textarea
                  className="input resize-none text-sm"
                  rows={2}
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  placeholder="Short bio…"
                  maxLength={200}
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 flex items-center justify-between">
                      Height <UnitPills value={form.heightUnit} options={[['cm', 'cm'], ['ft', 'ft-in']]} onChange={(u) => setForm({ ...form, heightUnit: u })} />
                    </label>
                    {form.heightUnit === 'ft' ? (
                      <div className="flex gap-1 items-center">
                        <input className="input" type="number" min={3} max={8} value={form.heightFt} onChange={(e) => setForm({ ...form, heightFt: e.target.value })} placeholder="5" />
                        <span className="text-xs text-gray-400">ft</span>
                        <input className="input" type="number" min={0} max={11} value={form.heightIn} onChange={(e) => setForm({ ...form, heightIn: e.target.value })} placeholder="10" />
                        <span className="text-xs text-gray-400">in</span>
                      </div>
                    ) : (
                      <input className="input" type="number" value={form.height} onChange={(e) => setForm({ ...form, height: e.target.value })} placeholder="175" />
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 flex items-center justify-between">
                      Weight <UnitPills value={form.weightUnit} options={[['kg', 'kg'], ['lb', 'lb']]}
                        onChange={(u) => setForm((f) => {
                          // Same weight in the other unit; an unchanged weight stays unchanged.
                          const conv = (v) => (v === '' ? '' : String(kgTo(toKgFrom(v, f.weightUnit), u)));
                          return { ...f, weightUnit: u, weight: f.weight === f.weightShown ? conv(f.weightShown) : conv(f.weight), weightShown: conv(f.weightShown) };
                        })} />
                    </label>
                    <input className="input" type="number" step="0.1" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} placeholder={form.weightUnit === 'lb' ? '160' : '70'} />
                    <p className="text-[10px] text-gray-400 mt-0.5">Changing it logs today's weigh-in; your weight is your 7-day average.</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Date of birth</label>
                    <input className="input" type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Goal</label>
                    <select className="input" value={form.fitnessGoal} onChange={(e) => setForm({ ...form, fitnessGoal: e.target.value })}>
                      {Object.entries(GOAL_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Body fat (%)</label>
                    <input className="input" type="number" min={3} max={70} step="0.1" value={form.bodyFat} onChange={(e) => setForm({ ...form, bodyFat: e.target.value })} placeholder="15" />
                    <p className="text-[10px] text-gray-400 mt-0.5">Used for FFMI · never shown to others</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Sex</label>
                    <select className="input" value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })}>
                      <option value="">—</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 mb-1 block">Activity level</label>
                    <select className="input" value={form.activityLevel} onChange={(e) => setForm({ ...form, activityLevel: e.target.value })}>
                      <option value="">—</option>
                      {ACTIVITY_LEVELS.map((a) => <option key={a.value} value={a.value}>{a.label} ({a.hint})</option>)}
                    </select>
                    <p className="text-[10px] text-gray-400 mt-0.5">Sex, age, height, weight and activity set your calorie goal · never shown to others</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Daily step goal</label>
                    <input className="input" type="number" min={1000} max={50000} step={500} value={form.stepGoal} onChange={(e) => setForm({ ...form, stepGoal: e.target.value })} placeholder="10000" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={saveEdit} disabled={saving} className="btn-primary">
                    <Check size={15} /> {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={cancelEdit} className="btn-secondary">
                    <X size={15} /> Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{profile.name}</h1>
                  {profile.fitnessGoal && (
                    <span className="badge bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400">{GOAL_LABELS[profile.fitnessGoal]}</span>
                  )}
                </div>
                {profile.bio && <p className="text-sm text-gray-500 mt-1">{profile.bio}</p>}
                <div className="flex flex-wrap gap-3 mt-2">
                  {age !== null && <span className="text-xs text-gray-400 dark:text-gray-500">{age} yrs</span>}
                  {profile.height && <span className="text-xs text-gray-400 dark:text-gray-500">{formatHeight(profile.height, me?.heightUnit)}</span>}
                  {profile.weight && <span className="text-xs text-gray-400 dark:text-gray-500">{formatBodyWeight(profile.weight, me?.bodyWeightUnit)}</span>}
                </div>
              </>
            )}
          </div>

          {/* Action button */}
          {!editing && (
            isOwn
              ? <div className="flex gap-2 shrink-0">
                  <button onClick={startEdit} className="btn-secondary"><Edit2 size={14} /> Edit</button>
                  <Link to="/settings" className="btn-secondary" title="Settings"><SettingsIcon size={14} /> Settings</Link>
                </div>
              : <div className="flex gap-2 shrink-0">
                  {/* Whether you can message them is up to their settings. */}
                  {profile.canMessage && (
                    <button onClick={() => navigate(`/feed?tab=messages&with=${profile._id}`)} className="btn btn-secondary" title="Message">
                      <MessageSquare size={14} /> Message
                    </button>
                  )}
                  <button onClick={toggleFollow} className={`btn ${isFollowing || profile.requested ? 'btn-secondary' : 'btn-primary'}`}
                    title={profile.requested ? 'Cancel your follow request' : undefined}>
                    {isFollowing ? <><UserMinus size={14} /> Unfollow</>
                      : profile.requested ? <><Clock size={14} /> Requested</>
                        : <><UserPlus size={14} /> {profile.privacy?.privateAccount ? 'Request to follow' : 'Follow'}</>}
                  </button>
                </div>
          )}
        </div>

        {/* Stats row */}
        <div className="flex mt-5 border-t border-gray-100 dark:border-gray-800 pt-4 divide-x divide-gray-100 dark:divide-gray-800">
          <StatPill label="posts"     value={posts.length} />
          <StatPill label="followers" value={profile.followersCount ?? profile.followers?.length ?? 0} onClick={locked ? undefined : () => openModal('followers')} />
          <StatPill label="following" value={profile.followingCount ?? profile.following?.length ?? 0} onClick={locked ? undefined : () => openModal('following')} />
        </div>
      </div>

      {locked ? (
        <div className="card text-center py-10">
          <Lock size={28} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
          <p className="font-medium text-gray-700 dark:text-gray-300">This account is private</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            {profile.requested ? 'Your follow request is waiting for approval.' : 'Follow them to see their posts and stats.'}
          </p>
        </div>
      ) : (
      <>
      {/* Stats (per-stat public/private) */}
      <ProfileStats userId={profile._id} refreshKey={statsKey} onEditProfile={startEdit} />

      {/* Posts */}
      <div className="space-y-4">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">Posts</h2>
        {posts.length === 0
          ? <div className="card text-center py-12 text-gray-400 text-sm">
              {isOwn ? <>No posts yet. <Link to="/feed" className="text-brand-600 hover:underline">Share your first!</Link></> : 'No posts yet.'}
            </div>
          : posts.map((post) => (
              <PostCard key={post._id} post={post} me={me} following={myFollowing} {...postActions} />
            ))
        }
      </div>
      </>
      )}

      {/* Follow list modal */}
      {modal && (
        <FollowListModal
          title={modal === 'followers' ? 'Followers' : 'Following'}
          users={loadingModal ? [] : modalUsers}
          onClose={() => { setModal(null); setModalUsers([]); }}
        />
      )}
      {viewingAvatar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 cursor-zoom-out" onClick={() => setViewingAvatar(false)}>
          <img src={profile.avatar} alt={profile.name} className="w-[min(80vw,80vh,28rem)] aspect-square rounded-full object-cover shadow-2xl" />
          <button className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Close"><X size={20} /></button>
        </div>
      )}
      {cropSrc && <AvatarCropper src={cropSrc} saving={uploading} onCancel={closeCropper} onSave={uploadAvatar} />}
    </div>
  );
}
