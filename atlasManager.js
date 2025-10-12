/**
 * AtlasManager handles loading and sampling from the tile atlas
 */
export class AtlasManager {
  constructor() {
    this.atlas = null;
    this.isLoaded = false;
    this.loadPromise = null;

    // Building sprites
    this.buildingSprites = {
      house: null,
      barn: null,
      farmland: null,
      lumberyard: null,
      cobblepath: null,
      stonequarry: null,
      warehouse: null
    };
    this.buildingSpritesLoaded = {
      house: false,
      barn: false,
      farmland: false,
      lumberyard: false,
      cobblepath: false,
      stonequarry: false,
      warehouse: false
    };
    this.buildingSpriteLoadPromises = {};

    // Define atlas sections based on the tile_sprites/tile_atlas.png structure (644x644 pixels)
    // Each section contains tiles in a grid pattern, we'll sample whole tiles only
    this.ATLAS_SIZE = 644; // Total atlas size
    this.TILE_SIZE = 32;   // Individual tile size in atlas

    this.ATLAS_SECTIONS = {
      WATER: { x: 0, y: 0, width: 225.4, height: 289.8, tilesX: 7, tilesY: 9 },
      FOREST: { x: 225.4, y: 0, width: 225.4, height: 193.2, tilesX: 4, tilesY: 6 },
      GRASS: { x: 354.2, y: 0, width: 289.8, height: 289.8, tilesX: 9, tilesY: 9 },
      STONE: { x: 0, y: 289.8, width: 193.6, height: 354.2, tilesX: 6, tilesY: 11 },
      MIXED_TERRAIN: { x: 225.4, y: 289.8, width: 225.4, height: 128.8, tilesX: 7, tilesY: 4 },
      SAND: { x: 225.4, y: 450.8, width: 128.8, height: 193.2, tilesX: 4, tilesY: 6},
      SNOW: { x: 354.2, y: 450.8, width: 289.8, height: 193.2, tilesX: 9, tilesY: 6 }
    };

    // Cache for consistent texture sampling
    this.textureCache = new Map();
  }

  /**
   * Load the tile atlas image
   */
  async loadAtlas(atlasPath = './tile_sprites/tile_atlas.png') {
    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        this.atlas = img;
        this.isLoaded = true;
        console.log('Tile atlas loaded successfully:', img.width, 'x', img.height);
        resolve(img);
      };

      img.onerror = (error) => {
        console.error('Failed to load tile atlas:', error);
        reject(error);
      };

