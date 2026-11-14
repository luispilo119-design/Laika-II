/**
 * Fondo ASCII de la pantalla de inicio: un agujero negro con disco de acreción.
 *
 * Es una animación decorativa, no una simulación científica. Escrita desde cero en JavaScript
 * para este proyecto; la idea visual viene de BLACK-HOLE de JIN2 (@jin_22ee), del que no se
 * reutiliza código (su licencia no permite redistribuirlo; ver la pantalla de referencias).
 *
 * Cómo funciona:
 *  1. buildField() lanza un rayo de luz por cada celda de caracteres y lo curva alrededor del
 *     agujero. Anota en qué puntos del disco cae cada rayo. Solo se calcula al cambiar el tamaño.
 *  2. shade() calcula el brillo de cada celda en el instante t: lo único que cambia con el tiempo
 *     es la textura del disco, que gira más rápido cuanto más cerca está del agujero.
 *  3. createBlackHole() convierte el brillo en caracteres y los dibuja en un <canvas>.
 *
 * Unidades internas: el radio del horizonte vale 1.
 */

const DISK_IN = 3; // borde interno del disco
const DISK_OUT = 11; // borde externo
const CAM_DIST = 30;
const CAM_ELEV = (8 * Math.PI) / 180; // la cámara mira el disco casi de canto
const ROLL = (-11 * Math.PI) / 180; // inclinación de la imagen
const MAX_HITS = 3; // cruces del disco que se guardan por rayo (el disco es translúcido)
const HIT_WEIGHT = [1, 0.7, 0.5];
const MAX_STEPS = 700;
const RING_W = 0.32; // ancho de cada anillo de textura
const RING_SAMPLES = 96; // muestras de textura a lo largo de un anillo
const SPIN = 0.85; // rad/s en el borde interno
const TWO_PI = Math.PI * 2;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const smooth = (a, b, x) => {
  const u = clamp((x - a) / (b - a), 0, 1);
  return u * u * (3 - 2 * u);
};

/** Generador determinista: el mismo dibujo en cada visita. */
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = Math.imul(s ^ (s >>> 15), 1 | s);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** Textura del disco: cada anillo tiene su propio ruido suave y gira a su propia velocidad. */
function buildRings() {
  const count = Math.ceil((DISK_OUT - DISK_IN) / RING_W) + 2;
  const rand = seeded(1957);
  const table = new Float32Array(count * RING_SAMPLES);
  const speed = new Float32Array(count); // en muestras por segundo
  const raw = new Float32Array(RING_SAMPLES);
  for (let k = 0; k < count; k++) {
    for (let j = 0; j < RING_SAMPLES; j++) raw[j] = rand();
    const blur = 2 + Math.floor(rand() * 4);
    for (let j = 0; j < RING_SAMPLES; j++) {
      let sum = 0;
      for (let d = -blur; d <= blur; d++) sum += raw[(j + d + RING_SAMPLES) % RING_SAMPLES];
      const v = clamp((sum / (2 * blur + 1) - 0.3) / 0.4, 0, 1);
      table[k * RING_SAMPLES + j] = 0.22 + 0.78 * v * v;
    }
    const radius = DISK_IN + k * RING_W;
    speed[k] = (SPIN * Math.pow(radius / DISK_IN, -1.5) * RING_SAMPLES) / TWO_PI;
  }
  return { count, table, speed };
}

/**
 * Traza un rayo por celda y guarda dónde toca el disco.
 * @param {number} cols
 * @param {number} rows
 * @param {{ cx: number, cy: number, cellW: number, cellH: number, unit: number }} view
 *   cx, cy: centro del agujero en celdas; cellW, cellH: tamaño de celda en px; unit: px por radio.
 */
