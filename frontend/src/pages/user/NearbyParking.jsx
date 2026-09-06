import { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from '../../components/Layout';
import Modal from '../../components/Modal';
import { EmptyState } from '../../components/Bits';
import LeafletMap, { ICONS } from '../../components/LeafletMap';
import BookingModal from '../../components/BookingModal';
import NavigateModal from '../../components/NavigateModal';
import { apiRequest } from '../../lib/api';
import { showToast } from '../../lib/toast';
import { getCurrentPosition, geocodeSearch, formatDistance, MAX_RADIUS_KM } from '../../lib/geo';

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

  const [results, setResults] = useState(null); // null = not searched yet
  const [loadingResults, setLoadingResults] = useState(false);

  const [activeLocation, setActiveLocation] = useState(null); // location card the user opened
  const [locationSlots, setLocationSlots] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [bookingSlot, setBookingSlot] = useState(null);
  const [justBooked, setJustBooked] = useState(null); // booking returned right after a successful booking
  const [navDestination, setNavDestination] = useState(null);

  const fetchNearby = useCallback(async (point, km, type) => {
    if (!point) return;
    setLoadingResults(true);
    const clampedKm = Math.min(Math.max(km, 0.5), MAX_RADIUS_KM);
    let url = `/locations/nearby?lat=${point.lat}&lng=${point.lng}&radius=${clampedKm}`;
    if (type) url += `&type=${encodeURIComponent(type)}`;
    const d = await apiRequest(url);
    setLoadingResults(false);
    if (d && d.success) {
      setResults(d.data);
    } else {
      setResults([]);
      showToast((d && d.message) || 'Could not load nearby parking.', 'danger');
    }
  }, []);

  // Re-run search whenever center, radius, or type filter changes.
  useEffect(() => {
    if (center) fetchNearby(center, radiusKm, slotType);
  }, [center, radiusKm, slotType, fetchNearby]);

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
    const t = setTimeout(() => runSearch(searchQuery), 450);
    return () => clearTimeout(t);
  }, [searchQuery, mode, runSearch]);

  function pickCandidate(c) {
    setCenter({ lat: c.lat, lng: c.lng, label: c.label });
    setSearchCandidates([]);
  }

  async function openLocation(loc) {
    setActiveLocation(loc);
    setLocationSlots(null);
    setLoadingSlots(true);
    const d = await apiRequest(`/slots?locationId=${loc._id}&limit=100`);
    setLoadingSlots(false);
    if (d && d.success) setLocationSlots(d.data);
    else setLocationSlots([]);
  }

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
            {searchQuery.trim() && !searching && searchCandidates.length === 0 && (
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
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: '1rem' }}>
          {results.map((loc) => (
            <div key={loc._id} className="ag-card" style={{ padding: '1rem', cursor: 'pointer', border: activeLocation && activeLocation._id === loc._id ? '1px solid var(--neon-cyan)' : undefined }} onClick={() => openLocation(loc)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--t1)', fontSize: '0.95rem' }}>{loc.name}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{loc.address}</div>
                </div>
                <span className="ag-badge active" style={{ fontSize: '0.68rem', whiteSpace: 'nowrap' }}>{formatDistance(loc.distanceKm)}</span>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem', fontSize: '0.78rem' }}>
                <span style={{ color: loc.availableSlots > 0 ? 'var(--neon-green)' : 'var(--neon-red)' }}>
                  <i className="bi bi-p-square" /> {loc.availableSlots}/{loc.totalSlots} available
                </span>
                {loc.minRate != null && (
                  <span style={{ color: 'var(--text-muted)' }}>
                    <i className="bi bi-currency-rupee" /> {loc.minRate === loc.maxRate ? `₹${loc.minRate}/hr` : `₹${loc.minRate}–₹${loc.maxRate}/hr`}
                  </span>
                )}
              </div>
              {loc.amenities && loc.amenities.length > 0 && (
                <div style={{ marginTop: '0.6rem', display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  {loc.amenities.map((a) => (
                    <span key={a} style={{ fontSize: '0.65rem', color: 'var(--text-dim)', border: '1px solid var(--t4)', borderRadius: 6, padding: '0.1rem 0.4rem' }}>{a}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Slots available at the selected location */}
      <Modal
        show={!!activeLocation}
        onClose={() => setActiveLocation(null)}
        title={activeLocation ? activeLocation.name : ''}
        icon="bi-grid-3x3-gap-fill"
      >
        {activeLocation && (
          <>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>{activeLocation.address}</div>
            {loadingSlots ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Loading slots...</div>
            ) : !locationSlots || locationSlots.length === 0 ? (
              <EmptyState icon="bi-slash-circle">No available slots at this location right now.</EmptyState>
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
          </>
        )}
      </Modal>

      <BookingModal slot={bookingSlot} show={!!bookingSlot} onClose={() => setBookingSlot(null)} onBooked={handleBooked} />

      {/* Right after a successful booking, offer in-app navigation immediately. */}
      <Modal
        show={!!justBooked}
        onClose={() => setJustBooked(null)}
        title="Booking Confirmed"
        icon="bi-check-circle"
        footer={(
          <>
            <button className="btn-ag ghost" onClick={() => setJustBooked(null)}>Close</button>
            <button className="btn-ag plasma" onClick={() => navigateNow(justBooked)}>
              <i className="bi bi-signpost-2" /> Navigate to Parking
            </button>
          </>
        )}
      >
        {justBooked && (
          <div style={{ textAlign: 'center', padding: '0.5rem' }}>
            <div style={{ fontSize: '2rem', color: 'var(--neon-green)' }}><i className="bi bi-check-circle-fill" /></div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--t1)', marginTop: '0.5rem' }}>
              Slot {justBooked.slotId && justBooked.slotId.slotNumber} booked!
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
              Check in within 1 hour, or open in-app navigation to head there now.
            </div>
          </div>
        )}
      </Modal>

      <NavigateModal show={!!navDestination} onClose={() => setNavDestination(null)} destination={navDestination} />
    </Layout>
  );
}