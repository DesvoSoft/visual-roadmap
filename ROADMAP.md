---
title: Visual Roadmap
subtitle: HOJA DE RUTA
owner: DesvoSoft
started: 2026-10-23 01:05
updated: 2026-10-23 01:45
capacity: 1
version: "0.1"
---

## Contexto

Hoja de ruta del propio proyecto: lo que falta para que más gente lo pruebe y confíe en lo que ve.

## Releases

### v0.7 · Arranque en un comando

| Item | Estado | Progreso | Esfuerzo | Inicio | Fin | Depende | Real | Nota |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T001 npx visual-roadmap instala, inicializa y abre el viewer | done | 100% | 1h | 2026-10-23 01:06 | 2026-10-23 01:06 | — | 50m | test/setup.test.js verde |
| T002 Paquete listo para npm y workflow de release por tag | done | 100% | 30m | 2026-10-23 01:06 | 2026-10-23 01:06 | — | 25m | npm pack ok, 63/63 tests |
| T003 Primer npm publish manual y trusted publishing configurado | planned | 0% | 20m | — | — | — | — | — |

### v0.8 · Un roadmap que no miente

| Item | Estado | Progreso | Esfuerzo | Inicio | Fin | Depende | Real | Nota |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T004 Métrica de cobertura: tiempo con cambios dentro de una tarea activa | done | 100% | 1.5h | 2026-10-23 01:36 | 2026-10-23 01:37 | — | 40m | trust.coverage + tests |
| T005 Indicador de frescura: actividad observada vs. último comando | done | 100% | 2h | 2026-10-23 01:37 | 2026-10-23 01:40 | — | 45m | pulse visto en navegador: live/stale + aviso de salud |
| T006 Detección de sesión muerta en viewer y brief | done | 100% | 1h | 2026-10-23 01:40 | 2026-10-23 01:42 | — | 25m | brief/status avisan stale; 71 tests |
| T007 Hook de git commit-msg para todos los agentes | done | 100% | 1.5h | 2026-10-23 01:42 | 2026-10-23 01:44 | — | 35m | githook.test.js: trailer e2e verde |
| T008 Arranque automático que no elige la tarea equivocada | done | 100% | 2h | 2026-10-23 01:44 | 2026-10-23 01:45 | — | 30m | pickForFiles + e2e; 76 tests |
| T009 Hooks para Cursor y Codex | planned | 0% | 2h | — | — | — | — | — |

### v0.9 · Distribución

| Item | Estado | Progreso | Esfuerzo | Inicio | Fin | Depende | Real |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T010 GIF de 15 s arriba del README | planned | 0% | 45m | — | — | — | — |
| T011 Show HN | planned | 0% | 30m | — | — | — | — |
| T012 Posts en r/ClaudeAI, r/cursor y X con el GIF | planned | 0% | 45m | — | — | — | — |

## Estimaciones

## Últimos cambios

- 01:45 | ✓ | T008 · Arranque automático que no elige la tarea equivocada — pickForFiles + e2e; 76 tests | +111 -10
- 01:44 | ▶ | T008 · Arranque automático que no elige la tarea equivocada
- 01:44 | ✓ | T007 · Hook de git commit-msg para todos los agentes — githook.test.js: trailer e2e verde | +513 -32
- 01:42 | ▶ | T007 · Hook de git commit-msg para todos los agentes
- 01:42 | ✓ | T006 · Detección de sesión muerta en viewer y brief — brief/status avisan stale; 71 tests | +282 -30
- 01:40 | ▶ | T006 · Detección de sesión muerta en viewer y brief
- 01:40 | ✓ | T005 · Indicador de frescura: actividad observada vs. último comando — pulse visto en navegador: live/stale + aviso de salud | +245 -23
- 01:37 | ▶ | T005 · Indicador de frescura: actividad observada vs. último comando
- 01:37 | ✓ | T004 · Métrica de cobertura: tiempo con cambios dentro de una tarea activa — trust.coverage + tests | +360 -49
- 01:36 | ▶ | T004 · Métrica de cobertura: tiempo con cambios dentro de una tarea activa
- 01:06 | ✓ | T002 · Paquete listo para npm y workflow de release por tag — npm pack ok, 63/63 tests | +65 -36
- 01:06 | ▶ | T002 · Paquete listo para npm y workflow de release por tag
- 01:06 | ✓ | T001 · npx visual-roadmap instala, inicializa y abre el viewer — test/setup.test.js verde | +65 -36
- 01:06 | ▶ | T001 · npx visual-roadmap instala, inicializa y abre el viewer
