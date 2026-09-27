---
name: visual-roadmap
description: >
  Mantén un ROADMAP.md en tiempo real durante sesiones largas de trabajo
  autónomo. El visor (viewer/index.html) muestra el progreso en vivo al
  usuario sin que tengas que pausar ni pedir confirmación.
  Compatible con: Antigravity · Claude · Codex · OpenCode · cualquier LLM
  con acceso a ficheros.
applies_to:
  - "ROADMAP.md"
  - "roadmap.md"
  - "**/*roadmap*.md"
triggers:
  - "on_session_start"
  - "before_major_task"
  - "after_completing_item"
  - "on_blocker_found"
---

# Skill: Visual Roadmap

> **TL;DR para agentes:** Mantén `ROADMAP.md` actualizado silenciosamente
> mientras trabajas. Actualiza `ai_task` cada vez que cambias de tarea.
> Nunca pausar por esto. El usuario lo ve en vivo en el browser.

---

## 1. Qué es este sistema

El **Visual Roadmap** es un protocolo de archivo único. La IA escribe y
mantiene `ROADMAP.md`; el visor (`viewer/index.html`) lo renderiza en vivo
mostrando:

- **Board Kanban** — columnas por release, cards con progreso
- **Timeline Gantt** — barras de tiempo, hitos, línea "hoy"
- **Log** — historial de actividad
- **Panel de IA** — qué está haciendo el agente, desde cuándo, ETA

El usuario abre `viewer/index.html` en el browser, selecciona el archivo
`ROADMAP.md` y observa el trabajo en tiempo real sin interrumpirte.

---

## 2. Cuándo actualizar el ROADMAP

| Evento                                  | Qué actualizar                              |
|----------------------------------------|---------------------------------------------|
| Inicio de sesión                        | `ai_agent`, `ai_task`, `ai_phase`, `updated`|
| Empiezas a trabajar en un ítem          | `status` → `active`, `ai_item`, `ai_since`  |
| Terminas un ítem                        | `status` → `done`, `progress` → `100%`      |
| Estimas mejor el tiempo restante        | `ai_eta`, `effort` del ítem                 |
| Encuentras un bloqueante                | `status` → `blocked`, nota en el ítem       |
| Cambias de tarea                        | `ai_task`, `ai_item`, `ai_phase`            |
| Algo sale diferente a lo planeado       | Añadir entrada al `## Log`                  |
| Fin de sesión                           | Borrar campos `ai_*` del frontmatter        |

**Regla de oro:** actualiza el ROADMAP **antes** de empezar a trabajar en
algo nuevo, no después. El usuario tiene que saber qué estás haciendo ahora.

---

## 3. Formato del ROADMAP.md

### 3.1 Frontmatter (campos obligatorios)

```yaml
---
title: Nombre del proyecto
subtitle: Una línea de descripción
owner: tu-nombre-o-username
started: YYYY-MM-DD          # fecha real de inicio
updated: YYYY-MM-DD          # actualiza cada vez que modificas el archivo
timezone: America/Mexico_City  # o la que corresponda
week_start: mon
capacity: 1                  # número de desarrolladores en el equipo
---
```

### 3.2 Campos de estado de IA (opcionales, añadir durante sesión)

```yaml
ai_agent: Antigravity          # tu nombre como agente
ai_task: "Escribiendo board.js"  # qué estás haciendo AHORA mismo
ai_item: "Shell index.html y navegación de vistas"  # ítem del roadmap en curso
ai_phase: R1                   # release en que estás trabajando
ai_since: "21:07"              # hora local de inicio de la tarea actual
ai_eta: "22:30"                # estimado de cuándo terminas el ítem actual
```

> ⚠️ **Importante:** estos campos **no bloquean** el trabajo. Actualízalos
> en background. Si no los actualizas, el panel de IA simplemente no se muestra.

### 3.3 Secciones del documento

```markdown
## Contexto
Descripción del proyecto. Texto libre con **markdown**.

## Releases
### R1 · Nombre del release
`YYYY-MM-DD → YYYY-MM-DD` · **active** · 35%

Descripción del release.

#### Categoría

| Item | Estado | Progreso | Owner | Esfuerzo | Inicio | Fin | Depende | Prio |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Nombre del ítem | planned | 0% | @user | 4h | 2026-10-01 | 2026-10-01 | — | P0 |

## Hitos

| Hito | Fecha | Release | Estado | Nota |
| --- | --- | --- | --- | --- |
| Alpha | 2026-10-09 | R1 | pending | Descripción |

## Log

- [x] 2026-09-25 — Tarea completada.
- [ ] 2026-09-28 — Tarea pendiente.
```

---

## 4. Valores válidos

### Estado (columna "Estado")

| Valor      | Cuándo usarlo                        |
|-----------|--------------------------------------|
| `planned`  | No empezado todavía                  |
| `active`   | En progreso ahora mismo              |
| `blocked`  | Bloqueado por dependencia o problema |
| `risk`     | En riesgo de no terminar a tiempo    |
| `done`     | Completado al 100%                   |
| `cancelled`| Descartado definitivamente           |

### Prioridad

| Valor | Significado           |
|-------|-----------------------|
| `P0`  | Crítico / bloqueante  |
| `P1`  | Alto                  |
| `P2`  | Normal                |
| `P3`  | Nice-to-have          |

### Esfuerzo

Usa siempre unidades explícitas: `4h`, `2d`, `1.5h`, `90m`.
**Nunca uses fechas para expresar esfuerzo.** El visor deriva las fechas
del esfuerzo y la capacidad; no al revés.

---

