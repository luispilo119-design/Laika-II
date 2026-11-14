# Contratos compartidos

Lo que las dos partes pueden dar por cierto. La versión en código está en `src/core/types.js`.
Dueño: Parte A. Cambiar algo de aquí afecta a los dos lados: se acuerda antes y se anota al final.

## 1. Coordenadas y unidades

- `lat`: planetocéntrica, grados, −90..90, norte positivo.
- `lon`: grados, −180..180, **este positivo** (igual que NASA Mars Trek). Leaflet usa `[lat, lon]`.
- Elevación en metros sobre el areoide MOLA. Temperatura en °C. Presión en Pa. Distancias en km.
- Radiación en mSv/día. Irradiancia en W/m². Polvo como opacidad óptica τ.
- Fechas terrestres en ISO 8601 UTC. Tiempo marciano con `Clock`.

## 2. Módulo

```js
// src/modules/<id>/index.js
export default {
  id: 'routes',          // también es la ruta: #/routes
  phase: 4,              // fase de la misión; null = recurso transversal
  owner: 'B',
  task: 'B4',
  fullscreen: false,     // true = sin barra superior
  messages,              // { es: {...}, en: {...} } desde ./i18n.js
  references: [],        // Reference[] que respaldan los datos del módulo
  mount(el, ctx) {       // pinta dentro de el; devuelve una función de limpieza
    return () => {};
  },
};
```

- El shell vuelve a montar el módulo al cambiar de idioma: no guardes estado importante en el DOM,
  guárdalo en el store.
- La limpieza debe quitar listeners globales, temporizadores, `requestAnimationFrame`, mapas y
  contextos WebGL.
- El CSS propio se importa desde `index.js` y usa clases con prefijo del módulo (`.routes__...`).
  Los colores y tamaños salen de las variables de `src/styles/base.css`.

## 3. Contexto (`ctx`)

| Campo | Qué es |
|---|---|
| `ctx.store` | Estado compartido (§4) |
| `ctx.t(key, vars)` | Texto en el idioma actual (§6) |
| `ctx.env` | Datos ambientales (§5) |
| `ctx.navigate(id)` | Cambia de módulo |
| `ctx.modules`, `ctx.phases` | Lista de módulos y fases, para índices y menús |

## 4. Estado

```js
{
  lang: 'es' | 'en',
  clock: { sol, localHour, ls },   // sol 0 = día del aterrizaje; localHour 0..24; ls 0..360
  mission: {
    name: '',
    departure: null,   // ISO; lo escribe hohmann
    arrival: null,     // ISO; lo escribe hohmann
    arrivalLs: null,   // lo escribe hohmann
    site: null,        // { lat, lon, name? }; lo escribe map
    hubs: [],          // Hub[]; lo escribe hubs
    routes: [],        // Route[]; lo escribe routes
  },
}
```

- `store.get()` devuelve el estado; no se muta.
- `store.set('mission.site', valor)` cambia una ruta. Los arreglos se reemplazan completos.
- `store.subscribe((state, path) => {...})` devuelve la función para cancelar.
- `store.replaceMission(mission, clock)` y `store.resetMission()` para cargar o reiniciar.
- Cada campo tiene **un solo módulo que lo escribe**; los demás solo leen. Todo módulo debe
  funcionar cuando los campos que lee son `null` o están vacíos (usa valores por defecto razonables
  y un aviso que lleve al módulo que los fija).
- Las claves de `Hub.type` y `Route.profile` están en `src/core/types.js`.

## 5. Entorno (`ctx.env`)

| Función | Devuelve |
|---|---|
| `env.isMock` | `true` mientras los datos sean de relleno |
| `await env.ready()` | Termina cuando las rejillas están cargadas |
| `env.sample(lat, lon, clock)` | `EnvSample`: elevación, pendiente, temperatura actual/mín/máx, presión, índice de hielo, radiación, polvo, irradiancia |
| `env.evaluate(lat, lon, clock, profile)` | `Evaluation`: puntaje 0–100, veredicto y factores con su peso |
| `await env.craters(bbox, minDiameterKm)` | Lista de `{ lat, lon, diameterKm }` |
| `await env.elevationGrid(bbox, size)` | `ElevationGrid`: `Float32Array` de `size × size` metros, fila 0 al norte |

- `bbox` es `{ south, west, north, east }`.
- `sample` y `evaluate` son síncronas y rápidas: se pueden llamar en cada movimiento del cursor.
- `iceIndex` puede ser `null` (sin datos). Trátalo como "sin datos", no como cero.
- Veredictos: `'viable'` (≥ 65), `'marginal'` (≥ 40), `'not_viable'`. Los umbrales y los pesos por
  perfil están exportados en `src/core/env.js` y se muestran en la interfaz.
- Mientras `env.isMock` sea `true` los números son inventados: sirven para programar, no para citar.

## 6. Textos

- `src/modules/<id>/i18n.js` exporta `{ es: {...}, en: {...} }`; se registra bajo el id del módulo.
- `t('routes.title')`, `t('routes.eta', { horas: 5 })` con marcadores `{horas}`.
- Obligatorias en todo módulo: `title` y `desc`.
- Las mismas claves en los dos idiomas; `npm test` lo comprueba.

## 7. Referencias

```js
{ id: 'hassler2014', title: '...', org: 'NASA/JPL', url: 'https://...', year: 2014, verified: false }
```

Cada módulo lista las suyas en `references`. La pantalla `references` (B7) las reúne leyendo
`ctx.modules`. `verified` pasa a `true` solo cuando alguien abrió el enlace y comprobó el dato.

## 8. Mapa base

```js
import { createMarsMap } from '../../core/marsmap.js';
const mars = createMarsMap(contenedor, { basemap: 'mola', center: [lat, lon], zoom: 4 });
mars.map;                 // instancia de Leaflet: añade aquí marcadores, polilíneas, capas
mars.setBasemap('viking');
mars.destroy();           // llamar en la limpieza del módulo
```

Es la única excepción a "no importar de fuera de tu módulo": `src/core/` se puede importar siempre.

## 9. Servicios y Supabase

- `src/services/index.js` exporta `init(ctx)`; `main.js` lo llama una vez al arrancar.
- Variables: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en `.env.local`.
- Si faltan, `init` no hace nada. Ningún módulo puede fallar por falta de Supabase.
- Lo que se guarda de una misión es `state.mission` más `state.clock`, tal cual.
- Los módulos no llaman a Supabase directamente: usan funciones exportadas por `src/services/`.

## 10. Datos procesados

Las rejillas viven en `public/data/` y solo las lee `src/core/env.js`. Su formato es asunto interno
de la Parte A; los módulos nunca las cargan por su cuenta.

## Registro de cambios de contrato

- 2026-11-14 — Versión inicial.
