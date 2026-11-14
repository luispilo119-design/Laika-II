# Martian Map — Interplanetary Survival Guide

Proyecto de hackathon del equipo **LAIKA II** (en honor a Laika, la perrita soviética que orbitó la
Tierra en el Sputnik 2).

Una guía interactiva para sobrevivir en Marte que se recorre **por fases de misión**: se planea el
viaje desde la Tierra con una transferencia de Hohmann, se elige el sitio de aterrizaje sobre un mapa
con capas de datos de la NASA, se vive el tránsito en confinamiento, se desciende en primera persona
y se levantan hubs autónomos comprobando qué zonas son viables.

Funciona en computadora y tablet. Interfaz en español e inglés.

## Arrancar

Requiere Node 20.19 o superior.

```bash
npm install
```

```bash
npm run dev
```

Otros comandos: `npm test` (comprueba que todo texto esté en los dos idiomas) y `npm run build`.

Supabase es opcional para desarrollar: sin `.env.local` la app guarda en el navegador. Para
activarlo, copia `.env.example` como `.env.local` y rellena los dos valores.

## Dónde está cada cosa

| Documento | Para qué |
|---|---|
| [docs/PLAN.md](docs/PLAN.md) | Plan general, fases, división del trabajo y calendario |
| [docs/CONTRATOS.md](docs/CONTRATOS.md) | Interfaces compartidas entre las dos partes |
| [docs/PARTE-A.md](docs/PARTE-A.md) | Tareas de la persona A |
| [docs/PARTE-B.md](docs/PARTE-B.md) | Tareas de la persona B |
| [docs/REFERENCIAS.md](docs/REFERENCIAS.md) | Fuentes de datos y su estado de verificación |
| [docs/BACKLOG.md](docs/BACKLOG.md) | Ideas abiertas para agregar |
| [CLAUDE.md](CLAUDE.md) | Instrucciones para los agentes de IA que trabajan en el repo |

```
src/core/       núcleo compartido (estado, idiomas, shell, entorno, mapa base)   → Parte A
src/modules/    un módulo por pantalla; cada carpeta tiene un dueño              → A o B
src/services/   Supabase y sincronización                                        → Parte B
supabase/       migraciones SQL                                                  → Parte B
tools/          scripts de Python que convierten datos NASA/USGS a rejillas      → Parte A
public/data/    rejillas ya procesadas que carga la web                          → Parte A
```

## Datos

Solo se usan fuentes de la NASA u otras fuentes científicas confiables, y cada cifra enlaza a su
referencia dentro de la app. Mientras la insignia **"Datos simulados"** esté visible, los valores
ambientales son de relleno y no deben citarse.
