import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from './Button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog = ({
  open,
  title,
  message,
  confirmLabel = 'DELETE',
  cancelLabel = 'CANCEL',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-void/85 backdrop-blur-sm" onClick={onCancel} aria-hidden="true" />

          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="glass-panel-strong relative w-full max-w-md overflow-hidden p-6"
          >
            <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-crimson/20 blur-3xl" />
            <div className="relative">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-crimson/40 bg-crimson/10">
                  <svg viewBox="0 0 24 24" className="h-5 w-5 text-crimson" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M12 9v4m0 4h.01M10.3 3.9L2.6 17.1A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.9L13.7 3.9a2 2 0 0 0-3.4 0z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <h2 className="font-display text-lg font-semibold text-white">{title}</h2>
              </div>

              <p className="text-sm leading-relaxed text-mist">{message}</p>

              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="ghost" onClick={onCancel} disabled={loading}>
                  {cancelLabel}
                </Button>
                <Button variant="danger" onClick={onConfirm} loading={loading} loadingText="DELETING">
                  {confirmLabel}
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};