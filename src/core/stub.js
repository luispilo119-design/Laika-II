/** Pantalla provisional para módulos que aún no se construyen. Dueño: Parte A. */

/**
 * @param {HTMLElement} el
 * @param {import('./types.js').Ctx} ctx
 * @param {import('./types.js').ModuleDef} mod
 */
export function mountStub(el, ctx, mod) {
  const { t } = ctx;
  el.innerHTML = `
    <section class="stub">
      <p class="stub__tag">${t('core.stub.pending')} · ${t('core.stub.owner', { owner: mod.owner })}</p>
      <h1>${t(`${mod.id}.title`)}</h1>
      <p class="stub__desc">${t(`${mod.id}.desc`)}</p>
      <p class="stub__task">${t('core.stub.task', { task: mod.task, owner: mod.owner })}</p>
    </section>
  `;
}
