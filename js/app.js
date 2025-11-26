/**
 * Main Application Class - Coordinates all components
 */
class AlbionLootTracker {
    constructor() {
        this.config = null;
        this.currentActivity = null;
        this.pollingInterval = null;
        this.durationInterval = null;

        // Initialize services and managers
        this.apiService = new AlbionAPIService();
        this.uiManager = new UIManager();

        // Bind methods
        this.init = this.init.bind(this);
        this.checkForKills = this.checkForKills.bind(this);
        this.updateActivityUI = this.updateActivityUI.bind(this);
    }

    /**
     * Initialize the application
     */
    init() {
        this.loadConfig();
        this.loadCurrentActivity();
        this.updateUI();
    }

    /**
     * Load configuration from storage
     */
    loadConfig() {
        const savedConfig = StorageManager.load(StorageManager.KEYS.CONFIG);
        if (savedConfig) {
            this.config = new GuildConfig(savedConfig);
        }
    }

    /**
     * Load current activity from storage
     */
    loadCurrentActivity() {
        const savedActivity = StorageManager.load(StorageManager.KEYS.CURRENT_ACTIVITY);
        if (savedActivity) {
            this.currentActivity = new Activity(savedActivity);
            if (this.currentActivity.status === 'active') {
                this.startPolling();
                this.startDurationUpdate();
            }
        }
    }

    /**
     * Save configuration to storage
     */
    saveConfig() {
        if (this.config) {
            StorageManager.save(StorageManager.KEYS.CONFIG, this.config.toJSON());
        }
    }

    /**
     * Save current activity to storage
     */
    saveCurrentActivity() {
        if (this.currentActivity) {
            StorageManager.save(StorageManager.KEYS.CURRENT_ACTIVITY, this.currentActivity.toJSON());
        }
    }

    /**
     * Update UI based on current state
     */
    updateUI() {
        if (!this.config) {
            this.uiManager.showWelcomeScreen();
        } else if (this.currentActivity && this.currentActivity.status === 'active') {
            this.uiManager.showActivityScreen();
            this.updateActivityUI();
        } else {
            this.uiManager.showWelcomeScreen(this.config);
        }
    }

    /**
     * Update activity UI elements
     */
    updateActivityUI() {
        if (!this.currentActivity) return;

        this.uiManager.updateActivityInfo(this.currentActivity);
        this.uiManager.updateParticipantsList(this.currentActivity.participants, this.currentActivity);
        this.uiManager.updatePendingKills(this.currentActivity.pendingKills);
        this.uiManager.updateConfirmedKills(this.currentActivity.kills);
    }

    /**
     * Show configuration modal
     */
    showConfig() {
        if (this.config) {
            this.uiManager.loadConfigToForm(this.config);
        }
        this.uiManager.showModal('configModal');
    }

    /**
     * Save configuration from form
     */
    saveConfigFromForm() {
        const formData = this.uiManager.getConfigFromForm();

        if (!formData.guildName || !formData.membersText) {
            this.uiManager.showToast('Por favor completa todos los campos', 'error');
            return;
        }

        // Get guildId from form if present
        const guildIdInput = document.getElementById('guildIdInput');
        const guildId = guildIdInput ? guildIdInput.value.trim() || null : null;

        const members = formData.membersText.split('\n')
            .map(name => name.trim())
            .filter(name => name.length > 0)
            .map(name => ({
                name,
                id: null,
                guildName: formData.guildName, // Add guildName to each member
                firstSeen: new Date().toISOString(),
                totalKills: 0,
                totalAssists: 0,
                totalDeaths: 0
            }));

        this.config = new GuildConfig({
            guildName: formData.guildName,
            guildId: guildId,
            members
        });

        this.saveConfig();
        this.uiManager.closeModal('configModal');
        this.uiManager.showToast('Configuración guardada correctamente', 'success');
        this.updateUI();
    }

    /**
     * Show new activity modal
     */
    newActivity() {
        if (!this.config) {
            this.uiManager.showToast('Primero debes configurar tu gremio', 'warning');
            this.showConfig();
            return;
        }

        // Check if there's already an active activity
        if (this.currentActivity && this.currentActivity.status === 'active') {
            this.uiManager.showToast('Ya hay una actividad activa. Finalízala primero.', 'warning');
            return;
        }

        this.uiManager.populateParticipantSelection(this.config.members, this.config.guildName);
        this.uiManager.showModal('newActivityModal');
    }

