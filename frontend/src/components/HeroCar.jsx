/**
 * Landing hero visual: an original Lamborghini-inspired supercar (low wedge
 * body, Y-signature LEDs, big side intake, layered panels, dimensional wheels)
 * that drives in along the lane, reverse-parallel-parks into an empty bay,
 * waits, then pulls out and drives away before the loop restarts.
 *
 * Pure inline SVG + CSS transforms/opacity (see ".hero-car" in
 * styles/style.css) — no JS animation loop, no canvas, no listeners, no filters.
 * The "3D" look is built from separate lit panels (top planes vs. side planes),
 * panel-gap lines, studio reflections, ambient-occlusion gradients, glass with
 * a visible interior, and wheels made of separate tyre / disc / caliper / rim
 * layers with a static gloss pass over the spinning rim.
 *
 * The car is split into nested groups so each motion can have its own easing:
 *   .hc-drive  forward / reverse travel along the lane (translateX)
 *   .hc-depth  lane -> bay distance, with a touch of perspective scale + shadow
 *   .hc-yaw    steering (rotation) and brake dive
 *   .hc-wheel  wheel spin, keyframed to match .hc-drive distance exactly
 *   .hc-glint  paint reflection sliding over the body as the car moves
 *   .hc-brake / .hc-rev / .hc-head  tail, reverse and head lamp states
 *
 * NOTE: .hc-yaw / .hc-depth pivot on their fill-box, so everything inside them
 * (including the travelling glint) is kept inside the car's x 62–593 extent,
 * and both wheel groups are circles centred on the wheel hub.
 */
const SPOKES = [0, 72, 144, 216, 288];
const TICKS = [0, 72, 144, 216, 288];
const HOLES = [0, 36, 72, 108, 144, 180, 216, 252, 288, 324];

// Wheel-arch cut-out: centre (cx,192), r=46, meeting the sill line at y=208.
const ARCH_DX = 43.13;
const archPath = (cx) => `M${cx - ARCH_DX} 208 A46 46 0 1 1 ${cx + ARCH_DX} 208 Z`;
const archLip = (cx) => `M${cx - ARCH_DX} 208 A46 46 0 1 1 ${cx + ARCH_DX} 208`;

const BODY =
  'M74 207 L64 172 C62 156 63 146 68 138 L84 129 L178 117 C214 110 250 100 292 94 ' +
  'C318 90 350 89 384 91 C398 92 406 95 416 99 L498 134 L566 148 C584 152 593 160 593 170 ' +
  'L592 186 L588 198 L592 204 L584 208 L515.13 208 ' +
  'A46 46 0 1 0 428.87 208 L213.13 208 A46 46 0 1 0 126.87 208 L84 208 Z';

const Wheel = ({ cx, cy }) => (
  <g transform={`translate(${cx} ${cy})`}>
    {/* tyre + brake disc (spins) */}
    <g className="hc-wheel">
      <circle r="39" fill="#06090f" />
      <circle r="38" fill="none" stroke="#223249" strokeWidth="1.2" />
      <circle r="35" fill="none" stroke="#0e1623" strokeWidth="3.4" />
      {TICKS.map((a) => (
        <path key={a} d="M0 -36.5 L0 -32" stroke="#4a5d78" strokeWidth="2.2" strokeLinecap="round" transform={`rotate(${a + 18})`} />
      ))}
      <circle r="29.8" fill="#000" />
      <circle r="28.4" fill="url(#hc-barrel)" />
      <circle r="24.5" fill="url(#hc-disc)" />
      {HOLES.map((a) => (
        <circle key={a} cx="0" cy="-19.5" r="1.1" fill="#161e2b" transform={`rotate(${a})`} />
      ))}
    </g>

    {/* brake caliper does not spin */}
    <g transform="rotate(-34)">
      <path d="M-7.5 -26.2 Q0 -28 7.5 -26.2 L9.6 -14.6 Q0 -12.8 -9.6 -14.6 Z" fill="#ffb11e" stroke="rgba(0,0,0,.55)" strokeWidth=".9" />
      <path d="M-5.5 -24.2 Q0 -25.4 5.5 -24.2" fill="none" stroke="rgba(255,255,255,.65)" strokeWidth="1" strokeLinecap="round" />
      <path d="M-6 -19.2 L6 -19.2" stroke="rgba(0,0,0,.45)" strokeWidth="1.1" />
    </g>

    {/* alloy rim: Y-spokes over the disc (spins) */}
    <g className="hc-wheel">
      <circle r="27.5" fill="none" stroke="url(#hc-metal)" strokeWidth="3.4" />
      {SPOKES.map((a) => (
        <g key={a} transform={`rotate(${a})`}>
          <path
            d="M-3.4 -8 L-3 -16 L-7.2 -25.8 L-3.4 -26.6 L0 -19.6 L3.4 -26.6 L7.2 -25.8 L3 -16 L3.4 -8 Z"
            fill="url(#hc-metal)"
            stroke="rgba(0,0,0,.6)"
            strokeWidth=".8"
            strokeLinejoin="round"
          />
          <path d="M0 -9.5 L0 -18" stroke="rgba(255,255,255,.55)" strokeWidth=".9" strokeLinecap="round" />
        </g>
      ))}
      <circle r="7.8" fill="url(#hc-metal)" stroke="rgba(0,240,255,.7)" strokeWidth="1" />
      <circle r="2.8" fill="#0a1220" />
    </g>

    {/* static lighting over the spinning parts: this is what keeps the wheel looking solid */}
    <circle r="27.5" fill="url(#hc-rimgloss)" />
    <path d="M-29 -24 A37.6 37.6 0 0 1 16 -34" fill="none" stroke="rgba(255,255,255,.28)" strokeWidth="2" strokeLinecap="round" />
    <path d="M30 22 A37.6 37.6 0 0 1 8 36" fill="none" stroke="rgba(120,200,255,.18)" strokeWidth="1.6" strokeLinecap="round" />
  </g>
);

