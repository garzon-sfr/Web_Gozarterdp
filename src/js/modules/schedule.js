/**
 * ==========================================
 * GOZARTE RDP - SCHEDULE MANAGER
 * Módulo de Programación Semanal conectado a AzuraCast
 * ==========================================
 */

class ScheduleManager {
    constructor() {
        this.API_BASE_URL = 'https://panel.gozarterdp.com/api';
        this.STATION_ID = 1; // GozarteRDP

        this.weekDays = [];
        this.currentWeekSchedule = [];
        this.selectedDayIndex = 0;
        this.isOpen = false;
        this.isLoading = false;
        this.lastFetchDate = null;

        this.elements = {
            toggleBtn: document.getElementById('scheduleToggle'),
            modalOverlay: document.getElementById('scheduleModal'),
            closeBtn: document.getElementById('scheduleClose'),
            weekRangeLabel: document.getElementById('scheduleWeekRange'),
            daysNav: document.getElementById('scheduleDaysNav'),
            content: document.getElementById('scheduleContent')
        };

        this.init();
    }

    /**
     * Inicialización del módulo
     */
    init() {
        this.calculateWeekDays();
        this.setupEventListeners();
    }

    /**
     * Calcula los 7 días de la semana actual (Lunes a Domingo)
     */
    calculateWeekDays() {
        const now = new Date();
        const currentDayOfWeek = now.getDay(); // 0 es Domingo, 1 es Lunes, etc.
        
        // Ajustar para que Lunes sea el primer día (0) y Domingo el último (6)
        const diffToMonday = (currentDayOfWeek === 0 ? -6 : 1) - currentDayOfWeek;
        
        const monday = new Date(now);
        monday.setDate(now.getDate() + diffToMonday);
        monday.setHours(0, 0, 0, 0);

        const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
        const dayShort = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

        this.weekDays = [];

        for (let i = 0; i < 7; i++) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);

            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const isToday = d.toDateString() === now.toDateString();

