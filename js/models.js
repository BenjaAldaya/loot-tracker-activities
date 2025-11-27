/**
 * Guild Configuration Model
 */
class GuildConfig {
    constructor(data = {}) {
        this.guildName = data.guildName || '';
        this.guildId = data.guildId || null;
        this.members = data.members || [];
    }

    addMember(name) {
        if (!this.members.find(m => m.name === name)) {
            this.members.push({
                name,
                id: null,
                firstSeen: new Date().toISOString(),
                totalKills: 0,
                totalAssists: 0,
                totalDeaths: 0
            });
        }
    }

    removeMember(name) {
        this.members = this.members.filter(m => m.name !== name);
    }

    getMember(name) {
        return this.members.find(m => m.name === name);
    }

    updateMember(name, data) {
        const member = this.getMember(name);
        if (member) {
            Object.assign(member, data);
        }
    }

    toJSON() {
        return {
            guildName: this.guildName,
            guildId: this.guildId,
            members: this.members
        };
    }
}

/**
 * Activity Model
 */
class Activity {
    constructor(data = {}) {
        this.id = data.id || `activity_${Date.now()}`;
        this.name = data.name || '';
        this.startTime = data.startTime || new Date().toISOString();
        this.endTime = data.endTime || null;
        this.status = data.status || 'active'; // 'active' | 'completed' | 'cancelled'
        this.city = data.city || 'Caerleon'; // Default city for market prices
        this.participants = data.participants || [];
        this.kills = data.kills || [];
        this.pendingKills = data.pendingKills || [];
        this.otherGuildKills = data.otherGuildKills || []; // Kills from guild members not in activity
        this.otherKillsOffset = data.otherKillsOffset || 0; // Pagination offset for loading more kills
        this.otherKillsHasMore = data.otherKillsHasMore !== false; // Whether there are more kills to load
        this.lastEventId = data.lastEventId || 0; // Track last processed event ID to prevent duplicates

        // Loot Chest System
        this.lootChest = data.lootChest || {
            name: data.lootChest?.name || 'Baúl de Botín',
            items: data.lootChest?.items || [],
            totalValue: data.lootChest?.totalValue || 0,
            city: data.lootChest?.city || data.city || 'Caerleon',
            lastPriceUpdate: data.lootChest?.lastPriceUpdate || null
        };
    }

    addParticipant(name) {
        if (!this.participants.find(p => p.name === name)) {
            this.participants.push({
                name,
                joinedAt: new Date().toISOString(),
                leftAt: null,
                isPaused: false,
                pausedAt: null,
                totalActiveTime: 0, // milliseconds
                pauseHistory: [], // [{pausedAt, resumedAt}]
                stats: {
                    kills: 0,
                    assists: 0,
                    deaths: 0,
                    damageDone: 0,
                    healingDone: 0,
                    killFame: 0
                }
            });
        }
    }

    removeParticipant(name) {
        const participant = this.getParticipant(name);
        if (participant) {
            participant.leftAt = new Date().toISOString();
            // Calculate final active time before removing
            this.updateParticipantActiveTime(participant);
        }
    }

    pauseParticipant(name) {
        const participant = this.getParticipant(name);
        if (participant && !participant.isPaused) {
            // Initialize pauseHistory if it doesn't exist
            if (!participant.pauseHistory) participant.pauseHistory = [];
            participant.isPaused = true;
            participant.pausedAt = new Date().toISOString();
        }
    }

    resumeParticipant(name) {
        const participant = this.getParticipant(name);
        if (participant && participant.isPaused) {
            // Initialize pauseHistory if it doesn't exist
            if (!participant.pauseHistory) participant.pauseHistory = [];
            const resumedAt = new Date().toISOString();
            participant.pauseHistory.push({
                pausedAt: participant.pausedAt,
                resumedAt: resumedAt
            });
            participant.isPaused = false;
            participant.pausedAt = null;
        }
    }

    updateParticipantActiveTime(participant) {
        if (!participant) return;

        // Initialize missing properties for backward compatibility
        if (!participant.pauseHistory) participant.pauseHistory = [];
        if (participant.isPaused === undefined) participant.isPaused = false;
        if (!participant.totalActiveTime) participant.totalActiveTime = 0;

        const now = new Date();
        const joinedTime = new Date(participant.joinedAt);
        const leftTime = participant.leftAt ? new Date(participant.leftAt) : now;

        // Calculate total time in activity
        let totalTime = leftTime - joinedTime;

        // Subtract paused time
        let pausedTime = 0;

        // Add completed pause periods
        participant.pauseHistory.forEach(pause => {
            const pauseStart = new Date(pause.pausedAt);
            const pauseEnd = new Date(pause.resumedAt);
            pausedTime += pauseEnd - pauseStart;
        });

        // Add current pause if active
        if (participant.isPaused && participant.pausedAt) {
            const currentPauseStart = new Date(participant.pausedAt);
            pausedTime += now - currentPauseStart;
        }

        participant.totalActiveTime = totalTime - pausedTime;
    }

    getParticipantActiveTime(name) {
        const participant = this.getParticipant(name);
        if (!participant) return 0;

        this.updateParticipantActiveTime(participant);
        return participant.totalActiveTime;
    }

    getParticipantParticipationPercentage(name) {
        const participant = this.getParticipant(name);
        if (!participant) return 0;

        const activeTime = this.getParticipantActiveTime(name);
        const activityDuration = this.getDuration();

        if (activityDuration === 0) return 0;

        return (activeTime / activityDuration) * 100;
    }

    getParticipant(name) {
        return this.participants.find(p => p.name === name);
    }

