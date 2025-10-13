import { Grid } from './grid.js';
import { WorldPresets } from './worldGenerator.js';
import { atlasManager } from './atlasManager.js';
import { ResourceManager } from './resources.js';
import { BuildingManager } from './buildings.js';
import { SaveManager } from './saveManager.js';
import { EventQueue } from './eventQueue.js';
import { TooltipManager } from './tooltips.js';
import { ResearchManager } from './research.js';

// Canvas Manager class for state management
class CanvasManager {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.canvas = null;
    this.grid = null;
    this.isInitialized = false;
  }

  // Create and setup the canvas
  createCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.canvas.style.border = '1px solid #ccc';
    this.canvas.style.cursor = 'grab';
    this.canvas.style.display = 'block';

    const canvasWrapper = document.querySelector('.canvas-wrapper');
    if (canvasWrapper) {
      // Insert canvas as first child
      canvasWrapper.insertBefore(this.canvas, canvasWrapper.firstChild);
      this.isInitialized = true;
    } else {
      console.error('canvas-wrapper element not found');
      return null;
    }

    return this.canvas;
  }

  // Initialize the grid system (infinite grid)
  initializeGrid(baseTileSize = 32) {
    if (!this.canvas) {
      console.error('Canvas must be created before initializing grid');
      return null;
    }

    this.grid = new Grid(this.canvas, baseTileSize);
    //this.grid.render(); // Initial render
    return this.grid;
  }

  // Resize the canvas
  resize(width, height) {
    if (this.canvas) {
      this.width = width;
      this.height = height;
      this.canvas.width = width;
      this.canvas.height = height;

      if (this.grid) {
        this.grid.render(); // Re-render after resize
      }
    }
  }

  // Get canvas dimensions
  getDimensions() {
    return { width: this.width, height: this.height };
  }

  // Clear the canvas
  clear() {
    if (this.canvas) {
      const ctx = this.canvas.getContext('2d');
      ctx.clearRect(0, 0, this.width, this.height);
    }
  }

  // Show/hide the canvas
  setVisible(visible) {
    if (this.canvas) {
      this.canvas.style.display = visible ? 'block' : 'none';
    }
  }

  // Get grid info if available
  getGridInfo() {
    return this.grid ? this.grid.getViewportInfo() : null;
  }

  // Cleanup
  destroy() {
    if (this.grid) {
      this.grid.destroy();
      this.grid = null;
    }
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    this.isInitialized = false;
  }
}

// Legacy function for backwards compatibility
function createCanvas(width, height) {
  const manager = new CanvasManager(width, height);
  return manager.createCanvas();
}

// Positioning utilities removed - now handled by CSS

