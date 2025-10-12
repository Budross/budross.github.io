// Building system for tile game
// Manages building placement, resource generation, and building types

// ============================================================================
// BUILDING CONFIGURATION - Edit costs and properties here
// ============================================================================
export const BUILDING_CONFIGS = {
  house: {
    type: 'house',
    name: 'House',
    description: 'Provides workers for your settlement',

    // Resource costs to build
    costs: {
      wood: 15,
    },

    // Effects when placed/removed
    effects: {
      onPlaced: {
        worker: 2  // Adds 2 workers when built
      },
      onRemoved: {
        worker: -2  // Removes 2 workers when demolished
      }
    },

    // Visual properties
    display: {
      color: '#8B4513',  // Brown
      icon: '🏠'
    }
  },

  farm: {
    type: 'farm',
    name: 'Farm',
    description: 'Generates food over time',

    // Resource costs to build
    costs: {
      worker: 4,
      wood: 15
    },

    // Resource generation
    generation: {
      food: 0.1  // Generates 1 food per second
    },

    // Visual properties
    display: {
      color: '#228B22',  // Forest green
      icon: '🌾'
    }
  },

  lumberyard: {
    type: 'lumberyard',
    name: 'Lumberyard',
    description: 'Processes wood from the forest',

    // Resource costs to build
    costs: {
      worker: 2
    },
    generation: {
      wood: 0.1// No automatic generation for now
    },
    // Visual properties
    display: {
      color: '#654321',  // Wood brown
      icon: '🪵'
    }
  },

  cobblepath: {
    type: 'cobblepath',
    name: 'Cobble Path',
    description: 'Decorative cobblestone path',

    // No costs - purely cosmetic
    costs: {},

    // Visual properties
    display: {
      color: '#808080',  // Gray
      icon: '🛤️'
    }
  },

  stonequarry: {
    type: 'stonequarry',
    name: 'Stone Quarry',
    description: 'Extracts stone from the earth',

    // Resource costs to build
    costs: {
      worker: 8,
      wood:50
    },

    generation: {
      stone: 0.05  // Generates 0.05 stone per second
    },

    // Visual properties
    display: {
      color: '#696969',  // Dim gray
      icon: '⛏️'
    }
  },

  warehouse: {
    type: 'warehouse',
    name: 'Warehouse',
    description: 'Increases resource storage capacity',

    // Resource costs to build
    costs: {
      wood: 25,
      stone: 10,
      worker: 1
    },

    // Effects when placed/removed
    effects: {
      onPlaced: {
        foodCap: 100,    // Adds 100 to food cap
        woodCap: 100,    // Adds 100 to wood cap
        stoneCap: 150    // Adds 150 to stone cap
      },
      onRemoved: {
        foodCap: -100,   // Removes 100 from food cap
        woodCap: -100,   // Removes 100 from wood cap
        stoneCap: -150   // Removes 150 from stone cap
      }
    },

    // Visual properties
    display: {
      color: '#8B7355',  // Wood brown
      icon: '📦'
    }
  }
};

// Base Building class
export class Building {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.createdAt = Date.now();
  }

  // Override in subclasses
  onPlaced(resourceManager) {
    // Called when building is placed on the grid
  }

  onRemoved(resourceManager) {
    // Called when building is removed from the grid
  }

  // Called every generation tick (for buildings that produce resources)
  generateResources(resourceManager) {
    // Generic implementation that works for all buildings with generation config
    const generation = this.config?.generation || {};
    for (const [resourceType, amount] of Object.entries(generation)) {
      if (amount > 0) {
        resourceManager.addResource(resourceType, amount);
      }
    }
  }

  getDisplayColor() {
    return '#cccccc'; // Default gray
  }

  getInfo() {
    return {
      type: this.type,
      position: { x: this.x, y: this.y },
      createdAt: this.createdAt
    };
  }
}

// House building - adds workers when placed
export class House extends Building {
  constructor(x, y) {
    super(x, y, 'house');
    this.config = BUILDING_CONFIGS.house;
  }

