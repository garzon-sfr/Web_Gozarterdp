// src/js/modules/chat.js
import {database,ref,push,onValue,off,serverTimestamp,limitToLast,query,orderByKey,remove} from '../firebase.js';

class ChatManager {
    constructor() {
        this.database = database;
        this.currentUser = null;
        this.messagesRef = null;
        this.isOpen = false;
        this.maxMessages = 30;
        this.messageLimit = 30;
        this.displayedMessages = new Set();
        this.messageListener = null;
        
        this.init();
    }

    init() {
        try {
            this.messagesRef = ref(this.database, 'messages');
            // console.log('✅ ChatManager inicializado');
            this.setupEventListeners();
            this.checkSavedUser();
        } catch (error) {
            console.error('❌ Error inicializando ChatManager:', error);
        }
    }

    setupEventListeners() {
        const chatToggle = document.getElementById('chat-toggle');
        const chatInput = document.getElementById('chat-input');
        const sendButton = document.getElementById('send-message');
        const joinButton = document.getElementById('join-chat');
        const usernameInput = document.getElementById('username-input');

        if (chatToggle) {
            chatToggle.addEventListener('click', () => this.toggleChat());
        }

        if (sendButton) {
            sendButton.addEventListener('click', () => this.sendMessage());
        }

        if (joinButton) {
            joinButton.addEventListener('click', () => this.joinChat());
        }
        
        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }
        