// Setup world generation controls functionality
function setupWorldControls(grid) {
  // Validate grid and worldGenerator existence
  if (!grid || !grid.worldGenerator) {
    console.error('setupWorldControls: Invalid grid or missing worldGenerator');
    return null;
  }

  // Get initial seed value with null safety and update the input
  const initialSeed = grid.worldGenerator.seed || Math.random();
  const seedInputValue = Math.floor(initialSeed * 1000000);
  const seedInput = document.querySelector('#worldSeed');
  if (seedInput) {
    //seedInput.value = seedInputValue;
  }

  // Toggle generation button
  const toggleBtn = document.querySelector('#toggleGeneration');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      if (!grid || typeof grid.disableProceduralGeneration !== 'function' || typeof grid.enableProceduralGeneration !== 'function') {
        console.error('Grid methods not available for toggle generation');
        return;
      }

      if (grid.proceduralGeneration) {
        grid.disableProceduralGeneration();
        toggleBtn.textContent = 'Enable Generation';
      } else {
        grid.enableProceduralGeneration();
        toggleBtn.textContent = 'Disable Generation';
      }
    });
  }

  // Regenerate world button
  const regenerateBtn = document.querySelector('#regenerateWorld');
  if (regenerateBtn) {
    regenerateBtn.addEventListener('click', () => {
      if (!grid || typeof grid.clearGeneratedTerrain !== 'function') {
        console.error('Grid clearGeneratedTerrain method not available');
        return;
      }
      grid.clearGeneratedTerrain();
    });
  }

  // Seed controls - seedInput already declared above
  const randomSeedBtn = document.querySelector('#randomSeed');

  if (seedInput) {
    seedInput.addEventListener('change', () => {
      if (!grid || typeof grid.setWorldSeed !== 'function') {
        console.error('Grid setWorldSeed method not available');
        return;
      }
      const seed = parseFloat(seedInput.value) / 1000000;
      grid.setWorldSeed(seed);
    });
  }

  if (randomSeedBtn) {
    randomSeedBtn.addEventListener('click', () => {
      if (!grid || typeof grid.setWorldSeed !== 'function' || !seedInput) {
        console.error('Grid setWorldSeed method or seedInput not available');
        return;
      }
      const newSeed = Math.random();
      seedInput.value = Math.floor(newSeed * 1000000);
      grid.setWorldSeed(newSeed);
    });
  }

  // Preset selector
  const presetSelect = document.querySelector('#worldPreset');
  if (presetSelect) {
    presetSelect.addEventListener('change', () => {
      if (!grid || typeof grid.updateWorldParameters !== 'function') {
        console.error('Grid updateWorldParameters method not available');
        return;
      }
      const presetName = presetSelect.value;
      if (presetName && WorldPresets[presetName]) {
        const preset = WorldPresets[presetName];
        grid.updateWorldParameters(preset);

        // Update UI to reflect preset values
        updateControlsFromGrid(grid);
      }
    });
  }

  // Slider controls
  const scaleSlider = document.querySelector('#worldScale');
  const scaleValue = document.querySelector('#scaleValue');
  const octaveSlider = document.querySelector('#worldOctaves');
  const octaveValue = document.querySelector('#octaveValue');
  const persistenceSlider = document.querySelector('#worldPersistence');
  const persistenceValue = document.querySelector('#persistenceValue');

  if (scaleSlider && scaleValue) {
    scaleSlider.addEventListener('input', () => {
      if (!grid || typeof grid.updateWorldParameters !== 'function') {
        console.error('Grid updateWorldParameters method not available');
        return;
      }
      const value = parseFloat(scaleSlider.value);
      scaleValue.textContent = value.toFixed(3);
      grid.updateWorldParameters({ scale: value });
    });
  }

  if (octaveSlider && octaveValue) {
    octaveSlider.addEventListener('input', () => {
      if (!grid || typeof grid.updateWorldParameters !== 'function') {
        console.error('Grid updateWorldParameters method not available');
        return;
      }
      const value = parseInt(octaveSlider.value);
      octaveValue.textContent = value;
      grid.updateWorldParameters({ octaves: value });
    });
  }

  if (persistenceSlider && persistenceValue) {
    persistenceSlider.addEventListener('input', () => {
      if (!grid || typeof grid.updateWorldParameters !== 'function') {
        console.error('Grid updateWorldParameters method not available');
        return;
      }
      const value = parseFloat(persistenceSlider.value);
      persistenceValue.textContent = value.toFixed(1);
      grid.updateWorldParameters({ persistence: value });
    });
  }

  // Update controls from grid state
  function updateControlsFromGrid(grid) {
    if (!grid || typeof grid.getWorldStats !== 'function') {
      console.error('Grid getWorldStats method not available');
      return;
    }

    try {
      const stats = grid.getWorldStats();
      if (stats && stats.parameters) {
        if (scaleSlider) scaleSlider.value = stats.parameters.scale;
        if (scaleValue) scaleValue.textContent = stats.parameters.scale.toFixed(3);
        if (octaveSlider) octaveSlider.value = stats.parameters.octaves;
        if (octaveValue) octaveValue.textContent = stats.parameters.octaves;
        if (persistenceSlider) persistenceSlider.value = stats.parameters.persistence;
        if (persistenceValue) persistenceValue.textContent = stats.parameters.persistence.toFixed(1);
        if (seedInput) seedInput.value = Math.floor(stats.seed * 1000000);
      }
    } catch (error) {
      console.error('Error updating controls from grid:', error);
    }
  }

  // Update stats periodically
  const statsElement = document.querySelector('#worldStats');
  if (statsElement) {
    setInterval(() => {
      if (!grid || typeof grid.getTotalTilesCount !== 'function') {
        return;
      }
      try {
        const counts = grid.getTotalTilesCount();
        if (counts) {
          statsElement.textContent = `Generated: ${counts.generated} | Painted: ${counts.painted}`;
        }
      } catch (error) {
        console.error('Error updating stats:', error);
      }
    }, 1000);
  }
}

