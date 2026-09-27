---
name: visual-roadmap
description: Use when doing coding work in a project with ROADMAP.md. Split each request into small verifiable tasks and keep the user informed with one-line `npx visual-roadmap` commands (start, done, block, eta).
---

# Visual Roadmap: protocolo para agentes

El usuario ve `ROADMAP.md` en vivo: tarea actual, tiempo transcurrido, ETA, bloqueos y problemas del plan. Tu parte es **planificar bien una vez y ejecutar un comando corto en cada cambio de estado**. El visor calcula relojes, ETAs y proyecciones. No escribas nada solo porque pasó el tiempo.

## Ciclo

1. **Retomar:** lee el resumen `[visual-roadmap]` del inicio de sesión. Si no aparece, ejecuta `npx visual-roadmap status`.
2. **Planificar**, solo si la petición todavía no está en el roadmap: divídela con `add` (ver abajo).
3. **Trabajar:** `start T004` → implementar → verificar → `done T004 --note "evidencia" --next`.
   `done` registra fin, duración real y líneas cambiadas, y `--next` arranca la siguiente tarea lista.
4. **Imprevistos:** `block T004 "causa"` · `eta T004 20m "razón"` (tiempo **restante**) · `split T004 …` si creció.

Pon el ID en el mensaje de commit (`T004: valida email`): el visor enlaza el commit con la tarea.

## Cómo dividir una petición

Hazlo antes de escribir código:

- **Una tarea es un resultado verificable de 15 a 90 min**, verificación incluida. Nómbrala por lo observable ("El login rechaza contraseñas incorrectas"), no por la actividad ("Trabajar en login").
- **Si pasa de 2 h, divídela** por resultado (rebanadas verticales: endpoint + UI + prueba de un caso), no por capa ("todo el backend").
- **La verificación va dentro de cada tarea.** Solo crea una tarea de pruebas aparte para e2e o QA manual reales.
- **Una versión es algo que el usuario puede usar** (`v0.1 · Login básico`), con 3 a 8 tareas. Primero lo que desbloquea lo demás.
- **Declara dependencias solo si son reales.** `--after T002` coloca la tarea detrás de T002 y la hace depender de ella.
- **Estima con honestidad**, incluyendo leer código y verificar: ajuste acotado 10–30 min, función pequeña con prueba 30–60, integración 60–120. No copies la misma cifra a todo.
- **No sobreplanifiques:** una petición de un solo paso y menos de 30 min es una sola tarea.
- **Si cambia el alcance:** `add` para lo nuevo, `split` para lo que creció y `cancelled` a mano para lo que ya no aplica.

```bash
npx visual-roadmap add "El login acepta credenciales válidas" --effort 45m --release "v0.1 · Acceso"
npx visual-roadmap add "La sesión persiste al recargar" --effort 30m --after T001
npx visual-roadmap split T003 "Enviar email de reset:30m" "Pantalla de nueva contraseña:45m"
```

`add` sin `--release` usa la versión de la tarea activa. `split` cancela la original, encadena las partes y pasa sus dependientes a la última parte.

## Comandos

| Cuándo | Comando |
| --- | --- |
| Retomar | `status` — tarea actual, ETA, siguientes listas, errores |
| Planificar | `add "Resultado" --effort 30m [--release "v0.2 · Nombre"] [--after T003]` |
| Tarea demasiado grande | `split T005 "Parte A:30m" "Parte B:45m"` |
| Empezar | `start T004 [--expected 40m]` (por defecto usa el esfuerzo) |
| Avance verificable | `progress T004 60` |
| La ETA ya no es creíble | `eta T004 25m "razón"` |
| Terminar | `done T004 --note "evidencia" [--next]` |
| Bloqueo | `block T004 "causa"` |
| Decisión o nota | `log "texto"` |
| Tras editar a mano | `check` — corrige todo `✗` |

Todos se ejecutan con `npx visual-roadmap …` y responden en una línea. `status` y `check` aceptan `--json`.

## Reglas

- Marca `done` solo con evidencia: prueba, build o comprobación descrita en `--note`. Nunca inventes resultados.
- Una sola tarea `active` por agente. Si la dejas sin terminar, usa `block` con la causa.
- Si la ETA venció: `done` si terminaste; si no, `eta` con el tiempo restante y la razón. Ir lento no es un problema; dejar una ETA vieja sí.
- No edites a mano `updated`, `now_task`, `Inicio`, `Fin` ni `Real`: los comandos los mantienen.
- Edita el archivo a mano solo para reordenar, renombrar o cancelar, y luego ejecuta `check`.
- Si al terminar un turno recibes un mensaje `[visual-roadmap] …` (hook de Claude Code), resuélvelo con el comando que indica y continúa.

## Formato, por si editas a mano

```markdown
## Releases

### v0.1 · Acceso
| Item | Estado | Progreso | Esfuerzo | Inicio | Fin | Depende | Real |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T001 El login acepta credenciales válidas | done | 100% | 45m | 2026-09-26 14:20 | 2026-09-26 15:02 | — | 42m |
| T002 La sesión persiste al recargar | planned | 0% | 30m | — | — | T001 | — |
```

Estados: `planned`, `active`, `blocked`, `risk`, `done`, `cancelled`. Esfuerzo: `20m`, `1.5h`. El orden de las filas es la secuencia prevista. Detalles en `docs/ROADMAP_FORMAT.md` del paquete.
