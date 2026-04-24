// ============================================
// THE HANDS OF THE DIVINE — UI System
// ============================================

class UI {
  constructor(game) {
    this.game = game;
    this.currentScreen = 'loading'; // loading, menu, create, playing
    this.symbolCanvas = null;
    this.symbolCtx = null;
    this.isDrawingSymbol = false;
    this.drawColor = 1; // 1 = draw, 0 = erase
    this.selectedTraits = [];
    this.religionName = '';
    this.religionColor = '#e63946';
    this.creatorName = '';
    this.traitFilter = 'ALL';

    // HUD state
    this.showEventLog = true;
    this.showStats = true;
    this.showLeaderboard = true;
    this.showChronicle = true;
    this.showSpawnPicker = false;
    this.showGMPanel = false;
    this.selectedMiracle = null;
    this.miracleCooldowns = {};
    this.tooltipData = null;
  }

  // ─── Build all UI HTML ────────────────────────────────────────────────────
  buildUI() {
    const container = document.getElementById('ui-layer');
    container.innerHTML = '';

    switch (this.currentScreen) {
      case 'loading': this._buildLoading(container); break;
      case 'menu':    this._buildMenu(container); break;
      case 'create':  this._buildCreate(container); break;
      case 'playing': this._buildHUD(container); break;
    }
  }

  setScreen(screen) {
    this.currentScreen = screen;
    this.buildUI();
  }

  // ─── LOADING SCREEN ──────────────────────────────────────────────────────
  _buildLoading(container) {
    container.innerHTML = `
      <div class="screen loading-screen">
        <div class="loading-symbol">✦</div>
        <div class="loading-title">THE HANDS OF THE DIVINE</div>
        <div class="loading-sub">Awakening the world...</div>
        <div class="loading-bar"><div class="loading-fill" id="loadFill"></div></div>
      </div>
    `;
  }

  setLoadProgress(pct) {
    const fill = document.getElementById('loadFill');
    if (fill) fill.style.width = pct + '%';
  }

