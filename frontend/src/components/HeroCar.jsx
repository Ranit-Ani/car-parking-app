/**
 * Landing hero visual: a premium EV in side profile that drives in along the
 * lane, reverse-parallel-parks into an empty bay, waits, then pulls out and
 * drives away before the loop restarts. Pure inline SVG + CSS transforms and
 * opacity (see ".hero-car" in styles/style.css) — no JS animation loop, no
 * canvas, no listeners.
 *
 * The car is split into nested groups so each motion can have its own easing:
 *   .hc-drive  forward / reverse travel along the lane (translateX)
 *   .hc-depth  lane -> bay distance, with a touch of perspective scale + shadow
 *   .hc-yaw    steering (rotation) and brake dive
 *   .hc-wheel  wheel spin, keyframed to match .hc-drive distance exactly
 */
const SPOKES = [0, 72, 144, 216, 288];

const Wheel = ({ cx, cy }) => (
  <g transform={`translate(${cx} ${cy})`}>
    <g className="hc-wheel">
    <circle r="39" fill="#05080f" />
    <circle r="37" fill="none" stroke="#1a2a40" strokeWidth="1.5" />
    <circle r="27" fill="url(#hc-rim)" />
    <circle r="27" fill="none" stroke="rgba(0,240,255,.35)" strokeWidth="1" />
    {SPOKES.map((a) => (
      <path key={a} d="M-3.2 -7 L-5 -25 Q0 -27.5 5 -25 L3.2 -7 Z" fill="#0a1424" transform={`rotate(${a})`} />
    ))}
    <circle r="6.5" fill="#0d1a2c" stroke="rgba(0,240,255,.5)" strokeWidth="1" />
    </g>
  </g>
);

export default function HeroCar() {
  return (
    <div className="hero-car" role="img" aria-label="Illustration of a modern electric car reverse-parking into an empty bay">
      <svg viewBox="0 0 800 250" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">
        <defs>
          <linearGradient id="hc-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#35557a" />
            <stop offset=".35" stopColor="#1a3050" />
            <stop offset=".75" stopColor="#0c1a2e" />
            <stop offset="1" stopColor="#060d1a" />
          </linearGradient>
          <linearGradient id="hc-sheen" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset=".45" stopColor="#fff" stopOpacity=".16" />
            <stop offset="1" stopColor="#9fe9ff" stopOpacity=".05" />
          </linearGradient>
          <linearGradient id="hc-glass" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#6fb4d6" stopOpacity=".55" />
            <stop offset=".5" stopColor="#10243d" />
            <stop offset="1" stopColor="#050c18" />
          </linearGradient>
          <radialGradient id="hc-rim" cx=".4" cy=".35" r=".8">
            <stop offset="0" stopColor="#8aa3bd" />
            <stop offset=".6" stopColor="#2a3d55" />
            <stop offset="1" stopColor="#101c2d" />
          </radialGradient>
          <radialGradient id="hc-ground" cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#000" stopOpacity=".75" />
            <stop offset=".6" stopColor="#000" stopOpacity=".28" />
            <stop offset="1" stopColor="#000" stopOpacity="0" />
          </radialGradient>
          <clipPath id="hc-clip">
            <path d="M66 190 C62 172 62 150 74 138 C90 130 140 124 190 112 C225 82 262 64 322 63 C380 63 430 84 475 112 C520 122 566 130 584 150 C592 160 594 176 590 190 L560 197 L518 197 A46 46 0 0 0 426 197 L216 197 A46 46 0 0 0 124 197 L78 197 Z" />
          </clipPath>
        </defs>

        {/* road: curb, lane marking and the parking bay (free = green, occupied = pink) */}
        <g className="hc-road">
          <line x1="0" y1="134" x2="800" y2="134" stroke="rgba(0,240,255,.16)" strokeWidth="1.2" />
          <line x1="0" y1="239" x2="800" y2="239" stroke="rgba(106,144,184,.28)" strokeWidth="1.5" strokeDasharray="26 22" />
          <rect className="hc-bay-free" x="35" y="140" width="590" height="52" rx="2" fill="rgba(0,255,179,.05)" stroke="#00ffb3" strokeWidth="1.6" />
          <rect className="hc-bay-busy" x="35" y="140" width="590" height="52" rx="2" fill="rgba(255,60,120,.05)" stroke="#ff3c78" strokeWidth="1.6" />
        </g>

        {/* car art is unchanged; this outer transform only places its parked pose in the bay */}
        <g transform="translate(2 -45)">
        <g className="hc-drive">
        <g className="hc-depth">
          {/* contact shadow stays on the ground (not rotated with the body) */}
          <ellipse cx="328" cy="233" rx="258" ry="8" fill="url(#hc-ground)" />
        <g className="hc-yaw">

          {/* body */}
          <path
            d="M66 190 C62 172 62 150 74 138 C90 130 140 124 190 112 C225 82 262 64 322 63 C380 63 430 84 475 112 C520 122 566 130 584 150 C592 160 594 176 590 190 L560 197 L518 197 A46 46 0 0 0 426 197 L216 197 A46 46 0 0 0 124 197 L78 197 Z"
            fill="url(#hc-body)"
            stroke="rgba(0,240,255,.28)"
            strokeWidth="1.2"
          />
          <g clipPath="url(#hc-clip)">
            {/* lower sill */}
            <path d="M60 180 L600 180 L600 200 L60 200 Z" fill="#050b16" opacity=".65" />
            {/* shoulder sheen */}
            <path d="M70 140 C200 124 420 118 600 150 L600 160 C420 132 200 138 70 154 Z" fill="url(#hc-sheen)" />
          </g>

          {/* glasshouse */}
          <path d="M206 111 C238 85 268 73 318 72 L318 111 Z" fill="url(#hc-glass)" />
          <path d="M328 72 C376 73 410 88 442 111 L328 111 Z" fill="url(#hc-glass)" />
          <path d="M206 111 C238 83 268 71 322 70 C384 70 420 88 446 111" fill="none" stroke="rgba(255,255,255,.4)" strokeWidth="1.2" />

          {/* character line, door cut, handles */}
          <path d="M92 142 C210 130 410 128 566 148" fill="none" stroke="rgba(160,225,255,.28)" strokeWidth="1.2" />
          <path d="M323 112 L323 186" stroke="rgba(0,0,0,.45)" strokeWidth="1.2" />
          <rect x="290" y="123" width="22" height="3.4" rx="1.7" fill="rgba(200,235,255,.5)" />
          <rect x="342" y="123" width="22" height="3.4" rx="1.7" fill="rgba(200,235,255,.5)" />

          {/* lamps: slim cool-white front blade, restrained rear strip */}
          <path d="M556 146 L587 158" stroke="#dff8ff" strokeWidth="3.4" strokeLinecap="round" />
          <path d="M556 146 L587 158" stroke="#00f0ff" strokeWidth="7" strokeLinecap="round" opacity=".18" />
          <path d="M66 152 L74 143" stroke="#ff3c78" strokeWidth="3" strokeLinecap="round" opacity=".85" />

          {/* wheels */}
          <Wheel cx={170} cy={192} />
          <Wheel cx={472} cy={192} />
        </g>
        </g>
        </g>
        </g>
      </svg>
    </div>
  );
}