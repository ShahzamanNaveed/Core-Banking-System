const pool = require('../db/connection');

// Get all audit logs
exports.getAllAuditLogs = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        LogID,
        Operation,
        TableAffected,
        RecordID,
        User as UserName,
        DateTime as CreatedAt,
        Details
      FROM AuditLog
      ORDER BY DateTime DESC
      LIMIT 100
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: error.message });
  }
};