            this.weekDays.push({
                index: i,
                name: dayNames[i],
                shortName: dayShort[i],
                dayNum: d.getDate(),
                date: d,
                dateStr: `${yyyy}-${mm}-${dd}`,
                isToday: isToday
            });
        }

        // Seleccionar por defecto el día actual
        const todayIndex = this.weekDays.findIndex(day => day.isToday);
        this.selectedDayIndex = todayIndex !== -1 ? todayIndex : 0;
    }

    /**
     * Asigna listeners de eventos para interactuar con el modal
     */
    setupEventListeners() {
        if (this.elements.toggleBtn) {
            this.elements.toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleModal();
            });
        }

        if (this.elements.closeBtn) {
            this.elements.closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closeModal();
            });
        }

        if (this.elements.modalOverlay) {
            this.elements.modalOverlay.addEventListener('click', (e) => {
                if (e.target === this.elements.modalOverlay) {
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
     * Alterna apertura y cierre del modal
     */
    toggleModal() {
        if (this.isOpen) {
            this.closeModal();
        } else {
            this.openModal();
        }
    }

    /**
     * Abre el modal de programación y carga los datos si es necesario
     */
    async openModal() {
        if (!this.elements.modalOverlay) return;

        this.isOpen = true;
        this.elements.modalOverlay.classList.remove('hidden');

        // Recalcular días por si cambió de medianoche
        this.calculateWeekDays();
        this.renderHeaderWeekRange();
        this.renderDaysNav();

        // Desplazar el nav al día actual
        this.scrollActiveTabIntoView();

        // Consultar API si no se ha consultado o si cambió el día
        const todayStr = new Date().toDateString();
        if (!this.currentWeekSchedule.length || this.lastFetchDate !== todayStr) {
            await this.fetchWeekSchedule();
        } else {
            this.renderProgramsForSelectedDay();
        }
    }

    /**
     * Cierra el modal de programación
     */
    closeModal() {
        if (!this.elements.modalOverlay) return;
        this.isOpen = false;
        this.elements.modalOverlay.classList.add('hidden');
    }

    /**
     * Muestra el rango de fechas en la cabecera (ej: "21 Sep - 27 Sep 2026")
     */
    renderHeaderWeekRange() {
        if (!this.elements.weekRangeLabel || this.weekDays.length < 7) return;

        const first = this.weekDays[0].date;
        const last = this.weekDays[6].date;

        const monthNames = [
            'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
            'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
        ];

        const firstStr = `${first.getDate()} ${monthNames[first.getMonth()]}`;
        const lastStr = `${last.getDate()} ${monthNames[last.getMonth()]} ${last.getFullYear()}`;

        this.elements.weekRangeLabel.textContent = `Semana del ${firstStr} al ${lastStr}`;
    }

    /**
     * Renderiza las pestañas de Lunes a Domingo
     */
    renderDaysNav() {
        if (!this.elements.daysNav) return;

        this.elements.daysNav.innerHTML = '';

        this.weekDays.forEach((day, idx) => {
            const btn = document.createElement('button');
            btn.className = `schedule-day-tab ${idx === this.selectedDayIndex ? 'active' : ''} ${day.isToday ? 'is-today' : ''}`;
            btn.setAttribute('type', 'button');
            btn.setAttribute('aria-label', `${day.name} ${day.dayNum}`);
            btn.setAttribute('data-day-index', idx);

            btn.innerHTML = `
                <span class="schedule-day-name">${day.shortName}</span>
                <span class="schedule-day-num">${day.dayNum}</span>
            `;

            btn.addEventListener('click', () => {
                this.selectDay(idx);
            });

            this.elements.daysNav.appendChild(btn);
        });
    }

    /**
     * Cambia de día seleccionado
     */
    selectDay(dayIndex) {
        if (this.selectedDayIndex === dayIndex) return;

        this.selectedDayIndex = dayIndex;

        // Actualizar clases de botones
        const allTabs = this.elements.daysNav.querySelectorAll('.schedule-day-tab');
        allTabs.forEach((tab, idx) => {
            tab.classList.toggle('active', idx === dayIndex);
        });

        this.renderProgramsForSelectedDay();
    }

    /**
     * Hace scroll suave horizontal al tab activo
     */
    scrollActiveTabIntoView() {
        setTimeout(() => {
            const activeTab = this.elements.daysNav?.querySelector('.schedule-day-tab.active');
            if (activeTab && this.elements.daysNav) {
                activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }, 100);
    }

    /**
     * Obtiene la programación semanal desde la API de AzuraCast
     */
    async fetchWeekSchedule() {
        if (!this.weekDays.length) return;

        const monday = this.weekDays[0].date;
        const sunday = this.weekDays[6].date;

        const startISO = `${this.formatISODate(monday)}T00:00:00`;
        const endISO = `${this.formatISODate(sunday)}T23:59:59`;

        const url = `${this.API_BASE_URL}/station/${this.STATION_ID}/schedule?start=${startISO}&end=${endISO}`;

        this.isLoading = true;
        this.renderLoadingState();

        try {
            const res = await fetch(url, { cache: 'no-store' });
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            const data = await res.json();
            this.currentWeekSchedule = Array.isArray(data) ? data : [];
            this.lastFetchDate = new Date().toDateString();
        } catch (error) {
            console.error('❌ Error al obtener programación de AzuraCast:', error);
            this.currentWeekSchedule = [];
        } finally {
            this.isLoading = false;
            this.renderProgramsForSelectedDay();
        }
    }

    /**
     * Renderiza el estado de carga
     */
    renderLoadingState() {
        if (!this.elements.content) return;
        this.elements.content.innerHTML = `
            <div class="schedule-loading">
                <i class="fas fa-circle-notch fa-spin"></i>
                <span>Cargando programación semanal...</span>
            </div>
        `;
    }

    /**
     * Renderiza los programas del día activo
     */
    renderProgramsForSelectedDay() {
        if (!this.elements.content) return;

        const selectedDay = this.weekDays[this.selectedDayIndex];
        if (!selectedDay) return;

        const dayDateStr = selectedDay.dateStr;
        const now = new Date();
        const currentTimestampSec = Math.floor(now.getTime() / 1000);

        // Filtrar programas de este día
        const programs = this.currentWeekSchedule.filter(item => {
            if (!item.start) return false;
            return item.start.startsWith(dayDateStr);
        });

        // Ordenar cronológicamente por hora de inicio
        programs.sort((a, b) => (a.start_timestamp || 0) - (b.start_timestamp || 0));

        this.elements.content.innerHTML = '';

        if (!programs.length) {
            this.elements.content.innerHTML = `
                <div class="schedule-empty">
                    <i class="fas fa-compact-disc schedule-empty-icon"></i>
                    <h4>Música y Alabanzas 24/7</h4>
                    <p>Hoy no hay listas especiales programadas. Disfruta de la mejor selección continua de GozarteRDP para bendecir tu día.</p>
                </div>
            `;
            return;
        }

        programs.forEach(item => {
            const timeRange = this.formatTimeRange(item.start, item.end);
            
            // Verificar si está sonando ahora mismo
            const isLiveNow = selectedDay.isToday && (
                item.is_now || 
                (currentTimestampSec >= item.start_timestamp && currentTimestampSec < item.end_timestamp)
            );

            const card = document.createElement('div');
            card.className = `schedule-item ${isLiveNow ? 'is-live-now' : ''}`;

            card.innerHTML = `
                <div class="schedule-item-top">
                    <div class="schedule-time-badge">
                        <i class="far fa-clock"></i>
                        <span>${timeRange}</span>
                    </div>
                    ${isLiveNow ? `
                        <span class="schedule-live-indicator">
                            <span class="schedule-live-dot"></span> AL AIRE AHORA
                        </span>
                    ` : ''}
                </div>
                <h4 class="schedule-item-title">${this.escapeHtml(item.name || item.title || 'Programa Especial')}</h4>
            `;

            this.elements.content.appendChild(card);
        });
    }

    /**
     * Formatea el rango de horas en formato amigable de 12 horas (ej. "07:00 PM - 09:00 PM")
     */
    formatTimeRange(startStr, endStr) {
        if (!startStr) return '';

        const formatSingle = (isoStr) => {
            try {
                const date = new Date(isoStr);
                let hours = date.getHours();
                const minutes = String(date.getMinutes()).padStart(2, '0');
                const ampm = hours >= 12 ? 'PM' : 'AM';
                hours = hours % 12;
                hours = hours ? hours : 12; // La medianoche/mediodía
                const strHours = String(hours).padStart(2, '0');
                return `${strHours}:${minutes} ${ampm}`;
            } catch (e) {
                return isoStr.substring(11, 16);
            }
        };

        const startFormatted = formatSingle(startStr);
        if (!endStr) return startFormatted;
        const endFormatted = formatSingle(endStr);

        return `${startFormatted} - ${endFormatted}`;
    }

    /**
     * Formatea fecha a YYYY-MM-DD
     */
    formatISODate(d) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    /**
     * Escapar HTML para evitar XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }
}

export default ScheduleManager;