  static getConfig() {
    return BUILDING_CONFIGS.house;
  }

  onPlaced(resourceManager, buildingManager) {
    // Apply onPlaced effects from config
    const effects = this.config.effects?.onPlaced || {};
    for (const [resourceType, amount] of Object.entries(effects)) {
      resourceManager.addResource(resourceType, amount);
    }
    console.log(`${this.config.display.icon} ${this.config.name} built at (${this.x}, ${this.y})`);
  }

  onRemoved(resourceManager, buildingManager) {
    // Apply onRemoved effects from config
    const effects = this.config.effects?.onRemoved || {};
    for (const [resourceType, amount] of Object.entries(effects)) {
      if (amount < 0) {
        resourceManager.removeResource(resourceType, Math.abs(amount));
      } else {
        resourceManager.addResource(resourceType, amount);
      }
    }
    console.log(`${this.config.display.icon} ${this.config.name} removed at (${this.x}, ${this.y})`);
  }

  getDisplayColor() {
    return this.config.display.color;
  }

  getInfo() {
    const workerBonus = this.config.effects?.onPlaced?.worker || 0;
    return {
      ...super.getInfo(),
      workerBonus: workerBonus,
      description: this.config.description,
      costs: this.config.costs
    };
  }
}

// Farm building - generates food over time
export class Farm extends Building {
  constructor(x, y) {
    super(x, y, 'farm');
    this.config = BUILDING_CONFIGS.farm;
    this.farmlandTiles = []; // Track farmland tile positions
  }

  static getConfig() {
    return BUILDING_CONFIGS.farm;
  }

  // Calculate 1-tile radius positions around the barn (8 surrounding tiles)
  getFarmlandPositions() {
    const offsets = [
      [-1, -1], [0, -1], [1, -1],  // top row
      [-1,  0],          [1,  0],  // middle row (excluding center)
      [-1,  1], [0,  1], [1,  1]   // bottom row
    ];

    return offsets.map(([dx, dy]) => ({
      x: this.x + dx,
      y: this.y + dy
    }));
  }

  onPlaced(resourceManager, buildingManager) {
    const foodPerSecond = this.config.generation?.food || 0;
    console.log(`${this.config.display.icon} ${this.config.name} built at (${this.x}, ${this.y}) - Generates ${foodPerSecond} food/second`);

    // Store farmland positions for later cleanup
    const potentialFarmland = this.getFarmlandPositions();

    // Filter out positions that already have buildings
    if (buildingManager) {
      this.farmlandTiles = potentialFarmland.filter(pos => {
        return !buildingManager.getBuilding(pos.x, pos.y);
      });
    } else {
      this.farmlandTiles = potentialFarmland;
    }

    console.log(`${this.config.display.icon} Farm will have ${this.farmlandTiles.length} farmland tiles`);
  }

  onRemoved(resourceManager, buildingManager) {
    console.log(`${this.config.display.icon} ${this.config.name} removed at (${this.x}, ${this.y})`);
    // Farmland cleanup is handled by the grid system
    this.farmlandTiles = [];
  }

  getDisplayColor() {
    return this.config.display.color;
  }

  getInfo() {
    const foodPerSecond = this.config.generation?.food || 0;
    return {
      ...super.getInfo(),
      foodPerSecond: foodPerSecond,
      farmlandTiles: this.farmlandTiles.length,
      description: this.config.description,
      costs: this.config.costs
    };
  }
}

// Lumberyard building - processes wood from forests
export class Lumberyard extends Building {
  constructor(x, y) {
    super(x, y, 'lumberyard');
    this.config = BUILDING_CONFIGS.lumberyard;
  }

  static getConfig() {
    return BUILDING_CONFIGS.lumberyard;
  }

  onPlaced(resourceManager, buildingManager) {
    console.log(`${this.config.display.icon} ${this.config.name} built at (${this.x}, ${this.y})`);
  }

  onRemoved(resourceManager, buildingManager) {
    console.log(`${this.config.display.icon} ${this.config.name} removed at (${this.x}, ${this.y})`);
  }

