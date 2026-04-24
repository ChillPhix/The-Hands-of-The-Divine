// ============================================
// THE HANDS OF THE DIVINE — Main Game
// ============================================

const GM_PASSWORD = 'divinemaster'; // Change this to your own password

class Game {
  constructor() {
    this.world = null;
    this.religions = [];
    this.holySites = [];
    this.events = [];
    this.tickCount = 0;
    this.myReligion = null;
    this.stats = {};

    this.storage = new Storage();
    this.simulation = null;
    this.renderer = null;
    this.ui = null;
    this.settlementManager = null;

    this.placingHolySite = null;
    this.choosingSpawn = false; // spawn picker mode
    this.pendingReligion = null; // religion data waiting for spawn
    this.lastSyncTick = 0;
    this.tickTimer = null;
    this.renderTimer = null;
    this.dirty = false;

    // GM mode
    this.isGM = false;
    this.gmTool = null; // current GM tool
  }

  async init() {
    this.ui = new UI(this);
    this.ui.setScreen('loading');

    // Connect to Supabase
    this.ui.setLoadProgress(10);
    const connected = await this.storage.init();

    // ─── Load or generate shared world ──────────────────────────
    this.ui.setLoadProgress(20);
    const worldState = await this.storage.loadWorldState();

    this.ui.setLoadProgress(30);

    // Always try to load chunks from Supabase first
    let chunks = null;
    if (connected) {
      chunks = await this.storage.loadChunks();
    }

    this.ui.setLoadProgress(50);

    if (chunks && Object.keys(chunks).length > 0) {
      // ─── Existing world found — load it ─────────────────────
      console.log('Loading shared world from Supabase...');
      this.world = chunksToWorld(chunks, CONFIG.WORLD_WIDTH, CONFIG.WORLD_HEIGHT);
      this.tickCount = worldState?.tick_count || 0;
    } else {
      // ─── No world exists yet — we're the first player ───────
      console.log('No world found — generating new shared world...');
      this.world = generateWorld(CONFIG.WORLD_WIDTH, CONFIG.WORLD_HEIGHT, CONFIG.WORLD_SEED);
      this.tickCount = 0;

      // Save to Supabase so all other players get this same world
      if (connected) {
        const newChunks = worldToChunks(this.world);
        await this.storage.saveChunks(newChunks);
        await this.storage.saveWorldState(0);
        console.log('Shared world saved to Supabase.');
      }
    }

    // ─── Load religions, holy sites, events ─────────────────────
    this.ui.setLoadProgress(60);
    this.religions = await this.storage.loadReligions();
    this.holySites = await this.storage.loadHolySites();
    this._assignReligionIndices();
    this.events = await this.storage.loadRecentEvents(100);

    // ─── Catch-up simulation ────────────────────────────────────
    this.simulation = new Simulation(this.world, this.religions, this.holySites);
    this.simulation.tickCount = this.tickCount;

    if (worldState?.last_tick_at && this.religions.length > 0) {
      const lastTick = new Date(worldState.last_tick_at).getTime();
      const now = Date.now();
      const elapsedMs = now - lastTick;
      const missedTicks = Math.floor(elapsedMs / CONFIG.TICK_INTERVAL_MS);

      if (missedTicks > 1) {
        const catchupTicks = Math.min(missedTicks, CONFIG.MAX_CATCHUP_TICKS);
        console.log(`Catching up ${catchupTicks} ticks (${missedTicks} missed)...`);

        const batchSize = 100;
        for (let i = 0; i < catchupTicks; i += batchSize) {
          const batch = Math.min(batchSize, catchupTicks - i);
          const newEvents = this.simulation.runTicks(batch);
          this.events.push(...newEvents);
          this.tickCount += batch;
          this.ui.setLoadProgress(60 + (i / catchupTicks) * 25);

          // Yield to prevent browser freeze
          if (i % 500 === 0 && i > 0) {
            await new Promise(r => setTimeout(r, 0));
          }
        }

        this.simulation.tickCount = this.tickCount;

        // Save caught-up state back to Supabase
        if (connected) {
          const catchupChunks = worldToChunks(this.world);
          await this.storage.saveChunks(catchupChunks);
          await this.storage.saveWorldState(this.tickCount);
          if (this.events.length > 0) {
            await this.storage.saveEvents(this.events.filter(e => !e.saved).slice(-50));
          }
          console.log('Catch-up state saved.');
        }
      }
    }

    // ─── Check for returning player ─────────────────────────────
    this.ui.setLoadProgress(90);
    const myRelId = localStorage.getItem('hotd_myReligionId');
    if (myRelId) {
      this.myReligion = this.religions.find(r => r.id === myRelId);
    }

    // ─── Setup renderer ─────────────────────────────────────────
    this.ui.setLoadProgress(95);
    this._setupRenderer();
    this.stats = this.simulation.getStats();

    this.ui.setLoadProgress(100);

    // Go to appropriate screen
    setTimeout(() => {
      this.ui.setScreen(this.myReligion ? 'playing' : 'menu');
      this._startGameLoop();
    }, 500);
  }

