// ============================================
// THE HANDS OF THE DIVINE — Agents
// ============================================
// Key NPCs that move on the map with specific behaviors.
// Stored in memory, synced to Supabase periodically.

const AGENT_TYPES = {
  hero:     { name: 'Hero',     sprite: 'hero',     color: '#f0d060', speed: 0.8, hp: 100 },
  merchant: { name: 'Merchant', sprite: 'merchant',  color: '#4cc9f0', speed: 0.5, hp: 30 },
  priest:   { name: 'Priest',   sprite: 'priest',    color: '#e8c84a', speed: 0.4, hp: 20 },
  builder:  { name: 'Builder',  sprite: 'builder',   color: '#8fbc6b', speed: 0.4, hp: 25 },
  warrior:  { name: 'Warrior',  sprite: 'warrior',   color: '#e63946', speed: 0.6, hp: 60 },
};

// Hero name generation
const HERO_FIRST = ['Aric','Bran','Cael','Dara','Eira','Finn','Gael','Hana','Idris','Jora',
  'Kira','Liam','Mira','Nara','Orin','Peia','Qara','Rian','Sera','Tarn','Ulra','Vara','Wren','Xael','Yara','Zara',
  'Aldric','Brynn','Cyrus','Dagny','Elara','Freya','Gideon','Hector','Isolde','Jasper'];
const HERO_TITLE = ['the Brave','the Wise','Lightbringer','Ironhand','Stormborn','the Pilgrim',
  'Flameheart','Shadowwalker','the Unyielding','Dawnbreaker','the Faithful','the Wanderer',
  'Truthseeker','the Bold','Oathkeeper','the Silent','Sunforged','Moonblessed'];

// Pixel art sprite data (5x7 pixel sprites stored as arrays)
// 0=transparent, 1=body, 2=skin, 3=accent, 4=weapon/item
const SPRITE_DATA = {
  hero: [
    [0,0,3,0,0],
    [0,2,2,2,0],
    [0,3,1,3,0],
    [3,1,1,1,4],
    [0,1,1,1,0],
    [0,1,0,1,0],
    [0,1,0,1,0],
  ],
  merchant: [
    [0,0,0,0,0],
    [0,2,2,2,0],
    [0,1,1,1,0],
    [4,1,1,1,4],
    [0,1,1,1,0],
    [0,1,0,1,0],
    [0,1,0,1,0],
  ],
  priest: [
    [0,0,3,0,0],
    [0,2,2,2,0],
    [0,3,3,3,0],
    [0,3,3,3,0],
    [0,3,3,3,0],
    [0,1,0,1,0],
    [0,1,0,1,0],
  ],
  builder: [
    [0,0,0,0,0],
    [0,2,2,2,0],
    [0,1,1,1,0],
    [0,1,1,1,4],
    [0,1,1,1,0],
    [0,1,0,1,0],
    [0,1,0,1,0],
  ],
  warrior: [
    [0,3,0,0,0],
    [0,2,2,2,0],
    [0,3,1,3,0],
    [4,1,1,1,0],
    [4,1,1,1,0],
    [0,1,0,1,0],
    [0,1,0,1,0],
  ],
};

class AgentManager {
  constructor(world, religions) {
    this.world = world;
    this.religions = religions;
    this.agents = []; // all agents
    this.nextId = 1;
  }

  // Spawn an agent for a religion
  spawn(type, religionIndex, x, y, name) {
    const typeInfo = AGENT_TYPES[type];
    if (!typeInfo) return null;

    const agent = {
      id: this.nextId++,
      type,
      religionIndex,
      x, y,
      targetX: x, targetY: y,
      hp: typeInfo.hp,
      maxHp: typeInfo.hp,
      name: name || this._genName(type),
      state: 'idle', // idle, moving, working, fighting, trading
      cargo: {},     // for merchants
      path: [],      // waypoints
      homeTown: null, // settlement reference
      cooldown: 0,
      kills: 0,      // for heroes
      level: 1,
      born: 0,       // tick born
    };

    this.agents.push(agent);
    return agent;
  }

