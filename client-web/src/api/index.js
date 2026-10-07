import api from './axios';

// ── Auth ────────────────────────────────────────────────────────────────────
export const authAPI = {
  register:     (data)  => api.post('/auth/register', data),
  login:        (data)  => api.post('/auth/login', data),
  logout:       ()      => api.post('/auth/logout'),
  getMe:        ()      => api.get('/auth/me'),
  changePassword: (currentPassword, newPassword) => api.put('/auth/password', { currentPassword, newPassword }),
};

// ── Users ───────────────────────────────────────────────────────────────────
export const userAPI = {
  getById:      (id)    => api.get(`/users/${id}`),
  updateMe:     (data)  => api.put('/users/me', data),
  uploadAvatar: (form)  => api.post('/users/me/avatar', form, { headers: { 'Content-Type': 'multipart/form-data' } }),
  follow:       (id)    => api.post(`/users/${id}/follow`),
  unfollow:     (id)    => api.delete(`/users/${id}/follow`),
  getFollowers: (id)    => api.get(`/users/${id}/followers`),
  getFollowing: (id)    => api.get(`/users/${id}/following`),
  getStats:     (id)    => api.get(`/users/${id}/stats`),
  search:       (q)     => api.get('/users/search', { params: { q } }),
  suggestions:  ()      => api.get('/users/suggestions'),
  followRequests: ()    => api.get('/users/me/follow-requests'),
  acceptRequest:  (id)  => api.post(`/users/me/follow-requests/${id}`),
  declineRequest: (id)  => api.delete(`/users/me/follow-requests/${id}`),
};

// ── Exercises ───────────────────────────────────────────────────────────────
export const exerciseAPI = {
  similar: (id, params) => api.get(`/exercises/${id}/similar`, { params }),
  getAll:   (params) => api.get('/exercises', { params }),
  getById:  (id)     => api.get(`/exercises/${id}`),
  create:   (data)   => api.post('/exercises', data),
  update:   (id, data) => api.put(`/exercises/${id}`, data),
  delete:   (id)     => api.delete(`/exercises/${id}`),
};

// ── Workouts ─────────────────────────────────────────────────────────────────
export const workoutAPI = {
  getMuscleSessions: (params) => api.get('/workouts/muscle-sessions', { params }),
  getAll:          (params) => api.get('/workouts', { params }),
  getById:         (id)     => api.get(`/workouts/${id}`),
  create:          (data)   => api.post('/workouts', data),
  update:          (id, data) => api.put(`/workouts/${id}`, data),
  delete:          (id)     => api.delete(`/workouts/${id}`),
  deleteAll:       ()       => api.delete('/workouts'),
  getStats:        ()       => api.get('/workouts/stats'),
  getProgress:     (exerciseId) => api.get(`/workouts/progress/${exerciseId}`),
  lastSets:    (exerciseId) => api.get(`/workouts/last/${exerciseId}`), // sets from the last workout with it
};

