/**
 * UI Manager - Handles all UI updates and interactions
 */
class UIManager {
    constructor() {
        this.elements = {
            // Screens
            welcomeScreen: document.getElementById('welcomeScreen'),
            activityScreen: document.getElementById('activityScreen'),

            // Activity elements
            activityName: document.getElementById('activityName'),
            activityDuration: document.getElementById('activityDuration'),
            totalKills: document.getElementById('totalKills'),
            totalDeaths: document.getElementById('totalDeaths'),
            totalFame: document.getElementById('totalFame'),
            participantCount: document.getElementById('participantCount'),
            participantsList: document.getElementById('participantsList'),
            pendingKillsCount: document.getElementById('pendingKillsCount'),
            pendingKillsList: document.getElementById('pendingKillsList'),
            confirmedKillsCount: document.getElementById('confirmedKillsCount'),
            confirmedKillsList: document.getElementById('confirmedKillsList'),
            lastUpdate: document.getElementById('lastUpdate'),

            // Modals
            configModal: document.getElementById('configModal'),
            newActivityModal: document.getElementById('newActivityModal'),

            // Forms
            guildNameInput: document.getElementById('guildNameInput'),
            guildMembersInput: document.getElementById('guildMembersInput'),
            activityNameInput: document.getElementById('activityNameInput'),
            participantSelection: document.getElementById('participantSelection'),

            // Toast container
            toastContainer: document.getElementById('toastContainer')
        };

        this.startUTCTimeUpdate();
    }

    startUTCTimeUpdate() {
        const updateTime = () => {
            const utcTimeElement = document.getElementById('utcTime');
            if (utcTimeElement) {
                const now = new Date();
                const timeString = now.toISOString().split('T')[1].substring(0, 8);
                utcTimeElement.textContent = `${timeString} UTC`;
            }
        };

        updateTime(); // Initial update
        setInterval(updateTime, 1000);
    }

    showWelcomeScreen(guildConfig = null) {
        this.elements.welcomeScreen.classList.remove('hidden');
        this.elements.activityScreen.classList.add('hidden');

        // Update welcome screen content based on guild config
        if (guildConfig) {
            this.updateWelcomeWithGuildInfo(guildConfig);
        }
    }