    addPendingKill(killData) {
        // Check for duplicates before adding
        const isDuplicate = this.pendingKills.some(k => k.eventId === killData.eventId);
        if (isDuplicate) {
            console.log(`[DUPLICATE PREVENTION] Skipping duplicate kill eventId: ${killData.eventId}`);
            return false;
        }

        this.pendingKills.push(killData);
        return true;
    }

    /**
     * Remove duplicate kills and kills from before activity started
     * @returns {object} Object with duplicatesCount and oldKillsCount
     */
    removeDuplicatePendingKills() {
        const uniqueKills = [];
        const seen = new Set();
        let duplicatesCount = 0;
        let oldKillsCount = 0;

        const activityStartDate = new Date(this.startTime);

        for (const kill of this.pendingKills) {
            // Check if it's a duplicate
            if (seen.has(kill.eventId)) {
                duplicatesCount++;
                console.log(`[CLEANUP] Removing duplicate kill eventId: ${kill.eventId}`);
                continue;
            }

            // Check if kill happened before activity started
            if (kill.timestamp) {
                const killDate = new Date(kill.timestamp);
                if (killDate < activityStartDate) {
                    oldKillsCount++;
                    console.log(`[CLEANUP] Removing old kill eventId: ${kill.eventId} (${kill.timestamp} < ${this.startTime})`);
                    continue;
                }
            }

            // Keep this kill
            seen.add(kill.eventId);
            uniqueKills.push(kill);
        }

        this.pendingKills = uniqueKills;
        return { duplicatesCount, oldKillsCount };
    }

    confirmKill(eventId, confirmedLoot) {
        const killIndex = this.pendingKills.findIndex(k => k.eventId === eventId);
        if (killIndex !== -1) {
            const kill = this.pendingKills[killIndex];
            kill.lootConfirmed = confirmedLoot;
            kill.status = 'confirmed';
            this.kills.push(kill);
            this.pendingKills.splice(killIndex, 1);

            // Update participant stats
            this.updateParticipantStats(kill);

            // Add confirmed loot to chest
            this.addLootToChest(confirmedLoot);
        }
    }

    addLootToChest(items) {
        if (!items || items.length === 0) return;

        items.forEach(item => {
            // Check if item already exists in chest (same type, quality, and slot)
            const existingItem = this.lootChest.items.find(chestItem =>
                chestItem.type === item.type &&
                chestItem.quality === item.quality &&
                chestItem.slot === item.slot
            );

            if (existingItem) {
                // If exists, increment count and update price if new price is available
                existingItem.count += item.count;
                if (item.price && item.price.found) {
                    existingItem.price = item.price;
                }
            } else {
                // If doesn't exist, add as new item
                this.lootChest.items.push({
                    type: item.type,
                    count: item.count,
                    quality: item.quality,
                    slot: item.slot,
                    price: item.price || null
                });
            }
        });

        // Update total value
        this.updateChestValue();
        this.lootChest.lastPriceUpdate = new Date().toISOString();
    }

    updateChestValue() {
        this.lootChest.totalValue = this.lootChest.items.reduce((total, item) => {
            const price = item.price?.sellPrice || 0;
            const count = item.count || 1;
            return total + (price * count);
        }, 0);
    }

    setChestName(name) {
        this.lootChest.name = name || 'Baúl de Botín';
    }

    getLootChestSummary() {
        return {
            name: this.lootChest.name,
            totalItems: this.lootChest.items.reduce((sum, item) => sum + item.count, 0),
            uniqueItems: this.lootChest.items.length,
            items: this.lootChest.items
        };
    }

    discardKill(eventId) {
        this.pendingKills = this.pendingKills.filter(k => k.eventId !== eventId);
    }

    updateParticipantStats(kill) {
        // Update killer stats
        const killer = this.getParticipant(kill.killer.name);
        if (killer && !killer.leftAt && !killer.isPaused) {
            killer.stats.kills++;
            killer.stats.killFame += kill.killer.killFame || 0;
        }

        // Update participants stats (including the killer)
        kill.participants.forEach(p => {
            const participant = this.getParticipant(p.name);
            if (participant && !participant.leftAt) {
                // Count as assist only if not the killer
                if (p.name !== kill.killer.name) {
                    participant.stats.assists++;
                }
                // Always add damage and healing
                participant.stats.damageDone += p.damageDone || 0;
                participant.stats.healingDone += p.healingDone || 0;
            }
        });

        // Check if victim is a participant (death counter)
        const victim = this.getParticipant(kill.victim.name);
        if (victim) {
            victim.stats.deaths++;
        }
    }

    getDuration() {
        const start = new Date(this.startTime);
        const end = this.endTime ? new Date(this.endTime) : new Date();
        return end - start;
    }

    getSummary() {
        return {
            totalKills: this.kills.length,
            totalPendingKills: this.pendingKills.length,
            totalFame: this.kills.reduce((sum, k) => sum + (k.victim.deathFame || 0), 0),
            totalLoot: this.kills.reduce((sum, k) => sum + k.lootConfirmed.length, 0),
            duration: this.getDuration()
        };
    }

    complete() {
        this.status = 'completed';
        this.endTime = new Date().toISOString();
    }

    cancel() {
        this.status = 'cancelled';
        this.endTime = new Date().toISOString();
    }

    setCity(city) {
        this.city = city;
        this.lootChest.city = city;
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            startTime: this.startTime,
            endTime: this.endTime,
            status: this.status,
            city: this.city,
            participants: this.participants,
            kills: this.kills,
            pendingKills: this.pendingKills,
            otherGuildKills: this.otherGuildKills,
            otherKillsOffset: this.otherKillsOffset,
            otherKillsHasMore: this.otherKillsHasMore,
            lastEventId: this.lastEventId,
            lootChest: this.lootChest
        };
    }
}
