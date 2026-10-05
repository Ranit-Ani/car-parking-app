/**
 * Landing-hero timeline for the two GLB vehicles (2-wheeler + 3-wheeler).
 *
 * This is a 1:1 port of the CSS keyframes in styles/style.css (bkDrive/bkDepth/bkYaw and
 * rkDrive/rkDepth/rkYaw) so the 3D vehicles move exactly like the SVG ones did and stay in
 * step with the CSS-animated bay indicator and the Lamborghini (same 47 s loop).
 * Keyframes are [percentOfLoop, value, easingToNextKeyframe].
 */
export const LOOP_MS = 47000;

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
  active: [0, 29.8],
  drive: [[0, -560, 'out'], [8.34, -40, 'io'], [11.915, 0, 'lin'], [22.043, 0, 'exit'], [28.894, 760, 'lin'], [29.787, 760, 'lin'], [100, 760, 'lin']],
  ty: [[0, 36, 'io'], [8.34, 36, 'io'], [11.915, 0, 'io'], [20.851, 0, 'io'], [25.021, 36, 'io'], [29.787, 36, 'lin'], [100, 36, 'lin']],
  scale: [[0, 1, 'io'], [8.34, 1, 'io'], [11.915, 0.92, 'io'], [20.851, 0.92, 'io'], [25.021, 1, 'io'], [29.787, 1, 'lin'], [100, 1, 'lin']],
  yaw: [[0, 0, 'io'], [8.34, 0, 'io'], [10.128, -4, 'io'], [12.213, 0, 'io'], [20.851, 0, 'io'], [22.638, 3.5, 'io'], [25.617, 0, 'io'], [29.787, 0, 'lin'], [100, 0, 'lin']],
};

/* ── 3-wheeler: 14 – 28 s ── */
export const RICKSHAW = {
  active: [29.7, 59.6],
  drive: [[0, -560, 'lin'], [29.787, -560, 'out'], [38.128, -40, 'io'], [41.702, 0, 'lin'], [51.83, 0, 'exit'], [58.681, 760, 'lin'], [59.574, 760, 'lin'], [100, 760, 'lin']],
  ty: [[0, 36, 'lin'], [29.787, 36, 'io'], [38.128, 36, 'io'], [41.702, 0, 'io'], [50.638, 0, 'io'], [54.809, 36, 'io'], [59.574, 36, 'lin'], [100, 36, 'lin']],
  scale: [[0, 1, 'lin'], [29.787, 1, 'io'], [38.128, 1, 'io'], [41.702, 0.92, 'io'], [50.638, 0.92, 'io'], [54.809, 1, 'io'], [59.574, 1, 'lin'], [100, 1, 'lin']],
  yaw: [[0, 0, 'lin'], [29.787, 0, 'io'], [38.128, 0, 'io'], [39.915, -4, 'io'], [42, 0, 'io'], [50.638, 0, 'io'], [52.426, 3.5, 'io'], [55.404, 0, 'io'], [59.574, 0, 'lin'], [100, 0, 'lin']],
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

/** True while neither GLB vehicle is on screen (only the Lamborghini slot) - safe moment to swap SVG -> 3D. */
export function isQuietMoment(tMs) {
  const pct = ((tMs % LOOP_MS) + LOOP_MS) % LOOP_MS / LOOP_MS * 100;
  return pct > 60.5 && pct < 98;
}