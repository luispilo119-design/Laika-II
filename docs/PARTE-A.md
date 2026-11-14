# Parte A — De la Tierra al sitio de aterrizaje

Persona A (dueña del repositorio) y su agente. Antes de empezar: [CLAUDE.md](../CLAUDE.md),
[PLAN.md](PLAN.md) y [CONTRATOS.md](CONTRATOS.md).

Rama de trabajo: `parte-a`. Marca cada casilla al terminar la tarea.

**Responsabilidad extra de esta parte:** mantener el núcleo (`src/core/`) y los contratos. Si un
cambio aquí afecta a la Parte B, se avisa y se anota en el registro al final de CONTRATOS.md.

| Tarea | Prioridad | Horas | Punto de integración |
|---|---|---|---|
| A0 Base y despliegue | P0 | 1 | I1 |
| A1 Transferencia de Hohmann | P0 | 6 | I1 |
| A2 Mapa con capas | P0 | 4 | I1 |
| A3 Datos reales y reloj marciano | P0 | 7 | I2 |
| A4 Ficha de zona y sitio de aterrizaje | P0 | 5 | I2–I3 |
| A5 Hubs autónomos | P0 | 6 | I3 |
| A6 Pulido y tablet | P1 | 2 | I4 |

---

## A0 · Base y despliegue

- [x] Esqueleto: Vite, shell con barra de fases, store, idiomas, registro de módulos, módulos
      provisionales, entorno de relleno, mapa base con mosaicos de Mars Trek, prueba de idiomas.
- [ ] Flujo de GitHub Actions que construye y publica en GitHub Pages en cada push a `main`
      (`.github/workflows/deploy.yml`). Requiere activar Pages en el repositorio (PLAN.md §9).
