// ============================================
// THE HANDS OF THE DIVINE — World Generation
// ============================================

const TERRAIN = {
  DEEP_WATER:  0,
  WATER:       1,
  COAST:       2,
  SAND:        3,
  PLAINS:      4,
  GRASSLAND:   5,
  FOREST:      6,
  DENSE_FOREST:7,
  HILLS:       8,
  MOUNTAIN:    9,
  SNOW:        10,
  SWAMP:       11,
  DESERT:      12,
  TUNDRA:      13,
};

const TERRAIN_NAMES = {
  [TERRAIN.DEEP_WATER]:  'Deep Ocean',
  [TERRAIN.WATER]:       'Ocean',
  [TERRAIN.COAST]:       'Coast',
  [TERRAIN.SAND]:        'Beach',
  [TERRAIN.PLAINS]:      'Plains',
  [TERRAIN.GRASSLAND]:   'Grassland',
  [TERRAIN.FOREST]:      'Forest',
  [TERRAIN.DENSE_FOREST]:'Dense Forest',
  [TERRAIN.HILLS]:       'Hills',
  [TERRAIN.MOUNTAIN]:    'Mountain',
  [TERRAIN.SNOW]:        'Snow Peak',
  [TERRAIN.SWAMP]:       'Swamp',
  [TERRAIN.DESERT]:      'Desert',
  [TERRAIN.TUNDRA]:      'Tundra',
};

// Pixel colors for each terrain (retro palette)
const TERRAIN_COLORS = {
  [TERRAIN.DEEP_WATER]:  '#1a1a4e',
  [TERRAIN.WATER]:       '#2a4494',
  [TERRAIN.COAST]:       '#4a88c7',
  [TERRAIN.SAND]:        '#d4c876',
  [TERRAIN.PLAINS]:      '#7db855',
  [TERRAIN.GRASSLAND]:   '#5a9e3e',
  [TERRAIN.FOREST]:      '#3a7a2a',
  [TERRAIN.DENSE_FOREST]:'#2a5a1e',
  [TERRAIN.HILLS]:       '#8a8a6a',
  [TERRAIN.MOUNTAIN]:    '#6e6e6e',
  [TERRAIN.SNOW]:        '#e8e8f0',
  [TERRAIN.SWAMP]:       '#4a6a3a',
  [TERRAIN.DESERT]:      '#d4a83a',
  [TERRAIN.TUNDRA]:      '#a8b8b8',
};

// Population capacity per terrain
const TERRAIN_POP_CAP = {
  [TERRAIN.DEEP_WATER]:  0,
  [TERRAIN.WATER]:       0,
  [TERRAIN.COAST]:       40,
  [TERRAIN.SAND]:        20,
  [TERRAIN.PLAINS]:      100,
  [TERRAIN.GRASSLAND]:   80,
  [TERRAIN.FOREST]:      60,
  [TERRAIN.DENSE_FOREST]:30,
  [TERRAIN.HILLS]:       50,
  [TERRAIN.MOUNTAIN]:    10,
  [TERRAIN.SNOW]:        5,
  [TERRAIN.SWAMP]:       25,
  [TERRAIN.DESERT]:      15,
  [TERRAIN.TUNDRA]:      20,
};

// Spread difficulty (higher = harder to convert)
const TERRAIN_SPREAD_DIFFICULTY = {
  [TERRAIN.DEEP_WATER]:  999,
  [TERRAIN.WATER]:       999,
  [TERRAIN.COAST]:       1.5,
  [TERRAIN.SAND]:        1.0,
  [TERRAIN.PLAINS]:      0.6,
  [TERRAIN.GRASSLAND]:   0.7,
  [TERRAIN.FOREST]:      1.2,
  [TERRAIN.DENSE_FOREST]:2.0,
  [TERRAIN.HILLS]:       1.4,
  [TERRAIN.MOUNTAIN]:    3.0,
  [TERRAIN.SNOW]:        2.5,
  [TERRAIN.SWAMP]:       1.8,
  [TERRAIN.DESERT]:      2.0,
  [TERRAIN.TUNDRA]:      1.6,
};

