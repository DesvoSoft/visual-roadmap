# Formato de `ROADMAP.md`

El archivo pertenece al proyecto que se está siguiendo. El visor lo lee; el agente lo modifica cuando hay cambios comprobables. `SKILL.md` contiene el protocolo breve para el agente.

## Ejemplo mínimo

```markdown
---
title: Mi proyecto
updated: 2026-09-27 09:00
capacity: 1
version: "0.1"
now_task:
  id: T001
  name: Crear el flujo de acceso
  context: v0.1 · Acceso inicial
  started_at: 2026-09-27 09:00
  expected: 90m
---

## Releases

### v0.1 · Acceso inicial
`2026-09-27 → 2026-09-29` · **active**

| Item | Estado | Progreso | Esfuerzo | Inicio | Fin | Depende |
| --- | --- | --- | --- | --- | --- | --- |
| T001 Crear el flujo de acceso | active | 20% | 2h | 2026-09-27 | 2026-09-27 | — |
| T002 Verificar sesiones | planned | 0% | 1h | 2026-09-28 | 2026-09-29 | T001 |

## Estimaciones

- 2026-09-27 10:00 | T001 | 50m | Se añadió un caso de sesión expirada

## Últimos cambios

- 10:00 | ↻ | T001: ETA revisada por el nuevo caso
```

## Reglas

- Usa encabezados `### v0.1 · Nombre` o `### R1 · Nombre` dentro de `## Releases`. Mantén IDs estables y coloca las versiones en el orden previsto.
- Cada tarea tiene un ID `T001`, `T002`, etc. Los estados admitidos son `planned`, `active`, `blocked`, `risk`, `done` y `cancelled`. Una tarea `done` tiene `100%`; no marques una versión terminada si conserva trabajo abierto.
- `Esfuerzo` admite `45m`, `1.5h`, `2d` o `1w`. `Inicio` y `Fin` usan `AAAA-MM-DD`; escribe `—` si no hay fecha fija. Las tareas sin fecha pueden recibir barras proyectadas si tienen esfuerzo.
- `Depende` contiene IDs separados por comas. El orden de las filas representa la secuencia prevista para la proyección.
- `now_task.started_at` y `updated` usan fecha y hora local `AAAA-MM-DD HH:mm`. `now_task.expected` es una duración estimada desde el inicio, por ejemplo `90m`, `01:30` o `2h`.
- Una línea de `## Estimaciones` expresa **tiempo restante** en el momento registrado, seguido de la razón. No reescribas la estimación inicial ni agregues entradas por el solo paso del tiempo.
- Puedes añadir una columna `Real` con la duración de tareas terminadas. El visor la usa para ajustar las proyecciones siguientes.
- Las fechas y ETA calculadas son orientativas. Los porcentajes, tareas terminadas y pruebas registradas deben corresponder a trabajo verificable.

La proyección actual suma duraciones de trabajo de forma continua y divide por `capacity`; no aplica horario laboral, fines de semana ni disponibilidad personal. Úsala para comparar el orden y el tamaño del trabajo pendiente, y pide al agente una revisión explícita cuando cambie el alcance o una entrega importante.

El archivo [VOIDFRONT.md](../examples/VOIDFRONT.md) es una demo ficticia de mayor tamaño. No lo copies como plan de otro proyecto.
