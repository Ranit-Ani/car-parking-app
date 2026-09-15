// Tiny pub/sub so any component can fire a toast without prop drilling.
// Mirrors the original showToast(msg, type) behaviour.

let listeners = [];

export function onToast(fn) {
  listeners.push(fn);
  return () => { listeners = listeners.filter((l) => l !== fn); };
}

export function showToast(message, type = 'success') {
  listeners.forEach((fn) => fn({ id: Date.now() + Math.random(), message, type }));
}

// ─── Offline / reconnected notifications ───────────────────────────────────
// `showOfflineNotice()` is called from apiRequest()/downloadFile() (see
// lib/api.js) every time the person tries to do something that needs the
// network while the device has none — i.e. "clicks a network-required
// component/page" while offline. It shares the same top-right toast host as
// every other notification, so the UI everyone already sees is reused as-is.
//
// Dedup rule: while an offline notice is already on screen, every further
// call is simply dropped — not queued, not remembered — so none of those
// extra clicks produce a notice later either, even after the visible one
// disappears. `offlineNoticeActive` is the single source of truth for "is
// one currently showing"; ToastHost flips it back off when that particular
// toast's timer elapses (see clearOfflineNoticeFlag below), which is also
// the only thing that allows the next call to show a new one.
let offlineNoticeActive = false;

export function showOfflineNotice() {
  if (offlineNoticeActive) return;
  offlineNoticeActive = true;
  const id = Date.now() + Math.random();
  listeners.forEach((fn) => fn({
    id,
    message: "You're offline. Check your internet connection.",
    type: 'danger',
    offline: true,
  }));
}

// Called by ToastHost once the offline toast it displayed has actually been
// removed from screen, so a brand-new click afterwards is free to show a
// fresh notice.
export function clearOfflineNoticeFlag() {
  offlineNoticeActive = false;
}

// Fired once per offline -> online transition (see the network subscription
// in ToastHost). Unlike the offline notice this isn't click-driven and
// isn't deduped against it — a reconnect is a single, distinct event.
export function showConnectedNotice() {
  listeners.forEach((fn) => fn({
    id: Date.now() + Math.random(),
    message: "You're back online.",
    type: 'success',
    connected: true,
  }));
}
