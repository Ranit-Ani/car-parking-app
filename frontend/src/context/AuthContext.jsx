import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearSession, getToken, getUser, setSession, setSessionExpiredHandler } from '../lib/api';
import { homeForRole } from '../lib/utils';
import { clearPageCache } from '../lib/pageCache';
import { rejoinSocketRooms } from '../lib/socket';

const AuthContext = createContext(null);

const DEFAULT_SESSION_EXPIRED_MESSAGE =
  'Your session has expired. Please log in again.';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getUser());
  // Non-null while a forced/terminated-session screen must block the whole
  // app (see setSessionExpiredHandler below). Shape: { message }.
  const [sessionExpired, setSessionExpired] = useState(null);
  const navigate = useNavigate();

  const login = useCallback((token, userObj) => {
    // A new login means a (possibly different) account's data is about to
    // load — never show a fresh login the previous session's cached pages.
    clearPageCache();
    setSession(token, userObj);
    setUser(userObj);
    // The shared socket connection (if one already exists from before this
    // login) stays connected across login/logout in the same tab, so it
    // won't naturally rejoin rooms for the new account on its own —
    // nudge it to do so now instead of waiting for a reconnect.
    rejoinSocketRooms(userObj);
  }, []);

  const updateUser = useCallback((patch) => {
    const merged = { ...getUser(), ...patch };
    localStorage.setItem('agp_user', JSON.stringify(merged));
    setUser(merged);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    clearPageCache();
    setUser(null);
    navigate('/login', { replace: true });
  }, [navigate]);

  // Wired up to apiRequest() once, here, so ANY API call anywhere in the
  // app — not just ones a page remembered to check — can pop the blocking
  // "your session ended" screen the moment the backend rejects a request
  // because this account's role/permissions changed (or the token expired,
  // or the account was deactivated). Revoking `user` immediately means
  // RequireAuth would also deny access to protected routes right away,
  // even though the overlay itself already blocks all interaction.
  useEffect(() => {
    setSessionExpiredHandler((body) => {
      setUser(null);
      setSessionExpired({ message: body?.message || DEFAULT_SESSION_EXPIRED_MESSAGE });
    });
    return () => setSessionExpiredHandler(null);
  }, []);

  // The ONLY way out of the blocking session-expired screen: fully clear
  // whatever's left of the old session and send the person to a clean
  // login page. Per the security requirement, this must not just refresh
  // the profile in place — a fresh login is required so the next JWT is
  // issued with the user's current (new) role and current tokenVersion.
  const confirmReLogin = useCallback(() => {
    clearSession();
    clearPageCache();
    setUser(null);
    setSessionExpired(null);
    navigate('/login', { replace: true });
  }, [navigate]);

  const redirectByRole = useCallback((role) => {
    navigate(homeForRole(role), { replace: true });
  }, [navigate]);

  const value = useMemo(
    () => ({ user, token: getToken(), login, logout, updateUser, redirectByRole, sessionExpired, confirmReLogin }),
    [user, login, logout, updateUser, redirectByRole, sessionExpired, confirmReLogin]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}