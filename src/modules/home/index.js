/**
 * Módulo "home": pantalla de inicio tipo videojuego. Dueño: Parte B — tarea B1 (docs/PARTE-B.md).
 * Esto es una versión mínima funcional (título, INICIAR, índice, idioma) para que la app se pueda
 * recorrer desde ya. B1 la reemplaza con el fondo ASCII animado y el menú completo.
 */
import messages from './i18n.js';
import { setLang } from '../../core/i18n.js';

/** @type {import('../../core/types.js').ModuleDef} */
const mod = {
  id: 'home',
  phase: 0,
  owner: 'B',
  task: 'B1',
  fullscreen: true,
  messages,
  references: [],
  mount(el, ctx) {
    const { t, modules, phases, store, navigate } = ctx;
    const groups = [
      ...phases.filter((p) => p.id !== 0).map((p) => ({ label: t(p.key), mods: modules.filter((m) => m.phase === p.id) })),
      { label: t('core.phase.resources'), mods: modules.filter((m) => m.phase == null) },
    ].filter((g) => g.mods.length > 0);

    el.innerHTML = `
      <section class="home">
        <img class="home__logo" src="./laika-logo.png" alt="LAIKA II" />
        <p class="home__kicker">${t('home.subtitle')}</p>
        <h1 class="home__title">MARTIAN MAP</h1>
        <div class="home__actions">
          <button type="button" class="btn btn--primary" data-action="start">${t('home.start')}</button>
          <button type="button" class="btn btn--ghost" data-action="lang">${t('core.langToggle')}</button>
        </div>
        <h2 class="home__index-title">${t('home.index')}</h2>
        <div class="home__index">
          ${groups
            .map(
              (g) => `
            <div class="home__group">
              <h3>${g.label}</h3>
              <ul>${g.mods.map((m) => `<li><a href="#/${m.id}">${t(`${m.id}.title`)}</a></li>`).join('')}</ul>
            </div>`,
            )
            .join('')}
        </div>
        <p class="home__credit">${t('home.credit')}</p>
      </section>
    `;

    el.querySelector('[data-action="start"]').addEventListener('click', () => navigate('hohmann'));
    el.querySelector('[data-action="lang"]').addEventListener('click', () =>
      setLang(store.get().lang === 'es' ? 'en' : 'es'),
    );
  },
};

export default mod;
