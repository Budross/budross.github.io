// Research system for tile game
// Manages technology unlocks and upgrades

// ============================================================================
// RESEARCH CONFIGURATION - Edit costs and effects here
// ============================================================================
export const RESEARCH_CONFIGS = {
  advancedConstruction: {
    id: 'advancedConstruction',
    name: 'Advanced Construction',
    description: 'Learn advanced building techniques to construct warehouses',

    // Resource costs to research
    costs: {
      food: 100,
    },

    // Prerequisites (other research IDs that must be completed first)
    requires: [],

    // What this research unlocks
    unlocks: {
      buildings: ['warehouse']
    },

    // Visual properties
    display: {
      icon: '🏗️',
      category: 'buildings'
    }
  },

  stoneMining: {
    id: 'stoneMining',
    name: 'Stone Mining',
    description: 'Develop techniques for extracting stone from quarries',

    costs: {
      food: 150
    },

    requires: [],

    unlocks: {
      buildings: ['stonequarry']
    },

    display: {
      icon: '⛏️',
      category: 'buildings'
    }
  },

  storageExpansion: {
    id: 'storageExpansion',
    name: 'Storage Expansion',
    description: 'Improve storage efficiency to hold more resources',

    costs: {
      food: 200
    },

    requires: ['advancedConstruction'],

    unlocks: {
      effects: {
        foodCap: 50,
        woodCap: 50,
        stoneCap: 50
      }
    },

    display: {
      icon: '📦',
      category: 'upgrades'
    }
  }
};

// Research Manager - coordinates all research and unlocks
export class ResearchManager {
  constructor(resourceManager, eventQueue = null) {
    this.resourceManager = resourceManager;
    this.eventQueue = eventQueue;

    // Track completed research by ID
    this.completedResearch = new Set();

    // Track which buildings are unlocked
    this.unlockedBuildings = new Set([
      'house',        // Starting buildings
      'farm',
      'lumberyard',
      'cobblepath',
      'researchLab'   // Research Lab is always available from start
    ]);
  }

