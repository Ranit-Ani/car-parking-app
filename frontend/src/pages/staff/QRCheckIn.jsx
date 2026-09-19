import { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import Layout from '../../components/Layout';
import Modal from '../../components/Modal';
import { ActionButton } from '../../components/Bits';
import { apiRequest } from '../../lib/api';
import { showToast } from '../../lib/toast';
import { formatDateTime } from '../../lib/utils';

/**
 * QR-based entry check-in — an ADDITIONAL way for staff to check a booking
 * in, alongside (not instead of) the existing manual Check-In page. Staff
 * scan the QR the user is shown after booking; the raw scanned string is
 * sent to the backend for verification (POST /staff/qr/verify) and, once
 * confirmed, check-in (POST /staff/qr/checkin) — the backend is the only
 * place that ever validates the token, checks booking status/expiry, and
 * enforces the staff member's own parking location, exactly the same
 * rules the manual flow already applies.
 *
 * Nothing here touches staff/CheckIn.jsx or staff/CheckOut.jsx — those
 * pages and their endpoints are completely unchanged.
 */
export default function QRCheckIn() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  // Scanning is "paused" (via this ref, not state, so the animation-frame
  // loop can read it without re-subscribing) the instant a frame decodes
  // successfully, until that result has been handled and the operator has
  // moved on — otherwise the same QR gets re-read dozens of times a second.
  const scanningRef = useRef(true);

  const [cameraError, setCameraError] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // The verified-but-not-yet-confirmed scan: keeps the raw qrData (needed
  // to call /qr/checkin) alongside the booking details shown to staff.
  const [scanResult, setScanResult] = useState(null); // { qrData, booking }
  const [checkinBusy, setCheckinBusy] = useState(false);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  async function handleScan(qrData) {
    setVerifying(true);
    const d = await apiRequest('/staff/qr/verify', { method: 'POST', body: { qrData } });
    setVerifying(false);
    if (d && d.success) {
      setScanResult({ qrData, booking: d.data });
    } else {
      showToast((d && d.message) || 'Invalid QR code.', 'danger');
      // Give it a moment before allowing the same frame to be re-read,
      // rather than resuming scanning immediately.
      setTimeout(() => { scanningRef.current = true; }, 1200);
    }
  }

  const tick = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    if (!canvasRef.current) canvasRef.current = document.createElement('canvas');
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    if (scanningRef.current) {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code && code.data) {
        scanningRef.current = false;
        handleScan(code.data);
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError('');
    setCameraReady(false);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera access is not available in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraReady(true);
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      console.error('Camera:', err);
      setCameraError('Could not access the camera. Check permissions and try again.');
    }
  }, [tick]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resumeScanning() {
    setScanResult(null);
    scanningRef.current = true;
  }

  async function confirmCheckIn() {
    if (!scanResult) return;
    setCheckinBusy(true);
    const d = await apiRequest('/staff/qr/checkin', { method: 'POST', body: { qrData: scanResult.qrData } });
    setCheckinBusy(false);
    if (d && d.success) {
      showToast('Checked in via QR — slot is now Occupied.', 'success');
      resumeScanning();
    } else {
      showToast((d && d.message) || 'Check-in failed.', 'danger');
      // Whatever went wrong (already used, expired, wrong location, etc.),
      // this scan is done — go back to scanning fresh.
      resumeScanning();
    }
  }

  const b = scanResult && scanResult.booking;

  return (
    <Layout title="QR Check-In" badge="Scan to check in" badgeClass="active">
      <div className="ag-alert info" style={{ marginBottom: '1.25rem' }}>
        <i className="bi bi-info-circle" /> This is an additional way to check a booking in. The Check-In page still works exactly as before for manual check-ins.
      </div>

      <div className="table-card" style={{ padding: '1.25rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <h6 style={{ margin: 0 }}>
            {cameraReady ? <><i className="bi bi-camera-video" /> Point the camera at the booking's QR code</> : 'Camera'}
          </h6>
        </div>

        <div
          style={{
            position: 'relative',
            maxWidth: 480,
            margin: '0 auto',
            borderRadius: 16,
            overflow: 'hidden',
            background: '#000',
            aspectRatio: '1 / 1',
          }}
        >
          <video ref={videoRef} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', display: cameraReady ? 'block' : 'none' }} />

          {!cameraReady && !cameraError && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              <span className="spinner-border-sm" /> &nbsp;Starting camera...
            </div>
          )}

          {cameraError && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <i className="bi bi-camera-video-off" style={{ fontSize: '2rem' }} />
              <span style={{ fontSize: '0.85rem' }}>{cameraError}</span>
              <button className="btn-ag ghost sm" onClick={startCamera}><i className="bi bi-arrow-clockwise" /> Retry</button>
            </div>
          )}

          {cameraReady && (
            <div
              style={{
                position: 'absolute', inset: '12%', border: '3px solid rgba(0,255,157,0.8)', borderRadius: 16,
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)', pointerEvents: 'none',
              }}
            />
          )}

          {verifying && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', color: '#fff' }}>
              <span className="spinner-border-sm" /> &nbsp;Verifying...
            </div>
          )}
        </div>
      </div>

      <Modal
        show={!!scanResult}
        onClose={resumeScanning}
        title="Confirm Check-In (QR)"
        icon="bi-qr-code-scan"
        headerStyle={{ background: 'linear-gradient(135deg,rgba(0,255,157,0.12),rgba(0,136,255,0.08))' }}
        footer={(
          <>
            <button className="btn-ag ghost" onClick={resumeScanning}>Cancel</button>
            <ActionButton busy={checkinBusy} busyLabel="Confirming..." className="btn-ag green" onClick={confirmCheckIn}>
              <i className="bi bi-check-circle" /> Confirm Check-In
            </ActionButton>
          </>
        )}
      >
        {b && (
          <>
            <table className="bill-table">
              <tbody>
                <tr><td>User</td><td style={{ fontWeight: 700 }}>{b.userId?.name || b.userName}</td></tr>
                <tr><td>Vehicle</td><td style={{ color: 'var(--neon-green)', fontWeight: 700 }}>{b.vehicleCategory || '—'}</td></tr>
                <tr><td>Registration No.</td><td style={{ color: 'var(--neon-green)', fontWeight: 700, fontFamily: 'monospace' }}>{b.registrationPending ? <span className="ag-badge unverified">Pending</span> : (b.vehicleNumber || '—')}</td></tr>
                <tr><td>Slot</td><td style={{ color: 'var(--neon-cyan)', fontWeight: 700 }}>{b.slotId?.slotNumber}</td></tr>
                <tr><td>Location</td><td>{b.slotId?.location}</td></tr>
                <tr><td>Rate</td><td>₹{b.slotId?.hourlyRate}/hour</td></tr>
                <tr><td>Booked At</td><td>{formatDateTime(b.bookingTime)}</td></tr>
              </tbody>
            </table>
            <div className="ag-alert info" style={{ marginTop: '1rem', marginBottom: 0, fontSize: '0.8rem' }}>
              <i className="bi bi-arrow-right-circle" /> Status will change: Booked → Occupied, and this QR will be marked used.
            </div>
          </>
        )}
      </Modal>
    </Layout>
  );
}