## 5. Reglas de estimación realista

Estas reglas evitan que el visor marque advertencias de planificación:

1. **Horas por día efectivo:** máximo `6h` por persona por día laboral.
2. **Duración mínima:** una tarea de `8h` de esfuerzo ocupa mínimo 2 días.
3. **Sin solapamientos imposibles:** si una persona tiene dos ítems activos
   el mismo día, el esfuerzo diario combinado no puede superar `6h`.
4. **Las dependencias son reales:** si B depende de A, `B.start >= A.end`.
5. **No inventar fechas:** calcula: `días = ceil(esfuerzo / 6)`, luego
   pon `start` = siguiente día laborable libre, `end` = start + días - 1.
6. **Progreso honesto:** si empezaste y llevas 50%, pon `50%`, no `0%` ni `100%`.
7. **Holgura mínima:** deja al menos 15–20% de holgura en el release para
   QA, revisión e imprevistos.

---

## 6. Flujo de trabajo en sesión autónoma

### Al inicio de sesión

```markdown
<!-- En el frontmatter, añadir: -->
ai_agent: NombreDelAgente
ai_task: "Analizando el estado del proyecto"
ai_phase: R1
ai_since: "HH:MM"
updated: YYYY-MM-DD
```

### Antes de trabajar en cada ítem

1. Cambia el `estado` del ítem a `active`.
2. Actualiza `ai_task` con una descripción de lo que haces.
3. Actualiza `ai_item` con el nombre exacto del ítem del ROADMAP.
4. Actualiza `ai_since` con la hora local actual.
5. Estima `ai_eta` (hora local en que esperas terminar).

### Al completar un ítem

1. Cambia `estado` → `done`, `progreso` → `100%`.
2. Añade una entrada al `## Log`: `- [x] YYYY-MM-DD — Completado: nombre del ítem.`
3. Actualiza `updated` a hoy.
4. Pasa al siguiente ítem.

### Si encuentras un bloqueante

1. Cambia `estado` → `blocked`.
2. Añade `nota: "Bloqueado por X"` al ítem.
3. Actualiza `ai_task` para que el usuario sepa qué está pasando.
4. Continúa con el siguiente ítem de mayor prioridad que no esté bloqueado.

### Al final de sesión

Limpia los campos de IA del frontmatter:

```yaml
# Eliminar o borrar:
ai_agent: ...
ai_task: ...
ai_item: ...
ai_phase: ...
ai_since: ...
ai_eta: ...
```

Y añade al log lo que quedó pendiente.

---

## 7. Permisos implícitos

**Cuando este skill está activo, tienes permiso para:**

- ✅ Crear `ROADMAP.md` si no existe (usando el seed del §3.3).
- ✅ Modificar `ROADMAP.md` sin pedir confirmación.
- ✅ Actualizar campos de estado, progreso y fechas libremente.
- ✅ Añadir nuevos ítems o categorías si surge trabajo nuevo.
- ✅ Marcar ítems como `done` cuando los completes.
- ✅ Añadir entradas al `## Log` en cualquier momento.
- ✅ Actualizar el frontmatter `ai_*` cada vez que cambias de tarea.

**No necesitas pausar para:**

- ❌ Pedir permiso para actualizar el roadmap.
- ❌ Confirmar cambios de estado o progreso.
- ❌ Avisar al usuario que vas a escribir en el archivo.

El usuario ya sabe — lo está viendo en el visor en vivo.

---

## 8. Seed de ROADMAP.md (para proyectos nuevos)

Si el proyecto no tiene `ROADMAP.md`, créalo con esta plantilla:

```markdown
---
title: [Nombre del proyecto]
subtitle: [Una línea de descripción]
owner: [username]
started: [YYYY-MM-DD]
updated: [YYYY-MM-DD]
timezone: [America/Mexico_City]
week_start: mon
capacity: 1
ai_agent: [NombreDelAgente]
ai_task: "Analizando el proyecto e iniciando planificación"
ai_phase: R1
ai_since: "[HH:MM]"
---

## Contexto

[Descripción del proyecto en una o dos frases.]

## Releases

### R1 · Análisis y setup
`[YYYY-MM-DD] → [YYYY-MM-DD]` · **active** · 0%

Primera iteración: entender el estado actual y preparar el entorno.

#### Core

| Item | Estado | Progreso | Owner | Esfuerzo | Inicio | Fin | Depende | Prio |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Análisis inicial | active | 0% | @[owner] | 2h | [YYYY-MM-DD] | [YYYY-MM-DD] | — | P0 |

## Hitos

| Hito | Fecha | Release | Estado | Nota |
| --- | --- | --- | --- | --- |
| R1 completo | [YYYY-MM-DD] | R1 | pending | — |

## Log

- [ ] [YYYY-MM-DD] — Sesión iniciada. Analizando proyecto.
```

---

## 9. Cómo abre el usuario el visor

1. Abrir `viewer/index.html` en Chrome o Edge (localmente, sin servidor).
2. Clic en **📂 Abrir** → seleccionar `ROADMAP.md`.
3. El visor se actualiza automáticamente cada 2 segundos.
4. El panel de IA aparece cuando hay `ai_agent` y `ai_task` en el frontmatter.

> **Alternativa sin File System Access API:** arrastrar `ROADMAP.md` sobre
> el visor. En este caso no hay actualización automática — hay que volver a
> arrastrar. O usar `?sse=http://localhost:PORT/sse` para recibir eventos
> desde un servidor local.

---

*Skill de Visual Roadmap — compatible con cualquier agente que pueda leer
y escribir archivos Markdown.*
