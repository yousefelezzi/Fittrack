import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/Layout';

// Pages
import Login       from './pages/Login';
import Register    from './pages/Register';
import Dashboard   from './pages/Dashboard';
import Exercises   from './pages/Exercises';
import LogWorkout  from './pages/LogWorkout';
import Plans       from './pages/Plans';
import History     from './pages/History';
import Progress    from './pages/Progress';
import Nutrition   from './pages/Nutrition';
import Hydration from './pages/Hydration';
import Supplements from './pages/Supplements';
import NutritionProgress from './pages/NutritionProgress';
import Steps       from './pages/Steps';
import Feed        from './pages/Feed';
import Profile     from './pages/Profile';
import Settings    from './pages/Settings';
import Calculators    from './pages/Calculators';
import AboutWNS       from './pages/AboutWNS';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  return user ? children : <Navigate to="/login" replace />;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/" replace /> : children;
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/login"    element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

            {/* Protected */}
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index           element={<Dashboard />} />
              <Route path="exercises" element={<Exercises />} />
              <Route path="log"       element={<LogWorkout />} />
              <Route path="plans"     element={<Plans />} />
              <Route path="history"   element={<History />} />
              <Route path="progress"  element={<Progress />} />
              <Route path="nutrition" element={<Nutrition />} />
              <Route path="nutrition/hydration" element={<Hydration />} />
              <Route path="nutrition/supplements" element={<Supplements />} />
              <Route path="nutrition/progress" element={<NutritionProgress />} />
              <Route path="steps"     element={<Steps />} />
              <Route path="feed"      element={<Feed />} />
              <Route path="profile"   element={<Profile />} />
              <Route path="profile/:id" element={<Profile />} />
              <Route path="settings"  element={<Settings />} />
              <Route path="calculators" element={<Navigate to="/calculators/ffmi" replace />} />
              <Route path="calculators/:calc" element={<Calculators />} />
              <Route path="calculators/wns/about" element={<AboutWNS />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
