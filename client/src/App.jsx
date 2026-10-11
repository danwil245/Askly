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
import { Home } from './pages/Home.jsx';
import { AudienceRoom } from './pages/AudienceRoom.jsx';
import { Login } from './pages/Login.jsx';
import { Signup } from './pages/Signup.jsx';
import { ToastProvider } from './hooks/useToast.jsx';
import { Toaster } from './components/shared/Toaster.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';

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
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/host/:code" element={<PresenterDashboard />} />
          <Route path="/r/:code" element={<AudienceRoom />} />
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

  // Only mount the Google provider when configured (empty clientId throws).
  return GOOGLE_CLIENT_ID ? (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>{tree}</GoogleOAuthProvider>
  ) : (
    tree
  );
}
