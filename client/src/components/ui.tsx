import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export const GlassCard = ({
  children,
  className = '',
  glow = 'red',
}: {
  children: ReactNode;
  className?: string;
  glow?: 'red' | 'blue' | 'none';
}) => (
  <div
    className={`glass-panel relative overflow-hidden ${
      glow === 'red' ? 'shadow-[0_0_60px_-30px_rgba(255,45,85,0.9)]' : ''
    } ${glow === 'blue' ? 'shadow-[0_0_60px_-30px_rgba(61,123,255,0.9)]' : ''} ${className}`}
  >
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
    />
    {children}
  </div>
);

export const Alert = ({
  kind = 'error',
  title,
  children,
  onDismiss,
}: {
  kind?: 'error' | 'info' | 'success' | 'warning';
  title?: string;
  children: ReactNode;
  onDismiss?: () => void;
}) => {
  const styles = {
    error: 'border-crimson/40 bg-crimson/10 text-crimson-soft',
    warning: 'border-amber/40 bg-amber/10 text-amber',
    success: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300',
    info: 'border-electric/40 bg-electric/10 text-electric-soft',
  }[kind];

  const icons = {
    error: 'M12 8v5M12 16.5h.01M10.3 3.9L2.6 17.1A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.9L13.7 3.9a2 2 0 0 0-3.4 0z',
    warning: 'M12 9v4m0 4h.01M12 3l9 16H3l9-16z',
    success: 'M20 6L9 17l-5-5',
    info: 'M12 16v-5m0-4h.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  }[kind];

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      role={kind === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${styles}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="mt-0.5 h-4 w-4 shrink-0">
        <path d={icons} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="min-w-0 flex-1 leading-relaxed">
        {title && <p className="font-medium text-white">{title}</p>}
        <div className={title ? 'mt-0.5' : ''}>{children}</div>
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="-mr-1 rounded p-1 opacity-60 transition hover:opacity-100" aria-label="Dismiss">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </motion.div>
  );
};

export const ErrorMessage = ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
  <Alert kind="error" title="Something went wrong">
    <p>{message}</p>
    {onRetry && (
      <button type="button" onClick={onRetry} className="mt-2 text-xs underline underline-offset-4 hover:text-white">
        Try again
      </button>
    )}
  </Alert>
);

export const FadeIn = ({
  children,
  delay = 0,
  y = 16,
  className = '',
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) => (
  <motion.div
    initial={{ opacity: 0, y }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
    className={className}
  >
    {children}
  </motion.div>
);

export const PageTransition = ({ children }: { children: ReactNode }) => (
  <AnimatePresence mode="wait">
    <motion.div
      initial={{ opacity: 0, y: 12, filter: 'blur(6px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -8, filter: 'blur(6px)' }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  </AnimatePresence>
);

export const FullPageLoader = ({ label = 'Decrypting evidence…' }: { label?: string }) => (
  <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
    <div className="relative h-14 w-14">
      <span className="absolute inset-0 rounded-full border-2 border-white/10" />
      <span className="absolute inset-0 animate-pulse-ring rounded-full border-2 border-crimson/60" />
      <span className="absolute inset-2 animate-spin rounded-full border-2 border-transparent border-t-electric" />
    </div>
    <p className="label-caps">{label}</p>
  </div>
);