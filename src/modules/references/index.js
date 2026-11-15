/**
 * Módulo "references": todas las fuentes de la app en un solo lugar.
 * Dueño: Parte B — tarea B7 (docs/PARTE-B.md).
 *
 * No tiene lista propia: reúne el campo `references` de cada módulo de ctx.modules. Una fuente
 * que registre cualquier módulo aparece aquí sin tocar este archivo.
 */
import './references.css';
import messages from './i18n.js';
import { BASEMAPS } from '../../core/marsmap.js';
import { esc } from '../../core/html.js';
import { collectReferences } from '../../core/references.js';

/** Bibliotecas de terceros. Las licencias son las que declara cada paquete en node_modules. */
const LIBRARIES = [
  { name: 'Leaflet', license: 'BSD-2-Clause', url: 'https://leafletjs.com/', useKey: 'references.libs.leaflet' },
  { name: 'three.js', license: 'MIT', url: 'https://threejs.org/', useKey: 'references.libs.three' },
  { name: 'Supabase JS', license: 'MIT', url: 'https://supabase.com/', useKey: 'references.libs.supabase' },
  { name: 'Vite', license: 'MIT', url: 'https://vite.dev/', useKey: 'references.libs.vite' },
];

const ASCII_SOURCE = 'https://github.com/JIN2-ASCII/-JIN2-ASCII/tree/main/BLACK-HOLE';
const MARS_TREK = 'https://trek.nasa.gov/mars/';

const isWebUrl = (url) => /^https?:\/\//i.test(String(url ?? ''));

function link(url, label) {
  if (!isWebUrl(url)) return esc(label);
  return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
}

/** @type {import('../../core/types.js').ModuleDef} */
const mod = {
  id: 'references',
  phase: null,
  owner: 'B',
  task: 'B7',
  messages,
  references: [],
  mount(el, ctx) {
    const { t, modules, phases } = ctx;
    const entries = collectReferences(modules);
    const verified = entries.filter((e) => e.ref.verified).length;

    const groups = [
      ...phases.map((p) => ({ label: t(p.key), items: entries.filter((e) => e.phase === p.id) })),
      { label: t('core.phase.resources'), items: entries.filter((e) => e.phase == null) },
    ].filter((g) => g.items.length > 0);

    const item = ({ ref, usedBy }) => `
      <li class="refs__item">
        <div class="refs__item-main">
          <p class="refs__title">${link(ref.url, ref.title || ref.url)}</p>
          <p class="refs__meta">${[ref.org, ref.year].filter(Boolean).map(esc).join(' · ') || t('references.noOrg')}</p>
          <p class="refs__used">
            ${t('references.usedIn')}
            ${usedBy.map((id) => `<a href="#/${esc(id)}">${esc(t(`${id}.title`))}</a>`).join(', ')}
          </p>
        </div>
        <span class="badge ${ref.verified ? 'refs__badge--ok' : 'badge--warn'}">
          ${t(ref.verified ? 'references.verified' : 'references.unverified')}
        </span>
      </li>`;

    const basemaps = Object.values(BASEMAPS)
      .map((layer) => `<li>${esc(layer.attribution)}</li>`)
      .join('');

    el.innerHTML = `
      <article class="refs">
        <header class="refs__head">
          <h1>${t('references.title')}</h1>
          <p class="refs__lead">${t('references.desc')}</p>
          <p class="refs__count">
            ${t('references.count', { total: entries.length, verified, pending: entries.length - verified })}
          </p>
          <p class="refs__legend">${t('references.legend')}</p>
        </header>

        ${
          groups.length === 0
            ? `<p class="refs__empty">${t('references.empty')}</p>`
            : groups
                .map(
                  (g) => `
          <section class="refs__group">
            <h2>${g.label}</h2>
            <ul class="refs__list">${g.items.map(item).join('')}</ul>
          </section>`,
                )
                .join('')
        }

        <section class="refs__group refs__credits">
          <h2>${t('references.credits.title')}</h2>

          <div class="refs__credit refs__credit--team">
            <img src="./laika-logo.png" alt="" width="56" height="56" />
            <div>
              <h3>${t('core.team')}</h3>
              <p>${t('references.credits.team')}</p>
            </div>
          </div>

          <div class="refs__credit">
            <h3>${t('references.credits.mapTitle')}</h3>
            <p>${t('references.credits.map')} ${link(MARS_TREK, 'NASA Mars Trek')}.</p>
            <ul class="refs__plain">${basemaps}</ul>
          </div>

          <div class="refs__credit">
            <h3>${t('references.credits.libsTitle')}</h3>
            <ul class="refs__plain">
              ${LIBRARIES.map(
                (lib) => `<li>${link(lib.url, lib.name)} — ${t(lib.useKey)} (${t('references.license')} ${lib.license})</li>`,
              ).join('')}
            </ul>
          </div>

          <div class="refs__credit">
            <h3>${t('references.credits.asciiTitle')}</h3>
            <p>${t('references.credits.ascii')} ${link(ASCII_SOURCE, 'BLACK-HOLE — JIN2 (@jin_22ee)')}.</p>
          </div>
        </section>
      </article>
    `;
  },
};

export default mod;