export function buildField(cols, rows, view) {
  const n = cols * rows;
  const count = new Uint8Array(n);
  const ring = new Float32Array(n * MAX_HITS); // posición radial en anillos de textura
  const angle = new Float32Array(n * MAX_HITS); // ángulo en muestras de textura
  const gain = new Float32Array(n * MAX_HITS); // brillo fijo del punto del disco
  const glow = new Float32Array(n); // halo que no cambia con el tiempo
  const star = new Float32Array(n); // 0 = sin estrella; si no, su fase de parpadeo
  const captured = new Uint8Array(n); // 1 = el rayo cae al agujero

  const rand = seeded(3111957);
  const sinE = Math.sin(CAM_ELEV);
  const cosE = Math.cos(CAM_ELEV);
  const camY = CAM_DIST * sinE;
  const camZ = CAM_DIST * cosE;
  const cosR = Math.cos(ROLL);
  const sinR = Math.sin(ROLL);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = row * cols + col;
      const sx0 = ((col + 0.5 - view.cx) * view.cellW) / view.unit;
      const sy0 = (-(row + 0.5 - view.cy) * view.cellH) / view.unit;
      const sx = sx0 * cosR - sy0 * sinR;
      const sy = sx0 * sinR + sy0 * cosR;
      const starRoll = rand();

      // Dirección del rayo: cámara estenopeica que mira al origen.
      let vx = sx;
      let vy = -sinE * CAM_DIST + cosE * sy;
      let vz = -cosE * CAM_DIST - sinE * sy;
      const len = Math.hypot(vx, vy, vz);
      vx /= len;
      vy /= len;
      vz /= len;
      let px = 0;
      let py = camY;
      let pz = camZ;

      const hx = py * vz - pz * vy;
      const hy = pz * vx - px * vz;
      const hz = px * vy - py * vx;
      const h2 = hx * hx + hy * hy + hz * hz;
      const impact = Math.sqrt(h2);

      // Rayos que pasan lejos: no tocan el disco, solo pueden mostrar una estrella.
      if (impact > DISK_OUT + 2) {
        if (starRoll < 0.012) star[i] = 0.05 + rand();
        continue;
      }

      let hits = 0;
      let fell = false;
      for (let step = 0; step < MAX_STEPS; step++) {
        const r2 = px * px + py * py + pz * pz;
        const r = Math.sqrt(r2);
        if (r < 1) {
          fell = true;
          break;
        }
        if (r > CAM_DIST * 1.2 && px * vx + py * vy + pz * vz > 0) break;
        const dt = clamp(0.06 * r, 0.02, 0.6);
        const k = (-1.5 * h2) / (r2 * r2 * r);
        vx += k * px * dt;
        vy += k * py * dt;
        vz += k * pz * dt;
        const nx = px + vx * dt;
        const ny = py + vy * dt;
        const nz = pz + vz * dt;
        if (py > 0 !== ny > 0 && hits < MAX_HITS) {
          const s = py / (py - ny);
          const qx = px + (nx - px) * s;
          const qz = pz + (nz - pz) * s;
          const rho = Math.hypot(qx, qz);
          if (rho >= DISK_IN && rho <= DISK_OUT) {
            const phi = Math.atan2(qz, qx);
            // El lado del disco que gira hacia la cámara se ve más brillante.
            const beta = Math.sqrt(0.5 / rho);
            const doppler = Math.sqrt(1 - beta * beta) / (1 - beta * Math.cos(phi) * cosE);
            const edge = smooth(DISK_IN, DISK_IN + 0.5, rho) * (1 - smooth(DISK_OUT - 2.5, DISK_OUT, rho));
            const at = i * MAX_HITS + hits;
            ring[at] = (rho - DISK_IN) / RING_W;
            angle[at] = ((phi + Math.PI) / TWO_PI) * RING_SAMPLES;
            gain[at] = Math.pow(DISK_IN / rho, 0.8) * Math.pow(doppler, 2.4) * edge * HIT_WEIGHT[hits];
            hits++;
          }
        }
        px = nx;
        py = ny;
        pz = nz;
      }
      count[i] = hits;
      if (fell) {
        captured[i] = 1;
      } else {
        // Anillo de fotones pegado a la sombra, más un halo tenue alrededor.
        const off = Math.max(0, impact - 2.6);
        glow[i] = 0.9 * Math.exp(-off / 0.22) + 0.05 * Math.exp(-off / 1.3);
        if (hits === 0 && starRoll < 0.012) star[i] = 0.05 + rand();
      }
    }
  }

  return { cols, rows, count, ring, angle, gain, glow, star, captured, rings: buildRings() };
}

/**
 * Brillo 0..1 de cada celda en el instante t (segundos).
 * @param {ReturnType<typeof buildField>} field
 * @param {number} t
 * @param {Float32Array} out longitud cols*rows
 */
