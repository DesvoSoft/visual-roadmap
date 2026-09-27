---
title: VOIDFRONT
subtitle: HOJA DE RUTA
owner: DesvoSoft
started: 2026-09-25 17:17
updated: 2026-09-26 22:15
timezone: America/Mexico_City
week_start: mon
capacity: 1
version: "0.1"
phase: 11
phase_total: 14
tests: 397
e2e: 37
decisions: 92
lines: 29421
last_commit: "335e3ea"
last_commit_time: "hace 49 min"
now_task:
  id: "T109"
  name: "Props del mundo"
  context: "Fase 11 · Resto de assets · Arte procedural"
  expected: "01:15"
  elapsed: "49 min"
  status: "tarda más de lo previsto"
---

## Últimos cambios

- 01:15 | ✓ | Cairn props y collision meshes | +1163 -251
- 23:55 | 📄 | tools: pipeline de exportación | +29 -2
- 23:52 | 📄 | roadmap: sync de entregables | +5 -0
- 23:51 | ✓ | Kit de iluminación volumétrica | +1175 -42
- 22:44 | 📄 | roadmap: estimación de esfuerzo | +4 -0
- 22:43 | ✓ | Asteroides procedurales LODs | +751 -84

## Contexto

Visor y seguimiento del desarrollo de **VOIDFRONT** en vivo.
El agente autónomo actualiza este archivo en cada commit o cambio de tarea sin interrumpir al usuario.

## Releases

### Fase 11 · Resto de assets
`2026-09-25 → 2026-09-28` · **active** · 82%

#### Arte procedural y combate

| Item | Estado | Progreso | Owner | Esfuerzo | Inicio | Fin | Depende | Prio |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T041 Proyectiles y armas | done | 100% | @desvosoft | 6h | 2026-09-25 | 2026-09-25 | — | P0 |
| T042 Escudos y daño por pieza | done | 100% | @desvosoft | 8h | 2026-09-25 | 2026-09-26 | T041 | P0 |
| T043 Órdenes de ataque | done | 100% | @desvosoft | 5h | 2026-09-26 | 2026-09-26 | T042 | P1 |
| T109 Props del mundo | active | 65% | @desvosoft | 8h | 2026-09-26 | 2026-09-27 | — | P0 |
| T110 Shaders de atmósfera planetaria | planned | 0% | @desvosoft | 6h | 2026-09-27 | 2026-09-28 | T109 | P1 |
| T111 Optimización de drawcalls | planned | 0% | @desvosoft | 4h | 2026-09-28 | 2026-09-28 | T110 | P0 |

### Fase 12 · Red y sincronización
`2026-09-29 → 2026-10-05` · **planned** · 0%

#### Core multijugador

| Item | Estado | Progreso | Owner | Esfuerzo | Inicio | Fin | Depende | Prio |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T112 Protocolo de snapshots de estado | planned | 0% | @desvosoft | 8h | 2026-09-29 | 2026-09-30 | T111 | P0 |
| T113 Client prediction para naves | planned | 0% | @desvosoft | 10h | 2026-10-01 | 2026-10-03 | T112 | P0 |

## Hitos

| Hito | Fecha | Release | Estado | Nota |
| --- | --- | --- | --- | --- |
| Alpha 0.1 | 2026-09-27 | Fase 11 | pending | Combate y props funcionales |
| Beta 0.2 | 2026-10-05 | Fase 12 | pending | Pruebas de servidor multijugador |

## Log

- [x] 2026-09-25 — T041 completado: físicas de proyectiles balísticos.
- [x] 2026-09-26 — T042 completado: mallas destructibles y absorción de energía.
- [x] 2026-09-26 — T043 completado: lógica de selección de objetivos y comandos de flota.
- [ ] 2026-09-26 — T109 en curso: modelos procedurales de estaciones y debris.
