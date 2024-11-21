// src/utils/upstreamApi.js
// This module interfaces with Cloudflare's API to manage subdomains

const axios = require('axios');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

// Destructure required environment variables
const { CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID } = process.env;

// Validate environment variables
if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ZONE_ID) {
    throw new Error('Missing required environment variables: CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID');
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
 * Helper function to extract the record name relative to the zone.
 * @param {string} fullDomain - The full domain name (e.g., sub.example.com)
 * @returns {string} - The record name relative to the zone (e.g., sub)
 */
const getRecordName = (fullDomain) => {
    // Assuming the zone is example.com
    // Extract the subdomain part
    const zone = 'mcstw.top'; // You might want to dynamically get this based on CLOUDFLARE_ZONE_ID
    if (fullDomain.endsWith(zone)) {
        return fullDomain.slice(0, -zone.length - 1); // Remove the zone and the dot
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
 * Find DNS record by full domain name
 * @param {string} fullDomain - The full domain name (e.g., sub.example.com)
 * @returns {Promise<Object|null>} - DNS record object or null if not found
 */
const findDnsRecord = async (fullDomain) => {
    const records = await fetchDnsRecords();
    const recordName = getRecordName(fullDomain);
    return records.find((record) => record.name === recordName) || null;
};

module.exports = {
    /**
     * Create a new subdomain by adding a DNS A record
     * @param {string} fullDomain - The full domain name to create (e.g., sub.example.com)
     * @param {string} targetIp - The target IP address
     * @returns {Promise<Object>} - The created DNS record
     */
    createSubdomain: async (fullDomain, targetIp) => {
        try {
            // Check if the subdomain already exists
            const existingRecord = await findDnsRecord(fullDomain);
            if (existingRecord) {
                throw new Error(`Subdomain ${fullDomain} already exists.`);
            }

            const recordName = getRecordName(fullDomain);

            // Create DNS A record
            const response = await cloudflareApi.post(`/zones/${CLOUDFLARE_ZONE_ID}/dns_records`, {
                type: 'A',
                name: recordName,
                content: targetIp,
                ttl: 1, // Auto
                proxied: false,
            });

            if (response.data.success) {
                return response.data.result;
            }
            throw new Error(response.data.errors.map((e) => e.message).join(', '));
        } catch (error) {
            throw new Error(`Failed to create subdomain: ${error.message}`);
        }
    },

    /**
     * Update an existing subdomain's IP address
     * @param {string} fullDomain - The full domain name to update (e.g., sub.example.com)
     * @param {string} targetIp - The new target IP address
     * @returns {Promise<Object>} - The updated DNS record
     */
    updateSubdomain: async (fullDomain, targetIp) => {
        try {
            // Find existing DNS record
            const existingRecord = await findDnsRecord(fullDomain);
            if (!existingRecord) {
                throw new Error(`Subdomain ${fullDomain} does not exist.`);
            }

            // Update DNS A record
            const response = await cloudflareApi.put(
                `/zones/${CLOUDFLARE_ZONE_ID}/dns_records/${existingRecord.id}`,
                {
                    type: 'A',
                    name: getRecordName(fullDomain),
                    content: targetIp,
                    ttl: existingRecord.ttl,
                    proxied: existingRecord.proxied,
                }
            );

            if (response.data.success) {
                return response.data.result;
            }
            throw new Error(response.data.errors.map((e) => e.message).join(', '));
        } catch (error) {
            throw new Error(`Failed to update subdomain: ${error.message}`);
        }
    },

    /**
     * Delete an existing subdomain by removing its DNS record
     * @param {string} fullDomain - The full domain name to delete (e.g., sub.example.com)
     * @returns {Promise<void>}
     */
    deleteSubdomain: async (fullDomain) => {
        try {
            // Find existing DNS record
            const existingRecord = await findDnsRecord(fullDomain);
            if (!existingRecord) {
                throw new Error(`Subdomain ${fullDomain} does not exist.`);
            }

            // Delete DNS A record
            const response = await cloudflareApi.delete(
                `/zones/${CLOUDFLARE_ZONE_ID}/dns_records/${existingRecord.id}`
            );

            if (response.data.success) {
                return;
            }
            throw new Error(response.data.errors.map((e) => e.message).join(', '));
        } catch (error) {
            throw new Error(`Failed to delete subdomain: ${error.message}`);
        }
    },
};
