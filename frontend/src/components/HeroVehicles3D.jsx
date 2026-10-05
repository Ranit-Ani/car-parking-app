/**
 * Real-time 3D layer for the landing hero: the Kawasaki 2-wheeler and the auto-rickshaw are
 * rendered straight from their .glb models (three.js), on a transparent canvas laid exactly
 * over the hero SVG (same 800x250 coordinate system, orthographic side-on camera).
 *
 * - Movement (travel, lane->bay depth, steering/dive) follows lib/heroTimeline.js, a port of
 *   the CSS keyframes, and is slaved to the Lamborghini's CSS animation clock so everything
 *   (bay indicator, car, bike, rickshaw) stays in step.
 * - Wheels are separate nodes in the .glb files; they spin by "rolling without slipping":
 *   angle = -distance travelled / wheel radius.
 * - Nothing is drawn for these two vehicles until both models are loaded; then the canvas fades in.
 *   If WebGL or the files fail, onFail() tells the parent to show the SVG vehicles instead.
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import bikeUrl from '../assets/models/kawasaki-h2r.glb?url';
import rickshawUrl from '../assets/models/auto-rickshaw.glb?url';
import { BIKE, RICKSHAW, LOOP_MS, sampleVehicle } from '../lib/heroTimeline.js';

// Same coordinate system as the SVG (viewBox 0 0 800 250); 1 world unit = 1 SVG px, y flipped.
const VIEW_W = 800;
const VIEW_H = 250;
const PARK_X = 332;     // bay centre (330 + the 2px outer translate used by the SVG art)
const GROUND_Y = 186.8; // tyre contact line (SVG y) when parked; the lane is `ty` px lower

// The H2R model ships with black mirror paint (its only green is the hidden frame). The body-panel
// material 'Vt_Liu.001' is re-painted Kawasaki green here - change `color` to taste, or delete the
// `paint` line below to get the original black bike back.
const BIKE_PAINT = { material: 'Vt_Liu.001', color: '#4ee21a', metalness: 0.35, roughness: 0.28 };

// lengthPx = on-screen length at lane scale (parked scale is x0.92)
const SPECS = [
  { key: 'bike', url: bikeUrl, track: BIKE, lengthPx: 340, wheelNames: ['wheel_f', 'wheel_r'], paint: BIKE_PAINT },
  { key: 'rickshaw', url: rickshawUrl, track: RICKSHAW, lengthPx: 290, wheelNames: ['wheel_f', 'wheel_rr', 'wheel_rl'], solidWheels: true },
];


/* The auto-rickshaw .glb ships with very rough wheel meshes: lumpy (not round), hollow inside and with
   a stray mudguard sliver that spins along with the tyre - so the wheels looked gappy and hard to read.
   For that model the original wheel meshes are hidden and replaced with clean, solid, procedural wheels
   (rubber tyre + steel rim + hub + dark spoke holes, so the rotation is clearly visible). */
