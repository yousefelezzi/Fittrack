import api from './axios';

// ── Auth ────────────────────────────────────────────────────────────────────
export const authAPI = {
  register:     (data)  => api.post('/auth/register', data),
  login:        (data)  => api.post('/auth/login', data),
  logout:       ()      => api.post('/auth/logout'),
  getMe:        ()      => api.get('/auth/me'),
  usernameAvailable: (username) => api.get('/auth/username-available', { params: { username } }),
  // Two-step sign-in: login may answer { twoFactorRequired, challenge, email }; then send the emailed code.
  verifyLogin: (challenge, code) => api.post('/auth/login/verify', { challenge, code }),
  resendLoginCode: (challenge) => api.post('/auth/login/resend', { challenge }),
  requestTwoFactor: (password) => api.post('/auth/2fa/enable/request', { password }),
  confirmTwoFactor: (code) => api.post('/auth/2fa/enable/confirm', { code }),
  disableTwoFactor: (password) => api.post('/auth/2fa/disable', { password }),
  // Password: a link is emailed; the new password is set on the page it opens.
  requestPasswordChange: () => api.post('/auth/password/request'),
  checkPasswordToken: (token) => api.get('/auth/password/check', { params: { token } }),
  resetPassword: (token, newPassword) => api.post('/auth/password/reset', { token, newPassword }),
  // Email: needs the password, then a link sent to the new address confirms it.
  requestEmailChange: (newEmail, password) => api.post('/auth/email/request', { newEmail, password }),
  cancelEmailChange: () => api.delete('/auth/email/request'),
  confirmEmailChange: (token) => api.post('/auth/email/confirm', { token }),
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
  // Save a custom exercise shared with you: { exerciseId, postId } or { exerciseId, messageId }.
  fromShared: (body) => api.post('/exercises/from-shared', body),
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
  plateaus:    ()         => api.get('/workouts/plateaus'), // exercises with no progress in the past month
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
// Body weight: daily weigh-ins (kg); the profile weight is their 7-day average.
export const weightAPI = {
  list:   (days)         => api.get('/weight', { params: { days } }),
  log:    (date, weight) => api.post('/weight', { date, weight }),
  delete: (id)           => api.delete(`/weight/${id}`),
};

// Cardio sessions (their own page); calories are estimated on the server.
export const cardioAPI = {
  getAll: (params) => api.get('/cardio', { params }),
  create: (data) => api.post('/cardio', data),
  delete: (id) => api.delete(`/cardio/${id}`),
};

// What today's reminders need: workout day / trained yet, supplements ticked.
export const reminderAPI = {
  today: (params) => api.get('/reminders/today', { params }),
};

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
  // A day's supplements; your stack is put on it (unticked) the first time it's opened.
  supplementDay: (date) => api.post('/nutrition/supplements/day', { date }),
  // Put a supplement on the day (unticked), or take it off the day.
  toggleSupplement: (date, supplementId) => api.post('/nutrition/supplements/toggle', { date, supplementId }),
  // Tick one off as taken (or untick it).
  tickSupplement: (date, supplementId) => api.post('/nutrition/supplements/tick', { date, supplementId }),
  // Tick several off at once: { supplementIds } or { copyFrom: 'YYYY-MM-DD' } (what was taken that day).
  takeSupplements: (date, body) => api.post('/nutrition/supplements/take', { date, ...body }),
  // Servings of a supplement on that day only.
  setSupplementServings: (date, supplementId, servings) => api.put('/nutrition/supplements/servings', { date, supplementId, servings }),
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
  // Your custom foods and recipes, plus ones you saved from posts and messages.
  mine:    ()             => api.get('/foods/mine'),
  save:    (body)         => api.post('/foods/saved', body), // { foodId, postId } or { foodId, messageId }
  unsave:  (id)           => api.delete(`/foods/saved/${id}`),
};
