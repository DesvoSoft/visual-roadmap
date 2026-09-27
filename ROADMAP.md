---
title: Visual Roadmap
subtitle: Visor de roadmaps en vivo, reutilizable en sesiones y proyectos con IA
owner: johan
started: 2026-09-25
updated: 2026-09-26
timezone: America/Mexico_City
week_start: mon
capacity: 1
ai_agent: Antigravity
ai_task: "R1 completado — tokens, watcher, board, timeline, log, app, shell y SKILL.md"
ai_phase: R1
---

## Contexto

Roadmap en **un único archivo Markdown** que la IA crea al abrir una sesión y va
actualizando durante el trabajo. El visor lo renderiza en vivo con el lenguaje
visual del RSI Progress Tracker: board kanban + timeline gantt.

Principio de diseño: **la IA no inventa fechas, las deriva de un presupuesto de
esfuerzo y de la capacidad declarada.** Todo ítem lleva horas, toda fecha es
auditable y el visor avisa cuando el calendario se vuelve imposible.

Planificado a **6 h/día efectiva** con capacidad 1, ~75-85 % de utilización:
holgura real para QA, revisión y los imprevistos que siempre aparecen.

## Releases

### R1 · Cimientos
`2026-09-28 → 2026-10-09` · **active** · 78%

Lo mínimo para que el visor funcione: esquema, parser, shell y watcher.

#### Core

| Item | Estado | Progreso | Owner | Esfuerzo | Inicio | Fin | Depende | Prio |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Definir esquema ROADMAP.md y ejemplo seed | done | 100% | @johan | 4h | 2026-09-25 | 2026-09-25 | — | P0 |
| tokens.css con paleta real extraída del bundle | done | 100% | @johan | 3h | 2026-09-25 | 2026-09-25 | — | P1 |
| md.js: frontmatter, releases y tablas | done | 100% | @johan | 10h | 2026-09-28 | 2026-09-30 | Definir esquema ROADMAP.md | P0 |
| md.js: checklists e Hitos | done | 100% | @johan | 5h | 2026-10-01 | 2026-10-02 | md.js: frontmatter | P2 |
| Watcher con File System Access API | done | 100% | @johan | 6h | 2026-09-26 | 2026-09-26 | — | P0 |
| Shell index.html y navegación de vistas | done | 100% | @johan | 4h | 2026-09-26 | 2026-09-26 | — | P0 |
| Fallback drag&drop y canal SSE | done | 100% | @johan | 4h | 2026-09-26 | 2026-09-26 | Watcher con File System | P2 |
| viewer.css base y scrollbar custom | done | 100% | @johan | 3h | 2026-09-26 | 2026-09-26 | Shell index.html | P1 |
| board.js: columnas, cards, categorías | done | 100% | @johan | 8h | 2026-09-26 | 2026-09-26 | md.js: frontmatter | P0 |
| timeline.js: gantt con barras y hitos | done | 100% | @johan | 10h | 2026-09-26 | 2026-09-26 | Shell index.html | P0 |
| log.js: vista del ## Log | done | 100% | @johan | 3h | 2026-09-26 | 2026-09-26 | md.js: checklists | P2 |
| app.js: AI status panel + wiring | done | 100% | @johan | 6h | 2026-09-26 | 2026-09-26 | board.js | P0 |
| SKILL.md universal para agentes de IA | done | 100% | @johan | 5h | 2026-09-26 | 2026-09-26 | — | P0 |

#### QA

| Item | Estado | Progreso | Owner | Esfuerzo | Inicio | Fin | Depende | Prio |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Test de parseo sobre el ejemplo seed | planned | 0% | @johan | 3h | 2026-10-08 | 2026-10-08 | md.js: checklists | P1 |
| Verificar render en Chrome, Edge y Firefox | planned | 0% | @johan | 3h | 2026-10-09 | 2026-10-09 | Test de parseo | P1 |

### R2 · Vistas
`2026-10-12 → 2026-11-04` · **planned** · 0%

Las dos vistas del sitio original, con su interacción real.

#### Board

| Item | Estado | Progreso | Owner | Esfuerzo | Inicio | Fin | Depende | Prio |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Columnas por release con header y contador | planned | 0% | @johan | 12h | 2026-10-12 | 2026-10-14 | — | P0 |
| Buscador con resaltado de coincidencias | planned | 0% | @johan | 8h | 2026-10-15 | 2026-10-16 | Columnas por release | P1 |
| Cards con progreso, owner y prioridad | planned | 0% | @johan | 6h | 2026-10-19 | 2026-10-20 | Columnas por release | P0 |
| Categorías colapsables con CardCount | planned | 0% | @johan | 6h | 2026-10-21 | 2026-10-22 | Cards con progreso | P1 |

#### Timeline

