/**
 * ChainTrack – Blockchain Supply Chain Tracker
 * Pure JavaScript blockchain implementation (no external dependencies)
 * Simulates SHA-256 hashing, Proof-of-Work (difficulty 2), and chain validation.
 */

// ── SHA-256 (pure JS, no external lib) ──────────────────────────────────────
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray  = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2,'0')).join('');
}

// ── BLOCK CLASS ──────────────────────────────────────────────────────────────
class Block {
  constructor(index, data, previousHash = '0') {
    this.index        = index;
    this.timestamp    = new Date().toISOString();
    this.data         = data;
    this.previousHash = previousHash;
    this.nonce        = 0;
    this.hash         = '';
  }

  async calculateHash() {
    const content = this.index + this.timestamp + JSON.stringify(this.data) +
                    this.previousHash + this.nonce;
    return await sha256(content);
  }

  async mine(difficulty = 2) {
    const target = '0'.repeat(difficulty);
    do {
      this.nonce++;
      this.hash = await this.calculateHash();
    } while (!this.hash.startsWith(target));
    return this.hash;
  }
}

// ── BLOCKCHAIN CLASS ─────────────────────────────────────────────────────────
class Blockchain {
  constructor() {
    this.chain      = [];
    this.difficulty = 2;
    this.blockTimes = [];
  }

  async createGenesis() {
    const genesis = new Block(0, {
      type:      'GENESIS',
      message:   'ChainTrack Supply Chain Genesis Block',
      network:   'ChainTrack Testnet v1.0',
      timestamp: new Date().toISOString(),
    }, '0000000000000000');
    genesis.nonce = 1;
    genesis.hash  = await genesis.calculateHash();
    this.chain.push(genesis);
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  async addBlock(data) {
    const prev  = this.getLatestBlock();
    const block = new Block(this.chain.length, data, prev.hash);
    const t0    = performance.now();
    await block.mine(this.difficulty);
    const elapsed = ((performance.now() - t0) / 1000).toFixed(3);
    this.blockTimes.push(parseFloat(elapsed));
    this.chain.push(block);
    return block;
  }

  async isValid() {
    for (let i = 1; i < this.chain.length; i++) {
      const cur  = this.chain[i];
      const prev = this.chain[i - 1];
      const recalc = await cur.calculateHash();
      if (cur.hash !== recalc)          return false;
      if (cur.previousHash !== prev.hash) return false;
    }
    return true;
  }

  avgBlockTime() {
    if (!this.blockTimes.length) return '—';
    const avg = this.blockTimes.reduce((a,b)=>a+b,0)/this.blockTimes.length;
    return avg.toFixed(2) + 's';
  }
}

// ── APP STATE ────────────────────────────────────────────────────────────────
let bc;
let selectedProduct = null;

async function initChain() {
  bc = new Blockchain();
  await bc.createGenesis();
  renderChain();
}

// ── RENDER ───────────────────────────────────────────────────────────────────
function renderChain() {
  const container = document.getElementById('chain-visual');
  container.innerHTML = '';

  [...bc.chain].reverse().forEach((block, idx) => {
    const isGenesis = block.index === 0;
    const data = block.data;

    // status class
    const rawStatus = data.status || data.type || 'manufactured';
    const statusClass = 'status-' + rawStatus.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'');
    const statusLabel = rawStatus.replace(/-/g,' ').replace(/\b\w/g, c=>c.toUpperCase());

    // connector (skip before last rendered = first block)
    if (idx !== 0) {
      const conn = document.createElement('div');
      conn.className = 'block-connector';
      container.appendChild(conn);
    }

    const card = document.createElement('div');
    card.className = 'block-card' + (isGenesis ? ' genesis-block' : '');
    card.onclick = () => showDetail(block);

    if (isGenesis) {
      card.innerHTML = `
        <div class="block-top">
          <span class="block-num">BLOCK #0 — GENESIS</span>
          <span class="block-time">${fmtTime(block.timestamp)}</span>
        </div>
        <div class="block-product">⛓ Genesis Block — ChainTrack Network</div>
        <div class="block-hash">Hash: <span>${block.hash}</span></div>`;
    } else {
      card.innerHTML = `
        <div class="block-top">
          <span class="block-num">BLOCK #${block.index}</span>
          <span class="block-time">${fmtTime(block.timestamp)}</span>
        </div>
        <div class="block-product">${data.productName || data.cargo || data.sku || 'Supply Event'}</div>
        <div class="block-status ${statusClass}">${statusLabel}</div>
        <div class="block-meta">
          ${data.sku        ? `<div class="meta-item">SKU: <strong>${data.sku}</strong></div>` : ''}
          ${data.origin     ? `<div class="meta-item">From: <strong>${data.origin}</strong></div>` : ''}
          ${data.destination? `<div class="meta-item">To: <strong>${data.destination}</strong></div>` : ''}
          ${data.quantity   ? `<div class="meta-item">Qty: <strong>${data.quantity}</strong></div>` : ''}
          ${data.handler    ? `<div class="meta-item">By: <strong>${data.handler}</strong></div>` : ''}
          ${data.carrier    ? `<div class="meta-item">Carrier: <strong>${data.carrier}</strong></div>` : ''}
          ${data.result     ? `<div class="meta-item">QC: <strong>${data.result}</strong></div>` : ''}
          ${data.inspector  ? `<div class="meta-item">Inspector: <strong>${data.inspector}</strong></div>` : ''}
        </div>
        <div class="block-hash">
          Hash: <span>${block.hash.slice(0,16)}…${block.hash.slice(-8)}</span>
          &nbsp;|&nbsp; Prev: <span>${block.previousHash.slice(0,16)}…</span>
          &nbsp;|&nbsp; Nonce: <span>${block.nonce}</span>
        </div>`;
    }

    container.appendChild(card);
  });

