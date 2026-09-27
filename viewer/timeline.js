/* Chronogram from declared dates and provisional effort projections. */
(function (global) {
  'use strict';
  const DAY = 86400000;
  const scales = { '6h': [6*3600000,3600000], '1d': [DAY,2*3600000], '3d': [3*DAY,12*3600000], '1w': [7*DAY,DAY], '1m': [30*DAY,5*DAY] };
  let zoom = '1d', offset = 0, search = '';
  let liveRange = null;
  const expanded = new Set();
  const t = key => global.UI.t(key);
  let initialized = false;
  function el(tag, cls, label) { const n = document.createElement(tag); n.className = cls; if (label != null) n.textContent = label; return n; }
  function time(raw, end) {
    if (!raw || typeof raw !== 'string') return null;
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw + (end ? 'T23:59:59' : 'T00:00:00') : raw.replace(' ','T'));
    return isNaN(d.getTime()) ? null : d.getTime();
  }
  function windowForItem(item, prediction) {
    const declaredStart = time(item.start, false), declaredEnd = time(item.end, true);
    const coarse = /^\d{4}-\d{2}-\d{2}$/.test(item.start || '') && /^\d{4}-\d{2}-\d{2}$/.test(item.end || '');
    const shortHours = item.actual || item.effort;
    if (coarse && shortHours > 0 && shortHours <= 3) {
      const midpoint = (declaredStart + declaredEnd) / 2;
      const half = shortHours * 3600000 / 2;
      return { start: midpoint - half, end: midpoint + half, coarse: true };
    }
    if (declaredStart != null && declaredEnd != null) return { start: declaredStart, end: declaredEnd, coarse: false, estimated: false };
    if (prediction) return { start: prediction.start, end: prediction.end, coarse: false, estimated: true };
    const duration = shortHours > 0 ? shortHours * 3600000 : null;
    if (duration != null && declaredStart != null) return { start: declaredStart, end: declaredStart + duration, coarse: true, estimated: true };
    if (duration != null && declaredEnd != null) return { start: declaredEnd - duration, end: declaredEnd, coarse: true, estimated: true };
    return { start: declaredStart, end: declaredEnd, coarse: false, estimated: false };
  }
  function clockLabel(now) { return new Intl.DateTimeFormat(global.UI.language,{hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(now)); }
  function render(doc, container) {
    container.replaceChildren();
    if (!doc?.releases?.length) { container.appendChild(el('div','empty-state',t('noPhases'))); return; }
    const forecast = global.Forecast.calculate(doc);
    if (!initialized) {
      const current = doc.releases.find(r => r.items.some(it => it.status === 'active'));
      if (current) expanded.add(current.id);
      else doc.releases.slice(0, 2).forEach(r => expanded.add(r.id));
      const days = forecast.totalRemaining / (24 * 60);
      if (days > 5) zoom = '1m';
      else if (days > 2) zoom = '1w';
      else if (days > .6) zoom = '3d';
      else if (days <= .17) zoom = '6h';   /* a short agent session: under ~4h of work left */
      initialized = true;
    }
    const now = Date.now(), span = scales[zoom][0], tick = scales[zoom][1], start = now + offset*span - span*.3, end = start+span;
    liveRange = { start, end, span, container, doc };
    const pos = ms => (ms-start)/span*100;
    const toolbar = el('div','subnav-bar'), controls = el('div','subnav-controls');
    toolbar.appendChild(el('strong','timeline-title',t('deliverables')));
    const input = el('input','search-input'); input.placeholder = t('search'); input.value = search;
    input.addEventListener('input', () => { search=input.value.toLowerCase().trim(); render(doc,container); container.querySelector('.search-input').focus(); });
    controls.appendChild(input);
    const expand=el('button','btn-icon-toggle',t('expand'));
    expand.addEventListener('click',()=>{doc.releases.forEach(group=>expanded.add(group.id));render(doc,container);});
    const collapse=el('button','btn-icon-toggle',t('collapse'));
    collapse.addEventListener('click',()=>{doc.releases.forEach(group=>expanded.delete(group.id));render(doc,container);});
    controls.append(expand,collapse);
    for (const [key,label] of [['6h','6 H'],['1d',global.UI.language==='es'?'1 DÍA':'1 DAY'],['3d',global.UI.language==='es'?'3 DÍAS':'3 DAYS'],['1w',global.UI.language==='es'?'1 SEMANA':'1 WEEK'],['1m',global.UI.language==='es'?'1 MES':'1 MONTH']]) {
      const b=el('button','zoom-btn'+(zoom===key?' zoom-btn--active':''),label);
      b.addEventListener('click',()=>{zoom=key;offset=0;render(doc,container);}); controls.appendChild(b);
    }
    for (const [label,delta] of [['‹',-1],[t('nowButton'),0],['›',1]]) {
      const b=el('button','btn-nav-now',label);
      b.addEventListener('click',()=>{offset=delta?offset+delta:0;render(doc,container);}); controls.appendChild(b);
    }
    toolbar.appendChild(controls); container.appendChild(toolbar);
    const late = doc.items.filter(it => it.status !== 'done' && it.status !== 'cancelled' && time(it.end,true) != null && time(it.end,true) < now).length;
    const blocked = doc.items.filter(it => it.status === 'blocked').length;
    const missingDates = doc.items.filter(it => it.status !== 'done' && !it.start && !it.end).length;
    const signals = el('div','timeline-signals');
    for (const [key,value] of [['pending',doc.stats.open],['blocked',blocked],['overdue',late],['undated',missingDates]]) {
      const label=t(key);
      const signal=el('span','timeline-signal',`${label}: ${value}`);
      if(value && (key==='blocked'||key==='overdue')) signal.classList.add('timeline-signal--alert');
      signals.appendChild(signal);
    }
    container.appendChild(signals);
    const tracker=el('div','tracker-container'), table=el('div','tracker-table');
    const left=el('div','tracker-left'), right=el('div','tracker-right');
    left.appendChild(el('div','tracker-left__head',t('versionDone')));
    const head=el('div','tracker-right__head'); head.style.width='100%';
    /* Ticks sit on round local hours/days so labels read 09:00, 12:00… */
    const midnight=new Date(start); midnight.setHours(0,0,0,0);
    for(let ms=midnight.getTime()+Math.ceil((start-midnight.getTime())/tick)*tick; ms<=end; ms+=tick) {
      const date=new Intl.DateTimeFormat(global.UI.language,{day:'numeric',month:'short'}).format(new Date(ms));
      const label=span<=DAY?clockLabel(ms):tick<DAY?`${date} ${clockLabel(ms)}`:date;
      const cell=el('div','time-tick-cell',label); cell.style.left=`${pos(ms)}%`; head.appendChild(cell);
    }
    right.appendChild(head);
    const lRows=el('div','tracker-left__rows'), rRows=el('div','tracker-right__rows'); rRows.style.width='100%';
    function row(label,bar,phase) {
      const l=el('div',phase?'phase-head-row':'task-label-row',label), r=el('div',phase?'phase-bar-row':'tracker-bar-row');
      if(bar) r.appendChild(bar); lRows.appendChild(l);rRows.appendChild(r);return l;
    }
    let undated=0;
    doc.releases.forEach((rel,index)=>{
      const items=(rel.items||[]).filter(it=>!search||`${it.taskId||''} ${it.name}`.toLowerCase().includes(search));
      if(search&&!items.length)return;
      const key=rel.id||String(index), done=rel.items.filter(it=>it.status==='done').length;
      let summary=null;
      const phaseStart=time(rel.start,false), phaseEnd=time(rel.end,true);
      if(phaseStart!=null&&phaseEnd!=null&&phaseEnd>=start&&phaseStart<=end){
        summary=el('div','phase-summary-bar');
        summary.style.left=`${Math.max(0,pos(phaseStart))}%`;
        summary.style.width=`${Math.max(1.5,Math.min(100,pos(phaseEnd))-Math.max(0,pos(phaseStart)))}%`;
        summary.appendChild(el('div','phase-seg-done'));
        summary.firstChild.style.width=`${rel.progress||0}%`;
      }
      const phase=row(`${expanded.has(key)?'⌄':'›'}  ${rel.id} · ${rel.name}   ${done}/${rel.items.length}`,summary,true);
      phase.setAttribute('role','button');phase.tabIndex=0;
      const toggle=()=>{expanded.has(key)?expanded.delete(key):expanded.add(key);render(doc,container);};
      phase.addEventListener('click',toggle);phase.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')toggle();});
      if(!expanded.has(key)&&!search)return;
      items.forEach(it=>{
        const predicted = forecast.projections.get(it.id);
        const window = windowForItem(it,predicted);
        const a=window.start, b=window.end;
        const provisional = window.estimated;
        let bar=null;
        if(a!=null||b!=null){
          const from=a??b,to=b??a;
          if(to>=start&&from<=end){
            const left=Math.max(0,pos(from)), right=Math.min(100,pos(to)), width=Math.max(0,right-left);
            bar=el('div',`tracker-bar tracker-bar--${it.status==='done'?'done':it.status==='active'?'now':'planned'}${provisional?' tracker-bar--provisional':''}${width<8?' tracker-bar--compact':''}`,width>=8?it.name:'');
            bar.style.left=`${left}%`;
            bar.style.width=`${width}%`;
            bar.title=window.coarse ? `${it.name} · ${t('dayPrecision')}` : provisional ? `${it.name} · ${t('projection')}` : `${it.name} · ${it.start||'?'} → ${it.end||'?'} · ${it.status}`;
          }
        }
        if(!it.start&&!it.end)undated++;
        const l=row(`${it.status==='done'?'■':it.status==='active'?'▰':'□'}  ${it.taskId||''} ${it.name}`,bar,false);
        if(!it.start&&!it.end)l.title=provisional?t('projection'):t('undated');
        l.setAttribute('role','button'); l.tabIndex=0; l.classList.add('task-label-row--interactive');
        if(it.status==='cancelled')l.classList.add('task-label-row--cancelled');
        if(it.status==='blocked')l.classList.add('task-label-row--blocked');
        l.addEventListener('click',()=>showDetail(it,doc,forecast));
        l.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')showDetail(it,doc,forecast);});
        if(bar)bar.addEventListener('click',()=>showDetail(it,doc,forecast));
      });
    });
    if(start<=now&&now<=end){
      const line=el('div','vertical-now-line');line.style.left=`${pos(now)}%`;right.appendChild(line);
      const label=el('div','vertical-now-label',`${t('nowButton')} ${clockLabel(now)}`);
      label.style.left=`${Math.max(7,Math.min(93,pos(now)))}%`;head.appendChild(label);
    }
    left.appendChild(lRows);right.appendChild(rRows);table.append(left,right);tracker.appendChild(table);
    tracker.appendChild(el('div','timeline-legend',`${undated} ${t('fixedDate')} · ${t('declared')} · ${t('projection')}`));
    container.appendChild(tracker);
    right.addEventListener('scroll',()=>{lRows.scrollTop=right.scrollTop;});
  }
  function showDetail(item, doc, forecast) {
    document.querySelector('.task-detail-overlay')?.remove();
    const overlay=el('div','task-detail-overlay');
    const panel=el('section','task-detail-panel');
    panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label',item.name);
    const close=el('button','task-detail-close','×');close.setAttribute('aria-label',t('close'));
    const dismiss=()=>{document.removeEventListener('keydown',onKey);overlay.remove();};
    const onKey=e=>{if(e.key==='Escape')dismiss();};
    close.addEventListener('click',dismiss);
    overlay.addEventListener('click',e=>{if(e.target===overlay)dismiss();});
    document.addEventListener('keydown',onKey);
    panel.append(close,el('div','hud-card__head-label',item.taskId||t('deliverables')),el('h2','task-detail-title',item.name));
    const fields=[
      [t('status'),t(item.status==='done'?'done':item.status==='blocked'?'blockedStatus':item.status==='cancelled'?'cancelledStatus':item.status)],
      [t('taskProgress'),`${item.progress||0} %`],
      [t('owner'),item.owner||'—'],
      [t('estimatedEffort'),item.effortRaw||t('noEstimate')],
      [t('actualDuration'),item.actual?global.Roadmap.fmtEffort(item.actual):t('pendingDuration')],
      [t('plannedStart'),item.start||t('noDate')],
      [t('plannedEnd'),item.end||t('noDate')],
      [t('depends'),item.depends.length?item.depends.join(', '):t('noDependencies')]
    ];
    const prediction=forecast.projections.get(item.id);
    if(prediction)fields.push([t('calculatedWindow'),`${global.Forecast.dateTime(prediction.start)} → ${global.Forecast.dateTime(prediction.end)}`]);
    fields.forEach(([label,value])=>{
      const line=el('div','task-detail-row');line.append(el('span','',label),el('strong','',value));panel.appendChild(line);
    });
    if(item.note)panel.appendChild(el('p','task-detail-note',item.note));
    const changes=(doc.estimateChanges||[]).filter(change=>change.taskId.toUpperCase()===(item.taskId||'').toUpperCase());
    if(changes.length){
      panel.appendChild(el('h3','hud-card__head-label',t('estimateHistory')));
      changes.forEach(change=>panel.appendChild(el('div','estimate-event',`${change.at} · ${change.remaining} ${t('remaining')} · ${change.reason||t('noReason')}`)));
    }
    const commits=item.taskId?(global.RoadmapGit||[]).filter(c=>c.tasks.includes(item.taskId.toUpperCase())):[];
    if(commits.length){
      panel.appendChild(el('h3','hud-card__head-label',t('commits')));
      commits.slice(0,8).forEach(c=>{
        const line=el('div','estimate-event commit-event');
        line.append(el('code','',c.hash),document.createTextNode(` ${c.subject} `),el('span','diff-add',`+${c.add}`),document.createTextNode(' '),el('span','diff-sub',`-${c.del}`));
        panel.appendChild(line);
      });
    }
    overlay.appendChild(panel);document.body.appendChild(overlay);close.focus();
  }
  function tickNow() {
    if (!liveRange) return;
    const { start, end, span, container, doc } = liveRange;
    const now = Date.now();
    if (now > end || now < start) { render(doc, container); return; }
    const line = container.querySelector('.vertical-now-line');
    if (line) line.style.left = `${(now - start) / span * 100}%`;
    const label = container.querySelector('.vertical-now-label');
    if (label) { label.style.left = `${Math.max(7,Math.min(93,(now-start)/span*100))}%`; label.textContent = `${t('nowButton')} ${clockLabel(now)}`; }
  }
  global.Timeline={render, tickNow, openTask:showDetail, windowForItem};
})(typeof window!=='undefined'?window:globalThis);
