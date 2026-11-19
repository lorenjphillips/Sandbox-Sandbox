const clips = {
  worm: {title:'Lisan al Gaib',source:'Dune: Part Two · Fremen council',video:'DcwUJhDJet4',start:369,end:381},
  anakin: {title:'I Don’t Like Sand',source:'Star Wars: Attack of the Clones',video:'eVLHPvEkRd4',start:23,end:37},
  radio: {title:'Sandstorm',source:'Darude · Live in Helsinki',video:'db5f-A-vSyw',start:44,end:57}
};

export function mountEasterEggPlayer(layer,panel,onOpen) {
  const title=panel.querySelector('#egg-title');
  const source=panel.querySelector('#egg-source');
  const media=panel.querySelector('#egg-media');
  const original=panel.querySelector('#egg-original');
  const dismiss=panel.querySelector('#egg-close');
  let active=null;

  function close(restoreFocus=false) {
    const previous=active;
    media.replaceChildren();
    panel.hidden=true;
    active=null;
    if(previous) {
      previous.setAttribute('aria-expanded','false');
      if(restoreFocus && !previous.hidden) previous.focus({preventScroll:true});
    }
  }

  layer.addEventListener('click',event=>{
    const trigger=event.target.closest('button[data-egg]');
    if(!trigger || !Object.hasOwn(clips,trigger.dataset.egg)) return;
    const clip=clips[trigger.dataset.egg];
    onOpen();
    close();
    active=trigger;
    active.setAttribute('aria-expanded','true');
    title.textContent=clip.title;
    source.textContent=clip.source;

    const watch=new URL('https://www.youtube.com/watch');
    watch.search=new URLSearchParams({v:clip.video,t:clip.start+'s'});
    original.href=watch.href;

    const embed=new URL('https://www.youtube-nocookie.com/embed/'+clip.video);
    embed.search=new URLSearchParams({
      autoplay:'1',start:clip.start,end:clip.end,playsinline:'1',rel:'0',origin:location.origin
    });
    const video=document.createElement('iframe');
    video.title=clip.title;
    video.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';
    video.referrerPolicy='strict-origin-when-cross-origin';
    video.src=embed.href;
    panel.hidden=false;
    media.append(video);
    if(event.detail===0) dismiss.focus({preventScroll:true});
  });

  dismiss.addEventListener('click',()=>close(true));
  return {close,isOpen:()=>!panel.hidden};
}
