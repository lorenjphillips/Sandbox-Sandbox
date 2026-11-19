import { Board, TERRITORY_WEIGHT } from './map.js';
import { mountEasterEggPlayer } from './easter-eggs.js';
const $ = selector => document.querySelector(selector);
const DAY = 86_400_000;
const LOOKBACK_DAYS = 180;
const MARKER_DAYS = 14;
const HISTORY_MONTHS = 6;
const BUSY_DAY_MS = 1020;
const QUIET_DAY_MS = 145;
const dateValue = date => Date.parse(date + 'T00:00:00Z');
const isoDate = time => new Date(time).toISOString().slice(0,10);

function subtractMonths(time, months) {
  const day = new Date(time);
  const year = day.getUTCFullYear();
  const month = day.getUTCMonth() - months;
  const lastDay = new Date(Date.UTC(year,month+1,0)).getUTCDate();
  return Date.UTC(year,month,Math.min(day.getUTCDate(),lastDay));
}
const shortDate = new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'short',day:'numeric'});
const longDate = new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'short',day:'numeric',year:'numeric'});
const formatDate = (time, full=false) => (full ? longDate : shortDate).format(time);
const escaped = value => String(value ?? '').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const moneyUnknown = 'No public figure verified';
const signals = {
  launch:{label:'Product launch',points:4},
  feature:{label:'Feature release',points:2},
  funding:{label:'Funding',points:3},
  partnership:{label:'Partnership',points:3},
  adoption:{label:'Adoption',points:3},
  retirement:{label:'Retirement',points:-4}
};
const fronts = [
  ['Execution','Runtime, hardware, performance and new sandbox surfaces','#c49348'],
  ['State','Snapshots, images, persistence and checkpoints','#6aa89b'],
  ['Network','Connectivity, access controls, security and isolation','#7e9db7'],
  ['Workflow','SDKs, tooling, integrations, pricing and availability','#a0ad74'],
  ['Capital & adoption','Capital, ownership, customer usage and commercial partnerships','#a293ad']
];
const frontColors = new Map(fronts.map(([name,,color])=>[name,color]));

function findFront(event) {
  if (frontColors.has(event.front)) return event.front;
  if (['funding','adoption','retirement'].includes(event.kind) || /\b(acquires?|acquisition|joins? .* ai)\b/i.test(event.title)) return 'Capital & adoption';
  if (/\b(snapshot|snapshots|state|retention|checkpoint|checkpointing|filesystem|storage|persistent|cache|image|images|drive|drives)\b/i.test(event.title)) return 'State';
  if (/\b(network|dns|port|ports|firewall|proxy|security|credential|sso|secret|secrets|egress|isolation)\b/i.test(event.title)) return 'Network';
  if (/\b(sdk|cli|api|pricing|tier|billing|dashboard|observability|authentication|regional|byoc|template|templates|input|logs|integration)\b/i.test(event.title)) return 'Workflow';
  return event.kind==='partnership' ? 'Capital & adoption' : 'Execution';
}

const elements = {
  stage:$('#stage'),canvas:$('#board-canvas'),labels:$('#map-labels'),markers:$('#marker-layer'),eggLayer:$('#egg-layer'),
  popover:$('#map-popover'),search:$('#map-search'),searchResults:$('#search-results'),
  updates:$('#updates-feed'),historyDate:$('#history-date'),historyDays:$('#history-days'),
  historyPlay:$('#history-play'),playbackNote:$('#playback-note'),latestButton:$('#jump-latest'),
  zoomHint:$('#zoom-hint'),profile:$('#profile')
};
const eggPlayer=$('#egg-player');
const easterEggs=mountEasterEggPlayer(elements.eggLayer,eggPlayer,clearSelection);

let atlas;
try {
  const result=await fetch(new URL('../data/atlas.json',import.meta.url));
  if (!result.ok) throw new Error('Catalog could not be loaded.');
  atlas=await result.json();
} catch (error) {
  $('#announcements').textContent='The catalog could not be loaded. Reload the page to retry.';
  throw error;
}

const companies = new Map(atlas.companies.map(company=>[company.id,company]));
const latest = dateValue(atlas.asOf);
const eventFilter = $('#kind-filter');
const typeOptions = [...eventFilter.options].slice(1).map(option=>option.outerHTML).join('');
eventFilter.innerHTML = `<option value="all">All signals</option><optgroup label="Signal type">${typeOptions}</optgroup>
  <optgroup label="Expansion front">${fronts.map(([name])=>`<option value="front:${escaped(name)}">${escaped(name)}</option>`).join('')}</optgroup>`;

