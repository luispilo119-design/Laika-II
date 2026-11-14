/**
 * Módulo "home": pantalla de inicio tipo videojuego. Dueño: Parte B — tarea B1 (docs/PARTE-B.md).
 * Fondo ASCII animado (blackhole.js), menú principal, índice de módulos por fase y créditos.
 */
import './home.css';
import messages from './i18n.js';
import { setLang, LANGS } from '../../core/i18n.js';
import { getStatus, onStatus, lastModule } from '../../services/index.js';
import { createBlackHole } from './blackhole.js';

const LANG_NAMES = { es: 'Español', en: 'English' };

/**
 * Estado de la pantalla que debe sobrevivir a un remontaje (el shell vuelve a montar el módulo
 * al cambiar de idioma): si el índice está abierto y qué control tenía el foco.
 */
const ui = { panel: false, focus: null };

/** true si la persona ya fijó algo de la misión. */
function hasMission(mission) {
  return Boolean(
    mission.name || mission.departure || mission.arrival || mission.site || mission.hubs.length || mission.routes.length,
  );
}

/**
 * A dónde lleva CONTINUAR: a la última fase de la misión que se visitó (las pantallas de
 * recursos no cuentan) o, si no se sabe, al siguiente paso pendiente.
 */
function resumeTarget(mission, modules) {
  const last = lastModule();
  if (last && modules.some((m) => m.id === last && m.phase != null && m.phase !== 0)) return last;
  if (!mission.departure || !mission.arrival) return 'hohmann';
  if (!mission.site) return 'map';
  if (mission.hubs.length === 0) return 'transit';
  if (mission.routes.length === 0) return 'routes';
  return 'guides';
}

/** Dónde va el agujero negro: a la derecha en horizontal, arriba en vertical (ver home.css). */
function holeLayout(width, height) {
  if (width / height <= 1.1) {
    return { fx: 0.5, fy: 0.27, unit: Math.min((width * 0.96) / 25, (height * 0.42) / 11) };
  }
  return { fx: 0.69, fy: 0.47, unit: Math.min((width * 0.74) / 25, (height * 0.95) / 12) };
}

