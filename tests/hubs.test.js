// Reglas de los hubs (tarea A5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HUB_TYPES, MAX_KM_FROM_HABITAT, distanceKm, habitatRule, newHubId } from '../src/modules/hubs/rules.js';
import { PROFILES } from '../src/core/env.js';
import messages from '../src/modules/hubs/i18n.js';

test('cada tipo de hub tiene perfil de pesos que suma 1 y textos en los dos idiomas', () => {
  for (const type of HUB_TYPES) {
    const weights = PROFILES[type.id];
    assert.ok(weights, `falta el perfil ${type.id}`);
    const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
    assert.ok(Math.abs(total - 1) < 1e-9, `los pesos de ${type.id} suman ${total}`);
    for (const lang of ['es', 'en']) assert.ok(messages[lang].type[type.id].name);
  }
});

test('distancia sobre la superficie de Marte', () => {
  // Un grado de latitud en Marte mide unos 59.16 km (radio medio de 3389.5 km).
  assert.ok(Math.abs(distanceKm({ lat: 0, lon: 0 }, { lat: 1, lon: 0 }) - 59.16) < 0.05);
  assert.ok(Math.abs(distanceKm({ lat: 0, lon: 179.5 }, { lat: 0, lon: -179.5 }) - 59.16) < 0.05, 'cruza el antimeridiano');
  assert.equal(distanceKm({ lat: 10, lon: 20 }, { lat: 10, lon: 20 }), 0);
});

test('regla de distancia al hábitat', () => {
  const habitat = { id: 'a', type: 'habitat', lat: 0, lon: 0, score: 50, verdict: 'marginal' };
  assert.equal(habitatRule(habitat, [habitat]).status, 'not_applicable');
  const solar = { id: 'b', type: 'solar', lat: 1, lon: 0, score: 50, verdict: 'marginal' };
  assert.equal(habitatRule(solar, [solar]).status, 'no_habitat');
  const near = habitatRule(solar, [habitat, solar]);
  assert.equal(near.status, 'ok');
  assert.ok(near.km < MAX_KM_FROM_HABITAT);
  const far = habitatRule({ ...solar, lat: 3 }, [habitat, solar]);
  assert.equal(far.status, 'too_far');
  assert.ok(far.km > MAX_KM_FROM_HABITAT);
});

test('los ids de hub no se repiten', () => {
  const ids = new Set(Array.from({ length: 200 }, newHubId));
  assert.equal(ids.size, 200);
});
