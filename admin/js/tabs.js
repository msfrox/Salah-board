/* ============================================================
   Salah Board — tabs.js
   Plain tab switcher for the admin panel. Hidden panels stay in the
   DOM (just [hidden]), so admin.js's populate/collect over every
   [data-path] keeps working across all tabs and the single global
   Save covers the whole form regardless of which tab is showing.
   ============================================================ */
(function () {
  'use strict';
  const tabs = Array.from(document.querySelectorAll('#admin-tabs .tab'));
  const panels = Array.from(document.querySelectorAll('.tab-panel'));
  if (!tabs.length) return;

  function show(name) {
    tabs.forEach(t => {
      const on = t.getAttribute('data-tab') === name;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    panels.forEach(p => {
      const on = p.getAttribute('data-panel') === name;
      p.classList.toggle('active', on);
      p.hidden = !on;
    });
    // Let feature tabs refresh live data when opened.
    document.dispatchEvent(new CustomEvent('sb-tab-shown', { detail: { tab: name } }));
    window.scrollTo(0, 0);
  }

  tabs.forEach(t => t.addEventListener('click', () => show(t.getAttribute('data-tab'))));
})();
