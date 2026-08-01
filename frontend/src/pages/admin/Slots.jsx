import { useCallback, useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import Alert from '../../components/Alert';
import Modal from '../../components/Modal';
import InfiniteSentinel from '../../components/InfiniteSentinel';
import { StatusBadge, ActionButton, EmptyState } from '../../components/Bits';
import { apiRequest } from '../../lib/api';
import { useInfiniteList } from '../../lib/useInfiniteList';
import { showToast } from '../../lib/toast';
import { getSocket } from '../../lib/socket';

const emptyForm = { slotNumber: '', hourlyRate: '', slotType: 'standard', location: '', floor: '' };

const CATEGORIES = [
  { type: 'standard', title: 'Standard', icon: 'bi-p-square' },
  { type: 'faculty', title: 'Faculty', icon: 'bi-mortarboard' },
  { type: 'disabled', title: 'Disabled', icon: 'bi-universal-access-circle' },
  { type: 'ev', title: 'EV Charging', icon: 'bi-ev-station' },
];

function SlotTable({ title, icon, slots, loading, loadingMore, hasMore, loadMore, total, onOpenPrice, onDelete, onAdd }) {
  return (
    <div className="table-card" style={{ marginBottom: '1.4rem' }}>
      <div className="tc-header">
        <h6>
          <i className={`bi ${icon}`} style={{ marginRight: '0.4rem' }} />
          {title} <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 400 }}>({slots.length}/{total} loaded)</span>
        </h6>
        <button className="btn-ag primary sm" onClick={onAdd}><i className="bi bi-plus-circle" /> Add</button>
      </div>
      <div className="table-responsive">
        <table className="ag-table">
          <thead><tr><th>Slot #</th><th>Location</th><th>Floor</th><th>Rate/hr</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {slots.length === 0 && loading ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Loading slots...</td></tr>
            ) : slots.length === 0 ? (
              <tr><td colSpan={6}><EmptyState icon="bi-grid-3x3-gap">No {title.toLowerCase()} slots yet.</EmptyState></td></tr>
            ) : slots.map((s) => (
              <tr key={s._id}>
                <td><strong style={{ color: 'var(--neon-cyan)' }}>{s.slotNumber}</strong></td>
                <td>{s.location}</td>
                <td>{s.floor}</td>
                <td style={{ color: 'var(--neon-green)' }}>
                  ₹{s.hourlyRate}{' '}
                  <button onClick={() => onOpenPrice(s._id, s.hourlyRate)} style={{ background: 'none', border: 'none', color: 'var(--neon-cyan)', cursor: 'pointer', fontSize: '0.8rem', padding: '0 0.25rem' }}>
                    <i className="bi bi-pencil" />
                  </button>
                </td>
                <td><StatusBadge status={s.status} /></td>
                <td><button className="btn-ag red sm" onClick={() => onDelete(s._id, s.slotNumber)}><i className="bi bi-trash" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {slots.length > 0 && (
        <InfiniteSentinel onVisible={loadMore} hasMore={hasMore} loading={loadingMore} />
      )}
    </div>
  );
}

