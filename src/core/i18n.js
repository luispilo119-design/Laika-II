/**
 * Textos bilingües. Dueño: Parte A.
 * Cada módulo trae su propio archivo i18n.js ({ es: {...}, en: {...} }) y el shell lo registra
 * bajo el id del módulo. Uso: t('hohmann.title'), t('core.phase.1'), t('x.msg', { dias: 259 }).
 * Regla: toda clave existe en es Y en en (tests/i18n.test.js lo comprueba).
 */
import { store } from './store.js';

export const LANGS = ['es', 'en'];

const messages = { es: {}, en: {} };

export function registerMessages(namespace, dict) {
  for (const lang of LANGS) messages[lang][namespace] = dict?.[lang] ?? {};
}

function lookup(lang, key) {
  return key
    .split('.')
    .reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), messages[lang]);
}

export function t(key, vars = {}) {
  const found = lookup(store.get().lang, key) ?? lookup('es', key);
  if (typeof found !== 'string') return key;
  return found.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
}

export function setLang(lang) {
  if (!LANGS.includes(lang)) return;
  store.set('lang', lang);
}
