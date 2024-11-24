// src/utils/upstreamApi.js
// This module interfaces with Cloudflare's API to manage subdomains

const axios = require('axios');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

// Destructure required environment variables
const { CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID, FIXED_IP, FIXED_PORT, SECOND_LEVEL_DOMAIN } = process.env;

// Validate environment variables
if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ZONE_ID || !FIXED_IP || !FIXED_PORT || !SECOND_LEVEL_DOMAIN) {
    throw new Error('Missing required environment variables: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID, FIXED_IP, FIXED_PORT, and SECOND_LEVEL_DOMAIN');
}

// Define the zone name
const ZONE_NAME = SECOND_LEVEL_DOMAIN;

// Create an Axios instance with Cloudflare API base URL and headers
const cloudflareApi = axios.create({
    baseURL: 'https://api.cloudflare.com/client/v4',
    headers: {
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
    },
});

/**
 * Helper function to extract the record name relative to the zone.
 * @param {string} fullDomain - The full domain name (e.g., mc0001.mcstw.top)
 * @returns {string} - The record name relative to the zone (e.g., mc0001)
 */
const getRecordName = (fullDomain) => {
    if (fullDomain.endsWith(`.${ZONE_NAME}`)) {
        return fullDomain.slice(0, -ZONE_NAME.length - 1); // Remove the zone and the dot
    }
    return fullDomain; // If not matching, return as is
};

/**
 * Helper function to create an SRV record for Minecraft
 * @param {string} recordName - The subdomain name (e.g., mc0001)
 * @returns {Promise<Object>} - The created SRV record
 */
const createSrvRecord = async (recordName) => {
    const srvName = `_minecraft._tcp.${recordName}`;
    const srvTarget = `${recordName}.${ZONE_NAME}`; // e.g., mc0001.mcstw.top
    const srvData = {
        service: "_minecraft",
        proto: "_tcp",
        name: recordName,
        priority: 0,
        weight: 5,
        port: parseInt(FIXED_PORT, 10),
        target: `${srvTarget}.` // 添加尾部的點
    };

    try {
        const response = await cloudflareApi.post(`/zones/${CLOUDFLARE_ZONE_ID}/dns_records`, {
            type: 'SRV',
            name: srvName,
            data: srvData,
            ttl: 1, // Auto
            proxied: false,
        });

        if (!response.data.success) {
            throw new Error(response.data.errors.map((e) => e.message).join(', '));
        }
        return response.data.result;
    } catch (error) {
        if (error.response) {
            const errorMessage = error.response.data.errors.map((e) => e.message).join(', ');
            console.error(`Cloudflare API Error: ${errorMessage}`);
            throw new Error(`Failed to create SRV record: ${errorMessage}`);
        } else {
            console.error(`Error: ${error.message}`);
            throw new Error(`Failed to create SRV record: ${error.message}`);
        }
    }
};



/**
 * Helper function to update an SRV record for Minecraft
 * @param {Object} existingRecord - The existing SRV record object
 * @returns {Promise<Object>} - The updated SRV record
 */
const updateSrvRecord = async (existingRecord) => {
    const srvName = existingRecord.name; // Should be _minecraft._tcp.mc0001
    const contentParts = existingRecord.content.split(' ');
    if (contentParts.length < 4) {
        throw new Error(`Invalid SRV record content: ${existingRecord.content}`);
    }
    const target = contentParts[3];
    const srvContent = `0 5 ${FIXED_PORT} ${target}`;

    try {
        const response = await cloudflareApi.put(`/zones/${CLOUDFLARE_ZONE_ID}/dns_records/${existingRecord.id}`, {
            type: 'SRV',
            name: srvName,
            content: srvContent,
            ttl: existingRecord.ttl,
            proxied: existingRecord.proxied,
        });

        if (!response.data.success) {
            throw new Error(response.data.errors.map((e) => e.message).join(', '));
        }
        return response.data.result;
    } catch (error) {
        throw new Error(`Failed to update SRV record: ${error.message}`);
    }
};

/**
 * Helper function to delete an SRV record
 * @param {Object} existingRecord - The existing SRV record object
 * @returns {Promise<void>}
 */
const deleteSrvRecord = async (existingRecord) => {
    try {
        const response = await cloudflareApi.delete(`/zones/${CLOUDFLARE_ZONE_ID}/dns_records/${existingRecord.id}`);

        if (!response.data.success) {
            throw new Error(response.data.errors.map((e) => e.message).join(', '));
        }
    } catch (error) {
        throw new Error(`Failed to delete SRV record: ${error.message}`);
    }
};

/**
 * Fetch DNS records for the specified zone and return them
 * @returns {Promise<Object[]>} - Array of DNS records
 */
const fetchDnsRecords = async () => {
    try {
        const response = await cloudflareApi.get(`/zones/${CLOUDFLARE_ZONE_ID}/dns_records`);
        if (!response.data.success) {
            throw new Error(response.data.errors.map((e) => e.message).join(', '));
        }
        return response.data.result;
    } catch (error) {
        throw new Error(`Failed to fetch DNS records: ${error.message}`);
    }
};

/**
 * Find DNS record by full domain name
 * @param {string} fullDomain - The full domain name (e.g., mc0001.mcstw.top)
 * @param {string} type - The DNS record type ('A' or 'SRV')
 * @returns {Promise<Object|null>} - DNS record object or null if not found
 */
const findDnsRecord = async (fullDomain, type = 'A') => {
    const records = await fetchDnsRecords();
    console.log(records);
    console.log(fullDomain);
    return records.find((record) => {
        if (record.type === 'SRV') {
            return record.data.target === `${fullDomain}.`;
        }
        return record.name === fullDomain;
    }) || null;
};

