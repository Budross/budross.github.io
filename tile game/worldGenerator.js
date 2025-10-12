import { SimplexNoise, NoiseUtils } from './noise.js';

/**
 * TerrainType definitions for different biomes and features
 * Colors are used as fallback when atlas textures are not available
 * Atlas mapping: deep_water/water → WATER section, grass → GRASS section,
 * forest → FOREST section, sand → SAND section, hills/mountains → STONE section, snow → SNOW section
 */
export const TerrainType = {
  DEEP_WATER: { id: 'deep_water', name: 'Deep Water', color: '#1e3a8a', elevation: 0.0 },
  WATER: { id: 'water', name: 'Water', color: '#3b82f6', elevation: 0.2 },
  SAND: { id: 'sand', name: 'Sand', color: '#fbbf24', elevation: 0.3 },
  GRASS: { id: 'grass', name: 'Grass', color: '#22c55e', elevation: 0.4 },
  FOREST: { id: 'forest', name: 'Forest', color: '#16a34a', elevation: 0.5 },
  HILLS: { id: 'hills', name: 'Hills', color: '#a3a3a3', elevation: 0.7 },
  MOUNTAINS: { id: 'mountains', name: 'Mountains', color: '#737373', elevation: 0.8 },
  SNOW: { id: 'snow', name: 'Snow', color: '#f8fafc', elevation: 0.9 }
};

/**
 * WorldGenerator class handles procedural terrain generation
 */
export class WorldGenerator {
  constructor(options = {}) {
    // Generation parameters
    this.seed = options.seed || Math.random();
    this.scale = options.scale || 0.02; // Scale factor for noise coordinates
    this.octaves = options.octaves || 4;
    this.persistence = options.persistence || 0.5;
    this.lacunarity = options.lacunarity || 2.0;

    // Terrain features
    this.elevationAmplitude = options.elevationAmplitude || 1.0;
    this.temperatureScale = options.temperatureScale || 0.005;
    this.moistureScale = options.moistureScale || 0.008;

    // Biome blending
    this.biomeBlending = options.biomeBlending || true;
    this.riverThreshold = options.riverThreshold || 0.1;

    // Initialize noise generators
    this.elevationNoise = new SimplexNoise(this.seed);
    this.temperatureNoise = new SimplexNoise(this.seed + 1000);
    this.moistureNoise = new SimplexNoise(this.seed + 2000);
    this.riverNoise = new SimplexNoise(this.seed + 3200);
    this.detailNoise = new SimplexNoise(this.seed + 4000);
    this.continentalNoise = new SimplexNoise(this.seed + 5000);
    this.oceanDepthNoise = new SimplexNoise(this.seed + 6000);

    // Cache for generated terrain data
    this.terrainCache = new Map();
    this.maxCacheSize = options.maxCacheSize || 10000;
  }

  /**
   * Generate terrain data for a specific coordinate
   */
  generateTerrain(x, y) {
    const key = `${x},${y}`;

    // Check cache first and update access time
    if (this.terrainCache.has(key)) {
      const cachedData = this.terrainCache.get(key);
      cachedData.lastAccessed = Date.now();
      return cachedData;
    }

    // Generate noise values
    const continentalMask = this.generateContinentalMask(x, y);
    const elevation = this.generateElevation(x, y, continentalMask);
    const temperature = this.generateTemperature(x, y);
    const moisture = this.generateMoisture(x, y);
    // Note: riverValue generation removed - rivers now handled by background system

    // Determine terrain type based on noise values (no rivers from old system)
    const terrainType = this.determineTerrainType(elevation, temperature, moisture, 1.0);

    // Add some detail variation
    const detail = this.detailNoise.noise2D(x * this.scale * 4, y * this.scale * 4);

    const terrainData = {
      x,
      y,
      elevation,
      temperature,
      moisture,
      detail,
      terrainType,
      color: this.getTerrainColor(terrainType, detail),
      isRiver: false, // Will be set by background river system
      metadata: {
        generated: true,
        generatedAt: Date.now(),
        seed: this.seed
      }
    };

    // Cache the result
    this.cacheTerrainData(key, terrainData);

    return terrainData;
  }

