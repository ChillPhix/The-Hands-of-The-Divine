// ============================================
// THE HANDS OF THE DIVINE — Settlements & Kingdoms
// ============================================
// Settlements are derived from population density.
// They are NOT stored in chunks — they're regenerated each session
// from the existing population data. This keeps chunk format stable.

const SETTLEMENT_TYPES = {
  VILLAGE:  { name: 'Village',  minPop: 25, icon: '🏘️', size: 1, color: '#c8b87a' },
  TOWN:    { name: 'Town',     minPop: 50, icon: '🏠', size: 2, color: '#d4a853' },
  CITY:    { name: 'City',     minPop: 75, icon: '🏙️', size: 3, color: '#e8c84a' },
  CAPITAL: { name: 'Capital',  minPop: 90, icon: '👑', size: 4, color: '#f0d060' },
};

const KINGDOM_NAMES_PREFIX = [
  'Grand','Holy','Free','United','Northern','Southern','Eastern','Western',
  'Ancient','Sacred','Blessed','Iron','Golden','Silver','Dark','Crimson',
  'Azure','Emerald','Obsidian','Ivory','Storm','Frost','Sun','Moon','Star',
];
const KINGDOM_NAMES_SUFFIX = [
  'Kingdom','Realm','Dominion','Empire','Republic','Theocracy','Federation',
  'Confederation','Sovereignty','Protectorate','Principality','Duchy',
  'Commonwealth','Caliphate','Shogunate','Khanate',
];

class SettlementManager {
  constructor(world, religions) {
    this.world = world;
    this.religions = religions;
    this.settlements = []; // [{x, y, type, name, owner, pop, isCapital}]
    this.kingdoms = [];    // [{id, name, religion, settlements:[], territory, relations:{}}]
    this.wars = [];        // [{attacker, defender, startTick, frontline:[]}]
    this.peaceDeals = [];  // [{kingdom1, kingdom2, tick}]
    this.lastUpdate = 0;
  }

  // Call every N ticks to recalculate settlements from world data
  update(tickCount) {
    // Only recalculate every 10 ticks (performance)
    if (tickCount - this.lastUpdate < 10) return;
    this.lastUpdate = tickCount;

    this._findSettlements();
    this._buildKingdoms(tickCount);
    this._processRelations(tickCount);
  }

  _findSettlements() {
    const w = this.world;
    const width = w.width;
    const height = w.height;
    this.settlements = [];

    // Scan for population clusters
    const checked = new Uint8Array(width * height);

    for (let y = 2; y < height - 2; y += 3) {
      for (let x = 2; x < width - 2; x += 3) {
        const idx = y * width + x;
        if (checked[idx]) continue;
        if (w.tiles[idx] <= TERRAIN.WATER) continue;
        if (w.population[idx] < SETTLEMENT_TYPES.VILLAGE.minPop) continue;

        const pop = w.population[idx];
        const owner = w.faithOwner[idx];

        // Determine settlement type based on local population density
        let totalPop = pop;
        let count = 1;
        const neighbors = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,1],[-1,1],[1,-1]];
        for (const [dx, dy] of neighbors) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const nIdx = ny * width + nx;
          totalPop += w.population[nIdx];
          count++;
          checked[nIdx] = 1;
        }
        checked[idx] = 1;

        const avgPop = totalPop / count;
        let type;
        if (avgPop >= SETTLEMENT_TYPES.CAPITAL.minPop) type = 'CAPITAL';
        else if (avgPop >= SETTLEMENT_TYPES.CITY.minPop) type = 'CITY';
        else if (avgPop >= SETTLEMENT_TYPES.TOWN.minPop) type = 'TOWN';
        else type = 'VILLAGE';

        // Generate a name using deterministic seed from position
        const nameSeed = (x * 7919 + y * 6271) & 0xFFFF;
        const name = this._genSettlementName(nameSeed);