export function shade(field, t, out) {
  const { count, ring, angle, gain, glow, star, rings } = field;
  const { table, speed } = rings;
  const n = out.length;
  for (let i = 0; i < n; i++) {
    let b = glow[i];
    const hits = count[i];
    for (let k = 0; k < hits; k++) {
      const at = i * MAX_HITS + k;
      const rf = ring[at];
      const k0 = rf | 0;
      const fr = rf - k0;
      let tex = 0;
      for (let side = 0; side < 2; side++) {
        const band = k0 + side;
        let u = (angle[at] - speed[band] * t) % RING_SAMPLES;
        if (u < 0) u += RING_SAMPLES;
        const j0 = u | 0;
        const j1 = j0 + 1 === RING_SAMPLES ? 0 : j0 + 1;
        const base = band * RING_SAMPLES;
        const v = table[base + j0] + (table[base + j1] - table[base + j0]) * (u - j0);
        tex += side === 0 ? v * (1 - fr) : v * fr;
      }
      b += gain[at] * tex;
    }
    if (star[i] > 0) {
      const twinkle = 0.3 + 0.2 * Math.sin(t * 1.3 + star[i] * 40);
      if (twinkle > b) b = twinkle * star[i];
    }
    out[i] = 1 - Math.exp(-2.8 * b);
  }
}

/** Caracteres de menor a mayor brillo. Solo ASCII, para que todos midan lo mismo. */
export const RAMP = ' .,:;~-=+*ox%#@';

/** Punto medio entre dos colores #rrggbb; si alguno viene en otro formato, devuelve el primero. */
function mixHex(a, b) {
  const parse = (hex) => /^#[0-9a-f]{6}$/i.exec(hex) && [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const ca = parse(a);
  const cb = parse(b);
  if (!ca || !cb) return a;
  return `#${ca.map((v, i) => Math.round((v + cb[i]) / 2).toString(16).padStart(2, '0')).join('')}`;
}

const FPS = 30;
const BUCKETS = 5;

/**
 * Dibuja la animación en un canvas y la mantiene al tamaño del elemento.
 * @param {HTMLCanvasElement} canvas
 * @param {(width: number, height: number) => { fx: number, fy: number, unit: number }} getLayout
 *   Dónde va el centro del agujero (fracción del ancho y del alto) y cuántos px mide un radio.
 * @returns {() => void} limpieza: detiene la animación y quita todos los listeners.
 */
