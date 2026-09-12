import { useEffect, useRef, useState } from 'react';
import Modal from './Modal';
import LeafletMap, { ICONS } from './LeafletMap';
import { watchPosition, fetchRoute, formatDistance, formatDuration, distanceKm } from '../lib/geo';

/**
 * "Navigate to Parking" — opens an in-app map (never redirects to Google
 * Maps or another app) showing the user's live location, the booked
 * parking location, the driving route between them, distance, and ETA.
 * Route is recomputed as the user moves (throttled) via OSRM's free,
 * keyless routing API.
 */
export default function NavigateModal({ show, onClose, destination }) {
  const [userPos, setUserPos] = useState(null);
  const [route, setRoute] = useState(null);
  const [error, setError] = useState('');
  const [routeLoading, setRouteLoading] = useState(false);
  const lastFetchRef = useRef({ time: 0, pos: null });

  // Live location while the modal is open.
  useEffect(() => {
    if (!show) {
      setUserPos(null);
      setRoute(null);
      setError('');
      lastFetchRef.current = { time: 0, pos: null };
      return undefined;
    }
    const stop = watchPosition(
      (pos) => { setUserPos(pos); setError(''); },
      (err) => setError(err.message || 'Could not access your location. Enable location permissions to navigate.')
    );
    return stop;
  }, [show]);

  // Recompute the route when the user has moved meaningfully or the route
  // has gone stale — not on every single GPS tick, to stay polite to the
  // free public OSRM server.
  useEffect(() => {
    if (!show || !userPos || !destination) return undefined;
    const last = lastFetchRef.current;
    const now = Date.now();
    const movedFar = !last.pos || (distanceKm(last.pos, userPos) || 0) > 0.05;
    const stale = now - last.time > 20000;
    if (!movedFar && !stale) return undefined;

    let cancelled = false;
    setRouteLoading(true);
    lastFetchRef.current = { time: now, pos: userPos };
    fetchRoute(userPos, destination)
      .then((r) => { if (!cancelled) setRoute(r); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setRouteLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPos, destination, show]);

  const straightLineKm = userPos && destination ? distanceKm(userPos, destination) : null;

  const markers = [];
  if (userPos) markers.push({ id: 'me', lat: userPos.lat, lng: userPos.lng, icon: ICONS.user, label: 'Your location' });
  if (destination) markers.push({ id: 'dest', lat: destination.lat, lng: destination.lng, icon: ICONS.destination, label: destination.name || 'Parking' });

  return (
    <Modal show={show} onClose={onClose} title="Navigate to Parking" icon="bi-signpost-2">
      {error && (
        <div className="ag-alert warning" style={{ marginBottom: '1rem' }}>
          <i className="bi bi-exclamation-triangle" /> {error}
        </div>
      )}

      <LeafletMap
        markers={markers}
        route={route ? route.coordinates : null}
        center={userPos || destination}
        zoom={15}
        height={340}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: '0.75rem', marginTop: '1rem' }}>
        <div className="stat-card plasma">
          <div className="stat-label">Distance</div>
          <div className="stat-value" style={{ fontSize: '1.1rem' }}>{formatDistance(route ? route.distanceKm : straightLineKm)}</div>
        </div>
        <div className="stat-card aurora">
          <div className="stat-label">ETA</div>
          <div className="stat-value" style={{ fontSize: '1.1rem' }}>{route ? formatDuration(route.durationMin) : routeLoading ? '…' : '—'}</div>
        </div>
      </div>

      {!userPos && !error && (
        <div style={{ marginTop: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          <i className="bi bi-geo-alt" /> Getting your live location...
        </div>
      )}
    </Modal>
  );
}