function buildSolidWheel(R, W) {
  const g = new THREE.Group();
  const rubber = new THREE.MeshStandardMaterial({ color: 0x0b0d11, roughness: 0.92, metalness: 0.0 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xc3ccd6, roughness: 0.35, metalness: 0.85 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x141a22, roughness: 0.7, metalness: 0.3 });
  const hub = new THREE.MeshStandardMaterial({ color: 0x7d8a99, roughness: 0.3, metalness: 0.9 });

  // tyre: rounded cross-section, revolved around the axle (lathe axis = Y, rotated to Z below)
  const hw = W / 2, r0 = R * 0.62, rc = Math.min(hw * 0.9, R * 0.2);
  const prof = [new THREE.Vector2(r0, -hw * 0.9)];
  for (let i = 0; i <= 8; i++) {
    const a = -Math.PI / 2 + (i / 8) * Math.PI; // round shoulder/tread
    prof.push(new THREE.Vector2(R - rc + Math.cos(a) * rc * 0.9 + rc * 0.1, Math.sin(a) * hw));
  }
  prof.push(new THREE.Vector2(r0, hw * 0.9));
  const tyre = new THREE.Mesh(new THREE.LatheGeometry(prof, 48), rubber);
  tyre.rotation.x = Math.PI / 2;
  tyre.material.side = THREE.DoubleSide;
  g.add(tyre);

  // rim: disc on each side so the wheel is solid from either view
  const rimR = R * 0.66;
  for (const sgn of [1, -1]) {
    const z = sgn * (hw + 0.004); // just outside the tyre side so the rim is never hidden by it
    const face = new THREE.Mesh(new THREE.CircleGeometry(rimR, 40), steel);
    face.position.z = z;
    if (sgn < 0) face.rotation.y = Math.PI;
    g.add(face);
    const lip = new THREE.Mesh(new THREE.RingGeometry(rimR * 0.93, rimR, 40), dark);
    lip.position.z = z + sgn * 0.001;
    if (sgn < 0) lip.rotation.y = Math.PI;
    g.add(lip);
    // 5 dark spoke holes
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + Math.PI / 2;
      const hole = new THREE.Mesh(new THREE.CircleGeometry(rimR * 0.17, 20), dark);
      hole.position.set(Math.cos(a) * rimR * 0.58, Math.sin(a) * rimR * 0.58, z + sgn * 0.002);
      if (sgn < 0) hole.rotation.y = Math.PI;
      g.add(hole);
    }
    const cap = new THREE.Mesh(new THREE.CircleGeometry(rimR * 0.22, 24), hub);
    cap.position.z = z + sgn * 0.003;
    if (sgn < 0) cap.rotation.y = Math.PI;
    g.add(cap);
  }
  return g;
}

function disposeScene(scene) {
  scene.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    mats.forEach((m) => {
      Object.values(m).forEach((v) => { if (v && v.isTexture) v.dispose(); });
      m.dispose();
    });
  });
}