  /**
   * Check if research is available to be purchased
   * @param {string} researchId - Research ID
   * @returns {boolean}
   */
  isAvailable(researchId) {
    const config = RESEARCH_CONFIGS[researchId];
    if (!config) return false;

    // Already completed?
    if (this.isCompleted(researchId)) return false;

    // Check prerequisites
    if (config.requires && config.requires.length > 0) {
      for (const prereqId of config.requires) {
        if (!this.isCompleted(prereqId)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Check if research is completed
   * @param {string} researchId - Research ID
   * @returns {boolean}
   */
  isCompleted(researchId) {
    return this.completedResearch.has(researchId);
  }

  /**
   * Check if player can afford research
   * @param {string} researchId - Research ID
   * @returns {boolean}
   */
  canAfford(researchId) {
    const config = RESEARCH_CONFIGS[researchId];
    if (!config || !config.costs) return true;

    return this.resourceManager.canAfford(config.costs);
  }

  /**
   * Purchase research (instant unlock)
   * @param {string} researchId - Research ID
   * @returns {Object} - {success: boolean, error: string|null}
   */
  purchaseResearch(researchId) {
    const config = RESEARCH_CONFIGS[researchId];

    // Validate research exists
    if (!config) {
      return {
        success: false,
        error: `Unknown research: ${researchId}`
      };
    }

    // Check if already completed
    if (this.isCompleted(researchId)) {
      return {
        success: false,
        error: 'Research already completed'
      };
    }

    // Check if available (prerequisites met)
    if (!this.isAvailable(researchId)) {
      return {
        success: false,
        error: 'Prerequisites not met'
      };
    }

    // Check resource costs
    if (!this.canAfford(researchId)) {
      const missingResources = [];
      for (const [resourceType, cost] of Object.entries(config.costs)) {
        const current = this.resourceManager.getResource(resourceType);
        if (current < cost) {
          missingResources.push(`${resourceType}: ${current}/${cost}`);
        }
      }
      const errorMsg = `Insufficient resources - ${missingResources.join(', ')}`;

      // Send event message
      if (this.eventQueue) {
        this.eventQueue.addMessage(`❌ ${config.name}: ${errorMsg}`);
      }

      return {
        success: false,
        error: errorMsg
      };
    }

    // Spend resources
    const spent = this.resourceManager.spend(config.costs);
    if (!spent) {
      return {
        success: false,
        error: 'Failed to deduct resources'
      };
    }

    // Complete research instantly
    this.completedResearch.add(researchId);

    // Apply unlocks
    this.applyUnlocks(config);

    // Log success
    console.log(`✅ Research completed: ${config.name}`);

    // Send event message
    if (this.eventQueue) {
      this.eventQueue.addMessage(`✓ Research completed: ${config.display.icon} ${config.name}`);
    }

    return {
      success: true,
      error: null
    };
  }

  /**
   * Apply research unlocks (buildings, effects, etc.)
   * @private
   */
  applyUnlocks(config) {
    const unlocks = config.unlocks || {};

    // Unlock buildings
    if (unlocks.buildings) {
      for (const buildingType of unlocks.buildings) {
        this.unlockedBuildings.add(buildingType);
        console.log(`🔓 Building unlocked: ${buildingType}`);
      }
    }

    // Apply effects (like cap increases)
    if (unlocks.effects) {
      for (const [effectType, value] of Object.entries(unlocks.effects)) {
        if (effectType.endsWith('Cap')) {
          // Resource cap increase
          const resourceType = effectType.replace('Cap', '');
          const currentCap = this.resourceManager.getResourceCap(resourceType);
          this.resourceManager.setResourceCap(resourceType, currentCap + value);
          console.log(`📈 ${resourceType} cap increased by ${value}`);
        }
      }
    }
  }

  /**
   * Check if a building type is unlocked
   * @param {string} buildingType - Building type
   * @returns {boolean}
   */
  isBuildingUnlocked(buildingType) {
    return this.unlockedBuildings.has(buildingType);
  }

  /**
   * Get all available research (not completed, prerequisites met)
   * @returns {Array} - Array of research configs
   */
  getAvailableResearch() {
    const available = [];
    for (const [id, config] of Object.entries(RESEARCH_CONFIGS)) {
      if (this.isAvailable(id)) {
        available.push(config);
      }
    }
    return available;
  }

  /**
   * Get all completed research
   * @returns {Array} - Array of research configs
   */
  getCompletedResearch() {
    const completed = [];
    for (const id of this.completedResearch) {
      const config = RESEARCH_CONFIGS[id];
      if (config) {
        completed.push(config);
      }
    }
    return completed;
  }

  /**
   * Get research statistics
   * @returns {Object}
   */
  getStats() {
    const total = Object.keys(RESEARCH_CONFIGS).length;
    const completed = this.completedResearch.size;
    const available = this.getAvailableResearch().length;

    return {
      total,
      completed,
      available,
      unlockedBuildings: Array.from(this.unlockedBuildings)
    };
  }

  /**
   * Export research data for saving
   * @returns {Object}
   */
  exportData() {
    return {
      completedResearch: Array.from(this.completedResearch),
      unlockedBuildings: Array.from(this.unlockedBuildings)
    };
  }

  /**
   * Import research data for loading
   * @param {Object} data
   */
  importData(data) {
    if (!data) return;

    // Clear existing data
    this.completedResearch.clear();

    // Import completed research
    if (data.completedResearch) {
      for (const researchId of data.completedResearch) {
        this.completedResearch.add(researchId);
      }
    }

    // Import unlocked buildings (or restore defaults)
    if (data.unlockedBuildings) {
      this.unlockedBuildings = new Set(data.unlockedBuildings);
    } else {
      // Restore default unlocked buildings
      this.unlockedBuildings = new Set([
        'house',
        'farm',
        'lumberyard',
        'cobblepath',
        'researchLab'
      ]);
    }

    console.log(`📚 Loaded ${this.completedResearch.size} completed research projects`);
  }

  /**
   * Reset all research (for debugging/testing)
   */
  reset() {
    this.completedResearch.clear();
    this.unlockedBuildings = new Set([
      'house',
      'farm',
      'lumberyard',
      'cobblepath',
      'researchLab'
    ]);
    console.log('🔄 Research progress reset');
  }

  /**
   * Get all research IDs
   * @returns {Array}
   */
  static getAllResearchIds() {
    return Object.keys(RESEARCH_CONFIGS);
  }
}