  _assignReligionIndices() {
    this.religions.forEach((r, i) => { r.index = i; });
  }

  _setupRenderer() {
    const canvas = document.getElementById('gameCanvas');
    const minimap = document.getElementById('minimapCanvas');
    this.renderer = new Renderer(canvas, minimap, this.world, this.religions);
    this.renderer.holySites = this.holySites;
    this.renderer.resize();

    // Settlement manager
    this.settlementManager = new SettlementManager(this.world, this.religions);
    this.settlementManager.update(this.tickCount);
    this.renderer.settlementManager = this.settlementManager;

    // Resource manager
    this.resourceManager = new ResourceManager(this.world);
    this.resourceManager.generateDeposits(CONFIG.WORLD_SEED);
    for (const rel of this.religions) {
      this.resourceManager.initStockpile(rel.index);
    }
    this.renderer.resourceManager = this.resourceManager;

    // Agent manager
    this.agentManager = new AgentManager(this.world, this.religions);
    this.renderer.agentManager = this.agentManager;

    if (this.myReligion) {
      this.renderer.myReligionIndex = this.myReligion.index;
    }

    window.addEventListener('resize', () => this.renderer.resize());
    this.renderer.onClick = (x, y) => this._handleTileClick(x, y);

    // Center on player's territory
    if (this.myReligion) {
      const myIdx = this.myReligion.index;
      for (let i = 0; i < this.world.width * this.world.height; i++) {
        if (this.world.faithOwner[i] === myIdx) {
          this.renderer.goTo(i % this.world.width, Math.floor(i / this.world.width));
          break;
        }
      }
    }
  }

  // ─── Game Loop ────────────────────────────────────────────────────────────
  _startGameLoop() {
    // Simulation tick
    this.tickTimer = setInterval(() => this._tick(), CONFIG.TICK_INTERVAL_MS);

    // Render loop
    const renderLoop = () => {
      if (this.renderer && (this.ui.currentScreen === 'playing' || this.choosingSpawn)) {
        this.renderer.render();

        // Spawn picker overlay
        if (this.choosingSpawn && this.renderer.hoveredTile) {
          this._drawSpawnPreview();
        }

        if (this.renderer.hoveredTile) {
          this.ui.updateTooltip(this.renderer.hoveredTile.x, this.renderer.hoveredTile.y);
        }
      }
      this.renderTimer = requestAnimationFrame(renderLoop);
    };
    renderLoop();

    // Periodic sync
    setInterval(() => {
      if (this.dirty) this._syncToStorage();
    }, CONFIG.SYNC_INTERVAL_MS);

    // Periodic HUD refresh
    setInterval(() => {
      if (this.ui.currentScreen === 'playing') {
        this.stats = this.simulation.getStats();
        for (const rel of this.religions) {
          const s = this.stats[rel.index];
          if (s) {
            rel.territory_count = s.tiles;
            rel.follower_count = s.population;
          }
        }
        if (this.myReligion) {
          const myStats = this.stats[this.myReligion.index] || {};
          this.myReligion.divine_power = Math.min(200,
            (this.myReligion.divine_power || 0) + (myStats.tiles || 0) * 0.01 + 0.1
          );
          for (const key of Object.keys(this.ui.miracleCooldowns)) {
            if (this.ui.miracleCooldowns[key] > 0) this.ui.miracleCooldowns[key]--;
          }
        }
        this.ui.refreshHUD();
        this.renderer.minimapDirty = true;
      }
    }, 5000);
  }