  /**
   * Generate continental mask to create distinct landmasses
   */
  generateContinentalMask(x, y) {
    // Very low frequency noise for continental shapes
    const continentalScale = this.scale * 0.1; // Much larger scale for continents

    // Primary continental pattern
    const primaryContinental = this.continentalNoise.octaveNoise2D(
      x * continentalScale,
      y * continentalScale,
      3,
      0.6
    );

    // Secondary pattern for more variety
    const secondaryContinental = this.continentalNoise.octaveNoise2D(
      x * continentalScale * 1.7,
      y * continentalScale * 1.3,
      2,
      0.4
    );

    // Combine patterns
    const continental = NoiseUtils.normalize(primaryContinental) * 0.7 +
                       NoiseUtils.normalize(secondaryContinental) * 0.3;

    return continental;
  }

  /**
   * Generate elevation using octave noise
   */
  generateElevation(x, y, continentalMask = 0.5) {
    const baseElevation = this.elevationNoise.octaveNoise2D(
      x * this.scale,
      y * this.scale,
      this.octaves,
      this.persistence
    );

    // Add some ridged noise for mountain features
    const ridges = this.elevationNoise.ridgedNoise2D(
      x * this.scale * 0.5,
      y * this.scale * 0.5,
      3,
      0.6
    );

    // Enhanced mountain generation along continental edges
    const continentalEdge = Math.abs(continentalMask - 0.5) * 2; // Peaks at continental edges
    const mountainMultiplier = NoiseUtils.smoothstep(0.3, 0.8, continentalEdge);

    // Combine base elevation with ridges
    let elevation = NoiseUtils.normalize(baseElevation) * this.elevationAmplitude;
    elevation += ridges * (0.3 + mountainMultiplier * 0.4); // Enhanced ridges at continental edges

    // Apply continental mask to create distinct landmasses
    // Areas with high continental values become land, low values become ocean
    const continentalInfluence = NoiseUtils.smoothstep(0.3, 0.7, continentalMask);

    // Ocean depth generation for deep ocean areas
    if (continentalMask < 0.4) {
      const oceanDepth = this.oceanDepthNoise.octaveNoise2D(
        x * this.scale * 0.3,
        y * this.scale * 0.3,
        2,
        0.5
      );
      // Create deeper oceans far from continents
      const depthFactor = (0.4 - continentalMask) / 0.4;
      elevation = -NoiseUtils.normalize(oceanDepth) * 0.3 * depthFactor;
    } else {
      // Apply continental influence to land elevation
      elevation = elevation * continentalInfluence + (continentalMask - 0.4) * 0.5;
    }

    return Math.max(-0.3, Math.min(1, elevation));
  }

  /**
   * Generate temperature value with improved climate zones
   */
  generateTemperature(x, y) {
    // Base temperature with large-scale variation
    const baseTemp = this.temperatureNoise.octaveNoise2D(
      x * this.temperatureScale,
      y * this.temperatureScale,
      3,
      0.6
    );

    // Enhanced latitude effect - create distinct climate bands
    const latitudePosition = Math.abs(y * 0.0005); // Reduced for larger climate zones

    // Create temperature bands: tropical (center), temperate, arctic (poles)
    let latitudeTemp;
    if (latitudePosition < 0.3) {
      // Tropical zone - hot
      latitudeTemp = 0.8 - latitudePosition * 0.3;
    } else if (latitudePosition < 0.6) {
      // Temperate zone - moderate
      latitudeTemp = 0.5 - (latitudePosition - 0.3) * 0.6;
    } else {
      // Arctic zone - cold
      latitudeTemp = 0.2 - Math.min(0.2, (latitudePosition - 0.6) * 0.5);
    }

    // Combine base noise with latitude effect (60% latitude, 40% noise)
    let temperature = latitudeTemp * 0.6 + NoiseUtils.normalize(baseTemp) * 0.4;

    return Math.max(0, Math.min(1, temperature));
  }

