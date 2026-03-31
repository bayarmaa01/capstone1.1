#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_DIR="/home/ubuntu/capstone1.1"
HEALTH_CHECK_TIMEOUT=60
MAX_RETRIES=10
RETRY_INTERVAL=5

echo -e "${YELLOW}🚀 Starting Blue/Green deployment...${NC}"

# Function to check health
check_health() {
    local url=$1
    local attempts=0
    
    while [ $attempts -lt $MAX_RETRIES ]; do
        if curl -f -s --max-time $HEALTH_CHECK_TIMEOUT "$url" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Health check passed for $url${NC}"
            return 0
        fi
        attempts=$((attempts + 1))
        echo -e "${YELLOW}⏳ Health check attempt $attempts/$MAX_RETRIES failed for $url, retrying in ${RETRY_INTERVAL}s...${NC}"
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
    sed -i "s|server blue_backend:5000;|server ${target_env}_backend:5000;|g" /home/ubuntu/capstone1.1/nginx.conf
    sed -i "s|server blue_frontend:3000;|server ${target_env}_frontend:3000;|g" /home/ubuntu/capstone1.1/nginx.conf
    sed -i "s|server blue_face-service:5001;|server ${target_env}_face-service:5001;|g" /home/ubuntu/capstone1.1/nginx.conf
    
    # Reload nginx
    docker exec nginx nginx -s reload || true
    echo -e "${GREEN}✅ Traffic switched to $target_env${NC}"
}

# Function to pull latest images
pull_images() {
    echo -e "${YELLOW}🐳 Pulling latest Docker images...${NC}"
    
    # Pull latest images
    docker pull $DOCKERHUB_USERNAME/capstone1.1-backend:latest || true
    docker pull $DOCKERHUB_USERNAME/capstone1.1-frontend:latest || true
    docker pull $DOCKERHUB_USERNAME/capstone1.1-face-service:latest || true
    
    echo -e "${GREEN}✅ Images pulled successfully${NC}"
}

# Function to update docker-compose files
update_compose_files() {
    local env=$1
    echo -e "${YELLOW}📝 Updating docker-compose.$env.yml with latest images...${NC}"
    
    # Update docker-compose file with latest images
    sed -i "s|docker.io/.*/capstone1.1-backend:latest|docker.io/$DOCKERHUB_USERNAME/capstone1.1-backend:latest|g" docker-compose.$env.yml
    sed -i "s|docker.io/.*/capstone1.1-frontend:latest|docker.io/$DOCKERHUB_USERNAME/capstone1.1-frontend:latest|g" docker-compose.$env.yml
    sed -i "s|docker.io/.*/capstone1.1-face-service:latest|docker.io/$DOCKERHUB_USERNAME/capstone1.1-face-service:latest|g" docker-compose.$env.yml
}

# Main deployment logic
cd "$COMPOSE_DIR"

# Pull latest images
pull_images

# Detect current active environment
if docker ps --format "table {{.Names}}" | grep -q "blue_backend"; then
    CURRENT_ENV="blue"
    NEW_ENV="green"
elif docker ps --format "table {{.Names}}" | grep -q "green_backend"; then
    CURRENT_ENV="green"
    NEW_ENV="blue"
else
    echo -e "${YELLOW}📍 No active environment detected, defaulting to blue${NC}"
    CURRENT_ENV="green"
    NEW_ENV="blue"
fi

echo -e "${YELLOW}📍 Current environment: $CURRENT_ENV${NC}"
echo -e "${YELLOW}🔄 Deploying to: $NEW_ENV${NC}"

# Update new environment compose file
update_compose_files "$NEW_ENV"

# Stop current environment if it exists
if [ "$CURRENT_ENV" != "" ]; then
    echo -e "${YELLOW}🛑 Stopping $CURRENT_ENV environment...${NC}"
    docker compose -f docker-compose.$CURRENT_ENV.yml down || true
fi

# Start new environment
echo -e "${YELLOW}🚀 Starting $NEW_ENV environment...${NC}"
docker compose -f docker-compose.$NEW_ENV.yml up -d

# Wait for services to be ready
echo -e "${YELLOW}⏱️ Waiting for services to start...${NC}"
sleep 30

# Health checks
echo -e "${YELLOW}🏥 Running health checks...${NC}"

backend_healthy=false
frontend_healthy=false
face_service_healthy=false

# Check backend health
if check_health "http://localhost:8080/api/health"; then
    backend_healthy=true
fi

# Check frontend health
if check_health "http://localhost:8080/health"; then
    frontend_healthy=true
fi

# Check face-service health
if check_health "http://localhost:8080/api/face/health"; then
    face_service_healthy=true
fi

# Evaluate health results
if [ "$backend_healthy" = true ] && [ "$frontend_healthy" = true ] && [ "$face_service_healthy" = true ]; then
    echo -e "${GREEN}✅ All health checks passed${NC}"
    
    # Switch traffic to new environment
    switch_nginx_upstream "$NEW_ENV"
    
    echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
    echo -e "${GREEN}🌐 Application is now running on $NEW_ENV environment${NC}"
    
    # Cleanup old environment
    if [ "$CURRENT_ENV" != "" ]; then
        echo -e "${YELLOW}🧹 Cleaning up $CURRENT_ENV environment...${NC}"
        docker compose -f docker-compose.$CURRENT_ENV.yml down -v || true
    fi
    
else
    echo -e "${RED}❌ Health checks failed, rolling back...${NC}"
    
    # Stop new environment
    docker compose -f docker-compose.$NEW_ENV.yml down || true
    
    # Start previous environment
    if [ "$CURRENT_ENV" != "" ]; then
        echo -e "${YELLOW}🔄 Restarting $CURRENT_ENV environment...${NC}"
        docker compose -f docker-compose.$CURRENT_ENV.yml up -d
        
        # Wait for services
        sleep 30
        
        # Switch back to previous environment
        switch_nginx_upstream "$CURRENT_ENV"
        
        echo -e "${GREEN}✅ Rollback completed${NC}"
    else
        echo -e "${RED}❌ No previous environment to rollback to${NC}"
    fi
    
    exit 1
fi

echo -e "${GREEN}🧹 Cleaning up old images...${NC}"
docker image prune -f

echo -e "${GREEN}✅ Deployment process completed${NC}"
