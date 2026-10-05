/**
 * Landing hero visual - two vehicles take turns in one parking bay (one 33s loop):
 *   1) a Kawasaki Ninja H2R 2-wheeler (0-14s)   <- real-time 3D, from kawasaki-h2r.glb
 *   2) a Lamborghini Centenario       (14-33s)  <- pre-rendered images (see below)
 * Each one drives in, parks, waits, then leaves before the next one arrives.
 *
 * Bike: <HeroVehicles3D/> draws the .glb model with three.js on a transparent
 * canvas laid over the SVG (lazy-loaded, so it never blocks first paint). Its wheels are
 * separate nodes in the model and spin as the vehicle rolls. While the model loads nothing
 * is drawn for it (the 3D canvas then fades in); the hand-drawn SVG version below is
 * only used as a fallback if WebGL / the file fails or the user prefers reduced motion.
 *
 * The Lamborghini is NOT a live 3D scene (its .glb is ~20 MB / 325k triangles, far too
 * heavy for a landing page). Instead the model was rendered once from the side into two
 * tiny transparent images (body ~60 KB, wheel ~15 KB) that slot into the CSS animation system:
 *   .hc-drive  forward / reverse travel      .hc-depth  lane -> bay distance
 *   .hc-yaw    steering + brake dive         .hc-wheel  wheel spin (keyframed to the travel)
 *   .hc-brake / .hc-rev / .hc-head  lamp glows
 * The bay indicator, the Lamborghini and the 3D bike all share the same 33s clock.
 */
import { Component, lazy, Suspense, useState, useCallback } from 'react';
import lamboBody from '../assets/lambo-body.webp';
import lamboWheel from '../assets/lambo-wheel.webp';

const HeroVehicles3D = lazy(() => import('./HeroVehicles3D.jsx'));

// If the 3D chunk itself fails to load (offline, blocked...) fall back to the SVG vehicles instead of crashing the page.
class Hero3DBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { if (this.props.onFail) this.props.onFail(); }
  render() { return this.state.failed ? null : this.props.children; }
}

/* ───────────────────────── 2-wheeler (sport-tourer, black + green) ───────────────────────── */
const BIKE_SPOKES = [0, 72, 144, 216, 288];
const BikeWheel = ({ cx }) => (
  <g transform={`translate(${cx} 190)`}>
    <g className="bk-wheel">
      <circle r="41" fill="#07090d" />
      <circle r="40" fill="none" stroke="#1f2a37" strokeWidth="1" />
      <circle r="31" fill="#0b1017" />
      <circle r="22" fill="none" stroke="#9aa7b8" strokeWidth="3.4" opacity=".75" />
      {BIKE_SPOKES.map((a) => (
        <path key={a} d="M-3.2 -9 L-6 -30 L6 -30 L3.2 -9 Z" fill="#10161e" stroke="rgba(150,205,245,.4)" strokeWidth=".6" strokeLinejoin="round" transform={`rotate(${a})`} />
      ))}
      <circle r="31" fill="none" stroke="#2f3e52" strokeWidth="1.4" />
      <circle r="8.5" fill="#1a2430" stroke="#3d4f66" strokeWidth=".8" />
    </g>
    <path d="M-30 -22 A37 37 0 0 1 12 -35" fill="none" stroke="rgba(255,255,255,.26)" strokeWidth="2" strokeLinecap="round" />
  </g>
);

