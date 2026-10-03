import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '../../../components/Button';
import { Alert, FadeIn } from '../../../components/ui';
import { clueService } from '../../../services/clueService';
import { toAppError } from '../../../services/apiClient';
import { useAuth } from '../../../context/AuthContext';
import type { Clue, ClueStats } from '../../../types';
import { formatDateTime } from '../../../utils/format';

const EMPTY_STATS: ClueStats = { totalClues: 0, activeClues: 0, inactiveClues: 0, generatedCodes: 0 };

const STAT_CARDS: { key: keyof ClueStats; label: string; accent: string }[] = [
  { key: 'totalClues', label: 'Total Clues', accent: 'from-crimson/20' },
  { key: 'activeClues', label: 'Active Clues', accent: 'from-emerald-400/20' },
  { key: 'inactiveClues', label: 'Inactive Clues', accent: 'from-amber/20' },
  { key: 'generatedCodes', label: 'Generated Codes', accent: 'from-electric/20' },
];

const AdminDashboardPage = () => {
  const navigate = useNavigate();
  const { admin } = useAuth();
  const [stats, setStats] = useState<ClueStats>(EMPTY_STATS);
  const [recent, setRecent] = useState<Clue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await clueService.list();
      setStats(response.stats);
      setRecent(response.clues.slice(0, 5));
    } catch (caught) {
      setError(toAppError(caught).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <FadeIn>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="label-caps">Scientific Files</p>
            <h1 className="mt-2 font-display text-2xl font-bold uppercase tracking-[0.2em] text-white sm:text-3xl">
              Admin Dashboard
            </h1>
            {admin?.email && <p className="mt-2 font-mono text-[11px] text-ash">Signed in as {admin.email}</p>}
          </div>

          <Button
            size="lg"
            onClick={() => navigate('/admin/upload')}
            icon={
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9">
                <path d="M12 16V4m0 0L7 9m5-5l5 5M4 17v2a1 1 0 001 1h14a1 1 0 001-1v-2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
          >
            Upload Clue
          </Button>
        </div>
      </FadeIn>

      {error && (
        <div className="mt-6">
          <Alert kind="error" title="Could not load the dashboard" onDismiss={() => setError(null)}>
            {error}
            <button type="button" onClick={() => void load()} className="ml-2 underline underline-offset-4">
              Retry
            </button>
          </Alert>
        </div>
      )}

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {STAT_CARDS.map((card, index) => (
          <FadeIn key={card.key} delay={0.06 * index}>
            <div className="stat-card">
              <div className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${card.accent} to-transparent`} />
              <p className="label-caps relative">{card.label}</p>
              {loading ? (
                <div className="relative mt-3 h-9 w-16 animate-pulse rounded bg-white/10" />
              ) : (
                <motion.p
                  key={stats[card.key]}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="relative mt-2 font-display text-3xl font-bold text-white sm:text-4xl"
                >
                  {stats[card.key]}
                </motion.p>
              )}
            </div>
          </FadeIn>
        ))}
      </div>
      <FadeIn delay={0.2}>
        <div className="mt-8 rounded-2xl border border-white/10 bg-charcoal/50 p-5 backdrop-blur-xl sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold uppercase tracking-[0.25em] text-white">
              Recent Clues
            </h2>
            <button
              type="button"
              onClick={() => navigate('/admin/clues')}
              className="font-mono text-[10px] uppercase tracking-[0.25em] text-crimson-soft transition-opacity hover:opacity-70"
            >
              Manage all →
            </button>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((row) => (
                <div key={row} className="h-12 animate-pulse rounded-lg bg-white/5" />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/[0.12] px-6 py-10 text-center">
              <p className="text-sm text-mist">No clues have been uploaded yet.</p>
              <Button size="sm" className="mt-4" onClick={() => navigate('/admin/upload')}>
                Upload your first clue
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              {recent.map((clue) => (
                <li key={clue.id} className="flex items-center gap-4 py-3">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      clue.isActive ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]' : 'bg-ash/50'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-white">{clue.title}</p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
                      {formatDateTime(clue.createdAt)} · {clue.isActive ? 'Active' : 'Inactive'}
                    </p>
                  </div>
                  <code className="rounded-md border border-crimson/30 bg-crimson/10 px-2.5 py-1 font-mono text-xs tracking-[0.2em] text-crimson-soft">
                    {clue.code}
                  </code>
                </li>
              ))}
            </ul>
          )}
        </div>
      </FadeIn>
    </div>
  );
};

export default AdminDashboardPage;