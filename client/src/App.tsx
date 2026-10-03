import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import PublicLayout from './layouts/PublicLayout';
import AdminLayout from './layouts/AdminLayout';
import WelcomePage from './pages/Welcome/WelcomePage';
import EnterCodePage from './pages/EnterCode/EnterCodePage';
import ClueVideoPage from './pages/ClueVideo/ClueVideoPage';
import AdminLoginPage from './pages/admin/Login/AdminLoginPage';
import AdminDashboardPage from './pages/admin/Dashboard/AdminDashboardPage';
import UploadCluePage from './pages/admin/UploadClue/UploadCluePage';
import ManageCluesPage from './pages/admin/ManageClues/ManageCluesPage';
import { useAuth } from './context/AuthContext';
import { FullPageLoader } from './components/ui';

const FullscreenLoader = () => (
  <div className="flex min-h-screen items-center justify-center">
    <FullPageLoader label="Verifying credentials…" />
  </div>
);

/** Unauthenticated visitors are sent to /admin/login; authed ones to the dashboard. */
const RequireAdmin = ({ children }: { children: JSX.Element }) => {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'checking') return <FullscreenLoader />;
  if (status === 'anonymous') return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  return children;
};

const GuestOnly = ({ children }: { children: JSX.Element }) => {
  const { status } = useAuth();
  if (status === 'checking') return <FullscreenLoader />;
  if (status === 'authenticated') return <Navigate to="/admin/dashboard" replace />;
  return children;
};

/** Rendered inside PublicLayout (the `*` route), so no extra layout wrapper. */
const NotFound = () => (
  <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
    <p className="font-mono text-xs uppercase tracking-[0.4em] text-crimson">Error 404</p>
    <h1 className="font-display text-3xl font-bold uppercase tracking-[0.3em] text-white">File Not Found</h1>
    <p className="max-w-md text-sm text-mist">The page you are looking for is not part of this investigation.</p>
    <a href="/" className="btn-primary">
      Return to base
    </a>
  </div>
);

const App = () => (
  <Routes>
    {/* ── Public / participant ─────────────────────────────────────────── */}
    <Route element={<PublicLayout />}>
      <Route path="/" element={<WelcomePage />} />
      <Route path="/code" element={<EnterCodePage />} />
      <Route path="/clue" element={<ClueVideoPage />} />
      <Route path="*" element={<NotFound />} />
    </Route>

    {/* ── Admin ────────────────────────────────────────────────────────── */}
    <Route
      path="/admin/login"
      element={
        <GuestOnly>
          <AdminLoginPage />
        </GuestOnly>
      }
    />
    <Route
      path="/admin"
      element={
        <RequireAdmin>
          <AdminLayout />
        </RequireAdmin>
      }
    >
      <Route index element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="dashboard" element={<AdminDashboardPage />} />
      <Route path="upload" element={<UploadCluePage />} />
      <Route path="clues" element={<ManageCluesPage />} />
    </Route>
  </Routes>
);

export default App;