  getDisplayColor() {
    return this.config.display.color;
  }

  getInfo() {
    return {
      ...super.getInfo(),
      description: this.config.description,
      costs: this.config.costs
    };
  }
}

// CobblePath building - purely decorative, no costs or effects
export class CobblePath extends Building {
  constructor(x, y) {
    super(x, y, 'cobblepath');
    this.config = BUILDING_CONFIGS.cobblepath;
  }

  static getConfig() {
    return BUILDING_CONFIGS.cobblepath;
  }

  onPlaced(resourceManager, buildingManager) {
    console.log(`${this.config.display.icon} ${this.config.name} placed at (${this.x}, ${this.y})`);
  }

  onRemoved(resourceManager, buildingManager) {
    console.log(`${this.config.display.icon} ${this.config.name} removed at (${this.x}, ${this.y})`);
  }

  getDisplayColor() {
    return this.config.display.color;
  }

  getInfo() {
    return {
      ...super.getInfo(),
      description: this.config.description
    };
  }
}

// StoneQuarry building - extracts stone from the earth
export class StoneQuarry extends Building {
  constructor(x, y) {
    super(x, y, 'stonequarry');
    this.config = BUILDING_CONFIGS.stonequarry;
  }

  static getConfig() {
    return BUILDING_CONFIGS.stonequarry;
  }

  onPlaced(resourceManager, buildingManager) {
    console.log(`${this.config.display.icon} ${this.config.name} built at (${this.x}, ${this.y})`);
  }

  onRemoved(resourceManager, buildingManager) {
    console.log(`${this.config.display.icon} ${this.config.name} removed at (${this.x}, ${this.y})`);
  }

  getDisplayColor() {
    return this.config.display.color;
  }

  getInfo() {
    return {
      ...super.getInfo(),
      description: this.config.description,
      costs: this.config.costs
    };
  }
}

// Warehouse building - increases resource storage capacity
export class Warehouse extends Building {
  constructor(x, y) {
    super(x, y, 'warehouse');
    this.config = BUILDING_CONFIGS.warehouse;
  }

  static getConfig() {
    return BUILDING_CONFIGS.warehouse;
  }

  onPlaced(resourceManager, buildingManager) {
    // Apply cap increases from config
    const effects = this.config.effects?.onPlaced || {};

    // Increase resource caps
    if (effects.foodCap) {
      const currentCap = resourceManager.getResourceCap('food');
      resourceManager.setResourceCap('food', currentCap + effects.foodCap);
    }
    if (effects.woodCap) {
      const currentCap = resourceManager.getResourceCap('wood');
      resourceManager.setResourceCap('wood', currentCap + effects.woodCap);
    }
    if (effects.stoneCap) {
      const currentCap = resourceManager.getResourceCap('stone');
      resourceManager.setResourceCap('stone', currentCap + effects.stoneCap);
    }

    console.log(`${this.config.display.icon} ${this.config.name} built at (${this.x}, ${this.y}) - Storage increased!`);
  }

  onRemoved(resourceManager, buildingManager) {
    // Apply cap decreases from config
    const effects = this.config.effects?.onRemoved || {};

    // Decrease resource caps (effects are negative values)
    if (effects.foodCap) {
      const currentCap = resourceManager.getResourceCap('food');
      resourceManager.setResourceCap('food', Math.max(0, currentCap + effects.foodCap));
    }
    if (effects.woodCap) {
      const currentCap = resourceManager.getResourceCap('wood');
      resourceManager.setResourceCap('wood', Math.max(0, currentCap + effects.woodCap));
    }
    if (effects.stoneCap) {
      const currentCap = resourceManager.getResourceCap('stone');
      resourceManager.setResourceCap('stone', Math.max(0, currentCap + effects.stoneCap));
    }

    console.log(`${this.config.display.icon} ${this.config.name} removed at (${this.x}, ${this.y}) - Storage decreased`);
  }

  getDisplayColor() {
    return this.config.display.color;
  }

