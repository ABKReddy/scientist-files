import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Backdrop } from '../components/ParticleField';
import { BrandMark } from '../components/Brand';

/** Cinematic shell for the participant-facing pages. */
const PublicLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="noise-overlay relative flex min-h-screen flex-col">
      <Backdrop />

      <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-8">
        <button type="button" onClick={() => navigate('/')} className="transition-opacity hover:opacity-80">
          <BrandMark />
        </button>
        <a
          href="/admin"
          className="rounded-lg border border-white/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.3em] text-ash transition-colors hover:border-crimson/40 hover:text-crimson-soft"
        >
          Admin
        </a>
      </header>

      <main className="relative z-10 flex flex-1 flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 14, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, filter: 'blur(8px)' }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-1 flex-col"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="relative z-10 px-5 py-5 sm:px-8">
        <div className="hairline mb-4" />
        <div className="flex flex-col items-center justify-between gap-2 text-center sm:flex-row sm:text-left">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-ash/70">
            Scientific Files · Case File No. 001
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-ash/50">
            Authorised personnel only
          </p>
        </div>
      </footer>
    </div>
  );
};

export default PublicLayout;