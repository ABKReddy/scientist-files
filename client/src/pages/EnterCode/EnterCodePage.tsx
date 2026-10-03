import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CodeSlots, isComplete, slotsToCode, CODE_LENGTH } from '../../components/CodeSlots';
import { Button } from '../../components/Button';
import { Alert, FadeIn } from '../../components/ui';
import { clueService } from '../../services/clueService';
import { toAppError } from '../../services/apiClient';
import type { AppError, UnlockedClue } from '../../types';
import { UNLOCKED_CLUE_KEY } from '../../utils/unlockedClue';

const EnterCodePage = () => {
  const navigate = useNavigate();
  const [slots, setSlots] = useState<string[]>(() => Array.from({ length: CODE_LENGTH }, () => ''));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const ready = isComplete(slots);

  const handleSubmit = async () => {
    if (!ready || loading) return;
    setError(null);
    setLoading(true);
    try {
      const code = slotsToCode(slots);
      const response = await clueService.verifyCode(code);
      // Keep the payload in sessionStorage so a refresh keeps the clue, but never
      // in the URL (no referrer leaks, no shoulder-surfing).
      sessionStorage.setItem(UNLOCKED_CLUE_KEY, JSON.stringify(response.clue as UnlockedClue));
      navigate('/clue', { replace: true, state: { clue: response.clue } });
    } catch (caught) {
      const appError = toAppError(caught) as AppError;
      setError(appError.message);
      setSlots(Array.from({ length: CODE_LENGTH }, () => ''));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (next: string[]) => {
    setSlots(next);
    if (error) setError(null);
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 py-10 sm:px-8">
      <FadeIn>
        <div className="text-center">
          <p className="label-caps">Step 01 · Authenticate</p>
          <h1 className="mt-4 font-display text-2xl font-bold uppercase tracking-[0.22em] text-white sm:text-3xl">
            Enter your code
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-mist/80">
            Your code is a combination of exactly five letters and numbers. Case does not matter.
          </p>
        </div>
      </FadeIn>

      <FadeIn delay={0.15}>
        <div className="mt-10 w-full max-w-2xl rounded-2xl border border-white/10 bg-charcoal/60 px-4 py-8 backdrop-blur-xl sm:px-10 sm:py-10">
          <div className="flex justify-center">
            <CodeSlots
              value={slots}
              onChange={handleChange}
              onSubmit={handleSubmit}
              disabled={loading}
              invalid={Boolean(error)}
            />
          </div>

          <div className="mt-12 flex flex-col items-center gap-3">
            <Button
              size="lg"
              onClick={handleSubmit}
              loading={loading}
              loadingText="VERIFYING"
              disabled={!ready}
              className="w-full max-w-xs"
              icon={
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M4 7V5a1 1 0 011-1h3M20 7V5a1 1 0 00-1-1h-3M4 17v2a1 1 0 001 1h3m12-3v2a1 1 0 01-1 1h-3M8 12h8m-4-4v8" strokeLinecap="round" />
                </svg>
              }
            >
              Get Clue
            </Button>

            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-ash/60">
              Press Enter to submit · {slots.filter(Boolean).length}/{CODE_LENGTH} entered
            </p>
          </div>
        </div>
      </FadeIn>

      {error && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6 w-full max-w-md">
          <Alert kind="error" title="Access denied" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        </motion.div>
      )}

      <FadeIn delay={0.3}>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mt-10 font-mono text-[10px] uppercase tracking-[0.3em] text-ash transition-colors hover:text-crimson-soft"
        >
          ← Return to briefing
        </button>
      </FadeIn>
    </div>
  );
};

export default EnterCodePage;