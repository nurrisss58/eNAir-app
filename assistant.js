/*
 * eNAir — ИИ-ассистент (виджет).
 *
 * Логика ответа живёт на сервере: POST /api/assistant.
 * Если на сервере задан AI_API_KEY — отвечает языковая модель,
 * иначе работает встроенный движок правил. Виджет одинаковый в обоих случаях.
 */
(function () {
  'use strict';

  if (document.getElementById('enair-ai-root')) return;

  // На хостинге API на том же домене; при открытии файлов с диска — локальный Flask.
  const API_BASE = location.protocol === 'file:' ? 'http://127.0.0.1:5000' : '';

  const GREETING = 'Здравствуйте! Я ассистент eNAir. Подскажу по рейсам, тарифам, багажу, регистрации и милям.';
  const DEFAULT_CHIPS = [
    'Сколько стоит билет до Лондона?',
    'Что входит в тариф Flex?',
    'Как зарегистрироваться?'
  ];

  const style = document.createElement('style');
  style.textContent = [
    '.enair-ai{position:fixed;right:20px;bottom:20px;z-index:100002;font-family:"Geist",system-ui,sans-serif}',
    '.enair-ai-launcher{display:inline-flex;align-items:center;gap:9px;border:0;border-radius:999px;padding:13px 20px;',
    'background:linear-gradient(110deg,#06b6d4,#8b5cf6);color:#fff;font:600 14px "Geist",sans-serif;cursor:pointer;',
    'box-shadow:0 12px 34px rgba(15,23,42,.28);transition:transform .15s,filter .15s}',
    '.enair-ai-launcher:hover{transform:translateY(-1px);filter:brightness(1.05)}',
    '.enair-ai-launcher:focus-visible{outline:2px solid #0f172a;outline-offset:3px}',
    '.enair-ai-dot{width:8px;height:8px;border-radius:50%;background:#fff;box-shadow:0 0 0 3px rgba(255,255,255,.35)}',
    '.enair-ai-panel{position:absolute;right:0;bottom:64px;width:360px;max-width:calc(100vw - 32px);height:min(520px,70vh);',
    'display:flex;flex-direction:column;background:#fff;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;',
    'box-shadow:0 28px 80px rgba(15,23,42,.3)}',
    // display:flex выше перебивает атрибут hidden, поэтому закрываем явно
    '.enair-ai-panel[hidden]{display:none}',
    '.enair-ai-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;',
    'background:linear-gradient(110deg,rgba(6,182,212,.12),rgba(139,92,246,.12));border-bottom:1px solid #e2e8f0}',
    '.enair-ai-title{font:700 15px "Outfit",sans-serif;color:#0f172a}',
    '.enair-ai-sub{display:block;font:400 11px "Geist",sans-serif;color:#64748b;margin-top:2px}',
    '.enair-ai-close{border:0;background:#fff;border-radius:50%;width:30px;height:30px;font-size:18px;line-height:1;color:#334155;cursor:pointer}',
    '.enair-ai-close:hover{background:#f1f5f9}',
    '.enair-ai-log{flex:1 1 auto;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;background:#f8fafc}',
    '.enair-ai-msg{max-width:85%;padding:10px 13px;border-radius:14px;font:400 13px/1.5 "Geist",sans-serif;white-space:pre-wrap;word-break:break-word}',
    '.enair-ai-msg.bot{align-self:flex-start;background:#fff;border:1px solid #e2e8f0;color:#0f172a;border-bottom-left-radius:6px}',
    '.enair-ai-msg.user{align-self:flex-end;background:#0f172a;color:#fff;border-bottom-right-radius:6px}',
    '.enair-ai-msg.pending{color:#64748b;font-style:italic}',
    '.enair-ai-note{align-self:flex-start;max-width:92%;padding:0 4px;font:400 11px "Geist",sans-serif;color:#94a3b8;line-height:1.4}',
    '.enair-ai-chips{display:flex;flex-wrap:wrap;gap:6px;padding:0 16px 10px;background:#f8fafc}',
    '.enair-ai-chip{border:1px solid #e2e8f0;background:#fff;border-radius:999px;padding:7px 11px;font:500 11px "Geist",sans-serif;color:#334155;cursor:pointer}',
    '.enair-ai-chip:hover{border-color:#06b6d4;color:#0e7490}',
    '.enair-ai-form{display:flex;gap:8px;padding:12px;border-top:1px solid #e2e8f0;background:#fff}',
    '.enair-ai-input{flex:1 1 auto;min-width:0;border:1px solid #cbd5e1;border-radius:11px;padding:11px 12px;font:400 13px "Geist",sans-serif;color:#0f172a}',
    '.enair-ai-input:focus{outline:2px solid rgba(6,182,212,.3);border-color:#06b6d4}',
    '.enair-ai-send{border:0;border-radius:11px;padding:0 16px;background:#0f172a;color:#fff;font:600 13px "Geist",sans-serif;cursor:pointer}',
    '.enair-ai-send:disabled{opacity:.5;cursor:default}',
    '@media(max-width:480px){.enair-ai{right:12px;left:12px;bottom:12px}.enair-ai-panel{right:0;left:0;width:auto}}'
  ].join('');

  document.head.appendChild(style);

  const root = document.createElement('div');
  root.id = 'enair-ai-root';
  root.className = 'enair-ai';

  const launcher = document.createElement('button');
  launcher.type = 'button';
  launcher.className = 'enair-ai-launcher';
  launcher.setAttribute('aria-expanded', 'false');
  launcher.setAttribute('aria-controls', 'enair-ai-panel');
  launcher.innerHTML = '<span class="enair-ai-dot" aria-hidden="true"></span><span>Спросить ассистента</span>';

  const panel = document.createElement('section');
  panel.className = 'enair-ai-panel';
  panel.id = 'enair-ai-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Ассистент eNAir');
  panel.hidden = true;

  const head = document.createElement('div');
  head.className = 'enair-ai-head';
  const titles = document.createElement('div');
  const title = document.createElement('div');
  title.className = 'enair-ai-title';
  title.textContent = 'Ассистент eNAir';
  const sub = document.createElement('span');
  sub.className = 'enair-ai-sub';
  sub.textContent = 'Рейсы, тарифы, багаж, регистрация';
  titles.append(title, sub);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'enair-ai-close';
  closeBtn.setAttribute('aria-label', 'Закрыть ассистента');
  closeBtn.textContent = '×';
  head.append(titles, closeBtn);

  const log = document.createElement('div');
  log.className = 'enair-ai-log';
  log.setAttribute('role', 'log');
  log.setAttribute('aria-live', 'polite');

  const chips = document.createElement('div');
  chips.className = 'enair-ai-chips';

  const form = document.createElement('form');
  form.className = 'enair-ai-form';
  const input = document.createElement('input');
  input.className = 'enair-ai-input';
  input.type = 'text';
  input.placeholder = 'Ваш вопрос…';
  input.setAttribute('aria-label', 'Вопрос ассистенту');
  input.maxLength = 400;
  const send = document.createElement('button');
  send.type = 'submit';
  send.className = 'enair-ai-send';
  send.textContent = 'Отправить';
  form.append(input, send);

  panel.append(head, log, chips, form);
  root.append(panel, launcher);
  document.body.appendChild(root);

  let started = false;
  let busy = false;

  function bubble(text, kind) {
    const node = document.createElement('div');
    node.className = 'enair-ai-msg ' + kind;
    node.textContent = text;
    log.appendChild(node);
    log.scrollTop = log.scrollHeight;
    return node;
  }

  function renderChips(items) {
    chips.replaceChildren();
    (items && items.length ? items : DEFAULT_CHIPS).slice(0, 3).forEach(text => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'enair-ai-chip';
      chip.textContent = text;
      chip.addEventListener('click', () => {
        input.value = text;
        form.requestSubmit();
      });
      chips.appendChild(chip);
    });
  }

  function open() {
    panel.hidden = false;
    launcher.setAttribute('aria-expanded', 'true');
    if (!started) {
      started = true;
      bubble(GREETING, 'bot');
      renderChips(DEFAULT_CHIPS);
    }
    input.focus();
  }

  function close() {
    panel.hidden = true;
    launcher.setAttribute('aria-expanded', 'false');
    launcher.focus();
  }

  launcher.addEventListener('click', () => (panel.hidden ? open() : close()));
  closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) close();
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const message = input.value.trim();
    if (!message || busy) return;

    busy = true;
    send.disabled = true;
    input.value = '';
    bubble(message, 'user');
    const pending = bubble('Печатает…', 'bot pending');

    try {
      const response = await fetch(API_BASE + '/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message })
      });

      let data = null;
      try {
        data = await response.json();
      } catch (error) {
        data = null;
      }

      pending.remove();

      if (!response.ok || !data || !data.reply) {
        bubble('Не получилось получить ответ. Попробуйте ещё раз через минуту.', 'bot');
        return;
      }

      bubble(data.reply, 'bot');

      // Если модель недоступна — честно показываем, что ответил движок правил.
      if (data.ai_error) {
        const note = document.createElement('div');
        note.className = 'enair-ai-note';
        note.textContent = 'Режим ИИ недоступен (' + data.ai_error + '), отвечает встроенный движок правил.';
        log.appendChild(note);
        log.scrollTop = log.scrollHeight;
      }

      if (Array.isArray(data.suggestions)) renderChips(data.suggestions);
    } catch (error) {
      pending.remove();
      bubble('Не удалось связаться с сервером. Проверьте подключение и попробуйте снова.', 'bot');
    } finally {
      busy = false;
      send.disabled = false;
      input.focus();
    }
  });
})();
