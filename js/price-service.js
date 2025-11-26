/**
 * Albion Price API Service
 * Handles all price-related API calls with rate limiting and caching
 */
class AlbionPriceService {
    constructor() {
        this.apiHost = 'https://west.albion-online-data.com'; // Americas Server
        this.lastRequestTime = 0;
        this.minRequestInterval = 350; // ~180 requests per minute = 333ms, use 350ms to be safe
        this.requestQueue = [];
        this.isProcessingQueue = false;
    }

    /**
     * Wait for rate limit
     */
    async waitForRateLimit() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;

        if (timeSinceLastRequest < this.minRequestInterval) {
            const waitTime = this.minRequestInterval - timeSinceLastRequest;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        this.lastRequestTime = Date.now();
    }

    /**
     * Get current prices for items
     * @param {Array<string>} itemTypes - Array of item type IDs (e.g., ['T4_BAG', 'T5_SWORD'])
     * @param {string} city - City name (e.g., 'Caerleon')
     * @param {Array<number>} qualities - Array of quality levels (e.g., [0, 1, 2])
     * @returns {Promise<Object>} Price data
     */
    async getCurrentPrices(itemTypes, city = 'Caerleon', qualities = null) {
        if (!itemTypes || itemTypes.length === 0) {
            return [];
        }

        // Remove duplicates
        const uniqueItems = [...new Set(itemTypes)];

        // Limit to avoid URL length issues (4096 char limit)
        const maxItemsPerRequest = 100;
        const chunks = [];
        for (let i = 0; i < uniqueItems.length; i += maxItemsPerRequest) {
            chunks.push(uniqueItems.slice(i, i + maxItemsPerRequest));
        }

        const allResults = [];

        for (const chunk of chunks) {
            await this.waitForRateLimit();

            const itemsParam = chunk.join(',');
            let url = `${this.apiHost}/api/v2/stats/prices/${itemsParam}.json?locations=${city}`;

            if (qualities && qualities.length > 0) {
                url += `&qualities=${qualities.join(',')}`;
            }

            try {
                console.log(`Fetching prices for ${chunk.length} items in ${city}`);
                const response = await fetch(url, {
                    headers: {
                        'Accept-Encoding': 'gzip' // Request compression to save bandwidth
                    }
                });

                if (!response.ok) {
                    console.error(`Price API error: ${response.status}`);
                    continue;
                }

                const data = await response.json();
                allResults.push(...data);
            } catch (error) {
                console.error('Error fetching prices:', error);
            }
        }

        return allResults;
    }

    /**
     * Get price for a single item with fallback to other cities
     * @param {string} itemType - Item type ID
     * @param {number} quality - Item quality (0-5)
     * @param {string} primaryCity - Primary city to check
     * @returns {Promise<Object>} Price info with city
     */
    async getItemPrice(itemType, quality = 0, primaryCity = 'Caerleon') {
        const fallbackCities = ['Caerleon', 'Bridgewatch', 'Lymhurst', 'Martlock', 'Thetford', 'Fort Sterling'];

        // Try primary city first
        let priceData = await this.getCurrentPrices([itemType], primaryCity, [quality]);

        if (priceData && priceData.length > 0 && priceData[0].sell_price_min > 0) {
            return {
                itemType,
                quality,
                city: primaryCity,
                sellPrice: priceData[0].sell_price_min,
                buyPrice: priceData[0].buy_price_max,
                lastUpdate: new Date().toISOString(),
                found: true
            };
        }

        // Try fallback cities
        for (const city of fallbackCities) {
            if (city === primaryCity) continue;

            priceData = await this.getCurrentPrices([itemType], city, [quality]);

            if (priceData && priceData.length > 0 && priceData[0].sell_price_min > 0) {
                return {
                    itemType,
                    quality,
                    city,
                    sellPrice: priceData[0].sell_price_min,
                    buyPrice: priceData[0].buy_price_max,
                    lastUpdate: new Date().toISOString(),
                    found: true,
                    fallback: true
                };
            }
        }

        // No price found
        return {
            itemType,
            quality,
            city: primaryCity,
            sellPrice: 0,
            buyPrice: 0,
            lastUpdate: new Date().toISOString(),
            found: false
        };
    }

    /**
     * Get prices for multiple items efficiently
     * Groups items by quality to minimize API calls
     * @param {Array<Object>} items - Array of items with {type, quality, count}
     * @param {string} city - City to check prices
     * @returns {Promise<Map>} Map of itemKey -> priceInfo
     */
    async getItemsPrices(items, city = 'Caerleon') {
        const priceMap = new Map();

        if (!items || items.length === 0) {
            return priceMap;
        }

        // Group items by quality for efficient API calls
        const qualityGroups = new Map();

        items.forEach(item => {
            const quality = item.quality || 0;
            if (!qualityGroups.has(quality)) {
                qualityGroups.set(quality, new Set());
            }
            qualityGroups.get(quality).add(item.type);
        });

        // Fetch prices for each quality group
        for (const [quality, itemTypes] of qualityGroups) {
            const itemTypesArray = Array.from(itemTypes);
            const priceData = await this.getCurrentPrices(itemTypesArray, city, [quality]);

            // Map results
            priceData.forEach(price => {
                const key = `${price.item_id}_${price.quality}`;
                priceMap.set(key, {
                    itemType: price.item_id,
                    quality: price.quality,
                    city: price.city,
                    sellPrice: price.sell_price_min || 0,
                    buyPrice: price.buy_price_max || 0,
                    lastUpdate: new Date().toISOString(),
                    found: price.sell_price_min > 0
                });
            });
        }

        return priceMap;
    }

    /**
     * Calculate total value of items
     * @param {Array<Object>} items - Array of items with {type, quality, count, price}
     * @returns {number} Total value
     */
    calculateTotalValue(items) {
        return items.reduce((total, item) => {
            const price = item.price?.sellPrice || 0;
            const count = item.count || 1;
            return total + (price * count);
        }, 0);
    }

    /**
     * Format price with K/M/B suffix
     * @param {number} value - Price value
     * @returns {string} Formatted price
     */
    formatPrice(value) {
        if (value >= 1000000000) {
            return (value / 1000000000).toFixed(2) + 'B';
        }
        if (value >= 1000000) {
            return (value / 1000000).toFixed(2) + 'M';
        }
        if (value >= 1000) {
            return (value / 1000).toFixed(1) + 'K';
        }
        return value.toString();
    }
}
