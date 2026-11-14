/**
 * Módulo "guides": la Fase 5, guía de supervivencia como libro interactivo. Dueño: Parte B — tarea B6.
 *
 * Capítulos:
 *  - Diario del sol: lo que la persona registra cada sol (agua, comidas, sueño, ejercicio),
 *    comparado con las cifras de la NASA, y la radiación acumulada de toda la misión.
 *  - Lo que necesita el cuerpo: los valores llegan de la Parte A en src/core/human-needs.js.
 *  - Una guía por emergencia, con sus hechos y fuentes y una lista de pasos que se marca por sol.
 */
import './guides.css';
import messages from './i18n.js';
import { REFERENCES, refOf, GUIDES, NEED_ORDER, ESSENTIAL_NEEDS } from './data.js';
import { readNeeds } from './needs.js';
import {
  TARGETS,
  CRUISE_MSV_PER_DAY,
  CAREER_LIMIT_MSV,
  MEALS_PER_DAY,
  WATER_STEP_L,
  readJournal,
  dayOf,
  updateDay,
  evaluateDay,
  cruiseDays,
  doseSummary,
  journalStats,
} from '../../core/journal.js';

// Si la Parte A todavía no creó el archivo, esto devuelve un objeto vacío (no falla al compilar).
const needsModule = Object.values(import.meta.glob('../../core/human-needs.js', { eager: true }))[0];
const NEEDS = readNeeds(needsModule);
// Las fuentes de esos valores también cuentan como referencias de este módulo.
const NEED_REFERENCES = Array.isArray(needsModule?.HUMAN_REFERENCES) ? needsModule.HUMAN_REFERENCES : [];
const allRefs = new Map([...REFERENCES, ...NEED_REFERENCES].map((r) => [r.id, r]));

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ESCAPES[ch]);

const CHAPTERS = ['today', 'body', ...GUIDES.map((g) => g.id)];
/** Forma de cada capítulo en el índice (Bauhaus: círculo, cuadrado, triángulo, media luna). */
const SHAPES = { today: 'circle', body: 'square', pressure: 'half', dust: 'triangle', radiation: 'ring', comms: 'bars', power: 'grid' };

/** Capítulo abierto: se recuerda fuera del DOM porque el shell remonta el módulo al cambiar de idioma. */
const ui = { chapter: 'today' };

/** Objetivos en uso: los de human-needs.js si existen; si no, los de respaldo de TARGETS. */
export function targetValues() {
  return {
    water: NEEDS.get(TARGETS.water.need)?.value ?? TARGETS.water.fallback,
    food: NEEDS.get(TARGETS.food.need)?.value ?? TARGETS.food.fallback,
  };
}

