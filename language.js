(function () {
  'use strict';
  const key = 'site_language';
  let language = localStorage.getItem(key) === 'ru' ? 'ru' : 'en';
  const navigation = document.querySelector('.sticky-navigation-2,.navigation-2,.nav');
  const hostArea = navigation || document.body;
  if (!document.getElementById('enair-language-style')) {
    const style = document.createElement('style');
    style.id = 'enair-language-style';
    style.textContent = '.enair-language-select{border:1px solid transparent;border-radius:999px;background:linear-gradient(#fff,#fff) padding-box,linear-gradient(120deg,#06b6d4,#8b5cf6) border-box;padding:8px 10px;color:#0f172a;font:600 12px Geist,Arial,sans-serif;cursor:pointer;box-shadow:0 3px 12px rgba(15,23,42,.06)}.enair-language-floating{position:fixed;top:14px;right:16px;z-index:100000}';
    document.head.append(style);
  }

  if (!document.querySelector('.enair-language-select')) {
    const select = document.createElement('select');
    select.className = 'enair-language-select';
    select.setAttribute('aria-label', 'Language / Язык');
    [['en', 'EN'], ['ru', 'RU']].forEach(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      select.append(option);
    });
    select.value = language;
    select.addEventListener('change', () => {
      language = select.value === 'ru' ? 'ru' : 'en';
      try { localStorage.setItem(key, language); } catch (_) {}
      document.cookie = `googtrans=/en/${language};path=/;max-age=31536000;SameSite=Lax`;
      location.reload();
    });
    if (navigation) {
      select.style.marginInlineStart = 'auto';
      hostArea.append(select);
    } else {
      select.classList.add('enair-language-floating');
      document.body.append(select);
    }
  }

  if (language !== 'ru' || document.getElementById('enair-translate-script')) return;
  const host = document.createElement('div');
  host.id = 'enair-translate-host';
  host.hidden = true;
  document.body.append(host);
  window.googleTranslateElementInit = function () {
    if (window.google?.translate?.TranslateElement) {
      new window.google.translate.TranslateElement(
        {pageLanguage: 'en', includedLanguages: 'en,ru', autoDisplay: false},
        'enair-translate-host'
      );
    }
  };
  const script = document.createElement('script');
  script.id = 'enair-translate-script';
  script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
  script.async = true;
  document.head.append(script);
})();
