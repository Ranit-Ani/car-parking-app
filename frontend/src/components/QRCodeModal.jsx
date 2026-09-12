import { useEffect, useState } from 'react';
import Modal from './Modal';
import { apiRequest } from '../lib/api';
import { showToast } from '../lib/toast';
import { formatDateTime } from '../lib/utils';

/**
 * Shows a booking's scannable entry QR code.
 *
 * The QR image is fetched fresh from the backend every time this modal
 * opens (GET /bookings/:id/qrcode) rather than being generated or cached
 * on the client — the single-use token it encodes never leaves the
 * server except inside this rendered image, and only to the booking's
 * owner (or staff/admin).
 *
 * This is purely additive: it's a new way for the user to see/present
 * their booking, alongside the existing booking list — it doesn't touch
 * any existing check-in/check-out behavior.
 */
export default function QRCodeModal({ bookingId, show, onClose }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!show || !bookingId) return;
    setData(null);
    setLoading(true);
    (async () => {
      const d = await apiRequest(`/bookings/${bookingId}/qrcode`);
      setLoading(false);
      if (d && d.success) {
        setData(d.data);
      } else {
        showToast((d && d.message) || 'Could not load QR code.', 'danger');
      }
    })();
  }, [show, bookingId]);

  const isStale = !!data && (data.qrUsed || data.status !== 'Booked');

  return (
    <Modal show={show} onClose={onClose} title="Entry QR Code" icon="bi-qr-code" size="sm">
      <div style={{ textAlign: 'center', padding: '0.25rem' }}>
        {loading && (
          <div style={{ color: 'var(--text-muted)', padding: '2.5rem 0' }}>
            <span className="spinner-border-sm" /> Loading QR code...
          </div>
        )}

        {!loading && data && (
          <>
            {data.qrUsed ? (
              <div className="ag-alert warning" style={{ fontSize: '0.8rem' }}>
                <i className="bi bi-exclamation-triangle" /> This QR code has already been used for check-in.
              </div>
            ) : data.status !== 'Booked' ? (
              <div className="ag-alert warning" style={{ fontSize: '0.8rem' }}>
                <i className="bi bi-info-circle" /> This QR is only valid while awaiting check-in (current status: {data.status}).
              </div>
            ) : (
              <div className="ag-alert info" style={{ fontSize: '0.8rem' }}>
                <i className="bi bi-camera" /> Show this at entry to check in.
              </div>
            )}

            <div
              style={{
                display: 'inline-block',
                background: '#fff',
                padding: '0.75rem',
                borderRadius: 14,
                marginTop: '0.5rem',
                opacity: isStale ? 0.4 : 1,
              }}
            >
              <img src={data.qrImage} alt="Booking entry QR code" style={{ width: 220, height: 220, display: 'block' }} />
            </div>

            {data.expiresAt && data.status === 'Booked' && (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.6rem' }}>
                Valid until {formatDateTime(data.expiresAt)}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
