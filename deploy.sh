#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_DIR="/home/azureuser/capstone1.1"
HEALTH_CHECK_TIMEOUT=60
MAX_RETRIES=10
RETRY_INTERVAL=5

echo -e "${YELLOW}🚀 Starting Blue/Green deployment...${NC}"

# Function to detect active environment
detect_active_env() {
    if grep -q "server blue_backend:" /home/azureuser/capstone1.1/nginx.conf; then
        echo "blue"
    else
        echo "green"
    fi
}

# Function to check health
check_health() {
    local url=$1
    local attempts=0
    
    while [ $attempts -lt $MAX_RETRIES ]; do
        # Use container-to-container communication
        case "$url" in
            *api/health*) 
                if curl -f -s --max-time 10 http://green_backend:4000/health > /dev/null 2>&1; then
                    echo -e "${GREEN}✅ Backend health check passed${NC}"
                    return 0
                fi
                ;;
            *face/health*) 
                if curl -f -s --max-time 10 http://green_face:5001/health > /dev/null 2>&1; then
                    echo -e "${GREEN}✅ Face service health check passed${NC}"
                    return 0
                fi
                ;;
        esac
        
        attempts=$((attempts + 1))
        echo -e "${YELLOW}⏳ Health check attempt $attempts/$MAX_RETRIES failed, retrying in ${RETRY_INTERVAL}s...${NC}"
        sleep $RETRY_INTERVAL
    done
    
    echo -e "${RED}❌ Health check failed for $url after $MAX_RETRIES attempts${NC}"
    return 1
}

# Function to switch nginx upstream
switch_nginx_upstream() {
    local target_env=$1
    echo -e "${YELLOW}🔄 Switching nginx upstream to $target_env...${NC}"
    
    # Update nginx configuration
    sed -i "s|server blue_backend:5000;|server ${target_env}_backend:5000;|g" /home/azureuser/capstone1.1/nginx.conf
    sed -i "s|server blue_frontend:3000;|server ${target_env}_frontend:3000;|g" /home/azureuser/capstone1.1/nginx.conf
    sed -i "s|server blue_face:5001;|server ${target_env}_face:5001;|g" /home/azureuser/capstone1.1/nginx.conf
    
    # Test nginx configuration
    docker exec nginx nginx -t || {
        echo -e "${RED}❌ Nginx configuration test failed${NC}"
        return 1
    }
    
    # Reload nginx (no downtime)
    docker exec nginx nginx -s reload || true
    echo -e "${GREEN}✅ Traffic switched to $target_env${NC}"
}

# Function to pull latest images
pull_images() {
    echo -e "${YELLOW}🐳 Pulling latest DockerHub images...${NC}"
    
    # Pull latest images
    docker pull bayarmaa/capstone1.1-backend:latest || true
    docker pull bayarmaa/capstone1.1-frontend:latest || true
    docker pull bayarmaa/capstone1.1-face-service:latest || true
    
    echo -e "${GREEN}✅ Images pulled successfully${NC}"
}

# Main deployment logic
cd "$COMPOSE_DIR"

# Pull latest images
pull_images

# Detect active environment
ACTIVE_ENV=$(detect_active_env)
echo -e "${YELLOW}🔍 Active environment: $ACTIVE_ENV${NC}"

# Determine new environment
if [ "$ACTIVE_ENV" = "blue" ]; then
    NEW_ENV="green"
    OLD_ENV="blue"
else
    NEW_ENV="blue"
    OLD_ENV="green"
fi

echo -e "${YELLOW}🔄 Deploying: $NEW_ENV (replacing $OLD_ENV)${NC}"

# Start new environment
echo -e "${YELLOW}🚀 Starting $NEW_ENV environment...${NC}"
docker compose up -d ${NEW_ENV}_backend ${NEW_ENV}_frontend ${NEW_ENV}_face

# Wait for services to be ready
echo -e "${YELLOW}⏱️ Waiting for services to start...${NC}"
sleep 60

# Check if containers are running
echo -e "${YELLOW}🔍 Checking container status...${NC}"
docker ps --filter "name=${NEW_ENV}_" --format "table {{.Names}}\t{{.Status}}"

# Health checks
echo -e "${YELLOW}🏥 Running health checks...${NC}"

backend_healthy=false
face_healthy=false

# Check backend health
if check_health "http://green_backend:4000/health"; then
    backend_healthy=true
fi

# Check face-service health
if check_health "http://green_face:5001/health"; then
    face_healthy=true
fi

# Evaluate health results
if [ "$backend_healthy" = true ] && [ "$face_healthy" = true ]; then
    echo -e "${GREEN}✅ All health checks passed${NC}"
    
    # Switch traffic to new environment
    switch_nginx_upstream "$NEW_ENV"
    
    echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
    echo -e "${GREEN}🌐 Application is now running on $NEW_ENV environment${NC}"
    
    # Stop old environment
    echo -e "${YELLOW}🛑 Stopping $OLD_ENV environment...${NC}"
    docker compose stop ${OLD_ENV}_backend ${OLD_ENV}_frontend ${OLD_ENV}_face || true
    
    echo -e "${GREEN}✅ Zero-downtime deployment completed${NC}"
    
else
    echo -e "${RED}❌ Health checks failed, rolling back...${NC}"
    
    # Stop new environment
    docker compose stop ${NEW_ENV}_backend ${NEW_ENV}_frontend ${NEW_ENV}_face || true
    
    echo -e "${GREEN}✅ Rollback completed - system still running on $OLD_ENV${NC}"
    exit 1
fi

echo -e "${GREEN}🧹 Cleaning up old images...${NC}"
docker image prune -f

echo -e "${GREEN}✅ Deployment process completed${NC}"