/**
 * Find SRV DNS record by full domain name
 * @param {string} fullDomain - The full domain name (e.g., mc0001.mcstw.top)
 * @returns {Promise<Object|null>} - SRV DNS record object or null if not found
 */
const findSrvRecord = async (fullDomain) => {
    const recordName = getRecordName(fullDomain);
    const srvName = `_minecraft._tcp.${recordName}`;
    const records = await fetchDnsRecords();
    return records.find((record) => record.name === srvName && record.type === 'SRV') || null;
};

module.exports = {
    /**
     * Create a new subdomain by adding a DNS A record
     * If the subdomain starts with 'mc', it points to FIXED_IP and creates an SRV record
     * @param {string} fullDomain - The full domain name to create (e.g., mc0001.mcstw.top)
     * @param {string} targetIp - The target IP address (ignored if domain starts with 'mc')
     * @returns {Promise<Object>} - The created DNS record(s)
     */
    createSubdomain: async (fullDomain, targetIp) => {
        try {
            const isMcSubdomain = fullDomain.startsWith('mc');

            // Check if the subdomain already exists
            const existingARecord = await findDnsRecord(fullDomain, 'A');
            if (existingARecord) {
                throw new Error(`Subdomain ${fullDomain} already exists.`);
            }

            const recordName = getRecordName(fullDomain);
            const ipToUse = isMcSubdomain ? FIXED_IP : targetIp;

            // Create DNS A record
            const aRecordResponse = await cloudflareApi.post(`/zones/${CLOUDFLARE_ZONE_ID}/dns_records`, {
                type: 'A',
                name: recordName,
                content: ipToUse,
                ttl: 1, // Auto
                proxied: false,
            });

            if (!aRecordResponse.data.success) {
                throw new Error(aRecordResponse.data.errors.map((e) => e.message).join(', '));
            }

            const createdARecord = aRecordResponse.data.result;

            if (!isMcSubdomain) {
                return { aRecord: createdARecord, srvRecord: null };
            }

            const createdSrvRecord = await createSrvRecord(recordName);
            return { aRecord: createdARecord, srvRecord: createdSrvRecord };
        } catch (error) {
            throw new Error(`Failed to create subdomain: ${error.message}`);
        }
    },

    /**
     * Update an existing subdomain's IP address
     * If the subdomain starts with 'mc', it updates to FIXED_IP and updates the SRV record
     * @param {string} fullDomain - The full domain name to update (e.g., mc0001.mcstw.top)
     * @param {string} targetIp - The new target IP address (ignored if domain starts with 'mc')
     * @returns {Promise<Object>} - The updated DNS record(s)
     */
    updateSubdomain: async (fullDomain, targetIp) => {
        try {
            const isMcSubdomain = fullDomain.startsWith('mc');

            // Find existing DNS A record
            const existingARecord = await findDnsRecord(fullDomain, 'A');
            if (!existingARecord) {
                throw new Error(`Subdomain ${fullDomain} does not exist.`);
            }

            const recordName = getRecordName(fullDomain);
            const ipToUse = isMcSubdomain ? FIXED_IP : targetIp;

            // Update DNS A record
            const aRecordResponse = await cloudflareApi.put(
                `/zones/${CLOUDFLARE_ZONE_ID}/dns_records/${existingARecord.id}`,
                {
                    type: 'A',
                    name: recordName,
                    content: ipToUse,
                    ttl: existingARecord.ttl,
                    proxied: existingARecord.proxied,
                }
            );

            if (!aRecordResponse.data.success) {
                throw new Error(aRecordResponse.data.errors.map((e) => e.message).join(', '));
            }

            const updatedARecord = aRecordResponse.data.result;

            if (!isMcSubdomain) {
                return { aRecord: updatedARecord, srvRecord: null };
            }

            const existingSrvRecord = await findSrvRecord(fullDomain);
            const updatedSrvRecord = existingSrvRecord
                ? await updateSrvRecord(existingSrvRecord)
                : await createSrvRecord(recordName);

            return { aRecord: updatedARecord, srvRecord: updatedSrvRecord };
        } catch (error) {
            throw new Error(`Failed to update subdomain: ${error.message}`);
        }
    },

    /**
     * Delete an existing subdomain by removing its DNS records
     * If the subdomain starts with 'mc', it deletes both A and SRV records
     * @param {string} fullDomain - The full domain name to delete (e.g., mc0001.mcstw.top)
     * @returns {Promise<void>}
     */
    deleteSubdomain: async (fullDomain) => {
        try {
            const isMcSubdomain = fullDomain.startsWith('mc');

            // Find existing DNS A record
            const existingARecord = await findDnsRecord(fullDomain, 'A');
            if (!existingARecord) {
                throw new Error(`Subdomain ${fullDomain} does not exist.`);
            }

            // Delete DNS A record
            const aRecordResponse = await cloudflareApi.delete(`/zones/${CLOUDFLARE_ZONE_ID}/dns_records/${existingARecord.id}`);

            if (!aRecordResponse.data.success) {
                throw new Error(aRecordResponse.data.errors.map((e) => e.message).join(', '));
            }

            if (!isMcSubdomain) {
                return;
            }

            const existingSrvRecord = await findSrvRecord(fullDomain);
            if (existingSrvRecord) {
                await deleteSrvRecord(existingSrvRecord);
            }
        } catch (error) {
            throw new Error(`Failed to delete subdomain: ${error.message}`);
        }
    },
};
