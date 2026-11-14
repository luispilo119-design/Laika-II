// Guías de supervivencia (Parte B, tarea B6): lectura de las necesidades diarias y coherencia del contenido.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readNeeds } from '../src/modules/guides/needs.js';
import { REFERENCES, refOf, GUIDES, NEED_IDS } from '../src/modules/guides/data.js';
import messages from '../src/modules/guides/i18n.js';

const REF = { title: 'NASA-STD-3001', org: 'NASA', url: 'https://www.nasa.gov/x' };

test('sin archivo de la Parte A no hay valores: todo queda como "sin datos"', () => {
  assert.equal(readNeeds(undefined).size, 0);
  assert.equal(readNeeds({}).size, 0);
  assert.equal(readNeeds({ default: 'texto' }).size, 0);
});

test('acepta una lista, un objeto por id o un export default', () => {
  const list = readNeeds({ HUMAN_NEEDS: [{ id: 'water', value: 3.5, unit: 'L', ref: REF }] });
  assert.deepEqual(list.get('water'), { id: 'water', value: 3.5, unit: 'L', note: null, ref: REF, refId: null });

  const byId = readNeeds({ HUMAN_NEEDS: { oxygen: { value: [0.8, 0.9], unit: 'kg', refId: 'std3001' } } });
  assert.deepEqual(byId.get('oxygen').value, [0.8, 0.9]);
  assert.equal(byId.get('oxygen').refId, 'std3001');

  const asDefault = readNeeds({ default: [{ id: 'food', value: 'ver la norma', note: { es: 'nota', en: 'note' } }] });
  assert.equal(asDefault.get('food').value, 'ver la norma');
  assert.deepEqual(asDefault.get('food').note, { es: 'nota', en: 'note' });
});

test('un valor ausente o inválido no se muestra como cifra', () => {
  const needs = readNeeds({
    HUMAN_NEEDS: [
      { id: 'water', value: null },
      { id: 'oxygen', value: NaN },
      { id: 'food', value: [1] },
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
  for (const id of NEED_IDS) for (const lang of ['es', 'en']) assert.ok(messages[lang].need[id].name && messages[lang].need[id].why);
});

test('las tarjetas de necesidades no traen cifras escritas a mano', () => {
  for (const lang of ['es', 'en']) {
    for (const id of NEED_IDS) assert.doesNotMatch(messages[lang].need[id].why, /\d/, `${lang}.need.${id}`);
  }
});
