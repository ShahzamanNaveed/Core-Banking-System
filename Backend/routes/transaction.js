const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');

router.post('/deposit', transactionController.deposit);
router.post('/withdraw', transactionController.withdraw);
router.post('/transfer', transactionController.transfer);

module.exports = router;