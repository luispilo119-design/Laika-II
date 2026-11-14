// Comprueba que todo texto existe en español y en inglés.
// Recorre src/core/messages.js y cada src/modules/<id>/i18n.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const modulesDir = join(root, 'src', 'modules');

function flatten(obj, prefix = '') {
  return Object.entries(obj ?? {}).flatMap(([key, value]) =>
    value && typeof value === 'object' ? flatten(value, `${prefix}${key}.`) : [`${prefix}${key}`],
  );
}

const files = [
  ['core', join(root, 'src', 'core', 'messages.js')],
  ...readdirSync(modulesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => [entry.name, join(modulesDir, entry.name, 'i18n.js')]),
];

for (const [name, file] of files) {
  test(`i18n "${name}": mismas claves en es y en`, async () => {
    assert.ok(existsSync(file), `falta ${file}`);
    const dict = (await import(pathToFileURL(file).href)).default;
    const es = flatten(dict.es).sort();
    const en = flatten(dict.en).sort();
    assert.deepEqual(en, es);
    if (name !== 'core') {
      assert.ok(es.includes('title'), 'todo módulo necesita la clave "title"');
    }
  });
}
