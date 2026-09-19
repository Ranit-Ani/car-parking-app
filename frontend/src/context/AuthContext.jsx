import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest, clearSession, getToken, getUser, setSession, setSessionExpiredHandler } from '../lib/api';
import { homeForRole } from '../lib/utils';
import { clearPageCache } from '../lib/pageCache';
import { rejoinSocketRooms } from '../lib/socket';
import { useRevalidate } from '../lib/useRevalidate';
import { getIsOnline } from '../lib/network';

const AuthContext = createContext(null);

const DEFAULT_SESSION_EXPIRED_MESSAGE =
  'Your session has expired. Please log in again.';

export function AuthProvider({ children }) {
  // Seeded SYNCHRONOUSLY from localStorage, before the first paint. This is
  // what "restores the persisted session before deciding what to show"
  // actually means in practice: by the time Landing (or RequireAuth) runs
  // its very first render, `user`/getToken() already reflect any saved
  // session — with no dependency on the network being up, so an offline
  // cold start still routes an already-logged-in person to their dashboard
  // instead of the public Landing page.
  const [user, setUser] = useState(() => getUser());
  // Non-null while a forced/terminated-session screen must block the whole
  // app (see setSessionExpiredHandler below). Shape: { message }.
  const [sessionExpired, setSessionExpired] = useState(null);
  const navigate = useNavigate();
  // Guards against two /auth/me calls racing each other (e.g. a network
  // reconnect and an app resume firing close together).
  const refreshingRef = useRef(false);

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

  // The `user` state above is seeded from whatever this DEVICE's
  // localStorage happened to cache the last time it logged in or saved a
  // profile change locally (see updateUser). That cache goes stale the
  // moment the account is edited from *another* device/tab/browser: this
  // device has no way to know its copy is outdated until something tells
  // it. The Profile page masks this by always fetching '/auth/me' itself
  // on mount, which is why the name looked "fixed" there while the
  // Sidebar/Dashboard — which only ever read the cached `user` from this
  // context — kept showing whatever name was cached the last time this
  // device logged in. Refreshing from the server (whenever a session
  // exists) keeps every device's header/sidebar/dashboard in sync with the
  // account's actual current data, not just the page that happens to fetch
  // it itself.
  //
  // refreshSession() is also what makes the app recover on its own once
  // connectivity returns (see useRevalidate() below): it distinguishes
  // "no internet right now" from "this session is no longer valid" —
  //  - offline / request failed: apiRequest() returns null here and the
  //    saved session is left exactly as it is. It is NOT cleared just
  //    because this call couldn't reach the server.
  //  - session actually invalid/expired: the backend answers with a 401 +
  //    one of SESSION_TERMINATION_CODES, which apiRequest() itself already
  //    catches — that's what pops the blocking "session ended" screen via
  //    setSessionExpiredHandler below, completely independent of this
  //    effect's success/failure.
  const refreshSession = useCallback(async () => {
    if (!getToken() || refreshingRef.current) return;
    // Skip outright while offline instead of firing a request that's
    // guaranteed to fail — it'll run again the moment useRevalidate()
    // sees the device come back online.
    if (!getIsOnline()) return;
    refreshingRef.current = true;
    try {
      const d = await apiRequest('/auth/me');
      // Guard against a race: on a slow connection (a cold-started free-tier
      // backend can easily take 30-60s to answer its very first request),
      // this call can still be in flight when the person is logged out for
      // an unrelated reason — a genuinely expired token rejected by some
      // other, faster request, or the person tapping "Log out" themselves.
      // That logout already cleared the token and sent them to a public
      // page (Login/Landing). If we then blindly apply THIS request's
      // success response, we'd write the session back to localStorage and
      // call setUser() again — silently "logging them back in" on a page
      // that's supposed to be for logged-out visitors. AppShell's
      // AIChatWidget checks `user` to decide whether to render, so the
      // visible symptom is exactly that: the assistant widget "appearing on
      // the landing page" a few seconds after the person was already
      // logged out, right when this slow, stale request finally resolves.
      // Bailing here if the token has since disappeared closes that gap.
      if (!getToken()) return;
      if (d && d.success && d.user) {
        const merged = { ...getUser(), ...d.user };
        localStorage.setItem('agp_user', JSON.stringify(merged));
        setUser(merged);
      }
    } finally {
      refreshingRef.current = false;
    }
  }, []);

  // Initial load, once, on mount.
  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  // Re-run whenever the device reconnects or the app comes back to the
  // foreground, so an active session (and this device's cached profile
  // data) catches up automatically — no navigation, button click, or app
  // restart required. Listeners are added/removed by this hook itself and
  // cleaned up on unmount (see lib/useRevalidate.js).
  useRevalidate(refreshSession);

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