import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Backdrop } from '../components/ParticleField';
import { BrandMark } from '../components/Brand';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Spinner } from '../components/Button';

const NAV_ITEMS = [
  {
    to: '/admin/dashboard',
    label: 'Dashboard',
    icon: 'M3 12l9-8 9 8M5 10v10h14V10',
  },
  {
    to: '/admin/upload',
    label: 'Upload Clue',
    icon: 'M12 16V4m0 0L7 9m5-5l5 5M4 17v2a1 1 0 001 1h14a1 1 0 001-1v-2',
  },
  {
    to: '/admin/clues',
    label: 'Manage Clues',
    icon: 'M4 7h16M4 12h16M4 17h10',
  },
];

const AdminLayout = () => {
  const { admin, logout } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      await logout();
      push('info', 'Signed out', 'Your admin session has been closed.');
      navigate('/admin/login', { replace: true });
    } finally {
      setSigningOut(false);
    }
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-xl px-4 py-3 font-mono text-xs uppercase tracking-[0.18em] transition-all duration-200 ${
      isActive
        ? 'border border-crimson/40 bg-crimson/10 text-crimson-soft shadow-glow-red'
        : 'border border-transparent text-mist hover:border-white/10 hover:bg-white/[0.04] hover:text-white'
    }`;

  return (
    <div className="noise-overlay relative flex min-h-screen flex-col">
      <Backdrop />

      <header className="relative z-20 flex items-center justify-between border-b border-white/10 bg-ink/60 px-5 py-4 backdrop-blur-xl sm:px-8">
        <div className="flex items-center gap-6">
          <NavLink to="/admin/dashboard">
            <BrandMark />
          </NavLink>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.35em] text-ash md:inline">
            Admin Console
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden max-w-[200px] truncate font-mono text-[11px] text-ash sm:inline">
            {admin?.email}
          </span>
          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={signingOut}
            className="flex items-center gap-2 rounded-lg border border-white/[0.12] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.25em] text-mist transition-colors hover:border-crimson/40 hover:text-crimson-soft disabled:opacity-50"
          >
            {signingOut ? <Spinner className="h-3 w-3" /> : <span>Logout</span>}
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="rounded-lg border border-white/[0.12] p-2 text-mist lg:hidden"
            aria-label="Toggle navigation"
            aria-expanded={menuOpen}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </header>

      <div className="relative z-10 flex flex-1 flex-col lg:flex-row">
        <aside className="hidden w-64 shrink-0 border-r border-white/10 p-5 lg:block">
          <nav className="flex flex-col gap-2">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} className={linkClass}>
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <path d={item.icon} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="mt-8 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
            <p className="label-caps mb-2">Storage</p>
            <p className="text-xs leading-relaxed text-mist/80">
              Videos are streamed to object storage. Only the URL and metadata live in MongoDB.
            </p>
          </div>
        </aside>

        <AnimatePresence>
          {menuOpen && (
            <motion.nav
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden border-b border-white/10 px-5 py-3 lg:hidden"
            >
              <div className="flex flex-col gap-2">
                {NAV_ITEMS.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={linkClass}
                    onClick={() => setMenuOpen(false)}
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
                      <path d={item.icon} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </motion.nav>
          )}
        </AnimatePresence>

        <main className="flex-1 px-5 py-6 sm:px-8 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;