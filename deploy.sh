#!/bin/bash

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_DIR="${COMPOSE_DIR:-$HOME/capstone1.1}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
HEALTH_CHECK_TIMEOUT=300
MAX_RETRIES=30
RETRY_INTERVAL=10
UPSTREAM_FILE="$COMPOSE_DIR/nginx.upstream.conf"
LOG_FILE="$COMPOSE_DIR/deploy.log"

# Logging function
log() {
    echo -e "$(date '+%Y-%m-%d %H:%M:%S') $1" | tee -a "$LOG_FILE"
}

# Error handling and rollback
rollback() {
    local env_to_stop=${1:-$NEW_ENV}
    local env_to_keep=${2:-$OLD_ENV}
    
    log "${RED}❌ Rolling back to $env_to_keep environment${NC}"
    
    # Stop failed environment
    cd "$COMPOSE_DIR"
    docker compose -f "$COMPOSE_FILE" stop ${env_to_stop}_backend ${env_to_stop}_frontend ${env_to_stop}_face 2>/dev/null || true
    
    # Restore upstream configuration
    if [[ -f "${UPSTREAM_FILE}.backup" ]]; then
        mv "${UPSTREAM_FILE}.backup" "$UPSTREAM_FILE"
        log "${YELLOW}🔄 Restored upstream configuration${NC}"
        
        # Reload nginx
        if docker exec nginx nginx -t; then
            docker exec nginx nginx -s reload
            log "${GREEN}✅ Nginx reloaded with restored configuration${NC}"
        else
            log "${RED}❌ Nginx configuration test failed during rollback${NC}"
        fi
    fi
    
    log "${GREEN}✅ Rollback completed - system running on $env_to_keep${NC}"
    exit 1
}

# Set trap for cleanup
trap 'rollback "$NEW_ENV" "$OLD_ENV"' ERR INT TERM

log "${BLUE}🚀 Starting Production Blue/Green Deployment${NC}"

# Function to wait for container health
wait_for_health() {
    local service=$1
    local timeout=$2
    local elapsed=0
    
    while [[ $elapsed -lt $timeout ]]; do
        local status
        status=$(docker inspect --format='{{.State.Health.Status}}' "$service" 2>/dev/null || echo "starting")
        
        if [[ "$status" == "healthy" ]]; then
            log "${GREEN}✅ $service is healthy${NC}"
            return 0
        elif [[ "$status" == "unhealthy" ]]; then
            log "${RED}❌ $service is unhealthy${NC}"
            return 1
        fi
        
        sleep $RETRY_INTERVAL
        elapsed=$((elapsed + RETRY_INTERVAL))
        log "${YELLOW}⏳ Waiting for $service health... (${elapsed}s)${NC}"
    done
    
    log "${RED}❌ Timeout waiting for $service health${NC}"
    return 1
}

# Function to check application health
check_app_health() {
    local env_prefix=$1
    local attempts=0
    
    while [[ $attempts -lt $MAX_RETRIES ]]; do
        # Check backend health
        if docker exec ${env_prefix}_backend curl -f -s --max-time 10 http://localhost:4000/api/health >/dev/null 2>&1; then
            log "${GREEN}✅ Backend health check passed${NC}"
        else
            log "${YELLOW}⏳ Backend health check attempt $((attempts + 1))/$MAX_RETRIES failed${NC}"
            sleep $RETRY_INTERVAL
            attempts=$((attempts + 1))
            continue
        fi
        
        # Check face service health
        if docker exec ${env_prefix}_face curl -f -s --max-time 10 http://localhost:5001/health >/dev/null 2>&1; then
            log "${GREEN}✅ Face service health check passed${NC}"
            return 0
        else
            log "${YELLOW}⏳ Face service health check attempt $((attempts + 1))/$MAX_RETRIES failed${NC}"
            sleep $RETRY_INTERVAL
            attempts=$((attempts + 1))
        fi
    done
    
    log "${RED}❌ Health check failed for $env_prefix environment${NC}"
    return 1
}

