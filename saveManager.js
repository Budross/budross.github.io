// SaveManager for tile game - handles localStorage persistence
// Manages saving and loading of game state including resources, buildings, and world seed

export class SaveManager {
  constructor(options = {}) {
    this.storageKey = options.storageKey || 'tileGameSave';
    this.version = options.version || '1.0';
    this.autoSaveInterval = options.autoSaveInterval || null; // milliseconds, null = disabled
    this.autoSaveTimer = null;

    // References to game managers (set via setManagers)
    this.resourceManager = null;
    this.buildingManager = null;
    this.researchManager = null;
    this.grid = null;
  }

  /**
   * Set references to game managers for save/load operations
   * @param {Object} managers - Object containing resourceManager, buildingManager, researchManager, grid
   */
  setManagers(managers) {
    this.resourceManager = managers.resourceManager;
    this.buildingManager = managers.buildingManager;
    this.researchManager = managers.researchManager;
    this.grid = managers.grid;
  }

  /**
   * Check if saved game data exists
   * @returns {boolean}
   */
  hasSavedGame() {
    try {
      const savedData = localStorage.getItem(this.storageKey);
      return savedData !== null;
    } catch (error) {
      console.error('Error checking for saved game:', error);
      return false;
    }
  }

  /**
   * Save current game state to localStorage
   * @returns {boolean} - Success status
   */
  saveGame() {
    try {
      // Validate managers are set
      if (!this.resourceManager || !this.buildingManager || !this.grid) {
        console.error('SaveManager: Managers not set. Call setManagers() first.');
        return false;
      }

      // Get world stats to extract seed
      const worldStats = this.grid.getWorldStats();

      // Get viewport info for convenience
      const viewportInfo = this.grid.getViewportInfo();

      // Construct save data
      const saveData = {
        version: this.version,
        timestamp: Date.now(),

        // Resources
        resources: this.resourceManager.getAllResources(),

        // Buildings
        buildings: this.buildingManager.exportData(),

        // Research (if available)
        research: this.researchManager ? this.researchManager.exportData() : null,

        // World generation seed
        worldSeed: worldStats.seed,

        // Viewport state (optional, for convenience)
        viewport: {
          x: viewportInfo.x,
          y: viewportInfo.y,
          zoomLevel: viewportInfo.zoomLevel
        }
      };

      // Serialize and save
      const serialized = JSON.stringify(saveData);
      localStorage.setItem(this.storageKey, serialized);

      console.log('💾 Game saved successfully:', {
        timestamp: new Date(saveData.timestamp).toLocaleString(),
        resources: saveData.resources,
        buildingCount: saveData.buildings.length,
        researchCount: saveData.research?.completedResearch?.length || 0,
        seed: saveData.worldSeed
      });

      return true;
    } catch (error) {
      console.error('Error saving game:', error);
      return false;
    }
  }

  /**
   * Load game state from localStorage
   * @returns {Object|null} - Loaded save data or null if failed
   */
  loadGame() {
    try {
      const savedDataString = localStorage.getItem(this.storageKey);

      if (!savedDataString) {
        console.log('No saved game found');
        return null;
      }

      // Parse saved data
      const saveData = JSON.parse(savedDataString);

      // Validate save data structure
      if (!this.validateSaveData(saveData)) {
        console.error('Invalid save data structure');
        return null;
      }

      console.log('📂 Game loaded successfully:', {
        timestamp: new Date(saveData.timestamp).toLocaleString(),
        version: saveData.version,
        resources: saveData.resources,
        buildingCount: saveData.buildings.length,
        seed: saveData.worldSeed
      });

      return saveData;
    } catch (error) {
      console.error('Error loading game:', error);
      return null;
    }
  }

  /**
   * Apply loaded save data to game managers
   * @param {Object} saveData - The loaded save data
   * @returns {boolean} - Success status
   */
  applySaveData(saveData) {
    try {
      // Validate managers are set
      if (!this.resourceManager || !this.buildingManager || !this.grid) {
        console.error('SaveManager: Managers not set. Call setManagers() first.');
        return false;
      }

      // Apply viewport first (before seed) so if seed changes, regeneration happens at correct location
      if (saveData.viewport) {
        this.grid.viewportX = saveData.viewport.x;
        this.grid.viewportY = saveData.viewport.y;
        this.grid.zoomLevel = saveData.viewport.zoomLevel;
        console.log('🔭 Viewport restored:', saveData.viewport);
      }

      // Apply world seed (must be done before buildings are placed)
      // If seed is unchanged, this will skip regeneration (see grid.setWorldSeed)
      if (saveData.worldSeed !== undefined) {
        this.grid.setWorldSeed(saveData.worldSeed);
        console.log(`🌍 World seed restored: ${saveData.worldSeed}`);
      }

      // Apply research (must be done before buildings to unlock them)
      if (saveData.research && this.researchManager) {
        this.researchManager.importData(saveData.research);
        console.log(`📚 Research progress restored: ${saveData.research.completedResearch?.length || 0} completed`);
      }

      // Apply resources
      if (saveData.resources) {
        for (const [resourceType, amount] of Object.entries(saveData.resources)) {
          this.resourceManager.setResource(resourceType, amount);
        }
        console.log('💰 Resources restored:', saveData.resources);
      }

      // Apply buildings
      if (saveData.buildings && Array.isArray(saveData.buildings)) {
        this.buildingManager.importData(saveData.buildings);
        console.log(`🏘️ ${saveData.buildings.length} buildings restored`);

        // Sync buildings to visual tiles (required for rendering)
        this.grid.syncBuildingsToTiles();
      }

      // Final render to display everything
      this.grid.render();

      return true;
    } catch (error) {
      console.error('Error applying save data:', error);
      return false;
    }
  }

