const db = require('../config/db');

// Get all shipments
exports.getAllShipments = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        s.id,
        c.name AS company_name,
        s.port_loading,
        s.port_discharge,
        s.price,
        s.currency,
        DATE_FORMAT(s.uploaded_at, '%Y-%m-%d %H:%i:%s') AS uploaded_at
      FROM shipments s
      LEFT JOIN companies c ON s.company_id = c.id
      ORDER BY s.uploaded_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching shipments" });
  }
};

// Delete shipment by ID
exports.deleteShipment = async (req, res) => {
  try {
    const shipmentId = req.params.id;
    await db.query('DELETE FROM shipments WHERE id = ?', [shipmentId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error deleting shipment.' });
  }
};

// Update shipment by ID
exports.updateShipment = async (req, res) => {
  try {
    const shipmentId = req.params.id;
    const { port_loading, port_discharge, price, currency } = req.body;
    await db.query(
      'UPDATE shipments SET port_loading = ?, port_discharge = ?, price = ?, currency = ? WHERE id = ?',
      [port_loading, port_discharge, price, currency, shipmentId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error updating shipment.' });
  }
};
