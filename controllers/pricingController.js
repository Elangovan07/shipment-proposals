const db = require('../config/db');

exports.getPricingData = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                s.id,
                c.name AS company_name,
                s.port_loading,
                s.port_discharge,
                s.price,          -- freight price
                s.currency,       -- freight currency
                s.container_size,
                s.house_do_fees,
                s.validity_date
            FROM shipments s
            LEFT JOIN companies c ON s.company_id = c.id
            ORDER BY company_name
        `);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error fetching pricing data" });
    }
};


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
                WHERE id=?
            `, [u.price, u.currency, u.container_size, u.house_do_fees, u.validity_date, u.id]);
        }
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Error updating pricing" });
    }
};


