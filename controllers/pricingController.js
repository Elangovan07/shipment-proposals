const db = require('../config/db');

// Get unique pricing pairs (normalized)
exports.getPricingData = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                TRIM(LOWER(s.port_loading)) AS port_loading,
                TRIM(LOWER(s.port_discharge)) AS port_discharge,
                MIN(s.price) AS price,
                MIN(s.currency) AS currency,
                MIN(s.container_size) AS container_size,
                MIN(s.house_do_fees) AS house_do_fees,
                MIN(s.validity_date) AS validity_date
            FROM shipments s
            GROUP BY TRIM(LOWER(s.port_loading)), TRIM(LOWER(s.port_discharge))
            ORDER BY TRIM(LOWER(s.port_loading)), TRIM(LOWER(s.port_discharge))
        `);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error fetching pricing data" });
    }
};

// Update pricing for ALL shipments with these POL/POD (normalized)
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
                WHERE TRIM(LOWER(port_loading))=? AND TRIM(LOWER(port_discharge))=?
            `, [
                u.price,
                u.currency,
                u.container_size,
                u.house_do_fees,
                // If blank string, undefined, or null: set as SQL null
                !u.validity_date || u.validity_date.trim() === "" ? null : u.validity_date,
                u.port_loading.trim().toLowerCase(),
                u.port_discharge.trim().toLowerCase()
            ]);
        }
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Error updating pricing" });
    }
};
