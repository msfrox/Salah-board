/* ============================================================
   Salah Board — admin.js
   Mobile-first settings form for the whole config.json surface
   (docs/CONFIG-SCHEMA.md). Browser-dev mode: reads/writes the same
   localStorage key as the display (sb_config) via display/js/config.js,
   so opening the display in a second tab reflects a Save through the
   existing `storage` event listener in main.js — no extra plumbing.
   Android (M3+) swaps loadConfig/persistConfig for GET/PUT /api/config
   without touching the rest of this file (see admin/api.md).
   ============================================================ */
(function () {
  'use strict';

  const PRAYERS = [
    { key: 'fajr', label: 'Fajr' },
    { key: 'luhr', label: 'Zuhr' },
    { key: 'asr', label: 'Asr' },
    { key: 'magrib', label: 'Maghrib' },
    { key: 'isha', label: 'Isha' },
  ];
  const LANGS = [
    { key: 'ta', label: 'Tamil' },
    { key: 'si', label: 'Sinhala' },
    { key: 'en', label: 'English' },
  ];
  const ROUND_OPTIONS = [0, 5, 10, 15];

  // Advanced tab — NORMAL-screen elements that can be resized / hidden.
  // Keys match config.layout.normal (docs/CONFIG-SCHEMA.md) and
  // display/css/layout.css.
  const LAYOUT_SIZES = [
    { key: 'masjidName', label: 'Masjid name' },
    { key: 'dates', label: 'Dates (Gregorian · Hijri)' },
    { key: 'clock', label: 'Clock' },
    { key: 'nextLabel', label: '"Next prayer" label' },
    { key: 'nextName', label: 'Next prayer name' },
    { key: 'timeLabels', label: '"Azan" / "Iqamah" labels' },
    { key: 'prayerTimes', label: 'Azan & iqamah times (big numbers)' },
    { key: 'countdown', label: 'Countdown to azan' },
    { key: 'ttLabels', label: 'Timetable — prayer names' },
    { key: 'ttTimes', label: 'Timetable — times' },
    { key: 'banners', label: "Banners (Jumu'ah, pinned notice, Ramadan)" },
    { key: 'cards', label: 'Rotating notice cards' },
  ];
  const LAYOUT_SHOW = [
    { key: 'masjidName', label: 'Masjid name' },
    { key: 'dates', label: 'Dates' },
    { key: 'nextLabel', label: '"Next prayer" label' },
    { key: 'countdown', label: 'Countdown to azan' },
    { key: 'timetable', label: "Today's timetable strip" },
    { key: 'cards', label: 'Rotating notice cards' },
  ];

  const pad2 = n => String(n).padStart(2, '0');
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  // ── Path get/set on plain nested objects ────────────────
  function getPath(obj, path) {
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  }
  function setPath(obj, path, value) {
    const keys = path.split('.');
    let cur = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!isPlainObject(cur[keys[i]])) cur[keys[i]] = {};
      cur = cur[keys[i]];
    }
    cur[keys[keys.length - 1]] = value;
  }
  function isPlainObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  }

  // ── 12h "h:mm AM/PM" <-> <input type=time> "HH:mm" ──────
  function ampmToInputValue(str) {
    const d = str && SBEngine.parseTime(str, new Date(2000, 0, 1));
    return d ? `${pad2(d.getHours())}:${pad2(d.getMinutes())}` : '';
  }
  function inputValueToAmpm(v) {
    if (!v) return '';
    const [hh, mm] = v.split(':').map(Number);
    let h = hh % 12; if (h === 0) h = 12;
    return `${h}:${pad2(mm)} ${hh >= 12 ? 'PM' : 'AM'}`;
  }

  // ── Config load/save — /api/config on Android, localStorage in
  //    browser-dev, same shape either way (see admin/api.md) ──
  async function loadConfig() {
    const cfg = SBConfig.deepMerge(SBConfig.defaults(), await SBConfig.getStoredAsync());
    if (cfg.theme === 'highcontrast') cfg.theme = 'default'; // renamed theme — migrate
    return cfg;
  }
  async function persistConfig(config) {
    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (res.ok) return true;
    } catch (e) { /* not running under the shell server — fall through */ }
    return SBConfig.save(config);
  }

  let notices = [];

  // ── Dynamic row builders ─────────────────────────────────
  function iqamahRowHtml(prayer) {
    return `
      <div class="subcard" data-prayer="${prayer.key}">
        <h4>${prayer.label}</h4>
        <label class="field">
          <span>Mode</span>
          <select data-path="iqamah.${prayer.key}.mode" class="iqamah-mode">
            <option value="offset">Offset after azan</option>
            <option value="fixed">Fixed time</option>
          </select>
        </label>
        <div class="mode-offset">
          <label class="field">
            <span>Minutes after azan</span>
            <input type="number" min="0" step="1" data-path="iqamah.${prayer.key}.minutes" data-number>
          </label>
          <label class="field">
            <span>Round up to nearest</span>
            <select data-path="iqamah.${prayer.key}.round" data-number>
              ${ROUND_OPTIONS.map(r => `<option value="${r}">${r === 0 ? 'No rounding' : r + ' min'}</option>`).join('')}
            </select>
          </label>
        </div>
        <div class="mode-fixed">
          <label class="field">
            <span>Fixed time</span>
            <input type="time" data-path="iqamah.${prayer.key}.time" data-time="ampm">
          </label>
        </div>
      </div>`;
  }

  function salahDurationRowHtml(prayer) {
    return `
      <label class="field">
        <span>${prayer.label}</span>
        <input type="number" min="1" step="1" data-path="screens.salahDuration.${prayer.key}" data-number>
      </label>`;
  }

  function layoutSizeRowHtml(item) {
    const id = `layout-size-${item.key}`;
    return `
      <div class="field layout-size">
        <span><label for="${id}">${item.label}</label> <strong class="layout-size-value" data-for="${id}">100%</strong></span>
        <div class="stepper">
          <button type="button" class="btn btn--secondary stepper-btn" data-step="-5" data-target="${id}" aria-label="Smaller">−</button>
          <input type="range" id="${id}" class="layout-range" min="${SBConfig.LAYOUT_MIN}" max="${SBConfig.LAYOUT_MAX}" step="5"
                 data-path="layout.normal.sizes.${item.key}" data-number>
          <button type="button" class="btn btn--secondary stepper-btn" data-step="5" data-target="${id}" aria-label="Bigger">+</button>
        </div>
      </div>`;
  }

  function layoutShowRowHtml(item) {
    return `
      <label class="field checkbox-field">
        <input type="checkbox" data-path="layout.normal.show.${item.key}">
        <span>${item.label}</span>
      </label>`;
  }

  function refreshLayoutValues() {
    $$('.layout-range').forEach(r => {
      const out = document.querySelector(`.layout-size-value[data-for="${r.id}"]`);
      if (out) out.textContent = `${r.value}%`;
    });
  }

  function ramadanOverrideRowHtml(prayer) {
    return `
      <div class="subcard" data-ramadan-prayer="${prayer.key}">
        <label class="field checkbox-field">
          <input type="checkbox" class="ramadan-override-enabled" data-prayer="${prayer.key}">
          <span>Override ${prayer.label} iqamah during Ramadan</span>
        </label>
        <div class="ramadan-override-body hidden">
          <label class="field">
            <span>Mode</span>
            <select data-path="ramadan.iqamahOverrides.${prayer.key}.mode" class="iqamah-mode">
              <option value="offset">Offset after azan</option>
              <option value="fixed">Fixed time</option>
            </select>
          </label>
          <div class="mode-offset">
            <label class="field">
              <span>Minutes after azan</span>
              <input type="number" min="0" step="1" data-path="ramadan.iqamahOverrides.${prayer.key}.minutes" data-number>
            </label>
            <label class="field">
              <span>Round up to nearest</span>
              <select data-path="ramadan.iqamahOverrides.${prayer.key}.round" data-number>
                ${ROUND_OPTIONS.map(r => `<option value="${r}">${r === 0 ? 'No rounding' : r + ' min'}</option>`).join('')}
              </select>
            </label>
          </div>
          <div class="mode-fixed">
            <label class="field">
              <span>Fixed time</span>
              <input type="time" data-path="ramadan.iqamahOverrides.${prayer.key}.time" data-time="ampm">
            </label>
          </div>
        </div>
      </div>`;
  }

  function taraweehNoteRowHtml(lang) {
    return `
      <label class="field">
        <span>${lang.label}</span>
        <textarea data-path="ramadan.taraweehNote.${lang.key}" rows="2"></textarea>
      </label>`;
  }

  function noticeCardHtml(n, idx) {
    return `
      <div class="subcard notice-card" data-notice-idx="${idx}">
        <label class="field checkbox-field">
          <span>Priority</span>
          <select class="notice-priority">
            <option value="normal" ${n.priority !== 'high' ? 'selected' : ''}>Normal (joins rotation)</option>
            <option value="high" ${n.priority === 'high' ? 'selected' : ''}>High (pinned banner)</option>
          </select>
        </label>
        ${LANGS.map(l => `
          <label class="field">
            <span>Text (${l.label})</span>
            <input type="text" class="notice-text" data-lang="${l.key}" value="${escapeAttr((n.text && n.text[l.key]) || '')}">
          </label>`).join('')}
        <label class="field">
          <span>From (optional)</span>
          <input type="date" class="notice-from" value="${n.from || ''}">
        </label>
        <label class="field">
          <span>To (optional)</span>
          <input type="date" class="notice-to" value="${n.to || ''}">
        </label>
        <button type="button" class="btn btn--danger notice-remove">Remove notice</button>
      </div>`;
  }

  function escapeAttr(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function renderNotices() {
    $('#notices-list').innerHTML = notices.length
      ? notices.map(noticeCardHtml).join('')
      : '<p class="hint">No notices yet.</p>';
  }

  // ── Build static-per-load dynamic sections ──────────────
  function buildDynamicSections() {
    $('#iqamah-rows').innerHTML = PRAYERS.map(iqamahRowHtml).join('');
    $('#salah-duration-rows').innerHTML = PRAYERS.map(salahDurationRowHtml).join('');
    $('#ramadan-override-rows').innerHTML = PRAYERS.map(ramadanOverrideRowHtml).join('');
    $('#taraweeh-note-rows').innerHTML = LANGS.map(taraweehNoteRowHtml).join('');
    $('#layout-size-rows').innerHTML = LAYOUT_SIZES.map(layoutSizeRowHtml).join('');
    $('#layout-show-rows').innerHTML = LAYOUT_SHOW.map(layoutShowRowHtml).join('');
  }

  // Options load async — callers must await this before populateForm() sets
  // the select's value, otherwise the value is set with no matching
  // <option> yet and gets silently dropped.
  function populateZoneOptions() {
    const sel = $('#zone-select');
    return fetch('../display/data/zones.json')
      .then(r => r.json())
      .then(data => {
        sel.innerHTML = (data.zones || []).map(z =>
          `<option value="${z.id}">${escapeAttr(z.name)} — ${escapeAttr((z.districts || []).join(', '))}</option>`
        ).join('');
      })
      .catch(() => {
        sel.innerHTML = Array.from({ length: 13 }, (_, i) => pad2(i + 1))
          .map(id => `<option value="${id}">Zone ${id}</option>`).join('');
      });
  }

  function updateModeVisibility(container) {
    container.querySelectorAll('.iqamah-mode').forEach(sel => {
      const subcard = sel.closest('.subcard');
      const isFixed = sel.value === 'fixed';
      subcard.querySelector('.mode-offset').classList.toggle('hidden', isFixed);
      subcard.querySelector('.mode-fixed').classList.toggle('hidden', !isFixed);
    });
  }

  // ── Populate the whole form from a config object ────────
  function populateForm(config) {
    $$('#admin-form [data-path]').forEach(el => {
      const path = el.getAttribute('data-path');
      const val = getPath(config, path);
      if (el.type === 'checkbox') {
        el.checked = !!val;
      } else if (el.type === 'radio') {
        el.checked = (el.value === val);
      } else if (el.dataset.time === 'ampm') {
        el.value = ampmToInputValue(val || '');
      } else {
        el.value = (val === undefined || val === null) ? '' : val;
      }
    });

    // Languages
    const langs = config.masjid.languages || [];
    $$('[data-lang]').forEach(cb => { cb.checked = langs.includes(cb.getAttribute('data-lang')); });
    refreshPrimaryLangOptions(langs);

    // Jumu'ah bayan enabled toggle
    const bayanEnabled = !!config.jumuah.bayan;
    $('#bayan-enabled').checked = bayanEnabled;
    $('#bayan-details').classList.toggle('hidden', !bayanEnabled);
    $('#bayan-date').value = config.jumuah.bayanDate || '';

    // Ramadan overrides enabled toggles
    PRAYERS.forEach(p => {
      const enabled = !!(config.ramadan.iqamahOverrides && config.ramadan.iqamahOverrides[p.key]);
      const cb = document.querySelector(`.ramadan-override-enabled[data-prayer="${p.key}"]`);
      cb.checked = enabled;
      cb.closest('.subcard').querySelector('.ramadan-override-body').classList.toggle('hidden', !enabled);
    });

    // Rotation cards
    $$('[data-rotation-card]').forEach(cb => {
      cb.checked = (config.rotation.cards || []).includes(cb.getAttribute('data-rotation-card'));
    });

    // Notices
    notices = JSON.parse(JSON.stringify(config.notices || []));
    renderNotices();

    // Sliders' live labels
    $('#scale-value').textContent = Number(config.display.scale).toFixed(1);
    $('#brightness-value').textContent = config.night.brightness;
    refreshLayoutValues();
    // (The Time tab manages #time-status itself — see time.js.)

    updateModeVisibility(document);
  }

  function refreshPrimaryLangOptions(currentLangs) {
    const enabledKeys = LANGS.filter(l => document.querySelector(`[data-lang="${l.key}"]`)?.checked).map(l => l.key);
    const keys = enabledKeys.length ? enabledKeys : (currentLangs.length ? currentLangs : ['en']);
    const sel = $('#primary-lang');
    const prevPrimary = currentLangs[0];
    sel.innerHTML = keys.map(k => `<option value="${k}">${LANGS.find(l => l.key === k).label}</option>`).join('');
    if (keys.includes(prevPrimary)) sel.value = prevPrimary;
  }

  // ── Collect the whole form into a config object ─────────
  function collectForm(base) {
    const config = JSON.parse(JSON.stringify(base));

    $$('#admin-form [data-path]').forEach(el => {
      const path = el.getAttribute('data-path');
      if (el.type === 'radio') {
        if (el.checked) setPath(config, path, el.value);
        return;
      }
      let val;
      if (el.type === 'checkbox') {
        val = el.checked;
      } else if (el.dataset.time === 'ampm') {
        val = inputValueToAmpm(el.value);
      } else if (el.hasAttribute('data-number')) {
        val = el.value === '' ? 0 : Number(el.value);
      } else {
        val = el.value;
      }
      setPath(config, path, val);
    });

    // Languages: checked boxes, primary first
    const enabled = LANGS.filter(l => document.querySelector(`[data-lang="${l.key}"]`).checked).map(l => l.key);
    const primary = $('#primary-lang').value;
    config.masjid.languages = enabled.length
      ? [primary, ...enabled.filter(l => l !== primary)]
      : ['en'];

    // Jumu'ah bayan: null when disabled
    config.jumuah.bayan = $('#bayan-enabled').checked ? inputValueToAmpm($('#bayan-time').value) : null;
    config.jumuah.bayanSpeaker = String(config.jumuah.bayanSpeaker || '').trim();
    config.jumuah.bayanTopic = String(config.jumuah.bayanTopic || '').trim();
    config.jumuah.bayanDate = $('#bayan-date').value || null;

    // Ramadan overrides: delete key entirely when disabled (sparse per spec)
    config.ramadan.iqamahOverrides = config.ramadan.iqamahOverrides || {};
    PRAYERS.forEach(p => {
      const enabled = document.querySelector(`.ramadan-override-enabled[data-prayer="${p.key}"]`).checked;
      if (!enabled) delete config.ramadan.iqamahOverrides[p.key];
    });

    // Rotation cards: always keep 'timetable' (always-on, harmless no-op) + checked ones
    const rotationChecked = $$('[data-rotation-card]').filter(cb => cb.checked).map(cb => cb.getAttribute('data-rotation-card'));
    config.rotation.cards = ['timetable', ...rotationChecked];

    // Notices: read back from the rendered cards (order preserved)
    config.notices = readNoticesFromDom();

    return config;
  }

  // Shared by collectForm and by add/remove so in-progress edits to OTHER
  // notice cards aren't lost when the list re-renders (renderNotices()
  // rebuilds every card from the `notices` array).
  function readNoticesFromDom() {
    return $$('.notice-card').map(card => {
      const text = {};
      card.querySelectorAll('.notice-text').forEach(inp => {
        if (inp.value.trim()) text[inp.getAttribute('data-lang')] = inp.value.trim();
      });
      const from = card.querySelector('.notice-from').value || undefined;
      const to = card.querySelector('.notice-to').value || undefined;
      const idx = card.getAttribute('data-notice-idx');
      const existing = notices[idx] || {};
      return {
        id: existing.id || `notice-${Date.now().toString(36)}-${idx}`,
        text,
        from, to,
        priority: card.querySelector('.notice-priority').value,
      };
    });
  }

  // ── Validation ───────────────────────────────────────────
  function validate(config) {
    const errors = [];
    if (!isPlainObject(config)) return ['Config must be a JSON object.'];

    if (!config.masjid || !config.masjid.name || !String(config.masjid.name).trim()) {
      errors.push('Masjid name is required.');
    }
    if (!/^\d{2}$/.test(config.zone) || Number(config.zone) < 1 || Number(config.zone) > 13) {
      errors.push('Zone must be one of the 13 ACJU zones.');
    }
    const scale = Number(config.display && config.display.scale);
    if (!Number.isFinite(scale) || scale < 0.2 || scale > 5.0) {
      errors.push('Display scale must be between 0.2 and 5.0.');
    }
    PRAYERS.forEach(p => {
      const rule = config.iqamah && config.iqamah[p.key];
      if (!rule) { errors.push(`Missing iqamah rule for ${p.label}.`); return; }
      if (rule.mode === 'fixed' && !rule.time) errors.push(`${p.label} iqamah: fixed time is required.`);
      if (rule.mode === 'offset' && !(Number(rule.minutes) >= 0)) errors.push(`${p.label} iqamah: minutes must be 0 or more.`);
    });
    ['azan', 'iqamahWarning', 'after'].forEach(k => {
      if (!(Number(config.screens[k]) >= 0)) errors.push(`Screen duration "${k}" must be 0 or more.`);
    });
    PRAYERS.forEach(p => {
      if (!(Number(config.screens.salahDuration[p.key]) > 0)) errors.push(`Salah duration for ${p.label} must be more than 0.`);
    });
    if (config.jumuah.enabled) {
      if (!config.jumuah.iqamah) errors.push("Jumu'ah iqamah time is required when Jumu'ah mode is enabled.");
      if (!(Number(config.jumuah.salahDuration) > 0)) errors.push("Jumu'ah salah duration must be more than 0.");
    }
    if (config.jumuah.bayanDate) {
      const d = new Date(config.jumuah.bayanDate + 'T12:00:00');
      if (isNaN(d.getTime())) errors.push("Bayan date is not a valid date.");
      else if (d.getDay() !== 5) errors.push("Bayan date must be a Friday (or leave it empty).");
    }
    if (config.luha.enabled && !(Number(config.luha.waitAfterSunrise) >= 0)) {
      errors.push('Luha wait-after-sunrise must be 0 or more.');
    }
    if (config.ramadan && config.ramadan.iqamahOverrides) {
      Object.keys(config.ramadan.iqamahOverrides).forEach(key => {
        const rule = config.ramadan.iqamahOverrides[key];
        if (rule.mode === 'fixed' && !rule.time) errors.push(`Ramadan override (${key}): fixed time is required.`);
        if (rule.mode === 'offset' && !(Number(rule.minutes) >= 0)) errors.push(`Ramadan override (${key}): minutes must be 0 or more.`);
      });
    }
    const brightness = Number(config.night.brightness);
    if (!(brightness >= 0 && brightness <= 100)) errors.push('Night brightness must be between 0 and 100.');
    if (!(Number(config.rotation.seconds) >= 3)) errors.push('Rotation seconds should be at least 3.');

    const sizes = (config.layout && config.layout.normal && config.layout.normal.sizes) || {};
    LAYOUT_SIZES.forEach(item => {
      const v = Number(sizes[item.key]);
      if (!(v >= SBConfig.LAYOUT_MIN && v <= SBConfig.LAYOUT_MAX)) {
        errors.push(`Advanced → "${item.label}" size must be between ${SBConfig.LAYOUT_MIN}% and ${SBConfig.LAYOUT_MAX}%.`);
      }
    });

    (config.notices || []).forEach((n, i) => {
      const hasText = n.text && Object.values(n.text).some(v => v && String(v).trim());
      if (!hasText) errors.push(`Notice #${i + 1}: needs text in at least one language.`);
      if (n.from && n.to && n.from > n.to) errors.push(`Notice #${i + 1}: "from" date must not be after "to" date.`);
    });

    return errors;
  }

  function showErrors(errors) {
    const box = $('#error-summary');
    if (!errors.length) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML = `<strong>Please fix ${errors.length} issue${errors.length > 1 ? 's' : ''}:</strong><ul>${
      errors.map(e => `<li>${escapeAttr(e)}</li>`).join('')
    }</ul>`;
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function showToast(msg, isError) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    t.className = 'toast' + (isError ? ' toast--error' : '');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => { t.hidden = true; }, 3500);
  }

  // ── Export / Import ─────────────────────────────────────
  function exportConfig(config) {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const name = (config.masjid.name || 'salah-board').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    a.href = url;
    a.download = `${name || 'salah-board'}-config.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function importConfig(file) {
    const reader = new FileReader();
    reader.onload = () => {
      let parsed;
      try {
        parsed = JSON.parse(reader.result);
      } catch (e) {
        showToast('Import failed: not a valid JSON file.', true);
        return;
      }
      if (!isPlainObject(parsed)) {
        showToast('Import failed: file does not contain a config object.', true);
        return;
      }
      const merged = SBConfig.deepMerge(SBConfig.defaults(), parsed);
      const errors = validate(merged);
      if (errors.length) {
        showErrors(errors);
        showToast('Import rejected — the file has invalid settings.', true);
        return;
      }
      populateForm(merged);
      persistConfig(merged);
      showToast('Config imported and saved.');
    };
    reader.onerror = () => showToast('Import failed: could not read the file.', true);
    reader.readAsText(file);
  }

  // ── Wiring ───────────────────────────────────────────────
  function wireEvents() {
    document.addEventListener('change', e => {
      if (e.target.classList.contains('iqamah-mode')) updateModeVisibility(document);
      if (e.target.id === 'bayan-enabled') {
        $('#bayan-details').classList.toggle('hidden', !e.target.checked);
      }
      if (e.target.classList.contains('ramadan-override-enabled')) {
        e.target.closest('.subcard').querySelector('.ramadan-override-body').classList.toggle('hidden', !e.target.checked);
      }
      if (e.target.matches('[data-lang]')) {
        refreshPrimaryLangOptions(LANGS.filter(l => document.querySelector(`[data-lang="${l.key}"]`).checked).map(l => l.key));
      }
    });

    $('#scale-range').addEventListener('input', e => { $('#scale-value').textContent = Number(e.target.value).toFixed(1); });
    $('#brightness-range').addEventListener('input', e => { $('#brightness-value').textContent = e.target.value; });

    // Advanced tab: live % labels, −/+ fine steps, reset.
    document.addEventListener('input', e => { if (e.target.classList.contains('layout-range')) refreshLayoutValues(); });
    $('#layout-size-rows').addEventListener('click', e => {
      const btn = e.target.closest('.stepper-btn');
      if (!btn) return;
      const range = document.getElementById(btn.dataset.target);
      const v = Math.max(SBConfig.LAYOUT_MIN, Math.min(SBConfig.LAYOUT_MAX, Number(range.value) + Number(btn.dataset.step)));
      range.value = v;
      range.dispatchEvent(new Event('input', { bubbles: true }));
    });
    $('#layout-reset').addEventListener('click', () => {
      const d = SBConfig.defaults().layout.normal;
      $$('.layout-range').forEach(r => { r.value = d.sizes[r.dataset.path.split('.').pop()]; });
      $$('#layout-show-rows input[type=checkbox]').forEach(cb => { cb.checked = d.show[cb.dataset.path.split('.').pop()] !== false; });
      refreshLayoutValues();
      document.dispatchEvent(new CustomEvent('sb-layout-changed'));
      showToast('Reset — press Save to apply it to the board.');
    });

    $('#add-notice').addEventListener('click', () => {
      notices = readNoticesFromDom();
      notices.push({ text: {}, priority: 'normal' });
      renderNotices();
    });
    $('#notices-list').addEventListener('click', e => {
      if (e.target.classList.contains('notice-remove')) {
        const card = e.target.closest('.notice-card');
        const idx = Number(card.getAttribute('data-notice-idx'));
        if (confirm('Remove this notice?')) {
          notices = readNoticesFromDom();
          notices.splice(idx, 1);
          renderNotices();
        }
      }
    });

    $('#export-btn').addEventListener('click', async () => {
      const config = collectForm(await loadConfig());
      const errors = validate(config);
      if (errors.length) { showErrors(errors); showToast('Fix the errors above before exporting.', true); return; }
      exportConfig(config);
    });

    $('#import-file').addEventListener('change', e => {
      const file = e.target.files[0];
      if (file) importConfig(file);
      e.target.value = '';
    });

    $('#save-btn').addEventListener('click', async () => {
      const config = collectForm(await loadConfig());
      const errors = validate(config);
      if (errors.length) { showErrors(errors); showToast(`Not saved — ${errors.length} issue${errors.length > 1 ? 's' : ''} to fix.`, true); return; }
      showErrors([]);
      await persistConfig(config);
      populateForm(config);
      showToast('Saved. The display updates within a couple of seconds.');
    });
  }

  async function boot() {
    buildDynamicSections();
    await populateZoneOptions();
    wireEvents();
    populateForm(await loadConfig());
  }

  // Shared with the tab feature scripts (time.js, network.js) so they can read
  // and persist the same config through the same /api/config-or-localStorage
  // path, without duplicating that logic. loadConfig() returns the full merged
  // config; persistConfig(config) saves it (board file on the kiosk, else
  // localStorage). validate() lets a feature script reuse the form validator.
  // currentFormConfig() = the form's unsaved state as a full config (used by
  // the Advanced tab's live preview).
  async function currentFormConfig() { return collectForm(await loadConfig()); }
  window.SBAdmin = { loadConfig, persistConfig, validate, currentFormConfig };

  boot();
})();
