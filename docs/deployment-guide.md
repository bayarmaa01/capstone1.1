# Deployment Guide

## Overview

This guide covers deploying the AI Attendance System to Microsoft Azure using Terraform and GitHub Actions CI/CD pipeline.

## Prerequisites

### Required Tools
- [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli)
- [Terraform](https://www.terraform.io/downloads.html) (v1.0+)
- [Docker](https://www.docker.com/get-started)
- [Git](https://git-scm.com/)

### Azure Permissions
- Azure subscription with Owner role
- Ability to create resource groups
- Ability to register applications in Azure AD

## Environment Setup

### 1. Azure Authentication
```bash
# Login to Azure
az login

# Set subscription
az account set --subscription "your-subscription-id"

# Verify login
az account show
```

### 2. Service Principal Creation
```bash
# Create service principal for Terraform
az ad sp create-for-rbac --name "attendance-ml-sp" --role="Contributor" --scopes="/subscriptions/your-subscription-id"

# Note the output values (needed for terraform.tfvars)
{
  "appId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "displayName": "attendance-ml-sp",
  "password": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "tenant": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

### 3. GitHub Secrets Configuration
Add these secrets to your GitHub repository:

```bash
# Azure Credentials
AZURE_CREDENTIALS='{"clientId":"appId","clientSecret":"password","subscriptionId":"subscription-id","tenantId":"tenant"}'
AZURE_CLIENT_ID=appId
AZURE_CLIENT_SECRET=password
AZURE_SUBSCRIPTION_ID=subscription-id
AZURE_TENANT_ID=tenant

# Application Secrets
DATABASE_URL=postgresql://user:password@server:5432/attendance
JWT_SECRET=your-super-secure-jwt-secret
MOODLE_CLIENT_ID=your-moodle-client-id
MOODLE_CLIENT_SECRET=your-moodle-client-secret
MOODLE_URL=https://your-moodle-instance.com
```

## Azure Deployment

### 1. Terraform Configuration

Create `terraform/terraform.tfvars`:
```hcl
# Azure Configuration
tenant_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
object_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

# Database Configuration
db_admin_password = "YourSecurePassword123!"
database_url = "postgresql://attendanceadmin:YourSecurePassword123!@server.postgres.database.azure.com:5432/attendance"

# Security Configuration
jwt_secret = "your-super-secure-jwt-secret-key-minimum-32-characters"

# Moodle OAuth Configuration
moodle_client_id = "your-moodle-oauth-client-id"
moodle_client_secret = "your-moodle-oauth-client-secret"
moodle_url = "https://your-university-moodle-instance.com"

# Domain Configuration
domain_name = "attendance-ml.duckdns.org"
```

### 2. Infrastructure Deployment
```bash
cd terraform

# Initialize Terraform
terraform init

# Plan deployment
terraform plan -var-file=terraform.tfvars

# Apply infrastructure
terraform apply -var-file=terraform.tfvars

# Note the outputs for configuration
terraform output
```

### 3. Database Setup
```bash
# Get database connection details from Terraform output
DB_HOST=$(terraform output -raw database_host)
DB_NAME=$(terraform output -raw database_name)

# Connect to database and initialize schema
psql "host=$DB_HOST dbname=$DB_NAME user=attendanceadmin sslmode=require" -f ../backend/sql/init.sql
```

### 4. Custom Domain Configuration

#### DuckDNS Setup
1. Log in to [DuckDNS](https://www.duckdns.org/)
2. Create domain: `attendance-ml.duckdns.org`
3. Point to Azure App Service IP

#### Azure DNS Configuration
```bash
# Get App Service IP
APP_IP=$(az webapp show --resource-group attendance-ml-rg --name attendance-ml-frontend --query "defaultHostName" -o tsv)

# Add CNAME record in DuckDNS
# attendance-ml.duckdns.org → APP_IP
```

### 5. SSL Certificate
```bash
# Upload SSL certificate to Azure
az webapp config ssl upload \
  --resource-group attendance-ml-rg \
  --name attendance-ml-frontend \
  --certificate-file path/to/certificate.pfx \
  --certificate-password certificate-password

# Configure SSL binding
az webapp config ssl bind \
  --resource-group attendance-ml-rg \
  --name attendance-ml-frontend \
  --certificate-thumbprint thumbprint \
  --ssl-type SNIEnabled
```

## Application Deployment

### 1. CI/CD Pipeline
The GitHub Actions workflow automatically:
- Tests and builds application
- Creates Docker images
- Deploys to Azure App Service
- Configures application settings
- Performs health checks

### 2. Manual Deployment
```bash
# Build Docker images
docker build -t attendance-backend ./backend
docker build -t attendance-frontend ./frontend

# Tag and push to Azure Container Registry
az acr login --name attendancemlregistry
docker tag attendance-backend attendancemlregistry.azurecr.io/attendance-backend:latest
docker tag attendance-frontend attendancemlregistry.azurecr.io/attendance-frontend:latest
docker push attendancemlregistry.azurecr.io/attendance-backend:latest
docker push attendancemlregistry.azurecr.io/attendance-frontend:latest

# Deploy to App Service
az webapp config container set \
  --resource-group attendance-ml-rg \
  --name attendance-ml-backend \
  --docker-custom-image-name attendancemlregistry.azurecr.io/attendance-backend:latest \
  --docker-registry-server-url https://attendancemlregistry.azurecr.io
```

### 3. Application Settings
```bash
# Configure backend settings
az webapp config appsettings set \
  --resource-group attendance-ml-rg \
  --name attendance-ml-backend \
  --settings \
  DATABASE_URL="$DATABASE_URL" \
  JWT_SECRET="$JWT_SECRET" \
  MOODLE_CLIENT_ID="$MOODLE_CLIENT_ID" \
  MOODLE_CLIENT_SECRET="$MOODLE_CLIENT_SECRET" \
  MOODLE_URL="$MOODLE_URL" \
  AZURE_STORAGE_CONNECTION_STRING="$AZURE_STORAGE_CONNECTION_STRING" \
  AZURE_STORAGE_CONTAINER="face-images"

# Configure frontend settings
az webapp config appsettings set \
  --resource-group attendance-ml-rg \
  --name attendance-ml-frontend \
  --settings \
  REACT_APP_API_URL="https://attendance-ml-backend.azurewebsites.net/api"
```

## Monitoring and Logging

### 1. Application Insights
```bash
# Get Application Insights key
APP_INSIGHTS_KEY=$(az monitor app-insights component show \
  --resource-group attendance-ml-rg \
  --app attendance-ml-ai \
  --query "instrumentationKey" -o tsv)

# Configure application to use App Insights
# Add APP_INSIGHTS_INSTRUMENTATION_KEY to app settings
```

### 2. Log Analytics
```bash
# Query logs
az monitor log-analytics query \
  --workspace attendance-ml-logs \
  --analytics-query "AppRequests | take 10"
```

### 3. Health Monitoring
```bash
# Check application health
curl https://attendance-ml-backend.azurewebsites.net/health

# Check frontend
curl https://attendance-ml.duckdns.org
```

## Troubleshooting

### Common Issues

#### 1. Database Connection Errors
```bash
# Check database firewall rules
az postgres server firewall-rule list \
  --resource-group attendance-ml-rg \
  --server attendance-ml-db

# Add client IP to firewall
az postgres server firewall-rule create \
  --resource-group attendance-ml-rg \
  --server attendance-ml-db \
  --name AllowClientIP \
  --start-ip-address $(curl -s ifconfig.me) \
  --end-ip-address $(curl -s ifconfig.me)
```

#### 2. SSL Certificate Issues
```bash
# Check SSL binding
az webapp config ssl list \
  --resource-group attendance-ml-rg \
  --name attendance-ml-frontend

# Reupload certificate if needed
az webapp config ssl delete \
  --resource-group attendance-ml-rg \
  --name attendance-ml-frontend \
  --certificate-thumbprint thumbprint
```

#### 3. Application Deployment Issues
```bash
# Check deployment logs
az webapp log tail \
  --resource-group attendance-ml-rg \
  --name attendance-ml-backend

# Restart application
az webapp restart \
  --resource-group attendance-ml-rg \
  --name attendance-ml-backend
```

### Performance Optimization

#### 1. App Service Scaling
```bash
# Scale up App Service
az webapp update \
  --resource-group attendance-ml-rg \
  --name attendance-ml-backend \
  --sku B2

# Enable auto-scaling
az monitor autoscale create \
  --resource-group attendance-ml-rg \
  --resource attendance-ml-backend \
  --min-count 1 \
  --max-count 5 \
  --count 1
```

#### 2. Database Performance
```bash
# Check database performance
az postgres server show \
  --resource-group attendance-ml-rg \
  --name attendance-ml-db

# Scale up database if needed
az postgres server update \
  --resource-group attendance-ml-rg \
  --name attendance-ml-db \
  --sku-name B_Standard_B2ms
```

## Maintenance

### 1. Regular Updates
- Update dependencies monthly
- Apply security patches
- Review and update Terraform configurations
- Monitor performance metrics

### 2. Backup and Recovery
```bash
# Create database backup
az postgres db create \
  --resource-group attendance-ml-rg \
  --server-name attendance-ml-db \
  --name attendance-backup-$(date +%Y%m%d)

# Restore from backup
az postgres db restore \
  --resource-group attendance-ml-rg \
  --server-name attendance-ml-db \
  --name attendance \
  --source-database attendance-backup-YYYYMMDD
```

### 3. Security Audits
- Review access permissions quarterly
- Update secrets regularly
- Monitor security logs
- Perform penetration testing

---

This deployment guide ensures a production-ready, secure, and scalable deployment of the AI Attendance System on Microsoft Azure.
