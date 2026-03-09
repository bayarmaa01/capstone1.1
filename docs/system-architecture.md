# System Architecture Documentation

## Overview

The AI Attendance System is a cloud-native, microservices-based platform designed for university-scale attendance tracking with AI-powered analytics and LMS integration.

## Architecture Diagram

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   AI Services   │
│   (React)       │◄──►│   (Node.js)     │◄──►│   (Python)      │
│                 │    │                 │    │                 │
│ - Dashboard     │    │ - Auth Service  │    │ - Face Recog    │
│ - Analytics     │    │ - LMS Sync      │    │ - Prediction    │
│ - Attendance    │    │ - Analytics     │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Azure CDN     │    │  Azure App Svc  │    │ Azure Container │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                    ┌─────────────────┐
                    │   Azure Storage │
                    │   PostgreSQL    │
                    │   Key Vault     │
                    │   Redis Cache   │
                    └─────────────────┘
```

## Components

### 1. Frontend Application

**Technology:** React + TypeScript + Vite

**Responsibilities:**
- User interface and experience
- Real-time dashboard updates
- Data visualization (Chart.js)
- OAuth2 authentication flow
- Responsive design

**Key Features:**
- Teacher dashboard with analytics
- Student attendance view
- Real-time notifications
- Mobile-responsive design

### 2. Backend API Services

**Technology:** Node.js + Express

**Microservices:**

#### Authentication Service
- OAuth2 integration with Moodle
- JWT token management
- Role-based access control
- Session management

#### LMS Synchronization Service
- Hourly course synchronization
- Student enrollment updates
- Teacher assignment
- Data validation

#### Analytics Service
- Attendance trend analysis
- Risk student identification
- Performance metrics
- Report generation

#### Storage Service
- Azure Blob Storage integration
- Face image management
- Encoding data storage
- File optimization

### 3. AI/ML Services

**Technology:** Python + scikit-learn + OpenCV

**Components:**

#### Face Recognition Service
- Student identification
- Face embedding generation
- Real-time processing
- Confidence scoring

#### Prediction Service
- Risk student prediction
- Anomaly detection
- Pattern analysis
- Model training

## Data Flow

### 1. Authentication Flow
```
User → Frontend → Moodle OAuth → Backend → JWT Token → Dashboard
```

### 2. Attendance Recording Flow
```
Camera → Face Recognition → Student ID → Attendance Record → Analytics
```

### 3. LMS Synchronization Flow
```
Moodle API → Sync Service → Database → Notification → Frontend
```

### 4. Analytics Processing Flow
```
Attendance Data → Analytics Engine → Insights → Dashboard Visualization
```

## Database Schema

### Core Tables

**Users Table**
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  lms_id INTEGER UNIQUE,
  username TEXT UNIQUE,
  email TEXT,
  name TEXT,
  role TEXT CHECK (role IN ('student', 'teacher', 'admin')),
  lms_token TEXT,
  created_at TIMESTAMP DEFAULT now()
);
```

**Classes Table**
```sql
CREATE TABLE classes (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  instructor_id INT REFERENCES users(id),
  lms_course_id INTEGER UNIQUE,
  created_at TIMESTAMP DEFAULT now()
);
```

**Attendance Table**
```sql
CREATE TABLE attendance (
  id SERIAL PRIMARY KEY,
  class_id INT REFERENCES classes(id),
  student_id INT REFERENCES students(id),
  session_date DATE NOT NULL,
  present BOOLEAN DEFAULT true,
  method TEXT CHECK (method IN ('qr', 'face', 'manual')),
  confidence FLOAT DEFAULT 1.0,
  recorded_at TIMESTAMP DEFAULT now()
);
```

## Security Architecture

### 1. Authentication Layer
- OAuth2 with Moodle LMS
- JWT token-based authentication
- Role-based access control (RBAC)
- Session management

### 2. Application Security
- Helmet.js for HTTP headers
- Rate limiting (express-rate-limit)
- CORS protection
- Input validation and sanitization

### 3. Infrastructure Security
- Azure Key Vault for secrets
- Managed identities
- Network security groups
- SSL/TLS encryption

### 4. Data Protection
- Encrypted storage
- Secure file handling
- GDPR compliance
- Data retention policies

## Performance Architecture

### 1. Caching Strategy
- Redis for session storage
- Application-level caching
- CDN for static assets
- Database query optimization

### 2. Scalability Design
- Horizontal scaling with Azure App Service
- Load balancing
- Database connection pooling
- Asynchronous processing

### 3. Monitoring & Observability
- Application Insights
- Log Analytics
- Performance monitoring
- Health checks

## Deployment Architecture

### 1. Infrastructure as Code
- Terraform for Azure resources
- Environment configuration
- Automated provisioning
- Resource tagging

### 2. CI/CD Pipeline
- GitHub Actions workflows
- Automated testing
- Docker containerization
- Blue-green deployment

### 3. Environment Management
- Development/Staging/Production
- Configuration management
- Secret management
- Rollback strategies

## Integration Points

### 1. LMS Integration (Moodle)
- OAuth2 authentication
- REST API integration
- Real-time synchronization
- Data mapping

### 2. Azure Services
- Blob Storage for files
- PostgreSQL for data
- Key Vault for secrets
- App Service for hosting

### 3. Third-party Services
- DuckDNS for custom domain
- GitHub for source control
- Docker Hub for images
- Chart.js for visualization

## Disaster Recovery

### 1. Backup Strategy
- Automated database backups
- File storage replication
- Configuration backups
- Recovery point objectives

### 2. High Availability
- Multi-region deployment
- Load balancing
- Failover mechanisms
- Health monitoring

### 3. Incident Response
- Alerting systems
- Incident documentation
- Recovery procedures
- Post-incident analysis

## Future Scalability

### 1. Microservices Expansion
- Service mesh implementation
- Event-driven architecture
- API gateway
- Service discovery

### 2. AI/ML Enhancement
- Advanced prediction models
- Real-time processing
- Edge computing
- Model versioning

### 3. Multi-tenant Support
- University isolation
- Data segregation
- Custom configurations
- White-labeling

---

This architecture supports enterprise-scale deployment while maintaining security, performance, and reliability standards suitable for university production environments.
