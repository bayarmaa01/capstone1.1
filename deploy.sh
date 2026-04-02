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

# Function to detect active environment
detect_active_env() {
    if grep -q "server blue_backend:" /home/ubuntu/capstone1.1/nginx.prod.conf; then
        echo "blue"
    else
        echo "green"
    fi
}

# Function to check health
check_health() {
    local url=$1
    local attempts=0
    local env_prefix=""
    
    # Determine environment prefix based on active deployment
    if [ "$NEW_ENV" = "green" ]; then
        env_prefix="green_"
    else
        env_prefix="blue_"
    fi
    
    while [ $attempts -lt $MAX_RETRIES ]; do
        # Use container-to-container communication with dynamic environment
        case "$url" in
            *api/health*) 
                if docker exec ${env_prefix}backend curl -f -s --max-time 10 http://localhost:4000/api/health > /dev/null 2>&1; then
                    echo -e "${GREEN}✅ Backend health check passed${NC}"
                    return 0
                fi
                ;;
            *face/health*) 
                if docker exec ${env_prefix}face curl -f -s --max-time 10 http://localhost:5001/health > /dev/null 2>&1; then
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
    sed -i "s|server blue_backend:4000;|server ${target_env}_backend:4000;|g" /home/ubuntu/capstone1.1/nginx.prod.conf
    sed -i "s|server blue_frontend:80;|server ${target_env}_frontend:80;|g" /home/ubuntu/capstone1.1/nginx.prod.conf
    sed -i "s|server blue_face:5001;|server ${target_env}_face:5001;|g" /home/ubuntu/capstone1.1/nginx.prod.conf
    
    # Test nginx configuration
    docker exec nginx nginx -t || {
        echo -e "${RED}❌ Nginx configuration test failed${NC}"
        return 1
    }
    
    # Reload nginx (no downtime)
    docker exec nginx nginx -s reload || true
    echo -e "${GREEN}✅ Traffic switched to $target_env${NC}"
}

# Function to build local images
build_images() {
    echo -e "${YELLOW}🚀 Building local images...${NC}"
    docker compose -f docker-compose.fixed.yml build --no-cache
    echo -e "${GREEN}✅ Local images built successfully${NC}"
}

# Main deployment logic
cd "$COMPOSE_DIR"

# Build local images
build_images

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
docker compose -f docker-compose.fixed.yml up -d ${NEW_ENV}_backend ${NEW_ENV}_frontend ${NEW_ENV}_face

# Wait for services to be ready
echo -e "${YELLOW}⏱️ Waiting for services to start...${NC}"
sleep 120

# Check individual container logs for debugging
echo -e "${YELLOW}🔍 Checking container logs...${NC}"
docker logs ${NEW_ENV}_backend --tail 10 || echo "Backend logs not available"
docker logs ${NEW_ENV}_face --tail 10 || echo "Face service logs not available"

# Check if containers are running
echo -e "${YELLOW}🔍 Checking container status...${NC}"
docker ps --filter "name=${NEW_ENV}_" --format "table {{.Names}}\t{{.Status}}"

# Health checks
echo -e "${YELLOW}🏥 Running health checks...${NC}"

backend_healthy=false
face_healthy=false

# Check backend health using container network
echo -e "${YELLOW}🔍 Testing backend connection...${NC}"

if docker exec ${NEW_ENV}_backend curl -f -s --max-time 10 http://localhost:4000/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend health check passed${NC}"
    backend_healthy=true
else
    echo -e "${RED}❌ Backend health check failed${NC}"
fi

# Check face-service health using container network
echo -e "${YELLOW}🔍 Testing face service connection...${NC}"

# Retry face service health check with more attempts
face_retry_count=0
max_face_retries=5
face_retry_interval=10

while [ $face_retry_count -lt $max_face_retries ]; do
    if docker exec ${NEW_ENV}_face curl -f -s --max-time 5 http://localhost:5001/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Face service health check passed${NC}"
        face_healthy=true
        break
    else
        face_retry_count=$((face_retry_count + 1))
        echo -e "${YELLOW}⚠️ Face service health check attempt $face_retry_count/$max_face_retries failed${NC}"
        if [ $face_retry_count -lt $max_face_retries ]; then
            echo -e "${YELLOW}⏱️ Waiting $face_retry_interval seconds before retry...${NC}"
            sleep $face_retry_interval
        fi
    fi
done

if [ "$face_healthy" != true ]; then
    echo -e "${RED}❌ Face service health check failed after $max_face_retries attempts${NC}"
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
    docker compose -f docker-compose.fixed.yml stop ${OLD_ENV}_backend ${OLD_ENV}_frontend ${OLD_ENV}_face || true
    
    echo -e "${GREEN}✅ Zero-downtime deployment completed${NC}"
    
else
    echo -e "${RED}❌ Health checks failed, rolling back...${NC}"
    
    # Stop new environment
    docker compose -f docker-compose.fixed.yml stop ${NEW_ENV}_backend ${NEW_ENV}_frontend ${NEW_ENV}_face || true
    
    echo -e "${GREEN}✅ Rollback completed - system still running on $OLD_ENV${NC}"
    exit 1
fi

echo -e "${GREEN}🧹 Cleaning up old images...${NC}"
docker image prune -f

echo -e "${GREEN}✅ Deployment process completed${NC}"
