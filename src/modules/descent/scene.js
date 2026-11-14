/**
 * Escena Three.js de la primera persona: terreno, rocas, cielo, sol y cámara. Parte B — B5.
 * Se carga bajo demanda (import dinámico desde index.js) para que Three.js no pese en el
 * arranque de la app.
 *
 * Qué viene de datos y qué es decorativo:
 *  - La forma del terreno sale de la rejilla de `env.elevationGrid`.
 *  - El relieve fino, las rocas y los colores son decorativos (ver terrain.js y la nota en pantalla).
 */
import {
  BufferAttribute,
  Color,
  DirectionalLight,
  FogExp2,
  HemisphereLight,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  RingGeometry,
  Scene,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';
import { AREA_M, EYE_M, START_ALTITUDE_M, sunState, dustFogDensity, easeInOut } from './terrain.js';

const DESCENT_SECONDS = 7;
const WALK_MPS = 5; // más rápido que una caminata real, para poder recorrer el terreno
const RUN_FACTOR = 3;
const TURN_RPS = 1.4; // giro con el teclado, radianes por segundo
const LOOK_SENSITIVITY = 0.0042; // radianes por píxel arrastrado
const LOOK_DOWN = -Math.PI / 2 + 0.02;
const ROCKS = 260;

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = Math.imul(s ^ (s >>> 15), 1 | s);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {object} opts
 * @param {HTMLCanvasElement} opts.canvas
 * @param {ReturnType<import('./terrain.js').makeHeightField>} opts.field
 * @param {{ groundDark: string, groundMid: string, groundLight: string, rock: string, sky: string, dust: string, night: string, sun: string }} opts.palette
 *   colores CSS (#rrggbb)
 */
export function createScene({ canvas, field, palette }) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

  const scene = new Scene();
  const fog = new FogExp2(palette.sky, dustFogDensity(0.5));
  scene.fog = fog;
  scene.background = new Color(palette.sky);

  const camera = new PerspectiveCamera(70, 1, 0.3, 16000);
  camera.rotation.order = 'YXZ';

  // ---------- Terreno ----------
  const segments = field.width - 1;
  const geometry = new PlaneGeometry(AREA_M, AREA_M, segments, segments);
  geometry.rotateX(-Math.PI / 2); // del plano XY al suelo XZ: la fila 0 queda al norte (z negativo)
  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const dark = new Color(palette.groundDark);
  const mid = new Color(palette.groundMid);
  const light = new Color(palette.groundLight);
  const tint = new Color();
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    position.setY(i, field.heightAt(x, z));
    // Manchas suaves de color para que el suelo no sea un tono plano.
    const patch = 0.5 + 0.5 * Math.sin(x * 0.0041 + 0.8) * Math.cos(z * 0.0035 - 1.1);
    const grain = 0.5 + 0.5 * Math.sin(x * 0.07 + z * 0.05);
    tint.lerpColors(dark, mid, patch).lerp(light, grain * 0.18);
    colors[i * 3] = tint.r;
    colors[i * 3 + 1] = tint.g;
    colors[i * 3 + 2] = tint.b;
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const groundMaterial = new MeshLambertMaterial({ vertexColors: true });
  scene.add(new Mesh(geometry, groundMaterial));

  // ---------- Rocas (decorativas) ----------
  const rockGeometry = new IcosahedronGeometry(1, 0);
  const rockMaterial = new MeshLambertMaterial({ color: palette.rock, flatShading: true });
  const rocks = new InstancedMesh(rockGeometry, rockMaterial, ROCKS);
  const rand = seeded(20261114);
  const matrix = new Matrix4();
  const rockPos = new Vector3();
  const rockRot = new Quaternion();
  const rockScale = new Vector3();
  const axis = new Vector3();
  for (let i = 0; i < ROCKS; i++) {
    const r = 12 + Math.pow(rand(), 1.6) * 650;
    const a = rand() * Math.PI * 2;
    const size = 0.15 + Math.pow(rand(), 2.2) * 1.3;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    rockPos.set(x, field.heightAt(x, z) + size * 0.25, z);
    rockRot.setFromAxisAngle(axis.set(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize(), rand() * Math.PI * 2);
    rockScale.set(size * (0.7 + rand() * 0.6), size * (0.5 + rand() * 0.4), size * (0.7 + rand() * 0.6));
    rocks.setMatrixAt(i, matrix.compose(rockPos, rockRot, rockScale));
  }
  rocks.instanceMatrix.needsUpdate = true;
  scene.add(rocks);

  // ---------- Marca del sitio de aterrizaje (se ve desde arriba y sirve de referencia al caminar) ----------
  const markGeometry = new RingGeometry(70, 80, 64);
  markGeometry.rotateX(-Math.PI / 2);
  const markPosition = markGeometry.attributes.position;
  for (let i = 0; i < markPosition.count; i++) {
    markPosition.setY(i, field.heightAt(markPosition.getX(i), markPosition.getZ(i)) + 0.15);
  }
  const markMaterial = new MeshBasicMaterial({ color: palette.sun });
  scene.add(new Mesh(markGeometry, markMaterial));

  // ---------- Luz, cielo y sol ----------
  const sunLight = new DirectionalLight(palette.sun, 2.4);
  scene.add(sunLight);
  const hemi = new HemisphereLight(palette.sky, palette.groundDark, 1);
  scene.add(hemi);
  const sunGeometry = new SphereGeometry(140, 20, 14);
  const sunMaterial = new MeshBasicMaterial({ color: palette.sun, fog: false });
  const sunDisc = new Mesh(sunGeometry, sunMaterial);
  scene.add(sunDisc);
  const sunDir = new Vector3(0, 1, 0);

  const skyClear = new Color(palette.sky);
  const skyDusty = new Color(palette.dust);
  const skyNight = new Color(palette.night);
  const skyNow = new Color();
  const nightLight = new Color(palette.sun);
  const markColor = new Color(palette.sun);

  /** Cielo, luz y niebla según la hora solar local y la opacidad del polvo (τ). */
  function setEnvironment({ hour, tau }) {
    const sun = sunState(hour);
    const dustiness = Math.min(1, Math.max(0, tau / 1.5));
    sunDir.set(sun.dir[0], sun.dir[1], sun.dir[2]);
    skyNow.lerpColors(skyClear, skyDusty, dustiness);
    skyNow.lerpColors(skyNight, skyNow.clone(), sun.daylight);
    scene.background.copy(skyNow);
    fog.color.copy(skyNow);
    fog.density = dustFogDensity(tau);
    sunLight.position.copy(sunDir).multiplyScalar(1000);
    sunLight.intensity = 2.6 * sun.daylight * (1 - 0.5 * dustiness);
    // De noche queda una luz tenue y neutra para que el terreno se siga distinguiendo.
    hemi.color.lerpColors(nightLight, skyNow, sun.daylight);
    hemi.intensity = 0.4 + 0.9 * sun.daylight;
    markMaterial.color.copy(markColor).multiplyScalar(0.3 + 0.7 * sun.daylight);
    sunDisc.visible = sun.dir[1] > -0.03;
  }

  // ---------- Cámara ----------
  const view = { x: 0, z: 0, yaw: 0, pitch: LOOK_DOWN, mode: 'above', progress: 0 };

  /** Empieza a bajar; con `instant` (movimiento reducido) aparece ya en el suelo. */
  function startDescent(instant = false) {
    if (view.mode !== 'above') return;
    view.mode = instant ? 'ground' : 'descending';
    view.progress = instant ? 1 : 0;
    if (instant) view.pitch = 0;
  }

  /**
   * @param {number} dt  segundos desde el cuadro anterior
   * @param {{ forward: number, strafe: number, turn: number, run: boolean, lookX: number, lookY: number }} input
   */
  function update(dt, input) {
    let altitude = EYE_M;
    if (view.mode === 'above') {
      altitude = START_ALTITUDE_M;
    } else if (view.mode === 'descending') {
      view.progress = Math.min(1, view.progress + dt / DESCENT_SECONDS);
      const t = easeInOut(view.progress);
      altitude = START_ALTITUDE_M + (EYE_M - START_ALTITUDE_M) * t;
      view.pitch = LOOK_DOWN * (1 - t * t);
      if (view.progress >= 1) {
        view.mode = 'ground';
        view.pitch = 0;
      }
    } else {
      view.yaw -= input.turn * TURN_RPS * dt + input.lookX * LOOK_SENSITIVITY;
      view.pitch = Math.min(1.2, Math.max(-1.2, view.pitch - input.lookY * LOOK_SENSITIVITY));
      const speed = WALK_MPS * (input.run ? RUN_FACTOR : 1) * dt;
      const sin = Math.sin(view.yaw);
      const cos = Math.cos(view.yaw);
      // Con yaw = 0 se mira al norte (−z); "forward" avanza hacia donde se mira.
      view.x = field.clampToArea(view.x + (-sin * input.forward + cos * input.strafe) * speed);
      view.z = field.clampToArea(view.z + (-cos * input.forward - sin * input.strafe) * speed);
    }
    camera.position.set(view.x, field.heightAt(view.x, view.z) + altitude, view.z);
    camera.rotation.set(view.pitch, view.yaw, 0);
    sunDisc.position.copy(camera.position).addScaledVector(sunDir, 9000);
  }

  function resize(width, height) {
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  return {
    setEnvironment,
    startDescent,
    update,
    resize,
    render: () => renderer.render(scene, camera),
    /** Dónde está la persona y en qué fase de la bajada. */
    state: () => ({ x: view.x, z: view.z, mode: view.mode, headingDeg: (((-view.yaw * 180) / Math.PI) % 360 + 360) % 360 }),
    /** Libera la memoria de la escena y el contexto WebGL. */
    dispose() {
      geometry.dispose();
      groundMaterial.dispose();
      rockGeometry.dispose();
      rockMaterial.dispose();
      rocks.dispose();
      markGeometry.dispose();
      markMaterial.dispose();
      sunGeometry.dispose();
      sunMaterial.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
