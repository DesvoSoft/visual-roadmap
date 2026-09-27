/* Interface preferences and copy. Roadmap content is never translated. */
(function (global) {
  'use strict';
  const copy = {
    en: {
      roadmap:'ROADMAP', tracking:'TRACKING', versions:'VERSIONS', notes:'NOTES', progress:'PROGRESS TRACKER',
      open:'Open', pick:'Open ROADMAP.md', choose:'Select ROADMAP.md to start tracking',
      connected:'Synced', connecting:'Connecting', disconnected:'Disconnected', snapshot:'Snapshot', updatedAgo:'Updated {time} ago', unknownUpdate:'Update time unknown',
      version:'Version', phase:'Phase', of:'of', tasks:'tasks', decisions:'decisions', lines:'lines', lastCommit:'last commit',
      now:'CURRENT TASK', noTask:'No active task', markActive:'Waiting for the agent to start a task', expected:'Expected', elapsed:'Elapsed', agentEta:'Agent ETA', revisedEta:'Revised ETA',
      delayed:'Delayed', provisional:'provisional', etaExtended:'ETA extended by', noEstimate:'No estimate',
      phasesDone:'Phases completed', calculatedDelivery:'Projected delivery', pace:'Observed pace', since:'In development since', perTask:'per task',
      recentChanges:'RECENT CHANGES', etaChanges:'ETA CHANGES', noChanges:'No changes recorded in ROADMAP.md', noRevisions:'No ETA revisions recorded',
      missingEffort:'task(s) lack effort estimates; the project ETA may be incomplete.', reviewEta:'The active task has passed its ETA. The agent should revise it.',
      calibrated:'Forecast adjusted using {count} completed task(s) and capacity {capacity}.', basedOnEffort:'Forecast based on remaining effort and declared capacity.',
      range:'Indicative window', confidence:'confidence', low:'low', medium:'medium', high:'high',
      deliverables:'DELIVERABLES', search:'Search deliverables', expand:'Expand all', collapse:'Collapse all', nowButton:'NOW',
      pending:'Pending', blocked:'Blocked', overdue:'Overdue', undated:'No fixed dates',
      versionDone:'VERSION · DONE', noPhases:'No phases or tasks in ROADMAP.md.', fixedDate:'task(s) without fixed dates', declared:'Solid: declared dates', projection:'Striped: projection', dayPrecision:'Day precision; add HH:mm to Start and End for exact timing',
      status:'Status', taskProgress:'Progress', owner:'Owner', estimatedEffort:'Estimated effort', actualDuration:'Actual duration', pendingDuration:'Pending',
      plannedStart:'Planned start', plannedEnd:'Planned end', depends:'Depends on', noDependencies:'No dependencies', calculatedWindow:'Projected window', estimateHistory:'ESTIMATE HISTORY', noReason:'No reason recorded', close:'Close details',
      versionsTitle:'VERSIONS & DELIVERABLES', noVersions:'No versions are defined in ROADMAP.md.', all:'All', inProgress:'In progress', openItems:'Open', done:'Done',
      items:'Items', effort:'Effort', schedule:'Schedule', remaining:'remaining', projectDays:'project days', noItems:'No items match this filter',
      releaseWindow:'Delivery window', activeTasks:'Active', riskTasks:'At risk', completion:'Completion', releaseDetails:'Release details',
      logEmpty:'The log is empty. Add entries under ## Log in ROADMAP.md.', completed:'completed', cancelled:'cancelled', noDate:'No date',
      planned:'Planned', active:'Active', paused:'Paused', slip:'Slipped', blockedStatus:'Blocked', risk:'At risk', cancelledStatus:'Cancelled', calculated:'calculated', plannedLabel:'planned',
      health:'ROADMAP HEALTH', health_error:'error(s)', health_warn:'warning(s)', health_info:'suggestion(s)', parseError:'Could not read ROADMAP.md',
      ago:'{time} ago', commits:'COMMITS', notifyOn:'Notifications on (task done, blocked or stuck)', notifyOff:'Enable desktop notifications', allDone:'All tasks done'
    },
    es: {
      roadmap:'HOJA DE RUTA', tracking:'SEGUIMIENTO', versions:'VERSIONES', notes:'NOTAS', progress:'SEGUIMIENTO DEL PROGRESO',
      open:'Abrir', pick:'Abrir ROADMAP.md', choose:'Selecciona ROADMAP.md para comenzar el seguimiento',
      connected:'Sincronizado', connecting:'Conectando', disconnected:'Sin conexión', snapshot:'Vista puntual', updatedAgo:'Actualizado hace {time}', unknownUpdate:'Fecha de actualización desconocida',
      version:'Versión', phase:'Fase', of:'de', tasks:'tareas', decisions:'decisiones', lines:'líneas', lastCommit:'último commit',
      now:'TAREA ACTUAL', noTask:'Sin tarea en curso', markActive:'Esperando a que el agente inicie una tarea', expected:'Esperado', elapsed:'Transcurrido', agentEta:'ETA del agente', revisedEta:'ETA revisada',
      delayed:'Retraso', provisional:'provisional', etaExtended:'ETA ampliada', noEstimate:'Sin estimación',
      phasesDone:'Fases completadas', calculatedDelivery:'Entrega calculada', pace:'Ritmo observado', since:'En desarrollo desde', perTask:'por tarea',
      recentChanges:'ÚLTIMOS CAMBIOS', etaChanges:'CAMBIOS DE ETA', noChanges:'Sin cambios registrados en ROADMAP.md', noRevisions:'Sin revisiones de ETA registradas',
      missingEffort:'tarea(s) sin esfuerzo estimado; la ETA global puede estar incompleta.', reviewEta:'La tarea activa superó su ETA. El agente debe revisarla.',
      calibrated:'Proyección ajustada con {count} tarea(s) terminadas y capacidad {capacity}.', basedOnEffort:'Proyección según esfuerzo pendiente y capacidad declarada.',
      range:'Ventana orientativa', confidence:'confianza', low:'baja', medium:'media', high:'alta',
      deliverables:'ENTREGABLES', search:'Buscar entregables', expand:'Expandir todo', collapse:'Colapsar todo', nowButton:'AHORA',
      pending:'Pendientes', blocked:'Bloqueadas', overdue:'Vencidas', undated:'Sin fechas fijas',
      versionDone:'VERSIÓN · HECHAS', noPhases:'No hay fases ni tareas en ROADMAP.md.', fixedDate:'tarea(s) sin fecha fija', declared:'Sólido: fecha declarada', projection:'Rayas: proyección', dayPrecision:'Precisión de día; añade HH:mm a Inicio y Fin para ubicarla exactamente',
      status:'Estado', taskProgress:'Progreso', owner:'Responsable', estimatedEffort:'Esfuerzo estimado', actualDuration:'Duración real', pendingDuration:'Pendiente',
      plannedStart:'Inicio declarado', plannedEnd:'Fin declarado', depends:'Depende de', noDependencies:'Sin dependencias', calculatedWindow:'Ventana calculada', estimateHistory:'HISTORIAL DE ESTIMACIONES', noReason:'Sin motivo registrado', close:'Cerrar ficha',
      versionsTitle:'VERSIONES Y ENTREGABLES', noVersions:'No hay versiones definidas en ROADMAP.md.', all:'Todo', inProgress:'En curso', openItems:'Abierto', done:'Hecho',
      items:'Ítems', effort:'Esfuerzo', schedule:'Plazo', remaining:'restantes', projectDays:'días de proyecto', noItems:'No hay ítems para este filtro',
      releaseWindow:'Ventana de entrega', activeTasks:'Activas', riskTasks:'En riesgo', completion:'Avance', releaseDetails:'Detalle de la versión',
      logEmpty:'El log está vacío. Agrega entradas a ## Log en ROADMAP.md.', completed:'completados', cancelled:'cancelados', noDate:'Sin fecha',
      planned:'Planeado', active:'En curso', paused:'Pausada', slip:'Desplazada', blockedStatus:'Bloqueado', risk:'En riesgo', cancelledStatus:'Descartado', calculated:'calculada', plannedLabel:'planificada',
      health:'SALUD DEL ROADMAP', health_error:'error(es)', health_warn:'aviso(s)', health_info:'sugerencia(s)', parseError:'No se pudo leer ROADMAP.md',
      ago:'hace {time}', commits:'COMMITS', notifyOn:'Notificaciones activas (tarea hecha, bloqueada o atascada)', notifyOff:'Activar notificaciones de escritorio', allDone:'Todas las tareas terminadas'
    }
  };
  function saved(key, fallback) { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } }
  let language = saved('visual-roadmap-language','en') === 'es' ? 'es' : 'en';
  let theme = saved('visual-roadmap-theme','dark') === 'light' ? 'light' : 'dark';
  function t(key, vars) {
    let value = copy[language][key] || copy.en[key] || key;
    for (const [name, replacement] of Object.entries(vars || {})) value = value.replaceAll(`{${name}}`, String(replacement));
    return value;
  }
  function apply() {
    document.documentElement.lang = language;
    document.documentElement.dataset.theme = theme;
    document.querySelectorAll('[data-i18n]').forEach(node => { node.textContent = t(node.dataset.i18n); });
    document.querySelectorAll('[data-i18n-title]').forEach(node => { node.title = t(node.dataset.i18nTitle); });
    const picker = document.getElementById('language-select');
    if (picker) picker.value = language;
    const button = document.getElementById('theme-toggle');
    if (button) { button.textContent = theme === 'dark' ? '☀' : '☾'; button.title = theme === 'dark' ? 'Light theme' : 'Dark theme'; }
  }
  function setLanguage(value) { language = value === 'es' ? 'es' : 'en'; try { localStorage.setItem('visual-roadmap-language',language); } catch {} apply(); document.dispatchEvent(new Event('roadmap:preferences')); }
  function setTheme(value) { theme = value === 'light' ? 'light' : 'dark'; try { localStorage.setItem('visual-roadmap-theme',theme); } catch {} apply(); document.dispatchEvent(new Event('roadmap:preferences')); }
  document.addEventListener('DOMContentLoaded', apply);
  global.UI = { t, apply, setLanguage, setTheme, get language() { return language; }, get theme() { return theme; } };
})(typeof window !== 'undefined' ? window : globalThis);
