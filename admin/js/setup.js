/* ============================================================
   Salah Board — setup.js  (first-run setup, card SB-10)

   A board that has never saved a config (or saved part-way through
   setup) shows "not set up yet" instead of prayer times. This walks
   the caretaker through the settings that differ between masjids,
   one tab at a time, and asks them to confirm each:
     1. masjid name, languages, ACJU zone   (General)
     2. iqamah times and Luha               (Prayers)
     3. Jumu'ah practice                    (Jumu'ah & Ramadan)
     4. finish: save with setupDone: true -> the display shows times
   The values already in the form are one example (the first masjid
   to use the board); the caretaker confirms or changes them.
   Uses the same form, Save path and validator as the rest of the page.
   ============================================================ */
(function () {
  'use strict';

  const box = document.getElementById('setup-guide');
  if (!box) return;

  const style = document.createElement('style');
  style.textContent = `
    .setup-guide { position: sticky; top: 0; z-index: 50; margin: 0 0 12px;
      background: var(--a-card, #fff); border: 2px solid var(--a-accent, #1f7a4d);
      border-radius: var(--a-radius, 12px); padding: 14px 16px; box-shadow: 0 4px 16px rgba(0,0,0,.08); }
    .setup-guide[hidden] { display: none; }
    .setup-guide h2 { margin: 0 0 .3rem; font-size: 1.1rem; }
    .setup-guide .setup-step { color: var(--a-fg-dim, #5b6472); font-size: .85rem; margin: 0 0 .4rem; }
    .setup-guide p { margin: .3rem 0; line-height: 1.45; }
    .setup-guide .setup-confirm { display: flex; gap: .5rem; align-items: flex-start; margin: .6rem 0; font-weight: 600; }
    .setup-guide .setup-confirm input { margin-top: .2rem; width: 1.2rem; height: 1.2rem; }
    .setup-guide .setup-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: .5rem; }
    .setup-guide .setup-msg { color: var(--a-danger, #b3261e); min-height: 1.2em; margin: .3rem 0 0; font-size: .92rem; }
  `;
  document.head.appendChild(style);

  const EXAMPLE = 'The values filled in are an <b>example</b>: the practice of the first masjid that ' +
    'used this board (Colombo). They are not a rule. Change anything that differs at your masjid.';

  const STEPS = [
    { tab: 'general', title: 'Your masjid',
      body: 'Type your masjid\'s name, tick the languages to show, and pick your <b>ACJU zone</b> ' +
        '(the prayer times come from it). The theme and font can be changed any time.',
      confirm: 'The name, languages and zone are right for our masjid.',
      check: () => document.querySelector('[data-path="masjid.name"]').value.trim()
        ? null : 'Type the masjid\'s name first.' },
    { tab: 'prayers', title: 'Iqamah times and Luha',
      body: EXAMPLE + ' For each prayer, the iqamah is either some minutes after the azan or a fixed clock time.',
      confirm: 'These iqamah times and Luha settings match our masjid.' },
    { tab: 'special', title: 'Jumu\'ah (Friday)',
      body: EXAMPLE + ' Check the order, the bayan time (or switch the bayan off), how the iqamah is set ' +
        '(a fixed time, or minutes after the azan) and the khutbah length. Ramadan mode can stay off until Ramadan.',
      confirm: 'This is how Jumu\'ah runs at our masjid.' },
    { tab: null, title: 'Finish',
      body: 'That is everything the board needs. Press <b>Finish setup</b> to save; prayer times appear on the ' +
        'screen within a few seconds. Everything can be changed later in these settings ' +
        '(the clock is under <b>Time</b>, the hotspot and updates under <b>Network</b>).',
      confirm: null },
  ];

  let step = 0;
  const confirmed = STEPS.map(() => false);

  function showTab(name) {
    const t = document.querySelector(`#admin-tabs .tab[data-tab="${name}"]`);
    if (t) t.click();
  }

  function render(msg) {
    const s = STEPS[step];
    box.innerHTML = `
      <h2>Set up this board — ${s.title}</h2>
      <p class="setup-step">Step ${step + 1} of ${STEPS.length}</p>
      <p>${s.body}</p>
      ${s.confirm ? `<label class="setup-confirm"><input type="checkbox" id="setup-ok" ${confirmed[step] ? 'checked' : ''}>
        <span>${s.confirm}</span></label>` : ''}
      <p class="setup-msg" id="setup-msg">${msg || ''}</p>
      <div class="setup-actions">
        ${step > 0 ? '<button type="button" class="btn btn--secondary" id="setup-back">Back</button>' : ''}
        ${s.confirm ? '<button type="button" class="btn btn--primary" id="setup-next">Next</button>'
                    : '<button type="button" class="btn btn--primary" id="setup-finish">Finish setup</button>'}
      </div>`;
    if (s.tab) showTab(s.tab);
    const ok = document.getElementById('setup-ok');
    if (ok) ok.addEventListener('change', () => { confirmed[step] = ok.checked; });
    const back = document.getElementById('setup-back');
    if (back) back.addEventListener('click', () => { step--; render(); });
    const next = document.getElementById('setup-next');
    if (next) next.addEventListener('click', () => {
      const problem = s.check && s.check();
      if (problem) return render(problem);
      if (!confirmed[step]) return render('Check the values, then tick the box to confirm.');
      step++; render();
    });
    const fin = document.getElementById('setup-finish');
    if (fin) fin.addEventListener('click', finish);
  }

  async function finish() {
    const A = window.SBAdmin;
    const config = await A.currentFormConfig();
    const errors = A.validate(config);
    if (errors.length) return render('Fix these first: ' + errors.join(' '));
    config.setupDone = true;
    if (!(await A.persistConfig(config))) return render('Not saved: the board refused it. Unlock the settings and press Finish again.');
    box.innerHTML = `<h2>Setup finished</h2>
      <p>Saved. The display shows prayer times within a few seconds. You can change any setting below and press Save.</p>
      <div class="setup-actions"><a class="btn btn--primary" href="../display/">Back to the display</a>
      <button type="button" class="btn btn--secondary" id="setup-close">Close</button></div>`;
    document.getElementById('setup-close').addEventListener('click', () => { box.hidden = true; });
  }

  async function start() {
    let stored = {};
    try { stored = await SBConfig.getStoredAsync(); } catch (e) { /* treat as fresh */ }
    if (!SBConfig.needsSetup(stored)) return;
    box.hidden = false;
    render();
  }

  // Wait for admin.js to fill the form (it boots asynchronously).
  if (window.SBAdmin) setTimeout(start, 300);
  else window.addEventListener('load', () => setTimeout(start, 300));
})();
