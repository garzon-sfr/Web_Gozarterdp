// src/js/modules/push-notifications.js
import { auth, messaging, signInAnonymously, getToken, onMessage } from '../firebase.js';

class PushNotifications {
    constructor() {
        this.token = null;
        this.isSubscribed = false;
        this.isAuthenticated = false;
        this.vapidKey = "BPQgbWZXP39cxDbBVVd7IyF6iEFe5aX-63nj5bMH8Oq5S4tFDDBQMfqI_miCoKmQvVcT0a_Xi3h4SQVvDG0i31Q";
        this.backendUrl = "https://notificacion.gozarterdp.com";
        this.toastContainer = null;
        this.autoRequestDone = false;
        this.tokenRequested = false; // Evitar múltiples solicitudes
        
        this.init();
    }

    async init() {
        this.createToastContainer();
        this.injectStyles();
        this.listenForMessages();
        await this.checkAuth();
        this.autoRequestNotifications();
    }

    injectStyles() {
        if (document.getElementById('push-notification-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'push-notification-styles';
        styles.textContent = `
            @keyframes pushSlideInRight {
                from { opacity: 0; transform: translateX(100%); }
                to { opacity: 1; transform: translateX(0); }
            }
            @keyframes pushSlideOutRight {
                from { opacity: 1; transform: translateX(0); }
                to { opacity: 0; transform: translateX(100%); }
            }
            .push-toast {
                position: relative;
                padding: 14px 18px;
                margin-bottom: 12px;
                border-radius: 16px;
                font-family: 'Poppins', sans-serif;
                font-size: 14px;
                font-weight: 500;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
                animation: pushSlideInRight 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
                cursor: pointer;
                max-width: 360px;
                min-width: 280px;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.2);
            }
            .push-toast:hover { transform: translateX(-5px); }
            .push-toast.push-toast-info { background: linear-gradient(135deg, rgba(33, 147, 176, 0.95), rgba(109, 213, 237, 0.95)); }
            .push-toast.push-toast-success { background: linear-gradient(135deg, rgba(17, 153, 142, 0.95), rgba(56, 239, 125, 0.95)); }
            .push-toast.push-toast-error { background: linear-gradient(135deg, rgba(235, 51, 73, 0.95), rgba(244, 92, 67, 0.95)); }
            .push-toast.push-toast-warning { background: linear-gradient(135deg, rgba(242, 153, 74, 0.95), rgba(242, 201, 76, 0.95)); }
            .push-toast-content { display: flex; align-items: center; gap: 14px; }
            .push-toast-icon { font-size: 24px; }
            .push-toast-text { flex: 1; }
            .push-toast-title { font-weight: 700; font-size: 15px; display: block; }
            .push-toast-message { font-size: 12px; opacity: 0.9; display: block; }
            .push-toast-close {
                background: rgba(255, 255, 255, 0.2);
                border: none;
                color: white;
                width: 24px;
                height: 24px;
                border-radius: 12px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .push-toast-close:hover { background: rgba(255, 255, 255, 0.4); }
            .push-toast-progress {
                position: absolute;
                bottom: 0;
                left: 0;
                height: 3px;
                background: rgba(255, 255, 255, 0.5);
                border-radius: 0 0 0 16px;
                animation: pushProgress 5s linear forwards;
            }
            @keyframes pushProgress {
                from { width: 100%; }
                to { width: 0%; }
            }
        `;
        document.head.appendChild(styles);
    }

    createToastContainer() {
        if (!document.getElementById('push-toast-container')) {
            this.toastContainer = document.createElement('div');
            this.toastContainer.id = 'push-toast-container';
            this.toastContainer.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                gap: 12px;
                pointer-events: none;
            `;
            document.body.appendChild(this.toastContainer);
        } else {
            this.toastContainer = document.getElementById('push-toast-container');
        }
    }

    showToast(title, message, type = 'info', duration = 5000) {
        const toast = document.createElement('div');
        toast.className = `push-toast push-toast-${type}`;
        toast.style.pointerEvents = 'auto';
        
        const icons = { info: '🔔', success: '✅', error: '❌', warning: '⚠️' };
        
        toast.innerHTML = `
            <div class="push-toast-content">
                <div class="push-toast-icon">${icons[type] || '🔔'}</div>
                <div class="push-toast-text">
                    <strong class="push-toast-title">${this.escapeHtml(title)}</strong>
                    ${message ? `<span class="push-toast-message">${this.escapeHtml(message)}</span>` : ''}
                </div>
                <button class="push-toast-close"><i class="fas fa-times"></i></button>
            </div>
            <div class="push-toast-progress" style="animation-duration: ${duration}ms"></div>
        `;
        
        const closeBtn = toast.querySelector('.push-toast-close');
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeToast(toast);
        });
        
        toast.addEventListener('click', (e) => {
            if (e.target !== closeBtn && !closeBtn.contains(e.target)) {
                this.closeToast(toast);
            }
        });
        
        this.toastContainer.appendChild(toast);
        
        setTimeout(() => {
            if (toast.parentNode) this.closeToast(toast);
        }, duration);
        
        return toast;
    }

    closeToast(toast) {
        toast.style.animation = 'pushSlideOutRight 0.3s ease forwards';
        setTimeout(() => {
            if (toast.parentNode) toast.remove();
        }, 300);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async autoRequestNotifications() {
        if (this.autoRequestDone) return;
        this.autoRequestDone = true;

        if (this.isSubscribed) return;
        if (Notification.permission === 'denied') return;

        if (Notification.permission === 'granted') {
            await this.activateNotifications(true);
            return;
        }

        setTimeout(async () => {
            if (Notification.permission === 'default') {
                await this.activateNotifications(true);
            }
        }, 3000);
    }

    async activateNotifications(silent = false) {
        // Evitar múltiples solicitudes
        if (this.tokenRequested) return false;
        this.tokenRequested = true;
        
        // 1. Autenticación anónima
        if (!this.isAuthenticated) {
            try {
                const userCredential = await signInAnonymously(auth);
                this.isAuthenticated = true;
            } catch (error) {
                this.tokenRequested = false;
                if (!silent) this.showToast('❌ Error', 'Error de autenticación', 'error', 4000);
                return false;
            }
        }

        // 2. Pedir permiso
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
            this.tokenRequested = false;
            if (!silent) {
                this.showToast('⚠️ Permiso denegado', 'Activa desde el botón', 'warning', 4000);
            }
            return false;
        }

        // 3. Obtener token - Usar try-catch silencioso para el error interno
        try {
            // El error deleteTokenInternal ocurre dentro de Firebase, lo atrapamos silenciosamente
            this.token = await getToken(messaging, { vapidKey: this.vapidKey });
            
            if (!this.token) {
                this.tokenRequested = false;
                if (!silent) this.showToast('❌ Error', 'No se pudo obtener token', 'error', 4000);
                return false;
            }
            
            // 4. Enviar al backend
            const response = await fetch(`${this.backendUrl}/suscribir`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    token: this.token,
                    userId: auth.currentUser?.uid,
                    timestamp: Date.now()
                })
            });

            if (response.ok) {
                this.isSubscribed = true;
                localStorage.setItem('push_subscribed', 'true');
                localStorage.setItem('push_token', this.token);
                
                // Mostrar toast de éxito SIEMPRE (tanto automático como manual)
                this.showToast('🔔 Notificaciones activadas', 'Recibirás alertas importantes', 'success', 4000);
                return true;
            } else {
                throw new Error('Error backend');
            }
            
        } catch (error) {
            this.tokenRequested = false;
            // El error de Firebase es interno, no lo mostramos al usuario
            if (!error.message?.includes('pushManager') && !error.message?.includes('deleteTokenInternal')) {
                console.error("Error:", error);
                if (!silent) this.showToast('❌ Error', 'No se pudieron activar', 'error', 4000);
            }
            return false;
        }
    }

    listenForMessages() {
        onMessage(messaging, (payload) => {
            const title = payload.notification?.title || 'Gozarte RDP';
            const body = payload.notification?.body || '';
            this.showToast(title, body, 'info', 6000);
        });
    }

    async checkAuth() {
        const currentUser = auth.currentUser;
        if (currentUser) {
            this.isAuthenticated = true;
        }
        
        const savedSubscription = localStorage.getItem('push_subscribed');
        if (savedSubscription === 'true' && Notification.permission === 'granted') {
            this.isSubscribed = true;
            this.token = localStorage.getItem('push_token');
        }
    }
}

const pushNotifications = new PushNotifications();
export default pushNotifications;