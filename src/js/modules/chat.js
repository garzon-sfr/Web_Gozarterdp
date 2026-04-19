// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDoVSYZvO_ew5ySaN7981J8S6rxV1aCwrQ",
  authDomain: "gozartechat.firebaseapp.com",
  databaseURL: "https://gozartechat-default-rtdb.firebaseio.com",
  projectId: "gozartechat",
  storageBucket: "gozartechat.firebasestorage.app",
  messagingSenderId: "845903029009",
  appId: "1:845903029009:web:dc28a9f7435a7a1b9c62b0"
};

class ChatManager {
    constructor() {
        this.firebase = null;
        this.database = null;
        this.currentUser = null;
        this.messagesRef = null;
        this.usersRef = null;
        this.isOpen = false;
        this.maxMessages = 30; // Límite en Firebase
        this.messageLimit = 30; // Límite a mostrar
        this.displayedMessages = new Set(); // Para evitar duplicados
        
        this.init();
    }

    async init() {
        try {
            // Import Firebase modules
            const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
            const { getDatabase, ref, push, onValue, off, serverTimestamp, limitToLast, query, orderByKey, remove } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');
            
            // Initialize Firebase
            this.firebase = initializeApp(firebaseConfig);
            this.database = getDatabase(this.firebase);
            
            // Setup references
            this.messagesRef = ref(this.database, 'messages');
            this.usersRef = ref(this.database, 'users');
            
            // Store Firebase functions
            this.firebaseFunctions = {
                ref, push, onValue, off, serverTimestamp, limitToLast, query, orderByKey, remove
            };
            
            console.log('✅ Chat Firebase inicializado');
            this.setupEventListeners();
            
        } catch (error) {
            console.error('❌ Error Firebase:', error);
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

        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }

        if (joinButton) {
            joinButton.addEventListener('click', () => this.joinChat());
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
            const chatToggle = document.getElementById('chat-toggle');

            if (!chatContainer || !chatToggle) return;

            // Si el chat está cerrado → no hacer nada
            if (!this.isOpen) return;

            const clickedInsideChat = chatContainer.contains(e.target);
            const clickedToggle = chatToggle.contains(e.target);

            if (!clickedInsideChat && !clickedToggle) {
                this.closeChat();
            }
        });
    }

    closeChat() {
    const chatContainer = document.getElementById('chat-container');
    const chatToggle = document.getElementById('chat-toggle');

    if (!chatContainer || !chatToggle) return;

    this.isOpen = false;
    chatContainer.classList.remove('open');
    chatToggle.innerHTML = '<i class="fas fa-comments"></i>';
}

    toggleChat() {
        const chatContainer = document.getElementById('chat-container');
        const chatToggle = document.getElementById('chat-toggle');
        
        if (!chatContainer || !chatToggle) return;

        if (this.isOpen) {
            this.closeChat();
            return;
        }

        this.isOpen = true;
        chatContainer.classList.add('open');
        chatToggle.innerHTML = '<i class="fas fa-times"></i>';

        if (this.currentUser) {
            this.loadMessages();
        }
    }

    async joinChat() {
        const usernameInput = document.getElementById('username-input');
        const username = usernameInput.value.trim();
        
        if (!username) {
            alert('Por favor, ingresa un nombre');
            return;
        }

        if (username.length < 2 || username.length > 20) {
            alert('El nombre debe tener entre 2 y 20 caracteres');
            return;
        }

        this.currentUser = {
            id: this.generateUserId(),
            username: username,
            joinedAt: Date.now(),
            color: this.generateUserColor()
        };

        localStorage.setItem('gozarte_chat_user', JSON.stringify(this.currentUser));
        this.showChatInterface();
        
        // Mensajes de bienvenida predeterminados
        const welcomeMessages = [
            `¡Hola ${username}! 🎵 Bienvenido a Gozarte RDP`,
            `¡${username} se ha unido al chat! 👋 ¡Comparte tu opinión!`,
            `¡Bienvenido ${username}! 🎶 Comparte tu canción favorita`,
            `¡${username} está aquí! 🎧 ¡Que viva la música cristiana!`,
            `¡Hola ${username}! 🙏 Bendiciones y buena música!`
        ];
        
        const randomWelcome = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
        this.welcomeMessage = randomWelcome; // Guardar para mostrarlo después
        
        this.loadMessages();
    }

    showChatInterface() {
        const loginSection = document.getElementById('chat-login');
        const chatSection = document.getElementById('chat-interface');
        const userInfo = document.getElementById('current-user');
        
        if (loginSection) loginSection.style.display = 'none';
        if (chatSection) chatSection.style.display = 'flex';
        if (userInfo) userInfo.textContent = this.currentUser.username;
    }

    async sendMessage() {
        const chatInput = document.getElementById('chat-input');
        const message = chatInput.value.trim();
        
        if (!message || !this.currentUser) return;
        
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
                timestamp: this.firebaseFunctions.serverTimestamp(),
                clientTimestamp: Date.now()
            };

            await this.firebaseFunctions.push(this.messagesRef, messageData);
            chatInput.value = '';
            
            // Limpiar mensajes antiguos si exceden el límite
            this.cleanOldMessages();
            
        } catch (error) {
            console.error('Error al enviar:', error);
            alert('Error al enviar mensaje');
        }
    }

    loadMessages() {
        if (!this.database || !this.currentUser) return;

        const messagesQuery = this.firebaseFunctions.query(
            this.messagesRef,
            this.firebaseFunctions.limitToLast(this.messageLimit)
        );

        this.firebaseFunctions.onValue(messagesQuery, (snapshot) => {
            const messages = [];
            snapshot.forEach((child) => {
                messages.push({
                    id: child.key,
                    ...child.val()
                });
            });
            
            // Solo cargar completamente si es la primera vez
            if (this.displayedMessages.size === 0) {
                this.loadInitialMessages(messages);
            } else {
                this.displayMessages(messages);
            }
        });
    }

    // Carga inicial de mensajes sin parpadeo
    loadInitialMessages(messages) {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;

        messagesContainer.innerHTML = '';
        this.displayedMessages.clear();
        
        // Cargar mensajes existentes primero
        messages.forEach(message => {
            this.addMessageToDOM(message);
            this.displayedMessages.add(message.id);
        });
        
        // Mostrar mensaje de bienvenida AL FINAL (como mensaje más reciente)
        if (this.welcomeMessage) {
            this.addSystemMessage(this.welcomeMessage);
            this.welcomeMessage = null; // Limpiar después de mostrarlo
        }
        
        // Scroll inicial sin animación
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    displayMessages(messages) {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;

        // Solo añadir mensajes nuevos que no hemos mostrado
        messages.forEach(message => {
            if (!this.displayedMessages.has(message.id)) {
                this.addMessageToDOM(message);
                this.displayedMessages.add(message.id);
            }
        });
        
        // Mantener solo los IDs de los últimos 30 mensajes
        if (this.displayedMessages.size > this.messageLimit) {
            const messagesArray = Array.from(this.displayedMessages);
            const messagesToKeep = messagesArray.slice(-this.messageLimit);
            this.displayedMessages = new Set(messagesToKeep);
            
            // Limpiar mensajes del DOM que ya no necesitamos
            this.cleanupDOM();
        }
    }

    addMessageToDOM(message) {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message';
        messageDiv.setAttribute('data-message-id', message.id); // Para identificar el mensaje
        
        const isOwnMessage = message.userId === this.currentUser?.id;
        if (isOwnMessage) {
            messageDiv.classList.add('own-message');
        }

        const timestamp = new Date(message.clientTimestamp || Date.now()).toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit'
        });

        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="username" style="color: ${message.color || '#ffffff'}">${message.username}</span>
                <span class="timestamp">${timestamp}</span>
            </div>
            <div class="message-text">${this.escapeHtml(message.text)}</div>
        `;

        messagesContainer.appendChild(messageDiv);
        
        // Scroll suave solo para mensajes nuevos
        this.smoothScrollToBottom();
    }

    addSystemMessage(text) {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message system-message';
        messageDiv.innerHTML = `<div class="message-text">${text}</div>`;

        messagesContainer.appendChild(messageDiv);
        this.smoothScrollToBottom();
    }

    generateUserId() {
        return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    generateUserColor() {
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
            '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
        ];
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
                this.showChatInterface();
                
                // Mensaje de regreso para usuarios que ya tienen sesión
                const returnMessages = [
                    `¡${this.currentUser.username} te escuchamos! 🔥`,
                    `¡Bienvenido de vuelta ${this.currentUser.username}! 🎵`,
                    `¡${this.currentUser.username} Cuentanos tu opinión!👋`,
                    `¡Hola otra vez ${this.currentUser.username}! 🎶`
                ];
                
                const randomReturn = returnMessages[Math.floor(Math.random() * returnMessages.length)];
                this.welcomeMessage = randomReturn;
                
                return true;
            } catch (error) {
                localStorage.removeItem('gozarte_chat_user');
            }
        }
        return false;
    }

    // Scroll suave para evitar parpadeos
    smoothScrollToBottom() {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;

        // Usar requestAnimationFrame para un scroll más suave
        requestAnimationFrame(() => {
            messagesContainer.scrollTo({
                top: messagesContainer.scrollHeight,
                behavior: 'smooth'
            });
        });
    }

    // Limpiar mensajes del DOM que ya no necesitamos
    cleanupDOM() {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;

        const messageElements = messagesContainer.querySelectorAll('.chat-message:not(.system-message)');
        
        // Si hay más de 30 mensajes en el DOM, eliminar los más antiguos
        if (messageElements.length > this.messageLimit) {
            const messagesToRemove = messageElements.length - this.messageLimit;
            for (let i = 0; i < messagesToRemove; i++) {
                if (messageElements[i]) {
                    messageElements[i].remove();
                }
            }
        }
    }

    // Limpiar mensajes antiguos automáticamente
    async cleanOldMessages() {
        try {
            // Obtener todos los mensajes ordenados por clave (timestamp)
            const allMessagesQuery = this.firebaseFunctions.query(
                this.messagesRef,
                this.firebaseFunctions.orderByKey()
            );

            this.firebaseFunctions.onValue(allMessagesQuery, async (snapshot) => {
                const messages = [];
                snapshot.forEach((child) => {
                    messages.push({
                        key: child.key,
                        timestamp: child.val().clientTimestamp || 0
                    });
                });

                // Si hay más de 30 mensajes, eliminar los más antiguos
                if (messages.length > this.maxMessages) {
                    const messagesToDelete = messages
                        .sort((a, b) => a.timestamp - b.timestamp)
                        .slice(0, messages.length - this.maxMessages);

                    // Eliminar mensajes antiguos
                    for (const message of messagesToDelete) {
                        const messageRef = this.firebaseFunctions.ref(this.database, `messages/${message.key}`);
                        await this.firebaseFunctions.remove(messageRef);
                    }
                    
                    console.log(`🧹 Eliminados ${messagesToDelete.length} mensajes antiguos`);
                }
            }, { onlyOnce: true }); // Solo ejecutar una vez
        } catch (error) {
            console.error('Error al limpiar mensajes:', error);
        }
    }

    cleanup() {
        if (this.messagesRef && this.firebaseFunctions) {
            this.firebaseFunctions.off(this.messagesRef);
        }
    }
}

export default ChatManager; 