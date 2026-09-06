// ─── Indian vehicle registration number validation ────────────────────────
//
// Standard format:  SS RR CCC NNNN
//   SS   - 2-letter state/UT code (e.g. WB, DL, MH)
//   RR   - 1 or 2 digit RTO code (01-99)
//   CCC  - 1 to 3 letter series (some RTOs skip the series on very old
//          registrations, but modern series always has at least 1 letter)
//   NNNN - 4 digit unique number
//
// Accepted with or without spaces: "WB 01 AB 1234" and "WB01AB1234" are
// both valid and are normalized to the same compact, space-free form
// before being stored (matching how existing records are already saved).

// All current Indian state and Union Territory RTO codes. Includes a couple
// of legacy codes (OR, UA) that are still found on older, already-issued
// plates so existing valid data never gets rejected.
const VALID_STATE_CODES = new Set([
  'AN', 'AP', 'AR', 'AS', 'BR', 'CG', 'CH', 'DD', 'DL', 'DN', 'DH',
  'GA', 'GJ', 'HR', 'HP', 'JH', 'JK', 'KA', 'KL', 'LA', 'LD',
  'MH', 'ML', 'MN', 'MP', 'MZ', 'NL', 'OD', 'OR', 'PB', 'PY',
  'RJ', 'SK', 'TN', 'TR', 'TS', 'UA', 'UK', 'UP', 'WB',
]);

// SS RR CCC NNNN, where the RTO code can be 1-2 digits and the series can
// be 1-3 letters.
const VEHICLE_NUMBER_REGEX = /^([A-Z]{2})(\d{1,2})([A-Z]{1,3})(\d{4})$/;

// The special "Bharat Series" format introduced in 2021: YY BH #### XX
// (2-digit year, literal "BH", 4 digits, 2 letters).
const BH_SERIES_REGEX = /^(\d{2})BH(\d{4})([A-Z]{2})$/;

/**
 * Strip spaces/hyphens and uppercase a raw vehicle number so it can be
 * validated and stored consistently, regardless of how the user typed it.
 */
function normalizeVehicleNumber(raw) {
  if (raw === null || raw === undefined) return '';
  return String(raw).toUpperCase().replace(/[\s-]+/g, '').trim();
}

/**
 * Validate that a vehicle registration number follows a real Indian
 * registration format (standard state-series-number format, or the Bharat
 * series format), including checking the state/UT code against the list of
 * codes actually in use. Accepts input with or without spaces.
 */
function isValidVehicleNumber(raw) {
  const value = normalizeVehicleNumber(raw);
  if (!value) return false;

  const standard = VEHICLE_NUMBER_REGEX.exec(value);
  if (standard) {
    const [, stateCode, rtoCode] = standard;
    if (!VALID_STATE_CODES.has(stateCode)) return false;
    if (Number(rtoCode) < 1) return false;
    return true;
  }

  // Bharat series plates aren't tied to a single state code, so they skip
  // the state-code check.
  if (BH_SERIES_REGEX.test(value)) return true;

  return false;
}

module.exports = {
  VALID_STATE_CODES,
  normalizeVehicleNumber,
  isValidVehicleNumber,
};