  updateStats();
}

function fmtTime(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'}) +
         ' ' + d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
}

async function updateStats() {
  const products = new Set(bc.chain.slice(1).map(b => b.data.sku || b.data.productName).filter(Boolean));
  document.getElementById('s-blocks').textContent   = bc.chain.length;
  document.getElementById('s-products').textContent = products.size;
  document.getElementById('s-time').textContent     = bc.avgBlockTime();
  document.getElementById('block-count-hdr').textContent = bc.chain.length + ' Blocks';

  const valid = await bc.isValid();
  const el = document.getElementById('s-integrity');
  const badge = document.getElementById('chain-valid-badge');
  if (valid) {
    el.textContent = '✓ Valid';
    el.style.color = 'var(--accent3)';
    badge.textContent = '✓ Chain Valid';
    badge.style.color = 'var(--accent3)';
  } else {
    el.textContent = '✗ TAMPERED';
    el.style.color = 'var(--danger)';
    badge.textContent = '✗ Chain Tampered!';
    badge.style.color = 'var(--danger)';
  }
}

// ── ADD BLOCKS ───────────────────────────────────────────────────────────────
async function addBlock() {
  const sku  = document.getElementById('f-sku').value.trim();
  const name = document.getElementById('f-name').value.trim();
  if (!sku || !name) { showToast('⚠️ SKU and Product Name are required', 'warn'); return; }

  showToast('⛏ Mining block…', 'info');

  const data = {
    type:        'PRODUCT_EVENT',
    sku,
    productName: name,
    status:      document.getElementById('f-status').value,
    quantity:    document.getElementById('f-qty').value,
    origin:      document.getElementById('f-origin').value,
    destination: document.getElementById('f-dest').value,
    handler:     document.getElementById('f-handler').value,
    temperature: document.getElementById('f-temp').value,
    notes:       document.getElementById('f-notes').value,
  };

  await bc.addBlock(data);
  renderChain();
  clearForm(['f-sku','f-name','f-qty','f-origin','f-dest','f-handler','f-temp','f-notes']);
  showToast('✓ Block mined & added to chain!');
}

async function addShipmentBlock() {
  const bol = document.getElementById('s-bol').value.trim();
  if (!bol) { showToast('⚠️ Bill of Lading is required', 'warn'); return; }
  showToast('⛏ Mining shipment block…', 'info');

  const data = {
    type:      'SHIPMENT',
    status:    'in-transit',
    bol,
    carrier:   document.getElementById('s-carrier').value,
    container: document.getElementById('s-container').value,
    portOfLoading:   document.getElementById('s-pol').value,
    portOfDischarge: document.getElementById('s-pod').value,
    eta:       document.getElementById('s-eta').value,
    cargo:     document.getElementById('s-cargo').value,
  };

  await bc.addBlock(data);
  renderChain();
  clearForm(['s-bol','s-carrier','s-container','s-pol','s-pod','s-eta','s-cargo']);
  showToast('✓ Shipment block mined & added!');
}

