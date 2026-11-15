/**
 * Reloj marciano: control compartido para mover el sol, la hora local y la estación (Ls).
 * Dueño: Parte A (tarea A3). Escribe `clock` en el store; cualquier módulo puede montarlo:
 *
 *   import { mountClockControl } from '../../core/clock.js';
 *   const unmount = mountClockControl(contenedor, ctx);   // llamar unmount() en la limpieza
 *
 * Si la misión tiene fecha de llegada (la fija Hohmann), el sol y el Ls van atados: el sol 0 es el
 * día del aterrizaje y el Ls de cada sol se calcula con el algoritmo de Mars24. Sin fecha de llegada
 * el Ls se mueve libremente para explorar las estaciones.
 */
import './clock.css';
import { marsLs, northernSeason, isDustSeason, wrap360 } from '../modules/hohmann/orbit.js';

/** Duración del sol marciano en segundos (Mars24, NASA GISS). */
export const SOL_SECONDS = 88775.244;
/** Soles de un año marciano (668.6 soles; Mars24, NASA GISS). */
export const SOLS_PER_YEAR = 668.6;

/** Ls del sol `sol` contado desde la fecha de llegada `arrivalIso`. */
export function lsAtSol(arrivalIso, sol) {
  return marsLs(new Date(new Date(arrivalIso).getTime() + sol * SOL_SECONDS * 1000));
}

export function formatHour(localHour) {
  const total = Math.round((((localHour % 24) + 24) % 24) * 60);
  const hh = Math.floor(total / 60) % 24;
  return `${String(hh).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * @param {HTMLElement} el
 * @param {import('./types.js').Ctx} ctx
 * @returns {() => void} limpieza
 */
export function mountClockControl(el, ctx) {
  const { store, t } = ctx;
  const box = document.createElement('div');
  box.className = 'clock';
  box.innerHTML = `
    <div class="clock__now" aria-live="polite"></div>
    <label class="clock__row">
      <span>${t('core.clock.hour')}</span>
      <input type="range" data-hour min="0" max="23.5" step="0.5" />
    </label>
    <div class="clock__row">
      <span>${t('core.clock.sol')}</span>
      <div class="clock__stepper">
        <button type="button" class="btn" data-sol="-30" aria-label="${t('core.clock.solBack30')}">−30</button>
        <button type="button" class="btn" data-sol="-1" aria-label="${t('core.clock.solBack')}">−1</button>
        <output data-sol-value></output>
        <button type="button" class="btn" data-sol="1" aria-label="${t('core.clock.solNext')}">+1</button>
        <button type="button" class="btn" data-sol="30" aria-label="${t('core.clock.solNext30')}">+30</button>
      </div>
    </div>
    <label class="clock__row">
      <span>${t('core.clock.ls')}</span>
      <input type="range" data-ls min="0" max="359" step="1" />
    </label>
    <p class="clock__note" data-note></p>
    <button type="button" class="btn btn--ghost clock__reset" data-reset>${t('core.clock.reset')}</button>
  `;
  el.append(box);

  const hourInput = box.querySelector('[data-hour]');
  const lsInput = box.querySelector('[data-ls]');
  const now = box.querySelector('.clock__now');
  const solValue = box.querySelector('[data-sol-value]');
  const note = box.querySelector('[data-note]');

  function paint() {
    const { clock, mission } = store.get();
    hourInput.value = String(Math.round(clock.localHour * 2) / 2);
    lsInput.value = String(Math.round(wrap360(clock.ls)) % 360);
    solValue.textContent = String(clock.sol);
    for (const back of box.querySelectorAll('[data-sol^="-"]')) back.disabled = clock.sol <= 0;
    const season = t(`core.clock.season.${northernSeason(clock.ls)}`);
    now.innerHTML = `
      <strong>${t('core.clock.now', { sol: clock.sol, hour: formatHour(clock.localHour) })}</strong>
      <span>${t('core.clock.seasonLine', { ls: Math.round(wrap360(clock.ls)), season })}</span>
      ${isDustSeason(clock.ls) ? `<span class="clock__dust">${t('core.clock.dustSeason')}</span>` : ''}
    `;
    note.textContent = mission.arrival ? t('core.clock.linked') : t('core.clock.free');
  }

  hourInput.addEventListener('input', () => store.set('clock.localHour', Number(hourInput.value)));

  lsInput.addEventListener('input', () => store.set('clock.ls', Number(lsInput.value)));

  for (const btn of box.querySelectorAll('[data-sol]')) {
    btn.addEventListener('click', () => {
      const { clock, mission } = store.get();
      const sol = Math.max(0, clock.sol + Number(btn.dataset.sol));
      const delta = sol - clock.sol;
      if (delta === 0) return;
      // Con fecha de llegada, el Ls sale de la fecha; sin ella, avanza al ritmo medio del año marciano.
      const ls = mission.arrival ? lsAtSol(mission.arrival, sol) : wrap360(clock.ls + (delta * 360) / SOLS_PER_YEAR);
      store.set('clock', { ...clock, sol, ls });
    });
  }

  box.querySelector('[data-reset]').addEventListener('click', () => {
    const { clock, mission } = store.get();
    store.set('clock', { sol: 0, localHour: 12, ls: mission.arrivalLs ?? clock.ls });
  });

  const unsubscribe = store.subscribe((_state, path) => {
    if (path === 'clock' || path.startsWith('clock.') || path === 'mission' || path.startsWith('mission.arrival')) paint();
  });
  paint();

  return () => {
    unsubscribe();
    box.remove();
  };
}