const Bike = ({ art = true }) => (
  <g className="hv-veh" transform="translate(2 -45)">
    <g className="bk-drive">
      <g className="bk-depth">
        <ellipse cx="330" cy="233" rx="190" ry="6" fill="url(#hc-underglow)" />
        <ellipse cx="330" cy="233" rx="196" ry="7" fill="url(#hc-ground)" />
        {art && (<>
        <ellipse cx="205" cy="231.5" rx="30" ry="3" fill="#000" opacity=".6" />
        <ellipse cx="455" cy="231.5" rx="30" ry="3" fill="#000" opacity=".6" />
        <g className="bk-yaw">
          <g transform="translate(330 231) scale(1.14) translate(-330 -231)">
          <BikeWheel cx={205} />
          {/* swingarm + frame + engine */}
          <path d="M205 184 L308 176 L311 190 L205 198 Z" fill="#0a0e14" stroke="rgba(150,205,245,.35)" strokeWidth=".8" strokeLinejoin="round" />
          <path d="M296 150 L404 146 L420 206 L306 214 Z" fill="url(#bk-engine)" stroke="rgba(150,205,245,.25)" strokeWidth=".8" />
          <g stroke="#22d36b" strokeWidth="2.2" strokeLinecap="round" fill="none" opacity=".85">
            <path d="M308 160 L396 156" />
            <path d="M310 176 L408 170" />
          </g>
          <path d="M314 190 L404 186 L410 204 L318 208 Z" fill="#05080d" stroke="rgba(150,205,245,.3)" strokeWidth=".8" />
          {/* silver silencer (in front of the rear wheel, as in the photo) */}
          <path d="M170 204 L262 184 L272 200 L180 222 Z" fill="url(#bk-metal)" stroke="rgba(0,8,22,.7)" strokeWidth="1" strokeLinejoin="round" />
          <path d="M176 206 L262 187" stroke="rgba(255,255,255,.75)" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M262 184 L272 200" stroke="#0a0e14" strokeWidth="5" strokeLinecap="round" />
          {/* tail + seat + tank */}
          <path d="M150 126 L172 110 L262 132 L258 152 L168 148 Z" fill="url(#bk-black)" stroke="rgba(150,205,245,.4)" strokeWidth=".8" strokeLinejoin="round" />
          <path d="M150 126 L153 140 L159 140 L160 122 Z" fill="#ff2b6a" />
          <path d="M152 162 L170 158 L174 184 L158 186 Z" fill="#0a0e14" />
          <path d="M206 140 C232 126 292 122 338 128 L350 144 L216 152 Z" fill="#06080c" stroke="rgba(150,205,245,.3)" strokeWidth=".8" strokeLinejoin="round" />
          <path d="M214 140 C240 130 292 126 336 131" fill="none" stroke="rgba(255,255,255,.28)" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M338 118 C364 98 404 96 430 112 L436 140 L348 148 Z" fill="url(#bk-black)" stroke="rgba(150,205,245,.3)" strokeWidth=".8" />
          <path d="M352 112 C374 102 400 102 420 114" fill="none" stroke="rgba(255,255,255,.6)" strokeWidth="1.6" strokeLinecap="round" />
          {/* front wheel + gold fork */}
          <BikeWheel cx={455} />
          <path d="M470 124 L459 188" stroke="#d4af2c" strokeWidth="6" strokeLinecap="round" />
          <path d="M477 126 L465 186" stroke="#7a6212" strokeWidth="2" strokeLinecap="round" />
          <path d="M424 160 C428 142 482 140 488 160 L480 162 C472 150 434 150 432 164 Z" fill="url(#bk-black)" stroke="rgba(150,205,245,.35)" strokeWidth=".8" />
          {/* fairing (ends above the wheel so the tyre stays visible) + green flashes */}
          <path d="M396 116 L440 100 L478 110 L506 128 L516 152 L500 176 L452 172 L420 164 L400 142 Z" fill="url(#bk-black)" stroke="rgba(190,240,255,.45)" strokeWidth="1" strokeLinejoin="round" />
          <path d="M406 118 L440 106 L474 114" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M424 146 L470 150 L466 158 L420 154 Z" fill="#22d36b" />
          <path d="M432 163 L488 168 L484 175 L428 170 Z" fill="#22d36b" />
          <path d="M438 128 L462 132 L460 137 L436 133 Z" fill="rgba(255,255,255,.4)" />
          {/* headlamp */}
          <circle className="hv-bike-head" cx="508" cy="130" r="18" fill="url(#hc-lampglow)" />
          <path d="M488 118 L516 128 L512 142 L488 132 Z" fill="#dfeaf6" stroke="rgba(0,8,22,.7)" strokeWidth=".8" strokeLinejoin="round" />
          <path d="M492 123 L510 130" stroke="#00f0ff" strokeWidth="1.6" strokeLinecap="round" />
          {/* screen + mirror */}
          <path d="M456 106 L438 72 C446 66 462 68 476 76 L484 108 Z" fill="rgba(190,228,255,.34)" stroke="rgba(255,255,255,.65)" strokeWidth="1" strokeLinejoin="round" />
          <path d="M446 76 C454 72 464 74 472 80" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="1" strokeLinecap="round" />
          <path d="M450 100 L470 94 L478 104 L458 110 Z" fill="#0a0e14" stroke="rgba(150,205,245,.45)" strokeWidth=".8" strokeLinejoin="round" />
          </g>
        </g>
        </>)}
      </g>
    </g>
  </g>
);

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function HeroCar() {
  // 'loading' = GLB vehicles still downloading (bike not drawn yet) | '3d' = GLB vehicles running |
  // 'svg' = fallback to the hand-drawn SVG vehicles (reduced motion, no WebGL, or the files failed)
  const [reduced] = useState(prefersReducedMotion);
  const [mode, setMode] = useState(() => (prefersReducedMotion() ? 'svg' : 'loading'));
  const handleReady = useCallback(() => setMode('3d'), []);
  const handleFail = useCallback(() => setMode('svg'), []);
  return (
    <div className="hero-car" role="img" aria-label="A motorbike and a supercar taking turns to park in an empty bay">
      <svg viewBox="0 0 800 250" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">
        <defs>
          <radialGradient id="hc-underglow" cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#00f0ff" stopOpacity=".28" />
            <stop offset="1" stopColor="#00f0ff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="hc-ground" cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#000" stopOpacity=".78" />
            <stop offset=".6" stopColor="#000" stopOpacity=".3" />
            <stop offset="1" stopColor="#000" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="hc-lampglow" cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#eaffff" stopOpacity=".9" />
            <stop offset=".4" stopColor="#00f0ff" stopOpacity=".32" />
            <stop offset="1" stopColor="#00f0ff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="hc-tailglow" cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#ff4f86" stopOpacity=".85" />
            <stop offset=".5" stopColor="#ff3c78" stopOpacity=".28" />
            <stop offset="1" stopColor="#ff3c78" stopOpacity="0" />
          </radialGradient>
          {/* 2-wheeler paints */}
          <linearGradient id="bk-black" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3b4656" />
            <stop offset=".35" stopColor="#141b25" />
            <stop offset="1" stopColor="#04070b" />
          </linearGradient>
          <linearGradient id="bk-engine" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#1b2531" />
            <stop offset="1" stopColor="#05080d" />
          </linearGradient>
          <linearGradient id="bk-metal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f2f7fb" />
            <stop offset=".4" stopColor="#a7b5c4" />
            <stop offset="1" stopColor="#4b5a6c" />
          </linearGradient>
        </defs>

        {/* road: curb, lane marking and the parking bay (free = green, occupied = pink) */}
        <g className="hc-road">
          <line x1="0" y1="134" x2="800" y2="134" stroke="rgba(0,240,255,.16)" strokeWidth="1.2" />
          <line x1="0" y1="239" x2="800" y2="239" stroke="rgba(106,144,184,.28)" strokeWidth="1.5" strokeDasharray="26 22" />
          <rect className="hc-bay-free" x="35" y="140" width="590" height="52" rx="2" fill="rgba(0,255,179,.05)" stroke="#00ffb3" strokeWidth="1.6" />
          <rect className="hc-bay-busy" x="35" y="140" width="590" height="52" rx="2" fill="rgba(255,60,120,.05)" stroke="#ff3c78" strokeWidth="1.6" />
        </g>

        {/* two vehicles take turns in the same bay: 2-wheeler, then the supercar */}
        {mode !== 'loading' && <Bike art={mode === 'svg'} />}

        {/* car art; this outer transform only places its parked pose in the bay */}
        <g className="hv-veh" transform="translate(2 -45)">
        <g className="hc-drive">
        <g className="hc-depth">
          {/* ground: soft underglow, contact shadow and a darker patch under each tyre (stay on the ground, not rotated) */}
          <ellipse cx="328" cy="233" rx="250" ry="7" fill="url(#hc-underglow)" />
          <ellipse cx="328" cy="233" rx="258" ry="8" fill="url(#hc-ground)" />
          <ellipse cx="170" cy="231.5" rx="38" ry="3.4" fill="#000" opacity=".6" />
          <ellipse cx="472" cy="231.5" rx="38" ry="3.4" fill="#000" opacity=".6" />
        <g className="hc-yaw">
          {/* body shell rendered from the GLB (wheels removed so they can spin) */}
          <image href={lamboBody} x="54.68" y="100.66" width="561.55" height="117.57" preserveAspectRatio="none" />

          {/* spinning wheels: rear 42.6 r, front 40.8 r (front tyre is a touch smaller on the real car, but must cover the arch liner) */}
          <g transform="translate(170 188.37)">
            {/* static dark well + brake disc behind the spinning wheel (the sprite has see-through gaps between spokes) */}
            <circle r="40.5" fill="#080b11" />
            <circle r="27" fill="#37404d" />
            <circle r="9" fill="#141a23" />
            <g className="hc-wheel"><image href={lamboWheel} x="-43.38" y="-43.38" width="86.77" height="86.77" /></g>
          </g>
          <g transform="translate(472 190.06)">
            <circle r="38.8" fill="#080b11" />
            <circle r="25.5" fill="#37404d" />
            <circle r="8.5" fill="#141a23" />
            <g className="hc-wheel"><image href={lamboWheel} x="-40.8" y="-40.8" width="81.6" height="81.6" /></g>
          </g>

          {/* lamp glows (same state machine as before: head / brake / reverse) */}
          <circle className="hc-head" cx="558" cy="166" r="16" fill="url(#hc-lampglow)" />
          <g className="hc-brake"><circle cx="84" cy="152" r="15" fill="url(#hc-tailglow)" /></g>
          <circle className="hc-rev" cx="74" cy="164" r="2.6" fill="#f4fdff" />
        </g>
        </g>
        </g>
        </g>
      </svg>
      {!reduced && mode !== 'svg' && (
        <Hero3DBoundary onFail={handleFail}>
          <Suspense fallback={null}>
            <HeroVehicles3D active={mode === '3d'} onReady={handleReady} onFail={handleFail} />
          </Suspense>
        </Hero3DBoundary>
      )}
    </div>
  );
}