  /**
   * Generate moisture value
   */
  generateMoisture(x, y) {
    const moisture = this.moistureNoise.octaveNoise2D(
      x * this.moistureScale,
      y * this.moistureScale,
      3,
      0.5
    );

    return NoiseUtils.normalize(moisture);
  }

  /**
   * Generate river value for water features
   */
  generateRiverValue(x, y) {
    const riverNoise = Math.abs(this.riverNoise.noise2D(
      x * this.scale * 0.3,
      y * this.scale * 0.5
    ));

    return riverNoise;
  }

  /**
   * Determine terrain type based on noise values
   */
  determineTerrainType(elevation, temperature, moisture, riverValue) {
    // Skip old river generation if background river system is enabled
    // This will be overridden by the background river overlay system
    // if (riverValue < this.riverThreshold && elevation > 0.15) {
    //   return TerrainType.WATER;
    // }

    // Ocean and water levels with improved gradients
    if (elevation < -0.1) return TerrainType.DEEP_WATER; // Deep ocean
    if (elevation < 0.0) return TerrainType.WATER; // Shallow ocean
    if (elevation < 0.05) return TerrainType.WATER; // Coastal water
    if (elevation < 0.15) return TerrainType.SAND; // Beach/coastal

    // Snow at high elevations or in cold climates
    if (elevation > 0.85 || (elevation > 0.6 && temperature < 0.2)) return TerrainType.SNOW;
    if (elevation > 0.75) return TerrainType.MOUNTAINS;
    if (elevation > 0.55) return TerrainType.HILLS;

    // Enhanced biome determination based on temperature and moisture
    if (temperature > 0.7 && moisture < 0.3) {
      return TerrainType.SAND; // Hot deserts
    }

    if (temperature < 0.3 && moisture < 0.4) {
      return TerrainType.SAND; // Cold/tundra areas
    }

    if (moisture > 0.65 && temperature > 0.5) {
      return TerrainType.FOREST; // Tropical/temperate rainforests
    }

    if (moisture > 0.5 && temperature > 0.3 && temperature < 0.7) {
      return TerrainType.FOREST; // Temperate forests
    }

    if (temperature < 0.25) {
      return elevation > 0.4 ? TerrainType.HILLS : TerrainType.GRASS; // Cold grasslands/tundra
    }

    // Default grassland for moderate climates
    return TerrainType.GRASS;
  }

  /**
   * Get terrain color with variation
   */
  getTerrainColor(terrainType, detail) {
    const baseColor = terrainType.color;

    // Add some variation based on detail noise
    const variation = Math.floor(detail * 30); // -15 to +15 variation

    // Parse hex color and apply variation
    const hex = baseColor.replace('#', '');
    const r = Math.max(0, Math.min(255, parseInt(hex.substr(0, 2), 16) + variation));
    const g = Math.max(0, Math.min(255, parseInt(hex.substr(2, 2), 16) + variation));
    const b = Math.max(0, Math.min(255, parseInt(hex.substr(4, 2), 16) + variation));

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  /**
   * Cache terrain data with size limit and distance-based cleanup
   */
  cacheTerrainData(key, data) {
    // Add timestamp for LRU tracking
    data.cachedAt = Date.now();
    data.lastAccessed = Date.now();

    if (this.terrainCache.size >= this.maxCacheSize) {
      // Remove oldest entries by access time (LRU)
      const entries = Array.from(this.terrainCache.entries());
      entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

      // Remove oldest 20% of entries
      const removeCount = Math.max(1, Math.floor(this.maxCacheSize * 0.2));
      for (let i = 0; i < removeCount; i++) {
        this.terrainCache.delete(entries[i][0]);
      }
    }

    this.terrainCache.set(key, data);
  }

  /**
   * Clean cache entries that are far from the given center point
   */
  cleanDistantCacheEntries(centerX, centerY, maxDistance) {
    const entriesToRemove = [];

    for (const [key, data] of this.terrainCache) {
      if (data.x !== undefined && data.y !== undefined) {
        const dx = data.x - centerX;
        const dy = data.y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > maxDistance) {
          entriesToRemove.push(key);
        }
      }
    }

    // Remove distant entries
    for (const key of entriesToRemove) {
      this.terrainCache.delete(key);
    }

    return entriesToRemove.length;
  }

