import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button, Spinner } from '../../../components/Button';
import { Alert, FadeIn } from '../../../components/ui';
import { clueService } from '../../../services/clueService';
import { toAppError } from '../../../services/apiClient';
import { useToast } from '../../../context/ToastContext';
import type { Clue, UploadTicket } from '../../../types';
import { copyToClipboard, formatBytes } from '../../../utils/format';

const MAX_VIDEO_SIZE_MB = Number(import.meta.env.VITE_MAX_VIDEO_SIZE_MB ?? 200);
const ACCEPTED = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v', 'video/ogg'];
const ACCEPTED_EXTENSIONS = /\.(mp4|m4v|mov|webm|ogv)$/i;

type Stage = 'form' | 'uploaded' | 'created';

const UploadCluePage = () => {
  const navigate = useNavigate();
  const { push } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [stage, setStage] = useState<Stage>('form');
  const [ticket, setTicket] = useState<UploadTicket | null>(null);
  const [createdClue, setCreatedClue] = useState<Clue | null>(null);

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Object URLs leak if not revoked; clean up on every change and unmount.
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const validateFile = (candidate: File): string | null => {
    if (!ACCEPTED.includes(candidate.type) && !ACCEPTED_EXTENSIONS.test(candidate.name)) {
      return 'Unsupported file type. Please choose an MP4, WebM or MOV video.';
    }
    if (candidate.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
      return `Video is too large. Maximum file size is ${MAX_VIDEO_SIZE_MB} MB.`;
    }
    if (candidate.size === 0) return 'The selected file is empty.';
    return null;
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    setError(null);
    if (!selected) {
      setFile(null);
      return;
    }
    const message = validateFile(selected);
    if (message) {
      setFieldError(message);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setFieldError(null);
    setFile(selected);
  };

  const handleUpload = async (event: FormEvent) => {
    event.preventDefault();
    if (uploading) return;
    if (title.trim().length < 2) {
      setFieldError('Please enter a clue title (at least 2 characters).');
      return;
    }
    if (!file) {
      setFieldError('Please choose a video file to upload.');
      return;
    }

    setFieldError(null);
    setError(null);
    setUploading(true);
    setProgress(0);
    try {
      const response = await clueService.uploadVideo(file, (update) => setProgress(update.percent));
      setTicket(response.upload);
      setStage('uploaded');
      push('success', 'Video uploaded', 'The evidence file is stored in object storage.');
    } catch (caught) {
      setError(toAppError(caught).message);
    } finally {
      setUploading(false);
    }
  };

  const handleGenerateCode = async () => {
    if (!ticket || generating) return;
    setGenerating(true);
    setError(null);
    try {
      const response = await clueService.createClue({
        title: title.trim(),
        description: description.trim(),
        uploadToken: ticket.uploadToken,
      });
      setCreatedClue(response.clue);
      setStage('created');
      push('success', 'Clue created', `Code ${response.clue.code} is now active.`);
    } catch (caught) {
      setError(toAppError(caught).message);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!createdClue) return;
    const ok = await copyToClipboard(createdClue.code);
    if (ok) {
      setCopied(true);
      push('success', 'Code copied!', 'Paste it into the chat for your participants.');
      window.setTimeout(() => setCopied(false), 2200);
    } else {
      push('error', 'Copy failed', 'Select the code and copy it manually.');
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setFile(null);
    setTicket(null);
    setCreatedClue(null);
    setStage('form');
    setProgress(0);
    setError(null);
    setFieldError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const stageSteps = useMemo(
    () => [
      { key: 'form', label: 'Upload video' },
      { key: 'uploaded', label: 'Generate code' },
      { key: 'created', label: 'Share code' },
    ],
    []
  );
  const activeStep = stageSteps.findIndex((step) => step.key === stage);

  return (
    <div className="mx-auto w-full max-w-4xl">
      <FadeIn>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="label-caps">Scientific Files</p>
            <h1 className="mt-2 font-display text-2xl font-bold uppercase tracking-[0.2em] text-white sm:text-3xl">
              Upload Clue
            </h1>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/clues')}>
            Manage clues →
          </Button>
        </div>
      </FadeIn>

      {/* Stepper */}
      <FadeIn delay={0.1}>
        <ol className="mt-6 flex flex-wrap items-center gap-2 sm:gap-3">
          {stageSteps.map((step, index) => {
            const done = index < activeStep;
            const active = index === activeStep;
            return (
              <li key={step.key} className="flex items-center gap-2 sm:gap-3">
                <span
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors ${
                    active
                      ? 'border-crimson/50 bg-crimson/10 text-crimson-soft'
                      : done
                        ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
                        : 'border-white/10 text-ash/70'
                  }`}
                >
                  {done ? <span>✓</span> : <span>0{index + 1}</span>}
                  <span className="hidden sm:inline">{step.label}</span>
                </span>
                {index < stageSteps.length - 1 && (
                  <span className="h-px w-6 bg-white/15 sm:w-10" aria-hidden="true" />
                )}
              </li>
            );
          })}
        </ol>
      </FadeIn>

      {error && (
        <div className="mt-6">
          <Alert kind="error" title="Operation failed" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        </div>
      )}

      {stage === 'created' && createdClue && (
        <FadeIn>
          <div className="mt-8 glass-panel-strong overflow-hidden p-6 text-center sm:p-10">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18 }}
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-400/10"
            >
              <svg viewBox="0 0 24 24" className="h-7 w-7 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.div>

            <h2 className="mt-6 font-display text-lg font-bold uppercase tracking-[0.25em] text-white sm:text-xl">
              Clue Created Successfully
            </h2>
            <p className="mt-2 text-sm text-mist">Your clue code</p>

            <div className="mx-auto mt-6 inline-flex rounded-2xl border-2 border-crimson/40 bg-crimson/[0.07] px-8 py-5 shadow-glow-red">
              <code className="font-mono text-4xl font-bold tracking-[0.3em] text-white sm:text-5xl">
                {createdClue.code}
              </code>
            </div>

            <p className="mt-6 text-sm text-mist/80">
              Share this code with participants. It is the only way to unlock{' '}
              <span className="text-white">{createdClue.title}</span>.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button onClick={handleCopy} size="lg" icon={
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="9" y="9" width="12" height="12" rx="2" />
                  <path d="M5 15V5a2 2 0 012-2h10" strokeLinecap="round" />
                </svg>
              }>
                {copied ? 'Code copied!' : 'Copy Code'}
              </Button>
              <Button variant="secondary" size="lg" onClick={resetForm}>
                Upload another clue
              </Button>
              <Button variant="ghost" size="lg" onClick={() => navigate('/admin/clues')}>
                Manage clues
              </Button>
            </div>
          </div>
        </FadeIn>
      )}
      {stage === 'form' && (
        <FadeIn delay={0.15}>
          <form onSubmit={handleUpload} className="mt-8 grid gap-6 lg:grid-cols-2" noValidate>
            <div className="rounded-2xl border border-white/10 bg-charcoal/50 p-5 backdrop-blur-xl sm:p-6">
              <div>
                <label htmlFor="clue-title" className="label-caps mb-2 block">
                  Clue Title
                </label>
                <input
                  id="clue-title"
                  type="text"
                  value={title}
                  maxLength={120}
                  onChange={(event) => setTitle(event.target.value)}
                  className="field"
                  placeholder="Clue 01 — The Labelling Room"
                />
              </div>

              <div className="mt-5">
                <label htmlFor="clue-description" className="label-caps mb-2 block">
                  Description <span className="normal-case tracking-normal text-ash/50">(optional)</span>
                </label>
                <textarea
                  id="clue-description"
                  value={description}
                  maxLength={2000}
                  rows={4}
                  onChange={(event) => setDescription(event.target.value)}
                  className="field resize-none"
                  placeholder="What are the investigators looking at?"
                />
                <p className="mt-1 text-right font-mono text-[10px] text-ash/60">{description.length}/2000</p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-charcoal/50 p-5 backdrop-blur-xl sm:p-6">
              <p className="label-caps mb-3">Video</p>

              <label
                htmlFor="clue-video"
                className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-4 py-8 text-center transition-colors ${
                  file
                    ? 'border-emerald-400/40 bg-emerald-400/5'
                    : 'border-white/15 bg-white/[0.02] hover:border-crimson/40 hover:bg-crimson/[0.04]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  id="clue-video"
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,video/x-m4v,video/ogg,.mp4,.m4v,.mov,.webm,.ogv"
                  onChange={handleFileChange}
                  className="sr-only"
                />
                <svg viewBox="0 0 24 24" className="h-8 w-8 text-crimson-soft" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 16V4m0 0L7 9m5-5l5 5M4 17v2a1 1 0 001 1h14a1 1 0 001-1v-2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-sm text-mist">{file ? 'Choose a different file' : 'Choose Video'}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ash/60">
                  MP4 · WebM · MOV — max {MAX_VIDEO_SIZE_MB} MB
                </span>
              </label>

              {file && (
                <div className="mt-4">
                  <p className="truncate text-sm text-white">{file.name}</p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
                    {formatBytes(file.size)} · {file.type || 'video/mp4'}
                  </p>
                </div>
              )}

              {previewUrl && (
                <motion.video
                  key={previewUrl}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  src={previewUrl}
                  controls
                  preload="metadata"
                  className="mt-4 aspect-video w-full rounded-xl border border-white/10 bg-black"
                />
              )}
              {uploading && (
                <div className="mt-4">
                  <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
                    <span>Uploading</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-crimson to-electric"
                      animate={{ width: `${progress}%` }}
                      transition={{ ease: 'easeOut', duration: 0.2 }}
                    />
                  </div>
                </div>
              )}

              {fieldError && (
                <div className="mt-4">
                  <Alert kind="error" onDismiss={() => setFieldError(null)}>
                    {fieldError}
                  </Alert>
                </div>
              )}

              <Button
                type="submit"
                fullWidth
                size="lg"
                className="mt-6"
                loading={uploading}
                loadingText="UPLOADING"
                disabled={!file || title.trim().length < 2}
              >
                Upload Clue
              </Button>
            </div>
          </form>
        </FadeIn>
      )}
      {stage === 'uploaded' && (
        <FadeIn>
          <div className="mt-8 glass-panel-strong p-6 text-center sm:p-10">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-400/10">
              <svg viewBox="0 0 24 24" className="h-7 w-7 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            <h2 className="mt-6 font-display text-lg font-bold uppercase tracking-[0.25em] text-white sm:text-xl">
              Video Uploaded Successfully
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-mist/80">
              The file is in storage
              {ticket ? ` (${formatBytes(ticket.bytes)} · ${ticket.format.toUpperCase()})` : ''}. Now generate
              the participant code — the server creates a unique 5-character code and saves the clue.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" onClick={handleGenerateCode} loading={generating} loadingText="GENERATING CODE">
                Generate Code
              </Button>
              <Button variant="ghost" size="lg" onClick={resetForm} disabled={generating}>
                Start over
              </Button>
            </div>

            {generating && (
              <p className="mt-4 flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-ash">
                <Spinner className="h-3 w-3" /> Cryptographically random · checking uniqueness
              </p>
            )}
          </div>
        </FadeIn>
      )}
    </div>
  );
};

export default UploadCluePage;