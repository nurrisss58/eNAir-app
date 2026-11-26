/* eNAir — ticket-pdf.js
   Self-contained boarding-pass / e-ticket PDF generator. No libraries, no CDN,
   no server round-trip: it reads the flight data already present on the page
   (sessionStorage `enair.pass`, localStorage `enairState` receipt, the DOM
   `[data-pass]` values) and renders a detailed, on-brand A4 PDF, then triggers
   a real file download.

   Exposed as:
     - window.enairTicketPDF.download(kind)   in the browser
     - module.exports.buildTicketPdf(data, kind)  under Node (for testing)

   `kind` is "boarding-pass" or "e-ticket" and only changes the header title /
   status pill. The layout and data stay the same. */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.enairTicketPDF = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var W = 595.28;           // A4 portrait, points
  var H = 841.89;

  var BRAND = {
    ink:    [15, 23, 42],
    ink2:   [51, 65, 85],
    muted:  [100, 116, 139],
    line:   [226, 232, 240],
    soft:   [241, 245, 249],
    bg:     [248, 250, 252],
    cyan:   [6, 182, 212],
    violet: [139, 92, 246],
    green:  [16, 185, 129],
    red:    [239, 68, 68],
    white:  [255, 255, 255]
  };

  /* ---------------- text & color helpers ---------------- */

  var DEACCENT = {
    'À': 'A', 'Á': 'A', 'Â': 'A', 'Ã': 'A', 'Ä': 'A', 'Å': 'A', 'Æ': 'AE',
    'Ç': 'C', 'È': 'E', 'É': 'E', 'Ê': 'E', 'Ë': 'E', 'Ì': 'I', 'Í': 'I',
    'Î': 'I', 'Ï': 'I', 'Ð': 'D', 'Ñ': 'N', 'Ò': 'O', 'Ó': 'O', 'Ô': 'O',
    'Õ': 'O', 'Ö': 'O', 'Ø': 'O', 'Ù': 'U', 'Ú': 'U', 'Û': 'U', 'Ü': 'U',
    'Ý': 'Y', 'Þ': 'TH', 'ß': 'ss',
    'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a', 'å': 'a', 'æ': 'ae',
    'ç': 'c', 'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e', 'ì': 'i', 'í': 'i',
    'î': 'i', 'ï': 'i', 'ð': 'd', 'ñ': 'n', 'ò': 'o', 'ó': 'o', 'ô': 'o',
    'õ': 'o', 'ö': 'o', 'ø': 'o', 'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u',
    'ý': 'y', 'þ': 'th', 'ÿ': 'y'
  };

  // The PDF uses the built-in Helvetica with WinAnsiEncoding, so everything we
  // draw must be expressible as single bytes in that encoding. Restrict to
  // ASCII plus the two punctuation marks that are identical in Latin-1 and
  // WinAnsi (· and ×); everything else is transliterated.
  function sanitize(str) {
    if (str === null || str === undefined) return '';
    var s = String(str);
    var out = '';
    for (var i = 0; i < s.length; i += 1) {
      var c = s.charAt(i);
      var code = s.charCodeAt(i);
      if (code === 0x20B8) { out += 'KZT'; continue; }          // ₸
      if (code === 0xB7 || code === 0xD7) { out += c; continue; } // · ×
      if (code >= 0x20 && code <= 0x7E) { out += c; continue; }   // ASCII
      if (DEACCENT[c]) { out += DEACCENT[c]; continue; }
      if (code === 0x2014 || code === 0x2013 || code === 0x2212 ||
          code === 0x2192 || code === 0x2190 || code === 0x2194) { out += '-'; continue; }
      if (code === 0x2018 || code === 0x2019 || code === 0x201A) { out += "'"; continue; }
      if (code === 0x201C || code === 0x201D || code === 0x201E) { out += '"'; continue; }
      if (code === 0x2026) { out += '...'; continue; }
      if (code === 0x2022 || code === 0x25CF || code === 0x25AA) { out += '-'; continue; }
      out += ' ';                                                 // drop unknown
    }
    return out;
  }

  function esc(str) {
    var s = sanitize(str);
    return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }

  function rgb(c) {
    return (c[0] / 255).toFixed(3) + ' ' + (c[1] / 255).toFixed(3) + ' ' + (c[2] / 255).toFixed(3);
  }

  function lerpColor(a, b, t) {
    return [
      Math.round(a[0] + (b[0] - a[0]) * t),
      Math.round(a[1] + (b[1] - a[1]) * t),
      Math.round(a[2] + (b[2] - a[2]) * t)
    ];
  }

  // Approximate text width in points for Helvetica / Helvetica-Bold.
  function tw(str, size, bold) {
    var len = sanitize(str).length;
    return len * size * (bold ? 0.56 : 0.52);
  }

  function fitSize(str, size, maxW) {
    var s = sanitize(str);
    var w = s.length * size * 0.55;
    if (w <= maxW) return size;
    return Math.max(7, size * maxW / w);
  }

  /* ---------------- low-level PDF drawing ---------------- */

  function rectFill(cmds, x, y, w, h, color) {
    cmds.push(rgb(color) + ' rg ' + x.toFixed(2) + ' ' + y.toFixed(2) + ' ' +
      w.toFixed(2) + ' ' + h.toFixed(2) + ' re f\n');
  }

  function roundRectPath(x, y, w, h, r) {
    var k = r * 0.5523;
    var p = [];
    p.push((x + r).toFixed(2) + ' ' + y.toFixed(2) + ' m');
    p.push((x + w - r).toFixed(2) + ' ' + y.toFixed(2) + ' l');
    p.push((x + w - r + k).toFixed(2) + ' ' + y.toFixed(2) + ' ' +
           (x + w).toFixed(2) + ' ' + (y + r - k).toFixed(2) + ' ' +
           (x + w).toFixed(2) + ' ' + (y + r).toFixed(2) + ' c');
    p.push((x + w).toFixed(2) + ' ' + (y + h - r).toFixed(2) + ' l');
    p.push((x + w).toFixed(2) + ' ' + (y + h - r + k).toFixed(2) + ' ' +
           (x + w - r + k).toFixed(2) + ' ' + (y + h).toFixed(2) + ' ' +
           (x + w - r).toFixed(2) + ' ' + (y + h).toFixed(2) + ' c');
    p.push((x + r).toFixed(2) + ' ' + (y + h).toFixed(2) + ' l');
    p.push((x + r - k).toFixed(2) + ' ' + (y + h).toFixed(2) + ' ' +
           x.toFixed(2) + ' ' + (y + h - r + k).toFixed(2) + ' ' +
           x.toFixed(2) + ' ' + (y + h - r).toFixed(2) + ' c');
    p.push(x.toFixed(2) + ' ' + (y + r).toFixed(2) + ' l');
    p.push(x.toFixed(2) + ' ' + (y + r - k).toFixed(2) + ' ' +
           (x + r - k).toFixed(2) + ' ' + y.toFixed(2) + ' ' +
           (x + r).toFixed(2) + ' ' + y.toFixed(2) + ' c');
    p.push('h');
    return p;
  }

  function roundRectFill(cmds, x, y, w, h, r, color) {
    cmds.push(rgb(color) + ' rg ' + roundRectPath(x, y, w, h, r).join(' ') + ' f\n');
  }

  function roundRectStroke(cmds, x, y, w, h, r, color, width) {
    cmds.push(rgb(color) + ' RG ' + (width || 1).toFixed(2) + ' w ' +
      roundRectPath(x, y, w, h, r).join(' ') + ' S\n');
  }

  function line(cmds, x1, y1, x2, y2, color, width) {
    cmds.push(rgb(color) + ' RG ' + (width || 1).toFixed(2) + ' w ' +
      x1.toFixed(2) + ' ' + y1.toFixed(2) + ' m ' +
      x2.toFixed(2) + ' ' + y2.toFixed(2) + ' l S\n');
  }

  function dashLine(cmds, x1, y1, x2, y2, color, width, dash) {
    var d = dash || 4;
    cmds.push('[' + d.toFixed(1) + ' ' + d.toFixed(1) + '] 0 d ' +
      rgb(color) + ' RG ' + (width || 1).toFixed(2) + ' w ' +
      x1.toFixed(2) + ' ' + y1.toFixed(2) + ' m ' +
      x2.toFixed(2) + ' ' + y2.toFixed(2) + ' l S [] 0 d\n');
  }

  function text(cmds, x, y, str, size, font, color, align, maxW) {
    var s = esc(str);
    var sz = maxW ? fitSize(s, size, maxW) : size;
    var tx = x;
    if (align === 'center') tx = x - tw(s, sz, font === 'F2') / 2;
    else if (align === 'right') tx = x - tw(s, sz, font === 'F2');
    cmds.push('BT /' + font + ' ' + sz.toFixed(1) + ' Tf ' + rgb(color) + ' rg ' +
      tx.toFixed(2) + ' ' + y.toFixed(2) + ' Td (' + s + ') Tj ET\n');
  }

  function arrow(cmds, x1, x2, y, color, width) {
    line(cmds, x1, y, x2, y, color, width);
    var w = (width || 1) * 2.6 + 1.2;
    line(cmds, x2, y, x2 - w, y + w * 0.55, color, width);
    line(cmds, x2, y, x2 - w, y - w * 0.55, color, width);
  }

  /* ---------------- deterministic QR & barcode ---------------- */

  function hashStr(str) {
    var h = 2166136261;
    var s = String(str || '');
    for (var i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) || 1;
  }

  function lcg(seed) {
    var s = seed;
    return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  }

  function qrMatrix(seedStr) {
    var N = 21;
    var grid = [];
    var r, c;
    for (r = 0; r < N; r += 1) {
      grid.push([]);
      for (c = 0; c < N; c += 1) grid[r].push(false);
    }
    function setFinder(r0, c0) {
      for (var rr = 0; rr < 7; rr += 1) {
        for (var cc = 0; cc < 7; cc += 1) {
          var onBorder = rr === 0 || rr === 6 || cc === 0 || cc === 6;
          var inCenter = rr >= 2 && rr <= 4 && cc >= 2 && cc <= 4;
          grid[r0 + rr][c0 + cc] = onBorder || inCenter;
        }
      }
    }
    setFinder(0, 0);
    setFinder(0, N - 7);
    setFinder(N - 7, 0);
    for (var i = 8; i < 13; i += 1) {
      grid[6][i] = i % 2 === 0;
      grid[i][6] = i % 2 === 0;
    }
    var rand = lcg(hashStr(seedStr));
    for (r = 0; r < N; r += 1) {
      for (c = 0; c < N; c += 1) {
        if ((r < 8 && c < 8) || (r < 8 && c >= N - 8) || (r >= N - 8 && c < 8)) continue;
        if (r === 6 || c === 6) continue;
        grid[r][c] = rand() > 0.5;
      }
    }
    return grid;
  }

  function barcodeBars(seedStr) {
    var rand = lcg(hashStr(seedStr));
    var bars = [];
    for (var i = 0; i < 26; i += 1) bars.push(rand() > 0.55 ? 3.5 : 2);
    return bars;
  }

  /* ---------------- data collection ---------------- */

  function readJson(key, store) {
    try { return JSON.parse(store.getItem(key) || 'null') || {}; }
    catch (e) { return {}; }
  }

  function joinList(v, sep) {
    if (Array.isArray(v)) return v.filter(Boolean).map(String).join(sep);
    return v || '';
  }

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Schedule knowledge used to enrich a ticket when the page only knows the
  // flight number (e.g. the demo boarding pass): keeps the PDF consistent with
  // the flight data shown across the site.
  var FLIGHT_INFO = {
    'EN-102': { from: 'JFK', to: 'LHR', cityFrom: 'New York', cityTo: 'London', date: '28 Mar 2026', departure: '08:15', arrival: '20:30', aircraft: 'Airbus A350-H2', duration: '7h 15m' },
    'EN-204': { from: 'JFK', to: 'CDG', cityFrom: 'New York', cityTo: 'Paris', date: '29 Mar 2026', departure: '11:40', arrival: '23:55', aircraft: 'Boeing 787-9', duration: '12h 15m' },
    'EN-318': { from: 'LHR', to: 'DXB', cityFrom: 'London', cityTo: 'Dubai', date: '30 Mar 2026', departure: '17:05', arrival: '05:20', aircraft: 'Airbus A380-800', duration: '12h 15m' },
    'EN-88': { from: 'LHR', to: 'NRT', cityFrom: 'London', cityTo: 'Tokyo', date: '31 Mar 2026', departure: '09:30', arrival: '07:10', aircraft: 'Airbus A350-H2', duration: '21h 40m' },
    'EN-101': { from: 'JFK', to: 'LHR', cityFrom: 'New York', cityTo: 'London', date: '27 Mar 2026', departure: '22:40', arrival: '10:55', aircraft: 'Airbus A350-H2', duration: '7h 15m' }
  };

  // Accepts "28.03.2026 08:15" or "28 Mar 2026" (date) / "08:15 AM" (time).
  function parseDateTime(v, part) {
    if (!v) return '';
    var s = String(v).trim();
    var m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})\s+(\d{1,2}):(\d{2})$/);
    if (m) {
      var date = Number(m[1]) + ' ' + (MONTHS[Number(m[2]) - 1] || m[2]) + ' ' + m[3];
      var time = m[4] + ':' + m[5];
      return part === 'date' ? date : time;
    }
    var iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (iso && part === 'date') {
      return Number(iso[3]) + ' ' + (MONTHS[Number(iso[2]) - 1] || iso[2]) + ' ' + iso[1];
    }
    var tm = s.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (tm && part === 'time') {
      var h = Number(tm[1]) % 12;
      if (/pm/i.test(tm[3] || '')) h += 12;
      return String(h).padStart(2, '0') + ':' + tm[2];
    }
    if (part === 'date') {
      var dm = s.match(/(\d{1,2})\s+[A-Za-z]{3}\s+\d{4}/);
      if (dm) return s;
      return s;
    }
    return s;
  }

  function minusMinutes(time, mins) {
    var m = String(time || '').match(/(\d{1,2}):(\d{2})/);
    if (!m) return '';
    var total = Number(m[1]) * 60 + Number(m[2]) - mins;
    if (total < 0) total += 1440;
    var h = Math.floor(total / 60) % 24;
    var mm = total % 60;
    return String(h).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  }

  function collectData(kind) {
    var pass = {};
    var dom = {};
    var state = {};
    var receipt = {};
    var recBooking = {};
    var breakdown = {};
    var flight = {};

    if (typeof sessionStorage !== 'undefined') pass = readJson('enair.pass', sessionStorage);
    if (typeof localStorage !== 'undefined') {
      state = readJson('enairState', localStorage);
      receipt = state.receipt || {};
      recBooking = receipt.booking || {};
      breakdown = receipt.breakdown || {};
      flight = state.flight || {};
    }
    if (typeof document !== 'undefined') {
      var nodes = document.querySelectorAll('[data-pass]');
      for (var i = 0; i < nodes.length; i += 1) {
        var k = nodes[i].getAttribute('data-pass');
        var v = (nodes[i].textContent || '').trim();
        if (k && v) dom[k] = v;
      }
    }

    var from = dom.from || pass.from || flight.from || state.from || 'JFK';
    var to = dom.to || pass.to || flight.to || state.to || 'LHR';
    var cityFrom = dom.cityFrom || pass.cityFrom || flight.fromName || state.fromName ||
      recBooking.departure_city || 'New York';
    var cityTo = dom.cityTo || pass.cityTo || flight.toName || state.toName ||
      recBooking.arrival_city || 'London';

    var flightNo = recBooking.flight_number || dom.flight || pass.flight || flight.no || 'eN-102';
    var aircraft = flight.aircraft || recBooking.aircraft || '';
    var duration = flight.duration || '';

    var rawDep = recBooking.departure_time || '';
    var rawArr = recBooking.arrival_time || '';

    var date = dom.date || pass.date || parseDateTime(rawDep, 'date') ||
      parseDateTime(state.departureDate, 'date') || '';
    var departure = dom.departure || pass.departure || parseDateTime(rawDep, 'time') ||
      parseDateTime(flight.dep, 'time') || '';
    var arrival = parseDateTime(rawArr, 'time') || parseDateTime(flight.arr, 'time') || '';
    var boarding = dom.boarding || pass.boarding || recBooking.boarding_time ||
      (departure ? minusMinutes(departure, 45) : '');
    var gate = dom.gate || pass.gate || flight.gate || recBooking.terminal_gate || '';
    var terminal = dom.terminal || pass.terminal || flight.terminal || '';

    var seats = joinList(state.seats, ' · ') || recBooking.seats || dom.seat || pass.seat || '';
    var passengers = joinList(state.passengers, ' · ') || joinList(recBooking.passenger_names, ' · ') ||
      dom.passenger || pass.passenger || '';

    var cabin = recBooking.cabin || pass.cabin || state.cabin || 'Economy';
    var fare = recBooking.fare || state.fare || '';
    var bags = dom.bags || pass.bags || recBooking.baggage ||
      (fare === 'Business' || fare === 'First' ? '2 x 32 kg checked bags' : '2 x 23 kg');
    var status = recBooking.status || (kind === 'boarding-pass' ? 'checked_in' : 'confirmed');
    var reference = recBooking.reference || pass.reference || state.confirmation || dom.reference ||
      'EN482913';
    var total = breakdown.total || recBooking.total_price || flight.price || '';
    var issued = recBooking.created_at || '';
    var email = recBooking.email || '';

    // Enrich sparse data from the schedule table so the PDF always matches the
    // flight: fills missing times, airports, aircraft and duration.
    var info = FLIGHT_INFO[String(flightNo).toUpperCase().replace(/\s+/g, '')];
    var hasRoute = Boolean(dom.from || pass.from || flight.from || state.from ||
      recBooking.departure_city);
    if (info) {
      if (!date) date = info.date;
      if (!departure) departure = info.departure;
      if (!arrival) arrival = info.arrival;
      if (!aircraft) aircraft = info.aircraft;
      if (!duration) duration = info.duration;
      if (!hasRoute) {
        from = info.from;
        to = info.to;
        cityFrom = info.cityFrom;
        cityTo = info.cityTo;
      }
    }

    return {
      reference: reference,
      flight: flightNo,
      from: from,
      to: to,
      cityFrom: cityFrom,
      cityTo: cityTo,
      date: date,
      departure: departure,
      arrival: arrival,
      boarding: boarding,
      gate: gate,
      terminal: terminal,
      seats: seats,
      passengers: passengers,
      cabin: cabin,
      fare: fare,
      bags: bags,
      status: status,
      aircraft: aircraft,
      duration: duration,
      total: total,
      issued: issued,
      email: email
    };
  }

  function moneyKzt(v) {
    if (v === null || v === undefined || v === '') return '';
    var n = Number(v);
    if (!isFinite(n) || !n) return '';
    return 'KZT ' + Math.round(n).toLocaleString('en-US');
  }

  function statusLabel(status) {
    var s = String(status || '').toLowerCase();
    if (s === 'cancelled') return 'CANCELLED';
    if (s === 'checked_in' || s === 'checked in') return 'CHECKED IN';
    return 'CONFIRMED';
  }

  /* ---------------- render ---------------- */

  function render(cmds, d, kind) {
    var isPass = kind === 'boarding-pass';
    var title = isPass ? 'BOARDING PASS' : 'E-TICKET';
    var status = statusLabel(d.status);

    /* header band (gradient) */
    var hh = 122;
    var GRAD_N = 80;
    for (var g = 0; g < GRAD_N; g += 1) {
      var t = g / (GRAD_N - 1);
      rectFill(cmds, g * W / GRAD_N, H - hh, W / GRAD_N + 0.6, hh, lerpColor(BRAND.violet, BRAND.cyan, t));
    }

    text(cmds, 40, H - 50, 'eNAir', 25, 'F2', BRAND.white);
    text(cmds, 40, H - 70, 'HYDROGEN-ELECTRIC AIRLINE', 7, 'F1', BRAND.white);
    text(cmds, 40, H - 94, title, 13, 'F2', BRAND.white);

    // status pill (top-right)
    var pillW = 128, pillH = 26;
    var pillX = W - 40 - pillW, pillY = H - 58;
    roundRectFill(cmds, pillX, pillY, pillW, pillH, pillH / 2, BRAND.white);
    text(cmds, pillX + pillW / 2, pillY + 8, status, 8.5, 'F2',
      status === 'CANCELLED' ? BRAND.red : BRAND.violet, 'center');

    /* ticket card */
    var x0 = 40, y0 = 80, x1 = W - 40, y1 = 692;
    var cw = x1 - x0, ch = y1 - y0, cr = 24;
    // soft shadow
    roundRectFill(cmds, x0 + 5, y0 - 7, cw, ch, cr, BRAND.line);
    roundRectFill(cmds, x0, y0, cw, ch, cr, BRAND.white);
    roundRectStroke(cmds, x0, y0, cw, ch, cr, BRAND.line, 1);

    var PAD = 34;
    var il = x0 + PAD;          // 74
    var ir = x1 - PAD;          // 521.28
    var it = y1 - PAD;          // 658
    var ib = y0 + PAD;          // 114
    var mainRight = 358;        // main column right edge
    var mmid = (il + mainRight) / 2; // main column center

    /* route hero (main column) */
    text(cmds, il, 628, d.from, 34, 'F2', BRAND.ink, 'left', 132);
    text(cmds, mainRight, 628, d.to, 34, 'F2', BRAND.ink, 'right', 132);
    var leftW = tw(d.from, 34, true);
    var rightW = tw(d.to, 34, true);
    var ax1 = Math.max(il + leftW + 16, 158);
    var ax2 = Math.min(mainRight - rightW - 16, mainRight - 58);
    if (ax2 - ax1 > 44) arrow(cmds, ax1, ax2, 634, BRAND.violet, 1.6);

    var showCities = Boolean(d.cityFrom && d.cityTo) &&
      String(d.cityFrom).toUpperCase() !== String(d.from).toUpperCase();
    if (showCities) {
      text(cmds, il, 604, d.cityFrom, 10.5, 'F1', BRAND.muted, 'left', 150);
      text(cmds, mainRight, 604, d.cityTo, 10.5, 'F1', BRAND.muted, 'right', 150);
    }

    var meta1 = [];
    if (d.flight) meta1.push(d.flight);
    if (d.aircraft) meta1.push(d.aircraft);
    var meta2 = [];
    if (d.date) meta2.push(d.date);
    if (d.duration) meta2.push(d.duration);
    meta2.push('Non-stop');
    var meta1Y = showCities ? 580 : 604;
    text(cmds, mmid, meta1Y, meta1.join(' · '), 12, 'F2', BRAND.ink, 'center', 260);
    text(cmds, mmid, meta1Y - 18, meta2.join(' · '), 8.5, 'F1', BRAND.muted, 'center', 260);

    line(cmds, il, 544, mainRight, 544, BRAND.line, 1);

    /* departure / arrival timeline (main column) */
    var tlY = 510;
    text(cmds, il, tlY, d.departure || '—', 17, 'F2', BRAND.ink);
    text(cmds, il, tlY - 17, 'DEPARTURE', 6.5, 'F1', BRAND.muted);
    text(cmds, mainRight, tlY, d.arrival || '—', 17, 'F2', BRAND.ink, 'right');
    text(cmds, mainRight, tlY - 17, 'ARRIVAL', 6.5, 'F1', BRAND.muted, 'right');
    arrow(cmds, il + 72, mainRight - 72, tlY - 8, BRAND.cyan, 1.2);

    line(cmds, il, 468, mainRight, 468, BRAND.line, 1);

    /* details grid — 2 columns x 6 rows */
    var col1 = il, col2 = 224;
    var colW = 120;
    var rows = [
      ['PASSENGER(S)', d.passengers || '—'],
      ['SEAT(S)', d.seats || '—'],
      ['FLIGHT', d.flight],
      ['CLASS / FARE', [d.cabin, d.fare].filter(Boolean).join(' ')],
      ['GATE / TERMINAL', [d.gate || '', d.terminal ? 'T' + d.terminal : ''].filter(Boolean).join(' · ') || 'At check-in'],
      ['BOARDING', d.boarding || 'TBA'],
      ['DEPARTURE', d.departure || '—'],
      ['ARRIVAL', d.arrival || '—'],
      ['BAGGAGE', d.bags || '—'],
      ['BOOKING REF', d.reference],
      ['AIRCRAFT', d.aircraft || '—'],
      ['STATUS', statusLabel(d.status)]
    ];
    var rowPitch = 40;
    var baseValueY = 448;
    for (var ri = 0; ri < rows.length; ri += 1) {
      var col = ri % 2;
      var rrow = Math.floor(ri / 2);
      var x = col === 0 ? col1 : col2;
      var vy = baseValueY - rrow * rowPitch;
      text(cmds, x, vy, rows[ri][1], 10.5, 'F2', BRAND.ink, 'left', colW);
      text(cmds, x, vy + 15, rows[ri][0], 6.5, 'F1', BRAND.muted);
    }

    /* payment strip (main column) */
    var payY = 178, payH = 52;
    roundRectFill(cmds, il, payY, mainRight - il, payH, 14, BRAND.soft);
    text(cmds, il + 14, payY + 32, 'TOTAL PAID', 6.5, 'F1', BRAND.muted);
    text(cmds, il + 14, payY + 14, moneyKzt(d.total) || '—', 16, 'F2', BRAND.violet);
    var issuedText = 'Issued ' + (d.issued ? parseDateTime(d.issued, 'date') : 'demo ticket');
    text(cmds, mainRight - 14, payY + 28, issuedText, 6.5, 'F1', BRAND.muted, 'right', 120);
    text(cmds, mainRight - 14, payY + 12, 'eNAir · demo', 6.5, 'F1', BRAND.muted, 'right', 120);

    /* stub divider */
    dashLine(cmds, 370, ib + 8, 370, it - 8, BRAND.line, 1, 5);

    /* stub column */
    var scx = (370 + ir) / 2; // ~445.6
    text(cmds, scx, 620, 'SCAN AT GATE', 6.5, 'F1', BRAND.muted, 'center');

    var qrCell = 4, qrSize = 21 * qrCell; // 84
    var qrX = scx - qrSize / 2, qrTop = 604;
    roundRectFill(cmds, qrX - 6, qrTop - qrSize - 6, qrSize + 12, qrSize + 12, 10, BRAND.white);
    roundRectStroke(cmds, qrX - 6, qrTop - qrSize - 6, qrSize + 12, qrSize + 12, 10, BRAND.line, 1);
    var qrGrid = qrMatrix(d.reference);
    for (var qr = 0; qr < qrGrid.length; qr += 1) {
      for (var qc = 0; qc < qrGrid.length; qc += 1) {
        if (qrGrid[qr][qc]) rectFill(cmds, qrX + qc * qrCell, qrTop - (qr + 1) * qrCell, qrCell, qrCell, BRAND.ink);
      }
    }

    text(cmds, scx, 500, d.reference, 12, 'F2', BRAND.ink, 'center');
    text(cmds, scx, 482, 'BOOKING REF', 6.5, 'F1', BRAND.muted, 'center');

    var bars = barcodeBars(d.reference);
    var barGap = 1.8;
    var barTotal = 0;
    for (var bi = 0; bi < bars.length; bi += 1) barTotal += bars[bi] + barGap;
    barTotal -= barGap;
    var bx = scx - barTotal / 2, by = 440, bh = 30;
    var cx = bx;
    for (var bj = 0; bj < bars.length; bj += 1) {
      rectFill(cmds, cx, by, bars[bj], bh, BRAND.ink);
      cx += bars[bj] + barGap;
    }

    text(cmds, scx, 408, 'SEAT', 6.5, 'F1', BRAND.muted, 'center');
    var stubSeat = d.seats ? String(d.seats).split(/[·,]/)[0].trim() : '';
    text(cmds, scx, 372, stubSeat || '—', 26, 'F2', BRAND.ink, 'center');

    line(cmds, scx - 55, 330, scx + 55, 330, BRAND.line, 1);
    text(cmds, scx, 312, [d.cabin, d.fare].filter(Boolean).join(' ') || 'Economy', 8, 'F1', BRAND.muted, 'center', 120);
    text(cmds, scx, 296, d.bags || '', 8, 'F1', BRAND.muted, 'center', 120);

    /* footer */
    text(cmds, W / 2, 54, 'eNAir · Hydrogen-electric airline', 8, 'F1', BRAND.muted, 'center');
    text(cmds, W / 2, 42, 'Prototype ' + (isPass ? 'boarding pass' : 'e-ticket') + ' · not valid for travel', 7, 'F1', BRAND.muted, 'center');
  }

  /* ---------------- PDF assembly ---------------- */

  function latin1Bytes(str) {
    var out = new Uint8Array(str.length);
    for (var i = 0; i < str.length; i += 1) out[i] = str.charCodeAt(i) & 0xFF;
    return out;
  }

  function buildTicketPdf(data, kind) {
    var cmds = [];
    render(cmds, data, kind || 'e-ticket');
    var content = cmds.join('');

    var objects = [];
    objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
    objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
    objects.push('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + W.toFixed(2) + ' ' + H.toFixed(2) + '] ' +
      '/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n');
    objects.push('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n');
    objects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n');
    objects.push('6 0 obj\n<< /Length ' + content.length + ' >>\nstream\n' + content + 'endstream\nendobj\n');

    var header = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
    var body = '';
    var offsets = [];
    var pos = header.length;
    for (var i = 0; i < objects.length; i += 1) {
      offsets.push(pos);
      body += objects[i];
      pos += objects[i].length;
    }

    var xref = 'xref\n0 ' + (objects.length + 1) + '\n';
    xref += '0000000000 65535 f \n';
    for (var j = 0; j < offsets.length; j += 1) {
      xref += ('0000000000' + offsets[j]).slice(-10) + ' 00000 n \n';
    }
    var trailer = 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\nstartxref\n' +
      pos + '\n%%EOF\n';

    return latin1Bytes(header + body + xref + trailer);
  }

  /* ---------------- browser API ---------------- */

  function filename(d) {
    return 'enair-' + String(d.reference || 'ticket').replace(/[^A-Za-z0-9_-]/g, '') + '.pdf';
  }

  function download(kind) {
    var d = collectData(kind);
    var bytes = buildTicketPdf(d, kind);
    var blob = new Blob([bytes], { type: 'application/pdf' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename(d);
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 800);
  }

  function bind() {
    var nodes = document.querySelectorAll('[data-pdf]');
    for (var i = 0; i < nodes.length; i += 1) {
      nodes[i].addEventListener('click', function (ev) {
        ev.preventDefault();
        var kind = this.getAttribute('data-pdf') || 'e-ticket';
        try {
          download(kind);
          var toast = document.getElementById('toast');
          if (toast) {
            toast.textContent = 'PDF downloaded · ' + (kind === 'boarding-pass' ? 'boarding pass' : 'e-ticket');
            toast.className = 'toast show ok';
            setTimeout(function () { toast.className = 'toast'; }, 3200);
          }
        } catch (err) {
          if (window.console) console.error('PDF generation failed:', err);
          var toastErr = document.getElementById('toast');
          if (toastErr) {
            toastErr.textContent = 'Could not generate the PDF';
            toastErr.className = 'toast show err';
            setTimeout(function () { toastErr.className = 'toast'; }, 3200);
          }
        }
      });
    }
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
    else bind();
  }

  return {
    download: download,
    collectData: collectData,
    buildPdf: buildTicketPdf,
    buildTicketPdf: buildTicketPdf
  };
});
