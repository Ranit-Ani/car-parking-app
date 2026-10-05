/**
 * Real-time 3D layer for the landing hero: the Kawasaki 2-wheeler is
 * rendered straight from its .glb model (three.js), on a transparent canvas laid exactly
 * over the hero SVG (same 800x250 coordinate system, orthographic side-on camera).
 *
 * - Movement (travel, lane->bay depth, steering/dive) follows lib/heroTimeline.js, a port of
 *   the CSS keyframes, and is slaved to the Lamborghini's CSS animation clock so everything
 *   (bay indicator, car, bike) stays in step.
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
import { BIKE, LOOP_MS, sampleVehicle } from '../lib/heroTimeline.js';

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
];



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
            wheels.push({ node, radius: ((wb.max.y - wb.min.y) / 2) * k });
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
        for (const w of v.wheels) w.node.rotation.z = -s.x / (w.radius * 0.96); // rolling: forward = clockwise
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