  _tick() {
    if (!this.simulation || !this.world) return;

    const newEvents = this.simulation.runTicks(1);
    this.tickCount++;
    this.events.push(...newEvents);
    this.dirty = true;

    // Resources
    if (this.resourceManager) {
      this.resourceManager.gatherTick(this.religions);
    }

    // Agents
    if (this.agentManager) {
      const settlements = this.settlementManager?.settlements || [];
      this.agentManager.update(this.tickCount, this.resourceManager, settlements);
    }

    if (this.settlementManager) {
      this.settlementManager.update(this.tickCount);
      const relEvent = this.settlementManager._processRelations(this.tickCount);
      if (relEvent) this.events.push(relEvent);
    }

    this.events = this.events.slice(-200);
    if (this.tickCount % 5 === 0) this.renderer.minimapDirty = true;
  }

  _drawSpawnPreview() {
    const ctx = this.renderer.ctx;
    const tile = this.renderer.hoveredTile;
    if (!tile) return;
    const ts = this.renderer.tileSize;
    const zoom = this.renderer.zoom;
    const radius = 3;

    // Draw preview circle in the pending religion's color
    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(-this.renderer.camX, -this.renderer.camY);

    const color = this.pendingReligion?.color || '#f0d060';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2 / zoom;
    ctx.globalAlpha = 0.6 + Math.sin(Date.now() * 0.005) * 0.2;
    ctx.beginPath();
    ctx.arc(tile.x * ts + ts/2, tile.y * ts + ts/2, radius * ts, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.1;
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  async _syncToStorage() {
    if (!this.dirty) return;
    this.dirty = false;

    try {
      const chunks = worldToChunks(this.world);
      await this.storage.saveChunks(chunks);
      await this.storage.saveWorldState(this.tickCount);

      const unsaved = this.events.filter(e => !e.saved);
      if (unsaved.length > 0) {
        await this.storage.saveEvents(unsaved.slice(-30));
        unsaved.forEach(e => e.saved = true);
      }

      if (this.myReligion) {
        const s = this.stats[this.myReligion.index] || {};
        await this.storage.updateReligionStats(this.myReligion.id, {
          divine_power: this.myReligion.divine_power,
          population: s.population || 0,
          tiles: s.tiles || 0,
        });
      }
    } catch (err) {
      console.error('Sync error:', err);
      this.dirty = true;
    }
  }

  // ─── Create Religion (now with spawn picker) ──────────────────────────────
  async createReligion(data) {
    const id = `rel_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const religion = {
      id,
      index: this.religions.length,
      name: data.name,
      color: data.color,
      traits: data.traits,
      symbol_data: data.symbol_data,
      creator_name: data.creator_name,
      divine_power: CONFIG.STARTING_DIVINE_POWER,
      territory_count: 0,
      follower_count: 0,
    };

    const fx = getCombinedEffects(data.traits);
    if (fx.startingPowerMult) religion.divine_power *= fx.startingPowerMult;

    // Store pending and enter spawn picker mode
    this.pendingReligion = religion;
    this.choosingSpawn = true;

    // Show the map so they can pick
    this.religions.push(religion);
    this.myReligion = religion;
    this.simulation.religions = this.religions;
    this.renderer.religions = this.religions;
    this.renderer.myReligionIndex = religion.index;

    this.ui.setScreen('playing');
    // The UI will show a spawn picker overlay
    this.ui.showSpawnPicker = true;
    this.ui.refreshHUD();
  }

  async _finalizeSpawn(x, y) {
    const religion = this.pendingReligion;
    if (!religion) return;

    // Check tile is valid for spawning
    const idx = y * this.world.width + x;
    if (this.world.tiles[idx] <= TERRAIN.WATER) return;

    // Claim starting area
    const startRadius = 4;
    for (let dy = -startRadius; dy <= startRadius; dy++) {
      for (let dx = -startRadius; dx <= startRadius; dx++) {
        if (Math.sqrt(dx * dx + dy * dy) > startRadius) continue;
        const tx = x + dx;
        const ty = y + dy;
        if (tx < 0 || tx >= this.world.width || ty < 0 || ty >= this.world.height) continue;
        const tidx = ty * this.world.width + tx;
        if (this.world.tiles[tidx] <= TERRAIN.WATER) continue;
        if (this.world.faithOwner[tidx] >= 0) continue;
        this.world.faithOwner[tidx] = religion.index;
        this.world.faithStrength[tidx] = 100 + Math.floor(Math.random() * 100);
      }
    }

    localStorage.setItem('hotd_myReligionId', religion.id);
    await this.storage.saveReligion(religion);

    // Init resources for this religion
    if (this.resourceManager) {
      this.resourceManager.initStockpile(religion.index);
    }

    // Spawn starting agents
    if (this.agentManager) {
      this.agentManager.spawnStartingAgents(religion.index, x, y, this.tickCount);
    }

    const event = {
      tick: this.tickCount, type: 'religion_created',
      religionId: religion.id, desc: `✦ ${religion.name} has manifested in the world!`
    };
    this.events.push(event);

    this.choosingSpawn = false;
    this.pendingReligion = null;
    this.ui.showSpawnPicker = false;
    this.dirty = true;
    await this._syncToStorage();

    this.renderer.goTo(x, y);
    this.stats = this.simulation.getStats();
    this.ui.refreshHUD();
  }

  // ─── Handle Tile Click ────────────────────────────────────────────────────
  _handleTileClick(x, y) {
    // Spawn picker mode
    if (this.choosingSpawn) {
      this._finalizeSpawn(x, y);
      return;
    }

    if (!this.myReligion) return;

    // GM tools
    if (this.isGM && this.gmTool) {
      this._handleGMClick(x, y);
      return;
    }

    // Miracle usage
    if (this.ui.selectedMiracle) {
      const miracleId = this.ui.selectedMiracle;
      const m = CONFIG.MIRACLES[miracleId];
      if (!m) return;

      const fx = getCombinedEffects(this.myReligion.traits || []);
      const cost = Math.round(m.cost * (fx.miracleCostMult || 1));

      if ((this.myReligion.divine_power || 0) < cost) return;
      if ((this.ui.miracleCooldowns[miracleId] || 0) > 0) return;

      this.simulation.applyMiracle(miracleId, x, y, this.myReligion.index);
      this.myReligion.divine_power -= cost;

      const cdMult = fx.miracleCooldownMult || 1;
      this.ui.miracleCooldowns[miracleId] = Math.round(m.cooldownTicks * cdMult);

      this.ui.selectedMiracle = null;
      this.renderer.selectedMiracle = null;
      this.dirty = true;
      this.renderer.markDirty();
      this.ui.refreshHUD();
      return;
    }

    // Holy site placement
    if (this.placingHolySite) {
      const type = this.placingHolySite;
      const cost = CONFIG.HOLY_SITE_COSTS[type] || 10;
      const fx = getCombinedEffects(this.myReligion.traits || []);
      const actualCost = Math.round(cost * (fx.holySiteCostMult || 1));

      if ((this.myReligion.divine_power || 0) < actualCost) {
        this.placingHolySite = null;
        return;
      }

      const tidx = y * this.world.width + x;
      if (this.world.faithOwner[tidx] !== this.myReligion.index) {
        this.placingHolySite = null;
        return;
      }

      const site = {
        id: `hs_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        religion_id: this.myReligion.id,
        tile_x: x, tile_y: y,
        site_type: type,
        power: type === 'cathedral' ? 30 : type === 'temple' ? 20 : 10,
      };

      this.holySites.push(site);
      this.simulation.holySites = this.holySites;
      this.renderer.holySites = this.holySites;
      this.myReligion.divine_power -= actualCost;
      this.storage.saveHolySite(site);

      this.events.push({
        tick: this.tickCount, type: 'holy_site',
        religionId: this.myReligion.id,
        x, y, desc: `🏛️ ${this.myReligion.name} built a ${type} at (${x},${y})`
      });

      this.placingHolySite = null;
      this.dirty = true;
      this.renderer.markDirty();
      this.ui.refreshHUD();
      return;
    }

    // Regular click — claim unclaimed tile
    const tidx = y * this.world.width + x;
    if (this.world.faithOwner[tidx] === -1 && this.world.tiles[tidx] > TERRAIN.WATER) {
      if ((this.myReligion.divine_power || 0) >= 2) {
        this.world.faithOwner[tidx] = this.myReligion.index;
        this.world.faithStrength[tidx] = 50;
        this.myReligion.divine_power -= 2;
        this.dirty = true;
        this.renderer.markDirty();
      }
    }
  }

