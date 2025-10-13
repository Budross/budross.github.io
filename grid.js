import { Tile } from './tile.js';
import { WorldGenerator } from './worldGenerator.js';

export class Grid {
  constructor(canvas, baseTileSize = 32) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.baseTileSize = baseTileSize;

    // Zoom properties
    this.zoomLevel = 1.0;
    this.minZoom = 0.1;
    this.maxZoom = 5.0;
    this.zoomStep = 0.1;

    // Viewport properties for panning
    this.viewportX = 0;
    this.viewportY = 0;

    // Mouse interaction state
    this.isDragging = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;

    // Paint dragging state
    this.isPaintDragging = false;
    this.lastPaintedTile = { x: null, y: null };
    this.paintDragStartPos = { x: null, y: null };

    // Tile selection state
    this.selectedTile = { x: null, y: null };
    this.highlightColor = '#ffff00';
    this.highlightAlpha = 0.6;
    this.selectionMode = false; // Toggle between pan and select modes

    // Tile painting state
    this.paintedTiles = new Map(); // Map<"x,y", Tile>
    this.farmlandTiles = new Map(); // Map<"x,y", {farmX, farmY}> - track which farm owns each farmland
    this.paintMode = false;
    this.currentBuildingType = 'house'; // Default building type
    this.buildingManager = null; // Will be set externally

    // Tooltip manager
    this.tooltipManager = null; // Will be set externally

    // World generation
    this.worldGenerator = new WorldGenerator();
    this.proceduralGeneration = true;
    this.generatedTiles = new Map(); // Cache for generated terrain
    this.lastVisibleRange = { startX: 0, startY: 0, endX: 0, endY: 0 };


    // Tile unloading configuration
    this.tileRetentionBuffer = 15; // Extra tiles beyond max zoom out area
    this.enableTileUnloading = true; // Feature toggle
    this.unloadingStats = {
      tilesUnloaded: 0,
      lastUnloadTime: 0,
      retentionRadius: 0,
      totalMemoryCleared: 0
    };

    // Bind event handlers
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleWheel = this.handleWheel.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleClick = this.handleClick.bind(this);

    // Add event listeners
    this.canvas.addEventListener('mousedown', this.handleMouseDown);
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('mouseup', this.handleMouseUp);
    this.canvas.addEventListener('mouseleave', this.handleMouseUp);
    this.canvas.addEventListener('wheel', this.handleWheel);
    this.canvas.addEventListener('click', this.handleClick);

    // Add global keyboard event listener for spacebar
    document.addEventListener('keydown', this.handleKeyDown);

    // Prevent right-click context menu
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // Get current tile size based on zoom level
  get tileSize() {
    return this.baseTileSize * this.zoomLevel;
  }

  // Convert screen coordinates to grid coordinates
  screenToGrid(screenX, screenY) {
    const gridX = Math.floor((screenX + this.viewportX) / this.tileSize);
    const gridY = Math.floor((screenY + this.viewportY) / this.tileSize);
    return { x: gridX, y: gridY };
  }

  // Convert grid coordinates to screen coordinates
  gridToScreen(gridX, gridY) {
    const screenX = (gridX * this.tileSize) - this.viewportX;
    const screenY = (gridY * this.tileSize) - this.viewportY;
    return { x: screenX, y: screenY };
  }


  // Handle mouse down event
  handleMouseDown(event) {
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    if (this.paintMode) {
      // Initialize paint dragging
      this.isPaintDragging = true;
      const gridPos = this.screenToGrid(mouseX, mouseY);

      // Paint the initial tile (now places buildings)
      this.paintTile(gridPos.x, gridPos.y, this.currentBuildingType);

      // Record starting position and last painted tile
      this.paintDragStartPos = { x: gridPos.x, y: gridPos.y };
      this.lastPaintedTile = { x: gridPos.x, y: gridPos.y };

      // Update cursor for paint dragging
      this.canvas.style.cursor = 'crosshair';
    } else if (!this.selectionMode) {
      // Normal pan dragging
      this.isDragging = true;
      this.lastMouseX = mouseX;
      this.lastMouseY = mouseY;
      this.canvas.style.cursor = 'grabbing';
    }
  }

