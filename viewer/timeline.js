/* Chronogram from declared dates and provisional effort projections. */
(function (global) {
  'use strict';
  const DAY = 86400000;
  const scales = { '3h': [3*3600000,30*60000], '6h': [6*3600000,3600000], '1d': [DAY,2*3600000], '3d': [3*DAY,12*3600000], '1w': [7*DAY,DAY], '1m': [30*DAY,5*DAY] };
  let zoom = '1d', offset = 0, search = '', filter = '', fitted = false, focusedWindow = null;
  let liveRange = null, lastActive = '';
  let scrollTop = 0;   /* every update rebuilds the rows: the reader keeps their place */
  const expanded = new Set();
  const collapsedGroups = new Set();
  const t = key => global.UI.t(key);
  let initialized = false;
  function el(tag, cls, label) { const n = document.createElement(tag); n.className = cls; if (label != null) n.textContent = label; return n; }
  function time(raw, end) {
    if (!raw || typeof raw !== 'string') return null;
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw + (end ? 'T23:59:59' : 'T00:00:00') : raw.replace(' ','T'));
    return isNaN(d.getTime()) ? null : d.getTime();
  }
  function windowForItem(item, prediction, now = Date.now()) {
    const declaredStart = time(item.start, false), declaredEnd = time(item.end, true);
    const coarse = /^\d{4}-\d{2}-\d{2}$/.test(item.start || '') && /^\d{4}-\d{2}-\d{2}$/.test(item.end || '');
    const shortHours = item.actual || item.effort;
    if (item.status === 'cancelled' && declaredEnd == null) return { start: null, end: null, coarse: false, estimated: false };   /* never ran to the end: nothing to draw */
    if (item.status !== 'done' && item.status !== 'cancelled' && prediction) return { start: prediction.start, end: prediction.end, coarse: false, estimated: true, slipMinutes: prediction.slipMinutes || 0 };
    if (item.status !== 'done' && item.status !== 'cancelled' && declaredStart != null && declaredStart < now) {
      const duration = declaredEnd != null && declaredEnd > declaredStart ? declaredEnd - declaredStart : Math.max(1, shortHours || 0) * 3600000;
      return { start: now, end: now + duration, coarse: false, estimated: true, slipMinutes: Math.round((now - declaredStart) / 60000) };
    }
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
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  function matchesTask(item, query) { return normalize(`${item.taskId || ''} ${item.name || ''}`).includes(normalize(query.trim())); }
  function focusRange(window, span) {
    const width = Math.max(span, window.end - window.start);
    const center = (window.start + window.end) / 2;
    return { start: center-width/2, end: center+width/2, span: width };
  }
  function fitRange(windows, now = Date.now()) {
    const valid = windows.filter(w => Number.isFinite(w.start) && Number.isFinite(w.end));
    if (!valid.length) return focusRange({ start: now, end: now }, DAY);
    const first = Math.min(...valid.map(w => w.start)), last = Math.max(...valid.map(w => w.end));
    const padding = Math.max(3600000, (last-first)*.06);
    return { start: first-padding, end: last+padding, span: last-first+padding*2 };
  }
  /* Consecutive runs of `#### Subgroup` inside a release; one unnamed group when the release has none */
  function groupItems(items) {
    const groups = [];
    for (const it of items) {
      const name = it.category || '';
      const last = groups[groups.length - 1];
      if (last && last.name === name) last.items.push(it);
      else groups.push({ name, items: [it] });
    }
    return groups;
  }
  const LABEL_KEY = 'vr.timelineLabelWidth';
  function storedLabelWidth() { try { const v = Number(localStorage.getItem(LABEL_KEY)); return v >= 200 && v <= 1200 ? v : null; } catch { return null; } }
  function saveLabelWidth(v) { try { localStorage.setItem(LABEL_KEY, String(Math.round(v))); } catch {} }
  const glyph = status => status==='done'?'■':status==='active'?'▶':status==='paused'?'Ⅱ':status==='blocked'?'⛔':status==='risk'?'⚠':status==='cancelled'?'✕':'□';
  function render(doc, container) {
    container.replaceChildren();
    document.querySelector('.shot-preview')?.remove();
    if (!doc?.releases?.length) { container.appendChild(el('div','empty-state',t('noPhases'))); return; }
    const forecast = global.Forecast.calculate(doc);
    /* Follow the agent: open the release of the active task whenever the active task changes */
    const activeRelease = doc.releases.find(r => r.items.some(it => it.status === 'active'));
    const activeKey = activeRelease ? `${activeRelease.id}::${activeRelease.items.find(it => it.status === 'active').taskId}` : '';
    if (initialized && activeRelease && activeKey !== lastActive) expanded.add(activeRelease.id);
    lastActive = activeKey;
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
    const now = Date.now();
    const windows = doc.items.map(it => windowForItem(it, forecast.projections.get(it.id), now));
    const allRange = fitRange(windows, now);
    const selectedRange = fitted ? allRange : focusedWindow || null;
    const span = selectedRange?.span || scales[zoom][0];
    const tick = fitted ? (span > 14*DAY ? 7*DAY : span > 3*DAY ? DAY : span > DAY ? 12*3600000 : span > 6*3600000 ? 3600000 : 30*60000) : scales[zoom][1];
    const start = selectedRange ? selectedRange.start + offset*span*.5 : now + offset*span*.5 - span*.3;
    const end = start+span;
    liveRange = { start, end, span, container, doc };
    const pos = ms => (ms-start)/span*100;
    const toolbar = el('div','subnav-bar'), controls = el('div','subnav-controls');
    toolbar.appendChild(el('strong','timeline-title',t('deliverables')));
    const input = el('input','search-input'); input.type='search'; input.placeholder = t('searchTask'); input.setAttribute('aria-label',t('searchTask')); input.value = search;
    const matching = doc.items.filter(it => matchesTask(it,search) && (!filter || (filter==='pending' ? it.status!=='done'&&it.status!=='cancelled' : filter==='blocked' ? it.status==='blocked' : filter==='overdue' ? it.status!=='done'&&it.status!=='cancelled'&&time(it.end,true)!=null&&time(it.end,true)<now : it.status!=='done'&&!it.start&&!it.end)));
    input.addEventListener('input', () => {
      const caret=input.selectionStart;
      search=input.value.trim(); offset=0; fitted=false; filter='';
      const hit=doc.items.find(it=>matchesTask(it,search));
      const w=search&&hit ? windowForItem(hit,forecast.projections.get(hit.id),Date.now()) : null;
      focusedWindow=w?.start!=null&&w?.end!=null ? focusRange(w,Math.max(scales[zoom][0],(w.end-w.start)*1.8)) : null;
      render(doc,container);
      const next=container.querySelector('.search-input'); next.focus(); next.setSelectionRange(caret,caret);
    });
    controls.appendChild(input);
    if(search) controls.appendChild(el('span','timeline-search-count',`${matching.length} ${matching.length===1?t('result'):t('results')}`));
    const expand=el('button','btn-icon-toggle','⊞'); expand.title=t('expand'); expand.setAttribute('aria-label',t('expand'));
    expand.addEventListener('click',()=>{doc.releases.forEach(group=>expanded.add(group.id));collapsedGroups.clear();render(doc,container);});
    const collapse=el('button','btn-icon-toggle','⊟'); collapse.title=t('collapse'); collapse.setAttribute('aria-label',t('collapse'));
    collapse.addEventListener('click',()=>{doc.releases.forEach(group=>expanded.delete(group.id));render(doc,container);});
    const late = doc.items.filter(it => it.status !== 'done' && it.status !== 'cancelled' && time(it.end,true) != null && time(it.end,true) < now).length;
    const blocked = doc.items.filter(it => it.status === 'blocked').length;
    const missingDates = doc.items.filter(it => it.status !== 'done' && !it.start && !it.end).length;
    const signals = el('div','timeline-signals');
    for (const [key,value] of [['pending',doc.stats.open],['blocked',blocked],['overdue',late],['undated',missingDates]]) {
      const signal=el('button','timeline-signal'+(filter===key?' timeline-signal--active':''),`${t(key)} ${value}`);
      signal.type='button'; signal.setAttribute('aria-pressed',String(filter===key));
      if(value && (key==='blocked'||key==='overdue')) signal.classList.add('timeline-signal--alert');
      signal.addEventListener('click',()=>{filter=filter===key?'':key;render(doc,container);});
      signals.appendChild(signal);
    }
    controls.append(signals,expand,collapse);
    for (const [key,label] of [['3h','3 H'],['6h','6 H'],['1d',global.UI.language==='es'?'1 DÍA':'1 DAY'],['3d',global.UI.language==='es'?'3 DÍAS':'3 DAYS'],['1w',global.UI.language==='es'?'1 SEMANA':'1 WEEK'],['1m',global.UI.language==='es'?'1 MES':'1 MONTH']]) {
      const b=el('button','zoom-btn'+(zoom===key?' zoom-btn--active':''),label);
      b.addEventListener('click',()=>{zoom=key;offset=0;fitted=false;focusedWindow=null;render(doc,container);}); controls.appendChild(b);
    }
    const fit=el('button','zoom-btn'+(fitted?' zoom-btn--active':''),t('fitSchedule'));
    fit.title=t('fitScheduleHint'); fit.addEventListener('click',()=>{fitted=true;focusedWindow=null;offset=0;render(doc,container);});controls.appendChild(fit);
    for (const [label,delta] of [['‹',-1],[t('nowButton'),0],['›',1]]) {
      const b=el('button','btn-nav-now',label);
      b.title=delta<0?t('earlier'):delta>0?t('later'):t('goToday');
      b.setAttribute('aria-label',b.title);
      b.addEventListener('click',()=>{if(delta){if(fitted){focusedWindow=allRange;fitted=false;}offset+=delta;}else{offset=0;fitted=false;focusedWindow=null;}render(doc,container);}); controls.appendChild(b);
    }
    toolbar.appendChild(controls); container.appendChild(toolbar);
    const guide=el('div','timeline-guide');
    guide.appendChild(el('span','timeline-guide__range',`${global.Forecast.dateTime(start)} → ${global.Forecast.dateTime(end)}`));
    for(const [cls,key] of [['now','todayLine'],['done','completedBlock'],['active','currentBlock'],['projection','projectedBlock']]){
      const item=el('span','timeline-guide__item');item.append(el('i',`timeline-guide__swatch timeline-guide__swatch--${cls}`),el('span','',t(key)));guide.appendChild(item);
    }
    container.appendChild(guide);
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
    function row(parts,bar,kind) {
      const l=el('div',kind==='phase'?'phase-head-row':kind==='group'?'group-head-row':'task-label-row');
      const r=el('div',kind==='phase'?'phase-bar-row':kind==='group'?'group-bar-row':'tracker-bar-row');
      l.append(...parts.filter(Boolean)); if(bar) r.appendChild(bar); lRows.appendChild(l);rRows.appendChild(r);return l;
    }
    function summaryBar(list, progress) {
      const ws=list.map(it=>windowForItem(it,forecast.projections.get(it.id),now)).filter(w=>w.start!=null&&w.end!=null);
      if(!ws.length)return null;
      const a=Math.min(...ws.map(w=>w.start)), b=Math.max(...ws.map(w=>w.end));
      if(b<start||a>end)return null;
      const bar=el('div','phase-summary-bar phase-summary-bar--group');
      bar.style.left=`${Math.max(0,pos(a))}%`;
      bar.style.width=`${Math.max(1.5,Math.min(100,pos(b))-Math.max(0,pos(a)))}%`;
      const fill=el('div','phase-seg-done');fill.style.width=`${progress}%`;bar.appendChild(fill);
      return bar;
    }
    const toggleRow=(l,onToggle)=>{
      l.setAttribute('role','button');l.tabIndex=0;
      l.addEventListener('click',onToggle);l.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onToggle();}});
    };
    const preview = el('div', 'shot-preview'); preview.hidden = true; document.body.appendChild(preview);
    doc.releases.forEach((rel,index)=>{
      const items=(rel.items||[]).filter(it=>(!search||matchesTask(it,search)) && (!filter || (filter==='pending' ? it.status!=='done'&&it.status!=='cancelled' : filter==='blocked' ? it.status==='blocked' : filter==='overdue' ? it.status!=='done'&&it.status!=='cancelled'&&time(it.end,true)!=null&&time(it.end,true)<now : it.status!=='done'&&!it.start&&!it.end)));
      if((search||filter)&&!items.length)return;
      const key=rel.id||String(index), done=rel.items.filter(it=>it.status==='done').length;
      let summary=null;
      const projectedWindows=rel.items.map(it=>forecast.projections.get(it.id)).filter(Boolean);
      let phaseStart=projectedWindows.length ? Math.min(...projectedWindows.map(p=>p.start)) : time(rel.start,false);
      let phaseEnd=projectedWindows.length ? Math.max(...projectedWindows.map(p=>p.end)) : time(rel.end,true);
      if(!projectedWindows.length && rel.items.some(it=>it.status!=='done'&&it.status!=='cancelled') && phaseStart!=null && phaseStart<now) {
        phaseEnd=now+Math.max(3600000,(phaseEnd||phaseStart)-phaseStart);phaseStart=now;
      }
      if(phaseStart!=null&&phaseEnd!=null&&phaseEnd>=start&&phaseStart<=end){
        summary=el('div','phase-summary-bar');
        summary.style.left=`${Math.max(0,pos(phaseStart))}%`;
        summary.style.width=`${Math.max(1.5,Math.min(100,pos(phaseEnd))-Math.max(0,pos(phaseStart)))}%`;
        summary.appendChild(el('div','phase-seg-done'));
        summary.firstChild.style.width=`${rel.progress||0}%`;
      }
      const open=expanded.has(key)||!!search||!!filter;
      const phase=row([el('span','tl-chevron',open?'⌄':'›'),el('span','tl-phase-code',rel.id),el('span','tl-name',rel.name),el('span','tl-count',`${done}/${rel.items.filter(it=>it.status!=='cancelled').length}`)],summary,'phase');
      phase.title=`${rel.id} · ${rel.name}`;
      toggleRow(phase,()=>{expanded.has(key)?expanded.delete(key):expanded.add(key);render(doc,container);});
      if(!open)return;
      const groups=groupItems(items), named=groups.some(g=>g.name);
      groups.forEach((group,gi)=>{
      const nested=named&&!!group.name;
      if(nested){
        const gkey=`${key}::${gi}::${group.name}`;
        const all=rel.items.filter(it=>(it.category||'')===group.name&&it.status!=='cancelled');
        const gDone=all.filter(it=>it.status==='done').length;
        const gOpen=!collapsedGroups.has(gkey)||!!search||!!filter;
        const progress=all.length?Math.round(all.reduce((n,it)=>n+(it.status==='done'?100:it.progress||0),0)/all.length):0;
        const gl=row([el('span','tl-chevron',gOpen?'⌄':'›'),el('span','tl-name',group.name),el('span','tl-count',`${gDone}/${all.length}`)],summaryBar(all,progress),'group');
        gl.title=group.name;
        toggleRow(gl,()=>{collapsedGroups.has(gkey)?collapsedGroups.delete(gkey):collapsedGroups.add(gkey);render(doc,container);});
        if(!gOpen)return;
      }
      group.items.forEach(it=>{
        const predicted = forecast.projections.get(it.id);
        const window = windowForItem(it,predicted,now);
        const a=window.start, b=window.end;
        const provisional = window.estimated;
        let bar=null;
        if(a!=null||b!=null){
          const from=a??b,to=b??a;
          if(to>=start&&from<=end){
            const left=Math.max(0,pos(from)), right=Math.min(100,pos(to)), width=Math.max(0,right-left);
            bar=el('div',`tracker-bar tracker-bar--${it.status==='done'?'done':it.status==='active'?'now':it.status==='paused'?'paused':it.status==='blocked'?'blocked':'planned'}${provisional?' tracker-bar--provisional':''}${width<8?' tracker-bar--compact':''}${search?' tracker-bar--found':''}`);
            bar.setAttribute('aria-label',`${it.taskId||''} ${it.name}`.trim());
            if(it.status==='active'&&it.progress>0){const fill=el('i','tracker-bar__fill');fill.style.width=`${Math.min(100,it.progress)}%`;bar.appendChild(fill);}
            bar.style.left=`${left}%`;
            bar.style.width=`${width}%`;
            bar.title=window.coarse ? `${it.name} · ${t('dayPrecision')}` : provisional ? `${it.name} · ${t('projection')} · ${global.Forecast.dateTime(from)} → ${global.Forecast.dateTime(to)}` : `${it.name} · ${it.start||'?'} → ${it.end||'?'} · ${it.status}`;
            if(window.slipMinutes > 0) { bar.classList.add('tracker-bar--slipped'); bar.title += ` · ${t('slip')} +${global.Forecast.duration(window.slipMinutes)}`; }
          }
        }
        const chips=[];
        if(it.status==='active'&&it.progress>0)chips.push(el('span','tl-chip tl-chip--progress',`${it.progress}%`));
        if(window.slipMinutes>0){const chip=el('span','tl-chip tl-chip--slip',`+${global.Forecast.duration(window.slipMinutes)}`);chip.title=t('slip');chips.push(chip);}
        const l=row([el('span',`tl-glyph tl-glyph--${it.status}`,glyph(it.status)),it.taskId?el('span','tl-code',`${it.taskId}:`):null,el('span','tl-name',it.name),...chips],bar,'task');
        if(nested)l.classList.add('task-label-row--nested');
        if(it.status==='active')l.classList.add('task-label-row--now');
        l.title=`${it.taskId?it.taskId+': ':''}${it.name}${window.slipMinutes>0?` · ${t('slip')} +${global.Forecast.duration(window.slipMinutes)}`:''}`;
        if(search)l.classList.add('task-label-row--found');
        if(!it.start&&!it.end)l.title+=` · ${provisional?t('projection'):t('undated')}`;
        l.setAttribute('role','button'); l.tabIndex=0; l.classList.add('task-label-row--interactive');
        if(it.status==='cancelled')l.classList.add('task-label-row--cancelled');
        if(it.status==='blocked')l.classList.add('task-label-row--blocked');
        if(it.status==='paused')l.classList.add('task-label-row--paused');
        const shots = global.RoadmapShots?.available ? global.RoadmapShots.forTask(it.taskId) : [];
        if (shots.length) {
          const badge = el('span', 'shot-badge', `📷 ${shots.length}`);
          badge.title = `${shots.length} ${t('shots')}`;
          l.appendChild(badge);
        }
        if (bar && shots.length && (zoom === '3h' || zoom === '6h' || zoom === '1d')) {
          shots.forEach(s => {
            const at = Date.parse(s.at);
            if (at < start || at > end) return;
            const mark = el('span', 'shot-mark');
            mark.style.left = `${pos(at)}%`;
            mark.title = `${global.Forecast.dateTime(at)} · ${s.caption || ''}`;
            mark.addEventListener('click', e => { e.stopPropagation(); showDetail(it, doc, forecast, s.id); });
            bar.parentElement.appendChild(mark);
          });
        }
        const coverShot = shots.length ? global.RoadmapShots.coverFor(it.taskId) : null;
        if (bar && coverShot) {
          bar.addEventListener('mouseenter', () => {
            preview.replaceChildren(Object.assign(document.createElement('img'), { src: global.RoadmapShots.url(coverShot), alt: coverShot.caption || it.name }));
            const r = bar.getBoundingClientRect();
            preview.style.left = `${Math.max(8, Math.min(innerWidth - 260, r.left))}px`;
            preview.style.top = `${Math.min(innerHeight - 180, r.bottom + 6)}px`;
            preview.hidden = false;
          });
          bar.addEventListener('mouseleave', () => { preview.hidden = true; });
        }
        l.addEventListener('click',()=>showDetail(it,doc,forecast));
        l.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')showDetail(it,doc,forecast);});
        if(bar){
          bar.setAttribute('role','button');bar.tabIndex=0;
          bar.addEventListener('click',()=>showDetail(it,doc,forecast));
          bar.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showDetail(it,doc,forecast);}});
        }
      });
      });
    });
    if(start<=now&&now<=end){
      const line=el('div','vertical-now-line');line.style.left=`${pos(now)}%`;rRows.appendChild(line);
      const label=el('div','vertical-now-label',`${t('nowButton')} ${clockLabel(now)}`);
      label.style.left=`${Math.max(7,Math.min(93,pos(now)))}%`;head.appendChild(label);
    }
    left.appendChild(lRows);right.appendChild(rRows);
    const width=storedLabelWidth(); if(width)table.style.setProperty('--tl-label-width',`${width}px`);
    const handle=el('div','tracker-resizer');handle.setAttribute('role','separator');handle.setAttribute('aria-orientation','vertical');handle.title=t('resizeColumn');
    handle.addEventListener('pointerdown',e=>{
      e.preventDefault();handle.setPointerCapture(e.pointerId);handle.classList.add('tracker-resizer--active');
      const x0=e.clientX,w0=left.getBoundingClientRect().width,max=table.getBoundingClientRect().width*.7;
      const move=ev=>{const w=Math.max(200,Math.min(max,w0+ev.clientX-x0));table.style.setProperty('--tl-label-width',`${w}px`);};
      const up=()=>{handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',up);handle.classList.remove('tracker-resizer--active');saveLabelWidth(left.getBoundingClientRect().width);};
      handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',up);
    });
    handle.addEventListener('dblclick',()=>{table.style.removeProperty('--tl-label-width');try{localStorage.removeItem(LABEL_KEY);}catch{}});
    table.append(left,handle,right);tracker.appendChild(table);
    if((search||filter)&&!matching.length)rRows.appendChild(el('div','timeline-empty',t('noTimelineMatches')));
    container.appendChild(tracker);
    right.addEventListener('scroll',()=>{lRows.scrollTop=scrollTop=right.scrollTop;});
    right.scrollTop=scrollTop;lRows.scrollTop=right.scrollTop;
  }
  function openLightbox(shots, index) {
    document.querySelector('.lightbox')?.remove();
    const box=el('div','lightbox');box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');
    const img=document.createElement('img'),caption=el('div','lightbox__caption');
    const show=i=>{
      index=(i+shots.length)%shots.length;
      const s=shots[index];
      img.src=global.RoadmapShots.url(s);img.alt=s.caption||'';
      caption.textContent=`${index+1}/${shots.length} · ${global.Forecast.dateTime(Date.parse(s.at))} · ${s.caption||''}`;
    };
    const close=()=>{document.removeEventListener('keydown',onKey,true);box.remove();};
    const onKey=e=>{
      if(e.key==='Escape'){e.stopPropagation();close();}
      else if(e.key==='ArrowRight')show(index+1);
      else if(e.key==='ArrowLeft')show(index-1);
    };
    box.addEventListener('click',e=>{if(e.target===box)close();});
    document.addEventListener('keydown',onKey,true);
    box.append(img,caption);document.body.appendChild(box);show(index);
  }
  function showDetail(item, doc, forecast, focusShotId) {
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
    if(prediction?.slipMinutes)fields.push([t('slip'),global.Forecast.duration(prediction.slipMinutes)]);
    fields.forEach(([label,value])=>{
      const line=el('div','task-detail-row');line.append(el('span','',label),el('strong','',value));panel.appendChild(line);
    });
    if(item.note)panel.appendChild(el('p','task-detail-note',item.note));
    const id=(item.taskId||'').toUpperCase();
    const when=v=>global.Forecast.timestamp(v);
    const events=[];
    if(item.start)events.push({at:when(item.start),icon:'▶',text:t('started')});
    (doc.estimateChanges||[]).filter(c=>c.taskId.toUpperCase()===id)
      .forEach(c=>events.push({at:when(c.at),icon:'↻',text:`ETA ${c.remaining} ${t('remaining')} · ${c.reason||t('noReason')}`}));
    (id?(global.RoadmapGit||[]).filter(c=>c.tasks.includes(id)):[])
      .forEach(c=>events.push({at:c.time,icon:'⎇',text:`${c.hash} ${c.subject}`,diff:`+${c.add} -${c.del}`}));
    const shots=global.RoadmapShots?.available?global.RoadmapShots.forTask(id):[];
    shots.forEach((s,i)=>events.push({at:Date.parse(s.at),shot:s,index:i}));
    if(item.status==='done'&&item.end)events.push({at:when(item.end),icon:'✓',text:t('done')});
    events.sort((a,b)=>(a.at||0)-(b.at||0));
    panel.appendChild(el('h3','hud-card__head-label',t('activity')));
    const logEl=el('div','task-log');
    events.forEach(ev=>{
      const row=el('div','task-log__row');
      row.appendChild(el('span','task-log__time',ev.at?global.Forecast.dateTime(ev.at):'—'));
      if(ev.shot){
        const thumb=document.createElement('img');
        Object.assign(thumb,{className:'task-log__thumb',loading:'lazy',src:global.RoadmapShots.url(ev.shot),alt:ev.shot.caption||item.name});
        thumb.addEventListener('click',()=>openLightbox(shots,ev.index));
        const body=el('div','task-log__shot');
        body.append(thumb,el('div','task-log__caption',`${ev.shot.kind==='final'?'★ ':''}${ev.shot.caption||''}`),el('div','task-log__meta',ev.shot.source));
        row.append(el('span','task-log__icon','📷'),body);
        if(ev.shot.id===focusShotId)requestAnimationFrame(()=>row.scrollIntoView({block:'center'}));
      }else{
        row.append(el('span','task-log__icon',ev.icon),el('span','task-log__text',ev.text));
        if(ev.diff)row.appendChild(el('span','task-log__diff',ev.diff));
      }
      logEl.appendChild(row);
    });
    if(!events.length)logEl.appendChild(el('div','task-log__empty',t('noActivity')));
    panel.appendChild(logEl);
    if(!global.RoadmapShots?.available)panel.appendChild(el('p','task-log__hint',t('shotsServeOnly')));
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
  global.Timeline={render, tickNow, openTask:showDetail, windowForItem, matchesTask, focusRange, fitRange, groupItems};
})(typeof window!=='undefined'?window:globalThis);