export default function AdminSlots() {
  // One independent, server-filtered, infinitely-scrollable list per slot
  // category — mirrors the Admins/Staff/Users split on the Manage Users page.
  const standardBuild = useCallback((page, limit) => `/slots/all?type=standard&page=${page}&limit=${limit}`, []);
  const facultyBuild = useCallback((page, limit) => `/slots/all?type=faculty&page=${page}&limit=${limit}`, []);
  const disabledBuild = useCallback((page, limit) => `/slots/all?type=disabled&page=${page}&limit=${limit}`, []);
  const evBuild = useCallback((page, limit) => `/slots/all?type=ev&page=${page}&limit=${limit}`, []);

  const standardList = useInfiniteList(standardBuild, [], 20);
  const facultyList = useInfiniteList(facultyBuild, [], 20);
  const disabledList = useInfiniteList(disabledBuild, [], 20);
  const evList = useInfiniteList(evBuild, [], 20);

  const listsByType = { standard: standardList, faculty: facultyList, disabled: disabledList, ev: evList };

  const refreshAll = useCallback(() => {
    standardList.refresh();
    facultyList.refresh();
    disabledList.refresh();
    evList.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [addBusy, setAddBusy] = useState(false);
  const [addAlert, setAddAlert] = useState({ message: '', type: 'info' });

  const [priceOpen, setPriceOpen] = useState(false);
  const [priceId, setPriceId] = useState(null);
  const [priceVal, setPriceVal] = useState('');
  const [priceBusy, setPriceBusy] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    socket.on('slotUpdated', refreshAll);
    socket.on('slotDeleted', refreshAll);
    return () => {
      socket.off('slotUpdated', refreshAll);
      socket.off('slotDeleted', refreshAll);
    };
  }, [refreshAll]);

  function openAdd(defaultType) {
    setForm({ ...emptyForm, slotType: defaultType || 'standard' });
    setAddAlert({ message: '', type: 'info' });
    setAddOpen(true);
  }

  async function addSlot() {
    setAddBusy(true);
    const d = await apiRequest('/admin/slots', {
      method: 'POST',
      body: {
        slotNumber: form.slotNumber,
        hourlyRate: parseFloat(form.hourlyRate),
        slotType: form.slotType,
        location: form.location || 'Main Campus',
        floor: form.floor || 'Ground',
      },
    });
    setAddBusy(false);
    if (d && d.success) {
      setAddOpen(false);
      showToast('Slot added!', 'success');
      refreshAll();
    } else {
      setAddAlert({ message: (d && d.message) || 'Failed.', type: 'danger' });
    }
  }

  function openPrice(id, rate) {
    setPriceId(id);
    setPriceVal(String(rate));
    setPriceOpen(true);
  }

  async function updatePrice() {
    setPriceBusy(true);
    const d = await apiRequest('/admin/slots/' + priceId + '/pricing', { method: 'PUT', body: { hourlyRate: parseFloat(priceVal) } });
    setPriceBusy(false);
    if (d && d.success) {
      setPriceOpen(false);
      showToast('Pricing updated!', 'success');
      refreshAll();
    } else {
      showToast((d && d.message) || 'Failed.', 'danger');
    }
  }

  async function delSlot(id, num) {
    if (!confirm('Delete slot ' + num + '?')) return;
    const d = await apiRequest('/admin/slots/' + id, { method: 'DELETE' });
    if (d && d.success) { showToast('Slot deleted.', 'warning'); refreshAll(); }
    else showToast((d && d.message) || 'Failed.', 'danger');
  }

  return (
    <Layout title="Slot Management" badge={false} right={<button className="btn-ag primary sm" onClick={() => openAdd('standard')}><i className="bi bi-plus-circle" /> Add Slot</button>}>
      {CATEGORIES.map((cat) => {
        const list = listsByType[cat.type];
        return (
          <SlotTable
            key={cat.type}
            title={cat.title}
            icon={cat.icon}
            slots={list.items}
            loading={list.loading}
            loadingMore={list.loadingMore}
            hasMore={list.hasMore}
            loadMore={list.loadMore}
            total={list.total}
            onOpenPrice={openPrice}
            onDelete={delSlot}
            onAdd={() => openAdd(cat.type)}
          />
        );
      })}

      <Modal
        show={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add New Slot"
        icon="bi-plus-circle"
        footer={(
          <>
            <button className="btn-ag ghost" onClick={() => setAddOpen(false)}>Cancel</button>
            <ActionButton busy={addBusy} busyLabel="Adding..." className="btn-ag primary" onClick={addSlot}><i className="bi bi-plus-circle" /> Add Slot</ActionButton>
          </>
        )}
      >
        <Alert message={addAlert.message} type={addAlert.type} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div className="ag-input-group" style={{ margin: 0 }}><label className="ag-label">Slot Number *</label><input className="ag-input" placeholder="P001" value={form.slotNumber} onChange={(e) => setForm({ ...form, slotNumber: e.target.value })} /></div>
          <div className="ag-input-group" style={{ margin: 0 }}><label className="ag-label">Hourly Rate (₹) *</label><input className="ag-input" type="number" min="0" placeholder="20" value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })} /></div>
          <div className="ag-input-group" style={{ margin: 0 }}>
            <label className="ag-label">Type</label>
            <select className="ag-select" value={form.slotType} onChange={(e) => setForm({ ...form, slotType: e.target.value })}>
              <option value="standard">Standard</option>
              <option value="faculty">Faculty</option>
              <option value="disabled">Disabled</option>
              <option value="ev">EV Charging</option>
            </select>
          </div>
          <div className="ag-input-group" style={{ margin: 0 }}><label className="ag-label">Location</label><input className="ag-input" placeholder="Block A" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
          <div className="ag-input-group" style={{ margin: 0 }}><label className="ag-label">Floor</label><input className="ag-input" placeholder="Ground" value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} /></div>
        </div>
      </Modal>

      <Modal
        show={priceOpen}
        onClose={() => setPriceOpen(false)}
        title="Update Rate"
        icon="bi-pencil"
        size="sm"
        footer={(
          <>
            <button className="btn-ag ghost" onClick={() => setPriceOpen(false)}>Cancel</button>
            <ActionButton busy={priceBusy} busyLabel="Updating..." className="btn-ag primary" onClick={updatePrice}><i className="bi bi-check-circle" /> Update</ActionButton>
          </>
        )}
      >
        <label className="ag-label">New Rate (₹/hr)</label>
        <input className="ag-input" type="number" min="0" value={priceVal} onChange={(e) => setPriceVal(e.target.value)} />
      </Modal>
    </Layout>
  );
}