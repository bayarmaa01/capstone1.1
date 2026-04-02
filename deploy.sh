#!/bin/bash

# ========================================
# Zero-Downtime Blue/Green Deploy Script
# ========================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.yml"
HEALTH_TIMEOUT=300
SWITCH_API_URL="http://localhost/api/deploy/switch"

echo -e "${BLUE}🚀 Starting Zero-Downtime Blue/Green Deployment${NC}"

# Function to check service health
check_health() {
    local service_name=$1
    local max_attempts=30
    local attempt=1
    
    echo -e "${YELLOW}⏳ Checking health of $service_name...${NC}"
    
    while [ $attempt -le $max_attempts ]; do
        if docker compose ps $service_name | grep -q "healthy"; then
            echo -e "${GREEN}✅ $service_name is healthy${NC}"
            return 0
        fi
        
        echo -e "${YELLOW}⏳ Attempt $attempt/$max_attempts: $service_name not healthy yet...${NC}"
        sleep 10
        ((attempt++))
    done
    
    echo -e "${RED}❌ $service_name failed to become healthy${NC}"
    return 1
}

# Function to switch traffic
switch_traffic() {
    echo -e "${BLUE}🔄 Switching traffic...${NC}"
    
    # Call the switch API
    response=$(curl -s -X POST $SWITCH_API_URL)
    
    if echo "$response" | grep -q "Switched to"; then
        echo -e "${GREEN}✅ Traffic switched successfully${NC}"
        echo "$response"
        return 0
    else
        echo -e "${RED}❌ Failed to switch traffic${NC}"
        echo "$response"
        return 1
    fi
}

# Main deployment logic
main() {
    echo -e "${BLUE}📋 Current deployment status:${NC}"
    docker compose ps
    
    # Determine current active environment
    echo -e "${BLUE}🔍 Determining current active environment...${NC}"
    if grep -q "blue_backend" nginx.upstream.conf; then
        CURRENT_ENV="blue"
        NEW_ENV="green"
    else
        CURRENT_ENV="green"
        NEW_ENV="blue"
    fi
    
    echo -e "${BLUE}📍 Current: $CURRENT_ENV, Building: $NEW_ENV${NC}"
    
    # Build new environment
    echo -e "${BLUE}🔨 Building $NEW_ENV environment...${NC}"
    docker compose build $NEW_ENV-backend $NEW_ENV-frontend $NEW_ENV-face
    
    # Start new environment
    echo -e "${BLUE}🚀 Starting $NEW_ENV environment...${NC}"
    docker compose up -d $NEW_ENV-backend $NEW_ENV-frontend $NEW_ENV-face
    
    # Wait for health checks
    echo -e "${BLUE}🏥 Waiting for $NEW_ENV services to become healthy...${NC}"
    
    if check_health "$NEW_ENV-backend" && check_health "$NEW_ENV-frontend" && check_health "$NEW_ENV-face"; then
        echo -e "${GREEN}✅ All $NEW_ENV services are healthy${NC}"
    else
        echo -e "${RED}❌ $NEW_ENV services failed health checks${NC}"
        echo -e "${YELLOW}🔄 Rolling back...${NC}"
        docker compose stop $NEW_ENV-backend $NEW_ENV-frontend $NEW_ENV-face
        exit 1
    fi
    
    # Switch traffic
    if switch_traffic; then
        echo -e "${GREEN}✅ Traffic switched to $NEW_ENV${NC}"
        
        # Wait a bit for the switch to take effect
        sleep 10
        
        # Verify switch worked
        echo -e "${BLUE}🔍 Verifying switch...${NC}"
        if grep -q "$NEW_ENV-backend" nginx.upstream.conf; then
            echo -e "${GREEN}✅ Switch verified - $NEW_ENV is now active${NC}"
        else
            echo -e "${RED}❌ Switch verification failed${NC}"
            exit 1
        fi
        
        # Stop old environment
        echo -e "${BLUE}🛑 Stopping old $CURRENT_ENV environment...${NC}"
        docker compose stop $CURRENT_ENV-backend $CURRENT_ENV-frontend $CURRENT_ENV-face
        
        echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
        echo -e "${BLUE}📊 Final status:${NC}"
        docker compose ps
        
    else
        echo -e "${RED}❌ Traffic switch failed${NC}"
        echo -e "${YELLOW}🔄 Rolling back...${NC}"
        docker compose stop $NEW_ENV-backend $NEW_ENV-frontend $NEW_ENV-face
        exit 1
    fi
}

# Handle script arguments
case "${1:-}" in
    "status")
        echo -e "${BLUE}📊 Current deployment status:${NC}"
        docker compose ps
        if grep -q "blue_backend" nginx.upstream.conf; then
            echo -e "${BLUE}📍 Active environment: BLUE${NC}"
        else
            echo -e "${BLUE}📍 Active environment: GREEN${NC}"
        fi
        ;;
    "switch")
        switch_traffic
        ;;
    "health")
        check_health "blue_backend"
        check_health "blue_frontend" 
        check_health "blue_face"
        check_health "green_backend"
        check_health "green_frontend"
        check_health "green_face"
        ;;
    *)
        main
        ;;
esac