// Setup paint controls functionality (now for buildings)
function setupPaintControls(grid, buildingManager) {
  // Building button event listeners
  const buildingButtons = document.querySelectorAll('#paintControls .building-btn');
  const currentBuildingIndicator = document.querySelector('#paintControls .building-indicator');

  // Update button tooltips to show costs
  buildingButtons.forEach(button => {
    const buildingType = button.dataset.building;
    const config = buildingManager.getBuildingConfig(buildingType);

    if (config) {
      let tooltip = config.description;
      if (config.costs) {
        const costStr = Object.entries(config.costs)
          .map(([type, amount]) => `${amount} ${type}`)
          .join(', ');
        tooltip += ` | Cost: ${costStr}`;
      }
      button.title = tooltip;
    }

    button.addEventListener('click', () => {
      grid.setBuildingType(buildingType);

      // Update visual feedback
      buildingButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      if (currentBuildingIndicator) {
        currentBuildingIndicator.textContent = button.textContent;
      }
    });
  });

  // Update button affordability and locked state periodically
  const updateBuildingAffordability = () => {
    buildingButtons.forEach(button => {
      const buildingType = button.dataset.building;
      const canAfford = buildingManager.canAffordBuilding(buildingType);

      // Check if building is locked via research
      const researchManager = buildingManager.researchManager;
      const isLocked = researchManager && !researchManager.isBuildingUnlocked(buildingType);

      // Store original text if not already stored
      if (!button.dataset.originalText) {
        button.dataset.originalText = button.textContent;
      }

      if (isLocked) {
        // Building is locked - show lock icon and disable
        button.classList.add('unaffordable');
        button.style.opacity = '0.4';
        button.disabled = true;
        button.style.cursor = 'not-allowed';

        // Add lock icon if not already present
        if (!button.textContent.includes('🔒')) {
          button.textContent = '🔒 ' + button.dataset.originalText;
        }
        button.title = button.title + ' [LOCKED - Requires Research]';
      } else {
        // Building is unlocked - check affordability
        button.disabled = false;
        button.style.cursor = 'pointer';

        // Remove lock icon if present
        if (button.textContent.includes('🔒')) {
          button.textContent = button.dataset.originalText;
        }

        if (canAfford) {
          button.classList.remove('unaffordable');
          button.style.opacity = '1';
        } else {
          button.classList.add('unaffordable');
          button.style.opacity = '0.5';
        }
      }
    });
  };

  // Update affordability immediately and periodically
  updateBuildingAffordability();
  setInterval(updateBuildingAffordability, 500);

  // Clear all button event listener
  const clearAllBtn = document.querySelector('#clearAllBtn');
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', () => {
      if (confirm('Clear all buildings?')) {
        grid.clearAllPaint();
      }
    });
  }

  // Update building stats periodically
  const buildingStatsElement = document.querySelector('#buildingStats');
  if (buildingStatsElement) {
    setInterval(() => {
      const stats = buildingManager.getStats();
      buildingStatsElement.textContent = `Population: ${stats.population} | Houses: ${stats.houses} | Farms: ${stats.farms} | Lumberyards: ${stats.lumberyards} | Paths: ${stats.cobblepaths}`;
    }, 500);
  }
}

