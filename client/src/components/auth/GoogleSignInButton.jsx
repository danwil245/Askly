import { useEffect, useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { api } from '../../api/http.js';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

/**
 * Renders the Google sign-in button only when Google is configured on BOTH sides
 * (VITE_GOOGLE_CLIENT_ID present and the server reports googleEnabled). Otherwise
 * renders nothing (spec section 6).
 */
export function GoogleSignInButton({ onCredential, onError }) {
  const [serverEnabled, setServerEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .health()
      .then((h) => !cancelled && setServerEnabled(!!h.googleEnabled))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!CLIENT_ID || !serverEnabled) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="flex justify-center">
        <GoogleLogin
          onSuccess={(cred) => onCredential(cred.credential)}
          onError={() => onError?.('Google sign-in failed')}
          useOneTap={false}
          theme="outline"
          size="large"
          text="continue_with"
          shape="pill"
        />
      </div>
    </div>
  );
}
