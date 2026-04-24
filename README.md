# ✦ The Hands of The Divine

A persistent, multiplayer browser god-sim where you create a religion and compete to spread your faith across a massive procedurally-generated world.

Inspired by WorldBox — but you're a god competing with other gods through faith, not armies.

## 🎮 How It Worksd

1. **Create a Religion** — Draw your holy symbol (pixel art), pick a sacred color, name your faith, and choose up to 5 traits from 50+ options
2. **Enter the World** — Your followers spawn on a 300×300 procedurally generated map with continents, oceans, mountains, forests, deserts, and more
3. **Watch It Grow** — Your religion spreads autonomously based on the traits you chose. Warlike faiths conquer by force. Traders spread along coasts. Underground cults pop up in distant lands.
4. **Intervene Subtly** — Place holy sites to boost your faith. Use rare miracles to bless your people or curse your enemies. Claim unclaimed tiles.
5. **Check Back Later** — The world catches up when you return. See what happened while you were gone.

## 🛠️ Setup

### 1. Supabase (Database)

1. Go to [supabase.com](https://supabase.com) → New Project → name it `the-hands-of-the-divine`
2. Pick a region close to you, set a database password
3. Once created, go to **SQL Editor** → paste the contents of `schema.sql` → Run
4. Go to **Settings → API** → copy your **Project URL** and **anon public key**
5. Open `js/config.js` and paste them in:

```js
SUPABASE_URL: 'https://your-project.supabase.co',
SUPABASE_ANON_KEY: 'your-anon-key-here',
```

### 2. GitHub Pages (Hosting)

1. Create a repo called `the-hands-of-the-divine`
2. Push all these files to it
3. Go to **Settings → Pages → Source: Deploy from a branch → main → / (root)**
4. Your game is live at `https://yourusername.github.io/the-hands-of-the-divine`

### Or run locally

Just open `index.html` in a browser. Without Supabase configured, it runs in local-only mode using localStorage.

## 🗺️ The World

- **300×300 tiles** (90,000 total) with procedural terrain
- Terrain types: Deep Ocean, Ocean, Coast, Beach, Plains, Grassland, Forest, Dense Forest, Hills, Mountain, Snow Peak, Swamp, Desert, Tundra
- Each terrain has different population capacity, spread difficulty, and strategic value

## ⛪ Religion Traits (50+)

| Category | Examples |
|----------|---------|
| **Spread** | Missionary, Warlike, Traders, Seafaring, Nomadic, Underground, Viral |
| **Society** | Fertile, Scholarly, Industrious, Communal, Builders, Storytellers |
| **Belief** | Fanatical, Tolerant, Secretive, Prophetic, Nature Worship, Syncretic |
| **Survival** | Hardy, Adaptive, Mountain-Born, Desert-Born, Frost-Born, Fortified |
| **Dark** | Blood Sacrifice, Plague Bearers, Raiders, Cannibalistic, Doomsday Cult |
| **Divine** | Chosen People, Miracle Worker, Omnipresent, Wrathful God, Benevolent God |

Traits combine for emergent behavior:
- **Warlike + Seafaring** = Viking raiders
- **Scholarly + Tolerant** = Slow but impossible to uproot
- **Underground + Plague Bearers** = Silent corruption
- **Fanatical + Blood Sacrifice** = Terrifying but powerful

## ⚡ Miracles

| Miracle | Cost | Effect |
|---------|------|--------|
| Bless | 5⚡ | Boost growth and faith in an area |
| Drought | 8⚡ | Weaken enemy population |
| Storm | 10⚡ | Disrupt enemy faith |
| Inspire | 6⚡ | Boost conversion speed |
| Pestilence | 15⚡ | Plague weakens everything in area |
| Earthquake | 20⚡ | Devastate terrain and population |
| Fertility | 4⚡ | Population boom |
| Vision | 3⚡ | Reveal hidden info |

## 📁 File Structure

```
the-hands-of-the-divine/
  index.html          ← Main page
  schema.sql          ← Supabase table setup
  js/
    config.js         ← Supabase keys & game settings
    world.js          ← World generation & terrain
    traits.js         ← All 50+ religion traits
    simulation.js     ← Core tick engine
    renderer.js       ← Pixel art canvas renderer
    storage.js        ← Supabase sync layer
    ui.js             ← Menus, HUD, religion creation
    main.js           ← Game bootstrap & loop
```

## 🎨 Tech

- Pure vanilla JS — no build step, no framework
- HTML5 Canvas with pixel art rendering
- Supabase for persistent shared world state
- GitHub Pages for free hosting
- Press Start 2P + VT323 fonts for retro aesthetic

---

*Shape your faith. Claim the world. Watch empires rise and fall.*
