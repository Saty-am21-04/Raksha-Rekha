const express = require('express');
const { getWayanadBacktest } = require('../controllers/backtestController');

const router = express.Router();

router.get('/', getWayanadBacktest);

module.exports = router;
