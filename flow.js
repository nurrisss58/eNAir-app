/* eNAir — flow pages runtime: manage booking, check-in, passes, changes,
   baggage, rewards, account, support and status. */

(function () {
  'use strict';

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const money = value => '₸' + Math.round(Number(value) || 0).toLocaleString('en-US');
  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (error) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (error) { /* ignore */ }
    }
  };

  const session = {
    get(key, fallback) {
      try {
        const raw = sessionStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (error) { return fallback; }
    },
    set(key, value) {
      try { sessionStorage.setItem(key, JSON.stringify(value)); } catch (error) { /* ignore */ }
    }
  };

  let toastTimer = null;
  function toast(message, kind) {
    const el = $('#toast') || (() => {
      const node = document.createElement('div');
      node.id = 'toast';
      node.className = 'toast';
      document.body.appendChild(node);
      return node;
    })();
    el.textContent = message;
    el.className = 'toast show' + (kind ? ' ' + kind : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = 'toast'; }, 3200);
  }

  const DEMO_FLIGHTS = [
    { flight_number: 'eN-102', departure_city: 'New York', arrival_city: 'London', departure_time: '28.03.2026 08:15', arrival_time: '28.03.2026 20:30', price: 604660, seats_available: 24, aircraft: 'Airbus A350-H2' },
    { flight_number: 'eN-204', departure_city: 'New York', arrival_city: 'Paris', departure_time: '29.03.2026 11:40', arrival_time: '29.03.2026 23:55', price: 589200, seats_available: 12, aircraft: 'Boeing 787-9' },
    { flight_number: 'eN-318', departure_city: 'London', arrival_city: 'Dubai', departure_time: '30.03.2026 17:05', arrival_time: '31.03.2026 05:20', price: 641100, seats_available: 8, aircraft: 'Airbus A380-800' },
    { flight_number: 'eN-88', departure_city: 'London', arrival_city: 'Tokyo', departure_time: '31.03.2026 09:30', arrival_time: '01.04.2026 07:10', price: 812000, seats_available: 16, aircraft: 'Airbus A350-H2' }
  ];

  const DEMO_BOOKING = {
    reference: 'EN482913',
    flight_number: 'eN-102',
    departure_city: 'New York',
    arrival_city: 'London',
    departure_time: '28.03.2026 08:15',
    arrival_time: '28.03.2026 20:30',
    cabin: 'Economy Flex',
    fare: 'Flex',
    passengers: 2,
    passenger_names: ['Alex Morgan', 'Sam Reed'],
    total_price: 604660,
    status: 'confirmed',
    seats: '12A, 12B'
  };

  async function api(path, options) {
    const response = await fetch(path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, options || {}));
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return response.json();
  }

  async function flights() {
    try {
      const data = await api('/api/flights');
      return Array.isArray(data) && data.length ? data : DEMO_FLIGHTS;
    } catch (error) {
      return DEMO_FLIGHTS;
    }
  }

  async function booking(reference) {
    try {
      const data = await api('/api/bookings/' + encodeURIComponent(reference));
      return Object.assign({}, DEMO_BOOKING, data);
    } catch (error) {
      return Object.assign({}, DEMO_BOOKING, { reference: reference || DEMO_BOOKING.reference });
    }
  }

  function param(name, fallback) {
    const value = new URLSearchParams(location.search).get(name);
    return value || fallback || '';
  }

  function formatDate(value) {
    if (!value) return '—';
    const [date, time] = String(value).split(' ');
    return time ? date + ' · ' + time : date;
  }

  /* ---------- decorative pass elements ---------- */

  function drawQr(container) {
    if (!container) return;
    const cells = 21;
    container.innerHTML = '';
    let seed = 7;
    const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let y = 0; y < cells; y += 1) {
      for (let x = 0; x < cells; x += 1) {
        const cell = document.createElement('i');
        const finder = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
        const ring = finder && (x === 0 || x === 6 || y === 0 || y === 6 ||
          (x >= 2 && x <= 4 && y >= 2 && y <= 4));
        if (finder) {
          if (!ring) cell.className = 'off';
        } else if (rand() > 0.52) {
          cell.className = 'off';
        }
        container.appendChild(cell);
      }
    }
  }

  function drawBarcode(container) {
    if (!container) return;
    container.innerHTML = '';
    let seed = 11;
    const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let i = 0; i < 46; i += 1) {
      const bar = document.createElement('i');
      if (rand() > 0.6) bar.className = 'w';
      container.appendChild(bar);
    }
  }

  function passData() {
    return session.get('enair.pass', {
      reference: DEMO_BOOKING.reference,
      flight: DEMO_BOOKING.flight_number,
      from: 'JFK',
      to: 'LHR',
      cityFrom: 'New York',
      cityTo: 'London',
      date: '28 Mar 2026',
      departure: '08:15',
      boarding: '07:35',
      gate: 'B22',
      terminal: '4',
      seat: '12A',
      gateSeat: '12A',
      passenger: 'Alex Morgan',
      cabin: 'Economy Flex',
      bags: '2 × 23 kg'
    });
  }

  function fillPass() {
    const data = passData();
    $$('[data-pass]').forEach(el => {
      const key = el.getAttribute('data-pass');
      if (data[key] !== undefined) el.textContent = data[key];
    });
    drawQr($('[data-qr]'));
    drawBarcode($('[data-barcode]'));
  }

  /* ---------- pages ---------- */

  const pages = {
    async manage() {
      const form = $('#manage-form');
      const result = $('#trip');
      const error = $('#manage-error');

      const render = data => {
        $$('[data-trip]').forEach(el => {
          const key = el.getAttribute('data-trip');
          if (key === 'route') el.textContent = (data.departure_city || 'New York') + ' → ' + (data.arrival_city || 'London');
          else if (key === 'passengers') el.textContent = (data.passenger_names || ['Alex Morgan']).join(', ');
          else if (key === 'seats') el.textContent = data.seats || '12A · 12B';
          else if (key === 'bags') el.textContent = '2 × 23 kg';
          else if (key === 'total') el.textContent = money(data.total_price);
          else if (data[key] !== undefined) el.textContent = data[key];
        });
        const ref = data.reference || '';
        $$('[data-ref-link]').forEach(link => {
          const base = link.getAttribute('data-ref-link');
          link.setAttribute('href', base + (base.indexOf('?') >= 0 ? '&' : '?') + 'ref=' + encodeURIComponent(ref));
        });
        result.classList.remove('hidden');
        error.classList.add('hidden');
      };

      if (form) {
        form.addEventListener('submit', async event => {
          event.preventDefault();
          const reference = ($('#reference').value || '').trim().toUpperCase();
          const lastname = ($('#lastname').value || '').trim();
          const refField = $('#f-reference');
          if (reference.length < 6) {
            refField.classList.add('has-error');
            return;
          }
          refField.classList.remove('has-error');
          const data = await booking(reference);
          if (lastname && (data.passenger_names || []).join(' ').toLowerCase().indexOf(lastname.toLowerCase()) === -1) {
            error.textContent = 'Booking not found — check the reference and last name.';
            error.classList.remove('hidden');
            result.classList.add('hidden');
            return;
          }
          render(data);
          toast('Booking found · ' + (data.reference || reference), 'ok');
        });
      }

      if (result && !param('ref')) {
        render(DEMO_BOOKING);
      }
      if (param('ref')) {
        const data = await booking(param('ref'));
        render(data);
      }
    },

    async checkin() {
      const form = $('#checkin-form');
      if (!form) return;
      const ref = param('ref', DEMO_BOOKING.reference);
      $$('[data-checkin-ref]').forEach(el => { el.textContent = ref; });

      form.addEventListener('submit', event => {
        event.preventDefault();
        let valid = true;
        $$('.field[data-validate]', form).forEach(field => {
          const input = $('input', field);
          const value = (input.value || '').trim();
          const rule = field.getAttribute('data-validate');
          const ok = rule === 'passport' ? value.length >= 6 : value.length >= 4;
          field.classList.toggle('has-error', !ok);
          if (!ok) valid = false;
        });
        const consent = $('#consent');
        if (consent && !consent.checked) { valid = false; toast('Confirm the document data to continue', 'err'); }
        if (!valid) return;

        const passengers = $$('[data-passenger-name]').map(el => el.textContent.trim());
        session.set('enair.pass', Object.assign({}, passData(), {
          reference: ref,
          passenger: (passengers[0] || 'Alex Morgan') + (passengers[1] ? ' + ' + passengers[1] : ''),
          seat: $('#seat-value') ? $('#seat-value').textContent.trim() : '12A'
        }));
        toast('Check-in complete · boarding pass ready', 'ok');
        setTimeout(() => { location.href = 'enair-boarding-pass.html'; }, 500);
      });
    },

    pass() { fillPass(); },

    async change() {
      const list = $('[data-options]');
      if (!list) return;
      const all = await flights();
      const current = all[0];

      const days = ['THU', 'FRI', 'SAT', 'SUN', 'MON', 'TUE', 'WED'];
      const dates = ['26 Mar', '27 Mar', '28 Mar', '29 Mar', '30 Mar', '31 Mar', '01 Apr'];
      const strip = $('[data-dates]');
      if (strip) {
        strip.innerHTML = '';
        dates.forEach((date, index) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'date-card' + (index === 2 ? ' is-active' : '');
          button.innerHTML = '<em>' + days[index] + '</em><b>' + date + '</b><small>' + money(520000 + index * 23400) + '</small>';
          button.addEventListener('click', () => {
            $$('.date-card', strip).forEach(node => node.classList.remove('is-active'));
            button.classList.add('is-active');
            toast('Date changed to ' + date);
          });
          strip.appendChild(button);
        });
      }

      const render = items => {
        list.innerHTML = '';
        items.forEach((flight, index) => {
          const row = document.createElement('div');
          row.className = 'option' + (index === 0 ? ' is-active' : '');
          const delta = index === 0 ? '+₸0' : '+' + money(12000 * index);
          row.innerHTML = '<span class="radio"></span>' +
            '<span><b class="times">' + flight.departure_time.split(' ')[1] + ' — ' + flight.arrival_time.split(' ')[1] + '</b>' +
            '<span class="meta">' + flight.flight_number + ' · ' + flight.aircraft + ' · non-stop</span></span>' +
            '<span class="delta">' + delta + '</span>';
          row.addEventListener('click', () => {
            $$('.option', list).forEach(node => node.classList.remove('is-active'));
            row.classList.add('is-active');
          });
          list.appendChild(row);
        });
      };

      render([current].concat(all.slice(1, 3)));

      const confirm = $('#change-confirm');
      if (confirm) {
        confirm.addEventListener('click', () => {
          toast('Flight changed · new e-ticket sent', 'ok');
          setTimeout(() => { location.href = 'enair-manage-booking.html'; }, 600);
        });
      }
    },

    refund() {
      const confirm = $('#refund-confirm');
      if (!confirm) return;
      const total = Number(param('total', DEMO_BOOKING.total_price)) || DEMO_BOOKING.total_price;
      const fee = Math.round(total * 0.138);
      const refund = total - fee;
      const set = (selector, value) => { const el = $(selector); if (el) el.textContent = money(value); };
      set('[data-paid]', total);
      set('[data-fee]', fee);
      set('[data-refund]', refund);

      confirm.addEventListener('click', () => {
        $('#refund-form').classList.add('hidden');
        const done = $('#refund-done');
        done.classList.remove('hidden');
        $('[data-refund-done]').textContent = money(refund);
        toast('Booking cancelled · refund will arrive in 5–7 days', 'ok');
      });
    },

    baggage() {
      const state = { extra: 1, sports: 0, oversized: 0 };
      const prices = { extra: 22050, sports: 36750, oversized: 46550 };
      const update = () => {
        $$('[data-qty]').forEach(row => {
          const key = row.getAttribute('data-qty');
          $('[data-count]', row).textContent = state[key];
        });
        const total = state.extra * prices.extra + state.sports * prices.sports + state.oversized * prices.oversized;
        $$('[data-bag-total]').forEach(el => { el.textContent = money(total); });
        $$('[data-bag-extra]').forEach(el => { el.textContent = state.extra + ' × 23 kg'; });
        return total;
      };

      $$('[data-qty]').forEach(row => {
        const key = row.getAttribute('data-qty');
        $$('button', row).forEach(button => {
          button.addEventListener('click', () => {
            const action = button.getAttribute('data-step');
            state[key] = Math.max(0, Math.min(4, state[key] + (action === 'plus' ? 1 : -1)));
            update();
          });
        });
      });

      const add = $('#bag-add');
      if (add) {
        add.addEventListener('click', () => {
          const total = update();
          session.set('enair.bags', { count: state.extra + state.sports + state.oversized, total });
          toast('Baggage added · ' + money(total), 'ok');
        });
      }
      update();
    },

    rewards() {
      const balance = store.get('enair.miles', 48250);
      $$('[data-miles]').forEach(el => { el.textContent = balance.toLocaleString('en-US') + ' miles'; });

      $$('[data-filter]').forEach(button => {
        button.addEventListener('click', () => {
          $$('[data-filter]').forEach(node => node.classList.remove('is-active'));
          button.classList.add('is-active');
          const kind = button.getAttribute('data-filter');
          $$('[data-kind]').forEach(tile => {
            tile.classList.toggle('hidden', kind !== 'all' && tile.getAttribute('data-kind') !== kind);
          });
        });
      });
    },

    redeem() {
      const balance = store.get('enair.miles', 48250);
      const miles = Number(param('miles', 25000));
      const name = param('name', 'Business upgrade');
      $$('[data-reward-name]').forEach(el => { el.textContent = name; });
      $$('[data-reward-miles]').forEach(el => { el.textContent = miles.toLocaleString('en-US'); });
      $$('[data-balance]').forEach(el => { el.textContent = balance.toLocaleString('en-US'); });
      $$('[data-after]').forEach(el => { el.textContent = Math.max(0, balance - miles).toLocaleString('en-US') + ' miles'; });

      const confirm = $('#redeem-confirm');
      if (confirm) {
        confirm.addEventListener('click', () => {
          store.set('enair.miles', Math.max(0, balance - miles));
          toast('Redeemed · ' + miles.toLocaleString('en-US') + ' miles', 'ok');
          setTimeout(() => { location.href = 'enair-rewards.html'; }, 700);
        });
      }
    },

    settings() {
      const form = $('#settings-form');
      if (!form) return;
      const saved = store.get('enair.settings', { name: 'Alex', last: 'Morgan', email: 'alex.morgan@email.com', phone: '+1 212 555 0148' });
      Object.keys(saved).forEach(key => {
        const input = $('[name="' + key + '"]', form);
        if (input && typeof saved[key] === 'string') input.value = saved[key];
      });
      const toggles = store.get('enair.toggles', { updates: true, checkin: true, offers: false });
      Object.keys(toggles).forEach(key => {
        const input = $('[data-toggle="' + key + '"]', form);
        if (input) input.checked = Boolean(toggles[key]);
      });

      form.addEventListener('submit', event => {
        event.preventDefault();
        const data = {};
        $$('input[type="text"], input[type="email"], input[type="tel"]', form).forEach(input => { data[input.name] = input.value; });
        const flags = {};
        $$('[data-toggle]', form).forEach(input => { flags[input.getAttribute('data-toggle')] = input.checked; });
        store.set('enair.settings', data);
        store.set('enair.toggles', flags);
        toast('Settings saved', 'ok');
      });
    },

    payment() {
      const list = $('#cards');
      if (!list) return;
      const defaults = [
        { brand: 'Visa', number: '4242', exp: '09/29', def: true },
        { brand: 'Mastercard', number: '8801', exp: '02/27', def: false }
      ];
      let cards = store.get('enair.cards', defaults);

      const render = () => {
        list.innerHTML = '';
        cards.forEach((card, index) => {
          const row = document.createElement('div');
          row.className = 'saved-card' + (card.def ? ' is-default' : '');
          row.innerHTML = '<span class="card-brand ' + card.brand.toLowerCase() + '">' + card.brand.toUpperCase() + '</span>' +
            '<span class="grow"><b>•••• ' + card.number + '</b><small>Expires ' + card.exp + '</small></span>' +
            (card.def ? '<span class="badge badge-green">Default</span>' : '<button type="button" class="btn btn-ghost btn-sm" data-default="' + index + '">Make default</button>') +
            '<button type="button" class="btn btn-ghost btn-sm" data-remove="' + index + '">Remove</button>';
          list.appendChild(row);
        });
        $$('[data-default]', list).forEach(button => {
          button.addEventListener('click', () => {
            const index = Number(button.getAttribute('data-default'));
            cards = cards.map((card, i) => Object.assign({}, card, { def: i === index }));
            store.set('enair.cards', cards);
            render();
            toast('Default card updated', 'ok');
          });
        });
        $$('[data-remove]', list).forEach(button => {
          button.addEventListener('click', () => {
            cards.splice(Number(button.getAttribute('data-remove')), 1);
            if (cards.length && !cards.some(card => card.def)) cards[0].def = true;
            store.set('enair.cards', cards);
            render();
            toast('Card removed');
          });
        });
      };

      const addForm = $('#add-card-form');
      const openBtn = $('#add-card');
      if (openBtn) openBtn.addEventListener('click', () => addForm.classList.toggle('hidden'));

      if (addForm) {
        addForm.addEventListener('submit', event => {
          event.preventDefault();
          const value = ($('#card-number').value || '').replace(/\s+/g, '');
          const exp = ($('#card-exp').value || '').trim();
          const field = $('#f-card-number');
          const luhn = value => {
            let sum = 0;
            let double = false;
            for (let i = value.length - 1; i >= 0; i -= 1) {
              let digit = Number(value[i]);
              if (Number.isNaN(digit)) return false;
              if (double) { digit *= 2; if (digit > 9) digit -= 9; }
              sum += digit;
              double = !double;
            }
            return sum % 10 === 0;
          };
          const ok = value.length >= 13 && luhn(value) && /^\d{2}\/\d{2}$/.test(exp);
          field.classList.toggle('has-error', !ok);
          if (!ok) return;
          const brand = value.startsWith('4') ? 'Visa' : value.startsWith('5') ? 'Mastercard' : 'Amex';
          cards.push({ brand, number: value.slice(-4), exp, def: !cards.length });
          store.set('enair.cards', cards);
          addForm.reset();
          addForm.classList.add('hidden');
          render();
          toast('Card added', 'ok');
        });
      }
      render();
    },

    chat() {
      const body = $('#chat-body');
      const form = $('#chat-form');
      if (!body || !form) return;
      const input = $('#chat-input', form);
      const push = (text, mine) => {
        const bubble = document.createElement('div');
        bubble.className = 'bubble ' + (mine ? 'me' : 'bot');
        bubble.textContent = text;
        body.appendChild(bubble);
        body.scrollTop = body.scrollHeight;
        return bubble;
      };

      const reply = async message => {
        try {
          const data = await api('/api/assistant', { method: 'POST', body: JSON.stringify({ message }) });
          if (data && data.reply) return data.reply;
        } catch (error) { /* fallback */ }
        if (/baggage|bag/i.test(message)) return 'Your fare includes 2 checked bags of 23 kg. Extra baggage can be added from Manage booking.';
        if (/seat|upgrade/i.test(message)) return 'I can hold an extra-legroom seat for ₸49,000 or an upgrade for 25,000 miles. Which one works better?';
        if (/date|change|move/i.test(message)) return '30 March has seats in Economy Flex. The fare difference is ₸12,400 — shall I hold it?';
        return 'I can help with bookings, seats, baggage and miles. Tell me what you would like to change.';
      };

      form.addEventListener('submit', async event => {
        event.preventDefault();
        const message = (input.value || '').trim();
        if (!message) return;
        input.value = '';
        push(message, true);
        const typing = push('…', false);
        const answer = await reply(message);
        typing.textContent = answer;
        body.scrollTop = body.scrollHeight;
      });

      $$('[data-quick]').forEach(button => {
        button.addEventListener('click', () => {
          input.value = button.getAttribute('data-quick');
          form.dispatchEvent(new Event('submit'));
        });
      });
    },

    async status() {
      const form = $('#status-form');
      if (!form) return;
      const render = data => {
        $$('[data-status]').forEach(el => {
          const key = el.getAttribute('data-status');
          if (key === 'route') el.textContent = (data.departure_city || '') + ' → ' + (data.arrival_city || '');
          else if (data[key] !== undefined) el.textContent = data[key];
        });
        $('#status-card').classList.remove('hidden');
      };

      form.addEventListener('submit', async event => {
        event.preventDefault();
        const number = ($('#flight-number').value || '').trim().toLowerCase();
        const all = await flights();
        const found = all.find(flight => flight.flight_number.toLowerCase() === number ||
          flight.flight_number.toLowerCase().replace('en-', '') === number.replace('en-', '')) || all[0];
        render(found);
        toast('Status updated · ' + found.flight_number, 'ok');
      });

      const all = await flights();
      if ($('#status-card') && !$('#status-card').classList.contains('hidden')) render(all[0]);
    },

    tokyo() {
      $$('[data-tab]').forEach(button => {
        button.addEventListener('click', () => {
          $$('[data-tab]').forEach(node => node.classList.remove('is-active'));
          button.classList.add('is-active');
          const name = button.getAttribute('data-tab');
          $$('[data-panel]').forEach(panel => {
            panel.classList.toggle('hidden', panel.getAttribute('data-panel') !== name);
          });
        });
      });
    },

    mobilePay() {
      const form = $('#pay-form');
      if (!form) return;
      form.addEventListener('submit', event => {
        event.preventDefault();
        const number = ($('#card-number').value || '').replace(/\s+/g, '');
        const field = $('#f-card-number');
        const ok = number.length >= 13;
        field.classList.toggle('has-error', !ok);
        if (!ok) return;
        toast('Payment confirmed · e-ticket sent', 'ok');
        setTimeout(() => { location.href = 'booking-confirmation.html'; }, 700);
      });
    },

    async mobileCheckin() {
      await pages.checkin();
    },

    mobilePass() { fillPass(); }
  };

  document.addEventListener('click', event => {
    const trigger = event.target.closest('[data-toast]');
    if (!trigger) return;
    event.preventDefault();
    toast(trigger.getAttribute('data-toast'), 'ok');
  });

  document.addEventListener('DOMContentLoaded', () => {
    const page = document.body.getAttribute('data-page');
    if (page && pages[page]) {
      Promise.resolve(pages[page]()).catch(error => {
        console.error(error);
        toast('Something went wrong, showing demo data', 'err');
      });
    }
    if ($('[data-qr]') || $('[data-barcode]')) fillPass();
  });
})();
