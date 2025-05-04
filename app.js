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

        // Check if API key exists
        this.apiKey = localStorage.getItem('groqApiKey');
        if (!this.apiKey) {
            this.showApiKeyPrompt();
        }

        // Display version number
        const versionEl = document.createElement('div');
        versionEl.className = 'version-info';
        versionEl.textContent = 'v1.1';
        document.querySelector('.app-container').appendChild(versionEl);
    }

    showApiKeyPrompt() {
        const savedApiKey = localStorage.getItem('groqApiKey');
        const apiKey = prompt("Please enter your Groq API key:", savedApiKey || "");

        if (apiKey) {
            localStorage.setItem('groqApiKey', apiKey);
            this.apiKey = apiKey;
        } else {
            this.addMessage("⚠️ No API key provided. Please click the settings button to add your Groq API key.", "system");
        }
    }

    setupOfflineIndicator() {
        this.updateOnlineStatus();
        window.addEventListener('online', () => this.updateOnlineStatus());
        window.addEventListener('offline', () => this.updateOnlineStatus());
    }

    updateOnlineStatus() {
        if (navigator.onLine) {
            this.statusIndicator.innerHTML = '<i class="ri-signal-wifi-line"></i><span>Online</span>';
            this.statusIndicator.className = 'online';
        } else {
            this.statusIndicator.innerHTML = '<i class="ri-signal-wifi-error-line"></i><span>Offline</span>';
            this.statusIndicator.className = 'offline';
        }
    }

    setupEventListeners() {
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.userInput.addEventListener('keydown', (e) => this.handleInputKeydown(e));
        this.themeSwitch.addEventListener('click', () => this.toggleTheme());
        this.clearChat.addEventListener('click', () => this.clearMessages());

        const settingsButton = document.getElementById('settings-button');
        if (settingsButton) {
            settingsButton.addEventListener('click', () => this.showApiKeyPrompt());
        }

        this.userInput.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.userInput.classList.add('dragover');
        });

        this.userInput.addEventListener('dragleave', () => {
            this.userInput.classList.remove('dragover');
        });

        this.userInput.addEventListener('drop', (e) => this.handleFileDrop(e));

        const sidebarToggle = document.getElementById('sidebar-toggle');
        const sidebar = document.querySelector('.sidebar');

        if (sidebarToggle && sidebar) {
            sidebarToggle.addEventListener('click', () => {
                sidebar.classList.toggle('open');
                document.body.classList.toggle('sidebar-open');
            });
        }

        const ttsToggle = document.getElementById('tts-toggle');
        if (ttsToggle) {
            ttsToggle.addEventListener('click', () => {
                if (this.isSpeaking) {
                    this.stopSpeaking();
                } else {
                    const messages = document.querySelectorAll('.message.assistant');
                    if (messages.length > 0) {
                        const lastMessage = messages[messages.length - 1];
                        this.speakText(lastMessage.textContent);
                    }
                }
            });
        }

        const exportBtn = document.getElementById('export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportCurrentConversation());
        }

        document.querySelectorAll('.quick-action').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                if (action) {
                    this.userInput.value = action;
                    this.sendMessage();
                }
            });
        });
    }

    setupAutoResizeTextarea() {
        const resizeTextarea = () => {
            this.userInput.style.height = 'auto';
            this.userInput.style.height = (this.userInput.scrollHeight) + 'px';
        };

        this.userInput.addEventListener('input', resizeTextarea);
        window.addEventListener('resize', resizeTextarea);
    }

    setupVoiceInput() {
        if ('webkitSpeechRecognition' in window) {
            this.recognition = new webkitSpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = true;

            this.recognition.onresult = (event) => {
                const transcript = Array.from(event.results)
                    .map(result => result[0].transcript)
                    .join('');

                this.userInput.value = transcript;
                this.userInput.dispatchEvent(new Event('input'));
            };

            this.voiceInput.addEventListener('click', () => {
                if (this.recognition.state === 'inactive') {
                    this.recognition.start();
                    this.voiceInput.classList.add('recording');
                } else {
                    this.recognition.stop();
                    this.voiceInput.classList.remove('recording');
                }
            });
        } else {
            this.voiceInput.style.display = 'none';
        }
    }

    setupAutocomplete() {
        this.suggestionContainer = document.createElement('div');
        this.suggestionContainer.className = 'suggestion-container';
        this.suggestionContainer.style.display = 'none';
        document.querySelector('.input-wrapper').appendChild(this.suggestionContainer);

        this.userInput.addEventListener('input', () => {
            clearTimeout(this.typingTimer);

            const inputText = this.userInput.value.trim();

            if (inputText.length > 5 && inputText.length < 60) {
                this.typingTimer = setTimeout(() => this.generateSuggestion(inputText), this.typingDelay);
            } else {
                this.hideSuggestions();
            }
        });

        document.addEventListener('click', (e) => {
            if (!this.suggestionContainer.contains(e.target) && e.target !== this.userInput) {
                this.hideSuggestions();
            }
        });
    }

    async generateSuggestion(inputText) {
        if (this.isGeneratingSuggestion || !navigator.onLine || !this.apiKey) {
            return;
        }

        this.isGeneratingSuggestion = true;

        try {
            const prompt = `I'm writing a message that starts with: "${inputText}". Suggest 3 different ways to complete this thought in a concise way. Format each suggestion on its own line with a ">" prefix. Keep each suggestion under 100 characters and make them diverse in style and content.`;

            const response = await this.callGroqAPI(prompt, true);

            const suggestions = response
                .split('\n')
                .filter(line => line.trim().startsWith('>'))
                .map(line => line.replace(/^>\s*/, '').trim())
                .filter(suggestion => suggestion.length > 0)
                .slice(0, 3);

            if (suggestions.length > 0) {
                this.showSuggestions(suggestions);
            } else {
                this.hideSuggestions();
            }
        } catch (error) {
            console.error('Error generating suggestions:', error);
            this.hideSuggestions();
        } finally {
            this.isGeneratingSuggestion = false;
        }
    }

    showSuggestions(suggestions) {
        this.suggestionContainer.innerHTML = '';

        suggestions.forEach(suggestion => {
            const suggestionEl = document.createElement('div');
            suggestionEl.className = 'suggestion';
            suggestionEl.textContent = suggestion;

            suggestionEl.addEventListener('click', () => {
                this.userInput.value = suggestion;
                this.userInput.dispatchEvent(new Event('input'));
                this.hideSuggestions();
                this.userInput.focus();
            });

            this.suggestionContainer.appendChild(suggestionEl);
        });

        this.suggestionContainer.style.display = 'block';
    }

    hideSuggestions() {
        if (this.suggestionContainer) {
            this.suggestionContainer.style.display = 'none';
        }
    }

    async handleFileDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        this.userInput.classList.remove('dragover');

        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            const fileContents = await Promise.all(
                files.map(file => this.readFileContent(file))
            );
            this.userInput.value += fileContents.join('\n');
            this.userInput.dispatchEvent(new Event('input'));
        }
    }

    readFileContent(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsText(file);
        });
    }

    handleInputKeydown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.sendMessage();
        } else if (e.key === 'ArrowUp' && e.ctrlKey) {
            e.preventDefault();
            this.navigateHistory('up');
        } else if (e.key === 'ArrowDown' && e.ctrlKey) {
            e.preventDefault();
            this.navigateHistory('down');
        }
    }

    navigateHistory(direction) {
        if (direction === 'up' && this.historyIndex < this.messageHistory.length - 1) {
            this.historyIndex++;
        } else if (direction === 'down' && this.historyIndex > -1) {
            this.historyIndex--;
        }

        if (this.historyIndex > -1 && this.historyIndex < this.messageHistory.length) {
            this.userInput.value = this.messageHistory[this.messageHistory.length - 1 - this.historyIndex];
        } else if (this.historyIndex === -1) {
            this.userInput.value = '';
        }
    }

    async sendMessage() {
        const content = this.userInput.value.trim();
        if (!content) return;

        this.addMessage(content, 'user');
        this.messageHistory.push(content);
        this.historyIndex = -1;

        this.userInput.value = '';
        this.userInput.style.height = 'auto';

        if (this.conversations.length > 0 && this.currentConversation) {
            const currentConv = this.conversations.find(c => c.id === this.currentConversation);
            if (currentConv && currentConv.title === 'New Conversation' && currentConv.messages.length === 0) {
                currentConv.title = content.substring(0, 28) + (content.length > 28 ? '...' : '');
                this.saveConversations();
                this.updateConversationsList();
            }
        }

        const streamingMsgElement = this.addStreamingMessage();

        try {
            if (!this.apiKey) {
                this.showApiKeyPrompt();
                if (!this.apiKey) {
                    this.messagesContainer.removeChild(streamingMsgElement);
                    this.addMessage("⚠️ API key is required to communicate with Groq. Please add your API key in settings.", "system");
                    return;
                }
            }

            const conversationMessages = this.getConversationHistory();

            await this.callGroqAPIWithStreaming(content, streamingMsgElement, conversationMessages);

        } catch (error) {
            console.error("Error calling Groq API:", error);
            streamingMsgElement.innerHTML = `Error: ${error.message}. Please check your API key or try again later.`;
            streamingMsgElement.classList.remove('assistant');
            streamingMsgElement.classList.add('system');
        }
    }

    getConversationHistory() {
        if (!this.currentConversation) return [];

        const conversation = this.conversations.find(c => c.id === this.currentConversation);
        if (!conversation) return [];

        return conversation.messages.slice(-10).map(msg => ({
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content: msg.content
        }));
    }

    addStreamingMessage() {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message assistant streaming';
        messageDiv.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
        this.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
        return messageDiv;
    }

    async callGroqAPIWithStreaming(prompt, messageElement, conversationHistory = []) {
        const endpoint = "https://api.groq.com/openai/v1/chat/completions";

        const messages = [
            ...conversationHistory,
            { role: "user", content: prompt }
        ];

        const payload = {
            model: this.currentModel,
            messages: messages,
            temperature: 0.7,
            max_tokens: 4096,
            stream: true
        };

        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${this.apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `API request failed with status ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let responseText = '';

        messageElement.innerHTML = '';
        messageElement.classList.remove('streaming');

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);

            const lines = chunk.split('\n').filter(line => line.trim() !== '');

            for (const line of lines) {
                if (line.includes('[DONE]')) continue;

                let jsonStr = line.replace(/^data: /, '').trim();
                if (!jsonStr) continue;

                try {
                    const json = JSON.parse(jsonStr);
                    if (json.choices && json.choices[0].delta && json.choices[0].delta.content) {
                        const content = json.choices[0].delta.content;
                        responseText += content;

                        const sanitizedContent = this.sanitizeHTML(marked.parse(responseText));
                        messageElement.innerHTML = sanitizedContent;

                        messageElement.querySelectorAll('pre code').forEach((block) => {
                            hljs.highlightElement(block);
                        });

                        this.scrollToBottom();
                    }
                } catch (e) {
                    console.error('Error parsing JSON from stream:', e);
                }
            }
        }

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
    }

    async callGroqAPI(prompt, isAutocomplete = false) {
        const endpoint = "https://api.groq.com/openai/v1/chat/completions";

        const payload = {
            model: isAutocomplete ? "llama-3.3-8b-versatile" : this.currentModel,
            messages: [
                { role: "user", content: prompt }
            ],
            temperature: isAutocomplete ? 1.0 : 0.7,
            max_tokens: isAutocomplete ? 150 : 2048
        };

        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${this.apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `API request failed with status ${response.status}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }

    addMessage(content, role) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;

        if (role === 'system') {
            messageDiv.textContent = content;
        } else {
            const sanitizedContent = this.sanitizeHTML(marked.parse(content));
            messageDiv.innerHTML = sanitizedContent;

            messageDiv.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
            });
        }

        this.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();

        if (role !== 'system' && this.currentConversation) {
            const conversation = this.conversations.find(c => c.id === this.currentConversation);
            if (conversation) {
                conversation.messages.push({
                    role,
                    content: role === 'user' ? content : messageDiv.innerHTML
                });
                this.saveConversations();
            }
        }

        return messageDiv;
    }

    sanitizeHTML(html) {
        const div = document.createElement('div');
        div.innerHTML = html;

        div.querySelectorAll('*').forEach(element => {
            Array.from(element.attributes).forEach(attr => {
                if (attr.name.startsWith('on') || attr.name === 'href' && attr.value.startsWith('javascript:')) {
                    element.removeAttribute(attr.name);
                }
            });
        });

        return div.innerHTML;
    }

    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    clearMessages() {
        if (confirm('Are you sure you want to clear all messages?')) {
            this.messagesContainer.innerHTML = '';
            localStorage.removeItem('chatMessages');

            const welcomeMessage = document.querySelector('.welcome-message');
            if (!welcomeMessage) {
                this.messagesContainer.innerHTML = `
                    <div class="welcome-message">
                        <h2>Welcome to NeuroPulse</h2>
                        <p>Experience the future of AI chat with blazing-fast responses powered by Groq.</p>
                        <div class="features">
                            <div class="feature">
                                <i class="ri-flashlight-line"></i>
                                <span>Lightning-fast responses</span>
                            </div>
                            <div class="feature">
                                <i class="ri-brain-line"></i>
                                <span>Advanced AI understanding</span>
                            </div>
                            <div class="feature">
                                <i class="ri-code-line"></i>
                                <span>Code highlighting</span>
                            </div>
                        </div>
                    </div>
                `;
            }
        }
    }

    saveMessages() {
        const messages = Array.from(this.messagesContainer.querySelectorAll('.message')).map(msg => ({
            content: msg.innerHTML,
            role: msg.classList.contains('user') ? 'user' :
                msg.classList.contains('assistant') ? 'assistant' : 'system'
        }));
        localStorage.setItem('chatMessages', JSON.stringify(messages));
    }

    loadMessages() {
        const saved = localStorage.getItem('chatMessages');
        if (saved) {
            const messages = JSON.parse(saved);
            if (messages.length > 0) {
                const welcomeMessage = document.querySelector('.welcome-message');
                if (welcomeMessage) {
                    welcomeMessage.remove();
                }
            }

            messages.forEach(msg => {
                const messageDiv = document.createElement('div');
                messageDiv.className = `message ${msg.role}`;
                messageDiv.innerHTML = msg.content;
                this.messagesContainer.appendChild(messageDiv);
            });

            this.scrollToBottom();
        }
    }

    loadTheme() {
        const theme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', theme);
    }

    toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        const newTheme = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    }

    async initializeModelSelector() {
        const modelSelector = document.getElementById('model-selector');
        if (modelSelector) {
            modelSelector.innerHTML = '';

            try {
                const response = await fetch('https://api.groq.com/models', {
                    headers: {
                        "Authorization": `Bearer ${this.apiKey}`
                    }
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch models from Groq API');
                }

                const models = await response.json();
                models.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model.id;
                    option.textContent = model.name;
                    modelSelector.appendChild(option);
                });

                modelSelector.value = this.currentModel;

                modelSelector.addEventListener('change', (e) => {
                    this.currentModel = e.target.value;
                    localStorage.setItem('selectedModel', this.currentModel);
                    this.addMessage(`Model changed to ${this.modelOptions[this.currentModel]}`, 'system');
                });
            } catch (error) {
                console.error('Error fetching models:', error);
                Object.entries(this.modelOptions).forEach(([id, name]) => {
                    const option = document.createElement('option');
                    option.value = id;
                    option.textContent = name;
                    modelSelector.appendChild(option);
                });

                modelSelector.value = this.currentModel;
            }
        }
    }

    setupConversations() {
        this.loadConversations();

        const newChatBtn = document.getElementById('new-chat-btn');
        const conversationsList = document.getElementById('conversations-list');

        if (newChatBtn) {
            newChatBtn.addEventListener('click', () => this.startNewConversation());
        }

        if (this.conversations.length === 0) {
            this.startNewConversation();
        } else if (!this.currentConversation) {
            this.setCurrentConversation(this.conversations[0].id);
        }

        this.updateConversationsList();
    }

    startNewConversation() {
        const id = 'conv-' + Date.now();
        const newConversation = {
            id,
            title: 'New Conversation',
            messages: [],
            createdAt: new Date().toISOString()
        };

        this.conversations.unshift(newConversation);
        this.setCurrentConversation(id);
        this.saveConversations();

        this.messagesContainer.innerHTML = '';

        this.messagesContainer.innerHTML = `
            <div class="welcome-message">
                <h2>Welcome to NeuroPulse</h2>
                <p>Experience the future of AI chat with blazing-fast responses powered by Groq.</p>
                <div class="features">
                    <div class="feature">
                        <i class="ri-flashlight-line"></i>
                        <span>Lightning-fast responses</span>
                    </div>
                    <div class="feature">
                        <i class="ri-brain-line"></i>
                        <span>Advanced AI understanding</span>
                    </div>
                    <div class="feature">
                        <i class="ri-code-line"></i>
                        <span>Code highlighting</span>
                    </div>
                </div>
            </div>
        `;
    }

    setCurrentConversation(id) {
        this.currentConversation = id;

        const items = document.querySelectorAll('.conversation-item');
        items.forEach(item => {
            item.classList.toggle('active', item.dataset.id === id);
        });

        this.loadMessagesForCurrentConversation();
    }

    loadMessagesForCurrentConversation() {
        if (!this.currentConversation) return;

        const conversation = this.conversations.find(c => c.id === this.currentConversation);
        if (!conversation) return;

        this.messagesContainer.innerHTML = '';

        conversation.messages.forEach(msg => {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${msg.role}`;
            messageDiv.innerHTML = msg.content;
            this.messagesContainer.appendChild(messageDiv);
        });

        this.scrollToBottom();
    }

    updateConversationsList() {
        const conversationsList = document.getElementById('conversations-list');
        if (!conversationsList) return;

        conversationsList.innerHTML = '';

        this.conversations.forEach(conv => {
            const item = document.createElement('div');
            item.className = 'conversation-item';
            item.dataset.id = conv.id;
            if (conv.id === this.currentConversation) {
                item.classList.add('active');
            }

            let title = conv.title;
            if (title === 'New Conversation' && conv.messages.length > 0) {
                const firstUserMsg = conv.messages.find(m => m.role === 'user');
                if (firstUserMsg) {
                    title = firstUserMsg.content.substring(0, 28) + (firstUserMsg.content.length > 28 ? '...' : '');
                }
            }

            item.innerHTML = `
                <div class="conversation-title">${this.escapeHTML(title)}</div>
                <div class="conversation-actions">
                    <button class="rename-btn" title="Rename"><i class="ri-edit-line"></i></button>
                    <button class="delete-btn" title="Delete"><i class="ri-delete-bin-line"></i></button>
                </div>
            `;

            item.querySelector('.conversation-title').addEventListener('click', () => {
                this.setCurrentConversation(conv.id);
            });

            item.querySelector('.rename-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                const newTitle = prompt('Enter new conversation name:', title);
                if (newTitle) {
                    conv.title = newTitle;
                    this.saveConversations();
                    this.updateConversationsList();
                }
            });

            item.querySelector('.delete-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Are you sure you want to delete this conversation?')) {
                    this.conversations = this.conversations.filter(c => c.id !== conv.id);
                    this.saveConversations();

                    if (conv.id === this.currentConversation) {
                        if (this.conversations.length > 0) {
                            this.setCurrentConversation(this.conversations[0].id);
                        } else {
                            this.startNewConversation();
                        }
                    }

                    this.updateConversationsList();
                }
            });

            conversationsList.appendChild(item);
        });
    }

    loadConversations() {
        const savedConversations = localStorage.getItem('conversations');
        if (savedConversations) {
            this.conversations = JSON.parse(savedConversations);
            this.currentConversation = localStorage.getItem('currentConversation') || (this.conversations.length > 0 ? this.conversations[0].id : null);
        }
    }

    saveConversations() {
        localStorage.setItem('conversations', JSON.stringify(this.conversations));
        localStorage.setItem('currentConversation', this.currentConversation);
    }

    escapeHTML(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    speakText(text) {
        if (!this.speechSynthesis) return;

        const cleanText = text.replace(/```[\s\S]*?```/g, 'code block omitted')
            .replace(/`([^`]+)`/g, '$1')
            .replace(/\*\*([^*]+)\*\*/g, '$1');

        const utterance = new SpeechSynthesisUtterance(cleanText);

        utterance.onstart = () => {
            this.isSpeaking = true;
            document.getElementById('tts-toggle').innerHTML = '<i class="ri-volume-up-fill"></i>';
            document.getElementById('tts-toggle').classList.add('active');
        };

        utterance.onend = () => {
            this.isSpeaking = false;
            document.getElementById('tts-toggle').innerHTML = '<i class="ri-volume-up-line"></i>';
            document.getElementById('tts-toggle').classList.remove('active');
        };

        this.speechSynthesis.speak(utterance);
    }

    stopSpeaking() {
        if (this.speechSynthesis && this.isSpeaking) {
            this.speechSynthesis.cancel();
            this.isSpeaking = false;
            document.getElementById('tts-toggle').innerHTML = '<i class="ri-volume-up-line"></i>';
            document.getElementById('tts-toggle').classList.remove('active');
        }
    }

    exportCurrentConversation() {
        if (!this.currentConversation) return;

        const conversation = this.conversations.find(c => c.id === this.currentConversation);
        if (!conversation) return;

        let markdown = `# ${conversation.title}\n\n`;
        markdown += `*Exported from NeuroPulse on ${new Date().toLocaleString()}*\n\n`;

        conversation.messages.forEach(msg => {
            const roleLabel = msg.role === 'user' ? '👤 **You**' : '🤖 **AI**';
            markdown += `${roleLabel}\n\n${msg.content}\n\n---\n\n`;
        });

        const blob = new Blob([markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${conversation.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.md`;
        a.click();

        URL.revokeObjectURL(url);
    }
}

// Add this function to enable push notifications
async function subscribeToPushNotifications() {
    try {
        // Check if service worker and push are supported
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.log('Push notifications not supported');
            return false;
        }
        
        // Get the service worker registration
        const registration = await navigator.serviceWorker.ready;
        
        // Check permission status
        let permission = Notification.permission;
        if (permission !== 'granted') {
            permission = await Notification.requestPermission();
        }
        
        if (permission !== 'granted') {
            console.log('Notification permission denied');
            return false;
        }
        
        // Get existing subscription or create a new one
        let subscription = await registration.pushManager.getSubscription();
        
        if (!subscription) {
            // You'd need to replace this with your actual VAPID public key
            const vapidPublicKey = 'YOUR_VAPID_PUBLIC_KEY';
            const convertedKey = urlBase64ToUint8Array(vapidPublicKey);
            
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedKey
            });
        }
        
        // Send subscription to your backend
        await sendSubscriptionToServer(subscription);
        
        return true;
    } catch (error) {
        console.error('Error subscribing to push notifications:', error);
        return false;
    }
}

// Helper function to convert base64 to Uint8Array (for VAPID key)
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');
    
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// Function to send subscription to your server
async function sendSubscriptionToServer(subscription) {
    try {
        const response = await fetch('/api/subscribe', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(subscription)
        });
        return response.json();
    } catch (error) {
        console.error('Error sending subscription to server:', error);
    }
}

// Function to check for app updates
function checkForUpdates() {
    // Check if service worker is supported
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(registration => {
            // Check for updates every hour
            setInterval(() => {
                registration.update();
                console.log('Checking for updates...');
            }, 60 * 60 * 1000); // Every hour
        });
        
        // Listen for the controlling service worker changing
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!refreshing) {
                refreshing = true;
                // Show update notification to user
                if (confirm('New version available! Reload to update?')) {
                    window.location.reload();
                }
            }
        });
    }
}

// Call this during app initialization
function initializeAppUpdates() {
    // Register button for push notification subscription
    const notificationBtn = document.getElementById('enable-notifications');
    if (notificationBtn) {
        notificationBtn.addEventListener('click', subscribeToPushNotifications);
    }
    
    // Initialize update checking
    checkForUpdates();
}

// Listen for update messages from the service worker and show a notification in the UI
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', event => {
        if (event.data && event.data.type === 'UPDATE_AVAILABLE') {
            // Show a toast or dialog to the user
            if (confirm('A new version of NeuroPulse is available! Reload to update?')) {
                window.location.reload();
            }
        }
    });
}

// Optionally, add a button in your UI to manually check for updates
// <button id="check-updates">Check for Updates</button>
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('check-updates');
    if (btn && 'serviceWorker' in navigator) {
        btn.addEventListener('click', () => {
            if (navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({ type: 'CHECK_UPDATE' });
            }
        });
    }
});

// Add this to your existing initialization code
document.addEventListener('DOMContentLoaded', () => {
    // ...existing code...
    initializeAppUpdates();
});

// Initialize the app
new ChatApp();
