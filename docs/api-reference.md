# API Reference Documentation

## Overview

The AI Attendance System provides RESTful APIs for authentication, attendance management, analytics, AI predictions, and storage operations.

## Base URL

**Production:** `https://attendance-ml-backend.azurewebsites.net/api`  
**Development:** `http://localhost:4000/api`

## Authentication

All API endpoints (except OAuth endpoints) require JWT authentication.

### Headers
```http
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

### Error Responses
```json
{
  "error": "Error message description"
}
```

## Authentication Endpoints

### OAuth2 Login
```http
GET /auth/oauth/login
```

**Description:** Redirects to Moodle OAuth2 login page.

**Response:** HTTP 302 redirect to Moodle

---

### OAuth2 Callback
```http
GET /auth/oauth/callback?code=<code>&state=<state>
```

**Description:** Handles OAuth2 callback from Moodle.

**Parameters:**
- `code` (string): Authorization code from Moodle
- `state` (string): State parameter for CSRF protection

**Response:** HTTP 302 redirect to frontend with token

---

### Get Current User
```http
GET /auth/me
```

**Description:** Get current authenticated user information.

**Authentication:** Required

**Response:**
```json
{
  "user": {
    "id": 123,
    "lms_id": 456,
    "username": "john.doe",
    "email": "john.doe@university.edu",
    "name": "John Doe",
    "role": "student",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

---

### Legacy Login (Admin Only)
```http
POST /auth/login
```

**Description:** Traditional login for admin users.

**Body:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Response:**
```json
{
  "success": true,
  "token": "jwt-token-here",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin"
  }
}
```

---

### Verify Token
```http
GET /auth/verify
```

**Description:** Verify JWT token validity.

**Authentication:** Required

**Response:**
```json
{
  "valid": true,
  "user": {
    "id": 123,
    "username": "john.doe",
    "role": "student"
  }
}
```

## Analytics Endpoints

### Get Attendance Trends
```http
GET /analytics/attendance-trends/:classId?period=<period>
```

**Description:** Get attendance trends for a specific class.

**Authentication:** Required

**Parameters:**
- `classId` (integer): Class ID
- `period` (string, optional): `7d`, `30d`, or `90d` (default: `30d`)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "session_date": "2024-01-01",
      "total_students": 25,
      "present_students": 23,
      "attendance_percentage": 92.0
    }
  ]
}
```

---

### Get Risk Students
```http
GET /analytics/risk-students?threshold=<threshold>&classId=<classId>
```

**Description:** Get students at risk of poor attendance.

**Authentication:** Required

**Parameters:**
- `threshold` (number, optional): Attendance threshold (default: 75)
- `classId` (integer, optional): Filter by specific class

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "student_id": "S001",
      "name": "John Doe",
      "email": "john.doe@university.edu",
      "total_sessions": 20,
      "present_sessions": 14,
      "attendance_percentage": 70.0
    }
  ]
}
```

---

### Get Section Summary
```http
GET /analytics/section-summary/:classId
```

**Description:** Get comprehensive summary for a class section.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Computer Science 101",
    "code": "CS101",
    "enrolled_students": 25,
    "active_students": 24,
    "overall_attendance": 88.5,
    "weekly_active": 20
  }
}
```

---

### Get Weekly Attendance Patterns
```http
GET /analytics/weekly-attendance/:classId
```

**Description:** Get attendance patterns by day of week.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "day_of_week": 1,
      "sessions": 12,
      "avg_attendance": 85.5
    }
  ]
}
```

---

### Get Attendance Heatmap
```http
GET /analytics/heatmap/:classId
```

**Description:** Get attendance heatmap data for visualization.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "session_date": "2024-01-01",
      "day_of_week": 1,
      "total_students": 25,
      "present_students": 23,
      "attendance_percentage": 92.0
    }
  ]
}
```

---

### Get Dashboard Overview
```http
GET /analytics/dashboard/:classId
```

**Description:** Get complete dashboard data for a class.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": { /* Section summary data */ },
    "trends": [ /* Attendance trends data */ ],
    "riskStudents": [ /* Risk students data */ ],
    "methodDistribution": [ /* Method distribution data */ ]
  }
}
```

