(function () {
  'use strict';
  const key = 'site_language';
  const language = localStorage.getItem(key) === 'ru' ? 'ru' : 'en';
  const navigation = document.querySelector('.sticky-navigation-2,.navigation-2,.nav');
  const hostArea = navigation?.querySelector('.nav-actions') || navigation || document.body;

  if (!document.querySelector('.enair-language-switch')) {
    const style = document.createElement('style');
    style.textContent = '.enair-header-controls{display:flex;align-items:center;gap:8px}.enair-switch-group{display:inline-flex;gap:3px;padding:4px;border:1px solid #e7eaf1;border-radius:14px;background:rgba(255,255,255,.94);box-shadow:0 5px 16px rgba(15,23,42,.08)}.enair-switch-group button{border:0;border-radius:10px;background:transparent;padding:8px 11px;color:#64748b;font:700 12px Geist,Arial,sans-serif;cursor:pointer;transition:.18s}.enair-switch-group button:hover{background:#f3f4ff;color:#4f46e5}.enair-switch-group button.is-active{background:linear-gradient(115deg,#06b6d4,#8b5cf6);color:#fff;box-shadow:0 4px 10px rgba(99,102,241,.28)}.enair-language-floating{position:fixed;top:14px;right:16px;z-index:100000}';
    document.head.append(style);
    const group = document.createElement('div');
    group.className = 'enair-switch-group enair-language-switch';
    group.setAttribute('aria-label', 'Language');
    [['en', 'EN'], ['ru', 'RU']].forEach(([value, label]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.setAttribute('aria-pressed', String(value === language));
      if (value === language) button.classList.add('is-active');
      button.addEventListener('click', () => {
        try { localStorage.setItem(key, value); } catch (_) {}
        document.cookie = `googtrans=/en/${value};path=/;max-age=31536000;SameSite=Lax`;
        location.reload();
      });
      group.append(button);
    });
    if (navigation) hostArea.append(group);
    else { group.classList.add('enair-language-floating'); document.body.append(group); }
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
