const express = require('express');
const { getSituationReport, sendEmergencyNotification } = require('../controllers/opsController');

const router = express.Router();

const buckets = new Map();
const rateLimit = (request, response, next) => {
  const key = request.ip || 'local';
  const now = Date.now();
  const windowMs = 60_000;
  const current = buckets.get(key) || { count: 0, resetAt: now + windowMs };
  if (now > current.resetAt) {
    current.count = 0;
    current.resetAt = now + windowMs;
  }
  current.count += 1;
  buckets.set(key, current);
  if (current.count > 10) return response.status(429).json({ error: 'Too many operations requests.' });
  next();
};

router.post('/dispatch-alert', rateLimit, sendEmergencyNotification);
router.post('/sitrep', rateLimit, getSituationReport);

module.exports = router;
