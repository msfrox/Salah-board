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

  // ── Software update (git pull) + reboot ──────────────────
  function wireUpdate() {
    const upStatus = m => { const el = $('#update-status'); if (el) el.textContent = m; };
    const upBtn = $('#update-btn');
    if (upBtn) upBtn.addEventListener('click', async () => {
      if (!confirm('Fetch and apply the latest code from GitHub?')) return;
      upBtn.disabled = true;
      upStatus('Updating from GitHub…');
      const r = await post('/api/update');
      upBtn.disabled = false;
      if (r.ok) {
        upStatus(r.output && /already up to date/i.test(r.output)
          ? 'Already up to date.'
          : 'Updated. Reboot the board to apply the new code.');
      } else {
        upStatus('Update failed — ' + (r.error || 'board device with internet only.'));
      }
    });
    const rbBtn = $('#reboot-btn');
    if (rbBtn) rbBtn.addEventListener('click', async () => {
      if (!confirm('Reboot the board now?')) return;
      upStatus('Rebooting…');
      const r = await post('/api/reboot');
      if (!r.ok) upStatus('Could not reboot — ' + (r.error || 'board device only.'));
    });
  }

  document.addEventListener('sb-tab-shown', e => { if (e.detail.tab === 'network') refresh(); });

  wire();
  wireWifi();
  wireUpdate();
})();
