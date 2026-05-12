// Test attendance recording endpoint
const axios = require('axios');

async function testAttendance() {
  try {
    const testData = {
      class_id: 1,
      student_id: 8,
      present: true,
      method: 'face_recognition',
      confidence: 0.62,
      session_date: new Date().toISOString().slice(0, 10)
    };

    console.log('Testing attendance recording with:', testData);
    
    const response = await axios.post('http://localhost:4000/api/attendance/record', testData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Success:', response.data);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Headers:', error.response.headers);
    }
  }
}

testAttendance();