// Setup resource display updates
function setupResourceDisplay(resourceManager) {
  const foodElement = document.getElementById('foodAmount');
  const workerElement = document.getElementById('workerAmount');
  const woodElement = document.getElementById('woodAmount');
  const stoneElement = document.getElementById('stoneAmount');

  // Helper function to format resource display with cap
  const formatResource = (name, value, type, element) => {
    const cap = resourceManager.getResourceCap(type);
    const percentage = resourceManager.getCapPercentage(type);

    // Format based on whether resource has a cap
    let displayText;
    if (cap === Infinity) {
      // No cap (workers) - display with 0 decimals
      displayText = `${name}: ${value.toFixed(0)}`;
    } else {
      // Has cap - display with 2 decimals
      displayText = `${name}: ${value.toFixed(2)}/${cap}`;
    }

    // Apply color based on cap percentage
    if (element) {
      if (percentage >= 100) {
        element.style.color = '#ff6b6b'; // Red when at cap
        element.style.fontWeight = 'bold';
      } else if (percentage >= 90) {
        element.style.color = '#ffa500'; // Orange when near cap
        element.style.fontWeight = 'bold';
      } else {
        element.style.color = ''; // Default color
        element.style.fontWeight = '';
      }
    }

    return displayText;
  };

  // Update display function
  const updateDisplay = (type, value) => {
    if (type === 'food' && foodElement) {
      foodElement.textContent = formatResource('Food', value, type, foodElement);
    } else if (type === 'worker' && workerElement) {
      workerElement.textContent = formatResource('Worker', value, type, workerElement);
    } else if (type === 'wood' && woodElement) {
      woodElement.textContent = formatResource('Wood', value, type, woodElement);
    } else if (type === 'stone' && stoneElement) {
      stoneElement.textContent = formatResource('Stone', value, type, stoneElement);
    }
  };

  // Register listener with resource manager
  resourceManager.addListener(updateDisplay);

  // Initial display update
  foodElement.textContent = formatResource('Food', resourceManager.getResource('food'), 'food', foodElement);
  workerElement.textContent = formatResource('Worker', resourceManager.getResource('worker'), 'worker', workerElement);
  woodElement.textContent = formatResource('Wood', resourceManager.getResource('wood'), 'wood', woodElement);
  stoneElement.textContent = formatResource('Stone', resourceManager.getResource('stone'), 'stone', stoneElement);
}

// Setup save/load controls
function setupSaveControls(saveManager) {
  const saveBtn = document.getElementById('saveGameBtn');
  const loadBtn = document.getElementById('loadGameBtn');
  const clearSaveBtn = document.getElementById('clearSaveBtn');
  const saveInfoElement = document.getElementById('saveInfo');

  // Save button
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const success = saveManager.saveGame();
      if (success) {
        // Show feedback
        saveBtn.textContent = '✓ Saved!';
        setTimeout(() => {
          saveBtn.textContent = 'Save Game';
        }, 2000);
      } else {
        saveBtn.textContent = '✗ Failed';
        setTimeout(() => {
          saveBtn.textContent = 'Save Game';
        }, 2000);
      }
    });
  }

  // Load button
  if (loadBtn) {
    loadBtn.addEventListener('click', () => {
      if (confirm('Load saved game? Current progress will be lost if not saved.')) {
        const saveData = saveManager.loadGame();
        if (saveData) {
          const success = saveManager.applySaveData(saveData);
          if (success) {
            loadBtn.textContent = '✓ Loaded!';
            setTimeout(() => {
              loadBtn.textContent = 'Load Game';
            }, 2000);
          }
        } else {
          alert('No saved game found or failed to load.');
        }
      }
    });
  }

  // Clear save button
  if (clearSaveBtn) {
    clearSaveBtn.addEventListener('click', () => {
      if (confirm('Delete saved game? This cannot be undone!')) {
        const success = saveManager.clearSave();
        if (success) {
          clearSaveBtn.textContent = '✓ Cleared';
          setTimeout(() => {
            clearSaveBtn.textContent = 'Clear Save';
          }, 2000);
        }
      }
    });
  }

  // Update save info display
  const updateSaveInfo = () => {
    if (saveInfoElement) {
      const saveInfo = saveManager.getSaveInfo();
      if (saveInfo) {
        const timeAgo = Math.floor((Date.now() - saveInfo.timestamp) / 1000 / 60); // minutes ago
        saveInfoElement.textContent = `Last save: ${timeAgo}m ago (${saveInfo.buildingCount} buildings)`;
      } else {
        saveInfoElement.textContent = 'Auto-save: every 30s';
      }
    }
  };

  // Update save info periodically
  updateSaveInfo();
  setInterval(updateSaveInfo, 10000); // Update every 10 seconds
}

