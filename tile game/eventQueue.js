// Message templates for common game events
const MESSAGE_TEMPLATES = {
  building_placed_success: '{icon} {buildingName} built at ({x}, {y})',
  building_placed_error: '❌ Cannot build {buildingName}: {error}',
  building_removed: '🏚️ {buildingName} removed at ({x}, {y})'
};

// Event Queue Manager for displaying messages to the player
export class EventQueue {
  constructor(maxMessages = 50) {
    // Get reference to the message log DOM element
    this.messageLogElement = document.getElementById('messageLog');

    if (!this.messageLogElement) {
      console.error('EventQueue: messageLog element not found');
    }

    // Store message history
    this.messages = [];

    // Maximum number of messages to keep
    this.maxMessages = maxMessages;

    // Event listeners for message events (for future extensibility)
    this.listeners = [];
  }

  /**
   * Add a new message to the queue
   * @param {string} text - The message text to display
   * @param {string} type - Message type ('info', 'success', 'warning', 'error')
   */
  addMessage(text, type = 'info') {
    if (!text || typeof text !== 'string') {
      console.warn('EventQueue: Invalid message text');
      return false;
    }

    // Create message object with timestamp
    const message = {
      text,
      type,
      timestamp: Date.now()
    };

    // Add to message history
    this.messages.push(message);

    // Trim message history if exceeds max
    if (this.messages.length > this.maxMessages) {
      this.messages.shift(); // Remove oldest message
    }

    // Render the message to DOM
    this._renderMessage(message);

    // Notify listeners
    this.notifyListeners(message);

    // Auto-scroll to bottom to show latest message
    this._scrollToBottom();

    return true;
  }

  /**
   * Clear all messages from the display
   */
  clearMessages() {
    if (this.messageLogElement) {
      this.messageLogElement.innerHTML = '';
    }
    this.messages = [];
    this.notifyListeners({ type: 'clear' });
  }

  /**
   * Get all messages in history
   * @returns {Array} - Array of message objects
   */
  getMessages() {
    return [...this.messages];
  }

  /**
   * Get message count
   * @returns {number}
   */
  getMessageCount() {
    return this.messages.length;
  }

  /**
   * Render a message to the DOM
   * @private
   */
  _renderMessage(message) {
    if (!this.messageLogElement) {
      return;
    }

    // Create message div element
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    messageDiv.textContent = message.text;

    // Add type-specific styling (data attribute for CSS targeting)
    messageDiv.setAttribute('data-message-type', message.type);

    // Append to message log
    this.messageLogElement.appendChild(messageDiv);

    // Trim DOM elements if we have too many
    const messageElements = this.messageLogElement.querySelectorAll('.message');
    if (messageElements.length > this.maxMessages) {
      messageElements[0].remove();
    }
  }

  /**
   * Scroll message panel to bottom to show latest messages
   * @private
   */
  _scrollToBottom() {
    if (this.messageLogElement) {
      this.messageLogElement.scrollTop = this.messageLogElement.scrollHeight;
    }
  }

  /**
   * Register a listener for message events
   * @param {Function} callback - Called with message object
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
   * Notify all listeners of a message event
   * @private
   */
  notifyListeners(message) {
    this.listeners.forEach(listener => {
      try {
        listener(message);
      } catch (error) {
        console.error('Error in event queue listener:', error);
      }
    });
  }

  /**
   * Add a message using a predefined template
   * @param {string} templateKey - Key from MESSAGE_TEMPLATES
   * @param {Object} variables - Variables to replace in template (e.g., {buildingName: 'House'})
   * @param {string} type - Message type ('info', 'success', 'warning', 'error')
   */
  addTemplatedMessage(templateKey, variables = {}, type = 'info') {
    const template = MESSAGE_TEMPLATES[templateKey];

    if (!template) {
      console.warn(`EventQueue: Unknown template key: ${templateKey}`);
      return false;
    }

    // Replace variables in template
    let message = template;
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{${key}}`;
      message = message.replaceAll(placeholder, value);
    }

    // Add the formatted message
    return this.addMessage(message, type);
  }

  /**
   * Convenience method for building-related messages
   * @param {string} action - 'placed' or 'removed'
   * @param {string} buildingType - Type of building (e.g., 'house', 'farm')
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {boolean} success - Whether the action was successful (only for 'placed')
   * @param {string} error - Error message (only if success is false)
   */
  addBuildingMessage(action, buildingType, x, y, success = true, error = null) {
    // Import building configs dynamically to get building info
    // We'll need to pass the config directly or accept icon/name as parameters
    // For now, we'll accept icon and name through a buildingConfig parameter
    // This will be passed from BuildingManager which has access to BUILDING_CONFIGS

    return this._addBuildingMessageWithConfig(action, buildingType, x, y, success, error, null);
  }

  /**
   * Internal method for building messages with config
   * @private
   */
  _addBuildingMessageWithConfig(action, buildingType, x, y, success, error, buildingConfig) {
    let templateKey;
    let messageType = 'info';

    if (action === 'placed') {
      if (success) {
        templateKey = 'building_placed_success';
        messageType = 'success';
      } else {
        templateKey = 'building_placed_error';
        messageType = 'error';
      }
    } else if (action === 'removed') {
      templateKey = 'building_removed';
      messageType = 'info';
    } else {
      console.warn(`EventQueue: Unknown building action: ${action}`);
      return false;
    }

    // Build variables object
    const variables = {
      buildingName: buildingConfig?.name || buildingType,
      icon: buildingConfig?.display?.icon || '🏗️',
      x: x,
      y: y,
      error: error || 'Unknown error'
    };

    return this.addTemplatedMessage(templateKey, variables, messageType);
  }

  /**
   * Get statistics about the event queue
   * @returns {Object}
   */
  getStats() {
    return {
      totalMessages: this.messages.length,
      maxMessages: this.maxMessages,
      listenerCount: this.listeners.length,
      isConnected: !!this.messageLogElement
    };
  }
}