  // Handle mouse move event
  handleMouseMove(event) {
    const rect = this.canvas.getBoundingClientRect();
    const currentMouseX = event.clientX - rect.left;
    const currentMouseY = event.clientY - rect.top;

    // Get mouse position relative to page for tooltips
    const pageX = event.clientX;
    const pageY = event.clientY;

    if (this.isPaintDragging) {
      // Building placement is now only on initial click (no continuous painting during drag)
      // This section is kept for future features but doesn't paint during drag
      // Hide tooltip during paint dragging
      if (this.tooltipManager) {
        this.tooltipManager.hide();
      }
    } else if (this.selectionMode) {
      // Update cursor for selection mode
      this.canvas.style.cursor = 'pointer';

      // Delegate hover event to tiles if they have custom handling
      const gridPos = this.screenToGrid(currentMouseX, currentMouseY);
      const existingTile = this.getPaintedTile(gridPos.x, gridPos.y);
      if (existingTile && typeof existingTile.onHover === 'function') {
        existingTile.onHover(event);
      }

      // Show tooltip for hovered tile
      if (this.tooltipManager) {
        const tile = this.getOrGenerateTile(gridPos.x, gridPos.y);
        if (tile) {
          this.tooltipManager.update(tile, pageX, pageY, this.buildingManager, this.zoomLevel);
        }
      }
    } else if (this.paintMode) {
      // Update cursor for paint mode (ready to paint)
      this.canvas.style.cursor = 'crosshair';

      // Delegate hover event to tiles if they have custom handling
      const gridPos = this.screenToGrid(currentMouseX, currentMouseY);
      const existingTile = this.getPaintedTile(gridPos.x, gridPos.y);
      if (existingTile && typeof existingTile.onHover === 'function') {
        existingTile.onHover(event);
      }

      // Show tooltip for hovered tile
      if (this.tooltipManager) {
        const tile = this.getOrGenerateTile(gridPos.x, gridPos.y);
        if (tile) {
          this.tooltipManager.update(tile, pageX, pageY, this.buildingManager, this.zoomLevel);
        }
      }
    } else if (this.isDragging) {
      // Calculate movement delta for pan dragging
      const deltaX = currentMouseX - this.lastMouseX;
      const deltaY = currentMouseY - this.lastMouseY;

      // Update viewport position (opposite direction for natural panning)
      this.viewportX -= deltaX;
      this.viewportY -= deltaY;

      // Update last mouse position
      this.lastMouseX = currentMouseX;
      this.lastMouseY = currentMouseY;

      // Re-render the grid
      this.render();

      // Hide tooltip during dragging
      if (this.tooltipManager) {
        this.tooltipManager.hide();
      }
    } else {
      // Pan mode (not dragging) - show tooltips
      const gridPos = this.screenToGrid(currentMouseX, currentMouseY);
      if (this.tooltipManager) {
        const tile = this.getOrGenerateTile(gridPos.x, gridPos.y);
        if (tile) {
          this.tooltipManager.update(tile, pageX, pageY, this.buildingManager, this.zoomLevel);
        }
      }
    }
  }

  // Handle mouse up event
  handleMouseUp(event) {
    // Reset paint dragging state
    if (this.isPaintDragging) {
      this.isPaintDragging = false;
      this.lastPaintedTile = { x: null, y: null };
      this.paintDragStartPos = { x: null, y: null };
    }

    // Trigger tile unloading after panning completes
    const wasDragging = this.isDragging;

    // Reset pan dragging state
    this.isDragging = false;

    // Restore appropriate cursor based on current mode
    if (this.selectionMode) {
      this.canvas.style.cursor = 'pointer';
    } else if (this.paintMode) {
      this.canvas.style.cursor = 'crosshair';
    } else {
      this.canvas.style.cursor = 'grab';
    }

    // Unload distant tiles after panning completes
    if (wasDragging && this.enableTileUnloading) {
      this.unloadDistantTiles();
    }

    // Hide tooltip when mouse leaves canvas (mouseleave also triggers this handler)
    if (event.type === 'mouseleave' && this.tooltipManager) {
      this.tooltipManager.hide();
    }
  }

  // Handle click event for tile selection and painting
  handleClick(event) {
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const gridPos = this.screenToGrid(mouseX, mouseY);

    if (this.selectionMode) {
      this.selectTile(gridPos.x, gridPos.y);
    } else if (this.paintMode) {
      // Note: Single-tile painting is now handled in mouseDown
      // This click handler mainly deals with tile event delegation

      // Get the tile at this position (may have been painted during drag)
      const tile = this.getPaintedTile(gridPos.x, gridPos.y);

      // Delegate click event to the tile object if it has custom handling
      if (tile && typeof tile.onClick === 'function') {
        tile.onClick(event);
      }
    }

    // For any existing tile at this position, also delegate the click
    const existingTile = this.getPaintedTile(gridPos.x, gridPos.y);
    if (existingTile && !this.paintMode && typeof existingTile.onClick === 'function') {
      existingTile.onClick(event);
    }
  }

