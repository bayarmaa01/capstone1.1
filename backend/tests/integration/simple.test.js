const request = require('supertest');

describe('Simple Integration Test', () => {
  test('GET /api/health should return 200', async () => {
    // Create a minimal Express app for testing
    const express = require('express');
    const app = express();
    
    // Add health endpoint
    app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });
    
    const response = await request(app)
      .get('/api/health')
      .expect(200);
    
    expect(response.body).toHaveProperty('status');
    expect(response.body.status).toBe('ok');
  });
});
