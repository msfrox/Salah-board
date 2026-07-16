/* ============================================================
   Salah Board — preview.js  (admin Preview tab: dev/test states)

   Opens the LIVE display forced into any of the 13 states using the
   existing ?state= / ?t= debug params (display/js/main.js + state.js),
   so a caretaker or dev can eyeball every screen without waiting for
   that time of day. No display-side changes needed.
   ============================================================ */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);

  // Ordered to match README-designs.md's 13 states (LUHA_OPEN etc.).
  const STATES = [
    ['normal', 'Normal'],
    ['azan', 'Azan'],
    ['between', 'Between (iqamah countdown)'],
    ['iqamah', 'Iqamah (straighten rows)'],
    ['salah', 'Salah in progress'],
    ['after', 'After salah (adhkar)'],
    ['sunrise-wait', 'Sunrise wait'],
    ['luha-wait', 'Luha wait'],
    ['luha-open', 'Luha open'],
    ['night', 'Night'],
    ['jumuah', "Jumu'ah (bayan)"],
    ['khutbah', 'Khutbah'],
  ];

  function previewUrl(state) {
    const params = new URLSearchParams();
    if (state) params.set('state', state);
    const t = $('#preview-time') && $('#preview-time').value;
    if (t) params.set('t', t); // "YYYY-MM-DDTHH:MM" — exactly what main.js expects
    const qs = params.toString();
    return '../display/' + (qs ? '?' + qs : '');
  }

  function build() {
    const grid = $('#preview-grid');
    if (!grid) return;
    grid.innerHTML = STATES.map(([key, label]) =>
      `<button type="button" class="btn btn--secondary preview-btn" data-state="${key}">${label}</button>`
    ).join('');
    grid.addEventListener('click', e => {
      const btn = e.target.closest('[data-state]');
      if (btn) window.open(previewUrl(btn.getAttribute('data-state')), '_blank');
    });
    const live = $('#preview-open-live');
    if (live) live.addEventListener('click', () => window.open(previewUrl(null), '_blank'));
  }

  build();
})();