  getInfo() {
    const capBonuses = this.config.effects?.onPlaced || {};
    return {
      ...super.getInfo(),
      capBonuses: capBonuses,
      description: this.config.description,
      costs: this.config.costs
    };
  }
}

// Building Manager - coordinates all buildings and resource generation
export class BuildingManager {
  constructor(resourceManager, eventQueue = null) {
    this.resourceManager = resourceManager;
    this.eventQueue = eventQueue; // Optional event queue for displaying messages
    this.buildings = new Map(); // Map<"x,y", Building>
    this.generationInterval = null;
    this.generationRate = 1000; // Generate resources every 1000ms (1 second)
  }

  // Create building instance based on type
  createBuilding(x, y, type) {
    switch (type) {
      case 'house':
        return new House(x, y);
      case 'farm':
        return new Farm(x, y);
      case 'lumberyard':
        return new Lumberyard(x, y);
      case 'cobblepath':
        return new CobblePath(x, y);
      case 'stonequarry':
        return new StoneQuarry(x, y);
      case 'warehouse':
        return new Warehouse(x, y);
      default:
        console.warn(`Unknown building type: ${type}`);
        return null;
    }
  }

  // Place a building at the specified position
  // Returns { success: boolean, building: Building|null, error: string|null }
  // @param {boolean} skipCosts - If true, skip resource cost checks (used when loading saved buildings)
  placeBuilding(x, y, type, tile = null, skipCosts = false) {
    const key = `${x},${y}`;

    // Get building configuration
    const config = BUILDING_CONFIGS[type];
    if (!config) {
      return {
        success: false,
        building: null,
        error: `Unknown building type: ${type}`
      };
    }

    // Check resource costs (skip when loading saved buildings)
    if (!skipCosts && config.costs) {
      const canAfford = this.resourceManager.canAfford(config.costs);
      if (!canAfford) {
        // Build detailed error message showing what's needed
        const missingResources = [];
        for (const [resourceType, cost] of Object.entries(config.costs)) {
          const current = this.resourceManager.getResource(resourceType);
          if (current < cost) {
            missingResources.push(`${resourceType}: ${current}/${cost}`);
          }
        }
        const errorMsg = `Insufficient resources - ${missingResources.join(', ')}`;

        // Send event message if eventQueue is available
        if (this.eventQueue) {
          this.eventQueue._addBuildingMessageWithConfig('placed', type, x, y, false, errorMsg, config);
        }

        return {
          success: false,
          building: null,
          error: errorMsg
        };
      }
    }

    // Validate terrain compatibility if tile is provided
    if (tile && typeof tile.canPlaceBuilding === 'function') {
      const validation = tile.canPlaceBuilding(type);
      if (!validation.allowed) {
        const errorMsg = validation.reason || 'Building cannot be placed on this terrain';

        // Send event message if eventQueue is available
        if (this.eventQueue) {
          this.eventQueue._addBuildingMessageWithConfig('placed', type, x, y, false, errorMsg, config);
        }

        return {
          success: false,
          building: null,
          error: errorMsg
        };
      }
    }

    // Remove existing building if present
    if (this.buildings.has(key)) {
      this.removeBuilding(x, y);
    }

    // Deduct resources (skip when loading saved buildings)
    if (!skipCosts && config.costs) {
      const spent = this.resourceManager.spend(config.costs);
      if (!spent) {
        return {
          success: false,
          building: null,
          error: 'Failed to deduct resources (this should not happen)'
        };
      }
    }

    // Create and place new building
    const building = this.createBuilding(x, y, type);
    if (building) {
      this.buildings.set(key, building);
      building.onPlaced(this.resourceManager, this);
      console.log(`✅ ${config.name} built successfully at (${x}, ${y})`);

      // Send event message if eventQueue is available
      if (this.eventQueue) {
        this.eventQueue._addBuildingMessageWithConfig('placed', type, x, y, true, null, config);
      }

      return {
        success: true,
        building: building,
        error: null
      };
    }

    // If building creation failed, refund resources
    if (config.costs) {
      for (const [resourceType, amount] of Object.entries(config.costs)) {
        this.resourceManager.addResource(resourceType, amount);
      }
    }

    return {
      success: false,
      building: null,
      error: 'Failed to create building'
    };
  }