# Function to switch nginx upstream atomically
switch_upstream() {
    local target_env=$1
    
    log "${YELLOW}🔄 Switching nginx upstream to $target_env...${NC}"
    
    # Backup current configuration
    cp "$UPSTREAM_FILE" "${UPSTREAM_FILE}.backup"
    
    # Create new upstream configuration
    cat > "$UPSTREAM_FILE" << EOF
# Dynamic upstream configuration for blue-green deployment
# Updated: $(date)

upstream backend_upstream {
    server ${target_env}_backend:4000;
    keepalive 32;
}

upstream frontend_upstream {
    server ${target_env}_frontend:80;
    keepalive 32;
}

upstream face_upstream {
    server ${target_env}_face:5001;
    keepalive 32;
}
EOF
    
    # Test nginx configuration
    if docker exec nginx nginx -t; then
        # Reload nginx (zero downtime)
        docker exec nginx nginx -s reload
        log "${GREEN}✅ Traffic switched to $target_env${NC}"
        return 0
    else
        # Restore backup on failure
        mv "${UPSTREAM_FILE}.backup" "$UPSTREAM_FILE"
        log "${RED}❌ Nginx configuration test failed, restored backup${NC}"
        return 1
    fi
}

# Main deployment logic
cd "$COMPOSE_DIR"

# Detect active environment
ACTIVE_ENV="blue"
if grep -q "server green_backend:" "$UPSTREAM_FILE" 2>/dev/null; then
    ACTIVE_ENV="green"
fi

log "${YELLOW}🔍 Active environment: $ACTIVE_ENV${NC}"

# Determine new environment
if [[ "$ACTIVE_ENV" == "blue" ]]; then
    NEW_ENV="green"
    OLD_ENV="blue"
else
    NEW_ENV="blue"
    OLD_ENV="green"
fi

log "${YELLOW}🔄 Deploying: $NEW_ENV (replacing $OLD_ENV)${NC}"

# Build images
log "${YELLOW}🏗️ Building images...${NC}"
if ! docker compose -f "$COMPOSE_FILE" build --no-cache; then
    log "${RED}❌ Build failed${NC}"
    exit 1
fi

# Start new environment
log "${YELLOW}🚀 Starting $NEW_ENV environment...${NC}"
if ! docker compose -f "$COMPOSE_FILE" up -d ${NEW_ENV}_backend ${NEW_ENV}_frontend ${NEW_ENV}_face; then
    log "${RED}❌ Failed to start $NEW_ENV environment${NC}"
    exit 1
fi

# Wait for containers to become healthy
log "${YELLOW}⏱️ Waiting for services to become healthy...${NC}"
for service in ${NEW_ENV}_backend ${NEW_ENV}_face; do
    if ! wait_for_health "$service" "$HEALTH_CHECK_TIMEOUT"; then
        log "${RED}❌ $service failed to become healthy${NC}"
        rollback "$NEW_ENV" "$OLD_ENV"
    fi
done

# Run application health checks
log "${YELLOW}🏥 Running application health checks...${NC}"
if ! check_app_health "$NEW_ENV"; then
    log "${RED}❌ Application health checks failed${NC}"
    rollback "$NEW_ENV" "$OLD_ENV"
fi

# Switch traffic to new environment
if ! switch_upstream "$NEW_ENV"; then
    log "${RED}❌ Failed to switch upstream${NC}"
    rollback "$NEW_ENV" "$OLD_ENV"
fi

# Wait for traffic switch to propagate
sleep 10

# Verify new environment is serving traffic
log "${YELLOW}🔍 Verifying traffic routing...${NC}"
if ! curl -f -s --max-time 10 https://attendance-ml.duckdns.org/health >/dev/null 2>&1; then
    log "${RED}❌ Health check failed after traffic switch${NC}"
    rollback "$NEW_ENV" "$OLD_ENV"
fi

# Stop old environment
log "${YELLOW}🛑 Stopping $OLD_ENV environment...${NC}"
docker compose -f "$COMPOSE_FILE" stop ${OLD_ENV}_backend ${OLD_ENV}_frontend ${OLD_ENV}_face 2>/dev/null || true

# Clean up
log "${GREEN}🧹 Cleaning up old images...${NC}"
docker image prune -f 2>/dev/null || true

# Remove backup file on success
rm -f "${UPSTREAM_FILE}.backup"

log "${GREEN}✅ Zero-downtime deployment completed successfully!${NC}"
log "${GREEN}🌐 Application is now running on $NEW_ENV environment${NC}"
log "${GREEN}📊 Deployment completed at $(date)${NC}"
