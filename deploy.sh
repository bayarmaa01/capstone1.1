#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_DIR="$HOME/capstone1.1"
COMPOSE_FILE="docker-compose.yml"
HEALTH_CHECK_TIMEOUT=60
MAX_RETRIES=10
RETRY_INTERVAL=5

echo -e "${YELLOW}🚀 Starting Blue/Green deployment...${NC}"

# Function to detect active environment
detect_active_env() {
    if grep -q "server blue_backend:" "$COMPOSE_DIR/nginx.prod.conf"; then
        echo "blue"
    else
        echo "green"
    fi
}

# Function to check health
check_health() {
    local env_prefix=$1
    local attempts=0
    
    while [ $attempts -lt $MAX_RETRIES ]; do
        # Check backend health
        if docker exec ${env_prefix}_backend curl -f -s --max-time 10 http://localhost:4000/api/health > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Backend health check passed${NC}"
        else
            echo -e "${YELLOW}⏳ Backend health check attempt $((attempts + 1))/$MAX_RETRIES failed${NC}"
            sleep $RETRY_INTERVAL
            attempts=$((attempts + 1))
            continue
        fi
        
        # Check face service health
        if docker exec ${env_prefix}_face curl -f -s --max-time 10 http://localhost:5001/health > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Face service health check passed${NC}"
            return 0
        else
            echo -e "${YELLOW}⏳ Face service health check attempt $((attempts + 1))/$MAX_RETRIES failed${NC}"
            sleep $RETRY_INTERVAL
            attempts=$((attempts + 1))
        fi
    done
    
    echo -e "${RED}❌ Health check failed for $env_prefix environment${NC}"
    return 1
}

# Function to switch nginx upstream
switch_nginx_upstream() {
    local target_env=$1
    echo -e "${YELLOW}🔄 Switching nginx upstream to $target_env...${NC}"
    
    # Update nginx configuration
    sed -i "s|server blue_backend:4000;|server ${target_env}_backend:4000;|g" "$COMPOSE_DIR/nginx.prod.conf"
    sed -i "s|server blue_frontend:80;|server ${target_env}_frontend:80;|g" "$COMPOSE_DIR/nginx.prod.conf"
    sed -i "s|server blue_face:5001;|server ${target_env}_face:5001;|g" "$COMPOSE_DIR/nginx.prod.conf"
    
    # Test nginx configuration
    docker exec nginx nginx -t || {
        echo -e "${RED}❌ Nginx configuration test failed${NC}"
        return 1
    }
    
    # Reload nginx (no downtime)
    docker exec nginx nginx -s reload || true
    echo -e "${GREEN}✅ Traffic switched to $target_env${NC}"
}

# Main deployment logic
cd "$COMPOSE_DIR"

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

# Build images
echo -e "${YELLOW}🏗️ Building images...${NC}"
docker compose -f "$COMPOSE_FILE" build --no-cache

# Start new environment
echo -e "${YELLOW}� Starting $NEW_ENV environment...${NC}"
docker compose -f "$COMPOSE_FILE" up -d ${NEW_ENV}_backend ${NEW_ENV}_frontend ${NEW_ENV}_face

# Wait for containers to start
echo -e "${YELLOW}⏱️ Waiting for services to start...${NC}"
sleep 30

# Health checks
echo -e "${YELLOW}🏥 Running health checks...${NC}"

if check_health "$NEW_ENV"; then
    echo -e "${GREEN}✅ All health checks passed${NC}"
    
    # Switch traffic to new environment
    switch_nginx_upstream "$NEW_ENV"
    
    echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
    echo -e "${GREEN}🌐 Application is now running on $NEW_ENV environment${NC}"
    
    # Stop old environment
    echo -e "${YELLOW}🛑 Stopping $OLD_ENV environment...${NC}"
    docker compose -f "$COMPOSE_FILE" stop ${OLD_ENV}_backend ${OLD_ENV}_frontend ${OLD_ENV}_face || true
    
    echo -e "${GREEN}✅ Zero-downtime deployment completed${NC}"
    
else
    echo -e "${RED}❌ Health checks failed, rolling back...${NC}"
    
    # Stop new environment
    docker compose -f "$COMPOSE_FILE" stop ${NEW_ENV}_backend ${NEW_ENV}_frontend ${NEW_ENV}_face || true
    
    echo -e "${GREEN}✅ Rollback completed - system still running on $OLD_ENV${NC}"
    exit 1
fi

echo -e "${GREEN}🧹 Cleaning up old images...${NC}"
docker image prune -f

echo -e "${GREEN}✅ Deployment process completed${NC}"
