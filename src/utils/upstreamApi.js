// src/utils/upstreamApi.js
// This module interfaces with Cloudflare's API to manage subdomains

const axios = require('axios');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

// Destructure required environment variables
const {
    CLOUDFLARE_API_TOKEN,
    CLOUDFLARE_ZONE_ID,
    CLOUDFLARE_SRV_SERVICE,
    CLOUDFLARE_SRV_PROTOCOL,
    CLOUDFLARE_SRV_PRIORITY,
    CLOUDFLARE_SRV_WEIGHT,
    CLOUDFLARE_SRV_TARGET,
    CLOUDFLARE_A_RECORD_IP,
} = process.env;

// Validate environment variables
if (
    !CLOUDFLARE_API_TOKEN ||
    !CLOUDFLARE_ZONE_ID ||
    !CLOUDFLARE_SRV_SERVICE ||
    !CLOUDFLARE_SRV_PROTOCOL ||
    !CLOUDFLARE_SRV_PRIORITY ||
    !CLOUDFLARE_SRV_WEIGHT ||
    !CLOUDFLARE_SRV_TARGET ||
    !CLOUDFLARE_A_RECORD_IP
) {
    throw new Error(
        'Missing required environment variables: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID, CLOUDFLARE_SRV_SERVICE, CLOUDFLARE_SRV_PROTOCOL, CLOUDFLARE_SRV_PRIORITY, CLOUDFLARE_SRV_WEIGHT, CLOUDFLARE_SRV_TARGET, CLOUDFLARE_A_RECORD_IP'
    );
}

// Create an Axios instance with Cloudflare API base URL and headers
const cloudflareApi = axios.create({
    baseURL: 'https://api.cloudflare.com/client/v4',
    headers: {
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
    },
});

/**
 * Helper function to determine if the domain starts with 'mc'
 * @param {string} fullDomain - The full domain name (e.g., mc.example.com)
 * @returns {boolean} - True if domain starts with 'mc.', else false
 */
const isMcSubdomain = (fullDomain) => {
    const subdomain = fullDomain.split('.')[0];
    return subdomain.startsWith('mc');
};

/**
 * Helper function to extract the record name relative to the zone.
 * @param {string} fullDomain - The full domain name (e.g., sub.mcstw.top or mc.mcstw.top)
 * @returns {string} - The record name relative to the zone
 */
const getRecordName = (fullDomain) => {
    const zone = 'mcstw.top'; // 固定區域名稱

    if (fullDomain.endsWith(zone)) {
        const subdomain = fullDomain.slice(0, -zone.length - 1); // 移除區域名稱和點
        return subdomain;
    }

    return fullDomain; // If not matching, return as is
};

/**
 * Fetch DNS records for the specified zone and return them
 * @returns {Promise<Object[]>} - Array of DNS records
 */
const fetchDnsRecords = async () => {
    try {
        const response = await cloudflareApi.get(`/zones/${CLOUDFLARE_ZONE_ID}/dns_records`);
        if (response.data.success) {
            return response.data.result;
        }
        throw new Error(response.data.errors.map((e) => e.message).join(', '));
    } catch (error) {
        throw new Error(`Failed to fetch DNS records: ${error.message}`);
    }
};

/**
 * Find DNS record by full domain name and type
 * @param {string} fullDomain - The full domain name (e.g., mc.mcstw.top)
 * @param {string} type - DNS record type ('SRV' or 'A')
 * @returns {Promise<Object|null>} - DNS record object or null if not found
 */
const findDnsRecord = async (fullDomain, type) => {
    const records = await fetchDnsRecords();
    const recordName = getRecordName(fullDomain);
    return records.find((record) => record.name === recordName && record.type === type) || null;
};

