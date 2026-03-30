const request = require('supertest');

// Mock Azure Storage to avoid connection issues
jest.mock('../../src/services/azure_storage', () => ({
  initializeContainer: jest.fn(),
  uploadBlob: jest.fn(),
  getBlobUrl: jest.fn(),
  deleteBlob: jest.fn()
}));

describe('Server Health Check', () => {
  beforeAll(() => {
    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  });

  test('GET /api/health should return 200', async () => {
    // Import app after mocking
    const app = require('../../src/server');
    
    const response = await request(app)
      .get('/api/health')
      .expect(200);
    
    expect(response.body).toHaveProperty('status');
  });
});