## AI Prediction Endpoints

### Train Prediction Model
```http
POST /ai/train-model/:classId
```

**Description:** Train AI prediction model for a class.

**Authentication:** Teacher required

**Response:**
```json
{
  "success": true,
  "message": "Model trained successfully",
  "model": {
    "classId": 1,
    "trainedAt": "2024-01-01T00:00:00.000Z",
    "featuresCount": 5
  }
}
```

---

### Predict Risk Students
```http
GET /ai/predict-risk/:classId?futureDays=<futureDays>
```

**Description:** Predict students at risk using AI model.

**Authentication:** Teacher required

**Parameters:**
- `classId` (integer): Class ID
- `futureDays` (integer, optional): Prediction horizon (default: 7)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "studentId": 123,
      "riskScore": 0.85,
      "riskLevel": "high",
      "attendanceRate": 0.65,
      "consecutiveAbsences": 3,
      "riskFactors": ["Low attendance rate", "Recent consecutive absences"],
      "predictionDate": "2024-01-01T00:00:00.000Z"
    }
  ],
  "summary": {
    "total": 25,
    "highRisk": 3,
    "mediumRisk": 5,
    "lowRisk": 17
  }
}
```

---

### Detect Anomalies
```http
GET /ai/detect-anomalies/:classId
```

**Description:** Detect attendance anomalies using AI.

**Authentication:** Teacher required

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "type": "sudden_drop",
      "studentId": 123,
      "severity": "high",
      "description": "Sudden drop in attendance detected",
      "previousRate": 0.9,
      "recentRate": 0.4
    }
  ],
  "summary": {
    "total": 2,
    "highSeverity": 1,
    "mediumSeverity": 1,
    "lowSeverity": 0
  }
}
```

---

### Get AI Insights
```http
GET /ai/insights/:classId
```

**Description:** Get comprehensive AI insights and recommendations.

**Authentication:** Teacher required

**Response:**
```json
{
  "success": true,
  "data": {
    "riskStudents": [ /* Top 5 risk students */ ],
    "criticalAnomalies": [ /* Critical anomalies */ ],
    "recommendations": [
      {
        "type": "intervention",
        "priority": "high",
        "title": "Multiple High-Risk Students Detected",
        "description": "Found 3 students at high risk",
        "action": "Schedule individual meetings"
      }
    ],
    "overallRiskLevel": "medium"
  }
}
```

## Storage Endpoints

### Upload Face Image
```http
POST /storage/upload-face/:studentId
```

**Description:** Upload face image for student recognition.

**Authentication:** Teacher required

**Content-Type:** `multipart/form-data`

**Body:**
- `image` (file): Image file (max 5MB, JPEG/PNG)

**Response:**
```json
{
  "success": true,
  "message": "Face image uploaded successfully",
  "data": {
    "url": "https://storage.account/containers/images/faces/123/image.jpg",
    "fileName": "faces/123/uuid.jpg",
    "metadata": {
      "studentId": "123",
      "originalName": "photo.jpg",
      "uploadedAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

---

### Get Face Image
```http
GET /storage/face/:studentId/:fileName
```

**Description:** Retrieve specific face image.

**Authentication:** Required

**Response:** Image file with appropriate Content-Type

---

### List Face Images
```http
GET /storage/faces/:studentId
```

**Description:** List all face images for a student.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "name": "faces/123/image1.jpg",
      "url": "https://storage.account/containers/images/faces/123/image1.jpg",
      "uploadedAt": "2024-01-01T00:00:00.000Z",
      "size": 1024000
    }
  ],
  "count": 1
}
```

---

### Delete Face Image
```http
DELETE /storage/face/:studentId/:fileName
```

**Description:** Delete specific face image.

**Authentication:** Teacher required

**Response:**
```json
{
  "success": true,
  "message": "Face image deleted successfully"
}
```

---

### Upload Face Encoding
```http
POST /storage/encoding/:studentId
```

**Description:** Upload face encoding data for AI recognition.

**Authentication:** Teacher required

