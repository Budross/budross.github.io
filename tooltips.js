// Tooltip system for tile game
// Displays information about terrain and building tiles on hover

export class TooltipManager {
  constructor() {
    this.tooltipElement = null;
    this.currentTile = null;
    this.visible = false;
    this.offsetX = 15; // Pixels from cursor
    this.offsetY = 15; // Pixels from cursor
    this.minZoomLevel = 2.0; // Minimum zoom level to show tooltips

    this.createTooltipElement();
  }

  // Create the tooltip DOM element
  createTooltipElement() {
    this.tooltipElement = document.createElement('div');
    this.tooltipElement.className = 'tile-tooltip';
    this.tooltipElement.style.display = 'none';
    document.body.appendChild(this.tooltipElement);
  }

  // Show tooltip at cursor position with tile information
  show(tile, mouseX, mouseY, buildingManager) {
    if (!tile || !this.tooltipElement) return;

    this.currentTile = tile;
    this.visible = true;

    // Build tooltip content
    const content = this.buildTooltipContent(tile, buildingManager);
    this.tooltipElement.innerHTML = content;

    // Position tooltip near cursor
    this.position(mouseX, mouseY);

    // Display tooltip
    this.tooltipElement.style.display = 'block';
  }

  // Hide tooltip
  hide() {
    if (!this.tooltipElement) return;

    this.visible = false;
    this.currentTile = null;
    this.tooltipElement.style.display = 'none';
  }

  // Update tooltip content if tile changed
  update(tile, mouseX, mouseY, buildingManager, zoomLevel = 1.0) {
    // Check zoom level threshold - only show tooltips at 2.0x zoom or higher
    if (zoomLevel < this.minZoomLevel) {
      this.hide();
      return;
    }

    // Check if tile is null
    if (!tile) {
      this.hide();
      return;
    }

    // Check if we're hovering over the same tile
    if (this.currentTile && this.currentTile.x === tile.x && this.currentTile.y === tile.y) {
      // Same tile, just update position (tooltip already visible)
      this.position(mouseX, mouseY);
      return;
    }

    // Different tile or first tile, show with new content
    this.show(tile, mouseX, mouseY, buildingManager);
  }

  // Position tooltip near cursor
  position(mouseX, mouseY) {
    if (!this.tooltipElement) return;

    // Calculate position with offset
    let left = mouseX + this.offsetX;
    let top = mouseY + this.offsetY;

    // Get tooltip dimensions
    const rect = this.tooltipElement.getBoundingClientRect();
    const tooltipWidth = rect.width;
    const tooltipHeight = rect.height;

    // Prevent tooltip from going off-screen
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Adjust horizontal position if tooltip would go off right edge
    if (left + tooltipWidth > viewportWidth) {
      left = mouseX - tooltipWidth - this.offsetX;
    }

    // Adjust vertical position if tooltip would go off bottom edge
    if (top + tooltipHeight > viewportHeight) {
      top = mouseY - tooltipHeight - this.offsetY;
    }

    // Apply position
    this.tooltipElement.style.left = `${left}px`;
    this.tooltipElement.style.top = `${top}px`;
  }

  // Build HTML content for tooltip based on tile data
  buildTooltipContent(tile, buildingManager) {
    const lines = [];

    // Tile coordinates
    lines.push(`<div class="tooltip-header">Tile (${tile.x}, ${tile.y})</div>`);

    // Building information (if present)
    if (tile.building) {
      const building = tile.building;
      const config = buildingManager ? buildingManager.getBuildingConfig(building.type) : null;

      if (config) {
        lines.push(`<div class="tooltip-section">`);
        lines.push(`<strong class="tooltip-building-name">${config.display.icon} ${config.name}</strong>`);

        // Building costs
        if (config.costs && Object.keys(config.costs).length > 0) {
          const costStr = Object.entries(config.costs)
            .map(([type, amount]) => `${amount} ${type}`)
            .join(', ');
          lines.push(`<div class="tooltip-item">Cost: ${costStr}</div>`);
        }

        // Building generation
        if (config.generation && Object.keys(config.generation).length > 0) {
          const genStr = Object.entries(config.generation)
            .map(([type, amount]) => `+${amount}/s ${type}`)
            .join(', ');
          lines.push(`<div class="tooltip-item">Generates: ${genStr}</div>`);
        }

        // Building effects (population, workers)
        if (config.effects?.onPlaced) {
          const effectStr = Object.entries(config.effects.onPlaced)
            .map(([type, amount]) => `+${amount} ${type}`)
            .join(', ');
          lines.push(`<div class="tooltip-item">Provides: ${effectStr}</div>`);
        }

        lines.push(`</div>`);
      } else {
        lines.push(`<div class="tooltip-section"><strong>Building: ${building.type}</strong></div>`);
      }
    }

    // Farmland overlay (if present but no building)
    if (tile.farmland && !tile.building) {
      lines.push(`<div class="tooltip-section">`);
      lines.push(`<strong class="tooltip-farmland">🌾 Farmland</strong>`);
      lines.push(`<div class="tooltip-item">Farm field</div>`);
      lines.push(`</div>`);
    }

    // Terrain information (always show for generated tiles)
    if (tile.terrainType) {
      lines.push(`<div class="tooltip-section">`);
      lines.push(`<strong class="tooltip-terrain">Terrain: ${tile.terrainType.name}</strong>`);
      lines.push(`<div class="tooltip-item">Elevation: ${tile.elevation.toFixed(2)}</div>`);

      // Optional: show additional terrain data
      if (tile.temperature !== undefined && tile.moisture !== undefined) {
        lines.push(`<div class="tooltip-item">Temperature: ${tile.temperature.toFixed(2)}</div>`);
        lines.push(`<div class="tooltip-item">Moisture: ${tile.moisture.toFixed(2)}</div>`);
      }

      lines.push(`</div>`);
    }

    // Show if tile is manually painted vs generated
    if (tile.isPainted) {
      lines.push(`<div class="tooltip-footer">Manually placed</div>`);
    } else if (tile.isGenerated) {
      lines.push(`<div class="tooltip-footer">Procedurally generated</div>`);
    }

    return lines.join('');
  }

  // Check if tooltip is currently visible
  isVisible() {
    return this.visible;
  }

  // Set minimum zoom level for showing tooltips
  setMinZoomLevel(level) {
    this.minZoomLevel = level;
  }

  // Cleanup
  destroy() {
    if (this.tooltipElement && this.tooltipElement.parentNode) {
      this.tooltipElement.parentNode.removeChild(this.tooltipElement);
    }
    this.tooltipElement = null;
    this.currentTile = null;
    this.visible = false;
  }
}
