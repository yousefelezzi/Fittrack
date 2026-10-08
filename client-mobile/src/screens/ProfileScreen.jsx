import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl, Image, TextInput, Alert, Modal, FlatList,
  KeyboardAvoidingView, Platform, Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import { userAPI, postAPI, uploadUrl } from '../api';
import { Card, Avatar, Button, Spinner, colors, makeStyles, Segmented, Label, Hint, ErrorText, ListRow } from '../components';
import ProfileStats from '../components/ProfileStats';
import AvatarCropper from '../components/AvatarCropper';
import { PostCard } from '../components/social';
import { usePostActions } from '../components/usePostActions';
import { ACTIVITY_LEVELS } from '../../../client-web/src/utils/calculators';
import { Footprints, Calculator, History, Settings, Lock, FileText, Pencil, Camera } from 'lucide-react-native';
import { cmToFtIn, ftInToCm, kgTo, toKgFrom, formatHeight, formatBodyWeight } from '../../../client-web/src/utils/bodyUnits';

const GOAL_LABELS = {
  lose_weight: 'Lose Weight', build_muscle: 'Build Muscle', improve_endurance: 'Improve Endurance', stay_active: 'Stay Active', other: 'Other',
};
const idOf = (x) => String(x?._id ?? x);
// Today as YYYY-MM-DD in the phone's time zone.
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s).getTime());