const events=atlas.events.map((event,index)=>({
  ...event,id:String(index+1),time:dateValue(event.date),front:findFront(event)
})).sort((a,b)=>b.time-a.time || a.title.localeCompare(b.title));
const eventsById=new Map(events.map(event=>[event.id,event]));
const oldest=subtractMonths(latest,HISTORY_MONTHS);
const archiveEvents=events.filter(event=>event.time>=oldest && event.time<=latest);
const eventsByDay=new Map();
for(const event of archiveEvents) {
  const entries=eventsByDay.get(event.time);
  if(entries) entries.push(event);
  else eventsByDay.set(event.time,[event]);
}
const historyButtons=new Map();
let historyTabStop=null;
let currentDate=latest;
let playingHistory=false;
let historyTimer=null;
let category='all';
let kind='all';
let focusedEvent=null;
let hoveredEvent=null;
let pinnedEvent=null;
let hidePopoverTimer=null;
let visibleView='atlas';
let zoomHintShown=false;
let compared=new Set();
let currentProfile=null;
let activeProfileTab='overview';
const scoreCache=new Map();
const movementCache=new Map();
const signalStyle=event=>'--signal:'+frontColors.get(event.front);
const signed = points => (points>0 ? '+' : points<0 ? '−' : '') + Math.abs(points);
const evidenceLink = (url, label) =>
  `<a class="evidence-link" href="${escaped(url)}" target="_blank" rel="noopener noreferrer">${escaped(label)}</a>`;
