// ============================================
// THE HANDS OF THE DIVINE — Traits System
// ============================================
// Each trait modifies simulation behavior.
// Players pick up to 5 traits when creating a religion.

const TRAIT_CATEGORIES = {
  SPREAD:   { name: 'Spread',   color: '#e63946', icon: '📡' },
  SOCIETY:  { name: 'Society',  color: '#457b9d', icon: '🏛️' },
  BELIEF:   { name: 'Belief',   color: '#f4a261', icon: '📿' },
  SURVIVAL: { name: 'Survival', color: '#2a9d8f', icon: '🛡️' },
  DARK:     { name: 'Dark',     color: '#9b5de5', icon: '💀' },
  DIVINE:   { name: 'Divine',   color: '#f0d060', icon: '⚡' },
};

const TRAITS = [
  // ─── SPREAD (how your faith moves) ──────────────────────────
  { id: 'missionary',     cat: 'SPREAD',   name: 'Missionary',      icon: '🙏', desc: 'Followers actively convert neighbors. +40% spread speed.',
    fx: { spreadMult: 1.4 } },
  { id: 'warlike',        cat: 'SPREAD',   name: 'Warlike',         icon: '⚔️', desc: 'Conquer territory by force. Can take populated enemy tiles.',
    fx: { forcedConversion: true, spreadMult: 1.1 } },
  { id: 'traders',        cat: 'SPREAD',   name: 'Traders',         icon: '🪙', desc: 'Spread along coast and river tiles at double speed.',
    fx: { coastSpread: 2.0, riverSpread: 2.0 } },
  { id: 'nomadic',        cat: 'SPREAD',   name: 'Nomadic',         icon: '🐪', desc: 'Can spread across desert and tundra easily.',
    fx: { desertSpread: 2.0, tundraSpread: 2.0 } },
  { id: 'seafaring',      cat: 'SPREAD',   name: 'Seafaring',       icon: '⛵', desc: 'Can spread across water tiles. Coastal bonus.',
    fx: { waterSpread: true, coastSpread: 1.5 } },
  { id: 'underground',    cat: 'SPREAD',   name: 'Underground',     icon: '🕳️', desc: 'Slow but can pop up in random distant tiles.',
    fx: { randomSpread: true, spreadMult: 0.8 } },
  { id: 'viral',          cat: 'SPREAD',   name: 'Viral',           icon: '🔥', desc: 'Explosive early spread, weakens over time.',
    fx: { spreadMult: 2.0, faithDecay: 1.3 } },
  { id: 'persistent',     cat: 'SPREAD',   name: 'Persistent',      icon: '🪨', desc: 'Very slow spread, but nearly impossible to lose tiles.',
    fx: { spreadMult: 0.5, defenseMult: 3.0 } },
  { id: 'diplomatic',     cat: 'SPREAD',   name: 'Diplomatic',      icon: '🤝', desc: 'Easier to convert tiles with existing population.',
    fx: { popConversionBonus: 1.5 } },
  { id: 'pilgrimage',     cat: 'SPREAD',   name: 'Pilgrimage',      icon: '🚶', desc: 'Holy sites boost spread radius significantly.',
    fx: { holySiteRadiusMult: 2.0 } },

  // ─── SOCIETY (how your people behave) ──────────────────────
  { id: 'fertile',        cat: 'SOCIETY',  name: 'Fertile',         icon: '👶', desc: 'Population grows 50% faster.',
    fx: { popGrowthMult: 1.5 } },
  { id: 'scholarly',      cat: 'SOCIETY',  name: 'Scholarly',       icon: '📚', desc: 'Slower growth but stronger faith. Harder to convert away.',
    fx: { popGrowthMult: 0.8, faithGrowthMult: 1.5, defenseMult: 1.3 } },
  { id: 'industrious',    cat: 'SOCIETY',  name: 'Industrious',     icon: '⚒️', desc: 'Holy sites are cheaper and more effective.',
    fx: { holySiteCostMult: 0.5, holySitePowerMult: 1.5 } },
  { id: 'ascetic',        cat: 'SOCIETY',  name: 'Ascetic',         icon: '🧘', desc: 'Thrive in harsh terrain. Mountain and desert bonus.',
    fx: { harshTerrainBonus: 2.0 } },
  { id: 'hedonistic',     cat: 'SOCIETY',  name: 'Hedonistic',      icon: '🍷', desc: 'Massive growth in good terrain, terrible in bad.',
    fx: { goodTerrainMult: 2.0, harshTerrainMult: 0.3 } },
  { id: 'communal',       cat: 'SOCIETY',  name: 'Communal',        icon: '🏘️', desc: 'Adjacent friendly tiles boost each other.',
    fx: { adjacencyBonus: true } },
  { id: 'hierarchical',   cat: 'SOCIETY',  name: 'Hierarchical',    icon: '👑', desc: 'Stronger near holy sites, weaker far away.',
    fx: { holySiteStrength: true, distanceWeakness: true } },
  { id: 'egalitarian',    cat: 'SOCIETY',  name: 'Egalitarian',     icon: '⚖️', desc: 'Uniform faith strength everywhere. No hot/cold spots.',
    fx: { faithEqualization: true } },
  { id: 'builders',       cat: 'SOCIETY',  name: 'Builders',        icon: '🏗️', desc: 'Can build 2x as many holy sites.',
    fx: { maxHolySitesMult: 2.0 } },
  { id: 'storytellers',   cat: 'SOCIETY',  name: 'Storytellers',    icon: '📖', desc: 'Faith spreads further but weaker at the edges.',
    fx: { spreadRange: 2.0, edgeFaithMult: 0.5 } },

  // ─── BELIEF (spiritual character) ──────────────────────────
  { id: 'fanatical',      cat: 'BELIEF',   name: 'Fanatical',       icon: '🔥', desc: 'Very high faith strength. Resist conversion fiercely.',
    fx: { faithGrowthMult: 1.8, defenseMult: 2.0, popGrowthMult: 0.7 } },
  { id: 'tolerant',       cat: 'BELIEF',   name: 'Tolerant',        icon: '☮️', desc: 'Can coexist in tiles with other faiths. Slow takeover.',
    fx: { coexistence: true, spreadMult: 0.7 } },
  { id: 'secretive',      cat: 'BELIEF',   name: 'Secretive',       icon: '🎭', desc: 'Other players can\'t see your territory easily.',
    fx: { hidden: true, spreadMult: 0.9 } },
  { id: 'prophetic',      cat: 'BELIEF',   name: 'Prophetic',       icon: '🔮', desc: 'Periodically spawns prophets that boost local faith.',
    fx: { prophetSpawn: true } },
  { id: 'ritualistic',    cat: 'BELIEF',   name: 'Ritualistic',     icon: '🕯️', desc: 'Holy sites have double the effect radius.',
    fx: { holySiteRadiusMult: 2.0 } },
  { id: 'nature_worship',  cat: 'BELIEF',   name: 'Nature Worship',  icon: '🌳', desc: 'Massive bonus in forests and swamps.',
    fx: { forestBonus: 2.5, swampBonus: 2.0 } },
  { id: 'sun_worship',    cat: 'BELIEF',   name: 'Sun Worship',     icon: '☀️', desc: 'Bonus in open terrain (plains, grassland, desert).',
    fx: { openTerrainBonus: 1.8 } },
  { id: 'ancestor_worship',cat: 'BELIEF',  name: 'Ancestor Worship',icon: '💀', desc: 'Old territories get stronger over time.',
    fx: { faithAgingBonus: true } },
  { id: 'iconoclast',     cat: 'BELIEF',   name: 'Iconoclast',      icon: '🔨', desc: 'Destroy enemy holy sites on conquest.',
    fx: { destroyHolySites: true } },
  { id: 'syncretic',      cat: 'BELIEF',   name: 'Syncretic',       icon: '🔀', desc: 'Absorb traits of conquered faiths temporarily.',
    fx: { absorbTraits: true } },

  // ─── SURVIVAL (how your people endure) ─────────────────────
  { id: 'hardy',          cat: 'SURVIVAL', name: 'Hardy',           icon: '💪', desc: 'Population survives disasters better.',
    fx: { disasterResist: 2.0 } },
  { id: 'adaptive',       cat: 'SURVIVAL', name: 'Adaptive',        icon: '🦎', desc: 'No terrain penalties. Equal everywhere.',
    fx: { noTerrainPenalty: true } },
  { id: 'mountain_born',  cat: 'SURVIVAL', name: 'Mountain-Born',   icon: '🏔️', desc: 'Thrive in mountains and hills. Defensive bonus.',
    fx: { mountainBonus: 2.5, hillsBonus: 2.0, defenseMult: 1.3 } },
  { id: 'desert_born',    cat: 'SURVIVAL', name: 'Desert-Born',     icon: '🏜️', desc: 'Thrive in deserts and sand. Heat resistance.',
    fx: { desertBonus: 2.5, sandBonus: 2.0 } },
  { id: 'coastal',        cat: 'SURVIVAL', name: 'Coastal',         icon: '🏖️', desc: 'Thrive along coasts. Fishing bonus.',
    fx: { coastBonus: 2.5, popGrowthCoast: 1.5 } },
  { id: 'frost_born',     cat: 'SURVIVAL', name: 'Frost-Born',      icon: '❄️', desc: 'Thrive in snow and tundra.',
    fx: { snowBonus: 2.5, tundraBonus: 2.0 } },
  { id: 'resilient',      cat: 'SURVIVAL', name: 'Resilient',       icon: '🛡️', desc: 'Recover from losses quickly.',
    fx: { recoverySpeed: 2.0 } },
  { id: 'migratory',      cat: 'SURVIVAL', name: 'Migratory',       icon: '🦅', desc: 'Can abandon poor tiles to strengthen good ones.',
    fx: { canAbandon: true, concentrateFaith: true } },
  { id: 'fortified',      cat: 'SURVIVAL', name: 'Fortified',       icon: '🏰', desc: 'Tiles near holy sites are very hard to take.',
    fx: { holySiteDefense: 3.0 } },
  { id: 'scavengers',     cat: 'SURVIVAL', name: 'Scavengers',      icon: '🐀', desc: 'Take over abandoned and weakened tiles faster.',
    fx: { weakTileBonus: 2.0 } },

  // ─── DARK (risky, powerful) ────────────────────────────────
  { id: 'blood_sacrifice', cat: 'DARK',    name: 'Blood Sacrifice',  icon: '🩸', desc: 'Lose population to gain massive divine power.',
    fx: { sacrificeForPower: true } },
  { id: 'plague_bearers',  cat: 'DARK',    name: 'Plague Bearers',   icon: '☠️', desc: 'Neighboring enemy tiles lose population over time.',
    fx: { plagueAura: true } },
  { id: 'raiders',         cat: 'DARK',    name: 'Raiders',          icon: '🏴', desc: 'Can raid distant tiles. Steal population.',
    fx: { raidAbility: true } },
  { id: 'cannibalistic',   cat: 'DARK',    name: 'Cannibalistic',    icon: '🦴', desc: 'Absorb population from conquered tiles.',
    fx: { absorbPop: true } },
  { id: 'heretical',       cat: 'DARK',    name: 'Heretical',        icon: '⛧', desc: 'Cause schisms in neighboring faiths.',
    fx: { causeSchism: true } },
  { id: 'doomsday',        cat: 'DARK',    name: 'Doomsday Cult',    icon: '🌑', desc: 'Stronger when losing. Weaker when winning.',
    fx: { desperationPower: true } },
  { id: 'parasitic',       cat: 'DARK',    name: 'Parasitic',        icon: '🕷️', desc: 'Grow faster in enemy territory than unclaimed.',
    fx: { enemyTerritoryBonus: 2.0 } },
  { id: 'corruption',      cat: 'DARK',    name: 'Corruption',       icon: '🫧', desc: 'Slowly weaken faith of ALL neighbors, including allies.',
    fx: { faithDrain: true } },
  { id: 'apocalyptic',     cat: 'DARK',    name: 'Apocalyptic',      icon: '💥', desc: 'Miracles cost less but are more destructive.',
    fx: { miracleCostMult: 0.5, miraclePowerMult: 2.0 } },
  { id: 'void_touched',    cat: 'DARK',    name: 'Void-Touched',     icon: '🌀', desc: 'Tiles you abandon become cursed wasteland.',
    fx: { cursedAbandonment: true } },

  // ─── DIVINE (god-power focused) ────────────────────────────
  { id: 'chosen_people',   cat: 'DIVINE',  name: 'Chosen People',    icon: '✡️', desc: 'Start with double divine power.',
    fx: { startingPowerMult: 2.0 } },
  { id: 'miracle_worker',  cat: 'DIVINE',  name: 'Miracle Worker',   icon: '⚡', desc: 'Miracles recharge 50% faster.',
    fx: { miracleCooldownMult: 0.5 } },
  { id: 'omnipresent',     cat: 'DIVINE',  name: 'Omnipresent',      icon: '👁️', desc: 'Can see the entire map. No fog of war.',
    fx: { fullVision: true } },
  { id: 'wrathful',        cat: 'DIVINE',  name: 'Wrathful God',     icon: '⛈️', desc: 'Destructive miracles are 2x stronger.',
    fx: { destructiveMiracleMult: 2.0 } },
  { id: 'benevolent',      cat: 'DIVINE',  name: 'Benevolent God',   icon: '🌈', desc: 'Healing/growth miracles are 2x stronger.',
    fx: { healingMiracleMult: 2.0 } },
];

// Helper to get trait by id
function getTrait(id) {
  return TRAITS.find(t => t.id === id);
}

// Get combined effects of a set of traits
function getCombinedEffects(traitIds) {
  const effects = {};
  for (const id of traitIds) {
    const trait = getTrait(id);
    if (!trait) continue;
    for (const [key, value] of Object.entries(trait.fx)) {
      if (typeof value === 'number') {
        effects[key] = (effects[key] || 1) * value;
      } else {
        effects[key] = value;
      }
    }
  }
  return effects;
}
