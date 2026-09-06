import Sidebar from './Sidebar';
import AIChatWidget from './AIChatWidget';
import { useAuth } from '../context/AuthContext';
import { useNav } from '../context/NavContext';

/**
 * Every page used to render its own <Sidebar/> and <AIChatWidget/> inside
 * <Layout>, which meant navigating between pages destroyed and recreated
 * both on every single navigation — including the AI assistant's chat
 * history, which was silently wiped every time you left its page.
 *
 * AppShell mounts them once, at the app root, so they persist across
 * navigation like a normal app's sidebar/chat widget would. Keying them
 * off the account id still forces a clean remount when the logged-in
 * account changes (login, logout, or switching accounts in the same tab),
 * so nothing leaks between sessions.
 *
 * IMPORTANT: Sidebar and AIChatWidget must use *different* key strings
 * (not both bare `uid`). React keys only need to be unique among sibling
 * elements, but re-using the exact same key on two different sibling
 * components here caused React's reconciler to mismatch them across
 * renders — e.g. on logout, when `uid` flips to 'anon', React could end up
 * matching the old Sidebar fiber to the new AIChatWidget slot (or vice
 * versa) instead of cleanly unmounting/remounting. The visible symptom
 * was the logout-confirmation modal (rendered inside Sidebar) getting
 * "orphaned" mid-transition: it stayed on screen over the login page and
 * its buttons stopped responding, only clearing up on a full app restart.
 * Prefixing each key so they can never collide fixes this.
 */
export default function AppShell({ children }) {
  const { user } = useAuth();
  const { navOpen, setNavOpen } = useNav();
  const uid = user?._id || user?.id || 'anon';

  return (
    <>
      <Sidebar key={`sidebar-${uid}`} open={navOpen} onNavigate={() => setNavOpen(false)} />
      {navOpen && <div className="sidebar-overlay" onClick={() => setNavOpen(false)} />}
      {children}
      <AIChatWidget key={`chat-${uid}`} />
    </>
  );
}