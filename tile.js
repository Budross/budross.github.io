import { atlasManager } from './atlasManager.js';

// Simple Tile class for grid attributes
export class Tile {
  constructor(x, y, props = {}) {
    this.x = x;
    this.y = y;
    this.color = props.color || null;
    this.data = props.data || {}; // Store any custom data

    // State management properties
    this.selected = props.selected || false;
    this.highlighted = props.highlighted || false;
    this.visible = props.visible !== false; // Default to true
    this.locked = props.locked || false;

    // Terrain and world generation properties
    this.terrainType = props.terrainType || null;
    this.elevation = props.elevation || 0;
    this.temperature = props.temperature || 0.5;
    this.moisture = props.moisture || 0.5;
    this.riverValue = props.riverValue || 1;
    this.detail = props.detail || 0;
    this.isGenerated = props.isGenerated || false;
    this.isPainted = props.isPainted || false; // Track if manually painted
    this.isRiver = props.isRiver || false; // Track if tile is a river

    // Building property
    this.building = props.building || null; // Reference to building instance
    this.farmland = props.farmland || false; // Farmland overlay flag
    this.rotation = props.rotation !== undefined ? props.rotation : 0; // Rotation in degrees (0, 90, 180, 270)

    // Metadata
    this.createdAt = new Date();
    this.lastModified = new Date();
  }

  // Factory method
  static create(x, y, props = {}) {
    return new Tile(x, y, props);
  }

  // Update properties
  set(key, value) {
    if (key === 'color') {
      this.color = value;
    } else {
      this.data[key] = value;
    }
    this.lastModified = new Date();
  }

  // Get a property
  get(key) {
    return key === 'color' ? this.color : this.data[key];
  }

  // State management methods
  select() {
    this.selected = true;
    this.lastModified = new Date();
    return this;
  }

  deselect() {
    this.selected = false;
    this.lastModified = new Date();
    return this;
  }

  highlight() {
    this.highlighted = true;
    return this;
  }

  unhighlight() {
    this.highlighted = false;
    return this;
  }

  show() {
    this.visible = true;
    return this;
  }

  hide() {
    this.visible = false;
    return this;
  }

  lock() {
    this.locked = true;
    return this;
  }

  unlock() {
    this.locked = false;
    return this;
  }

  // State query methods
  isSelected() {
    return this.selected;
  }

  isHighlighted() {
    return this.highlighted;
  }

  isVisible() {
    return this.visible;
  }

  isLocked() {
    return this.locked;
  }

  // Rendering methods (Phase 3)
  render(ctx, screenX, screenY, tileSize) {
    // Only render if tile is visible
    if (!this.visible) {
      return;
    }

    // If tile has a building, try to render building sprite first
    if (this.building) {
      // For farm buildings, render as barn
      const spriteType = this.building.type === 'farm' ? 'barn' : this.building.type;
      const buildingRendered = atlasManager.renderBuilding(
        ctx, spriteType, screenX, screenY, tileSize
      );

      // Fallback to building color if sprite not available
      if (!buildingRendered) {
        ctx.fillStyle = this.building.getDisplayColor();
        ctx.fillRect(screenX, screenY, tileSize, tileSize);
      }
    } else if (this.farmland) {
      // Render terrain first, then farmland overlay
      let atlasRendered = false;
      if (this.terrainType && atlasManager.isLoaded) {
        atlasRendered = atlasManager.renderTile(
          ctx, this.x, this.y, screenX, screenY, tileSize, this.terrainType
        );
      }

      // Fallback to color rendering if atlas fails or not available
      if (!atlasRendered && this.color) {
        ctx.fillStyle = this.color;
        ctx.fillRect(screenX, screenY, tileSize, tileSize);
      }

      // Render farmland overlay on top with rotation
      atlasManager.renderBuilding(ctx, 'farmland', screenX, screenY, tileSize, this.rotation);
    } else {
      // Try to render with atlas texture first
      let atlasRendered = false;
      if (this.terrainType && atlasManager.isLoaded) {
        atlasRendered = atlasManager.renderTile(
          ctx, this.x, this.y, screenX, screenY, tileSize, this.terrainType
        );
      }

      // Fallback to color rendering if atlas fails or not available
      if (!atlasRendered && this.color) {
        ctx.fillStyle = this.color;
        ctx.fillRect(screenX, screenY, tileSize, tileSize);
      }
    }

    // Add visual effects for tile states
    this.renderStateEffects(ctx, screenX, screenY, tileSize);
  }

