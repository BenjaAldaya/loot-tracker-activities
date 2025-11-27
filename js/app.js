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
        this.priceService = new AlbionPriceService();
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

            // Clean up any duplicate kills and old kills from previous activities
            const cleanupResult = this.currentActivity.removeDuplicatePendingKills();
            if (cleanupResult.duplicatesCount > 0 || cleanupResult.oldKillsCount > 0) {
                console.log(`[CLEANUP] Removed ${cleanupResult.duplicatesCount} duplicate kills and ${cleanupResult.oldKillsCount} old kills from previous activities`);
                this.saveCurrentActivity();
            }

            // Restore lastEventId from saved activity to prevent duplicate kills
            if (this.currentActivity.lastEventId) {
                this.apiService.lastEventId = this.currentActivity.lastEventId;
                console.log(`[INIT] Restored lastEventId: ${this.apiService.lastEventId}`);
            }

            if (this.currentActivity.status === 'active') {
                this.startPolling(false); // false = resuming existing activity, don't reload all kills
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
        // Update activity badge in header
        const activityBadge = document.getElementById('activityBadge');
        const activityBadgeText = document.getElementById('activityBadgeText');

        if (this.currentActivity && this.currentActivity.status === 'active') {
            if (activityBadge) {
                activityBadge.classList.remove('hidden');
                if (activityBadgeText) {
                    activityBadgeText.textContent = `${this.currentActivity.name}`;
                }
            }
        } else {
            if (activityBadge) {
                activityBadge.classList.add('hidden');
            }
        }

        // Update main UI
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
        this.uiManager.updateLootChest(this.currentActivity);
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
        const citySelect = document.getElementById('activityCitySelect');
        const selectedCity = citySelect ? citySelect.value : 'Caerleon';

        if (!activityName || selectedParticipants.length === 0) {
            this.uiManager.showToast('Ingresa un nombre y selecciona participantes', 'warning');
            return;
        }

        this.currentActivity = new Activity({
            name: activityName,
            city: selectedCity
        });

        // Add participants
        selectedParticipants.forEach(name => {
            this.currentActivity.addParticipant(name);
        });

        this.saveCurrentActivity();
        this.uiManager.closeModal('newActivityModal');
        this.uiManager.clearActivityNameInput();
        this.uiManager.showToast(`Actividad "${activityName}" iniciada en ${selectedCity}`, 'success');
        this.updateUI();

        // Reset lastEventId to load all available kills on first poll
        this.apiService.lastEventId = 0;
        this.currentActivity.lastEventId = 0;

        this.startPolling(true); // true = new activity, load all historical kills
        this.startDurationUpdate();
    }

    /**
     * Start polling for kills
     * @param {boolean} isNewActivity - If true, loads all historical kills; otherwise continues from lastEventId
     */
    startPolling(isNewActivity = false) {
        if (this.pollingInterval) return;

        // Only load all historical kills for NEW activities
        // For resumed activities (after page reload), continue from lastEventId
        if (isNewActivity) {
            console.log('🆕 New activity: loading all historical kills');
            this.checkForKills(true);
        } else {
            console.log('📂 Resuming activity: continuing from lastEventId');
            this.checkForKills(false);
        }

        // Poll every 3 minutes - users don't need real-time updates during activity
        this.pollingInterval = setInterval(() => {
            this.checkForKills(false); // Subsequent checks only get new kills
        }, 180000); // Every 3 minutes (180 seconds)

        console.log('✅ Polling started: checking for new kills every 3 minutes');
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
        // Prevent race condition: don't process if no activity or activity is not active
        if (!this.config || !this.currentActivity || this.currentActivity.status !== 'active') {
            console.log('[RACE PROTECTION] Skipping kill check - activity not active');
            return;
        }

        try {
            // Show loading indicator
            this.uiManager.updateLastUpdateTime(true);

            // Use guild-specific endpoint if guildId is available, otherwise use general events
            let events = [];
            let allEvents = [];

            if (this.config.guildId) {
                console.log(`[DEBUG] Fetching guild events for: ${this.config.guildName} (ID: ${this.config.guildId})`);

                // Fetch first page
                events = await this.apiService.fetchGuildEvents(this.config.guildId, 51, 0);
                allEvents = [...events];

                // If we're in initial load mode or if there's a potential gap, fetch more pages
                if (events.length === 51) {
                    const minEventId = Math.min(...events.map(e => e.EventId));
                    const potentialGap = this.apiService.lastEventId > 0 ? minEventId - this.apiService.lastEventId : 0;

                    // If there's a gap of more than 51 events, try to fetch more pages
                    if (potentialGap > 51 && potentialGap < 1000) {
                        console.log(`[DEBUG] Potential gap detected (${potentialGap} events), fetching additional pages...`);

                        // Fetch up to 10 additional pages (51 * 10 = 510 events max)
                        let offset = 51;
                        let pagesLoaded = 1;
                        const maxPages = Math.min(10, Math.ceil(potentialGap / 51));

                        while (pagesLoaded < maxPages) {
                            const nextPage = await this.apiService.fetchGuildEvents(this.config.guildId, 51, offset);
                            if (nextPage.length === 0) break;

                            allEvents = [...allEvents, ...nextPage];
                            pagesLoaded++;
                            offset += 51;

                            // Check if we've covered the gap
                            const oldestEventId = Math.min(...nextPage.map(e => e.EventId));
                            if (oldestEventId <= this.apiService.lastEventId) {
                                console.log(`[DEBUG] Gap covered after ${pagesLoaded} pages`);
                                break;
                            }
                        }

                        console.log(`[DEBUG] Loaded ${pagesLoaded} pages (${allEvents.length} total events)`);
                    }
                }

                events = allEvents;
            } else {
                console.log(`[DEBUG] No guild ID configured, fetching general events`);
                events = await this.apiService.fetchEvents();
            }

            console.log(`[DEBUG] Fetched ${events.length} total events from API`);
            console.log(`[DEBUG] Current lastEventId: ${this.apiService.lastEventId}`);
            console.log(`[DEBUG] Include all mode: ${includeAll}`);

            // Get active participant names (excluding those who left)
            const activeParticipantNames = this.currentActivity.participants
                .filter(p => !p.leftAt)
                .map(p => p.name);

            console.log(`[DEBUG] Active participants: ${activeParticipantNames.join(', ')}`);
            console.log(`[DEBUG] Guild name: ${this.config.guildName}`);
            console.log(`[DEBUG] Guild ID: ${this.config.guildId}`);
            console.log(`[DEBUG] Activity start time: ${this.currentActivity.startTime}`);

            // Filter kills only for active participants and after activity start time
            const activityKills = this.apiService.filterActivityKills(
                events,
                activeParticipantNames,
                includeAll,
                this.config.guildName,  // Pass guild name for additional filtering
                this.currentActivity.startTime  // Pass activity start time to filter out old kills
            );

            console.log(`[DEBUG] After filtering: ${activityKills.length} activity kills`);

            // Check if we might be missing events due to API limit
            if (events.length >= 51 && !includeAll) {
                console.warn(`⚠️ WARNING: API returned maximum number of events (51). Some kills may have been missed!`);
                console.warn(`⚠️ Consider reducing polling interval or checking more frequently.`);
                this.uiManager.showToast(
                    '⚠️ Advertencia: Se alcanzó el límite de eventos de la API. Algunas kills pueden haberse perdido.',
                    'warning',
                    5000
                );
            }

            // Check for potential gap in EventIds
            if (!includeAll && events.length > 0) {
                const minEventId = Math.min(...events.map(e => e.EventId));
                if (this.apiService.lastEventId > 0 && minEventId > this.apiService.lastEventId + 1) {
                    const gap = minEventId - this.apiService.lastEventId - 1;
                    console.warn(`⚠️ WARNING: Gap detected in EventIds! Last processed: ${this.apiService.lastEventId}, Oldest available: ${minEventId}. Missing ${gap} events!`);
                    this.uiManager.showToast(
                        `⚠️ Se detectó un hueco de ${gap} eventos. Algunas kills pueden haberse perdido.`,
                        'warning',
                        5000
                    );
                }
            }

            if (activityKills.length > 0) {
                console.log(`✅ Found ${activityKills.length} ${includeAll ? 'historical' : 'new'} activity kills`);

                // Double-check activity is still active before adding kills
                if (this.currentActivity.status !== 'active') {
                    console.log('[RACE PROTECTION] Activity ended during processing - discarding kills');
                    return;
                }

                let addedKills = 0;
                activityKills.forEach(killEvent => {
                    const killData = this.apiService.extractLootFromKill(killEvent);

                    // filterActivityKills already did the filtering, no need to do it again
                    this.currentActivity.addPendingKill(killData);
                    this.uiManager.showToast(
                        `🗡️ Nueva kill: ${killData.killer.name} → ${killData.victim.name}`,
                        'success'
                    );
                    addedKills++;
                });

                console.log(`[DEBUG] Added ${addedKills} kills to pending list`);

                // Update lastEventId with max from activity kills only
                const maxEventId = Math.max(...activityKills.map(e => e.EventId));
                console.log(`[DEBUG] Updating lastEventId from ${this.apiService.lastEventId} to ${maxEventId}`);
                this.apiService.updateLastEventId(maxEventId);

                // Save lastEventId to activity to prevent duplicates on page reload
                this.currentActivity.lastEventId = maxEventId;

                this.saveCurrentActivity();
                this.updateActivityUI();
            } else {
                console.log(`ℹ️ No new kills found in this poll`);

                // Even if no activity kills, update lastEventId to prevent re-checking old events
                if (events.length > 0) {
                    const maxEventId = Math.max(...events.map(e => e.EventId));
                    if (maxEventId > this.apiService.lastEventId) {
                        console.log(`[DEBUG] No activity kills but updating lastEventId from ${this.apiService.lastEventId} to ${maxEventId} to skip rechecking`);
                        this.apiService.updateLastEventId(maxEventId);

                        // Save lastEventId to activity
                        this.currentActivity.lastEventId = maxEventId;
                        this.saveCurrentActivity();
                    }
                }
            }

            // Hide loading indicator
            this.uiManager.updateLastUpdateTime(false);
        } catch (error) {
            console.error('❌ Error checking for kills:', error);
            // Hide loading indicator on error
            this.uiManager.updateLastUpdateTime(false);
        }
    }

    /**
     * Confirm a kill with all detected loot
     */
    async confirmKill(eventId) {
        if (!this.currentActivity) return;

        const kill = this.currentActivity.pendingKills.find(k => k.eventId === eventId);
        if (!kill) return;

        const loot = kill.victimInventory || kill.lootDetected || [];

        if (loot.length === 0) {
            this.currentActivity.confirmKill(eventId, loot);
            this.saveCurrentActivity();
            this.updateActivityUI();
            this.uiManager.showToast('Kill confirmada sin loot', 'info');
            return;
        }

        this.uiManager.showToast('Consultando precios...', 'info');

        try {
            const priceMap = await this.priceService.getItemsPrices(loot, this.currentActivity.city);

            loot.forEach(item => {
                const key = `${item.type}_${item.quality || 0}`;
                const priceInfo = priceMap.get(key);

                if (priceInfo && priceInfo.found) {
                    item.price = {
                        sellPrice: priceInfo.sellPrice,
                        buyPrice: priceInfo.buyPrice,
                        city: priceInfo.city,
                        lastUpdate: priceInfo.lastUpdate,
                        found: true
                    };
                } else {
                    item.price = {
                        sellPrice: 0,
                        buyPrice: 0,
                        city: this.currentActivity.city,
                        lastUpdate: new Date().toISOString(),
                        found: false
                    };
                }
            });

            this.currentActivity.confirmKill(eventId, loot);
            this.saveCurrentActivity();
            this.updateActivityUI();

            const totalValue = this.priceService.calculateTotalValue(loot);
            const formattedValue = this.priceService.formatPrice(totalValue);
            const itemsWithPrice = loot.filter(item => item.price?.found).length;

            this.uiManager.showToast(
                `Kill confirmada: ${loot.length} items (${itemsWithPrice} con precio) - Valor: ${formattedValue}`,
                'success'
            );
        } catch (error) {
            console.error('Error fetching prices:', error);

            this.currentActivity.confirmKill(eventId, loot);
            this.saveCurrentActivity();
            this.updateActivityUI();
            this.uiManager.showToast('Kill confirmada (error al obtener precios)', 'warning');
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
    async confirmEditedLoot(eventId) {
        if (!this.currentActivity || !window.currentEditingKill) return;

        const victimInventory = window.currentEditingKill.victimInventory || window.currentEditingKill.lootDetected || [];
        const confirmedLoot = [];

        // Get selected items
        window.selectedLootItems.forEach(index => {
            if (victimInventory[index]) {
                confirmedLoot.push(victimInventory[index]);
            }
        });

        if (confirmedLoot.length === 0) {
            // Confirm kill with empty loot
            this.currentActivity.confirmKill(eventId, confirmedLoot);
            this.saveCurrentActivity();
            this.updateActivityUI();

            window.currentEditingKill = null;
            window.selectedLootItems = null;
            this.uiManager.closeModal('editLootModal');
            this.uiManager.showToast('Kill confirmada sin loot obtenido', 'info');
            return;
        }

        // Show loading toast
        this.uiManager.showToast('Consultando precios...', 'info');

        try {
            // Fetch prices for confirmed loot
            const priceMap = await this.priceService.getItemsPrices(confirmedLoot, this.currentActivity.city);

            // Attach prices to items
            confirmedLoot.forEach(item => {
                const key = `${item.type}_${item.quality || 0}`;
                const priceInfo = priceMap.get(key);

                if (priceInfo && priceInfo.found) {
                    item.price = {
                        sellPrice: priceInfo.sellPrice,
                        buyPrice: priceInfo.buyPrice,
                        city: priceInfo.city,
                        lastUpdate: priceInfo.lastUpdate,
                        found: true
                    };
                } else {
                    item.price = {
                        sellPrice: 0,
                        buyPrice: 0,
                        city: this.currentActivity.city,
                        lastUpdate: new Date().toISOString(),
                        found: false
                    };
                }
            });

            // Confirm kill with priced loot
            this.currentActivity.confirmKill(eventId, confirmedLoot);
            this.saveCurrentActivity();
            this.updateActivityUI();

            // Clean up
            window.currentEditingKill = null;
            window.selectedLootItems = null;

            this.uiManager.closeModal('editLootModal');

            const totalValue = this.priceService.calculateTotalValue(confirmedLoot);
            const formattedValue = this.priceService.formatPrice(totalValue);
            const itemsWithPrice = confirmedLoot.filter(item => item.price?.found).length;

            this.uiManager.showToast(
                `Kill confirmada: ${confirmedLoot.length} items (${itemsWithPrice} con precio) - Valor: ${formattedValue}`,
                'success'
            );
        } catch (error) {
            console.error('Error fetching prices:', error);

            // Confirm without prices if API fails
            this.currentActivity.confirmKill(eventId, confirmedLoot);
            this.saveCurrentActivity();
            this.updateActivityUI();

            window.currentEditingKill = null;
            window.selectedLootItems = null;

            this.uiManager.closeModal('editLootModal');
            this.uiManager.showToast(`Kill confirmada (error al obtener precios)`, 'warning');
        }
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
     * Show diagnostics panel
     */
    showDiagnostics() {
        this.refreshDiagnostics();
        this.uiManager.showModal('diagnosticsModal');
    }

    /**
     * Refresh diagnostics information
     */
    async refreshDiagnostics() {
        const diagnosticsContent = document.getElementById('diagnosticsContent');

        diagnosticsContent.innerHTML = '<div style="text-align: center; padding: 20px;">Cargando diagnóstico...</div>';

        try {
            // Fetch current events from API
            const events = await this.apiService.fetchEvents();

            const now = new Date();
            const activeParticipantNames = this.currentActivity
                ? this.currentActivity.participants.filter(p => !p.leftAt).map(p => p.name)
                : [];

            let html = `
                <div style="background: rgba(255, 255, 255, 0.05); padding: 20px; border-radius: 8px; margin-bottom: 16px;">
                    <h3 style="margin: 0 0 16px 0; color: #00d9ff;">📊 Estado del Sistema</h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div>
                            <strong>Hora actual:</strong> ${now.toLocaleString('es-ES')}
                        </div>
                        <div>
                            <strong>Actividad activa:</strong> ${this.currentActivity ? '✅ Sí' : '❌ No'}
                        </div>
                        <div>
                            <strong>Último EventId procesado:</strong> ${this.apiService.lastEventId}
                        </div>
                        <div>
                            <strong>Eventos en API:</strong> ${events.length}
                        </div>
                        ${this.currentActivity ? `
                            <div>
                                <strong>Participantes activos:</strong> ${activeParticipantNames.length}
                            </div>
                            <div>
                                <strong>Kills pendientes:</strong> ${this.currentActivity.pendingKills.length}
                            </div>
                            <div>
                                <strong>Kills confirmadas:</strong> ${this.currentActivity.kills.length}
                            </div>
                            <div>
                                <strong>Ciudad:</strong> ${this.currentActivity.city}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;

            if (this.currentActivity) {
                html += `
                    <div style="background: rgba(255, 255, 255, 0.05); padding: 20px; border-radius: 8px; margin-bottom: 16px;">
                        <h3 style="margin: 0 0 16px 0; color: #00d9ff;">👥 Participantes Activos</h3>
                        <div style="background: rgba(0, 0, 0, 0.3); padding: 12px; border-radius: 4px; overflow-x: auto;">
                            ${activeParticipantNames.map(name => `<span style="display: inline-block; background: rgba(34, 197, 94, 0.2); padding: 4px 8px; border-radius: 4px; margin: 4px;">${name}</span>`).join('')}
                        </div>
                    </div>
                `;
            }

            if (events.length > 0) {
                const minEventId = Math.min(...events.map(e => e.EventId));
                const maxEventId = Math.max(...events.map(e => e.EventId));
                const gap = this.apiService.lastEventId > 0 && minEventId > this.apiService.lastEventId + 1
                    ? minEventId - this.apiService.lastEventId - 1
                    : 0;

                html += `
                    <div style="background: rgba(255, 255, 255, 0.05); padding: 20px; border-radius: 8px; margin-bottom: 16px;">
                        <h3 style="margin: 0 0 16px 0; color: #00d9ff;">🔍 Análisis de Eventos API</h3>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                            <div>
                                <strong>EventId más antiguo disponible:</strong> ${minEventId}
                            </div>
                            <div>
                                <strong>EventId más reciente:</strong> ${maxEventId}
                            </div>
                            <div>
                                <strong>Rango de EventIds:</strong> ${maxEventId - minEventId + 1}
                            </div>
                            <div>
                                <strong>Total eventos retornados:</strong> ${events.length}
                            </div>
                        </div>
                        ${gap > 0 ? `
                            <div style="background: rgba(239, 68, 68, 0.2); padding: 12px; border-radius: 4px; border-left: 4px solid #ef4444;">
                                <strong>⚠️ ADVERTENCIA:</strong> Hay un hueco de <strong>${gap}</strong> eventos entre el último procesado (${this.apiService.lastEventId}) y el más antiguo disponible (${minEventId}).
                                <br><strong>Posibles causas:</strong> El polling se detuvo por mucho tiempo, o hubo demasiada actividad y se superó el límite de 51 eventos.
                            </div>
                        ` : `
                            <div style="background: rgba(34, 197, 94, 0.2); padding: 12px; border-radius: 4px; border-left: 4px solid #22c55e;">
                                <strong>✅ OK:</strong> No se detectaron huecos en los EventIds. Todos los eventos están siendo procesados correctamente.
                            </div>
                        `}
                        ${events.length >= 51 ? `
                            <div style="background: rgba(245, 158, 11, 0.2); padding: 12px; border-radius: 4px; border-left: 4px solid #f59e0b; margin-top: 12px;">
                                <strong>⚠️ LÍMITE DE API ALCANZADO:</strong> La API retornó el máximo de 51 eventos por página. El sistema ahora carga múltiples páginas automáticamente si detecta huecos.
                                <br><strong>Intervalo actual:</strong> Polling cada 15 segundos para maximizar captura de eventos.
                            </div>
                        ` : ''}
                    </div>
                `;

                // Show last 10 events
                html += `
                    <div style="background: rgba(255, 255, 255, 0.05); padding: 20px; border-radius: 8px;">
                        <h3 style="margin: 0 0 16px 0; color: #00d9ff;">📋 Últimos 10 Eventos de la API</h3>
                        <div style="background: rgba(0, 0, 0, 0.3); padding: 12px; border-radius: 4px; max-height: 400px; overflow-y: auto;">
                `;

                const recentEvents = events.slice(0, 10);
                for (const event of recentEvents) {
                    const isProcessed = event.EventId <= this.apiService.lastEventId;
                    const isRelevant = this.currentActivity && activeParticipantNames.length > 0 && (
                        (event.Killer && activeParticipantNames.includes(event.Killer.Name)) ||
                        (event.Participants && event.Participants.some(p => activeParticipantNames.includes(p.Name)))
                    );

                    const statusColor = isProcessed ? '#6b7280' : (isRelevant ? '#22c55e' : '#f59e0b');
                    const statusText = isProcessed ? 'Ya procesado' : (isRelevant ? 'Relevante' : 'No relevante');
                    const statusIcon = isProcessed ? '✓' : (isRelevant ? '🎯' : '○');

                    html += `
                        <div style="background: rgba(255, 255, 255, 0.05); padding: 12px; border-radius: 4px; margin-bottom: 8px; border-left: 4px solid ${statusColor};">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                <div>
                                    <strong style="color: #00d9ff;">Event ${event.EventId}</strong>
                                    <span style="margin-left: 12px; color: ${statusColor};">${statusIcon} ${statusText}</span>
                                </div>
                                <div style="font-size: 12px; color: var(--text-secondary);">
                                    ${new Date(event.TimeStamp).toLocaleString('es-ES')}
                                </div>
                            </div>
                            <div style="font-size: 13px;">
                                <strong>Killer:</strong> ${event.Killer?.Name || 'Unknown'}
                                <span style="margin-left: 12px;"><strong>Victim:</strong> ${event.Victim?.Name || 'Unknown'}</span>
                                <br>
                                <strong>Participants:</strong> ${event.Participants?.map(p => p.Name).join(', ') || 'None'}
                            </div>
                        </div>
                    `;
                }

                html += `
                        </div>
                    </div>
                `;
            } else {
                html += `
                    <div style="background: rgba(239, 68, 68, 0.2); padding: 20px; border-radius: 8px; text-align: center;">
                        <strong>⚠️ No se pudieron obtener eventos de la API</strong>
                        <br>Verifica tu conexión a internet y que la API de Albion esté disponible.
                    </div>
                `;
            }

            diagnosticsContent.innerHTML = html;

        } catch (error) {
            diagnosticsContent.innerHTML = `
                <div style="background: rgba(239, 68, 68, 0.2); padding: 20px; border-radius: 8px;">
                    <strong>❌ Error al cargar diagnóstico:</strong>
                    <pre style="margin-top: 12px; padding: 12px; background: rgba(0, 0, 0, 0.3); border-radius: 4px; overflow-x: auto;">${error.message}</pre>
                </div>
            `;
        }
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
     * Show edit chest name modal
     */
    showEditChestNameModal() {
        if (!this.currentActivity) {
            this.uiManager.showToast('No hay actividad activa', 'warning');
            return;
        }

        const chestNameInput = document.getElementById('chestNameInput');
        if (chestNameInput) {
            chestNameInput.value = this.currentActivity.lootChest.name;
        }

        this.uiManager.showModal('editChestNameModal');
    }

    /**
     * Confirm chest name change
     */
    confirmChestName() {
        if (!this.currentActivity) return;

        const chestNameInput = document.getElementById('chestNameInput');
        const newName = chestNameInput.value.trim();

        if (!newName) {
            this.uiManager.showToast('El nombre del baúl no puede estar vacío', 'warning');
            return;
        }

        this.currentActivity.setChestName(newName);
        this.saveCurrentActivity();
        this.updateActivityUI();

        this.uiManager.closeModal('editChestNameModal');
        this.uiManager.showToast(`Baúl renombrado a "${newName}"`, 'success');
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

    /**
     * Export current activity to JSON file
     */
    exportActivityToJSON() {
        if (!this.currentActivity) {
            this.uiManager.showToast('No hay actividad activa para exportar', 'warning');
            return;
        }

        const data = {
            activity: this.currentActivity.toJSON(),
            config: this.config ? this.config.toJSON() : null,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };

        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `albion-activity-${this.currentActivity.name}-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.uiManager.showToast('Actividad exportada correctamente', 'success');
    }

    /**
     * Export all data (config + activity + history) to JSON file
     */
    exportAllData() {
        const history = StorageManager.load(StorageManager.KEYS.HISTORY) || [];

        const data = {
            config: this.config ? this.config.toJSON() : null,
            currentActivity: this.currentActivity ? this.currentActivity.toJSON() : null,
            history: history,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };

        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `albion-tracker-backup-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.uiManager.showToast('Datos exportados correctamente', 'success');
    }

    /**
     * Import data from JSON file
     */
    importDataFromJSON() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';

        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const text = await file.text();
                const data = JSON.parse(text);

                // Validate data structure
                if (!data.version) {
                    throw new Error('Archivo JSON inválido - falta versión');
                }

                // Ask user what to import
                const importAll = confirm('¿Importar TODO (configuración, actividad e historial)?\n\nCancelar = solo importar actividad actual');

                if (importAll) {
                    // Import config
                    if (data.config) {
                        this.config = new GuildConfig(data.config);
                        this.saveConfig();
                    }

                    // Import current activity
                    if (data.currentActivity) {
                        this.currentActivity = new Activity(data.currentActivity);
                        this.saveCurrentActivity();

                        // Restore lastEventId
                        if (this.currentActivity.lastEventId) {
                            this.apiService.lastEventId = this.currentActivity.lastEventId;
                        }
                    }

                    // Import history
                    if (data.history && Array.isArray(data.history)) {
                        StorageManager.save(StorageManager.KEYS.HISTORY, data.history);
                    }

                    this.uiManager.showToast('Todos los datos importados correctamente', 'success');
                } else {
                    // Import only current activity
                    if (data.activity || data.currentActivity) {
                        const activityData = data.activity || data.currentActivity;
                        this.currentActivity = new Activity(activityData);
                        this.saveCurrentActivity();

                        // Restore lastEventId
                        if (this.currentActivity.lastEventId) {
                            this.apiService.lastEventId = this.currentActivity.lastEventId;
                        }

                        this.uiManager.showToast('Actividad importada correctamente', 'success');
                    } else {
                        throw new Error('No se encontró actividad en el archivo');
                    }
                }

                // Refresh UI
                this.updateUI();

            } catch (error) {
                console.error('Error importing data:', error);
                this.uiManager.showToast(`Error al importar: ${error.message}`, 'error');
            }
        };

        input.click();
    }
}

// Initialize application
let app;

document.addEventListener('DOMContentLoaded', () => {
    app = new AlbionLootTracker();
    window.app = app; // Make accessible globally for onclick handlers
    app.init();
});
