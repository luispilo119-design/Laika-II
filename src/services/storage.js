/**
 * Lectura y escritura segura en localStorage para los servicios. Dueño: Parte B.
 * Si el navegador no deja usar el almacenamiento (modo privado, cuota llena), no falla:
 * leer devuelve el valor por defecto y escribir no hace nada.
 */

/** @returns {{ read: (key: string, fallback: any) => any, write: (key: string, value: any) => void }} */
export function browserStorage() {
  return {
    read(key, fallback) {
      try {
        const raw = globalThis.localStorage?.getItem(key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    write(key, value) {
      try {
        globalThis.localStorage?.setItem(key, JSON.stringify(value));
      } catch {
        /* almacenamiento no disponible */
      }
    },
  };
}

/** Almacenamiento en memoria, para pruebas. */
export function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial).map(([k, v]) => [k, JSON.stringify(v)]));
  return {
    read(key, fallback) {
      return data.has(key) ? JSON.parse(data.get(key)) : fallback;
    },
    write(key, value) {
      data.set(key, JSON.stringify(value));
    },
  };
}
