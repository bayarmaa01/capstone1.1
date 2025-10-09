# 📚 Automated Student Attendance System

Complete attendance monitoring system for colleges using **QR codes** and **Face Recognition**.

## 🚀 Features

- ✅ **Face Recognition** - Automatic attendance using camera
- ✅ **QR Code Scanning** - Fast manual attendance
- ✅ **Manual Override** - Teacher can manually mark attendance
- ✅ **Real-time Dashboard** - View live attendance statistics
- ✅ **Analytics** - Student performance tracking
- ✅ **Multi-Class Support** - Manage multiple classes
- ✅ **Secure Authentication** - JWT-based login system

## 🛠️ Technology Stack

**Backend:**
- Node.js + Express
- PostgreSQL
- JWT Authentication
- Multer (file uploads)

**Frontend:**
- React.js
- html5-qrcode
- Axios

**Face Recognition:**
- Python + Flask
- face_recognition library
- OpenCV

## 📋 Prerequisites

Make sure you have installed:
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Git](https://git-scm.com/)

## 🏃 Quick Start with Docker

### 1. Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/automated-attendance-system.git
cd automated-attendance-system
```

### 2. Start All Services
```bash
docker-compose up --build
```

**Wait 2-3 minutes for all services to start.**

### 3. Access the Application

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:4000
- **Face Service:** http://localhost:5001

### 4. Default Login
```
Username: admin
Password: admin123
```

## 🔧 Manual Setup (Without Docker)

### Backend
```bash
cd backend
npm install
# Create .env file with DATABASE_URL
npm start
```

### Face Service
```bash
cd face-service
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

### Frontend
```bash
cd frontend
npm install
# Create .env with API URLs
npm start
```

### Database
```bash
# Install PostgreSQL and create database
psql -U postgres
CREATE DATABASE attendance;
\c attendance
\i backend/sql/init.sql
```

## 📖 Usage Guide

### 1. Add Students

1. Go to Dashboard
2. Click "Add Student"
3. Upload student photo (clear frontal face)
4. Fill student details
5. Submit

### 2. Create Classes

1. Click "Add Class"
2. Enter class code and name
3. Enroll students in the class

### 3. Take Attendance

1. Open a class
2. Click "Start Attendance Session"
3. Choose mode:
   - **Face Recognition**: Students look at camera
   - **QR Scanner**: Students show QR codes
4. Mark manually if needed

### 4. View Reports

- Class page shows attendance statistics
- Individual student performance
- At-risk students (< 75% attendance)

## 📂 Project Structure
```
automated-attendance-system/
├── backend/                 # Node.js API
│   ├── src/
│   │   ├── server.js       # Main server
│   │   ├── db.js           # Database connection
│   │   └── routes/         # API endpoints
│   ├── sql/init.sql        # Database schema
│   └── Dockerfile
│
├── frontend/                # React application
│   ├── src/
│   │   ├── pages/          # Page components
│   │   ├── components/     # Reusable components
│   │   └── App.jsx
│   └── Dockerfile
│
├── face-service/            # Python face recognition
│   ├── app.py              # Flask API
│   ├── requirements.txt
│   └── Dockerfile
│
└── docker-compose.yml       # All services configuration
```

## 🔐 Security Notes

⚠️ **Before deploying to production:**

1. Change `JWT_SECRET` in `.env`
2. Use strong database passwords
3. Enable HTTPS
4. Obtain student consent for photos
5. Never commit `.env` files to Git

## 🐛 Troubleshooting

**Face recognition not working:**
- Ensure good lighting
- Student should face camera directly
- Photo quality should be high

**Database connection error:**
- Wait for PostgreSQL to fully start
- Check `DATABASE_URL` in `.env`

**Camera not accessible:**
- Grant browser camera permissions
- Check if another app is using camera

## 📝 API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Register new user

### Students
- `GET /api/students` - Get all students
- `POST /api/students` - Add student with photo

### Classes
- `GET /api/classes` - Get all classes
- `POST /api/classes` - Create class
- `GET /api/classes/:id/students` - Get class students

### Attendance
- `POST /api/attendance/record` - Mark attendance
- `GET /api/attendance/class/:id/date/:date` - Get attendance
- `GET /api/attendance/class/:id/stats` - Get statistics

## 📄 License

MIT License

## 👥 Contributors

Your Name - Your GitHub Profile

## 🙏 Acknowledgments

- face_recognition library by Adam Geitgey
- html5-qrcode by Minhaz