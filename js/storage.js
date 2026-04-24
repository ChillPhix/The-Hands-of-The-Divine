// ============================================
// THE HANDS OF THE DIVINE — Storage (Supabase)
// ============================================

class Storage {
  constructor() {
    this.supabase = null;
    this.connected = false;
  }

  async init() {
    if (CONFIG.SUPABASE_URL === 'YOUR_SUPABASE_URL_HERE') {
      console.warn('Supabase not configured — running in local-only mode');
      return false;
    }

    try {
      // Load Supabase client from CDN (already included in HTML)
      this.supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
      this.connected = true;
      console.log('Connected to Supabase');
      return true;
    } catch (err) {
      console.error('Failed to connect to Supabase:', err);
      return false;
    }
  }

  // ─── World State ──────────────────────────────────────────────────────────
  async loadWorldState() {
    if (!this.connected) return this._loadLocal('worldState');

    try {
      const { data, error } = await this.supabase
        .from('world_state')
        .select('*')
        .eq('id', 'main')
        .single();

      if (error || !data) return null;
      return data;
    } catch (err) {
      console.error('Error loading world state:', err);
      return this._loadLocal('worldState');
    }
  }

  async saveWorldState(tickCount) {
    const state = { id: 'main', tick_count: tickCount, last_tick_at: new Date().toISOString(), seed: CONFIG.WORLD_SEED };

    if (!this.connected) {
      this._saveLocal('worldState', state);
      return;
    }

    try {
      await this.supabase
        .from('world_state')
        .upsert(state);
    } catch (err) {
      console.error('Error saving world state:', err);
      this._saveLocal('worldState', state);
    }
  }

  // ─── World Chunks ─────────────────────────────────────────────────────────
  async loadChunks() {
    if (!this.connected) {
      const local = this._loadLocal('worldChunks');
      return local || null;
    }

    try {
      const { data, error } = await this.supabase
        .from('world_chunks')
        .select('chunk_id, tiles');

      if (error || !data || data.length === 0) return null;

      const chunks = {};
      for (const row of data) {
        chunks[row.chunk_id] = row.tiles;
      }
      return chunks;
    } catch (err) {
      console.error('Error loading chunks:', err);
      return this._loadLocal('worldChunks');
    }
  }

  async saveChunks(chunks) {
    if (!this.connected) {
      this._saveLocal('worldChunks', chunks);
      return;
    }

    try {
      // Batch upsert all chunks
      const rows = Object.entries(chunks).map(([chunk_id, tiles]) => ({
        chunk_id,
        tiles,
        updated_at: new Date().toISOString(),
      }));

      // Supabase has a limit on upsert size, so batch in groups of 20
      for (let i = 0; i < rows.length; i += 20) {
        const batch = rows.slice(i, i + 20);
        await this.supabase
          .from('world_chunks')
          .upsert(batch);
      }
    } catch (err) {
      console.error('Error saving chunks:', err);
      this._saveLocal('worldChunks', chunks);
    }
  }

  // Save only specific dirty chunks
  async saveDirtyChunks(chunks, dirtyChunkIds) {
    if (!this.connected) {
      // For local, just save everything
      this._saveLocal('worldChunks', chunks);
      return;
    }

    if (dirtyChunkIds.length === 0) return;

    try {
      const rows = dirtyChunkIds.map(chunk_id => ({
        chunk_id,
        tiles: chunks[chunk_id],
        updated_at: new Date().toISOString(),
      }));

      for (let i = 0; i < rows.length; i += 20) {
        const batch = rows.slice(i, i + 20);
        await this.supabase
          .from('world_chunks')
          .upsert(batch);
      }
    } catch (err) {
      console.error('Error saving dirty chunks:', err);
    }
  }

  // ─── Religions ────────────────────────────────────────────────────────────
  async loadReligions() {
    if (!this.connected) {
      return this._loadLocal('religions') || [];
    }

    try {
      const { data, error } = await this.supabase
        .from('religions')
        .select('*')
        .order('created_at', { ascending: true });

      return error ? [] : (data || []);
    } catch (err) {
      console.error('Error loading religions:', err);
      return this._loadLocal('religions') || [];
    }
  }

