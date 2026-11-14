/**
 * Módulo "guides": la Fase 5, guías de supervivencia. Dueño: Parte B — tarea B6.
 *
 * Dos partes: lo que el cuerpo necesita cada día (los valores llegan de la Parte A en
 * src/core/human-needs.js; aquí no se escribe ninguna cifra) y las guías por situación, cada una
 * con sus hechos, sus pasos, sus fuentes y enlaces a los módulos que la respaldan.
 */
import './guides.css';
import messages from './i18n.js';
import { REFERENCES, refOf, GUIDES, NEED_IDS } from './data.js';
import { readNeeds } from './needs.js';

// Si la Parte A todavía no creó el archivo, esto devuelve un objeto vacío (no falla al compilar).
const needsModule = Object.values(import.meta.glob('../../core/human-needs.js', { eager: true }))[0];
const NEEDS = readNeeds(needsModule);

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ESCAPES[ch]);

/** Guía abierta: se recuerda fuera del DOM porque el shell remonta el módulo al cambiar de idioma. */
const ui = { guide: GUIDES[0].id };

/** @type {import('../../core/types.js').ModuleDef} */
const mod = {
  id: 'guides',
  phase: 5,
  owner: 'B',
  task: 'B6',
  messages,
  references: REFERENCES,
  mount(el, ctx) {
    const { t, store, navigate, modules } = ctx;
    const { lang } = store.get();
    const locale = lang === 'es' ? 'es-MX' : 'en-US';
    const num = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
    const allRefs = new Map(modules.flatMap((m) => m.references ?? []).map((ref) => [ref.id, ref]));

    const link = (ref) =>
      `<a href="${esc(ref.url)}" target="_blank" rel="noopener noreferrer">${esc([ref.org, ref.title].filter(Boolean).join(' — '))}</a>`;
    const sources = (refIds, label = t('guides.source')) => `
      <p class="guides__src"><span>${label}:</span>${refIds.map((id) => link(refOf(id))).join('')}</p>`;

    // ---------- Necesidades diarias ----------

    function needCard(id) {
      const need = NEEDS.get(id);
      const known = NEED_IDS.includes(id);
      const name = known ? t(`guides.need.${id}.name`) : esc(id);
      const why = known ? `<p class="guides__need-why">${t(`guides.need.${id}.why`)}</p>` : '';
      if (!need) {
        return `
          <article class="guides__need">
            <h3>${name}</h3>
            <p class="guides__need-value guides__need-value--empty">${t('guides.needs.noData')}</p>
            ${why}
          </article>`;
      }
      const value = Array.isArray(need.value)
        ? t('guides.needs.range', { low: num.format(need.value[0]), high: num.format(need.value[1]) })
        : typeof need.value === 'number'
          ? num.format(need.value)
          : esc(need.value);
      const note = typeof need.note === 'string' ? need.note : (need.note?.[lang] ?? need.note?.es ?? '');
      const ref = need.ref ?? (need.refId ? allRefs.get(need.refId) : null);
      return `
        <article class="guides__need">
          <h3>${name}</h3>
          <p class="guides__need-value">${value} <span>${esc(need.unit)}</span></p>
          ${why}
          ${note ? `<p class="guides__need-note">${esc(note)}</p>` : ''}
          ${ref?.url ? `<p class="guides__src"><span>${t('guides.source')}:</span>${link(ref)}</p>` : ''}
        </article>`;
    }

    // Primero las seis previstas; después, cualquier otra que traiga el archivo de la Parte A.
    const needIds = [...NEED_IDS, ...[...NEEDS.keys()].filter((id) => !NEED_IDS.includes(id))];

    el.innerHTML = `
      <div class="guides">
        <header class="guides__head">
          <h1>${t('guides.title')}</h1>
          <p>${t('guides.desc')}</p>
        </header>

        <section>
          <h2>${t('guides.needs.title')}</h2>
          <p class="guides__lead">${t('guides.needs.lead')}</p>
          <div class="guides__needs">${needIds.map(needCard).join('')}</div>
        </section>

        <section>
          <h2>${t('guides.guides.title')}</h2>
          <div class="guides__tabs" role="tablist" aria-label="${t('guides.guides.pick')}">
            ${GUIDES.map(
              (guide) => `
              <button type="button" class="guides__tab" role="tab" id="guides-tab-${guide.id}"
                aria-controls="guides-panel" data-guide="${guide.id}">${t(`guides.guide.${guide.id}.name`)}</button>`,
            ).join('')}
          </div>
          <article class="guides__panel" id="guides-panel" role="tabpanel" tabindex="-1"></article>
        </section>
      </div>
    `;

    const tabs = [...el.querySelectorAll('.guides__tab')];
    const panel = el.querySelector('.guides__panel');
    const tablist = el.querySelector('.guides__tabs');

    // ---------- Guías por situación ----------

    function showGuide(id) {
      const guide = GUIDES.find((g) => g.id === id) ?? GUIDES[0];
      ui.guide = guide.id;
      for (const tab of tabs) {
        const selected = tab.dataset.guide === guide.id;
        tab.setAttribute('aria-selected', String(selected));
        tab.tabIndex = selected ? 0 : -1;
      }
      panel.setAttribute('aria-labelledby', `guides-tab-${guide.id}`);
      const key = `guides.guide.${guide.id}`;
      const steps = Array.from({ length: guide.steps }, (_, i) => i + 1);
      panel.innerHTML = `
        <h3 class="guides__name">${t(`${key}.name`)}</h3>

        <div class="guides__cols">
          <section>
            <h4>${t('guides.guides.facts')}</h4>
            <ul class="guides__facts">
              ${guide.facts.map((fact) => `<li>${t(`${key}.fact.${fact.id}`)}${sources(fact.refs)}</li>`).join('')}
            </ul>
          </section>

          <section>
            <h4>${t('guides.guides.steps')}</h4>
            <ol class="guides__steps">
              ${steps.map((n) => `<li>${t(`${key}.step.${n}`)}</li>`).join('')}
            </ol>
            ${sources(guide.stepRefs, t('guides.guides.basis'))}
            <p class="guides__fine">${t('guides.guides.disclaimer')}</p>
          </section>
        </div>

        <h4>${t('guides.guides.links')}</h4>
        <div class="guides__links">
          ${guide.links
            .filter((moduleId) => modules.some((m) => m.id === moduleId))
            .map((moduleId) => `<button type="button" class="btn" data-go="${moduleId}">${t(`${moduleId}.title`)}</button>`)
            .join('')}
        </div>
      `;
    }

    function onClick(event) {
      const guide = event.target.closest('.guides__tab')?.dataset.guide;
      if (guide) return showGuide(guide);
      const go = event.target.closest('[data-go]')?.dataset.go;
      if (go) navigate(go);
      return undefined;
    }

    function onTabKey(event) {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
      const at = GUIDES.findIndex((g) => g.id === ui.guide);
      let next;
      if (step) next = (at + step + GUIDES.length) % GUIDES.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = GUIDES.length - 1;
      else return;
      event.preventDefault();
      showGuide(GUIDES[next].id);
      tabs[next].focus();
    }

    el.addEventListener('click', onClick);
    tablist.addEventListener('keydown', onTabKey);
    showGuide(ui.guide);

    return () => {
      el.removeEventListener('click', onClick);
      tablist.removeEventListener('keydown', onTabKey);
    };
  },
};

export default mod;