    /**
     * Start a new activity
     */
    startActivity() {
        const activityName = this.uiManager.getActivityNameFromForm();
        const selectedParticipants = this.uiManager.getSelectedParticipants();

        if (!activityName || selectedParticipants.length === 0) {
            this.uiManager.showToast('Ingresa un nombre y selecciona participantes', 'warning');
            return;
        }

        this.currentActivity = new Activity({
            name: activityName
        });

        // Add participants
        selectedParticipants.forEach(name => {
            this.currentActivity.addParticipant(name);
        });

        this.saveCurrentActivity();
        this.uiManager.closeModal('newActivityModal');
        this.uiManager.clearActivityNameInput();
        this.uiManager.showToast(`Actividad "${activityName}" iniciada`, 'success');
        this.updateUI();

        // Reset lastEventId to load all available kills on first poll
        this.apiService.lastEventId = 0;

        this.startPolling();
        this.startDurationUpdate();
    }

    /**
     * Start polling for kills
     */
    startPolling() {
        if (this.pollingInterval) return;

        // First check with includeAll=true to load historical kills
        this.checkForKills(true);

        this.pollingInterval = setInterval(() => {
            this.checkForKills(false); // Subsequent checks only get new kills
        }, 30000); // Every 30 seconds
    }

    /**
     * Stop polling for kills
     */
    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    /**
     * Start duration update interval
     */
    startDurationUpdate() {
        if (this.durationInterval) return;

        this.durationInterval = setInterval(() => {
            if (this.currentActivity && this.currentActivity.status === 'active') {
                this.uiManager.updateActivityInfo(this.currentActivity);
            }
        }, 1000);
    }

    /**
     * Stop duration update interval
     */
    stopDurationUpdate() {
        if (this.durationInterval) {
            clearInterval(this.durationInterval);
            this.durationInterval = null;
        }
    }

    /**
     * Check for new kills from API
     * @param {boolean} includeAll - If true, load all available kills (for initial load)
     */
    async checkForKills(includeAll = false) {
        if (!this.config || !this.currentActivity) return;

        try {
            // Show loading indicator
            this.uiManager.updateLastUpdateTime(true);

            const events = await this.apiService.fetchEvents();

            // Get active participant names (excluding those who left)
            const activeParticipantNames = this.currentActivity.participants
                .filter(p => !p.leftAt)
                .map(p => p.name);

            // Filter kills only for active participants
            const activityKills = this.apiService.filterActivityKills(events, activeParticipantNames, includeAll);

            if (activityKills.length > 0) {
                console.log(`Found ${activityKills.length} ${includeAll ? 'historical' : 'new'} activity kills`);

                activityKills.forEach(killEvent => {
                    const killData = this.apiService.extractLootFromKill(killEvent);

                    // Only add if killer or participants are in the activity
                    const killerInActivity = activeParticipantNames.includes(killData.killer.name);
                    const participantsInActivity = killData.participants.some(p =>
                        activeParticipantNames.includes(p.name)
                    );

                    if (killerInActivity || participantsInActivity) {
                        this.currentActivity.addPendingKill(killData);
                        this.uiManager.showToast(
                            `🗡️ Nueva kill: ${killData.killer.name} → ${killData.victim.name}`,
                            'success'
                        );
                    }
                });

                // Update lastEventId with max from activity kills only
                const maxEventId = Math.max(...activityKills.map(e => e.EventId));
                this.apiService.updateLastEventId(maxEventId);

                this.saveCurrentActivity();
                this.updateActivityUI();
            }

            // Hide loading indicator
            this.uiManager.updateLastUpdateTime(false);
        } catch (error) {
            console.error('Error checking for kills:', error);
            // Hide loading indicator on error
            this.uiManager.updateLastUpdateTime(false);
        }
    }

    /**
     * Confirm a kill with all detected loot
     */
    confirmKill(eventId) {
        if (!this.currentActivity) return;

        const kill = this.currentActivity.pendingKills.find(k => k.eventId === eventId);
        if (kill) {
            this.currentActivity.confirmKill(eventId, kill.lootDetected);
            this.saveCurrentActivity();
            this.updateActivityUI();
            this.uiManager.showToast('Kill confirmada', 'success');
        }
    }