export default function HeroCar() {
  return (
    <div className="hero-car" role="img" aria-label="Illustration of a modern supercar reverse-parking into an empty bay">
      <svg viewBox="0 0 800 250" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">
        <defs>
          {/* paint: lit top planes, darker side planes */}
          <linearGradient id="hc-paint" gradientUnits="userSpaceOnUse" x1="0" y1="128" x2="0" y2="208">
            <stop offset="0" stopColor="#3ab8f0" />
            <stop offset=".28" stopColor="#1b8ad8" />
            <stop offset=".62" stopColor="#0c4f94" />
            <stop offset="1" stopColor="#051d40" />
          </linearGradient>
          <linearGradient id="hc-paint-up" gradientUnits="userSpaceOnUse" x1="0" y1="89" x2="0" y2="148">
            <stop offset="0" stopColor="#dcf9ff" />
            <stop offset=".35" stopColor="#86deff" />
            <stop offset=".75" stopColor="#38b0ea" />
            <stop offset="1" stopColor="#1f86d0" />
          </linearGradient>
          <linearGradient id="hc-carbon" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#222f42" />
            <stop offset="1" stopColor="#05080f" />
          </linearGradient>
          <linearGradient id="hc-intake" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#010409" />
            <stop offset="1" stopColor="#0d1a2c" />
          </linearGradient>
          <linearGradient id="hc-glass" x1="0" y1="0" x2=".6" y2="1">
            <stop offset="0" stopColor="#9fe0f8" stopOpacity=".9" />
            <stop offset=".35" stopColor="#1e5584" />
            <stop offset=".7" stopColor="#0a2038" />
            <stop offset="1" stopColor="#030811" />
          </linearGradient>
          <linearGradient id="hc-glass-sky" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#d2f4ff" />
            <stop offset=".5" stopColor="#62b6e0" />
            <stop offset="1" stopColor="#1d4f80" />
          </linearGradient>
          <linearGradient id="hc-headglass" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#0c2a45" />
            <stop offset="1" stopColor="#020710" />
          </linearGradient>
          <linearGradient id="hc-metal" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f4fbff" />
            <stop offset=".35" stopColor="#a2b8ce" />
            <stop offset=".7" stopColor="#52677f" />
            <stop offset="1" stopColor="#1e2c3f" />
          </linearGradient>
          <radialGradient id="hc-barrel" cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#0d1623" />
            <stop offset="1" stopColor="#000" />
          </radialGradient>
          <radialGradient id="hc-disc" cx=".4" cy=".35" r=".8">
            <stop offset="0" stopColor="#8794a6" />
            <stop offset="1" stopColor="#2c3644" />
          </radialGradient>
          <linearGradient id="hc-rimgloss" x1="0" y1="0" x2=".7" y2=".7">
            <stop offset="0" stopColor="#fff" stopOpacity=".38" />
            <stop offset=".5" stopColor="#fff" stopOpacity="0" />
            <stop offset="1" stopColor="#00f0ff" stopOpacity=".12" />
          </linearGradient>
          <radialGradient id="hc-well" cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#0a1322" />
            <stop offset="1" stopColor="#000" />
          </radialGradient>
          <linearGradient id="hc-ao" gradientUnits="userSpaceOnUse" x1="0" y1="168" x2="0" y2="208">
            <stop offset="0" stopColor="#000a1e" stopOpacity="0" />
            <stop offset="1" stopColor="#000a1e" stopOpacity=".62" />
          </linearGradient>
          <linearGradient id="hc-streak" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset=".5" stopColor="#fff" stopOpacity=".34" />
            <stop offset="1" stopColor="#bff6ff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="hc-glint" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset=".5" stopColor="#dff8ff" stopOpacity=".17" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="hc-edge" gradientUnits="userSpaceOnUse" x1="64" y1="0" x2="593" y2="0">
            <stop offset="0" stopColor="#9fefff" stopOpacity=".25" />
            <stop offset=".5" stopColor="#fff" stopOpacity=".95" />
            <stop offset="1" stopColor="#bff6ff" stopOpacity=".5" />
          </linearGradient>
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
          <radialGradient id="hc-underglow" cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#00f0ff" stopOpacity=".28" />
            <stop offset="1" stopColor="#00f0ff" stopOpacity="0" />
          </radialGradient>
          <clipPath id="hc-clip">
            <path d={BODY} />
          </clipPath>
        </defs>

        {/* road: curb, lane marking and the parking bay (free = green, occupied = pink) */}
        <g className="hc-road">
          <line x1="0" y1="134" x2="800" y2="134" stroke="rgba(0,240,255,.16)" strokeWidth="1.2" />
          <line x1="0" y1="239" x2="800" y2="239" stroke="rgba(106,144,184,.28)" strokeWidth="1.5" strokeDasharray="26 22" />
          <rect className="hc-bay-free" x="35" y="140" width="590" height="52" rx="2" fill="rgba(0,255,179,.05)" stroke="#00ffb3" strokeWidth="1.6" />
          <rect className="hc-bay-busy" x="35" y="140" width="590" height="52" rx="2" fill="rgba(255,60,120,.05)" stroke="#ff3c78" strokeWidth="1.6" />
        </g>

        {/* car art; this outer transform only places its parked pose in the bay */}
        <g transform="translate(2 -45)">
        <g className="hc-drive">
        <g className="hc-depth">
          {/* ground: soft underglow, contact shadow and a darker patch under each tyre (stay on the ground, not rotated) */}
          <ellipse cx="328" cy="233" rx="250" ry="7" fill="url(#hc-underglow)" />
          <ellipse cx="328" cy="233" rx="258" ry="8" fill="url(#hc-ground)" />
          <ellipse cx="170" cy="231.5" rx="38" ry="3.4" fill="#000" opacity=".6" />
          <ellipse cx="472" cy="231.5" rx="38" ry="3.4" fill="#000" opacity=".6" />
        <g className="hc-yaw">

          {/* ── body shell ── */}
          <path d={BODY} fill="url(#hc-paint)" />
          <g clipPath="url(#hc-clip)">
            {/* top planes (roof, engine cover, hood) catch the sky, so they're lighter than the flanks */}
            <path
              d="M64 129 L84 129 L178 117 C214 110 250 100 292 94 C318 90 350 89 384 91 C398 92 406 95 416 99 L498 134 L566 148 C584 152 593 160 593 170 L586 170 L536 150 L500 142 L452 137 L300 133 L240 129 L170 126 L100 134 L64 144 Z"
              fill="url(#hc-paint-up)"
            />
            {/* sharp shoulder crease: bright edge on top, shadow just below */}
            <path d="M586 170 L536 150 L500 142 L452 137 L300 133 L240 129 L170 126 L100 134 L64 144" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="1.2" strokeLinejoin="round" />
            <path d="M536 152 L500 144 L452 139 L300 135 L240 131 L170 128 L100 136 L64 146" fill="none" stroke="rgba(0,12,34,.45)" strokeWidth="2.4" strokeLinejoin="round" />

            {/* studio softbox reflection along the flank */}
            <path d="M70 150 L300 144 L500 154 L566 164 L500 159 L300 150 L70 157 Z" fill="url(#hc-streak)" />
            {/* sculpted lower-flank scallop */}
            <path d="M444 176 C400 170 330 172 250 180" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="1.2" />

            {/* engine-cover vent */}
            <path d="M208 118 L254 108 L254 112 L210 122 Z" fill="#020812" />
            <path d="M210 123 L254 113" stroke="rgba(160,225,255,.35)" strokeWidth=".8" />

            {/* ambient occlusion toward the sill */}
            <rect x="60" y="168" width="540" height="42" fill="url(#hc-ao)" />

            {/* carbon rocker + accent */}
            <path d="M213 208 L215 199 L428 199 L429 208 Z" fill="url(#hc-carbon)" />
            <path d="M217 199.6 L426 199.6" stroke="rgba(160,225,255,.4)" strokeWidth=".9" />
            <path d="M216 206.6 L428 206.6" stroke="#00f0ff" strokeWidth="1" opacity=".55" />

            {/* door cut-lines (dark gap + light edge) */}
            <g fill="none" strokeLinecap="round">
              <path d="M452 128 C450 150 446 176 441 199" stroke="rgba(0,8,22,.75)" strokeWidth="1.4" />
              <path d="M453.4 130 C451.4 150 447.4 176 442.4 199" stroke="rgba(255,255,255,.2)" strokeWidth=".8" />
              <path d="M318 128 C324 150 332 176 338 199" stroke="rgba(0,8,22,.75)" strokeWidth="1.4" />
              <path d="M319.4 130 C325.4 150 333.4 176 339.4 199" stroke="rgba(255,255,255,.2)" strokeWidth=".8" />
            </g>
            <rect x="350" y="141" width="24" height="3.6" rx="1.8" fill="rgba(0,8,22,.55)" />
            <rect x="350" y="139.6" width="24" height="3.2" rx="1.6" fill="rgba(215,243,255,.7)" />

            {/* large side air intake */}
            <path d="M318 138 L266 143 C246 150 234 164 232 184 L240 196 L338 199 C330 176 324 156 318 138 Z" fill="url(#hc-intake)" />
            <g stroke="rgba(120,200,255,.2)" strokeWidth="1.3" fill="none">
              <path d="M322 152 L262 157" />
              <path d="M326 164 L246 169" />
              <path d="M330 176 L240 181" />
              <path d="M334 188 L242 193" />
            </g>
            <path d="M318 138 L266 143 C246 150 234 164 232 184" fill="none" stroke="rgba(190,240,255,.6)" strokeWidth="1.3" />

            {/* front fender gills + fascia */}
            <path d="M498 150 L530 156 L529 160 L496 154 Z" fill="#020812" />
            <path d="M500 161 L531 167 L530 170 L498 165 Z" fill="#020812" />
            <path d="M546 174 L592 171 L589 196 L551 197 Z" fill="url(#hc-intake)" />
            <g stroke="rgba(120,200,255,.3)" strokeWidth="1.2" fill="none">
              <path d="M550 180 L591 177" />
              <path d="M550 187 L590 184" />
              <path d="M551 193 L589 191" />
            </g>
            <path d="M516 200 L588 198 L593 204 L584 208 L516 208 Z" fill="url(#hc-carbon)" />
            <path d="M520 200.4 L588 198.8" stroke="#00f0ff" strokeWidth="1" opacity=".7" />

            {/* rear diffuser */}
            <path d="M66 182 L74 207 L126 208 L130 196 L98 190 Z" fill="url(#hc-carbon)" />
            <g stroke="rgba(130,165,200,.4)" strokeWidth="1">
              <path d="M88 192 L92 207" />
              <path d="M102 194 L106 208" />
              <path d="M116 196 L119 208" />
            </g>

            {/* paint reflection that slides over the panels as the car moves */}
            <g className="hc-glint">
              <path d="M286 89 L338 89 L308 208 L256 208 Z" fill="url(#hc-glint)" />
              <path d="M368 89 L384 89 L354 208 L338 208 Z" fill="url(#hc-glint)" opacity=".7" />
            </g>
          </g>

          {/* ── glasshouse ── */}
          <path d="M394 94 L416 99 L498 134 L452 128 L412 107 L402 100 Z" fill="url(#hc-glass-sky)" stroke="rgba(0,8,22,.8)" strokeWidth=".9" strokeLinejoin="round" />
          <path d="M404 98 L494 133" stroke="rgba(255,255,255,.55)" strokeWidth="1" />
          <path d="M262 128 L288 106 C306 98 330 96.5 360 96.5 L392 97.5 C401 99 408 103 412 107 L452 128 Z" fill="url(#hc-glass)" />
          {/* cabin interior seen through the glass */}
          <path d="M316 128 C314 114 320 104 334 103 C344 103 349 112 349 128 Z" fill="#1c2f4a" />
          <path d="M322 114 C326 108 336 106 342 110" fill="none" stroke="rgba(160,215,255,.35)" strokeWidth="1" />
          <ellipse cx="386" cy="116" rx="3" ry="9" fill="#0d1a2c" transform="rotate(24 386 116)" />
          <path d="M394 128 L418 119 L434 128 Z" fill="#071120" />
          {/* glass reflections */}
          <path d="M300 128 L346 97 L362 97 L320 128 Z" fill="#fff" opacity=".2" />
          <path d="M372 128 L396 98 L402 100 L388 128 Z" fill="#fff" opacity=".12" />
          <path d="M262 128 L288 106 C306 98 330 96.5 360 96.5 L392 97.5 C401 99 408 103 412 107 L452 128 Z" fill="none" stroke="#02060d" strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M288 106 C306 98 330 96.5 360 96.5 L392 97.5 C401 99 408 103 412 107" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth=".8" />
          {/* wing mirror */}
          <path d="M446 124 L470 122 C475 124 475 129 470 131 L450 132 Z" fill="#1286d2" stroke="rgba(0,8,22,.8)" strokeWidth=".9" strokeLinejoin="round" />
          <path d="M449 125 L468 123.4" stroke="rgba(255,255,255,.6)" strokeWidth="1" strokeLinecap="round" />

          {/* rim light along the upper silhouette */}
          <path d="M68 138 L84 129 L178 117 C214 110 250 100 292 94 C318 90 350 89 384 91 C398 92 406 95 416 99 L498 134 L566 148 C584 152 593 160 593 170" fill="none" stroke="url(#hc-edge)" strokeWidth="1.5" strokeLinejoin="round" />

          {/* ── lamps ── */}
          <g>
            <circle className="hc-head" cx="572" cy="157" r="16" fill="url(#hc-lampglow)" />
            <path d="M530 146 L568 150 C584 154 592 162 593 169 L552 160 Z" fill="url(#hc-headglass)" stroke="rgba(255,255,255,.4)" strokeWidth=".8" strokeLinejoin="round" />
            <path d="M534 148 L568 152 C580 155 588 160 591 166" fill="none" stroke="#00f0ff" strokeWidth="6" strokeLinecap="round" opacity=".2" />
            <path d="M534 148 L568 152 C580 155 588 160 591 166" fill="none" stroke="#eaffff" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M552 157 L576 163" fill="none" stroke="#eaffff" strokeWidth="1.6" strokeLinecap="round" />
          </g>
          <g className="hc-brake">
            <circle cx="76" cy="150" r="17" fill="url(#hc-tailglow)" />
            <path d="M66 146 L94 139 L98 143 L68 156 Z" fill="#ff2b6a" />
            <path d="M68 160 L92 154 L94 157 L69 165 Z" fill="#ff2b6a" />
            <path d="M68 147.4 L93 141.4" stroke="#ffd0de" strokeWidth="1" strokeLinecap="round" />
          </g>
          <path className="hc-rev" d="M67 168 L81 165 L82 169 L68 173 Z" fill="#f4fdff" />

          {/* ── wheels: arch wells, fender lips, then the wheels ── */}
          <path d={archPath(170)} fill="url(#hc-well)" />
          <path d={archPath(472)} fill="url(#hc-well)" />
          <path d={archLip(170)} fill="none" stroke="rgba(0,10,28,.55)" strokeWidth="3" />
          <path d={archLip(472)} fill="none" stroke="rgba(0,10,28,.55)" strokeWidth="3" />
          <path d={archLip(170)} fill="none" stroke="rgba(170,232,255,.5)" strokeWidth="1" />
          <path d={archLip(472)} fill="none" stroke="rgba(170,232,255,.5)" strokeWidth="1" />
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