/** @type {import('../../core/types.js').ModuleDef} */
const mod = {
  id: 'home',
  phase: 0,
  owner: 'B',
  task: 'B1',
  fullscreen: true,
  messages,
  references: [
    {
      id: 'jin2-black-hole',
      title: 'BLACK-HOLE — animación ASCII de un agujero negro (inspiración visual del fondo)',
      org: 'JIN2 (@jin_22ee)',
      url: 'https://github.com/JIN2-ASCII/-JIN2-ASCII/tree/main/BLACK-HOLE',
      year: 2026,
      verified: true,
    },
    {
      // Respalda la dedicatoria: Sputnik 2 se lanzó el 3 de noviembre de 1957 con la perra Laika.
      id: 'nasa-dawn-space-age',
      title: 'Dawn of the Space Age (Sputnik 1 y Sputnik 2, con Laika a bordo)',
      org: 'NASA History',
      url: 'https://www.nasa.gov/history/dawn-of-the-space-age/',
      verified: true,
    },
  ],
  mount(el, ctx) {
    const { t, modules, phases, store, navigate } = ctx;
    const { lang, mission } = store.get();
    const resume = hasMission(mission) ? resumeTarget(mission, modules) : null;
    const groups = [
      ...phases
        .filter((p) => p.id !== 0)
        .map((p) => ({ label: t(p.key), mods: modules.filter((m) => m.phase === p.id) })),
      { label: t('core.phase.resources'), mods: modules.filter((m) => m.phase == null) },
    ].filter((g) => g.mods.length > 0);

    el.innerHTML = `
      <section class="home__stage">
        <canvas class="home__bg" aria-hidden="true"></canvas>
        <div class="home__scrim" aria-hidden="true"></div>

        <div class="home__hud">
          <header class="home__brand">
            <img class="home__mark" src="./laika-logo.png" alt="" width="56" height="56" />
            <p class="home__team">${t('core.team')}</p>
          </header>

          <div class="home__main">
            <p class="home__tagline">${t('home.subtitle')}</p>
            <h1 class="home__name">MARTIAN <br />MAP</h1>

            <nav class="home__menu" aria-label="${t('home.menuLabel')}">
              <button type="button" class="home__item home__item--primary" data-action="start">${t('home.start')}</button>
              ${
                resume
                  ? `<button type="button" class="home__item" data-action="continue">
                       ${t('home.continue')}<span class="home__hint">${t(`${resume}.title`)}</span>
                     </button>`
                  : ''
              }
              <button type="button" class="home__item" data-action="index" aria-haspopup="dialog">${t('home.index')}</button>
              <div class="home__lang" role="group" aria-label="${t('home.language')}">
                <span class="home__lang-label">${t('home.language')}</span>
                ${LANGS.map(
                  (code) => `
                  <button type="button" class="home__lang-btn" data-lang="${code}" lang="${code}"
                    aria-pressed="${code === lang}">${LANG_NAMES[code] ?? code.toUpperCase()}</button>`,
                ).join('')}
              </div>
            </nav>
          </div>

          <footer class="home__foot">
            <p class="home__sync" role="status"></p>
            <p class="home__dedication">${t('home.credit')}</p>
          </footer>
        </div>

        <div class="home__panel" role="dialog" aria-modal="true" aria-labelledby="home-index-title" hidden>
          <div class="home__panel-head">
            <h2 id="home-index-title">${t('home.index')}</h2>
            <button type="button" class="btn" data-action="close">${t('home.back')}</button>
          </div>
          <div class="home__phases">
            ${groups
              .map(
                (g) => `
              <section class="home__phase">
                <h3>${g.label}</h3>
                <ul>
                  ${g.mods
                    .map(
                      (m) => `
                    <li>
                      <a class="home__link" href="#/${m.id}">
                        <strong>${t(`${m.id}.title`)}</strong>
                        <span>${t(`${m.id}.desc`)}</span>
                      </a>
                    </li>`,
                    )
                    .join('')}
                </ul>
              </section>`,
              )
              .join('')}
          </div>
        </div>
      </section>
    `;

    const hud = el.querySelector('.home__hud');
    const menu = el.querySelector('.home__menu');
    const panel = el.querySelector('.home__panel');
    const syncLine = el.querySelector('.home__sync');

    const stopAnimation = createBlackHole(el.querySelector('.home__bg'), holeLayout);

    // ---- Estado del guardado (local o nube) ----
    function paintStatus(status) {
      syncLine.dataset.status = status;
      syncLine.textContent = t(`home.sync.${status}`);
    }
    paintStatus(getStatus());
    const stopStatus = onStatus(paintStatus);

    // ---- Índice ----
    function setPanel(open, moveFocus = true) {
      ui.panel = open;
      panel.hidden = !open;
      hud.inert = open;
      if (!moveFocus) return;
      const target = open ? panel.querySelector('[data-action="close"]') : menu.querySelector('[data-action="index"]');
      target?.focus({ preventScroll: true });
    }

    // ---- Acciones ----
    function onClick(event) {
      const langBtn = event.target.closest('[data-lang]');
      if (langBtn) {
        const code = langBtn.dataset.lang;
        if (code !== store.get().lang) {
          ui.focus = `[data-lang="${code}"]`;
          setLang(code); // el shell vuelve a montar esta pantalla
        }
        return;
      }
      if (event.target.closest('.home__link')) {
        ui.panel = false; // al volver al inicio, el índice aparece cerrado
        return;
      }
      const action = event.target.closest('[data-action]')?.dataset.action;
      if (action === 'start') navigate('hohmann');
      else if (action === 'continue') navigate(resume);
      else if (action === 'index') setPanel(true);
      else if (action === 'close') setPanel(false);
    }

    // ---- Teclado: flechas para moverse por el menú o el índice, Escape para cerrar ----
    const STEP = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
    function onKeydown(event) {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === 'Escape' && ui.panel) {
        event.preventDefault();
        setPanel(false);
        return;
      }
      const isEdge = event.key === 'Home' || event.key === 'End';
      if (!(event.key in STEP) && !isEdge) return;
      const items = [...(ui.panel ? panel : menu).querySelectorAll('button, a[href]')];
      if (items.length === 0) return;
      const at = items.indexOf(document.activeElement);
      let next;
      if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = items.length - 1;
      else if (at === -1) next = STEP[event.key] > 0 ? 0 : items.length - 1;
      else next = (at + STEP[event.key] + items.length) % items.length;
      event.preventDefault();
      items[next].focus();
    }

    el.addEventListener('click', onClick);
    document.addEventListener('keydown', onKeydown);

    // ---- Restaurar lo que había antes de un cambio de idioma ----
    if (ui.panel) setPanel(true, false);
    if (ui.focus) {
      el.querySelector(ui.focus)?.focus({ preventScroll: true });
      ui.focus = null;
    }

    return () => {
      stopAnimation();
      stopStatus();
      el.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKeydown);
    };
  },
};

export default mod;
