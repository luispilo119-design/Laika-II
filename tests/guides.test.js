// Guías de supervivencia (Parte B, tarea B6): lectura de las necesidades diarias y coherencia del contenido.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readNeeds } from '../src/modules/guides/needs.js';
import { REFERENCES, refOf, GUIDES, NEED_ORDER, ESSENTIAL_NEEDS } from '../src/modules/guides/data.js';
import messages from '../src/modules/guides/i18n.js';

const REF = { title: 'NASA-STD-3001', org: 'NASA', url: 'https://www.nasa.gov/x' };

test('sin archivo de la Parte A no hay valores: todo queda como "sin datos"', () => {
  assert.equal(readNeeds(undefined).size, 0);
  assert.equal(readNeeds({}).size, 0);
  assert.equal(readNeeds({ default: 'texto' }).size, 0);
});

test('lee el formato de src/core/human-needs.js: valor, límites, origen y referencia por id', () => {
  const needs = readNeeds({
    HUMAN_NEEDS: {
      oxygen: { id: 'oxygen', value: 0.82, unit: 'kg/d', refId: 'bvad', where: 'Tabla 3-33', whereEn: 'Table 3-33' },
      cabinPressure: { id: 'cabinPressure', value: 101, min: 48, max: 102.7, unit: 'kPa', refId: 'bvad', where: 'Tabla 4-1' },
      careerRadiation: { id: 'careerRadiation', max: 600, unit: 'mSv', refId: 'no-registrada', where: 'V1 4030' },
    },
    HUMAN_REFERENCES: [{ id: 'bvad', ...REF }],
  });
  assert.deepEqual(needs.get('oxygen'), {
    id: 'oxygen', value: 0.82, min: null, max: null, unit: 'kg/d', where: 'Tabla 3-33', whereEn: 'Table 3-33', ref: REF,
  });
  assert.equal(needs.get('cabinPressure').whereEn, '', 'sin whereEn queda vacío y la pantalla usa where');
  assert.deepEqual([needs.get('cabinPressure').min, needs.get('cabinPressure').max], [48, 102.7]);
  const career = needs.get('careerRadiation');
  assert.deepEqual([career.value, career.max], [null, 600], 'un límite sin valor nominal también es un dato');
  assert.equal(career.ref, null, 'una referencia que no está registrada no se inventa');
});

test('el archivo real de la Parte A trae las seis necesidades esenciales con su fuente', async () => {
  const needs = readNeeds(await import('../src/core/human-needs.js'));
  for (const id of ESSENTIAL_NEEDS) {
    assert.ok(needs.has(id), `falta ${id}`);
    assert.ok(needs.get(id).ref?.url, `${id} sin referencia`);
  }
  for (const [id, need] of needs) {
    if (need.where) assert.ok(need.whereEn, `${id}: el origen del dato no tiene texto en inglés`);
  }
  for (const id of needs.keys()) assert.ok(NEED_ORDER.includes(id), `sin nombre en pantalla: ${id}`);
});

test('acepta también una lista, un par [mínimo, máximo] y un export default', () => {
  const list = readNeeds({ HUMAN_NEEDS: [{ id: 'oxygen', value: 0.8, unit: 'kg/d', ref: REF }] });
  assert.equal(list.get('oxygen').ref.url, REF.url);
  const pair = readNeeds({ default: { temperature: { value: [18, 27], unit: '°C' } } });
  assert.deepEqual([pair.get('temperature').value, pair.get('temperature').min, pair.get('temperature').max], [null, 18, 27]);
});

test('una necesidad sin ningún número no se muestra como cifra', () => {
  const needs = readNeeds({
    HUMAN_NEEDS: [
      { id: 'water', value: null },
      { id: 'oxygen', value: NaN },
      { id: 'food', value: 'mucho' },
      { id: 'pressure' },
      { value: 5 },
      null,
      { id: 'radiation', value: 0, ref: { title: 'x', url: 'javascript:alert(1)' } },
    ],
  });
  assert.deepEqual([...needs.keys()], ['radiation'], 'solo el cero, que sí es un valor, pasa');
  assert.equal(needs.get('radiation').ref, null, 'una referencia sin URL http(s) se descarta');
});

test('cada guía tiene hechos con fuente, pasos y textos en los dos idiomas', () => {
  const ids = new Set(REFERENCES.map((ref) => ref.id));
  assert.equal(ids.size, REFERENCES.length);
  for (const ref of REFERENCES) {
    assert.equal(ref.verified, true);
    assert.match(ref.url, /^https:\/\//);
  }
  assert.deepEqual(GUIDES.map((g) => g.id), ['pressure', 'dust', 'radiation', 'comms', 'power']);
  for (const guide of GUIDES) {
    assert.ok(guide.links.length > 0, `${guide.id}: sin enlace a otro módulo`);
    for (const id of guide.stepRefs) assert.ok(refOf(id), `referencia desconocida: ${id}`);
    for (const lang of ['es', 'en']) {
      const text = messages[lang].guide[guide.id];
      assert.ok(text.name);
      for (const fact of guide.facts) {
        assert.ok(fact.refs.length > 0 && fact.refs.every((id) => refOf(id)), `${guide.id}: hecho ${fact.id} sin fuente`);
        assert.ok(text.fact[fact.id], `${lang} ${guide.id}: falta el hecho ${fact.id}`);
      }
      assert.equal(Object.keys(text.fact).length, guide.facts.length);
      assert.equal(Object.keys(text.step).length, guide.steps, `${lang} ${guide.id}: número de pasos`);
    }
  }
  for (const lang of ['es', 'en']) {
    for (const id of NEED_ORDER) assert.ok(messages[lang].need[id].name, `${lang}: falta el nombre de ${id}`);
    for (const id of ESSENTIAL_NEEDS) assert.ok(messages[lang].need[id].why, `${lang}: falta el porqué de ${id}`);
  }
});

test('las tarjetas de necesidades no traen cifras escritas a mano', () => {
  for (const lang of ['es', 'en']) {
    for (const id of NEED_ORDER) assert.doesNotMatch(JSON.stringify(messages[lang].need[id]), /\d/, `${lang}.need.${id}`);
  }
});