  // Remove a building at the specified position
  removeBuilding(x, y) {
    const key = `${x},${y}`;
    const building = this.buildings.get(key);

    if (building) {
      // Get config before removing
      const config = BUILDING_CONFIGS[building.type];

      building.onRemoved(this.resourceManager, this);
      this.buildings.delete(key);

      // Send event message if eventQueue is available
      if (this.eventQueue && config) {
        this.eventQueue._addBuildingMessageWithConfig('removed', building.type, x, y, true, null, config);
      }

      return true;
    }

    return false;
  }

  // Get building at position
  getBuilding(x, y) {
    const key = `${x},${y}`;
    return this.buildings.get(key) || null;
  }

  // Get all buildings of a specific type
  getBuildingsByType(type) {
    const buildingsOfType = [];
    for (const building of this.buildings.values()) {
      if (building.type === type) {
        buildingsOfType.push(building);
      }
    }
    return buildingsOfType;
  }

  // Count buildings by type
  getBuildingCount(type = null) {
    if (type === null) {
      return this.buildings.size;
    }
    return this.getBuildingsByType(type).length;
  }

  // Start resource generation interval
  startGeneration() {
    if (this.generationInterval) {
      console.warn('Generation already started');
      return;
    }

    this.generationInterval = setInterval(() => {
      this.tickGeneration();
    }, this.generationRate);

    console.log('🔄 Building resource generation started');
  }

  // Stop resource generation interval
  stopGeneration() {
    if (this.generationInterval) {
      clearInterval(this.generationInterval);
      this.generationInterval = null;
      console.log('⏸️ Building resource generation stopped');
    }
  }

  // Generate resources for all buildings (called every tick)
  tickGeneration() {
    for (const building of this.buildings.values()) {
      if (typeof building.generateResources === 'function') {
        building.generateResources(this.resourceManager);
      }
    }
  }

  // Clear all buildings
  clearAll() {
    // Remove all buildings and trigger their onRemoved callbacks
    const buildingsCopy = Array.from(this.buildings.values());
    for (const building of buildingsCopy) {
      this.removeBuilding(building.x, building.y);
    }
  }

  // Get statistics about all buildings
  getStats() {
    const houseCount = this.getBuildingCount('house');
    const stats = {
      total: this.buildings.size,
      houses: houseCount,
      farms: this.getBuildingCount('farm'),
      lumberyards: this.getBuildingCount('lumberyard'),
      cobblepaths: this.getBuildingCount('cobblepath'),
      population: houseCount * 2, // Each house provides 2 population
      generationActive: this.generationInterval !== null
    };
    return stats;
  }

  // Export building data for saving
  exportData() {
    const data = [];
    for (const building of this.buildings.values()) {
      data.push({
        x: building.x,
        y: building.y,
        type: building.type,
        createdAt: building.createdAt
      });
    }
    return data;
  }

  // Import building data for loading
  importData(data) {
    this.clearAll();
    for (const buildingData of data) {
      // Skip resource costs when loading saved buildings (resources were already spent when originally built)
      this.placeBuilding(buildingData.x, buildingData.y, buildingData.type, null, true);
    }
  }

  // Get building configuration by type
  getBuildingConfig(type) {
    return BUILDING_CONFIGS[type] || null;
  }

  // Check if player can afford a building
  canAffordBuilding(type) {
    const config = BUILDING_CONFIGS[type];
    if (!config || !config.costs) {
      return true; // No costs, can always afford
    }
    return this.resourceManager.canAfford(config.costs);
  }

  // Get all building types
  static getBuildingTypes() {
    return Object.keys(BUILDING_CONFIGS);
  }

  // Cleanup
  destroy() {
    this.stopGeneration();
    this.clearAll();
  }
}
