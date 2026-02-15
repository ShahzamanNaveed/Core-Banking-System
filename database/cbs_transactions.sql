-- =====================================================
-- Core Banking System (CBS) - Sample Data & Test Cases
-- =====================================================

USE cbs;

-- =====================================================
-- Insert Sample Customers
-- =====================================================
INSERT INTO Customer (Name, CNIC, Contact,Gmail) VALUES
('Muhammad Talha', '42201-1234567-1', '0300-1234567','Talha123@gmail.com'),
('Faiza Ali', '42201-2345678-2', '0321-2345678','Ali1122@gmail.com'),
('Laiba Najeeb Khan', '42201-3456789-3', '0333-3456789','Najeeb224@gmail.com');

-- =====================================================
-- Insert Sample Accounts
-- =====================================================
INSERT INTO Account (CustomerID, Type, Balance, Status) VALUES
(1, 'Savings', 50000.00, 'Active'),
(2, 'Current', 25000.00, 'Active'),
(3, 'Savings', 75000.00, 'Active');

-- =====================================================
-- Insert Saving Account Details
-- =====================================================
INSERT INTO SavingAccount (AccountNo, InterestRate) VALUES
(1, 3.50),
(3, 4.00);

-- =====================================================d:\Core_Banking_System-main
-- Insert Current Account Details
-- =====================================================
INSERT INTO CurrentAccount (AccountNo, OverdraftLimit) VALUES
(2, 5000.00);

-- =====================================================
-- Test Case 1: Successful Deposit (with COMMIT)
-- =====================================================
CALL sp_deposit(1, 10000.00, 'Cash', 'Muhammad Talha');

-- =====================================================
-- Test Case 2: Successful Withdrawal (with COMMIT)
-- =====================================================
CALL sp_withdraw(2, 5000.00, 'ATM', 'Muhammad Talha');

-- =====================================================
-- Test Case 3: Failed Withdrawal - Insufficient Balance (ROLLBACK)
-- =====================================================
CALL sp_withdraw(1, 100000.00, 'Counter', 'Muhammad Talha');

-- =====================================================
-- Test Case 4: Successful Transfer (Atomic with COMMIT)
-- =====================================================
CALL sp_transfer(3, 5, 15000.00, 'Faiza Ali');

-- =====================================================
-- Test Case 5: Failed Transfer - Insufficient Balance (ROLLBACK)
-- =====================================================
CALL sp_transfer(1, 3, 200000.00, 'Muhammad Talha');

-- =====================================================
-- Test Case 6: SAVEPOINT Demonstration
-- =====================================================
CALL sp_savepoint_demo('New Customer', '42201-9999999-9', '0300-9999999', 'Savings', 20000.00);

-- =====================================================
-- View All Customers
-- =====================================================
SELECT * FROM Customer;

-- =====================================================
-- View All Accounts with Customer Names
-- =====================================================
SELECT 
    a.AccountNo,
    c.Name AS CustomerName,
    a.Type,
    a.Balance,
    a.Status
FROM Account a
JOIN Customer c ON a.CustomerID = c.CustomerID;

-- =====================================================
-- View All Transactions
-- =====================================================
SELECT 
    t.TransID,
    t.FromAccount,
    t.ToAccount,
    t.Amount,
    t.Type,
    t.DateTime,
    t.Status
FROM TransactionLog t
ORDER BY t.DateTime DESC;

-- =====================================================
-- View All Deposits
-- =====================================================
SELECT 
    d.DepositID,
    t.ToAccount AS AccountNo,
    d.Amount,
    d.DepositMethod,
    t.DateTime
FROM Deposit d
JOIN TransactionLog t ON d.TransID = t.TransID;

-- =====================================================
-- View All Withdrawals
-- =====================================================
SELECT 
    w.WithdrawalID,
    t.FromAccount AS AccountNo,
    w.Amount,
    w.WithdrawalMethod,
    t.DateTime
FROM Withdrawal w
JOIN TransactionLog t ON w.TransID = t.TransID;

-- =====================================================
-- View All Transfers
-- =====================================================
SELECT 
    tr.TransferID,
    t.FromAccount,
    t.ToAccount,
    tr.Amount,
    tr.TransferType,
    t.DateTime
FROM Transfer tr
JOIN TransactionLog t ON tr.TransID = t.TransID;

-- =====================================================
-- View Audit Log (COMMIT/ROLLBACK History)
-- =====================================================
SELECT * FROM AuditLog ORDER BY DateTime DESC;

-- =====================================================
-- Customer Account Summary
-- =====================================================
SELECT 
    c.CustomerID,
    c.Name,
    c.CNIC,
    COUNT(a.AccountNo) AS TotalAccounts,
    SUM(a.Balance) AS TotalBalance
FROM Customer c
LEFT JOIN Account a ON c.CustomerID = a.CustomerID
GROUP BY c.CustomerID;

Select * From Customer