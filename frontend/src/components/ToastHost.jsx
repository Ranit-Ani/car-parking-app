import { useEffect, useState } from 'react';
import { onToast, showConnectedNotice, clearOfflineNoticeFlag } from '../lib/toast';
import { subscribeNetwork } from '../lib/network';

const ICONS = {
  success: 'bi-check-circle-fill',
  danger: 'bi-exclamation-triangle-fill',
  warning: 'bi-exclamation-circle-fill',
};

// Offline/connected toasts reuse this same icon set but read a bit better
// with connectivity-specific glyphs.
const CONNECTIVITY_ICONS = {
  offline: 'bi-wifi-off',
  connected: 'bi-wifi',
};

export default function ToastHost() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    return onToast((toast) => {
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
        // Once THIS offline toast has actually left the screen, allow the
        // next offline attempt to show a new one. Anything that arrived
        // while this one was showing was dropped, not queued, and stays
        // dropped — it does not get a notice of its own later.
        if (toast.offline) clearOfflineNoticeFlag();
      }, 3500);
    });
  }, []);

  // Show a "back online" toast the moment connectivity actually returns —
  // independent of whatever page is on screen or what triggered the last
  // offline notice.
  useEffect(() => {
    return subscribeNetwork((online) => {
      if (online) showConnectedNotice();
    });
  }, []);

  return (
    <div style={{ position: 'fixed', top: 0, right: 0, zIndex: 99998, display: 'flex', flexDirection: 'column', gap: '.5rem', padding: '1rem' }}>
      {toasts.map((t) => (
        <div key={t.id} className={`ag-toast ${t.type}`}>
          <i className={`bi ${(t.offline && CONNECTIVITY_ICONS.offline) || (t.connected && CONNECTIVITY_ICONS.connected) || ICONS[t.type] || ICONS.success}`} /> {t.message}
        </div>
      ))}
    </div>
  );
}
