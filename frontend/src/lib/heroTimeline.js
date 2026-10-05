/**
 * Landing-hero timeline for the GLB 2-wheeler.
 *
 * This is a 1:1 port of the CSS keyframes in styles/style.css (bkDrive/bkDepth/bkYaw) so the
 * 3D bike moves exactly like the SVG one did and stays in
 * step with the CSS-animated bay indicator and the Lamborghini (same 37 s loop).
 * Keyframes are [percentOfLoop, value, easingToNextKeyframe].
 */
export const LOOP_MS = 37000;

function cubicBezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (t) => ((ax * t + bx) * t + cx) * t;
  const Y = (t) => ((ay * t + by) * t + cy) * t;
  const dX = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {            // Newton
      const e = X(t) - x;
      if (Math.abs(e) < 1e-6) return Y(t);
      const d = dX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    let lo = 0, hi = 1; t = x;               // bisection fallback
    for (let i = 0; i < 40; i++) {
      const e = X(t);
      if (Math.abs(e - x) < 1e-6) break;
      if (x > e) lo = t; else hi = t;
      t = (hi + lo) / 2;
    }
    return Y(t);
  };
}

const EASE = {
  lin: (t) => t,
  io: cubicBezier(0.45, 0, 0.55, 1),   // ease in-out
  out: cubicBezier(0.22, 0.6, 0.3, 1), // eases out into the stop
  exit: cubicBezier(0.5, 0, 0.9, 0.55), // eases in to leave
};

function sampleTrack(track, pct) {
  const first = track[0], last = track[track.length - 1];
  if (pct <= first[0]) return first[1];
  if (pct >= last[0]) return last[1];
  for (let i = 0; i < track.length - 1; i++) {
    const [p0, v0, ease] = track[i];
    const [p1, v1] = track[i + 1];
    if (pct >= p0 && pct <= p1) {
      if (p1 === p0) return v1;
      return v0 + (v1 - v0) * EASE[ease]((pct - p0) / (p1 - p0));
    }
  }
  return last[1];
}

/* ── 2-wheeler: 0 – 14 s ── */
export const BIKE = {
  active: [0, 38],
  drive: [[0, -560, 'out'], [10.594, -40, 'io'], [15.135, 0, 'lin'], [28.001, 0, 'exit'], [36.703, 760, 'lin'], [37.838, 760, 'lin'], [100, 760, 'lin']],
  ty: [[0, 36, 'io'], [10.594, 36, 'io'], [15.135, 0, 'io'], [26.487, 0, 'io'], [31.783, 36, 'io'], [37.838, 36, 'lin'], [100, 36, 'lin']],
  scale: [[0, 1, 'io'], [10.594, 1, 'io'], [15.135, 0.92, 'io'], [26.487, 0.92, 'io'], [31.783, 1, 'io'], [37.838, 1, 'lin'], [100, 1, 'lin']],
  yaw: [[0, 0, 'io'], [10.594, 0, 'io'], [12.866, -4, 'io'], [15.514, 0, 'io'], [26.487, 0, 'io'], [28.756, 3.5, 'io'], [32.541, 0, 'io'], [37.838, 0, 'lin'], [100, 0, 'lin']],
};

/** State of one vehicle at `tMs` into the loop. x = lane travel in SVG px, ty = lane->bay depth shift in px,
 *  scale = perspective scale, yaw = degrees (CSS sign: + is clockwise). `visible` is false while it is off-screen. */
export function sampleVehicle(v, tMs) {
  const pct = ((tMs % LOOP_MS) + LOOP_MS) % LOOP_MS / LOOP_MS * 100;
  return {
    visible: pct >= v.active[0] && pct <= v.active[1],
    x: sampleTrack(v.drive, pct),
    ty: sampleTrack(v.ty, pct),
    scale: sampleTrack(v.scale, pct),
    yaw: sampleTrack(v.yaw, pct),
  };
}

/** True while the GLB bike is off screen (only the Lamborghini slot) - safe moment to swap SVG -> 3D. */
export function isQuietMoment(tMs) {
  const pct = ((tMs % LOOP_MS) + LOOP_MS) % LOOP_MS / LOOP_MS * 100;
  return pct > 39 && pct < 97;
}