  // ─── MAIN MENU ───────────────────────────────────────────────────────────
  _buildMenu(container) {
    const religions = this.game.religions || [];
    const faithList = religions.map(r => `
      <div class="faith-badge" style="border-color:${r.color}; background:${r.color}22">
        <span class="faith-badge-color" style="background:${r.color}"></span>
        <span>${r.name}</span>
        <span class="faith-badge-tiles">${r.territory_count || 0} tiles</span>
      </div>
    `).join('');

    container.innerHTML = `
      <div class="screen menu-screen">
        <div class="menu-stars"></div>
        <div class="menu-content">
          <div class="menu-symbol">✦</div>
          <h1 class="menu-title">THE HANDS OF<br>THE DIVINE</h1>
          <p class="menu-subtitle">Shape your faith. Claim the world. Watch empires rise and fall.</p>
          <div class="menu-divider"></div>
          <button class="btn btn-primary" id="btnCreate">FORGE A NEW RELIGION</button>
          ${religions.length > 0 ? `
            <div class="menu-faiths">
              <div class="menu-faiths-title">ACTIVE FAITHS IN THE WORLD</div>
              <div class="faith-list">${faithList}</div>
            </div>
          ` : `
            <div class="menu-empty">No faiths yet. Be the first god.</div>
          `}
          <div class="menu-info">
            <span>World: ${CONFIG.WORLD_WIDTH}×${CONFIG.WORLD_HEIGHT}</span>
            <span>Tick: ${this.game.tickCount || 0}</span>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btnCreate').addEventListener('click', () => {
      this.setScreen('create');
    });
  }

  // ─── RELIGION CREATION ────────────────────────────────────────────────────
  _buildCreate(container) {
    const colors = ['#e63946','#457b9d','#f4a261','#2a9d8f','#9b5de5','#f72585','#4cc9f0',
      '#ff6b35','#06d6a0','#ffd166','#ef476f','#118ab2','#e07be0','#73d216','#ff8fab','#c77dff'];

    const colorBtns = colors.map(c => `
      <button class="color-btn ${this.religionColor === c ? 'active' : ''}"
              style="background:${c}" data-color="${c}"></button>
    `).join('');

    const categories = ['ALL', ...Object.keys(TRAIT_CATEGORIES)];
    const catTabs = categories.map(c => `
      <button class="cat-tab ${this.traitFilter === c ? 'active' : ''}" data-cat="${c}">
        ${c === 'ALL' ? '⬡ All' : TRAIT_CATEGORIES[c].icon + ' ' + TRAIT_CATEGORIES[c].name}
      </button>
    `).join('');

    const filteredTraits = this.traitFilter === 'ALL'
      ? TRAITS
      : TRAITS.filter(t => t.cat === this.traitFilter);

    const traitCards = filteredTraits.map(t => {
      const selected = this.selectedTraits.includes(t.id);
      const catColor = TRAIT_CATEGORIES[t.cat]?.color || '#666';
      return `
        <div class="trait-card ${selected ? 'selected' : ''} ${this.selectedTraits.length >= CONFIG.MAX_TRAITS && !selected ? 'disabled' : ''}"
             data-trait="${t.id}" style="${selected ? `border-color:${catColor}; box-shadow: 0 0 8px ${catColor}44` : ''}">
          <div class="trait-icon">${t.icon}</div>
          <div class="trait-info">
            <div class="trait-name">${t.name}</div>
            <div class="trait-desc">${t.desc}</div>
          </div>
          <div class="trait-cat" style="color:${catColor}">${TRAIT_CATEGORIES[t.cat]?.name || ''}</div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="screen create-screen">
        <div class="create-panel">
          <button class="btn-back" id="btnBack">← Back</button>
          <h2 class="create-title">FORGE YOUR FAITH</h2>

          <div class="create-section">
            <label class="create-label">YOUR NAME</label>
            <input type="text" class="create-input" id="inputCreator" placeholder="Anonymous God"
                   value="${this.creatorName}" maxlength="20">
          </div>

          <div class="create-section">
            <label class="create-label">RELIGION NAME</label>
            <input type="text" class="create-input" id="inputName" placeholder="e.g. The Eternal Flame"
                   value="${this.religionName}" maxlength="28">
          </div>

          <div class="create-row">
            <div class="create-section" style="flex:0 0 auto">
              <label class="create-label">DRAW YOUR SYMBOL</label>
              <div class="symbol-area">
                <canvas id="symbolCanvas" width="16" height="16"></canvas>
                <div class="symbol-tools">
                  <button class="sym-tool active" id="symDraw" title="Draw">✏️</button>
                  <button class="sym-tool" id="symErase" title="Erase">🧹</button>
                  <button class="sym-tool" id="symClear" title="Clear">🗑️</button>
                </div>
              </div>
            </div>
            <div class="create-section" style="flex:1">
              <label class="create-label">SACRED COLOR</label>
              <div class="color-grid">${colorBtns}</div>
            </div>
          </div>

          <div class="create-section">
            <label class="create-label">TENETS & TRAITS <span class="trait-count">(${this.selectedTraits.length}/${CONFIG.MAX_TRAITS})</span></label>
            <div class="cat-tabs">${catTabs}</div>
            <div class="traits-grid">${traitCards}</div>
          </div>

          <div class="create-preview">
            <canvas id="previewSymbol" width="48" height="48"></canvas>
            <div>
              <div class="preview-name" style="color:${this.religionColor}">${this.religionName || 'Unnamed Faith'}</div>
              <div class="preview-traits">${this.selectedTraits.map(id => {
                const t = getTrait(id);
                return t ? `<span class="preview-trait">${t.icon} ${t.name}</span>` : '';
              }).join('')}</div>
            </div>
          </div>

          <button class="btn btn-primary btn-create ${!this.religionName.trim() ? 'disabled' : ''}"
                  id="btnManifest">⚡ MANIFEST INTO THE WORLD</button>
        </div>
      </div>
    `;

    // Setup symbol drawing canvas
    this._setupSymbolCanvas();

    // Event listeners
    document.getElementById('btnBack').addEventListener('click', () => this.setScreen('menu'));

    document.getElementById('inputName').addEventListener('input', (e) => {
      this.religionName = e.target.value;
      this._updatePreview();
    });

    document.getElementById('inputCreator').addEventListener('input', (e) => {
      this.creatorName = e.target.value;
    });

    document.querySelectorAll('.color-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.religionColor = btn.dataset.color;
        this.buildUI(); // rebuild to update active state
      });
    });

    document.querySelectorAll('.cat-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.traitFilter = tab.dataset.cat;
        this.buildUI();
      });
    });

    document.querySelectorAll('.trait-card:not(.disabled)').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.trait;
        if (this.selectedTraits.includes(id)) {
          this.selectedTraits = this.selectedTraits.filter(t => t !== id);
        } else if (this.selectedTraits.length < CONFIG.MAX_TRAITS) {
          this.selectedTraits.push(id);
        }
        this.buildUI();
      });
    });

    document.getElementById('symDraw').addEventListener('click', () => { this.drawColor = 1; this.buildUI(); });
    document.getElementById('symErase').addEventListener('click', () => { this.drawColor = 0; this.buildUI(); });
    document.getElementById('symClear').addEventListener('click', () => {
      this.symbolData = new Uint8Array(16 * 16);
      this.buildUI();
    });

    document.getElementById('btnManifest').addEventListener('click', () => {
      if (this.religionName.trim()) {
        this.game.createReligion({
          name: this.religionName.trim(),
          color: this.religionColor,
          traits: this.selectedTraits,
          symbol_data: JSON.stringify(Array.from(this.symbolData || new Uint8Array(256))),
          creator_name: this.creatorName.trim() || 'Anonymous',
        });
      }
    });
  }

  _setupSymbolCanvas() {
    const canvas = document.getElementById('symbolCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    if (!this.symbolData) {
      this.symbolData = new Uint8Array(16 * 16);
    }

    // Render existing symbol data
    this._renderSymbol(ctx, this.symbolData, 16, 16);

    // Drawing
    const draw = (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = 16 / rect.width;
      const scaleY = 16 / rect.height;
      const x = Math.floor((e.clientX || e.touches?.[0]?.clientX || 0 - rect.left) * scaleX);
      const y = Math.floor(((e.clientY || e.touches?.[0]?.clientY || 0) - rect.top) * scaleY);
      if (x >= 0 && x < 16 && y >= 0 && y < 16) {
        this.symbolData[y * 16 + x] = this.drawColor;
        this._renderSymbol(ctx, this.symbolData, 16, 16);
        this._updatePreview();
      }
    };

    canvas.addEventListener('mousedown', (e) => { this.isDrawingSymbol = true; draw(e); });
    canvas.addEventListener('mousemove', (e) => { if (this.isDrawingSymbol) draw(e); });
    window.addEventListener('mouseup', () => { this.isDrawingSymbol = false; });
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); this.isDrawingSymbol = true; draw(e); }, { passive: false });
    canvas.addEventListener('touchmove', (e) => { e.preventDefault(); if (this.isDrawingSymbol) draw(e); }, { passive: false });
    canvas.addEventListener('touchend', () => { this.isDrawingSymbol = false; });

    this._updatePreview();
  }

  _renderSymbol(ctx, data, w, h) {
    ctx.clearRect(0, 0, w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[y * w + x]) {
          ctx.fillStyle = this.religionColor;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
  }

  _updatePreview() {
    const preview = document.getElementById('previewSymbol');
    if (!preview) return;
    const ctx = preview.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 48, 48);
    if (this.symbolData) {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          if (this.symbolData[y * 16 + x]) {
            ctx.fillStyle = this.religionColor;
            ctx.fillRect(x * 3, y * 3, 3, 3);
          }
        }
      }
    }
    const nameEl = document.querySelector('.preview-name');
    if (nameEl) {
      nameEl.textContent = this.religionName || 'Unnamed Faith';
      nameEl.style.color = this.religionColor;
    }
  }

  // ─── GAME HUD ─────────────────────────────────────────────────────────────
  _buildHUD(container) {
    const rel = this.game.myReligion;
    if (!rel) return;

    const stats = this.game.stats || {};
    const myStats = stats[rel.index] || { tiles: 0, population: 0, avgFaith: 0 };
    const totalLand = CONFIG.WORLD_WIDTH * CONFIG.WORLD_HEIGHT * 0.45; // rough land tiles estimate

    // Miracles bar
    const miracleBtns = Object.entries(CONFIG.MIRACLES).map(([id, m]) => {
      const cd = this.miracleCooldowns[id] || 0;
      const canUse = (rel.divine_power || 0) >= m.cost && cd === 0;
      const isActive = this.selectedMiracle === id;
      return `
        <button class="miracle-btn ${canUse ? '' : 'disabled'} ${isActive ? 'active' : ''}"
                data-miracle="${id}" title="${m.name}: ${m.desc} (Cost: ${m.cost}⚡)">
          <span class="miracle-icon">${m.icon}</span>
          <span class="miracle-name">${m.name}</span>
          ${cd > 0 ? `<span class="miracle-cd">⏳${cd}</span>` : `<span class="miracle-cost">${m.cost}⚡</span>`}
        </button>
      `;
    }).join('');

    // Scoreboard
    const allRels = (this.game.religions || []).slice().sort((a, b) => (b.territory_count || 0) - (a.territory_count || 0));
    const scoreRows = allRels.map(r => {
      const s = stats[r.index] || { tiles: 0, population: 0 };
      const pct = ((s.tiles / totalLand) * 100).toFixed(1);
      const isMe = r.id === rel.id;
      return `
        <div class="score-row ${isMe ? 'score-me' : ''}">
          <span class="score-color" style="background:${r.color}"></span>
          <span class="score-name" style="color:${r.color}">${r.name}</span>
          <div class="score-bar-track">
            <div class="score-bar-fill" style="width:${Math.min(100, pct)}%; background:${r.color}"></div>
          </div>
          <span class="score-num">${s.tiles}</span>
        </div>
      `;
    }).join('');

    // Event log
    const events = (this.game.events || []).slice(-15).reverse();
    const eventRows = events.map(e => `
      <div class="event-row">
        <span class="event-tick">T${e.tick}</span>
        <span class="event-desc">${e.desc || e.description}</span>
      </div>
    `).join('');

    // Kingdoms section
    const sm = this.game.settlementManager;
    let kingdomSection = '';
    if (sm && sm.kingdoms.length > 0) {
      const kingdomRows = sm.kingdoms
        .sort((a, b) => b.territory - a.territory)
        .map(k => {
          const relColor = k.religion?.color || '#888';
          const warTargets = Object.entries(k.relations || {}).filter(([_, r]) => r === 'war');
          const peaceTargets = Object.entries(k.relations || {}).filter(([_, r]) => r === 'peace');
          let relStatus = '';
          if (warTargets.length > 0) {
            relStatus = `<span style="color:#e63946;font-size:11px">⚔️ At war</span>`;
          } else if (peaceTargets.length > 0) {
            relStatus = `<span style="color:#2a9d8f;font-size:11px">☮️ Peace</span>`;
          }
          return `
            <div class="kingdom-row">
              <span class="score-color" style="background:${relColor}"></span>
              <div class="kingdom-info">
                <div class="kingdom-name" style="color:${relColor}">${k.name}</div>
                <div class="kingdom-detail">👑 ${k.capitalName} · ${k.settlements.length} settlements · ${k.territory} tiles ${relStatus}</div>
              </div>
            </div>
          `;
        }).join('');
      kingdomSection = `
        <div class="sidebar-section">
          <div class="sidebar-title">👑 Kingdoms</div>
          <div class="kingdom-list">${kingdomRows}</div>
        </div>
      `;
    }

    container.innerHTML = `
      ${this.showSpawnPicker ? `
        <div class="spawn-overlay">
          <div class="spawn-banner">
            <div class="spawn-title">🌍 CHOOSE YOUR STARTING LOCATION</div>
            <div class="spawn-sub">Click anywhere on land to place your followers. Scroll and zoom to explore first.</div>
          </div>
        </div>
      ` : ''}

      <!-- Top bar -->
      <div class="hud-top">
        <div class="hud-religion">
          <canvas id="hudSymbol" width="24" height="24"></canvas>
          <span class="hud-name" style="color:${rel.color}">${rel.name}</span>
        </div>
        <div class="hud-stats">
          <span class="hud-stat">🗺️ ${myStats.tiles} tiles</span>
          <span class="hud-stat">👥 ${myStats.population}</span>
          <span class="hud-stat">📿 ${myStats.avgFaith}%</span>
          <span class="hud-stat divine-power">⚡ ${Math.floor(rel.divine_power || 0)}</span>
        </div>
        <div class="hud-tick">
          Tick ${this.game.tickCount || 0}
          <button class="gm-toggle-btn" id="btnGMToggle" title="Game Master">⚙️</button>
        </div>
      </div>

      <!-- GM Panel -->
      ${this.showGMPanel ? `
        <div class="gm-panel">
          ${this.game.isGM ? `
            <div class="gm-title">⚙️ GAME MASTER</div>
            <div class="gm-tools">
              <button class="btn btn-sm ${this.game.gmTool === 'smite' ? 'gm-active' : ''}" id="gmSmite">💀 Smite Area</button>
              <button class="btn btn-sm ${this.game.gmTool === 'bless_area' ? 'gm-active' : ''}" id="gmBless">🌟 Bless Area</button>
              <button class="btn btn-sm ${this.game.gmTool === 'purge_faith' ? 'gm-active' : ''}" id="gmPurge">🌀 Purge Faith</button>
              <button class="btn btn-sm" id="gmDeselect">✋ Deselect Tool</button>
              <div style="border-top:1px solid #333;margin:8px 0;padding-top:8px">
                <button class="btn btn-sm" style="border-color:#e63946;color:#e63946" id="gmReset">⚠️ RESET ENTIRE WORLD</button>
              </div>
            </div>
          ` : `
            <div class="gm-title">🔒 Game Master Login</div>
            <input type="password" class="create-input" id="gmPassword" placeholder="Enter GM password" style="margin:8px 0">
            <button class="btn btn-sm" id="gmLogin">Login</button>
          `}
          <button class="btn btn-sm" id="gmClose" style="margin-top:8px;opacity:0.5">Close</button>
        </div>
      ` : ''}

      <!-- Miracles bar -->
      <div class="hud-miracles">
        ${miracleBtns}
        ${this.selectedMiracle ? `
          <div class="miracle-hint">Click on the map to use ${CONFIG.MIRACLES[this.selectedMiracle]?.icon} ${CONFIG.MIRACLES[this.selectedMiracle]?.name}
            <button class="miracle-cancel" id="btnCancelMiracle">✕</button>
          </div>
        ` : ''}
      </div>

      <!-- Side panels -->
      <div class="hud-sidebar">
        <div class="sidebar-section">
          <div class="sidebar-title sidebar-toggle" id="toggleLeaderboard">🏆 Leaderboard ${this.showLeaderboard ? '▾' : '▸'}</div>
          ${this.showLeaderboard ? `<div class="scoreboard">${scoreRows}</div>` : ''}
        </div>

        ${kingdomSection}

        <div class="sidebar-section">
          <div class="sidebar-title sidebar-toggle" id="toggleChronicle">📜 World Chronicle ${this.showChronicle ? '▾' : '▸'}</div>
          ${this.showChronicle ? `<div class="event-log">${eventRows || '<div class="event-row"><span class="event-desc" style="opacity:0.4">The world is quiet...</span></div>'}</div>` : ''}
        </div>
        <div class="sidebar-section">
          <div class="sidebar-title">🏛️ Holy Sites</div>
          <button class="btn btn-sm" id="btnPlaceShrine">⛩️ Shrine (${CONFIG.HOLY_SITE_COSTS.shrine}⚡)</button>
          <button class="btn btn-sm" id="btnPlaceTemple">🏛️ Temple (${CONFIG.HOLY_SITE_COSTS.temple}⚡)</button>
          <button class="btn btn-sm" id="btnPlaceCathedral">⛪ Cathedral (${CONFIG.HOLY_SITE_COSTS.cathedral}⚡)</button>
        </div>
      </div>

      <!-- Tile tooltip -->
      <div class="hud-tooltip" id="tileTooltip" style="display:none"></div>
    `;

    // Render symbol in HUD
    const hudSym = document.getElementById('hudSymbol');
    if (hudSym && rel.symbol_data) {
      const ctx = hudSym.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      const data = JSON.parse(rel.symbol_data);
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          if (data[y * 16 + x]) {
            ctx.fillStyle = rel.color;
            ctx.fillRect(x * 1.5, y * 1.5, 1.5, 1.5);
          }
        }
      }
    }

    // Toggle listeners
    const toggleLB = document.getElementById('toggleLeaderboard');
    if (toggleLB) toggleLB.addEventListener('click', () => { this.showLeaderboard = !this.showLeaderboard; this.buildUI(); });
    const toggleChr = document.getElementById('toggleChronicle');
    if (toggleChr) toggleChr.addEventListener('click', () => { this.showChronicle = !this.showChronicle; this.buildUI(); });

    // Miracle buttons
    document.querySelectorAll('.miracle-btn:not(.disabled)').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.miracle;
        this.selectedMiracle = this.selectedMiracle === id ? null : id;
        this.game.renderer.selectedMiracle = this.selectedMiracle;
        this.buildUI();
      });
    });

    if (document.getElementById('btnCancelMiracle')) {
      document.getElementById('btnCancelMiracle').addEventListener('click', () => {
        this.selectedMiracle = null;
        this.game.renderer.selectedMiracle = null;
        this.buildUI();
      });
    }

    // Holy site buttons
    ['Shrine', 'Temple', 'Cathedral'].forEach(type => {
      const btn = document.getElementById(`btnPlace${type}`);
      if (btn) {
        btn.addEventListener('click', () => {
          this.game.placingHolySite = type.toLowerCase();
          this.selectedMiracle = null;
          this.game.renderer.selectedMiracle = null;
        });
      }
    });

    // GM panel
    const gmToggle = document.getElementById('btnGMToggle');
    if (gmToggle) gmToggle.addEventListener('click', () => { this.showGMPanel = !this.showGMPanel; this.buildUI(); });

    const gmClose = document.getElementById('gmClose');
    if (gmClose) gmClose.addEventListener('click', () => { this.showGMPanel = false; this.buildUI(); });

    const gmLogin = document.getElementById('gmLogin');
    if (gmLogin) {
      gmLogin.addEventListener('click', () => {
        const pw = document.getElementById('gmPassword')?.value || '';
        if (this.game.tryGMLogin(pw)) { this.buildUI(); }
        else { alert('Wrong password'); }
      });
    }

    const gmSmite = document.getElementById('gmSmite');
    if (gmSmite) gmSmite.addEventListener('click', () => { this.game.gmTool = this.game.gmTool === 'smite' ? null : 'smite'; this.buildUI(); });
    const gmBless = document.getElementById('gmBless');
    if (gmBless) gmBless.addEventListener('click', () => { this.game.gmTool = this.game.gmTool === 'bless_area' ? null : 'bless_area'; this.buildUI(); });
    const gmPurge = document.getElementById('gmPurge');
    if (gmPurge) gmPurge.addEventListener('click', () => { this.game.gmTool = this.game.gmTool === 'purge_faith' ? null : 'purge_faith'; this.buildUI(); });
    const gmDeselect = document.getElementById('gmDeselect');
    if (gmDeselect) gmDeselect.addEventListener('click', () => { this.game.gmTool = null; this.buildUI(); });
    const gmReset = document.getElementById('gmReset');
    if (gmReset) {
      gmReset.addEventListener('click', () => {
        if (confirm('RESET THE ENTIRE WORLD? This destroys all religions, territory, and progress. Cannot be undone.')) {
          this.game.gmResetWorld();
        }
      });
    }
  }

  // Update tooltip on hover
  updateTooltip(tileX, tileY) {
    const tooltip = document.getElementById('tileTooltip');
    if (!tooltip) return;

    const w = this.game.world;
    if (!w || tileX < 0 || tileY < 0 || tileX >= w.width || tileY >= w.height) {
      tooltip.style.display = 'none';
      return;
    }

    const idx = tileY * w.width + tileX;
    const terrain = w.tiles[idx];
    const pop = w.population[idx];
    const owner = w.faithOwner[idx];
    const faith = w.faithStrength[idx];

    let ownerInfo = 'Unclaimed';
    if (owner >= 0) {
      const rel = this.game.religions[owner];
      if (rel) {
        ownerInfo = `<span style="color:${rel.color}">${rel.name}</span> (${Math.round(faith / 2.55)}%)`;
      }
    }

    // Check for settlement at this tile
    let settlementInfo = '';
    if (this.game.settlementManager) {
      const s = this.game.settlementManager.settlements.find(
        s => Math.abs(s.x - tileX) <= 1 && Math.abs(s.y - tileY) <= 1
      );
      if (s) {
        const st = SETTLEMENT_TYPES[s.type];
        settlementInfo = `<div style="color:${st?.color || '#ccc'}">${st?.icon || ''} ${s.name} (${st?.name || s.type})</div>`;
      }
    }

    // Check for kingdom
    let kingdomInfo = '';
    if (owner >= 0 && this.game.settlementManager) {
      const k = this.game.settlementManager.kingdoms.find(k => k.religionIndex === owner);
      if (k) {
        kingdomInfo = `<div style="opacity:0.6">👑 ${k.name}</div>`;
      }
    }

    tooltip.innerHTML = `
      <div><strong>${TERRAIN_NAMES[terrain] || 'Unknown'}</strong> (${tileX}, ${tileY})</div>
      <div>Pop: ${pop} / ${TERRAIN_POP_CAP[terrain] || 0}</div>
      <div>${ownerInfo}</div>
      ${settlementInfo}
      ${kingdomInfo}
    `;
    tooltip.style.display = 'block';
  }

  refreshHUD() {
    if (this.currentScreen === 'playing') {
      this.buildUI();
    }
  }
}
