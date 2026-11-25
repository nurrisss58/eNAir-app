/* Progressive enhancements; booking data remains owned by navigation.js. */
(() => {
  'use strict';
  const page = location.pathname.split('/').pop();
  const words = {
    en: ['Manage booking','Check in','Flight status','Search','Fare','Passengers','Seats','Payment','Review total','Show','Hide','Continue','Choose a fare'],
    ru: ['Моя бронь','Регистрация на рейс','Статус рейса','Поиск','Тариф','Пассажиры','Места','Оплата','Проверить итог','Показать','Скрыть','Продолжить','Выберите тариф'],
    kk: ['Броньды басқару','Рейске тіркелу','Рейс мәртебесі','Іздеу','Тариф','Жолаушылар','Орындар','Төлем','Қорытынды','Көрсету','Жасыру','Жалғастыру','Тарифті таңдаңыз']
  };
  function label(index){return (words[document.documentElement.lang] || words.en)[index];}
  function text(node,index){node.dataset.experienceLabel=index;node.dataset.noI18n='';node.textContent=label(index);}
  const scroll = () => document.body.classList.toggle('experience-scrolled',window.scrollY>30);
  addEventListener('scroll',scroll,{passive:true});scroll();
  const hero=document.querySelector('.hero-section-20');
  if(hero){
    const links=document.createElement('nav');links.className='experience-shortcuts';
    ['enair-manage-booking.html','enair-check-in.html','enair-flight-status.html'].forEach((url,i)=>{
      const a=document.createElement('a');a.href=url;text(a,i);links.append(a);
    });hero.append(links);
  }
  const pages=['booking-search.html','booking-select-fare.html','booking-passengers.html','booking-seats.html','booking-payment.html'];
  const step=pages.indexOf(page);
  if(step>=0){
    const old=document.querySelector('.booking-progress-18,.stepper');
    if(old){
      const nav=document.createElement('nav');nav.className='experience-progress';nav.setAttribute('aria-label','Booking progress');
      pages.forEach((url,i)=>{
        const item=document.createElement(i<step?'a':'span');
        if(i<step){item.href=url;item.classList.add('is-done');}
        if(i===step)item.setAttribute('aria-current','step');
        const number=document.createElement('span');number.className='experience-step-num';number.textContent=String(i+1);
        const caption=document.createElement('span');caption.className='experience-step-label';text(caption,i+3);
        item.setAttribute('aria-label',`${i+1}. ${label(i+3)}`);
        item.append(number,caption);nav.append(item);
        if(i<pages.length-1){const line=document.createElement('span');line.className='experience-step-line';line.setAttribute('aria-hidden','true');nav.append(line);}
      });
      old.replaceWith(nav);
    }
  }
  // A bar with the running total; it scrolls to the page's own primary action
  // instead of submitting anything, so the checkout logic stays in one place.
  const summary=document.querySelector('.order-summary-68')||document.querySelector('.seats-layout .summary')||document.querySelector('.trip-summary-39');
  const total=summary&&(summary.querySelector('.amount-83')||summary.querySelector('#total')||summary.querySelector('.price-45'));
  if(summary&&total){
    const bar=document.createElement('div');bar.className='experience-mobile-bar';bar.setAttribute('role','region');bar.setAttribute('aria-label','Order total');
    const value=document.createElement('span');value.className='experience-bar-total';
    const button=document.createElement('button');button.type='button';text(button,page==='booking-payment.html'?8:11);
    const action=page==='booking-payment.html'
      ? summary
      : document.querySelector('.enair-fare-continue')||document.querySelector('.label-105')||document.querySelector('.summary .btn-primary');
    button.onclick=()=>{
      const fallback=document.querySelector('.fare-tiers-46')||summary;
      const target=action&&!action.disabled?action:fallback;
      target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'center'});
      if(typeof target.focus==='function')target.focus({preventScroll:true});
    };
    const sync=()=>{const current=total.hidden?'':(total.textContent||'').trim();value.textContent=current||(page==='booking-select-fare.html'?label(12):'—');};
    sync();
    new MutationObserver(sync).observe(total,{subtree:true,childList:true,characterData:true});
    bar.append(value,button);document.body.append(bar);document.body.classList.add('experience-has-bar');
  }
  document.querySelectorAll('input[type=password]').forEach(input=>{
    if(input.parentElement.querySelector('button'))return;
    const wrap=document.createElement('div');wrap.className='experience-password';input.before(wrap);wrap.append(input);
    const button=document.createElement('button');button.type='button';text(button,9);button.setAttribute('aria-pressed','false');
    button.onclick=()=>{const show=input.type==='password';input.type=show?'text':'password';text(button,show?10:9);button.setAttribute('aria-pressed',String(show));};wrap.append(button);
  });
  new MutationObserver(()=>{
    document.querySelectorAll('[data-experience-label]').forEach(node=>text(node,Number(node.dataset.experienceLabel)));
  }).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
})();
