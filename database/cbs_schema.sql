-- =====================================================
-- Core Banking System (CBS) - Database Schema (FIXED)
-- Lab Instructor: Sir Rohan Farooq
-- =====================================================

-- Create Database
CREATE DATABASE IF NOT EXISTS cbs;
USE cbs;

-- =====================================================
-- Table 1: Customer
-- =====================================================
CREATE TABLE IF NOT EXISTS Customer (
    CustomerID INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(100) NOT NULL,
    CNIC VARCHAR(20) UNIQUE NOT NULL,
    Contact VARCHAR(20) NOT NULL,
    Gmail VARCHAR(100) UNIQUE NOT NULL
);


-- =====================================================
-- Table 2: Account (Parent Table for Savings & Current)
-- =====================================================
CREATE TABLE IF NOT EXISTS Account (
    AccountNo INT PRIMARY KEY AUTO_INCREMENT,
    CustomerID INT NOT NULL,
    Type ENUM('Savings', 'Current') NOT NULL,
    Balance DECIMAL(15,2) DEFAULT 0,
    Status ENUM('Active', 'Inactive', 'Closed') DEFAULT 'Active',
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (CustomerID) REFERENCES Customer(CustomerID) ON DELETE CASCADE
);

-- =====================================================
-- Table 3: SavingAccount (Specialization of Account)
-- =====================================================
CREATE TABLE IF NOT EXISTS SavingAccount (
    AccountNo INT PRIMARY KEY,
    InterestRate DECIMAL(5,2) NOT NULL DEFAULT 3.50,
    FOREIGN KEY (AccountNo) REFERENCES Account(AccountNo) ON DELETE CASCADE
);

-- =====================================================
-- Table 4: CurrentAccount (Specialization of Account)
-- =====================================================
CREATE TABLE IF NOT EXISTS CurrentAccount (
    AccountNo INT PRIMARY KEY,
    OverdraftLimit DECIMAL(15,2) DEFAULT 0,
    FOREIGN KEY (AccountNo) REFERENCES Account(AccountNo) ON DELETE CASCADE
);

-- =====================================================
-- Table 5: TransactionLog (Main Transaction Table)
-- Added UserName column to track operator
-- =====================================================
CREATE TABLE IF NOT EXISTS TransactionLog (
    TransID INT PRIMARY KEY AUTO_INCREMENT,
    FromAccount INT,
    ToAccount INT,
    Amount DECIMAL(15,2) NOT NULL,
    Type ENUM('Deposit', 'Withdrawal', 'Transfer') NOT NULL,
    DateTime DATETIME DEFAULT CURRENT_TIMESTAMP,
    Status ENUM('Success', 'Failed', 'Rolled Back') DEFAULT 'Success',
    UserName VARCHAR(50) DEFAULT 'system',
    FOREIGN KEY (FromAccount) REFERENCES Account(AccountNo),
    FOREIGN KEY (ToAccount) REFERENCES Account(AccountNo)
);

-- =====================================================
-- Table 6: Deposit (Specialization of Transaction)
-- =====================================================
CREATE TABLE IF NOT EXISTS Deposit (
    DepositID INT PRIMARY KEY AUTO_INCREMENT,
    TransID INT NOT NULL,
    Amount DECIMAL(15,2) NOT NULL,
    DepositMethod ENUM('Cash', 'Cheque', 'Online') DEFAULT 'Cash',
    FOREIGN KEY (TransID) REFERENCES TransactionLog(TransID) ON DELETE CASCADE
);

-- =====================================================
-- Table 7: Withdrawal (Specialization of Transaction)
-- =====================================================
CREATE TABLE IF NOT EXISTS Withdrawal (
    WithdrawalID INT PRIMARY KEY AUTO_INCREMENT,
    TransID INT NOT NULL,
    Amount DECIMAL(15,2) NOT NULL,
    WithdrawalMethod ENUM('ATM', 'Counter', 'Online') DEFAULT 'Counter',
    FOREIGN KEY (TransID) REFERENCES TransactionLog(TransID) ON DELETE CASCADE
);

-- =====================================================
-- Table 8: Transfer (Specialization of Transaction)
-- =====================================================
CREATE TABLE IF NOT EXISTS Transfer (
    TransferID INT PRIMARY KEY AUTO_INCREMENT,
    TransID INT NOT NULL,
    Amount DECIMAL(15,2) NOT NULL,
    TransferType ENUM('Internal', 'External') DEFAULT 'Internal',
    FOREIGN KEY (TransID) REFERENCES TransactionLog(TransID) ON DELETE CASCADE
);

