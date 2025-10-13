// Resource Manager for tracking game resources
export class ResourceManager {
  constructor() {
    // Initialize resources
    this.resources = {
      food: 0,
      worker: 0,
      wood: 0,
      stone: 0
      // Add more resources as needed
    };

    // Resource caps (Infinity means no cap)
    this.resourceCaps = {
      food: 100,
      worker: Infinity,  // Workers have no cap
      wood: 100,
      stone: 50
    };

    // Event listeners for resource changes
    this.listeners = [];
  }

  /**
   * Add amount to a resource
   * @param {string} type - Resource type (food, worker)
   * @param {number} amount - Amount to add
   * @returns {boolean} - Success/failure
   */
  addResource(type, amount) {
    if (!this.resources.hasOwnProperty(type)) {
      console.warn(`Unknown resource type: ${type}`);
      return false;
    }

    if (amount < 0) {
      console.warn('Use removeResource for negative amounts');
      return false;
    }

    const cap = this.resourceCaps[type] ?? Infinity;
    const newValue = Math.min(this.resources[type] + amount, cap);
    const actualAdded = newValue - this.resources[type];

    this.resources[type] = newValue;
    this.notifyListeners(type, this.resources[type]);

    // Warn if we hit the cap and couldn't add full amount
    if (actualAdded < amount && cap !== Infinity) {
      console.log(`${type} capped at ${cap} (tried to add ${amount}, added ${actualAdded.toFixed(2)})`);
    }

    return true;
  }

  /**
   * Remove amount from a resource
   * @param {string} type - Resource type (food, worker)
   * @param {number} amount - Amount to remove
   * @returns {boolean} - Success/failure
   */
  removeResource(type, amount) {
    if (!this.resources.hasOwnProperty(type)) {
      console.warn(`Unknown resource type: ${type}`);
      return false;
    }

    if (amount < 0) {
      console.warn('Amount must be positive');
      return false;
    }

    // Check if we have enough resources
    if (this.resources[type] < amount) {
      console.warn(`Insufficient ${type}: has ${this.resources[type]}, needs ${amount}`);
      return false;
    }

    this.resources[type] -= amount;
    this.notifyListeners(type, this.resources[type]);
    return true;
  }

  /**
   * Get current amount of a resource
   * @param {string} type - Resource type
   * @returns {number} - Current amount
   */
  getResource(type) {
    return this.resources[type] ?? 0;
  }

  /**
   * Get all resources
   * @returns {Object} - All resources
   */
  getAllResources() {
    return { ...this.resources };
  }

  /**
   * Set a resource to a specific value
   * @param {string} type - Resource type
   * @param {number} value - New value
   */
  setResource(type, value) {
    if (!this.resources.hasOwnProperty(type)) {
      console.warn(`Unknown resource type: ${type}`);
      return false;
    }

    if (value < 0) {
      console.warn('Resource value cannot be negative');
      return false;
    }

    const cap = this.resourceCaps[type] ?? Infinity;
    this.resources[type] = Math.min(value, cap);
    this.notifyListeners(type, this.resources[type]);
    return true;
  }

  /**
   * Register a listener for resource changes
   * @param {Function} callback - Called with (type, newValue)
   */
  addListener(callback) {
    if (typeof callback === 'function') {
      this.listeners.push(callback);
    }
  }

  /**
   * Remove a listener
   * @param {Function} callback - The listener to remove
   */
  removeListener(callback) {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Notify all listeners of a resource change
   * @private
   */
  notifyListeners(type, newValue) {
    this.listeners.forEach(listener => {
      try {
        listener(type, newValue);
      } catch (error) {
        console.error('Error in resource listener:', error);
      }
    });
  }

  /**
   * Check if player can afford a cost
   * @param {Object} cost - Object with resource types and amounts
   * @returns {boolean}
   */
  canAfford(cost) {
    for (const [type, amount] of Object.entries(cost)) {
      if (this.getResource(type) < amount) {
        return false;
      }
    }
    return true;
  }

  /**
   * Deduct multiple resources (transaction-like)
   * @param {Object} cost - Object with resource types and amounts
   * @returns {boolean} - Success/failure
   */
  spend(cost) {
    // First check if we can afford it
    if (!this.canAfford(cost)) {
      return false;
    }

    // Then deduct all resources
    for (const [type, amount] of Object.entries(cost)) {
      this.removeResource(type, amount);
    }

    return true;
  }

  /**
   * Reset all resources to 0
   */
  reset() {
    for (const type in this.resources) {
      this.resources[type] = 0;
      this.notifyListeners(type, 0);
    }
  }

  /**
   * Get resource statistics
   * @returns {Object}
   */
  getStats() {
    return {
      resources: this.getAllResources(),
      caps: { ...this.resourceCaps },
      listenerCount: this.listeners.length
    };
  }

  /**
   * Get the cap for a specific resource
   * @param {string} type - Resource type
   * @returns {number} - The cap value (Infinity if no cap)
   */
  getResourceCap(type) {
    return this.resourceCaps[type] ?? Infinity;
  }

  /**
   * Set the cap for a specific resource
   * @param {string} type - Resource type
   * @param {number} cap - New cap value (use Infinity for no cap)
   */
  setResourceCap(type, cap) {
    if (!this.resources.hasOwnProperty(type)) {
      console.warn(`Unknown resource type: ${type}`);
      return false;
    }

    if (cap < 0) {
      console.warn('Resource cap cannot be negative');
      return false;
    }

    this.resourceCaps[type] = cap;

    // If current resource amount exceeds new cap, reduce it
    if (this.resources[type] > cap) {
      this.resources[type] = cap;
      this.notifyListeners(type, this.resources[type]);
    }

    return true;
  }

  /**
   * Check if a resource is at its cap
   * @param {string} type - Resource type
   * @returns {boolean}
   */
  isAtCap(type) {
    const cap = this.getResourceCap(type);
    return cap !== Infinity && this.resources[type] >= cap;
  }

  /**
   * Get percentage of cap used (0-100)
   * @param {string} type - Resource type
   * @returns {number} - Percentage (0-100), or 0 if no cap
   */
  getCapPercentage(type) {
    const cap = this.getResourceCap(type);
    if (cap === Infinity) return 0;
    return (this.resources[type] / cap) * 100;
  }
}