    /**
     * Discard a kill
     */
    discardKill(eventId) {
        if (!this.currentActivity) return;

        if (confirm('¿Estás seguro de descartar esta kill?')) {
            this.currentActivity.discardKill(eventId);
            this.saveCurrentActivity();
            this.updateActivityUI();
            this.uiManager.showToast('Kill descartada', 'success');
        }
    }

    /**
     * Edit kill loot
     */
    editKillLoot(eventId) {
        if (!this.currentActivity) return;

        const kill = this.currentActivity.pendingKills.find(k => k.eventId === eventId);
        if (!kill) {
            this.uiManager.showToast('Kill no encontrada', 'error');
            return;
        }

        // Show edit loot modal
        this.uiManager.showEditLootModal(kill);
        this.uiManager.showModal('editLootModal');
    }

    /**
     * Toggle loot item selection
     */
    toggleLootItem(index) {
        if (!window.selectedLootItems) return;

        const itemCard = document.getElementById(`loot-item-${index}`);
        if (!itemCard) return;

        if (window.selectedLootItems.has(index)) {
            // Deselect
            window.selectedLootItems.delete(index);
            itemCard.classList.remove('selected');
            itemCard.style.background = 'rgba(239, 68, 68, 0.1)';
            itemCard.style.borderColor = 'rgba(239, 68, 68, 0.4)';
            itemCard.style.opacity = '0.6';

            const indicator = itemCard.querySelector('.selection-indicator');
            if (indicator) {
                indicator.style.background = 'rgba(239, 68, 68, 0.9)';
                indicator.textContent = '✗';
            }
        } else {
            // Select
            window.selectedLootItems.add(index);
            itemCard.classList.add('selected');
            itemCard.style.background = 'rgba(34, 197, 94, 0.2)';
            itemCard.style.borderColor = 'rgba(34, 197, 94, 0.6)';
            itemCard.style.opacity = '1';

            const indicator = itemCard.querySelector('.selection-indicator');
            if (indicator) {
                indicator.style.background = 'rgba(34, 197, 94, 0.9)';
                indicator.textContent = '✓';
            }
        }

        // Update summary
        this.updateLootSummary();
    }

    /**
     * Select all loot items
     */
    selectAllLoot() {
        if (!window.currentEditingKill) return;

        const victimInventory = window.currentEditingKill.victimInventory || window.currentEditingKill.lootDetected || [];
        window.selectedLootItems = new Set(victimInventory.map((_, index) => index));

        // Update all cards
        victimInventory.forEach((_, index) => {
            const itemCard = document.getElementById(`loot-item-${index}`);
            if (itemCard) {
                itemCard.classList.add('selected');
                itemCard.style.background = 'rgba(34, 197, 94, 0.2)';
                itemCard.style.borderColor = 'rgba(34, 197, 94, 0.6)';
                itemCard.style.opacity = '1';

                const indicator = itemCard.querySelector('.selection-indicator');
                if (indicator) {
                    indicator.style.background = 'rgba(34, 197, 94, 0.9)';
                    indicator.textContent = '✓';
                }
            }
        });

        this.updateLootSummary();
        this.uiManager.showToast('Todos los items seleccionados', 'success');
    }

    /**
     * Deselect all loot items
     */
    deselectAllLoot() {
        if (!window.currentEditingKill) return;

        const victimInventory = window.currentEditingKill.victimInventory || window.currentEditingKill.lootDetected || [];
        window.selectedLootItems = new Set();

        // Update all cards
        victimInventory.forEach((_, index) => {
            const itemCard = document.getElementById(`loot-item-${index}`);
            if (itemCard) {
                itemCard.classList.remove('selected');
                itemCard.style.background = 'rgba(239, 68, 68, 0.1)';
                itemCard.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                itemCard.style.opacity = '0.6';

                const indicator = itemCard.querySelector('.selection-indicator');
                if (indicator) {
                    indicator.style.background = 'rgba(239, 68, 68, 0.9)';
                    indicator.textContent = '✗';
                }
            }
        });

        this.updateLootSummary();
        this.uiManager.showToast('Todos los items deseleccionados', 'info');
    }

