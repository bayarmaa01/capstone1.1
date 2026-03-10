# 🔐 Azure Storage Setup Guide

## 🚨 **Security Issue - RESOLVED**

The Azure Storage Account Access Key has been removed from the repository to comply with GitHub's security policies.

---

## ✅ **What Was Fixed**

### **Problem:**
- **Issue:** Azure Storage Account Access Key was committed to `docker-compose.yml`
- **Risk:** Security vulnerability - secrets exposed in version control
- **GitHub Action:** Push protection blocked the commit

### **Solution:**
- **Removed:** Hard-coded Azure Storage connection string
- **Replaced:** Environment variable `${AZURE_STORAGE_CONNECTION_STRING}`
- **Security:** Secrets now properly managed via environment variables

---

## 🔧 **How to Set Up Azure Storage Connection**

### **1. Get Your Azure Storage Connection String**

```bash
# Via Azure Portal
1. Go to Azure Portal → Storage Accounts
2. Select your storage account (attendanceblob01)
3. Go to "Access keys" section
4. Copy the "Connection string"

# Via Azure CLI
az storage account show-connection-string \
  --name attendanceblob01 \
  --resource-group attendance-ml-rg
```

### **2. Set Environment Variable**

#### **For Local Development:**
```bash
# Create .env file
cp .env.example .env

# Edit .env file
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=attendanceblob01;AccountKey=YOUR_ACTUAL_KEY;EndpointSuffix=core.windows.net
```

#### **For Docker Compose:**
```bash
# Set environment variable before running docker-compose
export AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=attendanceblob01;AccountKey=YOUR_ACTUAL_KEY;EndpointSuffix=core.windows.net"

# Or use .env file with docker-compose
echo "AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=attendanceblob01;AccountKey=YOUR_ACTUAL_KEY;EndpointSuffix=core.windows.net" >> .env
```

#### **For Production (Azure VM):**
```bash
# SSH into Azure VM
ssh azureuser@your-vm-ip

# Set environment variable
echo 'export AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=attendanceblob01;AccountKey=YOUR_ACTUAL_KEY;EndpointSuffix=core.windows.net"' >> ~/.bashrc

# Reload shell
source ~/.bashrc
```

#### **For GitHub Actions:**
```yaml
# In GitHub repository settings
1. Go to Settings → Secrets and variables → Actions
2. Add new repository secret:
   - Name: AZURE_STORAGE_CONNECTION_STRING
   - Value: Your actual connection string
```

---

## 🐳 **Docker Compose Usage**

### **Current Configuration:**
```yaml
backend:
  environment:
    AZURE_STORAGE_CONNECTION_STRING: ${AZURE_STORAGE_CONNECTION_STRING}
```

### **How to Run:**
```bash
# Method 1: Export environment variable
export AZURE_STORAGE_CONNECTION_STRING="your-connection-string"
docker-compose up

# Method 2: Use .env file
echo "AZURE_STORAGE_CONNECTION_STRING=your-connection-string" >> .env
docker-compose up

# Method 3: Pass directly
AZURE_STORAGE_CONNECTION_STRING="your-connection-string" docker-compose up
```

---

## 🔍 **Verification**

### **Check Azure Storage Integration:**
```bash
# Test backend service
curl http://localhost:4000/api/storage/test

# Check if Azure Storage is working
# Should return success message if connection string is valid
```

### **Verify Environment Variable:**
```bash
# Check if environment variable is set
echo $AZURE_STORAGE_CONNECTION_STRING

# In Docker container
docker exec attendance-backend env | grep AZURE_STORAGE_CONNECTION_STRING
```

---

## 🚀 **Deployment Instructions**

### **1. Local Development:**
```bash
# 1. Copy environment template
cp .env.example .env

# 2. Edit .env with your Azure Storage connection string
# 3. Start services
docker-compose up
```

### **2. Production Deployment:**
```bash
# 1. SSH to Azure VM
ssh azureuser@your-vm-ip

# 2. Set environment variable
export AZURE_STORAGE_CONNECTION_STRING="your-connection-string"

# 3. Pull latest code
git pull origin main

# 4. Restart services
docker-compose down
docker-compose up -d
```

### **3. GitHub Actions:**
```bash
# The workflow will automatically use the secret from GitHub Secrets
# No manual configuration needed after setting up the repository secret
```

---

## 🔒 **Security Best Practices**

### **✅ Do:**
- Store connection strings in environment variables
- Use GitHub Secrets for CI/CD
- Rotate keys regularly
- Use Azure Key Vault for production

### **❌ Don't:**
- Commit secrets to version control
- Share connection strings in plain text
- Use production keys in development
- Hard-code secrets in configuration files

---

## 🛠️ **Troubleshooting**

### **Common Issues:**

#### **"Invalid connection string" error:**
```bash
# Verify connection string format
echo $AZURE_STORAGE_CONNECTION_STRING | grep -q "DefaultEndpointsProtocol"
```

#### **"Access denied" error:**
```bash
# Check if storage account exists
az storage account show --name attendanceblob01

# Verify key is valid
az storage account keys list --account-name attendanceblob01
```

#### **"Environment variable not found" error:**
```bash
# Check if variable is set
echo $AZURE_STORAGE_CONNECTION_STRING

# Set it if missing
export AZURE_STORAGE_CONNECTION_STRING="your-connection-string"
```

---

## 📞 **Support**

### **Azure Storage Documentation:**
- [Azure Storage Connection Strings](https://docs.microsoft.com/en-us/azure/storage/common/storage-configure-connection-string)
- [Storage Account Keys](https://docs.microsoft.com/en-us/azure/storage/common/storage-account-keys-manage)

### **System Documentation:**
- `DEPLOYMENT.md` - Complete deployment guide
- `DEPLOYMENT_STATUS.md` - Current system status
- `/docs/` - Technical documentation

---

## ✅ **Current Status: SECURE**

- ✅ **Secrets Removed** from version control
- ✅ **Environment Variables** properly configured
- ✅ **GitHub Push Protection** satisfied
- ✅ **Security Best Practices** implemented
- ✅ **System Ready** for deployment

---

**🎉 Your AI Smart Attendance System is now secure and ready for production deployment!**

---

*Last Updated: March 2026*
*Security Status: Compliant*
*Next Step: Set environment variables and deploy*