  // Handle mouse wheel event for zooming
  handleWheel(event) {
    event.preventDefault();

    const rect = this.canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Convert mouse position to world coordinates before zoom
    const worldPosBeforeZoom = {
      x: (mouseX + this.viewportX) / this.tileSize,
      y: (mouseY + this.viewportY) / this.tileSize
    };

    // Calculate new zoom level
    const zoomDirection = event.deltaY > 0 ? -1 : 1;
    const newZoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom,
      this.zoomLevel + (zoomDirection * this.zoomStep)));

    // Only proceed if zoom level actually changed
    if (newZoomLevel !== this.zoomLevel) {
      this.zoomLevel = newZoomLevel;

      // Convert the same world position back to new screen coordinates
      const newTileSize = this.baseTileSize * this.zoomLevel;
      const worldPosAfterZoom = {
        x: worldPosBeforeZoom.x * newTileSize,
        y: worldPosBeforeZoom.y * newTileSize
      };

      // Adjust viewport to keep the mouse position fixed
      this.viewportX = worldPosAfterZoom.x - mouseX;
      this.viewportY = worldPosAfterZoom.y - mouseY;

      // Re-render the grid
      this.render();

      // Unload distant tiles after zooming
      if (this.enableTileUnloading) {
        this.unloadDistantTiles();
      }
    }
  }

  // Handle keyboard events
  handleKeyDown(event) {
    console.log('Keyboard event detected:', event.code, event.key);
    switch (event.code) {
      case 'Space':
        event.preventDefault();
        console.log('Spacebar detected! Calling moveViewportToOrigin...');
        try {
          this.moveViewportToOrigin();
          console.log('moveViewportToOrigin called successfully');
        } catch (error) {
          console.error('Error calling moveViewportToOrigin:', error);
        }
        break;
      case 'Digit1':
        event.preventDefault();
        this.setPanMode();
        break;
      case 'Digit2':
        event.preventDefault();
        this.toggleSelectionMode();
        break;
      case 'Digit3':
        event.preventDefault();
        this.togglePaintMode();
        break;
      default:
        console.log('Other key pressed:', event.code);
    }
  }

  // Calculate visible tile range for efficient rendering (infinite grid)
  getVisibleTileRange() {
    const startX = Math.floor(this.viewportX / this.tileSize);
    const startY = Math.floor(this.viewportY / this.tileSize);
    const endX = Math.ceil((this.viewportX + this.canvas.width) / this.tileSize);
    const endY = Math.ceil((this.viewportY + this.canvas.height) / this.tileSize);

    return { startX, startY, endX, endY };
  }

  // Calculate tile retention radius based on maximum zoom out + buffer
  calculateRetentionRadius() {
    // Calculate how many tiles would be visible at maximum zoom out (0.1x)
    const maxZoomOutTileSize = this.baseTileSize * this.minZoom; // 0.1x zoom
    const tilesWideAtMaxZoom = Math.ceil(this.canvas.width / maxZoomOutTileSize);
    const tilesHighAtMaxZoom = Math.ceil(this.canvas.height / maxZoomOutTileSize);

    // Use the larger dimension and add buffer
    const maxVisibleDimension = Math.max(tilesWideAtMaxZoom, tilesHighAtMaxZoom);
    const retentionRadius = Math.floor(maxVisibleDimension / 2) + this.tileRetentionBuffer;

    // Add some bounds checking - ensure reasonable limits
    const minRadius = 20; // At least 20 tiles
    const maxRadius = 80; // No more than 80 tiles to prevent excessive memory
    const boundedRadius = Math.max(minRadius, Math.min(maxRadius, retentionRadius));

    // Update stats for monitoring
    this.unloadingStats.retentionRadius = boundedRadius;

    console.log(`💾 Retention radius: ${boundedRadius} tiles (canvas: ${this.canvas.width}x${this.canvas.height}, max zoom tiles: ${maxVisibleDimension})`);
    return boundedRadius;
  }

  // Render the grid
  render() {
    // Clear the canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Set grid line style
    this.ctx.strokeStyle = '#ddd';
    this.ctx.lineWidth = 1;

    // Get visible tile range
    const { startX, startY, endX, endY } = this.getVisibleTileRange();

    // Draw painted tiles first (behind grid lines)
    this.drawPaintedTiles(startX, startY, endX, endY);

    // Draw vertical lines
    for (let x = startX; x <= endX + 1; x++) {
      const screenX = (x * this.tileSize) - this.viewportX;
      if (screenX >= -1 && screenX <= this.canvas.width + 1) {
        this.ctx.beginPath();
        this.ctx.moveTo(screenX, 0);
        this.ctx.lineTo(screenX, this.canvas.height);
        this.ctx.stroke();
      }
    }

    // Draw horizontal lines
    for (let y = startY; y <= endY + 1; y++) {
      const screenY = (y * this.tileSize) - this.viewportY;
      if (screenY >= -1 && screenY <= this.canvas.height + 1) {
        this.ctx.beginPath();
        this.ctx.moveTo(0, screenY);
        this.ctx.lineTo(this.canvas.width, screenY);
        this.ctx.stroke();
      }
    }

    // Draw tile coordinates for reference (adaptive interval based on zoom)
    this.ctx.fillStyle = '#999';

    // Adjust coordinate interval and font size based on zoom level
    let interval = 10;
    let fontSize = 12;

    if (this.zoomLevel < 0.5) {
      interval = 50;
      fontSize = 10;
    } else if (this.zoomLevel < 1.0) {
      interval = 20;
      fontSize = 11;
    } else if (this.zoomLevel > 2.0) {
      interval = 5;
      fontSize = 14;
    }

    // Don't show coordinates if tiles are too small
    if (this.tileSize < 15) {
      return;
    }

    this.ctx.font = `${fontSize}px Arial`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    // Calculate the starting points to align with interval
    const startLabelX = Math.floor(startX / interval) * interval;
    const startLabelY = Math.floor(startY / interval) * interval;

    for (let x = startLabelX; x <= endX; x += interval) {
      for (let y = startLabelY; y <= endY; y += interval) {
        const screenPos = this.gridToScreen(x, y);
        const centerX = screenPos.x + this.tileSize / 2;
        const centerY = screenPos.y + this.tileSize / 2;

        if (centerX >= 0 && centerX <= this.canvas.width &&
            centerY >= 0 && centerY <= this.canvas.height) {
          this.ctx.fillText(`${x},${y}`, centerX, centerY);
        }
      }
    }

    // Draw selected tile highlight (on top of everything)
    this.drawSelectedTile();
  }

  // Generate terrain tile if not exists
  getOrGenerateTile(x, y) {
    const tileKey = `${x},${y}`;

    // First check painted tiles (they override generated terrain)
    if (this.paintedTiles.has(tileKey)) {
      return this.paintedTiles.get(tileKey);
    }

    // Check if we already have this tile cached
    let tile = this.generatedTiles.get(tileKey);

    if (!tile) {
      // Generate new terrain tile if procedural generation is enabled
      if (this.proceduralGeneration) {
        const terrainData = this.worldGenerator.generateTerrain(x, y);
        tile = Tile.createTerrain(x, y, terrainData);
        this.generatedTiles.set(tileKey, tile);
      } else {
        return null;
      }
    }

    return tile;
  }

  // Draw all tiles (both painted and generated) within the visible range
  drawPaintedTiles(startX, startY, endX, endY) {
    // Generate terrain for visible area if needed
    if (this.proceduralGeneration) {
      //this.generateVisibleTerrain(startX, startY, endX, endY);
    }

    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        const tile = this.getOrGenerateTile(x, y);

        if (tile && tile.isVisible()) {
          const screenPos = this.gridToScreen(x, y);

          // Only draw if the tile is visible on screen
          if (screenPos.x + this.tileSize >= 0 && screenPos.x <= this.canvas.width &&
              screenPos.y + this.tileSize >= 0 && screenPos.y <= this.canvas.height) {

            // Use tile's render method for self-controlled appearance
            tile.render(this.ctx, screenPos.x, screenPos.y, this.tileSize);
          }
        }
      }
    }
  }

  // Unload tiles that are far from the current viewport
  unloadDistantTiles() {
    console.log(`🗑️ unloadDistantTiles CALLED, generatedTiles.size: ${this.generatedTiles.size}`);
    console.trace('Call stack:');

    if (!this.enableTileUnloading || this.generatedTiles.size === 0) {
      console.log(`🗑️ Unloading skipped (enabled: ${this.enableTileUnloading}, size: ${this.generatedTiles.size})`);
      return;
    }

    const startTime = performance.now();
    const retentionRadius = this.calculateRetentionRadius();

    // Calculate viewport center in tile coordinates
    const centerX = Math.floor((this.viewportX + this.canvas.width / 2) / this.tileSize);
    const centerY = Math.floor((this.viewportY + this.canvas.height / 2) / this.tileSize);

    const tilesToUnload = [];
    let tilesChecked = 0;
    const totalTiles = this.generatedTiles.size;
    let terrainCacheCleared = 0;

    // Process all tiles for unloading (no limits to ensure proper cleanup)
    for (const [tileKey, tile] of this.generatedTiles) {
      const tileX = tile.x;
      const tileY = tile.y;

      // Calculate Euclidean distance from viewport center (circular retention area)
      const dx = tileX - centerX;
      const dy = tileY - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Check if tile is beyond retention radius
      if (distance > retentionRadius) {
        // Never unload painted tiles (user-created content)
        const paintedTileKey = `${tileX},${tileY}`;
        if (!this.paintedTiles.has(paintedTileKey)) {
          tilesToUnload.push(tileKey);
        }
      }

      tilesChecked++;
    }

    // Unload the distant tiles
    for (const tileKey of tilesToUnload) {
      this.generatedTiles.delete(tileKey);
      this.unloadingStats.tilesUnloaded++;
    }

    // Clean distant entries from WorldGenerator cache using new distance-based method
    terrainCacheCleared = this.worldGenerator.cleanDistantCacheEntries(
      centerX, centerY, retentionRadius
    );

    // Update stats
    this.unloadingStats.lastUnloadTime = performance.now() - startTime;
    this.unloadingStats.totalMemoryCleared += tilesToUnload.length + terrainCacheCleared;

    // Log unloading activity
    if (tilesToUnload.length > 0) {
      console.log(`🗑️ Unloaded ${tilesToUnload.length} tiles + ${terrainCacheCleared} cache entries beyond ${retentionRadius} tile radius (${this.generatedTiles.size} tiles remain, ${this.worldGenerator.terrainCache.size} cached)`);
    }
  }


  // Generate terrain for visible area efficiently
  generateVisibleTerrain(startX, startY, endX, endY, force = false) {
    // Check if we need to generate new area (skip check if forced)
    const needsGeneration = force || (
      startX < this.lastVisibleRange.startX ||
      startY < this.lastVisibleRange.startY ||
      endX > this.lastVisibleRange.endX ||
      endY > this.lastVisibleRange.endY
    );

    if (needsGeneration) {
      // Add buffer around visible area for smoother scrolling
      const buffer = 5;
      const genStartX = startX - buffer;
      const genStartY = startY - buffer;
      const genEndX = endX + buffer;
      const genEndY = endY + buffer;

      // Generate tiles in visible area + buffer
      for (let x = genStartX; x <= genEndX; x++) {
        for (let y = genStartY; y <= genEndY; y++) {
          this.getOrGenerateTile(x, y); // This will generate if not cached
        }
      }

      // Update last visible range
      this.lastVisibleRange = { startX: genStartX, startY: genStartY, endX: genEndX, endY: genEndY };
    }

    // Note: Tile unloading is now handled in pan/zoom handlers only
    // to prevent unloading during building placement or normal rendering
  }

  // Draw the selected tile highlight
  drawSelectedTile() {
    if (this.selectedTile.x !== null && this.selectedTile.y !== null) {
      const screenPos = this.gridToScreen(this.selectedTile.x, this.selectedTile.y);

      // Only draw if the tile is visible on screen
      if (screenPos.x + this.tileSize >= 0 && screenPos.x <= this.canvas.width &&
          screenPos.y + this.tileSize >= 0 && screenPos.y <= this.canvas.height) {
        console.log(this.ctx.globalAlpha);
        console.log(this.ctx.fillStyle);
        this.ctx.save();
        this.ctx.globalAlpha = this.highlightAlpha;
        this.ctx.fillStyle = this.highlightColor;
        this.ctx.fillRect(screenPos.x, screenPos.y, this.tileSize, this.tileSize);

        // Add a border around the selected tile
        this.ctx.globalAlpha = 1.0;
        this.ctx.strokeStyle = this.highlightColor;
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(screenPos.x, screenPos.y, this.tileSize, this.tileSize);
        this.ctx.strokeStyle = '#999999'; // Reset to grid line color 
        this.ctx.lineWidth = 1; // Reset to default line width  
        this.ctx.restore();
      }
    }
  }

  // Get current viewport info
  getViewportInfo() {
    return {
      x: this.viewportX,
      y: this.viewportY,
      tileSize: this.tileSize,
      zoomLevel: this.zoomLevel,
      baseTileSize: this.baseTileSize,
      visibleTiles: this.getVisibleTileRange()
    };
  }

  // Set viewport position
  setViewport(x, y) {
    this.viewportX = x;
    this.viewportY = y;
    this.render();
  }

  moveViewportToOrigin() {
    console.log('moveViewportToOrigin called');
    // Calculate viewport position to center the origin tile (0,0) on the canvas
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;

    // Offset viewport so that tile (0,0) is centered
    const viewportX = -centerX + (this.tileSize / 2);
    const viewportY = -centerY + (this.tileSize / 2);

    console.log(`Moving viewport from (${this.viewportX}, ${this.viewportY}) to (${viewportX}, ${viewportY})`);
    this.setViewport(viewportX, viewportY);
  }

  // Tile selection methods
  selectTile(gridX, gridY) {
    console.log(`selectTile called with (${gridX}, ${gridY}), currently selected: (${this.selectedTile.x}, ${this.selectedTile.y})`);

    // Check if clicking on the already selected tile
    if (this.selectedTile.x === gridX && this.selectedTile.y === gridY) {
      // Deselect the tile
      console.log('Deselecting tile');
      this.clearSelection();
      return null;
    }

    // Clear previous selection state from painted tiles
    this.paintedTiles.forEach(tile => {
      if (tile.selected) {
        tile.deselect();
      }
    });

    // Also clear selection state from generated terrain tiles
    this.generatedTiles.forEach(tile => {
      if (tile.selected) {
        tile.deselect();
      }
    });

    // Update grid selection tracking
    this.selectedTile = { x: gridX, y: gridY };

    // If there's a painted tile at this position, mark it as selected
    const tile = this.getPaintedTile(gridX, gridY);
    if (tile) {
      tile.select();
    }

    this.render();
    return { x: gridX, y: gridY, tile };
  }

  clearSelection() {
    // Clear selection state from painted tiles
    this.paintedTiles.forEach(tile => {
      if (tile.selected) {
        tile.deselect();
      }
    });

    // Also clear selection state from generated terrain tiles
    this.generatedTiles.forEach(tile => {
      if (tile.selected) {
        tile.deselect();
      }
    });

    this.selectedTile = { x: null, y: null };
    this.render();
  }

  getSelectedTile() {
    if (this.selectedTile.x !== null && this.selectedTile.y !== null) {
      const tile = this.getPaintedTile(this.selectedTile.x, this.selectedTile.y);
      return {
        x: this.selectedTile.x,
        y: this.selectedTile.y,
        tile: tile
      };
    }
    return null;
  }

  setHighlightColor(color) {
    this.highlightColor = color;
    this.render();
  }

  setHighlightAlpha(alpha) {
    this.highlightAlpha = Math.max(0, Math.min(1, alpha));
    this.render();
  }

  // Mode switching methods
  setPanMode() {
    this.selectionMode = false;
    this.paintMode = false;
    this.canvas.style.cursor = 'grab';
    console.log(`Pan mode activated (Press '1' for pan, '2' for selection, '3' for paint)`);
  }

  toggleSelectionMode() {
    this.selectionMode = !this.selectionMode;
    // Turn off paint mode if selection mode is enabled
    if (this.selectionMode) {
      this.paintMode = false;
    }

    // Set appropriate cursor
    if (this.selectionMode) {
      this.canvas.style.cursor = 'pointer';
    } else if (this.paintMode) {
      this.canvas.style.cursor = 'crosshair';
    } else {
      this.canvas.style.cursor = 'grab';
    }

    console.log(`Selection mode: ${this.selectionMode ? 'ON' : 'OFF'} (Press '2' to toggle)`);
  }

  // Paint mode methods
  togglePaintMode() {
    this.paintMode = !this.paintMode;
    // Turn off selection mode if paint mode is enabled
    if (this.paintMode) {
      this.selectionMode = false;
    }

    // Set appropriate cursor
    if (this.selectionMode) {
      this.canvas.style.cursor = 'pointer';
    } else if (this.paintMode) {
      this.canvas.style.cursor = 'crosshair';
    } else {
      this.canvas.style.cursor = 'grab';
    }

    console.log(`Paint mode: ${this.paintMode ? 'ON' : 'OFF'} (Press '3' to toggle) - Click and drag to paint multiple tiles`);
  }


  paintTile(gridX, gridY, buildingType = this.currentBuildingType) {
    const tileKey = `${gridX},${gridY}`;
    console.log(`🏗️ paintTile called at (${gridX}, ${gridY}), generatedTiles.size BEFORE: ${this.generatedTiles.size}`);

    // Get existing tile or get/generate terrain tile
    let tile = this.paintedTiles.get(tileKey);
    if (!tile) {
      // Check if there's a generated terrain tile at this location
      tile = this.getOrGenerateTile(gridX, gridY);
    }

    // Place building using BuildingManager with terrain validation
    if (this.buildingManager) {
      const result = this.buildingManager.placeBuilding(gridX, gridY, buildingType, tile);

      if (!result.success) {
        // Building placement failed - show warning
        console.warn(`❌ ${result.error}`);
        return {
          x: gridX,
          y: gridY,
          success: false,
          error: result.error
        };
      }

      const building = result.building;

      if (this.paintedTiles.has(tileKey)) {
        // Update existing painted tile with building
        const paintedTile = this.paintedTiles.get(tileKey);

        // Important: The old building was already removed by BuildingManager.placeBuilding()
        // at line 797, so we just need to update the tile's visual representation
        paintedTile.onPaint(building);
      } else {
        // Create new painted tile with building, preserving terrain data
        const newTile = new Tile(gridX, gridY, {
          building: building,
          visible: true,
          selected: false,
          highlighted: false,
          locked: false,
          isPainted: true,
          terrainType: tile?.terrainType,
          elevation: tile?.elevation,
          temperature: tile?.temperature,
          moisture: tile?.moisture,
          detail: tile?.detail,
          isGenerated: tile?.isGenerated
        });
        this.paintedTiles.set(tileKey, newTile);
      }

      // If this is a farm building, place farmland tiles around it
      if (buildingType === 'farm' && building.farmlandTiles) {
        console.log(`🌾 Placing farmland for farm at (${gridX}, ${gridY})`);
        this.placeFarmlandTiles(gridX, gridY, building.farmlandTiles);
      }

      console.log(`🏗️ paintTile AFTER placing building, generatedTiles.size: ${this.generatedTiles.size}`);
      this.render();
      console.log(`🏗️ paintTile AFTER render(), generatedTiles.size: ${this.generatedTiles.size}`);
      return {
        x: gridX,
        y: gridY,
        buildingType,
        building,
        success: true
      };
    } else {
      console.warn('BuildingManager not set on Grid');
      return { success: false, error: 'BuildingManager not set' };
    }
  }

  // Place farmland tiles around a farm building
  placeFarmlandTiles(farmX, farmY, farmlandPositions) {
    for (const pos of farmlandPositions) {
      const farmlandKey = `${pos.x},${pos.y}`;

      // Skip if this position already has a building
      if (this.buildingManager.getBuilding(pos.x, pos.y)) {
        continue;
      }

      // Generate random rotation for visual variety (0, 90, 180, or 270 degrees)
      const rotations = [0, 90, 180, 270];
      const randomRotation = rotations[Math.floor(Math.random() * rotations.length)];

      // Get or create the tile at this position
      let farmlandTile = this.paintedTiles.get(farmlandKey);
      const terrainTile = this.getOrGenerateTile(pos.x, pos.y);

      if (!farmlandTile) {
        // Create new farmland tile with random rotation
        farmlandTile = new Tile(pos.x, pos.y, {
          visible: true,
          isPainted: true,
          terrainType: terrainTile?.terrainType,
          elevation: terrainTile?.elevation,
          temperature: terrainTile?.temperature,
          moisture: terrainTile?.moisture,
          detail: terrainTile?.detail,
          isGenerated: terrainTile?.isGenerated,
          farmland: true, // Mark as farmland overlay
          rotation: randomRotation // Add random rotation for visual variety
        });
        this.paintedTiles.set(farmlandKey, farmlandTile);
      } else {
        // Add farmland overlay to existing tile with random rotation
        farmlandTile.farmland = true;
        farmlandTile.rotation = randomRotation;
      }

      // Track which farm this farmland belongs to
      this.farmlandTiles.set(farmlandKey, { farmX, farmY });
    }
  }

  // Remove farmland tiles associated with a farm
  removeFarmlandTiles(farmX, farmY) {
    const toRemove = [];

    // Find all farmland tiles belonging to this farm
    for (const [key, owner] of this.farmlandTiles.entries()) {
      if (owner.farmX === farmX && owner.farmY === farmY) {
        toRemove.push(key);
      }
    }

    // Remove farmland tiles
    for (const key of toRemove) {
      this.farmlandTiles.delete(key);

      // Get the tile and remove farmland overlay
      const tile = this.paintedTiles.get(key);
      if (tile) {
        tile.farmland = false;
        // If tile has no building and no other overlays, remove it
        if (!tile.building && !tile.farmland) {
          this.paintedTiles.delete(key);
        }
      }
    }

    console.log(`🗑️ Removed ${toRemove.length} farmland tiles for farm at (${farmX}, ${farmY})`);
  }

  clearTile(gridX, gridY) {
    const tileKey = `${gridX},${gridY}`;
    const tile = this.paintedTiles.get(tileKey);

    // Remove building if it exists
    if (tile && tile.building && this.buildingManager) {
      // If it's a farm, remove associated farmland first
      if (tile.building.type === 'farm') {
        this.removeFarmlandTiles(gridX, gridY);
      }

      this.buildingManager.removeBuilding(gridX, gridY);
    }

    const wasDeleted = this.paintedTiles.delete(tileKey);
    if (wasDeleted) {
      this.render();
    }
    return wasDeleted;
  }

  clearAllPaint() {
    // Clear all buildings first
    if (this.buildingManager) {
      this.buildingManager.clearAll();
    }

    this.paintedTiles.clear();
    this.farmlandTiles.clear();
    this.render();
  }

  setBuildingType(buildingType) {
    this.currentBuildingType = buildingType;
    console.log(`Building type set to: ${buildingType}`);
  }

  // Set building manager reference
  setBuildingManager(buildingManager) {
    this.buildingManager = buildingManager;
  }

  // Set tooltip manager for displaying tile information
  setTooltipManager(tooltipManager) {
    this.tooltipManager = tooltipManager;
  }

  // Sync buildings from BuildingManager to visual tiles (for loading saved games)
  syncBuildingsToTiles() {
    if (!this.buildingManager) {
      console.warn('BuildingManager not set, cannot sync buildings');
      return;
    }

    console.log('🔄 Syncing buildings to visual tiles...');
    let syncedCount = 0;

    // Iterate through all buildings in the BuildingManager
    for (const [key, building] of this.buildingManager.buildings.entries()) {
      const { x, y } = building;
      const tileKey = `${x},${y}`;

      // Check if painted tile already exists
      if (this.paintedTiles.has(tileKey)) {
        // Update existing tile with building reference
        const existingTile = this.paintedTiles.get(tileKey);
        existingTile.building = building;
        syncedCount++;
      } else {
        // Get or generate terrain tile at this position
        const terrainTile = this.getOrGenerateTile(x, y);

        // Create new painted tile with building
        const newTile = new Tile(x, y, {
          building: building,
          visible: true,
          selected: false,
          highlighted: false,
          locked: false,
          isPainted: true,
          terrainType: terrainTile?.terrainType,
          elevation: terrainTile?.elevation,
          temperature: terrainTile?.temperature,
          moisture: terrainTile?.moisture,
          detail: terrainTile?.detail,
          isGenerated: terrainTile?.isGenerated
        });

        this.paintedTiles.set(tileKey, newTile);
        syncedCount++;
      }

      // If this is a farm, sync farmland tiles
      if (building.type === 'farm' && building.farmlandTiles && building.farmlandTiles.length > 0) {
        console.log(`🌾 Syncing farmland for farm at (${x}, ${y})`);
        this.placeFarmlandTiles(x, y, building.farmlandTiles);
      }
    }

    console.log(`✅ Synced ${syncedCount} buildings to visual tiles`);

    // Render the grid to display all synced buildings
    this.render();
  }

  getPaintedTileColor(gridX, gridY) {
    const tileKey = `${gridX},${gridY}`;
    const tile = this.paintedTiles.get(tileKey);
    return tile ? tile.color : null;
  }

  // New method to get the full tile object (checks both painted and generated)
  getPaintedTile(gridX, gridY) {
    return this.getOrGenerateTile(gridX, gridY);
  }

  // Get only manually painted tiles (original behavior)
  getOnlyPaintedTile(gridX, gridY) {
    const tileKey = `${gridX},${gridY}`;
    return this.paintedTiles.get(tileKey) || null;
  }

  getPaintedTilesCount() {
    return this.paintedTiles.size;
  }

  // Debug and testing methods
  exportTileData() {
    const tilesData = {};
    this.paintedTiles.forEach((tile, key) => {
      tilesData[key] = tile.toJSON();
    });
    return tilesData;
  }

  importTileData(tilesData) {
    this.clearAllPaint();
    Object.entries(tilesData).forEach(([key, tileData]) => {
      const tile = Tile.fromJSON(tileData);
      this.paintedTiles.set(key, tile);
    });
    this.render();
  }

  // Verify tile system is working correctly
  validateTileSystem() {
    console.log('=== Tile System Validation ===');
    console.log(`Total painted tiles: ${this.paintedTiles.size}`);

    let visibleCount = 0;
    let selectedCount = 0;
    let highlightedCount = 0;
    let lockedCount = 0;

    this.paintedTiles.forEach(tile => {
      if (tile.isVisible()) visibleCount++;
      if (tile.isSelected()) selectedCount++;
      if (tile.isHighlighted()) highlightedCount++;
      if (tile.isLocked()) lockedCount++;
    });

    console.log(`Visible tiles: ${visibleCount}`);
    console.log(`Selected tiles: ${selectedCount}`);
    console.log(`Highlighted tiles: ${highlightedCount}`);
    console.log(`Locked tiles: ${lockedCount}`);

    // Test backward compatibility
    const testTile = this.getPaintedTile(0, 0);
    if (testTile) {
      const color = this.getPaintedTileColor(0, 0);
      console.log(`Backward compatibility test - tile color: ${color}, tile.color: ${testTile.color}`);
      console.log(`Colors match: ${color === testTile.color}`);
    }

    console.log('=== Validation Complete ===');
  }

  // Get current drag state information
  getDragState() {
    return {
      isPanDragging: this.isDragging,
      isPaintDragging: this.isPaintDragging,
      currentMode: this.paintMode ? 'paint' : this.selectionMode ? 'selection' : 'pan',
      lastPaintedTile: { ...this.lastPaintedTile },
      paintDragStartPos: { ...this.paintDragStartPos }
    };
  }

  // World generation control methods
  enableProceduralGeneration() {
    this.proceduralGeneration = true;
    this.render();
  }

  disableProceduralGeneration() {
    this.proceduralGeneration = false;
    this.render();
  }

  setWorldSeed(seed) {
    // Skip if seed is unchanged - no need to regenerate
    if (this.worldGenerator.seed === seed) {
      console.log('🌍 Seed unchanged, skipping regeneration');
      return;
    }

    this.worldGenerator.updateParameters({ seed });
    this.generatedTiles.clear();
    this.lastVisibleRange = { startX: 0, startY: 0, endX: 0, endY: 0 };

    // Force regeneration of currently visible area
    const { startX, startY, endX, endY } = this.getVisibleTileRange();
    this.generateVisibleTerrain(startX, startY, endX, endY, true); // Force regeneration

    this.render();
  }

  updateWorldParameters(params) {
    this.worldGenerator.updateParameters(params);
    this.generatedTiles.clear();
    this.lastVisibleRange = { startX: 0, startY: 0, endX: 0, endY: 0 };

    // Force regeneration of currently visible area
    const { startX, startY, endX, endY } = this.getVisibleTileRange();
    this.generateVisibleTerrain(startX, startY, endX, endY, true); // Force regeneration

    this.render();
  }

  getWorldStats() {
    return {
      ...this.worldGenerator.getStats(),
      proceduralGeneration: this.proceduralGeneration,
      generatedTilesCount: this.generatedTiles.size,
      paintedTilesCount: this.paintedTiles.size,
      tileUnloading: {
        enabled: this.enableTileUnloading,
        retentionRadius: this.unloadingStats.retentionRadius,
        tilesUnloaded: this.unloadingStats.tilesUnloaded,
        totalMemoryCleared: this.unloadingStats.totalMemoryCleared,
        lastUnloadTime: this.unloadingStats.lastUnloadTime
      }
    };
  }

  clearGeneratedTerrain() {
    this.generatedTiles.clear();
    this.worldGenerator.clearCache();
    this.lastVisibleRange = { startX: 0, startY: 0, endX: 0, endY: 0 };
    this.render();
  }

  // Enhanced tile count method
  getTotalTilesCount() {
    return {
      painted: this.paintedTiles.size,
      generated: this.generatedTiles.size,
      total: this.paintedTiles.size + this.generatedTiles.size
    };
  }

  // Cleanup method to remove event listeners
  destroy() {
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('mouseup', this.handleMouseUp);
    this.canvas.removeEventListener('mouseleave', this.handleMouseUp);
    this.canvas.removeEventListener('wheel', this.handleWheel);
    this.canvas.removeEventListener('click', this.handleClick);
    document.removeEventListener('keydown', this.handleKeyDown);

    // Clear generation caches
    this.generatedTiles.clear();
    this.worldGenerator.clearCache();
  }
}