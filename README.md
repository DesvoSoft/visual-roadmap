# Visual Roadmap

Visor local para seguir el trabajo de un agente de programación. Lee `ROADMAP.md` y muestra entregables, versiones, cronograma, tarea activa, ETA y revisiones de estimaciones. El agente actualiza el archivo cuando cambia el trabajo; el visor actualiza la pantalla automáticamente.

## Probarlo en otro proyecto

Requiere Node.js 18 o superior. Instala esta versión desde GitHub dentro del proyecto que vas a seguir:

```bash
npm install --save-dev git+https://github.com/DesvoSoft/visual-roadmap.git
npx visual-roadmap init --project "Mi proyecto"
npx visual-roadmap live
```

`init` crea `ROADMAP.md`, copia el visor portátil a `roadmap.html` y añade `SKILL.md` si no existe. No sobrescribe archivos existentes salvo que uses `--force`. `live` abre un servidor local que observa `ROADMAP.md`; si el puerto 3579 está ocupado, usa `--port 3580`. También puedes abrir `roadmap.html` directamente y seleccionar el archivo con **Open**.

El paquete aún no está publicado en npm. El enlace de GitHub de arriba instala esta versión del repositorio. Para trabajar desde un clon local, ejecuta `node ruta/al/clon/cli.js init` desde la carpeta de tu proyecto y luego `node ruta/al/clon/cli.js live`.

## Pedírselo a un agente

Después de instalar la herramienta, puedes darle esta instrucción:

> Lee `SKILL.md` y revisa este proyecto. Crea o actualiza `ROADMAP.md` con versiones y entregables verificables, IDs estables, dependencias y esfuerzo aproximado. Mantén una tarea activa y una ETA tentativa en minutos u horas mientras trabajas. Actualiza el archivo al iniciar o terminar tareas, verificar progreso, encontrar bloqueos o revisar una ETA; registra la razón de cada revisión. No inventes pruebas completadas ni fechas comprometidas. Comprueba la vista con `npx visual-roadmap live`.

El agente no necesita reescribir el archivo cada minuto: el visor calcula el tiempo transcurrido. Las barras rayadas del cronograma son proyecciones a partir del esfuerzo; las fechas declaradas en el archivo son planes del agente. Las ETA son orientativas y se recalculan con las duraciones reales cuando están disponibles.

## Qué muestra

- **Tracking:** entregables, dependencias, fechas declaradas y proyecciones, con búsqueda y varias escalas de tiempo.
- **Versions:** avance y tareas de cada versión, ventana de entrega y filtros.
- **Notes:** cambios y decisiones registrados en el roadmap.
- **Preferencias:** inglés por defecto, español opcional y temas oscuro o claro. Se guardan en el navegador.
- **Conexión:** estado de sincronización del archivo local.

El formato compatible y las reglas de actualización están en [SKILL.md](SKILL.md). Hay una [guía del formato](docs/ROADMAP_FORMAT.md) y una [guía de desarrollo](docs/DEVELOPMENT.md).

## Comandos

| Comando | Uso |
| --- | --- |
| `visual-roadmap init --project "Nombre"` | Crea los archivos iniciales sin sobrescribirlos. |
| `visual-roadmap live --port 3579` | Abre el visor y escucha cambios en `ROADMAP.md`. |
| `visual-roadmap serve --file ruta/ROADMAP.md` | Sirve el visor sin abrir el navegador. |
| `visual-roadmap open` | Abre el HTML portátil. |
| `visual-roadmap skill` | Muestra la ruta del protocolo para agentes. |

Desde este repositorio, `npm start` abre la [demo ficticia](examples/VOIDFRONT.md). El archivo de demo no describe el estado de este proyecto.

## Licencia

MIT. Consulta [LICENSE](LICENSE).
