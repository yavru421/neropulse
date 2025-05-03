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
        
        this.setupEventListeners();
        this.loadTheme();
        this.setupOfflineIndicator();
        this.setupVoiceInput();
        this.setupAutoResizeTextarea();
        this.loadMessages();
        
        // Configure markdown
        marked.setOptions({
            highlight: function(code, lang) {
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
    }

    // Show API key prompt
    showApiKeyPrompt() {
        const savedApiKey = localStorage.getItem('groqApiKey');
        const apiKey = prompt("Please enter your Groq API key:", savedApiKey || "");
        
        if (apiKey) {
            localStorage.setItem('groqApiKey', apiKey);
            this.apiKey = apiKey;
        } else {
            // If no API key provided, show warning message
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
        
        // Add settings button event listener
        const settingsButton = document.getElementById('settings-button');
        if (settingsButton) {
            settingsButton.addEventListener('click', () => this.showApiKeyPrompt());
        }
        
        // Handle drag and drop for files
        this.userInput.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.userInput.classList.add('dragover');
        });
        
        this.userInput.addEventListener('dragleave', () => {
            this.userInput.classList.remove('dragover');
        });
        
        this.userInput.addEventListener('drop', (e) => this.handleFileDrop(e));
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

        // Add user message to UI
        this.addMessage(content, 'user');
        this.messageHistory.push(content);
        this.historyIndex = -1;
        
        this.userInput.value = '';
        this.userInput.style.height = 'auto';

        // Add a "thinking" message
        const thinkingMsgElement = this.addMessage("Thinking...", 'assistant');
        
        try {
            // Check if API key is available
            if (!this.apiKey) {
                this.showApiKeyPrompt();
                if (!this.apiKey) {
                    this.messagesContainer.removeChild(thinkingMsgElement);
                    this.addMessage("⚠️ API key is required to communicate with Groq. Please add your API key in settings.", "system");
                    return;
                }
            }
            
            // Make direct API call to Groq
            const response = await this.callGroqAPI(content);
            
            // Remove the "thinking" message
            this.messagesContainer.removeChild(thinkingMsgElement);
            
            // Add the actual response
            this.addMessage(response, 'assistant');
        } catch (error) {
            console.error("Error calling Groq API:", error);
            // Remove the "thinking" message
            this.messagesContainer.removeChild(thinkingMsgElement);
            
            // Add error message
            this.addMessage(`Error: ${error.message}. Please check your API key or try again later.`, 'system');
        }
    }

    async callGroqAPI(prompt) {
        // Direct call to Groq API
        const endpoint = "https://api.groq.com/openai/v1/chat/completions";
        
        const payload = {
            model: "llama-3.3-70b-versatile", // Can be changed to another Groq model
            messages: [
                { role: "user", content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 2048
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
            // System messages are displayed as-is
            messageDiv.textContent = content;
        } else {
            // Process markdown and sanitize HTML for user and assistant messages
            const sanitizedContent = this.sanitizeHTML(marked.parse(content));
            messageDiv.innerHTML = sanitizedContent;
            
            // Add syntax highlighting to code blocks
            messageDiv.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
            });
        }

        this.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
        
        // Save messages to localStorage (except for thinking messages)
        if (content !== "Thinking...") {
            this.saveMessages();
        }

        return messageDiv;
    }

    sanitizeHTML(html) {
        const div = document.createElement('div');
        div.innerHTML = html;
        
        // Remove potentially dangerous attributes
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
            // Re-add welcome message
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
            // Remove welcome message if we have saved messages
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
}

// Initialize the app
new ChatApp();