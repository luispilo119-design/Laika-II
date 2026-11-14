/**
 * Shell de la app: barra de fases, cambio de idioma y montaje de módulos por hash (#/<id>).
 * Dueño: Parte A.
 */
import { store } from './store.js';
import { t, registerMessages, setLang } from './i18n.js';
import { env } from './env.js';
import { modules, PHASES } from './registry.js';
import coreMessages from './messages.js';

const DEFAULT_MODULE = 'home';

function navigate(id) {
  location.hash = `#/${id}`;
}

function currentModule() {
  const id = location.hash.replace(/^#\/?/, '').split('?')[0] || DEFAULT_MODULE;
  return modules.find((m) => m.id === id) ?? modules.find((m) => m.id === DEFAULT_MODULE);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function buildTopbar(active) {
  const bar = el('header', 'topbar');

  const brand = el('a', 'topbar__brand');
  brand.href = '#/home';
  const logo = el('img');
  logo.src = './laika-logo.png';
  logo.alt = 'LAIKA II';
  const brandText = el('span', 'topbar__brand-text');
  brandText.append(el('span', 'topbar__brand-team', 'LAIKA II'), el('span', 'topbar__brand-app', t('core.appName')));
  brand.append(logo, brandText);
  bar.append(brand);

  const nav = el('nav', 'topbar__nav');
  const groups = [
    ...PHASES.filter((p) => p.id !== 0).map((p) => ({ label: t(p.key), mods: modules.filter((m) => m.phase === p.id) })),
    { label: t('core.phase.resources'), mods: modules.filter((m) => m.phase == null) },
  ];
  for (const group of groups) {
    if (group.mods.length === 0) continue;
    const box = el('div', 'topbar__group');
    box.append(el('span', 'topbar__phase', group.label));
    const links = el('div', 'topbar__links');
    for (const mod of group.mods) {
      const link = el('a', mod.id === active.id ? 'is-active' : '', t(`${mod.id}.title`));
      link.href = `#/${mod.id}`;
      links.append(link);
    }
    box.append(links);
    nav.append(box);
  }
  bar.append(nav);

  const tools = el('div', 'topbar__tools');
  if (env.isMock) {
    const badge = el('span', 'badge badge--warn', t('core.mockBadge'));
    badge.title = t('core.mockHint');
    tools.append(badge);
  }
  const langBtn = el('button', 'btn btn--ghost', t('core.langToggle'));
  langBtn.type = 'button';
  langBtn.addEventListener('click', () => setLang(store.get().lang === 'es' ? 'en' : 'es'));
  tools.append(langBtn);
  bar.append(tools);

  return bar;
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
    root.replaceChildren();
    root.className = mod.fullscreen ? 'app app--fullscreen' : 'app';
    if (!mod.fullscreen) root.append(buildTopbar(mod));
    const view = el('main', 'view');
    view.dataset.module = mod.id;
    root.append(view);
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
