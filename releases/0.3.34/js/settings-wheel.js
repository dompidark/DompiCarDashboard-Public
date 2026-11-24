// Native scrolling supplies touch inertia; scroll-snap supplies the resting position.
export function initializeSettingsWheel(nav, select) {
  const row = 52;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const wrapper = document.createElement('div');
  wrapper.className = 'settings-wheel';
  nav.before(wrapper); wrapper.append(nav);
  const band = document.createElement('span');
  band.className = 'wheel-band'; band.setAttribute('aria-hidden','true'); wrapper.append(band);
  nav.classList.add('wheel-picker'); nav.setAttribute('aria-orientation','vertical');
  let timer, frame = 0;
  const buttons = () => [...nav.querySelectorAll('[data-settings-page]')];
  function paint() {
    frame = 0;
    buttons().forEach((button, i) => {
      let label = button.querySelector('.wheel-label');
      if (!label) { label = document.createElement('span'); label.className='wheel-label'; label.textContent=button.textContent; button.replaceChildren(label); }
      const distance = i - nav.scrollTop / row;
      const angle = Math.max(-65,Math.min(65, distance * -32));
      label.style.transform = reduced.matches ? 'none' : `rotateX(${angle}deg) translateZ(${-Math.min(30,Math.abs(distance)*12)}px)`;
      label.style.opacity = String(Math.max(.3,1-Math.abs(distance)*.32));
    });
  }
  function schedule() { if (!frame) frame=requestAnimationFrame(paint); }
  function settle() {
    clearTimeout(timer);
    const button = buttons()[Math.max(0,Math.min(buttons().length-1,Math.round(nav.scrollTop/row)))];
    if (button && nav.getBoundingClientRect().height && button.getAttribute('aria-selected')!=='true') select(button.dataset.settingsPage);
  }
  nav.addEventListener('scroll',()=>{schedule();clearTimeout(timer);timer=setTimeout(settle,180);},{passive:true});
  nav.addEventListener('scrollend',settle);
  document.addEventListener('dompi-settings-page',event=>{
    const index=buttons().findIndex(b=>b.dataset.settingsPage===event.detail);
    if(index>=0) nav.scrollTo({top:index*row,behavior:reduced.matches?'instant':'smooth'});
    schedule();
  });
  nav.addEventListener('keydown',event=>{
    if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();
    const list=buttons(), current=Math.max(0,list.findIndex(b=>b.getAttribute('aria-selected')==='true'));
    const index=event.key==='Home'?0:event.key==='End'?list.length-1:Math.max(0,Math.min(list.length-1,current+(['ArrowUp','ArrowLeft'].includes(event.key)?-1:1)));
    select(list[index].dataset.settingsPage);list[index].focus({preventScroll:true});
  });
  new MutationObserver(schedule).observe(nav,{childList:true});
  new ResizeObserver(()=>{
    if (nav.clientHeight) {
      const index=buttons().findIndex(b=>b.getAttribute('aria-selected')==='true');
      if(index>=0)nav.scrollTo({top:index*row,behavior:'instant'});
    }
    schedule();
  }).observe(nav);
  reduced.addEventListener('change',schedule);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
  schedule();
}
