// ============================================
// THE HANDS OF THE DIVINE — Simulation Engine
// ============================================

class Simulation {
  constructor(world, religions, holySites) {
    this.world = world;
    this.religions = religions || [];
    this.holySites = holySites || [];
    this.eventQueue = [];
    this.tickCount = 0;
  }

  // Run N ticks (for catch-up simulation)
  runTicks(count) {
    const batchSize = Math.min(count, CONFIG.MAX_CATCHUP_TICKS);
    for (let i = 0; i < batchSize; i++) {
      this.tick();
    }
    return this.eventQueue.splice(0);
  }

  // Single simulation tick
  tick() {
    this.tickCount++;
    const w = this.world;
    const width = w.width;
    const height = w.height;

    // Pre-compute religion effects
    const relEffects = {};
    for (const rel of this.religions) {
      relEffects[rel.index] = getCombinedEffects(rel.traits || []);
    }

    // Pre-compute holy site influence map (sparse)
    const holySiteInfluence = this._computeHolySiteInfluence();

    // Process each inhabited tile
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const terrain = w.tiles[idx];

        // Skip water
        if (terrain === TERRAIN.DEEP_WATER || terrain === TERRAIN.WATER) continue;

        const pop = w.population[idx];
        const owner = w.faithOwner[idx];
        const faith = w.faithStrength[idx];

        // ─── Population growth ─────────────────────────────────
        if (pop > 0) {
          const cap = TERRAIN_POP_CAP[terrain];
          let growthRate = 0.02; // base 2% per tick

          if (owner >= 0 && relEffects[owner]) {
            const fx = relEffects[owner];
            growthRate *= (fx.popGrowthMult || 1);

            // Terrain-specific growth bonuses
            if (terrain === TERRAIN.COAST && fx.popGrowthCoast) {
              growthRate *= fx.popGrowthCoast;
            }
          }

          // Logistic growth curve
          const growth = growthRate * pop * (1 - pop / cap);
          w.population[idx] = Math.min(cap, Math.max(1, Math.round(pop + growth)));
        }

        // ─── Faith strength growth in owned tiles ──────────────
        if (owner >= 0 && faith < 255) {
          let faithGrowth = 2;
          const fx = relEffects[owner] || {};

          faithGrowth *= (fx.faithGrowthMult || 1);

          // Holy site bonus
          const hsBonus = holySiteInfluence[idx];
          if (hsBonus && hsBonus.religion === owner) {
            faithGrowth *= (1 + hsBonus.power * 0.1);
          }

          // Adjacency bonus
          if (fx.adjacencyBonus) {
            const neighbors = this._getNeighbors(x, y);
            let friendlyCount = 0;
            for (const [nx, ny] of neighbors) {
              if (w.faithOwner[ny * width + nx] === owner) friendlyCount++;
            }
            faithGrowth *= (1 + friendlyCount * 0.1);
          }

          w.faithStrength[idx] = Math.min(255, faith + Math.round(faithGrowth));
        }

        // ─── Faith decay in unoccupied tiles with faith ────────
        if (owner >= 0 && pop === 0 && faith > 0) {
          const fx = relEffects[owner] || {};
          const decay = fx.faithDecay || 1;
          w.faithStrength[idx] = Math.max(0, faith - Math.round(1 * decay));
          if (w.faithStrength[idx] === 0) {
            w.faithOwner[idx] = -1;
          }
        }

        // ─── Faith spreading ───────────────────────────────────
        if (owner >= 0 && faith > 30 && pop > 10) {
          this._spreadFaith(x, y, idx, owner, faith, relEffects, holySiteInfluence);
        }

        // ─── Plague bearers aura ───────────────────────────────
        if (owner >= 0 && relEffects[owner]?.plagueAura) {
          const neighbors = this._getNeighbors(x, y);
          for (const [nx, ny] of neighbors) {
            const nIdx = ny * width + nx;
            const nOwner = w.faithOwner[nIdx];
            if (nOwner >= 0 && nOwner !== owner && w.population[nIdx] > 5) {
              w.population[nIdx] = Math.max(1, w.population[nIdx] - 1);
            }
          }
        }
      }
    }

    // ─── Random underground spread ─────────────────────────────
    for (const rel of this.religions) {
      const fx = relEffects[rel.index];
      if (!fx?.randomSpread) continue;
      if (this.tickCount % 10 !== 0) continue; // every 10 ticks

      // Find a random land tile and try to seed faith
      for (let attempt = 0; attempt < 3; attempt++) {
        const rx = Math.floor(Math.random() * width);
        const ry = Math.floor(Math.random() * height);
        const rIdx = ry * width + rx;
        if (w.tiles[rIdx] <= TERRAIN.WATER) continue;
        if (w.faithOwner[rIdx] >= 0) continue;
        if (w.population[rIdx] < 5) continue;
        w.faithOwner[rIdx] = rel.index;
        w.faithStrength[rIdx] = 15;
        this.eventQueue.push({
          tick: this.tickCount, type: 'underground_spread',
          religionId: rel.id, x: rx, y: ry,
          desc: `${rel.name} emerged in a distant land!`
        });
        break;
      }
    }

    // ─── Prophet spawning ──────────────────────────────────────
    for (const rel of this.religions) {
      const fx = relEffects[rel.index];
      if (!fx?.prophetSpawn) continue;
      if (this.tickCount % 30 !== 0) continue;

      // Boost a random owned tile significantly
      const ownedTiles = [];
      for (let i = 0; i < width * height; i++) {
        if (w.faithOwner[i] === rel.index) ownedTiles.push(i);
      }
      if (ownedTiles.length > 0) {
        const target = ownedTiles[Math.floor(Math.random() * ownedTiles.length)];
        w.faithStrength[target] = Math.min(255, w.faithStrength[target] + 50);
        const tx = target % width;
        const ty = Math.floor(target / width);
        this.eventQueue.push({
          tick: this.tickCount, type: 'prophet',
          religionId: rel.id, x: tx, y: ty,
          desc: `A prophet of ${rel.name} appeared!`
        });
      }
    }

    // ─── Random natural events (rare) ──────────────────────────
    if (this.tickCount % 50 === 0 && Math.random() < 0.3) {
      this._naturalEvent();
    }

    // ─── Sacrifice for power ───────────────────────────────────
    for (const rel of this.religions) {
      const fx = relEffects[rel.index];
      if (!fx?.sacrificeForPower) continue;
      if (this.tickCount % 20 !== 0) continue;

      let totalPop = 0;
      for (let i = 0; i < width * height; i++) {
        if (w.faithOwner[i] === rel.index) totalPop += w.population[i];
      }
      // Sacrifice 1% of population for divine power
      const sacrifice = Math.floor(totalPop * 0.01);
      if (sacrifice > 0) {
        rel.divine_power = (rel.divine_power || 0) + sacrifice * 2;
        // Reduce population proportionally
        for (let i = 0; i < width * height; i++) {
          if (w.faithOwner[i] === rel.index && w.population[i] > 5) {
            w.population[i] = Math.max(1, Math.round(w.population[i] * 0.99));
          }
        }
      }
    }
  }

  _spreadFaith(x, y, idx, owner, faith, relEffects, holySiteInfluence) {
    const w = this.world;
    const width = w.width;
    const fx = relEffects[owner] || {};
    const spreadMult = fx.spreadMult || 1;
    const neighbors = this._getNeighbors(x, y);

    for (const [nx, ny] of neighbors) {
      const nIdx = ny * width + nx;
      const nTerrain = w.tiles[nIdx];
      const nOwner = w.faithOwner[nIdx];

      // Skip same owner
      if (nOwner === owner) continue;

      // Terrain passability
      let difficulty = TERRAIN_SPREAD_DIFFICULTY[nTerrain] || 1;
      if (nTerrain === TERRAIN.DEEP_WATER || nTerrain === TERRAIN.WATER) {
        if (!fx.waterSpread) continue;
        difficulty = 2.0;
      }

      // Terrain bonuses from traits
      if (nTerrain === TERRAIN.COAST && fx.coastSpread) difficulty /= fx.coastSpread;
      if (nTerrain === TERRAIN.DESERT && (fx.desertSpread || fx.desertBonus)) difficulty /= (fx.desertSpread || fx.desertBonus || 1);
      if (nTerrain === TERRAIN.TUNDRA && (fx.tundraSpread || fx.tundraBonus)) difficulty /= (fx.tundraSpread || fx.tundraBonus || 1);
      if ((nTerrain === TERRAIN.FOREST || nTerrain === TERRAIN.DENSE_FOREST) && fx.forestBonus) difficulty /= fx.forestBonus;
      if (nTerrain === TERRAIN.SWAMP && fx.swampBonus) difficulty /= fx.swampBonus;
      if (nTerrain === TERRAIN.MOUNTAIN && fx.mountainBonus) difficulty /= fx.mountainBonus;
      if (nTerrain === TERRAIN.HILLS && fx.hillsBonus) difficulty /= fx.hillsBonus;
      if (nTerrain === TERRAIN.SNOW && fx.snowBonus) difficulty /= fx.snowBonus;
      if ((nTerrain === TERRAIN.PLAINS || nTerrain === TERRAIN.GRASSLAND) && fx.openTerrainBonus) difficulty /= fx.openTerrainBonus;
      if (fx.noTerrainPenalty) difficulty = Math.min(difficulty, 1.0);

      // Harsh terrain general modifier
      const isHarsh = [TERRAIN.MOUNTAIN, TERRAIN.SNOW, TERRAIN.DESERT, TERRAIN.SWAMP].includes(nTerrain);
      if (isHarsh && fx.harshTerrainBonus) difficulty /= fx.harshTerrainBonus;
      if (!isHarsh && fx.goodTerrainMult) difficulty /= fx.goodTerrainMult;
      if (isHarsh && fx.harshTerrainMult) difficulty *= (1 / fx.harshTerrainMult);

      // Calculate spread chance
      let spreadChance = 0.08 * spreadMult / difficulty;
      spreadChance *= (faith / 255); // stronger faith = more spread

      // Weak tile bonus
      if (fx.weakTileBonus && nOwner >= 0 && w.faithStrength[nIdx] < 30) {
        spreadChance *= fx.weakTileBonus;
      }

      // Enemy territory bonus
      if (fx.enemyTerritoryBonus && nOwner >= 0) {
        spreadChance *= fx.enemyTerritoryBonus;
      }

      if (Math.random() < spreadChance) {
        if (nOwner === -1) {
          // Unclaimed tile — take it
          w.faithOwner[nIdx] = owner;
          w.faithStrength[nIdx] = 10;
        } else {
          // Contested tile — weaken then take
          const defFx = relEffects[nOwner] || {};
          const defense = (defFx.defenseMult || 1);

          // Holy site defense
          const hsBonus = holySiteInfluence[nIdx];
          const hsDef = (hsBonus && hsBonus.religion === nOwner && defFx.holySiteDefense) ? defFx.holySiteDefense : 1;

          const damage = Math.max(1, Math.round(5 / defense / hsDef));

          // Warlike: forced conversion possible
          if (fx.forcedConversion && faith > w.faithStrength[nIdx]) {
            w.faithStrength[nIdx] -= damage * 2;
          } else {
            w.faithStrength[nIdx] -= damage;
          }

          if (w.faithStrength[nIdx] <= 0) {
            // Destroy enemy holy sites if iconoclast
            if (fx.destroyHolySites) {
              this.holySites = this.holySites.filter(hs => !(hs.tile_x === nx && hs.tile_y === ny));
            }
            w.faithOwner[nIdx] = owner;
            w.faithStrength[nIdx] = 10;

            // Absorb population if cannibalistic
            if (fx.absorbPop) {
              const stolen = Math.floor(w.population[nIdx] * 0.3);
              w.population[idx] = Math.min(TERRAIN_POP_CAP[w.tiles[idx]], w.population[idx] + stolen);
            }
          }
        }
      }
    }
  }

  _getNeighbors(x, y) {
    const dirs = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
    const result = [];
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < this.world.width && ny >= 0 && ny < this.world.height) {
        result.push([nx, ny]);
      }
    }
    return result;
  }

  _computeHolySiteInfluence() {
    const map = {};
    const baseRadius = 8;

    for (const hs of this.holySites) {
      const rel = this.religions.find(r => r.id === hs.religion_id);
      if (!rel) continue;
      const fx = getCombinedEffects(rel.traits || []);
      const radius = Math.round(baseRadius * (fx.holySiteRadiusMult || 1));
      const power = (hs.power || 10) * (fx.holySitePowerMult || 1);

      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > radius) continue;
          const tx = hs.tile_x + dx;
          const ty = hs.tile_y + dy;
          if (tx < 0 || tx >= this.world.width || ty < 0 || ty >= this.world.height) continue;
          const idx = ty * this.world.width + tx;
          const influence = power * (1 - dist / radius);
          if (!map[idx] || map[idx].power < influence) {
            map[idx] = { religion: rel.index, power: influence };
          }
        }
      }
    }

    return map;
  }

  _naturalEvent() {
    const w = this.world;
    const rx = Math.floor(Math.random() * w.width);
    const ry = Math.floor(Math.random() * w.height);

    if (w.tiles[ry * w.width + rx] <= TERRAIN.WATER) return;

    const events = ['drought', 'plague', 'bounty', 'earthquake'];
    const event = events[Math.floor(Math.random() * events.length)];
    const radius = 5 + Math.floor(Math.random() * 8);

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.sqrt(dx * dx + dy * dy) > radius) continue;
        const tx = rx + dx;
        const ty = ry + dy;
        if (tx < 0 || tx >= w.width || ty < 0 || ty >= w.height) continue;
        const idx = ty * w.width + tx;

        switch (event) {
          case 'drought':
            w.population[idx] = Math.max(0, Math.round(w.population[idx] * 0.7));
            break;
          case 'plague':
            w.population[idx] = Math.max(0, Math.round(w.population[idx] * 0.5));
            w.faithStrength[idx] = Math.max(0, w.faithStrength[idx] - 20);
            break;
          case 'bounty':
            const cap = TERRAIN_POP_CAP[w.tiles[idx]] || 0;
            w.population[idx] = Math.min(cap, Math.round(w.population[idx] * 1.5) + 10);
            break;
          case 'earthquake':
            w.population[idx] = Math.max(0, Math.round(w.population[idx] * 0.4));
            w.faithStrength[idx] = Math.max(0, w.faithStrength[idx] - 40);
            if (w.faithStrength[idx] <= 0) w.faithOwner[idx] = -1;
            break;
        }
      }
    }

    const eventNames = { drought: '☀️ Drought', plague: '☠️ Plague', bounty: '🌿 Bountiful Harvest', earthquake: '🌋 Earthquake' };
    this.eventQueue.push({
      tick: this.tickCount, type: event, x: rx, y: ry,
      desc: `${eventNames[event]} struck at (${rx}, ${ry})!`
    });
  }

  // Apply a miracle at a location
  applyMiracle(miracleId, x, y, religionIndex) {
    const m = CONFIG.MIRACLES[miracleId];
    if (!m) return;

    const w = this.world;
    const rel = this.religions.find(r => r.index === religionIndex);
    const fx = rel ? getCombinedEffects(rel.traits || []) : {};
    const powerMult = fx.miraclePowerMult || 1;
    const radius = m.radius;

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.sqrt(dx * dx + dy * dy) > radius) continue;
        const tx = x + dx;
        const ty = y + dy;
        if (tx < 0 || tx >= w.width || ty < 0 || ty >= w.height) continue;
        const idx = ty * w.width + tx;

        switch (miracleId) {
          case 'bless':
            if (w.faithOwner[idx] === religionIndex) {
              w.faithStrength[idx] = Math.min(255, w.faithStrength[idx] + Math.round(20 * powerMult));
              const cap = TERRAIN_POP_CAP[w.tiles[idx]] || 0;
              w.population[idx] = Math.min(cap, w.population[idx] + Math.round(10 * powerMult));
            }
            break;
          case 'drought':
            if (w.faithOwner[idx] !== religionIndex) {
              w.population[idx] = Math.max(0, Math.round(w.population[idx] * (1 - 0.3 * powerMult)));
            }
            break;
          case 'storm':
            if (w.faithOwner[idx] !== religionIndex) {
              w.faithStrength[idx] = Math.max(0, w.faithStrength[idx] - Math.round(30 * powerMult));
              if (w.faithStrength[idx] <= 0) w.faithOwner[idx] = -1;
            }
            break;
          case 'inspire':
            if (w.faithOwner[idx] === religionIndex || w.faithOwner[idx] === -1) {
              w.faithStrength[idx] = Math.min(255, w.faithStrength[idx] + Math.round(15 * powerMult));
              if (w.faithOwner[idx] === -1 && w.population[idx] > 0) {
                w.faithOwner[idx] = religionIndex;
              }
            }
            break;
          case 'pestilence':
            w.population[idx] = Math.max(0, Math.round(w.population[idx] * (1 - 0.4 * powerMult)));
            w.faithStrength[idx] = Math.max(0, w.faithStrength[idx] - Math.round(25 * powerMult));
            if (w.faithStrength[idx] <= 0) w.faithOwner[idx] = -1;
            break;
          case 'earthquake':
            w.population[idx] = Math.max(0, Math.round(w.population[idx] * (1 - 0.5 * powerMult)));
            w.faithStrength[idx] = Math.max(0, w.faithStrength[idx] - Math.round(50 * powerMult));
            if (w.faithStrength[idx] <= 0) w.faithOwner[idx] = -1;
            break;
          case 'fertility':
            const cap = TERRAIN_POP_CAP[w.tiles[idx]] || 0;
            w.population[idx] = Math.min(cap, Math.round(w.population[idx] * (1 + 0.5 * powerMult)) + 5);
            break;
          case 'vision':
            // Just reveals info — handled by renderer
            break;
        }
      }
    }

    this.eventQueue.push({
      tick: this.tickCount, type: 'miracle', religionId: rel?.id,
      x, y, desc: `${rel?.name || 'Unknown'} invoked ${m.icon} ${m.name}!`
    });
  }

  // Get stats for all religions
  getStats() {
    const w = this.world;
    const stats = {};
    for (const rel of this.religions) {
      stats[rel.index] = { tiles: 0, population: 0, totalFaith: 0, avgFaith: 0 };
    }

    for (let i = 0; i < w.width * w.height; i++) {
      const owner = w.faithOwner[i];
      if (owner >= 0 && stats[owner]) {
        stats[owner].tiles++;
        stats[owner].population += w.population[i];
        stats[owner].totalFaith += w.faithStrength[i];
      }
    }

    for (const s of Object.values(stats)) {
      s.avgFaith = s.tiles > 0 ? Math.round(s.totalFaith / s.tiles) : 0;
    }

    return stats;
  }
}
