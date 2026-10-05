---
name: visual-roadmap
description: Use automatically for coding work in a project with ROADMAP.md. Run the one-line visual-roadmap commands yourself without a user reminder.
---

# Visual Roadmap: protocolo para agentes

El usuario ve `ROADMAP.md` en vivo: tarea actual, tiempo, ETA y bloqueos. Mantenlo al día tú, sin que te lo pidan: **planifica una vez y ejecuta un comando corto en cada cambio de estado**. El visor calcula relojes y proyecciones; no escribas nada solo porque pasó el tiempo.

## Ciclo

1. **Retomar:** usa el resumen `[visual-roadmap]` del inicio de sesión; si no aparece, `status`.
2. **Planificar** solo lo que aún no esté en el roadmap, con `add`.
3. **Trabajar:** `start T004` antes de editar código → implementar → verificar → `done T004 --note "evidencia" --next` (`--next` arranca la siguiente tarea lista).
4. **Imprevistos:** `block`, `eta` o `split`.

## Comandos

Todos son `npx visual-roadmap …` y responden en una línea.

| Cuándo | Comando |
| --- | --- |
| Retomar | `status` |
| Planificar | `add "Resultado" --effort 30m [--release "v0.2 · Nombre"] [--group "Subgrupo"] [--after T003]` |
| Empezar | `start T004` |
| Avance verificable | `progress T004 60` |
| La ETA ya no es creíble | `eta T004 25m "razón"` (tiempo **restante**) |
| Terminar | `done T004 --note "evidencia" [--next]` |
| Bloqueo | `block T004 "causa"` |
| Pausa | `pause T004 "motivo"` · `resume T004` |
| Tarea demasiado grande | `split T005 "Parte A:30m" "Parte B:45m"` |
| Decisión o nota | `log "texto"` |
| Captura como evidencia (opcional) | `shot T004 captura.png "qué demuestra" --final` |
| Tras editar el archivo a mano | `check` y corrige todo `✗` |

`add` sin `--release` usa la versión de la tarea activa. `--after T002` coloca la tarea detrás de T002 y la hace depender de ella. `--group` la pone bajo un subtítulo `####` (útil con más de ~6 tareas por versión).

## Cómo dividir una petición

- **Tarea = resultado verificable de 15 a 90 min**, verificación incluida, nombrada por lo observable ("El login rechaza contraseñas incorrectas"), no por la actividad.
- **Más de 2 h: divídela** en rebanadas verticales (endpoint + UI + prueba de un caso), no por capa.
- **Versión = algo que el usuario puede usar** (`v0.1 · Login básico`), 3 a 8 tareas; primero lo que desbloquea lo demás.
- **Estima con honestidad**, leyendo código y verificando: ajuste acotado 10–30 min, función con prueba 30–60, integración 60–120.
- **No sobreplanifiques:** un solo paso de menos de 30 min es una sola tarea.
- **Cambio de alcance:** `add` lo nuevo, `split` lo que creció, estado `cancelled` a mano para lo que ya no aplica.

## Reglas

- `done` solo con evidencia (prueba, build o comprobación) en `--note`. Nunca inventes resultados.
- Una sola tarea `active`. Si la dejas sin terminar: `block` con la causa.
- ETA vencida: `done` si terminaste; si no, `eta` con lo que falta y por qué.
- Pon el ID en los commits (`T004: valida email`): el visor los enlaza con la tarea.
- No edites a mano `updated`, `now_task`, `Inicio`, `Fin` ni `Real`. A mano solo se reordena, renombra o cancela; después `check`. Formato: `docs/ROADMAP_FORMAT.md` del paquete.
- Un mensaje `[visual-roadmap] …` (hook de Claude Code) indica qué comando ejecutar: hazlo y continúa. Las capturas de Chrome/Playwright se guardan solas en la tarea activa.