  // ─── GM Tools ─────────────────────────────────────────────────────────────
  tryGMLogin(password) {
    if (password === GM_PASSWORD) {
      this.isGM = true;
      return true;
    }
    return false;
  }

  _handleGMClick(x, y) {
    const radius = 8;
    switch (this.gmTool) {
      case 'smite':
        // Destroy everything in radius
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            if (Math.sqrt(dx*dx+dy*dy) > radius) continue;
            const tx = x+dx, ty = y+dy;
            if (tx<0||tx>=this.world.width||ty<0||ty>=this.world.height) continue;
            const i = ty*this.world.width+tx;
            this.world.population[i] = 0;
            this.world.faithOwner[i] = -1;
            this.world.faithStrength[i] = 0;
          }
        }
        this.events.push({ tick: this.tickCount, type: 'gm_smite', x, y,
          desc: `💀 The Divine Hand smote the land at (${x},${y})!` });
        break;

      case 'bless_area':
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            if (Math.sqrt(dx*dx+dy*dy) > radius) continue;
            const tx = x+dx, ty = y+dy;
            if (tx<0||tx>=this.world.width||ty<0||ty>=this.world.height) continue;
            const i = ty*this.world.width+tx;
            if (this.world.tiles[i] <= TERRAIN.WATER) continue;
            const cap = TERRAIN_POP_CAP[this.world.tiles[i]] || 100;
            this.world.population[i] = Math.min(cap, this.world.population[i] + 30);
          }
        }
        this.events.push({ tick: this.tickCount, type: 'gm_bless', x, y,
          desc: `🌟 The Creator blessed the land at (${x},${y})!` });
        break;

      case 'purge_faith':
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            if (Math.sqrt(dx*dx+dy*dy) > radius) continue;
            const tx = x+dx, ty = y+dy;
            if (tx<0||tx>=this.world.width||ty<0||ty>=this.world.height) continue;
            const i = ty*this.world.width+tx;
            this.world.faithOwner[i] = -1;
            this.world.faithStrength[i] = 0;
          }
        }
        this.events.push({ tick: this.tickCount, type: 'gm_purge', x, y,
          desc: `🌀 All faith was purged from (${x},${y})!` });
        break;
    }

    this.dirty = true;
    this.renderer.markDirty();
  }

  async gmResetWorld() {
    if (!this.isGM) return;

    const newSeed = Date.now() % 100000;
    this.world = generateWorld(CONFIG.WORLD_WIDTH, CONFIG.WORLD_HEIGHT, newSeed);
    this.tickCount = 0;
    this.religions = [];
    this.holySites = [];
    this.events = [{ tick: 0, type: 'gm_reset', desc: '🌍 The world has been reset by the Creator!' }];
    this.myReligion = null;
    localStorage.removeItem('hotd_myReligionId');

    // Clear Supabase
    if (this.storage.connected) {
      try {
        await this.storage.supabase.from('religions').delete().neq('id', '');
        await this.storage.supabase.from('holy_sites').delete().neq('id', '');
        await this.storage.supabase.from('world_events').delete().neq('id', 0);
      } catch (e) { console.error('GM reset cleanup error:', e); }

      const chunks = worldToChunks(this.world);
      await this.storage.saveChunks(chunks);
      await this.storage.saveWorldState(0);
      await this.storage.saveEvents(this.events);
    }

    // Reinitialize
    this.simulation = new Simulation(this.world, this.religions, this.holySites);
    this.settlementManager = new SettlementManager(this.world, this.religions);
    this.renderer.world = this.world;
    this.renderer.religions = this.religions;
    this.renderer.holySites = this.holySites;
    this.renderer.settlementManager = this.settlementManager;
    this.renderer.markDirty();
    this.stats = {};

    this.ui.setScreen('menu');
  }
}

// ─── Boot ────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  window.game = game;
  game.init().catch(err => {
    console.error('Game init failed:', err);
    document.getElementById('ui-layer').innerHTML = `
      <div class="screen" style="display:flex;align-items:center;justify-content:center;color:#e63946;font-family:monospace">
        <div style="text-align:center">
          <div style="font-size:40px;margin-bottom:16px">⚠️</div>
          <div>Failed to initialize: ${err.message}</div>
          <div style="margin-top:8px;opacity:0.5">Check console for details</div>
        </div>
      </div>
    `;
  });
});
