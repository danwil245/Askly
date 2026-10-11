import { lazy, Suspense, useEffect } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { Landing } from './pages/Landing.jsx';
import { AudienceRoom } from './pages/AudienceRoom.jsx';
import { Login } from './pages/Login.jsx';
import { Signup } from './pages/Signup.jsx';
import { ComingSoon } from './pages/ComingSoon.jsx';
import { SpeakerHub } from './pages/SpeakerHub.jsx';
import { History } from './pages/History.jsx';
import { SessionReport } from './pages/SessionReport.jsx';
import { ToastProvider } from './hooks/useToast.jsx';
import { Toaster } from './components/shared/Toaster.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { RequireAuth } from './lib/guards.jsx';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

// The presenter dashboard pulls in recharts; lazy-load it so common routes stay lean.
const PresenterDashboard = lazy(() =>
  import('./pages/PresenterDashboard.jsx').then((m) => ({ default: m.PresenterDashboard }))
);

function RouteFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg">
      <span
        className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}

/** Bridges the http layer's 401 handler to router navigation (→ /login?next=). */
function UnauthorizedBridge() {
  const { setUnauthorizedRedirect } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    setUnauthorizedRedirect(() => {
      const next = encodeURIComponent(location.pathname + location.search);
      navigate(`/login?next=${next}`, { replace: true });
    });
  }, [setUnauthorizedRedirect, navigate, location]);
  return null;
}

function AppRoutes() {
  return (
    <>
      <UnauthorizedBridge />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Hubs (built out in later phases) */}
          <Route
            path="/speaker"
            element={
              <RequireAuth>
                <SpeakerHub />
              </RequireAuth>
            }
          />
          <Route
            path="/history/:roomCode"
            element={
              <RequireAuth>
                <History />
              </RequireAuth>
            }
          />
          <Route
            path="/history/session/:sessionId"
            element={
              <RequireAuth>
                <SessionReport />
              </RequireAuth>
            }
          />
          <Route
            path="/mentor"
            element={
              <RequireAuth>
                <ComingSoon title="Mentor hub" note="Chapters and reusable course rooms." />
              </RequireAuth>
            }
          />
          <Route
            path="/quiz"
            element={
              <RequireAuth>
                <ComingSoon title="Quiz hub" note="Build and host live quizzes." />
              </RequireAuth>
            }
          />

          {/* Quiz player (public, built in Phase 6) */}
          <Route path="/play/:code" element={<ComingSoon title="Quiz" note="The quiz player is coming soon." />} />

          {/* Q&A / Mentor rooms */}
          <Route
            path="/host/:code"
            element={
              <RequireAuth>
                <PresenterDashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/r/:code"
            element={
              <RequireAuth>
                <AudienceRoom />
              </RequireAuth>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}

export default function App() {
  const tree = (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
        <Toaster />
      </AuthProvider>
    </ToastProvider>
  );

  return GOOGLE_CLIENT_ID ? (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>{tree}</GoogleOAuthProvider>
  ) : (
    tree
  );
}
