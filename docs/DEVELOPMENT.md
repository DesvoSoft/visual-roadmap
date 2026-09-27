# Desarrollo del visor

## Estructura

| Ruta | Función |
| --- | --- |
| `bin/visual-roadmap.js` | CLI: `init`, `live`, `serve`, `open`, comandos del agente y hooks. |
| `lib/agent.js` | Ediciones deterministas de `ROADMAP.md` para los comandos del agente (`start`, `done`, `eta`…). Funciones puras texto → texto; es el `main` del paquete. |
| `lib/git.js` | Lectura de git sin escribir: commits recientes con IDs de tarea y líneas cambiadas desde una hora dada. |
| `lib/server.js` | Servidor local, eventos SSE al cambiar el roadmap y `/git` para commits. |
| `viewer/` | Fuentes del visor: parser, previsiones, vistas, idiomas y estilos. |
| `dist/roadmap.html` | HTML generado que se copia con `init` y sirve en modo live. |
| `templates/ROADMAP.seed.md` | Plantilla inicial sin tareas ficticias. |
| `SKILL.md` | Protocolo del agente que `init` instala en cada proyecto. |
| `scripts/` | `build.js` genera el HTML portátil; `screenshots.js` regenera las capturas del README. |
| `examples/` | Datos de demostración, separados de la plantilla. |
| `test/` | Pruebas del parser, las previsiones, los comandos del agente, el servidor y los hooks. |
| `.github/workflows/ci.yml` | Pruebas en Linux y Windows con Node 18, 20 y 22, y comprobación de que el bundle está al día. |

## Flujo local

```bash
npm test
npm run build
npm start
npm run screenshots
```

`npm start` usa la demo ficticia en `examples/VOIDFRONT.md` y abre el servidor local en el puerto 3579. Para seguir un proyecto real, usa `node bin/visual-roadmap.js serve --file ruta/ROADMAP.md --port 3580` o instala el comando en ese proyecto.

Edita las fuentes de `viewer/` y vuelve a ejecutar `npm run build` antes de distribuir la herramienta o probar el HTML portátil. `dist/roadmap.html` está versionado porque `init` lo copia sin requerir un paso de compilación en el proyecto del usuario. La CI falla si `dist/roadmap.html` no coincide con las fuentes. Registra los cambios relevantes en `CHANGELOG.md`.

La sincronización usa un servidor en `127.0.0.1` y eventos SSE. El visor portátil también permite seleccionar un archivo manualmente. No requiere cuenta ni servicio remoto.