export default function HeroVehicles3D({ active, onReady, onFail }) {
  const hostRef = useRef(null);
  const activeRef = useRef(active);
  const onReadyRef = useRef(onReady);
  const onFailRef = useRef(onFail);
  activeRef.current = active;
  onReadyRef.current = onReady;
  onFailRef.current = onFail;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    } catch (err) {
      console.warn('[hero] WebGL unavailable, using SVG vehicles', err);
      if (onFailRef.current) onFailRef.current();
      return undefined;
    }
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(0, VIEW_W, VIEW_H, 0, 0.1, 4000);
    camera.position.set(0, 0, 1500); // looks down -Z at the vehicle's right-hand side (+X = forward on screen)

    // procedural studio reflections (no network / HDR file needed) + a key light and a cyan rim light
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    scene.environmentIntensity = 0.9;
    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(-500, 900, 900);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x00f0ff, 1.1);
    rim.position.set(700, 400, -800);
    scene.add(rim);

    const resize = () => {
      const w = host.clientWidth, h = host.clientHeight;
      if (!w || !h) return;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    let inView = true;
    const io = new IntersectionObserver(([e]) => { inView = e.isIntersecting; });
    io.observe(host);

    // clock: the Lamborghini's CSS animation (same 47s loop everything else uses)
    let masterAnim = null;
    const t0 = performance.now();
    const clock = () => {
      if (!masterAnim) {
        const el = host.parentElement && host.parentElement.querySelector('.hc-drive');
        masterAnim = el && el.getAnimations ? el.getAnimations().find((a) => a.animationName === 'carDrive') || null : null;
      }
      if (masterAnim && typeof masterAnim.currentTime === 'number') return masterAnim.currentTime % LOOP_MS;
      return (performance.now() - t0) % LOOP_MS;
    };

    let disposed = false;
    let ready = false;
    let announced = false;
    let drawnEmpty = false;
    const vehicles = [];

    const loader = new GLTFLoader();
    // The server's CSP allows blob: images (img-src) but not blob: fetches (connect-src). By default
    // GLTFLoader decodes the textures embedded in a .glb with fetch(blob:...) (ImageBitmapLoader),
    // which that CSP blocks - so use a plain <img>-based TextureLoader instead.
    loader.register((parser) => {
      parser.textureLoader = new THREE.TextureLoader(parser.options.manager);
      return { name: 'HERO_IMG_TEXTURES' };
    });
    Promise.all(SPECS.map((sp) => loader.loadAsync(sp.url)))
      .then((gltfs) => {
        if (disposed) return;
        gltfs.forEach((gltf, i) => {
          const sp = SPECS[i];
          const model = gltf.scene;
          if (sp.paint) {
            model.traverse((o) => {
              const mat = o.isMesh && o.material;
              if (mat && !Array.isArray(mat) && mat.name === sp.paint.material) {
                mat.color.set(sp.paint.color);
                mat.metalness = sp.paint.metalness;
                mat.roughness = sp.paint.roughness;
              }
            });
          }
          model.updateMatrixWorld(true);
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const k = sp.lengthPx / size.x; // px per metre

          // wheels: spin about their own node origin (baked at the axle); radius from their bounding box
          const wheels = [];
          sp.wheelNames.forEach((name) => {
            const node = model.getObjectByName(name);
            if (!node) return;
            const wb = new THREE.Box3().setFromObject(node);
            if (sp.solidWheels) {
              // true wheel radius = axle height above the ground (model min y); width/side from the old mesh
              const R = node.position.y - box.min.y;
              const W = Math.max(wb.max.z - wb.min.z, 0.12);
              const centre = node.worldToLocal(wb.getCenter(new THREE.Vector3()));
              node.traverse((o) => { if (o.isMesh) o.visible = false; });
              const solid = buildSolidWheel(R, W);
              solid.position.z = centre.z;
              node.add(solid);
              wheels.push({ node, radius: R * k, fudge: 1 });
              return;
            }
            wheels.push({ node, radius: ((wb.max.y - wb.min.y) / 2) * k, fudge: 0.96 });
          });

          // origin of the model = bottom-centre (ground contact), like the SVG art's transform-origin
          model.position.set(-((box.min.x + box.max.x) / 2) * k, -box.min.y * k, 0);
          model.scale.setScalar(k);

          const yaw = new THREE.Group();
          yaw.add(model);
          const root = new THREE.Group();
          root.add(yaw);
          root.visible = false;
          scene.add(root);
          vehicles.push({ track: sp.track, root, yaw, wheels });
        });
        ready = true;
      })
      .catch((err) => {
        if (disposed) return;
        console.warn('[hero] could not load 3D models, using SVG vehicles', err);
        if (onFailRef.current) onFailRef.current();
      });

    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!ready) return;
      const t = clock();

      // hand over from the SVG vehicles as soon as both models are loaded
      if (!announced) {
        announced = true;
        console.info('[hero] 3D vehicles loaded - switching from SVG to GLB');
        if (onReadyRef.current) onReadyRef.current();
      }
      if (!activeRef.current || !inView) return;

      let any = false;
      for (const v of vehicles) {
        const s = sampleVehicle(v.track, t);
        v.root.visible = s.visible;
        if (!s.visible) continue;
        any = true;
        v.root.position.set(PARK_X + s.x, VIEW_H - (GROUND_Y + s.ty), 0);
        v.root.scale.setScalar(s.scale);
        v.yaw.rotation.z = (-s.yaw * Math.PI) / 180; // CSS rotate(+deg) is clockwise; three +z is counter-clockwise
        for (const w of v.wheels) w.node.rotation.z = -s.x / (w.radius * w.fudge); // rolling: forward = clockwise
      }
      if (any || !drawnEmpty) {
        renderer.render(scene, camera);
        drawnEmpty = !any;
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      disposeScene(scene);
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={hostRef} className={active ? 'hero-3d on' : 'hero-3d'} aria-hidden="true" />;
}