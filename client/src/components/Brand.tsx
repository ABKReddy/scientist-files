import { motion } from 'framer-motion';

export const BrandMark = ({
  compact = false,
  className = '',
}: {
  compact?: boolean;
  className?: string;
}) => (
  <div className={`flex items-center gap-3 ${className}`}>
    <span className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-crimson/30 bg-crimson/10">
      <span className="absolute inset-0 animate-pulse-ring rounded-lg border border-crimson/40" />
      <svg viewBox="0 0 24 24" className="h-4 w-4 text-crimson" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="10.5" cy="10.5" r="6" />
        <path d="M15 15l4.5 4.5" strokeLinecap="round" />
      </svg>
    </span>
    {!compact && (
      <span className="leading-none">
        <span className="block font-display text-sm font-bold tracking-[0.42em] text-white">SCIENTIFIC</span>
        <span className="mt-1 block font-mono text-[10px] tracking-[0.5em] text-ash">FILES</span>
      </span>
    )}
  </div>
);

/** The cinematic two-line title treatment used on the welcome screen. */
export const FilmTitle = () => (
  <div className="text-center">
    <motion.h1
      initial={{ opacity: 0, letterSpacing: '0.9em', filter: 'blur(12px)' }}
      animate={{ opacity: 1, letterSpacing: '0.34em', filter: 'blur(0px)' }}
      transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
      className="font-display text-3xl font-bold uppercase leading-none text-white sm:text-5xl md:text-6xl"
      style={{ textShadow: '0 0 28px rgba(255,45,85,0.45), 0 0 70px rgba(61,123,255,0.22)' }}
    >
      Scientific
    </motion.h1>

    <motion.div
      initial={{ opacity: 0, scaleX: 0.2 }}
      animate={{ opacity: 1, scaleX: 1 }}
      transition={{ duration: 0.9, delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto mt-4 h-px w-40 bg-gradient-to-r from-transparent via-crimson/70 to-transparent sm:w-64"
    />

    <motion.h2
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, delay: 0.7 }}
      className="mt-4 font-mono text-lg uppercase tracking-[0.62em] text-crimson-soft sm:text-2xl md:text-3xl"
      style={{ textShadow: '0 0 22px rgba(255,45,85,0.5)' }}
    >
      Files
    </motion.h2>
  </div>
);

export const ClassifiedStamp = ({ label }: { label: string }) => (
  <span className="inline-flex items-center gap-2 rounded-full border border-crimson/30 bg-crimson/5 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.3em] text-crimson-soft">
    <span className="h-1.5 w-1.5 rounded-full bg-crimson shadow-glow-red" />
    {label}
  </span>
);