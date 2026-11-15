/**
 * Módulo "dashboard": tablero con todo lo de la misión y reporte para imprimir o guardar en PDF.
 * Dueño: Parte A. Solo lee del store y de env (no importa otros módulos); el diario de
 * supervivencia se resume con src/core/journal.js, el mismo cálculo que usa la guía.
 */
import './dashboard.css';
import messages from './i18n.js';
import {
  CAREER_LIMIT_MSV,
  readJournal,
  journalStats,
  cruiseDays,
  doseSummary,
  targetValues,
} from '../../core/journal.js';
import { esc } from '../../core/html.js';
import { collectReferences } from '../../core/references.js';


const VERDICT_TONE = { viable: 'var(--ok)', marginal: 'var(--yellow)', not_viable: 'var(--red)' };

/** @type {import('../../core/types.js').ModuleDef} */
const mod = {
  id: 'dashboard',
  phase: 6,
  owner: 'A',
  task: 'A9',
  messages,
  references: [],
  mount(el, ctx) {
    const { t, store, env, navigate, modules } = ctx;
    const { lang, mission, clock } = store.get();
    const locale = lang === 'es' ? 'es-MX' : 'en-US';
    const n0 = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
    const n1 = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
    const n2 = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
    const date = (iso) => (iso ? new Date(iso).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }) : '—');
    const coords = (lat, lon) => t('core.coords', { lat: n2.format(lat), lon: n2.format(lon) });
    const modelTag = `<span class="badge">${t('dashboard.model')}</span>`;
    const verdictChip = (v) => `<span class="dash__verdict" style="--tone:${VERDICT_TONE[v]}">${t(`core.verdict.${v}`)}</span>`;

    // ---------- Datos ----------
    const values = targetValues();
    const journal = readJournal(mission.journal);
    const stats = journalStats(journal, values);
    const days = cruiseDays(mission);
    const site = mission.site;
    const sample = site ? env.sample(site.lat, site.lon, clock) : null;
    const evaluation = site ? env.evaluate(site.lat, site.lon, clock, 'habitat') : null;
    const dose = doseSummary({ cruiseDays: days, sols: stats.sols.length ? stats.lastSol : 0, surfaceMSvDay: sample?.radiationMSvDay ?? null });
    const hubs = mission.hubs ?? [];
    const routes = mission.routes ?? [];
    const count = (v) => hubs.filter((h) => h.verdict === v).length;
    const km = routes.reduce((s, r) => s + (r.distanceKm ?? 0), 0);
    const hours = routes.reduce((s, r) => s + (r.durationH ?? 0), 0);
    const modeled = new Set(sample?.modeled ?? []);

    const steps = [
      { id: 'plan', done: days > 0, go: 'hohmann', shape: 'circle' },
      { id: 'site', done: !!site, go: 'map', shape: 'square' },
      { id: 'hubs', done: hubs.length > 0, go: 'hubs', shape: 'triangle' },
      { id: 'routes', done: routes.length > 0, go: 'routes', shape: 'half' },
      { id: 'journal', done: stats.sols.length > 0, go: 'guides', shape: 'ring' },
    ];
    const doneCount = steps.filter((s) => s.done).length;

    // Todas las referencias de todos los módulos, sin repetir (las mismas de la pantalla Referencias).
    const refList = collectReferences(modules)
      .map((entry) => entry.ref)
      .sort((a, b) => (a.org || '').localeCompare(b.org || '') || a.title.localeCompare(b.title));

    // ---------- Vista ----------
    const kpi = (label, big, sub, extra = '', tone = '') => `
      <article class="dash__kpi" ${tone ? `style="--accent:${tone}"` : ''}>
        <p class="kicker">${label}</p>
        <p class="dash__big">${big}</p>
        <p class="dash__sub">${sub}</p>
        ${extra}
      </article>`;

    const envRow = (label, value, unit, field) =>
      `<tr><th scope="row">${label}</th><td>${value == null ? `<span class="dash__muted">${t('dashboard.noData')}</span>` : `${value} ${unit}`}</td><td>${modeled.has(field) ? modelTag : ''}</td></tr>`;

    el.innerHTML = `
      <div class="dash">
        <header class="dash__head">
          <div>
            <p class="kicker">${t('dashboard.kicker')}</p>
            <label class="dash__name">
              <span class="dash__sr">${t('dashboard.nameLabel')}</span>
              <input type="text" value="${esc(mission.name)}" placeholder="${t('dashboard.namePlaceholder')}" maxlength="60" />
            </label>
            <p class="dash__sub">${t('dashboard.generated', { date: new Date().toLocaleString(locale) })}</p>
          </div>
          <div class="dash__actions">
            <button type="button" class="btn btn--primary" data-print>${t('dashboard.print')}</button>
            <p class="dash__hint">${t('dashboard.printHint')}</p>
          </div>
        </header>

        <section class="dash__progress" aria-label="${t('dashboard.progress')}">
          <div class="dash__progress-head">
            <h2>${t('dashboard.progress')}</h2>
            <span class="dash__count">${doneCount}/${steps.length}</span>
          </div>
          <div class="glyph-bar glyph-bar--square dash__progress-bar" style="--value:${doneCount / steps.length};--tone:var(--red)"></div>
          <ol class="dash__steps">
            ${steps
              .map(
                (s, i) => `
              <li class="dash__step ${s.done ? 'is-done' : ''}">
                <span class="dash__shape dash__shape--${s.shape}" aria-hidden="true"></span>
                <span class="dash__step-n">${String(i + 1).padStart(2, '0')}</span>
                <span class="dash__step-name">${t(`dashboard.step.${s.id}`)}</span>
                <span class="dash__step-state">${s.done ? t('dashboard.done') : t('dashboard.pending')}</span>
                <button type="button" class="btn btn--ghost dash__go" data-go="${s.go}">${t('dashboard.go')} →</button>
              </li>`,
              )
              .join('')}
          </ol>
        </section>

        <section class="dash__kpis">
          ${kpi(
            t('dashboard.kpi.journey'),
            days ? t('dashboard.kpi.journeyDays', { n: days }) : '—',
            days ? t('dashboard.kpi.journeyDates', { dep: date(mission.departure), arr: date(mission.arrival) }) : t('dashboard.kpi.noPlan'),
            mission.arrivalLs != null ? `<p class="dash__sub">${t('dashboard.kpi.arrivalLs', { ls: n0.format(mission.arrivalLs) })}</p>` : '',
            'var(--blue)',
          )}
          ${kpi(
            t('dashboard.kpi.site'),
            evaluation ? evaluation.score : '—',
            site ? coords(site.lat, site.lon) : t('dashboard.kpi.noSite'),
            evaluation ? verdictChip(evaluation.verdict) : '',
            evaluation ? VERDICT_TONE[evaluation.verdict] : '',
          )}
          ${kpi(t('dashboard.kpi.hubs'), hubs.length, t('dashboard.kpi.hubsSplit', { v: count('viable'), m: count('marginal'), n: count('not_viable') }), '', 'var(--yellow)')}
          ${kpi(t('dashboard.kpi.routes'), routes.length, t('dashboard.kpi.routesSum', { km: n0.format(km), h: n1.format(hours) }), '', 'var(--ink)')}
          ${kpi(
            t('dashboard.kpi.survival'),
            t('dashboard.kpi.sols', { n: stats.sols.length }),
            t('dashboard.kpi.survivalSum', { score: n0.format(stats.avgScore * 100), streak: stats.streak, water: n1.format(stats.totalWater) }),
            '',
            'var(--ok)',
          )}
          ${kpi(
            t('dashboard.kpi.dose'),
            `${n0.format(dose.total)} <small>mSv</small>`,
            t('dashboard.kpi.doseOf', { limit: CAREER_LIMIT_MSV }),
            `<div class="glyph-bar" style="--value:${Math.min(1, dose.share).toFixed(3)};--tone:${dose.share > 0.8 ? 'var(--red)' : 'var(--ink)'}"></div>`,
            'var(--red)',
          )}
        </section>

        ${
          sample
            ? `
        <section class="dash__section">
          <h2>${t('dashboard.env.title')}</h2>
          <p class="dash__sub">${t('dashboard.env.lead')} · ${coords(site.lat, site.lon)}</p>
          <div class="dash__cols">
            <table class="dash__table">
              <tbody>
                ${envRow(t('dashboard.env.elevation'), n0.format(sample.elevationM), 'm', 'elevationM')}
                ${envRow(t('dashboard.env.slope'), n1.format(sample.slopeDeg), '°', 'slopeDeg')}
                ${envRow(t('dashboard.env.tempMin'), n0.format(sample.temperatureMinC), '°C', 'temperatureMinC')}
                ${envRow(t('dashboard.env.tempMax'), n0.format(sample.temperatureMaxC), '°C', 'temperatureMaxC')}
                ${envRow(t('dashboard.env.pressure'), n0.format(sample.pressurePa), 'Pa', 'pressurePa')}
                ${envRow(t('dashboard.env.ice'), sample.iceIndex == null ? null : n2.format(sample.iceIndex), '', 'iceIndex')}
                ${envRow(t('dashboard.env.radiation'), n2.format(sample.radiationMSvDay), 'mSv/d', 'radiationMSvDay')}
                ${envRow(t('dashboard.env.dust'), n2.format(sample.dustOpacity), '', 'dustOpacity')}
                ${envRow(t('dashboard.env.solar'), n0.format(sample.solarWm2), 'W/m²', 'solarWm2')}
              </tbody>
            </table>
            <div>
              <h3 class="kicker">${t('dashboard.env.factors')}</h3>
              <ul class="dash__factors">
                ${evaluation.factors
                  .map(
                    (f) => `
                  <li>
                    <div class="dash__factor-head"><span>${t(`core.factor.${f.id}`)}</span><span>${f.noData ? t('dashboard.noData') : f.score} · ${t('dashboard.env.weight', { w: n0.format(f.weight * 100) })}</span></div>
                    <div class="glyph-bar" style="--value:${(f.score / 100).toFixed(2)};--tone:${f.score >= 65 ? 'var(--ok)' : f.score >= 40 ? 'var(--yellow)' : 'var(--red)'}"></div>
                  </li>`,
                  )
                  .join('')}
              </ul>
            </div>
          </div>
        </section>`
            : ''
        }

        <section class="dash__section">
          <h2>${t('dashboard.hubs.title')}</h2>
          ${
            hubs.length
              ? `<table class="dash__table dash__table--grid">
            <thead><tr><th>#</th><th>${t('dashboard.hubs.type')}</th><th>${t('dashboard.hubs.coords')}</th><th>${t('dashboard.hubs.score')}</th><th>${t('dashboard.hubs.verdict')}</th></tr></thead>
            <tbody>${hubs
              .map(
                (h, i) =>
                  `<tr><td>${i + 1}</td><td>${t(`hubs.type.${h.type}.name`)}</td><td>${coords(h.lat, h.lon)}</td><td>${h.score ?? '—'}</td><td>${h.verdict ? verdictChip(h.verdict) : '—'}</td></tr>`,
              )
              .join('')}</tbody>
          </table>`
              : `<p class="dash__muted">${t('dashboard.hubs.none')}</p>`
          }
        </section>

        <section class="dash__section">
          <h2>${t('dashboard.routes.title')}</h2>
          ${
            routes.length
              ? `<table class="dash__table dash__table--grid">
            <thead><tr><th>#</th><th>${t('dashboard.routes.vehicle')}</th><th>${t('dashboard.routes.distance')}</th><th>${t('dashboard.routes.duration')}</th></tr></thead>
            <tbody>${routes
              .map(
                (r, i) =>
                  `<tr><td>${i + 1}</td><td>${t(`routes.profile.${r.profile}.name`)}${r.from || r.to ? `<br><small class="dash__muted">${esc(r.from ?? '·')} → ${esc(r.to ?? '·')}</small>` : ''}</td><td>${n1.format(r.distanceKm ?? 0)} km</td><td>${r.durationH != null ? `${n1.format(r.durationH)} h` : '—'}</td></tr>`,
              )
              .join('')}</tbody>
          </table>`
              : `<p class="dash__muted">${t('dashboard.routes.none')}</p>`
          }
        </section>

        <section class="dash__section">
          <h2>${t('dashboard.journal.title')}</h2>
          ${
            stats.evals.length
              ? `<table class="dash__table dash__table--grid">
            <thead><tr><th>${t('dashboard.journal.sol')}</th><th>${t('dashboard.journal.water')}</th><th>${t('dashboard.journal.meals')}</th><th>${t('dashboard.journal.sleep')}</th><th>${t('dashboard.journal.exercise')}</th><th>${t('dashboard.journal.score')}</th></tr></thead>
            <tbody>${stats.evals
              .map(
                (e) =>
                  `<tr><td>${e.sol}</td><td>${n2.format(e.day.water)}</td><td>${e.day.meals}/3</td><td>${e.day.sleep == null ? '—' : n1.format(e.day.sleep)}</td><td>${n1.format(e.day.exercise)}</td><td><span class="dash__dot dash__dot--${e.status}"></span>${n0.format(e.score * 100)}</td></tr>`,
              )
              .join('')}</tbody>
          </table>`
              : `<p class="dash__muted">${t('dashboard.journal.none')}</p>`
          }
        </section>

        <section class="dash__section dash__refs">
          <h2>${t('dashboard.refs.title')}</h2>
          <p class="dash__sub">${t('dashboard.refs.lead')}</p>
          <ol>
            ${refList.map((r) => `<li><strong>${esc(r.org)}</strong> — ${esc(r.title)}${r.year ? ` (${r.year})` : ''}. <a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.url)}</a></li>`).join('')}
          </ol>
        </section>

        <footer class="dash__footer">${t('dashboard.footer')}</footer>
      </div>
    `;

    const nameInput = el.querySelector('.dash__name input');
    const onInput = () => store.set('mission.name', nameInput.value.slice(0, 60));
    const onClick = (event) => {
      if (event.target.closest('[data-print]')) return window.print();
      const go = event.target.closest('[data-go]')?.dataset.go;
      if (go) navigate(go);
      return undefined;
    };
    nameInput.addEventListener('change', onInput);
    el.addEventListener('click', onClick);
    return () => {
      nameInput.removeEventListener('change', onInput);
      el.removeEventListener('click', onClick);
    };
  },
};

export default mod;