function EditModal({ visible, profile, onClose, onSave, onChangePhoto, children }) {
  const { user: me } = useAuth();
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!visible) return;
    setErr('');
    setForm({
      name: profile?.name ?? '',
      bio: profile?.bio ?? '',
      // Height and weight are typed in the user's units (cm or ft + in, kg or lb).
      heightUnit: me?.heightUnit === 'ft' ? 'ft' : 'cm',
      height: profile?.height?.toString() ?? '',
      heightFt: profile?.height ? String(cmToFtIn(profile.height).ft) : '',
      heightIn: profile?.height ? String(cmToFtIn(profile.height).in) : '',
      weightUnit: me?.bodyWeightUnit === 'lb' ? 'lb' : 'kg',
      weight: profile?.weight ? String(kgTo(profile.weight, me?.bodyWeightUnit)) : '',
      weightShown: profile?.weight ? String(kgTo(profile.weight, me?.bodyWeightUnit)) : '',
      dateOfBirth: profile?.dateOfBirth ? new Date(profile.dateOfBirth).toISOString().slice(0, 10) : '',
      fitnessGoal: profile?.fitnessGoal ?? 'stay_active',
      bodyFat: profile?.bodyFat?.toString() ?? '',
      sex: profile?.sex ?? '',
      activityLevel: profile?.activityLevel ?? '',
      stepGoal: String(profile?.stepGoal ?? 10000),
    });
  }, [visible, profile]);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { setErr('Name is required'); return; }
    if (form.dateOfBirth && !isDate(form.dateOfBirth)) { setErr('Date of birth must be YYYY-MM-DD'); return; }
    if (form.bodyFat !== '' && !(Number(form.bodyFat) >= 3 && Number(form.bodyFat) <= 70)) { setErr('Body fat must be between 3 and 70%'); return; }
    const stepGoal = Number(form.stepGoal);
    if (!(stepGoal >= 1000 && stepGoal <= 50000)) { setErr('Step goal must be between 1,000 and 50,000'); return; }
    setSaving(true);
    try {
      const heightCm = form.heightUnit === 'ft'
        ? (form.heightFt !== '' || form.heightIn !== '' ? ftInToCm(form.heightFt, form.heightIn) : null)
        : (form.height ? Number(form.height) : null);
      await onSave({
        name: form.name.trim(),
        bio: form.bio.trim(),
        fitnessGoal: form.fitnessGoal,
        ...(heightCm ? { height: heightCm } : {}),
        // Only when changed: it's logged as today's weigh-in; the profile weight is the 7-day average.
        ...(form.weight !== '' && form.weight !== form.weightShown
          ? { weight: Math.round(toKgFrom(form.weight, form.weightUnit) * 100) / 100, weightDate: todayKey() } : {}),
        heightUnit: form.heightUnit,
        bodyWeightUnit: form.weightUnit,
        ...(form.dateOfBirth ? { dateOfBirth: form.dateOfBirth } : {}),
        // Empty clears it, so FFMI can be turned off again.
        bodyFat: form.bodyFat === '' ? null : Number(form.bodyFat),
        sex: form.sex || null,
        activityLevel: form.activityLevel === '' ? null : Number(form.activityLevel),
        stepGoal: Math.round(stepGoal),
      });
      onClose();
    } catch (e) {
      setErr(e.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const field = (label, key, props = {}) => (
    <View style={{ flex: 1 }}>
      <Label>{label}</Label>
      <TextInput style={styles.field} value={form[key]} onChangeText={set(key)} placeholderTextColor={colors.textMuted} {...props} />
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.editScroll} keyboardShouldPersistTaps="handled">
          <View style={styles.editHeader}>
            <Text style={styles.editTitle}>Edit Profile</Text>
            <TouchableOpacity onPress={onClose}><Text style={{ color: colors.brand }}>Cancel</Text></TouchableOpacity>
          </View>
          <ErrorText>{err}</ErrorText>
          {/* Tap the picture (or its camera badge) to change it. */}
          <TouchableOpacity onPress={onChangePhoto} style={styles.photoRow} activeOpacity={0.8} accessibilityLabel="Change profile picture">
            <View>
              <Avatar user={profile} size={76} />
              <View style={styles.cameraBadge}><Camera size={15} color="#fff" /></View>
            </View>
          </TouchableOpacity>
          {field('Name', 'name')}
          {field('Bio', 'bio', { multiline: true, maxLength: 200, placeholder: 'Short bio…', style: [styles.field, { height: 70, textAlignVertical: 'top', paddingTop: 8 }] })}
          <Label>Height</Label>
          <Segmented value={form.heightUnit} onChange={(u) => setForm((f) => ({ ...f, heightUnit: u }))} options={[['cm', 'cm'], ['ft', 'ft-in']]} style={{ width: 140, marginBottom: 6 }} />
          {form.heightUnit === 'ft' ? (
            <View style={styles.row}>
              {field('Feet', 'heightFt', { keyboardType: 'number-pad', placeholder: '5' })}
              {field('Inches', 'heightIn', { keyboardType: 'number-pad', placeholder: '10' })}
            </View>
          ) : field('Centimetres', 'height', { keyboardType: 'decimal-pad', placeholder: '175' })}
          <Label>Weight</Label>
          <Segmented value={form.weightUnit} style={{ width: 140, marginBottom: 6 }} options={[['kg', 'kg'], ['lb', 'lb']]}
            onChange={(u) => setForm((f) => {
              // Same weight in the other unit; an unchanged weight stays unchanged.
              const conv = (v) => (v === '' ? '' : String(kgTo(toKgFrom(v, f.weightUnit), u)));
              return { ...f, weightUnit: u, weight: f.weight === f.weightShown ? conv(f.weightShown) : conv(f.weight), weightShown: conv(f.weightShown) };
            })} />
          {field(form.weightUnit === 'lb' ? 'Pounds' : 'Kilograms', 'weight', { keyboardType: 'decimal-pad', placeholder: form.weightUnit === 'lb' ? '160' : '70' })}
          <Hint>Changing your weight logs today's weigh-in; your weight is your 7-day average (Nutrition → Weight).</Hint>
          <View style={styles.row}>
            {field('Date of birth', 'dateOfBirth', { placeholder: 'YYYY-MM-DD', keyboardType: 'numbers-and-punctuation' })}
            {field('Body fat (%)', 'bodyFat', { keyboardType: 'decimal-pad', placeholder: '15' })}
          </View>
          <Hint>Body fat is used for FFMI and never shown to others.</Hint>

          <Label>Sex</Label>
          <Segmented value={form.sex} onChange={set('sex')} options={[['', '—'], ['male', 'Male'], ['female', 'Female']]} />

          <Label>Activity level</Label>
          {ACTIVITY_LEVELS.map((a) => (
            <TouchableOpacity key={a.value} onPress={() => set('activityLevel')(a.value)} style={[styles.option, form.activityLevel === a.value && styles.optionActive]}>
              <Text style={[styles.optionText, form.activityLevel === a.value && { color: colors.brand, fontWeight: '600' }]}>{a.label}</Text>
              <Text style={styles.hintText}>{a.hint}</Text>
            </TouchableOpacity>
          ))}
          <Hint>Sex, age, height, weight and activity set your calorie goal · never shown to others</Hint>

          {field('Daily step goal', 'stepGoal', { keyboardType: 'number-pad', placeholder: '10000' })}

          <Label>Fitness goal</Label>
          {Object.entries(GOAL_LABELS).map(([val, label]) => (
            <TouchableOpacity key={val} onPress={() => set('fitnessGoal')(val)} style={[styles.option, form.fitnessGoal === val && styles.optionActive]}>
              <Text style={[styles.optionText, form.fitnessGoal === val && { color: colors.brand, fontWeight: '600' }]}>{label}</Text>
            </TouchableOpacity>
          ))}
          <Button title={saving ? 'Saving…' : 'Save changes'} onPress={handleSave} loading={saving} style={{ marginTop: 20 }} />
        </ScrollView>
      </KeyboardAvoidingView>
      {/* The cropper opens on top of this screen. */}
      {children}
    </Modal>
  );
}

