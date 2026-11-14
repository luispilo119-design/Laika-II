/**
 * Vista 3D de la transferencia de Hohmann (Three.js). Dueño: Parte A.
 *
 * Solo dibuja: las posiciones salen de orbit.js (mismos cálculos que la versión 2D).
 * Las órbitas están en el plano de la eclíptica (x, y en UA) y se pasan a Three como (x, 0, -y).
 * Los tamaños de los cuerpos están exagerados para que se vean; las distancias sí están a escala.
 */
import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  DirectionalLight,
  AmbientLight,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PointLight,
  Points,
  PointsMaterial,
  RingGeometry,
  Scene,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
  WebGLRenderer,
  DoubleSide,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const K = 10; // unidades de Three por UA
const toV = (p, y = 0) => new Vector3(p.x * K, y, -p.y * K);

/** Textura procedural de un planeta: bandas y manchas, sin imágenes externas. */
function planetTexture(base, accents, seed) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 128);
  let s = seed;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  for (let i = 0; i < 90; i++) {
    g.fillStyle = accents[i % accents.length];
    g.globalAlpha = 0.25 + rand() * 0.45;
    g.beginPath();
    g.ellipse(rand() * 256, 14 + rand() * 100, 6 + rand() * 30, 3 + rand() * 12, rand() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  const tex = new CanvasTexture(c);
  return tex;
}

function glowSprite(color, size) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, color);
  grad.addColorStop(0.25, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const sprite = new Sprite(new SpriteMaterial({ map: new CanvasTexture(c), blending: AdditiveBlending, depthWrite: false, transparent: true }));
  sprite.scale.set(size, size, 1);
  return sprite;
}

function lineFrom(points, material) {
  const geo = new BufferGeometry().setFromPoints(points.map((p) => toV(p)));
  const line = new Line(geo, material);
  if (material.isLineDashedMaterial) line.computeLineDistances();
  return line;
}

/**
 * @param {HTMLElement} container  caja donde va el canvas (se llena por completo)
 * @param {{ earth: string, mars: string, ship: string, sun: string, labels: Record<string, string> }} opts
 * @returns {null | { setPaths: Function, update: Function, dispose: Function }}  null si no hay WebGL
 */
