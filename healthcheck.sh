#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${1:-http://localhost:8080}"
BACKEND_URL="$BASE_URL/api/health"
FRONTEND_URL="$BASE_URL/health"
FACE_SERVICE_URL="$BASE_URL/api/face/health"
TIMEOUT=30
MAX_RETRIES=5

echo -e "${YELLOW}🏥 Starting comprehensive health check...${NC}"

# Function to check endpoint
check_endpoint() {
    local url=$1
    local name=$2
    local attempts=0
    
    while [ $attempts -lt $MAX_RETRIES ]; do
        if curl -f -s --max-time $TIMEOUT "$url" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ $name: HEALTHY${NC}"
            return 0
        else
            attempts=$((attempts + 1))
            echo -e "${YELLOW}⚠️ $name: Attempt $attempts/$MAX_RETRIES failed${NC}"
            if [ $attempts -lt $MAX_RETRIES ]; then
                sleep 10
            fi
        fi
    done
    
    echo -e "${RED}❌ $name: UNHEALTHY${NC}"
    return 1
}

# Function to check Docker containers
check_containers() {
    echo -e "${YELLOW}🐳 Checking Docker containers...${NC}"
    
    local containers=("blue_backend" "green_backend" "blue_frontend" "green_frontend" "blue_face-service" "green_face-service" "nginx" "postgres" "redis")
    local running_containers=0
    
    for container in "${containers[@]}"; do
        if docker ps --format "table {{.Names}}" | grep -q "$container"; then
            echo -e "${GREEN}✅ $container: RUNNING${NC}"
            running_containers=$((running_containers + 1))
        else
            echo -e "${RED}❌ $container: STOPPED${NC}"
        fi
    done
    
    echo -e "${YELLOW}📊 Total running containers: $running_containers/${#containers[@]}${NC}"
}

# Function to check system resources
check_system() {
    echo -e "${YELLOW}📈 Checking system resources...${NC}"
    
    # CPU usage
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}')
    echo -e "${YELLOW}🖥️ CPU Usage: ${cpu_usage}%${NC}"
    
    # Memory usage
    local memory_info=$(free -m | awk 'NR==2{printf "%.1f", $3*100/$2}')
    echo -e "${YELLOW}💾 Memory Usage: ${memory_info}%${NC}"
    
    # Disk usage
    local disk_usage=$(df -h / | awk 'NR==2{print $5}')
    echo -e "${YELLOW}💿 Disk Usage: $disk_usage${NC}"
    
    # Docker stats
    echo -e "${YELLOW}🐳 Docker containers stats:${NC}"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" || true
}

# Function to check database connectivity
check_database() {
    echo -e "${YELLOW}🗄️ Checking database connectivity...${NC}"
    
    if docker exec postgres pg_isready -U postgres -d attendance > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PostgreSQL: CONNECTED${NC}"
    else
        echo -e "${RED}❌ PostgreSQL: DISCONNECTED${NC}"
    fi
}

# Function to check Redis connectivity
check_redis() {
    echo -e "${YELLOW}🔴 Checking Redis connectivity...${NC}"
    
    if docker exec redis redis-cli ping > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Redis: CONNECTED${NC}"
    else
        echo -e "${RED}❌ Redis: DISCONNECTED${NC}"
    fi
}

# Main health check
echo -e "${YELLOW}🔍 Checking application endpoints...${NC}"

backend_healthy=false
frontend_healthy=false
face_service_healthy=false

# Check all endpoints
if check_endpoint "$BACKEND_URL" "Backend API"; then
    backend_healthy=true
fi

if check_endpoint "$FRONTEND_URL" "Frontend"; then
    frontend_healthy=true
fi

if check_endpoint "$FACE_SERVICE_URL" "Face Service API"; then
    face_service_healthy=true
fi

# Check infrastructure
check_containers
check_database
check_redis
check_system

# Overall health assessment
echo -e "${YELLOW}🎯 Overall Health Assessment:${NC}"

if [ "$backend_healthy" = true ] && [ "$frontend_healthy" = true ] && [ "$face_service_healthy" = true ]; then
    echo -e "${GREEN}✅ APPLICATION IS HEALTHY${NC}"
    exit 0
else
    echo -e "${RED}❌ APPLICATION HAS ISSUES${NC}"
    
    if [ "$backend_healthy" = false ]; then
        echo -e "${RED}  - Backend API is down${NC}"
    fi
    
    if [ "$frontend_healthy" = false ]; then
        echo -e "${RED}  - Frontend is down${NC}"
    fi
    
    if [ "$face_service_healthy" = false ]; then
        echo -e "${RED}  - Face Service API is down${NC}"
    fi
    
    exit 1
fi
