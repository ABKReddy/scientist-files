import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { VideoPlayer } from '../../components/VideoPlayer';
import { Button } from '../../components/Button';
import { clearUnlockedClue, readUnlockedClue } from '../../utils/unlockedClue';
import type { UnlockedClue } from '../../types';

const ClueVideoPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [clue] = useState<UnlockedClue | null>(
    () => (location.state as { clue?: UnlockedClue } | null)?.clue ?? readUnlockedClue()
  );

  useEffect(() => {
    // Direct navigation (refresh / deep link) without a valid session → back to code entry.
    if (!clue) navigate('/code', { replace: true });
  }, [clue, navigate]);

  const handleExit = () => {
    clearUnlockedClue();
    navigate('/code', { replace: true });
  };

  if (!clue) return null;

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-8 sm:py-12">
      <motion.div
        initial={{ opacity: 0, scale: 1.06, filter: 'blur(14px)' }}
        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        className="text-center"
      >
        <motion.p
          initial={{ opacity: 0, letterSpacing: '0.8em' }}
          animate={{ opacity: 1, letterSpacing: '0.4em' }}
          transition={{ duration: 1.1, delay: 0.2 }}
          className="font-mono text-xs uppercase text-crimson-soft sm:text-sm"
          style={{ textShadow: '0 0 20px rgba(255,45,85,0.6)' }}
        >
          Clue Unlocked
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.45 }}
          className="mt-4 font-display text-2xl font-bold uppercase tracking-[0.12em] text-white sm:text-4xl"
        >
          {clue.title}
        </motion.h1>

        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mx-auto mt-6 h-px w-52 bg-gradient-to-r from-transparent via-crimson/70 to-transparent"
        />
      </motion.div>

      {clue.description && (
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="mt-6 max-w-2xl text-center text-sm leading-relaxed text-mist"
        >
          {clue.description}
        </motion.p>
      )}

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.8 }}
        className="mt-8 w-full max-w-4xl"
      >
        {/* streamUrl is a short-lived, token-gated redirect — the raw storage URL is never rendered. */}
        <VideoPlayer src={clue.streamUrl || clue.videoUrl} title={clue.title} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 1.1 }}
        className="mt-8 flex w-full max-w-4xl flex-col items-center gap-3"
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-ash/60">
          Playback link expires in {Math.round(clue.expiresIn / 60)} minutes · Do not share this device
        </p>
        <Button variant="ghost" size="sm" onClick={handleExit}>
          Enter another code
        </Button>
      </motion.div>
    </div>
  );
};

export default ClueVideoPage;