/** @type {import('../../core/types.js').ModuleDef} */
const mod = {
  id: 'guides',
  phase: 5,
  owner: 'B',
  task: 'B6',
  messages,
  references: [...REFERENCES, ...NEED_REFERENCES],
  mount(el, ctx) {
    const { t, store, navigate, modules, env } = ctx;
    const { lang } = store.get();
    const locale = lang === 'es' ? 'es-MX' : 'en-US';
    const num = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
    const num1 = new Intl.NumberFormat(locale, { maximumFractionDigits: 1, minimumFractionDigits: 1 });
    const VALUES = targetValues();

    const shortLink = (ref) =>
      ref
        ? `<a href="${esc(ref.url)}" target="_blank" rel="noopener noreferrer" title="${esc(ref.title)}">${esc(ref.org || ref.title)}</a>`
        : '';
    const link = (ref) =>
      ref
        ? `<a href="${esc(ref.url)}" target="_blank" rel="noopener noreferrer">${esc([ref.org, ref.title].filter(Boolean).join(' — '))}</a>`
        : '';
    const sources = (refIds, label = t('guides.source')) => `
      <p class="guides__src"><span>${label}:</span>${refIds.map((id) => link(refOf(id) ?? allRefs.get(id))).join('')}</p>`;
    const srcTag = (refId) => `<span class="book__src">${shortLink(allRefs.get(refId))}</span>`;
    const shape = (name) => `<span class="book__shape book__shape--${name}" aria-hidden="true"></span>`;
    const glyph = (value, tone) =>
      `<div class="glyph-bar" style="--value:${Math.max(0, Math.min(1, value)).toFixed(3)};--tone:${tone}"></div>`;

    const journal = () => readJournal(store.get().mission.journal);
    const saveJournal = (next) => store.set('mission.journal', next);

    el.innerHTML = `
      <div class="book">
        <header class="book__head">
          <p class="kicker">${t('guides.book.kicker')}</p>
          <h1>${t('guides.title')}</h1>
        </header>
        <div class="book__body">
          <nav class="book__toc" aria-label="${t('guides.book.chapters')}">
            ${CHAPTERS.map(
              (id, i) => `
              <button type="button" class="book__tab" data-chapter="${id}">
                ${shape(SHAPES[id])}
                <span class="book__tab-n">${String(i + 1).padStart(2, '0')}</span>
                <span class="book__tab-name">${chapterName(id)}</span>
              </button>`,
            ).join('')}
          </nav>
          <article class="book__spread" aria-live="polite"></article>
        </div>
      </div>
    `;

    const spread = el.querySelector('.book__spread');
    const tabs = [...el.querySelectorAll('.book__tab')];

    function chapterName(id) {
      if (id === 'today') return t('guides.book.today');
      if (id === 'body') return t('guides.book.body');
      return t(`guides.guide.${id}.name`);
    }

    function pager(id) {
      const i = CHAPTERS.indexOf(id);
      const prev = CHAPTERS[i - 1];
      const next = CHAPTERS[i + 1];
      return `
        <footer class="book__pager">
          ${prev ? `<button type="button" class="btn btn--ghost" data-chapter="${prev}">← ${chapterName(prev)}</button>` : '<span></span>'}
          <span class="book__folio">${t('guides.book.page', { n: i + 1 })}</span>
          ${next ? `<button type="button" class="btn btn--ghost" data-chapter="${next}">${chapterName(next)} →</button>` : '<span></span>'}
        </footer>`;
    }

    // ---------- Capítulo: diario del sol ----------

    function bodyFigure(ev) {
      // Silueta geométrica: el agua llena el torso de abajo hacia arriba según lo bebido.
      const fill = Math.round(ev.water * 100);
      return `
        <svg class="book__figure" viewBox="0 0 120 200" role="img" aria-label="${t('guides.journal.body')}">
          <defs>
            <clipPath id="book-torso"><rect x="30" y="58" width="60" height="96" rx="6" /></clipPath>
          </defs>
          <circle cx="60" cy="30" r="22" class="book__fig-head" />
          <rect x="30" y="58" width="60" height="96" rx="6" class="book__fig-torso" />
          <rect x="30" y="${58 + 96 - (96 * fill) / 100}" width="60" height="${(96 * fill) / 100}" class="book__fig-water" clip-path="url(#book-torso)" />
          <rect x="8" y="62" width="16" height="70" rx="4" class="book__fig-limb ${ev.exercise >= 1 ? 'is-on' : ''}" />
          <rect x="96" y="62" width="16" height="70" rx="4" class="book__fig-limb ${ev.exercise >= 1 ? 'is-on' : ''}" />
          <rect x="34" y="158" width="20" height="40" rx="4" class="book__fig-limb ${ev.food >= 1 ? 'is-on' : ''}" />
          <rect x="66" y="158" width="20" height="40" rx="4" class="book__fig-limb ${ev.food >= 1 ? 'is-on' : ''}" />
          <path d="M44 30 h32" class="book__fig-eyes ${ev.sleep >= 1 ? 'is-rested' : ''}" />
          <text x="60" y="112" text-anchor="middle" class="book__fig-pct">${fill}%</text>
        </svg>`;
    }

    function stepper(field, value, step, label) {
      return `
        <div class="book__stepper">
          <button type="button" class="btn" data-step="${field}" data-delta="${-step}" aria-label="${t('guides.journal.less')} — ${label}">−</button>
          <output>${value == null ? `<span class="book__muted">${t('guides.journal.notLogged')}</span>` : t('guides.journal.hours', { v: num1.format(value) })}</output>
          <button type="button" class="btn" data-step="${field}" data-delta="${step}" aria-label="${t('guides.journal.more')} — ${label}">+</button>
        </div>`;
    }

    function renderToday() {
      const j = journal();
      const sol = j.day;
      const day = dayOf(j, sol);
      const ev = evaluateDay(day, VALUES);
      const stats = journalStats(j, VALUES);
      const mission = store.get().mission;
      const site = mission.site;
      const surfaceRate = site ? env.sample(site.lat, site.lon, store.get().clock)?.radiationMSvDay ?? null : null;
      const cDays = cruiseDays(mission);
      const dose = doseSummary({ cruiseDays: cDays, sols: stats.lastSol, surfaceMSvDay: surfaceRate });
      const cups = Math.round(VALUES.water / WATER_STEP_L);
      const drunk = Math.round(day.water / WATER_STEP_L);
      const tone = { good: 'var(--ok)', fair: 'var(--yellow, var(--warn))', poor: 'var(--red, var(--bad))' }[ev.status];
      const lastSol = Math.max(stats.lastSol, sol);

      return `
        <section class="book__page book__page--left">
          <div class="book__sol">
            <button type="button" class="btn btn--ghost book__sol-nav" data-sol="${sol - 1}" ${sol <= 1 ? 'disabled' : ''} aria-label="${t('guides.journal.prevSol')}">←</button>
            <div>
              <p class="kicker">${t('guides.journal.solOf', { n: stats.sols.length })}</p>
              <h2 class="book__sol-n">${t('guides.journal.sol', { n: sol })}</h2>
            </div>
            <button type="button" class="btn ${sol >= lastSol ? 'btn--primary' : 'btn--ghost'} book__sol-nav" data-sol="${sol + 1}"
              aria-label="${sol >= lastSol ? t('guides.journal.newSol', { n: sol + 1 }) : t('guides.journal.nextSol')}">${sol >= lastSol ? '+' : '→'}</button>
          </div>
          <p class="book__lead">${t('guides.journal.lead')}</p>
          <div class="book__today">
            ${bodyFigure(ev)}
            <div class="book__score">
              <p class="kicker">${t('guides.journal.score')}</p>
              <p class="book__score-n" style="color:${tone}">${Math.round(ev.score * 100)}</p>
              <p class="book__status book__status--${ev.status}">${t(`guides.journal.status.${ev.status}`)}</p>
            </div>
          </div>
          <h3 class="kicker">${t('guides.journal.calendar')}</h3>
          <div class="book__cal" role="list" title="${t('guides.journal.calendarHint')}">
            ${Array.from({ length: lastSol }, (_, i) => i + 1)
              .map((n) => {
                const e = stats.evals.find((x) => x.sol === n);
                const cls = e ? `is-${e.status}` : 'is-empty';
                return `<button type="button" role="listitem" class="book__cal-dot ${cls} ${n === sol ? 'is-current' : ''}" data-sol="${n}" aria-label="${t('guides.journal.sol', { n })}">${n}</button>`;
              })
              .join('')}
          </div>
        </section>

        <section class="book__page book__page--right">
          <div class="book__log">
            <div class="book__row">
              <div class="book__row-head">
                <h3>${t('guides.journal.water')}</h3>
                <span class="book__val">${t('guides.journal.waterOf', { v: num.format(day.water), target: num.format(VALUES.water) })}</span>
              </div>
              <div class="book__cups">
                ${Array.from({ length: Math.max(cups, drunk) }, (_, i) => `<button type="button" class="book__cup ${i < drunk ? 'is-full' : ''}" data-cup="${i + 1}" aria-label="${(i + 1) * 250} ml"></button>`).join('')}
                <button type="button" class="btn book__cup-add" data-water="${WATER_STEP_L}" aria-label="${t('guides.journal.waterAdd')}">+250 ml</button>
              </div>
              ${glyph(ev.water, 'var(--blue, var(--ok))')}
              <p class="book__note">${ev.waterMissing > 0 ? t('guides.journal.waterMissing', { v: num.format(ev.waterMissing) }) : t('guides.journal.waterDone')} ${srcTag(TARGETS.water.refId)}</p>
            </div>

            <div class="book__row">
              <div class="book__row-head">
                <h3>${t('guides.journal.food')}</h3>
                <span class="book__val">${t('guides.journal.foodOf', { v: num.format(ev.foodKg), target: num.format(VALUES.food) })}</span>
              </div>
              <div class="book__meals">
                ${Array.from({ length: MEALS_PER_DAY }, (_, i) => i + 1)
                  .map((n) => `<button type="button" class="book__meal ${day.meals >= n ? 'is-on' : ''}" data-meal="${n}" aria-pressed="${day.meals >= n}">${t(`guides.journal.meal.${n}`)}</button>`)
                  .join('')}
              </div>
              ${glyph(ev.food, 'var(--yellow, var(--warn))')}
              <p class="book__note">${srcTag(TARGETS.food.refId)}</p>
            </div>

            <div class="book__row book__row--split">
              <div>
                <h3>${t('guides.journal.sleep')}</h3>
                ${stepper('sleep', day.sleep, 0.5, t('guides.journal.sleep'))}
                ${glyph(ev.sleep, 'var(--ink, var(--text))')}
                <p class="book__note">${t('guides.journal.sleepRange', { low: TARGETS.sleep.low, high: TARGETS.sleep.high })} ${srcTag(TARGETS.sleep.refId)}</p>
              </div>
              <div>
                <h3>${t('guides.journal.exercise')}</h3>
                ${stepper('exercise', day.exercise, 0.5, t('guides.journal.exercise'))}
                ${glyph(ev.exercise, 'var(--red, var(--bad))')}
                <p class="book__note">${t('guides.journal.exerciseTarget', { v: TARGETS.exercise.value })} ${srcTag(TARGETS.exercise.refId)}</p>
              </div>
            </div>

            <div class="book__row book__dose">
              <div class="book__row-head">
                <h3>${t('guides.journal.dose')}</h3>
                <span class="book__val">${num1.format(dose.total)} mSv</span>
              </div>
              <div class="glyph-bar glyph-bar--square book__dose-bar" style="--value:${Math.min(1, dose.share).toFixed(3)};--tone:${dose.share > 0.8 ? 'var(--red)' : 'var(--ink)'}"></div>
              <p class="book__note">${t('guides.journal.doseTotal', { v: num1.format(dose.total), limit: CAREER_LIMIT_MSV })} ${srcTag('nasa-std-3001-radiation')}</p>
              <ul class="book__dose-list">
                <li>${cDays ? t('guides.journal.doseCruise', { days: cDays, rate: CRUISE_MSV_PER_DAY }) : t('guides.journal.doseNoPlan')} ${cDays ? srcTag('jpl-rad-cruise') : ''}</li>
                <li>${surfaceRate != null ? `${t('guides.journal.doseSurface', { sols: stats.lastSol, rate: num.format(surfaceRate) })} <span class="badge">${t('core.modelTag')}</span>` : t('guides.journal.doseNoSite')}</li>
              </ul>
              ${surfaceRate != null ? `<p class="book__fine">${t('guides.journal.doseModel')}</p>` : ''}
            </div>
          </div>
        </section>`;
    }

    // ---------- Capítulo: necesidades ----------

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
        <article class="guides__need ${ESSENTIAL_NEEDS.includes(id) ? 'guides__need--key' : ''}">
          <h3>${name}</h3>
          <p class="guides__need-value">${main}</p>
          ${need.value !== null && limits ? `<p class="guides__need-note">${limits}</p>` : ''}
          ${why}
          ${where ? `<p class="guides__need-note">${t('guides.needs.where', { where: esc(where) })}</p>` : ''}
          ${need.ref ? `<p class="guides__src"><span>${t('guides.source')}:</span>${shortLink(need.ref)}</p>` : ''}
        </article>`;
    }

    function renderBody() {
      const needIds = [
        ...NEED_ORDER.filter((id) => ESSENTIAL_NEEDS.includes(id) || NEEDS.has(id)),
        ...[...NEEDS.keys()].filter((id) => !NEED_ORDER.includes(id)),
      ];
      return `
        <section class="book__page book__page--full">
          <h2>${t('guides.needs.title')}</h2>
          <p class="book__lead">${t('guides.needs.lead')}</p>
          <div class="guides__needs">${needIds.map(needCard).join('')}</div>
        </section>`;
    }

    // ---------- Capítulos: guías de emergencia ----------

    function renderGuide(id) {
      const guide = GUIDES.find((g) => g.id === id);
      const key = `guides.guide.${guide.id}`;
      const j = journal();
      const checks = dayOf(j).checks;
      const steps = Array.from({ length: guide.steps }, (_, i) => i + 1);
      const done = steps.filter((n) => checks[`${guide.id}.${n}`]).length;
      return `
        <section class="book__page book__page--left">
          <div class="book__guide-art">${shape(SHAPES[id])}</div>
          <h2>${t(`${key}.name`)}</h2>
          <h3 class="kicker">${t('guides.guides.facts')}</h3>
          <ol class="book__facts">
            ${guide.facts.map((fact) => `<li>${t(`${key}.fact.${fact.id}`)}${sources(fact.refs)}</li>`).join('')}
          </ol>
        </section>
        <section class="book__page book__page--right">
          <div class="book__row-head">
            <h3>${t('guides.journal.checklist')}</h3>
            <span class="book__val">${t('guides.journal.checked', { done, total: guide.steps })}</span>
          </div>
          ${glyph(done / guide.steps, 'var(--red, var(--bad))')}
          <p class="book__note">${t('guides.journal.checklistHint')} · ${t('guides.journal.sol', { n: j.day })}</p>
          <ol class="book__checks">
            ${steps
              .map((n) => {
                const k = `${guide.id}.${n}`;
                return `<li><label class="book__check ${checks[k] ? 'is-done' : ''}"><input type="checkbox" data-check="${k}" ${checks[k] ? 'checked' : ''} /><span class="book__check-n">${n}</span><span>${t(`${key}.step.${n}`)}</span></label></li>`;
              })
              .join('')}
          </ol>
          ${sources(guide.stepRefs, t('guides.guides.basis'))}
          <p class="book__fine">${t('guides.guides.disclaimer')}</p>
          <h3 class="kicker">${t('guides.guides.links')}</h3>
          <div class="guides__links">
            ${guide.links
              .filter((moduleId) => modules.some((m) => m.id === moduleId))
              .map((moduleId) => `<button type="button" class="btn" data-go="${moduleId}">${t(`${moduleId}.title`)}</button>`)
              .join('')}
          </div>
        </section>`;
    }

    // ---------- Navegación ----------

    function show(id, { turn = false } = {}) {
      ui.chapter = CHAPTERS.includes(id) ? id : 'today';
      for (const tab of tabs) tab.setAttribute('aria-current', String(tab.dataset.chapter === ui.chapter));
      const content = ui.chapter === 'today' ? renderToday() : ui.chapter === 'body' ? renderBody() : renderGuide(ui.chapter);
      spread.innerHTML = `<div class="book__pages">${content}</div>${pager(ui.chapter)}`;
      if (turn) {
        spread.classList.remove('is-turning');
        void spread.offsetWidth; // reinicia la animación de hoja
        spread.classList.add('is-turning');
      }
    }

    function changeDay(patch) {
      const j = journal();
      saveJournal(updateDay(j, j.day, patch));
      show(ui.chapter);
    }

    function onClick(event) {
      const target = event.target;
      const chapter = target.closest('[data-chapter]')?.dataset.chapter;
      if (chapter) return show(chapter, { turn: chapter !== ui.chapter });
      const go = target.closest('[data-go]')?.dataset.go;
      if (go) return navigate(go);

      const solBtn = target.closest('[data-sol]');
      if (solBtn && !solBtn.disabled) {
        const j = journal();
        const sol = Math.max(1, Number(solBtn.dataset.sol));
        saveJournal({ ...j, day: sol });
        return show('today', { turn: true });
      }
      const day = dayOf(journal());
      const water = target.closest('[data-water]');
      if (water) return changeDay({ water: Math.round((day.water + Number(water.dataset.water)) * 100) / 100 });
      const cup = target.closest('[data-cup]');
      if (cup) {
        const n = Number(cup.dataset.cup);
        const current = Math.round(day.water / WATER_STEP_L);
        // Tocar el último vaso lleno lo vacía; tocar otro llena hasta ese.
        return changeDay({ water: (current === n ? n - 1 : n) * WATER_STEP_L });
      }
      const meal = target.closest('[data-meal]');
      if (meal) {
        const n = Number(meal.dataset.meal);
        return changeDay({ meals: day.meals >= n ? n - 1 : n });
      }
      const step = target.closest('[data-step]');
      if (step) {
        const field = step.dataset.step;
        const delta = Number(step.dataset.delta);
        const base = day[field] ?? (field === 'sleep' ? TARGETS.sleep.low - delta : 0);
        const next = Math.max(0, Math.min(field === 'sleep' ? 14 : 8, base + delta));
        return changeDay({ [field]: next });
      }
      return undefined;
    }

    function onChange(event) {
      const key = event.target.dataset?.check;
      if (!key) return;
      const day = dayOf(journal());
      changeDay({ checks: { ...day.checks, [key]: event.target.checked } });
    }

    el.addEventListener('click', onClick);
    el.addEventListener('change', onChange);
    show(ui.chapter);

    return () => {
      el.removeEventListener('click', onClick);
      el.removeEventListener('change', onChange);
    };
  },
};

export default mod;
