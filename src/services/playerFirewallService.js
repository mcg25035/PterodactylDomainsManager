const db = require('../utils/db');

const createBan = async (banData) => {
	const { serverId, type, value, expiresAt } = banData;
	if (!serverId || !type || !value) {
		throw new Error('Server ID, ban type, and value are required.');
	}

	const ban = {
		id: Date.now().toString(),
		serverId,
		type,
		value,
		createdAt: Date.now(),
		expiresAt: expiresAt ? Number(expiresAt) : -1,
	};

	return new Promise((resolve, reject) => {
		db.run('INSERT INTO playerFirewall (id, serverId, type, value, createdAt, expiresAt) VALUES (?, ?, ?, ?, ?, ?, ?)', [ban.id, ban.serverId, ban.type, ban.value, ban.createdAt, ban.expiresAt], function (err) {
			if (err) return reject(err);
			resolve(ban);
		});
	});
};

const readBanByDomain = async (domain) => {
	if (!domain) {
		throw new Error('Domain is required.');
	}

	const domains = await new Promise((resolve, reject) => {
		db.all('SELECT * FROM domains WHERE thirdLevelDomain = ?', [domain], (err, rows) => {
			if (err) return reject(err);
			resolve(rows);
		});
	});

	const foundDomain = domains.find(d => d.thirdLevelDomain === domain);

	if (!foundDomain) {
		throw new Error('Domain not found.');
	}

	const serverId = foundDomain.serverId;

	const bans = await new Promise((resolve, reject) => {
		db.all('SELECT * FROM playerFirewall WHERE serverId = ?', [serverId], (err, rows) => {
			if (err) return reject(err);
			resolve(rows);
		})
	});

	return bans;
};

const readBanByServerId = async (serverId) => {
	if (!serverId) {
		throw new Error('Server ID is required.');
	}
	const bans = await new Promise((resolve, reject) => {
		db.all('SELECT * FROM playerFirewall WHERE serverId = ?', [serverId], (err, rows) => {
			if (err) return reject(err);
			resolve(rows);
		});
	});
	return bans;
};

const updateBan = async (id, banData) => {
	if (!id) {
		throw new Error('Ban ID is required.');
	}
	const { duration } = banData;

	const expiresAt = duration ? new Date(Date.now() + duration * 1000) : null;

	await new Promise((resolve, reject) => {
		db.run('UPDATE playerFirewall SET duration = ?, expiresAt = ? WHERE id = ?', [duration, expiresAt, id], function (err) {
			if (err) return reject(err);
			if (this.changes === 0) return reject(new Error('Ban not found.'));
			resolve();
		});
	});

	return new Promise((resolve, reject) => {
		db.get('SELECT * FROM playerFirewall WHERE id = ?', [id], (err, row) => {
			if (err) return reject(err);
			resolve(row);
		});
	});
};

const deleteBan = async (id) => {
	if (!id) {
		throw new Error('Ban ID is required.');
	}
	return new Promise((resolve, reject) => {
		db.run('DELETE FROM playerFirewall WHERE id = ?', [id], function (err) {
			if (err) return reject(err);
			if (this.changes === 0) return reject(new Error('Ban not found.'));
			resolve();
		});
	});
};

module.exports = {
	createBan,
	readBanByDomain,
	readBanByServerId,
	updateBan,
	deleteBan,
};
