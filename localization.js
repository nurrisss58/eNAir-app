/* eNAir localization: interface language (EN / RU / KK) and display currency.
   Replaces the Google Translate widget: translations come from a local dictionary,
   prices are converted from the KZT base stored in data-price-kzt. */
(function () {
  'use strict';
  window.enairLocalizationEnabled = true;

  var LANG_KEY = 'enair.lang';
  var CURRENCY_KEY = 'enair.currency';
  var RATES = { KZT: 1, USD: 1 / 490, EUR: 1 / 535 };
  var SYMBOLS = { KZT: '₸', USD: '$', EUR: '€' };
  var SUPPORTED = ['en', 'ru', 'kk'];

  var RU = {
    'Destinations': 'Направления',
    'Book Flights': 'Билеты',
    'Our Fleet': 'Наш флот',
    'Loyalty': 'Лояльность',
    'About eNAir': 'О eNAir',
    'Help': 'Помощь',
    'Book Now': 'Забронировать',
    'Sign in / Register': 'Войти / Регистрация',
    'Sign in': 'Войти',
    'Manage booking': 'Мои брони',
    'My account': 'Личный кабинет',
    'Search': 'Найти',
    'From': 'Откуда',
    'To': 'Куда',
    'Departure': 'Вылет',
    'Return': 'Обратно',
    'Passengers': 'Пассажиры',
    'Economy': 'Эконом',
    'Welcome to Next-Gen Aviation': 'Авиация нового поколения',
    'Fly Beyond Boundaries': 'Летайте без границ',
    'Why Choose eNAir?': 'Почему eNAir?',
    'AI-Powered Routes': 'Маршруты с ИИ',
    'Zero-Emission Fleet': 'Флот без выбросов',
    'Seamless Digital Journey': 'Цифровой путь без трений',
    'Global Lounge Network': 'Глобальная сеть лаунжей',
    'Popular Destinations': 'Популярные направления',
    'Explore': 'Смотреть',
    'Select': 'Выбрать',
    'Choose fare': 'Выбрать тариф',
    'Continue': 'Продолжить',
    'Continue to Payment': 'Перейти к оплате',
    'Pay': 'Оплатить',
    'Back to Home': 'На главную',
    'Download e-ticket': 'Скачать билет',
    'Add to calendar': 'В календарь',
    'Send': 'Отправить',
    'Send message': 'Отправить сообщение',
    'Save changes': 'Сохранить',
    'Sign out': 'Выйти',
    'Company': 'Компания',
    'Support': 'Поддержка',
    'Connect': 'Связь',
    'Experience': 'Впечатления',
    'Personas': 'Персоны',
    'About Us': 'О нас',
    'Careers': 'Карьера',
    'Pressroom': 'Пресса',
    'Sustainability': 'Устойчивость',
    'Help Center': 'Центр помощи',
    'Flight Status': 'Статус рейса',
    'Baggage Claim': 'Розыск багажа',
    'Refund Policies': 'Правила возврата',
    'Accessible Travel': 'Доступные путешествия',
    'Privacy Policy': 'Конфиденциальность',
    'Terms of Use': 'Условия использования',
    'Our Journey': 'Наш путь',
    'The Flight Path of Innovation': 'Путь инноваций',
    'Be part of the journey': 'Станьте частью пути',
    'Our Fleet': 'Наш флот',
    'Where will you fly?': 'Куда полетите?',
    'Round-trip': 'Туда-обратно',
    'One-way': 'В одну сторону',
    'Available Outbound Flights': 'Доступные рейсы',
    'Select fare': 'Выберите тариф',
    'Who is traveling?': 'Кто летит?',
    'Passenger details': 'Данные пассажиров',
    'Secure payment': 'Безопасная оплата',
    'Payment confirmed': 'Оплата подтверждена',
    "You're booked": 'Вы забронированы',
    'Booking reference': 'Номер брони',
    'Manage booking': 'Мои брони',
    'Viewed': 'Просмотрено',
    'Redefining air travel through sustainable design, intelligent AI routing, and aerospace-level hyper-comfort.':
      'Переосмысляем авиаперевозки: устойчивый дизайн, маршруты с ИИ и комфорт уровня аэрокосмоса.',
    'AVIATION RE-ENGINEERED': 'АВИАЦИЯ ПЕРЕОСМЫСЛЕНА',
    '2 Passengers · Economy': '2 пассажира · Эконом',
    '2 Passengers В· Economy': '2 пассажира · Эконом',
    'Ask the assistant': 'Спросить ассистента',
    'PERSONAL ACCOUNT': 'ЛИЧНЫЙ КАБИНЕТ',
    'Your membership, trips and preferences in one place.': 'Членство, поездки и настройки в одном месте.',
    'Overview': 'Обзор',
    'Profile & notifications': 'Профиль и уведомления',
    'Payment methods': 'Способы оплаты',
    'Miles & rewards': 'Мили и награды',
    'My bookings': 'Мои брони',
    'eNAIR MEMBERSHIP': 'ЧЛЕНСТВО eNAIR',
    'ACCOUNT NUMBER': 'НОМЕР АККАУНТА',
    'MILES BALANCE': 'БАЛАНС МИЛЬ',
    'LANGUAGE': 'ЯЗЫК',
    'Your details': 'Ваши данные',
    'Edit the name, phone and language right here — no extra page.': 'Имя, телефон и язык — прямо здесь, без лишних страниц.',
    'FIRST NAME': 'ИМЯ',
    'LAST NAME': 'ФАМИЛИЯ',
    'PHONE': 'ТЕЛЕФОН',
    'EMAIL ADDRESS': 'EMAIL',
    'Save details': 'Сохранить',
    'Notification settings': 'Настройки уведомлений',
    'Recent bookings': 'Последние поездки',
    'Your latest trips on this account.': 'Последние поездки этого аккаунта.',
    'No bookings yet — your next trip will appear here.': 'Пока нет броней — следующая поездка появится здесь.',
    'Contact details': 'Контактные данные',
    'Used for tickets and flight updates.': 'Нужны для билетов и уведомлений о рейсе.',
    'Notifications': 'Уведомления',
    'Gate changes, check-in reminders and offers.': 'Изменения гейта, напоминания о регистрации и предложения.',
    'Flight updates': 'Обновления рейса',
    'Check-in reminders': 'Напоминания о регистрации',
    'Offers': 'Предложения',
    'On': 'Вкл',
    'Off': 'Выкл',
    'Gold member': 'Gold',
    'Member': 'Участник',
    'Personal account': 'Личный кабинет',
    'Account number': 'Номер аккаунта',
    'Miles balance': 'Баланс миль',
    'Language': 'Язык',
    'Email is the sign-in identity.': 'Email — это логин.',
    'Member since': 'Участник с',

  };

  var KK = {
    'Destinations': 'Бағыттар',
    'Book Flights': 'Әуе билеттері',
    'Our Fleet': 'Біздің флот',
    'Loyalty': 'Адалдық бағдарламасы',
    'About eNAir': 'eNAir туралы',
    'Help': 'Көмек',
    'Book Now': 'Брондау',
    'Sign in / Register': 'Кіру / Тіркелу',
    'Sign in': 'Кіру',
    'Manage booking': 'Менің брондарым',
    'My account': 'Жеке кабинет',
    'Search': 'Іздеу',
    'From': 'Қайдан',
    'To': 'Қайда',
    'Departure': 'Ұшу',
    'Return': 'Қайту',
    'Passengers': 'Жолаушылар',
    'Economy': 'Эконом',
    'Fly Beyond Boundaries': 'Шекарасыз ұшыңыз',
    'Company': 'Компания',
    'Support': 'Қолдау',
    'Connect': 'Байланыс',
    'Experience': 'Әсерлер',
    'Personas': 'Персоналар',
    'Continue': 'Жалғастыру',
    'Select': 'Таңдау',
    'Sign out': 'Шығу'
  };

  var DICTIONARIES = { en: null, ru: RU, kk: KK };
  var PREFIX_RULES = {
    ru: [
      [/^Member since (.+)$/, 'Участник с $1'],
      [/^(\d+) passengers$/, '$1 пассажира'],
      [/^Seats? (.+)$/, 'Места $1']
    ],
    kk: [
      [/^Member since (.+)$/, 'Мүше: $1']
    ]
  };

  var originals = new WeakMap();
  var currentLanguage = readLanguage();
  var currentCurrency = readCurrency();

  function readLanguage() {
    try {
      var saved = (localStorage.getItem(LANG_KEY) || '').toLowerCase();
      if (SUPPORTED.indexOf(saved) >= 0) return saved;
      if (localStorage.getItem('site_language') === 'ru') return 'ru';
    } catch (error) { /* ignore */ }
    return 'en';
  }

  function readCurrency() {
    try {
      var saved = (localStorage.getItem(CURRENCY_KEY) || '').toUpperCase();
      if (saved && RATES[saved]) return saved;
      if ((localStorage.getItem('site_currency') || '').toUpperCase() === 'USD') return 'USD';
    } catch (error) { /* ignore */ }
    return 'KZT';
  }

  function saveLanguage(code) {
    try { localStorage.setItem(LANG_KEY, code); localStorage.setItem('site_language', code); } catch (error) { /* ignore */ }
  }

  function saveCurrency(code) {
    try { localStorage.setItem(CURRENCY_KEY, code); localStorage.setItem('site_currency', code); } catch (error) { /* ignore */ }
  }

  function syncLanguageToProfile(code) {
    fetch('/api/me', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ language: code })
    }).catch(function () { /* a guest simply keeps it locally */ });
  }

  function format(amountKzt) {
    var value = Math.round(Number(amountKzt) * RATES[currentCurrency]);
    if (!Number.isFinite(value)) return '';
    return SYMBOLS[currentCurrency] + value.toLocaleString('en-US');
  }

  function applyPrices(root) {
    (root || document).querySelectorAll('[data-price-kzt]').forEach(function (element) {
      var base = Number(element.dataset.priceKzt);
      if (!Number.isFinite(base)) return;
      var text = format(base);
      if (!text) return;
      element.textContent = (element.dataset.pricePrefix || '') + text + (element.dataset.priceSuffix || '');
    });
  }

  function translateTextNode(node, language) {
    if (!originals.has(node)) originals.set(node, node.nodeValue);
    var source = originals.get(node);
    if (!source || !source.trim()) return;
    var dictionary = DICTIONARIES[language];
    var trimmed = source.trim();
    var replacement = dictionary && dictionary[trimmed];
    if (!replacement && PREFIX_RULES[language]) {
      for (var i = 0; i < PREFIX_RULES[language].length; i += 1) {
        var rule = PREFIX_RULES[language][i];
        if (rule[0].test(trimmed)) {
          replacement = trimmed.replace(rule[0], rule[1]);
          break;
        }
      }
    }
    node.nodeValue = replacement ? source.replace(trimmed, replacement) : source;
  }

  function applyLanguage(language) {
    currentLanguage = language;
    saveLanguage(language);
    document.documentElement.lang = language;
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        var parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'OPTION'].indexOf(parent.tagName) >= 0) return NodeFilter.FILTER_REJECT;
        if (parent.closest('[data-no-i18n]')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var node;
    while ((node = walker.nextNode())) translateTextNode(node, language);
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (input) {
      if (!input.dataset.i18nOriginal) input.dataset.i18nOriginal = input.placeholder;
      var key = input.dataset.i18nOriginal;
      var dictionary = DICTIONARIES[language];
      input.placeholder = (dictionary && dictionary[key]) || input.dataset.i18nOriginal;
    });
    var languageSelect = document.getElementById('language');
    if (languageSelect && languageSelect.tagName === 'SELECT') languageSelect.value = language;
    document.querySelectorAll('[data-lang]').forEach(function (button) {
      var active = button.dataset.lang === language;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function setCurrency(code) {
    if (!RATES[code]) return;
    currentCurrency = code;
    saveCurrency(code);
    applyPrices();
    document.querySelectorAll('[data-currency]').forEach(function (button) {
      var active = button.dataset.currency === code;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function buildControls() {
    var navigation = document.querySelector('.nav, .sticky-navigation-2, .navigation-2');
    if (!navigation) return;
    var host = navigation.querySelector('.nav-actions') || navigation;

    navigation.querySelectorAll('.enair-currency-switch, .enair-language-switch, .enair-switch-group, .currency').forEach(function (old) {
      old.style.display = 'none';
    });

    var group = document.querySelector('.enair-local-controls');
    if (!group) {
      group = document.createElement('div');
      group.className = 'enair-local-controls';
      group.setAttribute('aria-label', 'Language and currency');

      var languageGroup = document.createElement('div');
      languageGroup.className = 'enair-local-group';
      [['en', 'EN'], ['ru', 'RU'], ['kk', 'KK']].forEach(function (pair) {
        var button = document.createElement('button');
        button.type = 'button';
        button.dataset.lang = pair[0];
        button.textContent = pair[1];
        button.addEventListener('click', function () {
          applyLanguage(pair[0]);
          syncLanguageToProfile(pair[0]);
        });
        languageGroup.appendChild(button);
      });
      group.appendChild(languageGroup);

      var currencyGroup = document.createElement('div');
      currencyGroup.className = 'enair-local-group';
      [['KZT', '₸'], ['USD', '$'], ['EUR', '€']].forEach(function (pair) {
        var button = document.createElement('button');
        button.type = 'button';
        button.dataset.currency = pair[0];
        button.textContent = pair[1] + ' ' + pair[0];
        button.addEventListener('click', function () { setCurrency(pair[0]); });
        currencyGroup.appendChild(button);
      });
      group.appendChild(currencyGroup);

      var style = document.createElement('style');
      style.textContent = '.enair-local-controls{display:flex;align-items:center;gap:6px}'
        + '.enair-local-group{display:inline-flex;gap:2px;padding:3px;border:1px solid #e7eaf1;border-radius:12px;background:rgba(255,255,255,.94)}'
        + '.enair-local-group button{border:0;border-radius:9px;background:transparent;padding:6px 9px;color:#64748b;font:700 11px Geist,Arial,sans-serif;cursor:pointer;transition:.16s;white-space:nowrap}'
        + '.enair-local-group button:hover{background:#f3f4ff;color:#4f46e5}'
        + '.enair-local-group button.is-active{background:linear-gradient(115deg,#06b6d4,#8b5cf6);color:#fff}'
        + '.nav-links a{white-space:nowrap}' + '@media (max-width:900px){.enair-local-controls{display:none}}';
      document.head.appendChild(style);
      host.appendChild(group);
    }

    group.querySelectorAll('[data-lang]').forEach(function (button) {
      var active = button.dataset.lang === currentLanguage;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    group.querySelectorAll('[data-currency]').forEach(function (button) {
      var active = button.dataset.currency === currentCurrency;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }


  function watchLateContent() {
    var timer = null;
    var observer = new MutationObserver(function (mutations) {
      if (currentLanguage === 'en') return;
      var hasNewText = mutations.some(function (mutation) {
        return Array.prototype.some.call(mutation.addedNodes, function (node) {
          return node.nodeType === 3 || (node.nodeType === 1 && node.textContent.trim());
        });
      });
      if (!hasNewText) return;
      clearTimeout(timer);
      timer = setTimeout(function () { applyLanguage(currentLanguage); }, 250);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function start() {
    watchLateContent();
    buildControls();
    applyPrices();
    if (currentLanguage !== 'en') applyLanguage(currentLanguage);
    // Restore the language stored on the account when the browser has no choice yet.
    if (!localStorage.getItem(LANG_KEY)) {
      fetch('/api/me', { credentials: 'same-origin' })
        .then(function (response) { return response.json(); })
        .then(function (data) {
          var stored = data && data.user && data.user.language;
          if (stored && SUPPORTED.indexOf(stored) >= 0 && stored !== currentLanguage) applyLanguage(stored);
        })
        .catch(function () { /* ignore */ });
    }
    window.enairLocalization = {
      language: function () { return currentLanguage; },
      currency: function () { return currentCurrency; },
      setLanguage: applyLanguage,
      setCurrency: setCurrency,
      applyPrices: applyPrices
    };
    window.dispatchEvent(new CustomEvent('enair:localizationready'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