    updateWelcomeWithGuildInfo(guildConfig) {
        const welcomeScreen = document.getElementById('welcomeScreen');
        if (!welcomeScreen) return;

        welcomeScreen.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚔️</div>
                <div class="empty-state-text">Gremio: ${guildConfig.guildName}</div>
                <div class="empty-state-subtext">${guildConfig.members.length} miembros configurados</div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-top: 32px; max-width: 600px;">
                    <div style="background: rgba(0, 217, 255, 0.1); padding: 20px; border-radius: 12px; text-align: center;">
                        <div style="font-size: 32px; font-weight: 700; color: #00d9ff;">${guildConfig.members.length}</div>
                        <div style="font-size: 14px; color: var(--text-secondary); margin-top: 4px;">Miembros</div>
                    </div>
                    ${guildConfig.guildId ? `
                        <div style="background: rgba(34, 197, 94, 0.1); padding: 20px; border-radius: 12px; text-align: center;">
                            <div style="font-size: 24px; font-weight: 700; color: #22c55e;">✓</div>
                            <div style="font-size: 14px; color: var(--text-secondary); margin-top: 8px;">API Conectada</div>
                        </div>
                    ` : `
                        <div style="background: rgba(234, 179, 8, 0.1); padding: 20px; border-radius: 12px; text-align: center;">
                            <div style="font-size: 24px; font-weight: 700; color: #eab308;">!</div>
                            <div style="font-size: 14px; color: var(--text-secondary); margin-top: 8px;">Sin ID de Gremio</div>
                        </div>
                    `}
                </div>

                <div style="display: flex; gap: 12px; margin-top: 32px; flex-wrap: wrap; justify-content: center;">
                    <button class="btn btn-primary" onclick="app.newActivity()" style="font-size: 16px; padding: 12px 24px;">
                        ➕ Nueva Actividad
                    </button>
                    <button class="btn btn-secondary" onclick="app.showConfig()">
                        ⚙️ Configuración
                    </button>
                    <button class="btn btn-secondary" onclick="window.location.href='other-kills.html'">
                        🏰 Ver Kills del Gremio
                    </button>
                </div>

                ${!guildConfig.guildId ? `
                    <div style="margin-top: 24px; padding: 16px; background: rgba(234, 179, 8, 0.1); border-left: 4px solid #eab308; border-radius: 8px; max-width: 600px;">
                        <div style="font-weight: 600; margin-bottom: 8px; color: #eab308;">⚠️ Recomendación</div>
                        <div style="font-size: 14px; color: var(--text-secondary);">
                            Tu gremio no tiene un ID configurado. Ve a Configuración y usa la búsqueda automática para obtener todas las funcionalidades.
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    showActivityScreen() {
        this.elements.welcomeScreen.classList.add('hidden');
        this.elements.activityScreen.classList.remove('hidden');
    }

    updateActivityInfo(activity) {
        this.elements.activityName.textContent = activity.name;

        // Update duration
        const duration = activity.getDuration();
        const hours = Math.floor(duration / 3600000);
        const minutes = Math.floor((duration % 3600000) / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);
        this.elements.activityDuration.textContent =
            `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        // Update stats
        const summary = activity.getSummary();
        this.elements.totalKills.textContent = summary.totalKills;
        this.elements.totalFame.textContent = summary.totalFame.toLocaleString();

        // Calculate total deaths from all participants
        const totalDeaths = activity.participants.reduce((sum, p) => sum + (p.stats.deaths || 0), 0);
        this.elements.totalDeaths.textContent = totalDeaths;
    }

    updateLootChest(activity) {
        const container = document.getElementById('lootChestContainer');
        if (!container || !activity) return;

        const chestSummary = activity.getLootChestSummary();

        if (chestSummary.totalItems === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📦</div>
                    <div class="empty-state-text">El baúl está vacío</div>
                    <div class="empty-state-subtext">Los items confirmados aparecerán aquí</div>
                </div>
            `;
            return;
        }

        // Sort items by quality (descending) and then by type
        const sortedItems = [...chestSummary.items].sort((a, b) => {
            if (b.quality !== a.quality) return b.quality - a.quality;
            return a.type.localeCompare(b.type);
        });

        container.innerHTML = `
            <!-- Chest Header -->
            <div style="background: rgba(255, 215, 0, 0.1); padding: 16px; border-radius: 8px; margin-bottom: 16px; border: 2px solid rgba(255, 215, 0, 0.3);">
                <div style="font-size: 20px; font-weight: 700; margin-bottom: 8px; color: #ffd700;">
                    📦 ${chestSummary.name}
                </div>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
                    <div style="text-align: center; padding: 10px; background: rgba(255, 255, 255, 0.05); border-radius: 6px;">
                        <div style="font-size: 24px; font-weight: 700; color: #00d9ff;">${chestSummary.totalItems}</div>
                        <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">Items Totales</div>
                    </div>
                    <div style="text-align: center; padding: 10px; background: rgba(255, 255, 255, 0.05); border-radius: 6px;">
                        <div style="font-size: 24px; font-weight: 700; color: #7bed9f;">${chestSummary.uniqueItems}</div>
                        <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">Items Únicos</div>
                    </div>
                    <div style="text-align: center; padding: 10px; background: rgba(255, 255, 255, 0.05); border-radius: 6px;">
                        <div style="font-size: 24px; font-weight: 700; color: #22c55e;">${activity.kills.length}</div>
                        <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">Kills</div>
                    </div>
                </div>
            </div>

            <!-- Chest Items Grid -->
            <div style="background: rgba(255, 255, 255, 0.05); padding: 16px; border-radius: 8px;">
                <div style="font-weight: 600; margin-bottom: 12px; color: var(--text-secondary); font-size: 13px;">
                    💰 Contenido del Baúl
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 12px; max-height: 400px; overflow-y: auto;">
                    ${sortedItems.map(item => `
                        <div style="position: relative; background: rgba(255, 215, 0, 0.05); border: 2px solid rgba(255, 215, 0, 0.2); border-radius: 8px; padding: 8px; text-align: center;">
                            <!-- Item Image -->
                            <img src="${app.apiService.getItemImageURL(item.type, item.quality, item.count, 80)}"
                                 alt="${item.type}"
                                 style="width: 100%; aspect-ratio: 1; object-fit: contain; margin-bottom: 4px;"
                                 onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22><rect fill=%22%23333%22 width=%22100%%22 height=%22100%%22/><text x=%2250%%22 y=%2250%%22 fill=%22%23666%22 text-anchor=%22middle%22 dy=%22.3em%22 font-size=%2214%22>?</text></svg>'">

                            <!-- Item Name -->
                            <div style="font-size: 10px; color: var(--text-secondary); word-break: break-all; line-height: 1.2; margin-top: 4px;">
                                ${item.type.split('_').pop()}
                            </div>

                            <!-- Quality Badge -->
                            ${item.quality > 0 ? `
                                <div style="position: absolute; top: 4px; left: 4px; background: rgba(255, 215, 0, 0.9); color: #000; font-size: 10px; padding: 2px 4px; border-radius: 3px; font-weight: 600;">
                                    ★${item.quality}
                                </div>
                            ` : ''}

                            <!-- Count Badge -->
                            <div style="position: absolute; bottom: 4px; right: 4px; background: rgba(0, 217, 255, 0.9); color: white; font-size: 12px; padding: 3px 6px; border-radius: 4px; font-weight: 700; border: 1px solid rgba(0, 217, 255, 0.5);">
                                x${item.count}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    updateParticipantsList(participants, activity) {
        this.elements.participantCount.textContent = participants.length;

        this.elements.participantsList.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px;">
                ${participants.map(p => {
            // Calculate participation percentage
            const percentage = activity ? activity.getParticipantParticipationPercentage(p.name) : 0;
            const activeTime = activity ? activity.getParticipantActiveTime(p.name) : 0;
            const hours = Math.floor(activeTime / 3600000);
            const minutes = Math.floor((activeTime % 3600000) / 60000);

            // Determine status
            let statusBadge = '';
            let statusClass = '';
            if (p.leftAt) {
                statusBadge = '<span style="background: rgba(255, 71, 87, 0.2); color: #ff4757; padding: 2px 8px; border-radius: 4px; font-size: 11px;">RETIRADO</span>';
                statusClass = 'opacity: 0.6;';
            } else if (p.isPaused) {
                statusBadge = '<span style="background: rgba(255, 215, 0, 0.2); color: #ffd700; padding: 2px 8px; border-radius: 4px; font-size: 11px;">PAUSADO</span>';
            } else {
                statusBadge = '<span style="background: rgba(0, 217, 255, 0.2); color: #00d9ff; padding: 2px 8px; border-radius: 4px; font-size: 11px;">ACTIVO</span>';
            }

            return `
                    <div class="participant-card" style="${statusClass}">
                        <div class="participant-header">
                            <div>
                                <div class="participant-name">${p.name} ${statusBadge}</div>
                                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">
                                    ⏱️ ${hours}h ${minutes}m | 📊 ${percentage.toFixed(1)}%
                                </div>
                            </div>
                            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                                ${!p.leftAt ? `
                                    ${p.isPaused ? `
                                        <button class="btn btn-success" style="padding: 4px 8px; font-size: 11px;" 
                                            onclick="app.resumeParticipant('${p.name}')">
                                            ▶️
                                        </button>
                                    ` : `
                                        <button class="btn btn-warning" style="padding: 4px 8px; font-size: 11px;" 
                                            onclick="app.pauseParticipant('${p.name}')">
                                            ⏸️
                                        </button>
                                    `}
                                    <button class="btn btn-danger" style="padding: 4px 8px; font-size: 11px;" 
                                        onclick="app.removeParticipantFromActivity('${p.name}')">
                                        ✗
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                        <div class="participant-stats" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-top: 8px;">
                            <div class="stat">
                                <div class="stat-label">Kills</div>
                                <div class="stat-value" style="color: #00d9ff;">${p.stats.kills}</div>
                            </div>
                            <div class="stat">
                                <div class="stat-label">Assists</div>
                                <div class="stat-value" style="color: #7bed9f;">${p.stats.assists}</div>
                            </div>
                            <div class="stat">
                                <div class="stat-label">Deaths</div>
                                <div class="stat-value" style="color: #ff4757;">${p.stats.deaths}</div>
                            </div>
                            <div class="stat">
                                <div class="stat-label">Damage</div>
                                <div class="stat-value">${(p.stats.damageDone / 1000).toFixed(1)}K</div>
                            </div>
                            <div class="stat">
                                <div class="stat-label">Healing</div>
                                <div class="stat-value">${(p.stats.healingDone / 1000).toFixed(1)}K</div>
                            </div>
                        </div>
                        <div class="progress-bar" style="margin-top: 8px;">
                            <div class="progress-fill" style="width: ${percentage}%"></div>
                        </div>
                    </div>
                `;
        }).join('')}
            </div>
        `;
    }

    updatePendingKills(pendingKills) {
        this.elements.pendingKillsCount.textContent = pendingKills.length;

        if (pendingKills.length === 0) {
            this.elements.pendingKillsList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-text">No hay kills pendientes</div>
                </div>
            `;
        } else {
            this.elements.pendingKillsList.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(450px, 1fr)); gap: 16px;">
                    ${pendingKills.map(kill => {
                        const date = new Date(kill.timestamp);
                        const utcDate = date.toISOString().split('T')[0];
                        const utcTime = date.toISOString().split('T')[1].substring(0, 8);

                        // Get victim equipment (top 8 items)
                        const victimEquipment = (kill.victimInventory || kill.lootDetected || []).slice(0, 8);

                        return `
                            <div class="kill-item" style="background: rgba(255, 215, 0, 0.05); border: 2px solid rgba(255, 215, 0, 0.3);">
                                <!-- Date Header -->
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border);">
                                    <div style="font-size: 12px; color: var(--text-secondary);">
                                        📅 ${utcDate} &nbsp;|&nbsp; 🕐 ${utcTime} UTC
                                    </div>
                                    <div class="kill-status status-pending">PENDIENTE</div>
                                </div>

                                <!-- Kill Info -->
                                <div style="margin-bottom: 12px;">
                                    <div style="font-size: 16px; font-weight: 600; margin-bottom: 4px;">
                                        <span style="color: #00d9ff;">${kill.killer.name}</span>
                                        <span style="color: var(--accent-primary); margin: 0 6px;">→</span>
                                        <span style="color: #ff4757;">${kill.victim.name}</span>
                                    </div>
                                    <div style="font-size: 12px; color: var(--text-secondary);">
                                        💀 Fame: ${kill.victim.deathFame.toLocaleString()} |
                                        👥 ${kill.participants.length} participantes |
                                        💰 ${kill.lootDetected.length} items
                                    </div>
                                </div>

                                <!-- Victim Equipment Preview -->
                                ${victimEquipment.length > 0 ? `
                                    <div style="margin-bottom: 12px;">
                                        <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 6px; font-weight: 600;">
                                            ⚔️ Equipación de la Víctima
                                        </div>
                                        <div style="display: grid; grid-template-columns: repeat(8, 1fr); gap: 4px;">
                                            ${victimEquipment.map(item => `
                                                <div style="position: relative; background: rgba(255, 255, 255, 0.05); border-radius: 6px; padding: 4px; aspect-ratio: 1;">
                                                    <img src="${app.apiService.getItemImageURL(item.type, item.quality, item.count, 60)}"
                                                         alt="${item.type}"
                                                         style="width: 100%; height: 100%; object-fit: contain;"
                                                         onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2260%22 height=%2260%22><rect fill=%22%23333%22 width=%22100%%22 height=%22100%%22/><text x=%2250%%22 y=%2250%%22 fill=%22%23666%22 text-anchor=%22middle%22 dy=%22.3em%22 font-size=%2210%22>?</text></svg>'">
                                                    ${item.quality > 0 ? `
                                                        <div style="position: absolute; top: 2px; left: 2px; background: rgba(255, 215, 0, 0.9); color: #000; font-size: 8px; padding: 1px 3px; border-radius: 2px; font-weight: 600;">
                                                            ★${item.quality}
                                                        </div>
                                                    ` : ''}
                                                    ${item.count > 1 ? `
                                                        <div style="position: absolute; bottom: 2px; right: 2px; background: rgba(0, 0, 0, 0.8); color: white; font-size: 9px; padding: 1px 3px; border-radius: 2px; font-weight: 600;">
                                                            ${item.count}
                                                        </div>
                                                    ` : ''}
                                                </div>
                                            `).join('')}
                                        </div>
                                        ${kill.lootDetected.length > 8 ? `
                                            <div style="text-align: center; font-size: 10px; color: var(--text-secondary); margin-top: 4px;">
                                                +${kill.lootDetected.length - 8} items más
                                            </div>
                                        ` : ''}
                                    </div>
                                ` : ''}

                                <!-- Action Buttons -->
                                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px;">
                                    <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 11px;"
                                        onclick="app.showKillDetail(${kill.eventId}, 'pending')">
                                        👁️ Detalle
                                    </button>
                                    <button class="btn btn-success" style="padding: 6px 12px; font-size: 11px;"
                                        onclick="app.confirmKill(${kill.eventId})">
                                        ✓ Todo
                                    </button>
                                    <button class="btn btn-warning" style="padding: 6px 12px; font-size: 11px;"
                                        onclick="app.editKillLoot(${kill.eventId})">
                                        ✏️ Editar
                                    </button>
                                    <button class="btn btn-danger" style="padding: 6px 12px; font-size: 11px;"
                                        onclick="app.discardKill(${kill.eventId})">
                                        ✗ Descartar
                                    </button>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }
    }

    updateConfirmedKills(confirmedKills) {
        this.elements.confirmedKillsCount.textContent = confirmedKills.length;

        if (confirmedKills.length === 0) {
            this.elements.confirmedKillsList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-text">No hay kills confirmadas aún</div>
                </div>
            `;
        } else {
            this.elements.confirmedKillsList.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(450px, 1fr)); gap: 16px;">
                    ${confirmedKills.map(kill => {
                        const date = new Date(kill.timestamp);
                        const utcDate = date.toISOString().split('T')[0];
                        const utcTime = date.toISOString().split('T')[1].substring(0, 8);

                        // Get confirmed loot (top 8 items)
                        const confirmedLoot = (kill.lootConfirmed || []).slice(0, 8);

                        // Calculate destroyed items
                        const victimInventory = kill.victimInventory || kill.lootDetected || [];
                        const destroyedCount = victimInventory.length - (kill.lootConfirmed || []).length;

                        return `
                            <div class="kill-item" style="background: rgba(34, 197, 94, 0.05); border: 2px solid rgba(34, 197, 94, 0.3);">
                                <!-- Date Header -->
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border);">
                                    <div style="font-size: 12px; color: var(--text-secondary);">
                                        📅 ${utcDate} &nbsp;|&nbsp; 🕐 ${utcTime} UTC
                                    </div>
                                    <div class="kill-status status-confirmed">CONFIRMADA</div>
                                </div>

                                <!-- Kill Info -->
                                <div style="margin-bottom: 12px;">
                                    <div style="font-size: 16px; font-weight: 600; margin-bottom: 4px;">
                                        <span style="color: #00d9ff;">${kill.killer.name}</span>
                                        <span style="color: var(--accent-primary); margin: 0 6px;">→</span>
                                        <span style="color: #ff4757;">${kill.victim.name}</span>
                                    </div>
                                    <div style="font-size: 12px; color: var(--text-secondary);">
                                        💀 Fame: ${kill.victim.deathFame.toLocaleString()} |
                                        👥 ${kill.participants.length} participantes
                                    </div>
                                </div>

                                <!-- Loot Stats -->
                                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px;">
                                    <div style="text-align: center; padding: 8px; background: rgba(34, 197, 94, 0.1); border-radius: 6px; border: 1px solid rgba(34, 197, 94, 0.3);">
                                        <div style="font-size: 18px; font-weight: 700; color: #22c55e;">${(kill.lootConfirmed || []).length}</div>
                                        <div style="font-size: 10px; color: var(--text-secondary); margin-top: 2px;">Obtenidos</div>
                                    </div>
                                    <div style="text-align: center; padding: 8px; background: rgba(239, 68, 68, 0.1); border-radius: 6px; border: 1px solid rgba(239, 68, 68, 0.3);">
                                        <div style="font-size: 18px; font-weight: 700; color: #ef4444;">${destroyedCount}</div>
                                        <div style="font-size: 10px; color: var(--text-secondary); margin-top: 2px;">Destruidos</div>
                                    </div>
                                    <div style="text-align: center; padding: 8px; background: rgba(59, 130, 246, 0.1); border-radius: 6px; border: 1px solid rgba(59, 130, 246, 0.3);">
                                        <div style="font-size: 18px; font-weight: 700; color: #3b82f6;">${victimInventory.length > 0 ? Math.round(((kill.lootConfirmed || []).length / victimInventory.length) * 100) : 0}%</div>
                                        <div style="font-size: 10px; color: var(--text-secondary); margin-top: 2px;">Tasa</div>
                                    </div>
                                </div>

                                <!-- Confirmed Loot Preview -->
                                ${confirmedLoot.length > 0 ? `
                                    <div style="margin-bottom: 12px;">
                                        <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 6px; font-weight: 600;">
                                            ✅ Loot Obtenido
                                        </div>
                                        <div style="display: grid; grid-template-columns: repeat(8, 1fr); gap: 4px;">
                                            ${confirmedLoot.map(item => `
                                                <div style="position: relative; background: rgba(34, 197, 94, 0.1); border-radius: 6px; padding: 4px; aspect-ratio: 1; border: 1px solid rgba(34, 197, 94, 0.3);">
                                                    <img src="${app.apiService.getItemImageURL(item.type, item.quality, item.count, 60)}"
                                                         alt="${item.type}"
                                                         style="width: 100%; height: 100%; object-fit: contain;"
                                                         onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2260%22 height=%2260%22><rect fill=%22%23333%22 width=%22100%%22 height=%22100%%22/><text x=%2250%%22 y=%2250%%22 fill=%22%23666%22 text-anchor=%22middle%22 dy=%22.3em%22 font-size=%2210%22>?</text></svg>'">
                                                    ${item.quality > 0 ? `
                                                        <div style="position: absolute; top: 2px; left: 2px; background: rgba(255, 215, 0, 0.9); color: #000; font-size: 8px; padding: 1px 3px; border-radius: 2px; font-weight: 600;">
                                                            ★${item.quality}
                                                        </div>
                                                    ` : ''}
                                                    ${item.count > 1 ? `
                                                        <div style="position: absolute; bottom: 2px; right: 2px; background: rgba(0, 0, 0, 0.8); color: white; font-size: 9px; padding: 1px 3px; border-radius: 2px; font-weight: 600;">
                                                            ${item.count}
                                                        </div>
                                                    ` : ''}
                                                </div>
                                            `).join('')}
                                        </div>
                                        ${(kill.lootConfirmed || []).length > 8 ? `
                                            <div style="text-align: center; font-size: 10px; color: var(--text-secondary); margin-top: 4px;">
                                                +${(kill.lootConfirmed || []).length - 8} items más
                                            </div>
                                        ` : ''}
                                    </div>
                                ` : `
                                    <div style="text-align: center; padding: 16px; background: rgba(239, 68, 68, 0.05); border-radius: 6px; margin-bottom: 12px;">
                                        <div style="font-size: 12px; color: var(--text-secondary);">
                                            ❌ Sin loot obtenido (todo destruido)
                                        </div>
                                    </div>
                                `}

                                <!-- Action Button -->
                                <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 11px; width: 100%;"
                                    onclick="app.showKillDetail(${kill.eventId}, 'confirmed')">
                                    👁️ Ver Detalle Completo
                                </button>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }
    }

    updateOtherGuildKills(otherKills, hasMore = true) {
        const container = document.getElementById('otherGuildKillsList');
        const countElement = document.getElementById('otherGuildKillsCount');

        if (!container || !countElement) return;

        countElement.textContent = otherKills.length;

        if (otherKills.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-text">No hay otras kills del gremio</div>
                    <div class="empty-state-subtext">Las kills de otros miembros aparecerán aquí</div>
                </div>
            `;
        } else {
            // Sort kills by date (most recent first)
            const sortedKills = [...otherKills].sort((a, b) =>
                new Date(b.timestamp) - new Date(a.timestamp)
            );

            let html = `
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(400px, 1fr)); gap: 16px; margin-bottom: 16px;">
                    ${sortedKills.map(kill => {
                const date = new Date(kill.timestamp);
                const utcDate = date.toISOString().split('T')[0];
                const utcTime = date.toISOString().split('T')[1].substring(0, 8);

                // Get top 6 loot items for preview
                const topLoot = kill.lootDetected.slice(0, 6);

                return `
                            <div class="kill-item" style="cursor: pointer;" onclick="app.showKillDetail(${kill.eventId}, 'other')">
                                <!-- Date Header -->
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border);">
                                    <div style="font-size: 12px; color: var(--text-secondary);">
                                        📅 ${utcDate} &nbsp;|&nbsp; 🕐 ${utcTime} UTC
                                    </div>
                                    <div class="kill-status" style="background: rgba(128, 128, 128, 0.2); color: #a0a0a0; font-size: 11px; padding: 3px 8px;">
                                        OTRO MIEMBRO
                                    </div>
                                </div>

                                <!-- Kill Info -->
                                <div style="margin-bottom: 12px;">
                                    <div style="font-size: 16px; font-weight: 600; margin-bottom: 4px;">
                                        <span style="color: #00d9ff;">${kill.killer.name}</span>
                                        <span style="color: var(--accent-primary); margin: 0 6px;">→</span>
                                        <span style="color: #ff4757;">${kill.victim.name}</span>
                                    </div>
                                    <div style="font-size: 12px; color: var(--text-secondary);">
                                        💀 Fame: ${kill.victim.deathFame.toLocaleString()} |
                                        👥 ${kill.participants.length} participantes
                                    </div>
                                </div>

                                <!-- Loot Preview Grid -->
                                ${topLoot.length > 0 ? `
                                    <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; margin-bottom: 12px;">
                                        ${topLoot.map(item => `
                                            <div style="position: relative; background: rgba(255, 255, 255, 0.05); border-radius: 6px; padding: 4px; aspect-ratio: 1;">
                                                <img src="${app.apiService.getItemImageURL(item.type, item.quality, item.count, 60)}"
                                                     alt="${item.type}"
                                                     style="width: 100%; height: 100%; object-fit: contain;"
                                                     onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2260%22 height=%2260%22><rect fill=%22%23333%22 width=%22100%%22 height=%22100%%22/><text x=%2250%%22 y=%2250%%22 fill=%22%23666%22 text-anchor=%22middle%22 dy=%22.3em%22 font-size=%2210%22>?</text></svg>'">
                                                ${item.count > 1 ? `
                                                    <div style="position: absolute; bottom: 2px; right: 2px; background: rgba(0, 0, 0, 0.8); color: white; font-size: 10px; padding: 1px 4px; border-radius: 3px; font-weight: 600;">
                                                        ${item.count}
                                                    </div>
                                                ` : ''}
                                            </div>
                                        `).join('')}
                                    </div>
                                ` : `
                                    <div style="text-align: center; padding: 16px; color: var(--text-secondary); font-size: 12px;">
                                        Sin loot
                                    </div>
                                `}

                                <!-- Total Items Badge -->
                                <div style="text-align: center; font-size: 11px; color: var(--text-secondary);">
                                    ${kill.lootDetected.length > 6 ? `+${kill.lootDetected.length - 6} items más` : `${kill.lootDetected.length} items total`}
                                </div>
                            </div>
                        `;
            }).join('')}
                </div>
            `;

            // Add "Load More" button if there are more kills available
            if (hasMore) {
                html += `
                    <div style="text-align: center; margin-top: 16px;">
                        <button class="btn btn-primary" onclick="app.loadMoreOtherKills()" style="width: 100%;">
                            ⬇️ Cargar Más Kills
                        </button>
                    </div>
                `;
            } else {
                html += `
                    <div style="text-align: center; margin-top: 16px; padding: 12px; color: var(--text-secondary); font-size: 14px;">
                        No hay más kills disponibles
                    </div>
                `;
            }

            container.innerHTML = html;
        }
    }

    updateLastUpdateTime(isLoading = false) {
        const lastUpdateElement = this.elements.lastUpdate;
        if (!lastUpdateElement) return;

        if (isLoading) {
            lastUpdateElement.innerHTML = `
                <span style="display: inline-flex; align-items: center; gap: 6px; color: #3b82f6;">
                    <span class="spinner" style="width: 12px; height: 12px; border-width: 2px;"></span>
                    Buscando kills...
                </span>
            `;
        } else {
            lastUpdateElement.textContent = new Date().toLocaleTimeString();
        }
    }

    showPollingStatus(isActive) {
        const lastUpdateContainer = document.querySelector('#lastUpdate').parentElement;
        if (!lastUpdateContainer) return;

        if (isActive) {
            lastUpdateContainer.classList.add('pulse');
        } else {
            lastUpdateContainer.classList.remove('pulse');
        }
    }

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
        }
    }

    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        this.elements.toastContainer.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 100);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    populateParticipantSelection(members, guildName) {
        // Add guild info header
        let html = '';
        if (guildName) {
            html += `
                <div style="background: rgba(0, 217, 255, 0.1); padding: 12px; border-radius: 8px; margin-bottom: 12px;">
                    <div style="font-weight: 600; margin-bottom: 4px;">🏰 ${guildName}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">
                        ${members.length} miembros disponibles
                    </div>
                </div>
            `;
        }

        html += members.map(member => `
            <label style="display: block; padding: 8px; cursor: pointer; border-radius: 4px; transition: background 0.2s;">
                <input type="checkbox" value="${member.name}" style="margin-right: 8px;">
                <span style="font-weight: 500;">${member.name}</span>
                ${member.killFame ? `
                    <span style="font-size: 11px; color: var(--text-secondary); margin-left: 8px;">
                        Fame: ${(member.killFame / 1000).toFixed(0)}K
                    </span>
                ` : ''}
            </label>
        `).join('');

        this.elements.participantSelection.innerHTML = html;

        // Add hover effect
        const labels = this.elements.participantSelection.querySelectorAll('label');
        labels.forEach(label => {
            label.addEventListener('mouseenter', () => {
                label.style.background = 'rgba(255, 255, 255, 0.05)';
            });
            label.addEventListener('mouseleave', () => {
                label.style.background = 'transparent';
            });
        });
    }

    getSelectedParticipants() {
        const checkboxes = this.elements.participantSelection.querySelectorAll('input:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }

    loadConfigToForm(config) {
        this.elements.guildNameInput.value = config.guildName || '';
        this.elements.guildMembersInput.value = config.members.map(m => m.name).join('\n');

        // Load guildId if available
        const guildIdInput = document.getElementById('guildIdInput');
        if (guildIdInput) {
            guildIdInput.value = config.guildId || '';
        }
    }

    getConfigFromForm() {
        return {
            guildName: this.elements.guildNameInput.value.trim(),
            membersText: this.elements.guildMembersInput.value.trim()
        };
    }

    getActivityNameFromForm() {
        return this.elements.activityNameInput.value.trim();
    }

    clearActivityNameInput() {
        this.elements.activityNameInput.value = '';
    }

    populateAddParticipantSelection(availableMembers) {
        const container = document.getElementById('addParticipantSelection');
        if (!container) return;

        if (availableMembers.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-text">Todos los miembros ya están en la actividad</div>
                </div>
            `;
            return;
        }

        container.innerHTML = availableMembers.map(member => `
            <label style="display: block; padding: 12px; cursor: pointer; border-radius: 4px; transition: background 0.2s; border: 1px solid rgba(255, 255, 255, 0.1); margin-bottom: 8px;">
                <input type="radio" name="addParticipant" value="${member.name}" style="margin-right: 8px;">
                <span style="font-weight: 500;">${member.name}</span>
                ${member.killFame ? `
                    <span style="font-size: 11px; color: var(--text-secondary); margin-left: 8px;">
                        Fame: ${(member.killFame / 1000).toFixed(0)}K
                    </span>
                ` : ''}
            </label>
        `).join('');

        // Add hover effect
        const labels = container.querySelectorAll('label');
        labels.forEach(label => {
            label.addEventListener('mouseenter', () => {
                label.style.background = 'rgba(255, 255, 255, 0.05)';
            });
            label.addEventListener('mouseleave', () => {
                label.style.background = 'transparent';
            });
        });
    }

    getSelectedAddParticipant() {
        const radio = document.querySelector('input[name="addParticipant"]:checked');
        return radio ? radio.value : null;
    }

    showKillDetail(kill, source) {
        const container = document.getElementById('killDetailContent');
        if (!container) return;

        const timestamp = new Date(kill.timestamp);
        const victimInventory = kill.victimInventory || kill.lootDetected || [];
        const confirmedLoot = kill.lootConfirmed || [];

        // Calculate destroyed items (items in inventory but not in confirmed loot)
        const destroyedItems = victimInventory.filter(invItem => {
            return !confirmedLoot.some(lootItem =>
                lootItem.type === invItem.type &&
                lootItem.slot === invItem.slot &&
                lootItem.quality === invItem.quality &&
                lootItem.count === invItem.count
            );
        });

        // Determine what to show based on source
        const isConfirmed = source === 'confirmed' || confirmedLoot.length > 0;

        container.innerHTML = `
            <div style="margin-bottom: 24px;">
                <div style="background: rgba(233, 69, 96, 0.1); padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                    <div style="font-size: 24px; font-weight: 700; margin-bottom: 8px;">
                        ${kill.killer.name} <span style="color: var(--accent-primary);">→</span> ${kill.victim.name}
                    </div>
                    <div style="font-size: 14px; color: var(--text-secondary);">
                        📅 ${timestamp.toLocaleDateString()} ${timestamp.toLocaleTimeString()}
                    </div>
                </div>

                <!-- Stats Grid -->
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 24px;">
                    <div style="background: rgba(0, 217, 255, 0.1); padding: 12px; border-radius: 8px;">
                        <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">KILLER</div>
                        <div style="font-size: 18px; font-weight: 600;">${kill.killer.name}</div>
                        <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
                            Fame: ${kill.killer.killFame.toLocaleString()} |
                            IP: ${kill.killer.averageItemPower}
                            ${kill.killer.guildName ? `| Guild: ${kill.killer.guildName}` : ''}
                        </div>
                    </div>
                    <div style="background: rgba(255, 71, 87, 0.1); padding: 12px; border-radius: 8px;">
                        <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">VICTIM</div>
                        <div style="font-size: 18px; font-weight: 600;">${kill.victim.name}</div>
                        <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
                            Fame: ${kill.victim.deathFame.toLocaleString()} |
                            IP: ${kill.victim.averageItemPower}
                            ${kill.victim.guildName ? `| Guild: ${kill.victim.guildName}` : ''}
                        </div>
                    </div>
                </div>

                <!-- Participants -->
                <div style="background: rgba(255, 255, 255, 0.05); padding: 16px; border-radius: 8px; margin-bottom: 24px;">
                    <div style="font-weight: 600; margin-bottom: 12px;">
                        👥 Participantes (${kill.participants.length})
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px;">
                        ${kill.participants.map(p => `
                            <div style="background: rgba(255, 255, 255, 0.05); padding: 8px; border-radius: 6px;">
                                <div style="font-weight: 500; font-size: 13px;">
                                    ${p.name === kill.killer.name ? '⚔️ ' : ''}${p.name}
                                </div>
                                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">
                                    💥 Damage: ${(p.damageDone / 1000).toFixed(1)}K
                                    ${p.healingDone > 0 ? `| ❤️ Healing: ${(p.healingDone / 1000).toFixed(1)}K` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                ${isConfirmed ? `
                    <!-- CONFIRMED LOOT (Real Loot) -->
                    <div style="background: rgba(34, 197, 94, 0.15); padding: 16px; border-radius: 8px; margin-bottom: 16px; border: 2px solid rgba(34, 197, 94, 0.3);">
                        <div style="font-weight: 600; margin-bottom: 12px; color: #22c55e; display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 18px;">✅</span>
                            <span>Loot Obtenido (Real) - ${confirmedLoot.length} items</span>
                        </div>
                        <div style="max-height: 400px; overflow-y: auto;">
                            ${confirmedLoot.length > 0 ? `
                                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 8px;">
                                    ${confirmedLoot.map((item, index) => `
                                        <div style="position: relative; background: rgba(34, 197, 94, 0.1); border-radius: 8px; padding: 8px; text-align: center; border: 1px solid rgba(34, 197, 94, 0.3);">
                                            <img src="${app.apiService.getItemImageURL(item.type, item.quality, item.count, 80)}"
                                                 alt="${item.type}"
                                                 style="width: 100%; aspect-ratio: 1; object-fit: contain; margin-bottom: 4px;"
                                                 onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22><rect fill=%22%23333%22 width=%22100%%22 height=%22100%%22/><text x=%2250%%22 y=%2250%%22 fill=%22%23666%22 text-anchor=%22middle%22 dy=%22.3em%22 font-size=%2214%22>?</text></svg>'">
                                            <div style="font-size: 10px; color: var(--text-secondary); word-break: break-all; line-height: 1.2;">
                                                ${item.type.split('_').pop()}
                                            </div>
                                            ${item.quality > 0 ? `
                                                <div style="position: absolute; top: 4px; left: 4px; background: rgba(255, 215, 0, 0.9); color: #000; font-size: 10px; padding: 2px 4px; border-radius: 3px; font-weight: 600;">
                                                    ★${item.quality}
                                                </div>
                                            ` : ''}
                                            ${item.count > 1 ? `
                                                <div style="position: absolute; bottom: 4px; right: 4px; background: rgba(0, 0, 0, 0.9); color: white; font-size: 12px; padding: 2px 6px; border-radius: 4px; font-weight: 600;">
                                                    x${item.count}
                                                </div>
                                            ` : ''}
                                        </div>
                                    `).join('')}
                                </div>
                            ` : '<div style="text-align: center; color: var(--text-secondary); padding: 20px;">Sin loot confirmado</div>'}
                        </div>
                    </div>

                    <!-- DESTROYED ITEMS -->
                    ${destroyedItems.length > 0 ? `
                        <div style="background: rgba(239, 68, 68, 0.1); padding: 16px; border-radius: 8px; margin-bottom: 16px; border: 2px solid rgba(239, 68, 68, 0.2);">
                            <div style="font-weight: 600; margin-bottom: 12px; color: #ef4444; display: flex; align-items: center; gap: 8px;">
                                <span style="font-size: 18px;">❌</span>
                                <span>Items Destruidos - ${destroyedItems.length} items</span>
                            </div>
                            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 12px;">
                                Estos items estaban en el inventario de la víctima pero fueron destruidos en el combate
                            </div>
                            <div style="max-height: 300px; overflow-y: auto;">
                                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 8px;">
                                    ${destroyedItems.map((item, index) => `
                                        <div style="position: relative; background: rgba(239, 68, 68, 0.05); border-radius: 8px; padding: 8px; text-align: center; border: 1px solid rgba(239, 68, 68, 0.2); opacity: 0.6;">
                                            <img src="${app.apiService.getItemImageURL(item.type, item.quality, item.count, 80)}"
                                                 alt="${item.type}"
                                                 style="width: 100%; aspect-ratio: 1; object-fit: contain; margin-bottom: 4px; filter: grayscale(70%);"
                                                 onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22><rect fill=%22%23333%22 width=%22100%%22 height=%22100%%22/><text x=%2250%%22 y=%2250%%22 fill=%22%23666%22 text-anchor=%22middle%22 dy=%22.3em%22 font-size=%2214%22>?</text></svg>'">
                                            <div style="font-size: 10px; color: var(--text-secondary); word-break: break-all; line-height: 1.2;">
                                                ${item.type.split('_').pop()}
                                            </div>
                                            <div class="destroyed-overlay"></div>
                                            ${item.quality > 0 ? `
                                                <div style="position: absolute; top: 4px; left: 4px; background: rgba(128, 128, 128, 0.7); color: #ddd; font-size: 10px; padding: 2px 4px; border-radius: 3px; font-weight: 600;">
                                                    ★${item.quality}
                                                </div>
                                            ` : ''}
                                            ${item.count > 1 ? `
                                                <div style="position: absolute; bottom: 4px; right: 4px; background: rgba(0, 0, 0, 0.7); color: #999; font-size: 12px; padding: 2px 6px; border-radius: 4px; font-weight: 600;">
                                                    x${item.count}
                                                </div>
                                            ` : ''}
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                    ` : ''}

                    <!-- Statistics Summary -->
                    <div style="background: rgba(59, 130, 246, 0.1); padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                        <div style="font-weight: 600; margin-bottom: 12px;">📊 Estadísticas del Loot</div>
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
                            <div style="text-align: center; padding: 12px; background: rgba(255, 255, 255, 0.05); border-radius: 6px;">
                                <div style="font-size: 24px; font-weight: 700; color: #22c55e;">${confirmedLoot.length}</div>
                                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">Items Obtenidos</div>
                            </div>
                            <div style="text-align: center; padding: 12px; background: rgba(255, 255, 255, 0.05); border-radius: 6px;">
                                <div style="font-size: 24px; font-weight: 700; color: #ef4444;">${destroyedItems.length}</div>
                                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">Items Destruidos</div>
                            </div>
                            <div style="text-align: center; padding: 12px; background: rgba(255, 255, 255, 0.05); border-radius: 6px;">
                                <div style="font-size: 24px; font-weight: 700; color: #3b82f6;">${victimInventory.length > 0 ? ((confirmedLoot.length / victimInventory.length) * 100).toFixed(1) : 0}%</div>
                                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">Tasa de Supervivencia</div>
                            </div>
                        </div>
                    </div>
                ` : `
                    <!-- VICTIM INVENTORY (Full Inventory for pending kills) -->
                    <div style="background: rgba(255, 215, 0, 0.1); padding: 16px; border-radius: 8px;">
                        <div style="font-weight: 600; margin-bottom: 12px;">
                            💰 Inventario Completo de la Víctima (${victimInventory.length} items)
                        </div>
                        <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 12px; padding: 8px; background: rgba(59, 130, 246, 0.1); border-radius: 6px;">
                            ℹ️ <strong>Importante:</strong> Estos son todos los items que tenía la víctima. Cuando confirmes la kill, selecciona solo los items que realmente obtuviste (loot real). Los demás se marcarán como destruidos.
                        </div>
                        <div style="max-height: 400px; overflow-y: auto;">
                            ${victimInventory.length > 0 ? `
                                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 8px;">
                                    ${victimInventory.map((item, index) => `
                                        <div style="position: relative; background: rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 8px; text-align: center;">
                                            <img src="${app.apiService.getItemImageURL(item.type, item.quality, item.count, 80)}"
                                                 alt="${item.type}"
                                                 style="width: 100%; aspect-ratio: 1; object-fit: contain; margin-bottom: 4px;"
                                                 onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22><rect fill=%22%23333%22 width=%22100%%22 height=%22100%%22/><text x=%2250%%22 y=%2250%%22 fill=%22%23666%22 text-anchor=%22middle%22 dy=%22.3em%22 font-size=%2214%22>?</text></svg>'">
                                            <div style="font-size: 10px; color: var(--text-secondary); word-break: break-all; line-height: 1.2;">
                                                ${item.type.split('_').pop()}
                                            </div>
                                            ${item.quality > 0 ? `
                                                <div style="position: absolute; top: 4px; left: 4px; background: rgba(255, 215, 0, 0.9); color: #000; font-size: 10px; padding: 2px 4px; border-radius: 3px; font-weight: 600;">
                                                    ★${item.quality}
                                                </div>
                                            ` : ''}
                                            ${item.count > 1 ? `
                                                <div style="position: absolute; bottom: 4px; right: 4px; background: rgba(0, 0, 0, 0.9); color: white; font-size: 12px; padding: 2px 6px; border-radius: 4px; font-weight: 600;">
                                                    x${item.count}
                                                </div>
                                            ` : ''}
                                        </div>
                                    `).join('')}
                                </div>
                            ` : '<div style="text-align: center; color: var(--text-secondary);">Sin items en inventario</div>'}
                        </div>
                    </div>
                `}

                <!-- Event Info -->
                <div style="margin-top: 16px; padding: 12px; background: rgba(255, 255, 255, 0.03); border-radius: 6px;">
                    <div style="font-size: 11px; color: var(--text-secondary);">
                        Event ID: ${kill.eventId} | Battle ID: ${kill.battleId}
                    </div>
                </div>
            </div>
        `;
    }

    showEditLootModal(kill) {
        const container = document.getElementById('editLootContent');
        if (!container) return;

        const timestamp = new Date(kill.timestamp);
        const victimInventory = kill.victimInventory || kill.lootDetected || [];

        container.innerHTML = `
            <div style="margin-bottom: 24px;">
                <!-- Kill Info -->
                <div style="background: rgba(233, 69, 96, 0.1); padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                    <div style="font-size: 24px; font-weight: 700; margin-bottom: 8px;">
                        ${kill.killer.name} <span style="color: var(--accent-primary);">→</span> ${kill.victim.name}
                    </div>
                    <div style="font-size: 14px; color: var(--text-secondary);">
                        📅 ${timestamp.toLocaleDateString()} ${timestamp.toLocaleTimeString()}
                    </div>
                </div>

                <!-- Instructions -->
                <div style="background: rgba(59, 130, 246, 0.1); padding: 16px; border-radius: 8px; margin-bottom: 24px; border-left: 4px solid #3b82f6;">
                    <div style="font-weight: 600; margin-bottom: 8px; color: #3b82f6;">📋 Instrucciones</div>
                    <div style="font-size: 14px; color: var(--text-secondary); line-height: 1.6;">
                        <strong>Selecciona los items que realmente obtuviste</strong> (loot que recogiste).
                        Los items NO seleccionados se marcarán como destruidos automáticamente.
                    </div>
                </div>

                <!-- Quick Actions -->
                <div style="display: flex; gap: 12px; margin-bottom: 16px;">
                    <button class="btn btn-success" onclick="app.selectAllLoot()" style="flex: 1;">
                        ✓ Seleccionar Todo
                    </button>
                    <button class="btn btn-secondary" onclick="app.deselectAllLoot()" style="flex: 1;">
                        ✗ Deseleccionar Todo
                    </button>
                </div>

                <!-- Items Grid -->
                <div style="background: rgba(255, 255, 255, 0.05); padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                    <div style="font-weight: 600; margin-bottom: 12px;">
                        💰 Inventario de la Víctima (${victimInventory.length} items)
                    </div>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 16px;">
                        Haz clic en cada item para seleccionar/deseleccionar
                    </div>
                    ${victimInventory.length > 0 ? `
                        <div id="lootItemsGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 12px; max-height: 500px; overflow-y: auto;">
                            ${victimInventory.map((item, index) => `
                                <div id="loot-item-${index}"
                                     class="loot-item-card selected"
                                     onclick="app.toggleLootItem(${index})"
                                     style="position: relative; background: rgba(34, 197, 94, 0.2); border: 2px solid rgba(34, 197, 94, 0.6); border-radius: 8px; padding: 8px; text-align: center; cursor: pointer; transition: all 0.2s;">

                                    <!-- Selection Indicator -->
                                    <div class="selection-indicator" style="position: absolute; top: 4px; right: 4px; width: 24px; height: 24px; background: rgba(34, 197, 94, 0.9); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: bold; color: white; z-index: 10;">
                                        ✓
                                    </div>

                                    <!-- Item Image -->
                                    <img src="${app.apiService.getItemImageURL(item.type, item.quality, item.count, 80)}"
                                         alt="${item.type}"
                                         style="width: 100%; aspect-ratio: 1; object-fit: contain; margin-bottom: 4px;"
                                         onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22><rect fill=%22%23333%22 width=%22100%%22 height=%22100%%22/><text x=%2250%%22 y=%2250%%22 fill=%22%23666%22 text-anchor=%22middle%22 dy=%22.3em%22 font-size=%2214%22>?</text></svg>'">

                                    <!-- Item Name -->
                                    <div style="font-size: 10px; color: var(--text-secondary); word-break: break-all; line-height: 1.2; margin-top: 4px;">
                                        ${item.type.split('_').pop()}
                                    </div>

                                    <!-- Quality Badge -->
                                    ${item.quality > 0 ? `
                                        <div style="position: absolute; top: 32px; left: 4px; background: rgba(255, 215, 0, 0.9); color: #000; font-size: 10px; padding: 2px 4px; border-radius: 3px; font-weight: 600;">
                                            ★${item.quality}
                                        </div>
                                    ` : ''}

                                    <!-- Count Badge -->
                                    ${item.count > 1 ? `
                                        <div style="position: absolute; bottom: 32px; right: 4px; background: rgba(0, 0, 0, 0.9); color: white; font-size: 12px; padding: 2px 6px; border-radius: 4px; font-weight: 600;">
                                            x${item.count}
                                        </div>
                                    ` : ''}
                                </div>
                            `).join('')}
                        </div>
                    ` : '<div style="text-align: center; color: var(--text-secondary); padding: 20px;">Sin items en inventario</div>'}
                </div>

                <!-- Summary -->
                <div style="background: rgba(255, 255, 255, 0.05); padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                    <div style="font-weight: 600; margin-bottom: 12px;">📊 Resumen</div>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
                        <div style="text-align: center; padding: 12px; background: rgba(255, 255, 255, 0.05); border-radius: 6px;">
                            <div style="font-size: 24px; font-weight: 700; color: #3b82f6;" id="totalItemsCount">${victimInventory.length}</div>
                            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">Total Items</div>
                        </div>
                        <div style="text-align: center; padding: 12px; background: rgba(255, 255, 255, 0.05); border-radius: 6px;">
                            <div style="font-size: 24px; font-weight: 700; color: #22c55e;" id="obtainedItemsCount">${victimInventory.length}</div>
                            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">Items Obtenidos</div>
                        </div>
                        <div style="text-align: center; padding: 12px; background: rgba(255, 255, 255, 0.05); border-radius: 6px;">
                            <div style="font-size: 24px; font-weight: 700; color: #ef4444;" id="destroyedItemsCount">0</div>
                            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">Items Destruidos</div>
                        </div>
                    </div>
                </div>

                <!-- Action Buttons -->
                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                    <button class="btn btn-secondary" onclick="app.closeModal('editLootModal')">
                        Cancelar
                    </button>
                    <button class="btn btn-primary" onclick="app.confirmEditedLoot(${kill.eventId})">
                        💾 Confirmar Loot
                    </button>
                </div>
            </div>
        `;

        // Store kill data for later use
        window.currentEditingKill = kill;
        window.selectedLootItems = new Set(victimInventory.map((_, index) => index));
    }

    populateHistory(history) {
        const container = document.getElementById('historyList');
        if (!container) return;

        if (history.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📭</div>
                    <div class="empty-state-text">No hay actividades en el historial</div>
                    <div class="empty-state-subtext">Las actividades finalizadas aparecerán aquí</div>
                </div>
            `;
            return;
        }

        container.innerHTML = history.map((activity, index) => {
            const startDate = new Date(activity.startTime);
            const endDate = new Date(activity.endTime);
            const duration = endDate - startDate;
            const hours = Math.floor(duration / 3600000);
            const minutes = Math.floor((duration % 3600000) / 60000);

            const totalFame = activity.kills.reduce((sum, k) => sum + (k.victim?.deathFame || 0), 0);

            return `
                <div class="card" style="margin-bottom: 16px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <div>
                            <div style="font-weight: 600; font-size: 16px;">${activity.name}</div>
                            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
                                📅 ${startDate.toLocaleDateString()} ${startDate.toLocaleTimeString()} - ${endDate.toLocaleTimeString()}
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 14px; color: var(--accent);">⏱️ ${hours}h ${minutes}m</div>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 12px;">
                        <div style="background: rgba(255, 255, 255, 0.05); padding: 12px; border-radius: 6px; text-align: center;">
                            <div style="font-size: 20px; font-weight: 600; color: var(--accent);">${activity.participants.length}</div>
                            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">Participantes</div>
                        </div>
                        <div style="background: rgba(255, 255, 255, 0.05); padding: 12px; border-radius: 6px; text-align: center;">
                            <div style="font-size: 20px; font-weight: 600; color: #00d9ff;">${activity.kills.length}</div>
                            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">Kills</div>
                        </div>
                        <div style="background: rgba(255, 255, 255, 0.05); padding: 12px; border-radius: 6px; text-align: center;">
                            <div style="font-size: 20px; font-weight: 600; color: #ffd700;">${totalFame.toLocaleString()}</div>
                            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">Fame</div>
                        </div>
                        <div style="background: rgba(255, 255, 255, 0.05); padding: 12px; border-radius: 6px; text-align: center;">
                            <div style="font-size: 20px; font-weight: 600; color: #7bed9f;">${activity.kills.reduce((sum, k) => sum + k.lootConfirmed.length, 0)}</div>
                            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">Items</div>
                        </div>
                    </div>

                    <details style="margin-top: 12px;">
                        <summary style="cursor: pointer; padding: 8px; background: rgba(255, 255, 255, 0.05); border-radius: 4px; font-weight: 500;">
                            👥 Ver Participantes (${activity.participants.length})
                        </summary>
                        <div style="margin-top: 12px; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px;">
                            ${activity.participants.map(p => {
                const activeTime = p.totalActiveTime || 0;
                const hours = Math.floor(activeTime / 3600000);
                const minutes = Math.floor((activeTime % 3600000) / 60000);
                const percentage = duration > 0 ? ((activeTime / duration) * 100).toFixed(1) : 0;

                return `
                                    <div style="background: rgba(255, 255, 255, 0.03); padding: 8px; border-radius: 4px;">
                                        <div style="font-weight: 500; font-size: 13px;">${p.name}</div>
                                        <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">
                                            ⏱️ ${hours}h ${minutes}m (${percentage}%)
                                        </div>
                                        <div style="font-size: 11px; color: var(--text-secondary);">
                                            🎯 ${p.stats.kills} kills | 🤝 ${p.stats.assists} assists
                                        </div>
                                    </div>
                                `;
            }).join('')}
                        </div>
                    </details>
                </div>
            `;
        }).join('');
    }
}
