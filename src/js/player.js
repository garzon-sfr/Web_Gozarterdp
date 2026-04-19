import ChatManager from './modules/chat.js';
import pushNotifications from './modules/push-notifications.js';
/* ==========================================
   GOZARTE RDP - VINTAGE PLAYER
   Lógica independiente, optimizada, sin dependencia de API
   ========================================== */

class VintageRadioPlayer {
    constructor() {
        // Constantes API
        this.API_BASE_URL = 'https://panel.gozarterdp.com/api';
        this.STATION_SHORT_NAME = 'gozarte_radio';
        this.FIXED_STREAM_URL = 'https://panel.gozarterdp.com/listen/gozarte_radio/radio.mp3';

        // Estado
        this.state = {
            currentNowPlaying: null,
            isPlaying: false,
            isOnline: false,
            isLive: false,
            isMuted: false,
            currentSongArt: null,
            updateTimer: null,
            connectionRetries: 0,
            lastArtworkUrl: null // Para detectar cambios
        };

        // chat manager
        this.chat = new ChatManager();

        this.pushNotifications = pushNotifications;
        // console.log('✅ Notificaciones push listas');
        
        // Agregar botón de notificaciones al menú
        this.addNotificationButton();
        


        // Elementos DOM
        this.elements = {
            playPauseButton: document.getElementById('playPauseButton'),
            volumeButton: document.getElementById('volumeButton'),
            volumeSlider: document.getElementById('volumeSlider'),
            menuToggle: document.getElementById('menuToggle'),
            menuDropdown: document.getElementById('menuDropdown'),
            menuClose: document.getElementById('menuClose'),
            
            trackTitle: document.getElementById('trackTitle'),
            trackArtist: document.getElementById('trackArtist'),
            trackText: document.getElementById('trackText'),
            offlineIndicator: document.getElementById('offlineIndicator'),
            
            artworkMain: document.getElementById('artworkMain'),
            songArtworkContainer: document.getElementById('songArtworkContainer'),
            songArtworkImg: document.getElementById('songArtworkImg'),
            
            audioElement: document.getElementById('audioElement'),
            mainApp: document.getElementById('mainApp')
        };

        this.init();
    }

    /**
     * Inicializa el reproductor
     */
    init() {
        // console.log('🎙️ Inicializando VintageRadioPlayer...');
        
        // Configurar audio element
        this.setupAudioElement();
        
        // Agregar event listeners
        this.setupEventListeners();
        
        // Configurar Media Session
        this.setupMediaSession();
        
        // Mostrar UI por defecto
        this.renderInitialState();
        
        // Cargar datos de la API
        this.fetchNowPlaying();
        
        // Iniciar polling
        this.startPolling();
        
        // init chat        
        this.chat.checkSavedUser();

        // console.log('✓ VintageRadioPlayer listo');
    }

    /**
     * Configura el elemento de audio
     */
    setupAudioElement() {
        this.elements.audioElement.crossOrigin = 'anonymous';
        this.elements.audioElement.volume = parseInt(this.elements.volumeSlider.value, 10) / 100;
        this.elements.audioElement.muted = false;
        this.updateVolumeIcon(false);
    }

    /**
     * Configura Media Session para notificaciones y controles
     */
    setupMediaSession() {
        if (!('mediaSession' in navigator)) return;

        navigator.mediaSession.setActionHandler('play', () => {
            this.play();
        });

        navigator.mediaSession.setActionHandler('pause', () => {
            this.pause();
        });

        navigator.mediaSession.setActionHandler('stop', () => {
            this.pause();
        });
    }

