/**
 * Módulo "guides": la Fase 5, guías de supervivencia. Dueño: Parte B — tarea B6.
 *
 * Dos partes: lo que el cuerpo necesita cada día (los valores llegan de la Parte A en
 * src/core/human-needs.js; aquí no se escribe ninguna cifra) y las guías por situación, cada una
 * con sus hechos, sus pasos, sus fuentes y enlaces a los módulos que la respaldan.
 */
import './guides.css';
import messages from './i18n.js';
import { REFERENCES, refOf, GUIDES, NEED_ORDER, ESSENTIAL_NEEDS } from './data.js';
import { readNeeds } from './needs.js';

// Si la Parte A todavía no creó el archivo, esto devuelve un objeto vacío (no falla al compilar).
const needsModule = Object.values(import.meta.glob('../../core/human-needs.js', { eager: true }))[0];
const NEEDS = readNeeds(needsModule);
// Las fuentes de esos valores también cuentan como referencias de este módulo.
const NEED_REFERENCES = Array.isArray(needsModule?.HUMAN_REFERENCES) ? needsModule.HUMAN_REFERENCES : [];

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
  references: [...REFERENCES, ...NEED_REFERENCES],
  mount(el, ctx) {
    const { t, store, navigate, modules } = ctx;
    const { lang } = store.get();
    const locale = lang === 'es' ? 'es-MX' : 'en-US';
    const num = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });

    const link = (ref) =>
      `<a href="${esc(ref.url)}" target="_blank" rel="noopener noreferrer">${esc([ref.org, ref.title].filter(Boolean).join(' — '))}</a>`;
    // En las tarjetas de necesidades la misma fuente se repite: basta la organización como enlace.
    const shortLink = (ref) =>
      `<a href="${esc(ref.url)}" target="_blank" rel="noopener noreferrer" title="${esc(ref.title)}">${esc(ref.org || ref.title)}</a>`;
    const sources = (refIds, label = t('guides.source')) => `
      <p class="guides__src"><span>${label}:</span>${refIds.map((id) => link(refOf(id))).join('')}</p>`;

    // ---------- Necesidades diarias ----------

    function needCard(id) {
      const need = NEEDS.get(id);
      const known = NEED_ORDER.includes(id);
      const name = known ? t(`guides.need.${id}.name`) : esc(id);
      const why = ESSENTIAL_NEEDS.includes(id) ? `<p class="guides__need-why">${t(`guides.need.${id}.why`)}</p>` : '';
      if (!need) {
        return `
          <article class="guides__need">
            <h3>${name}</h3>
            <p class="guides__need-value guides__need-value--empty">${t('guides.needs.noData')}</p>
            ${why}
          </article>`;
      }
      const unit = esc(need.unit);
      // En inglés se usa whereEn; si el archivo de la Parte A no lo trae, queda el texto original.
      const where = lang === 'es' ? need.where : need.whereEn || need.where;
      const limits =
        need.min !== null && need.max !== null
          ? t('guides.needs.range', { low: num.format(need.min), high: num.format(need.max), unit })
          : need.max !== null
            ? t('guides.needs.max', { v: num.format(need.max), unit })
            : need.min !== null
              ? t('guides.needs.min', { v: num.format(need.min), unit })
              : '';
      // Con valor nominal, los límites van debajo; sin él, el límite es el dato principal.
      const main = need.value !== null ? `${num.format(need.value)} <span>${unit}</span>` : limits;
      return `
        <article class="guides__need">
          <h3>${name}</h3>
          <p class="guides__need-value">${main}</p>
          ${need.value !== null && limits ? `<p class="guides__need-note">${limits}</p>` : ''}
          ${why}
          ${where ? `<p class="guides__need-note">${t('guides.needs.where', { where: esc(where) })}</p>` : ''}
          ${need.ref ? `<p class="guides__src"><span>${t('guides.source')}:</span>${shortLink(need.ref)}</p>` : ''}
        </article>`;
    }

    // Primero el orden previsto (las esenciales siempre; las demás, solo si hay dato) y después
    // cualquier otra necesidad que traiga el archivo de la Parte A.
    const needIds = [
      ...NEED_ORDER.filter((id) => ESSENTIAL_NEEDS.includes(id) || NEEDS.has(id)),
      ...[...NEEDS.keys()].filter((id) => !NEED_ORDER.includes(id)),
    ];

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
