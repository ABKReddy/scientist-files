import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Button, Spinner } from '../../../components/Button';
import { Alert, FadeIn } from '../../../components/ui';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { VideoPlayer } from '../../../components/VideoPlayer';
import { clueService } from '../../../services/clueService';
import { toAppError } from '../../../services/apiClient';
import { useToast } from '../../../context/ToastContext';
import type { Clue, ClueStats } from '../../../types';
import { copyToClipboard, formatDateTime } from '../../../utils/format';

type StatusFilter = 'all' | 'active' | 'inactive';

const EMPTY_STATS: ClueStats = { totalClues: 0, activeClues: 0, inactiveClues: 0, generatedCodes: 0 };

const StatusPill = ({ active }: { active: boolean }) => (
  <span
    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] ${
      active
        ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
        : 'border-white/[0.12] bg-white/5 text-ash'
    }`}
  >
    {active ? 'Active' : 'Inactive'}
  </span>
);

const RowActions = ({
  clue,
  busy,
  onView,
  onToggle,
  onDelete,
}: {
  clue: Clue;
  busy: boolean;
  onView: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) => (
  <div className="flex flex-wrap items-center justify-end gap-2">
    <Button variant="ghost" size="sm" onClick={onView}>
      View
    </Button>
    <Button variant="secondary" size="sm" onClick={onToggle} loading={busy} loadingText="…">
      {clue.isActive ? 'Disable' : 'Enable'}
    </Button>
    <Button variant="danger" size="sm" onClick={onDelete} disabled={busy}>
      Delete
    </Button>
    {busy && <Spinner className="h-3 w-3 text-ash" />}
  </div>
);

const ManageCluesPage = () => {
  const navigate = useNavigate();
  const { push } = useToast();

  const [clues, setClues] = useState<Clue[]>([]);
  const [stats, setStats] = useState<ClueStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');

  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Clue | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewing, setViewing] = useState<Clue | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await clueService.list({ search: search.trim() || undefined, status });
      setClues(response.clues);
      setStats(response.stats);
    } catch (caught) {
      setError(toAppError(caught).message);
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), search ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [load, search]);

  const toggleStatus = async (clue: Clue) => {
    if (busyId) return;
    setBusyId(clue.id);
    try {
      const response = await clueService.setStatus(clue.id, !clue.isActive);
      setClues((current) => current.map((item) => (item.id === clue.id ? response.clue : item)));
      setStats((current) => ({
        ...current,
        activeClues: current.activeClues + (clue.isActive ? -1 : 1),
        inactiveClues: current.inactiveClues + (clue.isActive ? 1 : -1),
      }));
      push('success', response.message, `${clue.title} is now ${clue.isActive ? 'disabled' : 'enabled'}.`);
    } catch (caught) {
      push('error', 'Update failed', toAppError(caught).message);
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    try {
      await clueService.remove(pendingDelete.id);
      setClues((current) => current.filter((item) => item.id !== pendingDelete.id));
      setStats((current) => ({
        ...current,
        totalClues: Math.max(0, current.totalClues - 1),
        generatedCodes: Math.max(0, current.generatedCodes - 1),
        activeClues: pendingDelete.isActive ? Math.max(0, current.activeClues - 1) : current.activeClues,
        inactiveClues: pendingDelete.isActive ? current.inactiveClues : Math.max(0, current.inactiveClues - 1),
      }));
      push('success', 'Clue deleted', `${pendingDelete.title} and its video have been removed.`);
      setPendingDelete(null);
    } catch (caught) {
      push('error', 'Delete failed', toAppError(caught).message);
    } finally {
      setDeleting(false);
    }
  };

  const handleCopyCode = async (clue: Clue) => {
    const ok = await copyToClipboard(clue.code);
    push(ok ? 'success' : 'error', ok ? 'Code copied!' : 'Copy failed', ok ? clue.code : 'Copy it manually.');
  };

  const filters = useMemo(
    () => [
      { key: 'all' as const, label: 'All' },
      { key: 'active' as const, label: 'Active' },
      { key: 'inactive' as const, label: 'Inactive' },
    ],
    []
  );

  return (
    <div className="mx-auto w-full max-w-6xl">
      <FadeIn>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="label-caps">Scientific Files</p>
            <h1 className="mt-2 font-display text-2xl font-bold uppercase tracking-[0.2em] text-white sm:text-3xl">
              Manage Clues
            </h1>
            <p className="mt-2 font-mono text-[11px] text-ash">
              {stats.totalClues} total · {stats.activeClues} active · {stats.inactiveClues} inactive
            </p>
          </div>
          <Button onClick={() => navigate('/admin/upload')} size="md">
            Upload Clue
          </Button>
        </div>
      </FadeIn>

      {error && (
        <div className="mt-6">
          <Alert kind="error" title="Could not load clues" onDismiss={() => setError(null)}>
            {error}
            <button type="button" onClick={() => void load()} className="ml-2 underline underline-offset-4">
              Retry
            </button>
          </Alert>
        </div>
      )}

      <FadeIn delay={0.1}>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {filters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setStatus(filter.key)}
                className={`rounded-lg border px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors ${
                  status === filter.key
                    ? 'border-crimson/50 bg-crimson/10 text-crimson-soft'
                    : 'border-white/10 text-ash hover:border-white/25 hover:text-white'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="relative sm:w-72">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search title or code…"
              aria-label="Search clues"
              className="field pr-9"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ash hover:text-white"
                aria-label="Clear search"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </FadeIn>
      <FadeIn delay={0.15}>
        {loading ? (
          <div className="mt-6 space-y-2">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="h-16 animate-pulse rounded-xl bg-white/5" />
            ))}
          </div>
        ) : clues.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-white/[0.12] px-6 py-16 text-center">
            <p className="text-sm text-mist">
              {search || status !== 'all'
                ? 'No clues match this filter.'
                : 'No clues yet — upload your first one.'}
            </p>
            <Button className="mt-5" onClick={() => navigate('/admin/upload')}>
              Upload Clue
            </Button>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="mt-6 hidden overflow-hidden rounded-2xl border border-white/10 bg-charcoal/40 backdrop-blur-xl lg:block">
              <table className="w-full text-left">
                <thead className="border-b border-white/10 bg-white/[0.03]">
                  <tr className="font-mono text-[10px] uppercase tracking-[0.25em] text-ash">
                    <th className="px-5 py-3.5 font-normal">Clue</th>
                    <th className="px-5 py-3.5 font-normal">Code</th>
                    <th className="px-5 py-3.5 font-normal">Video</th>
                    <th className="px-5 py-3.5 font-normal">Status</th>
                    <th className="px-5 py-3.5 font-normal">Created</th>
                    <th className="px-5 py-3.5 text-right font-normal">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {clues.map((clue) => (
                    <tr key={clue.id} className="transition-colors hover:bg-white/[0.03]">
                      <td className="px-5 py-4">
                        <p className="text-sm text-white">{clue.title}</p>
                        {clue.description && (
                          <p className="mt-0.5 max-w-xs truncate text-xs text-ash">{clue.description}</p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => void handleCopyCode(clue)}
                          title="Copy code"
                          className="rounded-md border border-crimson/30 bg-crimson/10 px-2.5 py-1 font-mono text-xs tracking-[0.2em] text-crimson-soft transition-colors hover:border-crimson/60"
                        >
                          {clue.code}
                        </button>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          {clue.storageProvider}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <StatusPill active={clue.isActive} />
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-mist">{formatDateTime(clue.createdAt)}</td>
                      <td className="px-5 py-4">
                        <RowActions
                          clue={clue}
                          busy={busyId === clue.id}
                          onView={() => setViewing(clue)}
                          onToggle={() => void toggleStatus(clue)}
                          onDelete={() => setPendingDelete(clue)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <ul className="mt-6 space-y-3 lg:hidden">
              {clues.map((clue) => (
                <li key={clue.id} className="rounded-2xl border border-white/10 bg-charcoal/50 p-4 backdrop-blur-xl">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-white">{clue.title}</p>
                      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
                        {formatDateTime(clue.createdAt)}
                      </p>
                    </div>
                    <StatusPill active={clue.isActive} />
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleCopyCode(clue)}
                    className="mt-3 rounded-md border border-crimson/30 bg-crimson/10 px-3 py-1.5 font-mono text-sm tracking-[0.25em] text-crimson-soft"
                  >
                    {clue.code}
                  </button>

                  <div className="mt-4">
                    <RowActions
                      clue={clue}
                      busy={busyId === clue.id}
                      onView={() => setViewing(clue)}
                      onToggle={() => void toggleStatus(clue)}
                      onDelete={() => setPendingDelete(clue)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </FadeIn>
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete clue"
        message={`Are you sure you want to delete this clue? “${pendingDelete?.title ?? ''}” and its video will be permanently removed. This cannot be undone.`}
        loading={deleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />

      <AnimatePresence>
        {viewing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] flex items-center justify-center p-4"
          >
            <div
              className="absolute inset-0 bg-void/85 backdrop-blur-sm"
              onClick={() => setViewing(null)}
              aria-hidden="true"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              role="dialog"
              aria-modal="true"
              aria-label={`Preview ${viewing.title}`}
              className="glass-panel-strong relative w-full max-w-3xl overflow-hidden p-5 sm:p-6"
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="label-caps">Clue preview</p>
                  <h2 className="mt-1.5 font-display text-lg font-bold uppercase tracking-[0.15em] text-white">
                    {viewing.title}
                  </h2>
                  <p className="mt-1 font-mono text-[11px] text-ash">
                    Code <span className="text-crimson-soft">{viewing.code}</span> ·{' '}
                    {viewing.isActive ? 'Active' : 'Inactive'} · {viewing.storageProvider}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setViewing(null)}
                  className="rounded-lg border border-white/[0.12] p-2 text-mist transition-colors hover:border-crimson/40 hover:text-white"
                  aria-label="Close preview"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              {viewing.description && (
                <p className="mb-4 text-sm leading-relaxed text-mist">{viewing.description}</p>
              )}

              <VideoPlayer src={viewing.videoUrl} title={viewing.title} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ManageCluesPage;