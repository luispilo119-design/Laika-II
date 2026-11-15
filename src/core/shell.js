/**
 * Shell de la app: barra de fases (src/core/topbar.js), cambio de idioma y montaje de módulos por hash (#/<id>).
 * Dueño: Parte A.
 */
import { store } from './store.js';
import { t, registerMessages, setLang } from './i18n.js';
import { env } from './env.js';
import { modules, PHASES } from './registry.js';
import coreMessages from './messages.js';
import { buildTopbar, setActive } from './topbar.js';
import { el } from './html.js';

const DEFAULT_MODULE = 'home';

function navigate(id) {
  location.hash = `#/${id}`;
}

function currentModule() {
  const id = location.hash.replace(/^#\/?/, '').split('?')[0] || DEFAULT_MODULE;
  return modules.find((m) => m.id === id) ?? modules.find((m) => m.id === DEFAULT_MODULE);
}

/**
 * @param {HTMLElement} root
 * @returns {import('./types.js').Ctx}
 */
export function startShell(root) {
  registerMessages('core', coreMessages);
  for (const mod of modules) registerMessages(mod.id, mod.messages);

  /** @type {import('./types.js').Ctx} */
  const ctx = { store, t, env, navigate, modules, phases: PHASES };

  let cleanup = null;
  // La barra se conserva entre pantallas para que el riel anime el cambio; solo se reconstruye
  // si cambia el idioma.
  let bar = null;
  let barLang = '';

  function topbarFor() {
    const lang = store.get().lang;
    if (!bar || barLang !== lang) {
      bar = buildTopbar({
        t,
        isMock: env.isMock,
        onNavigate: navigate,
        onToggleLang: () => setLang(lang === 'es' ? 'en' : 'es'),
      });
      barLang = lang;
    }
    return bar;
  }

  function render() {
    const mod = currentModule();
    if (typeof cleanup === 'function') {
      try {
        cleanup();
      } catch (err) {
        console.error(`[shell] error al desmontar`, err);
      }
    }
    cleanup = null;
    document.documentElement.lang = store.get().lang;
    document.title = `${t(`${mod.id}.title`)} — Martian Map`;
    root.className = mod.fullscreen ? 'app app--fullscreen' : 'app';
    const view = el('main', 'view');
    view.dataset.module = mod.id;
    if (mod.fullscreen) {
      root.replaceChildren(view);
    } else {
      const topbar = topbarFor();
      // Si la barra ya estaba montada, se deja en su lugar (no se reinserta) para no cortar la animación.
      for (const child of [...root.children]) if (child !== topbar) child.remove();
      if (topbar.parentNode !== root) root.prepend(topbar);
      root.append(view);
      setActive(topbar, mod.id);
    }
    try {
      cleanup = mod.mount(view, ctx) ?? null;
    } catch (err) {
      console.error(`[shell] error al montar "${mod.id}"`, err);
      view.textContent = `Error en el módulo "${mod.id}": ${err.message}`;
    }
  }

  // Los módulos muestrean el entorno de forma síncrona: antes de montar nada se cargan las rejillas.
  let dataReady = false;
  function boot() {
    root.className = 'app';
    root.replaceChildren(el('p', 'app__loading', t('core.loading')));
    env
      .ready()
      .then(() => {
        dataReady = true;
        render();
      })
      .catch((err) => {
        console.error('[shell] no se pudieron cargar los datos', err);
        const box = el('div', 'app__loading');
        const retry = el('button', 'btn btn--primary', t('core.retry'));
        retry.type = 'button';
        retry.addEventListener('click', boot);
        box.append(el('p', null, t('core.loadError')), retry);
        root.replaceChildren(box);
      });
  }

  window.addEventListener('hashchange', () => {
    if (dataReady) render();
  });
  store.subscribe((_state, path) => {
    if (path === 'lang' && dataReady) render();
  });
  boot();

  return ctx;
}
