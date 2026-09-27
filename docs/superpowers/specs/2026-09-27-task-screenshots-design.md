# Capturas por tarea — diseño

Fecha: 2026-09-27 · Estado: aprobado en conversación, pendiente de revisión escrita

## Objetivo

Los agentes ya toman capturas para validar su trabajo (Chrome, Playwright, `Read` de un PNG). Visual Roadmap las aprovecha: las asocia a la tarea activa, las guarda sin ocupar espacio de más y las muestra como progreso visual en el timeline y en el detalle de cada tarea.

**No** es una obligación nueva para el agente. Si no hay capturas, nada cambia.

### Criterios de éxito

- Con Claude Code, abrir el detalle de una tarea muestra las capturas que el agente tomó mientras trabajaba en ella, sin que el agente haya ejecutado ningún comando extra.
- El timeline indica qué tareas tienen capturas y deja ver la portada sin abrir el detalle.
- La carpeta de capturas no entra en git y no crece sin límite.
- Cero dependencias nuevas; Node 18+.

### Fuera de alcance

- Capturas tomadas por el propio Visual Roadmap (no hacemos screenshots).
- Sincronizar capturas entre máquinas o compañeros.
- Mostrar capturas en `roadmap.html` abierto sin servidor.

## Decisiones

| Tema | Decisión |
| --- | --- |
| Ubicación | `.roadmap/shots/` junto a `ROADMAP.md`, ignorada por git mediante su propio `.gitignore` (`*`). No se toca el `.gitignore` del usuario. |
| Origen | Principal: hook `PostToolUse` de Claude Code. Opcional: comando `shot` para cualquier agente. |
| Espacio | Retención por tarea y tope global + compresión a WebP hecha por el navegador. |
| Metadatos | `.roadmap/shots/index.json`. `ROADMAP.md` no cambia. |
| Detalle | Panel lateral con log vertical cronológico (eventos + capturas) y lightbox. |

## Arquitectura

```text
agente ── captura (MCP / Read) ──► hook post-tool-use ──┐
agente ── visual-roadmap shot ──────────────────────────┤
                                                         ▼
                                               lib/shots.js (add/prune)
                                                         │
                               .roadmap/shots/index.json + T011/*.png|webp
                                                         │
                                  lib/server.js  (GET /shots, GET /shots/file, POST /shots/:id, SSE)
                                                         │
                                  viewer: timeline (badge, hover, marcas) · detalle (log + lightbox)
                                          compresor en segundo plano (canvas → WebP → POST)
```

### Disco

```text
.roadmap/shots/
  .gitignore            # "*"
  index.json
  T011/20260927-1452-ab12cd34.png
```

`index.json`:

```json
{
  "version": 1,
  "shots": [
    {
      "id": "ab12cd34",
      "task": "T011",
      "at": "2026-09-27T14:52:10.000Z",
      "file": "T011/20260927-1452-ab12cd34.png",
      "caption": "drag en móvil ok",
      "kind": "progress",
      "source": "hook:chrome",
      "bytes": 182000,
      "compressed": false
    }
  ]
}
```

- `id`: primeros 8 caracteres hex del sha256 del contenido original. Mismo `id` en la misma tarea ⇒ no se guarda de nuevo.
- `kind`: `progress` (por defecto) o `final`. La **portada** de una tarea es la última `final`; si no hay, la más reciente.
- `source`: `cli`, `hook:chrome`, `hook:playwright`, `hook:mcp`, `hook:read`.
- Escritura atómica del índice (archivo temporal + `rename`).

### `lib/shots.js`

Módulo puro sobre `fs`, `path` y `crypto`. Recibe el directorio raíz (el de `ROADMAP.md`).

| Función | Qué hace |
| --- | --- |
| `add(root, { task, buffer \| file, caption, kind, source, now })` | Valida formato (png, jpg, webp por firma de bytes) y tamaño (≤ 10 MB), deduplica, copia, indexa y ejecuta `prune`. Devuelve la entrada o `{ skipped: 'duplicate' \| 'throttled' }`. |
| `list(root, task?)` | Entradas ordenadas por `at`. |
| `cover(entries)` | Portada según la regla anterior. |
| `prune(root, { maxMb, doneTasks })` | Retención (ver abajo). Devuelve los archivos borrados. |
| `replace(root, id, buffer)` | Sustituye el archivo por la versión WebP si es más pequeña; marca `compressed: true`. |
| `resolve(root, rel)` | Ruta absoluta segura: rechaza todo lo que salga de `.roadmap/shots/`. |

**Retención**, tras cada `add`:

1. Por tarea se conservan la primera, la portada y hasta 6 intermedias (las más recientes). El resto se borra.
2. Si el total supera `shots_max_mb` (frontmatter; por defecto 150), se borran intermedias de tareas `done`, de la más antigua a la más reciente, hasta bajar del tope. Primera y portada nunca se borran.

