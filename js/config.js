// ============================================
// THE HANDS OF THE DIVINE — Configuration
// ============================================
// Paste your Supabase project URL and anon key below.
// Find them at: Supabase Dashboard → Settings → API

const CONFIG = {
  SUPABASE_URL: 'https://imfcznasbmwkvivvximl.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltZmN6bmFzYm13a3ZpdnZ4aW1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5OTg4MjYsImV4cCI6MjA5MjU3NDgyNn0.fXal5sXXIG98bWE6fgWDto4s7YP9PZD8YMgAihvXCK8',

  // World settings
  WORLD_WIDTH: 300,
  WORLD_HEIGHT: 300,
  CHUNK_SIZE: 30,        // 30x30 tiles per chunk = 100 chunks
  TILE_SIZE: 4,          // pixels per tile at 1x zoom
  WORLD_SEED: 42,

  // Simulation
  TICK_INTERVAL_MS: 3000,     // 3 seconds per tick while tab open
  SYNC_INTERVAL_MS: 15000,    // sync to Supabase every 15 seconds
  MAX_CATCHUP_TICKS: 5000,    // cap fast-forward to prevent freeze

  // Religion
  MAX_TRAITS: 5,
  SYMBOL_SIZE: 16,       // 16x16 pixel symbol canvas
  STARTING_DIVINE_POWER: 100,

  // Miracles
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

  // Holy site costs
  HOLY_SITE_COSTS: {
    shrine:    10,
    temple:    30,
    cathedral: 80,
  },
};