  // Render additional visual effects based on tile state
  renderStateEffects(ctx, screenX, screenY, tileSize) {
    // Highlighted state - subtle overlay
    if (this.highlighted) {
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(screenX, screenY, tileSize, tileSize);
      ctx.restore();
    }

    // Selected state - border outline
    if (this.selected) {
      ctx.save();
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 2;
      ctx.strokeRect(screenX, screenY, tileSize, tileSize);
      ctx.restore();
    }

    // Locked state - diagonal stripes pattern
    if (this.locked) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(screenX, screenY + tileSize);
      ctx.lineTo(screenX + tileSize, screenY);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Animation placeholders (Phase 3)
  animate(animationType, duration = 1000) {
    // Placeholder for future animation system
    console.log(`Animating tile at (${this.x}, ${this.y}) with ${animationType}`);
  }

  transition(toState, duration = 500) {
    // Placeholder for future state transition animations
    console.log(`Transitioning tile at (${this.x}, ${this.y}) to state: ${toState}`);
  }

  // Event handling placeholders (Phase 2)
  onClick(event) {
    // Placeholder for click handling
  }

  onHover(event) {
    // Placeholder for hover handling
  }

  onPaint(colorOrBuilding) {
    // Handle both legacy color painting and new building placement
    if (typeof colorOrBuilding === 'string') {
      // Legacy color painting
      this.color = colorOrBuilding;
      this.isPainted = true;
      this.building = null; // Clear building if painting color
    } else if (colorOrBuilding && typeof colorOrBuilding === 'object') {
      // Building placement
      this.building = colorOrBuilding;
      this.isPainted = true;
      this.color = null; // Clear color if placing building
    }
    this.lastModified = new Date();
  }

  // Terrain-specific methods
  setTerrainData(terrainData) {
    this.terrainType = terrainData.terrainType;
    this.elevation = terrainData.elevation;
    this.temperature = terrainData.temperature;
    this.moisture = terrainData.moisture;
    this.riverValue = terrainData.riverValue;
    this.detail = terrainData.detail;
    this.isGenerated = true;

    // Set color from terrain if not manually painted
    if (!this.isPainted) {
      this.color = terrainData.color;
    }

    this.lastModified = new Date();
    return this;
  }

  getTerrainInfo() {
    return {
      terrainType: this.terrainType,
      elevation: this.elevation,
      temperature: this.temperature,
      moisture: this.moisture,
      riverValue: this.riverValue,
      detail: this.detail,
      isGenerated: this.isGenerated,
      isPainted: this.isPainted
    };
  }

  isWaterTile() {
    return this.terrainType && (
      this.terrainType.id === 'water' ||
      this.terrainType.id === 'deep_water'
    );
  }

  isMountainTile() {
    return this.terrainType && (
      this.terrainType.id === 'mountains' ||
      this.terrainType.id === 'hills'
    );
  }

  isForestTile() {
    return this.terrainType && this.terrainType.id === 'forest';
  }

  isGrassTile() {
    return this.terrainType && this.terrainType.id === 'grass';
  }

  isStoneTile() {
    return this.terrainType && (
      this.terrainType.id === 'hills' ||
      this.terrainType.id === 'mountains'
    );
  }

  // Check if a building type can be placed on this tile
  canPlaceBuilding(buildingType) {
    // If no terrain type, allow placement (for manually painted tiles)
    if (!this.terrainType) {
      return { allowed: true };
    }

    switch (buildingType) {
      case 'farm':
        // Farms can only be placed on grass tiles
        if (!this.isGrassTile()) {
          return {
            allowed: false,
            reason: `Farms can only be placed on grass tiles (current: ${this.terrainType.name})`
          };
        }
        return { allowed: true };

      case 'house':
        // Houses cannot be placed on water or mountains
        if (this.isWaterTile()) {
          return {
            allowed: false,
            reason: `Houses cannot be placed on water (current: ${this.terrainType.name})`
          };
        }
        if (this.isMountainTile()) {
          return {
            allowed: false,
            reason: `Houses cannot be placed on mountains (current: ${this.terrainType.name})`
          };
        }
        return { allowed: true };

      case 'lumberyard':
        // Lumberyards can only be placed on forest tiles
        if (!this.isForestTile()) {
          return {
            allowed: false,
            reason: `Lumberyards can only be placed on forest tiles (current: ${this.terrainType.name})`
          };
        }
        return { allowed: true };

      case 'stonequarry':
        // Stone quarries can only be placed on stone tiles (hills/mountains)
        if (!this.isStoneTile()) {
          return {
            allowed: false,
            reason: `Stone quarries can only be placed on stone tiles (current: ${this.terrainType.name})`
          };
        }
        return { allowed: true };

      default:
        // Unknown building type - allow by default
        return { allowed: true };
    }
  }

  // Check if this is a naturally generated tile
  isNaturalTerrain() {
    return this.isGenerated && !this.isPainted;
  }

  // Utility methods
  clone() {
    return new Tile(this.x, this.y, {
      color: this.color,
      data: { ...this.data },
      selected: this.selected,
      highlighted: this.highlighted,
      visible: this.visible,
      locked: this.locked,
      terrainType: this.terrainType,
      elevation: this.elevation,
      temperature: this.temperature,
      moisture: this.moisture,
      riverValue: this.riverValue,
      detail: this.detail,
      isGenerated: this.isGenerated,
      isPainted: this.isPainted,
      building: this.building,
      farmland: this.farmland,
      rotation: this.rotation
    });
  }

  toJSON() {
    return {
      x: this.x,
      y: this.y,
      color: this.color,
      data: this.data,
      selected: this.selected,
      highlighted: this.highlighted,
      visible: this.visible,
      locked: this.locked,
      terrainType: this.terrainType,
      elevation: this.elevation,
      temperature: this.temperature,
      moisture: this.moisture,
      riverValue: this.riverValue,
      detail: this.detail,
      isGenerated: this.isGenerated,
      isPainted: this.isPainted,
      building: this.building ? this.building.getInfo() : null,
      farmland: this.farmland,
      rotation: this.rotation,
      createdAt: this.createdAt.toISOString(),
      lastModified: this.lastModified.toISOString()
    };
  }

  static fromJSON(json) {
    const tile = new Tile(json.x, json.y, {
      color: json.color,
      data: json.data,
      selected: json.selected,
      highlighted: json.highlighted,
      visible: json.visible,
      locked: json.locked,
      terrainType: json.terrainType,
      elevation: json.elevation,
      temperature: json.temperature,
      moisture: json.moisture,
      riverValue: json.riverValue,
      detail: json.detail,
      isGenerated: json.isGenerated,
      isPainted: json.isPainted,
      farmland: json.farmland,
      rotation: json.rotation
    });
    tile.createdAt = new Date(json.createdAt);
    tile.lastModified = new Date(json.lastModified);
    return tile;
  }

  // Factory method for creating terrain tiles
  static createTerrain(x, y, terrainData) {
    const tile = new Tile(x, y, {
      color: terrainData.color,
      terrainType: terrainData.terrainType,
      elevation: terrainData.elevation,
      temperature: terrainData.temperature,
      moisture: terrainData.moisture,
      riverValue: terrainData.riverValue,
      detail: terrainData.detail,
      isGenerated: true,
      isPainted: false
    });
    return tile;
  }
}