// ─── Simple hash-based noise (no dependencies) ─────────────────────────────
class SeededNoise {
  constructor(seed) {
    this.seed = seed;
    this.perm = new Uint8Array(512);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    // Fisher-Yates shuffle with seed
    let s = seed;
    for (let i = 255; i > 0; i--) {
      s = (s * 16807 + 11) % 2147483647;
      const j = s % (i + 1);
      [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  // Simple 2D value noise with interpolation
  noise2D(x, y) {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);

    const aa = this.perm[this.perm[xi] + yi];
    const ab = this.perm[this.perm[xi] + yi + 1];
    const ba = this.perm[this.perm[xi + 1] + yi];
    const bb = this.perm[this.perm[xi + 1] + yi + 1];

    const x1 = aa / 255 * (1 - u) + ba / 255 * u;
    const x2 = ab / 255 * (1 - u) + bb / 255 * u;

    return x1 * (1 - v) + x2 * v;
  }

  // Fractal Brownian Motion for more natural terrain
  fbm(x, y, octaves = 6, lacunarity = 2.0, gain = 0.5) {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      value += amplitude * this.noise2D(x * frequency, y * frequency);
      maxValue += amplitude;
      amplitude *= gain;
      frequency *= lacunarity;
    }

    return value / maxValue;
  }
}

// ─── World Generator ────────────────────────────────────────────────────────
function generateWorld(width, height, seed) {
  const noise = new SeededNoise(seed);
  const moistureNoise = new SeededNoise(seed + 1000);
  const tempNoise = new SeededNoise(seed + 2000);
  const continentNoise = new SeededNoise(seed + 3000);

  const tiles = new Uint8Array(width * height);       // terrain type
  const population = new Uint16Array(width * height);  // population
  const faithOwner = new Int16Array(width * height);   // religion index (-1 = none)
  const faithStrength = new Uint8Array(width * height); // 0-255

  faithOwner.fill(-1);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;

      const nx = x / width;
      const ny = y / height;

      // Multiple continent shapes — no single-island falloff
      // Use large-scale noise to create continental shelves
      const continentVal = continentNoise.fbm(x * 0.004, y * 0.004, 3);
      // Slight edge falloff so borders are ocean (but much gentler)
      const edgeDist = Math.min(nx, ny, 1 - nx, 1 - ny);
      const edgeFalloff = Math.min(1, edgeDist * 8); // only affects outermost ~12%

      let elevation = noise.fbm(x * 0.008, y * 0.008, 6);
      // Continental masses — raises big blobs of land
      elevation = elevation * 0.6 + continentVal * 0.4;
      elevation *= edgeFalloff;

      // Shift elevation up so more land than ocean (~60% land)
      elevation += 0.08;

      const moisture = moistureNoise.fbm(x * 0.006, y * 0.006, 4);
      const temperature = tempNoise.fbm(x * 0.004, y * 0.004, 3);
      const latTemp = 1.0 - Math.abs(ny - 0.5) * 1.6;
      const temp = temperature * 0.4 + latTemp * 0.6;

      // Determine terrain
      let terrain;
      if (elevation < 0.22) {
        terrain = TERRAIN.DEEP_WATER;
      } else if (elevation < 0.30) {
        terrain = TERRAIN.WATER;
      } else if (elevation < 0.33) {
        terrain = TERRAIN.COAST;
      } else if (elevation < 0.35) {
        terrain = moisture > 0.5 ? TERRAIN.SAND : TERRAIN.COAST;
      } else if (elevation > 0.82) {
        terrain = TERRAIN.SNOW;
      } else if (elevation > 0.72) {
        terrain = TERRAIN.MOUNTAIN;
      } else if (elevation > 0.62) {
        terrain = TERRAIN.HILLS;
      } else {
        if (temp < 0.25) {
          terrain = moisture > 0.5 ? TERRAIN.TUNDRA : TERRAIN.SNOW;
        } else if (temp < 0.4) {
          terrain = moisture > 0.5 ? TERRAIN.FOREST : TERRAIN.TUNDRA;
        } else if (temp > 0.7 && moisture < 0.35) {
          terrain = TERRAIN.DESERT;
        } else if (moisture > 0.7 && temp > 0.4) {
          terrain = elevation < 0.42 ? TERRAIN.SWAMP : TERRAIN.DENSE_FOREST;
        } else if (moisture > 0.5) {
          terrain = TERRAIN.FOREST;
        } else if (moisture > 0.35) {
          terrain = TERRAIN.GRASSLAND;
        } else {
          terrain = TERRAIN.PLAINS;
        }
      }

      tiles[idx] = terrain;

      // Initial population
      const cap = TERRAIN_POP_CAP[terrain];
      if (cap > 0) {
        const popNoise = noise.fbm(x * 0.02, y * 0.02, 2);
        population[idx] = Math.floor(cap * popNoise * 0.4);
      }
    }
  }

  return { tiles, population, faithOwner, faithStrength, width, height };
}

// ─── Chunk management ───────────────────────────────────────────────────────
function getChunkId(cx, cy) {
  return `${cx}_${cy}`;
}

function worldToChunks(world) {
  const chunkSize = CONFIG.CHUNK_SIZE;
  const chunksX = Math.ceil(world.width / chunkSize);
  const chunksY = Math.ceil(world.height / chunkSize);
  const chunks = {};

  for (let cy = 0; cy < chunksY; cy++) {
    for (let cx = 0; cx < chunksX; cx++) {
      const chunkTiles = [];
      for (let ly = 0; ly < chunkSize; ly++) {
        for (let lx = 0; lx < chunkSize; lx++) {
          const wx = cx * chunkSize + lx;
          const wy = cy * chunkSize + ly;
          if (wx >= world.width || wy >= world.height) continue;
          const idx = wy * world.width + wx;
          chunkTiles.push({
            t: world.tiles[idx],
            p: world.population[idx],
            fo: world.faithOwner[idx],
            fs: world.faithStrength[idx],
          });
        }
      }
      chunks[getChunkId(cx, cy)] = chunkTiles;
    }
  }

  return chunks;
}

function chunksToWorld(chunks, width, height) {
  const chunkSize = CONFIG.CHUNK_SIZE;
  const tiles = new Uint8Array(width * height);
  const population = new Uint16Array(width * height);
  const faithOwner = new Int16Array(width * height);
  const faithStrength = new Uint8Array(width * height);
  faithOwner.fill(-1);

  const chunksX = Math.ceil(width / chunkSize);
  const chunksY = Math.ceil(height / chunkSize);

  for (let cy = 0; cy < chunksY; cy++) {
    for (let cx = 0; cx < chunksX; cx++) {
      const chunkData = chunks[getChunkId(cx, cy)];
      if (!chunkData) continue;
      let i = 0;
      for (let ly = 0; ly < chunkSize; ly++) {
        for (let lx = 0; lx < chunkSize; lx++) {
          const wx = cx * chunkSize + lx;
          const wy = cy * chunkSize + ly;
          if (wx >= width || wy >= height) { i++; continue; }
          const idx = wy * width + wx;
          const td = chunkData[i++];
          if (!td) continue;
          tiles[idx] = td.t;
          population[idx] = td.p;
          faithOwner[idx] = td.fo;
          faithStrength[idx] = td.fs;
        }
      }
    }
  }

  return { tiles, population, faithOwner, faithStrength, width, height };
}
