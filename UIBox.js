/**
 * UIBox.js - DEPRECATED - No longer used
 *
 * This file is no longer needed as all UI content is now defined directly in index.html.
 * JavaScript in script.js uses native DOM methods instead of this wrapper.
 *
 * This file can be safely deleted.
 */

const UIBox = {
  /**
   * Set the HTML content of a UI box
   * @param {string} elementId - The ID of the UI box element
   * @param {string} htmlContent - The HTML content to set
   */
  setContent(elementId, htmlContent) {
    const element = document.getElementById(elementId);
    if (element) {
      element.innerHTML = htmlContent;
    } else {
      console.warn(`UIBox: Element with id "${elementId}" not found`);
    }
  },

  /**
   * Show a UI box
   * @param {string} elementId - The ID of the UI box element
   */
  show(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
      element.style.display = 'block';
    } else {
      console.warn(`UIBox: Element with id "${elementId}" not found`);
    }
  },

  /**
   * Hide a UI box
   * @param {string} elementId - The ID of the UI box element
   */
  hide(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
      element.style.display = 'none';
    } else {
      console.warn(`UIBox: Element with id "${elementId}" not found`);
    }
  }
};

// Attach to window for global access
if (typeof window !== 'undefined') {
  window.UIBox = UIBox;
}

export default UIBox;
