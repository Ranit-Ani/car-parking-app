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

  const value = useMemo(() => ({ navOpen, setNavOpen }), [navOpen]);

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav() {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error('useNav must be used within NavProvider');
  return ctx;
}