export function createBlackHole(canvas, getLayout) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  const css = getComputedStyle(canvas);
  const pick = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  const fontFamily = pick('--font-mono', 'monospace');
  // Paleta por nivel de brillo, tomada de las variables de base.css.
  const rust700 = pick('--rust-700', '#96483a');
  const rust300 = pick('--rust-300', '#cf8a63');
  const cream = pick('--cream', '#fffff3');
  const palette = [
    { color: rust700, alpha: 0.7 },
    { color: pick('--rust-500', '#a5583b'), alpha: 1 },
    { color: rust300, alpha: 1 },
    { color: mixHex(rust300, cream), alpha: 1 },
    { color: cream, alpha: 1 },
  ];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  let field = null;
  let out = null;
  let width = 0;
  let height = 0;
  let charW = 0;
  let lineH = 0;
  let raf = 0;
  let last = 0;
  let elapsed = 4; // se arranca con el disco ya "en marcha"
  let resizeTimer = 0;
  let destroyed = false;
  let lensed = null; // brillo después del foco del puntero
  let heat = null; // cuánto ilumina el puntero cada celda (se apaga poco a poco)
  // Puntero en px del canvas. `x/y` es lo suavizado que se dibuja; `tx/ty` adonde va.
  const pointer = { x: -1e4, y: -1e4, tx: -1e4, ty: -1e4, active: 0, target: 0 };

  function rebuild() {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    if (!width || !height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const fontPx = clamp(Math.round(width / 110), 10, 18);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = `${fontPx}px ${fontFamily}`;
    ctx.textBaseline = 'top';
    charW = ctx.measureText('M'.repeat(40)).width / 40;
    lineH = Math.round(fontPx * 1.15);
    const cols = Math.ceil(width / charW);
    const rows = Math.ceil(height / lineH);
    const layout = getLayout(width, height);
    field = buildField(cols, rows, {
      cx: (layout.fx * width) / charW,
      cy: (layout.fy * height) / lineH,
      cellW: charW,
      cellH: lineH,
      unit: layout.unit,
    });
    out = new Float32Array(cols * rows);
    lensed = new Float32Array(cols * rows);
    heat = new Float32Array(cols * rows);
    draw();
  }

  /**
   * Interacción: donde pasa el puntero se "enciende" la parte brillante del ASCII (los caracteres
   * suben de nivel y de color) y el rastro se apaga en un par de segundos. No mueve nada.
   */
  function applyPointer(src, dst, cols, rows) {
    pointer.x += (pointer.tx - pointer.x) * 0.35;
    pointer.y += (pointer.ty - pointer.y) * 0.35;
    pointer.active += (pointer.target - pointer.active) * 0.15;
    const radius = Math.max(6, cols / 14); // en columnas
    const aspect = lineH / charW;
    // El calor de cada celda decae; el puntero lo recarga a su alrededor.
    let any = false;
    for (let i = 0; i < heat.length; i++) {
      if (heat[i] > 0.002) {
        heat[i] *= 0.93;
        any = true;
      } else heat[i] = 0;
    }
    if (pointer.active > 0.01) {
      const pcx = pointer.x / charW;
      const pcy = pointer.y / lineH;
      const r0 = Math.max(0, Math.floor(pcy - radius / aspect));
      const r1 = Math.min(rows - 1, Math.ceil(pcy + radius / aspect));
      const c0 = Math.max(0, Math.floor(pcx - radius));
      const c1 = Math.min(cols - 1, Math.ceil(pcx + radius));
      for (let row = r0; row <= r1; row++) {
        const dy = (row - pcy) * aspect;
        for (let col = c0; col <= c1; col++) {
          const d = Math.hypot(col - pcx, dy) / radius;
          if (d >= 1) continue;
          const v = (1 - d * d) * pointer.active;
          const i = row * cols + col;
          if (v > heat[i]) heat[i] = v;
          any = true;
        }
      }
    }
    if (!any) {
      dst.set(src);
      return;
    }
    for (let i = 0; i < src.length; i++) {
      const h = heat[i];
      // Lo que ya brilla brilla más; donde no hay nada aparece un polvo tenue de caracteres.
      dst[i] = h > 0 ? clamp(src[i] * (1 + 1.9 * h) + 0.07 * h, 0, 1) : src[i];
    }
  }

  function draw() {
    if (!field) return;
    shade(field, elapsed, out);
    const { cols, rows } = field;
    applyPointer(out, lensed, cols, rows);
    const out2 = lensed;
    const top = RAMP.length - 1;
    ctx.clearRect(0, 0, width, height);
    const lines = new Array(BUCKETS);
    const used = new Array(BUCKETS);
    for (let row = 0; row < rows; row++) {
      lines.fill('');
      used.fill(false);
      for (let col = 0; col < cols; col++) {
        const v = out2[row * cols + col];
        const ci = Math.round(Math.pow(v, 0.8) * top);
        const bucket = ci === 0 ? -1 : Math.min(BUCKETS - 1, (v * BUCKETS) | 0);
        for (let b = 0; b < BUCKETS; b++) lines[b] += b === bucket ? RAMP[ci] : ' ';
        if (bucket >= 0) used[bucket] = true;
      }
      const y = row * lineH;
      for (let b = 0; b < BUCKETS; b++) {
        if (!used[b]) continue;
        ctx.globalAlpha = palette[b].alpha;
        ctx.fillStyle = palette[b].color;
        ctx.fillText(lines[b], 0, y);
      }
    }
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = now - last;
    if (dt < 1000 / FPS - 1) return; // tope de 30 cuadros por segundo
    last = now;
    elapsed += Math.min(dt, 100) / 1000;
    draw();
  }

  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  /** Anima solo si la pestaña está visible y la persona no pidió reducir el movimiento. */
  function sync() {
    if (destroyed) return;
    const shouldRun = !document.hidden && !reduced.matches;
    if (shouldRun && !raf) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    } else if (!shouldRun) {
      stop();
      draw(); // cuadro fijo
    }
  }

  function toCanvas(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top, inside: event.clientY >= rect.top && event.clientY <= rect.bottom };
  }
  function onMove(event) {
    const p = toCanvas(event);
    if (pointer.target === 0) {
      pointer.x = p.x;
      pointer.y = p.y;
    }
    pointer.tx = p.x;
    pointer.ty = p.y;
    pointer.target = p.inside ? 1 : 0;
    if (!raf) draw();
  }
  function onLeave() {
    pointer.target = 0;
  }
  window.addEventListener('pointermove', onMove, { passive: true });
  document.documentElement.addEventListener('pointerleave', onLeave);

  const observer = new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(rebuild, 120);
  });
  observer.observe(canvas);
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', sync);

  rebuild();
  sync();

  return () => {
    destroyed = true;
    stop();
    clearTimeout(resizeTimer);
    observer.disconnect();
    window.removeEventListener('pointermove', onMove);
    document.documentElement.removeEventListener('pointerleave', onLeave);
    document.removeEventListener('visibilitychange', sync);
    reduced.removeEventListener('change', sync);
  };
}
