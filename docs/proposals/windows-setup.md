# Instalación e integración con agentes: propuesta pendiente

Fecha: 2026-09-27.

**Estado: solo documentación. Implementación aplazada por disponibilidad de cuota.**
El usuario confirmó priorizar Windows. Los comandos y comportamientos propuestos
aquí no están implementados ni constituyen un diseño técnico aprobado.

## Objetivo

Instalar Visual Roadmap una vez por usuario y ejecutarlo desde la raíz de cada
proyecto con `ROADMAP.md`, sin copiar el software dentro del repositorio.
Conservar la instalación por proyecto como alternativa. Facilitar la preparación
con un asistente de terminal y dar a los agentes un protocolo breve, verificable
y económico en tokens.

## Situación actual revisada

- El paquete declara el ejecutable `visual-roadmap`; el README propone instalar
  desde GitHub como dependencia de desarrollo. No documenta publicación en npm.
- `init` crea el roadmap, copia el visor portable y la skill, e instala bloques
  de instrucciones y hooks según el entorno detectado.
- El servidor ya sirve el visor desde el paquete instalado: la copia de
  `roadmap.html` no es necesaria para el visor en vivo.
- Los comandos de tareas buscan `ROADMAP.md` en directorios superiores hasta
  encontrarlo o alcanzar la raíz Git; `live` y `serve` resuelven desde el
  directorio actual. Los hooks tienen otra resolución de contexto.
- La skill y los bloques generados asumen `npx visual-roadmap`.
- Algunos hooks arrancan automáticamente una tarea tras detectar cambios.
  La skill recomienda `done --next`, que inicia otra tarea inmediatamente.
- Las mutaciones de tareas leen y escriben el Markdown directamente. No debe
  prometerse coordinación fiable entre varios escritores sin resolverla.

Referencias de implementación: `bin/visual-roadmap.js`, `lib/server.js`,
`lib/agent.js`, `SKILL.md` y `README.md`. Revisarlas de nuevo al retomar.

## Dirección propuesta

Separar tres responsabilidades:

1. **Programa:** instalación por usuario (opción recomendada) o por proyecto.
2. **Datos:** `ROADMAP.md` permanece en el proyecto; capturas y estado auxiliar
   siguen siendo propios de ese proyecto.
3. **Integración:** instrucciones y skill del agente con alcance explícito.
   Instalar el programa por usuario no implica activar hooks globalmente.
   Un repositorio puede compartir instrucciones aunque el programa sea externo.

El visor portable pasaría a ser una exportación opcional. No introducir un
servicio permanente ni una base de datos global para resolver este flujo.

## Experiencia deseada (aún no disponible)

```text
visual-roadmap setup
  Instalación: Usuario / Proyecto
  Integraciones: seleccionar agentes
  Resumen: destinos, archivos y configuración que cambiarán

cd mi-proyecto
visual-roadmap init
visual-roadmap
```

- `setup`: asistente TUI sencillo para humanos; equivalente por flags para
  automatización. Debe poder repetirse sin duplicar ni destruir configuración.
- `init`: prepara o vincula el proyecto preservando su roadmap existente.
- Sin argumentos: abre el roadmap del proyecto. Si falta, ofrece inicializarlo
  solo en terminal interactiva; en ejecución automatizada informa cómo proceder.
- Los agentes usan comandos explícitos y nunca quedan esperando una selección
  interactiva. Las operaciones habituales no deben descargar paquetes.
- `doctor` (propuesto): muestra ejecutable y versión efectivos, roadmap resuelto,
  integración, problemas detectados y acciones concretas para corregirlos.

## Prioridad Windows

Diseñar primero para Windows y PowerShell, incluyendo rutas con espacios,
acentos y carpetas de OneDrive. La instalación por usuario debería funcionar
sin privilegios de administrador y explicar cuándo el PATH requiere abrir una
nueva terminal. Detectar instalaciones duplicadas y explicar cuál se ejecuta.

**Pendiente de decidir:** cómo obtener el primer instalador antes de que exista
el comando `setup`, mecanismo de distribución, ubicación por usuario, requisito
de Node.js, actualizaciones, desinstalación y selección de versión por proyecto.
No asumir que una instalación global de npm equivale al alcance por usuario
deseado. macOS y Linux quedan para una fase posterior.

## Contrato para agentes y documentación

- Unificar resolución del proyecto en tareas, visor y hooks, con `--file`
  explícito como prioridad. Definir límites para repositorios anidados y worktrees.
- Mantener una skill canónica y breve: `status` al retomar; planificar solo lo
  nuevo; `start` antes del trabajo; `done` únicamente con evidencia real.
- Consultar documentación extensa solo cuando haga falta. Salida compacta por
  defecto y estructurada cuando corresponda; evitar sondeos periódicos inútiles.
- Registrar trabajo efectivamente iniciado. Proponer arranque automático y
  `done --next` como opciones, no como obligación del protocolo.
- Distinguir pausa de bloqueo; no inventar porcentajes, estimaciones ni pruebas.
- Usar el ejecutable instalado y resolver su ubicación sin depender de una
  descarga implícita mediante `npx`.
- Antes de soportar varios agentes escritores, definir propiedad de tareas,
  exclusión mutua y escrituras seguras para evitar pérdida de actualizaciones.
- Documentar capacidades reales por integración; no presentar los hooks de
  Claude Code como automatización disponible en todos los agentes.
- Preservar configuración ajena; actualizar únicamente archivos o bloques
  propios. Definir migración para skills, hooks y copias del visor existentes.
- Organizar documentación en inicio rápido por alcance, protocolo del agente y
  diagnóstico. Verificar ejemplos contra la CLI para evitar divergencias.

## Orden sugerido al retomar

1. Confirmar distribución inicial, alcance de integración y contrato de versiones.
2. Cerrar diseño de resolución de proyecto y comandos no interactivos.
3. Implementar instalación Windows, asistente y diagnóstico sobre esos comandos.
4. Actualizar skill, documentación y migración de instalaciones anteriores.

Pruebas de aceptación futuras: instalación por usuario y por proyecto; rutas
con espacios; proyecto nuevo y existente; ejecución desde subcarpetas; dos
proyectos abiertos; puerto ocupado; terminal sin TTY; repetición del setup;
preservación de instrucciones ajenas; actualización y desinstalación sin borrar
roadmaps. Probar concurrencia si se incorpora soporte para varios escritores.

## Límite de esta entrega

Solo se registra la propuesta y la prioridad Windows. No cambia el instalador,
el arranque, los hooks, la skill vigente ni el formato del roadmap. No publicar
los comandos propuestos como instrucciones de uso hasta implementarlos y
verificarlos. Retomar desde este documento, sin repetir la exploración completa.