// ── Plans ────────────────────────────────────────────────────────────────────
export const planAPI = {
  getAll:    ()        => api.get('/plans'),
  getById:   (id)      => api.get(`/plans/${id}`),
  create:    (data)    => api.post('/plans', data),
  update:    (id, data)  => api.put(`/plans/${id}`, data),
  delete:    (id)      => api.delete(`/plans/${id}`),
  start:     (id, day) => api.post(`/plans/${id}/start`, { dayOfWeek: day }),
  activate:  (id)      => api.patch(`/plans/${id}/activate`),
  generate:  (opts)    => api.post('/plans/generate', opts),
  analyze:   (body)    => api.post('/plans/analyze', body),
  skeleton:  (opts)    => api.post('/plans/skeleton', opts),
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
  getByDate:   (date)        => api.get('/nutrition', { params: { date } }),
  getRange:    (from, to)    => api.get('/nutrition/range', { params: { from, to } }),
  upsert:      (data)        => api.post('/nutrition', data),
  addMeal:     (id, meal)    => api.post(`/nutrition/${id}/meals`, meal),
  updateMeal:  (id, mId, data) => api.put(`/nutrition/${id}/meals/${mId}`, data),
  deleteMeal:  (id, mId)     => api.delete(`/nutrition/${id}/meals/${mId}`),
  updateGoals: (id, goals)   => api.put(`/nutrition/${id}/goals`, goals),
  getHistory:  (params)      => api.get('/nutrition/history', { params }),
  getTargets:  ()            => api.get('/nutrition/targets'),
  copyMeals:   (body)        => api.post('/nutrition/copy', body),
  mealPlan:    (opts)        => api.post('/nutrition/meal-plan', opts),
  applyPlan:   (body)        => api.post('/nutrition/meal-plan/apply', body),
  deleteLog:   (id)          => api.delete(`/nutrition/${id}`),
  deleteAll:   ()            => api.delete('/nutrition'),
  summary:     (from, to)         => api.get('/nutrition/summary', { params: { from, to } }),
  addWater:    (date, amount)     => api.post('/nutrition/water', { date, amount }),
  deleteWater: (entryId)          => api.delete(`/nutrition/water/${entryId}`),
  toggleSupplement: (date, supplementId) => api.post('/nutrition/supplements/toggle', { date, supplementId }),
};

// ── Steps ───────────────────────────────────────────────────────────────────
export const stepsAPI = {
  getRange: (from, to)     => api.get('/steps', { params: { from, to } }),
  set:      (date, steps)  => api.put('/steps', { date, steps }),
};

// ── Posts / Feed ──────────────────────────────────────────────────────────────
export const postAPI = {
  getFeed:       (params) => api.get('/posts/feed', { params }),
  getUserPosts:  (userId, params) => api.get(`/posts/user/${userId}`, { params }),
  getById:       (id)     => api.get(`/posts/${id}`),
  create:        (form)   => api.post('/posts', form, { headers: { 'Content-Type': 'multipart/form-data' } }),
  delete:        (id)     => api.delete(`/posts/${id}`),
  like:          (id)     => api.post(`/posts/${id}/like`),
  unlike:        (id)     => api.delete(`/posts/${id}/like`),
  edit:          (id, caption) => api.put(`/posts/${id}`, { caption }),
  addComment:    (id, text, parentId) => api.post(`/posts/${id}/comments`, { text, ...(parentId && { parentId }) }),
  editComment:   (id, cId, text) => api.put(`/posts/${id}/comments/${cId}`, { text }),
  deleteComment: (id, cId)  => api.delete(`/posts/${id}/comments/${cId}`),
};
// ── Messages ──────────────────────────────────────────────────────────────────
export const messageAPI = {
  conversations: ()             => api.get('/messages/conversations'),
  unread:        ()             => api.get('/messages/unread'),
  open:          (userId)       => api.post('/messages/conversations', { userId }),
  messages:      (id, params)   => api.get(`/messages/conversations/${id}`, { params }),
  send:          (id, body)     => api.post(`/messages/conversations/${id}`, body),
  markRead:      (id)           => api.post(`/messages/conversations/${id}/read`),
  createGroup:   (name, userIds) => api.post('/messages/groups', { name, userIds }),
  renameGroup:   (id, name)     => api.put(`/messages/conversations/${id}`, { name }),
  addMembers:    (id, userIds)  => api.post(`/messages/conversations/${id}/members`, { userIds }),
  leaveGroup:    (id)           => api.post(`/messages/conversations/${id}/leave`),
};
// ── Foods ─────────────────────────────────────────────────────────────────────
export const foodAPI = {
  search: (q, limit = 15) => api.get('/foods/search', { params: { q, limit } }),
  getById: (id)           => api.get(`/foods/${id}`),
  create:  (data)         => api.post('/foods', data),
  update:  (id, data)     => api.put(`/foods/${id}`, data),
};
