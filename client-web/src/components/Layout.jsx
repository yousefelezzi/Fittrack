import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  LayoutDashboard, Dumbbell, ClipboardList, BarChart2,
  Apple, Users, LogOut, Menu, X, Moon, Sun,
  Calculator, History, Dumbbell as WorkoutsIcon, ChevronDown, PlusCircle, Footprints,
  Utensils, GlassWater, Pill, TrendingUp,
  Scale, HeartPulse,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { messageAPI } from '../api';
import logo from '../assets/logo.svg';
import Avatar from './Avatar';

// Everything about training lives under one collapsible "Workouts" group.
const workoutNav = [
  { to: '/log',       label: 'Log Workout', icon: PlusCircle },
  { to: '/cardio',    label: 'Log Cardio',  icon: HeartPulse },
  { to: '/plans',     label: 'Plans',       icon: ClipboardList },
  { to: '/exercises', label: 'Exercises',   icon: Dumbbell },
  { to: '/progress',  label: 'Progress',    icon: BarChart2 },
];

// Nutrition has the same kind of group: the food log, hydration, supplements, progress.
const nutritionNav = [
  { to: '/nutrition',             label: 'Food Log',    icon: Utensils, end: true },
  { to: '/nutrition/hydration',   label: 'Hydration',   icon: GlassWater },
  { to: '/nutrition/supplements', label: 'Supplements', icon: Pill },
  { to: '/nutrition/weight',      label: 'Weight',      icon: Scale },
  { to: '/nutrition/progress',    label: 'Progress',    icon: TrendingUp },
];

const nav = [
  { to: '/history',   label: 'History',     icon: History },
  { to: '/steps',     label: 'Steps',       icon: Footprints },
  { to: '/feed',      label: 'Community',   icon: Users },
];



const NavItem = ({ to, label, Icon, onClick, nested, badge, end }) => (
  <NavLink
    to={to}
    end={end || to === '/'}
    onClick={onClick}
    className={({ isActive }) =>
      `flex items-center gap-3 ${nested ? 'pl-9 pr-3 py-1.5' : 'px-3 py-2'} rounded-lg text-sm font-medium transition-colors ${
        isActive
          ? 'bg-brand-600 text-white'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
      }`
    }
  >
    <Icon size={nested ? 16 : 18} />
    <span className="flex-1">{label}</span>
    {badge > 0 && (
      <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-brand-600 text-white text-[10px] font-semibold flex items-center justify-center">
        {badge > 99 ? '99+' : badge}
      </span>
    )}
  </NavLink>
);

export default function Layout() {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  // Unread messages, shown on Community. Checked on page changes and every minute.
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    const check = () => messageAPI.unread().then(({ data }) => setUnread(data.count)).catch(() => {});
    check();
    const id = setInterval(check, 60000);
    return () => clearInterval(id);
  }, [location.pathname, location.search]);
  // Groups are open by default. When collapsed, the header lights up if you're on one of its pages.
  const [groupsOpen, setGroupsOpen] = useState({ workouts: true, nutrition: true });
  const NavGroup = ({ id, label, Icon, items }) => {
    const isOpen = groupsOpen[id];
    const inGroup = items.some(({ to }) => location.pathname.startsWith(to));
    return (
      <>
        <button
          onClick={() => setGroupsOpen((g) => ({ ...g, [id]: !g[id] }))}
          aria-expanded={isOpen}
          className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            inGroup && !isOpen
              ? 'bg-brand-600 text-white'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
          }`}
        >
          <Icon size={18} />
          <span className="flex-1 text-left">{label}</span>
          <ChevronDown size={15} className={`transition-transform ${isOpen ? '' : '-rotate-90'}`} />
        </button>
        {isOpen && items.map(({ to, label: l, icon, end }) => (
          <NavItem key={to} to={to} label={l} Icon={icon} end={end} nested onClick={() => setOpen(false)} />
        ))}
      </>
    );
  };

  const handleLogout = async () => { await logout(); navigate('/login'); };

  const Sidebar = ({ mobile }) => (
    <aside className={`flex flex-col h-full ${mobile ? '' : 'w-56'}`}>
      <div className="p-4 border-b border-gray-100 dark:border-gray-800">
        <img src={logo} alt="FitTrack" className="h-10" />
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <NavItem to="/" label="Dashboard" Icon={LayoutDashboard} onClick={() => setOpen(false)} />

        <NavGroup id="workouts" label="Workouts" Icon={WorkoutsIcon} items={workoutNav} />
        <NavGroup id="nutrition" label="Nutrition" Icon={Apple} items={nutritionNav} />

        {nav.map(({ to, label, icon: Icon }) => (
          <NavItem key={to} to={to} label={label} Icon={Icon} onClick={() => setOpen(false)}
            badge={to === '/feed' ? unread : 0} />
        ))}
        {/* Active for every /calculators/... page, including About WNS */}
        <NavItem to="/calculators" label="Calculators" Icon={Calculator} onClick={() => setOpen(false)} />
      </nav>
      <div className="p-3 border-t border-gray-100 dark:border-gray-800">
        {/* Dark mode toggle */}
        <button
          onClick={toggle}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors mb-1"
          aria-label="Toggle dark mode"
        >
          {dark ? <Sun size={16} /> : <Moon size={16} />}
          {dark ? 'Light mode' : 'Dark mode'}
        </button>
        {/* Your profile: picture and name. `end` so other people's profiles don't highlight it. */}
        <NavLink
          to="/profile"
          end
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-2.5 px-2.5 py-2 mb-1 rounded-lg transition-colors ${
              isActive
                ? 'bg-brand-600 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`
          }
          title="Your profile"
        >
          <Avatar user={user} size="sm" />
          <span className="text-sm font-medium truncate">{user?.name}</span>
        </NavLink>
        <button onClick={handleLogout} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 dark:hover:text-red-400 rounded-lg transition-colors">
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
      {/* Desktop sidebar */}
      <div className="hidden md:flex md:w-56 md:flex-col bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {open && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="fixed inset-0 bg-black/30 dark:bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative z-50 w-56 bg-white dark:bg-gray-900 flex flex-col h-full shadow-xl">
            <Sidebar mobile />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile topbar */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
          <button onClick={() => setOpen(true)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300">
            <Menu size={22} />
          </button>
          <span className="flex items-center gap-1.5 font-bold text-brand-600"><Dumbbell size={18} /> FitTrack</span>
          <button
            onClick={toggle}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
            aria-label="Toggle dark mode"
          >
            {dark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
