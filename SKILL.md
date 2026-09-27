---
name: visual-roadmap
description: >
  Protocolo canónico de seguimiento de progreso y hoja de ruta en vivo
  para agentes de IA (Claude, Codex, Antigravity, OpenCode, Cursor, Aider).
  Permite al usuario monitorizar en tiempo real el trabajo autónomo
  mediante el HUD Sci-Fi (inspirado en RSI / Voidfront Tracker)
  sin necesidad de interrumpir al agente.
applies_to:
  - "ROADMAP.md"
  - "roadmap.md"
  - "**/*roadmap*.md"
triggers:
  - "on_session_start"
  - "before_starting_task"
  - "after_commit"
  - "after_completing_task"
  - "on_task_delay_or_block"
---

# Skill: Visual Roadmap (Protocolo Canónico para Agentes de IA)

> **MANDATO PRINCIPAL PARA EL AGENTE:**
> Mantén `ROADMAP.md` actualizado en silencio con cada tarea y commit.
> El usuario tiene abierto el visor local en su navegador y observa tu avance en vivo.
> **Nunca pauses la sesión ni pidas confirmación para actualizar este archivo.**

---

## 1. Esquema Canónico de `ROADMAP.md`

Un archivo `ROADMAP.md` bien formateado consta de:
1. **Frontmatter YAML** con métricas globales y la tarea actual (`now_task`).
2. **Sección `## Últimos cambios`** con diffs de código y commits recientes.
3. **Sección `## Contexto`** con resumen del proyecto.
4. **Sección `## Releases`** dividida en Fases/Entregables con tablas que usan identificadores de tarea (`T001`, `T041`, etc.).
5. **Sección `## Hitos`** con fechas clave.
6. **Sección `## Log`** con checklist histórico.

---

## 2. Plantilla Frontmatter de Métricas en Vivo

```yaml
---
title: NOMBRE_DEL_PROYECTO          # Nombre mostrado en la barra lateral y cabecera
subtitle: HOJA DE RUTA             # Subtítulo (e.g. HOJA DE RUTA, DEV TRACKER)
owner: DesvoSoft                   # Responsable o equipo
started: 2026-09-25 17:17          # Fecha y hora exacta de inicio del proyecto/sprint
updated: 2026-09-26 22:15          # Fecha y hora de la última modificación
timezone: America/Mexico_City      # Zona horaria local del entorno
week_start: mon                    # mon | sun
capacity: 1                        # Número de desarrolladores/agentes activos
version: "0.1"                     # Versión objetivo en desarrollo
phase: 11                          # Número de fase actual
phase_total: 14                    # Total de fases proyectadas
tests: 397                         # Cantidad total de tests unitarios/integración
e2e: 37                            # Cantidad de tests end-to-end
decisions: 92                      # Decisiones de arquitectura tomadas
lines: 29421                       # Conteo aproximado de líneas de código
last_commit: "335e3ea"             # Hash corto del último commit
last_commit_time: "hace 49 min"    # Tiempo relativo o estampa del commit
now_task:
  id: "T109"                       # Código de la tarea en curso (ej. T109)
  name: "Props del mundo"          # Nombre conciso de lo que el agente hace AHORA
  context: "Fase 11 · Resto de assets · Arte procedural" # Contexto / fase
  expected: "01:15"                # Tiempo esperado de duración (HH:MM o minutos)
  elapsed: "49 min"                # Tiempo transcurrido en esta tarea
  status: "tarda más de lo previsto" # "en tiempo" | "tarda más de lo previsto" | "bloqueado"
---
```

---

## 3. Sección `## Últimos cambios` (Live Activity Feed)

Cada vez que completes una acción, commit o refactor, añade la línea más reciente arriba:

```markdown
## Últimos cambios

- 01:15 | ✓ | Cairn props y collision meshes | +1163 -251
- 23:55 | 📄 | tools: pipeline de exportación | +29 -2
- 23:52 | 📄 | roadmap: sync de entregables | +5 -0
- 23:51 | ✓ | Kit de iluminación volumétrica | +1175 -42
- 22:44 | 📄 | roadmap: estimación de esfuerzo | +4 -0
- 22:43 | ✓ | Asteroides procedurales LODs | +751 -84
```

**Formato de fila:**
`- HH:MM | ICONO | DESCRIPCIÓN | +LÍNEAS_AÑADIDAS -LÍNEAS_BORRADAS`
- Iconos válidos: `✓` (completado/commit), `📄` (archivo/doc), `⚡` (optimización), `⚠` (alerta).

---

## 4. Tablas de Tareas con Identificadores Canónicos (`Txxx`)

Toda tarea debe tener un identificador al inicio de su nombre (`T001`, `T041`, `T109`, etc.):

```markdown
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
| T110 Shaders de atmósfera | planned | 0% | @desvosoft | 6h | 2026-09-27 | 2026-09-28 | T109 | P1 |
```

### Columnas y Valores Válidos:
- **Item**: `Txxx Nombre descriptivo` (siempre prefijado con `T` y número).
- **Estado**: `planned` (planeado), `active` (en curso), `blocked` (bloqueado), `risk` (en riesgo), `done` (terminado).
- **Progreso**: Porcentaje entre `0%` y `100%`.
- **Esfuerzo**: `4h`, `8h`, `2d`, etc.
- **Inicio / Fin**: Fechas `YYYY-MM-DD`.
- **Depende**: Código de la tarea previa (`T041`) o `—`.
- **Prio**: `P0` (crítica), `P1` (alta), `P2` (media), `P3` (baja).

---

## 5. Ciclo de Vida del Agente Durante una Sesión Autónoma

1. **Al iniciar la sesión:**
   - Si no existe `ROADMAP.md`, créalo usando este estándar.
   - Si existe, lee las tareas y selecciona la prioritaria (`P0` o `P1`).
   - Actualiza el frontmatter:
     ```yaml
     now_task:
       id: "T109"
       name: "Nombre de la tarea"
       context: "Fase X · Contexto"
       expected: "01:00"
       elapsed: "0 min"
       status: "en curso"
     ```
2. **Durante el desarrollo:**
   - Si la tarea toma más tiempo de lo proyectado, actualiza `status: "tarda más de lo previsto"` y `elapsed: "XX min"`.
   - El visor mostrará automáticamente la alerta en color ámbar y la barra de progreso reactiva.
3. **Al hacer commit o terminar la tarea:**
   - Añade una entrada arriba en `## Últimos cambios` con el delta de líneas (`+N -N`).
   - Marca la tarea en la tabla como `done` y `100%`.
   - Incrementa las estadísticas globales (`tests`, `lines`, `last_commit`).
   - Pasa inmediatamente a la siguiente tarea configurando el nuevo `now_task`.

---

## 6. Autonomía y Permisos

El usuario ha concedido permisos completos para:
- Modificar libremente `ROADMAP.md` en cualquier momento de la sesión.
- Realizar commits locales y push al repositorio remoto según corresponda.
- Nunca interrumpir el flujo de ejecución para consultar sobre actualizaciones del roadmap.
