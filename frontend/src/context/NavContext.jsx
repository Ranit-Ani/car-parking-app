import { createContext, useContext, useEffect, useMemo, useState } from 'react';

// Mobile sidebar open/closed state, lifted out of <Layout> so that
// <Sidebar> and <AIChatWidget> can be mounted once for the whole app
// (in AppShell) instead of once per page. Layout still toggles it via
// the top-bar hamburger button.
const NavContext = createContext(null);

export function NavProvider({ children }) {
  const [navOpen, setNavOpen] = useState(false);

  // Prevent the page behind the mobile nav from scrolling while it's open.
  useEffect(() => {
    document.body.classList.toggle('nav-locked', navOpen);
    return () => document.body.classList.remove('nav-locked');
  }, [navOpen]);

  // AI Assistant panel open/close state, lifted out of <AIChatWidget> (same
  // reasoning as navOpen above) so any page — e.g. Profile's role-based
  // Help & Support — can open the assistant from a button of its own
  // instead of the fixed bottom-right FAB, without duplicating the widget.
  const [aiOpen, setAiOpen] = useState(false);
  // An optional question to auto-send the moment the panel opens, so a
  // suggested question elsewhere in the app can "hand off" straight into
  // a live answer instead of just opening an empty panel.
  const [aiPendingPrompt, setAiPendingPrompt] = useState(null);

  const openAIAssistant = (prompt) => {
    if (prompt) setAiPendingPrompt(prompt);
    setAiOpen(true);
  };
  const clearAiPendingPrompt = () => setAiPendingPrompt(null);

  const value = useMemo(
    () => ({ navOpen, setNavOpen, aiOpen, setAiOpen, aiPendingPrompt, openAIAssistant, clearAiPendingPrompt }),
    [navOpen, aiOpen, aiPendingPrompt]
  );

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav() {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error('useNav must be used within NavProvider');
  return ctx;
}