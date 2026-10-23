# Disciplina del agente: que el roadmap no mienta

Fecha: 2026-10-23.

**Estado: propuesta. Nada de esto está implementado.**

## Problema

Todo el valor depende de que el agente ejecute `start`, `done`, `eta` y `block`
en el momento justo. Cuando se salta uno, la vista sigue viéndose segura pero ya
no coincide con lo que pasa, y quien la mira pierde la confianza. Una vista que
miente es peor que no tener ninguna.

## Cómo falla hoy

| Fallo | Qué ve la persona | Qué lo cubre hoy |
| --- | --- | --- |
| Escribe código sin `start` | Nada activo mientras el repo cambia | `PostToolUse` arranca la siguiente tarea lista (solo Claude Code) |
| Termina sin `done` | La tarea "sigue" y luego se pasa del ETA | `Stop` lo recuerda una vez (solo Claude Code) |
| Trabaja en algo que no está en el roadmap | Se arranca una tarea que no corresponde | Nada. El arranque automático puede equivocarse de tarea |
| El ETA queda corto y no lo corrige | Naranja, pero sin explicación | `Stop` / `UserPromptSubmit` piden `eta` |
| La sesión muere (cuota, crash, Ctrl+C) | Tarea activa para siempre | Nada |
| Codex, Cursor, Gemini, Copilot | Todo lo de arriba, sin red de seguridad | Solo el texto del protocolo |

Conclusión: fuera de Claude Code la disciplina es pura buena voluntad, y en
Claude Code los hooks corrigen, pero el viewer no muestra cuánto se puede
confiar en lo que enseña.

## Idea central: dos señales en lugar de una

Hoy el viewer solo muestra lo **declarado**, lo que el agente dice con comandos.
Hay una segunda señal que nadie tiene que acordarse de emitir, lo **observado**:
archivos que cambian, commits y llamadas a hooks. El servidor de `live` ya vigila
`ROADMAP.md` y podría vigilar también el árbol de trabajo (respetando
`.gitignore`) sin costar un solo token al agente.

Con las dos señales, el viewer puede decir la verdad incluso cuando el agente falla:

- **Declarado y observado coinciden:** todo normal.
- **Hay actividad pero nada activo:** "Se está escribiendo código fuera del roadmap · 12 archivos en 8 min".
- **Hay tarea activa pero no hay actividad:** "Sin actividad desde hace 25 min. ¿La sesión terminó?". Este caso cubre la sesión que se murió.
- **Hay un commit con ID de una tarea activa y luego silencio:** "Posiblemente terminada: commit `T004: …` hace 10 min".

La persona deja de tener que adivinar. Esto vale para **cualquier agente**, sin hooks.

## Propuestas, por impacto/coste

1. **Indicador de frescura en el viewer** (barato, alto impacto). Un punto
   verde/ámbar/gris junto a "Ahora" con la última actividad observada y el último
   comando. El servidor ya existe, solo hay que añadir un watcher del árbol y un
   evento SSE `activity`. Cero tokens.
2. **Detección de sesión muerta** (barato). Sin actividad durante N minutos con
   una tarea activa: el viewer la marca como "sin actividad" y el `status`/brief
   siguiente se lo dice al agente ("T004 quedó activa sin actividad desde ayer:
   retómala o `pause`"). El estado no se cambia solo, solo se señala.
3. **Hook de git `commit-msg` / `post-commit`** (medio). Es la única integración
   que funciona igual con todos los agentes, porque todos hacen commit. Avisa (sin
   bloquear) si el commit no lleva ID o si no hay tarea activa, y deja una línea en
   "Últimos cambios". `init` lo instalaría con opción de saltarlo, como los hooks.
4. **Arranque automático con más criterio** (medio). Antes de arrancar "la
   siguiente lista", comparar los archivos tocados con las tareas (nombre, notas,
   archivos de commits anteriores). Si no hay coincidencia clara, pedirle al agente
   `add` en vez de arrancar la tarea equivocada.
5. **Hooks para Cursor y Codex** (medio, *a verificar*). Revisar qué eventos ofrecen hoy
   (Cursor tiene `hooks.json` con eventos de shell y de fin de turno; Codex tiene
   `notify`) y reutilizar `runHook` con un adaptador por agente.
6. **Métrica de cobertura** (barato, sirve para medir lo demás). Porcentaje del
   tiempo con cambios de código que cae dentro de una tarea activa, calculado con git
   y los intervalos de las tareas. Se muestra en el viewer y en `status --json`. Sin
   esta métrica no sabemos si las propuestas 1–5 mejoran algo.

## Orden sugerido

Primero 6 (medir) y 1 (mostrar frescura); juntas cambian la percepción sin tocar
el protocolo. Después 2 y 3, que llevan la red de seguridad a todos los agentes.
4 y 5 cuando la métrica diga dónde se pierde más.

## Fuera de alcance

- Que el viewer cambie estados solo (`done` automático). Inferir que algo terminó
  es fácil de hacer mal; el viewer señala y el agente decide.
- Vigilar contenido de archivos o enviar algo fuera de la máquina.