const socialMark = `<img src="${new URL('./twitter-x.svg',import.meta.url).href}" alt="">`;
const officialPost = event => event.tweetUrl || (/^https:\/\/(?:www\.)?(?:x|twitter)\.com\//i.test(event.url) ? event.url : '');
const eventEvidence = event => {
  const post=officialPost(event);
  const social=post ? `<a class="evidence-link social-source" href="${escaped(post)}" target="_blank" rel="noopener noreferrer">${socialMark} Original post on X</a>` : '';
  return [post!==event.url ? evidenceLink(event.url,event.source) : '',social].filter(Boolean).join(' ');
};
const eventToys={launch:'rocket',funding:'coins',partnership:'blocks',adoption:'pawns',retirement:'cone',feature:'gear'};

const board = new Board(elements,atlas.companies,{
  pick:openProfile,
  clear:clearSelection,
  playToy:playBoardToy,
  eventButton:makeEventButton,
  eventAnchor:event=>eventMovement(event).anchor,
  placed:placePopover
});

function scoreOn(date) {
  if(scoreCache.has(date)) return scoreCache.get(date);
  const score=Object.create(null);
  for(const event of events) {
    const age=(date-event.time)/DAY;
    if(age<0 || age>=LOOKBACK_DAYS || event.relatedCompany) continue;
    score[event.company]=(score[event.company]||0)+signals[event.kind].points;
  }
  scoreCache.set(date,score);
  return score;
}

function eventMovement(event) {
  const cacheId=event.company+'-'+event.date;
  if (movementCache.has(cacheId)) return movementCache.get(cacheId);
  const old=board.layout(scoreOn(event.time-DAY));
  const updated=board.layout(scoreOn(event.time));
  const gained=[];
  const lost=[];
  for (let i=0;i<old.length;i++) {
    if(old[i]===updated[i]) continue;
    if(updated[i]===event.company) gained.push(i);
    if(old[i]===event.company) lost.push(i);
  }
  const home = board.sites.get(event.company);
  const candidates = (gained.length ? gained : lost).map(index=>board.tiles[index]);
  const anchor = candidates.sort((a,b)=>Math.hypot(b.x-home.x,b.y-home.y)-Math.hypot(a.x-home.x,a.y-home.y))[0];
  const impact = {delta:gained.length-lost.length,anchor,changed:[...gained,...lost]};
  movementCache.set(cacheId,impact);
  return impact;
}

function makeEventButton(event) {
  const element=document.createElement('button');
  element.type='button';
  element.className='event-token';
  element.dataset.event=event.id;
  element.dataset.toy=eventToys[event.kind];
  element.style.setProperty('--signal',frontColors.get(event.front));
  element.style.setProperty('--flag-delay',-(Number(event.id)%17)*.39+'s');
  element.innerHTML=`<span class="event-toy" aria-hidden="true"></span>${officialPost(event) ? `<span class="event-social-mark" aria-hidden="true">${socialMark}</span>` : ''}`;
  element.setAttribute('aria-label',companies.get(event.company).name+' · '+event.title+(officialPost(event) ? ' · X post' : ''));
  element.addEventListener('animationend',e=>{
    if(e.animationName==='flag-pulse') element.classList.remove('pulse');
  });
  element.addEventListener('mouseenter',()=>showHover(event));
  element.addEventListener('mouseleave',scheduleHide);
  element.addEventListener('focus',()=>showHover(event));
  element.addEventListener('blur',scheduleHide);
  element.addEventListener('click',()=> {
    if(pinnedEvent?.id===event.id) {
      clearSelection();
    } else {
      focusEvent(event);
    }
  });
  return element;
}

function showHover(event) {
  clearTimeout(hidePopoverTimer);
  if (pinnedEvent) return;
  hoveredEvent=event;
  drawPopover();
}

function scheduleHide() {
  clearTimeout(hidePopoverTimer);
  hidePopoverTimer=setTimeout(()=>{
    if (pinnedEvent || elements.popover.matches(':hover,:focus-within')) return;
    hoveredEvent=null;
    drawPopover();
  },135);
}

function drawPopover() {
  const event=pinnedEvent||hoveredEvent;
  if(!event) {elements.popover.hidden=true;return;}
  const movement=eventMovement(event);
  const signal=signals[event.kind];
  elements.popover.style.setProperty('--signal',frontColors.get(event.front));
  elements.popover.innerHTML=`
    ${pinnedEvent ? '<button type="button" class="popover-close" data-close-popover aria-label="Close update">Close</button>' : ''}
    <h3>${escaped(event.title)}</h3>
    <p class="popover-meta">${escaped(companies.get(event.company).name)} · ${escaped(event.front)} · ${formatDate(event.time)}</p>
    <p>${escaped(event.summary)}</p>
    <div class="popover-footer">
      <span>${eventEvidence(event)}</span>
      <small class="signal-delta" title="Same-day net change in the provider's territory">
        ${event.relatedCompany ? 'Shared rollout' : signed(signal.points)+' pts'} · ${signed(movement.delta)} hex${Math.abs(movement.delta)===1?'':'es'}
      </small>
    </div>`;
  elements.popover.hidden=false;
  placePopover();
}

function placePopover() {
  const event=pinnedEvent||hoveredEvent;
  if (!event || elements.popover.hidden || elements.popover.offsetParent===null) return;
  const node=board.markerNodes.get(event.id)?.node;
  const fallback=board.sites.get(event.company);
  const viewport=board.viewport();
  const x=node&&!node.hidden ? parseFloat(node.style.left) : viewport.dx+fallback.screen.x*viewport.zoom;
  const y=node&&!node.hidden ? parseFloat(node.style.top) : viewport.dy+fallback.screen.y*viewport.zoom;
  const width=elements.popover.offsetWidth;
  const height=elements.popover.offsetHeight;
  let left=x+16;
  let top=y+15;
  if(left+width>viewport.width-9) left=x-width-16;
  if(top+height>viewport.height-9) top=y-height-16;
  elements.popover.style.left=Math.min(Math.max(9,left),viewport.width-width-9)+'px';
  elements.popover.style.top=Math.min(Math.max(8,top),viewport.height-height-9)+'px';
}

function focusEvent(event) {
  hoveredEvent=null;
  focusedEvent=event.id;
  pinnedEvent=event;
  updateBoard(new Set(eventMovement(event).changed));
  const node=board.markerNodes.get(event.id)?.node;
  node?.classList.remove('pulse');
  requestAnimationFrame(()=>node?.classList.add('pulse'));
  drawPopover();
  elements.popover.querySelector('[data-close-popover]')?.focus({preventScroll:true});
}

function clearSelection(render=true) {
  if(!focusedEvent && !hoveredEvent && !pinnedEvent) return;
  focusedEvent=null;
  hoveredEvent=null;
  pinnedEvent=null;
  drawPopover();
  if(render) updateBoard();
}

const matchesKind=event=>kind==='all' || event.kind===kind || 'front:'+event.front===kind;
const matchesCategory=event=>category==='all' || companies.get(event.company).category===category;

function updateBoard(flash=new Set(),replay=false) {
  board.selected=pinnedEvent?.company || (visibleView==='atlas' ? currentProfile?.id : null);
  board.setLayout(board.layout(scoreOn(currentDate)),'all',flash,{replay});
  const showRecent=currentDate===latest && !playingHistory;
  const filtered=showRecent ? archiveEvents.filter(event=>event.time>latest-MARKER_DAYS*DAY) : eventsByDay.get(currentDate)||[];
  const featured=showRecent
    ? Array.from(new Map(filtered.toReversed().map(event=>[event.company,event])).values())
      .sort((a,b)=>b.time-a.time || a.title.localeCompare(b.title))
    : filtered;
  let markerEvents=featured.slice(0,15);
  const firstPost=showRecent && featured.find(officialPost);
  if(firstPost && !markerEvents.includes(firstPost)) markerEvents.splice(3,0,firstPost);
  markerEvents=markerEvents.slice(0,15);
  if(focusedEvent) {
    const event=eventsById.get(focusedEvent);
    markerEvents=[event,...markerEvents.filter(item=>item.id!==focusedEvent)];
  }
  board.setEventMarkers(markerEvents,focusedEvent);
  const activityTiles=featured.slice(0,8).map(event=>eventMovement(event).anchor?.index ?? board.sites.get(event.company).index);
  board.setActivityTiles(activityTiles);
}

function renderUpdates() {
  const groups=new Map();
  for(const event of archiveEvents) {
    if(!matchesKind(event) || !matchesCategory(event)) continue;
    if(!groups.has(event.date)) groups.set(event.date,[]);
    groups.get(event.date).push(event);
  }
  if(!groups.size) {
    elements.updates.innerHTML='<p class="empty-state">No updates match these filters.</p>';
    return;
  }
  elements.updates.innerHTML=[...groups.entries()].map(([date,entries])=>`
    <section class="update-day" aria-labelledby="updates-${date}">
      <h2 id="updates-${date}"><time datetime="${date}">${formatDate(dateValue(date),true)}</time></h2>
      <div class="update-day-items">${entries.map(event=>{
        const company=companies.get(event.company);
        const logo=new URL('./logos/'+company.id+'.png',import.meta.url);
        return `<article class="update-item" style="${signalStyle(event)}">
          <div class="update-item-head">
            <img class="update-logo" src="${escaped(logo.href)}" alt="" loading="lazy">
            <div><p class="update-provider">${escaped(company.name)} · ${signals[event.kind].label}</p>
            <h3>${escaped(event.title)}</h3></div>
          </div>
          <p class="update-summary">${escaped(event.summary)}</p>
          <div class="update-links">${eventEvidence(event)}
            <button type="button" class="utility-button" data-show-event="${event.id}">Show on map</button>
          </div>
        </article>`;
      }).join('')}</div>
    </section>`).join('');
}

function buildHistory() {
  const dates=[];
  for(let time=oldest;time<=latest;time+=DAY) {
    const date=isoDate(time);
    const busy=eventsByDay.has(time);
    const monthStart=date.endsWith('-01') && time!==oldest;
    dates.push(`<button type="button" class="history-day" tabindex="-1" data-history-date="${date}" ${busy ? 'data-has-events' : ''} ${monthStart ? 'data-month-start' : ''} aria-label="${formatDate(time,true)}${busy ? ', has updates' : ''}">${formatDate(time)}</button>`);
  }
  elements.historyDate.min=isoDate(oldest);
  elements.historyDate.max=atlas.asOf;
  elements.historyDays.innerHTML=dates.join('');
  for(const button of elements.historyDays.querySelectorAll('[data-history-date]')) historyButtons.set(button.dataset.historyDate,button);
}

function setHistoryTabStop(button) {
  if(historyTabStop) historyTabStop.tabIndex=-1;
  historyTabStop=button;
  if(button) button.tabIndex=0;
}

function revealHistoryDay(button) {
  const strip=elements.historyDays.getBoundingClientRect();
  const rect=button.getBoundingClientRect();
  if(rect.left<strip.left || rect.right>strip.right) {
    elements.historyDays.scrollLeft+=rect.left-strip.left-(strip.width-rect.width)/2;
  }
}

function syncLatestButton() {
  const strip=elements.historyDays;
  const atRightEdge=strip.scrollWidth-strip.clientWidth-strip.scrollLeft<2;
  elements.latestButton.disabled=currentDate===latest && atRightEdge;
}

function showSnapshot(next, announce=false, playback=false) {
  if(!Number.isFinite(next) || next<oldest || next>latest) return;
  const flash=new Set();
  if(playback) {
    const prior=board.layout(scoreOn(currentDate));
    board.layout(scoreOn(next)).forEach((owner,index)=>{
      if(owner!==prior[index]) flash.add(index);
    });
  } else stopHistory();
  historyButtons.get(isoDate(currentDate))?.removeAttribute('aria-current');
  currentDate=next;
  const activeDate=isoDate(currentDate);
  const activeButton=historyButtons.get(activeDate);
  activeButton.setAttribute('aria-current','date');
  setHistoryTabStop(activeButton);
  elements.historyDate.value=activeDate;
  revealHistoryDay(activeButton);
  syncLatestButton();
  clearSelection(false);
  updateBoard(flash,playback);
  if(elements.profile.open && activeProfileTab==='evidence') renderProfile();
  if(announce) {
    const count=eventsByDay.get(currentDate)?.length||0;
    const activity=count ? `${count} sourced ${count===1?'update':'updates'}` : 'No sourced updates';
    $('#announcements').textContent=`${formatDate(currentDate,true)}. ${activity} for this day.`;
  }
  return flash.size;
}

function setPlaybackButton() {
  elements.historyPlay.textContent=playingHistory ? 'Pause' : 'Play';
  elements.historyPlay.setAttribute('aria-label',playingHistory ? 'Pause history' : 'Play history');
}

function stopHistory() {
  if(!playingHistory) return;
  clearTimeout(historyTimer);
  historyTimer=null;
  playingHistory=false;
  elements.playbackNote.hidden=true;
  setPlaybackButton();
}

function scheduleHistory(territoryChanged=false) {
  const entries=eventsByDay.get(currentDate)||[];
  const lead=entries.reduce((best,entry)=>!best ||
    Math.abs(signals[entry.kind].points)>Math.abs(signals[best.kind].points) ? entry : best,null);
  elements.playbackNote.hidden=!lead;
  if(lead) {
    const extra=entries.length>1 ? ` +${entries.length-1} more` : '';
    elements.playbackNote.textContent=`${companies.get(lead.company).name} · ${lead.title}${extra}`;
  }
  historyTimer=setTimeout(()=>{
    if(currentDate===latest) {
      stopHistory();
      updateBoard();
      $('#announcements').textContent=`History ended on ${formatDate(latest,true)}.`;
      return;
    }
    const changed=showSnapshot(currentDate+DAY,false,true);
    scheduleHistory(changed>0);
  },lead || territoryChanged ? BUSY_DAY_MS : QUIET_DAY_MS);
}

function toggleHistory() {
  if(playingHistory) {
    stopHistory();
    updateBoard();
    $('#announcements').textContent=`History paused on ${formatDate(currentDate,true)}.`;
    return;
  }
  if(currentDate===latest) showSnapshot(oldest);
  playingHistory=true;
  setPlaybackButton();
  scheduleHistory();
  $('#announcements').textContent=`Playing history from ${formatDate(currentDate,true)}.`;
}

function playBoardToy(id) {
  if(id==='hourglass' && currentDate>oldest) {
    showSnapshot(currentDate-DAY,true);
    return;
  }
  const notes={
    sandbox:'The lid opens to reveal a tiny sandbox and shovel.',
    hourglass:'First day in the archive',
    scarab:'The scarab scurries away and leaves tracks in the sand.',
    grass:'Touch grass ✓'
  };
  const note=notes[id];
  $('#announcements').textContent=note;
  if(id==='grass' || id==='hourglass') return note;
}

function matchingCompanies(query, categoryName='all') {
  const matches=query.trim().toLocaleLowerCase();
  return [...companies.values()].filter(company=>{
    const pool=[company.name,company.id,company.provider,...company.products].join(' ').toLocaleLowerCase();
    return (categoryName==='all' || company.category===categoryName) && matches.split(/\s+/).every(term=>pool.includes(term));
  }).sort((a,b)=>a.name.localeCompare(b.name));
}

function mapSearch(showWhenEmpty=false) {
  const query=elements.search.value;
  if (!query.trim() && !showWhenEmpty) {elements.searchResults.hidden=true;return;}
  const results=matchingCompanies(query);
  elements.searchResults.innerHTML=results.length ? results.map(company=>`
    <button type="button" data-search-id="${company.id}">${escaped(company.name)}</button>`).join('') : '<p>No matching providers.</p>';
  elements.searchResults.hidden=false;
}

function compareToggle(id) {
  if(compared.has(id)) compared.delete(id);
  else if(compared.size<3) compared.add(id);
  else {
    $('#announcements').textContent='Comparison holds up to three providers. Remove one to make room.';
    return;
  }
  try {localStorage.setItem('sandbox-atlas-compare',JSON.stringify([...compared]));} catch {}
  renderDirectory();
  if(elements.profile.open) updateCompareButton();
}

function compareSelection() {
  const urlParams=new URLSearchParams(location.hash.split('?')[1]||'');
  const urlIds=urlParams.get('providers')?.split(',').filter(id=>companies.has(id));
  if(urlIds?.length) return urlIds.slice(0,3);
  try {
    const stored=JSON.parse(localStorage.getItem('sandbox-atlas-compare')||'[]');
    return Array.isArray(stored) ? stored.filter(id=>companies.has(id)).slice(0,3) : [];
  } catch {return [];}
}

function renderDirectory() {
  const found=matchingCompanies($('#directory-search').value,$('#directory-category').value);
  $('#directory-table').innerHTML=found.length ? `
    <table><thead><tr><th scope="col">Provider</th><th scope="col">Category</th><th scope="col">Status</th><th scope="col">First pricing entry</th><th scope="col">Compare</th></tr></thead>
    <tbody>${found.map(company=>`<tr>
      <td><button type="button" class="provider-link" data-open-profile="${company.id}">${escaped(company.name)}</button></td>
      <td>${escaped(company.category)}</td>
      <td>${escaped(company.status||'Available')}</td>
      <td>${escaped(company.pricing[0]?.value||'No price verified')}</td>
      <td><button type="button" class="compare-pick" data-compare-id="${company.id}" aria-pressed="${compared.has(company.id)}" aria-label="${compared.has(company.id)?'Remove ':'Compare '}${escaped(company.name)}" ${compared.size===3&&!compared.has(company.id)?'disabled':''}>${compared.has(company.id)?'Remove':'Add'}</button></td>
    </tr>`).join('')}</tbody></table>`
    : '<p class="empty-state">No matching providers.</p>';
  const selected=[...compared].map(id=>companies.get(id)).filter(Boolean);
  const ul=entries=>entries.length ? `<ul>${entries.map(value=>`<li>${escaped(value)}</li>`).join('')}</ul>` : 'No details verified';
  const rows=[
    ['Products',c=>ul(c.products)],
    ['Advantages',c=>ul(c.strengths)],
    ['Tradeoffs',c=>ul(c.tradeoffs)],
    ['Pricing',c=>ul(c.pricing.map(p=>p.label+' · '+p.value+(p.detail?' ('+p.detail+')':'')))],
    ['Founders',c=>ul(c.founders)],
    ['Founded',c=>escaped(c.founded||'Unverified')],
    ['Funding',c=>escaped(c.funding||moneyUnknown)],
    ['Investors',c=>ul(c.investors)],
    ['Revenue',c=>escaped(c.revenue||moneyUnknown)],
    ['Valuation',c=>escaped(c.valuation||moneyUnknown)]
  ];
  $('#compare-tray').innerHTML=selected.length ? `<div class="compare-tray">
    <table aria-label="Comparison"><thead><tr><th scope="col">Measure</th>${selected.map(c=>`<th scope="col">${escaped(c.name)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(([label,getValue])=>`<tr><th scope="row">${label}</th>${selected.map(c=>`<td>${getValue(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '';
}

function openProfile(id) {
  if(!companies.has(id)) return;
  elements.searchResults.hidden=true;
  elements.search.value='';
  clearSelection(false);
  currentProfile=companies.get(id);
  activeProfileTab='overview';
  if(visibleView==='atlas') updateBoard();
  renderProfile();
  if(!elements.profile.open) elements.profile.show();
  $('#close-profile').focus({preventScroll:true});
}

function updateCompareButton() {
  const button=$('#profile-compare');
  if(!button || !currentProfile) return;
  const active=compared.has(currentProfile.id);
  button.textContent=active ? 'In comparison' : 'Add to comparison';
  button.setAttribute('aria-pressed',String(active));
  button.setAttribute('aria-label',active ? 'Remove from comparison' : 'Add to comparison');
  button.disabled=!active && compared.size>=3;
  $('#profile-comparison-link').hidden=compared.size===0;
}

function renderProfile() {
  const company=currentProfile;
  if(!company) return;
  const list=values=>values.length ? `<ul>${values.map(value=>`<li>${escaped(value)}</li>`).join('')}</ul>` : '<p>No details verified.</p>';
  const corporate=[
    ...(company.provider!==company.name ? [['Operator',company.provider]] : []),
    ...(company.status ? [['Status',company.status]] : []),
    ['Founded',company.founded],['Founders',company.founders.join(', ')],
    ['Funding',company.funding],['Revenue',company.revenue],['Valuation',company.valuation],
    ['Investors',company.investors.join(', ')]
  ];
  const tabs=[['overview','Overview'],['pricing','Products & pricing'],['evidence','Evidence']];
  const sourceList=company.sources.map(source=>`<li>${evidenceLink(source.url,source.label)}</li>`).join('');
  const cutoff=visibleView==='atlas' ? currentDate : latest;
  const matchingEvents=archiveEvents.filter(event=>event.company===company.id && event.time<=cutoff);
  const brandLogo=new URL('./logos/'+company.id+'.png',import.meta.url);
  const body={
    overview:`
      <table class="profile-facts" aria-label="Company facts"><tbody>${corporate.map(([label,value])=>`<tr><th scope="row">${label}</th><td>${value ? escaped(value) : '<span aria-label="Unverified">—</span>'}</td></tr>`).join('')}</tbody></table>
      <section class="profile-section"><p>${escaped(company.description)}</p></section>
      <section class="profile-section"><h3>Advantages</h3>${list(company.strengths)}</section>
      <section class="profile-section"><h3>Tradeoffs</h3>${list(company.tradeoffs)}</section>`,
    pricing:`
      <section class="profile-section"><h3>Products</h3>${list(company.products)}</section>
      <section class="profile-section"><h3>Public pricing</h3>
        <p>Snapshot ${formatDate(latest,true)}</p>
        ${company.pricing.length ? company.pricing.map(entry=>`<div class="pricing-item"><span>${escaped(entry.label)}</span>
          <div><strong>${escaped(entry.value)}</strong><small>${escaped(entry.detail)}</small></div></div>`).join('') : '<p>No public price verified.</p>'}
      </section>`,
    evidence:`<section class="profile-section"><h3>Public signals</h3>
      ${matchingEvents.length ? matchingEvents.map(event=>`<article class="profile-event" style="${signalStyle(event)}"><h4>${escaped(event.title)}</h4><p class="event-stamp">${formatDate(event.time,true)} · ${escaped(event.front)} · ${event.relatedCompany ? 'Shared rollout' : signed(signals[event.kind].points)+' pts'}</p><p>${escaped(event.summary)}</p>${eventEvidence(event)}</article>`).join('') : '<p>No sourced updates in this window.</p>'}
      </section><section class="profile-section"><h3>Sources for company facts</h3><ul class="profile-sources">${sourceList}</ul></section>`
  };
  elements.profile.innerHTML=`
    <header class="profile-head">
      <div class="profile-identity">
        <img class="profile-logo" src="${escaped(brandLogo.href)}" alt="">
        <h2 id="profile-title">${escaped(company.name)}</h2>
        <button type="button" id="close-profile" class="utility-button close-profile" aria-label="Close profile">Close</button>
      </div>
      <div class="profile-tabs" aria-label="Profile view" role="group">
        ${tabs.map(([id,text])=>`<button type="button" data-profile-tab="${id}" aria-pressed="${activeProfileTab===id}">${text}</button>`).join('')}
      </div>
    </header>
    <div class="profile-body">${body[activeProfileTab]}</div>
    ${activeProfileTab==='overview' ? '<footer class="profile-actions"><button type="button" id="profile-compare" class="comparison-cta" data-profile-compare></button><a href="#compare" class="utility-button" id="profile-comparison-link" hidden>View comparison</a></footer>' : ''}`;
  updateCompareButton();
}

function renderMethod() {
  $('#method-content').innerHTML=`
    <section class="method-section"><h2>Map controls</h2>
      <p>Drag with the left or right mouse button to rotate and tilt the board. Shift-drag or middle-drag to pan. Scroll to zoom around the pointer.</p>
      <p>On a touchscreen, use one finger to rotate and two to pan or pinch to zoom. Reset view returns to the starting position.</p></section>
    <section class="method-section"><h2>Territory</h2>
      <p>Each offering has a fixed home hex. Every other land hex goes to the offering with the lowest squared distance to its home, reduced by ${TERRITORY_WEIGHT} per score point. Scores use events from the preceding ${LOOKBACK_DAYS} days and are capped between −5 and +18 for the geometry.</p>
      <p>Territory size reflects catalog activity. A flag shows the event even if the boundary stays in place. The net hex change shown on a flag combines all scored events for that offering on the same day. Shared rollouts can link to a second profile and earn points once.</p></section>
    <section class="method-section"><h2>Signal weights</h2>
      <ul>${Object.values(signals).map(signal=>`<li><strong>${signed(signal.points)}</strong> ${signal.label}</li>`).join('')}</ul></section>
    <section class="method-section"><h2>Fronts</h2>
      <ul>${fronts.map(([name,meaning,color])=>`<li style="--signal:${color}"><strong>${escaped(name)}</strong><span class="muted">${escaped(meaning)}</span></li>`).join('')}</ul></section>
    <section class="method-section"><h2>Coverage</h2>
      <p>The catalog covers ${companies.size} offerings. Some share an owner. The map calendar and Updates cover six months. Play starts from the selected date, or from the beginning if Latest is selected. The current catalog and home hexes stay fixed in historical views, while territory and flags follow dated sources. Company facts and prices reflect the catalog snapshot.</p>
      <p>Figures identify their scope and source where available. Public prices use each provider’s billing units.</p>
      <p>Snapshot ${formatDate(latest,true)}. ${evidenceLink('https://battleships.dev/','Battleships pricing reference')}.</p></section>`;
}

function route() {
  const requested=location.hash.slice(1).split('?')[0];
  const nextView=['compare','method','updates'].includes(requested) ? requested : 'atlas';
  if(nextView!=='atlas') stopHistory();
  if(visibleView!==nextView && elements.profile.open) elements.profile.close();
  if(nextView!=='atlas' && easterEggs.isOpen()) easterEggs.close();
  visibleView=nextView;
  for(const view of ['atlas','updates','compare','method']) $('#'+view+'-view').hidden=view!==visibleView;
  for(const link of document.querySelectorAll('[data-view]')) {
    if(link.dataset.view===visibleView) link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  }
  if(visibleView==='atlas') requestAnimationFrame(()=>{
    updateBoard();
    revealHistoryDay(historyButtons.get(isoDate(currentDate)));
    syncLatestButton();
    if(!zoomHintShown) {
      zoomHintShown=true;
      elements.zoomHint.hidden=false;
      window.setTimeout(()=>{elements.zoomHint.hidden=true;},1350);
    }
  });
  if(visibleView==='compare') renderDirectory();
  if(visibleView==='updates') renderUpdates();
}

function changeCategory(next) {
  category=next;
  for(const btn of document.querySelectorAll('[data-category]')) {
    const active=btn.dataset.category===next;
    btn.classList.toggle('active',active);
    btn.setAttribute('aria-pressed',String(active));
  }
  renderUpdates();
}

elements.updates.addEventListener('click',click=>{
  const event=eventsById.get(click.target.closest('[data-show-event]')?.dataset.showEvent);
  if(!event) return;
  location.hash='atlas';
  route();
  window.scrollTo({top:0,behavior:'auto'});
  board.resetView();
  showSnapshot(event.time,true);
  focusEvent(event);
});
elements.popover.addEventListener('mouseenter',()=>clearTimeout(hidePopoverTimer));
elements.popover.addEventListener('mouseleave',scheduleHide);
elements.popover.addEventListener('click',event=>{
  if(event.target.closest('[data-close-popover]')) clearSelection();
});
eventFilter.addEventListener('change',event=>{
  kind=event.target.value;
  renderUpdates();
});
elements.historyDays.addEventListener('scroll',syncLatestButton,{passive:true});
elements.historyPlay.addEventListener('click',toggleHistory);
document.addEventListener('visibilitychange',()=>{
  if(document.hidden) stopHistory();
});
$('#reset-camera').addEventListener('click',()=>{
  board.resetView();
  elements.stage.focus({preventScroll:true});
});
elements.historyDays.addEventListener('click',event=>{
  const date=event.target.closest('[data-history-date]')?.dataset.historyDate;
  if(date) showSnapshot(dateValue(date),true);
});
elements.historyDays.addEventListener('keydown',event=>{
  const date=event.target.closest('[data-history-date]')?.dataset.historyDate;
  if(!date) return;
  const time=dateValue(date);
  const offsets={ArrowLeft:-DAY,ArrowRight:DAY,PageUp:-7*DAY,PageDown:7*DAY};
  const next=event.key==='Home' ? oldest : event.key==='End' ? latest : time+(offsets[event.key]||0);
  if(next===time) return;
  event.preventDefault();
  const button=historyButtons.get(isoDate(Math.max(oldest,Math.min(latest,next))));
  setHistoryTabStop(button);
  button.focus({preventScroll:true});
  revealHistoryDay(button);
});
elements.historyDate.addEventListener('input',()=>{
  const date=dateValue(elements.historyDate.value);
  if(date!==currentDate) showSnapshot(date,true);
});
elements.historyDate.addEventListener('change',()=>{
  elements.historyDate.value=isoDate(currentDate);
});
elements.latestButton.addEventListener('click',()=>{
  showSnapshot(latest,true);
  historyButtons.get(atlas.asOf).focus({preventScroll:true});
});

document.querySelector('.category-filter')?.addEventListener('click',event=>{
  const next=event.target.closest('[data-category]')?.dataset.category;
  if(next) changeCategory(next);
});
elements.search.addEventListener('input',()=>mapSearch(true));
elements.search.addEventListener('focus',()=>mapSearch(true));
elements.search.addEventListener('click',()=>mapSearch(true));
elements.search.closest('.map-search-wrap').addEventListener('focusout',event=>{
  if(event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) elements.searchResults.hidden=true;
});
elements.search.addEventListener('keydown',event=>{
  if(event.key==='Escape' && !elements.searchResults.hidden) {
    event.stopPropagation();
    elements.searchResults.hidden=true;
    return;
  }
  const first=elements.searchResults.querySelector('button');
  if(event.key==='ArrowDown' && first) {event.preventDefault();first.focus();}
  if(event.key==='Enter' && first) first.click();
});
elements.searchResults.addEventListener('keydown',event=>{
  if(event.key==='ArrowDown' || event.key==='ArrowUp') {
    const next=event.key==='ArrowDown' ? event.target.nextElementSibling : event.target.previousElementSibling;
    (next||elements.search).focus();
    event.preventDefault();
  }
  if(event.key==='Escape') {
    event.stopPropagation();
    elements.search.focus();
    elements.searchResults.hidden=true;
  }
});
elements.searchResults.addEventListener('click',event=>{
  const id=event.target.closest('[data-search-id]')?.dataset.searchId;
  if(id) openProfile(id);
});
document.addEventListener('pointerdown',event=>{
  if(!event.target.closest('.map-search-wrap')) elements.searchResults.hidden=true;
});
document.addEventListener('keydown',event=>{
  const editing=event.target.closest('input,select,textarea,[contenteditable]');
  if(event.key==='/' && !editing && !event.metaKey && !event.ctrlKey && !event.altKey) {
    event.preventDefault();
    if(visibleView==='compare') $('#directory-search').focus();
    else {
      if(visibleView!=='atlas') {location.hash='atlas';route();}
      elements.search.focus();
      mapSearch(true);
    }
  }
  if(event.key==='Escape' && elements.searchResults.hidden) {
    if(elements.profile.open && !eggPlayer.contains(event.target)) elements.profile.close();
    else if(easterEggs.isOpen()) easterEggs.close(true);
    else clearSelection();
  }
});

$('#directory-search').addEventListener('input',renderDirectory);
$('#directory-category').addEventListener('change',renderDirectory);
$('#compare-view').addEventListener('click',event=>{
  const profileId=event.target.closest('[data-open-profile]')?.dataset.openProfile;
  const compareId=event.target.closest('[data-compare-id]')?.dataset.compareId;
  if(profileId) openProfile(profileId);
  if(compareId) {
    compareToggle(compareId);
    document.querySelector('#directory-table [data-compare-id="'+compareId+'"]')?.focus({preventScroll:true});
  }
});
elements.profile.addEventListener('click',event=>{
  if(event.target.closest('#close-profile')) {
    elements.profile.close();
    return;
  }
  const tab=event.target.closest('[data-profile-tab]')?.dataset.profileTab;
  if(tab) {
    activeProfileTab=tab;
    renderProfile();
    elements.profile.querySelector('[data-profile-tab="'+tab+'"]').focus();
  }
  if(event.target.closest('[data-profile-compare]')) compareToggle(currentProfile.id);
});
elements.profile.addEventListener('close',()=>{
  if(elements.profile.open) return;
  currentProfile=null;
  if(visibleView==='atlas') updateBoard();
});
window.addEventListener('hashchange',route);
$('.wordmark').addEventListener('click',()=>{
  clearSelection();
  board.resetView();
});

compared=new Set(compareSelection());
renderMethod();
buildHistory();
showSnapshot(latest);
route();
