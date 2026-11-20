const DAY=86_400_000;
const monthLabel=new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric',timeZone:'UTC'});
const dateLabel=new Intl.DateTimeFormat('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric',timeZone:'UTC'});
const parseDay=value=>Date.parse(value+'T00:00:00Z');
const isoDay=time=>new Date(time).toISOString().slice(0,10);

function nextMonth(time,step=0) {
  const date=new Date(time);
  return Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+step,1);
}

export function mountHistoryCalendar(trigger,panel,{min,max,onSelect}) {
  const first=parseDay(min),last=parseDay(max);
  const heading=panel.querySelector('#history-calendar-month');
  const days=panel.querySelector('[data-calendar-days]');
  const previous=panel.querySelector('[data-calendar-month="-1"]');
  const next=panel.querySelector('[data-calendar-month="1"]');
  const clear=panel.querySelector('[data-calendar-clear]');
  let selected=null;
  let month=nextMonth(last);

  function render(preferred=selected??last) {
    const end=nextMonth(month,1);
    const from=Math.max(first,month);
    const through=Math.min(last,end-DAY);
    const focusDay=Math.max(from,Math.min(through,preferred));
    const label=monthLabel.format(month);
    if(heading.textContent!==label) heading.textContent=label;
    previous.disabled=month===nextMonth(first);
    next.disabled=month===nextMonth(last);
    clear.setAttribute('aria-pressed',String(selected===null));
    const dates=Array.from({length:new Date(month).getUTCDay()},()=>'<span aria-hidden="true"></span>');
    for(let time=month;time<end;time+=DAY) {
      const enabled=time>=from&&time<=through;
      dates.push(`<button type="button" data-calendar-date="${isoDay(time)}" tabindex="${time===focusDay?0:-1}" aria-label="${dateLabel.format(time)}" aria-pressed="${time===selected}" ${enabled?'':'disabled'}>${new Date(time).getUTCDate()}</button>`);
    }
    days.innerHTML=dates.join('');
    return days.querySelector('[tabindex="0"]');
  }

  function close(restoreFocus=false) {
    if(panel.hidden) return false;
    panel.hidden=true;
    trigger.setAttribute('aria-expanded','false');
    if(restoreFocus) trigger.focus({preventScroll:true});
    return true;
  }

  function setDate(date) {
    const time=date ? parseDay(date) : NaN;
    selected=time>=first&&time<=last ? time : null;
    trigger.toggleAttribute('data-has-date',selected!==null);
    const label=selected===null ? 'Choose a start date' : 'Start date '+dateLabel.format(selected);
    trigger.setAttribute('aria-label',label);
    trigger.title=label;
    if(!panel.hidden) render();
  }

  function choose(date) {
    close(true);
    setDate(date);
    onSelect(date);
  }

  trigger.addEventListener('click',()=>{
    if(close()) return;
    month=nextMonth(selected??last);
    panel.hidden=false;
    trigger.setAttribute('aria-expanded','true');
    render().focus({preventScroll:true});
  });

  panel.addEventListener('click',event=>{
    const button=event.target.closest('button');
    if(!button||button.disabled) return;
    if(button===clear) choose(null);
    else if(button.dataset.calendarDate) choose(button.dataset.calendarDate);
    else if(button.dataset.calendarMonth) {
      month=nextMonth(month,Number(button.dataset.calendarMonth));
      const focusDay=render();
      if(button.disabled) focusDay.focus();
    }
  });

  panel.addEventListener('keydown',event=>{
    const date=event.target.dataset.calendarDate;
    if(!date) return;
    const time=parseDay(date);
    const calendarDay=new Date(time);
    const offsets={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7,Home:-calendarDay.getUTCDay(),End:6-calendarDay.getUTCDay()};
    let destination;
    if(Object.hasOwn(offsets,event.key)) destination=time+offsets[event.key]*DAY;
    else if(event.key==='PageUp'||event.key==='PageDown') {
      const targetMonth=nextMonth(time,event.key==='PageUp'?-1:1);
      destination=Math.min(targetMonth+(calendarDay.getUTCDate()-1)*DAY,nextMonth(targetMonth,1)-DAY);
    } else return;
    event.preventDefault();
    destination=Math.max(first,Math.min(last,destination));
    month=nextMonth(destination);
    render(destination).focus();
  });

  document.addEventListener('pointerdown',event=>{
    if(!panel.contains(event.target)&&!trigger.contains(event.target)) close();
  });
  trigger.parentElement.addEventListener('focusout',event=>{
    if(event.relatedTarget&&!panel.contains(event.relatedTarget)&&event.relatedTarget!==trigger) close();
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&close(true)) {
      event.preventDefault();
      event.stopPropagation();
    }
  },true);

  return {setDate,close};
}
