import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// ── Base URL ──────────────────────────────────────────────────────────────────
// Problem this solves: "localhost" means something different on every device.
// In a simulator it points back to your computer; in Expo Go on a real phone
// it points at the phone itself, so a hardcoded localhost URL silently fails
// on physical devices with no obvious error.
//
// Fix: reuse the same host Expo's dev server (Metro) is already running on —
// it's right there in Constants, and it's the one address guaranteed to be
// reachable from whatever device is running the app, physical or simulated.
function resolveDevHost() {
  const hostUri =
    Constants.expoConfig?.hostUri ?? Constants.manifest2?.extra?.expoGo?.debuggerHost;
  if (!hostUri) return null;
  const host = hostUri.split(':')[0];
  return host || null;
}

const devHost = resolveDevHost();

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  // 5001 is the server's port in docker-compose (and 5000 is taken by AirPlay on macOS).
  (devHost ? `http://${devHost}:5001/api` : 'http://localhost:5001/api');

// Exercise photos are static files of the web app (client-web/public), not
// the API. Set EXPO_PUBLIC_WEB_URL to where the web app runs; in development
// it defaults to the web container on the dev machine (port 3000), otherwise
// to the API's origin (the web app and API share a domain behind Caddy).
const WEB_URL =
  process.env.EXPO_PUBLIC_WEB_URL ??
  (devHost ? `http://${devHost}:3000` : BASE_URL.replace(/\/api\/?$/, ''));

/** Full URL for a path served by the web app, e.g. "/exercise-images/x.jpg". */
/**
 * A user-facing message for a failed request: the server's own message if it
 * sent one, a hint about the address if it couldn't be reached, else `fallback`.
 */
export const errorMessage = (err, fallback) => {
  if (err.response?.data?.message) return err.response.data.message;
  if (!err.response) return `Can't reach the server at ${BASE_URL}. Check EXPO_PUBLIC_API_URL and that your phone is on the same Wi-Fi.`;
  return `${fallback} (server answered ${err.response.status} from ${BASE_URL})`;
};

// Uploaded files (avatars, post photos) are saved as "/uploads/…" on the API
// server, so they're relative to its origin, not the web app's.
const API_ORIGIN = BASE_URL.replace(/\/api\/?$/, '');

/** Full URL for an uploaded file, e.g. "/uploads/avatar-1.jpg"; full URLs pass through. */
export const uploadUrl = (path) => (!path || /^(https?:|file:|data:)/.test(path) ? path : `${API_ORIGIN}${path}`);