  /**
   * Generate multiple tiles efficiently
   */
  generateRegion(startX, startY, width, height) {
    const region = [];

    for (let y = startY; y < startY + height; y++) {
      for (let x = startX; x < startX + width; x++) {
        region.push(this.generateTerrain(x, y));
      }
    }

    return region;
  }

  /**
   * Generate a region with realistic river networks
   */
  generateRegionWithRivers(startX, startY, width, height, riverOptions = {}) {
    // First generate the base terrain
    const region = this.generateRegion(startX, startY, width, height);

    // Then add realistic rivers
    const riverGenerator = new RiverNetworkGenerator(riverOptions);
    const riverNetworks = riverGenerator.generateRivers(region, this);

    return {
      region,
      riverNetworks,
      stats: {
        totalTiles: region.length,
        riverTiles: region.filter(tile => tile.isRiver).length,
        riverNetworkCount: riverNetworks.length
      }
    };
  }

  /**
   * Update generation parameters
   */
  updateParameters(newParams) {
    let regenerateNoise = false;

    if (newParams.seed !== undefined && newParams.seed !== this.seed) {
      this.seed = newParams.seed;
      regenerateNoise = true;
    }

    // Update other parameters
    Object.assign(this, newParams);

    // Regenerate noise instances if seed changed
    if (regenerateNoise) {
      this.elevationNoise = new SimplexNoise(this.seed);
      this.temperatureNoise = new SimplexNoise(this.seed + 1000);
      this.moistureNoise = new SimplexNoise(this.seed + 2000);
      this.riverNoise = new SimplexNoise(this.seed + 3200);
      this.detailNoise = new SimplexNoise(this.seed + 4000);
      this.continentalNoise = new SimplexNoise(this.seed + 5000);
      this.oceanDepthNoise = new SimplexNoise(this.seed + 6000);
    }

    // Clear cache to force regeneration
    this.terrainCache.clear();
  }

  /**
   * Get generation statistics
   */
  getStats() {
    return {
      seed: this.seed,
      cacheSize: this.terrainCache.size,
      maxCacheSize: this.maxCacheSize,
      parameters: {
        scale: this.scale,
        octaves: this.octaves,
        persistence: this.persistence,
        elevationAmplitude: this.elevationAmplitude,
        temperatureScale: this.temperatureScale,
        moistureScale: this.moistureScale
      }
    };
  }

  /**
   * Clear the terrain cache
   */
  clearCache() {
    this.terrainCache.clear();
  }
}

// Predefined world generation presets
export const WorldPresets = {
  ARCHIPELAGO: {
    scale: 0.008,
    octaves: 5,
    persistence: 0.6,
    elevationAmplitude: 0.8,
    riverThreshold: 0.05,
    description: "Many small islands scattered across vast oceans"
  },

  CONTINENTAL: {
    scale: 0.003,
    octaves: 6,
    persistence: 0.7,
    elevationAmplitude: 1.0,
    riverThreshold: 0.1,
    description: "Large continents with diverse climates and terrains"
  },

  MOUNTAINOUS: {
    scale: 0.012,
    octaves: 4,
    persistence: 0.8,
    elevationAmplitude: 1.4,
    riverThreshold: 0.2,
    description: "Rugged terrain with prominent mountain ranges"
  },

  PANGAEA: {
    scale: 0.001,
    octaves: 7,
    persistence: 0.6,
    elevationAmplitude: 0.9,
    riverThreshold: 0.12,
    description: "Single massive supercontinent surrounded by ocean"
  },

  OCEANIC: {
    scale: 0.015,
    octaves: 3,
    persistence: 0.4,
    elevationAmplitude: 0.5,
    riverThreshold: 0.03,
    description: "Mostly ocean with scattered small landmasses"
  }
};

/**
 * RiverNetworkGenerator - Post-terrain generation of realistic river systems
 * Creates rivers that flow from high elevation peaks to low elevation valleys/coasts
 */