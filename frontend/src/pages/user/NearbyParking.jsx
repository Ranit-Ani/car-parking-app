import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Layout from '../../components/Layout';
import Modal from '../../components/Modal';
import { EmptyState } from '../../components/Bits';
import LeafletMap, { ICONS } from '../../components/LeafletMap';
import BookingModal from '../../components/BookingModal';
import NavigateModal from '../../components/NavigateModal';
import QRCodeModal from '../../components/QRCodeModal';
import { apiRequest } from '../../lib/api';
import { showToast } from '../../lib/toast';
import { getCurrentPosition, geocodeSearch, MAX_RADIUS_KM } from '../../lib/geo';
import { getSocket } from '../../lib/socket';
import { useRevalidate } from '../../lib/useRevalidate';

const TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'standard', label: 'Standard' },
  { value: 'faculty', label: 'Faculty' },
  { value: 'disabled', label: 'Disabled' },
  { value: 'ev', label: 'EV Charging' },
];

export default function NearbyParking() {
  const [mode, setMode] = useState('radius'); // 'radius' | 'search'
  const [radiusKm, setRadiusKm] = useState(2);
  const [slotType, setSlotType] = useState('');

  const [center, setCenter] = useState(null); // { lat, lng, label? } — the point results are searched around
  const [locating, setLocating] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchCandidates, setSearchCandidates] = useState([]);
  const [searching, setSearching] = useState(false);
  // Set right after a suggestion is picked so the debounced search-as-you-type
  // effect doesn't immediately re-query and reopen the suggestion list for
  // the text we just programmatically filled in.
  const skipNextSearchRef = useRef(false);

  const [results, setResults] = useState(null); // null = not searched yet
  const [loadingResults, setLoadingResults] = useState(false);

  const [activeLocation, setActiveLocation] = useState(null); // location card the user opened
  const [locationSlots, setLocationSlots] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [bookingSlot, setBookingSlot] = useState(null);
  const [justBooked, setJustBooked] = useState(null); // booking returned right after a successful booking
  const [navDestination, setNavDestination] = useState(null);
  const [showBookingQr, setShowBookingQr] = useState(false);

  const fetchNearby = useCallback(async (point, km, type, opts = {}) => {
    if (!point) return;
    // Skip the "Scanning..." loading state for background/live refreshes
    // (e.g. triggered by a socket event) — only show it for a fresh search
    // the user is actively waiting on.
    if (!opts.silent) setLoadingResults(true);
    const clampedKm = Math.min(Math.max(km, 0.5), MAX_RADIUS_KM);
    let url = `/locations/nearby?lat=${point.lat}&lng=${point.lng}&radius=${clampedKm}`;
    if (type) url += `&type=${encodeURIComponent(type)}`;
    const d = await apiRequest(url);
    if (!opts.silent) setLoadingResults(false);
    if (d && d.success) {
      setResults(d.data);
    } else if (!opts.silent) {
      setResults([]);
      showToast((d && d.message) || 'Could not load nearby parking.', 'danger');
    }
  }, []);

  // Re-run search whenever center, radius, or type filter changes.
  useEffect(() => {
    if (center) fetchNearby(center, radiusKm, slotType);
  }, [center, radiusKm, slotType, fetchNearby]);

  // Live sync: availability counts on the cards + map (and slots showing
  // up/disappearing at nearby locations) should update the instant anyone
  // books, cancels, or an admin edits a slot/location — not just on the
  // next manual search.
  const liveRefreshNearby = useCallback(() => {
    if (center) fetchNearby(center, radiusKm, slotType, { silent: true });
  }, [center, radiusKm, slotType, fetchNearby]);

  useEffect(() => {
    const socket = getSocket();
    const events = ['slotUpdated', 'slotDeleted', 'locationUpdated', 'locationDeleted', 'bookingCreated', 'bookingCancelled', 'bookingUpdated'];
    events.forEach((ev) => socket.on(ev, liveRefreshNearby));
    return () => events.forEach((ev) => socket.off(ev, liveRefreshNearby));
  }, [liveRefreshNearby]);

  async function useMyLocation() {
    setLocating(true);
    try {
      const pos = await getCurrentPosition();
      setCenter({ ...pos, label: 'Your current location' });
    } catch (err) {
      showToast(err.message || 'Could not get your location. Please allow location access.', 'warning');
    } finally {
      setLocating(false);
    }
  }

  // Try to get the user's location automatically on first visit (radius mode).
  useEffect(() => {
    useMyLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSearch = useCallback(async (query) => {
    if (!query.trim()) { setSearchCandidates([]); return; }
    setSearching(true);
    try {
      const candidates = await geocodeSearch(query.trim());
      setSearchCandidates(candidates);
    } catch (err) {
      showToast(err.message || 'Search failed.', 'warning');
      setSearchCandidates([]);
    } finally {
      setSearching(false);
    }
  }, []);

  // Search-as-you-type: no manual "Search" button — results (and the final
  // nearby-parking search once a candidate is picked) happen automatically.
  // Debounced so we don't hit the geocoder on every keystroke.
  useEffect(() => {
    if (mode !== 'search') return undefined;
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      return undefined;
    }
    const t = setTimeout(() => runSearch(searchQuery), 450);
    return () => clearTimeout(t);
  }, [searchQuery, mode, runSearch]);

  function pickCandidate(c) {
    setCenter({ lat: c.lat, lng: c.lng, label: c.label });
    skipNextSearchRef.current = true;
    setSearchQuery(c.label);
    setSearchCandidates([]);
  }

  function openLocation(loc) {
    setActiveLocation(loc);
  }

  // Fetch (and re-fetch) the slot grid for whichever location is open,
  // whenever the open location OR the slot type filter changes — so
  // switching the "Slot Type" dropdown while a location is already open
  // immediately re-filters the grid instead of leaving the stale,
  // unfiltered list on screen.
  const fetchLocationSlots = useCallback(async (locationId, type, opts = {}) => {
    if (!opts.silent) {
      setLocationSlots(null);
      setLoadingSlots(true);
    }
    let url = `/slots?locationId=${locationId}&limit=100`;
    if (type) url += `&type=${encodeURIComponent(type)}`;
    const d = await apiRequest(url);
    if (!opts.silent) setLoadingSlots(false);
    if (d && d.success) setLocationSlots(d.data);
    else if (!opts.silent) setLocationSlots([]);
  }, []);

  useEffect(() => {
    if (!activeLocation) return;
    fetchLocationSlots(activeLocation._id, slotType);
  }, [activeLocation, slotType, fetchLocationSlots]);

  // Live sync: while a location's slot grid is open, reflect any booking
  // made elsewhere (by this user on another tab, or anyone else) right away
  // so "TAP TO BOOK" never lets someone try to book a slot that's already gone.
  useEffect(() => {
    if (!activeLocation) return undefined;
    const socket = getSocket();
    const refreshSlots = () => fetchLocationSlots(activeLocation._id, slotType, { silent: true });
    socket.on('slotUpdated', refreshSlots);
    socket.on('slotDeleted', refreshSlots);
    return () => {
      socket.off('slotUpdated', refreshSlots);
      socket.off('slotDeleted', refreshSlots);
    };
  }, [activeLocation, slotType, fetchLocationSlots]);

  // Reconnect/resume safety net: refetch nearby locations (and the open
  // location's slot grid, if any) the instant connectivity is back —
  // otherwise this page stayed silently blank/stale until the user
  // navigated away and back, since the effects above only ever ran once
  // per search/filter change.
  const revalidateNearby = useCallback(() => {
    if (center) fetchNearby(center, radiusKm, slotType, { silent: true });
    if (activeLocation) fetchLocationSlots(activeLocation._id, slotType, { silent: true });
  }, [center, radiusKm, slotType, activeLocation, fetchNearby, fetchLocationSlots]);

  useRevalidate(revalidateNearby);

  function handleBooked(booking) {
    setBookingSlot(null);
    setActiveLocation(null);
    setJustBooked(booking);
  }

  function navigateNow(booking) {
    const loc = booking && booking.slotId && booking.slotId.locationId;
    if (!loc || !loc.geo || !loc.geo.coordinates) {
      showToast('Location coordinates are not available for this slot.', 'warning');
      return;
    }
    setNavDestination({ lat: loc.geo.coordinates[1], lng: loc.geo.coordinates[0], name: loc.name });
  }

  const mapMarkers = useMemo(() => {
    const list = [];
    if (center) list.push({ id: 'center', lat: center.lat, lng: center.lng, icon: ICONS.user, label: center.label || 'Search center' });
    (results || []).forEach((loc) => {
      list.push({
        id: loc._id,
        lat: loc.latitude,
        lng: loc.longitude,
        icon: activeLocation && activeLocation._id === loc._id ? ICONS.parkingSelected : ICONS.parking,
        label: `${loc.name} — ${loc.availableSlots} available`,
        tag: { title: loc.name, subtitle: `${loc.availableSlots}/${loc.totalSlots}` },
        onClick: () => openLocation(loc),
      });
    });
    return list;
  }, [center, results, activeLocation]);

  return (
    <Layout title="Nearby Parking">
      <div className="ag-card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <button className={`btn-ag ${mode === 'radius' ? 'primary' : 'ghost'} sm`} style={{ flex: 1, whiteSpace: 'nowrap' }} onClick={() => setMode('radius')}>
            <i className="bi bi-broadcast" /> Search by Distance
          </button>
          <button className={`btn-ag ${mode === 'search' ? 'primary' : 'ghost'} sm`} style={{ flex: 1, whiteSpace: 'nowrap' }} onClick={() => setMode('search')}>
            <i className="bi bi-geo-alt" /> Search a Location
          </button>
        </div>

        {mode === 'radius' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '1rem', alignItems: 'end' }}>
            <div className="ag-input-group" style={{ margin: 0 }}>
              <label className="ag-label">Radius — up to {MAX_RADIUS_KM} km</label>
              <input
                type="range"
                min="0.5"
                max={MAX_RADIUS_KM}
                step="0.5"
                value={radiusKm}
                onChange={(e) => setRadiusKm(parseFloat(e.target.value))}
                className="ag-range"
              />
              <div style={{ fontSize: '0.78rem', color: 'var(--neon-cyan)', marginTop: '0.25rem' }}>{radiusKm} km</div>
            </div>
            <div className="ag-input-group" style={{ margin: 0 }}>
              <label className="ag-label">Slot Type</label>
              <select className="ag-select" value={slotType} onChange={(e) => setSlotType(e.target.value)}>
                {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <button className="btn-ag plasma" onClick={useMyLocation} disabled={locating}>
              {locating ? <><span className="spinner-border-sm" /> Locating...</> : <><i className="bi bi-crosshair" /> Use My Location</>}
            </button>
          </div>
        ) : (
          <div>
            <div className="ag-input-group" style={{ margin: 0 }}>
              <label className="ag-label">Address, Landmark, or Area</label>
              <div className="ag-input-icon">
                <i className={searching ? 'bi bi-hourglass-split' : 'bi bi-search'} />
                <input
                  className="ag-input"
                  type="text"
                  placeholder="e.g. City Center Mall, Sector 5"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            {searchQuery.trim() && !searching && searchCandidates.length === 0 && !(center && center.label === searchQuery) && (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '-0.6rem', marginBottom: '0.6rem' }}>No matching places found. Try a different search.</div>
            )}
            <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '1rem', alignItems: 'end' }}>
              <div className="ag-input-group" style={{ margin: 0 }}>
                <label className="ag-label">Radius — up to {MAX_RADIUS_KM} km</label>
                <input
                  type="range"
                  min="0.5"
                  max={MAX_RADIUS_KM}
                  step="0.5"
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(parseFloat(e.target.value))}
                  className="ag-range"
                />
                <div style={{ fontSize: '0.78rem', color: 'var(--neon-cyan)', marginTop: '0.25rem' }}>{radiusKm} km</div>
              </div>
              <div className="ag-input-group" style={{ margin: 0 }}>
                <label className="ag-label">Slot Type</label>
                <select className="ag-select" value={slotType} onChange={(e) => setSlotType(e.target.value)}>
                  {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {searchCandidates.length > 0 && (
          <div className="ag-card" style={{ marginTop: '1rem', padding: '0.75rem' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Pick a match</div>
            {searchCandidates.map((c, i) => (
              <button
                key={i}
                onClick={() => pickCandidate(c)}
                style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', color: 'var(--t1)', padding: '0.5rem 0.25rem', cursor: 'pointer', fontSize: '0.82rem', borderBottom: i < searchCandidates.length - 1 ? '1px solid var(--t4)' : 'none' }}
              >
                <i className="bi bi-geo-alt" style={{ color: 'var(--neon-cyan)', marginRight: '0.4rem' }} /> {c.label}
              </button>
            ))}
          </div>
        )}

        {center && (
          <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <i className="bi bi-pin-map-fill" style={{ color: 'var(--neon-cyan)' }} /> Searching near: <strong style={{ color: 'var(--t1)' }}>{center.label || `${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}`}</strong>
          </div>
        )}
      </div>

      {center && (
        <div className="ag-card" style={{ padding: '0.75rem', marginBottom: '1.5rem' }}>
          <LeafletMap markers={mapMarkers} center={center} height={360} />
        </div>
      )}

      {loadingResults ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Scanning for nearby parking...</div>
      ) : results === null ? (
        <EmptyState icon="bi-compass">Choose a search mode above to find parking near you.</EmptyState>
      ) : results.length === 0 ? (
        <EmptyState icon="bi-search">No parking locations found within {radiusKm} km.</EmptyState>
      ) : !activeLocation ? (
        <EmptyState icon="bi-cursor-fill">
          {results.length} parking location{results.length === 1 ? '' : 's'} found — tap a marker on the map to view its available slots.
        </EmptyState>
      ) : (
        <div className="ag-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--t1)', fontSize: '1rem' }}>{activeLocation.name}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{activeLocation.address}</div>
            </div>
            <button className="btn-ag ghost sm" onClick={() => setActiveLocation(null)}><i className="bi bi-x-lg" /> Clear</button>
          </div>
          {!loadingSlots && locationSlots && locationSlots.length > 0 && (
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'var(--neon-green)', marginRight: 4 }} />Available — Tap to book now</span>
            </div>
          )}
          {loadingSlots ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Loading slots...</div>
          ) : !locationSlots || locationSlots.length === 0 ? (
            <EmptyState icon="bi-slash-circle">
              {slotType ? 'No available slots of this type at this location right now.' : 'No available slots at this location right now.'}
            </EmptyState>
          ) : (
            <div className="slot-grid">
              {locationSlots.map((s) => (
                <div key={s._id} className="slot-tile available" onClick={() => setBookingSlot(s)}>
                  <div className="slot-number">{s.slotNumber}</div>
                  <div className="slot-type">{s.slotType}</div>
                  <div className="slot-rate">₹{s.hourlyRate}/hr</div>
                  {s.floor && <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>Floor {s.floor}</div>}
                  <div style={{ fontSize: '0.65rem', color: 'var(--neon-green)', marginTop: '0.3rem', letterSpacing: '0.05em' }}>TAP TO BOOK</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <BookingModal slot={bookingSlot} show={!!bookingSlot} onClose={() => setBookingSlot(null)} onBooked={handleBooked} />

      {/* Right after a successful booking, offer in-app navigation immediately. */}
      <Modal
        show={!!justBooked}
        onClose={() => setJustBooked(null)}
        title="Booking Confirmed"
        icon="bi-check-circle"
        footer={(
          <div style={{ display: 'flex', gap: '0.6rem', width: '100%' }}>
            <button
              className="btn-ag aurora"
              style={{ flex: 1, minWidth: 0, justifyContent: 'center', whiteSpace: 'normal', textAlign: 'center' }}
              onClick={() => setShowBookingQr(true)}
            >
              <i className="bi bi-qr-code" /> Entry QR
            </button>
            <button
              className="btn-ag plasma"
              style={{ flex: 1, minWidth: 0, justifyContent: 'center', whiteSpace: 'normal', textAlign: 'center' }}
              onClick={() => navigateNow(justBooked)}
            >
              <i className="bi bi-signpost-2" /> Navigate
            </button>
          </div>
        )}
      >
        {justBooked && (
          <div style={{ textAlign: 'center', padding: '0.5rem' }}>
            <div style={{ fontSize: '2rem', color: 'var(--neon-green)' }}><i className="bi bi-check-circle-fill" /></div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--t1)', marginTop: '0.5rem' }}>
              Slot {justBooked.slotId && justBooked.slotId.slotNumber} booked!
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
              Check in within 1 hour — show your entry QR at the gate, or check in manually, then open in-app navigation to head there now.
            </div>
          </div>
        )}
      </Modal>

      <QRCodeModal bookingId={justBooked?._id} show={showBookingQr} onClose={() => setShowBookingQr(false)} />

      <NavigateModal show={!!navDestination} onClose={() => setNavDestination(null)} destination={navDestination} />
    </Layout>
  );
}