const pool = require('../db/connection');

// Get all accounts
exports.getAllAccounts = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        a.AccountNo,
        a.CustomerID as CustID,
        a.Type,
        a.Balance,
        a.Status
      FROM Account a
      ORDER BY a.AccountNo DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({ error: error.message });
  }
};

// Create new account
exports.createAccount = async (req, res) => {
  const { custID, type, balance } = req.body;
  
  try {
    // Convert type: SAV -> Savings, CUR -> Current
    const accountType = type === 'SAV' ? 'Savings' : 'Current';
    const initialBalance = parseFloat(balance) || 0;
    
    // Insert into Account table
    const [result] = await pool.query(
      'INSERT INTO Account (CustomerID, Type, Balance) VALUES (?, ?, ?)',
      [custID, accountType, initialBalance]
    );
    
    const accountNo = result.insertId;
    
    // Insert into SavingAccount or CurrentAccount
    if (accountType === 'Savings') {
      await pool.query(
        'INSERT INTO SavingAccount (AccountNo, InterestRate) VALUES (?, 3.50)',
        [accountNo]
      );
    } else {
      await pool.query(
        'INSERT INTO CurrentAccount (AccountNo, OverdraftLimit) VALUES (?, 5000.00)',
        [accountNo]
      );
    }
    
    res.json({ 
      success: true, 
      accountNo: accountNo,
      message: 'Account created successfully' 
    });
  } catch (error) {
    console.error('Error creating account:', error);
    res.status(500).json({ error: error.message });
  }
};