module.exports = {
    /**
     * Create a new subdomain by adding a DNS SRV or A record based on the subdomain prefix
     * @param {string} fullDomain - The full domain name to create (e.g., mc.mcstw.top or sub.mcstw.top)
     * @param {number} targetPort - The target port (used for SRV records)
     * @returns {Promise<Object>} - The created DNS record
     */
    createSubdomain: async (fullDomain, targetPort) => {
        try {
            if (isMcSubdomain(fullDomain)) {
                // Handle SRV record for 'mc' subdomains
                const existingRecord = await findDnsRecord(fullDomain, 'SRV');
                if (existingRecord) {
                    throw new Error(`Subdomain ${fullDomain} already exists as SRV record.`);
                }

                const recordName = `${CLOUDFLARE_SRV_SERVICE}.${CLOUDFLARE_SRV_PROTOCOL}.${getRecordName(fullDomain)}`;

                // Create DNS SRV record
                const response = await cloudflareApi.post(`/zones/${CLOUDFLARE_ZONE_ID}/dns_records`, {
                    type: 'SRV',
                    name: recordName,
                    data: {
                        priority: parseInt(CLOUDFLARE_SRV_PRIORITY, 10),
                        weight: parseInt(CLOUDFLARE_SRV_WEIGHT, 10),
                        port: targetPort,
                        target: CLOUDFLARE_SRV_TARGET,
                    },
                    ttl: 1, // Auto TTL
                    proxied: false,
                });

                if (response.data.success) {
                    return response.data.result;
                }
                throw new Error(response.data.errors.map((e) => e.message).join(', '));
            } else {
                // Handle A record for other subdomains
                const existingRecord = await findDnsRecord(fullDomain, 'A');
                if (existingRecord) {
                    throw new Error(`Subdomain ${fullDomain} already exists as A record.`);
                }

                const recordName = getRecordName(fullDomain);

                // Create DNS A record
                const response = await cloudflareApi.post(`/zones/${CLOUDFLARE_ZONE_ID}/dns_records`, {
                    type: 'A',
                    name: recordName,
                    content: CLOUDFLARE_A_RECORD_IP,
                    ttl: 1, // Auto TTL
                    proxied: false,
                });

                if (response.data.success) {
                    return response.data.result;
                }
                throw new Error(response.data.errors.map((e) => e.message).join(', '));
            }
        } catch (error) {
            throw new Error(`Failed to create subdomain: ${error.message}`);
        }
    },

    /**
     * Update an existing subdomain's IP address or port based on the subdomain prefix
     * @param {string} fullDomain - The full domain name to update (e.g., mc.mcstw.top or sub.mcstw.top)
     * @param {number} targetPort - The new target port (used for SRV records)
     * @returns {Promise<Object>} - The updated DNS record
     */
    updateSubdomain: async (fullDomain, targetPort) => {
        try {
            if (isMcSubdomain(fullDomain)) {
                // Handle SRV record for 'mc' subdomains
                const existingRecord = await findDnsRecord(fullDomain, 'SRV');
                if (!existingRecord) {
                    throw new Error(`Subdomain ${fullDomain} does not exist as SRV record.`);
                }

                const recordName = `${CLOUDFLARE_SRV_SERVICE}.${CLOUDFLARE_SRV_PROTOCOL}.${getRecordName(fullDomain)}`;

                // Update DNS SRV record
                const response = await cloudflareApi.put(
                    `/zones/${CLOUDFLARE_ZONE_ID}/dns_records/${existingRecord.id}`,
                    {
                        type: 'SRV',
                        name: recordName,
                        data: {
                            priority: existingRecord.data.priority, // Keep existing priority
                            weight: existingRecord.data.weight, // Keep existing weight
                            port: targetPort, // Update port
                            target: CLOUDFLARE_SRV_TARGET, // Keep existing target
                        },
                        ttl: existingRecord.ttl,
                        proxied: existingRecord.proxied,
                    }
                );

                if (response.data.success) {
                    return response.data.result;
                }
                throw new Error(response.data.errors.map((e) => e.message).join(', '));
            } else {
                // Handle A record for other subdomains
                const existingRecord = await findDnsRecord(fullDomain, 'A');
                if (!existingRecord) {
                    throw new Error(`Subdomain ${fullDomain} does not exist as A record.`);
                }

                const recordName = getRecordName(fullDomain);

                // Update DNS A record
                const response = await cloudflareApi.put(
                    `/zones/${CLOUDFLARE_ZONE_ID}/dns_records/${existingRecord.id}`,
                    {
                        type: 'A',
                        name: recordName,
                        content: CLOUDFLARE_A_RECORD_IP,
                        ttl: existingRecord.ttl,
                        proxied: existingRecord.proxied,
                    }
                );

                if (response.data.success) {
                    return response.data.result;
                }
                throw new Error(response.data.errors.map((e) => e.message).join(', '));
            }
        } catch (error) {
            throw new Error(`Failed to update subdomain: ${error.message}`);
        }
    },

    /**
     * Delete an existing subdomain by removing its DNS SRV or A record based on the subdomain prefix
     * @param {string} fullDomain - The full domain name to delete (e.g., mc.mcstw.top or sub.mcstw.top)
     * @returns {Promise<void>}
     */
    deleteSubdomain: async (fullDomain) => {
        try {
            if (isMcSubdomain(fullDomain)) {
                // Handle SRV record for 'mc' subdomains
                const existingRecord = await findDnsRecord(fullDomain, 'SRV');
                if (!existingRecord) {
                    throw new Error(`Subdomain ${fullDomain} does not exist as SRV record.`);
                }

                // Delete DNS SRV record
                const response = await cloudflareApi.delete(
                    `/zones/${CLOUDFLARE_ZONE_ID}/dns_records/${existingRecord.id}`
                );

                if (response.data.success) {
                    return;
                }
                throw new Error(response.data.errors.map((e) => e.message).join(', '));
            } else {
                // Handle A record for other subdomains
                const existingRecord = await findDnsRecord(fullDomain, 'A');
                if (!existingRecord) {
                    throw new Error(`Subdomain ${fullDomain} does not exist as A record.`);
                }

                // Delete DNS A record
                const response = await cloudflareApi.delete(
                    `/zones/${CLOUDFLARE_ZONE_ID}/dns_records/${existingRecord.id}`
                );

                if (response.data.success) {
                    return;
                }
                throw new Error(response.data.errors.map((e) => e.message).join(', '));
            }
        } catch (error) {
            throw new Error(`Failed to delete subdomain: ${error.message}`);
        }
    },
};