async function addQualityBlock() {
  const sku = document.getElementById('q-sku').value.trim();
  if (!sku) { showToast('⚠️ SKU is required', 'warn'); return; }
  showToast('⛏ Mining QC block…', 'info');

  const data = {
    type:      'QUALITY_CHECK',
    status:    'quality-check',
    sku,
    inspector: document.getElementById('q-inspector').value,
    result:    document.getElementById('q-result').value,
    score:     document.getElementById('q-score').value,
    findings:  document.getElementById('q-findings').value,
  };

  await bc.addBlock(data);
  renderChain();
  clearForm(['q-sku','q-inspector','q-score','q-findings']);
  showToast('✓ QC block mined & added!');
}

function clearForm(ids) {
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

// ── TABS ─────────────────────────────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById('tab-' + name).classList.add('active');
}

// ── SEARCH ───────────────────────────────────────────────────────────────────
function doSearch() {
  const q = document.getElementById('search-input').value.toLowerCase().trim();
  const results = document.getElementById('search-results');

  if (!q) { results.innerHTML = ''; return; }

  const matches = bc.chain.slice(1).filter(b => {
    const d = b.data;
    return [d.sku, d.productName, d.origin, d.destination, d.handler, d.carrier, d.bol, d.cargo]
      .some(v => v && v.toLowerCase().includes(q));
  });

  if (!matches.length) {
    results.innerHTML = `<div style="color:var(--muted);font-size:0.8rem;">No results found</div>`;
    return;
  }

  results.innerHTML = matches.map(b => `
    <div onclick="showDetail(bc.chain[${b.index}])"
         style="padding:0.6rem 0.8rem;border:1px solid var(--border);border-radius:8px;
                margin-bottom:0.5rem;cursor:pointer;background:var(--surface);font-size:0.82rem;
                transition:border-color 0.2s;"
         onmouseover="this.style.borderColor='var(--accent)'"
         onmouseout="this.style.borderColor='var(--border)'">
      <strong>${b.data.productName || b.data.cargo || b.data.sku || 'Block #'+b.index}</strong>
      <div style="color:var(--muted);font-size:0.7rem;">Block #${b.index} · ${b.data.sku||''}</div>
    </div>`).join('');
}

// ── DETAIL PANEL ─────────────────────────────────────────────────────────────
function showDetail(block) {
  if (block.index === 0) return;
  const d = block.data;

  // Find full journey for same SKU
  const sku = d.sku;
  const journey = sku
    ? bc.chain.slice(1).filter(b => b.data.sku === sku || b.data.sku === undefined)
    : [block];

  const statusIcons = {
    'manufactured':'🏭','in-transit':'🚢','at-warehouse':'🏢',
    'quality-check':'🔬','delivered':'✅','recalled':'⚠️',
    'SHIPMENT':'🚢','QUALITY_CHECK':'🔬','PRODUCT_EVENT':'📦',
  };

  const panel = document.getElementById('detail-panel');
  panel.innerHTML = `
    <div style="margin-bottom:1rem;">
      <div style="font-size:1rem;font-weight:700;margin-bottom:4px;">
        ${d.productName || d.cargo || 'Supply Event'}
      </div>
      ${sku ? `<div style="font-size:0.75rem;color:var(--muted);">SKU: ${sku}</div>` : ''}
      <div class="hash-badge">Block #${block.index} · ${block.hash.slice(0,24)}…</div>
    </div>
    <div style="margin-bottom:0.5rem;font-size:0.72rem;text-transform:uppercase;letter-spacing:1px;color:var(--muted);">Journey Timeline</div>
    ${bc.chain.slice(1).filter(b => {
        if (!sku) return b.index === block.index;
        return b.data.sku === sku;
      }).map(b => {
        const icon = statusIcons[b.data.status] || statusIcons[b.data.type] || '📦';
        const status = (b.data.status || b.data.type || '').replace(/-/g,' ');
        return `<div class="timeline-item">
          <div class="tl-dot">${icon}</div>
          <div class="tl-content">
            <div class="tl-event">${status.replace(/\b\w/g,c=>c.toUpperCase())}</div>
            <div class="tl-time">${fmtTime(b.timestamp)}</div>
            ${b.data.origin      ? `<div class="tl-loc">📍 ${b.data.origin} → ${b.data.destination||'?'}</div>` : ''}
            ${b.data.handler     ? `<div class="tl-loc">👤 ${b.data.handler}</div>` : ''}
            ${b.data.carrier     ? `<div class="tl-loc">🚢 ${b.data.carrier}</div>` : ''}
            ${b.data.inspector   ? `<div class="tl-loc">🔬 ${b.data.inspector} — Score: ${b.data.score||'?'}/100</div>` : ''}
            ${b.data.notes       ? `<div class="tl-loc" style="margin-top:3px;font-style:italic;">"${b.data.notes.slice(0,80)}${b.data.notes.length>80?'…':''}"</div>` : ''}
          </div>
        </div>`;
      }).join('')}
    <div style="font-size:0.72rem;color:var(--muted);border-top:1px solid var(--border);padding-top:0.8rem;margin-top:0.5rem;">
      <strong style="color:var(--text);">Raw Block Data</strong><br><br>
      ${Object.entries(d).map(([k,v])=>v?`<div><span style="color:var(--muted);">${k}:</span> <span style="color:var(--accent2);">${v}</span></div>`:'').join('')}
    </div>`;
}

