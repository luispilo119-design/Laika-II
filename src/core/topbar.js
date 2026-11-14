/**
 * Barra superior: la misión como un riel de estaciones. Cada pantalla es una estación; la línea
 * se llena hasta la estación activa, que crece en rojo, y las recorridas quedan rellenas.
 * Dueño: Parte A.
 */
import { modules, PHASES } from './registry.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/** Nombre corto para el menú; si no hay, el título del módulo. */
function shortLabel(t, id) {
  const key = `core.nav.${id}`;
  const short = t(key);
  return short === key ? t(`${id}.title`) : short;
}

/**
 * @param {object} opts
 * @param {(key: string, vars?: object) => string} opts.t
 * @param {boolean} opts.isMock
 * @param {(id: string) => void} opts.onNavigate
 * @param {() => void} opts.onToggleLang
 * @returns {HTMLElement}
 */
export function buildTopbar({ t, isMock, onNavigate, onToggleLang }) {
  const bar = el('header', 'topbar');

  // ---- Marca ----
  const brand = el('a', 'topbar__brand');
  brand.href = '#/home';
  const logo = el('img');
  logo.src = './laika-logo.png';
  logo.alt = 'LAIKA II';
  const brandText = el('span', 'topbar__brand-text');
  brandText.append(el('span', 'topbar__brand-team', 'LAIKA II'), el('span', 'topbar__brand-app', t('core.appName')));
  brand.append(logo, brandText);

  // ---- Navegación ----
  const nav = el('nav', 'topbar__nav');
  nav.setAttribute('aria-label', t('core.menu.aria'));
  nav.append(el('span', 'topbar__rail'), el('span', 'topbar__rail-fill'));

  const groups = [
    ...PHASES.filter((p) => p.id !== 0).map((p) => ({
      phase: String(p.id),
      chip: t('core.menu.phaseShort', { n: p.id }),
      label: t(p.key),
      mods: modules.filter((m) => m.phase === p.id),
    })),
    {
      phase: 'res',
      chip: t('core.phase.resources'),
      label: t('core.phase.resources'),
      mods: modules.filter((m) => m.phase == null),
    },
  ].filter((g) => g.mods.length > 0);

  for (const group of groups) {
    const box = el('div', 'topbar__group');
    box.dataset.phase = group.phase;
    box.style.setProperty('--n', String(group.mods.length));
    const chip = el('span', 'topbar__phase', group.chip);
    chip.setAttribute('aria-hidden', 'true');
    box.append(chip);
    for (const mod of group.mods) {
      const link = el('a', 'topbar__item');
      link.href = `#/${mod.id}`;
      link.dataset.id = mod.id;
      link.dataset.phase = group.phase;
      const label = shortLabel(t, mod.id);
      link.title = `${t(`${mod.id}.title`)} · ${group.label}`;
      link.setAttribute('aria-label', `${label} — ${t(`${mod.id}.title`)}, ${group.label}`);
      const cap = el('span', 'topbar__cap');
      cap.append(el('span', 'topbar__dot'), el('span', 'topbar__label', label));
      link.append(cap);
      box.append(link);
    }
    nav.append(box);
  }

  nav.addEventListener('click', (event) => {
    const link = event.target.closest('.topbar__item');
    if (!link || event.defaultPrevented) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const id = link.dataset.id;
    if (id === bar.dataset.active) return;
    // Primero se mueve el riel y se deja pintar un cuadro; luego se monta el módulo (que puede
    // tardar). Las animaciones usan transform, así que siguen fluidas aunque el montaje bloquee.
    setActive(bar, id);
    requestAnimationFrame(() => setTimeout(() => onNavigate(id), 0));
  });

  // ---- Herramientas ----
  const tools = el('div', 'topbar__tools');
  if (isMock) {
    const badge = el('span', 'badge badge--warn', t('core.mockBadge'));
    badge.title = t('core.mockHint');
    tools.append(badge);
  }
  const langBtn = el('button', 'btn btn--ghost', t('core.langToggle'));
  langBtn.type = 'button';
  langBtn.addEventListener('click', onToggleLang);
  tools.append(langBtn);

  bar.append(brand, nav, tools);

  // Recalcula el riel cuando cambia el tamaño o cargan las fuentes.
  let frame = 0;
  const relayout = () => {
    cancelAnimationFrame(frame);
    nav.classList.add('is-resizing');
    placeRail(nav);
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => nav.classList.remove('is-resizing'));
    });
  };
  if (typeof ResizeObserver === 'function') new ResizeObserver(relayout).observe(nav);
  document.fonts?.ready.then(relayout).catch(() => {});

  return bar;
}

/** Marca el módulo activo y mueve el riel. Llamar con la barra ya dentro del documento. */
export function setActive(bar, id) {
  bar.dataset.active = id;
  let passed = true;
  for (const item of bar.querySelectorAll('.topbar__item')) {
    const on = item.dataset.id === id;
    if (on) passed = false;
    item.classList.toggle('is-active', on);
    item.classList.toggle('is-passed', passed);
    if (on) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  }
  for (const group of bar.querySelectorAll('.topbar__group')) {
    group.classList.toggle('is-current', Boolean(group.querySelector('.is-active')));
  }
  placeRail(bar.querySelector('.topbar__nav'));
  // Las transiciones se activan después del primer acomodo, para que nada "vuele" al cargar.
  if (!bar.classList.contains('is-ready')) {
    requestAnimationFrame(() => requestAnimationFrame(() => bar.classList.add('is-ready')));
  }
}

/** El riel va del primer al último punto de las fases y se llena hasta el punto activo. */
function placeRail(nav) {
  if (!nav?.isConnected) return;
  const dots = [...nav.querySelectorAll('.topbar__item:not([data-phase="res"]) .topbar__dot')];
  if (dots.length < 2 || !dots[0].offsetParent) return;
  const box = nav.getBoundingClientRect();
  const ox = box.left + nav.clientLeft;
  const oy = box.top + nav.clientTop;
  const center = (dot) => {
    const r = dot.getBoundingClientRect();
    return { x: r.left + r.width / 2 - ox, y: r.top + r.height / 2 - oy };
  };
  const active = nav.querySelector('.topbar__item.is-active');
  const first = center(dots[0]);
  const last = center(dots[dots.length - 1]);
  const target = active && active.dataset.phase !== 'res' ? center(active.querySelector('.topbar__dot')) : last;
  const span = Math.max(1, last.x - first.x);
  // En teléfono las estaciones pasan a varias filas: ahí el riel continuo se oculta.
  nav.classList.toggle('rail-wraps', Math.abs(last.y - first.y) >= 2);
  nav.style.setProperty('--rail-x', `${first.x}px`);
  nav.style.setProperty('--rail-y', `${first.y}px`);
  nav.style.setProperty('--rail-w', String(span));
  nav.style.setProperty('--rail-p', String(Math.min(1, Math.max(0, (target.x - first.x) / span))));
}
