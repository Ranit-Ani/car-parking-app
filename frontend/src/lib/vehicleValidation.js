// ─── Indian vehicle registration number validation (frontend) ─────────────
// Mirrors backend/utils/vehicleValidation.js so the same rules are enforced
// on both sides. Keep the two in sync if the format rules ever change.
//
// Standard format:  SS RR CCC NNNN
//   SS   - 2-letter state/UT code (e.g. WB, DL, MH)
//   RR   - 1 or 2 digit RTO code (01-99)
//   CCC  - 1 to 3 letter series
//   NNNN - 4 digit unique number
//
// Accepted with or without spaces: "WB 01 AB 1234" and "WB01AB1234" are
// both valid and are normalized to the same compact, space-free form.

export const VALID_STATE_CODES = new Set([
  'AN', 'AP', 'AR', 'AS', 'BR', 'CG', 'CH', 'DD', 'DL', 'DN', 'DH',
  'GA', 'GJ', 'HR', 'HP', 'JH', 'JK', 'KA', 'KL', 'LA', 'LD',
  'MH', 'ML', 'MN', 'MP', 'MZ', 'NL', 'OD', 'OR', 'PB', 'PY',
  'RJ', 'SK', 'TN', 'TR', 'TS', 'UA', 'UK', 'UP', 'WB',
]);

const VEHICLE_NUMBER_REGEX = /^([A-Z]{2})(\d{1,2})([A-Z]{1,3})(\d{4})$/;

// Bharat Series: YY BH #### XX
const BH_SERIES_REGEX = /^(\d{2})BH(\d{4})([A-Z]{2})$/;

/** Strip spaces/hyphens and uppercase, so the user can type it any way. */
export function normalizeVehicleNumber(raw) {
  if (raw === null || raw === undefined) return '';
  return String(raw).toUpperCase().replace(/[\s-]+/g, '').trim();
}

/** True if `raw` is a real Indian vehicle registration number. */
export function isValidVehicleNumber(raw) {
  const value = normalizeVehicleNumber(raw);
  if (!value) return false;

  const standard = VEHICLE_NUMBER_REGEX.exec(value);
  if (standard) {
    const [, stateCode, rtoCode] = standard;
    if (!VALID_STATE_CODES.has(stateCode)) return false;
    if (Number(rtoCode) < 1) return false;
    return true;
  }

  if (BH_SERIES_REGEX.test(value)) return true;

  return false;
}