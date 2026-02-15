const pool = require('../db/connection');

// Deposit
exports.deposit = async (req, res) => {
  const { accountNo, amount, user } = req.body;
  
  try {
    const [result] = await pool.query(
      'CALL sp_deposit(?, ?, ?, ?)',
      [accountNo, amount, 'Cash', user || 'system']
    );
    
    res.json({ 
      success: true, 
      message: result[0][0].message,
      newBalance: result[0][0].new_balance 
    });
  } catch (error) {
    console.error('Deposit error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Withdraw
exports.withdraw = async (req, res) => {
  const { accountNo, amount, user } = req.body;
  
  try {
    const [result] = await pool.query(
      'CALL sp_withdraw(?, ?, ?, ?)',
      [accountNo, amount, 'Counter', user || 'system']
    );
    
    res.json({ 
      success: true, 
      message: result[0][0].message,
      newBalance: result[0][0].new_balance 
    });
  } catch (error) {
    console.error('Withdraw error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Transfer
exports.transfer = async (req, res) => {
  const { fromAccount, toAccount, amount, user } = req.body;
  
  try {
    const [result] = await pool.query(
      'CALL sp_transfer(?, ?, ?, ?)',
      [fromAccount, toAccount, amount, user || 'system']
    );
    
    res.json({ 
      success: true, 
      message: result[0][0].message,
      senderBalance: result[0][0].sender_new_balance,
      receiverBalance: result[0][0].receiver_new_balance
    });
  } catch (error) {
    console.error('Transfer error:', error);
    res.status(500).json({ error: error.message });
  }
};