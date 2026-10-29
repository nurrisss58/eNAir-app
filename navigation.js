(function () {
  'use strict';

  const routes = {
    home: 'enair-homepage.html', destinations: 'enair-destinations.html', booking: 'enair-booking.html',
    search: 'booking-search.html', fare: 'booking-select-fare.html', passengers: 'booking-passengers.html',
    payment: 'booking-payment.html', fleet: 'enair-fleet-experience.html', loyalty: 'enair-loyalty.html',
    about: 'enair-about-contact.html', enrollment: 'enair-rewards-enrollment.html',
    personas: 'nair-high-user-personas.html', mobileHome: 'mobile-homepage.html',
    mobileBooking: 'mobile-booking.html', curatedIceland: 'curated-iceland.html',
    curatedAsia: 'curated-vietnam-bali.html', curatedGreece: 'curated-greece.html',
    fleetA350: 'fleet-a350.html', fleet787: 'fleet-787.html', fleetA380: 'fleet-a380.html'
  };

  const airports = [
    ['JFK', 'New York, USA'], ['LHR', 'London, UK'], ['CDG', 'Paris, France'], ['FCO', 'Rome, Italy'],
    ['NRT', 'Tokyo, Japan'], ['KIX', 'Kyoto, Japan'], ['KEF', 'Reykjavik, Iceland'], ['HAN', 'Hanoi, Vietnam'],
    ['ATH', 'Athens, Greece'], ['SIN', 'Singapore'], ['SYD', 'Sydney, Australia'],
    ['BCN', 'Barcelona, Spain'], ['RIO', 'Rio de Janeiro, Brazil'], ['AKL', 'Auckland, New Zealand'],
    ['DXB', 'Dubai, UAE'], ['DOH', 'Doha, Qatar'], ['GRU', 'Sao Paulo, Brazil'], ['DPS', 'Bali, Indonesia']
  ];
  const mapLocations = {
    'New York': {code:'JFK', name:'New York, USA', lat:40.6413, lon:-73.7781},
    London: {code:'LHR', name:'London, UK', lat:51.47, lon:-0.4543},
    Dubai: {code:'DXB', name:'Dubai, UAE', lat:25.2532, lon:55.3657},
    Tokyo: {code:'NRT', name:'Tokyo, Japan', lat:35.772, lon:140.3929},
    Sydney: {code:'SYD', name:'Sydney, Australia', lat:-33.9399, lon:151.1753},
    'Sao Paulo': {code:'GRU', name:'Sao Paulo, Brazil', lat:-23.4356, lon:-46.4731},
    Rome: {code:'FCO', name:'Rome, Italy', lat:41.8003, lon:12.2389},
    Kyoto: {code:'KIX', name:'Kyoto, Japan', lat:34.4347, lon:135.244},
    Barcelona: {code:'BCN', name:'Barcelona, Spain', lat:41.2974, lon:2.0833},
    Singapore: {code:'SIN', name:'Singapore', lat:1.3644, lon:103.9915},
    'Rio de Janeiro': {code:'GIG', name:'Rio de Janeiro, Brazil', lat:-22.9105, lon:-43.1631},
    Auckland: {code:'AKL', name:'Auckland, New Zealand', lat:-37.0082, lon:174.785},
    Reykjavik: {code:'KEF', name:'Reykjavik, Iceland', lat:63.985, lon:-22.6056},
    Hanoi: {code:'HAN', name:'Hanoi, Vietnam', lat:21.2187, lon:105.8042},
    Bali: {code:'DPS', name:'Bali, Indonesia', lat:-8.7482, lon:115.1672},
    Athens: {code:'ATH', name:'Athens, Greece', lat:37.9364, lon:23.9445}
  };
  const mapEmbedUrl = location => {
    const south = location.lat - 1.5;
    const north = location.lat + 1.5;
    const west = location.lon - 2.5;
    const east = location.lon + 2.5;
    const bounds = [west, south, east, north].map(value => value.toFixed(4)).join(',');
    return `https://www.openstreetmap.org/export/embed.html?bbox=${bounds}&layer=mapnik&marker=${location.lat},${location.lon}`;
  };
  function mapFrame(title, location = mapLocations['New York']) {
    const frame = document.createElement('iframe');
    frame.className = 'enair-map-frame';
    frame.title = title;
    frame.loading = 'lazy';
    frame.referrerPolicy = 'no-referrer-when-downgrade';
    frame.src = mapEmbedUrl(location);
    frame.setAttribute('allowfullscreen', '');
    return frame;
  }

  const flights = [
    {no:'eN-102', aircraft:'A350-H2 (Hydrogen)', from:'JFK', to:'LHR', dep:'08:15 AM', arr:'20:30 PM', duration:'7h 15m', price:244510},
    {no:'eN-108', aircraft:'A350-H2 (Hydrogen)', from:'JFK', to:'LHR', dep:'11:30 AM', arr:'23:45 PM', duration:'7h 15m', price:254800},
    {no:'eN-214', aircraft:'A350-H2 (Hydrogen)', from:'JFK', to:'LHR', dep:'15:00 PM', arr:'03:20 AM', duration:'7h 15m', price:235200}
  ];

  const page = location.pathname.split('/').pop() || 'index.html';
  const is = name => page === name;
  const clean = s => (s || '').replace(/\s+/g, ' ').trim();
  const dateValue = date => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const addDays = (date, days) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  };
  const today = new Date();
  const leafs = () => [...document.querySelectorAll('div,span,button,a')].filter(el => {
    if (!clean(el.textContent)) return false;
    return ![...el.children].some(c => /^(DIV|SPAN|BUTTON|A)$/.test(c.tagName));
  });
  const find = (text, occurrence = 0) => leafs().filter(x => clean(x.textContent).toLowerCase() === text.toLowerCase())[occurrence] || null;
  const findAll = text => leafs().filter(x => clean(x.textContent).toLowerCase() === text.toLowerCase());
  const go = url => { if (url) location.href = url; };
  const state = Object.assign({
    from:'JFK', fromName:'New York, USA', to:'LHR', toName:'London, UK', trip:'Round-trip',
    cabin:'Economy', adults:2, children:0, flight:null, fare:'Flex',
    departureDate:dateValue(addDays(today, 14)), returnDate:dateValue(addDays(today, 21))
  }, JSON.parse(localStorage.getItem('enairState') || '{}'));
  if (!state.departureDate || state.departureDate < dateValue(today)) state.departureDate = dateValue(addDays(today, 14));
  if (!state.returnDate || state.returnDate < state.departureDate) state.returnDate = dateValue(addDays(new Date(`${state.departureDate}T00:00:00`), 7));
  const save = () => localStorage.setItem('enairState', JSON.stringify(state));
  const CURRENCY_STORAGE_KEY = 'site_currency';
  const KZT_PER_USD = 490;
  const storedCurrency = localStorage.getItem(CURRENCY_STORAGE_KEY);
  let activeCurrency = storedCurrency === 'USD' ? 'USD' : 'KZT';
  function formatPriceKzt(amount) {
    const value = Number(amount);
    if (!Number.isFinite(value)) return '';
    const rounded = activeCurrency === 'USD' ? Math.round(value / KZT_PER_USD) : Math.round(value);
    return `${activeCurrency === 'USD' ? '$' : '₸'}${rounded.toLocaleString('en-US')}`;
  }
  function updateCurrencyPrices(root = document) {
    root.querySelectorAll('[data-price-kzt]').forEach(element => {
      const formatted = formatPriceKzt(element.dataset.priceKzt);
      if (!formatted) {
        console.error('Skipping a price element with invalid data-price-kzt.', element);
        return;
      }
      element.textContent = `${element.dataset.pricePrefix || ''}${formatted}${element.dataset.priceSuffix || ''}`;
    });
  }
  window.enairUpdateCurrencyPrices = updateCurrencyPrices;
  const authStorageKey = 'enairUser';
  const readAuthUser = () => {
    const saved = localStorage.getItem(authStorageKey);
    if (!saved) return null;
    try {
      const user = JSON.parse(saved);
      return user && typeof user.email === 'string' ? user : null;
    } catch (error) {
      console.error('Unable to read the saved eNAir user session.', error);
      return null;
    }
  };
  let activeUser = readAuthUser();
  let pendingAuthAction = null;

  function injectCSS() {
    if (document.getElementById('enair-enhancements')) return;
    const s = document.createElement('style'); s.id = 'enair-enhancements';
    s.textContent = `
      .enair-clickable{cursor:pointer!important;transition:filter .15s,transform .15s,box-shadow .15s}.enair-clickable:hover{filter:brightness(.97);transform:translateY(-1px)}
      .enair-clickable:focus-visible{outline:2px solid #06b6d4;outline-offset:3px}
      .enair-selected{box-shadow:0 0 0 2px #06b6d4 inset!important}
      .enair-toast{position:fixed;z-index:99999;left:50%;bottom:28px;transform:translateX(-50%);background:#0f172a;color:#fff;padding:12px 18px;border-radius:12px;font:600 14px system-ui;box-shadow:0 10px 30px rgba(15,23,42,.25)}
      .enair-modal-backdrop{position:fixed;inset:0;z-index:99990;background:rgba(15,23,42,.38);backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;padding:20px}
      .enair-modal{width:min(560px,calc(100vw - 40px));max-height:80vh;overflow:auto;background:#fff;border-radius:20px;padding:24px;box-shadow:0 24px 80px rgba(15,23,42,.28);font:14px system-ui;color:#0f172a}
      .enair-modal h3{margin:0 0 6px;font-size:22px}.enair-modal p{color:#64748b;margin:0 0 18px}.enair-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      .enair-choice{border:1px solid #e2e8f0;background:#fff;border-radius:12px;padding:12px;text-align:left;cursor:pointer}.enair-choice:hover{border-color:#06b6d4;background:#f8fafc}
      .enair-choice strong{display:block}.enair-choice span{color:#64748b;font-size:12px}.enair-modal-close{float:right;border:0;background:#f1f5f9;border-radius:50%;width:32px;height:32px;cursor:pointer;font-size:18px}
      .enair-filter-hidden{display:none!important}.enair-card-hover{transition:transform .18s,box-shadow .18s}.enair-card-hover:hover{transform:translateY(-3px);box-shadow:0 14px 35px rgba(15,23,42,.10)}
      .enair-editable{cursor:text!important}.enair-editable:focus{outline:2px solid #06b6d4;border-radius:4px}
      .enair-confirm{position:fixed;inset:0;z-index:100000;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:20px}.enair-confirm-card{background:#fff;border-radius:24px;padding:32px;max-width:480px;text-align:center;box-shadow:0 30px 100px rgba(0,0,0,.3)}
      .enair-confirm-icon{width:64px;height:64px;border-radius:50%;background:#ecfeff;color:#0891b2;display:grid;place-items:center;font-size:30px;margin:0 auto 16px}.enair-confirm-card h2{margin:0 0 8px}.enair-confirm-card p{color:#64748b;line-height:1.6}.enair-confirm-card button{border:0;background:#0f172a;color:#fff;border-radius:10px;padding:11px 18px;cursor:pointer}
      .enair-auth-actions{display:flex;align-items:center;gap:10px;flex-shrink:0;margin-left:12px;font:500 13px 'Geist',sans-serif}
      .enair-auth-email{max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#334155}
      .enair-auth-trigger,.enair-auth-logout{border:1px solid #e2e8f0;border-radius:999px;background:#fff;color:#0f172a;padding:10px 14px;font:600 13px 'Geist',sans-serif;white-space:nowrap;cursor:pointer}
      .enair-auth-trigger{background:#0f172a;color:#fff;border-color:#0f172a}
      .enair-auth-backdrop{position:fixed;inset:0;z-index:100001;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(15,23,42,.56);backdrop-filter:blur(6px)}
      .enair-auth-dialog{position:relative;width:min(420px,100%);box-sizing:border-box;border:1px solid #e2e8f0;border-radius:24px;background:#fff;padding:32px;box-shadow:0 28px 90px rgba(15,23,42,.28);font:14px 'Geist',sans-serif;color:#0f172a}
      .enair-auth-close{position:absolute;top:16px;right:16px;width:36px;height:36px;border:0;border-radius:50%;background:#f1f5f9;color:#334155;font-size:22px;cursor:pointer}
      .enair-auth-dialog h2{margin:0 40px 8px 0;font:700 26px 'Outfit',sans-serif}
      .enair-auth-description{margin:0 0 22px;color:#64748b;line-height:1.5}
      .enair-auth-tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:20px;padding:4px;border-radius:12px;background:#f1f5f9}
      .enair-auth-tab{border:0;border-radius:9px;background:transparent;padding:10px;color:#64748b;font:600 14px 'Geist',sans-serif;cursor:pointer}
      .enair-auth-tab[aria-selected="true"]{background:#fff;color:#0f172a;box-shadow:0 1px 4px rgba(15,23,42,.12)}
      .enair-auth-form{display:grid;gap:14px}
      .enair-auth-field{display:grid;gap:7px;color:#334155;font-weight:600}
      .enair-auth-field input{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:11px;padding:12px 13px;font:400 15px 'Geist',sans-serif;color:#0f172a}
      .enair-auth-field input:focus{outline:2px solid rgba(6,182,212,.3);border-color:#06b6d4}
      .enair-auth-submit{border:0;border-radius:11px;background:linear-gradient(110deg,#06b6d4,#8b5cf6);padding:13px;color:#fff;font:700 15px 'Geist',sans-serif;cursor:pointer}
      .enair-auth-submit:disabled{opacity:.65;cursor:wait}
      .enair-auth-message{min-height:20px;margin:0;color:#b91c1c;line-height:1.4}
      .enair-auth-message:empty{display:none}
      .enair-header-controls{display:flex;align-items:center;gap:8px;flex-shrink:0;margin-left:12px}
      .enair-currency-select{max-width:100%;border:1px solid #e2e8f0;border-radius:999px;background:#fff;padding:9px 10px;color:#0f172a;font:600 12px 'Geist',sans-serif;cursor:pointer}
      .menu-mobile{display:none;border:1px solid #e2e8f0;border-radius:10px;background:#fff;padding:10px 14px;color:#0f172a;font:600 14px 'Geist',sans-serif;cursor:pointer}
      @media(max-width:900px){.enair-auth-actions{margin-left:0}.enair-auth-email{max-width:120px}}
      @media(max-width:900px){.enair-header-controls{margin-left:0}.menu-mobile{display:block}.navigation-2>[class^="book-now-"]{display:none!important}}
      @media(max-width:480px){.enair-header-controls{gap:4px}.enair-auth-actions{gap:4px}.enair-auth-trigger,.enair-auth-logout{padding:8px;font-size:12px}.enair-auth-email{max-width:56px}.enair-currency-select{padding:8px 6px;font-size:11px}.enair-auth-dialog{padding:26px 20px}.menu-mobile{padding:8px 10px!important;font-size:12px!important}}
      @media(max-width:360px){.sticky-navigation-2 .logo-group-3,.navigation-2 .brand-3{width:40px!important}.sticky-navigation-2 .enair-6,.navigation-2 .wordmark-6{display:none!important}}
      @media(max-width:900px){
        body{overflow-x:clip}
        [class*="sticky-navigation-"],[class*="navigation-"]{padding-left:20px!important;padding-right:20px!important}
        [class*="nav-links-"],[class*="links-"]{display:none!important}
        [class*="footer-content-"]{display:flex!important;flex-wrap:wrap!important;gap:24px!important}
        [class*="footer-content-"]>*{flex:1 1 140px!important;min-width:0}
        [class*="footer-brand-col-"]{flex:1 1 100%!important;width:auto!important}
        [class*="footer-bottom-"]{flex-wrap:wrap!important;gap:16px!important}
        .map-section-home-89{overflow:hidden}
      }
      @media(max-width:700px){.enair-grid{grid-template-columns:1fr}}
    `; document.head.appendChild(s);
  }

  function toast(msg) { const old = document.querySelector('.enair-toast'); if(old) old.remove(); const t=document.createElement('div'); t.className='enair-toast'; t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(),2200); }
  function clickable(el, handler) {
    if(!el || el.dataset.enairBound) return; el.dataset.enairBound='1'; el.classList.add('enair-clickable');
    if (!/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) {
      el.setAttribute('tabindex','0');
      el.setAttribute('role','button');
    }
    el.addEventListener('click', e=>{e.preventDefault();handler(e)}); el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();handler(e)}});
  }
  function clickableTarget(el) {
    const parent = el && el.parentElement;
    if (!parent || parent.children.length > 4) return el;
    const className = typeof parent.className === 'string' ? parent.className : '';
    return /^frame-/i.test(className) || /(?:button|cta|book-now|search-button)/i.test(className) ? parent : el;
  }
  function bindText(text, handler, occurrence=0){
    const el=find(text,occurrence); if(!el) return;
    clickable(clickableTarget(el),handler);
  }
  function modal(title, subtitle, body) {
    const back=document.createElement('div'); back.className='enair-modal-backdrop';
    back.innerHTML=`<div class="enair-modal"><button class="enair-modal-close">×</button><h3>${title}</h3><p>${subtitle||''}</p><div class="enair-modal-body"></div></div>`;
    back.querySelector('.enair-modal-body').append(body); document.body.append(back);
    const close=()=>back.remove();     back.querySelector('.enair-modal-close').addEventListener('click',close); back.addEventListener('click',e=>{if(e.target===back)close()}); return back;
  }

  function renderAuthControl() {
    document.querySelectorAll('.enair-auth-actions').forEach(actions => actions.remove());
    document.querySelectorAll('.sticky-navigation-2,.navigation-2').forEach(navigation => {
      let controls = navigation.querySelector('.enair-header-controls');
      if (!controls) {
        controls = document.createElement('div');
        controls.className = 'enair-header-controls';
        navigation.append(controls);
      }
      const actions = document.createElement('div');
      actions.className = 'enair-auth-actions';
      if (activeUser) {
        const email = document.createElement('span');
        email.className = 'enair-auth-email';
        email.textContent = activeUser.email;
        email.title = activeUser.email;
        const logout = document.createElement('button');
        logout.type = 'button';
        logout.className = 'enair-auth-logout';
        logout.textContent = 'Выйти';
        logout.addEventListener('click', () => {
          localStorage.removeItem(authStorageKey);
          activeUser = null;
          renderAuthControl();
          toast('Вы вышли из аккаунта');
        });
        actions.append(email, logout);
      } else {
        const login = document.createElement('button');
        login.type = 'button';
        login.className = 'enair-auth-trigger';
        login.setAttribute('aria-label', 'Войти или зарегистрироваться');
        login.addEventListener('click', () => openAuthModal());
        actions.append(login);
      }
      controls.append(actions);
    });
    updateAuthButtonLabels();
  }

  function renderCurrencyControl() {
    document.querySelectorAll('.sticky-navigation-2,.navigation-2').forEach(navigation => {
      let controls = navigation.querySelector('.enair-header-controls');
      if (!controls) {
        controls = document.createElement('div');
        controls.className = 'enair-header-controls';
        navigation.append(controls);
      }
      let select = controls.querySelector('.enair-currency-select');
      if (!select) {
        select = document.createElement('select');
        select.className = 'enair-currency-select';
        select.setAttribute('aria-label', 'Display currency');
        [['KZT', '₸ KZT'], ['USD', '$ USD']].forEach(([value, label]) => {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = label;
          select.append(option);
        });
        select.addEventListener('change', () => {
          activeCurrency = select.value === 'USD' ? 'USD' : 'KZT';
          try {
            localStorage.setItem(CURRENCY_STORAGE_KEY, activeCurrency);
          } catch (error) {
            console.error('Unable to save the selected currency.', error);
            toast('Валюта изменена, но не сохранена');
          }
          document.querySelectorAll('.enair-currency-select').forEach(control => { control.value = activeCurrency; });
          updateCurrencyPrices();
          window.dispatchEvent(new CustomEvent('enair:currencychange', {detail: {currency: activeCurrency}}));
        });
        controls.prepend(select);
      }
      select.value = activeCurrency;
    });
  }

  function updateAuthButtonLabels() {
    const compact = window.matchMedia('(max-width: 1100px)').matches;
    document.querySelectorAll('.enair-auth-trigger').forEach(button => {
      button.textContent = compact ? 'Войти' : 'Войти / Регистрация';
    });
  }
  window.addEventListener('resize', updateAuthButtonLabels);

  function openAuthModal(initialMode = 'login') {
    if (document.querySelector('.enair-auth-backdrop')) return;
    let mode = initialMode;
    const backdrop = document.createElement('div');
    backdrop.className = 'enair-auth-backdrop';
    const dialog = document.createElement('section');
    dialog.className = 'enair-auth-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'enair-auth-title');
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'enair-auth-close';
    close.setAttribute('aria-label', 'Закрыть окно');
    close.textContent = '×';
    const title = document.createElement('h2');
    title.id = 'enair-auth-title';
    const description = document.createElement('p');
    description.className = 'enair-auth-description';
    const tabs = document.createElement('div');
    tabs.className = 'enair-auth-tabs';
    tabs.setAttribute('role', 'tablist');
    const loginTab = document.createElement('button');
    loginTab.type = 'button';
    loginTab.className = 'enair-auth-tab';
    loginTab.textContent = 'Войти';
    loginTab.setAttribute('role', 'tab');
    const registerTab = document.createElement('button');
    registerTab.type = 'button';
    registerTab.className = 'enair-auth-tab';
    registerTab.textContent = 'Регистрация';
    registerTab.setAttribute('role', 'tab');
    tabs.append(loginTab, registerTab);
    const form = document.createElement('form');
    form.className = 'enair-auth-form';
    const emailLabel = document.createElement('label');
    emailLabel.className = 'enair-auth-field';
    emailLabel.append(document.createTextNode('Email'));
    const emailInput = document.createElement('input');
    emailInput.type = 'email';
    emailInput.name = 'email';
    emailInput.autocomplete = 'email';
    emailInput.required = true;
    emailInput.placeholder = 'name@example.com';
    emailLabel.append(emailInput);
    const passwordLabel = document.createElement('label');
    passwordLabel.className = 'enair-auth-field';
    passwordLabel.append(document.createTextNode('Пароль'));
    const passwordInput = document.createElement('input');
    passwordInput.type = 'password';
    passwordInput.name = 'password';
    passwordInput.required = true;
    passwordLabel.append(passwordInput);
    const message = document.createElement('p');
    message.className = 'enair-auth-message';
    message.setAttribute('role', 'status');
    message.setAttribute('aria-live', 'polite');
    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'enair-auth-submit';
    form.append(emailLabel, passwordLabel, message, submit);
    dialog.append(close, title, description, tabs, form);
    backdrop.append(dialog);
    document.body.append(backdrop);

    const closeModal = (preservePendingAction = false) => {
      if (!preservePendingAction) pendingAuthAction = null;
      document.removeEventListener('keydown', handleEscape);
      backdrop.remove();
    };
    const handleEscape = event => {
      if (event.key === 'Escape') closeModal();
    };
    const setMode = nextMode => {
      mode = nextMode;
      title.textContent = mode === 'login' ? 'С возвращением' : 'Создать аккаунт';
      description.textContent = mode === 'login'
        ? 'Войдите, чтобы продолжить бронирование.'
        : 'Зарегистрируйтесь, чтобы бронировать рейсы.';
      loginTab.setAttribute('aria-selected', String(mode === 'login'));
      registerTab.setAttribute('aria-selected', String(mode === 'register'));
      passwordInput.autocomplete = mode === 'login' ? 'current-password' : 'new-password';
      submit.textContent = mode === 'login' ? 'Войти' : 'Создать аккаунт';
      message.textContent = '';
    };
    close.addEventListener('click', closeModal);
    backdrop.addEventListener('click', event => {
      if (event.target === backdrop) closeModal();
    });
    loginTab.addEventListener('click', () => setMode('login'));
    registerTab.addEventListener('click', () => setMode('register'));
    document.addEventListener('keydown', handleEscape);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      submit.disabled = true;
      loginTab.disabled = true;
      registerTab.disabled = true;
      message.textContent = '';
      const requestMode = mode;
      try {
        const response = await fetch(`http://127.0.0.1:5000/api/${requestMode}`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({email: emailInput.value.trim(), password: passwordInput.value})
        });
        let result;
        try {
          result = await response.json();
        } catch (error) {
          console.error('The eNAir authentication endpoint returned invalid JSON.', error);
          message.textContent = 'Сервер вернул некорректный ответ. Попробуйте позже.';
          return;
        }
        if (!response.ok) {
          if (response.status >= 500) {
            console.error('eNAir authentication request failed.', result && result.error ? result.error : response.status);
            message.textContent = 'Сервис авторизации временно недоступен. Попробуйте позже.';
          } else {
            message.textContent = result && result.error ? result.error : `Не удалось выполнить запрос (${response.status}).`;
          }
          return;
        }
        if (!result || !result.user || typeof result.user.email !== 'string') {
          message.textContent = 'Сервер не вернул данные пользователя. Попробуйте позже.';
          return;
        }
        activeUser = {id: result.user.id, email: result.user.email};
        try {
          localStorage.setItem(authStorageKey, JSON.stringify(activeUser));
        } catch (error) {
          console.error('Unable to persist the eNAir user session.', error);
          toast('Вход выполнен, но сохранить сессию не удалось');
        }
        closeModal(true);
        renderAuthControl();
        toast(requestMode === 'login' ? 'Вход выполнен' : 'Регистрация завершена');
        const action = pendingAuthAction;
        pendingAuthAction = null;
        if (action) action();
      } catch (error) {
        console.error('Could not reach the eNAir authentication API.', error);
        message.textContent = 'Не удалось подключиться к серверу. Проверьте, что Flask запущен.';
      } finally {
        submit.disabled = false;
        loginTab.disabled = false;
        registerTab.disabled = false;
      }
    });
    setMode(mode);
    emailInput.focus();
  }

  function requireAuthentication(action) {
    if (activeUser) {
      action();
      return;
    }
    pendingAuthAction = action;
    openAuthModal('login');
  }

  function normalizeDatabaseFlight(flight) {
    const formatTime = value => {
      const match = String(value || '').match(/(?:T|\s)(\d{2}):(\d{2})/);
      if (!match) return String(value || 'Time unavailable');
      const hour = Number(match[1]);
      return `${String(hour % 12 || 12).padStart(2, '0')}:${match[2]} ${hour >= 12 ? 'PM' : 'AM'}`;
    };
    const dateTime = value => {
      const match = String(value || '').match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})$/);
      return match ? new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]), Number(match[4]), Number(match[5])) : null;
    };
    const departure = dateTime(flight.departure_time);
    const arrival = dateTime(flight.arrival_time);
    let duration = 'Duration unavailable';
    if (departure && arrival && arrival >= departure) {
      const minutes = Math.round((arrival - departure) / 60000);
      duration = `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
    }
    return {
      id: flight.id,
      no: String(flight.flight_number || `Flight ${flight.id}`),
      aircraft: String(flight.aircraft || 'Scheduled flight'),
      from: String(flight.departure_city || 'Origin'),
      to: String(flight.arrival_city || 'Destination'),
      dep: formatTime(flight.departure_time),
      arr: formatTime(flight.arrival_time),
      duration,
      price: Number(flight.price)
    };
  }

  window.enairSelectDatabaseFlight = flight => {
    const price = flight && Number(flight.price);
    if (!flight || flight.price == null || flight.price === '' || !Number.isFinite(price)) {
      toast('Информация о рейсе некорректна');
      return;
    }
    requireAuthentication(() => {
      state.flight = normalizeDatabaseFlight(flight);
      save();
      go(routes.fare);
    });
  };
  function textButton(text, handler, occurrence=0){bindText(text,handler,occurrence)}

  function globalNav(){
    const map={Destinations:routes.destinations,'Book Flights':routes.booking,'Our Fleet':routes.fleet,Loyalty:routes.loyalty,'About eNAir':routes.about,'Book Now':routes.booking};
    Object.entries(map).forEach(([t,u])=>findAll(t).slice(0,3).forEach(el=>clickable(clickableTarget(el),()=>go(u))));
    document.querySelectorAll('.brand-3,.logo-group-3,.logo-group-4,.logo-group,.brand').forEach(el=>clickable(el,()=>go(routes.home)));
    const footer={ 'About Us':routes.about,'Fleet Details':routes.fleet,Destinations:routes.destinations,'Loyalty Programs':routes.loyalty,'Contact Support':routes.about };
    Object.entries(footer).forEach(([t,u])=>findAll(t).forEach(el=>clickable(clickableTarget(el),()=>go(u))));
    renderAuthControl();
    renderCurrencyControl();
    updateCurrencyPrices();
  }

  function airportPicker(target){
    const wrap=document.createElement('div'); const grid=document.createElement('div'); grid.className='enair-grid';
    airports.forEach(([code,name])=>{const b=document.createElement('button');b.className='enair-choice';b.innerHTML=`<strong>${code}</strong><span>${name}</span>`;b.onclick=()=>{state[target]=code;state[target+'Name']=name;save();close();updateDisplayedRoute();toast(`${target==='from'?'From':'To'}: ${code}`)};grid.append(b)});
    const back=modal(target==='from'?'Choose departure airport':'Choose destination airport','Select an airport for your search',grid); const close=()=>back.remove();
    back.querySelector('.enair-modal-close').onclick=close; return back;
  }
  function datePicker(kind){
    const body=document.createElement('div');
    const current=(kind==='departure'?state.departureDate:state.returnDate);
    body.innerHTML=`<label style="display:block;margin-bottom:14px">${kind==='departure'?'Departure':'Return'} date<br><input id="edate" type="date" value="${current}" min="${dateValue(today)}" style="margin-top:8px;width:100%;box-sizing:border-box;padding:12px;border:1px solid #e2e8f0;border-radius:10px"></label><button id="savedate" style="border:0;background:#0f172a;color:#fff;border-radius:10px;padding:12px 18px">Apply date</button>`;
    const back=modal(`${kind==='departure'?'Departure':'Return'} date`,'Choose a date for your trip',body);
    body.querySelector('#savedate').onclick=()=>{const value=body.querySelector('#edate').value;if(!value){toast('Choose a valid date first');return}if(kind==='departure'){state.departureDate=value;if(state.returnDate<value)state.returnDate=dateValue(addDays(new Date(`${value}T00:00:00`),7))}else{if(value<state.departureDate){toast('Return date must follow departure');return}state.returnDate=value}save();updateDisplayedDates();back.remove();toast('Date updated')};
  }
  function passengerPicker(){
    const body=document.createElement('div'); body.innerHTML=`<div style="display:grid;gap:12px"><label>Adults <input id="ea" type="number" min="1" max="9" value="${state.adults}" style="float:right;width:80px"></label><label>Children <input id="ec" type="number" min="0" max="9" value="${state.children}" style="float:right;width:80px"></label><label>Cabin <select id="eac" style="float:right"><option>Economy</option><option>Premium</option><option>Business</option><option>First</option></select></label><button id="savep" style="margin-top:8px;border:0;background:#0f172a;color:#fff;border-radius:10px;padding:12px">Apply</button></div>`;
    body.querySelector('#eac').value=state.cabin; const back=modal('Passengers & cabin','Choose who is travelling and your cabin',body);
    body.querySelector('#savep').onclick=()=>{state.adults=+body.querySelector('#ea').value||1;state.children=+body.querySelector('#ec').value||0;state.cabin=body.querySelector('#eac').value;save();back.remove();updateDisplayedRoute();toast('Passenger settings updated')};
  }
  function updateDisplayedRoute(){
    const fromText=`${state.from} · ${state.fromName}`, toText=`${state.to} · ${state.toName}`;
    ['new-york-jfk-32','jfk-new-york-96'].forEach(()=>{});
    leafs().forEach(el=>{
      const t=clean(el.textContent);
      if(/^(?:JFK · New York, USA|JFK · New York)$/.test(t))el.textContent=fromText;
      if(/^(?:LHR · London, UK|LHR · London)$/.test(t))el.textContent=toText;
      if(/^\d+ (?:Adults?|Passengers?)(?:\s*[·,].*)?$/i.test(t)){
        const total=state.adults+state.children;
        el.textContent=`${total} ${total===1?'Passenger':'Passengers'} · ${state.cabin}`;
      }
    });
  }
  function updateDisplayedDates(){
    const displayed=leafs().filter(el=>/^(?:[A-Za-z]{3},\s*)?\d{1,2}\s+[A-Za-z]{3},?\s+\d{4}$/.test(clean(el.textContent)));
    [state.departureDate,state.returnDate].forEach((value,index)=>{
      const el=displayed[index];if(!el||!value)return;
      const original=clean(el.textContent);
      const date=new Date(`${value}T00:00:00`);
      const day=date.getDate();
      const month=new Intl.DateTimeFormat('en',{month:'short'}).format(date);
      const weekday=new Intl.DateTimeFormat('en',{weekday:'short'}).format(date);
      const withWeekday=/^[A-Za-z]{3},/.test(original);
      const commaAfterMonth=/^[A-Za-z]{3},/.test(original) ? false : /[A-Za-z]{3},\s+\d{4}$/.test(original);
      el.textContent=`${withWeekday?`${weekday}, `:''}${day} ${month}${commaAfterMonth?',':''} ${date.getFullYear()}`;
    });
  }
  function bindDateFields(){
    leafs().filter(el=>/^(?:[A-Za-z]{3},\s*)?\d{1,2}\s+[A-Za-z]{3},?\s+\d{4}$/.test(clean(el.textContent)))
      .forEach((el,index)=>clickable(el,()=>datePicker(index===0?'departure':'return')));
  }

  function setDestination(name){
    const destination=mapLocations[name];
    if(!destination)return;
    state.to=destination.code;
    state.toName=destination.name;
    save();
    updateDisplayedRoute();
  }
  function homeMap(){
    const map=document.querySelector('.map-illustration-95');
    if(!map)return;
    const instruction=find('Click any destination on the map to explore custom routes');
    if(instruction)instruction.textContent='Choose a hub to view its real location. Pan and zoom the map to explore.';
    const picker=document.createElement('div');picker.className='enair-map-picker';picker.setAttribute('aria-label','Choose an eNAir network hub');
    const frame=mapFrame('Interactive OpenStreetMap showing the eNAir global network');
    map.replaceChildren(frame,picker);
    Object.keys(mapLocations).slice(0,6).forEach((name,index)=>{
      const button=document.createElement('button');button.type='button';button.className='enair-map-city';button.textContent=name;
      button.setAttribute('aria-pressed',String(index===0));
      button.addEventListener('click',()=>{
        frame.src=mapEmbedUrl(mapLocations[name]);
        picker.querySelectorAll('button').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
        frame.title=`Interactive OpenStreetMap centered on ${name}`;
      });
      picker.append(button);
    });
  }
  function addPopularDestinationCards(){
    const track=document.querySelector('.frame-129');
    if(!track||track.querySelector('.home-destination-card'))return;
    const destinations=[
      {city:'Rome',country:'Italy',fare:'$420',image:'images/9134a0cea18f0b0e423a89ff57c3ce28b6d7f591.jpg'},
      {city:'Kyoto',country:'Japan',fare:'$650',image:'images/a22cfbb76932af50c4f91e0b1590bbed057d9cf0.jpg'},
      {city:'Singapore',country:'Singapore',fare:'$710',image:'images/43fef7c1149e5fbd383aefd82f9967f3f38b1495.jpg'},
      {city:'Barcelona',country:'Spain',fare:'$440',image:'images/8e5213b1360978f7e11e35e857922cdc1d5ee45c.jpg'}
    ];
    destinations.forEach(destination=>{
      const card=document.createElement('article');card.className='home-destination-card enair-card-hover';
      const image=document.createElement('div');image.className='home-destination-image';image.style.backgroundImage=`url("${destination.image}")`;
      const details=document.createElement('div');details.className='home-destination-details';
      const title=document.createElement('div');title.className='home-destination-city';title.textContent=destination.city;
      const country=document.createElement('div');country.className='home-destination-country';country.textContent=destination.country;
      const heading=document.createElement('div');heading.append(title,country);
      const footer=document.createElement('div');footer.className='home-destination-bottom';
      const fare=document.createElement('div');fare.className='home-destination-fare';fare.textContent=destination.fare;
      const explore=document.createElement('button');explore.type='button';explore.className='home-destination-explore';explore.textContent='Explore';
      footer.append(fare,explore);details.append(heading,footer);card.append(image,details);track.append(card);
    });
  }
  function bindPopularDestinationCarousel(){
    const track=document.querySelector('.frame-129');
    const previous=document.querySelector('.frame-123');
    const next=document.querySelector('.frame-126');
    if(!track||!previous||!next)return;
    const update=()=>{
      const max=track.scrollWidth-track.clientWidth;
      previous.classList.toggle('enair-carousel-disabled',track.scrollLeft<=2);
      next.classList.toggle('enair-carousel-disabled',track.scrollLeft>=max-2);
      previous.setAttribute('aria-disabled',String(track.scrollLeft<=2));
      next.setAttribute('aria-disabled',String(track.scrollLeft>=max-2));
    };
    const move=direction=>{
      track.scrollBy({left:direction*Math.max(240,track.clientWidth*.85),behavior:'smooth'});
      window.setTimeout(update,350);
    };
    previous.setAttribute('aria-label','Previous destinations');next.setAttribute('aria-label','More destinations');
    previous.classList.add('enair-carousel-arrow');next.classList.add('enair-carousel-arrow');
    clickable(previous,()=>move(-1));clickable(next,()=>move(1));
    track.addEventListener('scroll',update,{passive:true});window.addEventListener('resize',update);update();
    track.querySelectorAll('.explore-141,.explore-155,.explore-169,.explore-183,.home-destination-explore').forEach(button=>{
      clickable(clickableTarget(button),()=>{
        const card=button.closest('.frame-130,.frame-144,.frame-158,.frame-172,.home-destination-card');
        const title=card?.querySelector('.home-destination-city,.paris-134,.bali-148,.reykjavik-162,.cape-town-176')?.textContent.trim();
        if(title)setDestination(title);
        go(routes.search);
      });
    });
  }

  function homePage(){
    addPopularDestinationCards();
    homeMap();
    bindPopularDestinationCarousel();
    const from=find('New York (JFK)'); const to=find('London (LHR)');
    const pax=find('2 Adults, Economy')||find('2 Adults · Economy')||find('2 Adults · Economy Flex')||find('2 Adults');
    clickable(from,()=>airportPicker('from')); clickable(to,()=>airportPicker('to')); clickable(pax,passengerPicker);
    updateDisplayedDates(); bindDateFields();
    bindText('Search',()=>{save();go(routes.search)});
    bindText('Join eNAir Rewards',()=>go(routes.loyalty));
    document.querySelectorAll('.frame-129 .explore-141,.frame-129 .explore-155,.frame-129 .explore-169,.frame-129 .explore-183,.home-destination-explore').forEach((el,i)=>{
      if(el.dataset.enairBound)return;
      const card=el.closest('.frame-130,.frame-144,.frame-158,.frame-172,.home-destination-card');
      const city=card?.querySelector('.home-destination-city,.paris-134,.bali-148,.reykjavik-162,.cape-town-176')?.textContent.trim();
      clickable(clickableTarget(el),()=>{if(city)setDestination(city);go(routes.search)});
    });
    updateDisplayedRoute();
  }

  function bookingPage(){
    const searchButton=document.querySelector('.search-flights-30');
    if(searchButton)clickable(searchButton,()=>go(routes.search));
    const from=find('JFK · New York, USA')||find('JFK · New York'); const to=find('LHR · London, UK')||find('LHR · London'); const pax=find('2 Adults · Economy')||find('2 Adults · Economy Flex')||find('2 Adults');
    clickable(from,()=>airportPicker('from')); clickable(to,()=>airportPicker('to')); clickable(pax,passengerPicker);
    document.querySelectorAll('[class*="arrow-left-right"],[class*="arrow-up-down"]').forEach(el=>clickable(el,()=>{[state.from,state.to]=[state.to,state.from];[state.fromName,state.toName]=[state.toName,state.fromName];save();updateDisplayedRoute();toast('Departure and destination swapped')}));
    updateDisplayedDates(); bindDateFields();
    const tripOptions=[['Round-trip','.frame-52'],['One-way','.frame-54']];
    const cabinOptions=[['Economy','.frame-57'],['Premium','.frame-59'],['Business','.frame-61'],['First','.frame-63']];
    const updateBookingOptions=()=>{
      tripOptions.forEach(([name,selector])=>{
        const option=document.querySelector(selector);
        if(option){const active=state.trip===name;option.classList.toggle('enair-option-selected',active);option.setAttribute('aria-pressed',String(active));}
      });
      cabinOptions.forEach(([name,selector])=>{
        const option=document.querySelector(selector);
        if(option){const active=state.cabin===name;option.classList.toggle('enair-option-selected',active);option.setAttribute('aria-pressed',String(active));}
      });
      const returnDate=document.querySelector('.frame-78');
      if(returnDate)returnDate.hidden=state.trip==='One-way';
    };
    tripOptions.forEach(([name,selector])=>{
      const option=document.querySelector(selector);
      if(option)clickable(option,()=>{state.trip=name;save();updateBookingOptions();toast(`${name} selected`);});
    });
    cabinOptions.forEach(([name,selector])=>{
      const option=document.querySelector(selector);
      if(option)clickable(option,()=>{state.cabin=name;save();updateBookingOptions();toast(`${name} selected`);});
    });
    updateBookingOptions();
    const flightButtons=['.frame-114','.frame-145','.frame-176'];
    flightButtons.forEach((selector,index)=>{
      const button=document.querySelector(selector);
      if(!button)return;
      button.setAttribute('aria-pressed','false');
      clickable(button,()=>{
        requireAuthentication(()=>{
          flightButtons.forEach(other=>{
            const item=document.querySelector(other);
            if(item){item.classList.remove('enair-flight-selected');item.setAttribute('aria-pressed','false');}
          });
          button.classList.add('enair-flight-selected');
          button.setAttribute('aria-pressed','true');
          state.flight=flights[index];
          save();
          go(routes.fare);
        });
      });
    });
    const fareCards=[
      ['Lite','.frame-214','.frame-236 .select-lite-237'],
      ['Flex','.frame-238','.frame-260 .select-flex-261'],
      ['Business','.frame-262','.frame-284 .select-business-285']
    ];
    let selectedFare=state.fareChosen?state.fare:'';
    const continueButton=document.createElement('button');
    continueButton.type='button';
    continueButton.className='enair-fare-continue';
    continueButton.textContent='Choose a fare to continue';
    continueButton.disabled=true;
    continueButton.addEventListener('click',()=>{
      if(!selectedFare)return;
      save();
      go(routes.passengers);
    });
    document.querySelector('.frame-213')?.after(continueButton);
    const updateFareSelection=()=>{
      fareCards.forEach(([fare,selector,buttonSelector])=>{
        const card=document.querySelector(selector);
        if(!card)return;
        const active=selectedFare===fare;
        card.classList.toggle('enair-fare-selected',active);
        card.setAttribute('aria-pressed',String(active));
        const action=card.querySelector(buttonSelector);
        if(action)action.textContent=active?'Selected':'Select';
      });
      continueButton.disabled=!selectedFare;
      continueButton.textContent=selectedFare?`Continue with ${selectedFare} fare`:'Choose a fare to continue';
    };
    fareCards.forEach(([fare,selector])=>{
      const card=document.querySelector(selector);
      if(card)clickable(card,()=>{
        selectedFare=fare;
        state.fare=fare;
        state.fareChosen=true;
        save();
        updateFareSelection();
      });
    });
    updateFareSelection();
    const configure=document.querySelector('.configure-flight-288');
    if(configure)clickable(configure,()=>{
      document.querySelector('.airplane-cross-section-290')?.scrollIntoView({behavior:'auto',block:'center'});
      toast(state.selectedSeat?`Seat ${state.selectedSeat} is selected`:'Choose an available seat to configure this flight');
    });
    const seatMap=document.querySelector('.frame-304');
    if(seatMap){
      seatMap.querySelectorAll('[class^="rectangle-"]').forEach((seat,index)=>{
        const originalColor=getComputedStyle(seat).backgroundColor;
        const unavailable=originalColor==='rgb(226, 232, 240)';
        const rowLabel=seat.parentElement.querySelector('[class^="row-"]');
        const rowNumber=rowLabel?.textContent.match(/\d+/)?.[0]||'1';
        const seatIndex=[...seat.parentElement.querySelectorAll('[class^="rectangle-"]')].indexOf(seat);
        const seatId=`${rowNumber}${String.fromCharCode(65+seatIndex)}`;
        seat.setAttribute('role','button');
        seat.setAttribute('aria-label',unavailable?`Seat ${seatId}, occupied`:`Seat ${seatId}, available`);
        seat.setAttribute('aria-pressed','false');
        if(unavailable){
          seat.setAttribute('aria-disabled','true');
          if(state.selectedSeat===seatId){state.selectedSeat='';save();}
          return;
        }
        if(originalColor==='rgb(6, 182, 212)')seat.style.backgroundColor='#cbd5e1';
        if(state.selectedSeat===seatId){
          seat.classList.add('enair-seat-selected');
          seat.setAttribute('aria-pressed','true');
          seat.setAttribute('aria-label',`Seat ${seatId}, selected`);
        }
        clickable(seat,()=>{
          seatMap.querySelectorAll('[aria-pressed="true"]').forEach(selected=>{
            selected.classList.remove('enair-seat-selected');
            selected.setAttribute('aria-pressed','false');
            selected.setAttribute('aria-label',`Seat ${selected.dataset.seatId}, available`);
          });
          if(state.selectedSeat===seatId){
            state.selectedSeat='';
            seat.setAttribute('aria-label',`Seat ${seatId}, available`);
            toast('Seat selection cleared');
          }else{
            state.selectedSeat=seatId;
            seat.dataset.seatId=seatId;
            seat.classList.add('enair-seat-selected');
            seat.setAttribute('aria-pressed','true');
            seat.setAttribute('aria-label',`Seat ${seatId}, selected`);
            toast(`Seat ${seatId} selected`);
          }
          save();
        });
        seat.dataset.seatId=seatId;
      });
    }
    updateDisplayedRoute();
  }

  function destinationCard(el){
    let n=el; for(let i=0;i<8&&n;i++,n=n.parentElement){ if(n.querySelector && n.querySelector('[class^="rectangle-"]')) return n; } return null;
  }
  function destinationsPage(){
    const imageMap={
      'Rome':'images/9134a0cea18f0b0e423a89ff57c3ce28b6d7f591.jpg','Kyoto':'images/a22cfbb76932af50c4f91e0b1590bbed057d9cf0.jpg','New York':'images/61cb408922fc1a437c78374d6412f9ba8ec7b287.jpg','Sydney':'images/79af2a35c0154e8b361f34a4475f13194c5270c9.jpg','Barcelona':'images/8e5213b1360978f7e11e35e857922cdc1d5ee45c.jpg','Singapore':'images/43fef7c1149e5fbd383aefd82f9967f3f38b1495.jpg','Rio de Janeiro':'images/f4771602086106f3a210ef7b4894d6c7d181e915.jpg','Auckland':'images/622f3a0f01074858135b882a69a8aaa73aa57aec.jpg'
    };
    const meta={Rome:'Cultural',Kyoto:'Cultural','New York':'City',Singapore:'City',Sydney:'Beach','Rio de Janeiro':'Beach',Auckland:'Adventure',Barcelona:'Cultural'};
    const region={Rome:'Europe',Kyoto:'Asia','New York':'Americas',Singapore:'Asia',Sydney:'Oceania','Rio de Janeiro':'Americas',Auckland:'Oceania',Barcelona:'Europe'};
    const cards=[];
    Object.entries(imageMap).forEach(([city,img])=>{
      const label=find(city); if(!label)return; const card=destinationCard(label); if(!card)return;
      const rect=card.querySelector('[class^="rectangle-"]'); if(rect){rect.style.backgroundImage=`url("${img}")`;rect.style.backgroundSize='cover';rect.style.backgroundPosition='center';}
      card.classList.add('enair-card-hover'); cards.push({el:card,city,type:meta[city],region:region[city],image:img,location:mapLocations[city]});
    });
    let activeType='All';let activeRegion='All Regions';
    const categoryButtons=[
      ['All','.frame-33'],['Beach','.frame-35'],['City','.frame-37'],['Adventure','.frame-39'],['Cultural','.frame-41']
    ].map(([type,selector])=>({type,el:document.querySelector(selector)})).filter(button=>button.el);
    const updateFilterState=()=>{
      categoryButtons.forEach(({type,el})=>el.setAttribute('aria-pressed',String(type===activeType)));
      const regionButton=document.querySelector('.frame-26');
      if(regionButton){regionButton.setAttribute('aria-haspopup','dialog');regionButton.setAttribute('aria-expanded','false');}
      const label=document.querySelector('.all-regions-29');
      if(label)label.textContent=activeRegion;
    };
    updateFilterState();
    const applyFilter=(type=activeType,reg=activeRegion)=>{
      activeType=type;activeRegion=reg;
      cards.forEach(x=>x.el.classList.toggle('enair-filter-hidden',(type!=='All'&&x.type!==type)||(reg!=='All Regions'&&x.region!==reg)));
      updateFilterState();
      toast((type==='All'&&reg==='All Regions')?'Showing all destinations':`${type==='All'?'All':type} · ${reg}`);
    };
    categoryButtons.forEach(({type,el})=>clickable(el,()=>applyFilter(type,activeRegion)));
    const regionEl=document.querySelector('.frame-26');
    if(regionEl) clickable(regionEl,()=>{
      const body=document.createElement('div');body.className='enair-grid';
      ['All Regions','Europe','Asia','Americas','Oceania'].forEach(reg=>{
        const button=document.createElement('button');button.type='button';button.className='enair-choice';
        const count=reg==='All Regions'?cards.length:cards.filter(card=>card.region===reg).length;
        const strong=document.createElement('strong');strong.textContent=reg;
        const caption=document.createElement('span');caption.textContent=`${count} ${count===1?'destination':'destinations'}`;
        button.append(strong,caption);
        button.addEventListener('click',()=>{
          applyFilter(activeType,reg);
          regionEl.setAttribute('aria-expanded','false');
          back.remove();
        });
        body.append(button);
      });
      const back=modal('Choose a region','Filter the global hubs by region',body);
      regionEl.setAttribute('aria-expanded','true');
    });
    const mapContainer=document.querySelector('.interactive-visual-map-44');
    const mapLayer=document.querySelector('.frame-45');
    const mapCard=document.querySelector('.hover-tooltip-card-47');
    const mapHeading=document.querySelector('.tokyo-japan-51');
    const mapCaption=document.querySelector('.direct-route-via-hydrogen-fl-52');
    const mapImage=document.querySelector('.rectangle-48');
    const mapFrameElement=mapFrame('Interactive OpenStreetMap centered on Tokyo, Japan',mapLocations.Tokyo);
    mapFrameElement.classList.add('detailed-high-tech-map-46');
    if(mapLayer)mapLayer.replaceChildren(mapFrameElement);
    const mapPicker=document.createElement('div');mapPicker.className='enair-destination-map-picker';mapPicker.setAttribute('aria-label','Choose a destination to locate on the map');
    if(mapContainer)mapContainer.append(mapPicker);
    const selectMapCity=city=>{
      const card=cards.find(item=>item.city===city);
      if(!card?.location)return;
      mapFrameElement.src=mapEmbedUrl(card.location);
      mapFrameElement.title=`Interactive OpenStreetMap centered on ${card.location.name}`;
      if(mapHeading)mapHeading.textContent=card.location.name;
      if(mapCaption)mapCaption.textContent=`${card.location.code} airport · Pan and zoom to explore`;
      if(mapImage)mapImage.style.backgroundImage=`url("${card.image}")`;
      if(mapCard)mapCard.setAttribute('aria-label',`Map selection: ${card.location.name}`);
      mapPicker.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.city===city)));
      cards.forEach(item=>item.el.classList.toggle('enair-map-active-card',item.city===city));
    };
    cards.forEach(({city,location})=>{
      if(!location)return;
      const button=document.createElement('button');button.type='button';button.className='enair-destination-map-city';button.textContent=city;button.dataset.city=city;button.setAttribute('aria-pressed','false');
      button.addEventListener('click',()=>selectMapCity(city));mapPicker.append(button);
      const label=cards.find(item=>item.city===city)?.el.querySelector('[class^="rome-"],[class^="kyoto-"],[class^="new-york-"],[class^="sydney-"],[class^="barcelona-"],[class^="singapore-"],[class^="rio-de-janeiro-"],[class^="auckland-"]');
      if(label){label.title=`Show ${location.name} on the map`;clickable(label,()=>selectMapCity(city));}
    });
    selectMapCity('Kyoto');
    findAll('View Flights').forEach(el=>clickable(clickableTarget(el),()=>{
      const card=destinationCard(el);const city=cards.find(item=>item.el===card)?.city;
      if(city)setDestination(city);
      go(routes.search);
    }));
    findAll('Explore Curated Plan').forEach(el=>clickable(clickableTarget(el),()=>{
      const card=el.closest('.frame-169,.frame-177,.frame-185');
      const text=clean(card?.textContent||'');
      const route=text.includes('Iceland')?routes.curatedIceland:text.includes('Vietnam')?routes.curatedAsia:routes.curatedGreece;
      go(route);
    }));
    const hub=find('Explore Global Hubs');if(hub)clickable(hub,()=>document.querySelector('.destination-grid-section-57')?.scrollIntoView({behavior:'smooth'}));
    const mapBook=document.querySelector('.frame-55');
    if(mapBook)clickable(mapBook,()=>{setDestination('Kyoto');go(routes.search)});
    bindText('Book Now',()=>go(routes.booking));
  }

  function searchPage(){
    // Turn the exported fields into controls.
    findAll('Round-trip').forEach(el=>clickable(el,()=>{state.trip='Round-trip';save();toast('Round-trip selected')}));
    findAll('One-way').forEach(el=>clickable(el,()=>{state.trip='One-way';save();toast('One-way selected')}));
    const fields=[['JFK · New York, USA','from'],['LHR · London, UK','to']]; fields.forEach(([t,k])=>{const el=find(t);clickable(el,()=>airportPicker(k))});
    const cabin=find('Economy  ·  Premium  ·  Business  ·  First'); if(cabin)clickable(cabin,passengerPicker);
    updateDisplayedDates(); bindDateFields();
    // Make every flight row selectable, not only its text button.
    document.querySelectorAll('[class^="flight-option-"]').forEach((row,i)=>{row.classList.add('enair-card-hover');clickable(row,()=>requireAuthentication(()=>{state.flight=flights[i%flights.length];save();go(routes.fare)}));});
    updateDisplayedRoute();
  }

  function farePage(){
    const flight=state.flight||flights[0];
    const route=document.querySelector('.flight-41');
    const details=document.querySelector('.details-42');
    const fareSummary=document.querySelector('.tier-44');
    const priceSummary=document.querySelector('.price-45');
    if(route)route.textContent=`${flight.from} ${flight.dep.replace(/ (AM|PM)$/, '')} → ${flight.to} ${flight.arr.replace(/ (AM|PM)$/, '')}`;
    if(details)details.textContent=`${flight.no} · ${flight.aircraft} · ${flight.duration} · Non-stop`;
    if(fareSummary)fareSummary.textContent=`${state.cabin} ${state.fare} · ${state.adults} adult${state.adults===1?'':'s'}`;
    if(priceSummary)priceSummary.dataset.priceKzt=String(currentTotal());
    updateCurrencyPrices();
    ['Select Lite','Select Flex','Select Business'].forEach(t=>bindText(t,()=>{state.fare=t.replace('Select ','');save();go(routes.passengers)}));
    findAll('Choose fare').forEach(el=>clickable(el,()=>go(routes.passengers)));
    // Make the entire fare card selectable.
    document.querySelectorAll('[class^="card-"]').forEach(card=>{const txt=clean(card.textContent);const tier=['Lite','Flex','Business'].find(x=>txt.includes(x));if(tier){card.classList.add('enair-card-hover');clickable(card,()=>{state.fare=tier;save();go(routes.passengers)})}});
  }

  function makeEditableValues(){
    document.querySelectorAll('[class^="value-"]').forEach(el=>{if(clean(el.textContent) && !el.querySelector('svg') && !el.dataset.enairEditable){el.dataset.enairEditable='1';el.classList.add('enair-editable');el.title='Click to edit';el.addEventListener('click',()=>{el.contentEditable='true';el.focus()});el.addEventListener('blur',()=>{el.contentEditable='false';});}});
  }
  function currentPriceBreakdown(){
    const storedPrice=Number(state.flight&&state.flight.price);
    const base=Number.isFinite(storedPrice)&&storedPrice>0?storedPrice:244510;
    const passengers=Math.max(1,Number(state.adults)||1);
    const fareSurchargeUsd={Lite:0,Flex:70,Business:260,First:520}[state.fare] ?? 70;
    const flights=Math.round(base*passengers);
    const fare=Math.round(fareSurchargeUsd*KZT_PER_USD*passengers);
    const taxes=96*KZT_PER_USD;
    return {flights,fare,taxes,total:flights+fare+taxes};
  }
  function currentTotal(){
    return currentPriceBreakdown().total;
  }
  function refreshTotal(){
    const breakdown=currentPriceBreakdown();
    const summaryPrice=document.querySelector('.price-45');
    const flightPrice=document.querySelector('.amount-73');
    const fareLabel=document.querySelector('.label-75');
    const farePrice=document.querySelector('.amount-76');
    const taxesPrice=document.querySelector('.amount-79');
    const totalPrice=document.querySelector('.amount-83');
    const payButton=document.querySelector('.label-85');
    if(summaryPrice)summaryPrice.dataset.priceKzt=String(breakdown.total);
    if(flightPrice)flightPrice.dataset.priceKzt=String(breakdown.flights);
    if(fareLabel)fareLabel.textContent=state.fare==='Lite'?`${state.cabin} Lite fare`:`${state.cabin} ${state.fare} upgrade`;
    if(farePrice)farePrice.dataset.priceKzt=String(breakdown.fare);
    if(taxesPrice)taxesPrice.dataset.priceKzt=String(breakdown.taxes);
    [totalPrice,payButton].forEach(element=>{if(element)element.dataset.priceKzt=String(breakdown.total)});
    updateCurrencyPrices();
  }
  function passengersPage(){
    makeEditableValues();
    const priceSummary=document.querySelector('.price-45');
    if(priceSummary)priceSummary.dataset.priceKzt=String(currentTotal());
    updateCurrencyPrices();
    bindText('Continue to payment',()=>{save();go(routes.payment)});
  }

  function paymentPage(){
    makeEditableValues();
    refreshTotal();
    const payButton=document.querySelector('.button-84');
    if(payButton)clickable(payButton,completeBooking);
    findAll('Pay by card').forEach(el=>clickable(el,()=>toast('Card payment mode selected')));
  }
  function completeBooking(){
    const code='EN'+Math.floor(100000+Math.random()*899999); state.confirmation=code; save();
    const wrap=document.createElement('div');wrap.className='enair-confirm';wrap.innerHTML=`<div class="enair-confirm-card"><div class="enair-confirm-icon">✓</div><h2>Booking confirmed</h2><p>This is a prototype checkout. No real payment was processed.<br><strong>Confirmation: ${code}</strong></p><button>Back to eNAir home</button></div>`;document.body.append(wrap);wrap.querySelector('button').onclick=()=>go(routes.home);
  }

  function fleetPage(){
    const aircraftLinks=[
      ['.frame-39 .explore-47',routes.fleetA350],
      ['.frame-63 .explore-64',routes.fleet787],
      ['.frame-80 .explore-81',routes.fleetA380]
    ];
    aircraftLinks.forEach(([selector,url])=>{
      const link=document.querySelector(selector);
      if(link)clickable(clickableTarget(link),()=>go(url));
    });
    bindText('Book Now',()=>go(routes.booking));
  }
  function loyaltyPage(){
    bindText('Join eNAir Rewards',()=>go(routes.enrollment));
    // Tier cards show a useful detail panel when clicked.
    ['Silver','Gold','Platinum'].forEach(t=>findAll(t).forEach(el=>clickable(el,()=>toast(`${t} tier selected`))));
    const controls=[
      ['.new-york-jfk-154','airport','JFK','Departure airport'],
      ['.london-lhr-158','airport','LHR','Destination airport'],
      ['.business-sanctuary-163','cabin','Business','Fare class'],
      ['.gold-member-167','tier','Gold','Membership tier']
    ];
    const airportsByCode={
      JFK:{label:'New York (JFK)',lat:40.6413,lon:-73.7781},
      LHR:{label:'London (LHR)',lat:51.47,lon:-0.4543},
      CDG:{label:'Paris (CDG)',lat:49.0097,lon:2.5479},
      FCO:{label:'Rome (FCO)',lat:41.8003,lon:12.2389},
      NRT:{label:'Tokyo (NRT)',lat:35.772,lon:140.3929},
      KIX:{label:'Kyoto (KIX)',lat:34.4347,lon:135.244},
      KEF:{label:'Reykjavik (KEF)',lat:63.985,lon:-22.6056},
      HAN:{label:'Hanoi (HAN)',lat:21.2187,lon:105.8042},
      ATH:{label:'Athens (ATH)',lat:37.9364,lon:23.9445},
      SIN:{label:'Singapore (SIN)',lat:1.3644,lon:103.9915},
      SYD:{label:'Sydney (SYD)',lat:-33.9399,lon:151.1753},
      BCN:{label:'Barcelona (BCN)',lat:41.2974,lon:2.0833},
      GIG:{label:'Rio de Janeiro (GIG)',lat:-22.9105,lon:-43.1631},
      AKL:{label:'Auckland (AKL)',lat:-37.0082,lon:174.785},
      DXB:{label:'Dubai (DXB)',lat:25.2532,lon:55.3657},
      DOH:{label:'Doha (DOH)',lat:25.2731,lon:51.6081},
      GRU:{label:'Sao Paulo (GRU)',lat:-23.4356,lon:-46.4731},
      DPS:{label:'Bali (DPS)',lat:-8.7482,lon:115.1672}
    };
    const options={
      airport:Object.entries(airportsByCode).map(([code,airport])=>[code,airport.label]),
      cabin:[['Economy','Economy'],['Premium','Premium'],['Business','Business Sanctuary'],['First','First']],
      tier:[['Silver','Silver Member'],['Gold','Gold Member'],['Platinum','Platinum Member'],['Diamond','Diamond Member']]
    };
    const fields={};
    controls.forEach(([selector,type,initial,label])=>{
      const current=document.querySelector(selector);
      if(!current)return;
      const select=document.createElement('select');
      select.className=`enair-miles-select${type==='airport'?' enair-miles-airport-select':''}`;
      select.setAttribute('aria-label',label);
      options[type].forEach(([value,text])=>{
        const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);
      });
      select.value=initial;
      current.replaceWith(select);
      fields[type+(type==='airport'?(selector.includes('new-york')?'From':'To'):'')]=select;
    });
    const calculator=document.querySelector('.frame-168');
    const recalculate=()=>{
      const origin=airportsByCode[fields.airportFrom.value];
      const destination=airportsByCode[fields.airportTo.value];
      const radians=value=>value*Math.PI/180;
      const dLat=radians(destination.lat-origin.lat);
      const dLon=radians(destination.lon-origin.lon);
      const distance=2*3958.8*Math.asin(Math.sqrt(Math.sin(dLat/2)**2+Math.cos(radians(origin.lat))*Math.cos(radians(destination.lat))*Math.sin(dLon/2)**2));
      const baseMiles=origin===airportsByCode.JFK&&destination===airportsByCode.LHR?3440:Math.round(distance/10)*10;
      const tierBonus={Silver:.10,Gold:.25,Platinum:.50,Diamond:.75}[fields.tier.value];
      const cabinBonus={Economy:0,Premium:.10,Business:.325,First:.50}[fields.cabin.value];
      const tierMiles=Math.round(baseMiles*tierBonus);
      const cabinMiles=Math.round(baseMiles*cabinBonus/10)*10;
      const total=baseMiles+tierMiles+cabinMiles;
      const totalValue=document.querySelector('[class~="5-420-173"]');
      if(totalValue)totalValue.textContent=total.toLocaleString('en-US');
      const breakdown=[
        [document.querySelector('.base-flight-miles-3-440-177'),`• Base Flight Miles: ${baseMiles.toLocaleString('en-US')}`],
        [document.querySelector('[class~="25-gold-multiplier-boost-860-178"]'),`• ${fields.tier.options[fields.tier.selectedIndex].textContent} bonus: +${tierMiles.toLocaleString('en-US')}`],
        [document.querySelector('.business-class-bonus-1-120-179'),`• ${fields.cabin.options[fields.cabin.selectedIndex].textContent} bonus: +${cabinMiles.toLocaleString('en-US')}`]
      ];
      breakdown.forEach(([element,text])=>{if(element)element.textContent=text;});
    };
    Object.values(fields).forEach(select=>select.addEventListener('change',recalculate));
    if(calculator)clickable(calculator,()=>{recalculate();toast('Your eNMiles estimate has been updated')});
    recalculate();
  }
  function aircraftPage(){
    const pageRoot=document.querySelector('[data-aircraft]');
    if(!pageRoot)return;
    const model=pageRoot.dataset.aircraft;
    const aircraftCodes={a350:'A350-H2',787:'787-E',a380:'A380-X'};
    document.title=`${aircraftCodes[model]||'eNAir aircraft'} | eNAir Fleet`;
    const booking=document.querySelector('.aircraft-book');
    if(booking)clickable(booking,()=>go(routes.booking));
    const back=document.querySelector('.aircraft-back');
    if(back)back.href=routes.fleet;
  }
  function aboutPage(){
    bindText('Get in Touch',()=>document.querySelector('.contact-section-86')?.scrollIntoView({behavior:'smooth'})||toast('Contact section'));
    bindText('Our Aerospace HQ',()=>toast('eNAir Aerospace HQ · Singapore')); 
    const form=document.querySelector('.contact-message-form');
    if(form){
      form.addEventListener('submit',event=>{
        event.preventDefault();
        const status=form.querySelector('[role="status"]');
        if(status)status.textContent='Your message has been sent. Our team will be in touch soon.';
        form.reset();
        toast('Message sent successfully');
      });
    }
  }
  function enrollmentPage(){
    const form=document.querySelector('.enrollment-form');
    if(!form)return;
    form.addEventListener('submit',event=>{
      event.preventDefault();
      const name=form.elements.namedItem('name').value.trim();
      localStorage.setItem('enairMember','true');
      form.hidden=true;
      const success=document.querySelector('.enrollment-success');
      if(success){
        const copy=success.querySelector('.enrollment-success-copy');
        if(copy)copy.textContent=`Welcome, ${name}. Your sample eNAir Rewards profile is ready.`;
        success.hidden=false;
      }
    });
  }
  function curatedTripPage(){
    const trip=document.querySelector('[data-curated-trip]');
    const destination=trip?.dataset.destination;
    document.querySelectorAll('.curated-trip-book').forEach(booking=>clickable(booking,()=>{if(destination)setDestination(destination);go(routes.search)}));
  }

  function informationalFallbacks(){
    const info={
      'Privacy Policy':'This prototype does not collect or transmit personal information. Booking details are stored only in this browser so the sample booking flow can keep your selections between pages.',
      'Terms of Use':'eNAir is a demonstration website. Fares, schedules, route availability, and service descriptions are illustrative and are not a real offer to transport passengers.',
      'Sustainability':'eNAir is designed around hydrogen-hybrid aircraft, lower-emission operations, and AI-assisted routing. The sustainability figures shown on this prototype are concept illustrations.',
      'Careers':'Explore future roles in aerospace engineering, sustainable aviation, customer experience, and digital product development. This prototype is not connected to a live recruitment system.',
      'Pressroom':'The eNAir pressroom would provide company announcements, media resources, leadership contacts, and the latest fleet and route news. For this prototype, contact the team through About & Contact.',
      'Press Room':'The eNAir pressroom would provide company announcements, media resources, leadership contacts, and the latest fleet and route news. For this prototype, contact the team through About & Contact.',
      'Corporate Travel':'Plan business travel with flexible fares, consolidated passenger details, and itinerary support. Start a sample booking with Book Flights.',
      'Global Lounge Network':'eNAir lounge access is planned around quiet work areas, private rest spaces, and curated dining at major network hubs. Availability depends on fare and destination.',
      'Partner Flights':'Partner-flight information would include eligible airline connections, transfer guidance, and through-ticket options. This prototype currently demonstrates eNAir-operated routes only.',
      'Help Center':'Find help with booking changes, travel documents, check-in, and account access. For personal assistance in this prototype, use the Contact Support link.',
      'Flight Status':'Flight status is not connected to live airline data in this prototype. Choose a flight in the booking flow to see the sample itinerary details.',
      'Baggage Claim':'For a delayed or missing bag, keep your baggage tag and travel itinerary available and contact the arrival airport baggage desk. This prototype does not submit real claims.',
      'Refund Policies':'Refund eligibility depends on fare conditions, cancellation timing, and applicable passenger-protection rules. Review the selected fare before booking; this prototype does not process real refunds.',
      'Accessible Travel':'Request mobility assistance, accessible seating, or support for sensory and communication needs before travel. Contact the airline support team in advance so arrangements can be confirmed.',
      'Corporate Offices':'eNAir corporate operations are represented as a global aerospace company in this concept. Contact Support can route general questions to the appropriate team.',
      'Affiliate Inquiries':'Affiliate partners can request information about referral tracking, approved brand materials, and commission terms. No affiliate accounts are active in this prototype.',
      'Strategic Alliances':'Airline, airport, and technology partners can discuss network connectivity, sustainable aviation, and customer-service integrations with the eNAir partnerships team.',
      'Developer API':'The eNAir developer API is a concept for searching routes, checking schedules, and managing sample bookings. No production API endpoint or credentials are available in this prototype.',
      'Regulatory Filings':'This prototype is not a public company filing system and does not publish audited financial or regulatory documents.',
      'Contact Support':'For booking, accessibility, or baggage questions, use the contact form on the About & Contact page. This prototype does not send submitted messages to a live support team.'
    };
    Object.entries(info).forEach(([title,message])=>findAll(title).forEach(el=>clickable(el,()=>{
      const body=document.createElement('div');
      const paragraph=document.createElement('p');paragraph.textContent=message;paragraph.style.cssText='line-height:1.7;margin:0';
      body.append(paragraph);
      modal(title,'eNAir information',body);
    })));
  }
  function globalFallbacks(){
    bindText('Search',()=>go(routes.search));
    bindText('View Flights',()=>go(routes.search));
    bindText('Book Now',()=>go(routes.booking)); bindText('Book Flights',()=>go(routes.booking));
    bindText('Contact Support',()=>go(routes.about));
  }

  function mobileMenu(){
    const navigation=document.querySelector('.sticky-navigation-2,.navigation-2');
    if(navigation&&!navigation.querySelector('.menu-mobile')){
      const button=document.createElement('button');
      button.type='button';
      button.className='menu-mobile';
      button.textContent='Menu';
      navigation.append(button);
    }
    document.querySelectorAll('[class^="menu-"]').forEach(menu=>{
      menu.setAttribute('aria-label','Open navigation menu');
      clickable(menu,()=>{
        const choices=document.createElement('div');choices.className='enair-grid';
        [['Destinations',routes.destinations],['Book Flights',routes.booking],['Our Fleet',routes.fleet],['Loyalty',routes.loyalty],['About eNAir',routes.about]]
          .forEach(([label,url])=>{const button=document.createElement('button');button.className='enair-choice';button.textContent=label;button.onclick=()=>go(url);choices.append(button)});
        modal('Explore eNAir','Choose a page',choices);
      });
    });
  }

  injectCSS(); globalNav();
  if(is('enair-homepage.html')||is('mobile-homepage.html')) homePage();
  if(is('enair-booking.html')||is('mobile-booking.html')) bookingPage();
  if(is('enair-destinations.html')) destinationsPage();
  if(is('booking-search.html')) searchPage();
  if(is('booking-select-fare.html')) farePage();
  if(is('booking-passengers.html')) passengersPage();
  if(is('booking-payment.html')) paymentPage();
  if(is('enair-fleet-experience.html')) fleetPage();
  if(is('enair-loyalty.html')) loyaltyPage();
  if(is('enair-rewards-enrollment.html')) enrollmentPage();
  if(is('fleet-a350.html')||is('fleet-787.html')||is('fleet-a380.html')) aircraftPage();
  if(is('enair-about-contact.html')) aboutPage();
  if(is('curated-iceland.html')||is('curated-vietnam-bali.html')||is('curated-greece.html')) curatedTripPage();
  if(is('mobile-homepage.html')||is('mobile-booking.html')||is('enair-booking.html')||is('booking-search.html')||is('enair-fleet-experience.html')||is('enair-loyalty.html')) mobileMenu();
  globalFallbacks(); informationalFallbacks();
  updateDisplayedRoute();
})();
