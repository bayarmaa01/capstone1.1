const request = require('supertest');
const app = require('../../src/server');

describe('Server Health Check', () => {
  test('GET /api/health should return 200', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect(200);
    
    expect(response.body).toHaveProperty('status');
  });
});