        this.settlements.push({
          x, y, type, name, owner, pop,
          avgPop: Math.round(avgPop),
          isCapital: false,
        });
      }
    }
  }

  _buildKingdoms(tickCount) {
    // Group settlements by religion owner into kingdoms
    const relSettlements = {};
    for (const s of this.settlements) {
      if (s.owner < 0) continue;
      if (!relSettlements[s.owner]) relSettlements[s.owner] = [];
      relSettlements[s.owner].push(s);
    }

    const prevKingdoms = {};
    for (const k of this.kingdoms) prevKingdoms[k.religionIndex] = k;

    this.kingdoms = [];

    for (const [ownerIdx, settlements] of Object.entries(relSettlements)) {
      const idx = parseInt(ownerIdx);
      const rel = this.religions[idx];
      if (!rel) continue;

      // Find largest settlement — it's the capital
      settlements.sort((a, b) => b.avgPop - a.avgPop);
      if (settlements.length > 0) settlements[0].isCapital = true;

      // Count total territory for this religion
      let territory = 0;
      for (let i = 0; i < this.world.width * this.world.height; i++) {
        if (this.world.faithOwner[i] === idx) territory++;
      }

      // Re-use existing kingdom or create new one
      const prev = prevKingdoms[idx];
      const kingdomName = prev?.name || this._genKingdomName(rel, (idx * 31337) & 0xFFFF);

      this.kingdoms.push({
        id: `kingdom_${idx}`,
        name: kingdomName,
        religionIndex: idx,
        religion: rel,
        settlements,
        territory,
        capitalName: settlements[0]?.name || 'Unknown',
        relations: prev?.relations || {},
      });
    }
  }

  _processRelations(tickCount) {
    // Every 50 ticks, kingdoms at borders may declare war or peace
    if (tickCount % 50 !== 0) return;
    if (this.kingdoms.length < 2) return;

    const w = this.world;
    const width = w.width;

    // Find border conflicts — which religions share borders?
    const borderPairs = new Set();
    for (let y = 1; y < w.height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const owner = w.faithOwner[idx];
        if (owner < 0) continue;

        // Check right and down neighbors only (avoid double counting)
        for (const [dx, dy] of [[1,0],[0,1]]) {
          const nIdx = (y + dy) * width + (x + dx);
          const nOwner = w.faithOwner[nIdx];
          if (nOwner >= 0 && nOwner !== owner) {
            const pair = owner < nOwner ? `${owner}_${nOwner}` : `${nOwner}_${owner}`;
            borderPairs.add(pair);
          }
        }
      }
    }

    // Process each border pair
    for (const pair of borderPairs) {
      const [a, b] = pair.split('_').map(Number);
      const kA = this.kingdoms.find(k => k.religionIndex === a);
      const kB = this.kingdoms.find(k => k.religionIndex === b);
      if (!kA || !kB) continue;

      const relA = this.religions[a];
      const relB = this.religions[b];
      const fxA = getCombinedEffects(relA?.traits || []);
      const fxB = getCombinedEffects(relB?.traits || []);

      // Check existing relation
      const relation = kA.relations[b] || 'neutral';

      if (relation === 'neutral') {
        // Chance of war based on traits
        let warChance = 0.1;
        if (fxA.forcedConversion) warChance += 0.2;
        if (fxB.forcedConversion) warChance += 0.2;
        if (fxA.coexistence) warChance -= 0.15;
        if (fxB.coexistence) warChance -= 0.15;

        if (Math.random() < warChance) {
          kA.relations[b] = 'war';
          kB.relations[a] = 'war';
          this.wars.push({ attacker: a, defender: b, startTick: tickCount });
          return { type: 'war_declared', kingdoms: [kA, kB], tick: tickCount,
            desc: `⚔️ ${kA.name} declared war on ${kB.name}!` };
        }
      } else if (relation === 'war') {
        // Chance of peace
        let peaceChance = 0.05;
        if (fxA.coexistence || fxB.coexistence) peaceChance += 0.15;

        // Longer wars more likely to end
        const war = this.wars.find(w => 
          (w.attacker === a && w.defender === b) || (w.attacker === b && w.defender === a));
        if (war && tickCount - war.startTick > 100) peaceChance += 0.1;

        if (Math.random() < peaceChance) {
          kA.relations[b] = 'peace';
          kB.relations[a] = 'peace';
          this.wars = this.wars.filter(w => 
            !((w.attacker === a && w.defender === b) || (w.attacker === b && w.defender === a)));
          this.peaceDeals.push({ kingdom1: a, kingdom2: b, tick: tickCount });
          return { type: 'peace_made', kingdoms: [kA, kB], tick: tickCount,
            desc: `☮️ ${kA.name} and ${kB.name} made peace!` };
        }
      } else if (relation === 'peace') {
        // Peace degrades to neutral over time
        const deal = this.peaceDeals.find(p =>
          (p.kingdom1 === a && p.kingdom2 === b) || (p.kingdom1 === b && p.kingdom2 === a));
        if (deal && tickCount - deal.tick > 200) {
          kA.relations[b] = 'neutral';
          kB.relations[a] = 'neutral';
        }
      }
    }
    return null;
  }

  _genSettlementName(seed) {
    const prefixes = ['Al','Ash','Bal','Cor','Del','Eld','Fen','Gor','Har','Ith',
      'Kel','Lor','Mar','Nor','Orn','Pel','Rav','Sol','Tor','Uth','Val','Wyn','Xar','Zul',
      'Brin','Drak','Fael','Grim','Kael','Myr','Shal','Thal','Vorn','Azar','Dun','Kal',
      'San','Tel','Ur','Nov','Amon','Tar','Rok','Mir','Aer','Bel','Cra','Dol','Era'];
    const suffixes = ['heim','ford','wick','ton','burg','vale','keep','hold','rest','fell',
      'moor','gate','haven','watch','reach','march','brook','stone','wood','ridge','shire',
      'dale','field','port','crest','peak','run','cross','well','bridge','hall','mount',
      'isle','hollow','thorn','wind','fire','dawn','dusk','light','shadow','river','lake'];

    const pi = seed % prefixes.length;
    const si = (seed * 7 + 13) % suffixes.length;
    return prefixes[pi] + suffixes[si];
  }

  _genKingdomName(religion, seed) {
    const pi = seed % KINGDOM_NAMES_PREFIX.length;
    const si = (seed * 3 + 7) % KINGDOM_NAMES_SUFFIX.length;
    return `${KINGDOM_NAMES_PREFIX[pi]} ${KINGDOM_NAMES_SUFFIX[si]} of ${religion.name}`;
  }

  // Get settlements visible in a viewport range
  getVisibleSettlements(startX, startY, endX, endY) {
    return this.settlements.filter(s =>
      s.x >= startX && s.x <= endX && s.y >= startY && s.y <= endY
    );
  }
}