export function createHohmann3D(container, opts) {
  let renderer;
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: false });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(new Color('#07060a'));
  renderer.domElement.className = 'hohmann__webgl';
  container.append(renderer.domElement);

  const labelLayer = document.createElement('div');
  labelLayer.className = 'hohmann__labels';
  container.append(labelLayer);

  const scene = new Scene();
  const camera = new PerspectiveCamera(42, 1, 0.1, 500);
  camera.position.set(0, 26, 22);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 8;
  controls.maxDistance = 70;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.target.set(0, 0, 0);

  scene.add(new AmbientLight(0xffffff, 0.25));
  const sunLight = new PointLight(0xfff1d0, 2.4, 0, 0);
  scene.add(sunLight);
  const fill = new DirectionalLight(0x8899ff, 0.15);
  fill.position.set(-10, 20, 10);
  scene.add(fill);

  // Estrellas de fondo
  const starGeo = new BufferGeometry();
  const starPos = [];
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 1400; i++) {
    const u = rnd() * 2 - 1;
    const th = rnd() * Math.PI * 2;
    const r = 160 + rnd() * 60;
    const sq = Math.sqrt(1 - u * u);
    starPos.push(r * sq * Math.cos(th), r * u, r * sq * Math.sin(th));
  }
  starGeo.setAttribute('position', new Float32BufferAttribute(starPos, 3));
  scene.add(new Points(starGeo, new PointsMaterial({ color: 0xffffff, size: 0.7, sizeAttenuation: true, transparent: true, opacity: 0.8 })));

  // Sol
  const sun = new Mesh(new SphereGeometry(0.9, 32, 16), new MeshBasicMaterial({ color: opts.sun }));
  scene.add(sun, glowSprite('rgba(255,210,120,0.9)', 7));

  // Planetas
  const earth = new Mesh(
    new SphereGeometry(0.42, 32, 16),
    new MeshStandardMaterial({ map: planetTexture('#2d6cc0', ['#3f9d4f', '#e8eef5', '#1f4f99'], 11), roughness: 0.8 }),
  );
  const mars = new Mesh(
    new SphereGeometry(0.32, 32, 16),
    new MeshStandardMaterial({ map: planetTexture('#c2532f', ['#8f3a22', '#e08a5f', '#f3e4d4'], 23), roughness: 0.95 }),
  );
  scene.add(earth, mars);

  // Nave: cono que apunta hacia donde avanza, con una estela.
  const ship = new Group();
  const hull = new Mesh(new ConeGeometry(0.12, 0.42, 12), new MeshStandardMaterial({ color: opts.ship, emissive: opts.ship, emissiveIntensity: 0.6 }));
  hull.rotation.x = Math.PI / 2;
  ship.add(hull, glowSprite('rgba(255,255,255,0.8)', 0.9));
  scene.add(ship);

  // Anillos de salida y llegada
  const ringMat = (color) => new MeshBasicMaterial({ color, side: DoubleSide, transparent: true, opacity: 0.85 });
  const depRing = new Mesh(new RingGeometry(0.62, 0.72, 40), ringMat(opts.earth));
  const arrRing = new Mesh(new RingGeometry(0.52, 0.62, 40), ringMat(opts.mars));
  depRing.rotation.x = arrRing.rotation.x = -Math.PI / 2;
  scene.add(depRing, arrRing);

  const dynamic = new Group(); // líneas que cambian con el plan o el tiempo
  scene.add(dynamic);
  let staticLines = new Group();
  scene.add(staticLines);
  let transferPts = [];
  let progressLine = null;
  let angleGroup = new Group();
  scene.add(angleGroup);

  // Etiquetas HTML que siguen a los objetos
  const labels = {};
  for (const [key, text] of Object.entries(opts.labels)) {
    const span = document.createElement('span');
    span.className = `hohmann__label hohmann__label--${key}`;
    span.textContent = text;
    labelLayer.append(span);
    labels[key] = span;
  }
  const placeLabel = (key, pos, visible = true) => {
    const span = labels[key];
    if (!span) return;
    const v = pos.clone().project(camera);
    const show = visible && v.z < 1;
    span.style.display = show ? '' : 'none';
    if (!show) return;
    const { clientWidth: w, clientHeight: h } = renderer.domElement;
    span.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px)`;
  };

  let state = null;
  let raf = 0;
  let disposed = false;

  function setPaths(paths) {
    scene.remove(staticLines);
    staticLines = new Group();
    staticLines.add(
      lineFrom(paths.earth, new LineBasicMaterial({ color: opts.earth, transparent: true, opacity: 0.55 })),
      lineFrom(paths.mars, new LineBasicMaterial({ color: opts.mars, transparent: true, opacity: 0.55 })),
      lineFrom(paths.transfer, new LineDashedMaterial({ color: opts.ship, dashSize: 0.35, gapSize: 0.25, transparent: true, opacity: 0.6 })),
    );
    scene.add(staticLines);
    transferPts = paths.transfer;
  }

  /**
   * @param {{ plan: any, earth: any, mars: any, ship: any|null, fraction: number, phase: number, angleDeg: number|null }} s
   */
  function update(s) {
    state = s;
    earth.position.copy(toV(s.earth));
    mars.position.copy(toV(s.mars));
    depRing.position.copy(toV(s.plan.earthAtDeparture, 0.01));
    arrRing.position.copy(toV(s.plan.marsAtArrival, 0.01));
    depRing.scale.setScalar(s.phase === 2 ? 1.5 : 1);
    arrRing.scale.setScalar(s.phase === 4 ? 1.5 : 1);

    // Tramo ya recorrido de la elipse, sólido.
    if (progressLine) dynamic.remove(progressLine);
    progressLine = null;
    if (s.fraction > 0 && transferPts.length) {
      const upTo = Math.max(1, Math.round(Math.min(1, s.fraction) * (transferPts.length - 1)));
      progressLine = lineFrom(transferPts.slice(0, upTo + 1), new LineBasicMaterial({ color: opts.ship, linewidth: 2 }));
      dynamic.add(progressLine);
    }

    ship.visible = Boolean(s.ship);
    if (s.ship) {
      const pos = toV(s.ship, 0.02);
      const ahead = toV(s.shipAhead ?? s.ship, 0.02);
      ship.position.copy(pos);
      if (ahead.distanceToSquared(pos) > 1e-8) ship.lookAt(ahead);
    }

    // Fase 1: líneas Sol–Tierra y Sol–Marte con el ángulo entre ellas.
    scene.remove(angleGroup);
    angleGroup = new Group();
    if (s.angleDeg != null) {
      const o = new Vector3(0, 0.01, 0);
      const mk = (to, color) => new Line(new BufferGeometry().setFromPoints([o, to]), new LineBasicMaterial({ color, transparent: true, opacity: 0.8 }));
      angleGroup.add(mk(earth.position.clone().setY(0.01), opts.earth), mk(mars.position.clone().setY(0.01), opts.mars));
      const a0 = Math.atan2(-earth.position.z, earth.position.x);
      const arc = [];
      const r = 4.2;
      for (let i = 0; i <= 32; i++) {
        const a = a0 + ((s.angleDeg * Math.PI) / 180) * (i / 32);
        arc.push(new Vector3(Math.cos(a) * r, 0.01, -Math.sin(a) * r));
      }
      angleGroup.add(new Line(new BufferGeometry().setFromPoints(arc), new LineBasicMaterial({ color: opts.ship })));
      const mid = a0 + ((s.angleDeg * Math.PI) / 180) / 2;
      angleGroup.userData.labelPos = new Vector3(Math.cos(mid) * (r + 1.2), 0.01, -Math.sin(mid) * (r + 1.2));
      labels.angle.textContent = `${Math.round(s.angleDeg)}°`;
    }
    scene.add(angleGroup);
  }

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = `${w}px`;
    renderer.domElement.style.height = `${h}px`;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  function frame() {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    if (document.hidden) return;
    controls.update();
    earth.rotation.y += 0.01;
    mars.rotation.y += 0.009;
    renderer.render(scene, camera);
    if (state) {
      placeLabel('sun', new Vector3(0, 1.4, 0));
      placeLabel('earth', earth.position.clone().add(new Vector3(0, 0.8, 0)));
      placeLabel('mars', mars.position.clone().add(new Vector3(0, 0.7, 0)));
      placeLabel('ship', ship.position.clone().add(new Vector3(0, 0.6, 0)), ship.visible);
      placeLabel('departure', depRing.position.clone().add(new Vector3(0, -0.2, 0.9)));
      placeLabel('arrival', arrRing.position.clone().add(new Vector3(0, -0.2, 0.9)));
      placeLabel('angle', angleGroup.userData.labelPos ?? new Vector3(), state.angleDeg != null);
    }
  }
  raf = requestAnimationFrame(frame);

  function dispose() {
    disposed = true;
    cancelAnimationFrame(raf);
    observer.disconnect();
    controls.dispose();
    renderer.dispose();
    scene.traverse((obj) => {
      obj.geometry?.dispose?.();
      const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
      for (const m of mats) {
        m.map?.dispose?.();
        m.dispose?.();
      }
    });
    renderer.domElement.remove();
    labelLayer.remove();
  }

  return { setPaths, update, dispose };
}