    async updateMediaSessionMetadata(metadata) {
        if (!('mediaSession' in navigator)) return;

        const artworkUrl = metadata.artUrl || this.elements.songArtworkImg.src || this.elements.artworkMain.querySelector('img')?.src || '';
        const artworkSrc = await this.createBlurredArtwork(artworkUrl);

        navigator.mediaSession.metadata = new MediaMetadata({
            title: document.getElementById('pageTitle').textContent || 'GozarteRDP',
            artist: metadata.title || 'Sin título',
            album: metadata.artist || 'Radio Cristiana',
            artwork: [
                { src: artworkSrc, sizes: '512x512', type: 'image/webp' }
            ]
        });

        navigator.mediaSession.playbackState = this.elements.audioElement.paused ? 'paused' : 'playing';
    }

async createBlurredArtwork(artUrl) {
    // Si no hay URL, usar imagen default
    if (!artUrl) {
        return this.elements.artworkMain?.querySelector('img')?.src || '/assets/images/LogosRDP.webp';
    }

    try {
        const image = new Image();
        // No usar crossOrigin para evitar errores CORS
        // image.crossOrigin = 'anonymous';

        const loaded = await new Promise((resolve) => {
            const timeout = setTimeout(() => resolve(false), 3000); // Timeout 3 segundos
            image.onload = () => {
                clearTimeout(timeout);
                resolve(true);
            };
            image.onerror = () => {
                clearTimeout(timeout);
                resolve(false);
            };
            image.src = artUrl;
        });

        if (!loaded) {
            // Si no se pudo cargar, usar imagen default sin error
            return this.elements.artworkMain?.querySelector('img')?.src || '/assets/images/LogosRDP.webp';
        }

        const size = 512;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0, size, size);
        return canvas.toDataURL('image/webp');
    } catch (err) {
        // Silenciar cualquier error y usar imagen default
        return this.elements.artworkMain?.querySelector('img')?.src || '/assets/images/LogosRDP.webp';
    }
}

    /**
     * Configura todos los event listeners
     */
    setupEventListeners() {
        // Play/Pause
        this.elements.playPauseButton.addEventListener('click', () => this.togglePlay());
        
        // Volumen (mute-only)
        this.elements.volumeButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleMute();
        });
        this.elements.volumeSlider.addEventListener('input', (e) => {
            const volume = parseInt(e.target.value, 10) / 100;
            this.elements.audioElement.volume = Math.max(0, Math.min(1, volume));
            // console.log(`🔊 Volumen: ${e.target.value}%`);
        });
        
        // Menú
        this.elements.menuToggle.addEventListener('click', () => this.toggleMenu());
        this.elements.menuClose.addEventListener('click', () => this.toggleMenu());
        
        // Cerrar menú al hacer click fuera
        document.addEventListener('click', (e) => {
            if (!this.elements.menuDropdown.contains(e.target) && !this.elements.menuToggle.contains(e.target)) {
                this.elements.menuDropdown.classList.add('hidden');
            }

        });
        
        // Audio events
        this.elements.audioElement.addEventListener('play', () => this.onAudioPlay());
        this.elements.audioElement.addEventListener('pause', () => this.onAudioPause());
        this.elements.audioElement.addEventListener('error', (e) => this.onAudioError(e));
        
        // Visibilidad de pestaña
        document.addEventListener('visibilitychange', () => this.handleVisibilityChange());
        
        // Limpieza al cerrar
        window.addEventListener('beforeunload', () => this.cleanup());
    }

    /**
     * Renderiza el estado inicial de la UI
     * Esto permite que el reproductor sea visible incluso sin datos de API
     */
    renderInitialState() {
        this.updatePlayButtonState(false);
        this.updateOfflineIndicator(false);
        this.updateMetadataDisplay({
            title: 'GozarteRDP',
            artist: 'Rey De Paz-Santa Barbara',
            text: '',
            isOnline: false,
            isLive: false
        });
    }

    /**
     * Obtiene los datos del now playing desde AzuraCast
     */
    async fetchNowPlaying() {
        const url = `${this.API_BASE_URL}/nowplaying/${this.STATION_SHORT_NAME}`;
        
        try {
            // console.log('📡 Consultando API...');
            const response = await fetch(url, {
                cache: 'no-store',
                method: 'GET'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            this.state.currentNowPlaying = data;
            this.state.connectionRetries = 0;
            
            this.processNowPlayingData(data);
            // console.log('✓ Datos actualizados');
            
        } catch (err) {
            // console.error('❌ Error:', err.message);
            this.handleApiError();
        }
    }

    /**
     * Procesa los datos obtenidos de la API
     */
    processNowPlayingData(data) {
        if (!data) return;

        const listeners = data.listeners?.current || 0;
        const isOnline = data.is_online || (data.station && data.station.is_online);
        const isLive = data.live && data.live.is_live;

        const el = document.getElementById("listenersCount");
        if (el) {
            el.textContent = `${listeners}`;
        }
        this.state.isOnline = isOnline;
        this.state.isLive = isLive;

        // Actualizar status
        this.updateOfflineIndicator(!isOnline);

        // Procesar metadata
        const metadata = this.extractMetadata(data);
        this.updateMetadataDisplay(metadata);

        // Actualizar metadata multimedia
        this.updateMediaSessionMetadata(metadata);
        
        if (!isOnline) {
            this.elements.songArtworkContainer.classList.add('hidden');
            this.state.lastArtworkUrl = null; // Reseteamos para que cuando vuelva online detecte el cambio
        } else {
            // Solo intentamos actualizar el arte si la emisora está ONLINE
            this.updateArtwork(metadata);
        }
        //*chat* - actualizar estado de chat
        const indicator = document.querySelector('.online-indicator');

        if (indicator) {
        indicator.classList.toggle('active', this.state.isOnline);
}
        this.state.listeners = data.listeners?.current || 0;
    }

    /**
     * Extrae la metadata de los datos de API
     * Maneja tanto Live DJ como reproducción normal
     */
    extractMetadata(data) {
        const isLive = data.live && data.live.is_live;
        
        if (isLive) {
            // LIVE DJ - datos del DJ en vivo
            return {
                title: `🔴 EN VIVO - ${data.live.streamer_name || 'Transmisión en vivo'}`,
                artist: 'Tardes Gozarte',
                text: data.now_playing?.song?.text || 'Conectado con nuestro estudio',
                isOnline: true,
                isLive: true,
                // IMPORTANTE: Usar arte del DJ en vivo o de la canción actual
                artUrl: data.live.art || data.now_playing?.song?.art || null
            };
        } else if (data.is_online && data.now_playing?.song) {
            // REPRODUCCIÓN NORMAL
            const song = data.now_playing.song;
            return {
                title: song.title ||'Una Familia en la Fé', //Todo metadatos incompletos, mostrar nombre de la emisora
                artist:song.artist ||'Rey De Paz', //Todo metadatos incompletos, mostrar descripción genérica
                text: '',
                isOnline: true,
                isLive: false,
                artUrl: song.art || null
            };
        } else {
            // OFFLINE
            return {
                title: 'Estación fuera de línea',
                artist: 'Volveremos pronto',
                text: 'Gracias por escucharnos.',
                isOnline: false,
                isLive: false,
                artUrl: null
            };
        }
    }

    /**
     * SOLUCIÓN AL BUG DE ARTWORK EN LIVE DJ
     * Gestiona correctamente la visualización del artwork en transiciones Live
     */
    updateArtwork(metadata) {
        const currentArtUrl = metadata.artUrl;
        const lastArtUrl = this.state.lastArtworkUrl;

        // Detectar cambio de artwork
        if (currentArtUrl !== lastArtUrl) {
            this.state.lastArtworkUrl = currentArtUrl;
            
            if (currentArtUrl) {
                // Mostrar artwork
                // console.log('🎨 Actualizando artwork:', currentArtUrl);
                
                // Crear nueva imagen para precargarla
                const img = new Image();
                img.onload = () => {
                    this.elements.songArtworkImg.src = currentArtUrl;
                    this.elements.songArtworkContainer.classList.remove('hidden');
                };
                img.onerror = () => {
                    // console.warn('⚠️ Error cargando artwork');
                    this.elements.songArtworkContainer.classList.add('hidden');
                };
                img.src = currentArtUrl;
            } else {
                // Ocultar artwork si no hay URL
                this.elements.songArtworkContainer.classList.add('hidden');
            }
        }
    }

    /**
     * Actualiza la metadata en la UI
     */
    updateMetadataDisplay(metadata) {
        this.elements.trackTitle.textContent = metadata.title;
        this.elements.trackArtist.textContent = metadata.artist;
        this.elements.trackText.textContent = metadata.text;
    }

    /**
     * Actualiza el indicador offline dentro del artwork
     */
    updateOfflineIndicator(isOffline) {
        if (isOffline) {
            this.elements.offlineIndicator.classList.remove('hidden');
        } else {
            this.elements.offlineIndicator.classList.add('hidden');
        }
    }

    updateVolumeIcon(isMuted) {
        if (isMuted) {
            this.elements.volumeButton.innerHTML = '<i class="fas fa-volume-mute"></i>';
            this.elements.volumeButton.setAttribute('aria-label', 'Activar sonido');
        } else {
            this.elements.volumeButton.innerHTML = '<i class="fas fa-volume-up"></i>';
            this.elements.volumeButton.setAttribute('aria-label', 'Silenciar');
        }
    }

    toggleMute() {
        const isMuted = this.elements.audioElement.muted;
        this.elements.audioElement.muted = !isMuted;
        this.state.isMuted = this.elements.audioElement.muted;
        this.updateVolumeIcon(this.state.isMuted);
        // console.log(`🔇 ${this.state.isMuted ? 'Muted' : 'Unmuted'}`);
    }

    /**
     * Alterna play/pause
     */
    togglePlay() {
        if (!this.state.isOnline) {
            // console.warn('⚠️ No puedo reproducir: emisora offline');
            return;
        }

        // Actualizamos el estado interno ANTES de que termine el proceso asíncrono
        if (this.elements.audioElement.paused) {
            this.state.isPlaying = true; // Variable de control manual
            this.play();
        } else {
            this.state.isPlaying = false; // Variable de control manual
            this.pause();
        }
    }

    /**
     * Inicia reproducción con fade in
     */
    async play() {
        // console.log('▶️ Iniciando reproducción...');
        
        try {
            // 1. Configuramos el origen antes de darle a play
            this.elements.audioElement.src = this.FIXED_STREAM_URL;
            this.elements.audioElement.volume = 0;
            
            // 2. Esperamos la promesa (Crucial para evitar AbortError)
            this.elements.playPauseButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            await this.elements.audioElement.play();
            
            // 3. Si llegamos aquí, la reproducción empezó con éxito
            const targetVolume = parseInt(this.elements.volumeSlider.value, 10) / 100;
            this.fadeVolume(targetVolume, 800);
            
        } catch (err) {
            // Filtramos el error de interrupción porque es un comportamiento esperado en clics rápidos
            if (err.name === 'AbortError') {
                // console.log('⚠️ Reproducción interrumpida por el usuario (limpieza silenciosa).');
            } else {
                // console.error('❌ Error real al reproducir:', err);
                this.updatePlayButtonState(false);
            }
        }
    }

    /**
     * Pausa reproducción con fade out (Blindado)
     */
    pause() {
        //console.log('⏸️ Pausando reproducción...');
        
        // 1. Cambiamos el icono inmediatamente para que el usuario vea que la app respondió
        this.updatePlayButtonState(false);
        
        // 2. Iniciamos el efecto de sonido
        this.fadeVolume(0, 500);
        
        setTimeout(() => {
            const audio = this.elements.audioElement;
            audio.pause();
            audio.removeAttribute('src'); 
            audio.load(); 
            // console.log('🛑 Stream liberado.');
        }, 510);
    }

    /**
     * Fade de volumen suave
     */
    fadeVolume(targetVolume, duration = 500) {
        const startVolume = this.elements.audioElement.volume;
        const steps = 20;
        const stepDuration = duration / steps;
        const volumeStep = (targetVolume - startVolume) / steps;
        let currentStep = 0;

        const fadeInterval = setInterval(() => {
            currentStep++;
            this.elements.audioElement.volume = Math.max(0, Math.min(1, startVolume + volumeStep * currentStep));
            
            if (currentStep >= steps) {
                clearInterval(fadeInterval);
                this.elements.audioElement.volume = targetVolume;
            }
        }, stepDuration);
    }

    /**
     * Actualiza el estado del botón play/pause
     */
    updatePlayButtonState(isPlaying) {
        this.state.isPlaying = isPlaying;
        
        // Cambiamos el icono
        const iconClass = isPlaying ? 'fa-pause' : 'fa-play';
        this.elements.playPauseButton.innerHTML = `<i class="fas ${iconClass}"></i>`;
        
        // Accesibilidad
        const label = isPlaying ? 'Pausar' : 'Reproducir';
        this.elements.playPauseButton.setAttribute('aria-label', label);
        
        // Clase de CSS para animaciones (ej: hacer que el disco gire o brille el neón)
        if (isPlaying) {
            this.elements.mainApp.classList.add('is-playing'); // Usar nombres de clase positivos suele ser más fácil de manejar
            this.elements.mainApp.classList.remove('paused');
        } else {
            this.elements.mainApp.classList.remove('is-playing');
            this.elements.mainApp.classList.add('paused');
        }
    }
    /**
     * Alterna visibilidad del menú
     */
    toggleMenu() {
        this.elements.menuDropdown.classList.toggle('hidden');
    }

    /**
     * Inicia el polling de actualizaciones
     */
    startPolling() {
        if (this.state.updateTimer) {
            clearInterval(this.state.updateTimer);
        }

        // Actualizar cada 10 segundos
        this.state.updateTimer = setInterval(() => {
            this.fetchNowPlaying();
        }, 20000);

        // console.log('🔄 Polling iniciado');
    }

    /**
     * Detiene el polling
     */
    stopPolling() {
        if (this.state.updateTimer) {
            clearInterval(this.state.updateTimer);
            // console.log('🛑 Polling detenido');
        }
    }

    /**
     * Maneja cambios de visibilidad de pestaña
     */
    handleVisibilityChange() {
        if (document.visibilityState === 'visible') {
            // console.log('👁️ Pestaña visible - actualizando datos');
            this.fetchNowPlaying();
        } else {
            // console.log('👁️ Pestaña oculta');
        }
    }

    /**
     * Maneja errores de audio
     */
    onAudioError(e) {
        const audio = this.elements.audioElement;
        
        // IGNORAR SI: no hay fuente, o si el error es por la limpieza del src (networkState 3)
        if (!audio.src || audio.networkState === 3 || audio.src.includes('index.html')) {
            return; 
        }

        console.error('🔴 Error de audio real:', e);
        this.updatePlayButtonState(false);
    }

    /**
     * Callback cuando comienza la reproducción
     */
    onAudioPlay() {
        // console.log('▶️ Audio en reproducción');
        this.updatePlayButtonState(true);
        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'playing';
        }
    }

    /**
     * Callback cuando se pausa la reproducción
     */
    onAudioPause() {
        // console.log('⏸️ Audio pausado');
        this.updatePlayButtonState(false);
        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'paused';
        }
    }

    /**
     * Maneja errores de API con reintentos
     */
    handleApiError() {
        this.state.connectionRetries++;
        const MAX_RETRIES = 5;

        if (this.state.connectionRetries < MAX_RETRIES) {
            // console.log(`🔄 Reintentando (${this.state.connectionRetries}/${MAX_RETRIES})...`);
            setTimeout(() => this.fetchNowPlaying(), 5000);
        } else {
            console.error('❌ Máximo de reintentos alcanzado');
        }
    }

    /**
     * Limpia recursos al cerrar
     */
    cleanup() {
        // console.log('🧹 Limpiando recursos...');
        this.stopPolling();
        this.pause();

        if (this.chat) {
        this.chat.cleanup();
    }
    }

    // 📡 Evento: El navegador está intentando descargar datos
   checkNetworkStatus() {
        const states = {
            0: "NETWORK_EMPTY (Sin inicializar)",
            1: "NETWORK_IDLE (Activo pero sin descargar)",
            2: "NETWORK_LOADING (Descargando datos...)",
            3: "NETWORK_NO_SOURCE (Error de conexión/Fuente vacía)"
        };
        const currentState = this.elements.audioElement.networkState;
        const msg = `🌐 Estado de Red Actual: ${states[currentState]}`;
        console.log(msg);
        return msg;
    }

    /**
     * 📡 NUEVO: Configura los sensores de red avanzados
     * Llama a esto dentro de tu setupEventListeners()
     */
    setupNetworkSensors() {
        const audio = this.elements.audioElement;

        // El navegador está intentando descargar datos
        audio.addEventListener('progress', () => {
            const buffered = audio.buffered;
            if (buffered.length > 0) {
                console.log(`📶 Buffer: ${Math.round(buffered.end(0) - buffered.start(0))}s descargados`);
            }
        });

        // La señal se cortó o es lenta (Buffering)
        audio.addEventListener('waiting', () => {
            console.warn('⚠️ Señal débil: Entrando en modo Buffering (cargando)...');
        });

        // La señal se recuperó y hay suficiente audio para seguir
        audio.addEventListener('playing', () => {
            console.log('✅ Señal estable: Reproducción fluida');
        });

        // El servidor cerró la conexión inesperadamente
        audio.addEventListener('stalled', () => {
            console.error('❌ Error crítico: El servidor de la radio dejó de enviar datos (Stalled)');
        });
    }

    // En player.js, dentro del método addNotificationButton()
    addNotificationButton() {
        setTimeout(() => {
            const menuContent = document.querySelector('.menu-content');
            if (!menuContent) return;
            
            if (document.getElementById('push-notify-btn')) return;
            
            const notifBtn = document.createElement('button');
            notifBtn.id = 'push-notify-btn';
            notifBtn.className = 'menu-link';
            notifBtn.style.cssText = `
                width: 100%;
                padding: 12px;
                margin: 10px 0;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border: none;
                color: white;
                border-radius: 8px;
                cursor: pointer;
                font-family: 'Poppins', sans-serif;
                font-size: 14px;
                display: flex;
                align-items: center;
                gap: 10px;
                justify-content: center;
                transition: transform 0.2s;
            `;
            
            // Verificar estado actual
            const isAlreadySubscribed = localStorage.getItem('push_subscribed') === 'true';
            if (isAlreadySubscribed && Notification.permission === 'granted') {
                notifBtn.innerHTML = '<i class="fas fa-check"></i> Notificaciones activas';
                notifBtn.style.background = 'linear-gradient(135deg, #11998e, #38ef7d)';
                notifBtn.disabled = true;
                notifBtn.style.opacity = '0.7';
            } else {
                notifBtn.innerHTML = '<i class="fas fa-bell"></i> Activar notificaciones';
            }
            
            notifBtn.onclick = async (e) => {
                e.stopPropagation();
                
                if (notifBtn.disabled) return;
                
                notifBtn.disabled = true;
                notifBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Activando...';
                
                // Activar notificaciones (modo no silencioso para mostrar mensajes)
                const success = await pushNotifications.activateNotifications(false);
                
                if (success) {
                    notifBtn.innerHTML = '<i class="fas fa-check"></i> Notificaciones activas';
                    notifBtn.style.background = 'linear-gradient(135deg, #11998e, #38ef7d)';
                } else {
                    notifBtn.innerHTML = '<i class="fas fa-bell"></i> Activar notificaciones';
                    notifBtn.disabled = false;
                }
            };
            
            const menuFooter = menuContent.querySelector('.menu-footer');
            if (menuFooter) {
                menuContent.insertBefore(notifBtn, menuFooter);
            } else {
                menuContent.appendChild(notifBtn);
            }
        }, 1000);
    }
}

const player = new VintageRadioPlayer();
export default player;
// ==========================================
// INICIALIZACIÓN GLOBAL
// ==========================================



// document.addEventListener('DOMContentLoaded', () => {
//     // console.log('📱 DOM cargado - inicializando player');
//     player = new VintageRadioPlayer();
// });

// // Exposición de objeto DEBUG para desarrollo
// window.DEBUG = {
//     player: () => player,
//     state: () => player?.state,
//     controls: {
//         play: () => player?.play(),
//         pause: () => player?.pause(),
//         toggle: () => player?.togglePlay(),
//         setVolume: (v) => {
//             if (player) {
//                 player.elements.volumeSlider.value = v;
//                 player.elements.audioElement.volume = v / 100;
//             }
//         },
//         getMetadata: () => player?.state.currentNowPlaying
//     }
// };