-- =====================================================
-- Table 9: AuditLog (Security & Tracking)
-- Renamed User -> UserName for consistency
-- =====================================================
CREATE TABLE IF NOT EXISTS AuditLog (
    LogID INT PRIMARY KEY AUTO_INCREMENT,
    Operation VARCHAR(50) NOT NULL, -- INSERT, UPDATE, DELETE, COMMIT, ROLLBACK
    TableAffected VARCHAR(50) NOT NULL,
    RecordID INT,
    UserName VARCHAR(50) DEFAULT 'system',
    DateTime DATETIME DEFAULT CURRENT_TIMESTAMP,
    Details TEXT
);

-- =====================================================
-- Stored Procedure 1: Deposit with TCL (COMMIT/ROLLBACK)
-- =====================================================
DELIMITER $$

DROP PROCEDURE IF EXISTS sp_deposit $$
CREATE PROCEDURE sp_deposit(
    IN p_account_no INT,
    IN p_amount DECIMAL(15,2),
    IN p_method ENUM('Cash', 'Cheque', 'Online'),
    IN p_user VARCHAR(50)
)
BEGIN
    DECLARE v_current_balance DECIMAL(15,2);
    DECLARE v_trans_id INT;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        -- Rollback on error
        ROLLBACK;
        INSERT INTO AuditLog (Operation, TableAffected, UserName, Details)
        VALUES ('ROLLBACK', 'Account', p_user, CONCAT('Deposit failed for Account ', p_account_no));
        SELECT 'Error: Transaction rolled back' AS message;
    END;
    
    START TRANSACTION;
    
    -- Get current balance (use FOR UPDATE to lock row in concurrent scenarios)
    SELECT Balance INTO v_current_balance FROM Account WHERE AccountNo = p_account_no FOR UPDATE;
    
    -- Update balance
    UPDATE Account 
    SET Balance = Balance + p_amount 
    WHERE AccountNo = p_account_no;
    
    -- Insert transaction log (include UserName)
    INSERT INTO TransactionLog (ToAccount, Amount, Type, Status, UserName)
    VALUES (p_account_no, p_amount, 'Deposit', 'Success', p_user);
    
    SET v_trans_id = LAST_INSERT_ID();
    
    -- Insert deposit details
    INSERT INTO Deposit (TransID, Amount, DepositMethod)
    VALUES (v_trans_id, p_amount, p_method);
    
    -- Audit log
    INSERT INTO AuditLog (Operation, TableAffected, RecordID, UserName, Details)
    VALUES ('COMMIT', 'Account', p_account_no, p_user, CONCAT('Deposit of ', p_amount, ' successful'));
    
    COMMIT;
    
    SELECT 'Success: Deposit completed' AS message, 
           v_current_balance + p_amount AS new_balance;
END $$
DELIMITER ;

-- =====================================================
-- Stored Procedure 2: Withdrawal with TCL
-- =====================================================
DELIMITER $$

DROP PROCEDURE IF EXISTS sp_withdraw $$
CREATE PROCEDURE sp_withdraw(
    IN p_account_no INT,
    IN p_amount DECIMAL(15,2),
    IN p_method ENUM('ATM', 'Counter', 'Online'),
    IN p_user VARCHAR(50)
)
BEGIN
    DECLARE v_current_balance DECIMAL(15,2);
    DECLARE v_trans_id INT;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        INSERT INTO AuditLog (Operation, TableAffected, UserName, Details)
        VALUES ('ROLLBACK', 'Account', p_user, CONCAT('Withdrawal failed for Account ', p_account_no));
        SELECT 'Error: Transaction rolled back' AS message;
    END;
    
    START TRANSACTION;
    
    -- Get current balance (lock)
    SELECT Balance INTO v_current_balance FROM Account WHERE AccountNo = p_account_no FOR UPDATE;
    
    -- Check sufficient balance
    IF v_current_balance < p_amount THEN
        ROLLBACK;
        INSERT INTO AuditLog (Operation, TableAffected, RecordID, UserName, Details)
        VALUES ('ROLLBACK', 'Account', p_account_no, p_user, 'Insufficient balance');
        SELECT 'Error: Insufficient balance' AS message;
    ELSE
        -- Deduct amount
        UPDATE Account 
        SET Balance = Balance - p_amount 
        WHERE AccountNo = p_account_no;
        
        -- Insert transaction log (include UserName)
        INSERT INTO TransactionLog (FromAccount, Amount, Type, Status, UserName)
        VALUES (p_account_no, p_amount, 'Withdrawal', 'Success', p_user);
        
        SET v_trans_id = LAST_INSERT_ID();
        
        -- Insert withdrawal details
        INSERT INTO Withdrawal (TransID, Amount, WithdrawalMethod)
        VALUES (v_trans_id, p_amount, p_method);
        
        -- Audit log
        INSERT INTO AuditLog (Operation, TableAffected, RecordID, UserName, Details)
        VALUES ('COMMIT', 'Account', p_account_no, p_user, CONCAT('Withdrawal of ', p_amount, ' successful'));
        
        COMMIT;
        
        SELECT 'Success: Withdrawal completed' AS message, 
               v_current_balance - p_amount AS new_balance;
    END IF;
