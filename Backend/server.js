
require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Database connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
});

// Serve frontend
app.use('/frontend', express.static(path.join(__dirname, '..', 'Frontend')));

// ==================== CUSTOMER ROUTES ====================

// Get all customers
app.get('/api/customers', async (req, res) => {
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
    console.log('Customers fetched:', rows.length);
    res.json(rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ...existing code...
// Add customer
app.post('/api/customers', async (req, res) => {
  console.log('POST /api/customers body:', req.body); // <-- debug log
  const { name, cnic, contact, gmail } = req.body;    // changed Gmail -> gmail (lowercase)

  if (!name || !cnic) {
    return res.status(400).json({ error: 'Name and CNIC are required' });
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO Customer (Name, CNIC, Contact, Gmail) VALUES (?, ?, ?, ?)',
      [name, cnic, contact, gmail] // use gmail variable
    );
    console.log('Customer added:', result.insertId);
    res.json({ success: true, customerId: result.insertId });
  } catch (error) {
    console.error('Error inserting customer:', error);
    res.status(500).json({ error: error.message });
  }
});
// ...existing code...

// ==================== ACCOUNT ROUTES ====================

// Get all accounts
app.get('/api/accounts', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        AccountNo,
        CustomerID as CustID,
        Type,
        Balance,
        Status
      FROM Account
      ORDER BY AccountNo DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create account
app.post('/api/accounts', async (req, res) => {
  const { custID, type, balance } = req.body;
  try {
    const accountType = type === 'SAV' ? 'Savings' : 'Current';
    const [result] = await pool.query(
      'INSERT INTO Account (CustomerID, Type, Balance) VALUES (?, ?, ?)',
      [custID, accountType, balance || 0]
    );
    
    const accountNo = result.insertId;
    
    if (accountType === 'Savings') {
      await pool.query('INSERT INTO SavingAccount (AccountNo, InterestRate) VALUES (?, 3.50)', [accountNo]);
    } else {
      await pool.query('INSERT INTO CurrentAccount (AccountNo, OverdraftLimit) VALUES (?, 5000)', [accountNo]);
    }
    
    res.json({ success: true, accountNo });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== TRANSACTION ROUTES ====================

// ---------- DEPOSIT ----------
app.post('/api/transactions/deposit', async (req, res) => {
  const { accountNo, amount, user } = req.body;
  const username = user || req.body.user || 'system'; // prefer provided user, else system

  try {
    // Call stored procedure (your SP signature: p_account_no, p_amount, p_method, p_user)
    await pool.query('CALL sp_deposit(?, ?, ?, ?)', [accountNo, amount, 'Cash', username]);

    // Fetch receiver account + customer name and updated balance
    const [accRows] = await pool.query(`
      SELECT A.AccountNo, A.Balance, C.Name AS CustomerName
      FROM Account A
      JOIN Customer C ON A.CustomerID = C.CustomerID
      WHERE A.AccountNo = ?
    `, [accountNo]);

    const acc = accRows[0] || null;

    res.json({
      success: true,
      receiver: acc ? { accountNo: acc.AccountNo, name: acc.CustomerName, newBalance: acc.Balance } : null
    });
  } catch (err) {
    console.error('Deposit error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------- WITHDRAW ----------
app.post('/api/transactions/withdraw', async (req, res) => {
  const { accountNo, amount, user } = req.body;
  const username = user || req.body.user || 'system';

  try {
    await pool.query('CALL sp_withdraw(?, ?, ?, ?)', [accountNo, amount, 'Counter', username]);

    const [accRows] = await pool.query(`
      SELECT A.AccountNo, A.Balance, C.Name AS CustomerName
      FROM Account A
      JOIN Customer C ON A.CustomerID = C.CustomerID
      WHERE A.AccountNo = ?
    `, [accountNo]);

    const acc = accRows[0] || null;

    res.json({
      success: true,
      sender: acc ? { accountNo: acc.AccountNo, name: acc.CustomerName, newBalance: acc.Balance } : null
    });
  } catch (err) {
    console.error('Withdraw error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------- TRANSFER ----------
app.post('/api/transactions/transfer', async (req, res) => {
  const { fromAccount, toAccount, amount, user } = req.body;
  const username = user || req.body.user || 'system';

  try {
    await pool.query('CALL sp_transfer(?, ?, ?, ?)', [fromAccount, toAccount, amount, username]);

    const [senderRows] = await pool.query(`
      SELECT A.AccountNo, A.Balance, C.Name AS CustomerName
      FROM Account A
      JOIN Customer C ON A.CustomerID = C.CustomerID
      WHERE A.AccountNo = ?
    `, [fromAccount]);

    const [receiverRows] = await pool.query(`
      SELECT A.AccountNo, A.Balance, C.Name AS CustomerName
      FROM Account A
      JOIN Customer C ON A.CustomerID = C.CustomerID
      WHERE A.AccountNo = ?
    `, [toAccount]);

    const sender = senderRows[0] || null;
    const receiver = receiverRows[0] || null;

    res.json({
      success: true,
      sender: sender ? { accountNo: sender.AccountNo, name: sender.CustomerName, newBalance: sender.Balance } : null,
      receiver: receiver ? { accountNo: receiver.AccountNo, name: receiver.CustomerName, newBalance: receiver.Balance } : null
    });
  } catch (err) {
    console.error('Transfer error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});


// ==================== AUDIT ROUTES ====================

// Get audit logs
app.get('/api/audit', async (req, res) => {
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
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, database: process.env.DB_NAME });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ CBS Backend running on http://localhost:${PORT}`);
  console.log(`📊 Database: ${process.env.DB_NAME}`);
  console.log(`🌐 Frontend: http://localhost:${PORT}/frontend/index.html`);
});