    /**
     * Update loot summary counters
     */
    updateLootSummary() {
        if (!window.currentEditingKill) return;

        const victimInventory = window.currentEditingKill.victimInventory || window.currentEditingKill.lootDetected || [];
        const totalItems = victimInventory.length;
        const obtainedItems = window.selectedLootItems.size;
        const destroyedItems = totalItems - obtainedItems;

        const totalElement = document.getElementById('totalItemsCount');
        const obtainedElement = document.getElementById('obtainedItemsCount');
        const destroyedElement = document.getElementById('destroyedItemsCount');

        if (totalElement) totalElement.textContent = totalItems;
        if (obtainedElement) obtainedElement.textContent = obtainedItems;
        if (destroyedElement) destroyedElement.textContent = destroyedItems;
    }

    /**
     * Confirm edited loot
     */
    confirmEditedLoot(eventId) {
        if (!this.currentActivity || !window.currentEditingKill) return;

        const victimInventory = window.currentEditingKill.victimInventory || window.currentEditingKill.lootDetected || [];
        const confirmedLoot = [];

        // Get selected items
        window.selectedLootItems.forEach(index => {
            if (victimInventory[index]) {
                confirmedLoot.push(victimInventory[index]);
            }
        });

        // Confirm kill with selected loot
        this.currentActivity.confirmKill(eventId, confirmedLoot);
        this.saveCurrentActivity();
        this.updateActivityUI();

        // Clean up
        window.currentEditingKill = null;
        window.selectedLootItems = null;

        this.uiManager.closeModal('editLootModal');
        this.uiManager.showToast(`Kill confirmada con ${confirmedLoot.length} items obtenidos`, 'success');
    }

    /**
     * End current activity
     */
    endActivity() {
        if (!this.currentActivity) return;

        if (!confirm('¿Estás seguro de finalizar esta actividad?')) return;

        this.currentActivity.complete();
        this.stopPolling();
        this.stopDurationUpdate();

        // Save to history
        const history = StorageManager.load(StorageManager.KEYS.HISTORY) || [];
        history.unshift(this.currentActivity.toJSON());
        StorageManager.save(StorageManager.KEYS.HISTORY, history);

        // Clear current activity
        StorageManager.remove(StorageManager.KEYS.CURRENT_ACTIVITY);
        this.currentActivity = null;

        this.uiManager.showToast('Actividad finalizada', 'success');
        this.updateUI();
    }

    /**
     * Show modal to add participant to current activity
     */
    showAddParticipantModal() {
        if (!this.currentActivity || !this.config) {
            this.uiManager.showToast('No hay actividad activa', 'warning');
            return;
        }

        // Get members not in activity
        const currentParticipantNames = this.currentActivity.participants
            .filter(p => !p.leftAt) // Only active participants
            .map(p => p.name);

        const availableMembers = this.config.members.filter(
            m => !currentParticipantNames.includes(m.name)
        );

        this.uiManager.populateAddParticipantSelection(availableMembers);
        this.uiManager.showModal('addParticipantModal');
    }

    /**
     * Filter available participants in add modal
     */
    filterAddParticipants(searchTerm) {
        const labels = document.querySelectorAll('#addParticipantSelection label');
        const term = searchTerm.toLowerCase();

        labels.forEach(label => {
            const text = label.textContent.toLowerCase();
            if (text.includes(term)) {
                label.style.display = 'block';
            } else {
                label.style.display = 'none';
            }
        });
    }

    /**
     * Confirm and add selected participant to activity
     */
    confirmAddParticipant() {
        const selectedName = this.uiManager.getSelectedAddParticipant();

        if (!selectedName) {
            this.uiManager.showToast('Selecciona un participante', 'warning');
            return;
        }

        this.currentActivity.addParticipant(selectedName);
        this.saveCurrentActivity();
        this.updateActivityUI();
        this.uiManager.closeModal('addParticipantModal');
        this.uiManager.showToast(`${selectedName} agregado a la actividad`, 'success');
    }

    /**
     * Show participant profile
     */
    showParticipantProfile(name) {
        this.uiManager.showToast('Función en desarrollo', 'warning');
    }

    /**
     * Show history
     */
    showHistory() {
        const history = StorageManager.load(StorageManager.KEYS.HISTORY) || [];
        this.uiManager.populateHistory(history);
        this.uiManager.showModal('historyModal');
    }

