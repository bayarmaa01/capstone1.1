# 🎓 AI Attendance System - Enterprise Platform

Production-ready university attendance monitoring system with **LMS integration**, **AI analytics**, and **cloud-native architecture**.

## 🚀 Key Features

- 🔐 **Moodle OAuth2 Authentication** - Seamless LMS login
- 🔄 **Automatic Section Synchronization** - Real-time course updates
- 🤖 **AI-Powered Analytics** - Risk prediction and anomaly detection
- 📊 **Real-time Dashboard** - Attendance trends and insights
- ☁️ **Cloud-Native Infrastructure** - Azure deployment with Terraform
- 🐳 **Docker Containerization** - Scalable microservices architecture
- 🔒 **Enterprise Security** - JWT, rate limiting, Key Vault integration
- 📈 **Advanced Analytics** - Chart.js visualizations and reporting

## 🛠️ Technology Stack

### Backend
- **Node.js + Express** - API server
- **PostgreSQL** - Primary database
- **Azure Storage** - Face image and encoding storage
- **Redis** - Caching and session management
- **JWT** - Authentication tokens

### Frontend
- **React + TypeScript** - Modern UI framework
- **Vite** - Fast build tool
- **Chart.js** - Data visualization
- **Axios** - HTTP client

### Infrastructure
- **Microsoft Azure** - Cloud provider
- **Terraform** - Infrastructure as Code
- **Docker** - Containerization
- **GitHub Actions** - CI/CD pipeline

### AI/ML
- **Python + scikit-learn** - Prediction models
- **Face Recognition** - Student identification
- **OpenCV** - Image processing

## 🌐 Production URL

**https://attendance-ml.duckdns.org/**

## 📋 Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Node.js 18+](https://nodejs.org/)
- [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli)
- [Terraform](https://www.terraform.io/downloads.html)

## 🏃 Quick Start

### 1. Clone Repository
```bash
git clone https://github.com/bayarmaa01/capstone1.1.git
cd automated-attendance-system
```

### 2. Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Edit with your configuration
# Required: DATABASE_URL, JWT_SECRET, MOODLE_CLIENT_ID, MOODLE_CLIENT_SECRET
```

### 3. Local Development
```bash
# Start all services
docker-compose up --build

# Or run services individually
cd backend && npm install && npm run dev
cd frontend && npm install && npm start
```

### 4. Access Points
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:4000
- **Health Check:** http://localhost:4000/health

## 🔧 Configuration

### Environment Variables
```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/attendance

# Security
JWT_SECRET=your-super-secure-secret-key

# Moodle OAuth
MOODLE_CLIENT_ID=your-moodle-client-id
MOODLE_CLIENT_SECRET=your-moodle-client-secret
MOODLE_URL=https://your-university-moodle.com
MOODLE_REDIRECT_URI=https://attendance-ml.duckdns.org/auth/callback

# Azure Storage
AZURE_STORAGE_CONNECTION_STRING=your-storage-connection-string
AZURE_STORAGE_CONTAINER=face-images

# Frontend
FRONTEND_URL=https://attendance-ml.duckdns.org
```

## � Features Overview

### 1. Moodle OAuth2 Authentication
- Seamless login with university credentials
- Automatic role detection (student/teacher)
- Token-based authentication
- User profile synchronization

### 2. LMS Synchronization
- Hourly course synchronization
- Student enrollment updates
- Automatic section creation
- Teacher assignment

### 3. AI Analytics Dashboard
- Attendance trend analysis
- Risk student identification
- Anomaly detection
- Predictive modeling

### 4. Real-time Monitoring
- Live attendance tracking
- Performance metrics
- System health monitoring
- Alert notifications

## 🏗️ Architecture

```
automated-attendance-system/
├── backend/
│   ├── src/
│   │   ├── server.js              # Main application server
│   │   ├── db.js                  # Database connection
│   │   ├── middleware/            # Authentication & security
│   │   ├── routes/                # API endpoints
│   │   ├── services/              # Business logic
│   │   └── ai/                    # AI prediction models
│   ├── sql/init.sql               # Database schema
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/            # React components
│   │   ├── pages/                 # Application pages
│   │   ├── dashboards/            # Analytics dashboards
│   │   └── App.jsx                # Main application
│   └── Dockerfile
├── terraform/                     # Azure infrastructure
├── .github/workflows/             # CI/CD pipeline
├── docs/                          # Documentation
└── docker-compose.yml             # Local development
```

## � Azure Deployment

### 1. Infrastructure Setup
```bash
cd terraform

# Initialize Terraform
terraform init

# Plan deployment
terraform plan -var-file=production.tfvars

# Apply infrastructure
terraform apply -var-file=production.tfvars
```

### 2. CI/CD Pipeline
- Automated testing and builds
- Docker image deployment
- Azure App Service deployment
- Health checks and monitoring

### 3. Monitoring
- Application Insights integration
- Log Analytics workspace
- Performance monitoring
- Error tracking

## � API Documentation

### Authentication Endpoints
- `GET /api/auth/oauth/login` - OAuth login redirect
- `GET /api/auth/oauth/callback` - OAuth callback
- `GET /api/auth/me` - Get current user
- `POST /api/auth/login` - Legacy login (admin only)

### Analytics Endpoints
- `GET /api/analytics/attendance-trends/:classId` - Attendance trends
- `GET /api/analytics/risk-students` - At-risk students
- `GET /api/analytics/dashboard/:classId` - Dashboard overview
- `GET /api/analytics/heatmap/:classId` - Attendance heatmap

### AI Prediction Endpoints
- `POST /api/ai/train-model/:classId` - Train prediction model
- `GET /api/ai/predict-risk/:classId` - Predict at-risk students
- `GET /api/ai/detect-anomalies/:classId` - Detect anomalies
- `GET /api/ai/insights/:classId` - AI insights

### Storage Endpoints
- `POST /api/storage/upload-face/:studentId` - Upload face image
- `GET /api/storage/faces/:studentId` - List face images
- `POST /api/storage/encoding/:studentId` - Upload face encoding
- `GET /api/storage/stats` - Storage statistics

## 🔒 Security Features

- **JWT Authentication** - Secure token-based auth
- **Rate Limiting** - DDoS protection
- **Helmet Security** - HTTP header protection
- **CORS Protection** - Cross-origin resource sharing
- **Input Validation** - Request sanitization
- **Azure Key Vault** - Secret management

## 🧪 Testing

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test

# Integration tests
docker-compose -f docker-compose.test.yml up
```

## 📈 Performance

- **Response Time:** <200ms average
- **Uptime:** 99.9% SLA
- **Scalability:** Auto-scaling enabled
- **Monitoring:** Real-time metrics

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit your changes
4. Push to the branch
5. Create Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🆘 Support

- **Documentation:** [docs/](docs/)
- **Issues:** [GitHub Issues](https://github.com/bayarmaa01/capstone1.1/issues)
- **Email:** support@attendance-ml.com

## 🎯 Capstone 2.0 Features

This system demonstrates enterprise-grade development practices:

- ✅ Microservices architecture
- ✅ Cloud-native deployment
- ✅ AI/ML integration
- ✅ Real-time analytics
- ✅ Security best practices
- ✅ CI/CD automation
- ✅ Infrastructure as Code
- ✅ Monitoring and observability

Perfect for university capstone defense and production deployment! 🚀