  // Spawn initial agents for a new religion
  spawnStartingAgents(religionIndex, centerX, centerY, tickCount) {
    // 1 hero, 2 builders, 1 priest
    const hero = this.spawn('hero', religionIndex, centerX, centerY);
    if (hero) hero.born = tickCount;

    for (let i = 0; i < 2; i++) {
      const b = this.spawn('builder', religionIndex,
        centerX + Math.floor(Math.random() * 4 - 2),
        centerY + Math.floor(Math.random() * 4 - 2));
      if (b) b.born = tickCount;
    }

    const priest = this.spawn('priest', religionIndex,
      centerX + Math.floor(Math.random() * 3 - 1),
      centerY + Math.floor(Math.random() * 3 - 1));
    if (priest) priest.born = tickCount;
  }

  // Update all agents (called each tick)
  update(tickCount, resourceManager, settlements) {
    for (const agent of this.agents) {
      if (agent.hp <= 0) continue;
      if (agent.cooldown > 0) { agent.cooldown--; continue; }

      switch (agent.type) {
        case 'hero': this._updateHero(agent, tickCount); break;
        case 'merchant': this._updateMerchant(agent, tickCount, resourceManager, settlements); break;
        case 'priest': this._updatePriest(agent, tickCount); break;
        case 'builder': this._updateBuilder(agent, tickCount, resourceManager, settlements); break;
        case 'warrior': this._updateWarrior(agent, tickCount); break;
      }

      // Move toward target
      this._moveToTarget(agent);
    }

    // Clean up dead agents
    this.agents = this.agents.filter(a => a.hp > 0);

    // Auto-spawn agents for religions that need them
    this._autoSpawn(tickCount, settlements);
  }

  _updateHero(agent, tickCount) {
    const w = this.world;
    // Heroes wander the border of their territory, boosting faith
    if (agent.state === 'idle' || Math.random() < 0.1) {
      // Find a border tile
      const borderTiles = this._findBorderTiles(agent.religionIndex, agent.x, agent.y, 20);
      if (borderTiles.length > 0) {
        const target = borderTiles[Math.floor(Math.random() * borderTiles.length)];
        agent.targetX = target.x;
        agent.targetY = target.y;
        agent.state = 'moving';
      }
    }

    // Boost faith in current tile
    const idx = Math.round(agent.y) * w.width + Math.round(agent.x);
    if (idx >= 0 && idx < w.width * w.height) {
      if (w.faithOwner[idx] === agent.religionIndex) {
        w.faithStrength[idx] = Math.min(255, w.faithStrength[idx] + 5);
      } else if (w.faithOwner[idx] === -1 && w.tiles[idx] > TERRAIN.WATER) {
        // Convert unclaimed tiles
        w.faithOwner[idx] = agent.religionIndex;
        w.faithStrength[idx] = 40;
      }
    }
  }

  _updateMerchant(agent, tickCount, resourceManager, settlements) {
    if (!settlements) return;
    // Merchants travel between settlements, boosting resources
    if (agent.state === 'idle') {
      const relSettlements = settlements.filter(s => s.owner === agent.religionIndex);
      if (relSettlements.length >= 2) {
        const target = relSettlements[Math.floor(Math.random() * relSettlements.length)];
        agent.targetX = target.x;
        agent.targetY = target.y;
        agent.state = 'trading';
      }
    }

    // When arriving at destination, boost resources
    if (agent.state === 'trading' && Math.abs(agent.x - agent.targetX) < 1 && Math.abs(agent.y - agent.targetY) < 1) {
      const stockpile = resourceManager?.getStockpile(agent.religionIndex);
      if (stockpile) {
        stockpile.food = Math.min(9999, (stockpile.food || 0) + 2);
        stockpile.gold = Math.min(9999, (stockpile.gold || 0) + 0.5);
      }
      agent.state = 'idle';
      agent.cooldown = 5;
    }
  }

