(function () {
  'use strict';

  const routes = {
    home: 'enair-homepage.html',
    destinations: 'enair-destinations.html',
    booking: 'enair-booking.html',
    search: 'booking-search.html',
    fare: 'booking-select-fare.html',
    passengers: 'booking-passengers.html',
    payment: 'booking-payment.html',
    fleet: 'enair-fleet-experience.html',
    loyalty: 'enair-loyalty.html',
    about: 'enair-about-contact.html',
    rewards: 'enair-rewards-enrollment.html'
  };

  const page = (location.pathname.split('/').pop() || 'index.html');
  const apiBase = '/api';
  const authKey = 'enairUser';

  function toast(msg) {
    let old = document.querySelector('.enair-toast');
    if (old) old.remove();
    const t = document.createElement('div');
    t.className = 'enair-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }

  function go(url) {
    if (url) location.href = url;
  }

  function bindText(text, handler) {
    const nodes = [...document.querySelectorAll('button, a, div, span')];
    for (const node of nodes) {
      if (!node || !node.textContent) continue;
      if (node.textContent.trim().toLowerCase() === text.toLowerCase()) {
        node.addEventListener('click', function (event) {
          event.preventDefault();
          handler(event, node);
        });
        return true;
      }
    }
    return false;
  }

  function bindTextPrefix(prefix, handler) {
    const nodes = [...document.querySelectorAll('button, a, div, span')];
    for (const node of nodes) {
      if (!node || !node.textContent) continue;
      const value = node.textContent.trim();
      if (value.toLowerCase().indexOf(prefix.toLowerCase()) === 0) {
        node.addEventListener('click', function (event) {
          event.preventDefault();
          handler(event, node);
        });
        return true;
      }
    }
    return false;
  }

  function bindNavigation() {
    const map = {
      'Home': routes.home,
      'Destinations': routes.destinations,
      'Book Flights': routes.booking,
      'Our Fleet': routes.fleet,
      'Loyalty': routes.loyalty,
      'About eNAir': routes.about,
      'Book Now': routes.booking,
      'Search': routes.search,
      'View Flights': routes.search,
      'Contact Support': routes.about,
      'Join eNAir Rewards': routes.rewards
    };

    Object.keys(map).forEach((label) => {
      bindText(label, () => go(map[label]));
    });

    const brandSelectors = ['.brand', '.brand-3', '.logo-group', '.logo-group-3', '.logo-group-4'];
    brandSelectors.forEach((selector) => {
      const el = document.querySelector(selector);
      if (el) {
        el.addEventListener('click', function (event) {
          event.preventDefault();
          go(routes.home);
        });
      }
    });
  }

  function openAuthModal() {
    if (document.querySelector('.enair-auth-modal')) return;

    const backdrop = document.createElement('div');
    backdrop.className = 'enair-auth-modal';
    backdrop.style.position = 'fixed';
    backdrop.style.inset = '0';
    backdrop.style.background = 'rgba(15,23,42,0.55)';
    backdrop.style.display = 'flex';
    backdrop.style.alignItems = 'center';
    backdrop.style.justifyContent = 'center';
    backdrop.style.zIndex = '99999';

    const modal = document.createElement('div');
    modal.style.width = '420px';
    modal.style.maxWidth = 'calc(100vw - 32px)';
    modal.style.background = '#fff';
    modal.style.borderRadius = '20px';
    modal.style.padding = '24px';
    modal.style.boxShadow = '0 24px 80px rgba(15, 23, 42, 0.28)';

    const title = document.createElement('h3');
    title.textContent = 'Войти / Регистрация';
    title.style.margin = '0 0 8px';
    title.style.fontSize = '28px';

    const desc = document.createElement('p');
    desc.textContent = 'Войдите, чтобы продолжить бронирование.';
    desc.style.margin = '0 0 16px';
    desc.style.color = '#64748b';

    const tabs = document.createElement('div');
    tabs.style.display = 'grid';
    tabs.style.gridTemplateColumns = '1fr 1fr';
    tabs.style.gap = '8px';
    tabs.style.marginBottom = '16px';

    const loginTab = document.createElement('button');
    loginTab.type = 'button';
    loginTab.textContent = 'Войти';
    loginTab.style.padding = '10px';
    loginTab.style.border = '1px solid #e2e8f0';
    loginTab.style.borderRadius = '10px';
    loginTab.style.background = '#0f172a';
    loginTab.style.color = '#fff';
    loginTab.style.cursor = 'pointer';

    const registerTab = document.createElement('button');
    registerTab.type = 'button';
    registerTab.textContent = 'Регистрация';
    registerTab.style.padding = '10px';
    registerTab.style.border = '1px solid #e2e8f0';
    registerTab.style.borderRadius = '10px';
    registerTab.style.background = '#fff';
    registerTab.style.color = '#0f172a';
    registerTab.style.cursor = 'pointer';

    const form = document.createElement('form');
    form.style.display = 'grid';
    form.style.gap = '12px';

    const emailLabel = document.createElement('label');
    emailLabel.style.display = 'grid';
    emailLabel.style.gap = '6px';
    emailLabel.style.fontWeight = '600';
    emailLabel.textContent = 'Email';

    const emailInput = document.createElement('input');
    emailInput.type = 'email';
    emailInput.required = true;
    emailInput.placeholder = 'name@example.com';
    emailInput.style.padding = '12px';
    emailInput.style.border = '1px solid #cbd5e1';
    emailInput.style.borderRadius = '10px';

    const passwordLabel = document.createElement('label');
    passwordLabel.style.display = 'grid';
    passwordLabel.style.gap = '6px';
    passwordLabel.style.fontWeight = '600';
    passwordLabel.textContent = 'Пароль';

    const passwordInput = document.createElement('input');
    passwordInput.type = 'password';
    passwordInput.required = true;
    passwordInput.placeholder = '********';
    passwordInput.style.padding = '12px';
    passwordInput.style.border = '1px solid #cbd5e1';
    passwordInput.style.borderRadius = '10px';

    const message = document.createElement('div');
    message.style.minHeight = '20px';
    message.style.color = '#b91c1c';
    message.style.fontSize = '14px';

    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.textContent = 'Войти';
    submit.style.border = '0';
    submit.style.borderRadius = '10px';
    submit.style.padding = '12px';
    submit.style.background = 'linear-gradient(110deg,#06b6d4,#8b5cf6)';
    submit.style.color = '#fff';
    submit.style.cursor = 'pointer';
    submit.style.fontWeight = '700';

    emailLabel.appendChild(emailInput);
    passwordLabel.appendChild(passwordInput);
    tabs.appendChild(loginTab);
    tabs.appendChild(registerTab);
    form.appendChild(emailLabel);
    form.appendChild(passwordLabel);
    form.appendChild(message);
    form.appendChild(submit);
    modal.appendChild(title);
    modal.appendChild(desc);
    modal.appendChild(tabs);
    modal.appendChild(form);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    function close() {
      backdrop.remove();
    }

    backdrop.addEventListener('click', function (event) {
      if (event.target === backdrop) close();
    });

    const closeX = document.createElement('button');
    closeX.type = 'button';
    closeX.textContent = '×';
    closeX.style.position = 'absolute';
    closeX.style.top = '12px';
    closeX.style.right = '12px';
    closeX.style.width = '32px';
    closeX.style.height = '32px';
    closeX.style.border = '0';
    closeX.style.borderRadius = '50%';
    closeX.style.background = '#f1f5f9';
    closeX.style.cursor = 'pointer';
    closeX.style.fontSize = '22px';
    closeX.style.color = '#334155';
    closeX.addEventListener('click', close);
    modal.style.position = 'relative';
    modal.appendChild(closeX);

    let mode = 'login';
    const setMode = function (nextMode) {
      mode = nextMode;
      title.textContent = mode === 'login' ? 'С возвращением' : 'Создать аккаунт';
      desc.textContent = mode === 'login' ? 'Войдите, чтобы продолжить бронирование.' : 'Зарегистрируйтесь, чтобы бронировать рейсы.';
      loginTab.style.background = mode === 'login' ? '#0f172a' : '#fff';
      loginTab.style.color = mode === 'login' ? '#fff' : '#0f172a';
      registerTab.style.background = mode === 'register' ? '#0f172a' : '#fff';
      registerTab.style.color = mode === 'register' ? '#fff' : '#0f172a';
      submit.textContent = mode === 'login' ? 'Войти' : 'Создать аккаунт';
      message.textContent = '';
    };

    loginTab.addEventListener('click', function () { setMode('login'); });
    registerTab.addEventListener('click', function () { setMode('register'); });

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      const email = emailInput.value.trim();
      const password = passwordInput.value;
      if (!email || !password) {
        message.textContent = 'Укажите email и пароль.';
        return;
      }
      const endpoint = mode === 'login' ? 'login' : 'register';
      submit.disabled = true;
      submit.textContent = 'Подождите...';

      try {
        const response = await fetch(apiBase + '/' + endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email, password: password })
        });

        let result = null;
        try {
          result = await response.json();
        } catch (error) {
          result = null;
        }

        if (!response.ok) {
          const err = (result && result.error) ? result.error : 'Ошибка сервера';
          message.textContent = err;
          submit.disabled = false;
          submit.textContent = mode === 'login' ? 'Войти' : 'Создать аккаунт';
          return;
        }

        const user = (result && result.user) ? result.user : { email: email };
        localStorage.setItem(authKey, JSON.stringify(user));
        toast(mode === 'login' ? 'Успешный вход' : 'Регистрация прошла успешно');
        close();
      } catch (error) {
        console.error('Auth API error:', error);
        message.textContent = 'Не удалось подключиться к серверу. Проверьте, что Flask запущен.';
      } finally {
        submit.disabled = false;
        submit.textContent = mode === 'login' ? 'Войти' : 'Создать аккаунт';
      }
    });

    setMode('login');
    emailInput.focus();
  }

  function injectAuthButtons() {
    const existing = document.querySelector('.enair-auth-trigger');
    if (existing) return;

    const nav = document.querySelector('.sticky-navigation-2, .navigation-2');
    if (!nav) return;

    const host = document.createElement('div');
    host.style.display = 'flex';
    host.style.alignItems = 'center';
    host.style.gap = '8px';

    const user = JSON.parse(localStorage.getItem(authKey) || 'null');
    if (user && user.email) {
      const email = document.createElement('span');
      email.textContent = user.email;
      email.style.maxWidth = '180px';
      email.style.overflow = 'hidden';
      email.style.textOverflow = 'ellipsis';
      email.style.whiteSpace = 'nowrap';
      email.style.color = '#334155';
      email.style.fontSize = '13px';
      host.appendChild(email);

      const logout = document.createElement('button');
      logout.type = 'button';
      logout.textContent = 'Выйти';
      logout.className = 'enair-auth-trigger';
      logout.style.padding = '8px 12px';
      logout.style.borderRadius = '999px';
      logout.style.border = '1px solid #e2e8f0';
      logout.style.background = '#fff';
      logout.style.color = '#0f172a';
      logout.style.cursor = 'pointer';
      logout.addEventListener('click', function () {
        localStorage.removeItem(authKey);
        injectAuthButtons();
      });
      host.appendChild(logout);
    } else {
      const login = document.createElement('button');
      login.type = 'button';
      login.textContent = 'Войти / Регистрация';
      login.className = 'enair-auth-trigger';
      login.style.padding = '10px 14px';
      login.style.borderRadius = '999px';
      login.style.border = '0';
      login.style.background = 'linear-gradient(110deg,#06b6d4,#8b5cf6)';
      login.style.color = '#fff';
      login.style.fontWeight = '700';
      login.style.cursor = 'pointer';
      login.addEventListener('click', openAuthModal);
      host.appendChild(login);
    }

    nav.appendChild(host);
  }

  function bindGenericButtons() {
    const pairs = {
      'Book Now': routes.booking,
      'Book Flights': routes.booking,
      'Search': routes.search,
      'View Flights': routes.search,
      'Destinations': routes.destinations,
      'Our Fleet': routes.fleet,
      'Loyalty': routes.loyalty,
      'About eNAir': routes.about,
      'Join eNAir Rewards': routes.rewards,
      'Contact Support': routes.about,
      'Home': routes.home
    };

    Object.keys(pairs).forEach((label) => {
      bindText(label, function () {
        go(pairs[label]);
      });
    });
  }

  function safeInit() {
    try {
      bindNavigation();
      bindGenericButtons();
      injectAuthButtons();
      if (typeof window !== 'undefined' && window) {
        window.enairSafe = true;
      }
    } catch (error) {
      console.error('navigation.js failed to initialize:', error);
    }
  }

  safeInit();
})();
