/**
 * Groqee Chat Module v3.6.4
 * Wisconsin's Finest AI Chat Interface
 * For use with NeropulseAPP PWA
 */

class GroqeeChat {
  constructor(config = {}) {
    this.config = {
      apiKey: null,
      apiEndpoint: '/api/chat',
      defaultModel: 'Musky (Most Powerful)',
      defaultTemplate: 'Musky - Academic Coach',
      temperature: 0.7,
      ...config
    };
    
    this.models = {};
    this.templates = {};
    this.history = [];
    this.initialized = false;
  }
  
  /**
   * Initialize the Groqee chat module
   * @param {Object} options - Initialization options
   * @returns {Promise} - Resolves when initialization is complete
   */
  async initialize(options = {}) {
    // Merge options with config
    this.config = { ...this.config, ...options };
    
    try {
      // Load models and templates
      const [modelsResponse, templatesResponse] = await Promise.all([
        fetch(this.config.modelsPath || 'pwa-assets/groqee-models.json'),
        fetch(this.config.templatesPath || 'pwa-assets/groqee-templates.json')
      ]);
      
      if (!modelsResponse.ok || !templatesResponse.ok) {
        throw new Error('Failed to load required resources');
      }
      
      const modelsData = await modelsResponse.json();
      const templatesData = await templatesResponse.json();
      
      this.models = modelsData.models || {};
      this.templates = templatesData.templates || {};
      
      this.initialized = true;
      this.triggerEvent('ready', { models: this.models, templates: this.templates });
      
      return {
        models: this.models,
        templates: this.templates
      };
    } catch (error) {
      console.error('Groqee initialization error:', error);
      this.triggerEvent('error', { message: error.message });
      throw error;
    }
  }
  
  /**
   * Format messages for the Groq API
   * @param {Array} history - Chat history
   * @param {String} newMessage - New message to send
   * @param {String} template - Template to use
   * @returns {Array} - Formatted messages
   */
  formatMessages(history, newMessage, template) {
    const templateContent = this.templates[template]?.content || 
                           this.templates[this.config.defaultTemplate]?.content ||
                           "You are a helpful AI assistant.";
    
    const messages = [{ role: "system", content: templateContent }];
    
    for (const [human, bot] of history) {
      messages.push({ role: "user", content: human });
      if (bot) {
        messages.push({ role: "assistant", content: bot });
      }
    }
    
    messages.push({ role: "user", content: newMessage });
    return messages;
  }
  
  /**
   * Send a chat message
   * @param {String} message - Message to send
   * @param {Object} options - Chat options
   * @returns {Promise} - Resolves with the response
   */
  async sendMessage(message, options = {}) {
    if (!this.initialized) {
      throw new Error('Groqee chat not initialized');
    }
    
    const opts = {
      modelName: this.config.defaultModel,
      template: this.config.defaultTemplate,
      temperature: this.config.temperature,
      ...options
    };
    
    // Get model configuration
    const modelConfig = this.models[opts.modelName] || this.models[this.config.defaultModel];
    
    if (!modelConfig) {
      throw new Error('Model not found');
    }
    
    // Format messages for API
    const messages = this.formatMessages(this.history, message, opts.template);
    
    try {
      this.triggerEvent('sendingMessage', { message, options: opts });
      
      // In a PWA context, we'll likely be using a proxy API endpoint
      const response = await fetch(this.config.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey ? { 'Authorization': `Bearer ${this.config.apiKey}` } : {})
        },
        body: JSON.stringify({
          messages,
          model: modelConfig.id,
          temperature: opts.temperature,
          max_tokens: modelConfig.max_tokens
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to get response from API');
      }
      
      const data = await response.json();
      const responseText = data.choices?.[0]?.message?.content || 'No response received';
      
      // Update history
      this.history.push([message, responseText]);
      
      this.triggerEvent('messageReceived', { 
        message, 
        response: responseText,
        model: opts.modelName
      });
      
      return responseText;
    } catch (error) {
      this.triggerEvent('error', { message: error.message });
      throw error;
    }
  }
  
  /**
   * Clear chat history
   */
  clearHistory() {
    this.history = [];
    this.triggerEvent('historyCleared');
  }
  
  /**
   * Set API key
   * @param {String} apiKey - Groq API key
   */
  setApiKey(apiKey) {
    this.config.apiKey = apiKey;
  }
  
  /**
   * Get available models
   * @returns {Object} - Available models
   */
  getModels() {
    return this.models;
  }
  
  /**
   * Get available templates
   * @returns {Object} - Available templates
   */
  getTemplates() {
    return this.templates;
  }
  
  /**
   * Get chat history
   * @returns {Array} - Chat history
   */
  getHistory() {
    return [...this.history];
  }
  
  // Event handling
  #eventListeners = {};
  
  /**
   * Add event listener
   * @param {String} event - Event name
   * @param {Function} callback - Event callback
   */
  on(event, callback) {
    if (!this.#eventListeners[event]) {
      this.#eventListeners[event] = [];
    }
    this.#eventListeners[event].push(callback);
  }
  
  /**
   * Remove event listener
   * @param {String} event - Event name
   * @param {Function} callback - Event callback
   */
  off(event, callback) {
    if (!this.#eventListeners[event]) return;
    this.#eventListeners[event] = this.#eventListeners[event].filter(cb => cb !== callback);
  }
  
  /**
   * Trigger event
   * @param {String} event - Event name
   * @param {Object} data - Event data
   */
  triggerEvent(event, data = {}) {
    if (!this.#eventListeners[event]) return;
    for (const callback of this.#eventListeners[event]) {
      callback(data);
    }
  }
}

// Export for both ES modules and CommonJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GroqeeChat };
} else if (typeof window !== 'undefined') {
  window.GroqeeChat = GroqeeChat;
}