  /**
   * Validate save data structure
   * @param {Object} saveData - Data to validate
   * @returns {boolean}
   */
  validateSaveData(saveData) {
    if (!saveData || typeof saveData !== 'object') {
      return false;
    }

    // Check required fields
    if (!saveData.version || !saveData.timestamp) {
      console.warn('Save data missing version or timestamp');
      return false;
    }

    // Check version compatibility (currently just checking it exists)
    // Future: implement version migration logic here
    if (saveData.version !== this.version) {
      console.warn(`Save data version mismatch: ${saveData.version} vs ${this.version}`);
      // For now, we'll allow different versions (could add migration logic later)
    }

    // Validate resources object
    if (saveData.resources && typeof saveData.resources !== 'object') {
      console.warn('Invalid resources data');
      return false;
    }

    // Validate buildings array
    if (saveData.buildings && !Array.isArray(saveData.buildings)) {
      console.warn('Invalid buildings data');
      return false;
    }

    // Validate world seed
    if (saveData.worldSeed !== undefined && typeof saveData.worldSeed !== 'number') {
      console.warn('Invalid world seed');
      return false;
    }

    return true;
  }

  /**
   * Clear saved game data
   * @returns {boolean}
   */
  clearSave() {
    try {
      localStorage.removeItem(this.storageKey);
      console.log('🗑️ Save data cleared');
      return true;
    } catch (error) {
      console.error('Error clearing save data:', error);
      return false;
    }
  }

  /**
   * Get save data info without loading it
   * @returns {Object|null}
   */
  getSaveInfo() {
    try {
      const savedDataString = localStorage.getItem(this.storageKey);
      if (!savedDataString) {
        return null;
      }

      const saveData = JSON.parse(savedDataString);
      return {
        version: saveData.version,
        timestamp: saveData.timestamp,
        buildingCount: saveData.buildings?.length || 0,
        seed: saveData.worldSeed,
        hasViewport: !!saveData.viewport
      };
    } catch (error) {
      console.error('Error getting save info:', error);
      return null;
    }
  }

  /**
   * Start auto-save timer
   */
  startAutoSave() {
    if (!this.autoSaveInterval || this.autoSaveInterval <= 0) {
      console.log('Auto-save disabled (interval not set)');
      return;
    }

    if (this.autoSaveTimer) {
      console.warn('Auto-save already running');
      return;
    }

    this.autoSaveTimer = setInterval(() => {
      console.log('🔄 Auto-saving...');
      this.saveGame();
    }, this.autoSaveInterval);

    console.log(`⏰ Auto-save started (every ${this.autoSaveInterval / 1000}s)`);
  }

  /**
   * Stop auto-save timer
   */
  stopAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
      console.log('⏸️ Auto-save stopped');
    }
  }

  /**
   * Export save data as JSON string (for manual backup)
   * @returns {string|null}
   */
  exportSaveDataAsJSON() {
    try {
      const savedDataString = localStorage.getItem(this.storageKey);
      if (!savedDataString) {
        console.log('No save data to export');
        return null;
      }
      return savedDataString;
    } catch (error) {
      console.error('Error exporting save data:', error);
      return null;
    }
  }

  /**
   * Import save data from JSON string (for manual restore)
   * @param {string} jsonString - Serialized save data
   * @returns {boolean}
   */
  importSaveDataFromJSON(jsonString) {
    try {
      // Validate it's valid JSON
      const saveData = JSON.parse(jsonString);

      // Validate structure
      if (!this.validateSaveData(saveData)) {
        console.error('Invalid save data structure');
        return false;
      }

      // Save to localStorage
      localStorage.setItem(this.storageKey, jsonString);
      console.log('📥 Save data imported successfully');
      return true;
    } catch (error) {
      console.error('Error importing save data:', error);
      return false;
    }
  }

  /**
   * Cleanup - stop auto-save
   */
  destroy() {
    this.stopAutoSave();
  }
}
