const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const connectDB = require('./config/db');
const runMigrations = require('./migrations');
const syncSupplementCatalog = require('./utils/syncSupplementCatalog');
const errorHandler = require('./middleware/errorHandler');

const authRoutes      = require('./routes/auth.routes');
const userRoutes      = require('./routes/user.routes');
const exerciseRoutes  = require('./routes/exercise.routes');
const workoutRoutes   = require('./routes/workout.routes');
const planRoutes      = require('./routes/plan.routes');
const nutritionRoutes = require('./routes/nutrition.routes');
const postRoutes      = require('./routes/post.routes');
const foodRoutes      = require('./routes/food.routes');
const messageRoutes   = require('./routes/message.routes');
const stepsRoutes     = require('./routes/steps.routes');
const supplementRoutes = require('./routes/supplement.routes');
const weightRoutes = require('./routes/weight.routes');
const reminderRoutes = require('./routes/reminder.routes');

const app = express();

// Trust the first hop in front of us (the nginx reverse proxy in the "web"
// container, or Caddy in production) so express-rate-limit and req.ip read
// the real client IP from X-Forwarded-For instead of nginx's own address.
// "1" = trust exactly one proxy hop; safe here since nothing untrusted sits
// between the internet and that proxy in this docker-compose setup.
app.set('trust proxy', 1);

// ── Uploads dir ───────────────────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// ── Database ──────────────────────────────────────────────────────────────────
// Migrations run in the server (not the seed), after the seed has updated the
// exercise library, since some of them depend on it (e.g. which are unilateral).
connectDB().then(runMigrations).then(syncSupplementCatalog);

// ── Security middleware ───────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

// ── Rate limiting ─────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', apiLimiter);
app.use('/api/auth/login',    authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/refresh',  authLimiter);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/users',     userRoutes);
app.use('/api/exercises', exerciseRoutes);
app.use('/api/workouts',  workoutRoutes);
app.use('/api/plans',     planRoutes);
app.use('/api/nutrition', nutritionRoutes);
app.use('/api/posts',     postRoutes);
app.use('/api/foods',     foodRoutes);
app.use('/api/messages',  messageRoutes);
app.use('/api/steps',     stepsRoutes);
app.use('/api/supplements', supplementRoutes);
app.use('/api/weight', weightRoutes);
app.use('/api/reminders', reminderRoutes);

// ── Global error handler ──────────────────────────────────────────────────────
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

module.exports = app;
