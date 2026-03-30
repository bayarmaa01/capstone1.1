const request = require('supertest');
const app = require('../../src/server');

describe('API Integration Tests', () => {
  test('GET /api/health endpoint integration', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect('Content-Type', /json/)
      .expect(200);
    
    expect(response.body).toBeDefined();
  });
});
