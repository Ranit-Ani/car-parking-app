/**
 * Landing hero visual: an original Lamborghini-inspired supercar (cab-forward
 * wedge, very low raked windshield, slim angular Y-signature LEDs, big black
 * front intake + splitter, huge angular side intake, scissor door, dark
 * multi-spoke wheels with a bronze lip) that drives in along the lane,
 * reverse-parallel-parks into an empty bay, waits (the scissor door lifts),
 * then pulls out and drives away before the loop restarts.
 *
 * Pure inline SVG + CSS transforms/opacity (see ".hero-car" in
 * styles/style.css) — no JS animation loop, no canvas, no listeners, no filters.
 * The "3D" look comes from separate lit panels (top planes vs. flanks),
 * panel-gap lines, studio reflections, ambient-occlusion gradients, glass with
 * a visible cabin behind it, and wheels built from separate tyre / disc /
 * caliper / spoke layers with a static gloss pass over the spinning rim.
 *
 * The car is split into nested groups so each motion can have its own easing:
 *   .hc-drive  forward / reverse travel along the lane (translateX)
 *   .hc-depth  lane -> bay distance, with a touch of perspective scale + shadow
 *   .hc-yaw    steering (rotation) and brake dive
 *   .hc-wheel  wheel spin, keyframed to match .hc-drive distance exactly
 *   .hc-door   scissor door lifting while parked (pivot at the A-pillar base)
 *   .hc-glint  paint reflection sliding over the body as the car moves
 *   .hc-brake / .hc-rev / .hc-head  tail, reverse and head lamp states
 *
 * NOTE: .hc-yaw / .hc-depth pivot on their fill-box (centre x, bottom y), so
 * everything inside them stays within the car's x 62–593 extent and the lowest
 * point stays the tyres; both wheel groups are circles centred on the hub.
 */
const SPOKES = Array.from({ length: 20 }, (_, i) => i * 18);
const TICKS = [0, 45, 90, 135, 180, 225, 270, 315];
const HOLES = Array.from({ length: 12 }, (_, i) => i * 30);

// Wheel-arch cut-out: centre (cx,192), r=46, meeting the sill line at y=208.
const ARCH_DX = 43.13;
const archPath = (cx) => `M${cx - ARCH_DX} 208 A46 46 0 1 1 ${cx + ARCH_DX} 208 Z`;
const archLip = (cx) => `M${cx - ARCH_DX} 208 A46 46 0 1 1 ${cx + ARCH_DX} 208`;

const BODY =
  'M74 207 L64 174 C62 158 63 148 68 140 L84 133 L170 124 C212 118 250 108 290 103 ' +
  'C320 100 352 98 386 97 L454 123 C484 127 524 135 560 145 C580 150 592 158 593 170 ' +
  'L592 186 L588 198 L592 204 L584 208 L515.13 208 ' +
  'A46 46 0 1 0 428.87 208 L213.13 208 A46 46 0 1 0 126.87 208 L84 208 Z';

