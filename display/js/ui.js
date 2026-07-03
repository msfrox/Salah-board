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
    const cells = [
      { key: 'fajr', label: label(content, 'fajr'), time: fmtRowTime(row.fajr, config, result) },
      { key: 'sunrise', label: label(content, 'sunrise'), time: fmtRowTime(row.sunrise, config, result) },
    ];
    cells.push({ key: 'luhr', label: label(content, result.isJumuahDay ? 'jumuah' : 'luhr'), time: fmtRowTime(row.luhr, config, result) });
    cells.push({ key: 'asr', label: label(content, 'asr'), time: fmtRowTime(row.asr, config, result) });
    cells.push({ key: 'magrib', label: label(content, 'magrib'), time: fmtRowTime(row.magrib, config, result) });
    cells.push({ key: 'isha', label: label(content, 'isha'), time: fmtRowTime(row.isha, config, result) });
    return cells;
  }

  function timetableCardHtml(content, config, result) {
    const cells = timetableCells(content, config, result);
    return `<div class="card card--timetable"><div class="timetable-strip">${
      cells.map(c => `<div class="tt-cell"><span class="tt-label">${escapeHtml(c.label)}</span><span class="tt-time">${escapeHtml(c.time)}</span></div>`).join('')
    }</div></div>`;
  }

  function noticeCardHtml(content, config, result) {
    const ls = langs(config);
    const notices = activeNotices(config.notices, result.now).filter(n => n.priority !== 'high');
    if (!notices.length) return '';
    const idx = rotationIndex(result.now, config.rotation.seconds, notices.length);
    const n = notices[idx];
    return `<div class="card card--notice"><p class="notice-text">${escapeHtml(pickNoticeText(n, ls))}</p></div>`;
  }

  function jumuahEtiquetteCardHtml(content, config, result) {
    const items = content.jumuahEtiquette || [];
    if (!items.length) return '';
    const idx = rotationIndex(result.now, config.rotation.seconds, items.length);
    const item = items[idx];
    return `<div class="card card--etiquette"><p class="etiquette-text">${escapeHtml(item.text)}</p></div>`;
  }

  // The full timetable strip is already always-on (per SPEC's NORMAL row),
  // so it's dropped here to avoid showing it twice — this region only
  // rotates the genuinely rotating cards (notices, Jumu'ah etiquette).
  function rotationCardHtml(content, config, result) {
    let cards = (config.rotation.cards || []).filter(c => c !== 'timetable');
    if (!result.isJumuahDay) cards = cards.filter(c => c !== 'jumuah-etiquette');
    if (!cards.length) return '';
    const idx = rotationIndex(result.now, config.rotation.seconds, cards.length);
    const card = cards[idx];
    if (card === 'notices') return noticeCardHtml(content, config, result);
    if (card === 'jumuah-etiquette') return jumuahEtiquetteCardHtml(content, config, result);
    return '';
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
    const next = result.nextAzan;
    const azanTime = next ? E.formatTime(next.time, config) : '--:--';
    const iqamahTime = next && next.iqamahTime ? E.formatTime(next.iqamahTime, config) : '--:--';
    const countdown = next ? E.fmtCountdown(next.time - result.now) : '--:--';
    const nextName = next ? prayerLabel(content, next.prayer, next.jumuah) : '—';

    let jumuahBanner = '';
    if (result.isJumuahDay) {
      const todayRow = result.rows.today;
      const bayanPart = config.jumuah.bayan
        ? ` · ${escapeHtml(label(content, 'bayan'))} ${escapeHtml(E.formatTime(E.parseTime(config.jumuah.bayan, result.dates.today), config))}`
        : '';
      const jumuahAzanTime = todayRow ? fmtRowTime(todayRow.luhr, config, result) : '--:--';
      jumuahBanner = `<div class="jumuah-day-banner">${escapeHtml(label(content, 'jumuahToday'))}` +
        `${bayanPart} · ${escapeHtml(label(content, 'azan'))} ${escapeHtml(jumuahAzanTime)}</div>`;
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
            <div class="clock-big">${clockStr}</div>
          </div>
          <div class="card hero-next">
            <span class="np-label">${escapeHtml(label(content, 'nextPrayer'))}</span>
            <span class="np-name">${escapeHtml(nextName)}</span>
            <div class="np-times">
              <div class="np-time-col">
                <span class="np-time-label">${escapeHtml(label(content, 'azan'))}</span>
                <span class="np-time">${escapeHtml(azanTime)}</span>
              </div>
              <div class="np-divider"></div>
              <div class="np-time-col">
                <span class="np-time-label">${escapeHtml(label(content, 'iqamah'))}</span>
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
        <div class="phones-silent-icon">📵</div>
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

  function renderSunriseWait(config, result, contentByLang) {
    const content = primaryContent(contentByLang, config);
    const E = global.SBEngine;
    const countdown = E.fmtCountdown(result.segEnd - result.now);
    return `
      <div class="screen screen--sunrise-wait">
        <div class="countdown-label">${escapeHtml(label(content, 'sunrise'))}</div>
        <div class="countdown">${countdown}</div>
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

  function renderJumuah(config, result, contentByLang) {
    const content = primaryContent(contentByLang, config);
    return `
      <div class="screen screen--jumuah">
        <div class="jumuah-banner">${escapeHtml((content.jumuahBayan || {}).text)}</div>
        ${jumuahEtiquetteCardHtml(content, config, result)}
      </div>`;
  }

  function renderKhutbah(config, result, contentByLang) {
    const content = primaryContent(contentByLang, config);
    return `
      <div class="screen screen--khutbah">
        <div class="khutbah-line">${escapeHtml((content.khutbahScreen || {}).line)}</div>
      </div>`;
  }

  const RENDERERS = {
    NORMAL: renderNormal,
    AZAN: renderAzan,
    BETWEEN: renderBetween,
    IQAMAH: renderIqamah,
    SALAH: renderSalah,
    AFTER: renderAfter,
    SUNRISE_WAIT: renderSunriseWait,
    LUHA_WAIT: renderLuhaWait,
    LUHA_OPEN: renderLuhaOpen,
    NIGHT: renderNight,
    JUMUAH: renderJumuah,
    KHUTBAH: renderKhutbah,
  };

  function render(container, result, config, contentByLang) {
    const fn = RENDERERS[result.state] || renderNormal;
    container.innerHTML = fn(config, result, contentByLang);
    container.className = `screen-root theme-${config.theme} state-${result.state.toLowerCase()}`;
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

  global.SBUi = { render, applyNightDim, escapeHtml, primaryContent };

})(window);
