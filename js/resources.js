// ============================================
// THE HANDS OF THE DIVINE — Resources
// ============================================
// Resources are generated from terrain at world gen.
// Each tile can have resource deposits. Religions accumulate
// resources from tiles they control.

// What each terrain produces
const TERRAIN_RESOURCES = {
  [TERRAIN.PLAINS]:      { food: 3 },
  [TERRAIN.GRASSLAND]:   { food: 2, wood: 1 },
  [TERRAIN.FOREST]:      { wood: 4, food: 1 },
  [TERRAIN.DENSE_FOREST]:{ wood: 6 },
  [TERRAIN.HILLS]:       { stone: 3, iron: 1 },
  [TERRAIN.MOUNTAIN]:    { stone: 5, iron: 3, gold: 0.5 },
  [TERRAIN.COAST]:       { fish: 3, food: 1 },
  [TERRAIN.SAND]:        { stone: 1 },
  [TERRAIN.DESERT]:      { stone: 2, gold: 1 },
  [TERRAIN.SWAMP]:       { food: 1, wood: 2 },
  [TERRAIN.TUNDRA]:      { stone: 1, iron: 1 },
  [TERRAIN.SNOW]:        { stone: 1 },
};

// Rare resource deposits (placed during world gen)
const RARE_DEPOSITS = {
  gold_vein:   { resource: 'gold', amount: 5, rarity: 0.005, terrain: [TERRAIN.MOUNTAIN, TERRAIN.HILLS, TERRAIN.DESERT] },
  iron_deposit:{ resource: 'iron', amount: 4, rarity: 0.02,  terrain: [TERRAIN.MOUNTAIN, TERRAIN.HILLS] },
  marble:      { resource: 'stone', amount: 6, rarity: 0.01, terrain: [TERRAIN.MOUNTAIN, TERRAIN.HILLS] },
  fertile_soil:{ resource: 'food', amount: 5, rarity: 0.03,  terrain: [TERRAIN.PLAINS, TERRAIN.GRASSLAND] },
  ancient_wood:{ resource: 'wood', amount: 5, rarity: 0.02,  terrain: [TERRAIN.FOREST, TERRAIN.DENSE_FOREST] },
};

class ResourceManager {
  constructor(world) {
    this.world = world;
    // Per-religion stockpiles: { religionIndex: { wood: N, stone: N, ... } }
    this.stockpiles = {};
    // Rare deposit locations (sparse map)
    this.deposits = {}; // { "x_y": { type, resource, amount } }
  }

  // Generate rare deposits based on world seed
  generateDeposits(seed) {
    const rng = this._seededRng(seed + 5000);
    const w = this.world;
    for (let y = 0; y < w.height; y++) {
      for (let x = 0; x < w.width; x++) {
        const terrain = w.tiles[y * w.width + x];
        for (const [name, dep] of Object.entries(RARE_DEPOSITS)) {
          if (!dep.terrain.includes(terrain)) continue;
          if (rng() < dep.rarity) {
            this.deposits[`${x}_${y}`] = { type: name, resource: dep.resource, amount: dep.amount };
          }
        }
      }
    }
  }

  // Initialize stockpile for a religion
  initStockpile(religionIndex) {
    if (!this.stockpiles[religionIndex]) {
      this.stockpiles[religionIndex] = { wood: 20, stone: 10, iron: 0, gold: 0, food: 30, fish: 0 };
    }
  }

  // Gather resources from all owned tiles (called each tick)
  gatherTick(religions) {
    const w = this.world;
    const width = w.width;

    // Reset per-tick income
    const income = {};
    for (const rel of religions) {
      if (!this.stockpiles[rel.index]) this.initStockpile(rel.index);
      income[rel.index] = { wood: 0, stone: 0, iron: 0, gold: 0, food: 0, fish: 0 };
    }

    // Scan tiles (sample every 3rd tile for performance)
    for (let y = 0; y < w.height; y += 2) {
      for (let x = 0; x < w.width; x += 2) {
        const idx = y * width + x;
        const owner = w.faithOwner[idx];
        if (owner < 0 || !income[owner]) continue;

        const terrain = w.tiles[idx];
        const baseRes = TERRAIN_RESOURCES[terrain];
        if (baseRes) {
          for (const [res, amt] of Object.entries(baseRes)) {
            income[owner][res] += amt * 0.01; // scaled down since we tick often
          }
        }

        // Check rare deposits
        const dep = this.deposits[`${x}_${y}`];
        if (dep) {
          income[owner][dep.resource] += dep.amount * 0.02;
        }
      }
    }

    // Apply income to stockpiles (cap at 9999)
    for (const [relIdx, inc] of Object.entries(income)) {
      const s = this.stockpiles[relIdx];
      if (!s) continue;
      for (const [res, amt] of Object.entries(inc)) {
        s[res] = Math.min(9999, (s[res] || 0) + amt);
      }
    }
  }

  // Check if religion can afford a cost
  canAfford(religionIndex, cost) {
    const s = this.stockpiles[religionIndex];
    if (!s) return false;
    for (const [res, amt] of Object.entries(cost)) {
      if ((s[res] || 0) < amt) return false;
    }
    return true;
  }

  // Spend resources
  spend(religionIndex, cost) {
    const s = this.stockpiles[religionIndex];
    if (!s) return false;
    for (const [res, amt] of Object.entries(cost)) {
      s[res] = (s[res] || 0) - amt;
    }
    return true;
  }

  getStockpile(religionIndex) {
    return this.stockpiles[religionIndex] || { wood: 0, stone: 0, iron: 0, gold: 0, food: 0, fish: 0 };
  }

  _seededRng(seed) {
    let s = seed;
    return () => { s = (s * 16807 + 11) % 2147483647; return (s - 1) / 2147483646; };
  }
}
