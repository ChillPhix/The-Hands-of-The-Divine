// ============================================
// THE HANDS OF THE DIVINE — Renderer
// ============================================

class Renderer {
  constructor(canvas, minimapCanvas, world, religions) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.miniCanvas = minimapCanvas;
    this.miniCtx = minimapCanvas.getContext('2d');
    this.world = world;
    this.religions = religions || [];

    this.zoom = 3;
    this.minZoom = 1;
    this.maxZoom = 12;
    this.camX = 0;
    this.camY = 0;
    this.tileSize = CONFIG.TILE_SIZE;

    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.hoveredTile = null;
    this.selectedMiracle = null;

    this.minimapDirty = true;
    this.time = 0;

    this.settlementManager = null;
    this.myReligionIndex = -1;
    this.people = [];
    this._lastPeopleUpdate = 0;

    this._setupEvents();
  }

  _setupEvents() {
    const c = this.canvas;

    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = c.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const worldXBefore = (mx / this.zoom) + this.camX;
      const worldYBefore = (my / this.zoom) + this.camY;
      const delta = e.deltaY > 0 ? -0.5 : 0.5;
      this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom + delta));
      this.camX = worldXBefore - (mx / this.zoom);
      this.camY = worldYBefore - (my / this.zoom);
      this._clampCamera();
    });

    c.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.isDragging = true;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        this.dragMoved = false;
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        const dx = e.clientX - this.dragStartX;
        const dy = e.clientY - this.dragStartY;
        if (Math.abs(dx) + Math.abs(dy) > 3) this.dragMoved = true;
        this.camX -= dx / this.zoom;
        this.camY -= dy / this.zoom;
        this._clampCamera();
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
      }
      const rect = c.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const worldX = Math.floor((mx / this.zoom + this.camX) / this.tileSize);
      const worldY = Math.floor((my / this.zoom + this.camY) / this.tileSize);
      if (worldX >= 0 && worldX < this.world.width && worldY >= 0 && worldY < this.world.height) {
        this.hoveredTile = { x: worldX, y: worldY };
      } else {
        this.hoveredTile = null;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (this.isDragging && !this.dragMoved && this.onClick) {
        const rect = c.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const worldX = Math.floor((mx / this.zoom + this.camX) / this.tileSize);
        const worldY = Math.floor((my / this.zoom + this.camY) / this.tileSize);
        if (worldX >= 0 && worldX < this.world.width && worldY >= 0 && worldY < this.world.height) {
          this.onClick(worldX, worldY);
        }
      }
      this.isDragging = false;
    });

    let lastTouchDist = 0;
    c.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.dragStartX = e.touches[0].clientX;
        this.dragStartY = e.touches[0].clientY;
        this.dragMoved = false;
      } else if (e.touches.length === 2) {
        lastTouchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      }
    }, { passive: false });

    c.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (e.touches.length === 1 && this.isDragging) {
        const dx = e.touches[0].clientX - this.dragStartX;
        const dy = e.touches[0].clientY - this.dragStartY;
        if (Math.abs(dx) + Math.abs(dy) > 3) this.dragMoved = true;
        this.camX -= dx / this.zoom;
        this.camY -= dy / this.zoom;
        this._clampCamera();
        this.dragStartX = e.touches[0].clientX;
        this.dragStartY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom + (dist - lastTouchDist) * 0.01));
        lastTouchDist = dist;
        this._clampCamera();
      }
    }, { passive: false });

    c.addEventListener('touchend', (e) => {
      if (this.isDragging && !this.dragMoved && this.onClick && e.changedTouches.length > 0) {
        const rect = c.getBoundingClientRect();
        const touch = e.changedTouches[0];
        const mx = touch.clientX - rect.left;
        const my = touch.clientY - rect.top;
        const worldX = Math.floor((mx / this.zoom + this.camX) / this.tileSize);
        const worldY = Math.floor((my / this.zoom + this.camY) / this.tileSize);
        if (worldX >= 0 && worldX < this.world.width && worldY >= 0 && worldY < this.world.height) {
          this.onClick(worldX, worldY);
        }
      }
      this.isDragging = false;
    });

    this.miniCanvas.addEventListener('click', (e) => {
      const rect = this.miniCanvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const scaleX = (this.world.width * this.tileSize) / this.miniCanvas.width;
      const scaleY = (this.world.height * this.tileSize) / this.miniCanvas.height;
      this.camX = (mx * scaleX) - (this.canvas.width / this.zoom / 2);
      this.camY = (my * scaleY) - (this.canvas.height / this.zoom / 2);
      this._clampCamera();
    });
  }

  _clampCamera() {
    const maxX = this.world.width * this.tileSize - this.canvas.width / this.zoom;
    const maxY = this.world.height * this.tileSize - this.canvas.height / this.zoom;
    this.camX = Math.max(0, Math.min(maxX, this.camX));
    this.camY = Math.max(0, Math.min(maxY, this.camY));
  }

  resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    this.canvas.width = parent.clientWidth;
    this.canvas.height = parent.clientHeight;
  }

  markDirty() { this.minimapDirty = true; }

  _isHiddenFromMe(ownerIndex) {
    if (ownerIndex === this.myReligionIndex) return false;
    const rel = this.religions[ownerIndex];
    if (!rel) return false;
    const fx = getCombinedEffects(rel.traits || []);
    if (!fx.hidden) return false;
    // Secretive religions are visible when zoomed in close (findable)
    return this.zoom < 6;
  }

  _updatePeople() {
    if (this.time - this._lastPeopleUpdate < 30) return;
    this._lastPeopleUpdate = this.time;
    const w = this.world;
    const ts = this.tileSize;
    const zoom = this.zoom;
    if (zoom < 4) { this.people = []; return; }

    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const startX = Math.max(0, Math.floor(this.camX / ts));
    const startY = Math.max(0, Math.floor(this.camY / ts));
    const endX = Math.min(w.width, Math.ceil((this.camX + cw / zoom) / ts) + 1);
    const endY = Math.min(w.height, Math.ceil((this.camY + ch / zoom) / ts) + 1);

    this.people = [];
    const maxPeople = 400;
    let count = 0;

    for (let y = startY; y < endY && count < maxPeople; y++) {
      for (let x = startX; x < endX && count < maxPeople; x++) {
        const idx = y * w.width + x;
        if (w.tiles[idx] <= TERRAIN.WATER) continue;
        const pop = w.population[idx];
        if (pop < 15) continue;
        const owner = w.faithOwner[idx];
        if (owner >= 0 && this._isHiddenFromMe(owner)) continue;

        const numPeople = pop >= 80 ? 3 : pop >= 40 ? 2 : 1;
        for (let i = 0; i < numPeople && count < maxPeople; i++) {
          const seed = x * 997 + y * 641 + i * 131;
          const wobbleX = Math.sin(this.time * 0.02 + seed) * ts * 0.3;
          const wobbleY = Math.cos(this.time * 0.015 + seed * 0.7) * ts * 0.3;
          this.people.push({ px: x * ts + ts * 0.5 + wobbleX, py: y * ts + ts * 0.5 + wobbleY, owner });
          count++;
        }
      }
    }
  }

  render() {
    this.time++;
    const ctx = this.ctx;
    const w = this.world;
    const ts = this.tileSize;
    const zoom = this.zoom;
    const cw = this.canvas.width;
    const ch = this.canvas.height;

    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, cw, ch);

    const startTileX = Math.max(0, Math.floor(this.camX / ts));
    const startTileY = Math.max(0, Math.floor(this.camY / ts));
    const endTileX = Math.min(w.width, Math.ceil((this.camX + cw / zoom) / ts) + 1);
    const endTileY = Math.min(w.height, Math.ceil((this.camY + ch / zoom) / ts) + 1);

    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(-this.camX, -this.camY);
    ctx.imageSmoothingEnabled = false;

    // ─── Terrain + Faith ────────────────────────────────────────
    for (let y = startTileY; y < endTileY; y++) {
      for (let x = startTileX; x < endTileX; x++) {
        const idx = y * w.width + x;
        const terrain = w.tiles[idx];
        const owner = w.faithOwner[idx];
        const faith = w.faithStrength[idx];
        const pop = w.population[idx];
        const px = x * ts;
        const py = y * ts;

        ctx.fillStyle = TERRAIN_COLORS[terrain] || '#000';
        ctx.fillRect(px, py, ts, ts);

        // Dithering
        if (terrain > TERRAIN.WATER) {
          const hash = ((x * 7 + y * 13) ^ (x * 3)) & 0xFF;
          if (hash < 40) { ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(px, py, ts, ts); }
          else if (hash > 215) { ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(px, py, ts, ts); }
        }

        // Water shimmer
        if (terrain === TERRAIN.DEEP_WATER || terrain === TERRAIN.WATER) {
          if (Math.sin((x + this.time * 0.05) * 0.5) > 0.4) {
            ctx.fillStyle = 'rgba(255,255,255,0.06)';
            ctx.fillRect(px, py, ts, ts);
          }
        }

        // Faith overlay
        if (owner >= 0 && this.religions[owner] && !this._isHiddenFromMe(owner)) {
          const alpha = 0.2 + (faith / 255) * 0.55;
          ctx.fillStyle = this.religions[owner].color;
          ctx.globalAlpha = alpha;
          ctx.fillRect(px, py, ts, ts);
          ctx.globalAlpha = 1;
        }

        // Dwelling dots at medium zoom
        if (zoom >= 3 && pop > 20 && terrain > TERRAIN.WATER) {
          const popRatio = pop / (TERRAIN_POP_CAP[terrain] || 100);
          if (popRatio > 0.2) {
            const numDots = Math.min(4, Math.floor(popRatio * 5));
            const dotColor = (owner >= 0 && this.religions[owner] && !this._isHiddenFromMe(owner))
              ? this.religions[owner].color : 'rgba(200,180,140,0.5)';
            ctx.fillStyle = dotColor;
            ctx.globalAlpha = 0.35;
            for (let d = 0; d < numDots; d++) {
              const dx = ((x * 3 + d * 7 + y) % 3) * (ts / 3) + ts * 0.1;
              const dy2 = ((y * 5 + d * 11 + x) % 3) * (ts / 3) + ts * 0.1;
              ctx.fillRect(px + dx, py + dy2, Math.max(1, ts * 0.15), Math.max(1, ts * 0.15));
            }
            ctx.globalAlpha = 1;
          }
        }
      }
    }

    // ─── Settlements ────────────────────────────────────────────
    if (this.settlementManager && zoom >= 2) {
      const visible = this.settlementManager.getVisibleSettlements(startTileX, startTileY, endTileX, endTileY);
      for (const s of visible) {
        if (s.owner >= 0 && this._isHiddenFromMe(s.owner)) continue;
        const st = SETTLEMENT_TYPES[s.type];
        if (!st) continue;
        const px = s.x * ts;
        const py = s.y * ts;
        const relColor = (s.owner >= 0 && this.religions[s.owner]) ? this.religions[s.owner].color : '#aaa';
        const bSize = Math.max(2, ts * (0.5 + st.size * 0.15));

        // Walls for cities
        if (s.type === 'CAPITAL' || s.type === 'CITY') {
          ctx.fillStyle = 'rgba(0,0,0,0.4)';
          ctx.fillRect(px + ts/2 - bSize/2 - 1, py + ts/2 - bSize/2 - 1, bSize + 2, bSize + 2);
        }
        // Building
        ctx.fillStyle = st.color;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(px + ts/2 - bSize/2, py + ts/2 - bSize/2, bSize, bSize);
        // Roof
        ctx.fillStyle = relColor;
        ctx.globalAlpha = 0.7;
        ctx.fillRect(px + ts/2 - bSize/2, py + ts/2 - bSize/2, bSize, Math.max(1, bSize * 0.3));
        ctx.globalAlpha = 1;

        // Capital crown
        if (s.isCapital) {
          const crownPulse = 0.85 + Math.sin(this.time * 0.08) * 0.15;
          ctx.fillStyle = '#f0d060';
          ctx.globalAlpha = crownPulse;
          const cs2 = Math.max(1, ts * 0.25);
          ctx.fillRect(px + ts/2 - cs2/2, py + ts/2 - bSize/2 - cs2 - 1, cs2, cs2);
          ctx.globalAlpha = 1;
        }

        // Label
        if (zoom >= 5) {
          ctx.fillStyle = '#fff';
          ctx.globalAlpha = 0.8;
          ctx.font = `${Math.max(1, 2.5 / zoom * ts)}px monospace`;
          ctx.textAlign = 'center';
          ctx.fillText(s.name, px + ts/2, py + ts/2 + bSize/2 + 3/zoom * ts);
          ctx.globalAlpha = 1;
        }
      }
    }

    // ─── People ─────────────────────────────────────────────────
    this._updatePeople();
    if (zoom >= 4) {
      const personSize = Math.max(0.5, ts * 0.18);
      for (const person of this.people) {
        const rc = (person.owner >= 0 && this.religions[person.owner]) ? this.religions[person.owner].color : '#d4c8a0';
        ctx.fillStyle = rc;
        ctx.globalAlpha = 0.7;
        ctx.fillRect(person.px - personSize/2, person.py - personSize/2, personSize, personSize);
        ctx.fillStyle = '#e8d8c0';
        ctx.globalAlpha = 0.6;
        ctx.fillRect(person.px - personSize/4, person.py - personSize, personSize/2, personSize/2);
        ctx.globalAlpha = 1;
      }
    }

    // ─── Agent Sprites ──────────────────────────────────────────
    if (this.agentManager && zoom >= 2) {
      const visibleAgents = this.agentManager.getVisibleAgents(startTileX, startTileY, endTileX, endTileY);
      for (const agent of visibleAgents) {
        if (this._isHiddenFromMe(agent.religionIndex)) continue;
        const typeInfo = AGENT_TYPES[agent.type];
        if (!typeInfo) continue;
        const rel = this.religions[agent.religionIndex];
        const relColor = rel?.color || '#888';

        const ax = agent.x * ts;
        const ay = agent.y * ts;

        if (zoom >= 5 && SPRITE_DATA[agent.type]) {
          // Draw pixel sprite
          const sprite = SPRITE_DATA[agent.type];
          const pixSize = ts * 0.15;
          const spriteW = 5 * pixSize;
          const spriteH = 7 * pixSize;
          const sx = ax + ts/2 - spriteW/2;
          const sy = ay + ts/2 - spriteH/2;

          for (let row = 0; row < 7; row++) {
            for (let col = 0; col < 5; col++) {
              const val = sprite[row][col];
              if (val === 0) continue;
              switch (val) {
                case 1: ctx.fillStyle = relColor; break;      // body in religion color
                case 2: ctx.fillStyle = '#e8c8a0'; break;     // skin
                case 3: ctx.fillStyle = '#f0d060'; break;     // accent/gold
                case 4: ctx.fillStyle = '#aaaaaa'; break;     // weapon/item
              }
              ctx.globalAlpha = 0.9;
              ctx.fillRect(sx + col * pixSize, sy + row * pixSize, pixSize, pixSize);
            }
          }
          ctx.globalAlpha = 1;

          // Name label for heroes
          if (agent.type === 'hero' && zoom >= 6) {
            ctx.fillStyle = '#f0d060';
            ctx.globalAlpha = 0.85;
            ctx.font = `${Math.max(1, 1.8/zoom * ts)}px monospace`;
            ctx.textAlign = 'center';
            ctx.fillText(agent.name, ax + ts/2, sy - pixSize);
            ctx.globalAlpha = 1;
          }
        } else {
          // Simple colored dot at lower zoom
          const dotSize = Math.max(1, ts * 0.4);
          ctx.fillStyle = typeInfo.color;
          ctx.globalAlpha = 0.85;
          ctx.fillRect(ax + ts/2 - dotSize/2, ay + ts/2 - dotSize/2, dotSize, dotSize);
          ctx.globalAlpha = 1;
        }
      }
    }

    // ─── Terrain Details (trees, rocks at zoom) ─────────────────
    if (zoom >= 4) {
      for (let y = startTileY; y < endTileY; y++) {
        for (let x = startTileX; x < endTileX; x++) {
          const idx = y * this.world.width + x;
          const terrain = this.world.tiles[idx];
          const px = x * ts;
          const py = y * ts;
          const hash = ((x * 31 + y * 17) ^ (x * 7)) & 0xFF;

          if (terrain === TERRAIN.FOREST || terrain === TERRAIN.DENSE_FOREST) {
            // Pixel trees
            if (hash < 120) {
              const treeH = ts * 0.6;
              const treeW = ts * 0.3;
              const tx = px + (hash % 3) * ts * 0.25 + ts * 0.1;
              const ty = py + ts * 0.1;
              // Trunk
              ctx.fillStyle = '#5a3a1a';
              ctx.globalAlpha = 0.6;
              ctx.fillRect(tx + treeW * 0.3, ty + treeH * 0.6, treeW * 0.4, treeH * 0.4);
              // Canopy
              ctx.fillStyle = terrain === TERRAIN.DENSE_FOREST ? '#1a4a0e' : '#2a6a1e';
              ctx.fillRect(tx, ty, treeW, treeH * 0.7);
              ctx.globalAlpha = 1;
            }
          } else if (terrain === TERRAIN.MOUNTAIN || terrain === TERRAIN.SNOW) {
            // Mountain peaks
            if (hash < 80) {
              const peakH = ts * 0.5;
              const peakW = ts * 0.4;
              const mx = px + ts * 0.3;
              const my = py + ts * 0.15;
              ctx.fillStyle = terrain === TERRAIN.SNOW ? '#d8d8e8' : '#7a7a7a';
              ctx.globalAlpha = 0.5;
              // Triangle-ish peak
              ctx.fillRect(mx + peakW * 0.25, my, peakW * 0.5, peakH * 0.3);
              ctx.fillRect(mx + peakW * 0.1, my + peakH * 0.3, peakW * 0.8, peakH * 0.3);
              ctx.fillRect(mx, my + peakH * 0.6, peakW, peakH * 0.4);
              // Snow cap
              if (terrain === TERRAIN.MOUNTAIN && hash < 40) {
                ctx.fillStyle = '#e8e8f0';
                ctx.fillRect(mx + peakW * 0.3, my, peakW * 0.4, peakH * 0.2);
              }
              ctx.globalAlpha = 1;
            }
          }
        }
      }
    }

    // ─── Resource deposit markers ───────────────────────────────
    if (this.resourceManager && zoom >= 5) {
      for (const [key, dep] of Object.entries(this.resourceManager.deposits)) {
        const [dx, dy] = key.split('_').map(Number);
        if (dx < startTileX || dx > endTileX || dy < startTileY || dy > endTileY) continue;
        const px = dx * ts;
        const py = dy * ts;
        const resInfo = CONFIG.RESOURCES[dep.resource];
        if (!resInfo) continue;

        // Small colored marker
        ctx.fillStyle = resInfo.color;
        ctx.globalAlpha = 0.6;
        const mSize = Math.max(1, ts * 0.25);
        ctx.fillRect(px + ts - mSize - 0.5, py + 0.5, mSize, mSize);
        ctx.globalAlpha = 1;
      }
    }

    // ─── Holy Sites ─────────────────────────────────────────────
    if (this.holySites) {
      for (const hs of this.holySites) {
        const rel = this.religions.find(r => r.id === hs.religion_id);
        if (!rel) continue;
        if (rel.index !== undefined && this._isHiddenFromMe(rel.index)) continue;
        if (hs.tile_x < startTileX - 3 || hs.tile_x > endTileX + 3 || hs.tile_y < startTileY - 3 || hs.tile_y > endTileY + 3) continue;

        const px = hs.tile_x * ts;
        const py = hs.tile_y * ts;
        const pulse = Math.sin(this.time * 0.08) * 0.2 + 0.8;
        const isCath = hs.site_type === 'cathedral';
        const isTemp = hs.site_type === 'temple';

        // Glow
        ctx.fillStyle = rel.color;
        ctx.globalAlpha = 0.06 * pulse;
        const glowR = (isCath ? 6 : isTemp ? 4 : 2.5) * ts;
        ctx.beginPath();
        ctx.arc(px + ts/2, py + ts/2, glowR, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        // Base
        const bw = (isCath ? 2.5 : isTemp ? 1.8 : 1.2) * ts;
        const bh = (isCath ? 2.2 : isTemp ? 1.5 : 1.0) * ts;
        ctx.fillStyle = '#1a1a2e';
        ctx.globalAlpha = 0.6;
        ctx.fillRect(px + ts/2 - bw/2, py + ts/2 - bh/2, bw, bh);

        // Structure
        ctx.fillStyle = rel.color;
        ctx.globalAlpha = 0.9 * pulse;
        const sw = bw * 0.8;
        const sh = bh * 0.8;
        ctx.fillRect(px + ts/2 - sw/2, py + ts/2 - sh/2, sw, sh);

        // Spire
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 0.9;
        const cs = Math.max(1, ts * 0.2);
        if (isCath) {
          for (let sp = -1; sp <= 1; sp++) {
            const spH = sp === 0 ? cs * 3 : cs * 2;
            ctx.fillRect(px + ts/2 + sp * cs * 1.5 - cs/4, py + ts/2 - sh/2 - spH, cs/2, spH);
          }
          ctx.fillRect(px + ts/2 - cs, py + ts/2 - sh/2 - cs * 3 - cs/2, cs * 2, cs/2);
        } else if (isTemp) {
          ctx.fillRect(px + ts/2 - cs/4, py + ts/2 - sh/2 - cs * 2, cs/2, cs * 2);
          ctx.fillRect(px + ts/2 - cs/2, py + ts/2 - sh/2 - cs * 2, cs, cs/3);
        } else {
          ctx.fillRect(px + ts/2 - cs/4, py + ts/2 - sh/2 - cs, cs/2, cs);
        }
        ctx.globalAlpha = 1;

        if (zoom >= 4) {
          const label = isCath ? 'Cathedral' : isTemp ? 'Temple' : 'Shrine';
          ctx.fillStyle = rel.color;
          ctx.globalAlpha = 0.7;
          ctx.font = `${Math.max(1, 2 / zoom * ts)}px monospace`;
          ctx.textAlign = 'center';
          ctx.fillText(label, px + ts/2, py + ts/2 + bh/2 + 3/zoom * ts);
          ctx.globalAlpha = 1;
        }
      }
    }

    // ─── Hover ──────────────────────────────────────────────────
    if (this.hoveredTile) {
      const hx = this.hoveredTile.x * ts;
      const hy = this.hoveredTile.y * ts;
      ctx.strokeStyle = this.selectedMiracle ? '#ff4444' : '#ffffff';
      ctx.lineWidth = 1 / zoom;
      ctx.strokeRect(hx, hy, ts, ts);
      if (this.selectedMiracle) {
        const m = CONFIG.MIRACLES[this.selectedMiracle];
        if (m) {
          ctx.strokeStyle = 'rgba(255,60,60,0.3)';
          ctx.lineWidth = 1 / zoom;
          ctx.beginPath();
          ctx.arc(hx + ts/2, hy + ts/2, m.radius * ts, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = 'rgba(255,60,60,0.08)';
          ctx.fill();
        }
      }
    }

    ctx.restore();
    this._renderMinimap();
  }

  _renderMinimap() {
    const mCtx = this.miniCtx;
    const mW = this.miniCanvas.width;
    const mH = this.miniCanvas.height;
    const w = this.world;

    if (this.minimapDirty) {
      const imgData = mCtx.createImageData(mW, mH);
      const data = imgData.data;
      const scaleX = w.width / mW;
      const scaleY = w.height / mH;
      for (let py = 0; py < mH; py++) {
        for (let px = 0; px < mW; px++) {
          const wx = Math.floor(px * scaleX);
          const wy = Math.floor(py * scaleY);
          const idx = wy * w.width + wx;
          const owner = w.faithOwner[idx];
          let color;
          if (owner >= 0 && this.religions[owner] && !this._isHiddenFromMe(owner)) {
            color = this._hexToRgb(this.religions[owner].color);
          } else {
            color = this._hexToRgb(TERRAIN_COLORS[w.tiles[idx]] || '#000000');
          }
          const pi = (py * mW + px) * 4;
          data[pi] = color.r; data[pi + 1] = color.g; data[pi + 2] = color.b; data[pi + 3] = 255;
        }
      }
      mCtx.putImageData(imgData, 0, 0);
      this.minimapDirty = false;
    }

    const scaleX = mW / (w.width * this.tileSize);
    const scaleY = mH / (w.height * this.tileSize);
    mCtx.strokeStyle = '#fff';
    mCtx.lineWidth = 1;
    mCtx.strokeRect(this.camX * scaleX, this.camY * scaleY,
      (this.canvas.width / this.zoom) * scaleX, (this.canvas.height / this.zoom) * scaleY);
  }

  _hexToRgb(hex) {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return r ? { r: parseInt(r[1],16), g: parseInt(r[2],16), b: parseInt(r[3],16) } : { r:0, g:0, b:0 };
  }

  goTo(x, y) {
    this.camX = x * this.tileSize - this.canvas.width / this.zoom / 2;
    this.camY = y * this.tileSize - this.canvas.height / this.zoom / 2;
    this._clampCamera();
    this.markDirty();
  }
}