// Setup research controls
function setupResearchControls(researchManager) {
  const researchButtons = document.querySelectorAll('#researchControls .research-btn');
  const researchStatsElement = document.querySelector('#researchStats');

  // Research button event listeners
  researchButtons.forEach(button => {
    const researchId = button.dataset.research;

    button.addEventListener('click', () => {
      const result = researchManager.purchaseResearch(researchId);

      if (result.success) {
        // Update button state immediately
        updateResearchButtons();
      } else {
        console.log(`Failed to purchase research: ${result.error}`);
      }
    });
  });

  // Update button states based on research availability
  const updateResearchButtons = () => {
    researchButtons.forEach(button => {
      const researchId = button.dataset.research;
      const isCompleted = researchManager.isCompleted(researchId);
      const isAvailable = researchManager.isAvailable(researchId);
      const canAfford = researchManager.canAfford(researchId);

      // Remove all state classes
      button.classList.remove('completed', 'available', 'locked', 'unaffordable');

      if (isCompleted) {
        button.classList.add('completed');
        button.disabled = true;
        button.style.opacity = '0.6';
      } else if (isAvailable) {
        button.classList.add('available');
        button.disabled = false;

        if (canAfford) {
          button.style.opacity = '1';
        } else {
          button.classList.add('unaffordable');
          button.style.opacity = '0.5';
        }
      } else {
        button.classList.add('locked');
        button.disabled = true;
        button.style.opacity = '0.4';
      }
    });
  };

  // Update research stats periodically
  const updateResearchStats = () => {
    if (researchStatsElement) {
      const stats = researchManager.getStats();
      researchStatsElement.textContent = `Completed: ${stats.completed}/${stats.total} | Available: ${stats.available}`;
    }
  };

  // Update immediately and periodically
  updateResearchButtons();
  updateResearchStats();
  setInterval(updateResearchButtons, 500);
  setInterval(updateResearchStats, 1000);
}

