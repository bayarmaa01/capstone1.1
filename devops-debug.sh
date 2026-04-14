#!/bin/bash

# =======================================
# 🚀 Production Debug & Auto-Fix Script
# =======================================
# Usage: ./devops-debug.sh [fast|full]

set -e

# Configuration
FRONTEND_CONTAINER="blue_frontend"
BACKEND_CONTAINER="blue_backend"
DB_CONTAINER="postgres"
NGINX_CONTAINER="nginx"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔍 Production Debug Script Started${NC}"
echo "Mode: ${1:-full}"

# Function to check container status
check_container() {
    local container=$1
    local status=$(docker ps --filter "name=$container" --format "{{.Status}}")
    
    if [ "$status" = "running" ]; then
        echo -e "${GREEN}✅ $container is running${NC}"
        return 0
    else
        echo -e "${RED}❌ $container is not running${NC}"
        return 1
    fi
}

# Function to check API health
check_api_health() {
    local url=$1
    local response=$(curl -s -o /dev/null -w "%{http_code}" "$url")
    
    if [ "$response" = "200" ]; then
        echo -e "${GREEN}✅ API $url is healthy${NC}"
        return 0
    else
        echo -e "${RED}❌ API $url returned $response${NC}"
        return 1
    fi
}

# Function to check database connection
check_db() {
    echo -e "${BLUE}🔍 Checking database connection...${NC}"
    docker exec "$DB_CONTAINER" psql -U app -d attendance -c "SELECT 1;" > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Database connection successful${NC}"
        return 0
    else
        echo -e "${RED}❌ Database connection failed${NC}"
        return 1
    fi
}

# Function to fix common issues
auto_fix() {
    echo -e "${YELLOW}🔧 Attempting auto-fix...${NC}"
    
    # Fix 502 Bad Gateway (restart nginx)
    if ! check_container "$NGINX_CONTAINER"; then
        echo -e "${YELLOW}🔄 Restarting nginx...${NC}"
        docker restart "$NGINX_CONTAINER"
        sleep 5
    fi
    
    # Fix backend connection issues
    if ! check_api_health "http://localhost:4000/api/health"; then
        echo -e "${YELLOW}🔄 Restarting backend...${NC}"
        docker restart "$BACKEND_CONTAINER"
        sleep 10
    fi
    
    # Fix frontend build issues
    if ! check_container "$FRONTEND_CONTAINER"; then
        echo -e "${YELLOW}🔨 Rebuilding frontend...${NC}"
        docker-compose build "$FRONTEND_CONTAINER"
        sleep 5
    fi
    
    # Fix database connection
    if ! check_db; then
        echo -e "${YELLOW}🔄 Restarting database...${NC}"
        docker restart "$DB_CONTAINER"
        sleep 10
    fi
}

# Main checks
echo -e "${BLUE}📊 System Health Check${NC}"

# Check all containers
echo "Checking containers..."
check_container "$FRONTEND_CONTAINER"
check_container "$BACKEND_CONTAINER" 
check_container "$DB_CONTAINER"

# Check API endpoints
echo "Checking API endpoints..."
check_api_health "http://localhost:4000/api/health"
check_api_health "http://localhost:4000/api/classes"
check_api_health "http://localhost:4000/api/attendance"

# Check database
check_db

# Auto-fix if issues found
echo "Checking for issues..."
if [ "$1" = "fast" ]; then
    # Fast mode - only restart services
    auto_fix
elif [ "$1" = "full" ]; then
    # Full mode - restart + rebuild
    auto_fix
    
    # Check nginx configuration
    echo -e "${BLUE}🔍 Checking nginx configuration...${NC}"
    docker exec "$NGINX_CONTAINER" nginx -t > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Nginx configuration is valid${NC}"
    else
        echo -e "${RED}❌ Nginx configuration has errors${NC}"
    fi
    
    # Show recent logs
    echo -e "${BLUE}📋 Recent logs (last 50 lines):${NC}"
    echo "=== Backend Logs ==="
    docker logs --tail 50 "$BACKEND_CONTAINER"
    echo ""
    echo "=== Frontend Logs ==="
    docker logs --tail 20 "$FRONTEND_CONTAINER"
    echo ""
    echo "=== Nginx Logs ==="
    docker logs --tail 20 "$NGINX_CONTAINER"
fi

echo -e "${GREEN}✅ Debug script completed${NC}"
