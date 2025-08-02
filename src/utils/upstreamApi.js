// src/utils/upstreamApi.js
const axios = require('axios');
const dotenv = require('dotenv');
const db = require('./db'); // Import the database connection

dotenv.config();

const { CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID, SECOND_LEVEL_DOMAIN } = process.env;

if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ZONE_ID || !SECOND_LEVEL_DOMAIN) {
    throw new Error('Missing required environment variables for Cloudflare API or domain configuration.');
}

let FIXED_ENDPOINTS = [];

const getFixedEndpointsFromDb = () => {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM fixed_endpoints ORDER BY id ASC", (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
};

// Initialize fixed endpoints on startup
(async () => {
    try {
        FIXED_ENDPOINTS = await getFixedEndpointsFromDb();
        if (FIXED_ENDPOINTS.length === 0) {
            console.warn("No fixed endpoints found in the database. Please ensure migration from .env has run or add them manually.");
        }
    } catch (error) {
        console.error("Failed to load fixed endpoints from database:", error.message);
        // Depending on criticality, you might want to throw an error here or use a fallback
    }
})();

const ZONE_NAME = SECOND_LEVEL_DOMAIN;

const cloudflareApi = axios.create({
    baseURL: 'https://api.cloudflare.com/client/v4',
    headers: {
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
    },
});

const getRecordName = (fullDomain) => {
    if (fullDomain.endsWith(`.${ZONE_NAME}`)) {
        return fullDomain.slice(0, -ZONE_NAME.length - 1);
    }
    return fullDomain; 
};

const createSrvRecord = async (recordName, portIndex = 0, port) => {
    if (portIndex < 0 || portIndex >= FIXED_ENDPOINTS.length) {
        throw new Error(`Invalid port index: ${portIndex}. Must be between 0 and ${FIXED_ENDPOINTS.length - 1}.`);
    }

    const srvName = `_minecraft._tcp.${recordName}`;
    const srvTarget = `${recordName}.${ZONE_NAME}`;
    const srvData = {
        service: "_minecraft",
        proto: "_tcp",
        name: recordName,
        priority: 0,
        weight: 5,
        port: port,
        target: `${srvTarget}.`
    };

    try {
        const response = await cloudflareApi.post(`/zones/${CLOUDFLARE_ZONE_ID}/dns_records`, {
            type: 'SRV',
            name: srvName,
            data: srvData,
            ttl: 1,
            proxied: false,
        });

        if (!response.data.success) {
            throw new Error(response.data.errors.map((e) => e.message).join(', '));
        }
        return response.data.result;
    } catch (error) {
        const errMsg = error.response 
            ? error.response.data.errors.map((e) => e.message).join(', ') 
            : error.message;
        throw new Error(`Failed to create SRV record: ${errMsg}`);
    }
};

const deleteSrvRecord = async (existingRecord) => {
    const response = await cloudflareApi.delete(`/zones/${CLOUDFLARE_ZONE_ID}/dns_records/${existingRecord.id}`);

    if (!response.data.success) {
        throw new Error(response.data.errors.map((e) => e.message).join(', '));
    }
};

const fetchDnsRecords = async () => {
    const response = await cloudflareApi.get(`/zones/${CLOUDFLARE_ZONE_ID}/dns_records?per_page=1000`);
    if (!response.data.success) {
        throw new Error(response.data.errors.map((e) => e.message).join(', '));
    }
    return response.data.result;
};

const findDnsRecord = async (fullDomain, type = 'A') => {
    const records = await fetchDnsRecords();
    return records.find((record) => {
        if (type !== record.type) return false;
        if (type === 'SRV') return record?.data?.target === `${fullDomain}`;
        return record.name === fullDomain;
    }) || null;
};

module.exports = {
    fetchAllDnsRecords: fetchDnsRecords,

    createSubdomain: async function (fullDomain, targetIp, ipPortIndex = 2, serverPort) {
        // if (ipPortIndex < 0 || ipPortIndex >= FIXED_ENDPOINTS.length) {
        //     throw new Error(`Invalid IP/Port index: ${ipPortIndex}. Must be between 0 and ${FIXED_ENDPOINTS.length - 1}.`);
        // }
        
        let ip = null;
        let port = null;
        FIXED_ENDPOINTS.forEach((endpoint) => {
            console.log(endpoint.id)
            console.log(ipPortIndex)

            if (endpoint.id !== ipPortIndex) return;
            if (ipPortIndex < 0) port = serverPort;
            else port = endpoint.port;

            ip = endpoint.ip;
            console.log(`Using fixed endpoint: ${endpoint.ip}:${endpoint.port}`);
        });

        

        if (!ip) throw new Error(`Invalid IP/Port index: ${ipPortIndex}.`);
        if (!port) throw new Error(`Invalid port for index: ${ipPortIndex}.`);

        const existingARecord = await findDnsRecord(fullDomain, 'A');
        if (existingARecord) throw new Error(`Subdomain ${fullDomain} already exists.`);

        const recordName = getRecordName(fullDomain);
        const ipToUse = ip
        // TODO: check use direct or fixed endpoint by database

        const aRecordResponse = await cloudflareApi.post(`/zones/${CLOUDFLARE_ZONE_ID}/dns_records`, {
            type: 'A',
            name: recordName,
            content: ipToUse,
            ttl: 1,
            proxied: false,
        });

        if (!aRecordResponse.data.success) {
            throw new Error(aRecordResponse.data.errors.map((e) => e.message).join(', '));
        }

        const createdARecord = aRecordResponse.data.result;
        const createdSrvRecord = await createSrvRecord(recordName, ipPortIndex, port);
        return { aRecord: createdARecord, srvRecord: createdSrvRecord };
    },

    updateSubdomain: async function (fullDomain, newFullDomain, targetIp, ipPortIndex = 0, serverPort) {
        // When updating, we delete the old records first.
        await this.deleteSubdomain(fullDomain);

        // Then create new records with potentially new IP/Port from the selected index
        const creationResult = await this.createSubdomain(newFullDomain, targetIp, ipPortIndex, serverPort);
        const updatedARecord = creationResult?.aRecord;

        let updatedSrvRecord = await findDnsRecord(newFullDomain, 'SRV');


        if (!updatedSrvRecord) {
            updatedSrvRecord = await createSrvRecord(getRecordName(newFullDomain), ipPortIndex);
        }

        return { aRecord: updatedARecord, srvRecord: updatedSrvRecord };
    },

    deleteSubdomain: async function (fullDomain) {
        const isMcSubdomain = fullDomain.startsWith('mc');

        const existingARecord = await findDnsRecord(fullDomain, 'A');
        if (!existingARecord) throw new Error(`Subdomain ${fullDomain} does not exist.`);

        const aRecordResponse = await cloudflareApi.delete(`/zones/${CLOUDFLARE_ZONE_ID}/dns_records/${existingARecord.id}`);
        if (!aRecordResponse.data.success) {
            throw new Error(aRecordResponse.data.errors.map((e) => e.message).join(', '));
        }

        if (!isMcSubdomain) return;

        const existingSrvRecord = await findDnsRecord(fullDomain, 'SRV');
        if (existingSrvRecord) await deleteSrvRecord(existingSrvRecord);
    },

    getFixedEndpoints: function () {
        return FIXED_ENDPOINTS.map((endpoint) => {
            console.log(endpoint);

            console.log({
                ...endpoint,
                index: endpoint.id
            });
            return {
                ...endpoint,
                index: endpoint.id
            }
        });
    },


};