  _updatePriest(agent, tickCount) {
    const w = this.world;
    // Priests wander owned territory boosting faith
    if (agent.state === 'idle' || Math.random() < 0.08) {
      const ox = agent.x + Math.floor(Math.random() * 16 - 8);
      const oy = agent.y + Math.floor(Math.random() * 16 - 8);
      const nx = Math.max(0, Math.min(w.width - 1, Math.round(ox)));
      const ny = Math.max(0, Math.min(w.height - 1, Math.round(oy)));
      agent.targetX = nx;
      agent.targetY = ny;
      agent.state = 'moving';
    }

    // Boost faith and convert nearby
    const radius = 2;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const tx = Math.round(agent.x) + dx;
        const ty = Math.round(agent.y) + dy;
        if (tx < 0 || tx >= w.width || ty < 0 || ty >= w.height) continue;
        const idx = ty * w.width + tx;
        if (w.tiles[idx] <= TERRAIN.WATER) continue;
        if (w.faithOwner[idx] === agent.religionIndex) {
          w.faithStrength[idx] = Math.min(255, w.faithStrength[idx] + 2);
        } else if (w.faithOwner[idx] === -1 && w.population[idx] > 5) {
          if (Math.random() < 0.05) {
            w.faithOwner[idx] = agent.religionIndex;
            w.faithStrength[idx] = 20;
          }
        }
      }
    }
  }

  _updateBuilder(agent, tickCount, resourceManager, settlements) {
    // Builders move to unclaimed territory near settlements and boost population
    if (agent.state === 'idle' || Math.random() < 0.05) {
      const ox = agent.x + Math.floor(Math.random() * 10 - 5);
      const oy = agent.y + Math.floor(Math.random() * 10 - 5);
      agent.targetX = Math.max(0, Math.min(this.world.width - 1, Math.round(ox)));
      agent.targetY = Math.max(0, Math.min(this.world.height - 1, Math.round(oy)));
      agent.state = 'working';
    }

    // Boost population in current area
    const idx = Math.round(agent.y) * this.world.width + Math.round(agent.x);
    if (idx >= 0 && idx < this.world.width * this.world.height) {
      if (this.world.faithOwner[idx] === agent.religionIndex) {
        const cap = TERRAIN_POP_CAP[this.world.tiles[idx]] || 0;
        if (this.world.population[idx] < cap) {
          this.world.population[idx] = Math.min(cap, this.world.population[idx] + 2);
        }
      }
    }
  }

  _updateWarrior(agent, tickCount) {
    // Warriors patrol borders and fight enemy agents
    if (agent.state === 'idle' || Math.random() < 0.1) {
      const borderTiles = this._findBorderTiles(agent.religionIndex, agent.x, agent.y, 15);
      if (borderTiles.length > 0) {
        const target = borderTiles[Math.floor(Math.random() * borderTiles.length)];
        agent.targetX = target.x;
        agent.targetY = target.y;
        agent.state = 'moving';
      }
    }

    // Fight nearby enemy agents
    for (const other of this.agents) {
      if (other.religionIndex === agent.religionIndex) continue;
      if (other.hp <= 0) continue;
      const dist = Math.abs(other.x - agent.x) + Math.abs(other.y - agent.y);
      if (dist < 2) {
        other.hp -= 10 + agent.level * 2;
        agent.cooldown = 3;
        if (other.hp <= 0) {
          agent.kills++;
          if (agent.kills % 3 === 0) agent.level++;
        }
        break;
      }
    }
  }

  _moveToTarget(agent) {
    const speed = AGENT_TYPES[agent.type]?.speed || 0.5;
    const dx = agent.targetX - agent.x;
    const dy = agent.targetY - agent.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < speed) {
      agent.x = agent.targetX;
      agent.y = agent.targetY;
      if (agent.state === 'moving') agent.state = 'idle';
    } else {
      agent.x += (dx / dist) * speed;
      agent.y += (dy / dist) * speed;
    }

    // Clamp
    agent.x = Math.max(0, Math.min(this.world.width - 1, agent.x));
    agent.y = Math.max(0, Math.min(this.world.height - 1, agent.y));
  }

  _findBorderTiles(religionIndex, cx, cy, radius) {
    const w = this.world;
    const results = [];
    const step = 2;
    for (let dy = -radius; dy <= radius; dy += step) {
      for (let dx = -radius; dx <= radius; dx += step) {
        const tx = Math.round(cx) + dx;
        const ty = Math.round(cy) + dy;
        if (tx < 0 || tx >= w.width || ty < 0 || ty >= w.height) continue;
        const idx = ty * w.width + tx;
        if (w.faithOwner[idx] !== religionIndex) continue;

        // Check if any neighbor is different
        for (const [ddx, ddy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const nx = tx + ddx, ny = ty + ddy;
          if (nx < 0 || nx >= w.width || ny < 0 || ny >= w.height) continue;
          if (w.faithOwner[ny * w.width + nx] !== religionIndex) {
            results.push({ x: tx, y: ty });
            break;
          }
        }
      }
    }
    return results;
  }

  _autoSpawn(tickCount, settlements) {
    if (tickCount % 20 !== 0) return;

    for (const rel of this.religions) {
      const relAgents = this.agents.filter(a => a.religionIndex === rel.index && a.hp > 0);
      const heroCount = relAgents.filter(a => a.type === 'hero').length;
      const merchantCount = relAgents.filter(a => a.type === 'merchant').length;
      const priestCount = relAgents.filter(a => a.type === 'priest').length;
      const builderCount = relAgents.filter(a => a.type === 'builder').length;
      const warriorCount = relAgents.filter(a => a.type === 'warrior').length;

      // Find a tile owned by this religion for spawning
      let spawnX = -1, spawnY = -1;
      for (let attempt = 0; attempt < 10; attempt++) {
        const rx = Math.floor(Math.random() * this.world.width);
        const ry = Math.floor(Math.random() * this.world.height);
        if (this.world.faithOwner[ry * this.world.width + rx] === rel.index) {
          spawnX = rx; spawnY = ry; break;
        }
      }
      if (spawnX < 0) continue;

      // Territory size determines agent caps
      const territory = (rel.territory_count || 0);
      const heroCap = Math.min(CONFIG.MAX_HEROES, Math.floor(territory / 200) + 1);
      const merchantCap = Math.min(CONFIG.MAX_MERCHANTS, Math.floor(territory / 100) + 1);
      const priestCap = Math.min(CONFIG.MAX_PRIESTS, Math.floor(territory / 150) + 1);
      const builderCap = Math.min(CONFIG.MAX_BUILDERS, Math.floor(territory / 80) + 1);
      const warriorCap = Math.min(CONFIG.MAX_WARRIORS, Math.floor(territory / 120) + 1);

      if (heroCount < heroCap && Math.random() < 0.1) {
        const h = this.spawn('hero', rel.index, spawnX, spawnY);
        if (h) h.born = tickCount;
      }
      if (merchantCount < merchantCap && Math.random() < 0.2) {
        this.spawn('merchant', rel.index, spawnX, spawnY);
      }
      if (priestCount < priestCap && Math.random() < 0.15) {
        this.spawn('priest', rel.index, spawnX, spawnY);
      }
      if (builderCount < builderCap && Math.random() < 0.2) {
        this.spawn('builder', rel.index, spawnX, spawnY);
      }
      if (warriorCount < warriorCap && Math.random() < 0.15) {
        this.spawn('warrior', rel.index, spawnX, spawnY);
      }
    }
  }

  _genName(type) {
    if (type === 'hero') {
      return HERO_FIRST[Math.floor(Math.random() * HERO_FIRST.length)] + ' ' +
             HERO_TITLE[Math.floor(Math.random() * HERO_TITLE.length)];
    }
    return AGENT_TYPES[type]?.name || 'Agent';
  }

  // Get agents visible in viewport
  getVisibleAgents(startX, startY, endX, endY) {
    return this.agents.filter(a =>
      a.hp > 0 && a.x >= startX - 1 && a.x <= endX + 1 && a.y >= startY - 1 && a.y <= endY + 1
    );
  }

  // Get all agents for a religion
  getAgentsForReligion(religionIndex) {
    return this.agents.filter(a => a.religionIndex === religionIndex && a.hp > 0);
  }
}
