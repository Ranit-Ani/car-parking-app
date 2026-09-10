// Small, app-styled confirmation card — used instead of window.confirm().
// A native confirm() is always prefixed by the browser with the page's own
// origin ("your-domain says ..."), which can't be removed or restyled and
// looks out of place. This renders a flat (non-blurred) dim backdrop with a
// small centered card, so it opens instantly with no jank, and reads
// cleanly like a native app confirmation sheet (e.g. WhatsApp's "Remove
// profile picture?" prompt).
export default function ConfirmSheet({
  show,
  message,
  cancelLabel = 'Cancel',
  confirmLabel = 'Confirm',
  busy = false,
  busyLabel = 'Please wait...',
  onCancel,
  onConfirm,
}) {
  if (!show) return null;
  return (
    <div className="confirm-sheet-backdrop" onClick={busy ? undefined : onCancel}>
      <div className="confirm-sheet" onClick={(e) => e.stopPropagation()}>
        <p>{message}</p>
        <div className="confirm-sheet-actions">
          <button type="button" onClick={onCancel} disabled={busy}>{cancelLabel}</button>
          <button type="button" onClick={onConfirm} disabled={busy}>{busy ? busyLabel : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}