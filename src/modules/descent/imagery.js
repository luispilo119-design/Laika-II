/**
 * Descarga las teselas de un mosaico orbital y las junta en un canvas para usarlo de textura.
 * Parte B — tarea B5. La lógica de qué pedir está en tiles.js.
 */
import { chooseImagery, pickLevel, tileCover, tileUrl } from './tiles.js';

function loadTile(url, signal) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // antes de src: sin esto WebGL no puede usar la imagen
    img.decoding = 'async';
    const abort = () => {
      img.src = '';
      reject(new Error('abort'));
    };
    signal?.addEventListener('abort', abort, { once: true });
    img.onload = () => {
      signal?.removeEventListener('abort', abort);
      resolve(img);
    };
    img.onerror = () => {
      signal?.removeEventListener('abort', abort);
      reject(new Error(`tile ${url}`));
    };
    img.src = url;
  });
}

/**
 * @param {import('../../core/types.js').BBox} bbox  recuadro del terreno
 * @param {{ signal?: AbortSignal, maxPx?: number, layer?: ReturnType<typeof chooseImagery> }} [opts]
 * @returns {Promise<{ canvas: HTMLCanvasElement, cover: import('../../core/types.js').BBox,
 *   layer: ReturnType<typeof chooseImagery>, ok: number, failed: number }>}
 *   Rechaza solo si no llegó ninguna tesela.
 */
export async function loadImagery(bbox, { signal, maxPx = 2048, layer = chooseImagery(bbox) } = {}) {
  const level = pickLevel(bbox, layer, maxPx);
  const tiles = tileCover(bbox, level);
  const cols = tiles.col1 - tiles.col0 + 1;
  const rows = tiles.row1 - tiles.row0 + 1;
  const size = layer.tileSize;
  const canvas = document.createElement('canvas');
  canvas.width = cols * size;
  canvas.height = rows * size;
  const g = canvas.getContext('2d');
  let ok = 0;
  let failed = 0;
  const jobs = [];
  for (let row = tiles.row0; row <= tiles.row1; row++) {
    for (let col = tiles.col0; col <= tiles.col1; col++) {
      jobs.push(
        loadTile(tileUrl(layer, level, row, col), signal)
          .then((img) => {
            g.drawImage(img, (col - tiles.col0) * size, (row - tiles.row0) * size, size, size);
            ok++;
          })
          .catch(() => {
            failed++;
          }),
      );
    }
  }
  await Promise.all(jobs);
  if (signal?.aborted) throw new Error('abort');
  if (!ok) throw new Error('no tiles');
  return { canvas, cover: tiles.cover, layer, ok, failed };
}
