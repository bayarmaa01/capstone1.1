# 🚀 AI Smart Attendance System

[![CI/CD Pipeline](https://github.com/bayarmaa01/capstone1.1/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/bayarmaa01/capstone1.1/actions/workflows/ci-cd.yml)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue?logo=docker)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18.x-green?logo=node.js)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.9-blue?logo=python)](https://python.org/)
[![HTTPS](https://img.shields.io/badge/HTTPS-Enabled-success?logo=letsencrypt)](https://letsencrypt.org/)

> **Production-ready AI-powered attendance management with face recognition, blue/green deployment, and Moodle LMS integration**

A comprehensive, cloud-native attendance system that revolutionizes educational institution management through advanced facial recognition, automated scheduling, and real-time analytics. Built with enterprise-grade DevOps practices and scalable microservices architecture.

---

## Live Demo

**[https://attendance-ml.duckdns.org](https://attendance-ml.duckdns.org)**

### Current Status: **PRODUCTION READY** 

| Component | Status | Details |
|-----------|--------|---------|
| HTTPS/SSL | **Working** | Let's Encrypt SSL certificates |
| Camera & Face Recognition | **Working** | Requires HTTPS for browser security |
| Attendance Recording | **Working** | Face-based attendance saving |
| Schedule API | **Working** | Fixed route matching issues |
| Database | **Connected** | PostgreSQL with proper constraints |
| Moodle LMS | **Ready** | Installation completed |
| Blue/Green Deployment | **Active** | Zero-downtime deployment working |

---

## Recent Updates & Changes

### **Latest Features Added** 

#### **HTTPS/SSL Implementation** 
- **Let's Encrypt SSL certificates** for secure HTTPS access
- **HTTP to HTTPS redirect** for all traffic
- **Camera functionality restored** - Now requires HTTPS for browser security
- **SSL certificate auto-renewal** support
- **Nginx SSL configuration** with modern security headers

#### **Attendance System Fixes**
- **Database constraint resolution** - Fixed `attendance_method_check` constraint
- **API route optimization** - Moved `/:id` routes before `/:classId` to prevent conflicts
- **Debug logging added** - Enhanced error tracking and troubleshooting
- **Method validation** - Changed from `facial_recognition` to `face_recognition`
- **Schedule API** - Added missing `GET /schedule/:id` endpoint

#### **Moodle LMS Integration**
- **Docker volume fixes** - Added `moodle_data` volume for persistent storage
- **Permission resolution** - Fixed data directory creation issues
- **Database configuration** - MariaDB setup with proper credentials
- **Web services ready** - API endpoints for integration
- **Installation wizard** - Complete setup process documented

#### **Blue/Green Deployment**
- **Zero-downtime switching** - Dynamic Nginx upstream configuration
- **Health checks** - Automated service validation
- **Rollback capability** - Instant fallback to previous version
- **Traffic management** - Smooth transition between environments

---

## 🏗️ System Architecture

```mermaid
graph TD
    User[User] --> Nginx[Nginx Gateway]
    Nginx --> Frontend[React Frontend]
    Nginx --> Backend[Node.js Backend]
    Nginx --> FaceService[Python Face Service]
    Nginx --> Moodle[Moodle LMS]
    
    Backend --> PostgreSQL[PostgreSQL]
    Backend --> Redis[Redis Cache]
    Backend --> Azure[Azure Storage]
    
    FaceService --> Azure
    FaceService --> Encodings[Face Encodings]
    
    subgraph "Blue/Green Deployment"
        Blue[Blue Environment]
        Green[Green Environment]
    end
```

### Architecture Overview
Our system follows a microservices architecture with clear separation of concerns:

- **Frontend Layer**: React SPA serving the user interface with HTTPS security
- **Gateway Layer**: Nginx reverse proxy with SSL termination and load balancing
- **Service Layer**: Node.js backend API and Python face recognition service
- **Data Layer**: PostgreSQL for persistent data, Redis for caching
- **Storage Layer**: Azure Blob Storage for face images and encodings
- **Integration Layer**: Moodle LMS for academic data synchronization

---

## CI/CD Pipeline Architecture

```mermaid
graph LR
    Code[Code Push] --> GitHub[GitHub Actions]
    GitHub --> Tests[Parallel Tests]
    Tests --> Build[Docker Build]
    Build --> Security[Security Scan]
    Security --> Push[Push to Registry]
    Push --> Deploy[Blue/Green Deploy]
    Deploy --> Monitor[Health Monitoring]
    
    subgraph "Testing Suite"
        Tests --> Backend[Backend Tests]
        Tests --> Frontend[Frontend Tests]
        Tests --> Face[Face Service Tests]
        Tests --> SecurityTests[Security Tests]
    end
    
    subgraph "Deployment Flow"
        Deploy --> BlueDeploy[Deploy to Blue]
        Deploy --> GreenDeploy[Deploy to Green]
        BlueDeploy --> HealthCheck[Health Check]
        GreenDeploy --> TrafficSwitch[Traffic Switch]
        HealthCheck --> Rollback[Rollback if Failed]
        TrafficSwitch --> Production[Production Ready]
    end
```

### Pipeline Stages

1. **Code Analysis**: Automated code quality checks and security scanning
2. **Parallel Testing**: Backend, frontend, and face service tests executed simultaneously
3. **Multi-Stage Build**: Optimized Docker builds with security scanning
4. **Registry Push**: Versioned Docker images with proper tagging
5. **Blue/Green Deployment**: Zero-downtime deployment with health validation
6. **Monitoring**: Continuous health checks and performance metrics

---

## Blue/Green Deployment Flow

```mermaid
graph TD
    subgraph "Current Production"
        CurrentUsers[Current Users] --> CurrentNginx[Nginx - Blue]
        CurrentNginx --> CurrentBackend[Backend - Blue]
        CurrentNginx --> CurrentFrontend[Frontend - Blue]
        CurrentNginx --> CurrentFace[Face Service - Blue]
    end
    
    subgraph "New Deployment"
        NewCode[New Code] --> GreenDeploy[Deploy to Green]
        GreenDeploy --> GreenBuild[Build Services]
        GreenBuild --> GreenHealth[Health Checks]
        GreenHealth --> GreenTest[Smoke Tests]
    end
    
    subgraph "Traffic Switch"
        SwitchDecision{Health OK?}
        SwitchDecision -->|Yes| TrafficSwitch[Switch Traffic]
        SwitchDecision -->|No| Rollback[Rollback to Blue]
        TrafficSwitch --> NewUsers[Users to Green]
        Rollback --> BlueStays[Blue Remains Active]
    end
    
    GreenTest --> SwitchDecision
    NewUsers --> GreenNginx[Nginx - Green]
    GreenNginx --> GreenBackend[Backend - Green]
    GreenNginx --> GreenFrontend[Frontend - Green]
    GreenNginx --> GreenFace[Face Service - Green]
```

### Zero-Downtime Strategy Features
- **Instant Traffic Switching**: Nginx upstream configuration updated dynamically
- **Health Validation**: Comprehensive health checks before traffic switch
- **Automatic Rollback**: Instant fallback to previous version on failure
- **Database Migration**: Safe database schema migrations
- **Session Persistence**: User sessions maintained during deployment

---

## Data Flow Architecture

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Nginx
    participant Backend
    participant FaceService
    participant Database
    participant Storage
    
    User->>Frontend: Access Application
    Frontend->>Nginx: HTTPS Request
    Nginx->>Backend: API Call
    
    alt Face Recognition
        Backend->>FaceService: Face Recognition Request
        FaceService->>Storage: Fetch Encodings
        Storage-->>FaceService: Face Data
        FaceService-->>Backend: Recognition Result
    end
    
    Backend->>Database: Save Attendance
    Database-->>Backend: Confirmation
    Backend-->>Nginx: Response
    Nginx-->>Frontend: HTTPS Response
    Frontend-->>User: Updated UI
```

---

## Security Architecture

```mermaid
graph TB
    Internet[Internet] --> Firewall[Firewall]
    Firewall --> LoadBalancer[Load Balancer]
    LoadBalancer --> Nginx[Nginx - SSL Termination]
    
    Nginx --> Frontend[React Frontend]
    Nginx --> Backend[Backend API]
    Nginx --> FaceService[Face Service]
    Nginx --> Moodle[Moodle LMS]
    
    subgraph "Security Layers"
        SSL[SSL/TLS Encryption]
        Auth[JWT Authentication]
        Rate[Rate Limiting]
        CORS[CORS Protection]
        Input[Input Validation]
        Container[Container Security]
    end
    
    Backend --> Auth
    Backend --> Rate
    Backend --> Input
    Nginx --> SSL
    Nginx --> CORS
    
    subgraph "Data Protection"
        PostgreSQL[(PostgreSQL)]
        Redis[(Redis Cache)]
        Azure[Azure Storage]
    end
    
    Backend --> PostgreSQL
    Backend --> Redis
    FaceService --> Azure
```

---

## Microservices Communication

```mermaid
graph TB
    subgraph "Frontend Services"
        React[React App]
        Auth[Auth Service]
        Camera[Camera Component]
        Dashboard[Dashboard]
    end
    
    subgraph "API Gateway"
        Nginx[Nginx Proxy]
        SSL[SSL Handler]
        Router[Route Manager]
    end
    
    subgraph "Backend Services"
        NodeAPI[Node.js API]
        Attendance[Attendance Service]
        Schedule[Schedule Service]
        Analytics[Analytics Service]
    end
    
    subgraph "AI Services"
        PythonAPI[Python API]
        FaceRecognition[Face Recognition]
        Encoding[Face Encoding]
    end
    
    subgraph "Data Services"
        PostgreSQL[(PostgreSQL)]
        Redis[(Redis Cache)]
        AzureBlob[Azure Storage]
    end
    
    React --> Nginx
    Auth --> Nginx
    Camera --> Nginx
    Dashboard --> Nginx
    
    Nginx --> NodeAPI
    Nginx --> PythonAPI
    
    NodeAPI --> Attendance
    NodeAPI --> Schedule
    NodeAPI --> Analytics
    NodeAPI --> PostgreSQL
    NodeAPI --> Redis
    
    PythonAPI --> FaceRecognition
    PythonAPI --> Encoding
    PythonAPI --> AzureBlob
```

---

## 🧰 Tech Stack

### 🎨 Frontend
- **React 18** - Modern UI framework with hooks and concurrent features
- **Material-UI (MUI)** - Professional component library with theming
- **Axios** - HTTP client with interceptors and error handling
- **React Router** - Client-side routing with lazy loading
- **Chart.js** - Interactive data visualization

### � Backend
- **Node.js 18** - High-performance JavaScript runtime
- **Express.js** - Fast, minimalist web framework
- **PostgreSQL** - Robust relational database with ACID compliance
- **Redis** - In-memory data structure store for caching
- **JWT** - Secure token-based authentication
- **Prisma** - Modern database ORM with type safety

### 🤖 AI Services
- **Python 3.9** - Face recognition service with scientific computing
- **OpenCV** - Computer vision library for face detection
- **Face Recognition** - Deep learning-based face recognition
- **NumPy** - Numerical computing for image processing
- **Flask** - Lightweight Python web framework

### 🐳 DevOps & Infrastructure
- **Docker** - Containerization with multi-stage builds
- **Docker Compose** - Multi-container orchestration
- **Nginx** - High-performance reverse proxy and load balancer
- **GitHub Actions** - CI/CD pipeline with parallel execution
- **AWS EC2** - Scalable cloud hosting
- **Azure Storage** - Secure blob storage for media files
- **Let's Encrypt** - Free SSL/TLS certificates

## 📦 Project Structure

```
ai-attendance-system/
├── 📁 backend/                 # Node.js API service
│   ├── 📁 src/
│   │   ├── 📁 controllers/     # Route controllers
│   │   ├── 📁 middleware/      # Express middleware
│   │   ├── 📁 models/          # Database models
│   │   ├── 📁 routes/          # API routes
│   │   ├── 📁 services/        # Business logic
│   │   └── 📄 server.js        # Application entry point
│   ├── 📁 tests/               # Test files
│   ├── 📄 package.json
│   └── 📄 Dockerfile
├── 📁 frontend/               # React application
│   ├── 📁 src/
│   │   ├── 📁 components/      # Reusable components
│   │   ├── 📁 pages/           # Page components
│   │   ├── 📁 services/        # API services
│   │   └── 📄 App.jsx          # Main app component
│   ├── 📁 public/
│   ├── 📄 package.json
│   └── 📄 Dockerfile
├── 📁 face-service/           # Python AI service
│   ├── 📁 app/
│   │   ├── 📄 face_recognition.py
│   │   └── 📄 api.py
│   ├── 📁 tests/
│   ├── 📄 requirements.txt
│   └── 📄 Dockerfile
├── 📁 nginx/                  # Nginx configuration
│   └── 📄 nginx.prod.conf
├── 📁 .github/workflows/       # CI/CD pipeline
│   └── 📄 ci-cd.yml
├── 📄 docker-compose.yml       # Main orchestration
├── 📄 deploy.sh               # Deployment script
├── 📄 .env.example            # Environment template
└── 📄 README.md               # This file
```

---

## ⚙️ Installation & Setup

### 🚀 Quick Start

### Prerequisites
- **Docker** & **Docker Compose**
- **Git**
- **Linux Server** (for production deployment)

### Production Deployment

```bash
# 1. Clone the repository
git clone https://github.com/bayarmaa01/capstone1.1.git
cd capstone1.1

# 2. Configure SSL certificates (production)
sudo certbot certonly --standalone -d your-domain.com

# 3. Start the system
docker compose up -d --build

# 4. Access the application
open https://your-domain.com
```

### Local Development

```bash
# Clone and start
git clone https://github.com/bayarmaa01/capstone1.1.git
cd capstone1.1
docker compose up -d

# Access locally
# Frontend: http://localhost:3000
# Backend API: http://localhost:4000
# Face Service: http://localhost:5001
# Moodle: http://localhost/moodle
```

---

## 🌐 Environment Variables

Create a `.env` file with the following configuration:

```bash
# 🗄️ Database Configuration
DATABASE_URL=postgresql://app:strong_password@postgres:5432/attendance
POSTGRES_PASSWORD=strong_password

# ⚡ Cache Configuration
REDIS_URL=redis://redis:6379

# 🔐 Security Configuration
JWT_SECRET=your_32_character_random_secret_key
NODE_ENV=production

# ☁️ Azure Storage
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=yourstorage;AccountKey=your_key;EndpointSuffix=core.windows.net
AZURE_STORAGE_CONTAINER=face-images

# 🎓 Moodle Integration
MOODLE_URL=https://attendance-ml.duckdns.org/moodle
MOODLE_TOKEN=your_moodle_api_token
MOODLE_WS_TOKEN=your_moodle_web_service_token

# 🌐 Frontend Configuration
REACT_APP_API_URL=https://attendance-ml.duckdns.org/api
REACT_APP_FACE_SERVICE_URL=https://attendance-ml.duckdns.org/face
FRONTEND_URL=https://attendance-ml.duckdns.org
```

---

## 🔍 API Endpoints

### 🏥 Health Checks
```bash
GET /health              # System health check
GET /api/health          # Backend service health
GET /face/health         # Face service health
```

### 👤 Authentication
```bash
POST /api/auth/login     # User login
POST /api/auth/register  # User registration
POST /api/auth/refresh   # Token refresh
```

### 📊 Attendance Management
```bash
GET /api/attendance      # Get attendance records
POST /api/attendance     # Mark attendance
GET /api/analytics       # Attendance analytics
```

### 🤖 Face Recognition
```bash
POST /face/recognize     # Face recognition
POST /face/register      # Register new face
GET /face/encodings      # Get face encodings
```

---

## ❤️ Health Checks

### 🏥 Docker Health Checks
Each service includes built-in health checks:

```dockerfile
# Backend health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Face service health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD python -c "import requests; requests.get('http://localhost:5001/health', timeout=5)"
```

### 🌐 Nginx Health Routing
Nginx routes traffic only to healthy services:
- **Automatic failover** to healthy instances
- **Health check endpoint** at `/health`
- **Service monitoring** with automatic recovery

---

## 🔐 Security Features

### 🛡️ Web Security
- **HTTPS/SSL** encryption with Let's Encrypt
- **Rate limiting** (10r/s API, 5r/s face recognition)
- **Security headers** (HSTS, XSS protection, CORS)
- **Input validation** and SQL injection prevention

### 🔒 Authentication & Authorization
- **JWT-based authentication** with refresh tokens
- **Role-based access control** (admin, user, instructor)
- **Session management** with Redis
- **Password hashing** with bcrypt

### 🐳 Container Security
- **Non-root users** in all containers
- **Minimal base images** for reduced attack surface
- **Secret management** through environment variables
- **Network isolation** with Docker networks

---

## 📊 Features

### 🧠 Face Recognition Attendance
- **Real-time face detection** using OpenCV
- **Face encoding storage** for accurate recognition
- **Liveness detection** to prevent spoofing
- **Multi-face support** for group attendance

### 📱 QR Code Attendance
- **Quick QR generation** for courses/events
- **Mobile-friendly scanning** interface
- **Time-based QR codes** for security
- **Offline capability** with sync later

### 🎓 Moodle LMS Integration
- **Automatic course synchronization**
- **Grade book integration**
- **User account management**
- **Assignment tracking**

### 📈 Analytics & Reporting
- **Real-time dashboards** with attendance trends
- **Risk detection alerts** for <75% attendance
- **Export functionality** (PDF, Excel, CSV)
- **Custom reporting** with filters

---

## 🚀 Deployment

### 🔄 CI/CD Pipeline
Our system uses GitHub Actions for automated deployment:

1. **Code Push** → Triggers pipeline
2. **Parallel Testing** → Backend, Frontend, Face Service
3. **Docker Build** → Multi-stage optimized builds
4. **Registry Push** → Docker Hub with versioning
5. **Blue/Green Deploy** → Zero-downtime deployment

### 🐳 Docker Deployment
```bash
# Production deployment
docker compose up -d

# Blue/Green deployment
chmod +x deploy.sh
./deploy.sh
```

### ☁️ AWS EC2 Setup
- **Instance type**: t3.medium or higher
- **Security groups**: 80, 443, 22, 8080
- **SSL certificates**: Let's Encrypt automation
- **Domain**: DuckDNS dynamic DNS

---

## 🧠 Future Improvements

### 🏗️ Kubernetes Migration
- **Container orchestration** with K8s
- **Auto-scaling** based on load
- **Service mesh** with Istio
- **Helm charts** for deployment

### 📊 Monitoring & Observability
- **Prometheus** metrics collection
- **Grafana** dashboards
- **ELK stack** for logging
- **Jaeger** distributed tracing

### 🤖 AI Enhancements
- **Deep learning models** for better accuracy
- **Behavioral analysis** for engagement
- **Predictive analytics** for attendance patterns
- **Mobile face recognition** SDK

---

## � Team & Academic Information

**Capstone Project – Group 2RGD0037**

🎓 Program: B.Tech Computer Science Engineering (DevOps)  
🏫 University: Lovely Professional University (LPU)  
📍 Location: Phagwara, Punjab, India  
📅 Year: 4th Year (Final Year Capstone Project)

### �‍💻 Team Members
- Munkh Erdene Khurtsbileg  
- Ankush Pal  
- Bayarmaa Bumandorj  
- Aarohan Sarkar  
- Rudrax Bhalerao  

### 🎓 Supervisor
Dr. Amandeep Singh  
Assistant Professor  
School of Computer Application  
Lovely Professional University  

Area of Specialization: Next Generation Programming Systems

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

Our team extends gratitude to:
- **OpenCV** for face recognition capabilities
- **React** for modern frontend framework
- **Docker** for containerization
- **GitHub Actions** for CI/CD pipeline
- **Moodle** for LMS integration support
- **Dr. Amandeep Singh** for valuable guidance and supervision
- **Lovely Professional University** for providing resources and support

---

⭐ **If this project helped you, please give it a star!** 🌟

---

## 🚀 Quick Start

### Prerequisites
- **Docker** & **Docker Compose**
- **Git**
- **SSL certificates** (for production)

### Local Development
```bash
# Clone the repository
git clone https://github.com/bayarmaa01/capstone1.1.git
cd capstone1.1

# Start all services
docker compose up -d

# Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:4000
# Face Service: http://localhost:5001
```

### Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Configure your services
# - Database credentials
# - Azure Storage keys
# - Moodle integration settings
# - JWT secrets
```

---

## 🧪 Testing Strategy

### 📋 Test Coverage
```bash
# Backend Tests
npm run test:unit          # Unit tests with mocked dependencies
npm run test:integration   # API integration tests
npm run test:ci           # Full test suite for CI/CD

# Frontend Tests
npm run test:ci           # Component testing with React Testing Library

# Face Service Tests
pytest tests/ --cov       # Python tests with coverage reporting
```

### 🔍 Quality Assurance
- **Unit Testing**: 85%+ code coverage target
- **Integration Testing**: API endpoint validation
- **Security Testing**: Trivy vulnerability scanning
- **Performance Testing**: Load testing with Artillery
- **Cross-browser Testing**: Chrome, Firefox, Safari compatibility

---

## 📚 API Documentation

### 🔐 Authentication Endpoints
```http
POST /api/auth/login          # User authentication
POST /api/auth/refresh        # Token refresh
POST /api/auth/logout          # Session termination
```

### 📊 Attendance Endpoints
```http
GET  /api/attendance/classes     # List all classes
POST /api/attendance/mark         # Mark attendance manually
GET  /api/attendance/report/:id  # Class attendance report
```

### 🤖 Face Service Endpoints
```http
POST /face/recognize           # Face recognition
GET  /face/enrolled             # List enrolled students
POST /face/enroll/:studentId     # Enroll new student
DELETE /face/unenroll/:studentId  # Remove student enrollment
```

---

## 🎯 Performance & Scalability

### ⚡ Optimization Techniques
- **Database Indexing**: Optimized queries for large datasets
- **Caching Strategy**: Redis for session and API caching
- **CDN Integration**: Azure CDN for static assets
- **Image Compression**: WebP format for faster loading
- **Lazy Loading**: React code splitting for better UX

### 📈 Scalability Metrics
- **Concurrent Users**: 1000+ simultaneous users
- **Face Processing**: 10+ faces per second
- **Database Connections**: Pool management for efficiency
- **Memory Usage**: <512MB per container
- **Response Time**: <200ms average API response

---

## 🤝 Contributing Guidelines

### 📋 Development Workflow
1. **Fork** the repository
2. **Create** feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** changes: `git commit -m "Add amazing feature"`
4. **Push** to branch: `git push origin feature/amazing-feature`
5. **Create** Pull Request with detailed description

### 🧪 Code Quality Standards
- **ESLint**: Consistent code formatting
- **Prettier**: Automated code styling
- **Husky**: Pre-commit hooks for quality
- **Tests**: 85%+ coverage required for new features
- **Documentation**: Update README for API changes

---

## 📞 Troubleshooting

### 🔧 Common Issues & Solutions

#### Docker Issues
```bash
# Port conflicts
lsof -i :4000  # Check what's using port 4000

# Container logs
docker compose logs backend  # View service logs

# Rebuild services
docker compose down && docker compose up --build
```

#### Database Issues
```bash
# Connection problems
psql -h localhost -U postgres -d attendance  # Test DB connection

# Reset database
docker compose down -v  # Remove volumes
docker compose up -d     # Fresh start
```

#### Face Recognition Issues
```bash
# Low lighting conditions
# Ensure good lighting for better recognition accuracy

# Camera permissions
# Check browser camera permissions in settings

# Model retraining
# Delete encodings/*.pkl and re-enroll students
```

---

## 📄 License

This project is licensed under the **MIT License** - see [LICENSE](LICENSE) file for details.

---

## 👥 Team Members

Munkh Erdene Khurtsbileg  
Ankush Pal  
Bayarmaa Bumandorj  
Aarohan Sarkar  
Rudrax Bhalerao  

School of Computer Science, Lovely Professional University  
Phagwara, Punjab, India

---

## 🎓 Supervisor

**Dr. Amandeep Singh**  
Assistant Professor  
School of Computer Application  
Lovely Professional University

## 🙏 Acknowledgments

Our team extends gratitude to:
- **OpenCV** - Computer vision library
- **face_recognition** - Face detection algorithms
- **React** - Frontend framework
- **Express.js** - Backend framework
- **Docker** - Containerization platform
- **Dr. Amandeep Singh** for mentorship and guidance
- **Lovely Professional University** for academic support

---

## 📞 Contact & Support

### 📧 Getting Help
- **Documentation**: This README covers most scenarios
- **Issues**: [GitHub Issues](https://github.com/bayarmaa01/capstone1.1/issues) for bug reports
- **Discussions**: [GitHub Discussions](https://github.com/bayarmaa01/capstone1.1/discussions) for questions

---

> **🚀 Built with passion by our team for revolutionizing education through AI and modern technology**

*This project demonstrates our team's expertise in full-stack development, DevOps practices, AI integration, and production-ready software engineering.*
