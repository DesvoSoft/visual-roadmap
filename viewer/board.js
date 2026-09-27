/* Version overview and detailed deliverable list. */
(function (global) {
  'use strict';
  let selectedId = null, filter = 'all', query = '';
  const t = key => global.UI.t(key);
  function node(tag, cls, value) { const el=document.createElement(tag); if(cls)el.className=cls; if(value!=null)el.textContent=value; return el; }
  function statusName(status) { return t(status==='blocked'?'blockedStatus':status==='cancelled'?'cancelledStatus':status||'planned'); }
  function date(raw) { if(!raw)return '—'; const d=global.Roadmap.toDate(raw); return d ? new Intl.DateTimeFormat(global.UI.language,{day:'numeric',month:'short',year:'numeric'}).format(d)+(raw.length>10?` ${raw.slice(11)}`:'') : raw; }
  function projectEnd(release, forecast) {
    const ends=release.items.map(item=>forecast.projections.get(item.id)?.end).filter(Boolean);
    return ends.length ? Math.max(...ends) : null;
  }
  function render(doc, container) {
    container.replaceChildren();
    if(!doc?.releases?.length){container.appendChild(node('div','empty-state',t('noVersions')));return;}
    const forecast=global.Forecast.calculate(doc);
    const available=doc.releases;
    const selected=available.find(release=>release.id===selectedId) || available.find(release=>release.status==='active') || available[0];
    selectedId=selected.id;
    const header=node('div','versions-heading');
    header.append(node('div','versions-heading__eyebrow',t('versionsTitle')),node('h2','versions-heading__title',`${doc.title}${doc.version ? ' · ' + doc.version : ''}`));
    const summary=node('div','versions-overview');
    const values=[
      [t('completion'),`${doc.stats.pct}%`],
      [t('phasesDone'),`${doc.stats.phasesDone}/${doc.stats.phasesTotal}`],
      [t('activeTasks'),String(doc.stats.active)],
      [t('riskTasks'),String(doc.stats.blocked+doc.stats.atRisk)]
    ];
    values.forEach(([label,value])=>{const item=node('div','versions-overview__item');item.append(node('span','',label),node('strong','',value));summary.appendChild(item);});
    header.appendChild(summary);container.appendChild(header);
    const layout=node('div','versions-layout'), rail=node('div','versions-rail'), detail=node('div','versions-detail');
    const railHead=node('div','versions-rail__head',`${t('versions')} · ${available.length}`);rail.appendChild(railHead);
    available.forEach(release=>{
      const done=release.items.filter(item=>item.status==='done').length;
      const btn=node('button',`version-entry${selected.id===release.id?' version-entry--selected':''}`);
      btn.type='button';btn.setAttribute('aria-pressed',String(selected.id===release.id));
      const top=node('div','version-entry__top');top.append(node('span','version-entry__name',`${release.id} · ${release.name}`),node('span',`version-entry__status version-entry__status--${release.status}`,statusName(release.status)));
      btn.append(top,node('div','version-entry__meta',`${done}/${release.items.length} ${t('tasks')} · ${release.progress||0}%`));
      const track=node('div','version-entry__track'), fill=node('div','version-entry__fill');fill.style.width=`${release.progress||0}%`;track.appendChild(fill);btn.appendChild(track);
      if(release.start||release.end)btn.appendChild(node('div','version-entry__dates',`${date(release.start)} → ${date(release.end)}`));
      btn.addEventListener('click',()=>{selectedId=release.id;render(doc,container);});rail.appendChild(btn);
    });
    const title=node('div','versions-detail__header');
    title.append(node('div','versions-heading__eyebrow',t('releaseDetails')),node('h3','versions-detail__title',`${selected.id} · ${selected.name}`));
    const range=node('div','versions-detail__range');
    range.append(node('span','',`${t('releaseWindow')}: ${date(selected.start)} → ${date(selected.end)}`));
    const projected=projectEnd(selected,forecast);
    if(projected)range.append(node('strong','',`${t('calculatedDelivery')}: ${global.Forecast.dateTime(projected)}`));
    title.appendChild(range);
    const progress=node('div','versions-detail__progress'), fill=node('div','versions-detail__progress-fill');fill.style.width=`${selected.progress||0}%`;progress.appendChild(fill);title.appendChild(progress);
    const counts=node('div','versions-detail__counts');
    for(const [label,value] of [[t('done'),selected.items.filter(i=>i.status==='done').length],[t('inProgress'),selected.items.filter(i=>i.status==='active').length],[t('blocked'),selected.items.filter(i=>i.status==='blocked').length],[t('pending'),selected.items.filter(i=>i.status==='planned').length]]) counts.appendChild(node('span','',`${label} ${value}`));
    title.appendChild(counts);detail.appendChild(title);
    const tools=node('div','versions-tools');
    const search=node('input','versions-search');search.type='search';search.placeholder=t('search');search.value=query;search.setAttribute('aria-label',t('search'));
    search.addEventListener('input',()=>{query=search.value.toLowerCase().trim();drawItems();});tools.appendChild(search);
    for(const [key,label] of [['all',t('all')],['open',t('openItems')],['done',t('done')]]){
      const btn=node('button',`versions-filter${filter===key?' versions-filter--active':''}`,label);btn.type='button';
      btn.addEventListener('click',()=>{filter=key;render(doc,container);});tools.appendChild(btn);
    }
    detail.appendChild(tools);
    const content=node('div','versions-deliverables');detail.appendChild(content);
    function drawItems(){
      content.replaceChildren();
      const groups=selected.categories.length ? selected.categories : [{name:t('deliverables'),items:selected.items}];
      let visible=0;
      groups.forEach(group=>{
        const items=group.items.filter(item=>(!query||`${item.taskId||''} ${item.name} ${item.note||''}`.toLowerCase().includes(query)) && (filter==='all'||(filter==='done'?item.status==='done':item.status!=='done'&&item.status!=='cancelled')));
        if(!items.length)return;
        visible+=items.length;
        content.appendChild(node('h4','versions-category',`${group.name||t('deliverables')} · ${items.length}`));
        items.forEach(item=>{
          const row=node('button',`deliverable-row deliverable-row--${item.status}`);row.type='button';
          const heading=node('div','deliverable-row__heading');heading.append(node('span','deliverable-row__id',item.taskId||'—'),node('strong','deliverable-row__name',item.name),node('span','deliverable-row__status',statusName(item.status)));
          const info=node('div','deliverable-row__info');
          info.append(node('span','',`${t('taskProgress')} ${item.progress||0}%`));
          if(item.effortRaw)info.append(node('span','',`${t('effort')} ${item.effortRaw}`));
          if(item.end)info.append(node('span','',`${t('plannedEnd')} ${date(item.end)}`));
          if(item.depends.length)info.append(node('span','',`${t('depends')} ${item.depends.join(', ')}`));
          const track=node('div','deliverable-row__track'), bar=node('div','deliverable-row__fill');bar.style.width=`${item.progress||0}%`;track.appendChild(bar);
          row.append(heading,info,track);
          row.addEventListener('click',()=>global.Timeline.openTask(item,doc,forecast));
          content.appendChild(row);
        });
      });
      if(!visible)content.appendChild(node('div','versions-empty',t('noItems')));
    }
    drawItems();layout.append(rail,detail);container.appendChild(layout);
  }
  global.Board={render};
})(typeof window!=='undefined'?window:globalThis);