- [ ] Variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` como variables del repositorio para
      el build publicado, cuando la persona B las tenga.

**Hecho cuando:** el enlace público abre la app en una tablet.

## A1 · Transferencia de Hohmann — `src/modules/hohmann/`

Es el arranque de la Fase 1: se planea el viaje **desde la Tierra**.

**Cálculo** (`orbit.js`, funciones puras con pruebas en `tests/`):

- Transferencia de Hohmann entre órbitas circulares y coplanares (Tierra 1 UA, Marte 1.524 UA):
  semieje de la elipse, tiempo de viaje, Δv de salida y de llegada, ángulo de fase necesario,
  periodo sinódico.
- Posición de la Tierra y Marte en una fecha con los elementos orbitales aproximados de JPL.
- Próximas ventanas de lanzamiento a partir de una fecha: días en que Marte adelanta a la Tierra por
  el ángulo de fase.
- Fecha de llegada, y Ls de Marte en esa fecha con el algoritmo de Mars24 (NASA GISS).

Valores esperados para comprobar el cálculo (órbitas circulares): viaje ≈ 259 días, Δv heliocéntrico
≈ 2.94 km/s a la salida y ≈ 2.65 km/s a la llegada, ángulo de fase ≈ 44°, periodo sinódico ≈ 780 días.
Las ventanas calculadas deben caer cerca de los periodos reales de lanzamiento a Marte
(julio de 2020, finales de 2026).

**Pantalla:**

- Diagrama del Sol, las dos órbitas y la elipse de transferencia, animado.
- Vista **por fases** con un control de pasos: 1) esperar la ventana, 2) impulso de salida,
  3) crucero, 4) llegada. Cada paso explica qué pasa, cuánto dura y qué Δv cuesta.
- Selector de fecha y lista de las próximas ventanas.
- Resumen: fecha de salida, fecha de llegada, días de viaje, estación marciana al llegar y aviso si
  la llegada cae en temporada de tormentas de polvo.
- Botón "Usar este plan": escribe `mission.departure`, `mission.arrival`, `mission.arrivalLs` y pone
  `clock.ls` en el Ls de llegada. Luego lleva al mapa.
- Nota visible: es la aproximación de Hohmann; las misiones reales usan trayectorias más precisas.

**Hecho cuando:** al elegir una fecha se ven las ventanas, la animación recorre las cuatro fases y
el plan queda guardado en el store; las pruebas de `orbit.js` pasan con los valores esperados.

**Fuentes:** elementos orbitales aproximados (JPL SSD), algoritmo de Mars24 (NASA GISS), material
educativo de JPL sobre ventanas de lanzamiento a Marte.

- [x] `orbit.js` con pruebas (`tests/orbit.test.js`): reproduce los dos ejemplos resueltos de Mars24,
      las oposiciones de Marte y cae a menos de 20 días de cinco lanzamientos reales.
- [x] Diagrama animado por fases
- [x] Ventanas, resumen y guardado del plan

**Cómo quedó:** las ventanas no usan el ángulo de fase fijo de libro sino la condición equivalente
con posiciones reales (Marte debe estar a 180° de donde salió la Tierra cuando llegue la nave), y la
media elipse va de la distancia real de la Tierra al salir a la de Marte al llegar. Por eso cada
ventana da una duración distinta (entre unos 236 y 282 días). Los valores de libro se muestran en
"Cómo se calcula".

**Pendiente menor (pasa a A6):** en tablet, el título y los pasos quedan debajo del diagrama.

## A2 · Mapa con capas — `src/modules/map/`

- [x] Mapa base con dos mosaicos de Mars Trek (imagen Viking y topografía MOLA).
- [ ] Registro de capas dentro del módulo: cada capa es una entrada con nombre, tipo, leyenda y
      referencia. Selector con opacidad.
- [ ] Capas superpuestas: hielo subterráneo (SWIM), temperatura, radiación, polvo, cráteres grandes,
      sitios de aterrizaje históricos y recorridos de Curiosity y Perseverance.
- [ ] Leyenda por capa con unidades y fuente.

**Hecho cuando:** se pueden encender y apagar las capas en tablet y cada una muestra su leyenda y
su fuente.

**Fuentes:** NASA Mars Trek, USGS Astrogeology, mapas SWIM, base de cráteres de Robbins y Hynek.

## A3 · Datos reales y reloj marciano — `tools/`, `public/data/`, `src/core/env.js`

Reemplaza el relleno de `env` por datos reales **sin cambiar las firmas** de CONTRATOS.md §5.

- [ ] `tools/`: scripts de Python que descargan y reducen cada producto a una rejilla global ligera
      (por ejemplo 1° o 0.5°) en `public/data/`, con un `README` que diga de dónde salió cada archivo.
- [ ] Elevación y pendiente desde MOLA.
- [ ] Índice de hielo desde SWIM (con `null` donde el mapa no cubre).
- [ ] Cráteres desde la base de Robbins y Hynek, filtrados por diámetro.
- [ ] Temperatura mínima, máxima y por hora según latitud, estación (Ls) y hora local, y opacidad de
      polvo por estación. Preferencia: rejillas de Mars Climate Database; si no da tiempo, un modelo
      analítico ajustado a mediciones de REMS/MEDA y **etiquetado como modelo** en `modeled`.
- [ ] Presión a partir de la elevación; radiación en superficie a partir de la medición de RAD
      ajustada por elevación (etiquetada como modelo).
- [ ] `env.isMock = false` y cada factor con su `refId` real.
- [ ] Control de reloj marciano en el shell o en el mapa: sol, hora local y estación; escribe `clock`.
- [ ] `src/core/human-needs.js`: necesidades diarias del cuerpo humano (agua, oxígeno, alimento,
      presión, temperatura, límites de radiación) con su referencia. Lo usa A4 y lo lee la Parte B
      para las guías (B6).

**Hecho cuando:** la insignia "Datos simulados" desaparece, mover el reloj cambia las temperaturas en
el mapa, y cada número de `env.sample` se puede rastrear hasta un archivo y una referencia.

**Fuentes:** MOLA (Smith et al. 2001), SWIM (Morgan et al. 2021), Robbins y Hynek (2012), Mars
Climate Database, REMS y MEDA en el PDS, RAD (Hassler et al. 2014), NASA-STD-3001.

## A4 · Ficha de zona y sitio de aterrizaje — `src/modules/map/`

- [ ] Al tocar un punto se abre la ficha: condiciones del lugar en el instante del reloj y, al lado,
      lo que necesita el cuerpo humano. Un porcentaje por factor y el puntaje global.
- [ ] Desglose visible de la fórmula: valor, puntaje, peso y fuente de cada factor.
- [ ] Restricciones de aterrizaje aparte de la viabilidad (elevación, pendiente, latitud) con su fuente.
- [ ] Botón "Elegir como sitio de aterrizaje": escribe `mission.site`.
- [ ] Mejores zonas: recorrer la rejilla y marcar las de mayor puntaje para el instante actual.

**Hecho cuando:** se puede tocar cualquier punto, entender por qué es viable o no, y dejar elegido
el sitio.

## A5 · Hubs autónomos — `src/modules/hubs/`

- [ ] Paleta de tipos de hub (hábitat, invernadero, planta solar, extracción de hielo, pista de
      aterrizaje); cada tipo usa su perfil de pesos de `env.evaluate`.
- [ ] Colocación estilo juego de estrategia: el hub sigue al cursor o al dedo con una vista previa
      verde, ámbar o roja según el veredicto en ese punto; un toque lo coloca.
- [ ] Panel del hub: viable / marginal / no viable y todos los porcentajes del cruce de datos.
- [ ] Lista de hubs colocados, con mover y eliminar; escribe `mission.hubs`.
- [ ] Reglas entre hubs (por ejemplo distancia máxima al hábitat) si queda tiempo.

**Hecho cuando:** se puede colocar cada tipo de hub en tablet, ver su veredicto con el desglose, y
los hubs siguen ahí al recargar.

**Fuentes:** las de A3, más la presentación de NASA-MSFC sobre hábitats autónomos (Tashakkor, 2022)
para lo que un hub necesita para operar sin tripulación.

## A6 · Pulido y tablet

- [ ] Recorrido completo en una tablet real o a 768 px: fases 1 y 4 sin tropiezos.
- [ ] Revisar que todas las referencias de los módulos de A estén verificadas.
- [ ] Guion de demo de 3 minutos.
