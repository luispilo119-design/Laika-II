/**
 * Escena Three.js de la primera persona: terreno, rocas, cielo, sol y cámara. Parte B — B5.
 * Se carga bajo demanda (import dinámico desde index.js) para que Three.js no pese en el
 * arranque de la app.
 *
 * Qué viene de datos y qué es decorativo:
 *  - La forma del terreno sale de la rejilla de `env.elevationGrid`.
 *  - El relieve fino, los cráteres pequeños, las rocas, los vehículos y los colores son decorativos
 *    (ver terrain.js y la nota en pantalla).
 */
import {
  BufferAttribute,
  Color,
  DirectionalLight,
  FogExp2,
  Group,
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
import { ROVER, makeVehicle, stepVehicle } from './vehicles.js';
import { createKit, buildLander, buildPressurizedRover, buildHabitat, buildSolarField } from './models.js';

export { ROVER };

const DESCENT_SECONDS = 7;
const WALK_MPS = 5; // más rápido que una caminata real, para poder recorrer el terreno
const RUN_FACTOR = 3;
const TURN_RPS = 1.4; // giro con el teclado, radianes por segundo
const LOOK_SENSITIVITY = 0.0042; // radianes por píxel arrastrado
const LOOK_DOWN = -Math.PI / 2 + 0.02;
const ROCKS = 320;
const BOULDERS = 46;
const CRATERS = 16;
const TERRAIN_SEGMENTS = 255;
const PERSON_RADIUS = 0.45;
const SLOPE_SLOW = 0.55; // en una pendiente fuerte se camina a ~45 % de la velocidad
const BOB_M = 0.045;

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
 * @param {number} [opts.seed]  semilla de los cráteres decorativos (cambia con el lugar)
 * @param {{ groundDark: string, groundMid: string, groundLight: string, rock: string, sky: string, dust: string, night: string, sun: string }} opts.palette
 *   colores CSS (#rrggbb)
 */
export function createScene({ canvas, field, palette, seed = 1114 }) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

  const scene = new Scene();
  const fog = new FogExp2(palette.sky, dustFogDensity(0.5));
  scene.fog = fog;
  scene.background = new Color(palette.sky);

  const camera = new PerspectiveCamera(70, 1, 0.3, 16000);
  camera.rotation.order = 'YXZ';

  const disposables = [];
  const keep = (x) => {
    disposables.push(x);
    return x;
  };

  // ---------- Cráteres pequeños (decorativos) ----------
  // La rejilla de elevación tiene ~15 km por celda: los cráteres de decenas o cientos de metros no
  // salen en los datos. Se agregan aquí para que el paisaje se lea como Marte; no son reales.
  const craterRand = seeded(seed);
  const craters = [];
  while (craters.length < CRATERS) {
    const r = 30 + Math.pow(craterRand(), 1.8) * 360;
    const a = craterRand() * Math.PI * 2;
    const d = 220 + craterRand() * (AREA_M / 2 - 400);
    const cx = Math.cos(a) * d;
    const cz = Math.sin(a) * d;
    if (craters.some((c) => Math.hypot(c.x - cx, c.z - cz) < (c.r + r) * 0.9)) continue;
    craters.push({ x: cx, z: cz, r, depth: r * (0.12 + craterRand() * 0.08), rim: r * 0.045 });
  }
  function craterRelief(x, z) {
    let h = 0;
    for (const c of craters) {
      const d = Math.hypot(x - c.x, z - c.z) / c.r;
      if (d > 1.8) continue;
      if (d < 1) h -= c.depth * (1 - d * d);
      h += c.rim * Math.exp(-(((d - 1) / 0.22) ** 2));
    }
    return h;
  }
  const heightAt = (x, z) => field.heightAt(x, z) + craterRelief(x, z);
  const obstacles = []; // { x, z, r }: rocas grandes y vehículos que no se atraviesan

  // ---------- Terreno ----------
  const segments = TERRAIN_SEGMENTS;
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
    position.setY(i, heightAt(x, z));
    // Manchas suaves de color para que el suelo no sea un tono plano.
    const patch = 0.5 + 0.5 * Math.sin(x * 0.0041 + 0.8) * Math.cos(z * 0.0035 - 1.1);
    const grain = 0.5 + 0.5 * Math.sin(x * 0.07 + z * 0.05);
    tint.lerpColors(dark, mid, patch).lerp(light, grain * 0.18);
    // El fondo de los cráteres un poco más oscuro y sus bordes más claros.
    const relief = craterRelief(x, z);
    if (relief < 0) tint.lerp(dark, Math.min(0.6, -relief / 30));
    else tint.lerp(light, Math.min(0.35, relief / 8));
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
    rockPos.set(x, heightAt(x, z) + size * 0.25, z);
    if (size > 0.55) obstacles.push({ x, z, r: size * 0.8 });
    rockRot.setFromAxisAngle(axis.set(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize(), rand() * Math.PI * 2);
    rockScale.set(size * (0.7 + rand() * 0.6), size * (0.5 + rand() * 0.4), size * (0.7 + rand() * 0.6));
    rocks.setMatrixAt(i, matrix.compose(rockPos, rockRot, rockScale));
  }
  rocks.instanceMatrix.needsUpdate = true;
  scene.add(rocks);

  const boulders = new InstancedMesh(rockGeometry, rockMaterial, BOULDERS);
  for (let i = 0; i < BOULDERS; i++) {
    const c = craters[i % craters.length];
    const a = rand() * Math.PI * 2;
    const rr = c.r * (1 + (rand() - 0.3) * 0.25);
    const x = c.x + Math.cos(a) * rr;
    const z = c.z + Math.sin(a) * rr;
    const size = 1.2 + rand() * 2.6;
    rockPos.set(x, heightAt(x, z) + size * 0.2, z);
    rockRot.setFromAxisAngle(axis.set(rand() - 0.5, rand(), rand() - 0.5).normalize(), rand() * Math.PI * 2);
    rockScale.set(size, size * (0.55 + rand() * 0.3), size * (0.8 + rand() * 0.4));
    boulders.setMatrixAt(i, matrix.compose(rockPos, rockRot, rockScale));
    obstacles.push({ x, z, r: size * 0.95 });
  }
  boulders.instanceMatrix.needsUpdate = true;
  scene.add(boulders);

  // ---------- Equipo de la misión junto al sitio (modelos simples, no a escala exacta) ----------
  const kit = createKit(keep);
  const place = (obj, x, z, yaw = 0, footprint = 0) => {
    obj.position.set(x, heightAt(x, z), z);
    obj.rotation.y = yaw;
    scene.add(obj);
    if (footprint) obstacles.push({ x, z, r: footprint });
    return obj;
  };

  place(buildLander(kit), -22, -38, 0.4, 5);
  const rover = place(buildPressurizedRover(kit), 10, -26, -0.9, ROVER.radius);
  const roverObstacle = obstacles[obstacles.length - 1];
  rover.rotation.order = 'YXZ';
  place(buildHabitat(kit), 48, -95, 2.6, 9);
  place(buildSolarField(kit), -95, -88, 0.2, 0);
  for (let row = 0; row < 3; row++) obstacles.push({ x: -95 + 6.6, z: -88 + row * 4, r: 8 });

  // ---------- Marca del sitio de aterrizaje (se ve desde arriba y sirve de referencia al caminar) ----------
  const markGeometry = new RingGeometry(70, 80, 64);
  markGeometry.rotateX(-Math.PI / 2);
  const markPosition = markGeometry.attributes.position;
  for (let i = 0; i < markPosition.count; i++) {
    markPosition.setY(i, heightAt(markPosition.getX(i), markPosition.getZ(i)) + 0.15);
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
    daylight = sun.daylight * (1 - 0.5 * dustiness);
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
  const view = { x: 0, z: 0, yaw: 0, pitch: LOOK_DOWN, mode: 'above', progress: 0, bob: 0 };
  const vehicle = makeVehicle(10, -26, -0.9);
  const track = [[0, 0]]; // recorrido (x, z) para el mini mapa
  let daylight = 1;

  function pushTrack(x, z) {
    const lastPt = track[track.length - 1];
    if (Math.hypot(x - lastPt[0], z - lastPt[1]) > 8) {
      track.push([x, z]);
      if (track.length > 1500) track.splice(1, 1);
    }
  }

  /** Mueve el rover un paso (física en vehicles.js) y coloca su modelo. */
  function drive(dt, input) {
    stepVehicle(vehicle, ROVER, dt, input, { heightAt, clampToArea: field.clampToArea, obstacles, self: roverObstacle, daylight });
    rover.position.set(vehicle.x, vehicle.y, vehicle.z);
    rover.rotation.set(-vehicle.roll, vehicle.heading, vehicle.pitch);
    pushTrack(vehicle.x, vehicle.z);
  }

  function canBoard() {
    return view.mode === 'ground' && Math.hypot(view.x - vehicle.x, view.z - vehicle.z) < ROVER.boardDistance;
  }

  function board() {
    if (!canBoard()) return false;
    view.mode = 'driving';
    vehicle.chaseYaw = 0;
    return true;
  }

  function exitVehicle() {
    if (view.mode !== 'driving') return;
    vehicle.speed = 0;
    // Bajarse por el lado izquierdo del rover, mirando hacia donde apuntaba.
    view.x = field.clampToArea(vehicle.x - Math.sin(vehicle.heading) * 3.6);
    view.z = field.clampToArea(vehicle.z - Math.cos(vehicle.heading) * 3.6);
    view.yaw = vehicle.heading - Math.PI / 2;
    view.pitch = 0;
    view.mode = 'ground';
  }

  function repair() {
    vehicle.damage = 0;
    vehicle.warn = null;
  }

  /** Saca a la persona de las rocas y vehículos con los que choca. */
  function resolveCollisions() {
    for (const o of obstacles) {
      const dx = view.x - o.x;
      const dz = view.z - o.z;
      const min = o.r + PERSON_RADIUS;
      const d2 = dx * dx + dz * dz;
      if (d2 >= min * min || d2 === 0) continue;
      const d = Math.sqrt(d2);
      view.x = o.x + (dx / d) * min;
      view.z = o.z + (dz / d) * min;
    }
  }

  /** Vuelve a la vista desde arriba (para volver a ver el sitio completo). */
  function ascend() {
    view.mode = 'above';
    view.progress = 0;
    view.pitch = LOOK_DOWN;
  }

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
    } else if (view.mode === 'driving') {
      drive(dt, input);
      vehicle.chaseYaw = (vehicle.chaseYaw - input.lookX * LOOK_SENSITIVITY) * (input.lookX ? 1 : 1 - Math.min(1, dt * 0.8));
      const back = vehicle.heading + Math.PI + vehicle.chaseYaw;
      const cx = vehicle.x + Math.cos(back) * 13;
      const cz = vehicle.z - Math.sin(back) * 13;
      const groundCam = heightAt(cx, cz);
      camera.position.set(cx, Math.max(groundCam + 2, rover.position.y + 5.5), cz);
      camera.lookAt(vehicle.x + Math.cos(vehicle.heading) * 6, rover.position.y + 1.6, vehicle.z - Math.sin(vehicle.heading) * 6);
      sunDisc.position.copy(camera.position).addScaledVector(sunDir, 9000);
      return;
    } else {
      view.yaw -= input.turn * TURN_RPS * dt + input.lookX * LOOK_SENSITIVITY;
      view.pitch = Math.min(1.2, Math.max(-1.2, view.pitch - input.lookY * LOOK_SENSITIVITY));
      const sin = Math.sin(view.yaw);
      const cos = Math.cos(view.yaw);
      // Con yaw = 0 se mira al norte (−z); "forward" avanza hacia donde se mira.
      const dirX = -sin * input.forward + cos * input.strafe;
      const dirZ = -cos * input.forward - sin * input.strafe;
      // La pendiente en la dirección de avance frena (de subida y de bajada).
      const len = Math.hypot(dirX, dirZ) || 1;
      const ahead = heightAt(view.x + (dirX / len) * 2, view.z + (dirZ / len) * 2) - heightAt(view.x, view.z);
      const grade = Math.min(1, Math.abs(ahead) / 2 / 0.6);
      const speed = WALK_MPS * (input.run ? RUN_FACTOR : 1) * (1 - SLOPE_SLOW * grade) * dt;
      view.x = field.clampToArea(view.x + dirX * speed);
      view.z = field.clampToArea(view.z + dirZ * speed);
      resolveCollisions();
      pushTrack(view.x, view.z);
      const moving = Math.abs(input.forward) + Math.abs(input.strafe) > 0;
      view.bob = moving ? view.bob + dt * (input.run ? 14 : 8) : view.bob * 0.9;
      altitude += moving ? Math.sin(view.bob) * BOB_M : 0;
    }
    camera.position.set(view.x, heightAt(view.x, view.z) + altitude, view.z);
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
    ascend,
    board,
    exitVehicle,
    repair,
    canBoard,
    /** Datos para el mini mapa: cráteres, equipo y recorrido, en metros locales. */
    mapData: () => ({ craters, track, vehicle: { x: vehicle.x, z: vehicle.z, heading: vehicle.heading } }),
    update,
    resize,
    render: () => renderer.render(scene, camera),
    /** Dónde está la persona y en qué fase de la bajada. */
    state: () => {
      const driving = view.mode === 'driving';
      const yaw = driving ? vehicle.heading - Math.PI / 2 : view.yaw;
      return {
        x: driving ? vehicle.x : view.x,
        z: driving ? vehicle.z : view.z,
        mode: view.mode,
        headingDeg: (((-yaw * 180) / Math.PI) % 360 + 360) % 360,
        canBoard: canBoard(),
        vehicle: { ...vehicle },
      };
    },
    /** Libera la memoria de la escena y el contexto WebGL. */
    dispose() {
      geometry.dispose();
      groundMaterial.dispose();
      rockGeometry.dispose();
      rockMaterial.dispose();
      rocks.dispose();
      boulders.dispose();
      for (const d of disposables) d.dispose();
      markGeometry.dispose();
      markMaterial.dispose();
      sunGeometry.dispose();
      sunMaterial.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