  async saveReligion(religion) {
    if (!this.connected) {
      const all = this._loadLocal('religions') || [];
      const idx = all.findIndex(r => r.id === religion.id);
      if (idx >= 0) all[idx] = religion;
      else all.push(religion);
      this._saveLocal('religions', all);
      return;
    }

    try {
      await this.supabase
        .from('religions')
        .upsert({
          id: religion.id,
          name: religion.name,
          symbol_data: religion.symbol_data,
          color: religion.color,
          traits: religion.traits,
          creator_name: religion.creator_name || 'Anonymous',
          divine_power: religion.divine_power || CONFIG.STARTING_DIVINE_POWER,
          follower_count: religion.follower_count || 0,
          territory_count: religion.territory_count || 0,
          last_active_at: new Date().toISOString(),
        });
    } catch (err) {
      console.error('Error saving religion:', err);
    }
  }

  async updateReligionStats(id, stats) {
    if (!this.connected) return;

    try {
      await this.supabase
        .from('religions')
        .update({
          divine_power: stats.divine_power,
          follower_count: stats.population,
          territory_count: stats.tiles,
          last_active_at: new Date().toISOString(),
        })
        .eq('id', id);
    } catch (err) {
      console.error('Error updating religion stats:', err);
    }
  }

  // ─── Holy Sites ───────────────────────────────────────────────────────────
  async loadHolySites() {
    if (!this.connected) {
      return this._loadLocal('holySites') || [];
    }

    try {
      const { data, error } = await this.supabase
        .from('holy_sites')
        .select('*');

      return error ? [] : (data || []);
    } catch (err) {
      return this._loadLocal('holySites') || [];
    }
  }

  async saveHolySite(site) {
    if (!this.connected) {
      const all = this._loadLocal('holySites') || [];
      all.push(site);
      this._saveLocal('holySites', all);
      return;
    }

    try {
      await this.supabase
        .from('holy_sites')
        .upsert(site);
    } catch (err) {
      console.error('Error saving holy site:', err);
    }
  }

  // ─── Events ───────────────────────────────────────────────────────────────
  async loadRecentEvents(limit = 50) {
    if (!this.connected) {
      return this._loadLocal('events') || [];
    }

    try {
      const { data, error } = await this.supabase
        .from('world_events')
        .select('*')
        .order('tick', { ascending: false })
        .limit(limit);

      return error ? [] : (data || []);
    } catch (err) {
      return [];
    }
  }

  async saveEvents(events) {
    if (!this.connected || events.length === 0) {
      if (events.length > 0) {
        const existing = this._loadLocal('events') || [];
        this._saveLocal('events', [...existing, ...events].slice(-200));
      }
      return;
    }

    try {
      const rows = events.map(e => ({
        tick: e.tick,
        event_type: e.type,
        religion_id: e.religionId || null,
        description: e.desc,
        tile_x: e.x || null,
        tile_y: e.y || null,
      }));

      await this.supabase
        .from('world_events')
        .insert(rows);
    } catch (err) {
      console.error('Error saving events:', err);
    }
  }

  // ─── Local storage fallback ───────────────────────────────────────────────
  _saveLocal(key, data) {
    try {
      // Compress large data
      const str = JSON.stringify(data);
      if (str.length > 4000000) {
        // Too large for localStorage — skip
        console.warn(`Data for ${key} too large for localStorage (${str.length} bytes)`);
        return;
      }
      localStorage.setItem(`hotd_${key}`, str);
    } catch (e) {
      console.warn('localStorage save failed:', e);
    }
  }

  _loadLocal(key) {
    try {
      const str = localStorage.getItem(`hotd_${key}`);
      return str ? JSON.parse(str) : null;
    } catch (e) {
      return null;
    }
  }
}
