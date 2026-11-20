const discoveries = {
  worm: ['Lisan al Gaib','<circle cx="7.5" cy="12.5" r="4.5"/><path d="M5.5 8.5c7-4 13-2 15 2.5l.5 2.5-3-1c-1.5 2.5-5 3.5-8 4.5m-3-7v5m-2-2.5h4m3-5c2 1.5 3 4 2 6.5m2-7c1.5 1 2.5 3 2.5 5"/>'],
  anakin: ['I Don’t Like Sand','<path d="m11 12 7.6-8a1 1 0 0 1 1.4 1.4L12.5 14M10 11l3.5 3.5m-5.2-2.3 3.5 3.5-5.6 5.5-3.5-3.5z"/>'],
  radio: ['Sandstorm','<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M8 8V5h8v3m-3 4h5m-5 3h5m-5 2h3"/><circle cx="8" cy="14" r="2"/>'],
  sandbox: ['Sandbox Sandbox Sandbox','<path d="m3 12 4-4h10l4 4-4 5H7zM3 12v3l4 5h10l4-5v-3M7 8l2-4h10l-2 4m-7 6 4-3"/>'],
  hourglass: ['Sands of Time','<path d="M6 3h12M6 21h12M8 3v2c0 3.5 4 4.5 4 7s-4 3.5-4 7v2m8-18v2c0 3.5-4 4.5-4 7s4 3.5 4 7v2m-6-3 2-2 2 2"/>'],
  scarab: ['The Scarab','<ellipse cx="12" cy="13" rx="5" ry="7"/><path d="M12 11v9m-4.5-9h9M9 6 7 4m8 2 2-2M7 10 4 8m3 6H4m4 3-3 3m12-10 3-2m-3 6h3m-4 3 3 3"/>'],
  grass: ['Touch Grass','<path d="M3 20h18m-14 0c0-5-2-8-4-9 4 0 7 3 8 9m1 0c-1-5-2-9-5-14 4 2 6 6 7 11 1-6 4-10 7-11-2 4-4 9-4 14"/>']
};

const storageKey = 'sandbox-atlas-achievements';
const sandColors = ['#f9e0a2','#edc47e','#d8a461','#b98146','#966037'];

function burstSand(stage,origin) {
  if(!origin || origin.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const board=stage.getBoundingClientRect();
  const spot=origin.getBoundingClientRect();
  const burst=document.createElement('div');
  burst.className='sand-confetti';
  burst.setAttribute('aria-hidden','true');
  burst.style.left=spot.left-board.left+spot.width/2+'px';
  burst.style.top=spot.top-board.top+spot.height/2+'px';
  const scale=Math.min(1,board.width/430);
  for(let i=0;i<24;i++) {
    const grain=document.createElement('span');
    const angle=(i+Math.random())*Math.PI/12;
    const radius=(18+Math.random()*39)*scale;
    grain.style.setProperty('--grain-x',Math.cos(angle)*radius+'px');
    grain.style.setProperty('--grain-rise',(Math.sin(angle)*radius*.45-24*scale)+'px');
    grain.style.setProperty('--grain-fall',(14+Math.random()*27)*scale+'px');
    grain.style.setProperty('--grain-turn',(Math.random()*320-160)+'deg');
    grain.style.setProperty('--grain-size',(2.5+Math.random()*2)+'px');
    grain.style.backgroundColor=sandColors[i%sandColors.length];
    grain.style.animationDelay=(i%5)*12+'ms';
    burst.append(grain);
  }
  stage.append(burst);
  setTimeout(()=>burst.remove(),900);
}

export function mountAchievements(trigger,panel,announcer,stage) {
  const list=panel.querySelector('#achievement-list');
  const count=panel.querySelector('#achievement-count');
  const entries=Object.entries(discoveries);
  const earned=new Set();
  try {
    const saved=JSON.parse(localStorage.getItem(storageKey)||'[]');
    if(Array.isArray(saved)) for(const id of saved) if(typeof id==='string' && Object.hasOwn(discoveries,id)) earned.add(id);
  } catch {}

  function render() {
    count.textContent=`${earned.size} of ${entries.length}`;
    list.innerHTML=entries.map(([id,[title,icon]],index)=>earned.has(id) ? `
      <li class="achievement-earned" data-achievement="${id}">
        <span class="achievement-badge"><svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg></span>
        <span class="achievement-name">${title}</span>
      </li>` : `
      <li><span class="achievement-badge" aria-hidden="true">?</span><span class="sr-only">Hidden achievement ${index+1}</span></li>`
    ).join('');
  }

  function close(restoreFocus=false) {
    if(panel.hidden) return false;
    panel.hidden=true;
    trigger.setAttribute('aria-expanded','false');
    if(restoreFocus) trigger.focus({preventScroll:true});
    return true;
  }

  trigger.addEventListener('click',()=>{
    if(close()) return;
    panel.hidden=false;
    trigger.setAttribute('aria-expanded','true');
  });
  document.addEventListener('pointerdown',event=>{
    if(!panel.contains(event.target) && !trigger.contains(event.target)) close();
  });

  function unlock(id,origin) {
    if(!Object.hasOwn(discoveries,id) || earned.has(id)) return;
    earned.add(id);
    try {localStorage.setItem(storageKey,JSON.stringify([...earned]));} catch {}
    render();
    announcer.textContent=`Achievement unlocked. ${discoveries[id][0]}.`;
    burstSand(stage,origin);
  }

  render();
  return {close,unlock};
}
