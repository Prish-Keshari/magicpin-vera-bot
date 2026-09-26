/* ═══ Vera Bot Dashboard — app.js ═══ */

(function () {
  'use strict';

  const API = '';  // same origin

  // ─── Navigation ───
  const navItems = document.querySelectorAll('.nav-item');
  const panels = document.querySelectorAll('.panel');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const target = item.dataset.panel;
      navItems.forEach(n => n.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      item.classList.add('active');
      document.getElementById('panel-' + target).classList.add('active');

      // Lazy-load data on first visit
      if (target === 'overview') loadOverview();
      if (target === 'submissions') loadSubmissions();
      if (target === 'merchants') loadMerchants();
      if (target === 'composer') loadComposerDropdowns();
    });
  });

  // ─── Overview ───
  let overviewLoaded = false;

  async function loadOverview() {
    if (overviewLoaded) return;
    try {
      const [health, meta] = await Promise.all([
        fetchJSON('/v1/healthz'),
        fetchJSON('/v1/metadata')
      ]);
      const c = health.contexts_loaded || {};
      animateNumber('s-categories', c.category || 0);
      animateNumber('s-merchants', c.merchant || 0);
      animateNumber('s-customers', c.customer || 0);
      animateNumber('s-triggers', c.trigger || 0);
      animateNumber('s-uptime', health.uptime_seconds || 0);

      document.getElementById('m-team').textContent = meta.team_name || '—';
      document.getElementById('m-members').textContent = (meta.team_members || []).join(', ') || '—';
      document.getElementById('m-model').textContent = meta.model || '—';
      document.getElementById('m-approach').textContent = meta.approach || '—';
      document.getElementById('m-version').textContent = meta.version || '—';
      document.getElementById('m-contact').textContent = meta.contact_email || '—';

      overviewLoaded = true;
    } catch (e) {
      console.error('Overview load error:', e);
    }
  }

  function animateNumber(id, target) {
    const el = document.getElementById(id);
    if (!el) return;
    const dur = 600;
    const start = performance.now();
    const from = 0;
    function step(now) {
      const t = Math.min((now - start) / dur, 1);
      const ease = 1 - Math.pow(1 - t, 3); // easeOutCubic
      el.textContent = Math.round(from + (target - from) * ease);
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // ─── Submissions ───
  let submissionsData = null;

  async function loadSubmissions() {
    if (submissionsData) return;
    try {
      const res = await fetchJSON('/v1/dashboard/submissions');
      submissionsData = res.submissions || [];
      renderSubmissions(submissionsData);
    } catch (e) {
      document.getElementById('sub-grid').innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <h3>Could not load submissions</h3>
          <p style="color:var(--text-muted)">${e.message}</p>
        </div>`;
    }
  }

  function renderSubmissions(items) {
    const grid = document.getElementById('sub-grid');
    if (!items.length) {
      grid.innerHTML = '<div class="empty-state"><div class="empty-icon">📄</div><h3>No submissions found</h3></div>';
      return;
    }
    grid.innerHTML = items.map(s => `
      <div class="sub-card">
        <div class="sub-header">
          <span class="sub-id">${esc(s.test_id)}</span>
          <span class="${ctaBadgeClass(s.cta)}">${esc(s.cta)}</span>
        </div>
        <div class="sub-body">${esc(s.body)}</div>
        <div class="sub-rationale">💡 ${esc(s.rationale)}</div>
        <div class="sub-meta">
          <span class="${s.send_as === 'vera' ? 'badge badge-cyan' : 'badge badge-pink'}">${esc(s.send_as)}</span>
          <span class="badge badge-amber" title="Suppression key">${esc(truncate(s.suppression_key, 40))}</span>
        </div>
      </div>
    `).join('');
  }

  document.getElementById('sub-search').addEventListener('input', e => {
    if (!submissionsData) return;
    const q = e.target.value.toLowerCase();
    const filtered = submissionsData.filter(s =>
      (s.body || '').toLowerCase().includes(q) ||
      (s.rationale || '').toLowerCase().includes(q) ||
      (s.test_id || '').toLowerCase().includes(q) ||
      (s.cta || '').toLowerCase().includes(q)
    );
    renderSubmissions(filtered);
  });

  // ─── Merchants ───
  let merchantsData = null;

  async function loadMerchants() {
    if (merchantsData) return;
    try {
      const res = await fetchJSON('/v1/dashboard/merchants');
      merchantsData = res.merchants || [];
      renderMerchantGrid(merchantsData);
    } catch (e) {
      document.getElementById('merchant-grid').innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-icon">🏪</div>
          <h3>No merchants loaded</h3>
          <p style="color:var(--text-muted)">Push contexts via POST /v1/context to populate</p>
        </div>`;
    }
  }

  function renderMerchantGrid(items) {
    const grid = document.getElementById('merchant-grid');
    if (!items.length) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">🏪</div>
        <h3>No merchants loaded</h3>
        <p style="color:var(--text-muted)">Push contexts via POST /v1/context to populate</p>
      </div>`;
      return;
    }
    grid.innerHTML = items.map(m => {
      const ident = m.identity || {};
      const perf = m.performance || {};
      const offers = (m.offers || []).filter(o => o.status === 'active').map(o => o.title);
      return `
        <div class="merchant-card" onclick="window.__showMerchant('${esc(m.merchant_id)}')">
          <div class="mc-name">${esc(ident.name || m.merchant_id)}</div>
          <div class="mc-location">📍 ${esc(ident.locality || '')}${ident.city ? ', ' + esc(ident.city) : ''} · ${esc(m.category_slug || '')}</div>
          <div class="mc-stats">
            <div class="mc-stat"><div class="mc-stat-val">${perf.views ?? '—'}</div><div class="mc-stat-lbl">Views</div></div>
            <div class="mc-stat"><div class="mc-stat-val">${perf.calls ?? '—'}</div><div class="mc-stat-lbl">Calls</div></div>
            <div class="mc-stat"><div class="mc-stat-val">${perf.ctr != null ? (perf.ctr * 100).toFixed(1) + '%' : '—'}</div><div class="mc-stat-lbl">CTR</div></div>
          </div>
          <div class="mc-offers">
            ${offers.length ? offers.map(o => `<span class="badge badge-green">${esc(o)}</span>`).join('') : '<span class="badge badge-amber">No active offers</span>'}
          </div>
        </div>`;
    }).join('');
  }

  window.__showMerchant = function (mid) {
    const m = (merchantsData || []).find(x => x.merchant_id === mid);
    if (!m) return;
    document.getElementById('merchant-list-view').style.display = 'none';
    const detail = document.getElementById('merchant-detail-view');
    detail.style.display = 'block';

    const ident = m.identity || {};
    const perf = m.performance || {};
    const sub = m.subscription || {};
    const agg = m.customer_aggregate || {};
    const signals = m.signals || [];
    const offers = m.offers || [];
    const hist = (m.conversation_history || []).slice(-5);

    detail.innerHTML = `
      <div class="merchant-detail">
        <button class="btn btn-secondary back-btn" onclick="window.__backToMerchants()">← Back to list</button>

        <div class="card" style="margin-bottom:16px">
          <h3 style="margin-bottom:16px">${esc(ident.name || mid)}</h3>
          <div class="stat-grid">
            <div class="stat-card"><div class="stat-value">${perf.views ?? '—'}</div><div class="stat-label">Views (30d)</div></div>
            <div class="stat-card"><div class="stat-value">${perf.calls ?? '—'}</div><div class="stat-label">Calls</div></div>
            <div class="stat-card"><div class="stat-value">${perf.directions ?? '—'}</div><div class="stat-label">Directions</div></div>
            <div class="stat-card"><div class="stat-value">${perf.ctr != null ? (perf.ctr * 100).toFixed(1) + '%' : '—'}</div><div class="stat-label">CTR</div></div>
          </div>
        </div>

        <div class="two-col">
          <div class="card">
            <div class="card-header"><h3>🆔 Identity</h3></div>
            <table class="info-table">
              <tr><td>Merchant ID</td><td>${esc(m.merchant_id)}</td></tr>
              <tr><td>Category</td><td>${esc(m.category_slug)}</td></tr>
              <tr><td>City</td><td>${esc(ident.city || '—')}</td></tr>
              <tr><td>Locality</td><td>${esc(ident.locality || '—')}</td></tr>
              <tr><td>Verified</td><td>${ident.verified ? '✅ Yes' : '❌ No'}</td></tr>
              <tr><td>Languages</td><td>${(ident.languages || []).join(', ') || '—'}</td></tr>
              <tr><td>Owner</td><td>${esc(ident.owner_first_name || '—')}</td></tr>
            </table>
          </div>
          <div class="card">
            <div class="card-header"><h3>📊 Subscription & Customers</h3></div>
            <table class="info-table">
              <tr><td>Plan</td><td>${esc(sub.plan || '—')}</td></tr>
              <tr><td>Status</td><td><span class="badge ${sub.status === 'active' ? 'badge-green' : 'badge-amber'}">${esc(sub.status || '—')}</span></td></tr>
              <tr><td>Days Remaining</td><td>${sub.days_remaining ?? '—'}</td></tr>
              <tr><td>Unique Customers YTD</td><td>${agg.total_unique_ytd ?? '—'}</td></tr>
              <tr><td>Lapsed 180d+</td><td>${agg.lapsed_180d_plus ?? '—'}</td></tr>
              <tr><td>6-mo Retention</td><td>${agg.retention_6mo_pct != null ? (agg.retention_6mo_pct * 100).toFixed(0) + '%' : '—'}</td></tr>
            </table>
          </div>
        </div>

        <div class="two-col" style="margin-top:16px">
          <div class="card">
            <div class="card-header"><h3>🎯 Offers</h3></div>
            ${offers.length ? offers.map(o => `
              <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
                <span>${esc(o.title || '—')}</span>
                <span class="badge ${o.status === 'active' ? 'badge-green' : 'badge-red'}">${esc(o.status)}</span>
              </div>
            `).join('') : '<p style="color:var(--text-muted)">No offers</p>'}
          </div>
          <div class="card">
            <div class="card-header"><h3>🚨 Signals</h3></div>
            ${signals.length ? signals.map(s => `<span class="badge badge-amber" style="margin:4px">${esc(String(s))}</span>`).join('') : '<p style="color:var(--text-muted)">No signals</p>'}
          </div>
        </div>

        ${hist.length ? `
        <div class="card" style="margin-top:16px">
          <div class="card-header"><h3>💬 Recent Conversation History</h3></div>
          ${hist.map(h => `
            <div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:0.85rem">
              <span class="badge ${h.from === 'vera' ? 'badge-cyan' : 'badge-green'}" style="margin-right:8px">${esc(h.from || '?')}</span>
              <span style="color:var(--text-muted)">${esc(h.ts || '')}</span>
              <div style="margin-top:4px">${esc(truncate(h.body || '', 150))}</div>
              ${h.engagement ? `<span class="badge badge-pink" style="margin-top:4px">${esc(h.engagement)}</span>` : ''}
            </div>
          `).join('')}
        </div>` : ''}
      </div>`;
  };

  window.__backToMerchants = function () {
    document.getElementById('merchant-list-view').style.display = 'block';
    document.getElementById('merchant-detail-view').style.display = 'none';
  };

  document.getElementById('merchant-search').addEventListener('input', e => {
    if (!merchantsData) return;
    const q = e.target.value.toLowerCase();
    renderMerchantGrid(merchantsData.filter(m => {
      const ident = m.identity || {};
      return (ident.name || '').toLowerCase().includes(q)
        || (ident.city || '').toLowerCase().includes(q)
        || (m.category_slug || '').toLowerCase().includes(q)
        || (m.merchant_id || '').toLowerCase().includes(q);
    }));
  });

  // ─── Composer ───
  let composerLoaded = false;

  async function loadComposerDropdowns() {
    if (composerLoaded) return;
    try {
      const [merchRes, catRes] = await Promise.all([
        fetchJSON('/v1/dashboard/merchants'),
        fetchJSON('/v1/dashboard/categories')
      ]);
      const merchants = merchRes.merchants || [];
      const mSel = document.getElementById('compose-merchant');
      merchants.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.merchant_id;
        opt.textContent = `${(m.identity || {}).name || m.merchant_id} (${m.category_slug})`;
        mSel.appendChild(opt);
      });

      // Fetch triggers from dashboard
      try {
        const trigRes = await fetchJSON('/v1/dashboard/triggers');
        const triggers = trigRes.triggers || [];
        const tSel = document.getElementById('compose-trigger');
        triggers.forEach(t => {
          const opt = document.createElement('option');
          opt.value = t.id || t.trigger_id || '';
          opt.textContent = `${t.kind || 'unknown'} — ${opt.value}`;
          tSel.appendChild(opt);
        });
      } catch (_) {}

      // Customers
      try {
        const custRes = await fetchJSON('/v1/dashboard/customers');
        const customers = custRes.customers || [];
        const cSel = document.getElementById('compose-customer');
        customers.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.customer_id;
          opt.textContent = `${(c.identity || {}).name || c.customer_id} → ${c.merchant_id}`;
          cSel.appendChild(opt);
        });
      } catch (_) {}

      composerLoaded = true;
      updateComposeBtn();
    } catch (e) {
      console.error('Composer load error:', e);
    }
  }

  function updateComposeBtn() {
    const m = document.getElementById('compose-merchant').value;
    const t = document.getElementById('compose-trigger').value;
    document.getElementById('compose-btn').disabled = !(m && t);
  }
  document.getElementById('compose-merchant').addEventListener('change', updateComposeBtn);
  document.getElementById('compose-trigger').addEventListener('change', updateComposeBtn);

  document.getElementById('compose-btn').addEventListener('click', async () => {
    const btn = document.getElementById('compose-btn');
    const out = document.getElementById('compose-output');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Composing...';
    out.innerHTML = '<div style="text-align:center;padding:40px"><div class="spinner"></div></div>';

    try {
      const res = await fetchJSON('/v1/dashboard/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchant_id: document.getElementById('compose-merchant').value,
          trigger_id: document.getElementById('compose-trigger').value,
          customer_id: document.getElementById('compose-customer').value || null
        })
      });

      out.innerHTML = `
        <div class="compose-result">
          <div class="result-body">${esc(res.body || '(empty)')}</div>
          <div class="result-meta">
            <div class="result-meta-item">
              <div class="meta-label">CTA</div>
              <div class="meta-value"><span class="${ctaBadgeClass(res.cta)}">${esc(res.cta || '—')}</span></div>
            </div>
            <div class="result-meta-item">
              <div class="meta-label">Send As</div>
              <div class="meta-value"><span class="badge ${res.send_as === 'vera' ? 'badge-cyan' : 'badge-pink'}">${esc(res.send_as || '—')}</span></div>
            </div>
            <div class="result-meta-item">
              <div class="meta-label">Template</div>
              <div class="meta-value">${esc(res.template_name || '—')}</div>
            </div>
            <div class="result-meta-item">
              <div class="meta-label">Suppression Key</div>
              <div class="meta-value" style="word-break:break-all">${esc(res.suppression_key || '—')}</div>
            </div>
          </div>
          <div class="card" style="margin-top:16px">
            <div class="card-header"><h3>💡 Rationale</h3></div>
            <p style="color:var(--text-secondary);font-size:0.88rem">${esc(res.rationale || '—')}</p>
          </div>
        </div>`;
    } catch (e) {
      out.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>Composition failed</h3><p style="color:var(--text-muted)">${esc(e.message)}</p></div>`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = '✨ Compose Message';
      updateComposeBtn();
    }
  });

  // ─── Chat Simulator ───
  let turnCounter = 0;

  function addBubble(role, text) {
    const msgs = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = `chat-bubble ${role === 'vera' ? 'vera' : 'merchant'}`;
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    div.innerHTML = `
      <div class="bubble-label">${role === 'vera' ? 'Vera' : 'Merchant'}</div>
      ${esc(text)}
      <div class="bubble-time">${now}</div>`;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }

  async function sendChat() {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (!msg) return;
    input.value = '';
    turnCounter++;

    addBubble('merchant', msg);

    try {
      const res = await fetchJSON('/v1/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: document.getElementById('chat-conv-id').value,
          merchant_id: document.getElementById('chat-merchant-id').value,
          from_role: 'merchant',
          message: msg,
          turn_number: turnCounter
        })
      });

      if (res.action === 'send') {
        addBubble('vera', res.body || '(no body)');
      } else if (res.action === 'wait') {
        addBubble('vera', `⏳ Waiting ${res.wait_seconds || '?'}s — ${res.rationale || ''}`);
      } else if (res.action === 'end') {
        addBubble('vera', `🔴 Conversation ended — ${res.rationale || ''}`);
      }
    } catch (e) {
      addBubble('vera', `⚠️ Error: ${e.message}`);
    }
  }

  document.getElementById('chat-send').addEventListener('click', sendChat);
  document.getElementById('chat-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') sendChat();
  });

  document.getElementById('chat-reset').addEventListener('click', () => {
    turnCounter = 0;
    const msgs = document.getElementById('chat-messages');
    msgs.innerHTML = `<div class="chat-bubble vera">
      <div class="bubble-label">Vera</div>
      Chat reset. Send a merchant reply to start...
      <div class="bubble-time">now</div>
    </div>`;
    document.getElementById('chat-conv-id').value = 'conv_demo_' + Date.now();
  });

  // Quick message buttons
  document.querySelectorAll('.quick-msg').forEach(el => {
    el.style.cssText = 'padding:10px 14px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-sm);cursor:pointer;font-size:0.85rem;transition:all 0.2s';
    el.addEventListener('mouseenter', () => el.style.borderColor = 'var(--accent)');
    el.addEventListener('mouseleave', () => el.style.borderColor = 'var(--border-color)');
    el.addEventListener('click', () => {
      document.getElementById('chat-input').value = el.dataset.msg;
      sendChat();
    });
  });

  // ─── Helpers ───
  async function fetchJSON(url, opts) {
    const res = await fetch(API + url, opts);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  function esc(s) {
    if (s == null) return '';
    const d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
  }

  function truncate(s, n) {
    if (!s) return '';
    return s.length > n ? s.slice(0, n) + '…' : s;
  }

  function ctaBadgeClass(cta) {
    const c = (cta || '').toLowerCase();
    if (c.includes('yes') || c.includes('confirm')) return 'badge badge-green';
    if (c === 'open_ended') return 'badge badge-blue';
    if (c === 'none') return 'badge badge-amber';
    if (c.includes('slot') || c.includes('choice')) return 'badge badge-pink';
    return 'badge badge-cyan';
  }

  // ─── Init ───
  loadOverview();

})();
