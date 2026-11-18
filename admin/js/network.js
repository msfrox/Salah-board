/* ============================================================
   Salah Board — network.js  (admin Network tab: WiFi hotspot)

   Talks to serve.py's /api/hotspot endpoints (nmcli under the hood).
   Degrades gracefully off the board device: the status line explains
   the feature is board-only and the buttons report the same.
   ============================================================ */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);

  const statusEl = () => $('#hotspot-status');
  const ssidEl = () => $('#hotspot-ssid');
  const passEl = () => $('#hotspot-pass');

  function setStatus(msg) { const el = statusEl(); if (el) el.textContent = msg; }

  async function refresh() {
    if (!statusEl()) return;
    setStatus('Checking…');
    try {
      const res = await fetch('/api/hotspot', { cache: 'no-store' });
      const info = await res.json();
      if (!info.available) {
        setStatus('Hotspot control is available only on the board device' +
          (info.error ? ` (${info.error}).` : '.'));
        return;
      }
      if (info.ssid && !ssidEl().value) ssidEl().value = info.ssid;
      if (info.password && !passEl().value) passEl().value = info.password;
      setStatus(info.active
        ? `Hotspot is ON — network "${info.ssid || 'SalahBoard'}".`
        : 'Hotspot is off.');
    } catch (e) {
      setStatus('Hotspot control is available only on the board device.');
    }
  }

  async function post(path, body) {
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const j = await res.json().catch(() => ({}));
      return { ok: res.ok && j.ok, error: j.error, output: j.output };
    } catch (e) {
      return { ok: false, error: 'board device only' };
    }
  }

  function wire() {
    const save = $('#hotspot-save');
    if (save) save.addEventListener('click', async () => {
      const ssid = (ssidEl().value || '').trim();
      const password = passEl().value || '';
      if (!ssid) { setStatus('Enter a network name (SSID).'); return; }
      if (password.length < 8) { setStatus('Password must be at least 8 characters.'); return; }
      setStatus('Saving & starting hotspot…');
      const r = await post('/api/hotspot/config', { ssid, password });
      if (r.ok) { setStatus(`Hotspot ON — network "${ssid}".`); }
      else setStatus('Could not start hotspot — ' + (r.error || 'board device only.'));
    });

    const start = $('#hotspot-start');
    if (start) start.addEventListener('click', async () => {
      setStatus('Starting…');
      const r = await post('/api/hotspot/start');
      setStatus(r.ok ? 'Hotspot ON.' : 'Could not start — ' + (r.error || 'configure it first, or board device only.'));
      refresh();
    });

    const stop = $('#hotspot-stop');
    if (stop) stop.addEventListener('click', async () => {
      setStatus('Stopping…');
      const r = await post('/api/hotspot/stop');
      setStatus(r.ok ? 'Hotspot off.' : 'Could not stop — ' + (r.error || 'board device only.'));
      refresh();
    });
  }

  // ── Join an existing WiFi network (scan + connect) ───────
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }
  function wifiSetStatus(msg) { const el = $('#wifi-status'); if (el) el.textContent = msg || ''; }

  function bars(signal) {
    const n = signal >= 75 ? 4 : signal >= 50 ? 3 : signal >= 25 ? 2 : 1;
    return '▂▄▆█'.slice(0, n) + '·'.repeat(4 - n);
  }

  function renderWifiList(networks) {
    const list = $('#wifi-list');
    if (!list) return;
    if (!networks.length) { list.innerHTML = '<p class="hint">No networks found.</p>'; return; }
    list.innerHTML = networks.map(n => `
      <button type="button" class="btn btn--secondary wifi-row" data-ssid="${escapeHtml(n.ssid)}" data-open="${n.open ? '1' : '0'}">
        <span class="wifi-name">${n.inUse ? '✓ ' : ''}${escapeHtml(n.ssid)}${n.open ? '' : ' 🔒'}</span>
        <span class="wifi-sig">${bars(n.signal)}</span>
      </button>`).join('');
  }

  function selectWifi(ssid, open) {
    const box = $('#wifi-connect');
    if (open) { connectWifi(ssid, ''); return; } // open network — no password needed
    $('#wifi-sel-ssid').textContent = ssid;
    $('#wifi-pass').value = '';
    box.hidden = false;
    box.dataset.ssid = ssid;
    $('#wifi-pass').focus();
  }

  async function connectWifi(ssid, password) {
    wifiSetStatus(`Connecting to "${ssid}"… the board may briefly drop off the network.`);
    $('#wifi-connect').hidden = true;
    const r = await post('/api/wifi/connect', { ssid, password });
    wifiSetStatus(r.ok
      ? `Connected to "${ssid}".`
      : `Could not connect to "${ssid}" — ` + (r.error || 'board device only, or wrong password.'));
  }

  function wireWifi() {
    const scan = $('#wifi-scan');
    if (scan) scan.addEventListener('click', async () => {
      wifiSetStatus('Scanning…');
      $('#wifi-connect').hidden = true;
      $('#wifi-list').innerHTML = '';
      try {
        const res = await fetch('/api/wifi/scan', { cache: 'no-store' });
        const info = await res.json();
        if (!info.available) { wifiSetStatus('WiFi scan is available only on the board device' + (info.error ? ` (${info.error}).` : '.')); return; }
        renderWifiList(info.networks || []);
        wifiSetStatus((info.networks || []).length ? 'Tap a network to join it.' : 'No networks found.');
      } catch (e) {
        wifiSetStatus('WiFi scan is available only on the board device.');
      }
    });

    const list = $('#wifi-list');
    if (list) list.addEventListener('click', e => {
      const row = e.target.closest('.wifi-row');
      if (row) selectWifi(row.getAttribute('data-ssid'), row.getAttribute('data-open') === '1');
    });

    const cbtn = $('#wifi-connect-btn');
    if (cbtn) cbtn.addEventListener('click', () => {
      const ssid = $('#wifi-connect').dataset.ssid || '';
      connectWifi(ssid, $('#wifi-pass').value || '');
    });
    const cancel = $('#wifi-cancel-btn');
    if (cancel) cancel.addEventListener('click', () => { $('#wifi-connect').hidden = true; });
  }

  // ── Version (what code the board is running) ─────────────
  // From serve.py's GET /api/version: the git commit at server start, what is
  // on disk after an update, and the release status (SB-7: running tag, newest
  // tag found, what "go back" returns to). Off the board there is no API.
  function fmtVersion(v) {
    const d = new Date(v.date);
    const when = isNaN(d) ? '' : d.toLocaleString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
    });
    return when ? `${when} · ${v.short}` : v.short;
  }
  function showRunning(info) {
    const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    const show = (id, on) => { const el = document.getElementById(id); if (el) el.hidden = !on; };
    if (!info || !info.available || !info.running) {
      set('version-running', 'Unknown');
      set('version-note', info
        ? 'This copy was not installed from GitHub, so it has no version information.'
        : 'Version information is available only on the board device.');
      show('version-note', true);
      show('version-change-row', false);
      show('version-branch-row', false);
      return;
    }
    const run = info.running;
    set('version-running', (info.current && !info.current.startsWith('build ') ? info.current + ' · ' : '') + fmtVersion(run));
    set('version-subject', run.subject || '');
    show('version-change-row', !!run.subject);
    set('version-branch', run.branch || '');
    show('version-branch-row', !!run.branch && run.branch !== 'HEAD');
    if (info.rebootNeeded && info.installed) {
      set('version-note', `A different version is ready (${fmtVersion(info.installed)}). Press Reload board to start using it.`);
      show('version-note', true);
    } else {
      show('version-note', false);
    }
  }
  function showRelease(v) {
    const verStatus = m => { const el = $('#version-status'); if (el) el.textContent = m; };
    const upBtn = $('#update-btn'), backBtn = $('#rollback-btn');
    if (!v || !v.current) { verStatus(''); return; }
    const when = v.checkedAt ? ` (last checked ${v.checkedAt.replace('T', ' ').slice(0, 16)})` : '';
    verStatus(v.latest
      ? (v.updateAvailable ? `A newer release is available: ${v.latest}.` : `This is the newest release${when}.`)
      : `No release found yet${when}. Press Check to look on GitHub.`);
    if (upBtn) { upBtn.hidden = !v.updateAvailable; upBtn.textContent = `Update to ${v.latest}`; }
    if (backBtn) { backBtn.hidden = !v.previous; backBtn.textContent = `Go back to ${v.previous}`; }
  }
  async function refreshVersion() {
    let info = null;
    try {
      const res = await fetch('/api/version', { cache: 'no-store' });
      if (res.ok) info = await res.json();
    } catch (e) { /* not on the board device */ }
    showRunning(info);
    showRelease(info);
  }

  // ── Software update (release tags, SB-7) + reload + reboot ─
  function wireUpdate() {
    const upStatus = m => { const el = $('#update-status'); if (el) el.textContent = m; };
    const upBtn = $('#update-btn'), backBtn = $('#rollback-btn'), checkBtn = $('#version-check-btn');

    async function act(path, busy) {
      [upBtn, backBtn, checkBtn].forEach(b => { if (b) b.disabled = true; });
      upStatus(busy);
      const res = await fetch(path, { method: 'POST' }).catch(() => null);
      const j = res ? await res.json().catch(() => ({})) : {};
      [upBtn, backBtn, checkBtn].forEach(b => { if (b) b.disabled = false; });
      await refreshVersion();
      return { ok: !!(res && res.ok && j.ok), j };
    }

    if (checkBtn) checkBtn.addEventListener('click', async () => {
      const r = await act('/api/version/check', 'Looking for a new version…');
      upStatus(r.ok ? '' : (r.j.error || 'Could not check — board device with internet only.'));
    });
    if (upBtn) upBtn.addEventListener('click', async () => {
      if (!confirm(upBtn.textContent + '? The board keeps showing prayer times; press Reload board afterwards to start the new version.')) return;
      const r = await act('/api/update', 'Updating…');
      upStatus(r.ok ? r.j.message : ('Update failed — ' + (r.j.error || 'board device with internet only.')));
    });
    if (backBtn) backBtn.addEventListener('click', async () => {
      if (!confirm(backBtn.textContent + '?')) return;
      const r = await act('/api/rollback', 'Going back…');
      upStatus(r.ok ? r.j.message : ('Could not go back — ' + (r.j.error || 'board device only.')));
    });
    // Reload board: restart serve.py (new code) — the board page notices the
    // new server instance and reloads itself. No device reboot. A restart
    // ends PIN sessions (they live in memory), so the lock screen comes back.
    const rlBtn = $('#reload-btn');
    if (rlBtn) rlBtn.addEventListener('click', async () => {
      rlBtn.disabled = true;
      upStatus('Reloading the board…');
      const r = await post('/api/restart');
      if (!r.ok) {
        rlBtn.disabled = false;
        upStatus('Could not reload — ' + (r.error || 'board device only.'));
        return;
      }
      setTimeout(() => {
        rlBtn.disabled = false;
        upStatus('Board reloaded. The screen refreshes within a few seconds; enter the PIN again to keep changing settings.');
        refreshVersion();
      }, 3000);
    });
    const rbBtn = $('#reboot-btn');
    if (rbBtn) rbBtn.addEventListener('click', async () => {
      if (!confirm('Reboot the whole device now? The screen goes blank for a minute or two.')) return;
      upStatus('Rebooting…');
      const r = await post('/api/reboot');
      if (!r.ok) upStatus('Could not reboot — ' + (r.error || 'board device only.'));
    });
  }

  // ── Prayer timetable (SB-5): check / update / go back ────
  // From serve.py's /api/data*. Plain words; offline is a normal answer, not an error.
  const OFFLINE_MSG = 'Not connected to the internet — the board keeps using its timetable.';
  function showData(d) {
    const set = (id, t) => { const el = document.getElementById(id); if (el) el.textContent = t; };
    const upBtn = $('#data-update-btn'), backBtn = $('#data-back-btn');
    if (!d || !d.active) {
      set('data-active', 'Unknown');
      set('data-status', 'Timetable information is available only on the board device.');
      if (upBtn) upBtn.hidden = true;
      if (backBtn) backBtn.hidden = true;
      return;
    }
    set('data-active', `${d.active.revision} (${d.active.source === 'refreshed' ? 'updated from pray.gear.lk' : 'came with the board'})`);
    let msg;
    if (!d.lastChecked) msg = 'Not checked yet. Press Check to see if a newer timetable is available.';
    else if (!d.online) msg = OFFLINE_MSG;
    else if (d.updateAvailable) msg = `A newer timetable is available: ${d.latest.revision}.`;
    else msg = 'This is the newest timetable.';
    if (d.lastChecked) msg += ` (last checked ${d.lastChecked.replace('T', ' ').slice(0, 16)})`;
    set('data-status', msg);
    if (upBtn) { upBtn.hidden = !(d.online && d.updateAvailable); upBtn.textContent = `Update timetable to ${d.latest ? d.latest.revision : ''}`; }
    if (backBtn) { backBtn.hidden = !d.previous; backBtn.textContent = d.previous ? `Go back to ${d.previous.revision}` : 'Go back'; }
  }
  async function refreshData() {
    let d = null;
    try {
      const res = await fetch('/api/data', { cache: 'no-store' });
      if (res.ok) d = await res.json();
    } catch (e) { /* not on the board device */ }
    showData(d);
  }
  function wireData() {
    const msg = m => { const el = $('#data-msg'); if (el) el.textContent = m; };
    const btns = ['#data-check-btn', '#data-update-btn', '#data-back-btn'].map(s => $(s));
    async function act(path, busy) {
      btns.forEach(b => { if (b) b.disabled = true; });
      msg(busy);
      const res = await fetch(path, { method: 'POST' }).catch(() => null);
      const j = res ? await res.json().catch(() => ({})) : {};
      btns.forEach(b => { if (b) b.disabled = false; });
      await refreshData();
      return { ok: !!(res && res.ok && j.ok), j };
    }
    const [checkBtn, upBtn, backBtn] = btns;
    if (checkBtn) checkBtn.addEventListener('click', async () => {
      const r = await act('/api/data/check', 'Looking for a newer timetable…');
      msg(r.ok ? '' : (r.j.error || OFFLINE_MSG));
    });
    if (upBtn) upBtn.addEventListener('click', async () => {
      if (!confirm(upBtn.textContent + '? The prayer times shown on the screen may change. You can go back afterwards.')) return;
      const r = await act('/api/data/refresh', 'Downloading and checking the new timetable… this takes a moment.');
      msg(r.ok ? r.j.message : ((r.j.error || 'Could not update.') + ' The board is still using its old timetable.'));
    });
    if (backBtn) backBtn.addEventListener('click', async () => {
      if (!confirm(backBtn.textContent + '? The prayer times shown on the screen may change.')) return;
      const r = await act('/api/data/rollback', 'Going back…');
      msg(r.ok ? r.j.message : ('Could not go back — ' + (r.j.error || 'board device only.')));
    });
  }

  document.addEventListener('sb-tab-shown', e => { if (e.detail.tab === 'network') { refresh(); refreshVersion(); refreshData(); } });

  wire();
  wireWifi();
  wireUpdate();
  wireData();
})();
