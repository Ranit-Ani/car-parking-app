import { useCallback, useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import Modal from '../../components/Modal';
import { ActionButton, EmptyState } from '../../components/Bits';
import { apiRequest } from '../../lib/api';
import { formatDate } from '../../lib/utils';
import { showToast } from '../../lib/toast';
import { getSocket } from '../../lib/socket';
import LeafletMap, { ICONS } from '../../components/LeafletMap';

const emptyForm = { name: '', address: '', description: '', amenities: '', latitude: '', longitude: '', isActive: true };
const emptyStaffForm = { name: '', email: '', password: '' };

// ─── Staff management modal body: view / add / edit / remove staff for
// ─── one specific parking location.
function StaffPanel({ location, onClose }) {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addForm, setAddForm] = useState(emptyStaffForm);
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const d = await apiRequest(`/admin/locations/${location._id}/staff`);
    setLoading(false);
    if (d && d.success) setStaff(d.data);
  }, [location._id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const socket = getSocket();
    socket.on('staffUpdated', load);
    return () => socket.off('staffUpdated', load);
  }, [load]);

  async function addStaff() {
    if (!addForm.name.trim()) return showToast('Staff name is required.', 'warning');
    if (!addForm.email.trim()) return showToast('Staff email is required.', 'warning');
    if (!addForm.password || addForm.password.length < 6) return showToast('Password must be at least 6 characters.', 'warning');

    setAdding(true);
    const d = await apiRequest(`/admin/locations/${location._id}/staff`, { method: 'POST', body: addForm });
    setAdding(false);
    if (d && d.success) {
      showToast(`${addForm.name} added as staff for ${location.name}.`, 'success');
      setAddForm(emptyStaffForm);
      load();
    } else {
      showToast((d && d.message) || 'Failed to add staff.', 'danger');
    }
  }

  async function toggleActive(member) {
    setBusyId(member._id);
    const d = await apiRequest(`/admin/locations/${location._id}/staff/${member._id}`, {
      method: 'PUT',
      body: { isActive: !member.isActive },
    });
    setBusyId(null);
    if (d && d.success) { showToast(`${member.name} ${d.data.isActive ? 'activated' : 'deactivated'}.`, 'warning'); load(); }
    else showToast((d && d.message) || 'Failed.', 'danger');
  }

  async function removeStaff(member) {
    if (!confirm(`Remove ${member.name} from ${location.name}? Their account reverts to a regular user.`)) return;
    setBusyId(member._id);
    const d = await apiRequest(`/admin/locations/${location._id}/staff/${member._id}`, { method: 'DELETE' });
    setBusyId(null);
    if (d && d.success) { showToast('Staff member removed.', 'warning'); load(); }
    else showToast((d && d.message) || 'Failed.', 'danger');
  }

  return (
    <>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 0 }}>
        Staff assigned here can only see and manage bookings, slots, and vehicles for <strong style={{ color: 'var(--text-main, #e8f4ff)' }}>{location.name}</strong>.
      </p>

      <div className="table-responsive" style={{ marginBottom: '1.25rem' }}>
        <table className="ag-table">
          <thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>Loading staff...</td></tr>
            ) : staff.length === 0 ? (
              <tr><td colSpan={5}><EmptyState icon="bi-person-badge">No staff assigned to this location yet.</EmptyState></td></tr>
            ) : staff.map((m) => (
              <tr key={m._id}>
                <td><strong>{m.name}</strong></td>
                <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{m.email}</td>
                <td>{m.isActive ? <span className="ag-badge available">Active</span> : <span className="ag-badge cancelled">Inactive</span>}</td>
                <td style={{ color: 'var(--text-muted)' }}>{formatDate(m.createdAt)}</td>
                <td>
                  <ActionButton
                    busy={busyId === m._id}
                    busyLabel="..."
                    className={`btn-ag ${m.isActive ? 'orange' : 'green'} sm`}
                    onClick={() => toggleActive(m)}
                  >
                    {m.isActive ? 'Deactivate' : 'Activate'}
                  </ActionButton>{' '}
                  <button className="btn-ag red sm" onClick={() => removeStaff(m)} disabled={busyId === m._id}><i className="bi bi-trash" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ag-card" style={{ padding: '1rem', background: 'rgba(0,136,255,0.05)' }}>
        <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.72rem', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '0.8rem' }}>ADD NEW STAFF MEMBER</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div className="ag-input-group" style={{ margin: 0 }}>
            <label className="ag-label">Name *</label>
            <input className="ag-input" placeholder="Staff name" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} />
          </div>
          <div className="ag-input-group" style={{ margin: 0 }}>
            <label className="ag-label">Email *</label>
            <input className="ag-input" type="email" placeholder="staff@campus.edu" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} />
          </div>
        </div>
        <div className="ag-input-group" style={{ margin: 0, marginBottom: '0.9rem' }}>
          <label className="ag-label">Password *</label>
          <input className="ag-input" type="password" placeholder="Min. 6 characters" value={addForm.password} onChange={(e) => setAddForm({ ...addForm, password: e.target.value })} />
        </div>
        <ActionButton busy={adding} busyLabel="Adding..." className="btn-ag primary sm" onClick={addStaff}>
          <i className="bi bi-person-plus" /> Add Staff to {location.name}
        </ActionButton>
      </div>
    </>
  );
}

