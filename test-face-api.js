// Test script to verify face recognition API
const FormData = require('form-data');
const fs = require('fs');
const axios = require('axios');

async function testFaceAPI() {
  try {
    // Create a simple test image (1x1 pixel JPEG)
    const testImageData = Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48, 0x00,
      0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43, 0x00, 0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00,
      0x3C, 0x00, 0x00, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0xFF, 0xC0, 0x00, 0x11, 0x08, 0x00, 0x01,
      0x01, 0x01, 0x01, 0x01, 0xFF, 0xD9
    ]);

    const formData = new FormData();
    formData.append('image', testImageData, {
      filename: 'test.jpg',
      contentType: 'image/jpeg'
    });
    formData.append('class_id', '1');
    formData.append('session_id', '18');

    console.log('Testing face recognition API...');
    
    const response = await axios.post('http://localhost:5001/recognize', formData, {
      headers: {
        ...formData.getHeaders()
      }
    });
    
    console.log('Response:', response.data);
    console.log('Status:', response.status);
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testFaceAPI();
