import { useEffect, useState } from 'react';
import Modal from './Modal';
import { ActionButton } from './Bits';
import { apiRequest } from '../lib/api';
import { showToast } from '../lib/toast';
import { isValidVehicleNumber, normalizeVehicleNumber } from '../lib/vehicleValidation';

/**
 * Self-contained "confirm booking" modal: loads the user's saved vehicles,
 * lets them pick one or enter a new vehicle, then POSTs to the existing
 * /api/bookings endpoint. This is the only way users book a slot — always
 * reached through Nearby Parking (pick a location → pick one of its
 * slots), never a raw cross-location slot list.
 */
export default function BookingModal({ slot, show, onClose, onBooked }) {
  const [savedVehicles, setSavedVehicles] = useState([]);
  const [vehicleChoice, setVehicleChoice] = useState('');
  const [vehicleCategory, setVehicleCategory] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [registrationPending, setRegistrationPending] = useState(false);
  const [saveVehicle, setSaveVehicle] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [invalidField, setInvalidField] = useState(null);

  const isNewVehicleNumberValid = registrationPending || isValidVehicleNumber(vehicleNumber);

  useEffect(() => {
    if (!show || !slot) return;
    setVehicleCategory('');
    setVehicleNumber('');
    setRegistrationPending(false);
    setSaveVehicle(false);
    setVehicleChoice('');
    setInvalidField(null);

    (async () => {
      const d = await apiRequest('/auth/vehicles');
      if (d && d.success) {
        setSavedVehicles(d.data);
        if (d.data.length > 0) setVehicleChoice(d.data[0]._id);
      }
    })();
  }, [show, slot]);

  function pickVehicle(id) {
    setVehicleChoice(id);
    if (id) {
      setVehicleCategory('');
      setVehicleNumber('');
      setRegistrationPending(false);
    }
  }

  function pulseInvalid(field) {
    setInvalidField(null);
    requestAnimationFrame(() => setInvalidField(field));
  }

  async function confirmBooking() {
    if (!slot) return;
    const body = { slotId: slot._id };

    if (vehicleChoice) {
      body.vehicleId = vehicleChoice;
    } else {
      if (!vehicleCategory) {
        pulseInvalid('category');
        return showToast('Select a vehicle category.', 'warning');
      }
      if (!registrationPending && !vehicleNumber.trim()) {
        pulseInvalid('number');
        return showToast('Enter your vehicle registration number, or check "Registration Pending".', 'warning');
      }
      if (!registrationPending && !isValidVehicleNumber(vehicleNumber)) {
        pulseInvalid('number');
        return showToast('Please enter a valid vehicle registration number.', 'warning');
      }
      body.vehicleCategory = vehicleCategory;
      body.vehicleNumber = registrationPending ? null : normalizeVehicleNumber(vehicleNumber);
      body.registrationPending = registrationPending;
      body.saveVehicle = saveVehicle;
    }

    setConfirmBusy(true);
    const data = await apiRequest('/bookings', { method: 'POST', body });
    setConfirmBusy(false);
    if (data && data.success) {
      showToast('Slot ' + slot.slotNumber + ' booked! Check in within 1 hour.', 'success');
      onBooked && onBooked(data.data);
    } else {
      showToast((data && data.message) || 'Booking failed.', 'danger');
    }
  }

  return (
    <Modal
      show={show}
      onClose={onClose}
      title="Confirm Booking"
      icon="bi-calendar-check"
      footer={(
        <>
          <button className="btn-ag ghost" onClick={onClose}>Cancel</button>
          <ActionButton
            busy={confirmBusy}
            busyLabel="Booking..."
            className="btn-ag aurora"
            onClick={confirmBooking}
            disabled={confirmBusy || (!vehicleChoice && (!vehicleCategory || !isNewVehicleNumberValid))}
          >
            <i className="bi bi-check-circle" /> Confirm Booking
          </ActionButton>
        </>
      )}
    >
      {slot && (
        <>
          <div className="bill-receipt">
            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', marginBottom: '0.3rem' }}>SELECTED SLOT</div>
            <div className="font-orbit" style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--neon-cyan)' }}>{slot.slotNumber}</div>
            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>{slot.slotType} · {slot.location}{slot.floor ? ` · Floor ${slot.floor}` : ''}</div>
          </div>
          <table className="bill-table">
            <tbody>
              <tr><td>Type</td><td>{slot.slotType}</td></tr>
              <tr><td>Location</td><td>{slot.location}</td></tr>
              {slot.floor && <tr><td>Floor</td><td>{slot.floor}</td></tr>}
              <tr><td>Rate</td><td>₹{slot.hourlyRate}/hour</td></tr>
              <tr><td>Booking Time</td><td>{new Date().toLocaleString('en-IN')} (now)</td></tr>
            </tbody>
          </table>

          <div className="ag-input-group" style={{ marginTop: '1rem' }}>
            <label className="ag-label">Vehicle</label>
            {savedVehicles.length > 0 && (
              <select className="ag-select" value={vehicleChoice} onChange={(e) => pickVehicle(e.target.value)}>
                {savedVehicles.map((v) => (
                  <option key={v._id} value={v._id}>
                    {v.nickname ? v.nickname + ' — ' : ''}{v.category} · {v.registrationPending ? 'Registration Pending' : v.vehicleNumber}
                  </option>
                ))}
                <option value="">+ Use a new vehicle...</option>
              </select>
            )}
          </div>

          {!vehicleChoice && (
            <>
              <div className="ag-input-group">
                <label className="ag-label">Vehicle Category</label>
                <select
                  className={`ag-select${invalidField === 'category' ? ' field-blink-error' : ''}`}
                  value={vehicleCategory}
                  onChange={(e) => { setVehicleCategory(e.target.value); setInvalidField(null); }}
                  required
                >
                  <option value="">Select category...</option>
                  <option value="2 Wheeler">2 Wheeler</option>
                  <option value="3 Wheeler">3 Wheeler</option>
                  <option value="4 Wheeler">4 Wheeler</option>
                </select>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginTop: '0.35rem' }}>
                  Buses, trucks, and other heavy vehicles are not supported.
                </div>
              </div>
              <div className="ag-input-group">
                <label className="ag-label">Vehicle Registration Number</label>
                <div className="ag-input-icon">
                  <i className="bi bi-car-front" />
                  <input
                    className={`ag-input${invalidField === 'number' ? ' field-blink-error' : ''}`}
                    type="text"
                    placeholder="e.g. WB 02 AB 1234"
                    value={registrationPending ? '' : vehicleNumber}
                    onChange={(e) => { setVehicleNumber(e.target.value); setInvalidField(null); }}
                    disabled={registrationPending}
                    required={!registrationPending}
                    autoCapitalize="characters"
                    autoCorrect="off"
                    autoComplete="off"
                    spellCheck={false}
                    style={{ textTransform: 'uppercase', ...(registrationPending ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}
                  />
                </div>
                {!registrationPending && vehicleNumber.trim() && !isNewVehicleNumberValid && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--neon-orange)', marginTop: '0.35rem' }}>
                    Please enter a valid vehicle registration number.
                  </div>
                )}
                <label className="ag-check-row">
                  <input
                    type="checkbox"
                    checked={registrationPending}
                    onChange={(e) => { setRegistrationPending(e.target.checked); setInvalidField(null); }}
                  />
                  <span>Registration Pending (New Vehicle)</span>
                </label>
                <label className="ag-check-row">
                  <input
                    type="checkbox"
                    checked={saveVehicle}
                    onChange={(e) => setSaveVehicle(e.target.checked)}
                  />
                  <span>Save this vehicle to my account</span>
                </label>
              </div>
            </>
          )}

          <div className="ag-alert info" style={{ marginTop: '1rem', marginBottom: 0, fontSize: '0.8rem' }}>
            <i className="bi bi-info-circle" /> Booking is for right now. You have 1 hour to check in before it auto-expires and the slot is released. Min 1-hour billing; final bill calculated at check-out.
          </div>
        </>
      )}
    </Modal>
  );
}