      img.src = atlasPath;
    });

    return this.loadPromise;
  }

  /**
   * Load a building sprite
   */
  async loadBuildingSprite(buildingType, spritePath) {
    // Return existing promise if already loading
    if (this.buildingSpriteLoadPromises[buildingType]) {
      return this.buildingSpriteLoadPromises[buildingType];
    }

    this.buildingSpriteLoadPromises[buildingType] = new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        this.buildingSprites[buildingType] = img;
        this.buildingSpritesLoaded[buildingType] = true;
        console.log(`Building sprite '${buildingType}' loaded successfully:`, img.width, 'x', img.height);
        resolve(img);
      };

      img.onerror = (error) => {
        console.error(`Failed to load building sprite '${buildingType}':`, error);
        reject(error);
      };

      img.src = spritePath;
    });

    return this.buildingSpriteLoadPromises[buildingType];
  }

  /**
   * Get a consistent texture sample for a tile based on its coordinates and terrain type
   */
  getTextureForTile(tileX, tileY, terrainType, tileSize = 32) {
    if (!this.isLoaded || !this.atlas) {
      return null;
    }

    // Create a unique key for this tile
    const tileKey = `${tileX},${tileY},${terrainType}`;

    // Check cache first
    if (this.textureCache.has(tileKey)) {
      return this.textureCache.get(tileKey);
    }

    // Get the section for this terrain type
    const section = this.getSectionForTerrain(terrainType);
    if (!section) {
      return null;
    }

    // Generate consistent tile selection within the section
    // We'll pick a specific tile from the available tiles in this section
    const seed = this.hashCoordinates(tileX, tileY);
    const availableTilesX = section.tilesX;
    const availableTilesY = section.tilesY;

    // Select which tile within the section to use (aligned to tile boundaries)
    const tileIndexX = seed % availableTilesX;
    const tileIndexY = Math.floor(seed / availableTilesX) % availableTilesY;

    // Calculate exact pixel coordinates within the atlas (aligned to 32px grid)
    const sourceX = section.x + (tileIndexX * this.TILE_SIZE);
    const sourceY = section.y + (tileIndexY * this.TILE_SIZE);

    const textureData = {
      sourceX: sourceX,
      sourceY: sourceY,
      sourceWidth: this.TILE_SIZE,
      sourceHeight: this.TILE_SIZE
    };

    // Cache the result
    this.textureCache.set(tileKey, textureData);

    return textureData;
  }

  /**
   * Render a textured tile to the canvas
   */
  renderTile(ctx, tileX, tileY, screenX, screenY, tileSize, terrainType) {
    if (!this.isLoaded || !this.atlas) {
      return false; // Indicate that atlas rendering failed
    }

    const textureData = this.getTextureForTile(tileX, tileY, terrainType);
    if (!textureData) {
      return false;
    }

    try {
      ctx.drawImage(
        this.atlas,
        textureData.sourceX, textureData.sourceY, textureData.sourceWidth, textureData.sourceHeight,
        screenX, screenY, tileSize, tileSize
      );
      return true;
    } catch (error) {
      console.error('Error rendering tile texture:', error);
      return false;
    }
  }

  /**
   * Render a building sprite to the canvas
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {string} buildingType - Type of building sprite to render
   * @param {number} screenX - X position on screen
   * @param {number} screenY - Y position on screen
   * @param {number} tileSize - Size of the tile
   * @param {number} rotation - Rotation in degrees (0, 90, 180, 270) - optional, defaults to 0
   */
  renderBuilding(ctx, buildingType, screenX, screenY, tileSize, rotation = 0) {
    if (!this.buildingSpritesLoaded[buildingType] || !this.buildingSprites[buildingType]) {
      return false; // Indicate that building sprite rendering failed
    }

    const sprite = this.buildingSprites[buildingType];

    try {
      // If rotation is needed, apply canvas transformation
      if (rotation !== 0) {
        ctx.save();

        // Translate to the center of the tile
        const centerX = screenX + tileSize / 2;
        const centerY = screenY + tileSize / 2;
        ctx.translate(centerX, centerY);

        // Rotate around the center (convert degrees to radians)
        ctx.rotate((rotation * Math.PI) / 180);

        // Draw centered on the rotated origin
        ctx.drawImage(
          sprite,
          0, 0, sprite.width, sprite.height,
          -tileSize / 2, -tileSize / 2, tileSize, tileSize
        );

        ctx.restore();
      } else {
        // No rotation - draw normally
        ctx.drawImage(
          sprite,
          0, 0, sprite.width, sprite.height,
          screenX, screenY, tileSize, tileSize
        );
      }
      return true;
    } catch (error) {
      console.error(`Error rendering building sprite '${buildingType}':`, error);
      return false;
    }
  }

  /**
   * Get the atlas section for a terrain type
   */
  getSectionForTerrain(terrainType) {
    if (!terrainType || !terrainType.id) {
      return null;
    }

    switch (terrainType.id) {
      case 'deep_water':
      case 'water':
        return this.ATLAS_SECTIONS.WATER;
      case 'grass':
        return this.ATLAS_SECTIONS.GRASS;
      case 'forest':
        return this.ATLAS_SECTIONS.FOREST;
      case 'sand':
        return this.ATLAS_SECTIONS.SAND;
      case 'hills':
      case 'mountains':
        return this.ATLAS_SECTIONS.STONE;
      case 'snow':
        return this.ATLAS_SECTIONS.SNOW;
      default:
        // Default to grass for unknown terrain types
        return this.ATLAS_SECTIONS.GRASS;
    }
  }

  /**
   * Generate a consistent hash from tile coordinates
   */
  hashCoordinates(x, y) {
    // Simple hash function that generates consistent pseudo-random numbers
    let hash = 0;
    const str = `${x},${y}`;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Clear the texture cache (useful for memory management)
   */
  clearCache() {
    this.textureCache.clear();
  }

  /**
   * Get atlas loading status
   */
  getStatus() {
    return {
      isLoaded: this.isLoaded,
      hasAtlas: !!this.atlas,
      cacheSize: this.textureCache.size,
      atlasSize: this.atlas ? { width: this.atlas.width, height: this.atlas.height } : null,
      buildingSprites: {
        house: this.buildingSpritesLoaded.house,
        barn: this.buildingSpritesLoaded.barn,
        farmland: this.buildingSpritesLoaded.farmland,
        lumberyard: this.buildingSpritesLoaded.lumberyard,
        cobblepath: this.buildingSpritesLoaded.cobblepath,
        stonequarry: this.buildingSpritesLoaded.stonequarry,
        warehouse: this.buildingSpritesLoaded.warehouse
      }
    };
  }

  /**
   * Preload textures for a region (optimization for large areas)
   */
  preloadRegion(startX, startY, width, height, terrainTypes) {
    if (!this.isLoaded) return;

    for (let y = startY; y < startY + height; y++) {
      for (let x = startX; x < startX + width; x++) {
        terrainTypes.forEach(terrainType => {
          this.getTextureForTile(x, y, terrainType);
        });
      }
    }
  }
}

// Create a singleton instance for global use
export const atlasManager = new AtlasManager();