/**
 * Escena Three.js de «En sitio»: terreno, foto orbital, rocas, cielo, sol y cámaras (vista aérea,
 * bajada, a pie y manejando). Parte B — B5. Se carga bajo demanda (import dinámico desde index.js)
 * para que Three.js no pese en el arranque de la app.
 *
 * Qué viene de datos y qué es decorativo:
 *  - La forma del terreno sale de la rejilla de `env.elevationGrid` (MOLA, ~15 km por celda).
 *  - La imagen del suelo es una foto real desde órbita (tiles.js); en blanco y negro, teñida.
 *  - El relieve fino, las rocas, los vehículos, el equipo y los colores son decorativos.
 */
import {
  BufferAttribute,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
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
  Points,
  PointsMaterial,
  BufferGeometry,
  Float32BufferAttribute,
  Quaternion,
  RingGeometry,
  SRGBColorSpace,
  Scene,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';
import {
  AREA_M,
  EYE_M,
  MESH_SEGMENTS,
  makeTerrainGrid,
  gridHeightAt,
  rayGround,
  sunState,
  dustFogDensity,
  easeInOut,
  toLatLon,
} from './terrain.js';
import { uvOf } from './tiles.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { ROVER, VEHICLES, WALK, makeVehicle, stepVehicle, effectiveSpec, subSteps } from './vehicles.js';
import { createKit, buildLander, buildPressurizedRover, buildRoboticRover, buildHabitat, buildSolarField } from './models.js';

export { ROVER };

const TURN_RPS = 1.4; // giro con el teclado, radianes por segundo
const LOOK_SENSITIVITY = 0.0042; // radianes por píxel arrastrado
const ROCKS = 320;
const BOULDERS = 60;
const PERSON_RADIUS = 0.45;
const SLOPE_SLOW = 0.55; // en una pendiente fuerte se camina a ~45 % de la velocidad
const BOB_M = 0.045;
const FOV = 70;

/** Límites de la vista aérea: distancia a la que se mira (m) e inclinación (rad sobre el horizonte). */
export const AERIAL = { minDist: 120, maxDist: 24000, minTilt: 0.2, maxTilt: 1.52, startDist: 6500, startTilt: 0.8 };

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

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
 * @param {{ lat: number, lon: number }} opts.site  centro del terreno
 * @param {boolean} [opts.equipment]  poner el equipo de la misión (solo en el sitio de aterrizaje)
 * @param {number} [opts.seed]
 * @param {{ groundDark: string, groundMid: string, groundLight: string, rock: string, sky: string, dust: string, night: string, sun: string }} opts.palette
 */
export function createScene({ canvas, field, palette, site, equipment = true, seed = 1114 }) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  let viewHeight = 1;

  const scene = new Scene();
  const fog = new FogExp2(palette.sky, dustFogDensity(0.5));
  scene.fog = fog;
  scene.background = new Color(palette.sky);
  let tau = 0.5;

  const camera = new PerspectiveCamera(FOV, 1, 0.3, 24000);
  camera.rotation.order = 'YXZ';

  const disposables = [];
  const keep = (x) => {
    disposables.push(x);
    return x;
  };

  // ---------- Terreno ----------
  // La persona y los vehículos pisan la misma malla que se dibuja (gridHeightAt).
  const grid = makeTerrainGrid(field.heightAt, MESH_SEGMENTS, field.areaM);
  const heightAt = (x, z) => gridHeightAt(grid, x, z);
  const obstacles = []; // { x, z, r }: rocas grandes y vehículos que no se atraviesan

  const geometry = keep(new PlaneGeometry(AREA_M, AREA_M, grid.n, grid.n));
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
    position.setY(i, grid.heights[i]);
    // Manchas suaves de color para que el suelo no sea un tono plano mientras llega la foto.
    const patch = 0.5 + 0.5 * Math.sin(x * 0.0041 + 0.8) * Math.cos(z * 0.0035 - 1.1);
    const grain = 0.5 + 0.5 * Math.sin(x * 0.07 + z * 0.05);
    tint.lerpColors(dark, mid, patch).lerp(light, grain * 0.18);
    colors[i * 3] = tint.r;
    colors[i * 3 + 1] = tint.g;
    colors[i * 3 + 2] = tint.b;
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  // polygonOffset: el parche nítido (misma superficie) se dibuja encima sin parpadeo.
  const groundMaterial = keep(new MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 4 }));
  const ground = new Mesh(geometry, groundMaterial);
  scene.add(ground);
  let groundTexture = null;

  /**
   * Pone la foto orbital sobre el terreno. `cover` es el recuadro (lat/lon) que cubre el canvas.
   * Las fotos CTX e HiRISE son en blanco y negro: se tiñen con el color del suelo (decorativo).
   */
  function setImagery(imageCanvas, cover) {
    const uv = geometry.attributes.uv;
    for (let i = 0; i < position.count; i++) {
      const { lat, lon } = toLatLon(site, position.getX(i), position.getZ(i));
      const [u, v] = uvOf(cover, lat, lon);
      uv.setXY(i, u, v);
    }
    uv.needsUpdate = true;
    groundTexture?.dispose();
    groundTexture = new CanvasTexture(imageCanvas);
    groundTexture.colorSpace = SRGBColorSpace;
    groundTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    groundMaterial.map = groundTexture;
    groundMaterial.vertexColors = false;
    groundMaterial.color.set(palette.groundTint ?? '#f0b58e');
    groundMaterial.needsUpdate = true;
  }

  // ---------- Parche nítido alrededor de la persona ----------
  // Usa los mismos vértices que el terreno (misma superficie y mismas normales), con una foto más
  // detallada de ese cuadro.
  let detail = null;
  function clearDetail() {
    if (!detail) return;
    scene.remove(detail.mesh);
    detail.mesh.geometry.dispose();
    detail.mesh.material.map?.dispose();
    detail.mesh.material.dispose();
    detail = null;
  }

  /** @param {{ x0: number, z0: number, x1: number, z1: number }} rect  metros locales */
  function setDetailImagery(imageCanvas, cover, rect) {
    clearDetail();
    const n = grid.n;
    const toIndex = (v) => Math.max(0, Math.min(n, Math.round((v + AREA_M / 2) / grid.step)));
    const ix0 = toIndex(rect.x0);
    const ix1 = toIndex(rect.x1);
    const iy0 = toIndex(rect.z0);
    const iy1 = toIndex(rect.z1);
    const cols = ix1 - ix0 + 1;
    const rows = iy1 - iy0 + 1;
    if (cols < 2 || rows < 2) return;
    const pos = new Float32Array(cols * rows * 3);
    const nor = new Float32Array(cols * rows * 3);
    const uvs = new Float32Array(cols * rows * 2);
    const groundNormals = geometry.attributes.normal;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const gi = (iy0 + r) * (n + 1) + (ix0 + c);
        const k = r * cols + c;
        const x = position.getX(gi);
        const z = position.getZ(gi);
        pos.set([x, position.getY(gi), z], k * 3);
        nor.set([groundNormals.getX(gi), groundNormals.getY(gi), groundNormals.getZ(gi)], k * 3);
        const { lat, lon } = toLatLon(site, x, z);
        uvs.set(uvOf(cover, lat, lon), k * 2);
      }
    }
    const index = [];
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const a = r * cols + c; // noroeste
        const b = (r + 1) * cols + c; // suroeste
        const cc = (r + 1) * cols + c + 1; // sureste
        const d = r * cols + c + 1; // noreste
        index.push(a, b, d, b, cc, d); // los mismos triángulos que PlaneGeometry
      }
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new Float32BufferAttribute(nor, 3));
    geo.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
    geo.setIndex(index);
    const texture = new CanvasTexture(imageCanvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const material = new MeshLambertMaterial({ map: texture, color: palette.groundTint ?? '#f0b58e' });
    const mesh = new Mesh(geo, material);
    scene.add(mesh);
    detail = { mesh };
  }

  // ---------- Rocas (decorativas, cerca del centro) ----------
  const rockGeometry = keep(new IcosahedronGeometry(1, 0));
  const rockMaterial = keep(new MeshLambertMaterial({ color: palette.rock, flatShading: true }));
  const rocks = keep(new InstancedMesh(rockGeometry, rockMaterial, ROCKS));
  const rand = seeded(seed);
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

  const boulders = keep(new InstancedMesh(rockGeometry, rockMaterial, BOULDERS));
  for (let i = 0; i < BOULDERS; i++) {
    const r = 120 + rand() * 1400;
    const a = rand() * Math.PI * 2;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const size = 1.2 + rand() * 2.6;
    rockPos.set(x, heightAt(x, z) + size * 0.2, z);
    rockRot.setFromAxisAngle(axis.set(rand() - 0.5, rand(), rand() - 0.5).normalize(), rand() * Math.PI * 2);
    rockScale.set(size, size * (0.55 + rand() * 0.3), size * (0.8 + rand() * 0.4));
    boulders.setMatrixAt(i, matrix.compose(rockPos, rockRot, rockScale));
    obstacles.push({ x, z, r: size * 0.95 });
  }
  boulders.instanceMatrix.needsUpdate = true;
  scene.add(boulders);

  // ---------- Equipo de la misión (modelos simples, no a escala exacta) ----------
  const kit = createKit(keep);
  const place = (obj, x, z, yaw = 0, footprint = 0) => {
    obj.position.set(x, heightAt(x, z), z);
    obj.rotation.y = yaw;
    scene.add(obj);
    if (footprint) obstacles.push({ x, z, r: footprint });
    return obj;
  };

  // Vehículos: el rover presurizado y la réplica de rover robótico, estacionados cerca del centro.
  const fleet = [
    { id: 'pressurized', build: buildPressurizedRover, x: 10, z: -26, heading: -0.9 },
    { id: 'perseverance', build: buildRoboticRover, x: -14, z: -18, heading: 0.6 },
  ].map(({ id, build, x, z, heading }) => {
    const spec = VEHICLES[id];
    const model = place(build(kit), x, z, heading, spec.radius);
    model.rotation.order = 'YXZ';
    return { id, spec, model, obstacle: obstacles[obstacles.length - 1], v: makeVehicle(x, z, heading) };
  });
  let car = fleet[0]; // el vehículo que se maneja (o el último usado)
  if (equipment) {
    place(buildLander(kit), -22, -38, 0.4, 5);
    place(buildHabitat(kit), 48, -95, 2.6, 9);
    place(buildSolarField(kit), -95, -88, 0.2, 0);
    for (let row = 0; row < 3; row++) obstacles.push({ x: -95 + 6.6, z: -88 + row * 4, r: 8 });

    // Marca del sitio de aterrizaje (se ve desde arriba y sirve de referencia al caminar).
    const markGeometry = keep(new RingGeometry(70, 80, 64));
    markGeometry.rotateX(-Math.PI / 2);
    const markPosition = markGeometry.attributes.position;
    for (let i = 0; i < markPosition.count; i++) {
      markPosition.setY(i, heightAt(markPosition.getX(i), markPosition.getZ(i)) + 0.15);
    }
    scene.add(new Mesh(markGeometry, keep(new MeshBasicMaterial({ color: palette.sun }))));
  }

  // ---------- Marcador del punto elegido en la vista aérea ----------
  const pin = new Group();
  const pinMaterial = keep(new MeshBasicMaterial({ color: '#eab422', fog: false, depthTest: false, transparent: true, opacity: 0.95 }));
  const pinStem = new Mesh(keep(new CylinderGeometry(1.2, 1.2, 90, 8)), pinMaterial);
  pinStem.position.y = 69;
  const pinHead = new Mesh(keep(new ConeGeometry(9, 24, 16)), pinMaterial);
  pinHead.rotation.x = Math.PI;
  pinHead.position.y = 12;
  pin.add(pinStem, pinHead);
  pin.renderOrder = 10;
  pin.visible = false;
  scene.add(pin);

  // ---------- Rutas reales de los rovers: línea y paradas (se ven desde lejos, en píxeles) ----------
  const routeGroup = new Group();
  scene.add(routeGroup);
  const lineMaterials = [];
  let routeItems = [];

  function clearRoutes() {
    for (const item of routeItems) {
      item.geometry.dispose();
      item.material.dispose();
      routeGroup.remove(item);
    }
    routeItems = [];
    lineMaterials.length = 0;
  }

  /**
   * Dibuja recorridos sobre el terreno.
   * @param {{ paths: [number, number][][], stops: [number, number][], color: string }[]} routes  en metros locales
   */
  function setRoutes(routes) {
    clearRoutes();
    for (const route of routes) {
      for (const path of route.paths) {
        if (path.length < 2) continue;
        const positions = [];
        for (const [x, z] of path) positions.push(x, heightAt(x, z) + 0.4, z); // a ras del suelo: a pie no tapa la vista
        const geometryLine = new LineGeometry();
        geometryLine.setPositions(positions);
        const material = new LineMaterial({ color: route.color, linewidth: 3, worldUnits: false, depthTest: true, fog: false });
        material.resolution.set(renderer.domElement.width, renderer.domElement.height);
        lineMaterials.push(material);
        const line = new Line2(geometryLine, material);
        line.computeLineDistances();
        line.renderOrder = 5;
        routeGroup.add(line);
        routeItems.push(line);
      }
      if (route.stops?.length) {
        const pts = new Float32Array(route.stops.length * 3);
        route.stops.forEach(([x, z], i) => {
          pts[i * 3] = x;
          pts[i * 3 + 1] = heightAt(x, z) + 0.6;
          pts[i * 3 + 2] = z;
        });
        const geometryPts = new BufferGeometry();
        geometryPts.setAttribute('position', new Float32BufferAttribute(pts, 3));
        const dots = new Points(geometryPts, new PointsMaterial({ color: '#161412', size: 5, sizeAttenuation: false, fog: false }));
        dots.renderOrder = 6;
        routeGroup.add(dots);
        routeItems.push(dots);
      }
    }
  }

  // ---------- Luz, cielo y sol ----------
  const sunLight = new DirectionalLight(palette.sun, 2.4);
  scene.add(sunLight);
  const hemi = new HemisphereLight(palette.sky, palette.groundDark, 1);
  scene.add(hemi);
  const sunMaterial = keep(new MeshBasicMaterial({ color: palette.sun, fog: false }));
  const sunDisc = new Mesh(keep(new SphereGeometry(140, 20, 14)), sunMaterial);
  scene.add(sunDisc);
  const sunDir = new Vector3(0, 1, 0);

  const skyClear = new Color(palette.sky);
  const skyDusty = new Color(palette.dust);
  const skyNight = new Color(palette.night);
  const skyNow = new Color();
  const nightLight = new Color(palette.sun);

  /** Cielo, luz y niebla según la hora solar local y la opacidad del polvo (τ). */
  function setEnvironment({ hour, tau: newTau }) {
    tau = newTau;
    const sun = sunState(hour);
    const dustiness = Math.min(1, Math.max(0, tau / 1.5));
    sunDir.set(sun.dir[0], sun.dir[1], sun.dir[2]);
    daylight = sun.daylight * (1 - 0.5 * dustiness);
    skyNow.lerpColors(skyClear, skyDusty, dustiness);
    skyNow.lerpColors(skyNight, skyNow.clone(), sun.daylight);
    scene.background.copy(skyNow);
    fog.color.copy(skyNow);
    sunLight.position.copy(sunDir).multiplyScalar(1000);
    sunLight.intensity = 2.6 * sun.daylight * (1 - 0.5 * dustiness);
    // De noche queda una luz tenue y neutra para que el terreno se siga distinguiendo.
    hemi.color.lerpColors(nightLight, skyNow, sun.daylight);
    hemi.intensity = 0.4 + 0.9 * sun.daylight;
    sunDisc.visible = sun.dir[1] > -0.03;
  }

  // ---------- Cámaras ----------
  const view = {
    mode: 'aerial', // 'aerial' | 'descending' | 'ground' | 'driving'
    x: 0,
    z: 0,
    yaw: 0,
    pitch: 0,
    bob: 0,
    aerial: { tx: 0, tz: 0, dist: AERIAL.startDist, tilt: AERIAL.startTilt, yaw: 0, goal: null },
    descent: null,
  };
  let realSpeed = false; // modo de velocidad: real (fuentes de la NASA) o de exploración (juego)
  let warp = 1; // aceleración del tiempo en modo real
  const track = [[0, 0]]; // recorrido (x, z) para el mini mapa
  let daylight = 1;

  function pushTrack(x, z) {
    const lastPt = track[track.length - 1];
    if (Math.hypot(x - lastPt[0], z - lastPt[1]) > 8) {
      track.push([x, z]);
      if (track.length > 1500) track.splice(1, 1);
    }
  }

  function placeModel(entry) {
    const v = entry.v;
    if (!v.y) v.y = heightAt(v.x, v.z);
    entry.model.position.set(v.x, v.y, v.z);
    entry.model.rotation.set(-v.roll, v.heading, v.pitch);
    entry.obstacle.x = v.x;
    entry.obstacle.z = v.z;
  }

  /** Mueve el vehículo `simDt` segundos (en pasos cortos) y coloca su modelo. */
  function drive(simDt, input) {
    const spec = effectiveSpec(car.spec, realSpeed);
    const world = { heightAt, clampToArea: field.clampToArea, obstacles, self: car.obstacle, daylight };
    const { steps, dt } = subSteps(simDt);
    for (let i = 0; i < steps; i++) stepVehicle(car.v, spec, dt, input, world);
    placeModel(car);
    pushTrack(car.v.x, car.v.z);
  }

  /** El vehículo estacionado más cercano a la persona, si está a distancia de subirse. */
  function nearbyVehicle() {
    let best = null;
    let bestD = Infinity;
    for (const entry of fleet) {
      const d = Math.hypot(view.x - entry.v.x, view.z - entry.v.z);
      if (d < entry.spec.boardDistance && d < bestD) {
        best = entry;
        bestD = d;
      }
    }
    return best;
  }

  function canBoard() {
    return view.mode === 'ground' && Boolean(nearbyVehicle());
  }

  function board() {
    if (!canBoard()) return false;
    car = nearbyVehicle();
    view.mode = 'driving';
    car.v.chaseYaw = 0;
    return true;
  }

  function exitVehicle() {
    if (view.mode !== 'driving') return;
    const v = car.v;
    v.speed = 0;
    // Bajarse por el lado izquierdo, mirando hacia donde apuntaba el vehículo.
    const side = car.spec.width / 2 + 2.2;
    view.x = field.clampToArea(v.x - Math.sin(v.heading) * side);
    view.z = field.clampToArea(v.z - Math.cos(v.heading) * side);
    view.yaw = v.heading - Math.PI / 2;
    view.pitch = 0;
    view.mode = 'ground';
  }

  function repair() {
    car.v.damage = 0;
    car.v.warn = null;
  }

  /**
   * Cambia de vehículo: 'walk' para ir a pie, o el id de un vehículo, que se trae junto a la
   * persona (o al punto que mira la vista aérea) y se maneja de inmediato.
   */
  function useVehicle(id) {
    if (id === 'walk') {
      exitVehicle();
      return;
    }
    const entry = fleet.find((f) => f.id === id);
    if (!entry) return;
    let x;
    let z;
    let heading;
    if (view.mode === 'driving') {
      if (entry === car) return;
      ({ x, z, heading } = car.v);
      car.v.speed = 0;
      // El vehículo anterior queda estacionado a un lado.
      car.v.x = field.clampToArea(x - Math.sin(heading) * (car.spec.width + entry.spec.width));
      car.v.z = field.clampToArea(z - Math.cos(heading) * (car.spec.width + entry.spec.width));
      car.v.y = 0;
      placeModel(car);
    } else if (view.mode === 'aerial' || view.mode === 'descending') {
      x = view.aerial.tx;
      z = view.aerial.tz;
      heading = view.aerial.yaw + Math.PI / 2;
    } else {
      x = view.x - Math.sin(view.yaw) * (entry.spec.length + 2);
      z = view.z - Math.cos(view.yaw) * (entry.spec.length + 2);
      heading = view.yaw + Math.PI / 2;
    }
    Object.assign(entry.v, { x: field.clampToArea(x), z: field.clampToArea(z), heading, speed: 0, y: 0, chaseYaw: 0 });
    placeModel(entry);
    car = entry;
    pin.visible = false;
    view.descent = null;
    view.mode = 'driving';
  }

  /** Modo de velocidad: real (con aceleración del tiempo) o de exploración. */
  function setSpeedMode(real, timeWarp = 1) {
    realSpeed = Boolean(real);
    warp = realSpeed ? Math.max(1, timeWarp) : 1;
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

  /** Sube a la vista aérea mirando el punto donde estaba la persona o el vehículo. */
  function ascend() {
    const driving = view.mode === 'driving';
    const a = view.aerial;
    a.tx = driving ? car.v.x : view.x;
    a.tz = driving ? car.v.z : view.z;
    a.yaw = driving ? car.v.heading - Math.PI / 2 : view.yaw;
    a.dist = 1800;
    a.tilt = 0.85;
    a.goal = null;
    view.mode = 'aerial';
  }

  /** Baja desde la vista aérea hasta (x, z); con `instant` (movimiento reducido) aparece ya abajo. */
  function descendTo(x, z, instant = false) {
    if (view.mode !== 'aerial') return;
    const tx = field.clampToArea(x);
    const tz = field.clampToArea(z);
    pin.visible = false;
    if (instant) {
      Object.assign(view, { mode: 'ground', x: tx, z: tz, yaw: view.aerial.yaw, pitch: 0 });
      return;
    }
    const from = camera.position.clone();
    const seconds = 2.5 + 3.5 * Math.min(1, from.distanceTo(new Vector3(tx, heightAt(tx, tz), tz)) / 9000);
    view.descent = { from, x: tx, z: tz, pitch0: camera.rotation.x, yaw: view.aerial.yaw, t: 0, seconds };
    view.mode = 'descending';
  }

  /** Baja al punto que se mira en la vista aérea. */
  function startDescent(instant = false) {
    descendTo(view.aerial.tx, view.aerial.tz, instant);
  }

  /** Mueve la vista aérea (con suavidad) para mirar (x, z) desde `dist` metros. */
  function flyTo(x, z, dist = null) {
    if (view.mode !== 'aerial') ascend();
    view.aerial.goal = { tx: field.clampToArea(x), tz: field.clampToArea(z), dist: dist ?? view.aerial.dist };
  }

  function updateAerial(dt, input) {
    const a = view.aerial;
    const fwdX = -Math.sin(a.yaw);
    const fwdZ = -Math.cos(a.yaw);
    const rightX = Math.cos(a.yaw);
    const rightZ = -Math.sin(a.yaw);
    const touched = input.lookX || input.lookY || input.forward || input.strafe || input.zoom !== 1;
    if (touched) a.goal = null;
    // Arrastrar mueve el suelo con el dedo: metros por píxel a la distancia que se mira.
    const mpp = (a.dist * 2 * Math.tan(((FOV / 2) * Math.PI) / 180)) / viewHeight;
    const along = mpp / Math.max(0.35, Math.sin(a.tilt)); // en profundidad el suelo se ve acortado
    a.tx += -rightX * input.lookX * mpp + fwdX * input.lookY * along;
    a.tz += -rightZ * input.lookX * mpp + fwdZ * input.lookY * along;
    const keyPan = a.dist * 0.7 * dt;
    a.tx += (fwdX * input.forward + rightX * input.strafe) * keyPan;
    a.tz += (fwdZ * input.forward + rightZ * input.strafe) * keyPan;
    a.yaw -= input.turn * 1.1 * dt + (input.rotate ?? 0);
    a.tilt = clamp(a.tilt + (input.tilt ?? 0), AERIAL.minTilt, AERIAL.maxTilt);
    a.dist = clamp(a.dist * (input.zoom ?? 1), AERIAL.minDist, AERIAL.maxDist);
    if (a.goal) {
      const k = 1 - Math.exp(-dt * 3.5);
      a.tx += (a.goal.tx - a.tx) * k;
      a.tz += (a.goal.tz - a.tz) * k;
      a.dist += (a.goal.dist - a.dist) * k;
      if (Math.hypot(a.goal.tx - a.tx, a.goal.tz - a.tz) < 1 && Math.abs(a.goal.dist - a.dist) < 1) a.goal = null;
    }
    a.tx = field.clampToArea(a.tx);
    a.tz = field.clampToArea(a.tz);
    const groundY = heightAt(a.tx, a.tz);
    const cx = a.tx - fwdX * Math.cos(a.tilt) * a.dist;
    const cz = a.tz - fwdZ * Math.cos(a.tilt) * a.dist;
    const cy = Math.max(groundY + Math.sin(a.tilt) * a.dist, heightAt(cx, cz) + 25);
    camera.position.set(cx, cy, cz);
    camera.rotation.set(-a.tilt, a.yaw, 0);
  }

  /**
   * @param {number} dt  segundos desde el cuadro anterior
   * @param {{ forward: number, strafe: number, turn: number, run: boolean, lookX: number, lookY: number,
   *   zoom?: number, tilt?: number, rotate?: number }} input
   */
  function update(dt, input) {
    // Con el tiempo acelerado solo se acelera lo que se mueve en el terreno, no la cámara.
    const simDt = dt * (realSpeed ? warp : 1);
    if (view.mode === 'aerial') {
      updateAerial(dt, input);
    } else if (view.mode === 'descending') {
      const d = view.descent;
      d.t = Math.min(1, d.t + dt / d.seconds);
      const e = easeInOut(d.t);
      const toY = heightAt(d.x, d.z) + EYE_M;
      const x = d.from.x + (d.x - d.from.x) * e;
      const z = d.from.z + (d.z - d.from.z) * e;
      // Baja más tarde de lo que avanza, para no rozar el suelo en el camino.
      const y = Math.max(d.from.y + (toY - d.from.y) * (e * e), heightAt(x, z) + EYE_M);
      camera.position.set(x, y, z);
      camera.rotation.set(d.pitch0 * (1 - e), d.yaw, 0);
      if (d.t >= 1) Object.assign(view, { mode: 'ground', x: d.x, z: d.z, yaw: d.yaw, pitch: 0, descent: null });
    } else if (view.mode === 'driving') {
      drive(simDt, input);
      const v = car.v;
      v.chaseYaw = (v.chaseYaw - input.lookX * LOOK_SENSITIVITY) * (input.lookX ? 1 : 1 - Math.min(1, dt * 0.8));
      const back = v.heading + Math.PI + v.chaseYaw;
      const reach = car.spec.length * 2.5;
      const cx = v.x + Math.cos(back) * reach;
      const cz = v.z - Math.sin(back) * reach;
      const modelY = car.model.position.y;
      camera.position.set(cx, Math.max(heightAt(cx, cz) + 2, modelY + car.spec.length), cz);
      camera.lookAt(v.x + Math.cos(v.heading) * 6, modelY + 1.6, v.z - Math.sin(v.heading) * 6);
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
      const walk = realSpeed ? WALK.realSpeed : WALK.exploreSpeed * (input.run ? WALK.runFactor : 1);
      const { steps, dt: stepDt } = subSteps(simDt, 0.1, 200);
      for (let i = 0; i < steps; i++) {
        const speed = walk * (1 - SLOPE_SLOW * grade) * stepDt;
        view.x = field.clampToArea(view.x + dirX * speed);
        view.z = field.clampToArea(view.z + dirZ * speed);
        resolveCollisions();
      }
      pushTrack(view.x, view.z);
      const moving = Math.abs(input.forward) + Math.abs(input.strafe) > 0;
      view.bob = moving ? view.bob + dt * (input.run ? 14 : 8) : view.bob * 0.9;
      camera.position.set(view.x, heightAt(view.x, view.z) + EYE_M + (moving ? Math.sin(view.bob) * BOB_M : 0), view.z);
      camera.rotation.set(view.pitch, view.yaw, 0);
    }

    // Desde lo alto: niebla más fina, plano lejano más lejos y marcador a escala visible.
    const altitude = Math.max(0, camera.position.y - heightAt(camera.position.x, camera.position.z));
    fog.density = dustFogDensity(tau, altitude);
    const near = altitude > 200 ? Math.min(20, altitude * 0.004) : 0.3;
    const far = altitude > 200 ? 30000 + altitude * 3 : 24000;
    if (Math.abs(camera.near - near) > near * 0.2 || camera.far !== far) {
      camera.near = near;
      camera.far = far;
      camera.updateProjectionMatrix();
    }
    if (pin.visible) pin.scale.setScalar(Math.max(0.3, view.aerial.dist / 1200));
    sunDisc.position.copy(camera.position).addScaledVector(sunDir, 9000);
    return simDt;
  }

  const ndc = new Vector3();
  /** Punto del suelo bajo una posición de la pantalla (coordenadas normalizadas −1..1). */
  function pick(ndcX, ndcY) {
    ndc.set(ndcX, ndcY, 0.5).unproject(camera).sub(camera.position).normalize();
    const p = camera.position;
    return rayGround([p.x, p.y, p.z], [ndc.x, ndc.y, ndc.z], heightAt, 80000);
  }

  function setPin(point) {
    pin.visible = Boolean(point);
    if (point) pin.position.set(point.x, heightAt(point.x, point.z), point.z);
  }

  function resize(width, height) {
    if (!width || !height) return;
    viewHeight = height;
    renderer.setSize(width, height, false);
    for (const m of lineMaterials) m.resolution.set(renderer.domElement.width, renderer.domElement.height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  return {
    setEnvironment,
    setImagery,
    setDetailImagery,
    setRoutes,
    startDescent,
    descendTo,
    ascend,
    flyTo,
    pick,
    setPin,
    board,
    exitVehicle,
    useVehicle,
    setSpeedMode,
    repair,
    canBoard,
    heightAt,
    /** Datos para el mini mapa: recorrido y vehículo, en metros locales. */
    mapData: () => ({ track, vehicles: fleet.map((f) => ({ id: f.id, x: f.v.x, z: f.v.z })) }),
    update,
    resize,
    render: () => renderer.render(scene, camera),
    /** Dónde está la persona (o lo que mira la vista aérea) y en qué modo. */
    state: () => {
      const driving = view.mode === 'driving';
      const aerial = view.mode === 'aerial' || view.mode === 'descending';
      const yaw = driving ? car.v.heading - Math.PI / 2 : aerial ? view.aerial.yaw : view.yaw;
      const x = driving ? car.v.x : aerial ? view.aerial.tx : view.x;
      const z = driving ? car.v.z : aerial ? view.aerial.tz : view.z;
      return {
        x,
        z,
        mode: view.mode,
        headingDeg: (((-yaw * 180) / Math.PI) % 360 + 360) % 360,
        aerialDist: view.aerial.dist,
        canBoard: canBoard(),
        vehicleId: driving ? car.id : 'walk',
        vehicle: { ...car.v },
        spec: car.spec,
        realSpeed,
      };
    },
    /** Libera la memoria de la escena y el contexto WebGL. */
    dispose() {
      clearRoutes();
      clearDetail();
      groundTexture?.dispose();
      for (const d of disposables) d.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
