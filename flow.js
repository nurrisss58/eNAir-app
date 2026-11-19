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

  const DEMO_USER = {
    email: 'demo@enair.com',
    first_name: 'Alex',
    last_name: 'Morgan',
    name: 'Alex Morgan',
    phone: '+1 212 555 0148',
    membership_number: 'EN-4829-13',
    tier: 'Gold',
    miles: 48250,
    language: 'en',
    member_since: '12.03.2024',
    last_login: '20.11.2026 00:10',
    notifications: { updates: true, checkin: true, offers: false }
  };

  const DEMO_BOOKINGS = [
    { reference: 'EN482913', flight_number: 'eN-102', departure_city: 'New York', arrival_city: 'London',
      departure_time: '28.03.2026 08:15', cabin: 'Economy Flex', status: 'confirmed' },
    { reference: 'EN771204', flight_number: 'eN-88', departure_city: 'London', arrival_city: 'Tokyo',
      departure_time: '31.03.2026 09:30', cabin: 'Business', status: 'confirmed' }
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

      form.addEventListener('submit', async event => {
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

        const names = $$('[data-passenger-name]').map(el => el.textContent.trim());
        const passports = $$('.field[data-validate="passport"] input, #passport').map(input => input.value.trim());
        const dobs = $$('.field[data-validate="date"] input, #dob').map(input => input.value.trim());
        const seats = ['12A', '12B'];
        const people = (names.length ? names : ['Alex Morgan']).map((name, index) => ({
          name,
          dob: dobs[index] || '',
          document: passports[index] || '',
          seat: seats[index] || '12A'
        }));

        try {
          await fetch('/api/bookings/' + encodeURIComponent(ref) + '/checkin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ passengers: people })
          });
        } catch (error) { /* the demo store still lets the flow continue */ }

        session.set('enair.pass', Object.assign({}, passData(), {
          reference: ref,
          passenger: people[0].name + (people[1] ? ' + ' + people[1].name : ''),
          seat: people[0].seat
        }));
        toast('Check-in complete · boarding pass ready', 'ok');
        setTimeout(() => { location.href = 'enair-boarding-pass.html'; }, 600);
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

    async baggage() {
      const ref = param('ref', DEMO_BOOKING.reference);
      const state = { extra_bag: 0, sports: 0, oversized: 0 };
      const prices = { extra_bag: 22050, sports: 36750, oversized: 46550 };
      const demoBanner = $('#baggage-demo');

      const update = () => {
        $$('[data-qty]').forEach(row => {
          const key = row.getAttribute('data-qty');
          $('[data-count]', row).textContent = state[key];
        });
        const total = state.extra_bag * prices.extra_bag + state.sports * prices.sports + state.oversized * prices.oversized;
        $$('[data-bag-total]').forEach(el => { el.textContent = money(total); });
        $$('[data-bag-extra]').forEach(el => { el.textContent = state.extra_bag + ' × 23 kg'; });
        return total;
      };

      try {
        const response = await fetch('/api/bookings/' + encodeURIComponent(ref) + '/services', { credentials: 'same-origin' });
        const data = await response.json();
        (data.items || []).forEach(item => { state[item.service] = item.quantity; });
        if (demoBanner) demoBanner.classList.toggle('hidden', !data.demo);
      } catch (error) {
        if (demoBanner) demoBanner.classList.remove('hidden');
      }

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
        add.addEventListener('click', async () => {
          const items = Object.keys(state)
            .filter(key => state[key] > 0)
            .map(key => ({ service: key, quantity: state[key] }));
          try {
            const response = await fetch('/api/bookings/' + encodeURIComponent(ref) + '/services', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'same-origin',
              body: JSON.stringify({ items })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Save failed');
            (data.items || []).forEach(item => { state[item.service] = item.quantity; });
            update();
            toast('Baggage saved · ' + money(data.total || update()), 'ok');
            if (demoBanner) demoBanner.classList.toggle('hidden', !data.demo);
          } catch (error) {
            session.set('enair.bags', { items, total: update() });
            toast('Saved in the browser only — database unavailable', 'err');
          }
        });
      }
      update();
    },

    async rewards() {
      const display = balance => {
        $$('[data-miles]').forEach(el => { el.textContent = Number(balance || 0).toLocaleString('en-US') + ' miles'; });
      };
      try {
        const response = await fetch('/api/me/miles', { credentials: 'same-origin' });
        const data = await response.json();
        display(data.balance);
      } catch (error) {
        display(store.get('enair.miles', 48250));
      }

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

    async redeem() {
      const miles = Number(param('miles', 25000));
      const name = param('name', 'Business upgrade');
      $$('[data-reward-name]').forEach(el => { el.textContent = name; });
      $$('[data-reward-miles]').forEach(el => { el.textContent = miles.toLocaleString('en-US'); });

      let balance = Number(store.get('enair.miles', 48250));
      try {
        const response = await fetch('/api/me/miles', { credentials: 'same-origin' });
        const data = await response.json();
        balance = Number(data.balance || 0);
      } catch (error) { /* keep the local balance */ }

      $$('[data-balance]').forEach(el => { el.textContent = balance.toLocaleString('en-US'); });
      $$('[data-after]').forEach(el => {
        el.textContent = Math.max(0, balance - miles).toLocaleString('en-US') + ' miles';
      });

      const confirm = $('#redeem-confirm');
      if (!confirm) return;
      confirm.addEventListener('click', async () => {
        confirm.disabled = true;
        try {
          const response = await fetch('/api/me/miles/redeem', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ miles, reward: name })
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Redemption failed');
          store.set('enair.miles', data.balance);
          toast('Redeemed · ' + miles.toLocaleString('en-US') + ' miles', 'ok');
          setTimeout(() => { location.href = 'enair-rewards.html'; }, 700);
        } catch (error) {
          store.set('enair.miles', Math.max(0, balance - miles));
          toast(error.message || 'Database unavailable — redeemed locally', 'err');
          setTimeout(() => { location.href = 'enair-rewards.html'; }, 900);
        } finally {
          confirm.disabled = false;
        }
      });
    },

    async account() {
      const banner = $('#account-demo');
      const setText = (key, value) => {
        $$('[data-account="' + key + '"]').forEach(el => { el.textContent = value; });
      };
      const languageName = code => ({ en: 'English', ru: 'Русский', kk: 'Қазақша' }[code] || 'English');

      const applyProfile = (user, demo) => {
        setText('first_name', user.first_name || 'there');
        setText('name', user.name || ((user.first_name || '') + ' ' + (user.last_name || '')).trim());
        setText('tier', user.tier || 'Gold');
        setText('member_since', user.member_since || '—');
        setText('membership_number', user.membership_number || '—');
        setText('miles', Number(user.miles || 0).toLocaleString('en-US'));
        setText('language', languageName(user.language));
        setText('email', user.email || '—');
        setText('phone', user.phone || '—');
        setText('last_login', user.last_login || '—');
        const notifications = user.notifications || {};
        setText('notify_updates', notifications.updates ? 'On' : 'Off');
        setText('notify_checkin', notifications.checkin ? 'On' : 'Off');
        setText('notify_offers', notifications.offers ? 'On' : 'Off');
        if (banner) banner.classList.toggle('hidden', !demo);
      };

      const renderBookings = list => {
        const holder = $('#account-bookings');
        const empty = $('#account-bookings-empty');
        if (!holder) return;
        holder.innerHTML = '';
        if (!list.length) {
          if (empty) empty.classList.remove('hidden');
          return;
        }
        if (empty) empty.classList.add('hidden');
        list.slice(0, 2).forEach(booking => {
          const row = document.createElement('a');
          row.className = 'option is-static';
          row.href = 'enair-manage-booking.html?ref=' + encodeURIComponent(booking.reference || '');
          row.innerHTML = '<span class="radio"></span>' +
            '<span><b class="times">' + (booking.departure_city || '') + ' → ' + (booking.arrival_city || '') + '</b>' +
            '<span class="meta">' + (booking.flight_number || '') + ' · ' + (booking.departure_time || '') +
            ' · ' + (booking.reference || '') + '</span></span>' +
            '<span class="delta">' + (booking.cabin || '') + '</span>';
          holder.appendChild(row);
        });
      };

      try {
        const response = await fetch('/api/me', { credentials: 'same-origin' });
        const data = await response.json();
        if (!data.authenticated) {
          location.href = 'enair-signin.html';
          return;
        }
        applyProfile(data.user, data.demo);
        const bookingsResponse = await fetch('/api/me/bookings', { credentials: 'same-origin' });
        const bookingsData = await bookingsResponse.json();
        renderBookings(bookingsData.bookings || []);
      } catch (error) {
        applyProfile(DEMO_USER, true);
        renderBookings(DEMO_BOOKINGS);
      }

      const signout = $('#signout-link');
      if (signout) {
        signout.addEventListener('click', async event => {
          event.preventDefault();
          try {
            await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
          } catch (error) { /* ignore */ }
          location.href = 'enair-signin.html';
        });
      }
    },

    async settings() {
      const form = $('#settings-form');
      if (!form) return;

      const banner = $('#settings-demo');
      const statusLine = $('#settings-status');
      const fields = {
        first_name: $('#first_name'),
        last_name: $('#last_name'),
        phone: $('#phone'),
        language: $('#language'),
        email: $('#email')
      };
      const toggles = {
        updates: $('[data-toggle="updates"]'),
        checkin: $('[data-toggle="checkin"]'),
        offers: $('[data-toggle="offers"]')
      };

      const fill = (user, demo) => {
        fields.first_name.value = user.first_name || '';
        fields.last_name.value = user.last_name || '';
        fields.phone.value = user.phone || '';
        fields.language.value = user.language || 'en';
        fields.email.value = user.email || '';
        const notifications = user.notifications || {};
        if (toggles.updates) toggles.updates.checked = Boolean(notifications.updates);
        if (toggles.checkin) toggles.checkin.checked = Boolean(notifications.checkin);
        if (toggles.offers) toggles.offers.checked = Boolean(notifications.offers);
        $$('[data-account="name"]').forEach(el => {
          el.textContent = user.name || ((user.first_name || '') + ' ' + (user.last_name || '')).trim();
        });
        $$('[data-account="membership_number"]').forEach(el => { el.textContent = user.membership_number || '—'; });
        $$('[data-account="tier"]').forEach(el => { el.textContent = user.tier || 'Gold'; });
        if (statusLine) {
          statusLine.textContent = demo
            ? 'Demo data — the database is not connected on this machine.'
            : 'Profile loaded from the database.';
        }
        if (banner) banner.classList.toggle('hidden', !demo);
      };

      try {
        const response = await fetch('/api/me', { credentials: 'same-origin' });
        const data = await response.json();
        fill(data.authenticated ? data.user : DEMO_USER, !data.authenticated || data.demo);
      } catch (error) {
        fill(DEMO_USER, true);
      }

      form.addEventListener('submit', async event => {
        event.preventDefault();
        const payload = {
          first_name: fields.first_name.value.trim(),
          last_name: fields.last_name.value.trim(),
          phone: fields.phone.value.trim(),
          language: fields.language.value,
          updates: toggles.updates ? toggles.updates.checked : true,
          checkin: toggles.checkin ? toggles.checkin.checked : true,
          offers: toggles.offers ? toggles.offers.checked : false
        };
        const button = $('#settings-save');
        if (button) button.disabled = true;
        try {
          const response = await fetch('/api/me', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(payload)
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Save failed');
          fill(data.user, data.demo);
          toast(data.demo ? 'Saved in demo mode' : 'Profile saved to the database', 'ok');
        } catch (error) {
          store.set('enair.settings', payload);
          toast('Database unavailable — saved in the browser', 'err');
        } finally {
          if (button) button.disabled = false;
        }
      });
    },

    async payment() {
      const list = $('#cards');
      if (!list) return;
      const form = $('#add-card-form');
      const openBtn = $('#add-card');
      const demoBanner = $('#cards-demo');

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

      const render = cards => {
        list.innerHTML = '';
        if (!cards.length) {
          list.innerHTML = '<p class="muted" style="font-size:14px">No saved cards yet.</p>';
          return;
        }
        cards.forEach(card => {
          const row = document.createElement('div');
          row.className = 'saved-card' + (card.default ? ' is-default' : '');
          row.innerHTML = '<span class="card-brand ' + String(card.brand || 'card').toLowerCase() + '">' +
            String(card.brand || 'CARD').toUpperCase() + '</span>' +
            '<span class="grow"><b>•••• ' + card.last4 + '</b><small>Expires ' + card.exp + '</small></span>' +
            (card.default
              ? '<span class="badge badge-green">Default</span>'
              : '<button type="button" class="btn btn-ghost btn-sm" data-default="' + card.id + '">Make default</button>') +
            '<button type="button" class="btn btn-ghost btn-sm" data-remove="' + card.id + '">Remove</button>';
          list.appendChild(row);
        });
        $$('[data-default]', list).forEach(button => {
          button.addEventListener('click', async () => {
            await fetch('/api/me/cards/' + button.getAttribute('data-default') + '/default', {
              method: 'POST', credentials: 'same-origin'
            });
            await load();
          });
        });
        $$('[data-remove]', list).forEach(button => {
          button.addEventListener('click', async () => {
            await fetch('/api/me/cards/' + button.getAttribute('data-remove'), {
              method: 'DELETE', credentials: 'same-origin'
            });
            await load();
          });
        });
      };

      const load = async () => {
        try {
          const response = await fetch('/api/me/cards', { credentials: 'same-origin' });
          const data = await response.json();
          if (!data.authenticated) throw new Error('signed out');
          if (demoBanner) demoBanner.classList.toggle('hidden', !data.demo);
          render(data.cards || []);
        } catch (error) {
          if (demoBanner) demoBanner.classList.remove('hidden');
          render(store.get('enair.cards', []));
        }
      };

      if (openBtn && form) openBtn.addEventListener('click', () => form.classList.toggle('hidden'));

      if (form) {
        form.addEventListener('submit', async event => {
          event.preventDefault();
          const number = ($('#card-number').value || '').replace(/\s+/g, '');
          const match = /^(\d{2})\s*\/\s*(\d{2})$/.exec(($('#card-exp').value || '').trim());
          const field = $('#f-card-number');
          const ok = number.length >= 13 && luhn(number) && Boolean(match);
          field.classList.toggle('has-error', !ok);
          if (!ok) return;

          const brand = number.startsWith('4') ? 'Visa' : number.startsWith('5') ? 'Mastercard' : 'Amex';
          const payload = {
            brand,
            last4: number.slice(-4),
            exp_month: Number(match[1]),
            exp_year: 2000 + Number(match[2]),
            holder: 'Alex Morgan'
          };
          try {
            const response = await fetch('/api/me/cards', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'same-origin',
              body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Save failed');
            form.reset();
            form.classList.add('hidden');
            await load();
            toast('Card added', 'ok');
          } catch (error) {
            const cards = store.get('enair.cards', []);
            cards.push({
              id: Date.now(),
              brand,
              last4: number.slice(-4),
              exp: match[1] + '/' + match[2],
              holder: '',
              default: !cards.length
            });
            store.set('enair.cards', cards);
            render(cards);
            toast('Saved in the browser only — database unavailable', 'err');
          }
        });
      }

      await load();
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
      window.__statusStart = true;
      const form = $('#status-form');
      if (!form) { window.__statusNoForm = true; return; }

      const banner = $('#status-demo');
      const historyBox = $('#status-history');
      const historyEmpty = $('#status-history-empty');
      const numberInput = $('#flight-number');

      const ROUTES = {
        'EN-88': ['London', 'Tokyo'],
        'EN-101': ['New York', 'London'],
        'EN-102': ['New York', 'London'],
        'EN-204': ['New York', 'Paris'],
        'EN-318': ['London', 'Dubai']
      };

      const setText = (key, value) => {
        $$('[data-status="' + key + '"]').forEach(el => { el.textContent = value; });
      };

      const badge = value => {
        const node = $('.badge[data-status="status_label"]');
        if (!node) return;
        node.textContent = value;
        node.className = 'badge ' + (/delay|cancel|divert/i.test(value) ? 'badge-amber'
          : /board|depart/i.test(value) ? 'badge-violet'
          : /land/i.test(value) ? 'badge-slate' : 'badge-green');
      };

      const renderHistory = list => {
        if (!historyBox) return;
        historyBox.innerHTML = '';
        if (!list.length) {
          if (historyEmpty) historyEmpty.classList.remove('hidden');
          return;
        }
        if (historyEmpty) historyEmpty.classList.add('hidden');
        list.forEach(event => {
          const row = document.createElement('div');
          row.className = 'option is-static';
          row.innerHTML = '<span class="radio"></span>' +
            '<span><b class="times">' + (event.status_label || event.status) + '</b>' +
            '<span class="meta">' + (event.reason || 'No reason given') + ' · ' + (event.created_at || '') + '</span></span>' +
            '<span class="delta">' + (event.delay_minutes ? '+' + event.delay_minutes + ' min' : '—') + '</span>';
          historyBox.appendChild(row);
        });
      };

      const render = data => {
        const route = ROUTES[data.flight_number] || ['Departure', 'Arrival'];
        setText('flight_number', data.flight_number);
        setText('route', route[0] + ' → ' + route[1]);
        setText('from', route[0]);
        setText('to', route[1]);
        const label = data.status_label || 'On time';
        setText('status_label', label);
        badge(label);
        setText('delay', (data.delay_minutes || 0) + ' min');
        setText('gate', (data.gate || '—') + (data.terminal ? ' · T' + data.terminal : ''));
        setText('reason', data.reason || 'On schedule');
        setText('updated_at', data.updated_at || '—');
        renderHistory(data.history || []);
        if (banner) banner.classList.toggle('hidden', !data.demo);
        const card = $('#status-card');
        if (card) card.classList.remove('hidden');
      };

      const load = async number => {
        const response = await fetch('/api/flights/' + encodeURIComponent(number) + '/status', { credentials: 'same-origin' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Lookup failed');
        render(data);
        return data;
      };

      try {
        await load((numberInput.value || 'EN-101').trim());
      } catch (error) {
        toast('Status service is unavailable', 'err');
      }

      form.addEventListener('submit', async event => {
        event.preventDefault();
        try {
          await load((numberInput.value || 'EN-101').trim());
          toast('Status updated', 'ok');
        } catch (error) {
          toast(error.message, 'err');
        }
      });

      const updateForm = $('#status-update-form');
      window.__statusWired = Boolean(updateForm);
      if (updateForm) {
        updateForm.dataset.wired = '1';
        updateForm.addEventListener('submit', async event => {
          event.preventDefault();
          const number = (numberInput.value || 'EN-101').trim();
          const payload = {
            status: $('#new-status').value,
            delay_minutes: Number($('#new-delay').value || 0),
            reason: $('#new-reason').value.trim(),
            gate: $('#new-gate').value.trim(),
            terminal: $('#new-terminal').value.trim()
          };
          const save = $('#status-save');
          if (save) save.disabled = true;
          try {
            const response = await fetch('/api/flights/' + encodeURIComponent(number) + '/status', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'same-origin',
              body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Save failed');
            await load(number);
            toast(data.demo ? 'Saved in the demo store' : 'Saved to the database', 'ok');
            const note = $('#status-save-note');
            if (note) {
              note.textContent = data.demo
                ? 'Demo mode: stored in memory because PostgreSQL is unavailable locally.'
                : 'Saved to flight_events and the flight row.';
            }
          } catch (error) {
            toast(error.message, 'err');
          } finally {
            if (save) save.disabled = false;
          }
        });
      }
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
