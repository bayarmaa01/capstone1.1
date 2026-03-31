#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_DIR="/home/ubuntu/capstone1.1"
HEALTH_CHECK_URL="http://localhost:8080/api/health"
MAX_RETRIES=30
RETRY_INTERVAL=10

echo -e "${YELLOW}🔄 Starting rollback process...${NC}"

# Function to check health
check_health() {
    local attempts=0
    while [ $attempts -lt $MAX_RETRIES ]; do
        if curl -f -s "$HEALTH_CHECK_URL" > /dev/null; then
            echo -e "${GREEN}✅ Health check passed${NC}"
            return 0
        fi
        attempts=$((attempts + 1))
        echo -e "${YELLOW}⏳ Health check attempt $attempts/$MAX_RETRIES failed, retrying in ${RETRY_INTERVAL}s...${NC}"
        sleep $RETRY_INTERVAL
    done
    return 1
}

# Function to switch environment
switch_environment() {
    local target_env=$1
    echo -e "${YELLOW}🔄 Switching to $target_env environment...${NC}"
    
    # Update nginx upstream
    sed -i "s|server blue_backend:5000;|server ${target_env}_backend:5000;|g" /home/ubuntu/capstone1.1/nginx.conf
    sed -i "s|server blue_frontend:3000;|server ${target_env}_frontend:3000;|g" /home/ubuntu/capstone1.1/nginx.conf
    sed -i "s|server blue_face-service:5001;|server ${target_env}_face-service:5001;|g" /home/ubuntu/capstone1.1/nginx.conf
    
    # Reload nginx
    docker exec nginx nginx -s reload
    echo -e "${GREEN}✅ Traffic switched to $target_env${NC}"
}

# Function to stop environment
stop_environment() {
    local env=$1
    echo -e "${YELLOW}🛑 Stopping $env environment...${NC}"
    cd "$COMPOSE_DIR"
    docker compose -f docker-compose.$env.yml down || true
}

# Function to start environment
start_environment() {
    local env=$1
    echo -e "${YELLOW}🚀 Starting $env environment...${NC}"
    cd "$COMPOSE_DIR"
    docker compose -f docker-compose.$env.yml up -d || true
}

# Main rollback logic
cd "$COMPOSE_DIR"

# Detect current active environment
if docker ps --format "table {{.Names}}" | grep -q "blue_backend"; then
    CURRENT_ENV="blue"
    ROLLBACK_ENV="green"
elif docker ps --format "table {{.Names}}" | grep -q "green_backend"; then
    CURRENT_ENV="green"
    ROLLBACK_ENV="blue"
else
    echo -e "${RED}❌ Could not detect active environment${NC}"
    exit 1
fi

echo -e "${YELLOW}📍 Current environment: $CURRENT_ENV${NC}"
echo -e "${YELLOW}🔄 Rollback target: $ROLLBACK_ENV${NC}"

# Stop current environment if it's failing
if ! check_health; then
    echo -e "${RED}❌ Current environment is unhealthy, stopping it...${NC}"
    stop_environment "$CURRENT_ENV"
    
    # Start rollback environment
    start_environment "$ROLLBACK_ENV"
    
    # Wait for services to be ready
    sleep 30
    
    # Switch traffic
    switch_environment "$ROLLBACK_ENV"
    
    # Verify rollback
    if check_health; then
        echo -e "${GREEN}✅ Rollback completed successfully!${NC}"
        echo -e "${GREEN}🌐 Application is now running on $ROLLBACK_ENV environment${NC}"
    else
        echo -e "${RED}❌ Rollback failed! Both environments are unhealthy${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ Current environment is healthy, no rollback needed${NC}"
fi

echo -e "${GREEN}🧹 Cleaning up old images...${NC}"
docker image prune -f

echo -e "${GREEN}✅ Rollback process completed${NC}"
