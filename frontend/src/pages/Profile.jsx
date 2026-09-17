import { useEffect, useRef, useState } from 'react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import ConfirmSheet from '../components/ConfirmSheet';
import OtpInput from '../components/OtpInput';
import PhotoCropModal from '../components/PhotoCropModal';
import { GuidelinesModal, PrivacyModal, TermsModal, RoleHelpSupportModal } from '../components/RoleSupportModals';
import { ActionButton } from '../components/Bits';
import { apiRequest } from '../lib/api';
import { useCachedState } from '../lib/useCachedState';
import { showToast } from '../lib/toast';
import { formatDate } from '../lib/utils';
import { isValidVehicleNumber, normalizeVehicleNumber } from '../lib/vehicleValidation';
import { useAuth } from '../context/AuthContext';
import { useRevalidate } from '../lib/useRevalidate';

export default function Profile() {
  const { user, updateUser, logout } = useAuth();
  const fileRef = useRef(null);

  // Cached so navigating back to Profile shows the previously-loaded
  // profile immediately instead of the "Loading..." placeholder again.
  const [profile, setProfile] = useCachedState('profile:me', null);
  const [name, setName] = useState(() => profile?.name || '');
  const [photoBase64, setPhotoBase64] = useState(undefined); // undefined = unchanged
  const [preview, setPreview] = useState(() => profile?.profilePhoto || '');
  const [saveBusy, setSaveBusy] = useState(false);

  const [curPwd, setCurPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confPwd, setConfPwd] = useState('');
  const [pwdBusy, setPwdBusy] = useState(false);

  const [emailModal, setEmailModal] = useState(false);
  const [emailStep, setEmailStep] = useState(1);
  const [newEmail, setNewEmail] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);

  const [deleteModal, setDeleteModal] = useState(false);
  const [deletePwd, setDeletePwd] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);

  // Saved vehicle removal — same custom confirm-sheet pattern as the
  // profile photo delete and Sidebar's logout confirm, not window.confirm().
  const [removeVehicleId, setRemoveVehicleId] = useState(null);
  const [removeVehicleBusy, setRemoveVehicleBusy] = useState(false);

  // ─── Profile photo action menu (view / edit / delete) ──────────────────────
  // A plain anchored dropdown, not the shared Modal — see the CSS comment on
  // .photo-actions-menu for why (the shared Modal's blurred backdrop made
  // this feel laggy for something that should open instantly).
  const [photoMenu, setPhotoMenu] = useState(false);
  const photoMenuRef = useRef(null);
  const [viewPhotoModal, setViewPhotoModal] = useState(false);
  const [deletePhotoBusy, setDeletePhotoBusy] = useState(false);
  const [deletePhotoConfirm, setDeletePhotoConfirm] = useState(false);

  // ─── Crop step (select any photo -> WhatsApp-style crop -> compress) ───────
  // The selected file never leaves the browser as-is: cropSrc is only a
  // local object URL used to render it inside the cropper, and the only
  // thing that ever reaches photoBase64 (and later the server) is the
  // cropped + compressed square JPEG produced by PhotoCropModal.
  const [cropModal, setCropModal] = useState(false);
  const [cropSrc, setCropSrc] = useState(null);

  useEffect(() => {
    if (!photoMenu) return undefined;
    function onDocClick(e) {
      if (photoMenuRef.current && !photoMenuRef.current.contains(e.target)) setPhotoMenu(false);
    }
    function onKeyDown(e) { if (e.key === 'Escape') setPhotoMenu(false); }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [photoMenu]);

  // ─── Saved Vehicles (Rule 3) ───────────────────────────────────────────────
  const [vehicles, setVehicles] = useCachedState('profile:vehicles', []);
  const [vehicleModal, setVehicleModal] = useState(false);
  const [vCategory, setVCategory] = useState('');
  const [vNumber, setVNumber] = useState('');
  const [vPending, setVPending] = useState(false);
  const [vNickname, setVNickname] = useState('');
  const [vBusy, setVBusy] = useState(false);
  const [vScanBusy, setVScanBusy] = useState(false);

  const isUserRole = user?.role === 'user';
  const role = user?.role || profile?.role || 'user';

  // Role-based Guidelines / Help & Support / Privacy / Terms — a single
  // "which one is open" flag, same pattern the Landing page uses for its
  // own About/Privacy/Terms/Help modals.
  const [supportModal, setSupportModal] = useState(null); // 'guidelines' | 'help' | 'privacy' | 'terms' | null
  const vNumberValid = vPending || isValidVehicleNumber(vNumber);

  const loadVehicles = async () => {
    const d = await apiRequest('/auth/vehicles');
    if (d && d.success) setVehicles(d.data);
  };

  useEffect(() => { if (isUserRole) loadVehicles(); }, [isUserRole]);
  function openAddVehicle() {
    setVCategory(''); setVNumber(''); setVPending(false); setVNickname('');
    setVehicleModal(true);
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ─── AI: scan a photo of a number plate to auto-fill the registration ──────
  async function scanVehiclePlate(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file next time
    if (!file) return;

    setVScanBusy(true);
    try {
      const imageBase64 = await fileToBase64(file);
      const d = await apiRequest('/ai/scan-plate', { method: 'POST', body: { imageBase64, mediaType: file.type || 'image/jpeg' } });
      if (d && d.success && d.data.plateNumber) {
        setVNumber(d.data.plateNumber);
        setVPending(false);
        if (d.data.vehicleCategoryGuess && !vCategory) setVCategory(d.data.vehicleCategoryGuess);
        if (d.data.confidence === 'low') showToast('Plate scanned, but I\'m not fully confident — please double-check it.', 'warning');
      } else {
        showToast((d && d.message) || "Couldn't read a plate in that photo. Try a clearer shot or type it in.", 'warning');
      }
    } finally {
      setVScanBusy(false);
    }
  }

  async function saveNewVehicle() {
    if (!vCategory) return showToast('Select a vehicle category.', 'warning');
    if (!vPending && !vNumber.trim()) return showToast('Enter a registration number, or mark as Registration Pending.', 'warning');
    if (!vPending && !isValidVehicleNumber(vNumber)) return showToast('Please enter a valid vehicle registration number.', 'warning');
    setVBusy(true);
    const d = await apiRequest('/auth/vehicles', {
      method: 'POST',
      body: { category: vCategory, vehicleNumber: vPending ? null : normalizeVehicleNumber(vNumber), registrationPending: vPending, nickname: vNickname.trim() || undefined },
    });
    setVBusy(false);
    if (d && d.success) {
      setVehicleModal(false);
      loadVehicles();
      showToast('Vehicle saved.', 'success');
    } else {
      showToast((d && d.message) || 'Failed to save vehicle.', 'danger');
    }
  }

  function askRemoveVehicle(id) {
    setRemoveVehicleId(id);
  }

  async function doRemoveVehicle() {
    if (!removeVehicleId) return;
    setRemoveVehicleBusy(true);
    const d = await apiRequest('/auth/vehicles/' + removeVehicleId, { method: 'DELETE' });
    setRemoveVehicleBusy(false);
    setRemoveVehicleId(null);
    if (d && d.success) { loadVehicles(); showToast('Vehicle removed.', 'success'); }
    else showToast((d && d.message) || 'Failed to remove vehicle.', 'danger');
  }

  const loadProfile = async () => {
    const d = await apiRequest('/auth/me');
    if (d && d.success) {
      setProfile(d.user);
      setName(d.user.name);
      setPreview(d.user.profilePhoto || '');
    }
  };

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reconnect/resume safety net — this page's data (profile + saved
  // vehicles) may be stale or never loaded at all if it was open while the
  // device was offline.
  useRevalidate(() => {
    loadProfile();
    if (isUserRole) loadVehicles();
  });

  function handlePhoto(e) {
    const file = e.target.files[0];
    e.target.value = ''; // allow re-selecting the same file next time
    if (!file) return;
    if (!file.type || !file.type.startsWith('image/')) {
      showToast('Please select an image file.', 'warning');
      return;
    }
    // No size/resolution restriction here — any original can be selected.
    // It's only ever read locally to drive the crop preview below; the
    // cropped + compressed result is what actually gets uploaded.
    setCropSrc(URL.createObjectURL(file));
    setCropModal(true);
  }

  function closeCropModal() {
    setCropModal(false);
    if (cropSrc) { URL.revokeObjectURL(cropSrc); setCropSrc(null); }
  }

  function handleCropDone(dataUrl) {
    setPhotoBase64(dataUrl);
    setPreview(dataUrl);
    closeCropModal();
  }

  function openEditPhoto() {
    setPhotoMenu(false);
    fileRef.current?.click();
  }

  // Confirmation is a small custom card (see .confirm-sheet in style.css),
  // not window.confirm() — the browser always prefixes a native confirm()
  // with the page's origin ("your-domain says ..."), which can't be
  // removed/restyled, and isn't the clean look we want here.
  function askDeletePhoto() {
    setPhotoMenu(false);
    setDeletePhotoConfirm(true);
  }

  async function doDeletePhoto() {
    setDeletePhotoConfirm(false);
    setDeletePhotoBusy(true);
    const d = await apiRequest('/auth/profile', { method: 'PUT', body: { profilePhoto: null } });
    setDeletePhotoBusy(false);
    if (d && d.success) {
      setPreview('');
      setPhotoBase64(undefined);
      updateUser({ profilePhoto: null });
      setProfile((p) => ({ ...p, profilePhoto: null }));
      showToast('Profile photo removed.', 'success');
    } else {
      showToast((d && d.message) || 'Failed to remove photo.', 'danger');
    }
  }

  async function saveProfile(e) {
    e.preventDefault();
    setSaveBusy(true);
    const body = { name: name.trim() };
    if (photoBase64 !== undefined) body.profilePhoto = photoBase64;
    const d = await apiRequest('/auth/profile', { method: 'PUT', body });
    setSaveBusy(false);
    if (d && d.success) {
      updateUser(d.user);
      setProfile((p) => ({ ...p, ...d.user }));
      showToast('Profile updated successfully!', 'success');
    } else {
      showToast((d && d.message) || 'Failed.', 'danger');
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    if (newPwd !== confPwd) return showToast('New passwords do not match.', 'danger');
    setPwdBusy(true);
    const d = await apiRequest('/auth/change-password', { method: 'PUT', body: { currentPassword: curPwd, newPassword: newPwd } });
    setPwdBusy(false);
    if (d && d.success) {
      showToast('Password updated!', 'success');
      setCurPwd(''); setNewPwd(''); setConfPwd('');
    } else {
      showToast((d && d.message) || 'Failed.', 'danger');
    }
  }

  function openEmailChange() {
    setEmailStep(1);
    setNewEmail(''); setEmailOtp('');
    setEmailModal(true);
  }

  async function sendEmailOTP() {
    if (!newEmail.trim()) return showToast('Enter a new email.', 'warning');
    setEmailBusy(true);
    const d = await apiRequest('/auth/email-change/initiate', { method: 'POST', body: { newEmail: newEmail.trim() } });
    setEmailBusy(false);
    if (d && d.success) {
      setEmailStep(2);
    } else {
      showToast((d && d.message) || 'Failed.', 'danger');
    }
  }

  async function verifyEmailOTP() {
    if (emailOtp.length < 6) return showToast('Enter all 6 digits.', 'warning');
    setEmailBusy(true);
    const d = await apiRequest('/auth/email-change/verify', { method: 'POST', body: { otp: emailOtp } });
    setEmailBusy(false);
    if (d && d.success) {
      updateUser(d.user);
      setProfile((p) => ({ ...p, email: d.user.email }));
      setEmailModal(false);
      showToast('Email updated to ' + d.user.email, 'success');
    } else {
      showToast((d && d.message) || 'Failed.', 'danger');
    }
  }

  async function doDelete() {
    if (!deletePwd) return showToast('Enter your password.', 'warning');
    setDeleteBusy(true);
    const d = await apiRequest('/auth/account', { method: 'DELETE', body: { password: deletePwd } });
    setDeleteBusy(false);
    if (d && d.success) {
      logout();
    } else {
      showToast((d && d.message) || 'Failed.', 'danger');
    }
  }

  if (!profile) return <Layout title="Operator Profile"><p style={{ color: 'var(--t2)' }}>Loading...</p></Layout>;

  return (
    <Layout title="Operator Profile" badge={false}>
      <div className="profile-grid">

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div className="ag-card ag-card-body">
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '.65rem', color: 'var(--t2)', letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: '1.4rem' }}>Identity</div>

          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div ref={photoMenuRef} style={{ position: 'relative', display: 'inline-block' }}>
              <div className="profile-avatar-wrap" onClick={() => setPhotoMenu((v) => !v)}>
                {preview ? (
                  <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
                ) : (
                  <span>{profile.name.charAt(0).toUpperCase()}</span>
                )}
                <div className="profile-avatar-overlay"><i className="bi bi-three-dots" style={{ fontSize: '1.1rem' }} /><span>Options</span></div>
              </div>
              {photoMenu && (
                <div className="photo-actions-menu" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    disabled={!preview}
                    onClick={() => { setPhotoMenu(false); setViewPhotoModal(true); }}
                  >
                    <i className="bi bi-eye" /> View Photo
                  </button>
                  <button type="button" role="menuitem" onClick={openEditPhoto}>
                    <i className="bi bi-pencil" /> Edit Photo
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="danger"
                    disabled={!preview || deletePhotoBusy}
                    onClick={askDeletePhoto}
                  >
                    <i className="bi bi-trash3" /> {deletePhotoBusy ? 'Removing...' : 'Delete Photo'}
                  </button>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
            <div style={{ fontSize: '.72rem', color: 'var(--t2)', fontFamily: "'Syne',sans-serif", letterSpacing: '.08em' }}>CLICK FOR PHOTO OPTIONS</div>
          </div>

          <form onSubmit={saveProfile}>
            <div className="ag-input-group">
              <label className="ag-label">Display Name</label>
              <div className="ag-input-icon"><i className="bi bi-person" /><input className="ag-input" type="text" required value={name} onChange={(e) => setName(e.target.value)} /></div>
            </div>
            <div className="ag-input-group">
              <label className="ag-label">Email</label>
              <div style={{ position: 'relative' }}>
                <div className="ag-input-icon"><i className="bi bi-at" /><input className="ag-input" type="email" disabled value={profile.email} style={{ opacity: .5, cursor: 'default', paddingRight: '3rem' }} /></div>
                <button type="button" className="btn-ag plasma sm" style={{ position: 'absolute', right: '.4rem', top: '50%', transform: 'translateY(-50%)' }} onClick={openEmailChange}>
                  <i className="bi bi-pencil" /> 
                </button>
              </div>
            </div>
            <div className="ag-input-group">
              <label className="ag-label">Account Status</label>
              <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', padding: '.5rem 0' }}>
                <span className={`ag-badge ${profile.isEmailVerified ? 'verified' : 'unverified'}`}>{profile.isEmailVerified ? 'Verified' : 'Unverified'}</span>
                <span className={`ag-badge ${profile.role}`}>{profile.role}</span>
                <span style={{ fontSize: '.75rem', color: 'var(--t2)' }}>Since {formatDate(profile.createdAt)}</span>
              </div>
            </div>
            <ActionButton type="submit" busy={saveBusy} busyLabel="Saving..." className="btn-ag primary full">
              <i className="bi bi-cloud-upload" /> Save Changes
            </ActionButton>
          </form>
        </div>

          {isUserRole ? (
            <div className="ag-card ag-card-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '.65rem', color: 'var(--t2)', letterSpacing: '.15em', textTransform: 'uppercase' }}>My Vehicles</div>
                <button type="button" className="btn-ag plasma sm" onClick={openAddVehicle}><i className="bi bi-plus-lg" /> Add Vehicle</button>
              </div>
              {vehicles.length === 0 ? (
                <p style={{ fontSize: '.82rem', color: 'var(--t2)' }}>No saved vehicles yet. Add one so you can pick it instantly when booking a slot.</p>
              ) : (
                <div
                  className="vehicle-list-scroll"
                  style={{ display: 'flex', flexDirection: 'column', gap: '.6rem', height: '84px', overflowY: 'auto', paddingRight: '.4rem' }}
                >
                  {vehicles.map((v) => (
                    <div key={v._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.6rem .8rem', border: '1px solid var(--t4)', borderRadius: '10px', flexShrink: 0 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontFamily: 'monospace' }}>
                          {v.registrationPending ? <span className="ag-badge unverified">Pending</span> : v.vehicleNumber}
                        </div>
                        <small style={{ color: 'var(--t2)' }}>{v.nickname ? v.nickname + ' · ' : ''}{v.category}</small>
                      </div>
                      <button className="btn-ag red sm" onClick={() => askRemoveVehicle(v._id)}><i className="bi bi-trash3" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="ag-card ag-card-body">
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '.65rem', color: 'var(--t2)', letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: '1.2rem' }}>Support & Legal</div>
              <div className="support-legal-grid">
                <button type="button" className="btn-ag ghost" onClick={() => setSupportModal('guidelines')}>
                  <i className="bi bi-signpost-2" /> Guidelines
                </button>
                <button type="button" className="btn-ag ghost" onClick={() => setSupportModal('help')}>
                  <i className="bi bi-life-preserver" /> Help &amp; Support
                </button>
                <button type="button" className="btn-ag ghost" onClick={() => setSupportModal('privacy')}>
                  <i className="bi bi-shield-lock" /> Privacy Policy
                </button>
                <button type="button" className="btn-ag ghost" onClick={() => setSupportModal('terms')}>
                  <i className="bi bi-file-earmark-text" /> Terms &amp; Conditions
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="ag-card ag-card-body">
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '.65rem', color: 'var(--t2)', letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: '1.2rem' }}>Security</div>
            <form onSubmit={savePassword}>
              <div className="ag-input-group">
                <label className="ag-label">Current Password</label>
                <div className="ag-input-icon"><i className="bi bi-lock" /><input className="ag-input" type="password" placeholder="Enter current password" required value={curPwd} onChange={(e) => setCurPwd(e.target.value)} /></div>
              </div>
              <div className="ag-input-group">
                <label className="ag-label">New Password</label>
                <div className="ag-input-icon"><i className="bi bi-lock-fill" /><input className="ag-input" type="password" placeholder="Min 6 characters" required minLength={6} value={newPwd} onChange={(e) => setNewPwd(e.target.value)} /></div>
              </div>
              <div className="ag-input-group">
                <label className="ag-label">Confirm New Password</label>
                <div className="ag-input-icon"><i className="bi bi-lock-fill" /><input className="ag-input" type="password" placeholder="Repeat new password" required value={confPwd} onChange={(e) => setConfPwd(e.target.value)} /></div>
              </div>
              <ActionButton type="submit" busy={pwdBusy} busyLabel="Updating..." className="btn-ag aurora full">
                <i className="bi bi-shield-lock" /> Update Password
              </ActionButton>
            </form>
          </div>

          {isUserRole && (
            <div className="ag-card ag-card-body">
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '.65rem', color: 'var(--t2)', letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: '1.2rem' }}>Support & Legal</div>
              <div className="support-legal-grid">
                <button type="button" className="btn-ag ghost" onClick={() => setSupportModal('guidelines')}>
                  <i className="bi bi-signpost-2" /> Guidelines
                </button>
                <button type="button" className="btn-ag ghost" onClick={() => setSupportModal('help')}>
                  <i className="bi bi-life-preserver" /> Help &amp; Support
                </button>
                <button type="button" className="btn-ag ghost" onClick={() => setSupportModal('privacy')}>
                  <i className="bi bi-shield-lock" /> Privacy Policy
                </button>
                <button type="button" className="btn-ag ghost" onClick={() => setSupportModal('terms')}>
                  <i className="bi bi-file-earmark-text" /> Terms &amp; Conditions
                </button>
              </div>
            </div>
          )}

          <div className="ag-card ag-card-body" style={{ borderColor: 'rgba(255,60,120,.15)' }}>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '.65rem', color: 'var(--nova)', letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: '1rem' }}>Danger Zone</div>
            <p style={{ fontSize: '.82rem', color: 'var(--t2)', marginBottom: '1rem', lineHeight: 1.6 }}>
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
            <button className="btn-ag nova full" onClick={() => { setDeletePwd(''); setDeleteModal(true); }}>
              <i className="bi bi-exclamation-triangle" /> Delete Account
            </button>
          </div>
        </div>
      </div>

      <Modal show={emailModal} onClose={() => setEmailModal(false)} title="Change Email" icon="bi-at" size="sm">
        {emailStep === 1 && (
          <>
            <div className="ag-input-group">
              <label className="ag-label">New Email Address</label>
              <div className="ag-input-icon"><i className="bi bi-at" /><input className="ag-input" type="email" placeholder="new@email.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} /></div>
            </div>
            <ActionButton busy={emailBusy} busyLabel="Sending..." className="btn-ag primary full" onClick={sendEmailOTP}>
              <i className="bi bi-send" /> Send Verification Code
            </ActionButton>
          </>
        )}
        {emailStep === 2 && (
          <>
            <div style={{ textAlign: 'center', marginBottom: '1rem', fontSize: '.82rem', color: 'var(--t2)' }}>
              Code sent to <strong style={{ color: 'var(--plasma)' }}>{newEmail}</strong>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <OtpInput value={emailOtp} onChange={setEmailOtp} autoFocus />
            </div>
            <ActionButton busy={emailBusy} busyLabel="Confirming..." className="btn-ag aurora full" onClick={verifyEmailOTP}>
              <i className="bi bi-check-shield" /> Confirm Email Change
            </ActionButton>
          </>
        )}
      </Modal>

      <Modal
        show={deleteModal}
        onClose={() => setDeleteModal(false)}
        title="Delete Account"
        icon="bi-exclamation-triangle"
        size="sm"
        headerStyle={{ background: 'linear-gradient(135deg,rgba(255,60,120,.12),rgba(200,0,50,.08))' }}
        footer={(
          <>
            <button className="btn-ag ghost" onClick={() => setDeleteModal(false)}>Cancel</button>
            <ActionButton busy={deleteBusy} busyLabel="Deleting..." className="btn-ag nova" onClick={doDelete}>
              <i className="bi bi-trash3" /> Delete Forever
            </ActionButton>
          </>
        )}
      >
        <p style={{ fontSize: '.84rem', color: 'var(--t2)', marginBottom: '1rem' }}>This will permanently delete your account. Enter your password to confirm.</p>
        <div className="ag-input-group">
          <label className="ag-label">Password</label>
          <div className="ag-input-icon"><i className="bi bi-lock" /><input className="ag-input" type="password" placeholder="Your password" value={deletePwd} onChange={(e) => setDeletePwd(e.target.value)} /></div>
        </div>
      </Modal>

      <Modal show={viewPhotoModal} onClose={() => setViewPhotoModal(false)} title="Profile Photo" icon="bi-image" size="sm">
        <div style={{ textAlign: 'center' }}>
          {preview ? (
            <img
              src={preview}
              alt="Profile"
              style={{ maxWidth: '100%', maxHeight: '60vh', borderRadius: '12px', objectFit: 'contain' }}
            />
          ) : (
            <p style={{ color: 'var(--t2)' }}>No profile photo set.</p>
          )}
        </div>
      </Modal>

      <PhotoCropModal
        show={cropModal}
        imageSrc={cropSrc}
        onCancel={closeCropModal}
        onDone={handleCropDone}
      />

      <GuidelinesModal role={role} show={supportModal === 'guidelines'} onClose={() => setSupportModal(null)} />
      <RoleHelpSupportModal role={role} show={supportModal === 'help'} onClose={() => setSupportModal(null)} />
      <PrivacyModal role={role} show={supportModal === 'privacy'} onClose={() => setSupportModal(null)} />
      <TermsModal role={role} show={supportModal === 'terms'} onClose={() => setSupportModal(null)} />

      {deletePhotoConfirm && (
        <ConfirmSheet
          show={deletePhotoConfirm}
          message="Remove profile picture?"
          confirmLabel="Remove"
          busy={deletePhotoBusy}
          busyLabel="Removing..."
          onCancel={() => setDeletePhotoConfirm(false)}
          onConfirm={doDeletePhoto}
        />
      )}

      {removeVehicleId && (
        <ConfirmSheet
          show={!!removeVehicleId}
          message="Remove this vehicle from your account?"
          confirmLabel="Remove"
          busy={removeVehicleBusy}
          busyLabel="Removing..."
          onCancel={() => setRemoveVehicleId(null)}
          onConfirm={doRemoveVehicle}
        />
      )}

      {isUserRole && (
        <Modal
          show={vehicleModal}
          onClose={() => setVehicleModal(false)}
          title="Add Vehicle"
          icon="bi-car-front"
          size="sm"
          footer={(
            <>
              <button className="btn-ag ghost" onClick={() => setVehicleModal(false)}>Cancel</button>
              <ActionButton
                busy={vBusy}
                busyLabel="Saving..."
                className="btn-ag green"
                onClick={saveNewVehicle}
                disabled={vBusy || !vCategory || !vNumberValid}
              >
                <i className="bi bi-check-circle" /> Save Vehicle
              </ActionButton>
            </>
          )}
        >
          <div className="ag-input-group">
            <label className="ag-label">Category</label>
            <select className="ag-select" value={vCategory} onChange={(e) => setVCategory(e.target.value)}>
              <option value="">Select category...</option>
              <option value="2 Wheeler">2 Wheeler</option>
              <option value="3 Wheeler">3 Wheeler</option>
              <option value="4 Wheeler">4 Wheeler</option>
            </select>
          </div>
          <div className="ag-input-group">
            <label className="ag-label">Registration Number</label>
            <div style={{ display: 'flex', gap: '.5rem', alignItems: 'stretch' }}>
              <input
                className="ag-input"
                type="text"
                placeholder="e.g. WB 02 AB 1234"
                value={vPending ? '' : vNumber}
                onChange={(e) => setVNumber(e.target.value)}
                disabled={vPending}
                autoCapitalize="characters"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                style={{ flex: 1, textTransform: 'uppercase', ...(vPending ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}
              />
              <label className="btn-ag plasma sm" style={{ flexShrink: 0, cursor: vPending || vScanBusy ? 'not-allowed' : 'pointer', opacity: vPending || vScanBusy ? 0.5 : 1 }}>
                {vScanBusy ? <span className="spinner-border-sm" /> : <i className="bi bi-camera" />}
                <input type="file" accept="image/*" capture="environment" onChange={scanVehiclePlate} disabled={vPending || vScanBusy} style={{ display: 'none' }} />
              </label>
            </div>
            {!vPending && vNumber.trim() && !vNumberValid && (
              <div style={{ fontSize: '.72rem', color: 'var(--nova, #ff3c78)', marginTop: '.35rem' }}>
                Please enter a valid vehicle registration number.
              </div>
            )}
            <label className="ag-check-row">
              <input type="checkbox" checked={vPending} onChange={(e) => setVPending(e.target.checked)} />
              <span>Registration Pending (New Vehicle)</span>
            </label>
          </div>
          <div className="ag-input-group">
            <label className="ag-label">Nickname (optional)</label>
            <input className="ag-input" type="text" placeholder="e.g. My Scooter" value={vNickname} onChange={(e) => setVNickname(e.target.value)} />
          </div>
        </Modal>
      )}
    </Layout>
  );
}