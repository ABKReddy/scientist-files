import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Spinner } from './Button';

const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

interface VideoPlayerProps {
  src: string;
  title: string;
  className?: string;
}

/**
 * Custom cinematic player: play/pause, seek bar with buffered range, volume,
 * mute, fullscreen, picture-in-picture and keyboard shortcuts.
 */
export const VideoPlayer = ({ src, title, className = '' }: VideoPlayerProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hideTimer = useRef<number | null>(null);

  const [playing, setPlaying] = useState(false);
  const [waiting, setWaiting] = useState(true);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    if (playing) {
      hideTimer.current = window.setTimeout(() => setControlsVisible(false), 2600);
    }
  }, [playing]);

  // Autoplay is best-effort: browsers block it unless the video is muted.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const attempt = video.play();
    if (attempt && typeof attempt.catch === 'function') {
      attempt.catch(() => {
        setPlaying(false);
        setWaiting(false);
      });
    }
  }, [src]);

  useEffect(() => {
    const onFullscreenChange = () => setFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  useEffect(
    () => () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    },
    []
  );

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().catch(() => setError('Playback was blocked by the browser. Press play to start.'));
    } else {
      video.pause();
    }
  }, []);

  const seekBy = useCallback((delta: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(Math.max(video.currentTime + delta, 0), video.duration || 0);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await containerRef.current.requestFullscreen();
    } catch {
      setError('Fullscreen is not available in this browser.');
    }
  }, []);

  const togglePictureInPicture = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !document.pictureInPictureEnabled) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await video.requestPictureInPicture();
    } catch {
      /* unsupported — ignore */
    }
  }, []);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).tagName === 'INPUT') return;
    switch (event.key) {
      case ' ':
      case 'k':
        event.preventDefault();
        togglePlay();
        break;
      case 'ArrowRight':
        event.preventDefault();
        seekBy(5);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        seekBy(-5);
        break;
      case 'm': {
        const next = !muted;
        setMuted(next);
        if (videoRef.current) videoRef.current.muted = next;
        break;
      }
      case 'f':
        void toggleFullscreen();
        break;
      default:
        break;
    }
  };

  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = Number(event.target.value);
    if (videoRef.current) videoRef.current.currentTime = next;
    setProgress(next);
  };

  const playedPercent = duration ? (progress / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onMouseMove={revealControls}
      onMouseLeave={() => playing && setControlsVisible(false)}
      className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-black shadow-glass outline-none ${className}`}
      aria-label={`Player for ${title}`}
    >
      <video
        ref={videoRef}
        src={src}
        className="block aspect-video w-full bg-black"
        playsInline
        preload="metadata"
        onClick={togglePlay}
        onDoubleClick={() => void toggleFullscreen()}
        onPlay={() => {
          setPlaying(true);
          setWaiting(false);
          revealControls();
        }}
        onPause={() => setPlaying(false)}
        onWaiting={() => setWaiting(true)}
        onCanPlay={() => setWaiting(false)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
        onTimeUpdate={(event) => {
          const video = event.currentTarget;
          setProgress(video.currentTime);
          if (video.buffered.length > 0) setBuffered(video.buffered.end(video.buffered.length - 1));
        }}
        onEnded={() => setPlaying(false)}
        onError={() => setError('This video could not be loaded. Check your connection and try again.')}
      />

      <AnimatePresence>
        {!playing && !error && (
          <motion.button
            type="button"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/35 backdrop-blur-[2px]"
            aria-label="Play video"
          >
            <span className="relative flex h-20 w-20 items-center justify-center rounded-full border border-crimson/50 bg-crimson/20 shadow-glow-red">
              <span className="absolute inset-0 animate-pulse-ring rounded-full border border-crimson/50" />
              <svg viewBox="0 0 24 24" className="ml-1 h-8 w-8 text-white" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {waiting && !error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Spinner className="h-10 w-10 text-white/[0.08]0" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 px-6 text-center">
          <p className="text-sm text-crimson-soft">{error}</p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              const video = videoRef.current;
              if (video) {
                video.load();
                void video.play().catch(() => undefined);
              }
            }}
            className="btn-secondary px-5 py-2 text-[11px]"
          >
            Retry
          </button>
        </div>
      )}
      <AnimatePresence>
        {(controlsVisible || !playing) && !error && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-3 pb-3 pt-8 sm:px-4"
          >
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={progress}
              onChange={handleSeek}
              aria-label="Seek"
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full outline-none accent-crimson
                         [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none
                         [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-crimson
                         [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full
                         [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-crimson"
              style={{
                background: `linear-gradient(to right, #ff2d55 ${playedPercent}%, rgba(255,255,255,${
                  0.12 + (duration ? (buffered / duration) * 0.2 : 0)
                }) ${playedPercent}%)`,
              }}
            />

            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={togglePlay}
                className="rounded-lg p-1.5 text-white transition-colors hover:text-crimson"
                aria-label={playing ? 'Pause' : 'Play'}
              >
                {playing ? (
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                    <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              <span className="font-mono text-[11px] tabular-nums text-white/[0.08]0">
                {formatTime(progress)} <span className="text-white/35">/ {formatTime(duration)}</span>
              </span>
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const next = !muted;
                    setMuted(next);
                    if (videoRef.current) videoRef.current.muted = next;
                  }}
                  className="rounded-lg p-1.5 text-white/90 transition-colors hover:text-crimson"
                  aria-label={muted ? 'Unmute' : 'Mute'}
                >
                  {muted || volume === 0 ? (
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M11 5L6 9H3v6h3l5 4V5z" strokeLinejoin="round" />
                      <path d="M16 9l4 6m0-6l-4 6" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M11 5L6 9H3v6h3l5 4V5z" strokeLinejoin="round" />
                      <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" strokeLinecap="round" />
                    </svg>
                  )}
                </button>

                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={muted ? 0 : volume}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    setVolume(next);
                    setMuted(next === 0);
                    if (videoRef.current) {
                      videoRef.current.volume = next;
                      videoRef.current.muted = next === 0;
                    }
                  }}
                  aria-label="Volume"
                  className="hidden h-1 w-20 cursor-pointer appearance-none rounded-full bg-white/20 accent-crimson sm:block
                             [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none
                             [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                />

                {document.pictureInPictureEnabled && (
                  <button
                    type="button"
                    onClick={() => void togglePictureInPicture()}
                    className="hidden rounded-lg p-1.5 text-white/90 transition-colors hover:text-crimson sm:block"
                    aria-label="Picture in picture"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <rect x="12" y="11" width="7" height="5" rx="1" />
                    </svg>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => void toggleFullscreen()}
                  className="rounded-lg p-1.5 text-white/90 transition-colors hover:text-crimson"
                  aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                >
                  {fullscreen ? (
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M9 3v6H3M15 3v6h6M9 21v-6H3m12 6v-6h6" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M3 9V5a2 2 0 0 1 2-2h4M21 9V5a2 2 0 0 0-2-2h-4M3 15v4a2 2 0 0 0 2 2h4m12-6v4a2 2 0 0 1-2 2h-4" strokeLinecap="round" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};