**Throttle** para el hook: como máximo una captura automática cada 30 s por tarea. `shot` explícito no tiene throttle.

### CLI

```bash
visual-roadmap shot [T011] <archivo> ["caption"] [--final]
visual-roadmap shots [T011] [--json]
visual-roadmap shots prune
```

- Sin ID usa la tarea activa; sin tarea activa responde con error en una línea.
- Salida en una línea: `✓  T011 shot ab12cd34 · 3 shots`.

### Hook automático

`hook post-tool-use` ya existe. Se añade, antes de la lógica actual y sin afectarla:

1. Si no hay tarea activa ⇒ nada.
2. Detectar la imagen en el payload:
   - Herramienta cuyo nombre contiene `screenshot`, o `computer` con `action: "screenshot"`: si `tool_response` trae un bloque de imagen base64, se decodifica; si `tool_input` trae una ruta (`filename`, `path`), se copia.
   - `Read` de `.png/.jpg/.jpeg/.webp` modificado hace menos de 10 min y fuera de `assets/`, `node_modules/`, `dist/`, `.roadmap/`.
3. Caption automático: URL o título de la página si vienen en el payload; si no, el nombre del archivo.
4. Cualquier error ⇒ salir en silencio con código 0. El hook nunca bloquea al agente.

**Riesgo:** la forma exacta del payload de las herramientas MCP en `PostToolUse` no está documentada por herramienta. Primer paso del plan: capturar payloads reales (Chrome MCP, Playwright MCP, `Read`) como fixtures de test.

### SKILL.md

Una línea opcional, sin nuevas obligaciones:

> Si una captura demuestra el resultado, puedes marcarla: `shot T011 captura.png "qué demuestra" --final`.

### Servidor

| Ruta | Respuesta |
| --- | --- |
| `GET /shots` | `index.json` (o `{ version: 1, shots: [] }`). |
| `GET /shots/file/<rel>` | La imagen, con `Content-Type` por extensión y `Cache-Control: max-age=31536000, immutable` (el nombre incluye el hash). 404 si `resolve` la rechaza. |
| `POST /shots/<id>` | Cuerpo `image/webp` ≤ 10 MB; llama a `replace`. Solo desde `127.0.0.1`. |
| SSE | Evento `shots` cuando cambia `index.json` (mismo watcher que `ROADMAP.md`). |

### Visor

**Datos:** el visor pide `GET /shots` al cargar y en cada evento `shots`. Sin servidor, la función se oculta y el detalle muestra "Capturas disponibles con `visual-roadmap live`".

**Compresor:** cola secuencial en `requestIdleCallback` para entradas con `compressed: false`: carga la imagen, la dibuja en un canvas de ancho ≤ 1600 px, `toBlob('image/webp', 0.8)` y `POST` solo si ocupa menos que el original.

**Timeline:**

- Etiqueta de tarea con `📷 N` cuando tiene capturas.
- Hover sobre la barra: miniatura de la portada (≤ 240 px) junto al tooltip.
- Con zoom de 1 día o menos, una marca pequeña sobre la barra en el instante de cada captura.

**Detalle de la tarea:** panel de ~560 px con cabecera (estado, `elapsed / expected`, chip) y un log vertical cronológico que mezcla:

- inicio y fin de la tarea,
- cambios de ETA,
- capturas (miniatura, caption, origen),
- commits que citan el ID,
- notas de "Últimos cambios" que mencionan el ID.

Clic en una miniatura ⇒ lightbox a pantalla completa con ← → entre las capturas de la tarea y `Esc` para cerrar. Imágenes con `loading="lazy"`.

## Errores

| Caso | Comportamiento |
| --- | --- |
| Formato o tamaño inválido en `shot` | Error en una línea, código 1. |
| `index.json` corrupto | Se renombra a `index.json.bak` y se empieza uno nuevo; aviso en `check`. |
| Archivo del índice que ya no existe | Se omite en `list` y se limpia en el siguiente `prune`. |
| Falla la compresión en el navegador | Se deja el original y se marca para no reintentar en esa sesión. |
| Error en el hook | Silencio, código 0. |

## Tests

- `test/shots.test.js`: deduplicación, throttle, portada, retención (por tarea y global), `resolve` rechaza `../`, escritura atómica, índice corrupto.
- `test/hook-shots.test.js`: fixtures reales de Chrome MCP, Playwright MCP y `Read`; sin tarea activa no guarda; errores no cambian el código de salida.
- `test/live.test.js`: `GET /shots`, `GET /shots/file` (incluido intento de path traversal), `POST /shots/:id`, evento SSE.
- Visor: capturas regeneradas en oscuro y claro, con una tarea demo que tenga capturas.

## Entrega

Sin push ni release hasta que el usuario revise el resultado en local.
