const db = require('../utils/db');

const createBan = async (banData) => {
	const { serverId, type, value, duration } = banData;
	if (!serverId || !type || !value) {
		throw new Error('Server ID, ban type, and value are required.');
	}

	const ban = {
		id: Date.now().toString(),
		serverId,
		type,
		value,
		createdAt: new Date(),
		duration: duration || null,
		expiresAt: duration ? new Date(Date.now() + duration * 1000) : null,
	};

	await db.insert('playerFirewall', ban);
	return ban;
};

const readBanByDomain = async (domain) => {
	if (!domain) {
		throw new Error('Domain is required.');
	}
	const domains = await db.read('domains');
	const foundDomain = domains.find(d => d.domain === domain);
	if (!foundDomain) {
		throw new Error('Domain not found.');
	}
	const serverId = foundDomain.serverId;
	const bans = await db.read('playerFirewall');
	return bans.filter(ban => ban.serverId === serverId);
};

const readBanByServerId = async (serverId) => {
	if (!serverId) {
		throw new Error('Server ID is required.');
	}
	const bans = await db.read('playerFirewall');
	return bans.filter(ban => ban.serverId === serverId);
};

const updateBan = async (id, banData) => {
	if (!id) {
		throw new Error('Ban ID is required.');
	}
	const { duration } = banData;
	const bans = await db.read('playerFirewall');
	const banIndex = bans.findIndex(ban => ban.id === id);
	if (banIndex === -1) {
		throw new Error('Ban not found.');
	}
	const updatedBan = {
		...bans[banIndex],
		duration: duration || null,
		expiresAt: duration ? new Date(Date.now() + duration * 1000) : null,
	};
	bans[banIndex] = updatedBan;
	await db.write('playerFirewall', bans);
	return updatedBan;
};

const deleteBan = async (id) => {
	if (!id) {
		throw new Error('Ban ID is required.');
	}
	const bans = await db.read('playerFirewall');
	const filteredBans = bans.filter(ban => ban.id !== id);
	if (filteredBans.length === bans.length) {
		throw new Error('Ban not found.');
	}
	await db.write('playerFirewall', filteredBans);
};

module.exports = {
	createBan,
	readBanByDomain,
	readBanByServerId,
	updateBan,
	deleteBan,
};
