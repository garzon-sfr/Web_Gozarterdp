/**
 * ==========================================
 * GOZARTE RDP - YOUTUBE LIVE MANAGER
 * Detección en tiempo real con Firebase RTDB,
 * Alerta flotante neón, reproductor embebido y auto-pausa de radio
 * ==========================================
 */

import { database, ref, onValue } from '../firebase.js';

class YouTubeLiveManager {
    constructor(playerInstance) {
        this.database = database;
        this.player = playerInstance; // Referencia a VintageRadioPlayer para pausar/reanudar
        this.channelId = 'UCJOz8K1UUYBhHCUOEFHHJng'; // @IglesiaReydePazStaBarbara
        
        this.isLive = false;
        this.currentVideoId = null;
        this.streamTitle = 'Transmisión en Vivo';
        this.isOpen = false;
        this.wasRadioPlayingBefore = false;

        this.elements = {
            banner: document.getElementById('ytLiveBanner'),
            modal: document.getElementById('ytModal'),
            closeBtn: document.getElementById('ytModalClose'),
            iframe: document.getElementById('ytIframe'),
            streamTitle: document.getElementById('ytStreamTitle')
        };

        this.init();
    }

    /**
     * Inicialización del módulo
     */
    init() {
        this.setupEventListeners();
        this.listenToFirebase();
    }

    /**
     * Escucha cambios en tiempo real en Firebase RTDB
     */
    listenToFirebase() {
        try {
            const liveRef = ref(this.database, 'transmision_youtube');
            onValue(liveRef, (snapshot) => {
                const data = snapshot.val();
                if (data && (data.enVivo === true || data.isLive === true)) {
                    this.setLiveState(true, data);
                } else {
                    this.setLiveState(false);
                }
            }, (error) => {
                console.error('❌ Error escuchando transmisión de YouTube:', error);
            });
        } catch (err) {
            console.error('❌ Error inicializando listener de YouTube:', err);
        }
    }

    /**
     * Actualiza el estado en vivo y muestra/oculta el botón flotante
     */
    setLiveState(isLive, data = {}) {
        this.isLive = isLive;

        if (!this.elements.banner) return;

        if (isLive) {
            this.streamTitle = data.titulo || data.title || 'Transmisión en Vivo';
            this.currentVideoId = data.videoId || null;
            if (data.canalId) {
                this.channelId = data.canalId;
            }

            // Mostrar botón flotante
            this.elements.banner.classList.remove('hidden');

            if (this.elements.streamTitle) {
                this.elements.streamTitle.textContent = this.streamTitle;
            }
        } else {
            // Ocultar botón flotante
            this.elements.banner.classList.add('hidden');

            // Si el modal de video estaba abierto, cerrarlo
            if (this.isOpen) {
                this.closeModal();
            }
        }
    }

    /**
     * Configuración de eventos de UI
     */
    setupEventListeners() {
        if (this.elements.banner) {
            this.elements.banner.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openModal();
            });
        }

        if (this.elements.closeBtn) {
            this.elements.closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closeModal();
            });
        }

        if (this.elements.modal) {
            this.elements.modal.addEventListener('click', (e) => {
                if (e.target === this.elements.modal) {
                    this.closeModal();
                }
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.closeModal();
            }
        });
    }

    /**
     * Abre el modal del video y auto-pausa la radio
     */
    openModal() {
        if (!this.elements.modal || !this.elements.iframe) return;

        this.isOpen = true;
        this.elements.modal.classList.remove('hidden');

        // 🎵 Auto-pausa inteligente de la radio
        if (this.player && this.player.state && this.player.state.isPlaying) {
            this.wasRadioPlayingBefore = true;
            this.player.pause();
            console.log('🔇 Radio pausada automáticamente al ver YouTube Live');
        } else {
            this.wasRadioPlayingBefore = false;
        }

        // Cargar video embebido oficial
        let embedUrl = '';
        if (this.currentVideoId) {
            embedUrl = `https://www.youtube-nocookie.com/embed/${this.currentVideoId}?autoplay=1&rel=0&enablejsapi=1`;
        } else {
            embedUrl = `https://www.youtube-nocookie.com/embed/live_stream?channel=${this.channelId}&autoplay=1&rel=0&enablejsapi=1`;
        }

        this.elements.iframe.src = embedUrl;
    }

    /**
     * Cierra el modal, detiene el video y reanuda la radio
     */
    closeModal() {
        if (!this.elements.modal || !this.elements.iframe) return;

        this.isOpen = false;
        this.elements.modal.classList.add('hidden');

        // Cortar el stream de YouTube inmediatamente
        this.elements.iframe.src = '';

        // 🎵 Reanudar la radio si estaba sonando antes
        if (this.wasRadioPlayingBefore && this.player) {
            console.log('▶️ Reanudando radio tras cerrar YouTube Live');
            this.player.play();
            this.wasRadioPlayingBefore = false;
        }
    }
}

export default YouTubeLiveManager;
