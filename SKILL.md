---
name: visual-roadmap
description: Keep ROADMAP.md current so a local viewer can show agent progress and changing ETAs.
applies_to:
  - "ROADMAP.md"
  - "roadmap.md"
---

# Visual Roadmap: protocolo breve para agentes

Actualiza `ROADMAP.md` **solo cuando cambia un hecho**: inicio, fin, bloqueo, alcance, progreso verificable o estimación. El visor calcula el reloj y las alertas entre escrituras. No reescribas el archivo cada minuto.

## Al comenzar

1. Lee la petición y el repositorio. Si falta `ROADMAP.md`, créalo con entregables comprobables; conserva un roadmap existente y corrige solo lo que haga falta.
2. Agrupa las tareas por **versiones o entregas reales**, en orden de dependencia. Usa encabezados `### v0.1 · Nombre`, `### v0.2 · Nombre` (o `### R1 · Nombre`) bajo `## Releases`. No mezcles tareas de instalación del visor con la visión del producto salvo que sean un entregable explícito.
3. Da a cada tarea un ID estable (`T001`), estado, progreso, esfuerzo estimado y dependencias. Mantén una sola tarea `active` si estás trabajando; si acabaste la sesión, deja claro cuál sigue. No marques una versión `done` mientras conserve tareas abiertas.
4. Para el trabajo actual, escribe `now_task.started_at` con fecha y hora local y `now_task.expected` con **tu mejor estimación**, aunque sea aproximada (`45m`, `01:30`, `2h`). Actualiza `updated`.
5. Pon fechas `Inicio` y `Fin` para tareas ya realizadas y para una ventana próxima que puedas planificar razonablemente. Para trabajo lejano o incierto, deja `—`; el visor dibuja una proyección rayada a partir del esfuerzo. No presentes esa proyección como fecha comprometida.

```yaml
---
title: Mi proyecto
updated: 2026-09-26 14:20
capacity: 1
version: "0.1"
now_task:
  id: T001
  name: Integrar autenticación
  context: Fase 1 · Acceso
  started_at: 2026-09-26 14:20
  expected: 01:30
---
```

## Tareas

```markdown
## Releases

### v0.1 · Acceso inicial
`2026-09-26 → 2026-09-28` · **active**

| Item | Estado | Progreso | Owner | Esfuerzo | Inicio | Fin | Depende | Prio |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T001 Integrar autenticación | active | 20% | @agente | 1.5h | 2026-09-26 | 2026-09-26 | — | P0 |
| T002 Pruebas de acceso | planned | 0% | @agente | 1h | 2026-09-26 | 2026-09-28 | T001 | P1 |
```

El progreso debe representar trabajo comprobable. No incrementes porcentajes solo porque pasó tiempo. Mantén el orden de las filas según la secuencia prevista; así el cronograma puede proyectarlas sin depender de una fecha inventada para cada una.

## Al cambiar la ETA

Estima los minutos **restantes** y añade una línea a `## Estimaciones`:

```markdown
## Estimaciones

- 2026-09-26 15:10 | T001 | 50m | Apareció un caso de sesión expirada
```

El visor conserva la ETA inicial, calcula la nueva y muestra la razón. Si la ETA venció, revisa el tiempo restante en el siguiente punto de trabajo relevante. No actualices `elapsed`; el visor lo calcula desde `started_at`.

## Al terminar o bloquearse

- Cambia el estado de la fila y su progreso. Si se terminó, usa `done` y `100%`. Si conoces la duración real, añádela en una columna opcional `Real` (`55m`, `2h`); ayuda a calibrar previsiones futuras.
- Si hay bloqueo, usa `blocked` y registra la causa en `## Últimos cambios`.
- Al empezar la siguiente tarea, cambia `now_task` y su `started_at` y `expected`.
- Actualiza `updated` únicamente cuando escribas cambios reales.

```markdown
## Últimos cambios

- 15:35 | ✓ | T001 Autenticación terminada | +84 -12
- 15:10 | ⚠ | T001 ETA revisada por sesión expirada |
```

Las horas y duraciones son estimaciones; los estados `done`, los porcentajes y los cambios registrados deben corresponder a evidencia del trabajo.