// Example usage and initialization
document.addEventListener('DOMContentLoaded', async function() {
  console.log('Initializing tile game...');

  // Initialize event queue
  const eventQueue = new EventQueue();
  console.log('Event queue initialized');

  // Initialize save manager
  const saveManager = new SaveManager({
    autoSaveInterval: 30000 // Auto-save every 30 seconds (optional)
  });

  // Initialize resource manager
  const resourceManager = new ResourceManager();
  console.log('Resource manager initialized');

  // Initialize building manager with event queue
  const buildingManager = new BuildingManager(resourceManager, eventQueue);
  console.log('Building manager initialized');

  // Initialize research manager
  const researchManager = new ResearchManager(resourceManager, eventQueue);
  console.log('Research manager initialized');

  // Connect research manager to building manager (for unlock checks)
  buildingManager.setResearchManager(researchManager);

  // Load the tile atlas first
  try {
    console.log('Loading tile atlas...');
    await atlasManager.loadAtlas('./tile_sprites/tile_atlas.png');
    console.log('Tile atlas loaded successfully!');
  } catch (error) {
    console.warn('Failed to load tile atlas, using fallback colors:', error);
  }

  // Load building sprites
  try {
    console.log('Loading building sprites...');
    await Promise.all([
      atlasManager.loadBuildingSprite('house', './tile_sprites/pixelarthouse.png'),
      atlasManager.loadBuildingSprite('barn', './tile_sprites/barn.png'),
      atlasManager.loadBuildingSprite('farmland', './tile_sprites/farmland.png'),
      atlasManager.loadBuildingSprite('lumberyard', './tile_sprites/lumberyard.png'),
      atlasManager.loadBuildingSprite('cobblepath', './tile_sprites/cobblepath.png'),
      atlasManager.loadBuildingSprite('stonequarry', './tile_sprites/stonequarry.png'),
      atlasManager.loadBuildingSprite('warehouse', './tile_sprites/warehouse.png'),
      atlasManager.loadBuildingSprite('researchLab', './tile_sprites/researchLab.png')
    ]);
    console.log('Building sprites loaded successfully!');
  } catch (error) {
    console.warn('Failed to load some building sprites, using fallback colors:', error);
  }

  // Create a canvas manager instance
  const canvasManager = new CanvasManager(1600, 900);

  // Create the canvas
  const canvas = canvasManager.createCanvas();

  if (canvas) {
    // Initialize the infinite grid with 32px base tile size
    const grid = canvasManager.initializeGrid(32);

    if (grid) {
      console.log('Interactive infinite grid initialized successfully!');
      console.log('- Click and drag to pan around the grid');
      console.log('- Scroll wheel to zoom in/out');
      console.log('- Base tile size: 32px');
      console.log('- Grid dimensions: infinite');

      // Validate worldGenerator is properly initialized
      if (!grid.worldGenerator) {
        console.error('Grid worldGenerator not initialized - world controls will be disabled');
      } else {
        console.log('WorldGenerator initialized successfully');
      }

      // Connect building manager to grid (needed before loading saved buildings)
      grid.setBuildingManager(buildingManager);

      // Initialize tooltip manager
      const tooltipManager = new TooltipManager();
      grid.setTooltipManager(tooltipManager);
      console.log('Tooltip manager initialized');

      // Set up save manager with references to game managers
      saveManager.setManagers({
        resourceManager,
        buildingManager,
        researchManager,
        grid
      });

      // Check for saved game and load if it exists
      if (saveManager.hasSavedGame()) {
        console.log('📂 Found saved game, loading...');
        const saveData = saveManager.loadGame();
        if (saveData) {
          saveManager.applySaveData(saveData);
          console.log('✅ Saved game loaded successfully!');
        } else {
          console.warn('⚠️ Failed to load saved game, starting fresh');
          // Apply default starting resources
          resourceManager.setResource('wood', 50);
          console.log('Starting resources: 50 wood');
        }
      } else {
        console.log('No saved game found, starting fresh');
        // Apply default starting resources
        resourceManager.setResource('wood', 50);
        console.log('Starting resources: 50 wood');
      }

      // Info display elements already exist in HTML - just get references for updates

      // Update viewport info during interaction
      const updateViewportInfo = () => {
        const viewportInfo = canvasManager.getGridInfo();
        if (viewportInfo) {
          const viewportInfoElement = document.getElementById('viewport-info');
          const zoomInfoElement = document.getElementById('zoom-info');
          const modeInfoElement = document.getElementById('mode-info');
          const paintInfoElement = document.getElementById('paint-info');
          const terrainInfoElement = document.getElementById('terrain-info');
          const atlasInfoElement = document.getElementById('atlas-info');

          if (viewportInfoElement) {
            // Calculate center grid coordinates
            const centerX = (viewportInfo.x + canvas.width / 2) / viewportInfo.tileSize;
            const centerY = (viewportInfo.y + canvas.height / 2) / viewportInfo.tileSize;

            viewportInfoElement.textContent =
              `Center: (${Math.round(centerX)}, ${Math.round(centerY)})`;
          }

          if (zoomInfoElement) {
            zoomInfoElement.textContent =
              `Zoom: ${viewportInfo.zoomLevel.toFixed(1)}x (${Math.round(viewportInfo.tileSize)}px tiles)`;
          }

          if (modeInfoElement && grid) {
            let mode = 'Pan';
            if (grid.selectionMode) mode = 'Selection';
            else if (grid.paintMode) mode = 'Paint';
            modeInfoElement.textContent = `Mode: ${mode}`;
          }

          if (paintInfoElement && grid) {
            const counts = grid.getTotalTilesCount();
            paintInfoElement.textContent = `Painted: ${counts.painted} | Generated: ${counts.generated}`;
          }

          // Show terrain info for center tile
          if (terrainInfoElement && grid) {
            const centerX = Math.floor((viewportInfo.x + canvas.width / 2) / viewportInfo.tileSize);
            const centerY = Math.floor((viewportInfo.y + canvas.height / 2) / viewportInfo.tileSize);
            const centerTile = grid.getOrGenerateTile(centerX, centerY);

            if (centerTile && centerTile.terrainType) {
              terrainInfoElement.textContent = `Terrain: ${centerTile.terrainType.name} (${centerTile.elevation.toFixed(2)})`;
            } else {
              terrainInfoElement.textContent = 'Terrain: None';
            }
          }

          // Show atlas status
          if (atlasInfoElement) {
            const atlasStatus = atlasManager.getStatus();
            const statusText = atlasStatus.isLoaded ?
              `Atlas: ✓ (${atlasStatus.cacheSize} cached)` :
              'Atlas: ✗ (using colors)';
            atlasInfoElement.textContent = statusText;
          }
        }
      };

      // Update info periodically
      setInterval(updateViewportInfo, 100);

      // Start building resource generation
      buildingManager.startGeneration();

      // Start auto-save (if enabled)
      saveManager.startAutoSave();

      // Setup world generation controls
      try {
        setupWorldControls(grid);
      } catch (error) {
        console.error('Error setting up world controls:', error);
        console.warn('World controls unavailable, but continuing with initialization');
      }

      // Setup paint controls (now for buildings)
      try {
        setupPaintControls(grid, buildingManager);
      } catch (error) {
        console.error('Error setting up paint controls:', error);
        console.warn('Paint controls unavailable, but continuing with initialization');
      }

      // Setup resource display
      try {
        setupResourceDisplay(resourceManager);
        console.log('Resource display initialized');
      } catch (error) {
        console.error('Error setting up resource display:', error);
      }

      // Setup save controls
      try {
        setupSaveControls(saveManager);
        console.log('Save controls initialized');
      } catch (error) {
        console.error('Error setting up save controls:', error);
      }

      // Setup research controls
      try {
        setupResearchControls(researchManager);
        console.log('Research controls initialized');
      } catch (error) {
        console.error('Error setting up research controls:', error);
      }

      // Initialize Research tab visibility based on whether player has a research lab
      try {
        const researchTab = document.querySelector('[data-window="researchControls"]');
        if (researchTab) {
          if (buildingManager.hasResearchLab()) {
            researchTab.style.display = 'block';
            console.log('Research tab shown - Research Lab found');
          } else {
            researchTab.style.display = 'none';
            console.log('Research tab hidden - No Research Lab');
          }
        }
      } catch (error) {
        console.error('Error setting Research tab visibility:', error);
      }

      // Initialize paint controls visibility (hidden by default)
      //grid.updatePaintControlsVisibility();

      // Add welcome messages to event queue
      eventQueue.addMessage('Welcome to the game!');
      eventQueue.addMessage('Use the sidebar to navigate controls.');

      // Make canvas manager globally accessible for debugging
      window.canvasManager = canvasManager;
      window.grid = grid;
      window.resources = resourceManager;
      window.buildings = buildingManager;
      window.research = researchManager;
      window.saveManager = saveManager;
      window.eventQueue = eventQueue;
      window.tooltipManager = tooltipManager;

      // Add tile system testing functions
      window.validateTiles = () => grid.validateTileSystem();
      window.exportTiles = () => grid.exportTileData();
      window.importTiles = (data) => grid.importTileData(data);
      window.getDragState = () => grid.getDragState();

      // Add atlas debugging functions
      window.atlasManager = atlasManager;
      window.getAtlasStatus = () => atlasManager.getStatus();
      window.clearAtlasCache = () => atlasManager.clearCache();

      // Test function to verify moveViewportToOrigin is accessible
      window.testMoveToOrigin = function() {
        console.log('Testing moveViewportToOrigin function...');
        console.log('Grid object:', grid);
        console.log('moveViewportToOrigin function:', grid.moveViewportToOrigin);
        if (typeof grid.moveViewportToOrigin === 'function') {
          console.log('Function exists! Calling it...');
          grid.moveViewportToOrigin();
        } else {
          console.error('moveViewportToOrigin is not a function!');
        }
      };
      console.log('Test function added. Call window.testMoveToOrigin() in console to test.');
    }
  }
});