**Body:**
```json
{
  "encoding": [0.1, 0.2, 0.3, ...],
  "metadata": {
    "model": "face_recognition_v1",
    "confidence": 0.95
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Face encoding uploaded successfully",
  "data": {
    "url": "https://storage.account/containers/encodings/123.json",
    "fileName": "encodings/123.json"
  }
}
```

---

### Get Face Encoding
```http
GET /storage/encoding/:studentId
```

**Description:** Retrieve face encoding for student.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": {
    "encoding": [0.1, 0.2, 0.3, ...],
    "metadata": {
      "studentId": "123",
      "uploadedAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

---

### Get Storage Statistics
```http
GET /storage/stats
```

**Description:** Get storage usage statistics.

**Authentication:** Teacher required

**Response:**
```json
{
  "success": true,
  "data": {
    "totalImages": 150,
    "totalEncodings": 25,
    "totalSize": 52428800,
    "studentCounts": {
      "123": 3,
      "124": 2
    }
  }
}
```

## Students Endpoints

### Get All Students
```http
GET /students?classId=<classId>
```

**Description:** Get all students, optionally filtered by class.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "student_id": "S001",
      "name": "John Doe",
      "email": "john.doe@university.edu",
      "photo_url": "https://storage.account/images/123.jpg",
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### Add Student
```http
POST /students
```

**Description:** Add new student (admin/teacher only).

**Authentication:** Teacher required

**Body:**
```json
{
  "student_id": "S002",
  "name": "Jane Smith",
  "email": "jane.smith@university.edu",
  "classId": 1
}
```

---

## Classes Endpoints

### Get All Classes
```http
GET /classes
```

**Description:** Get all classes for current user.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "code": "CS101",
      "name": "Computer Science 101",
      "instructor_id": 456,
      "lms_course_id": 789,
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### Create Class
```http
POST /classes
```

**Description:** Create new class (teacher only).

**Authentication:** Teacher required

**Body:**
```json
{
  "code": "CS102",
  "name": "Computer Science 102"
}
```

---

## Attendance Endpoints

### Record Attendance
```http
POST /attendance/record
```

**Description:** Record attendance for students.

**Authentication:** Teacher required

**Body:**
```json
{
  "classId": 1,
  "date": "2024-01-01",
  "attendance": [
    {
      "studentId": 123,
      "present": true,
      "method": "face",
      "confidence": 0.95
    }
  ]
}
```

---

### Get Class Attendance
```http
GET /attendance/class/:classId/date/:date
```

**Description:** Get attendance for specific class and date.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "student_id": "S001",
      "name": "John Doe",
      "present": true,
      "method": "face",
      "confidence": 0.95,
      "recorded_at": "2024-01-01T09:00:00.000Z"
    }
  ]
}
```

---

### Get Attendance Statistics
```http
GET /attendance/class/:classId/stats
```

**Description:** Get attendance statistics for a class.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": {
    "total_sessions": 20,
    "average_attendance": 87.5,
    "total_students": 25,
    "risk_students": 3
  }
}
```

## Error Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 429 | Too Many Requests |
| 500 | Internal Server Error |

## Rate Limiting

- **General API:** 100 requests per 15 minutes per IP
- **Authentication:** 5 requests per 15 minutes per IP
- **File Upload:** 10 requests per 15 minutes per IP

## SDK Examples

### JavaScript/Node.js
```javascript
const axios = require('axios');

const api = axios.create({
  baseURL: 'https://attendance-ml-backend.azurewebsites.net/api',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

// Get attendance trends
const trends = await api.get(`/analytics/attendance-trends/${classId}`);

// Upload face image
const formData = new FormData();
formData.append('image', imageFile);
const upload = await api.post(`/storage/upload-face/${studentId}`, formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});
```

### Python
```python
import requests

api = requests.Session()
api.headers.update({
    'Authorization': f'Bearer {token}',
    'Content-Type': 'application/json'
})

# Get risk students
response = api.get(f'{base_url}/analytics/risk-students')
risk_students = response.json()

# Upload face encoding
response = api.post(f'{base_url}/storage/encoding/{student_id}', json={
    'encoding': encoding_data
})
```

---

This API reference provides comprehensive documentation for integrating with the AI Attendance System.