        if (usernameInput) {
            usernameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.joinChat();
                }
            });
        }

        // Cerrar chat al hacer click fuera
        document.addEventListener('click', (e) => {
            const chatContainer = document.getElementById('chat-container');
            const chatToggleElem = document.getElementById('chat-toggle');
            
            if (!chatContainer || !chatToggleElem || !this.isOpen) return;
            
            if (!chatContainer.contains(e.target) && !chatToggleElem.contains(e.target)) {
                this.closeChat();
            }
        });
    }

    closeChat() {
        const chatContainer = document.getElementById('chat-container');
        const chatToggle = document.getElementById('chat-toggle');
        
        if (!chatContainer) return;

        this.isOpen = false;
        chatContainer.classList.remove('open');
        if (chatToggle) {
            chatToggle.innerHTML = '<i class="fas fa-comments"></i>';
        }
        
        if (this.messageListener && this.messagesRef) {
            off(this.messagesRef, 'value', this.messageListener);
            this.messageListener = null;
        }
    }

    toggleChat() {
        const chatContainer = document.getElementById('chat-container');
        const chatToggle = document.getElementById('chat-toggle');
        
        if (!chatContainer) return;

        if (this.isOpen) {
            this.closeChat();
            return;
        }

        this.isOpen = true;
        chatContainer.classList.add('open');
        if (chatToggle) {
            chatToggle.innerHTML = '<i class="fas fa-times"></i>';
        }

        if (this.currentUser) {
            this.loadMessages();
        }
    }

    joinChat() {
        const usernameInput = document.getElementById('username-input');
        const username = usernameInput ? usernameInput.value.trim() : '';
        
        if (!username) {
            alert('Por favor, ingresa un nombre');
            return;
        }

        if (username.length < 2 || username.length > 20) {
            alert('El nombre debe tener entre 2 y 20 caracteres');
            return;
        }

        this.currentUser = {
            id: 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            username: username,
            joinedAt: Date.now(),
            color: this.generateUserColor()
        };

        localStorage.setItem('gozarte_chat_user', JSON.stringify(this.currentUser));
        
        const loginSection = document.getElementById('chat-login');
        const chatSection = document.getElementById('chat-interface');
        const userInfo = document.getElementById('current-user');
        
        if (loginSection) loginSection.style.display = 'none';
        if (chatSection) chatSection.style.display = 'flex';
        if (userInfo) userInfo.textContent = username;
        
        this.loadMessages();
        
        setTimeout(() => {
            this.addSystemMessage(`✨ ${username} se unió a la conversación`);
        }, 500);
    }

    async sendMessage() {
        const chatInput = document.getElementById('chat-input');
        const message = chatInput ? chatInput.value.trim() : '';
        
        if (!message || !this.currentUser || !this.messagesRef) return;
        
        if (message.length > 500) {
            alert('Mensaje muy largo (máximo 500 caracteres)');
            return;
        }
    
        try {
            const messageData = {
                text: message,
                username: this.currentUser.username,
                userId: this.currentUser.id,
                color: this.currentUser.color,
                timestamp: serverTimestamp(),
                clientTimestamp: Date.now()
            };

            await push(this.messagesRef, messageData);
            if (chatInput) chatInput.value = '';
            
        } catch (error) {
            console.error('Error al enviar:', error);
            alert('Error al enviar mensaje');
        }
    }

    loadMessages() {
        if (!this.currentUser || !this.messagesRef) return;
        
        if (this.messageListener) {
            off(this.messagesRef, 'value', this.messageListener);
        }

        const messagesQuery = query(this.messagesRef, limitToLast(this.messageLimit));

        this.messageListener = onValue(messagesQuery, (snapshot) => {
            const messages = [];
            snapshot.forEach((child) => {
                messages.push({
                    id: child.key,
                    ...child.val()
                });
            });
            
            messages.sort((a, b) => (a.clientTimestamp || 0) - (b.clientTimestamp || 0));
            
            if (this.displayedMessages.size === 0) {
                this.loadInitialMessages(messages);
            } else {
                this.displayMessages(messages);
            }
        });
    }

    loadInitialMessages(messages) {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;

        messagesContainer.innerHTML = '';
        this.displayedMessages.clear();
        
        messages.forEach(message => {
            this.addMessageToDOM(message);
            this.displayedMessages.add(message.id);
        });
        
        if (this.currentUser && !localStorage.getItem('chat_welcome_shown')) {
            const welcomeMessages = [
                `¡Hola ${this.currentUser.username}! 🎵 Bienvenido a Gozarte RDP`,
                `¡${this.currentUser.username}! 👋 ¡Comparte tu opinión!`,
                `¡Bienvenido ${this.currentUser.username}! 🎶 Comparte tu canción favorita`
            ];
            const randomWelcome = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
            this.addSystemMessage(randomWelcome);
            localStorage.setItem('chat_welcome_shown', 'true');
        }
        
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    displayMessages(messages) {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;

        messages.forEach(message => {
            if (!this.displayedMessages.has(message.id)) {
                this.addMessageToDOM(message);
                this.displayedMessages.add(message.id);
            }
        });
    }

    addMessageToDOM(message) {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message';
        messageDiv.setAttribute('data-message-id', message.id);
        
        const isOwnMessage = this.currentUser && message.userId === this.currentUser.id;
        if (isOwnMessage) {
            messageDiv.classList.add('own-message');
        }

        const timestamp = new Date(message.clientTimestamp || Date.now()).toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit'
        });

        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="username" style="color: ${message.color || '#ffffff'}">${this.escapeHtml(message.username)}</span>
                <span class="timestamp">${timestamp}</span>
            </div>
            <div class="message-text">${this.escapeHtml(message.text)}</div>
        `;

        messagesContainer.appendChild(messageDiv);
        this.smoothScrollToBottom();
    }

    addSystemMessage(text) {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message system-message';
        messageDiv.innerHTML = `<div class="message-text">ℹ️ ${this.escapeHtml(text)}</div>`;

        messagesContainer.appendChild(messageDiv);
        this.smoothScrollToBottom();
        
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.style.opacity = '0';
                messageDiv.style.transition = 'opacity 0.5s';
                setTimeout(() => {
                    if (messageDiv.parentNode) messageDiv.remove();
                }, 500);
            }
        }, 8000);
    }

    generateUserColor() {
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    checkSavedUser() {
        const savedUser = localStorage.getItem('gozarte_chat_user');
        if (savedUser) {
            try {
                this.currentUser = JSON.parse(savedUser);
                
                const loginSection = document.getElementById('chat-login');
                const chatSection = document.getElementById('chat-interface');
                const userInfo = document.getElementById('current-user');
                
                if (loginSection) loginSection.style.display = 'none';
                if (chatSection) chatSection.style.display = 'flex';
                if (userInfo) userInfo.textContent = this.currentUser.username;
                
                // console.log('✅ Usuario recuperado:', this.currentUser.username);
                return true;
            } catch (error) {
                localStorage.removeItem('gozarte_chat_user');
            }
        }
        return false;
    }

    smoothScrollToBottom() {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;
        
        setTimeout(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 100);
    }

    cleanup() {
        if (this.messageListener && this.messagesRef) {
            off(this.messagesRef, 'value', this.messageListener);
            this.messageListener = null;
        }
        // console.log('🧹 Chat limpiado');
    }
}

export default ChatManager;