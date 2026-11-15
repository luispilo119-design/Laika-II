/**
 * Modelos 3D simples del equipo de la misión (módulo de aterrizaje, rover, hábitat, paneles).
 * Parte B — tarea B5. Son figuras hechas con cajas y cilindros, no a escala exacta ni copias de
 * vehículos reales; la pantalla lo avisa.
 */
import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry } from 'three';

/**
 * Materiales y fábricas de piezas. Todo lo que se crea pasa por `keep` para poder liberarlo.
 * @param {(x: any) => any} keep
 */
export function createKit(keep) {
  const mats = {
    white: keep(new MeshStandardMaterial({ color: '#e9e4da', roughness: 0.6, metalness: 0.1 })),
    gold: keep(new MeshStandardMaterial({ color: '#c99a3b', roughness: 0.35, metalness: 0.7 })),
    dark: keep(new MeshStandardMaterial({ color: '#2a2724', roughness: 0.9 })),
    glass: keep(new MeshStandardMaterial({ color: '#1d3f66', roughness: 0.2, metalness: 0.4 })),
    panel: keep(new MeshStandardMaterial({ color: '#1f3f7a', roughness: 0.3, metalness: 0.5 })),
    accent: keep(new MeshStandardMaterial({ color: '#d6402a', roughness: 0.5 })),
    grey: keep(new MeshStandardMaterial({ color: '#8d8a84', roughness: 0.7, metalness: 0.3 })),
  };
  const box = (w, h, d, mat) => new Mesh(keep(new BoxGeometry(w, h, d)), mat);
  const cyl = (rt, rb, h, mat, seg = 16) => new Mesh(keep(new CylinderGeometry(rt, rb, h, seg)), mat);
  const sphere = (r, mat, ...args) => new Mesh(keep(new SphereGeometry(r, ...args)), mat);
  return { mats, box, cyl, sphere };
}

/** Módulo de aterrizaje: cuerpo, patas y antena. */
export function buildLander({ mats, cyl, sphere }) {
  const lander = new Group();
  const body = cyl(2.6, 3.2, 3.2, mats.gold, 8);
  body.position.y = 3.4;
  lander.add(body);
  const top = cyl(1.4, 2.6, 1.4, mats.white, 8);
  top.position.y = 5.7;
  lander.add(top);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    const leg = cyl(0.12, 0.12, 4.2, mats.white, 6);
    leg.position.set(Math.cos(a) * 3.1, 1.6, Math.sin(a) * 3.1);
    leg.rotation.set(Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45);
    const foot = cyl(0.55, 0.65, 0.2, mats.white, 10);
    foot.position.set(Math.cos(a) * 4, 0.1, Math.sin(a) * 4);
    lander.add(leg, foot);
  }
  const dish = sphere(0.9, mats.white, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.4);
  dish.position.set(0.8, 7, 0);
  dish.rotation.z = -0.8;
  lander.add(dish);
  return lander;
}

/** Rover presurizado: cabina, seis ruedas, mástil. El frente apunta a +x. */
export function buildPressurizedRover({ mats, box, cyl }) {
  const rover = new Group();
  const chassis = box(5.2, 1.0, 2.6, mats.white);
  chassis.position.y = 1.3;
  const cabin = box(3.2, 1.6, 2.4, mats.white);
  cabin.position.set(-0.6, 2.6, 0);
  const windows = box(0.1, 0.8, 2.0, mats.glass);
  windows.position.set(1.02, 2.8, 0);
  const stripe = box(5.25, 0.18, 2.65, mats.accent);
  stripe.position.y = 1.85;
  rover.add(chassis, cabin, windows, stripe);
  for (const wx of [-1.9, 0, 1.9]) {
    for (const wz of [-1.45, 1.45]) {
      const wheel = cyl(0.62, 0.62, 0.5, mats.dark, 14);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(wx, 0.62, wz);
      rover.add(wheel);
    }
  }
  const mast = cyl(0.06, 0.06, 1.6, mats.white, 6);
  mast.position.set(-1.6, 4.1, 0.8);
  rover.add(mast);
  return rover;
}

/**
 * Réplica sencilla de un rover robótico de seis ruedas (tipo Perseverance): cuerpo, ruedas,
 * balancines, mástil con cabeza de cámaras, brazo plegado y el generador detrás. Hecha con figuras
 * básicas, no a escala exacta. El frente apunta a +x.
 */
export function buildRoboticRover({ mats, box, cyl }) {
  const rover = new Group();
  const body = box(2.2, 0.75, 1.9, mats.white);
  body.position.set(0, 1.25, 0);
  const deck = box(2.25, 0.08, 1.95, mats.grey);
  deck.position.set(0, 1.66, 0);
  rover.add(body, deck);
  for (const wx of [-1.25, 0, 1.25]) {
    for (const wz of [-1.25, 1.25]) {
      const wheel = cyl(0.26, 0.26, 0.4, mats.grey, 14);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(wx, 0.26, wz);
      rover.add(wheel);
    }
  }
  for (const wz of [-1.05, 1.05]) {
    const rocker = box(2.6, 0.08, 0.08, mats.grey);
    rocker.position.set(0, 0.85, wz);
    rocker.rotation.z = 0.08;
    rover.add(rocker);
  }
  const mast = cyl(0.07, 0.07, 1.5, mats.white, 8);
  mast.position.set(0.8, 2.4, 0.6);
  const head = box(0.35, 0.3, 0.7, mats.white);
  head.position.set(0.85, 3.2, 0.6);
  const lens = box(0.06, 0.12, 0.5, mats.glass);
  lens.position.set(1.04, 3.2, 0.6);
  rover.add(mast, head, lens);
  const arm = box(0.12, 0.12, 1.6, mats.grey);
  arm.position.set(1.2, 1.1, 0);
  const turret = box(0.35, 0.35, 0.35, mats.dark);
  turret.position.set(1.25, 1.1, -0.8);
  rover.add(arm, turret);
  const power = cyl(0.3, 0.3, 0.9, mats.dark, 10);
  power.rotation.z = 1.0;
  power.position.set(-1.35, 1.6, 0);
  rover.add(power);
  return rover;
}

/** Hábitat inflable con esclusa. */
export function buildHabitat({ mats, cyl, sphere }) {
  const habitat = new Group();
  const dome = sphere(7, mats.white, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2);
  const ringBase = cyl(7.1, 7.3, 0.8, mats.dark, 28);
  ringBase.position.y = 0.4;
  const lock = cyl(1.3, 1.3, 3.2, mats.white, 14);
  lock.rotation.z = Math.PI / 2;
  lock.position.set(8, 1.4, 0);
  const lockDoor = cyl(1.0, 1.0, 0.1, mats.accent, 14);
  lockDoor.rotation.z = Math.PI / 2;
  lockDoor.position.set(9.65, 1.4, 0);
  habitat.add(dome, ringBase, lock, lockDoor);
  return habitat;
}

/** Paneles solares inclinados hacia el ecuador. */
export function buildSolarField({ mats, box, cyl }) {
  const solar = new Group();
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      const post = cyl(0.08, 0.08, 1.4, mats.dark, 6);
      post.position.set(col * 4.4, 0.7, row * 4);
      const p2 = box(4, 0.08, 2.4, mats.panel);
      p2.position.set(col * 4.4, 1.45, row * 4);
      p2.rotation.x = -0.45;
      solar.add(post, p2);
    }
  }
  return solar;
}