const Wheel = ({ cx, cy }) => (
  <g transform={`translate(${cx} ${cy})`}>
    {/* tyre, barrel and brake disc (spin) */}
    <g className="hc-wheel">
      <circle r="39" fill="#06090f" />
      <circle r="38.2" fill="none" stroke="#243449" strokeWidth="1" />
      <circle r="35.6" fill="none" stroke="#0d1420" strokeWidth="3.6" />
      {TICKS.map((a) => (
        <path key={a} d="M0 -37 L0 -34.4" stroke="#3d4f68" strokeWidth="1.6" strokeLinecap="round" transform={`rotate(${a + 11})`} />
      ))}
      <circle r="32" fill="url(#hc-barrel)" />
      <circle r="21.5" fill="url(#hc-disc)" />
      <circle r="21.5" fill="none" stroke="#0a0f18" strokeWidth="1.2" />
      {HOLES.map((a) => (
        <circle key={a} cx="0" cy="-16.5" r="1" fill="#141c29" transform={`rotate(${a})`} />
      ))}
    </g>

    {/* brake caliper does not spin */}
    <g transform="rotate(-34)">
      <path d="M-7.5 -23.6 Q0 -25.4 7.5 -23.6 L9.6 -13.4 Q0 -11.8 -9.6 -13.4 Z" fill="#ffb11e" stroke="rgba(0,0,0,.55)" strokeWidth=".9" />
      <path d="M-5.5 -21.8 Q0 -23 5.5 -21.8" fill="none" stroke="rgba(255,255,255,.65)" strokeWidth="1" strokeLinecap="round" />
    </g>

    {/* dark multi-spoke face + bronze lip (spins) */}
    <g className="hc-wheel">
      <circle r="31.2" fill="none" stroke="url(#hc-bronze)" strokeWidth="2.8" />
      <circle r="29.6" fill="none" stroke="rgba(0,0,0,.65)" strokeWidth=".8" />
      {SPOKES.map((a) => (
        <path
          key={a}
          d="M-1.7 -8.5 L-2.7 -29.4 L2.7 -29.4 L1.7 -8.5 Z"
          transform={`rotate(${a}) skewX(-12)`}
          fill="#0e1520"
          stroke="rgba(140,185,230,.4)"
          strokeWidth=".45"
          strokeLinejoin="round"
        />
      ))}
      <circle r="9" fill="url(#hc-hub)" stroke="rgba(0,0,0,.7)" strokeWidth=".8" />
      <circle r="9" fill="none" stroke="rgba(0,240,255,.55)" strokeWidth=".7" />
      <path d="M0 -4.2 L3.6 -2.1 L3.6 2.1 L0 4.2 L-3.6 2.1 L-3.6 -2.1 Z" fill="url(#hc-metal)" stroke="rgba(0,0,0,.6)" strokeWidth=".6" />
    </g>

    {/* static lighting over the spinning parts: this is what keeps the wheel looking solid */}
    <circle r="30" fill="url(#hc-rimgloss)" />
    <path d="M-30.5 -22 A37.6 37.6 0 0 1 14 -35" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth="2" strokeLinecap="round" />
    <path d="M31 21 A37.6 37.6 0 0 1 9 36" fill="none" stroke="rgba(120,200,255,.2)" strokeWidth="1.6" strokeLinecap="round" />
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
          <linearGradient id="hc-paint-up" gradientUnits="userSpaceOnUse" x1="0" y1="96" x2="0" y2="152">
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
            <stop offset="0" stopColor="#9fe0f8" stopOpacity=".78" />
            <stop offset=".35" stopColor="#1e5584" stopOpacity=".74" />
            <stop offset=".7" stopColor="#0a2038" stopOpacity=".78" />
            <stop offset="1" stopColor="#030811" stopOpacity=".86" />
          </linearGradient>
          <linearGradient id="hc-glass-sky" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#d2f4ff" />
            <stop offset=".5" stopColor="#62b6e0" />
            <stop offset="1" stopColor="#1d4f80" />
          </linearGradient>
          <linearGradient id="hc-cabin" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#1a3050" />
            <stop offset="1" stopColor="#02060d" />
          </linearGradient>
          <linearGradient id="hc-seat" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#35557c" />
            <stop offset="1" stopColor="#0f1d33" />
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
          <linearGradient id="hc-bronze" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f0c28a" />
            <stop offset=".45" stopColor="#b9783c" />
            <stop offset="1" stopColor="#5a3417" />
          </linearGradient>
          <radialGradient id="hc-hub" cx=".4" cy=".35" r=".8">
            <stop offset="0" stopColor="#3a4a60" />
            <stop offset="1" stopColor="#0a1220" />
          </radialGradient>
          <radialGradient id="hc-barrel" cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#0d1623" />
            <stop offset="1" stopColor="#000" />
          </radialGradient>
          <radialGradient id="hc-disc" cx=".4" cy=".35" r=".8">
            <stop offset="0" stopColor="#8794a6" />
            <stop offset="1" stopColor="#2c3644" />
          </radialGradient>
          <linearGradient id="hc-rimgloss" x1="0" y1="0" x2=".7" y2=".7">
            <stop offset="0" stopColor="#fff" stopOpacity=".3" />
            <stop offset=".5" stopColor="#fff" stopOpacity="0" />
            <stop offset="1" stopColor="#00f0ff" stopOpacity=".1" />
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
            <stop offset=".5" stopColor="#dff8ff" stopOpacity=".16" />
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
          <clipPath id="hc-doorclip">
            <path d="M452 131 L428 199 L330 199 L272 134 L276 131 Z" />
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

          {/* ── rear wing on carbon struts ── */}
          <path d="M86 136 L90 114 L99 114 L101 134 Z" fill="url(#hc-carbon)" stroke="rgba(160,225,255,.35)" strokeWidth=".7" strokeLinejoin="round" />
          <path d="M108 133 L111 113 L119 113 L119 131 Z" fill="url(#hc-carbon)" stroke="rgba(160,225,255,.35)" strokeWidth=".7" strokeLinejoin="round" />
          <path d="M66 104 L106 99 L132 101 L130 113 L132 118 L68 125 Z" fill="url(#hc-carbon)" stroke="rgba(160,225,255,.5)" strokeWidth=".8" strokeLinejoin="round" />
          <path d="M70 105.4 L105 100.8 L129 102.6" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="1" strokeLinecap="round" />
          <path d="M68 122 L130 115.4" stroke="#00f0ff" strokeWidth=".9" opacity=".6" />

          {/* ── body shell ── */}
          <path d={BODY} fill="url(#hc-paint)" />
          <g clipPath="url(#hc-clip)">
            {/* top planes (engine cover, hood) catch the sky, so they're lighter than the flanks */}
            <path d="M64 152 L68 140 L84 133 L170 124 C212 118 250 108 290 103 L276 131 L214 134 L170 135 L100 142 Z" fill="url(#hc-paint-up)" />
            <path d="M454 123 C484 127 524 135 560 145 C580 150 592 158 593 170 L588 172 L575 164 L540 155 L498 145 L452 136 L452 131 Z" fill="url(#hc-paint-up)" />
            {/* sharp crease lines: bright edge on top, shadow just below */}
            <path d="M276 131 L214 134 L170 135 L100 142 L64 152" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="1.2" strokeLinejoin="round" />
            <path d="M276 133 L214 136 L170 137 L100 144 L64 154" fill="none" stroke="rgba(0,12,34,.45)" strokeWidth="2.4" strokeLinejoin="round" />
            <path d="M452 136 L498 145 L540 155 L575 164 L591 171" fill="none" stroke="rgba(255,255,255,.75)" strokeWidth="1.2" strokeLinejoin="round" />
            <path d="M452 138 L498 147 L540 157 L575 166 L591 173" fill="none" stroke="rgba(0,12,34,.45)" strokeWidth="2.4" strokeLinejoin="round" />

            {/* rear haunch: muscular wide-stance highlight over the rear arch */}
            <path d="M104 150 C130 128 188 124 232 138 L232 144 C190 134 134 136 104 158 Z" fill="url(#hc-streak)" opacity=".8" />
            {/* studio softbox reflection along the flank */}
            <path d="M70 160 L276 152 L452 160 L566 170 L452 165 L276 158 L70 166 Z" fill="url(#hc-streak)" />

            {/* engine-cover vent */}
            <path d="M178 126 L232 116 L232 120 L180 130 Z" fill="#020812" />
            <path d="M180 131 L232 121" stroke="rgba(160,225,255,.35)" strokeWidth=".8" />

            {/* ambient occlusion toward the sill */}
            <rect x="60" y="168" width="540" height="42" fill="url(#hc-ao)" />

            {/* carbon rocker + accent */}
            <path d="M213 208 L215 199 L428 199 L429 208 Z" fill="url(#hc-carbon)" />
            <path d="M217 199.6 L426 199.6" stroke="rgba(160,225,255,.4)" strokeWidth=".9" />
            <path d="M216 206.6 L428 206.6" stroke="#00f0ff" strokeWidth="1" opacity=".55" />

            {/* huge angular side intake behind the door (its front edge is the door's rear cut) */}
            <path d="M270 135 L330 198 L238 198 C230 190 227 176 229 162 C236 148 250 140 270 135 Z" fill="url(#hc-intake)" />
            <g stroke="rgba(120,200,255,.22)" strokeWidth="1.3" fill="none">
              <path d="M276 150 L240 160" />
              <path d="M292 166 L234 174" />
              <path d="M309 181 L236 188" />
            </g>
            <path d="M270 135 C250 140 236 148 229 162 C227 176 230 190 238 198" fill="none" stroke="rgba(190,240,255,.65)" strokeWidth="1.3" />
            <path d="M262 140 C246 146 238 154 234 166" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="2.4" />

            {/* front fender gills */}
            <path d="M500 150 L532 158 L531 162 L498 154 Z" fill="#020812" />
            <path d="M503 163 L534 170 L533 173 L501 167 Z" fill="#020812" />

            {/* front fascia: air-curtain blade, big black intake, carbon splitter */}
            <path d="M520 174 L538 178 L536 199 L520 199 Z" fill="url(#hc-carbon)" />
            <path d="M521 175.6 L537 179.4" stroke="rgba(160,225,255,.55)" strokeWidth="1" />
            <path d="M546 176 L592 174 L589 197 L550 198 Z" fill="url(#hc-intake)" />
            <g stroke="rgba(120,200,255,.28)" strokeWidth="1.1" fill="none">
              <path d="M550 182 L591 180" />
              <path d="M550 188 L590 186" />
              <path d="M551 193 L589 192" />
            </g>
            <path d="M546 176 L592 174" stroke="rgba(190,240,255,.7)" strokeWidth="1.1" />
            <path d="M516 200 L588 198 L593 204 L584 208 L516 208 Z" fill="url(#hc-carbon)" />
            <path d="M520 200.4 L588 198.8" stroke="#00f0ff" strokeWidth="1" opacity=".7" />

            {/* rear diffuser */}
            <path d="M66 182 L74 207 L126 208 L130 196 L98 190 Z" fill="url(#hc-carbon)" />
            <g stroke="rgba(130,165,200,.4)" strokeWidth="1">
              <path d="M88 192 L92 207" />
              <path d="M102 194 L106 208" />
              <path d="M116 196 L119 208" />
            </g>

            {/* cabin / doorway: only really visible while the scissor door is up */}
            <path d="M450 132 L389 105 C374 103.5 345 103.5 330 107 L279 133 L333 197 L430 197 Z" fill="url(#hc-cabin)" />
            <path d="M279 133 L333 197 L430 197 L436 178 L352 176 Z" fill="#050b16" opacity=".7" />
            <path d="M352 171 C346 149 348 126 357 113 C365 106 376 112 379 127 L383 171 Z" fill="url(#hc-seat)" />
            <path d="M347 172 L412 170 L418 181 L346 185 Z" fill="#1a2d4a" />
            <path d="M358 116 C362 111 369 111 373 117" fill="none" stroke="rgba(180,225,255,.45)" strokeWidth="1" strokeLinecap="round" />
            <ellipse cx="421" cy="141" rx="3.2" ry="14" transform="rotate(26 421 141)" fill="none" stroke="#0a1424" strokeWidth="3.2" />
            <path d="M419 152 L432 168" stroke="#0a1424" strokeWidth="3" strokeLinecap="round" />
            <path d="M452 131 L430 134 L437 152 L452 148 Z" fill="#081224" />
          </g>

          {/* ── windshield (seen at a slight angle, so it reads as a sloped glass plane) ── */}
          <path d="M386 97 L454 123 L452 131 L388 103 Z" fill="url(#hc-glass-sky)" stroke="rgba(0,8,22,.8)" strokeWidth=".8" strokeLinejoin="round" />
          <path d="M389 99 L452 124" stroke="rgba(255,255,255,.6)" strokeWidth=".9" />

          {/* ── scissor door: skin + side glass + mirror, hinged at the A-pillar base ── */}
          <g className="hc-door">
            <path d="M452 131 L428 199 L330 199 L272 134 L276 131 Z" fill="url(#hc-paint)" />
            <g clipPath="url(#hc-doorclip)">
              <path d="M270 150 L452 148 L452 160 L270 164 Z" fill="url(#hc-streak)" />
              <path d="M300 176 C350 170 400 172 440 178" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="1.2" />
              <rect x="260" y="168" width="200" height="34" fill="url(#hc-ao)" />
            </g>
            <path d="M452 131 L428 199" stroke="rgba(0,8,22,.75)" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M453.4 133 L429.4 199" stroke="rgba(255,255,255,.2)" strokeWidth=".8" strokeLinecap="round" />
            <path d="M272 134 L330 199" stroke="rgba(0,8,22,.8)" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M273.6 133 L331.6 198" stroke="rgba(190,240,255,.35)" strokeWidth=".8" strokeLinecap="round" />
            <path d="M330 199 L428 199" stroke="rgba(0,8,22,.7)" strokeWidth="1.2" />
            <rect x="372" y="146" width="22" height="3.2" rx="1.6" fill="rgba(0,8,22,.55)" />
            <rect x="372" y="144.8" width="22" height="2.8" rx="1.4" fill="rgba(215,243,255,.65)" />

            {/* side glass */}
            <path d="M452 131 L388 103 C374 101.5 344 101.5 328 105.5 L276 131 Z" fill="url(#hc-glass)" />
            <path d="M318 131 L350 104 L364 103.6 L336 131 Z" fill="#fff" opacity=".2" />
            <path d="M376 131 L394 106 L399 108 L390 131 Z" fill="#fff" opacity=".12" />
            <path d="M452 131 L388 103 C374 101.5 344 101.5 328 105.5 L276 131 Z" fill="none" stroke="#02060d" strokeWidth="2.2" strokeLinejoin="round" />
            <path d="M388 103 C374 101.5 344 101.5 328 105.5" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth=".8" />
            <path d="M276 131 L452 131" stroke="rgba(0,8,22,.75)" strokeWidth="1.2" />

            {/* wing mirror */}
            <path d="M448 123 L474 123 C480 125 480 132 474 134 L452 134 Z" fill="#1286d2" stroke="rgba(0,8,22,.8)" strokeWidth=".9" strokeLinejoin="round" />
            <path d="M452 125 L472 124.6" stroke="rgba(255,255,255,.65)" strokeWidth="1" strokeLinecap="round" />
          </g>

          {/* paint reflection that slides over the panels as the car moves */}
          <g clipPath="url(#hc-clip)">
            <g className="hc-glint">
              <path d="M286 97 L338 97 L308 208 L256 208 Z" fill="url(#hc-glint)" />
              <path d="M368 97 L384 97 L354 208 L338 208 Z" fill="url(#hc-glint)" opacity=".7" />
            </g>
          </g>

          {/* rim light along the upper silhouette */}
          <path d="M68 140 L84 133 L170 124 C212 118 250 108 290 103 C320 100 352 98 386 97 L454 123 C484 127 524 135 560 145 C580 150 592 158 593 170" fill="none" stroke="url(#hc-edge)" strokeWidth="1.5" strokeLinejoin="round" />

          {/* ── lamps ── */}
          <g>
            <circle className="hc-head" cx="574" cy="163" r="16" fill="url(#hc-lampglow)" />
            <path d="M530 153 L566 157 C581 161 590 167 592 173 L553 166 Z" fill="url(#hc-headglass)" stroke="rgba(255,255,255,.4)" strokeWidth=".8" strokeLinejoin="round" />
            <path d="M534 155 L566 159 C578 162 586 166 590 171" fill="none" stroke="#00f0ff" strokeWidth="6" strokeLinecap="round" opacity=".2" />
            <path d="M534 155 L566 159 C578 162 586 166 590 171" fill="none" stroke="#eaffff" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M552 161 L576 167" fill="none" stroke="#eaffff" strokeWidth="1.6" strokeLinecap="round" />
          </g>
          <g className="hc-brake">
            <circle cx="76" cy="152" r="17" fill="url(#hc-tailglow)" />
            <path d="M66 148 L94 142 L98 146 L68 160 Z" fill="#ff2b6a" />
            <path d="M68 164 L92 158 L94 161 L69 169 Z" fill="#ff2b6a" />
            <path d="M68 149.4 L93 143.8" stroke="#ffd0de" strokeWidth="1" strokeLinecap="round" />
          </g>
          <path className="hc-rev" d="M67 172 L81 169 L82 173 L68 177 Z" fill="#f4fdff" />

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