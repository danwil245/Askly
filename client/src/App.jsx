import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Home } from './pages/Home.jsx';
import { AudienceRoom } from './pages/AudienceRoom.jsx';
import { ToastProvider } from './hooks/useToast.jsx';
import { Toaster } from './components/shared/Toaster.jsx';

// The presenter dashboard pulls in recharts; lazy-load it so the common audience and
// home routes (especially on mobile) don't download the charts bundle.
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

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/host/:code" element={<PresenterDashboard />} />
            <Route path="/r/:code" element={<AudienceRoom />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster />
    </ToastProvider>
  );
}
