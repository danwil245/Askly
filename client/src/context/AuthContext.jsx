import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, setAuthToken, setUnauthorizedHandler } from '../api/http.js';
import { setSocketAuth } from '../socket/socket.js';

const TOKEN_KEY = 'askly.token';
const AuthContext = createContext(null);

function readToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
function writeToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(() => readToken());
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!token);
  // Where to send the user on a 401 (set by the component tree via onUnauthorized).
  const unauthorizedRef = useRef(null);

  const applyToken = useCallback((nextToken) => {
    setTokenState(nextToken);
    writeToken(nextToken);
    setAuthToken(nextToken);
    setSocketAuth(nextToken);
  }, []);

  const logout = useCallback(() => {
    applyToken(null);
    setUser(null);
  }, [applyToken]);

  // Keep the http layer's token + 401 handler in sync.
  useEffect(() => {
    setAuthToken(token);
    setSocketAuth(token);
    setUnauthorizedHandler(() => {
      applyToken(null);
      setUser(null);
      unauthorizedRef.current?.();
    });
  }, [token, applyToken]);

  // On boot (or token change), resolve the current user.
  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setUser(null);
      setLoading(false);
      return () => {};
    }
    setLoading(true);
    api
      .me()
      .then((res) => !cancelled && setUser(res.user))
      .catch(() => !cancelled && setUser(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleAuthResult = useCallback(
    ({ token: newToken, user: newUser }) => {
      applyToken(newToken);
      setUser(newUser);
      return newUser;
    },
    [applyToken]
  );

  const login = useCallback(
    async (email, password) => handleAuthResult(await api.login({ email, password })),
    [handleAuthResult]
  );
  const signup = useCallback(
    async (name, email, password) => handleAuthResult(await api.signup({ name, email, password })),
    [handleAuthResult]
  );
  const googleLogin = useCallback(
    async (idToken) => handleAuthResult(await api.google(idToken)),
    [handleAuthResult]
  );

  const setUnauthorizedRedirect = useCallback((fn) => {
    unauthorizedRef.current = fn;
  }, []);

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      isAuthenticated: !!user,
      login,
      signup,
      googleLogin,
      logout,
      setUnauthorizedRedirect,
    }),
    [token, user, loading, login, signup, googleLogin, logout, setUnauthorizedRedirect]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
