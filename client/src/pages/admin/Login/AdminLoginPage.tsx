import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BrandMark, ClassifiedStamp } from '../../../components/Brand';
import { Button, Spinner } from '../../../components/Button';
import { Alert, FadeIn } from '../../../components/ui';
import { Backdrop } from '../../../components/ParticleField';
import { useAuth } from '../../../context/AuthContext';
import { toAppError } from '../../../services/apiClient';
import type { AppError } from '../../../types';

const AdminLoginPage = () => {
  const { login, sessionNotice, clearSessionNotice } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/admin/dashboard';

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate(redirectTo, { replace: true });
    } catch (caught) {
      setError((toAppError(caught) as AppError).message);
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="noise-overlay relative flex min-h-screen flex-col items-center justify-center px-5 py-10">
      <Backdrop />

      <FadeIn className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <BrandMark />
        </div>

        <div className="glass-panel-strong p-6 sm:p-8">
          <div className="mb-6 text-center">
            <ClassifiedStamp label="Restricted access" />
            <h1 className="mt-4 font-display text-xl font-bold uppercase tracking-[0.25em] text-white sm:text-2xl">
              Admin Login
            </h1>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.3em] text-ash/70">
              Credentials required
            </p>
          </div>

          {sessionNotice && (
            <div className="mb-5">
              <Alert kind="warning" onDismiss={clearSessionNotice}>
                {sessionNotice}
              </Alert>
            </div>
          )}

          {error && (
            <div className="mb-5">
              <Alert kind="error" title="Authentication failed" onDismiss={() => setError(null)}>
                {error}
              </Alert>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="email" className="label-caps mb-2 block">
                Username / Email
              </label>
              <input
                id="email"
                type="email"
                name="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="field"
                placeholder="chief@scientificfiles.local"
              />
            </div>
            <div>
              <label htmlFor="password" className="label-caps mb-2 block">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="field pr-12"
                  placeholder="••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ash transition-colors hover:text-white"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.2A9.7 9.7 0 0112 5c5 0 9 4.5 9 7a11 11 0 01-2.6 3.6M6.6 6.6C4.2 8.2 3 10.3 3 12c0 2.5 4 7 9 7 1.3 0 2.5-.3 3.6-.8" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              fullWidth
              size="lg"
              loading={loading}
              loadingText="AUTHENTICATING"
              disabled={!email || !password}
              className="mt-2"
            >
              Login
            </Button>
          </form>

          <div className="mt-6 flex items-center gap-2 border-t border-white/[0.08] pt-4 font-mono text-[10px] uppercase tracking-[0.25em] text-ash/60">
            {loading ? <Spinner className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
            Session secured with httpOnly cookies
          </div>
        </div>
      </FadeIn>

      <motion.a
        href="/"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="relative z-10 mt-8 font-mono text-[10px] uppercase tracking-[0.3em] text-ash/60 transition-colors hover:text-crimson-soft"
      >
        ← Back to Scientific Files
      </motion.a>
    </div>
  );
};

export default AdminLoginPage;