const pool = require('../db/connection');

// Get all customers
exports.getAllCustomers = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        CustomerID as CustID,
        Name,
        CNIC,
        Contact,
        Gmail
      FROM Customer
      ORDER BY CustomerID DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: error.message });
  }
};

// Add new customer
exports.addCustomer = async (req, res) => {
  const { name, cnic, contact, gmail, Gmail } = req.body;
  const email = gmail ?? Gmail ?? null;
  
  try {
    const [result] = await pool.query(
      'INSERT INTO Customer (Name, CNIC, Contact, Gmail) VALUES (?, ?, ?, ?)',
      [name, cnic, contact, email]
    );
    
    res.json({ 
      success: true, 
      customerId: result.insertId,
      message: 'Customer added successfully' 
    });
  } catch (error) {
    console.error('Error adding customer:', error);
    res.status(500).json({ error: error.message });
  }
};