END $$
DELIMITER ;

-- =====================================================
-- Stored Procedure 3: Transfer with TCL (Atomic Operation)
-- =====================================================
DELIMITER $$

DROP PROCEDURE IF EXISTS sp_transfer $$
CREATE PROCEDURE sp_transfer(
    IN p_from_account INT,
    IN p_to_account INT,
    IN p_amount DECIMAL(15,2),
    IN p_user VARCHAR(50)
)
BEGIN
    DECLARE v_from_balance DECIMAL(15,2);
    DECLARE v_to_balance DECIMAL(15,2);
    DECLARE v_trans_id INT;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        INSERT INTO AuditLog (Operation, TableAffected, UserName, Details)
        VALUES ('ROLLBACK', 'Account', p_user, 
                CONCAT('Transfer failed from ', p_from_account, ' to ', p_to_account));
        SELECT 'Error: Transaction rolled back' AS message;
    END;
    
    START TRANSACTION;
    
    -- Get balances and lock rows
    SELECT Balance INTO v_from_balance FROM Account WHERE AccountNo = p_from_account FOR UPDATE;
    SELECT Balance INTO v_to_balance FROM Account WHERE AccountNo = p_to_account FOR UPDATE;
    
    -- Check sufficient balance
    IF v_from_balance < p_amount THEN
        ROLLBACK;
        INSERT INTO AuditLog (Operation, TableAffected, RecordID, UserName, Details)
        VALUES ('ROLLBACK', 'Account', p_from_account, p_user, 'Insufficient balance for transfer');
        SELECT 'Error: Insufficient balance' AS message;
    ELSE
        -- Debit from sender
        UPDATE Account 
        SET Balance = Balance - p_amount 
        WHERE AccountNo = p_from_account;
        
        -- Credit to receiver
        UPDATE Account 
        SET Balance = Balance + p_amount 
        WHERE AccountNo = p_to_account;
        
        -- Insert transaction log (include UserName)
        INSERT INTO TransactionLog (FromAccount, ToAccount, Amount, Type, Status, UserName)
        VALUES (p_from_account, p_to_account, p_amount, 'Transfer', 'Success', p_user);
        
        SET v_trans_id = LAST_INSERT_ID();
        
        -- Insert transfer details
        INSERT INTO Transfer (TransID, Amount, TransferType)
        VALUES (v_trans_id, p_amount, 'Internal');
        
        -- Audit log
        INSERT INTO AuditLog (Operation, TableAffected, RecordID, UserName, Details)
        VALUES ('COMMIT', 'Account', p_from_account, p_user, 
                CONCAT('Transfer of ', p_amount, ' to Account ', p_to_account, ' successful'));
        
        COMMIT;
        
        SELECT 'Success: Transfer completed' AS message,
               v_from_balance - p_amount AS sender_new_balance,
               v_to_balance + p_amount AS receiver_new_balance;
    END IF;
END $$
DELIMITER ;

-- =====================================================
-- Stored Procedure 4: SAVEPOINT Demonstration
-- =====================================================
DELIMITER $$

DROP PROCEDURE IF EXISTS sp_savepoint_demo $$
CREATE PROCEDURE sp_savepoint_demo(
    IN p_customer_name VARCHAR(100),
    IN p_cnic VARCHAR(20),
    IN p_contact VARCHAR(20),
    IN p_account_type ENUM('Savings', 'Current'),
    IN p_initial_deposit DECIMAL(15,2)
)
BEGIN
    DECLARE v_customer_id INT;
    DECLARE v_account_no INT;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SELECT 'Error: Complete transaction rolled back' AS message;
    END;
    
    START TRANSACTION;
    
    -- Step 1: Insert Customer
    INSERT INTO Customer (Name, CNIC, Contact)
    VALUES (p_customer_name, p_cnic, p_contact);
    
    SET v_customer_id = LAST_INSERT_ID();
    
    SAVEPOINT after_customer_insert;
    
    -- Step 2: Create Account
    INSERT INTO Account (CustomerID, Type, Balance)
    VALUES (v_customer_id, p_account_type, p_initial_deposit);
    
    SET v_account_no = LAST_INSERT_ID();
    
    -- Step 3: Create Saving/Current Account details
    IF p_account_type = 'Savings' THEN
        INSERT INTO SavingAccount (AccountNo, InterestRate)
        VALUES (v_account_no, 3.50);
    ELSE
        INSERT INTO CurrentAccount (AccountNo, OverdraftLimit)
        VALUES (v_account_no, 10000.00);
    END IF;
    
    SAVEPOINT after_account_creation;
    
    -- If everything successful, commit
    COMMIT;
    
    SELECT 'Success: Customer and Account created' AS message,
           v_customer_id AS customer_id,
           v_account_no AS account_number;
END $$
DELIMITER ;