| Item | Estado | Progreso | Owner | Esfuerzo | Inicio | Fin | Depende | Prio |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Escala temporal con sticky header | planned | 0% | @johan | 6h | 2026-10-13 | 2026-10-15 | Shell index.html | P0 |
| Swimlanes por categoría | planned | 0% | @johan | 9h | 2026-10-23 | 2026-10-27 | Escala temporal | P0 |
| Filtros por estado y orden por criterio | planned | 0% | @johan | 6h | 2026-10-26 | 2026-10-27 | Cards con progreso | P1 |
| Barras por fase y marca de hoy | planned | 0% | @johan | 8h | 2026-10-28 | 2026-10-30 | Swimlanes | P0 |
| Estados vacíos y No Data Available | planned | 0% | @johan | 3h | 2026-10-29 | 2026-10-29 | Swimlanes | P2 |
| Hitos en forma de diamante | planned | 0% | @johan | 5h | 2026-11-02 | 2026-11-02 | Barras por fase | P2 |

#### Common

| Item | Estado | Progreso | Owner | Esfuerzo | Inicio | Fin | Depende | Prio |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Sincronización de filtros entre vistas | planned | 0% | @johan | 4h | 2026-11-03 | 2026-11-03 | Filtros por estado | P2 |

#### QA

| Item | Estado | Progreso | Owner | Esfuerzo | Inicio | Fin | Depende | Prio |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| QA cruzado de las dos vistas | planned | 0% | @johan | 6h | 2026-11-04 | 2026-11-04 | Hitos en forma de diamante | P1 |

### R3 · IA y pulido
`2026-11-05 → 2026-11-25` · **planned** · 0%

Lo que hace que la IA mantenga el roadmap sola sin degradar el calendario.

#### Core

| Item | Estado | Progreso | Owner | Esfuerzo | Inicio | Fin | Depende | Prio |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Skill de opencode con SKILL.md y esquema | planned | 0% | @johan | 10h | 2026-11-05 | 2026-11-06 | QA cruzado | P0 |
| Reglas de tiempos realistas en el skill | planned | 0% | @johan | 8h | 2026-11-09 | 2026-11-10 | Skill de opencode | P0 |
| Check de realism en el visor | planned | 0% | @johan | 8h | 2026-11-11 | 2026-11-12 | Reglas de tiempos | P0 |
| Panel de resumen y métricas del proyecto | planned | 0% | @johan | 6h | 2026-11-13 | 2026-11-13 | Check de realism | P1 |

#### UI

| Item | Estado | Progreso | Owner | Esfuerzo | Inicio | Fin | Depende | Prio |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Vista Log con las checklists del Markdown | planned | 0% | @johan | 6h | 2026-11-16 | 2026-11-16 | md.js: checklists | P2 |
| Persistir vista y filtros en localStorage | planned | 0% | @johan | 4h | 2026-11-17 | 2026-11-17 | Vista Log | P2 |
| Pulido visual y responsive | planned | 0% | @johan | 8h | 2026-11-18 | 2026-11-19 | Persistir vista | P1 |

#### QA

| Item | Estado | Progreso | Owner | Esfuerzo | Inicio | Fin | Depende | Prio |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| README y guía de instalación | planned | 0% | @johan | 4h | 2026-11-20 | 2026-11-20 | Pulido visual | P2 |
| QA final cross-browser | planned | 0% | @johan | 6h | 2026-11-23 | 2026-11-23 | Pulido visual | P1 |
| Ajuste de fechas tras el QA final | planned | 0% | @johan | 4h | 2026-11-24 | 2026-11-24 | QA final cross-browser | P1 |

## Hitos

| Hito | Fecha | Release | Estado | Nota |
| --- | --- | --- | --- | --- |
| Alpha del visor | 2026-10-09 | R1 | pending | El seed renderiza en ambas vistas |
| Columnas del board | 2026-10-22 | R2 | pending | Columnas, cards y categorías |
| Gantt completo | 2026-11-02 | R2 | pending | Swimlanes, barras e hitos |
| Beta con skill de IA | 2026-11-13 | R3 | pending | La IA mantiene el roadmap sola |
| v1.0 | 2026-11-25 | R3 | pending | Documentado y cross-browser |

## Log

- [x] 2026-09-25 — Decidido el esquema de 9 columnas por ítem y el frontmatter.
- [x] 2026-09-25 — Analizado el bundle de RSI Progress Tracker: estructura de componentes y paleta.
- [x] 2026-09-26 — Escrito md.js con check de realism (sobre-asignación, dependencias y fechas vencidas).
- [x] 2026-09-26 — R1 completo en una sesión: tokens.css, watcher.js, board.js, timeline.js, log.js, app.js, viewer.css, index.html.
- [x] 2026-09-26 — SKILL.md universal creado: compatible con Antigravity, Claude, Codex, OpenCode y cualquier agente con acceso a ficheros.
- [ ] Siguiente: QA visual en Chrome/Edge, ajuste de estilos y prueba de actualización en vivo.
