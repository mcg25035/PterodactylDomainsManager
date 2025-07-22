const upstreamApi = require("../utils/upstreamApi");



async function getFixedEndpoints (req, res) {
    try {
        const fixedEndpoints = upstreamApi.getFixedEndpoints();
        return res.json(fixedEndpoints);
    } catch (error) {
        console.error(`Error fetching fixed endpoints: ${error.message}`);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
}


module.exports = {
    getFixedEndpoints
};