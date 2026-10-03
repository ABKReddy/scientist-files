import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ToastKind, ToastMessage } from '../types';

interface ToastContextValue {
  push: (kind: ToastKind, title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const KIND_STYLES: Record<ToastKind, { border: string; icon: string; glow: string }> = {
  success: { border: 'border-emerald-400/30', icon: 'text-emerald-400', glow: 'shadow-[0_0_30px_-10px_rgba(52,211,153,0.6)]' },
  error: { border: 'border-crimson/40', icon: 'text-crimson', glow: 'shadow-[0_0_30px_-10px_rgba(255,45,85,0.7)]' },
  info: { border: 'border-electric/35', icon: 'text-electric-soft', glow: 'shadow-[0_0_30px_-12px_rgba(61,123,255,0.7)]' },
};

const ICONS: Record<ToastKind, string> = {
  success: 'M20 6L9 17l-5-5',
  error: 'M18 6L6 18M6 6l12 12',
  info: 'M12 8h.01M11 12h1v5h1',
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, title: string, description?: string) => {
      counter.current += 1;
      const id = counter.current;
      setToasts((current) => [...current, { id, kind, title, description }]);
      window.setTimeout(() => dismiss(id), kind === 'error' ? 6000 : 4000);
    },
    [dismiss]
  );

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:top-0 sm:items-end"
        role="status"
        aria-live="polite"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              className={`pointer-events-auto w-full max-w-sm rounded-xl border ${KIND_STYLES[toast.kind].border} bg-ink/95 px-4 py-3 backdrop-blur-xl ${KIND_STYLES[toast.kind].glow}`}
            >
              <div className="flex items-start gap-3">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`mt-0.5 h-4 w-4 shrink-0 ${KIND_STYLES[toast.kind].icon}`}
                >
                  <path d={ICONS[toast.kind]} />
                </svg>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white">{toast.title}</p>
                  {toast.description && <p className="mt-0.5 text-xs leading-relaxed text-mist/80">{toast.description}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  className="-mr-1 -mt-1 rounded p-1 text-ash transition-colors hover:text-white"
                  aria-label="Dismiss notification"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
};