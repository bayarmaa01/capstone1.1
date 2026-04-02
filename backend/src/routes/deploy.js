const { exec } = require('child_process');
const express = require('express');
const router = express.Router();

let current = 'blue';

router.post('/switch', (req, res) => {
current = current === 'blue' ? 'green' : 'blue';

exec('docker exec capstone11-nginx-1 nginx -s reload');

res.json({ active: current });
});

router.get('/status', (req, res) => {
res.json({ active: current });
});

module.exports = router;