function FollowModal({ visible, title, users, onClose, onOpen }) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.followModalOverlay}>
        <View style={styles.followModalBox}>
          <View style={styles.followModalHeader}>
            <Text style={styles.followModalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}><Text style={{ color: colors.brand }}>Close</Text></TouchableOpacity>
          </View>
          <FlatList
            data={users}
            keyExtractor={(u) => u._id}
            renderItem={({ item: u }) => (
              <TouchableOpacity style={styles.followRow} onPress={() => onOpen(u._id)}>
                <Avatar user={u} size={38} />
                <View style={{ marginLeft: 10 }}>
                  <Text style={styles.followName}>{u.name}</Text>
                  {u.bio ? <Text style={styles.followBio} numberOfLines={1}>{u.bio}</Text> : null}
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.emptyText}>Nobody here yet</Text>}
          />
        </View>
      </View>
    </Modal>
  );
}

/** Your profile (Me tab), or someone else's when opened with { userId }. */
export default function ProfileScreen({ route, navigation }) {
  const { user: me, updateUser } = useAuth();
  const viewId = route?.params?.userId;
  const isOwn = !viewId || viewId === me?._id;
  const targetId = isOwn ? me?._id : viewId;

  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [followModal, setFollowModal] = useState(null);
  const [followUsers, setFollowUsers] = useState([]);
  const [cropImage, setCropImage] = useState(null); // picked photo being cropped
  const [uploading, setUploading] = useState(false);
  const [statsKey, setStatsKey] = useState(0);
  const [viewingAvatar, setViewingAvatar] = useState(false);
  const postActions = usePostActions(setPosts, me);

  const load = useCallback(async () => {
    try {
      const [uRes, pRes] = await Promise.all([userAPI.getById(targetId), postAPI.getUserPosts(targetId, { limit: 20 })]);
      setProfile(uRes.data);
      setPosts(pRes.data.posts ?? pRes.data);
      setStatsKey((k) => k + 1);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [targetId]);

  useEffect(() => { load(); }, [load]);

  const openFollow = async (type) => {
    setFollowModal(type);
    setFollowUsers([]);
    try {
      const res = type === 'followers' ? await userAPI.getFollowers(profile._id) : await userAPI.getFollowing(profile._id);
      setFollowUsers(res.data);
    } catch { setFollowUsers([]); }
  };
  const openProfile = (id) => {
    setFollowModal(null);
    if (id === me._id) navigation.popTo('Tabs', { screen: 'Profile' });
    else navigation.push('UserProfile', { userId: id });
  };

  const handleSaveProfile = async (data) => {
    const { data: updated } = await userAPI.updateMe(data);
    setProfile((p) => ({ ...p, ...updated }));
    updateUser(updated);
    setStatsKey((k) => k + 1);
  };

  // Picking a photo opens the cropper (a circle, like the avatar); the cropped square is uploaded.
  const handleAvatarPress = async () => {
    if (!isOwn) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Allow photo library access to change your avatar.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (result.canceled) return;
    setCropImage(result.assets[0]);
  };
  const uploadAvatar = async (uri) => {
    const form = new FormData();
    form.append('avatar', { uri, name: 'avatar.jpg', type: 'image/jpeg' });
    setUploading(true);
    try {
      const { data } = await userAPI.uploadAvatar(form);
      setProfile((p) => ({ ...p, avatar: data.avatar }));
      updateUser({ avatar: data.avatar });
      setCropImage(null);
    } catch { Alert.alert('Error', 'Could not upload avatar'); }
    finally { setUploading(false); }
  };

  // Follow, unfollow, or (for a private account) request / cancel the request.
  // It can change what's visible, so the profile reloads.
  const toggleFollow = async () => {
    try {
      if (profile.isFollowing || profile.requested) {
        await userAPI.unfollow(profile._id);
        if (profile.isFollowing) updateUser({ following: (me.following || []).filter((f) => idOf(f) !== idOf(profile._id)) });
      } else {
        const { data } = await userAPI.follow(profile._id);
        if (!data.requested) updateUser({ following: [...(me.following || []), profile._id] });
      }
      await load();
    } catch (e) { console.error(e); }
  };


  if (loading || !profile) return <View style={styles.centered}><Spinner /></View>;

  const isFollowing = !!profile.isFollowing;
  const locked = !isOwn && profile.canView === false; // private account you don't follow
  const age = profile.dateOfBirth ? Math.floor((Date.now() - new Date(profile.dateOfBirth)) / (365.25 * 86400000)) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}>
        <Card>
          <View style={styles.avatarRow}>
            {/* Tap to see the picture full size; it's changed from Edit Profile. */}
            <TouchableOpacity onPress={() => setViewingAvatar(true)} disabled={!profile.avatar} activeOpacity={0.8}>
              <Avatar user={profile} size={76} />
            </TouchableOpacity>
            <View style={styles.statsRow}>
              {[
                { label: 'posts', val: posts.length },
                { label: 'followers', val: profile.followersCount ?? profile.followers?.length ?? 0, onPress: locked ? undefined : () => openFollow('followers') },
                { label: 'following', val: profile.followingCount ?? profile.following?.length ?? 0, onPress: locked ? undefined : () => openFollow('following') },
              ].map(({ label, val, onPress }) => (
                <TouchableOpacity key={label} onPress={onPress} disabled={!onPress} style={styles.statPill}>
                  <Text style={styles.statNum}>{val}</Text>
                  <Text style={styles.statLabel}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Text style={styles.profileName}>{profile.name}</Text>
          {profile.fitnessGoal && <View style={[styles.goalBadge, { marginBottom: 4 }]}><Text style={styles.goalBadgeText}>{GOAL_LABELS[profile.fitnessGoal]}</Text></View>}
          {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
          <View style={styles.metaRow}>
            {age !== null && <Text style={styles.meta}>{age} yrs</Text>}
            {profile.height ? <Text style={styles.meta}>{formatHeight(profile.height, me?.heightUnit)}</Text> : null}
            {profile.weight ? <Text style={styles.meta}>{formatBodyWeight(profile.weight, me?.bodyWeightUnit)}</Text> : null}
            {isOwn ? <Text style={styles.meta}>{(profile.stepGoal ?? 10000).toLocaleString()} steps/day</Text> : null}
          </View>

          <View style={styles.actionRow}>
            {isOwn ? (
              <>
                <Button icon={Pencil} title="Edit Profile" variant="secondary" onPress={() => setEditVisible(true)} style={{ flex: 1 }} />
              </>
            ) : (
              <>
                {/* Whether you can message them is up to their settings. */}
                {profile.canMessage && (
                  <Button title="Message" variant="secondary" style={{ flex: 1, marginRight: 8 }}
                    onPress={() => navigation.popTo('Tabs', { screen: 'Feed', params: { messageUser: profile } })} />
                )}
                <Button style={{ flex: 1 }} onPress={toggleFollow} variant={isFollowing || profile.requested ? 'secondary' : 'primary'}
                  title={isFollowing ? 'Unfollow' : profile.requested ? 'Requested' : profile.privacy?.privateAccount ? 'Request to follow' : 'Follow'} />
              </>
            )}
          </View>
        </Card>

        {isOwn && (
          <Card style={{ paddingVertical: 4 }}>
            <ListRow icon={Footprints} title="Steps" subtitle="Daily steps, goal and history" onPress={() => navigation.navigate('Steps')} />
            <ListRow icon={Calculator} title="Calculators" subtitle="FFMI, BMR & TDEE, Weekly Net Stimulus, one-rep max" onPress={() => navigation.navigate('Calculators')} />
            <ListRow icon={History} title="History" subtitle="Past workouts and meals" onPress={() => navigation.navigate('History')} />
            <ListRow icon={Settings} title="Settings" subtitle="Appearance, privacy, password, sign out" onPress={() => navigation.navigate('Settings')} last />
          </Card>
        )}

        {locked ? (
          <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
            <View style={{ marginBottom: 6 }}><Lock size={28} color={colors.textMuted} /></View>
            <Text style={styles.profileName}>This account is private</Text>
            <Text style={styles.emptyText}>{profile.requested ? 'Your follow request is waiting for approval.' : 'Follow them to see their posts and stats.'}</Text>
          </Card>
        ) : (
        <>
        <ProfileStats userId={profile._id} refreshKey={statsKey} onEditProfile={() => setEditVisible(true)} onNavigate={(screen) => navigation.navigate(screen)} />

        <Text style={styles.sectionTitle}>Posts</Text>
        {posts.length === 0 ? (
          <View style={styles.emptyPosts}>
            <View style={{ marginBottom: 8 }}><FileText size={32} color={colors.textMuted} strokeWidth={1.5} /></View>
            <Text style={styles.emptyText}>{isOwn ? 'No posts yet. Share your workout from Community!' : 'No posts yet.'}</Text>
          </View>
        ) : posts.map((post) => (
          <PostCard key={post._id} post={post} me={me} {...postActions}
            onOpenProfile={(id) => { if (id !== idOf(profile._id)) openProfile(id); }} />
        ))}
        </>
        )}
      </ScrollView>

      <EditModal visible={editVisible} profile={profile} onClose={() => setEditVisible(false)} onSave={handleSaveProfile} onChangePhoto={handleAvatarPress}>
        {cropImage && <AvatarCropper image={cropImage} saving={uploading} onCancel={() => setCropImage(null)} onSave={uploadAvatar} />}
      </EditModal>
      <Modal visible={viewingAvatar} transparent animationType="fade" onRequestClose={() => setViewingAvatar(false)}>
        <TouchableOpacity activeOpacity={1} style={styles.avatarViewer} onPress={() => setViewingAvatar(false)}>
          {profile.avatar ? <Image source={{ uri: uploadUrl(profile.avatar) }} style={styles.avatarFull} resizeMode="cover" /> : null}
        </TouchableOpacity>
      </Modal>
      <FollowModal visible={!!followModal} title={followModal === 'followers' ? 'Followers' : 'Following'} users={followUsers}
        onClose={() => setFollowModal(null)} onOpen={openProfile} />
    </View>
  );
}

// Size of the enlarged profile picture.
const AVATAR_FULL = Math.min(Dimensions.get('window').width - 48, 380);

const styles = makeStyles(() => ({
  content:      { padding: 16, paddingBottom: 40 },
  centered:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatarRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  avatarViewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  // The full-size picture is shown as a circle, like the avatar.
  avatarFull:   { width: AVATAR_FULL, height: AVATAR_FULL, borderRadius: AVATAR_FULL / 2 },
  photoRow:     { alignSelf: 'center', marginBottom: 8 },
  cameraBadge:  { position: 'absolute', right: -2, bottom: -2, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bg },
  statsRow:     { flex: 1, flexDirection: 'row', justifyContent: 'space-around', marginLeft: 16 },
  statPill:     { alignItems: 'center' },
  statNum:      { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  statLabel:    { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  profileName:  { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  goalBadge:    { alignSelf: 'flex-start', backgroundColor: colors.brandLight, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  goalBadgeText:{ fontSize: 12, color: colors.brand, fontWeight: '600' },
  bio:          { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: 6 },
  metaRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  meta:         { fontSize: 13, color: colors.textMuted },
  actionRow:    { flexDirection: 'row' },
  row:          { flexDirection: 'row', gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: 10, marginTop: 8 },
  emptyPosts:   { alignItems: 'center', paddingVertical: 30 },
  emptyText:    { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  editScroll:   { padding: 24, paddingTop: 60, paddingBottom: 60 },
  editHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  editTitle:    { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  field:        { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.textPrimary },
  option:       { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 6 },
  optionActive: { borderColor: colors.brand, backgroundColor: colors.brandLight },
  optionText:   { fontSize: 14, color: colors.textPrimary },
  hintText:     { fontSize: 11, color: colors.textMuted },
  // Followers / following open in the middle of the screen.
  followModalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: 20 },
  followModalBox:     { backgroundColor: colors.surface, borderRadius: 20, maxHeight: '70%', paddingBottom: 8, overflow: 'hidden' },
  followModalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border },
  followModalTitle:   { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  followRow:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.subtle },
  followName:         { fontSize: 14, fontWeight: '500', color: colors.textPrimary },
  followBio:          { fontSize: 12, color: colors.textMuted, maxWidth: 220 },
}));