// ─── Location detail modal body: revenue, bookings & occupancy for one
// ─── specific parking location.
function DetailPanel({ location }) {
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    (async () => {
      const d = await apiRequest(`/admin/locations/${location._id}/detail`);
      if (d && d.success) setDetail(d.data);
    })();
  }, [location._id]);

  if (!detail) return <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Loading location stats...</div>;

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '0.9rem', marginBottom: '1.25rem' }}>
        <div className="stat-card green"><div className="stat-label">Revenue</div><div className="stat-value text-green">₹{(detail.revenue.totalRevenue || 0).toFixed(2)}</div></div>
        <div className="stat-card cyan"><div className="stat-label">Active Bookings</div><div className="stat-value text-cyan">{detail.activeBookings}</div></div>
        <div className="stat-card orange"><div className="stat-label">Occupancy Rate</div><div className="stat-value text-orange">{detail.occupancyRate}%</div></div>
        <div className="stat-card purple"><div className="stat-label">Completed Bookings</div><div className="stat-value text-cyan">{detail.completedBookings}</div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
        <div className="ag-card" style={{ padding: '0.9rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>TOTAL SLOTS</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{detail.slots.total || 0}</div>
        </div>
        <div className="ag-card" style={{ padding: '0.9rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>AVAILABLE</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--neon-green)' }}>{detail.slots.Available || 0}</div>
        </div>
        <div className="ag-card" style={{ padding: '0.9rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>OCCUPIED</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--neon-orange)' }}>{detail.slots.Occupied || 0}</div>
        </div>
        <div className="ag-card" style={{ padding: '0.9rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>STAFF ASSIGNED</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{detail.staffCount}</div>
        </div>
      </div>

      <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.7rem', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
        AVG BOOKING VALUE: <span style={{ color: 'var(--neon-orange)' }}>₹{(detail.revenue.avgAmount || 0).toFixed(2)}</span>
      </div>

      {detail.daily.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No completed bookings at this location in the last 30 days.</div>
      ) : (
        <div className="table-responsive" style={{ maxHeight: 220, overflowY: 'auto' }}>
          <table className="ag-table">
            <thead><tr><th>Date</th><th>Revenue</th><th>Bookings</th></tr></thead>
            <tbody>
              {detail.daily.slice().reverse().map((row) => (
                <tr key={row._id}>
                  <td>{row._id}</td>
                  <td className="text-green">₹{row.revenue.toFixed(2)}</td>
                  <td>{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

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
    socket.on('staffUpdated', load);
    return () => {
      socket.off('locationUpdated', load);
      socket.off('locationDeleted', load);
      socket.off('staffUpdated', load);
    };
  }, [load]);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);

  // Which location's Staff / Detail modal is currently open, if any.
  const [staffPanelFor, setStaffPanelFor] = useState(null);
  const [detailPanelFor, setDetailPanelFor] = useState(null);

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
    if (!confirm(`Delete "${loc.name}"? This only works if it has no slots or staff assigned.`)) return;
    const d = await apiRequest('/admin/locations/' + loc._id, { method: 'DELETE' });
    if (d && d.success) { showToast('Location deleted.', 'warning'); load(); }
    else showToast((d && d.message) || 'Failed.', 'danger');
  }

  return (
    <Layout title="Parking Locations" badge={false} right={<button className="btn-ag primary sm" onClick={openAdd}><i className="bi bi-plus-circle" /> Add Location</button>}>
      <div className="ag-alert info" style={{ marginBottom: '1.25rem' }}>
        <i className="bi bi-info-circle" /> These geo-located sites power users&apos; <strong>Nearby Parking</strong> search (by distance or by searched address/landmark) and in-app navigation. Link slots to a location from the Slot Management page, and assign staff to a location right here.
      </div>

      <div className="table-card">
        <div className="tc-header">
          <h6>Registered Locations <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>({locations.length})</span></h6>
          <button className="btn-ag ghost sm" onClick={load}><i className="bi bi-arrow-clockwise" /> Refresh</button>
        </div>
        <div className="table-responsive">
          <table className="ag-table">
            <thead><tr><th>Name</th><th>Address</th><th>Coordinates</th><th>Slots</th><th>Staff</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {locations.length === 0 && loading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Loading locations...</td></tr>
              ) : locations.length === 0 ? (
                <tr><td colSpan={7}><EmptyState icon="bi-geo-alt">No parking locations yet. Add one to enable Nearby Parking.</EmptyState></td></tr>
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
                  <td>
                    <button className="btn-ag ghost sm" onClick={() => setStaffPanelFor(loc)}>
                      <i className="bi bi-person-badge" /> {loc.staffCount || 0}
                    </button>
                  </td>
                  <td><span className={`ag-badge ${loc.isActive ? 'available' : 'cancelled'}`}>{loc.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn-ag cyan sm" onClick={() => setDetailPanelFor(loc)} title="Revenue, bookings & stats"><i className="bi bi-graph-up" /></button>{' '}
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

      <Modal
        show={!!staffPanelFor}
        onClose={() => setStaffPanelFor(null)}
        title={staffPanelFor ? `Staff — ${staffPanelFor.name}` : 'Staff'}
        icon="bi-person-badge"
        footer={<button className="btn-ag ghost" onClick={() => setStaffPanelFor(null)}>Close</button>}
      >
        {staffPanelFor && <StaffPanel location={staffPanelFor} onClose={() => setStaffPanelFor(null)} />}
      </Modal>

      <Modal
        show={!!detailPanelFor}
        onClose={() => setDetailPanelFor(null)}
        title={detailPanelFor ? `${detailPanelFor.name} — Revenue & Stats` : 'Location Detail'}
        icon="bi-graph-up"
        footer={<button className="btn-ag ghost" onClick={() => setDetailPanelFor(null)}>Close</button>}
      >
        {detailPanelFor && <DetailPanel location={detailPanelFor} />}
      </Modal>
    </Layout>
  );
}