    /**
     * Search guild and show results
     */
    async searchGuild() {
        const searchInput = document.getElementById('guildSearchInput');
        const searchButton = document.querySelector('[onclick="app.searchGuild()"]');
        const guildName = searchInput.value.trim();

        if (!guildName) {
            this.uiManager.showToast('Por favor ingresa el nombre del gremio', 'warning');
            return;
        }

        const resultsContainer = document.getElementById('guildSearchResults');

        try {
            // Add loading state to button
            searchButton.classList.add('loading');
            searchButton.disabled = true;

            // Show loading state
            resultsContainer.style.display = 'block';
            resultsContainer.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px; padding: 20px; background: rgba(59, 130, 246, 0.1); border-radius: 8px; border: 1px solid rgba(59, 130, 246, 0.3);">
                    <div class="spinner"></div>
                    <div>
                        <div style="font-weight: 600; color: #3b82f6; margin-bottom: 4px;">
                            🔍 Buscando "${guildName}"...
                        </div>
                        <div style="font-size: 12px; color: var(--text-secondary);">
                            Esto puede tardar unos segundos
                        </div>
                    </div>
                </div>
            `;

            this.uiManager.showToast('Buscando gremio en la API de Albion...', 'info');

            // Search for guild
            const guilds = await this.apiService.searchGuild(guildName);

            // Remove loading state
            searchButton.classList.remove('loading');
            searchButton.disabled = false;

            if (guilds.length === 0) {
                resultsContainer.style.display = 'block';
                resultsContainer.innerHTML = `
                    <div style="padding: 20px; text-align: center; background: rgba(239, 68, 68, 0.1); border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.3);">
                        <div style="font-size: 40px; margin-bottom: 8px;">😔</div>
                        <div style="font-weight: 600; color: #ef4444; margin-bottom: 4px;">
                            No se encontraron gremios
                        </div>
                        <div style="font-size: 14px; color: var(--text-secondary);">
                            Verifica el nombre e intenta de nuevo
                        </div>
                    </div>
                `;
                this.uiManager.showToast('No se encontraron gremios con ese nombre', 'warning');
                return;
            }

            // Show success message
            this.uiManager.showToast(`✅ Se encontraron ${guilds.length} gremios`, 'success');

            // Show results
            resultsContainer.style.display = 'block';
            resultsContainer.innerHTML = `
                <div style="background: rgba(34, 197, 94, 0.05); border-radius: 8px; padding: 12px; border: 1px solid rgba(34, 197, 94, 0.2);">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                        <span class="status-badge success">
                            ✓ ${guilds.length} resultado${guilds.length > 1 ? 's' : ''}
                        </span>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 8px; max-height: 300px; overflow-y: auto;">
                        ${guilds.map(guild => `
                            <div style="background: rgba(255, 255, 255, 0.05); padding: 12px; border-radius: 8px; cursor: pointer; transition: all 0.2s;"
                                 onmouseover="this.style.background='rgba(255, 255, 255, 0.1)'"
                                 onmouseout="this.style.background='rgba(255, 255, 255, 0.05)'"
                                 onclick="app.selectGuild('${guild.Id}', '${guild.Name.replace(/'/g, "\\'")}', ${guild.MemberCount})">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <div style="font-weight: 600; font-size: 15px; margin-bottom: 4px;">
                                            ${guild.Name}
                                        </div>
                                        <div style="font-size: 12px; color: var(--text-secondary);">
                                            👥 ${guild.MemberCount} miembros
                                            ${guild.AllianceName ? `| 🤝 ${guild.AllianceName}` : ''}
                                        </div>
                                    </div>
                                    <div style="padding: 6px 12px; background: rgba(0, 217, 255, 0.2); border-radius: 6px; font-size: 12px; font-weight: 600; color: #00d9ff;">
                                        Seleccionar
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;

        } catch (error) {
            console.error('Error searching guild:', error);

            // Remove loading state
            searchButton.classList.remove('loading');
            searchButton.disabled = false;

            let errorMessage = 'Error al buscar gremio.';
            let errorIcon = '❌';
            if (error.message.includes('timeout')) {
                errorMessage = 'La búsqueda tardó demasiado. Intenta de nuevo o verifica tu conexión.';
                errorIcon = '⏱️';
            } else if (error.message.includes('504')) {
                errorMessage = 'El servidor tardó demasiado en responder. Intenta de nuevo en unos momentos.';
                errorIcon = '🔌';
            } else if (error.message.includes('Failed to fetch')) {
                errorMessage = 'Error de conexión. Verifica tu internet e intenta de nuevo.';
                errorIcon = '📡';
            }

            this.uiManager.showToast(errorMessage, 'error');

            // Show error in results container
            if (resultsContainer) {
                resultsContainer.style.display = 'block';
                resultsContainer.innerHTML = `
                    <div style="padding: 20px; background: rgba(239, 68, 68, 0.1); border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.3);">
                        <div style="text-align: center; margin-bottom: 16px;">
                            <div style="font-size: 40px; margin-bottom: 8px;">${errorIcon}</div>
                            <span class="status-badge error">Error de conexión</span>
                        </div>
                        <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 16px; text-align: center;">
                            ${errorMessage}
                        </div>
                        <div style="background: rgba(255, 255, 255, 0.05); padding: 12px; border-radius: 6px;">
                            <div style="font-size: 12px; color: var(--text-secondary);">
                                <strong style="color: var(--text-primary);">💡 Sugerencias:</strong><br>
                                • Verifica tu conexión a internet<br>
                                • Intenta de nuevo en unos segundos<br>
                                • Si el problema persiste, usa la configuración manual
                            </div>
                        </div>
                    </div>
                `;
            }
        }
    }

    /**
     * Select a guild from search results and load its members
     */
    async selectGuild(guildId, guildName, memberCount) {
        const resultsContainer = document.getElementById('guildSearchResults');

        try {
            // Show loading overlay
            resultsContainer.style.display = 'block';
            resultsContainer.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px; padding: 20px; background: rgba(59, 130, 246, 0.1); border-radius: 8px; border: 1px solid rgba(59, 130, 246, 0.3);">
                    <div class="spinner"></div>
                    <div>
                        <div style="font-weight: 600; color: #3b82f6; margin-bottom: 4px;">
                            📥 Cargando miembros de ${guildName}...
                        </div>
                        <div style="font-size: 12px; color: var(--text-secondary);">
                            Obteniendo ${memberCount} miembros desde la API
                        </div>
                    </div>
                </div>
            `;

            this.uiManager.showToast(`Cargando ${memberCount} miembros de ${guildName}...`, 'info');

            // Get guild members
            const members = await this.apiService.getGuildMembers(guildId);

            // Update form fields
            document.getElementById('guildNameInput').value = guildName;
            document.getElementById('guildIdInput').value = guildId;
            document.getElementById('guildMembersInput').value = members.map(m => m.name).join('\n');

            // Show success state before hiding
            resultsContainer.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px; padding: 20px; background: rgba(34, 197, 94, 0.1); border-radius: 8px; border: 1px solid rgba(34, 197, 94, 0.3);">
                    <div style="font-size: 32px;">✅</div>
                    <div>
                        <div style="font-weight: 600; color: #22c55e; margin-bottom: 4px;">
                            ¡Gremio cargado exitosamente!
                        </div>
                        <div style="font-size: 12px; color: var(--text-secondary);">
                            ${members.length} miembros listos para configurar
                        </div>
                    </div>
                </div>
            `;

            // Hide after a short delay
            setTimeout(() => {
                resultsContainer.style.display = 'none';
                document.getElementById('guildSearchInput').value = '';
            }, 2000);

            this.uiManager.showToast(`✅ ${members.length} miembros cargados correctamente`, 'success');

        } catch (error) {
            console.error('Error loading guild members:', error);

            resultsContainer.style.display = 'block';
            resultsContainer.innerHTML = `
                <div style="padding: 20px; background: rgba(239, 68, 68, 0.1); border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.3); text-align: center;">
                    <div style="font-size: 40px; margin-bottom: 8px;">😞</div>
                    <span class="status-badge error">Error al cargar miembros</span>
                    <div style="font-size: 14px; color: var(--text-secondary); margin-top: 12px;">
                        No se pudieron cargar los miembros del gremio. Intenta de nuevo.
                    </div>
                </div>
            `;

            this.uiManager.showToast('Error al cargar miembros del gremio', 'error');
        }
    }

    /**
     * Load guild from API by name
     */
    async loadGuildFromAPI(guildName = 'CAZA GANKER') {
        try {
            this.uiManager.showToast('Buscando gremio...', 'success');

            // Search for guild
            const guilds = await this.apiService.searchGuild(guildName);

            if (guilds.length === 0) {
                this.uiManager.showToast('Gremio no encontrado', 'error');
                return;
            }

            // Get the first matching guild
            const guild = guilds[0];

            this.uiManager.showToast(`Gremio encontrado: ${guild.Name}. Cargando miembros...`, 'success');

            // Get guild members
            const members = await this.apiService.getGuildMembers(guild.Id);

            // Create config with guild data
            this.config = new GuildConfig({
                guildName: guild.Name,
                guildId: guild.Id,
                members: members
            });

            this.saveConfig();
            this.uiManager.showToast(`✅ ${members.length} miembros cargados correctamente`, 'success');
            this.updateUI();
        } catch (error) {
            console.error('Error loading guild:', error);
            this.uiManager.showToast('Error al cargar el gremio. Intenta de nuevo.', 'error');
        }
    }

    /**
     * Refresh guild members from API
     */
    async refreshGuildMembers() {
        if (!this.config || !this.config.guildId) {
            this.uiManager.showToast('Primero debes configurar tu gremio', 'warning');
            return;
        }

        try {
            this.uiManager.showToast('Actualizando miembros...', 'info');
            const members = await this.apiService.getGuildMembers(this.config.guildId);

            this.config.members = members;
            this.saveConfig();
            this.uiManager.showToast(`✅ Miembros actualizados: ${members.length}`, 'success');
        } catch (error) {
            console.error('Error refreshing members:', error);
            this.uiManager.showToast('Error al actualizar miembros', 'error');
        }
    }

    /**
     * Pause a participant
     */
    pauseParticipant(name) {
        if (!this.currentActivity) return;

        this.currentActivity.pauseParticipant(name);
        this.saveCurrentActivity();
        this.updateActivityUI();
        this.uiManager.showToast(`${name} pausado`, 'info');
    }

    /**
     * Resume a participant
     */
    resumeParticipant(name) {
        if (!this.currentActivity) return;

        this.currentActivity.resumeParticipant(name);
        this.saveCurrentActivity();
        this.updateActivityUI();
        this.uiManager.showToast(`${name} reanudado`, 'success');
    }

    /**
     * Remove a participant from activity
     */
    removeParticipantFromActivity(name) {
        if (!this.currentActivity) return;

        if (confirm(`¿Estás seguro de retirar a ${name} de la actividad?`)) {
            this.currentActivity.removeParticipant(name);
            this.saveCurrentActivity();
            this.updateActivityUI();
            this.uiManager.showToast(`${name} retirado de la actividad`, 'warning');
        }
    }

    /**
     * Select all participants in new activity modal
     */
    selectAllParticipants() {
        const checkboxes = this.uiManager.elements.participantSelection.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = true;
        });
    }

    /**
     * Deselect all participants in new activity modal
     */
    deselectAllParticipants() {
        const checkboxes = this.uiManager.elements.participantSelection.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
    }

    /**
     * Filter participants list by search term
     */
    filterParticipants(searchTerm) {
        const labels = this.uiManager.elements.participantSelection.querySelectorAll('label');
        const term = searchTerm.toLowerCase();

        labels.forEach(label => {
            const text = label.textContent.toLowerCase();
            if (text.includes(term)) {
                label.style.display = 'block';
            } else {
                label.style.display = 'none';
            }
        });
    }

    /**
     * Close modal by ID
     */
    closeModal(modalId) {
        this.uiManager.closeModal(modalId);
    }

    /**
     * Show kill detail modal
     */
    showKillDetail(eventId, source = 'pending') {
        let kill = null;

        if (source === 'pending') {
            kill = this.currentActivity.pendingKills.find(k => k.eventId === eventId);
        } else if (source === 'confirmed') {
            kill = this.currentActivity.kills.find(k => k.eventId === eventId);
        }

        if (kill) {
            this.uiManager.showKillDetail(kill, source);
            this.uiManager.showModal('killDetailModal');
        }
    }
}

// Initialize application
let app;

document.addEventListener('DOMContentLoaded', () => {
    app = new AlbionLootTracker();
    window.app = app; // Make accessible globally for onclick handlers
    app.init();
});
