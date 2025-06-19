// src/utils/upstreamApi.js
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const { CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID, FIXED_IP: FIXED_IP_STRING, FIXED_PORT: FIXED_PORT_STRING, SECOND_LEVEL_DOMAIN } = process.env;

if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ZONE_ID || !FIXED_IP_STRING || !FIXED_PORT_STRING || !SECOND_LEVEL_DOMAIN) {
    throw new Error('Missing required environment variables for Cloudflare API or domain configuration.');
}

const FIXED_IPS = FIXED_IP_STRING.split(',');
const FIXED_PORTS = FIXED_PORT_STRING.split(',').map(port => parseInt(port.trim(), 10));

if (FIXED_IPS.length === 0 || FIXED_PORTS.length === 0) {
    throw new Error('FIXED_IP or FIXED_PORT environment variables are empty or invalid.');
}

if (FIXED_IPS.length !== FIXED_PORTS.length) {
    throw new Error('The number of FIXED_IPs must match the number of FIXED_PORTs.');
}

FIXED_PORTS.forEach((port, index) => {
    if (isNaN(port)) {
        throw new Error(`Invalid port number at index ${index} in FIXED_PORT: ${FIXED_PORT_STRING}`);
    }
});

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

const createSrvRecord = async (recordName, portIndex = 0) => {
    if (portIndex < 0 || portIndex >= FIXED_PORTS.length) {
        throw new Error(`Invalid port index: ${portIndex}. Must be between 0 and ${FIXED_PORTS.length - 1}.`);
    }
    const selectedPort = FIXED_PORTS[portIndex];

    const srvName = `_minecraft._tcp.${recordName}`;
    const srvTarget = `${recordName}.${ZONE_NAME}`;
    const srvData = {
        service: "_minecraft",
        proto: "_tcp",
        name: recordName,
        priority: 0,
        weight: 5,
        port: selectedPort,
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

    createSubdomain: async function (fullDomain, targetIp, ipPortIndex = 0) {
        if (ipPortIndex < 0 || ipPortIndex >= FIXED_IPS.length) {
            throw new Error(`Invalid IP/Port index: ${ipPortIndex}. Must be between 0 and ${FIXED_IPS.length - 1}.`);
        }

        const isMcSubdomain = fullDomain.startsWith('mc');

        const existingARecord = await findDnsRecord(fullDomain, 'A');
        if (existingARecord) throw new Error(`Subdomain ${fullDomain} already exists.`);

        const recordName = getRecordName(fullDomain);
        const ipToUse = isMcSubdomain ? FIXED_IPS[ipPortIndex] : targetIp;

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

        if (!isMcSubdomain) return { aRecord: createdARecord, srvRecord: null };

        const createdSrvRecord = await createSrvRecord(recordName, ipPortIndex);
        return { aRecord: createdARecord, srvRecord: createdSrvRecord };
    },

    updateSubdomain: async function (fullDomain, newFullDomain, targetIp, ipPortIndex = 0) {
        const isMcSubdomain = fullDomain.startsWith('mc');

        // When updating, we delete the old records first.
        await this.deleteSubdomain(fullDomain);

        // Then create new records with potentially new IP/Port from the selected index
        const creationResult = await this.createSubdomain(newFullDomain, targetIp, ipPortIndex);
        const updatedARecord = creationResult?.aRecord;

        // For mc subdomains, SRV record needs to be explicitly found or recreated if logic implies.
        // createSubdomain already handles SRV creation with the correct port index.
        const updatedSrvRecord = isMcSubdomain ? creationResult?.srvRecord : null;
        // If createSubdomain doesn't return srvRecord directly in all cases or if separate fetch is preferred:
        // const updatedSrvRecord = isMcSubdomain ? await findDnsRecord(newFullDomain, 'SRV') : null;


        if (!isMcSubdomain) return { aRecord: updatedARecord, srvRecord: null };

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
    }
};
