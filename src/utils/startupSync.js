// src/utils/startupSync.js
const db = require('./db');
const upstreamApi = require('./upstreamApi');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const secondLevelDomain = process.env.SECOND_LEVEL_DOMAIN;

if (!secondLevelDomain) {
    throw new Error('SECOND_LEVEL_DOMAIN is not defined in the environment variables.');
}

async function syncFromCloudflare() {
    const cfRecords = await upstreamApi.fetchAllDnsRecords();
    // 過濾出屬於我們的 secondLevelDomain 並將 A 和 SRV 記錄組合
    const domainMap = {};

    for (const record of cfRecords) {
        if (!record.name.endsWith(`.${secondLevelDomain}`)) continue;

        const thirdLevelDomain = record.name.replace(`.${secondLevelDomain}`, '');
        if (!domainMap[thirdLevelDomain]) {
            domainMap[thirdLevelDomain] = { thirdLevelDomain };
        }

        if (record.type === 'A') {
            domainMap[thirdLevelDomain].cloudflareARecordId = record.id;
            domainMap[thirdLevelDomain].targetIp = record.content;
        }

        if (record.type === 'SRV') {
            domainMap[thirdLevelDomain].cloudflareSrvRecordId = record.id;
            // SRV記錄的port固定在環境變數FIXED_PORT，所以不從CF取
        }
    }

    // 取得本地所有 domain
    const localDomains = await new Promise((resolve, reject) => {
        db.all('SELECT * FROM domains', (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });

    const localDomainMap = {};
    for (const d of localDomains) {
        localDomainMap[d.thirdLevelDomain] = d;
    }

    // 以CF為準，同步資料
    const thirdLevelDomainsFromCf = Object.keys(domainMap);

    // 新增或更新
    for (const tld of thirdLevelDomainsFromCf) {
        const cfData = domainMap[tld];
        const localData = localDomainMap[tld];

        // 如果本地沒有，新增
        if (!localData) {
            // const id = uuidv4();
            // await new Promise((resolve, reject) => {
            //     db.run(
            //         `INSERT INTO domains (id, serverId, thirdLevelDomain, targetIp, targetPort, cloudflareARecordId, cloudflareSrvRecordId, otherData)
            //          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            //         [
            //             id,
            //             '', // serverId等使用者操作時再補上
            //             cfData.thirdLevelDomain,
            //             cfData.targetIp || null,
            //             null,
            //             cfData.cloudflareARecordId || null,
            //             cfData.cloudflareSrvRecordId || null,
            //             JSON.stringify({})
            //         ],
            //         (err) => (err ? reject(err) : resolve())
            //     );
            // });
            continue;
        }

        // 更新本地資料使其與CF同步
        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE domains 
                 SET targetIp = ?, cloudflareARecordId = ?, cloudflareSrvRecordId = ? 
                 WHERE id = ?`,
                [
                    cfData.targetIp || localData.targetIp,
                    cfData.cloudflareARecordId || localData.cloudflareARecordId,
                    cfData.cloudflareSrvRecordId || localData.cloudflareSrvRecordId,
                    localData.id
                ],
                (err) => (err ? reject(err) : resolve())
            );
        });
    }

    // 移除在CF不存在但本地有的資料(因為CF為準)
    for (const tld in localDomainMap) {
        if (!domainMap[tld] && !localDomainMap[tld].customDomain) {
            // 從本地刪除
            await new Promise((resolve, reject) => {
                db.run(
                    `DELETE FROM domains WHERE id = ?`,
                    [localDomainMap[tld].id],
                    (err) => (err ? reject(err) : resolve())
                );
            });
        }
    }

    console.log('Startup Sync from Cloudflare completed.');
}

module.exports = { syncFromCloudflare };