export const assetUrl = (path) => (!path || /^https?:\/\//.test(path) ? path : `${WEB_URL}${path}`);

const api = axios.create({ baseURL: BASE_URL, timeout: 15000 });

// ── Attach access token ────────────────────────────────────────────────────────
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Auto-refresh on 401 TOKEN_EXPIRED ─────────────────────────────────────────
let refreshing = false;
let queue = [];

const processQueue = (error, token = null) => {
  queue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  queue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (
      error.response?.status === 401 &&
      error.response?.data?.code === 'TOKEN_EXPIRED' &&
      !original._retry
    ) {
      if (refreshing) {
        return new Promise((resolve, reject) => queue.push({ resolve, reject }))
          .then((token) => { original.headers.Authorization = `Bearer ${token}`; return api(original); });
      }

      original._retry = true;
      refreshing = true;
      try {
        const refreshToken = await AsyncStorage.getItem('refreshToken');
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
        await AsyncStorage.multiSet([['accessToken', data.accessToken], ['refreshToken', data.refreshToken]]);
        processQueue(null, data.accessToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch (err) {
        processQueue(err, null);
        await AsyncStorage.multiRemove(['accessToken', 'refreshToken']);
        // Navigation to login is handled by the AuthContext listener
        return Promise.reject(err);
      } finally {
        refreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// ── Auth ─────────────────────────────────────────────────────────────────────
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login:    (data) => api.post('/auth/login', data),
  logout:   ()     => api.post('/auth/logout'),
  getMe:    ()     => api.get('/auth/me'),
  changePassword: (currentPassword, newPassword) => api.put('/auth/password', { currentPassword, newPassword }),
};

// ── Users ─────────────────────────────────────────────────────────────────────
export const userAPI = {
  getById:      (id)   => api.get(`/users/${id}`),
  updateMe:     (data) => api.put('/users/me', data),
  uploadAvatar: (form) => api.post('/users/me/avatar', form, { headers: { 'Content-Type': 'multipart/form-data' } }),
  follow:       (id)   => api.post(`/users/${id}/follow`),
  unfollow:     (id)   => api.delete(`/users/${id}/follow`),
  getFollowers: (id)   => api.get(`/users/${id}/followers`),
  getFollowing: (id)   => api.get(`/users/${id}/following`),
  getStats:     (id)   => api.get(`/users/${id}/stats`),
  search:       (q)    => api.get('/users/search', { params: { q } }),
  suggestions:  ()     => api.get('/users/suggestions'),
  followRequests: ()   => api.get('/users/me/follow-requests'),
  acceptRequest:  (id) => api.post(`/users/me/follow-requests/${id}`),
  declineRequest: (id) => api.delete(`/users/me/follow-requests/${id}`),
};

// ── Exercises ─────────────────────────────────────────────────────────────────
export const exerciseAPI = {
  getAll:  (params)      => api.get('/exercises', { params }),
  getById: (id)          => api.get(`/exercises/${id}`),
  similar: (id, params)  => api.get(`/exercises/${id}/similar`, { params }),
  create:  (data)        => api.post('/exercises', data),
  update:  (id, data)    => api.put(`/exercises/${id}`, data),
  delete:  (id)          => api.delete(`/exercises/${id}`),
};

// ── Workouts ──────────────────────────────────────────────────────────────────
export const workoutAPI = {
  getMuscleSessions: (params) => api.get('/workouts/muscle-sessions', { params }),
  getAll:      (params)      => api.get('/workouts', { params }),
  getById:     (id)          => api.get(`/workouts/${id}`),
  create:      (data)        => api.post('/workouts', data),
  update:      (id, data)    => api.put(`/workouts/${id}`, data),
  delete:      (id)          => api.delete(`/workouts/${id}`),
  deleteAll:   ()            => api.delete('/workouts'),
  getStats:    ()            => api.get('/workouts/stats'),
  getProgress: (exerciseId)  => api.get(`/workouts/progress/${exerciseId}`),
  lastSets:    (exerciseId) => api.get(`/workouts/last/${exerciseId}`), // sets from the last workout with it
};

// ── Plans ─────────────────────────────────────────────────────────────────────
export const planAPI = {
  getAll:   ()          => api.get('/plans'),
  getById:  (id)        => api.get(`/plans/${id}`),
  create:   (data)      => api.post('/plans', data),
  update:   (id, data)  => api.put(`/plans/${id}`, data),
  delete:   (id)        => api.delete(`/plans/${id}`),
  start:    (id, day)   => api.post(`/plans/${id}/start`, { dayOfWeek: day }),
  activate: (id)        => api.patch(`/plans/${id}/activate`),
  generate: (opts)      => api.post('/plans/generate', opts),
  analyze:  (body)      => api.post('/plans/analyze', body),
  skeleton: (opts)      => api.post('/plans/skeleton', opts),
  // Save a workout (yours, or shared with you: { postId } or { messageId }) as a template.
  fromWorkout: (body) => api.post('/plans/from-workout', body),
  // Save a copy of a whole plan shared with you ({ planId, postId } or { planId, messageId }).
  fromShared: (body) => api.post('/plans/from-shared', body),
};

// ── Nutrition ─────────────────────────────────────────────────────────────────
export const supplementAPI = {
  getAll: ()         => api.get('/supplements'),
  catalog: ()        => api.get('/supplements/catalog'), // built-in list with micros per serving
  create: (data)     => api.post('/supplements', data),
  update: (id, data) => api.put(`/supplements/${id}`, data),
  delete: (id)       => api.delete(`/supplements/${id}`),
};

export const nutritionAPI = {
  getByDate:   (date)             => api.get('/nutrition', { params: { date } }),
  getRange:    (from, to)         => api.get('/nutrition/range', { params: { from, to } }),
  upsert:      (data)             => api.post('/nutrition', data),
  addMeal:     (id, meal)         => api.post(`/nutrition/${id}/meals`, meal),
  updateMeal:  (id, mId, data)    => api.put(`/nutrition/${id}/meals/${mId}`, data),
  deleteMeal:  (id, mId)          => api.delete(`/nutrition/${id}/meals/${mId}`),
  updateGoals: (id, goals)        => api.put(`/nutrition/${id}/goals`, goals),
  getHistory:  (params)           => api.get('/nutrition/history', { params }),
  getTargets:  ()                 => api.get('/nutrition/targets'),
  copyMeals:   (body)             => api.post('/nutrition/copy', body),
  mealPlan:    (opts)             => api.post('/nutrition/meal-plan', opts),
  applyPlan:   (body)             => api.post('/nutrition/meal-plan/apply', body),
  deleteLog:   (id)               => api.delete(`/nutrition/${id}`),
  deleteAll:   ()                 => api.delete('/nutrition'),
  summary:     (from, to)         => api.get('/nutrition/summary', { params: { from, to } }),
  addWater:    (date, amount)     => api.post('/nutrition/water', { date, amount }),
  deleteWater: (entryId)          => api.delete(`/nutrition/water/${entryId}`),
  toggleSupplement: (date, supplementId) => api.post('/nutrition/supplements/toggle', { date, supplementId }),
};

// ── Foods ─────────────────────────────────────────────────────────────────────
export const foodAPI = {
  search:  (q, limit = 15) => api.get('/foods/search', { params: { q, limit } }),
  getById: (id)            => api.get(`/foods/${id}`),
  create:  (data)          => api.post('/foods', data),
  update:  (id, data)      => api.put(`/foods/${id}`, data),
};

// ── Steps ─────────────────────────────────────────────────────────────────────
export const stepsAPI = {
  getRange: (from, to)    => api.get('/steps', { params: { from, to } }),
  set:      (date, steps) => api.put('/steps', { date, steps }),
  sync:     (days)        => api.put('/steps/sync', { days }), // [{ date, steps }], only raises a day
};

// ── Posts ─────────────────────────────────────────────────────────────────────
export const postAPI = {
  getFeed:       (params)       => api.get('/posts/feed', { params }),
  getUserPosts:  (userId, p)    => api.get(`/posts/user/${userId}`, { params: p }),
  getById:       (id)           => api.get(`/posts/${id}`),
  create:        (form)         => api.post('/posts', form, { headers: { 'Content-Type': 'multipart/form-data' } }),
  delete:        (id)           => api.delete(`/posts/${id}`),
  like:          (id)           => api.post(`/posts/${id}/like`),
  unlike:        (id)           => api.delete(`/posts/${id}/like`),
  edit:          (id, caption)  => api.put(`/posts/${id}`, { caption }),
  addComment:    (id, text, parentId) => api.post(`/posts/${id}/comments`, parentId ? { text, parentId } : { text }),
  editComment:   (id, cId, text) => api.put(`/posts/${id}/comments/${cId}`, { text }),
  deleteComment: (id, cId)      => api.delete(`/posts/${id}/comments/${cId}`),
};

// ── Messages ──────────────────────────────────────────────────────────────────
export const messageAPI = {
  conversations: ()           => api.get('/messages/conversations'),
  unread:        ()           => api.get('/messages/unread'),
  open:          (userId)     => api.post('/messages/conversations', { userId }),
  messages:      (id, params) => api.get(`/messages/conversations/${id}`, { params }),
  send:          (id, body)   => api.post(`/messages/conversations/${id}`, body),
  markRead:      (id)         => api.post(`/messages/conversations/${id}/read`),
  createGroup:   (name, userIds) => api.post('/messages/groups', { name, userIds }),
  renameGroup:   (id, name)   => api.put(`/messages/conversations/${id}`, { name }),
  addMembers:    (id, userIds) => api.post(`/messages/conversations/${id}/members`, { userIds }),
  leaveGroup:    (id)         => api.post(`/messages/conversations/${id}/leave`),
};
