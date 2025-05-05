/**
 * NeuroPulse PWA - Modified to use Groqee 3.6.4 Components
 */

class ChatApp {
    constructor() {
        this.messagesContainer = document.getElementById('messages');
        this.userInput = document.getElementById('user-input');
        this.sendButton = document.getElementById('send-button');
        this.themeSwitch = document.getElementById('theme-switch');
        this.clearChat = document.getElementById('clear-chat');
        this.voiceInput = document.getElementById('voice-input');
        this.statusIndicator = document.getElementById('status');
        this.messageHistory = [];
        this.historyIndex = -1;
        this.isGeneratingSuggestion = false;
        this.typingTimer = null;
        this.typingDelay = 800; // ms delay after typing stops
        this.suggestionContainer = null;
        this.conversations = [];
        this.currentConversation = null;
        this.isStreaming = false;
        this.streamQueue = [];
        this.typingTimeout = null;
        this.typingSpeed = 10; // ms per character for typing effect
        this.speechSynthesis = window.speechSynthesis;
        this.isSpeaking = false;
        this.modelOptions = {
            "llama-3.3-70b-versatile": "Llama 3.3 70B (Recommended)",
            "llama-3.3-8b-versatile": "Llama 3.3 8B (Faster)",
            "gemma-7b-it": "Gemma 7B (Efficient)",
            "mixtral-8x7b-32768": "Mixtral 8x7B (Long context)",
            "llama4-vision-1": "Llama4 Vision 1",
            "llama4-vision-2": "Llama4 Vision 2"
        };
        this.currentModel = localStorage.getItem('selectedModel') || "llama-3.3-70b-versatile";
        
        // Check if API key exists
        this.apiKey = localStorage.getItem('groqApiKey');
        if (!this.apiKey) {
            this.showApiKeyPrompt();
        }
        
        // Initialize Groqee
        this.groqeeChat = new GroqeeChat({
            apiKey: this.apiKey,
            apiEndpoint: 'https://api.groq.com/openai/v1/chat/completions',
            defaultModel: this.currentModel,
            modelsPath: 'pwa-assets/groqee-models.json',
            templatesPath: 'pwa-assets/groqee-templates.json'
        });
        
        // Initialize Groqee components
        this.groqeeChat.initialize().then(() => {
            console.log('Groqee initialized successfully');
            // Optionally load models from Groqee
            const models = this.groqeeChat.getModels();
            if (models && Object.keys(models).length > 0) {
                console.log('Loaded models from Groqee:', models);
                this.modelOptions = {};
                for (const [key, model] of Object.entries(models)) {
                    this.modelOptions[model.id] = model.name;
                }
                this.initializeModelSelector();
            }
        }).catch(error => {
            console.error('Failed to initialize Groqee:', error);
        });
        
        this.setupEventListeners();
        this.loadTheme();
        this.setupOfflineIndicator();
        this.setupVoiceInput();
        this.setupAutoResizeTextarea();
        this.setupAutocomplete();
        this.setupConversations();
        this.loadMessages();
        this.initializeModelSelector();
        
        // Configure markdown
        marked.setOptions({
            highlight: function (code, lang) {
                if (lang && hljs.getLanguage(lang)) {
                    return hljs.highlight(code, { language: lang }).value;
                }
                return code;
            }
        });
        
        // Display version number
        const versionEl = document.createElement('div');
        versionEl.className = 'version-info';
        versionEl.textContent = 'v1.2 - Groqee 3.6.4';
        document.querySelector('.app-container').appendChild(versionEl);
    }
    
    // ... existing code ...
    
    async callGroqAPIWithStreaming(prompt, messageElement, conversationHistory = []) {
        try {
            // Format conversation history for Groqee
            const messages = [
                ...conversationHistory,
                { role: "user", content: prompt }
            ];
            
            // Use Groqee to handle the message sending
            messageElement.innerHTML = '';
            messageElement.classList.remove('streaming');
            
            // Set up a callback for streaming responses
            let responseText = '';
            const onMessageUpdate = (data) => {
                responseText = data.response || data;
                const sanitizedContent = this.sanitizeHTML(marked.parse(responseText));
                messageElement.innerHTML = sanitizedContent;
                messageElement.querySelectorAll('pre code').forEach((block) => {
                    hljs.highlightElement(block);
                });
                this.scrollToBottom();
            };
            
            // Register the event handler
            this.groqeeChat.on('messageUpdate', onMessageUpdate);
            
            // Send message using Groqee
            const response = await this.groqeeChat.sendMessage(prompt, {
                modelName: this.currentModel,
                temperature: 0.7,
                messages: messages
            });
            
            // Clean up event handler
            this.groqeeChat.off('messageUpdate', onMessageUpdate);
            
            // Use the final response
            responseText = response;
            
            // Store the conversation if needed
            if (this.currentConversation) {
                const conversation = this.conversations.find(c => c.id === this.currentConversation);
                if (conversation) {
                    if (conversation.messages.length === 0 || conversation.messages[conversation.messages.length - 1].content !== prompt) { 
                        conversation.messages.push({
                            role: 'user',
                            content: prompt
                        });
                    }
                    conversation.messages.push({
                        role: 'assistant',
                        content: responseText
                    });
                    this.saveConversations();
                }
            }
            
            return responseText;
        } catch (error) {
            console.error("Error calling Groq API via Groqee:", error);
            messageElement.innerHTML = `Error: ${error.message}. Please check your API key or try again later.`;
            messageElement.classList.remove('assistant');
            messageElement.classList.add('system');
            throw error;
        }
    }
    
    async callGroqAPI(prompt, isAutocomplete = false) {
        try {
            // For autocomplete, we can use a different model or temperature
            const options = {
                modelName: isAutocomplete ? "llama-3.3-8b-versatile" : this.currentModel,
                temperature: isAutocomplete ? 1.0 : 0.7,
            };
            
            // Use Groqee to send the message
            const response = await this.groqeeChat.sendMessage(prompt, options);
            return response;
        } catch (error) {
            console.error("Error calling Groq API via Groqee:", error);
            throw error;
        }
    }
    
    // ... remaining existing code ...
}

// ... remaining existing code ...

// Initialize the app
new ChatApp();
