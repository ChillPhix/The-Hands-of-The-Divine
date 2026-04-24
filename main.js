// ============================================
// THE HANDS OF THE DIVINE — Main Game
// ============================================

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

    this.placingHolySite = null;
    this.lastSyncTick = 0;
    this.tickTimer = null;
    this.renderTimer = null;
    this.dirty = false;
    this.dirtyChunks = new Set();
  }

  async init() {
    // Setup UI
    this.ui = new UI(this);
    this.ui.setScreen('loading');

    // Connect to storage
    this.ui.setLoadProgress(10);
    const connected = await this.storage.init();

    // Load or generate world
    this.ui.setLoadProgress(30);
    const worldState = await this.storage.loadWorldState();
    const chunks = await this.storage.loadChunks();

    this.ui.setLoadProgress(50);

    if (chunks && Object.keys(chunks).length > 0) {
      // Load existing world from storage
      this.world = chunksToWorld(chunks, CONFIG.WORLD_WIDTH, CONFIG.WORLD_HEIGHT);
      this.tickCount = worldState?.tick_count || 0;

      // Calculate catch-up ticks
      if (worldState?.last_tick_at) {
        const lastTick = new Date(worldState.last_tick_at).getTime();
        const now = Date.now();
        const elapsedMs = now - lastTick;
        const missedTicks = Math.floor(elapsedMs / CONFIG.TICK_INTERVAL_MS);

        if (missedTicks > 1) {
          this.ui.setLoadProgress(60);
          console.log(`Catching up ${missedTicks} ticks...`);

          // Load religions and holy sites first for simulation
          this.religions = await this.storage.loadReligions();
          this.holySites = await this.storage.loadHolySites();
          this._assignReligionIndices();

          this.simulation = new Simulation(this.world, this.religions, this.holySites);
          this.simulation.tickCount = this.tickCount;

          const catchupTicks = Math.min(missedTicks, CONFIG.MAX_CATCHUP_TICKS);
          const batchSize = 100;
          for (let i = 0; i < catchupTicks; i += batchSize) {
            const batch = Math.min(batchSize, catchupTicks - i);
            const newEvents = this.simulation.runTicks(batch);
            this.events.push(...newEvents);
            this.tickCount += batch;
            this.ui.setLoadProgress(60 + (i / catchupTicks) * 30);

            // Yield to prevent browser freeze
            if (i % 500 === 0 && i > 0) {
              await new Promise(r => setTimeout(r, 0));
            }
          }

          if (missedTicks > CONFIG.MAX_CATCHUP_TICKS) {
            console.log(`Capped catch-up at ${CONFIG.MAX_CATCHUP_TICKS} ticks (missed ${missedTicks})`);
          }

          // Save caught-up state
          this.dirty = true;
          await this._syncToStorage();
        }
      }
    } else {
      // Generate fresh world
      console.log('Generating new world...');
      this.world = generateWorld(CONFIG.WORLD_WIDTH, CONFIG.WORLD_HEIGHT, CONFIG.WORLD_SEED);

      // Save initial world
      const chunks = worldToChunks(this.world);
      await this.storage.saveChunks(chunks);
      await this.storage.saveWorldState(0);
    }

    this.ui.setLoadProgress(90);

    // Load religions and holy sites (if not loaded during catch-up)
    if (this.religions.length === 0) {
      this.religions = await this.storage.loadReligions();
      this.holySites = await this.storage.loadHolySites();
      this._assignReligionIndices();
    }

    // Load events
    this.events = await this.storage.loadRecentEvents(50);

    // Check for returning player
    const myRelId = localStorage.getItem('hotd_myReligionId');
    if (myRelId) {
      this.myReligion = this.religions.find(r => r.id === myRelId);
    }

    // Create simulation if not already
    if (!this.simulation) {
      this.simulation = new Simulation(this.world, this.religions, this.holySites);
      this.simulation.tickCount = this.tickCount;
    }

    // Setup renderer
    this.ui.setLoadProgress(95);
    this._setupRenderer();

    // Update stats
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

    // Handle window resize
    window.addEventListener('resize', () => this.renderer.resize());

    // Handle tile clicks
    this.renderer.onClick = (x, y) => this._handleTileClick(x, y);

    // Center on player's territory if exists
    if (this.myReligion) {
      const myIdx = this.myReligion.index;
      for (let i = 0; i < this.world.width * this.world.height; i++) {
        if (this.world.faithOwner[i] === myIdx) {
          const tx = i % this.world.width;
          const ty = Math.floor(i / this.world.width);
          this.renderer.goTo(tx, ty);
          break;
        }
      }
    }
  }

  // ─── Game Loop ────────────────────────────────────────────────────────────
  _startGameLoop() {
    // Simulation tick
    this.tickTimer = setInterval(() => {
      this._tick();
    }, CONFIG.TICK_INTERVAL_MS);

    // Render loop
    const renderLoop = () => {
      if (this.renderer && this.ui.currentScreen === 'playing') {
        this.renderer.render();

        // Update tooltip
        if (this.renderer.hoveredTile) {
          this.ui.updateTooltip(this.renderer.hoveredTile.x, this.renderer.hoveredTile.y);
        }
      }
      this.renderTimer = requestAnimationFrame(renderLoop);
    };
    renderLoop();

    // Periodic sync to Supabase
    setInterval(() => {
      if (this.dirty) this._syncToStorage();
    }, CONFIG.SYNC_INTERVAL_MS);

    // Periodic HUD refresh
    setInterval(() => {
      if (this.ui.currentScreen === 'playing') {
        this.stats = this.simulation.getStats();
        // Update religion stats
        for (const rel of this.religions) {
          const s = this.stats[rel.index];
          if (s) {
            rel.territory_count = s.tiles;
            rel.follower_count = s.population;
          }
        }
        // Divine power regeneration
        if (this.myReligion) {
          const myStats = this.stats[this.myReligion.index] || {};
          this.myReligion.divine_power = Math.min(200,
            (this.myReligion.divine_power || 0) + (myStats.tiles || 0) * 0.01 + 0.1
          );
          // Miracle cooldowns
          for (const key of Object.keys(this.ui.miracleCooldowns)) {
            if (this.ui.miracleCooldowns[key] > 0) {
              this.ui.miracleCooldowns[key]--;
            }
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
    this.events = this.events.slice(-200);
    this.dirty = true;

    // Track dirty chunks (simplified — mark all as dirty since we can't easily track which changed)
    // In production you'd track which tiles changed and map to chunks
    if (this.tickCount % 5 === 0) {
      this.renderer.minimapDirty = true;
    }
  }

  async _syncToStorage() {
    if (!this.dirty) return;
    this.dirty = false;

    try {
      const chunks = worldToChunks(this.world);
      await this.storage.saveChunks(chunks);
      await this.storage.saveWorldState(this.tickCount);

      if (this.events.length > 0) {
        const unsaved = this.events.filter(e => !e.saved);
        if (unsaved.length > 0) {
          await this.storage.saveEvents(unsaved);
          unsaved.forEach(e => e.saved = true);
        }
      }

      // Save religion stats
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
      this.dirty = true; // retry next interval
    }
  }

  // ─── Create Religion ──────────────────────────────────────────────────────
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

    // Check for trait bonuses
    const fx = getCombinedEffects(data.traits);
    if (fx.startingPowerMult) {
      religion.divine_power *= fx.startingPowerMult;
    }

    this.religions.push(religion);
    this.myReligion = religion;
    localStorage.setItem('hotd_myReligionId', id);

    // Save to storage
    await this.storage.saveReligion(religion);

    // Update simulation
    this.simulation.religions = this.religions;
    this.renderer.religions = this.religions;

    // Find a good starting location (populated, unclaimed plains/grassland)
    let bestIdx = -1;
    let bestScore = -1;
    for (let i = 0; i < this.world.width * this.world.height; i++) {
      const terrain = this.world.tiles[i];
      const pop = this.world.population[i];
      const owner = this.world.faithOwner[i];
      if (owner >= 0) continue;
      if (terrain <= TERRAIN.WATER) continue;

      let score = pop;
      if (terrain === TERRAIN.PLAINS || terrain === TERRAIN.GRASSLAND) score *= 2;
      if (terrain === TERRAIN.FOREST) score *= 1.5;
      // Prefer tiles away from edges
      const x = i % this.world.width;
      const y = Math.floor(i / this.world.width);
      const edgeDist = Math.min(x, y, this.world.width - x, this.world.height - y);
      score *= Math.min(1, edgeDist / 30);

      // Randomize a bit
      score *= 0.5 + Math.random();

      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0) {
      // Claim starting area (small cluster)
      const cx = bestIdx % this.world.width;
      const cy = Math.floor(bestIdx / this.world.width);
      const startRadius = 3;

      for (let dy = -startRadius; dy <= startRadius; dy++) {
        for (let dx = -startRadius; dx <= startRadius; dx++) {
          if (Math.sqrt(dx * dx + dy * dy) > startRadius) continue;
          const tx = cx + dx;
          const ty = cy + dy;
          if (tx < 0 || tx >= this.world.width || ty < 0 || ty >= this.world.height) continue;
          const idx = ty * this.world.width + tx;
          if (this.world.tiles[idx] <= TERRAIN.WATER) continue;
          if (this.world.faithOwner[idx] >= 0) continue;
          this.world.faithOwner[idx] = religion.index;
          this.world.faithStrength[idx] = 100 + Math.floor(Math.random() * 100);
        }
      }

      // Navigate camera there
      this.renderer.goTo(cx, cy);
    }

    // Log event
    const event = {
      tick: this.tickCount, type: 'religion_created',
      religionId: id, desc: `✦ ${religion.name} has manifested in the world!`
    };
    this.events.push(event);

    this.dirty = true;
    await this._syncToStorage();

    // Switch to playing
    this.stats = this.simulation.getStats();
    this.ui.setScreen('playing');
  }

  // ─── Handle Tile Click ────────────────────────────────────────────────────
  _handleTileClick(x, y) {
    if (!this.myReligion) return;

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

      const idx = y * this.world.width + x;
      if (this.world.faithOwner[idx] !== this.myReligion.index) {
        // Must place on own territory
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

    // Regular click — claim unclaimed tile if affordable
    const idx = y * this.world.width + x;
    if (this.world.faithOwner[idx] === -1 && this.world.tiles[idx] > TERRAIN.WATER) {
      if ((this.myReligion.divine_power || 0) >= 2) {
        this.world.faithOwner[idx] = this.myReligion.index;
        this.world.faithStrength[idx] = 50;
        this.myReligion.divine_power -= 2;
        this.dirty = true;
        this.renderer.markDirty();
      }
    }
  }
}

// ─── Boot ────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  window.game = game; // expose for debugging
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
