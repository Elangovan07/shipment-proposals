const db = require('../config/db');

// Get unique pricing pairs
exports.getPricingData = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                s.port_loading,
                s.port_discharge,
                MIN(s.price) AS price,                 -- Pick any representative price (edit as a group)
                MIN(s.currency) AS currency,
                MIN(s.container_size) AS container_size,
                MIN(s.house_do_fees) AS house_do_fees,
                MIN(s.validity_date) AS validity_date
            FROM shipments s
            GROUP BY s.port_loading, s.port_discharge
            ORDER BY s.port_loading, s.port_discharge
        `);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error fetching pricing data" });
    }
};

// Update pricing for ALL shipments with these POL/POD
exports.updateAllPricing = async (req, res) => {
    const { updates } = req.body;
    if (!Array.isArray(updates)) {
        return res.status(400).json({ success: false, message: "Invalid data" });
    }
    try {
        for (let u of updates) {
            await db.query(`
                UPDATE shipments 
                SET price=?, currency=?, container_size=?, house_do_fees=?, validity_date=?
                WHERE port_loading=? AND port_discharge=?
            `, [u.price, u.currency, u.container_size, u.house_do_fees, u.validity_date, u.port_loading, u.port_discharge]);
        }
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Error updating pricing" });
    }
};
