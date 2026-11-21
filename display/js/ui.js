/* ============================================================
   Salah Board — ui.js
   Pure render: (state result, config, content-by-language) -> HTML
   string. One innerHTML swap per tick — no per-tick DOM listeners,
   so a 24h+ run never accumulates handlers (SPEC M1 acceptance:
   no interval leaks).
   ============================================================ */
(function (global) {
  'use strict';

  const pad2 = n => String(n).padStart(2, '0');

  // Inline SVG icons — never rely on emoji, which render as tofu (□) on kiosk
  // browsers with no emoji font. currentColor inherits the surrounding colour.
  const ICON_NO_PHONE =
    '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" ' +
    'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="7" y="3" width="10" height="18" rx="2"/><line x1="11" y1="18" x2="13" y2="18"/>' +
    '<line x1="3" y1="3" x2="21" y2="21"/></svg>';

  // Shrink the masjid name to fit its row on one line (long names like
  // "Athurugiriya Jumma Masjidh" otherwise wrapped and broke the layout).
  // Cheap: only measures/adjusts when the name or available width changed.
  let _fitCache = { name: null, avail: 0, factor: 1 };
  function fitMasjidName(root, config) {
    const el = root.querySelector('.masjid-name');
    if (!el) return;
    const topbar = el.closest('.topbar') || el.parentElement;
    const dates = topbar ? topbar.querySelector('.dates') : null;
    const avail = topbar
      ? topbar.clientWidth - (dates ? dates.getBoundingClientRect().width : 0) - 32
      : el.clientWidth;
    const name = el.textContent;
    // Admin → Advanced "Masjid name" size, as a multiplier on the theme size.
    const sizes = config && config.layout && config.layout.normal && config.layout.normal.sizes;
    const factor = global.SBConfig.layoutFactor(sizes ? sizes.masjidName : 100);
    if (_fitCache.name === name && _fitCache.factor === factor && Math.abs(_fitCache.avail - avail) < 2) {
      if (_fitCache.size) el.style.fontSize = _fitCache.size; // fresh element after re-render
      return;
    }
    el.style.fontSize = '';                 // reset to the theme's default
    const base = parseFloat(getComputedStyle(el).fontSize) * factor;
    let size = base;
    el.style.fontSize = size + 'px';
    _fitCache = { name, avail, factor, size: el.style.fontSize };
    if (avail <= 0) return;
    // Reduce until it fits, but never below 55% of the theme size.
    for (let i = 0; i < 24 && el.scrollWidth > avail && size > base * 0.55; i++) {
      size *= 0.96;
      el.style.fontSize = size + 'px';
    }
    _fitCache.size = el.style.fontSize;
  }

  // Shrink the next-prayer name until the label + name row fits its half of
  // the hero, for themes that put them on one row (default, landscape:
  // .np-head is a flex row). Elsewhere .np-head is display:contents — skip.
  let _npFit = { key: null, size: '' };
  function fitNextName(root) {
    const head = root.querySelector('.np-head');
    const el = head && head.querySelector('.np-name');
    if (!el || getComputedStyle(head).display !== 'flex') return;
    const key = `${el.textContent}|${head.clientWidth}|${root.querySelector('.screen').className}`;
    if (_npFit.key === key) { if (_npFit.size) el.style.fontSize = _npFit.size; return; }
    el.style.fontSize = '';                 // theme size first
    const base = parseFloat(getComputedStyle(el).fontSize);
    let size = base;
    // Never below 50% of the theme size.
    for (let i = 0; i < 30 && head.scrollWidth > head.clientWidth + 1 && size > base * 0.5; i++) {
      size *= 0.95;
      el.style.fontSize = size + 'px';
    }
    _npFit = { key, size: el.style.fontSize };
  }

  // Shrink any Jumu'ah banner slide that's wider than the banner (down to
  // 75%); past that, CSS ends it with "…" (layout.css .jdb-slide).
  let _slideFit = {};
  function fitBannerSlides(root) {
    root.querySelectorAll('.jdb-carousel .jdb-slide').forEach(el => {
      const key = `${el.textContent}|${el.parentElement.clientWidth}`;
      if (key in _slideFit) { if (_slideFit[key]) el.style.fontSize = _slideFit[key]; return; }
      const base = parseFloat(getComputedStyle(el).fontSize);
      let size = base;
      for (let i = 0; i < 12 && el.scrollWidth > el.clientWidth + 1 && size > base * 0.75; i++) {
        size *= 0.97;
        el.style.fontSize = size + 'px';
      }
      _slideFit[key] = el.style.fontSize;
    });
  }

  // Size the big azan/iqamah numbers to the room the hero ACTUALLY has
  // (default theme, landscape grid). The CSS formula guesses the height the
  // rest of the hero takes; any change to it (admin size sliders, a taller
  // banner, another screen) made the guess wrong — numbers smaller than
  // needed with a gap above the timetable, or overlap. This measures and
  // fills the space exactly, within the same limits as the CSS: at most
  // 13rem, at most the width cap, at least 5rem. The CSS stays as fallback.
  let _heroFit = { key: null, size: '', compact: false };
  // Prayer times must stay clearly the biggest text: if they'd come out less
  // than this many times the clock's height, the clock, name and countdown
  // step back to compact sizes (theme.css .hero-compact) and we fit again.
  const HERO_MIN_RATIO = 1.4;
  function fitHero(root) {
    const row = root.querySelector('.hero-row');
    if (!row || getComputedStyle(row).display !== 'grid') return;
    const times = Array.from(row.querySelectorAll('.np-time'));
    const screen = root.querySelector('.screen');
    if (!times.length || !screen) return;
    const key = [row.clientWidth, row.clientHeight, screen.className,
      document.documentElement.style.cssText, times.map(t => t.textContent).join('|'),
      (row.querySelector('.np-name') || {}).textContent].join('/');
    const apply = v => times.forEach(t => { t.style.fontSize = v; });
    if (_heroFit.key === key) {
      screen.classList.toggle('hero-compact', _heroFit.compact);
      apply(_heroFit.size);
      return;
    }

    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const maxF = Math.min(13 * rem, (row.clientWidth - 4 * rem) / 6.4);
    const minF = 5 * rem;
    const items = Array.from(row.querySelectorAll('.np-head, .hero-clock, .np-times, .np-countdown'));
    const used = () => {
      let top = Infinity, bottom = -Infinity;
      items.forEach(el => { const r = el.getBoundingClientRect(); if (r.height) { top = Math.min(top, r.top); bottom = Math.max(bottom, r.bottom); } });
      return bottom - top;
    };
    const fit = () => {
      const target = row.clientHeight - 0.3 * rem;        // small safety margin
      let f = maxF;
      apply(f + 'px');
      let h = used();
      if (h > target) {
        // Height grows linearly with the font size: measure the slope once,
        // jump straight to the size that fits, then nudge down if needed.
        const f2 = Math.max(minF, f * 0.8);
        apply(f2 + 'px');
        const h2 = used();
        const slope = (h - h2) / (f - f2) || 0.8;
        f = Math.max(minF, Math.min(maxF, f2 - (h2 - target) / slope));
        apply(f + 'px');
        for (let i = 0; i < 6 && used() > target && f > minF; i++) {
          f = Math.max(minF, f * 0.97);
          apply(f + 'px');
        }
      }
      return f;
    };
    const ratio = () => {
      const c = row.querySelector('.clock-big');
      const ch = c ? c.getBoundingClientRect().height : 0;
      return ch ? times[0].getBoundingClientRect().height / ch : Infinity;
    };
    screen.classList.remove('hero-compact');
    let f = fit();
    let compact = false;
    if (ratio() < HERO_MIN_RATIO) {
      screen.classList.add('hero-compact');
      const fc = fit();
      if (fc > f) { f = fc; compact = true; }
      else { screen.classList.remove('hero-compact'); apply(f + 'px'); }
    }
    _heroFit = { key, size: f + 'px', compact };
  }

  // Jumu'ah footer: stack its two messages if they don't fit on one line.
  // Last resort (very narrow screens, e.g. portrait Tamil): shrink to 75%,
  // then let a message wrap rather than run off the screen.
  let _quietFit = {};
  function fitQuiet(root) {
    const q = root.querySelector('.jm-quiet');
    if (!q) return;
    const key = `${q.textContent}|${root.clientWidth}|${document.documentElement.style.cssText}`;
    const apply = f => {
      q.classList.toggle('jm-quiet--stack', f.stack);
      q.classList.toggle('jm-quiet--wrap', f.wrap);
      q.style.fontSize = f.size;
    };
    if (key in _quietFit) { apply(_quietFit[key]); return; }
    const f = { stack: false, wrap: false, size: '' };
    apply(f);
    const limit = root.clientWidth * 0.94;
    const msgs = q.querySelectorAll('.jm-msg');
    const oneLine = msgs.length < 2 || Math.abs(msgs[0].getBoundingClientRect().top - msgs[1].getBoundingClientRect().top) < 2;
    if (msgs.length > 1 && (!oneLine || q.getBoundingClientRect().width > limit)) { f.stack = true; apply(f); }
    const base = parseFloat(getComputedStyle(q).fontSize);
    let size = base;
    for (let i = 0; i < 10 && q.scrollWidth > limit && size > base * 0.75; i++) { size *= 0.97; f.size = size + 'px'; apply(f); }
    if (q.scrollWidth > limit) { f.wrap = true; apply(f); }
    _quietFit[key] = f;
  }

  // All fits above cache their result. If a web font (e.g. Tamil) finishes
  // loading after the first fit, the text was measured in a narrower fallback
  // font and would stay clipped — so forget the cached fits whenever fonts
  // finish loading; the next render (≤ 1 s) measures again with real fonts.
  if (global.document && document.fonts && document.fonts.addEventListener) {
    document.fonts.addEventListener('loadingdone', () => {
      _fitCache = { name: null, avail: 0, factor: 1 };
      _npFit = { key: null, size: '' };
      _slideFit = {};
      _heroFit = { key: null, size: '', compact: false };
      _quietFit = {};
    });
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function langs(config) {
    return (config.masjid.languages && config.masjid.languages.length) ? config.masjid.languages : ['en'];
  }
  // Deep-merges the primary-language pack over the English pack, so any
  // key missing at runtime (incomplete translation, pack fetch failure)
  // falls back to the en value instead of a raw key.
  function primaryContent(contentByLang, config) {
    const ls = langs(config);
    const en = contentByLang.en || {};
    const primary = contentByLang[ls[0]] || {};
    return global.SBConfig.deepMerge(en, primary);
  }
  function label(content, key) {
    return (content.labels && content.labels[key]) || key;
  }
  function prayerLabel(content, key, isJumuah) {
    if (isJumuah && key === 'luhr') return label(content, 'jumuah');
    return label(content, key);
  }

  function localISODate(d) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function pickNoticeText(notice, languages) {
    for (const l of languages) if (notice.text && notice.text[l]) return notice.text[l];
    const keys = notice.text ? Object.keys(notice.text) : [];
    return keys.length ? notice.text[keys[0]] : '';
  }

  function activeNotices(notices, now) {
    const today = localISODate(now);
    return (notices || []).filter(n => (!n.from || today >= n.from) && (!n.to || today <= n.to));
  }

  // Deterministic time-based rotation index — pure function of `now`,
  // so a reboot mid-rotation just resumes at the correct card.
  function rotationIndex(now, periodSeconds, length) {
    if (!length) return 0;
    return Math.floor(now.getTime() / 1000 / periodSeconds) % length;
  }

  // Locale used for the Gregorian date per primary language. Formatters
  // are cached per locale — ticking every second must not allocate new
  // Intl.DateTimeFormat instances (M1.5 leak-free acceptance).
  const GREG_LOCALE = { en: 'en-GB', ta: 'ta-LK', si: 'si-LK' };
  const _gregFmtCache = {};
  function gregorianText(d, lang) {
    const locale = GREG_LOCALE[lang] || 'en-GB';
    if (!_gregFmtCache[locale]) {
      _gregFmtCache[locale] = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }
    return _gregFmtCache[locale].format(d);
  }

  // Data files store times as "h:mm AM/PM" strings — always re-parse and
  // reformat through the engine so the display's clock.format/AM-PM rules
  // apply uniformly, instead of printing the raw data-file string.
  function fmtRowTime(str, config, result) {
    const E = global.SBEngine;
    return E.formatTime(E.parseTime(str, result.dates.today), config);
  }

  function timetableCells(content, config, result) {
    const row = result.rows.today;
    if (!row) return [];
    // While the main screen counts down to Luha, highlight Sunrise (Luha's
    // own time isn't a column in the timetable).
    const nextKey = result.luhaNext ? 'sunrise' : (result.nextAzan && result.nextAzan.prayer);
    const cells = [
      { key: 'fajr', label: label(content, 'fajr'), time: fmtRowTime(row.fajr, config, result) },
      { key: 'sunrise', label: label(content, 'sunrise'), time: fmtRowTime(row.sunrise, config, result) },
    ];
    cells.push({ key: 'luhr', label: label(content, result.isJumuahDay ? 'jumuah' : 'luhr'), time: fmtRowTime(row.luhr, config, result) });
    cells.push({ key: 'asr', label: label(content, 'asr'), time: fmtRowTime(row.asr, config, result) });
    cells.push({ key: 'magrib', label: label(content, 'magrib'), time: fmtRowTime(row.magrib, config, result) });
    cells.push({ key: 'isha', label: label(content, 'isha'), time: fmtRowTime(row.isha, config, result) });
    return cells.map(c => Object.assign(c, { isNext: c.key === nextKey }));
  }

  function timetableCardHtml(content, config, result) {
    const cells = timetableCells(content, config, result);
    return `<div class="card card--timetable"><div class="timetable-strip">${
      cells.map(c => `<div class="tt-cell${c.isNext ? ' tt-cell--next' : ''}"><span class="tt-label">${escapeHtml(c.label)}</span><span class="tt-time">${escapeHtml(c.time)}</span></div>`).join('')
    }</div></div>`;
  }

  // `stride` = how many card types share the rotation slot. Each card's own
  // item index must advance once per FULL round of card types; with the same
  // period as the card rotation, e.g. 2 card types + 2 notices always landed
  // on notice #1 and notice #2 never showed.
  function noticeCardHtml(content, config, result, stride = 1) {
    const ls = langs(config);
    const notices = activeNotices(config.notices, result.now).filter(n => n.priority !== 'high');
    if (!notices.length) return '';
    const idx = rotationIndex(result.now, config.rotation.seconds * stride, notices.length);
    const n = notices[idx];
    return `<div class="card card--notice"><p class="notice-text">${escapeHtml(pickNoticeText(n, ls))}</p></div>`;
  }

  function jumuahEtiquetteCardHtml(content, config, result, stride = 1) {
    const items = content.jumuahEtiquette || [];
    if (!items.length) return '';
    const idx = rotationIndex(result.now, config.rotation.seconds * stride, items.length);
    const item = items[idx];
    return `<div class="card card--etiquette"><p class="etiquette-text">${escapeHtml(item.text)}</p></div>`;
  }

  // The full timetable strip is already always-on (per SPEC's NORMAL row),
  // so it's dropped here to avoid showing it twice — this region only
  // rotates the genuinely rotating cards (notices, Jumu'ah etiquette).
  function rotationCardHtml(content, config, result) {
    let cards = (config.rotation.cards || []).filter(c => c !== 'timetable');
    if (!result.jumuahAlerts) cards = cards.filter(c => c !== 'jumuah-etiquette');
    // Build every card first and rotate only through the non-empty ones —
    // otherwise an empty slot (e.g. "notices" with none active) made the
    // card vanish every other period and the whole screen jump up and down.
    const build = (card, stride) => {
      if (card === 'notices') return noticeCardHtml(content, config, result, stride);
      if (card === 'jumuah-etiquette') return jumuahEtiquetteCardHtml(content, config, result, stride);
      return '';
    };
    const live = cards.filter(card => build(card, 1));
    if (!live.length) return '';
    const card = live[rotationIndex(result.now, config.rotation.seconds, live.length)];
    return build(card, live.length);
  }

  function pinnedNoticeHtml(config, result) {
    const ls = langs(config);
    const pinned = activeNotices(config.notices, result.now).filter(n => n.priority === 'high');
    if (!pinned.length) return '';
    const idx = rotationIndex(result.now, config.rotation.seconds, pinned.length);
    const n = pinned[idx];
    return `<div class="pinned-banner">${escapeHtml(pickNoticeText(n, ls))}</div>`;
  }

  // Rotates a text/dua item across BOTH the item list and configured
  // languages, per SPEC "rotating content alternates through the list".
  function rotateAcrossLanguages(contentByLang, config, now, extract) {
    const ls = langs(config);
    const primary = contentByLang[ls[0]] || contentByLang.en || {};
    const items = extract(primary) || [];
    if (!items.length) return null;
    const seqLen = items.length * ls.length;
    const idx = rotationIndex(now, config.rotation.seconds, seqLen);
    const itemIdx = idx % items.length;
    const langIdx = Math.floor(idx / items.length) % ls.length;
    const lang = ls[langIdx];
    const c = contentByLang[lang] || primary;
    const list = extract(c) || items;
    return list[itemIdx] || items[itemIdx];
  }

  function duaCardHtml(item) {
    if (!item) return '';
    const arabic = item.arabic ? `<p class="arabic" dir="rtl">${escapeHtml(item.arabic)}</p>` : '';
    const text = item.text ? `<p class="dua-text">${escapeHtml(item.text)}</p>` : '';
    const translation = item.translation ? `<p class="translation">${escapeHtml(item.translation)}</p>` : '';
    return `<div class="dua-card">${arabic}${text}${translation}</div>`;
  }

  // ── Per-state renderers ──────────────────────────────────
  function renderNormal(config, result, contentByLang) {
    const content = primaryContent(contentByLang, config);
    const E = global.SBEngine;
    const lang = langs(config)[0];
    const clockStr = E.formatClock(result.now, config);
    // Small AM/PM after the main clock (12-hour only): "4:06" alone could be
    // morning or afternoon.
    const period = ampmOf(config, result.now);
    const ampm = period ? `<span class="clock-ampm">${period}</span>` : '';
    const next = result.nextAzan;
    let azanTime = next ? E.formatTime(next.time, config) : '--:--';
    let iqamahTime = next && next.iqamahTime ? E.formatTime(next.iqamahTime, config) : '--:--';
    let countdown = next ? E.fmtCountdown(next.time - result.now) : '--:--';
    let nextName = next ? prayerLabel(content, next.prayer, next.jumuah) : '—';
    let leftLabel = label(content, 'azan');
    let rightLabel = label(content, 'iqamah');
    // After Fajr: Luha is next — Sunrise | Luha, counting down to sunrise,
    // then to Luha (config luha.showOnMain; see SBState.resolveLuhaNext).
    const ln = result.luhaNext;
    if (ln) {
      nextName = label(content, 'luha');
      leftLabel = label(content, 'sunrise');
      rightLabel = label(content, 'luha');
      azanTime = E.formatTime(ln.sunrise, config);
      iqamahTime = E.formatTime(ln.luha, config);
      countdown = E.fmtCountdown((result.now < ln.sunrise ? ln.sunrise : ln.luha) - result.now);
    }

    let jumuahBanner = '';
    if (result.jumuahAlerts) {
      // Morning (until Luha begins): "Jumu'ah today · Azan · Bayan". After
      // Luha the big numbers already show the Jumu'ah azan, so the banner
      // gives what comes next instead: "Jumu'ah today · Bayan · Khutbah".
      const todayRow = result.rows.today;
      const plan = result.jumuahPlan;
      const part = (key, date) => ` · ${escapeHtml(label(content, key))} ${escapeHtml(date ? E.formatTime(date, config) : '--:--')}`;
      const sunrise = todayRow ? E.parseTime(todayRow.sunrise, result.dates.today) : null;
      const luhaStart = sunrise ? E.addMinutes(sunrise, Math.max(0, Number(config.luha && config.luha.waitAfterSunrise) || 0)) : null;
      const afterLuha = luhaStart && result.now >= luhaStart;
      const azanDate = todayRow ? E.parseTime(todayRow.luhr, result.dates.today) : null;
      // plan.bayan is today's actual bayan start (moved later on late-azan
      // Fridays), always after the azan.
      const bayanPart = plan && plan.bayan ? part('bayan', plan.bayan) : '';
      const parts = afterLuha
        ? bayanPart + part('khutbah', plan && plan.khutbah)
        : part('azan', azanDate) + bayanPart;
      const mainLine = `<span class="jdb-main">${escapeHtml(label(content, 'jumuahToday'))}${parts}</span>`;
      jumuahBanner = result.bayanInfo
        ? jumuahCarouselHtml([mainLine, bayanInfoLine(result.bayanInfo)], result.now)
        : `<div class="jumuah-day-banner">${mainLine}</div>`;
    }

    let ramadanBlock = '';
    if (result.ramadan) {
      ramadanBlock = `<div class="ramadan-block">` +
        `<span class="ramadan-imsak">${escapeHtml(label(content, 'imsak'))}: ${escapeHtml(result.ramadan.imsak)}</span>` +
        `<span class="ramadan-iftar">${escapeHtml(label(content, 'iftar'))}: ${escapeHtml(result.ramadan.iftar)}</span>` +
        `</div>`;
    }

    return `
      <div class="screen screen--normal">
        <header class="topbar">
          <div class="masjid-name">${escapeHtml(config.masjid.name)}</div>
          <div class="dates">
            <span class="date-greg">${escapeHtml(gregorianText(result.now, lang))}</span>
            <span class="date-sep">·</span>
            <span class="date-hijri">${escapeHtml(result.hijri.text)}</span>
          </div>
        </header>
        ${jumuahBanner}
        ${pinnedNoticeHtml(config, result)}
        ${ramadanBlock}
        <div class="hero-row">
          <div class="card hero-clock">
            <div class="clock-big">${clockStr}${ampm}</div>
          </div>
          <div class="card hero-next">
            <div class="np-head">
              <span class="np-label">${escapeHtml(label(content, 'nextPrayer'))}</span>
              <span class="np-name">${escapeHtml(nextName)}</span>
            </div>
            <div class="np-times">
              <div class="np-time-col">
                <span class="np-time-label">${escapeHtml(leftLabel)}</span>
                <span class="np-time">${escapeHtml(azanTime)}</span>
              </div>
              <div class="np-divider"></div>
              <div class="np-time-col">
                <span class="np-time-label">${escapeHtml(rightLabel)}</span>
                <span class="np-time">${escapeHtml(iqamahTime)}</span>
              </div>
            </div>
            <span class="np-countdown">${countdown}</span>
          </div>
        </div>
        ${timetableCardHtml(content, config, result)}
        ${rotationCardHtml(content, config, result)}
      </div>`;
  }

  function renderAzan(config, result, contentByLang) {
    const content = primaryContent(contentByLang, config);
    const isJumuah = !!(result.meta && result.meta.jumuah);
    const name = prayerLabel(content, result.prayer, isJumuah);
    const reply = content.azanReply || {};
    const dua = content.azanDua || {};
    return `
      <div class="screen screen--azan">
        <div class="azan-banner">${escapeHtml(label(content, 'azan'))} — ${escapeHtml(name)}</div>
        <div class="azan-reminder">
          <p class="reminder-text">${escapeHtml(reply.text)}</p>
          <p class="arabic" dir="rtl">${escapeHtml(reply.arabic)}</p>
          <p class="translation">${escapeHtml(reply.translation)}</p>
        </div>
        <div class="azan-dua">
          <h3>${escapeHtml(dua.title)}</h3>
          <p class="arabic" dir="rtl">${escapeHtml(dua.arabic)}</p>
          <p class="translation">${escapeHtml(dua.translation)}</p>
        </div>
        <div class="phones-silent-icon">${ICON_NO_PHONE}</div>
      </div>`;
  }

  function renderBetween(config, result, contentByLang) {
    const content = primaryContent(contentByLang, config);
    const E = global.SBEngine;
    const iqamahTime = result.meta && result.meta.iqamahTime;
    const countdown = iqamahTime ? E.fmtCountdown(iqamahTime - result.now) : '--:--';
    const dua = rotateAcrossLanguages(contentByLang, config, result.now, c => c.betweenDuas);
    return `
      <div class="screen screen--between">
        <div class="iqamah-countdown-dominant">
          <div class="icd-label">${escapeHtml(label(content, 'iqamah'))}</div>
          <div class="icd-countdown">${countdown}</div>
        </div>
        <div class="between-reminder"><p>${escapeHtml((content.betweenReminder || {}).text)}</p></div>
        ${duaCardHtml(dua)}
        <div class="sunnah-reminder">${escapeHtml((content.sunnahReminder || {}).text)}</div>
      </div>`;
  }

  function renderIqamah(config, result, contentByLang) {
    const content = primaryContent(contentByLang, config);
    const scr = content.iqamahScreen || {};
    return `
      <div class="screen screen--iqamah">
        <h1 class="iqamah-title">${escapeHtml(scr.title)}</h1>
        <ul class="iqamah-lines">${(scr.lines || []).map(l => `<li>${escapeHtml(l)}</li>`).join('')}</ul>
      </div>`;
  }

  function renderSalah(config, result, contentByLang) {
    const content = primaryContent(contentByLang, config);
    const E = global.SBEngine;
    return `
      <div class="screen screen--salah">
        <div class="salah-clock">${E.formatClock(result.now, config)}</div>
        <div class="salah-line">${escapeHtml((content.salahScreen || {}).line)}</div>
      </div>`;
  }

  function renderAfter(config, result, contentByLang) {
    const item = rotateAcrossLanguages(contentByLang, config, result.now, c => c.afterSalahAdhkar);
    return `
      <div class="screen screen--after">
        ${duaCardHtml(item)}
      </div>`;
  }

  function renderLuhaWait(config, result, contentByLang) {
    const content = primaryContent(contentByLang, config);
    const E = global.SBEngine;
    const countdown = E.fmtCountdown(result.segEnd - result.now);
    return `
      <div class="screen screen--luha-wait">
        <div class="countdown-label">${escapeHtml(label(content, 'luha'))}</div>
        <div class="countdown">${countdown}</div>
      </div>`;
  }

  function renderLuhaOpen(config, result, contentByLang) {
    const content = primaryContent(contentByLang, config);
    return `
      <div class="screen screen--luha-open">
        <div class="luha-open-card">${escapeHtml((content.luhaOpen || {}).text)}</div>
      </div>`;
  }

  function renderNight(config, result, contentByLang) {
    const content = primaryContent(contentByLang, config);
    const E = global.SBEngine;
    const nextFajr = result.meta && result.meta.nextFajr;
    return `
      <div class="screen screen--night">
        <div class="night-clock">${E.formatClock(result.now, config)}</div>
        <div class="night-next-fajr">${escapeHtml(label(content, 'fajr'))} ${escapeHtml(nextFajr ? E.formatTime(nextFajr, config) : '')}</div>
      </div>`;
  }

  // Jumu'ah banner carousel: the slides share ONE line of height and
  // crossfade, instead of stacking (saves vertical room on 768p TVs).
  // The whole board re-renders every second, so a CSS animation would
  // restart each tick; instead each slide's animation-delay is set to the
  // current phase of a clock-derived cycle (negative delay = "already this
  // far in"). That keeps the fade continuous across re-renders and, like
  // the other rotations, is a pure function of `now`.
  const JDB_SLIDE_SECONDS = 6;
  function jumuahCarouselHtml(slides, now) {
    const n = slides.length;
    const cycle = n * JDB_SLIDE_SECONDS;
    const phase = (now.getTime() / 1000) % cycle;
    return `<div class="jumuah-day-banner jdb-carousel" style="--jdb-cycle:${cycle}s">` +
      slides.map((html, i) => {
        const offset = ((phase - i * JDB_SLIDE_SECONDS) % cycle + cycle) % cycle;
        return `<span class="jdb-slide" style="animation-delay:-${offset.toFixed(2)}s">${html}</span>`;
      }).join('') + `</div>`;
  }

  // "Speaker · Topic" (either part optional) — names and topics are typed by
  // the masjid in whatever language they use, so no translated labels needed.
  function bayanInfoLine(info) {
    if (!info) return '';
    const parts = [];
    if (info.speaker) parts.push(`<span class="jdb-speaker">${escapeHtml(info.speaker)}</span>`);
    if (info.topic) parts.push(`<span class="jdb-topic">${escapeHtml(info.topic)}</span>`);
    return `<span class="jdb-bayan">${parts.join('<span class="jdb-sep"> · </span>')}</span>`;
  }

  // ── Jumu'ah: sunnah → bayan → khutbah ─────────────────────
  // One shared layout so the three screens read as a set:
  //   body   — what's happening now (title) + its detail;
  //   sched  — sunnah/bayan only: the next times and minutes until the next
  //            step (whole minutes — nothing ticking while someone speaks);
  //   quiet  — the same footer on all three: no-phone icon + "switch off
  //            your phones · please remain silent" (khutbah: phones only —
  //            "remain silent" is already its main message).
  // Deliberately calm: no rotating cards, no seconds (corner clock too).
  // Each message is one unbreakable piece. Side by side with a dot when they
  // fit on one line; otherwise ui.js fitQuiet stacks them as two clean lines
  // (long Tamil/Sinhala wording, portrait) instead of breaking mid-phrase.
  function jumuahQuietHtml(content, withSilent) {
    const msg = key => `<span class="jm-msg">${escapeHtml(label(content, key))}</span>`;
    const text = msg('phonesOff') + (withSilent ? `<span class="jm-dot" aria-hidden="true">·</span>${msg('remainSilent')}` : '');
    return `<div class="jm-quiet"><span class="jm-quiet-icon">${ICON_NO_PHONE}</span><span class="jm-quiet-text">${text}</span></div>`;
  }

  function renderJumuah(config, result, contentByLang) {
    const content = primaryContent(contentByLang, config);
    const E = global.SBEngine;
    const m = result.meta || {};
    const phase = m.phase || 'bayan';
    const t = d => (d ? E.formatTime(d, config) : '--:--');
    const pair = (key, d) => `<span class="jm-pair"><span class="jm-key">${escapeHtml(label(content, key))}</span> ${escapeHtml(t(d))}</span>`;
    const sep = '<span class="date-sep jm-sep">·</span>';
    const inMinutes = (key, target) => {
      const n = target ? Math.max(1, Math.ceil((target - result.now) / 60000)) : '–';
      return label(content, 'inMinutes').replace('{name}', label(content, key)).replace('{n}', n);
    };
    const schedule = (pairs, key, target) => `
        <div class="jm-sched">
          <div class="jumuah-times">${pairs.join(sep)}</div>
          <div class="jumuah-countdown">${escapeHtml(inMinutes(key, target))}</div>
        </div>`;

    let title, detail, sched;
    if (phase === 'sunnah') {
      // Next step: the bayan, or the khutbah when there's no bayan.
      const toBayan = m.bayan !== false && m.bayanStart && m.bayanStart < m.khutbah;
      const reminder = (content.sunnahReminder || {}).text;
      title = label(content, 'sunnahPrayer');
      detail = reminder ? `<div class="jumuah-topic">${escapeHtml(reminder)}</div>` : '';
      sched = toBayan
        ? schedule([pair('bayan', m.bayanStart), pair('iqamah', m.iqamahTime)], 'bayan', m.bayanStart)
        : schedule([pair('khutbah', m.khutbah), pair('iqamah', m.iqamahTime)], 'khutbah', m.khutbah);
    } else {
      const info = result.bayanInfo;
      title = (content.jumuahBayan || {}).text;
      detail = (info && info.speaker ? `<div class="jumuah-speaker">${escapeHtml(info.speaker)}</div>` : '') +
        (info && info.topic ? `<div class="jumuah-topic">${escapeHtml(info.topic)}</div>` : '');
      sched = schedule([pair('khutbah', m.khutbah), pair('iqamah', m.iqamahTime)], 'khutbah', m.khutbah);
    }
    return `
      <div class="screen screen--jumuah jm jm--${phase === 'sunnah' ? 'sunnah' : 'bayan'}">
        <div class="jm-body">
          <div class="jumuah-banner">${escapeHtml(title)}</div>
          ${detail}
          ${sched}
        </div>
        ${jumuahQuietHtml(content, true)}
      </div>`;
  }

  function renderKhutbah(config, result, contentByLang) {
    const content = primaryContent(contentByLang, config);
    const k = content.khutbahScreen || {};
    // Older/partial packs only have the combined line.
    const body = k.title && k.silent
      ? `<div class="khutbah-title">${escapeHtml(k.title)}</div><div class="khutbah-line">${escapeHtml(k.silent)}</div>`
      : `<div class="khutbah-line">${escapeHtml(k.line)}</div>`;
    return `
      <div class="screen screen--khutbah jm jm--khutbah">
        <div class="jm-body">${body}</div>
        ${jumuahQuietHtml(content, false)}
      </div>`;
  }

  // Transient screens (azan, iqamah countdown, luha timer, Jumu'ah…)
  // take over the whole board, which used to hide the time. A small corner
  // clock keeps "what time is it now?" answerable on every screen. NORMAL
  // already has the big hero clock; SALAH and NIGHT already show their own
  // (deliberately dim) clock, so they are left as they are.
  const CORNER_CLOCK_STATES = ['AZAN', 'BETWEEN', 'IQAMAH', 'AFTER',
    'LUHA_WAIT', 'LUHA_OPEN', 'JUMUAH', 'KHUTBAH'];

  // "AM"/"PM" for 12-hour clocks, '' for 24-hour. Latin in every language,
  // like the digits.
  function ampmOf(config, now) {
    if (config.clock && config.clock.format === '24h') return '';
    return now.getHours() < 12 ? 'AM' : 'PM';
  }

  function cornerClockHtml(config, result) {
    if (!CORNER_CLOCK_STATES.includes(result.state)) return '';
    // AM/PM at the clock's own size here (board feedback) — the corner clock
    // is small already, so a reduced suffix would be hard to read.
    const period = ampmOf(config, result.now);
    // During the bayan and the khutbah the seconds would be the only thing
    // moving on a deliberately calm screen — show hours:minutes there.
    const calm = result.state === 'JUMUAH' || result.state === 'KHUTBAH';
    const clockCfg = calm ? Object.assign({}, config, { clock: Object.assign({}, config.clock, { showSeconds: false }) }) : config;
    return `<div class="corner-clock">${escapeHtml(global.SBEngine.formatClock(result.now, clockCfg))}` +
      (period ? `<span class="corner-ampm">${period}</span>` : '') + `</div>`;
  }

  const RENDERERS = {
    NORMAL: renderNormal,
    AZAN: renderAzan,
    BETWEEN: renderBetween,
    IQAMAH: renderIqamah,
    SALAH: renderSalah,
    AFTER: renderAfter,
    LUHA_WAIT: renderLuhaWait,
    LUHA_OPEN: renderLuhaOpen,
    NIGHT: renderNight,
    JUMUAH: renderJumuah,
    KHUTBAH: renderKhutbah,
  };

  // ── Screen transitions ───────────────────────────────────
  // Before the new screen replaces the old one, a clone of the old board is
  // laid over it and faded out (opacity only: compositor-cheap, no blur, no
  // filters). Off by default; docs/CONFIG-SCHEMA.md "transitions".
  //
  // HOOK for the lively transition Shehan picks (review/transitions/
  // screens.html): set SBUi.hooks.transitionHook to
  //   function (ctx) -> true if it animated, false/undefined to fall back to
  // the fade. ctx = { from, to, quiet, old (the cloned old board, on top),
  // root (the live new board), config, ms, done }. Used only when
  // mode = "lively"; the hook owns `old` and must call ctx.done() when finished.
  // Quiet destinations (QUIET_STATES) always get the muted fade.
  const QUIET_STATES = ['SALAH', 'NIGHT', 'JUMUAH', 'KHUTBAH'];
  let lastState = null;
  let activeOverlay = null;
  const hooks = { transitionHook: null };

  function reducedMotion() {
    return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function startTransition(container, nextState, config) {
    const prev = lastState;
    if (prev === nextState) return; // the board re-renders every second; only a real change animates
    lastState = nextState;
    const tr = config.transitions || {};
    if (activeOverlay) { activeOverlay.remove(); activeOverlay = null; }
    if (!prev || !tr.mode || tr.mode === 'off'
        || reducedMotion() || !container.firstChild || !container.animate) return;
    const old = container.cloneNode(true); // keeps id + inline vars, so theme CSS still applies
    old.style.position = 'fixed';
    old.style.inset = '0';
    old.style.zIndex = '40'; // above the screen, below #night-overlay (50)
    old.style.pointerEvents = 'none';
    old.setAttribute('aria-hidden', 'true');
    container.parentNode.appendChild(old); // after the live root, so getElementById still finds it
    activeOverlay = old;
    const quiet = QUIET_STATES.indexOf(nextState) >= 0;
    const ms = Math.round((tr.fadeMs || 1200) * (quiet ? 1.25 : 1));
    const done = () => { old.remove(); if (activeOverlay === old) activeOverlay = null; };
    if (tr.mode === 'lively' && !quiet && typeof hooks.transitionHook === 'function') {
      let handled = false;
      try { handled = hooks.transitionHook({ from: prev, to: nextState, quiet, old, root: container, config, ms, done }); } catch (e) { handled = false; }
      if (handled) return;
    }
    const a = old.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms, easing: 'ease-in-out', fill: 'forwards' });
    a.onfinish = a.oncancel = done;
  }

  function render(container, result, config, contentByLang) {
    startTransition(container, result.state, config);
    const fn = RENDERERS[result.state] || renderNormal;
    // Arabic honorific ligatures (ﷺ ﷻ … U+FDF0–FDFF) pack a whole phrase into
    // one character, unreadable at text size — wrap them so CSS can enlarge
    // them (layout.css .honorific). Text is already escaped, so these
    // characters can only be in text, never inside a tag.
    const html = (cornerClockHtml(config, result) + fn(config, result, contentByLang))
      // The space before it becomes non-breaking, so the honorific never
      // wraps away from the name it follows ("Muhammad" / "ﷺ" on two lines).
      .replace(/[ \u00A0]?([\uFDF0-\uFDFF])/g, '&nbsp;<span class="honorific">$1</span>');
    container.innerHTML = html;
    // phase-*: lets a theme tell Jumu'ah sunnah and bayan apart (both JUMUAH).
    const phase = result.meta && result.meta.phase ? ` phase-${result.meta.phase}` : '';
    container.className = `screen-root theme-${config.theme} state-${result.state.toLowerCase()}${phase}`;
    if (result.state === 'NORMAL') { fitMasjidName(container, config); fitNextName(container); fitBannerSlides(container); fitHero(container); }
    if (result.state === 'JUMUAH' || result.state === 'KHUTBAH') fitQuiet(container);
  }

  function applyNightDim(overlayEl, active, brightnessPercent) {
    if (active) {
      const opacity = Math.max(0, Math.min(1, 1 - (brightnessPercent || 0) / 100));
      overlayEl.style.opacity = String(opacity);
      overlayEl.style.pointerEvents = 'none';
    } else {
      overlayEl.style.opacity = '0';
    }
    // Android shell (M3/ARCHITECTURE.md shell responsibility #6): also
    // drive the real backlight when the JS bridge is present, so NIGHT
    // dims the panel itself instead of only a CSS overlay. Browser dev
    // and any non-Android host just skip this — the overlay above is
    // already the full visual effect there.
    if (window.SalahBridge && typeof window.SalahBridge.setBrightness === 'function') {
      window.SalahBridge.setBrightness(active ? (brightnessPercent || 0) : 100);
    }
  }

  global.SBUi = { render, applyNightDim, escapeHtml, primaryContent, hooks };

})(window);