// ── HASH VERIFIER ────────────────────────────────────────────────────────────
function verifyHash() {
  const input = document.getElementById('verify-input').value.trim().toLowerCase();
  const result = document.getElementById('verify-result');
  if (!input) return;

  const found = bc.chain.find(b => b.hash.startsWith(input.replace('0x','')));
  if (found) {
    const d = found.data;
    result.innerHTML = `
      <div style="color:var(--accent3);font-size:0.8rem;margin-bottom:8px;">✓ Block found & verified</div>
      <div style="font-size:0.75rem;color:var(--muted);">
        Block #${found.index}<br>
        ${d.productName || d.type || ''}<br>
        ${fmtTime(found.timestamp)}<br>
        <span style="color:var(--accent2);">Nonce: ${found.nonce}</span>
      </div>`;
  } else {
    result.innerHTML = `<div style="color:var(--danger);font-size:0.8rem;">✗ Hash not found in this chain</div>`;
  }
}

// ── TOAST ─────────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, type='success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.borderColor = type === 'warn' ? 'var(--warn)' :
                        type === 'info' ? 'var(--accent)' : 'var(--accent3)';
  t.style.color      = type === 'warn' ? 'var(--warn)' :
                       type === 'info' ? 'var(--accent)' : 'var(--accent3)';
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

// ── DEMO DATA ─────────────────────────────────────────────────────────────────
async function loadDemo() {
  showToast('⛏ Mining demo blocks… please wait', 'info');

  const demoBlocks = [
    {
      type:'PRODUCT_EVENT', sku:'SKU-001', productName:'Organic Coffee Beans',
      status:'manufactured', quantity:'2000 kg', origin:'Huila, Colombia',
      destination:'Port of Cartagena', handler:'FincaVerde S.A.',
      temperature:'18', notes:'Fair-trade certified, lot #CFB-2024-07'
    },
    {
      type:'QUALITY_CHECK', sku:'SKU-001', status:'quality-check',
      inspector:'Dr. Maria Ortiz', result:'passed', score:'96',
      findings:'Moisture 11.2%, no defects, grade Specialty 85+ SCA'
    },
    {
      type:'SHIPMENT', status:'in-transit', bol:'BOL-2024-9921',
      carrier:'Maersk Line', container:'MSKU7734892',
      portOfLoading:'Cartagena, COL', portOfDischarge:'Rotterdam, NLD',
      eta:'2024-11-20', cargo:'Organic green coffee, HS 0901.11, 2000 kg'
    },
    {
      type:'PRODUCT_EVENT', sku:'SKU-001', productName:'Organic Coffee Beans',
      status:'at-warehouse', quantity:'1994 kg', origin:'Rotterdam, NLD',
      destination:'Roastery Berlin', handler:'EuroBean GmbH',
      temperature:'16', notes:'6 kg declared as damaged on inspection'
    },
    {
      type:'PRODUCT_EVENT', sku:'SKU-001', productName:'Organic Coffee Beans',
      status:'delivered', quantity:'1994 kg', origin:'Rotterdam, NLD',
      destination:'Berlin, Germany', handler:'CaffeKunst GmbH',
      temperature:'18', notes:'Final delivery confirmed. Certificate of Organic issued.'
    },
  ];

  for (const d of demoBlocks) {
    await bc.addBlock(d);
  }

  renderChain();
  showToast('✓ 5 demo blocks added to chain!');
}
