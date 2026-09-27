# Desarrollo del visor

## Estructura

| Ruta | Función |
| --- | --- |
| `cli.js` | Comandos `init`, `live`, `serve`, `open` y `skill`. |
| `server.js` | Servidor local y eventos SSE al cambiar el roadmap. |
| `viewer/` | Fuentes del visor: parser, previsiones, vistas, idiomas y estilos. |
| `build.js` | Inserta CSS y JavaScript del visor en un HTML portátil. |
| `dist/roadmap.html` | HTML generado que se copia con `init` y sirve en modo live. |
| `ROADMAP.seed.md` | Plantilla inicial sin tareas ficticias. |
| `SKILL.md` | Instrucciones breves para el agente que mantiene el roadmap. |
| `examples/` | Datos de demostración, separados del template. |
| `test/` | Pruebas del parser, las previsiones y la sincronización. |

## Flujo local

```bash
npm test
npm run build
npm start
```

`npm start` usa la demo ficticia en `examples/VOIDFRONT.md` y abre el servidor local en el puerto 3579. Para seguir un proyecto real, usa `node cli.js serve --file ruta/ROADMAP.md --port 3580` o instala el comando en ese proyecto.

Edita las fuentes de `viewer/` y vuelve a ejecutar `npm run build` antes de distribuir la herramienta o probar el HTML portátil. `dist/roadmap.html` está versionado porque `init` lo copia sin requerir un paso de compilación en el proyecto del usuario. Comprueba que el bundle generado acompaña siempre a los cambios de sus fuentes.

La sincronización usa un servidor en `127.0.0.1` y eventos SSE. El visor portátil también permite seleccionar un archivo manualmente. No requiere cuenta ni servicio remoto.
