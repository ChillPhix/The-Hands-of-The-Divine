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

    // Viewport
    this.zoom = 3;
    this.minZoom = 1;
    this.maxZoom = 12;
    this.camX = 0;
    this.camY = 0;
    this.tileSize = CONFIG.TILE_SIZE;

    // Interaction
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.hoveredTile = null;
    this.selectedMiracle = null;

    // Cached images
    this.terrainBuffer = null;
    this.terrainDirty = true;
    this.faithBuffer = null;
    this.faithDirty = true;
    this.minimapBuffer = null;
    this.minimapDirty = true;

    // Animation
    this.animFrame = null;
    this.time = 0;

    this._setupEvents();
  }

  _setupEvents() {
    const c = this.canvas;

    // Mouse wheel zoom
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = c.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      // Zoom toward mouse position
      const worldXBefore = (mx / this.zoom) + this.camX;
      const worldYBefore = (my / this.zoom) + this.camY;

      const delta = e.deltaY > 0 ? -0.5 : 0.5;
      this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom + delta));

      this.camX = worldXBefore - (mx / this.zoom);
      this.camY = worldYBefore - (my / this.zoom);
      this._clampCamera();
      this.faithDirty = true;
    });

    // Pan
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
        this.faithDirty = true;
      }

      // Hover detection
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

    // Touch events for mobile
    let lastTouchDist = 0;
    c.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.dragStartX = e.touches[0].clientX;
        this.dragStartY = e.touches[0].clientY;
        this.dragMoved = false;
      } else if (e.touches.length === 2) {
        lastTouchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
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
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const delta = (dist - lastTouchDist) * 0.01;
        this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom + delta));
        lastTouchDist = dist;
        this._clampCamera();
      }
      this.faithDirty = true;
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

    // Minimap click to navigate
    this.miniCanvas.addEventListener('click', (e) => {
      const rect = this.miniCanvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const scaleX = (this.world.width * this.tileSize) / this.miniCanvas.width;
      const scaleY = (this.world.height * this.tileSize) / this.miniCanvas.height;
      this.camX = (mx * scaleX) - (this.canvas.width / this.zoom / 2);
      this.camY = (my * scaleY) - (this.canvas.height / this.zoom / 2);
      this._clampCamera();
      this.faithDirty = true;
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
    this.terrainDirty = true;
    this.faithDirty = true;
  }

  markDirty() {
    this.terrainDirty = true;
    this.faithDirty = true;
    this.minimapDirty = true;
  }

  // ─── Main render ──────────────────────────────────────────────────────────
  render() {
    this.time++;
    const ctx = this.ctx;
    const w = this.world;
    const ts = this.tileSize;
    const zoom = this.zoom;
    const cw = this.canvas.width;
    const ch = this.canvas.height;

    // Clear
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, cw, ch);

    // Calculate visible tile range
    const startTileX = Math.max(0, Math.floor(this.camX / ts));
    const startTileY = Math.max(0, Math.floor(this.camY / ts));
    const endTileX = Math.min(w.width, Math.ceil((this.camX + cw / zoom) / ts) + 1);
    const endTileY = Math.min(w.height, Math.ceil((this.camY + ch / zoom) / ts) + 1);

    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(-this.camX, -this.camY);

    // Disable image smoothing for pixel art
    ctx.imageSmoothingEnabled = false;

    // Draw tiles
    for (let y = startTileY; y < endTileY; y++) {
      for (let x = startTileX; x < endTileX; x++) {
        const idx = y * w.width + x;
        const terrain = w.tiles[idx];
        const owner = w.faithOwner[idx];
        const faith = w.faithStrength[idx];
        const pop = w.population[idx];

        const px = x * ts;
        const py = y * ts;

        // Base terrain color
        ctx.fillStyle = TERRAIN_COLORS[terrain] || '#000';
        ctx.fillRect(px, py, ts, ts);

        // Pixel art detail — subtle dithering for terrain variety
        if (terrain !== TERRAIN.DEEP_WATER && terrain !== TERRAIN.WATER) {
          const hash = ((x * 7 + y * 13) ^ (x * 3)) & 0xFF;
          if (hash < 40) {
            ctx.fillStyle = 'rgba(0,0,0,0.12)';
            ctx.fillRect(px, py, ts, ts);
          } else if (hash > 215) {
            ctx.fillStyle = 'rgba(255,255,255,0.08)';
            ctx.fillRect(px, py, ts, ts);
          }
        }

        // Water animation
        if (terrain === TERRAIN.DEEP_WATER || terrain === TERRAIN.WATER) {
          const wave = Math.sin((x + this.time * 0.05) * 0.5) * 0.5 + 0.5;
          if (wave > 0.7) {
            ctx.fillStyle = 'rgba(255,255,255,0.06)';
            ctx.fillRect(px, py, ts, ts);
          }
        }

        // Faith overlay
        if (owner >= 0 && this.religions[owner]) {
          const rel = this.religions[owner];
          const alpha = 0.2 + (faith / 255) * 0.55;
          ctx.fillStyle = rel.color;
          ctx.globalAlpha = alpha;
          ctx.fillRect(px, py, ts, ts);
          ctx.globalAlpha = 1;

          // Strong faith marker (small dot)
          if (faith > 180 && zoom >= 3) {
            ctx.fillStyle = rel.color;
            ctx.globalAlpha = 0.8;
            const dotSize = Math.max(1, ts * 0.3);
            ctx.fillRect(px + ts / 2 - dotSize / 2, py + ts / 2 - dotSize / 2, dotSize, dotSize);
            ctx.globalAlpha = 1;
          }
        }

        // Population indicator (at higher zoom)
        if (zoom >= 5 && pop > 0 && terrain > TERRAIN.WATER) {
          const popRatio = pop / (TERRAIN_POP_CAP[terrain] || 100);
          if (popRatio > 0.3) {
            ctx.fillStyle = 'rgba(255,255,200,0.3)';
            const dotSize = Math.max(1, ts * 0.2 * popRatio);
            ctx.fillRect(px + ts - dotSize - 1, py + 1, dotSize, dotSize);
          }
        }
      }
    }

    // Draw holy sites
    if (this.holySites) {
      for (const hs of this.holySites) {
        const px = hs.tile_x * ts;
        const py = hs.tile_y * ts;
        if (px < this.camX * ts || py < this.camY * ts) continue;

        const rel = this.religions.find(r => r.id === hs.religion_id);
        if (!rel) continue;

        // Glowing marker
        const pulse = Math.sin(this.time * 0.1) * 0.3 + 0.7;
        ctx.fillStyle = rel.color;
        ctx.globalAlpha = pulse;

        const size = hs.site_type === 'cathedral' ? ts * 1.5 : hs.site_type === 'temple' ? ts * 1.2 : ts;
        ctx.fillRect(px + (ts - size) / 2, py + (ts - size) / 2, size, size);

        // Cross/marker in center
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 0.9;
        const cs = Math.max(1, size * 0.3);
        ctx.fillRect(px + ts / 2 - cs / 2, py + ts / 2 - cs, cs, cs * 2);
        ctx.fillRect(px + ts / 2 - cs, py + ts / 2 - cs / 2, cs * 2, cs);

        ctx.globalAlpha = 1;
      }
    }

    // Hover highlight
    if (this.hoveredTile) {
      const hx = this.hoveredTile.x * ts;
      const hy = this.hoveredTile.y * ts;
      ctx.strokeStyle = this.selectedMiracle ? '#ff4444' : '#ffffff';
      ctx.lineWidth = 1 / zoom;
      ctx.strokeRect(hx, hy, ts, ts);

      // Miracle radius preview
      if (this.selectedMiracle) {
        const m = CONFIG.MIRACLES[this.selectedMiracle];
        if (m) {
          ctx.strokeStyle = 'rgba(255, 60, 60, 0.3)';
          ctx.lineWidth = 1 / zoom;
          ctx.beginPath();
          ctx.arc(hx + ts / 2, hy + ts / 2, m.radius * ts, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = 'rgba(255, 60, 60, 0.08)';
          ctx.fill();
        }
      }
    }

    ctx.restore();

    // ─── Render minimap ─────────────────────────────────────────
    this._renderMinimap();
  }

  _renderMinimap() {
    const mCtx = this.miniCtx;
    const mW = this.miniCanvas.width;
    const mH = this.miniCanvas.height;
    const w = this.world;

    // Only full redraw when dirty (expensive for 300x300)
    if (this.minimapDirty) {
      // Use ImageData for speed
      const imgData = mCtx.createImageData(mW, mH);
      const data = imgData.data;
      const scaleX = w.width / mW;
      const scaleY = w.height / mH;

      for (let py = 0; py < mH; py++) {
        for (let px = 0; px < mW; px++) {
          const wx = Math.floor(px * scaleX);
          const wy = Math.floor(py * scaleY);
          const idx = wy * w.width + wx;
          const terrain = w.tiles[idx];
          const owner = w.faithOwner[idx];

          let color;
          if (owner >= 0 && this.religions[owner]) {
            color = this._hexToRgb(this.religions[owner].color);
          } else {
            color = this._hexToRgb(TERRAIN_COLORS[terrain] || '#000000');
          }

          const pi = (py * mW + px) * 4;
          data[pi] = color.r;
          data[pi + 1] = color.g;
          data[pi + 2] = color.b;
          data[pi + 3] = 255;
        }
      }

      mCtx.putImageData(imgData, 0, 0);
      this.minimapDirty = false;
    }

    // Draw viewport rectangle
    const scaleX = mW / (w.width * this.tileSize);
    const scaleY = mH / (w.height * this.tileSize);
    const vx = this.camX * scaleX;
    const vy = this.camY * scaleY;
    const vw = (this.canvas.width / this.zoom) * scaleX;
    const vh = (this.canvas.height / this.zoom) * scaleY;

    mCtx.strokeStyle = '#fff';
    mCtx.lineWidth = 1;
    mCtx.strokeRect(vx, vy, vw, vh);
  }

  _hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    } : { r: 0, g: 0, b: 0 };
  }

  // Navigate camera to position
  goTo(x, y) {
    this.camX = x * this.tileSize - this.canvas.width / this.zoom / 2;
    this.camY = y * this.tileSize - this.canvas.height / this.zoom / 2;
    this._clampCamera();
    this.markDirty();
  }
}
