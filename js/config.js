// ============================================
// THE HANDS OF THE DIVINE — Configuration
// ============================================
// Paste your Supabase project URL and anon key below.
// Find them at: Supabase Dashboard → Settings → API

const CONFIG = {
  SUPABASE_URL: 'https://imfcznasbmwkvivvximl.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltZmN6bmFzYm13a3ZpdnZ4aW1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5OTg4MjYsImV4cCI6MjA5MjU3NDgyNn0.fXal5sXXIG98bWE6fgWDto4s7YP9PZD8YMgAihvXCK8',

  WORLD_WIDTH: 300,
  WORLD_HEIGHT: 300,
  CHUNK_SIZE: 30,
  TILE_SIZE: 4,
  WORLD_SEED: 42,

  TICK_INTERVAL_MS: 3000,
  SYNC_INTERVAL_MS: 15000,
  MAX_CATCHUP_TICKS: 5000,

  MAX_TRAITS: 5,
  SYMBOL_SIZE: 16,
  STARTING_DIVINE_POWER: 100,

  // Resources per terrain (base yield per tick)
  RESOURCES: {
    wood:  { name: 'Wood',  icon: '🪵', color: '#8B6914' },
    stone: { name: 'Stone', icon: '🪨', color: '#888888' },
    iron:  { name: 'Iron',  icon: '⛏️', color: '#A0A0B0' },
    gold:  { name: 'Gold',  icon: '🪙', color: '#FFD700' },
    food:  { name: 'Food',  icon: '🌾', color: '#D4A853' },
    fish:  { name: 'Fish',  icon: '🐟', color: '#5BA4CF' },
  },

  // Max agents per religion
  MAX_HEROES: 5,
  MAX_MERCHANTS: 10,
  MAX_PRIESTS: 8,
  MAX_BUILDERS: 15,
  MAX_WARRIORS: 12,
  AGENT_SPEED: 0.5, // tiles per tick

  // Structure costs {resource: amount}
  STRUCTURES: {
    hut:        { name: 'Hut',        icon: '🛖', cost: { wood: 5 },               popCap: 4,  size: 1 },
    house:      { name: 'House',      icon: '🏠', cost: { wood: 10, stone: 5 },    popCap: 8,  size: 1 },
    farm:       { name: 'Farm',       icon: '🌾', cost: { wood: 8 },               popCap: 0,  size: 2, produces: 'food' },
    mine:       { name: 'Mine',       icon: '⛏️', cost: { wood: 15, stone: 10 },   popCap: 0,  size: 1, produces: 'iron' },
    lumberyard: { name: 'Lumberyard', icon: '🪓', cost: { stone: 5 },              popCap: 0,  size: 2, produces: 'wood' },
    dock:       { name: 'Dock',       icon: '⚓', cost: { wood: 20, iron: 5 },     popCap: 0,  size: 2, produces: 'fish' },
    wall:       { name: 'Wall',       icon: '🧱', cost: { stone: 15 },             popCap: 0,  size: 1, defense: 10 },
    watchtower: { name: 'Watchtower', icon: '🗼', cost: { stone: 20, iron: 5 },    popCap: 0,  size: 1, defense: 20, vision: 8 },
    market:     { name: 'Market',     icon: '🏪', cost: { wood: 15, stone: 10 },   popCap: 0,  size: 2, trade: true },
    barracks:   { name: 'Barracks',   icon: '⚔️', cost: { wood: 10, stone: 15, iron: 10 }, popCap: 0, size: 2, spawns: 'warrior' },
    road:       { name: 'Road',       icon: '🛤️', cost: { stone: 2 },              popCap: 0,  size: 1, speed: 2.0 },
  },

  MIRACLES: {
    bless:     { name: 'Bless',     icon: '✨', cost: 5,  radius: 4,  cooldownTicks: 20,  desc: 'Boost growth in a small area' },
    drought:   { name: 'Drought',   icon: '☀️', cost: 8,  radius: 5,  cooldownTicks: 40,  desc: 'Weaken a region with famine' },
    storm:     { name: 'Storm',     icon: '⛈️', cost: 10, radius: 3,  cooldownTicks: 50,  desc: 'Disrupt an area with chaos' },
    inspire:   { name: 'Inspire',   icon: '💫', cost: 6,  radius: 6,  cooldownTicks: 25,  desc: 'Boost conversion speed nearby' },
    pestilence:{ name: 'Pestilence',icon: '🦠', cost: 15, radius: 7,  cooldownTicks: 80,  desc: 'Plague weakens all faiths in area' },
    earthquake:{ name: 'Earthquake',icon: '🌋', cost: 20, radius: 4,  cooldownTicks: 100, desc: 'Devastate terrain and population' },
    fertility: { name: 'Fertility', icon: '🌿', cost: 4,  radius: 5,  cooldownTicks: 15,  desc: 'Population boom in an area' },
    vision:    { name: 'Vision',    icon: '👁️', cost: 3,  radius: 8,  cooldownTicks: 10,  desc: 'Reveal hidden world info' },
  },

  HOLY_SITE_COSTS: {
    shrine:    10,
    temple:    30,
    cathedral: 80,
  },
};
