# Instrucciones para agentes — Martian Map (LAIKA II)

Hackathon con plazo corto y **dos personas trabajando en paralelo**, cada una con su propio agente,
en computadoras distintas sobre este mismo repositorio. El trabajo está dividido para que no se pisen.

## Antes de tocar nada

1. Lee [docs/PLAN.md](docs/PLAN.md) y [docs/CONTRATOS.md](docs/CONTRATOS.md).
2. Averigua qué parte te toca. **Persona A** es quien creó el repositorio; **Persona B** es la segunda
   persona del equipo. Si no lo sabes con certeza, pregúntale a la persona con la que trabajas.
3. Lee tu archivo: [docs/PARTE-A.md](docs/PARTE-A.md) o [docs/PARTE-B.md](docs/PARTE-B.md). Las tareas
   están en orden de prioridad, con criterio de "hecho cuando".

## Reglas

**Territorio.** Edita solo las carpetas de tu parte (tabla en docs/PLAN.md §3). `src/core/`,
`index.html`, `package.json`, `vite.config.js`, `docs/PLAN.md` y `docs/CONTRATOS.md` son de la Parte A.
Si la Parte B necesita un cambio ahí, lo pide a la persona A o lo manda en un commit aparte que toque
solo ese archivo, explicando por qué. Nunca edites el archivo de tareas de la otra parte.

**Contratos.** Los módulos se comunican solo por `ctx` (store, t, env, navigate). No importes
archivos de un módulo ajeno. No cambies la forma del estado ni las firmas de `env` sin acordarlo.

**Datos científicos.** No inventes cifras. Cada dato que se muestre debe tener una referencia de la
NASA u otra fuente confiable registrada en `references` del módulo. Marca `verified: true` solo
después de abrir el enlace y comprobar que respalda el dato. Si un valor sale de un modelo o de una
aproximación, dilo en la interfaz. Si no hay dato para una zona, muestra "sin datos", no un cero.

**Bilingüe.** Todo texto visible va en `i18n.js` del módulo, en `es` y en `en`. `npm test` falla si
falta una clave en algún idioma.

**Tablet.** Objetivos táctiles de al menos 44 px, nada que dependa de pasar el ratón por encima,
y que se vea bien a 768 px de ancho.

**Supabase es opcional.** La app debe arrancar y funcionar sin `.env.local`. No subas llaves al
repositorio; la `service_role` nunca va en el código del cliente.

**Juegos.** Los minijuegos son originales; no se recrea ningún juego existente.

## Flujo de git

- Rama de trabajo: `parte-a` o `parte-b`. No se hace force-push a `main`.
- Commits pequeños. Antes de integrar: `npm test` y `npm run build` deben pasar.
- Integra a `main` al cerrar cada tarea: `git pull --rebase origin main`, luego merge y push.
- Al terminar una tarea, marca su casilla en tu archivo `docs/PARTE-X.md`.
- Dependencia nueva: instálala en un commit que solo toque `package.json` y `package-lock.json`,
  e intégralo enseguida para que la otra parte lo reciba.

## Comandos

```bash
npm run dev
```

```bash
npm test
```

```bash
npm run build
```

## Cómo está hecho

Vite + JavaScript sin framework. Cada pantalla es un módulo en `src/modules/<id>/` que exporta un
`ModuleDef` (ver `src/core/types.js`) con `mount(el, ctx)`; el shell lo monta según el hash `#/<id>`.
Leaflet para el mapa (`src/core/marsmap.js`), Three.js para la primera persona, Supabase para guardar.
Los identificadores de código van en inglés; documentación, comentarios y commits, en español.
