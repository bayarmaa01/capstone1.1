const request = require('supertest');

// Mock Azure Storage to avoid connection issues
jest.mock('../../src/services/azure_storage', () => ({
  initializeContainer: jest.fn(),
  uploadBlob: jest.fn(),
  getBlobUrl: jest.fn(),
  deleteBlob: jest.fn()
}));

describe('Server Health Check', () => {
  let app;

  beforeAll(async () => {
    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    
    // Import app after mocking and env setup
    app = require('../../src/server');
  });

  afterAll(async () => {
    // Clean up - close server if it exists
    if (app && app.close) {
      await app.close();
    }
  });

  test('GET /api/health should return 200', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect(200);
    
    expect(response.body).toHaveProperty('status');
  });
});
