// Fondo ASCII de la pantalla de inicio (Parte B, tarea B1): la parte que no necesita navegador.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildField, shade, RAMP } from '../src/modules/home/blackhole.js';

const COLS = 120;
const ROWS = 40;
const view = { cx: COLS / 2, cy: ROWS / 2, cellW: 8, cellH: 16, unit: 30 };

test('el campo tiene sombra en el centro, disco alrededor y cielo en las esquinas', () => {
  const field = buildField(COLS, ROWS, view);
  const center = (ROWS / 2) * COLS + COLS / 2;
  assert.equal(field.captured[center], 1, 'el rayo central cae al agujero');
  assert.equal(field.captured[0], 0, 'una esquina no cae al agujero');
  assert.equal(field.count[0], 0, 'una esquina no toca el disco');
  const withDisk = field.count.reduce((sum, n) => sum + (n > 0 ? 1 : 0), 0);
  assert.ok(withDisk > COLS * ROWS * 0.05, 'una parte visible de la pantalla muestra el disco');
});

test('el brillo queda entre 0 y 1 y cambia con el tiempo', () => {
  const field = buildField(COLS, ROWS, view);
  const a = new Float32Array(COLS * ROWS);
  const b = new Float32Array(COLS * ROWS);
  shade(field, 0, a);
  shade(field, 1.5, b);
  let changed = 0;
  for (let i = 0; i < a.length; i++) {
    assert.ok(a[i] >= 0 && a[i] <= 1, `brillo fuera de rango en ${i}: ${a[i]}`);
    if (Math.abs(a[i] - b[i]) > 0.01) changed++;
  }
  assert.ok(changed > 100, 'el disco gira');
  const center = (ROWS / 2) * COLS + COLS / 2;
  assert.equal(a[center], 0, 'la sombra es negra');
});

test('la rampa de caracteres es ASCII y empieza en espacio', () => {
  assert.equal(RAMP[0], ' ');
  assert.match(RAMP, /^[\x20-\x7e]+$/);
});
