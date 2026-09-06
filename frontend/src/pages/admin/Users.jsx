import { useCallback, useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import InfiniteSentinel from '../../components/InfiniteSentinel';
import Modal from '../../components/Modal';
import { ActionButton, EmptyState } from '../../components/Bits';
import { apiRequest } from '../../lib/api';
import { useInfiniteList } from '../../lib/useInfiniteList';
import { formatDate } from '../../lib/utils';
import { showToast } from '../../lib/toast';
import { useAuth } from '../../context/AuthContext';
import { getSocket } from '../../lib/socket';

function RoleTable({ title, icon, rows, curUser, showLocation, onRoleChange, onReassign, onToggle, emptyText }) {
  return (
    <div className="table-card" style={{ marginBottom: '1.4rem' }}>
      <div className="tc-header"><h6><i className={`bi ${icon}`} style={{ marginRight: '0.4rem' }} />{title} ({rows.length})</h6></div>
      <div className="table-responsive">
        <table className="ag-table" style={{ tableLayout: 'fixed', width: '100%', minWidth: showLocation ? 900 : 760 }}>
          <colgroup>
            <col style={{ width: '170px' }} />
            <col style={{ width: '190px' }} />
            <col style={{ width: '100px' }} />
            {showLocation && <col style={{ width: '160px' }} />}
            <col style={{ width: '90px' }} />
            <col style={{ width: '100px' }} />
            <col style={{ width: '160px' }} />
          </colgroup>
          <thead>
            <tr>
              <th>Name</th><th>Email</th><th>Role</th>
              {showLocation && <th>Location</th>}
              <th>Status</th><th>Joined</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={showLocation ? 7 : 6}><EmptyState icon="bi-people">{emptyText}</EmptyState></td></tr>
            ) : rows.map((u) => (
              <tr key={u._id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    {/* Admins intentionally cannot view user/staff profile photos —
                        always show the initial, regardless of whether a photo exists. */}
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,var(--neon-blue),var(--neon-purple))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 }}>
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</strong>
                  </div>
                </td>
                <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</td>
                <td>
                  <select
                    className="ag-select"
                    style={{ width: 'auto', padding: '0.35rem 1.75rem 0.35rem 0.6rem', fontSize: '0.8rem' }}
                    value={u.role}
                    disabled={u._id === curUser.id}
                    onChange={(e) => onRoleChange(u, e.target.value)}
                  >
                    <option value="user">User</option>
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                {showLocation && (
                  <td>
                    {u.role === 'staff' ? (
                      <button className="btn-ag ghost sm" onClick={() => onReassign(u)} title="Reassign to a different location">
                        <i className="bi bi-geo-alt" /> {u.locationId?.name || 'Unassigned'}
                      </button>
                    ) : '—'}
                  </td>
                )}
                <td>{u.isActive ? <span className="ag-badge available">Active</span> : <span className="ag-badge cancelled">Inactive</span>}</td>
                <td style={{ color: 'var(--text-muted)' }}>{formatDate(u.createdAt)}</td>
                <td>
                  {u._id !== curUser.id ? (
                    <button className={`btn-ag ${u.isActive ? 'orange' : 'green'} sm`} onClick={() => onToggle(u._id)}>{u.isActive ? 'Deactivate' : 'Activate'}</button>
                  ) : (
                    <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>You</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminUsers() {
  const { user: curUser } = useAuth();
  const [locations, setLocations] = useState([]);

  // Needed so promoting someone to Staff (or reassigning an existing staff
  // member) can offer a location picker (multi-location support: every
  // staff account must be linked to exactly one parking location), and so
  // the "Location Wise" filter below has locations to choose from.
  useEffect(() => {
    (async () => {
      const d = await apiRequest('/admin/locations');
      if (d && d.success) setLocations(d.data.filter((l) => l.isActive !== false));
    })();
  }, []);

  // ─── View selector: which role's table is shown. The "Location Wise"
  // scope only applies to Staff — every staff account is tied to exactly
  // one parking location, whereas a User can book at any location, so
  // Users only ever show "All Users".
  const [roleView, setRoleView] = useState('user'); // 'user' | 'staff'
  const [scope, setScope] = useState('all'); // 'all' | 'location' (staff only)
  const [locationId, setLocationId] = useState('');

  // Switching to Users forces scope back to "all" — Location Wise isn't a
  // valid option for them.
  function changeRoleView(next) {
    setRoleView(next);
    if (next === 'user') setScope('all');
  }

  // Default to the first location once locations load, whenever "Location
  // Wise" is selected but nothing's picked yet.
  useEffect(() => {
    if (roleView === 'staff' && scope === 'location' && !locationId && locations.length > 0) {
      setLocationId(locations[0]._id);
    }
  }, [roleView, scope, locations, locationId]);

  function changeScope(next) {
    if (next === 'location' && locations.length === 0) {
      showToast('Add a parking location first (Parking Locations page) to filter location-wise.', 'warning');
      return;
    }
    setScope(next);
  }

  const buildUrl = useCallback((page, limit) => {
    let url = `/admin/users?page=${page}&limit=${limit}&role=${roleView}`;
    if (roleView === 'staff' && scope === 'location' && locationId) url += '&locationId=' + locationId;
    return url;
  }, [roleView, scope, locationId]);

  // The selected role's users load a page at a time and grow as the admin
  // scrolls, instead of the (potentially large) user base loading all at
  // once. Resets and re-fetches whenever the role, scope, or location
  // filter changes.
  const { items: users, loading, loadingMore, hasMore, loadMore, refresh, total } =
    useInfiniteList(buildUrl, [roleView, scope, locationId], 30);

  // Admins are always shown in full, unfiltered — the role/scope selector
  // above only applies to Users/Staff.
  const buildAdminUrl = useCallback((page, limit) => `/admin/users?page=${page}&limit=${limit}&role=admin`, []);
  const { items: adminUsers, loading: adminLoading, loadingMore: adminLoadingMore, hasMore: adminHasMore, loadMore: adminLoadMore, refresh: refreshAdmins } =
    useInfiniteList(buildAdminUrl, [], 30);

  function refreshAll() {
    refresh();
    refreshAdmins();
  }

  // Live sync: another admin changing a role or activation status (or a
  // fresh signup landing in the list) should reflect here instantly instead
  // of waiting for a manual refresh.
  useEffect(() => {
    const socket = getSocket();
    socket.on('userUpdated', refreshAll);
    socket.on('staffUpdated', refreshAll);
    return () => {
      socket.off('userUpdated', refreshAll);
      socket.off('staffUpdated', refreshAll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh, refreshAdmins]);

  // Location picker modal state — shared by "promote to Staff" and
  // "reassign an existing staff member's location".
  const [picker, setPicker] = useState(null); // { user, targetRole } | null
  const [pickedLocation, setPickedLocation] = useState('');
  const [busy, setBusy] = useState(false);

  async function applyRoleChange(user, role, targetLocationId) {
    const d = await apiRequest('/admin/users/' + user._id + '/role', { method: 'PUT', body: { role, locationId: targetLocationId } });
    if (d && d.success) {
      showToast('Role updated: ' + role, 'success');
    } else {
      showToast((d && d.message) || 'Failed.', 'danger');
    }
    refreshAll();
  }

  function updateRole(user, role) {
    if (role === 'staff') {
      // Every staff member must be linked to one parking location — ask
      // which one before applying the change.
      if (locations.length === 0) {
        showToast('Add a parking location first (Parking Locations page) before assigning staff.', 'warning');
        return;
      }
      setPickedLocation(user.locationId?._id || locations[0]._id);
      setPicker({ user, targetRole: 'staff' });
      return;
    }
    applyRoleChange(user, role, undefined);
  }

  function reassignStaff(user) {
    setPickedLocation(user.locationId?._id || (locations[0] && locations[0]._id) || '');
    setPicker({ user, targetRole: 'staff' });
  }

  async function confirmPicker() {
    if (!picker || !pickedLocation) return;
    setBusy(true);
    await applyRoleChange(picker.user, 'staff', pickedLocation);
    setBusy(false);
    setPicker(null);
  }

  async function toggleUser(id) {
    const d = await apiRequest('/admin/users/' + id + '/toggle', { method: 'PUT' });
    if (d && d.success) showToast(d.message, 'warning');
    else showToast((d && d.message) || 'Failed.', 'danger');
    refreshAll();
  }

  const roleLabel = roleView === 'staff' ? 'Staff' : 'Users';
  const selectedLocationName = locations.find((l) => l._id === locationId)?.name;

  return (
    <Layout title="User Management" badge={false}>
      <div className="ag-card" style={{ padding: '1rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '0.75rem', alignItems: 'end' }}>
          <div>
            <label className="ag-label">View</label>
            <select className="ag-select" value={roleView} onChange={(e) => changeRoleView(e.target.value)}>
              <option value="user">Users</option>
              <option value="staff">Staff</option>
            </select>
          </div>
          {roleView === 'staff' && (
            <div>
              <label className="ag-label">Show</label>
              <select className="ag-select" value={scope} onChange={(e) => changeScope(e.target.value)}>
                <option value="all">All Staff</option>
                <option value="location">Location Wise Staff</option>
              </select>
            </div>
          )}
          {roleView === 'staff' && scope === 'location' && (
            <div>
              <label className="ag-label">Location</label>
              <select className="ag-select" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                {locations.map((l) => <option key={l._id} value={l._id}>{l.name}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
          {users.length} of {total} {roleLabel.toLowerCase()} loaded
          {roleView === 'staff' && scope === 'location' && selectedLocationName ? ` at ${selectedLocationName}` : ''}
        </span>
        <button className="btn-ag ghost sm" onClick={refreshAll}><i className="bi bi-arrow-clockwise" /> Refresh</button>
      </div>

      <RoleTable
        title="Admins"
        icon="bi-shield-lock"
        rows={adminUsers}
        curUser={curUser}
        onRoleChange={updateRole}
        onToggle={toggleUser}
        emptyText={adminLoading ? 'Loading admins...' : 'No admins found.'}
      />
      <InfiniteSentinel onVisible={adminLoadMore} hasMore={adminHasMore} loading={adminLoadingMore} />

      {users.length === 0 && loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading {roleLabel.toLowerCase()}...</div>
      ) : roleView === 'staff' ? (
        <RoleTable
          title="Staff"
          icon="bi-person-badge"
          rows={users}
          curUser={curUser}
          showLocation
          onRoleChange={updateRole}
          onReassign={reassignStaff}
          onToggle={toggleUser}
          emptyText={scope === 'location' ? `No staff assigned to ${selectedLocationName || 'this location'}.` : 'No staff members found.'}
        />
      ) : (
        <RoleTable
          title="Users"
          icon="bi-people"
          rows={users}
          curUser={curUser}
          onRoleChange={updateRole}
          onToggle={toggleUser}
          emptyText="No users found."
        />
      )}

      <InfiniteSentinel onVisible={loadMore} hasMore={hasMore} loading={loadingMore} />

      <Modal
        show={!!picker}
        onClose={() => setPicker(null)}
        title={picker && picker.user.role === 'staff' ? 'Reassign Parking Location' : 'Assign Parking Location'}
        icon="bi-geo-alt-fill"
        footer={(
          <>
            <button className="btn-ag ghost" onClick={() => setPicker(null)}>Cancel</button>
            <ActionButton busy={busy} busyLabel="Saving..." className="btn-ag primary" onClick={confirmPicker} disabled={!pickedLocation}>
              <i className="bi bi-check-circle" /> Confirm
            </ActionButton>
          </>
        )}
      >
        {picker && (
          <>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 0 }}>
              <strong style={{ color: 'var(--text-main, #e8f4ff)' }}>{picker.user.name}</strong> will only be able to see and manage bookings, slots, and vehicles for the location you choose here.
            </p>
            <div className="ag-input-group" style={{ margin: 0 }}>
              <label className="ag-label">Parking Location *</label>
              <select className="ag-select" value={pickedLocation} onChange={(e) => setPickedLocation(e.target.value)}>
                {locations.map((l) => <option key={l._id} value={l._id}>{l.name}</option>)}
              </select>
            </div>
          </>
        )}
      </Modal>
    </Layout>
  );
}
