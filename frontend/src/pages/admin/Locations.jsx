import { useCallback, useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import Modal from '../../components/Modal';
import { ActionButton, EmptyState } from '../../components/Bits';
import { apiRequest } from '../../lib/api';
import { showToast } from '../../lib/toast';
import { getSocket } from '../../lib/socket';
import LeafletMap, { ICONS } from '../../components/LeafletMap';

const emptyForm = { name: '', address: '', description: '', amenities: '', latitude: '', longitude: '', isActive: true };

export default function AdminLocations() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const d = await apiRequest('/admin/locations');
    setLoading(false);
    if (d && d.success) setLocations(d.data);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const socket = getSocket();
    socket.on('locationUpdated', load);
    socket.on('locationDeleted', load);
    return () => {
      socket.off('locationUpdated', load);
      socket.off('locationDeleted', load);
    };
  }, [load]);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEdit(loc) {
    setEditingId(loc._id);
    setForm({
      name: loc.name || '',
      address: loc.address || '',
      description: loc.description || '',
      amenities: (loc.amenities || []).join(', '),
      latitude: loc.latitude != null ? String(loc.latitude) : '',
      longitude: loc.longitude != null ? String(loc.longitude) : '',
      isActive: loc.isActive !== false,
    });
    setFormOpen(true);
  }

  function useMyLocationAsCoords() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setForm((f) => ({ ...f, latitude: String(pos.coords.latitude), longitude: String(pos.coords.longitude) }));
    });
  }

  // Map picker: clicking or dragging the marker updates the form's
  // lat/lng fields directly, keeping the number inputs as the single
  // source of truth (typing in them still works and moves the marker too).
  function pickOnMap({ lat, lng }) {
    setForm((f) => ({ ...f, latitude: String(lat), longitude: String(lng) }));
  }

  const parsedLat = form.latitude !== '' && !Number.isNaN(Number(form.latitude)) ? Number(form.latitude) : null;
  const parsedLng = form.longitude !== '' && !Number.isNaN(Number(form.longitude)) ? Number(form.longitude) : null;
  const hasPin = parsedLat != null && parsedLng != null;
  // Default the map to a sensible view before any pin is placed: the
  // location being edited, or India's centroid for a brand-new one.
  const mapCenter = hasPin
    ? { lat: parsedLat, lng: parsedLng }
    : { lat: 20.5937, lng: 78.9629 };

  async function save() {
    if (!form.name.trim()) return showToast('Location name is required.', 'warning');
    if (form.latitude === '' || form.longitude === '') return showToast('Latitude and longitude are required so this location can show up in Nearby Parking search.', 'warning');

    setBusy(true);
    const body = {
      name: form.name.trim(),
      address: form.address.trim(),
      description: form.description.trim(),
      amenities: form.amenities,
      latitude: form.latitude,
      longitude: form.longitude,
      isActive: form.isActive,
    };
    const d = editingId
      ? await apiRequest('/admin/locations/' + editingId, { method: 'PUT', body })
      : await apiRequest('/admin/locations', { method: 'POST', body });
    setBusy(false);
    if (d && d.success) {
      setFormOpen(false);
      showToast(editingId ? 'Location updated!' : 'Location added!', 'success');
      load();
    } else {
      showToast((d && d.message) || 'Failed.', 'danger');
    }
  }

  async function remove(loc) {
    if (!confirm(`Delete "${loc.name}"? This only works if it has no slots assigned.`)) return;
    const d = await apiRequest('/admin/locations/' + loc._id, { method: 'DELETE' });
    if (d && d.success) { showToast('Location deleted.', 'warning'); load(); }
    else showToast((d && d.message) || 'Failed.', 'danger');
  }

  return (
    <Layout title="Parking Locations" badge={false} right={<button className="btn-ag primary sm" onClick={openAdd}><i className="bi bi-plus-circle" /> Add Location</button>}>
      <div className="ag-alert info" style={{ marginBottom: '1.25rem' }}>
        <i className="bi bi-info-circle" /> These geo-located sites power users&apos; <strong>Nearby Parking</strong> search (by distance or by searched address/landmark) and in-app navigation. Link slots to a location from the Slot Management page.
      </div>

      <div className="table-card">
        <div className="tc-header">
          <h6>Registered Locations <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>({locations.length})</span></h6>
          <button className="btn-ag ghost sm" onClick={load}><i className="bi bi-arrow-clockwise" /> Refresh</button>
        </div>
        <div className="table-responsive">
          <table className="ag-table">
            <thead><tr><th>Name</th><th>Address</th><th>Coordinates</th><th>Slots</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {locations.length === 0 && loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Loading locations...</td></tr>
              ) : locations.length === 0 ? (
                <tr><td colSpan={6}><EmptyState icon="bi-geo-alt">No parking locations yet. Add one to enable Nearby Parking.</EmptyState></td></tr>
              ) : locations.map((loc) => (
                <tr key={loc._id}>
                  <td><strong style={{ color: 'var(--neon-cyan)' }}>{loc.name}</strong></td>
                  <td style={{ color: 'var(--text-muted)' }}>{loc.address || '—'}</td>
                  <td className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{loc.latitude?.toFixed(4)}, {loc.longitude?.toFixed(4)}</td>
                  <td>
                    <span style={{ color: loc.availableSlots > 0 ? 'var(--neon-green)' : 'var(--text-muted)' }}>
                      {loc.availableSlots}/{loc.totalSlots}
                    </span>
                  </td>
                  <td><span className={`ag-badge ${loc.isActive ? 'available' : 'cancelled'}`}>{loc.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td>
                    <button className="btn-ag ghost sm" onClick={() => openEdit(loc)}><i className="bi bi-pencil" /></button>{' '}
                    <button className="btn-ag red sm" onClick={() => remove(loc)}><i className="bi bi-trash" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        show={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingId ? 'Edit Location' : 'Add Parking Location'}
        icon="bi-geo-alt-fill"
        footer={(
          <>
            <button className="btn-ag ghost" onClick={() => setFormOpen(false)}>Cancel</button>
            <ActionButton busy={busy} busyLabel="Saving..." className="btn-ag primary" onClick={save}>
              <i className="bi bi-check-circle" /> {editingId ? 'Save Changes' : 'Add Location'}
            </ActionButton>
          </>
        )}
      >
        <div className="ag-input-group" style={{ margin: 0, marginBottom: '0.9rem' }}>
          <label className="ag-label">Name *</label>
          <input className="ag-input" placeholder="Block A - Main Gate" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="ag-input-group" style={{ margin: 0, marginBottom: '0.9rem' }}>
          <label className="ag-label">Address</label>
          <input className="ag-input" placeholder="Main Gate Road, Campus Sector 1" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
        <div className="ag-input-group" style={{ margin: 0, marginBottom: '0.9rem' }}>
          <label className="ag-label">Description</label>
          <input className="ag-input" placeholder="Short description shown to users" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="ag-input-group" style={{ margin: 0, marginBottom: '0.9rem' }}>
          <label className="ag-label">Amenities (comma separated)</label>
          <input className="ag-input" placeholder="CCTV, Covered, EV Charging" value={form.amenities} onChange={(e) => setForm({ ...form, amenities: e.target.value })} />
        </div>
        <div className="ag-input-group" style={{ margin: 0, marginBottom: '0.5rem' }}>
          <label className="ag-label">Pin the location on the map *</label>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
            Click anywhere on the map to drop a pin, or drag the pin once it's placed. The Latitude/Longitude fields below update automatically — you can also type coordinates directly.
          </div>
          <LeafletMap
            key={editingId || 'new'}
            height={260}
            center={mapCenter}
            zoom={hasPin ? 16 : 5}
            fitToData={false}
            onPick={pickOnMap}
            markers={hasPin ? [{
              id: 'picked',
              lat: parsedLat,
              lng: parsedLng,
              icon: ICONS.parkingSelected,
              draggable: true,
              onDrag: pickOnMap,
              label: form.name || 'New location',
            }] : []}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <div className="ag-input-group" style={{ margin: 0 }}>
            <label className="ag-label">Latitude *</label>
            <input className="ag-input" type="number" step="any" placeholder="28.6139" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
          </div>
          <div className="ag-input-group" style={{ margin: 0 }}>
            <label className="ag-label">Longitude *</label>
            <input className="ag-input" type="number" step="any" placeholder="77.2090" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
          </div>
        </div>
        <button className="btn-ag ghost sm" onClick={useMyLocationAsCoords} style={{ marginBottom: '0.9rem' }}>
          <i className="bi bi-crosshair" /> Use My Current Location
        </button>
        <label className="ag-check-row">
          <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
          <span>Active (visible in Nearby Parking search)</span>
        </label>
      </Modal>
    </Layout>
  );
}