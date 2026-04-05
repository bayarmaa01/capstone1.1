#!/bin/bash

# Simple Blue-Green Switch Script
# Usage: ./switch.sh [blue|green]

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

# Get target environment
TARGET_ENV=${1:-blue}

if [[ "$TARGET_ENV" != "blue" && "$TARGET_ENV" != "green" ]]; then
    echo "Usage: $0 [blue|green]"
    exit 1
fi

log "🎯 Switching to $TARGET_ENV environment"

# Update nginx config to point to target environment
update_nginx_config() {
    log "📝 Updating nginx configuration for $TARGET_ENV"
    
    # Backup current config
    cp nginx.prod.conf nginx.prod.conf.backup
    
    # Update upstream servers
    if [[ "$TARGET_ENV" == "green" ]]; then
        sed -i 's/blue_backend/green_backend/g' nginx.prod.conf
        sed -i 's/blue_frontend/green_frontend/g' nginx.prod.conf
        sed -i 's/blue_face/green_face/g' nginx.prod.conf
        log "✅ Updated nginx to use GREEN environment"
    else
        sed -i 's/green_backend/blue_backend/g' nginx.prod.conf
        sed -i 's/green_frontend/blue_frontend/g' nginx.prod.conf
        sed -i 's/green_face/blue_face/g' nginx.prod.conf
        log "✅ Updated nginx to use BLUE environment"
    fi
}

# Health check function
health_check() {
    local service_name=$1
    local health_url=$2
    local max_attempts=10
    local attempt=1
    
    log "🔍 Checking health of $service_name..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "$health_url" > /dev/null 2>&1; then
            log "✅ $service_name is healthy (attempt $attempt)"
            return 0
        fi
        
        warning "$service_name health check failed (attempt $attempt/$max_attempts)"
        sleep 5
        ((attempt++))
    done
    
    error "❌ $service_name failed health check after $max_attempts attempts"
    return 1
}

# Restart nginx
restart_nginx() {
    log "🔄 Restarting nginx..."
    
    # Test nginx config
    if docker exec capstone11-nginx-1 nginx -t; then
        log "✅ Nginx configuration is valid"
        
        # Restart nginx
        docker restart capstone11-nginx-1
        
        # Wait for nginx to start
        sleep 10
        
        # Check nginx health
        if curl -f -s http://localhost/nginx-health > /dev/null 2>&1; then
            log "✅ Nginx restarted successfully"
            return 0
        else
            error "❌ Nginx failed to start properly"
            return 1
        fi
    else
        error "❌ Invalid nginx configuration"
        # Restore backup
        mv nginx.prod.conf.backup nginx.prod.conf
        return 1
    fi
}

# Verify services are running
verify_services() {
    log "🔍 Verifying $TARGET_ENV services are running..."
    
    # Check if target services are running
    if [[ "$TARGET_ENV" == "green" ]]; then
        if ! docker ps | grep -q "green_backend"; then
            log "🚀 Starting green services..."
            docker compose up -d green_backend green_frontend green_face
        fi
    else
        if ! docker ps | grep -q "blue_backend"; then
            log "🚀 Starting blue services..."
            docker compose up -d blue_backend blue_frontend blue_face
        fi
    fi
    
    # Wait for services to be ready
    sleep 15
}

# Main switching process
main() {
    log "🚀 Starting Blue-Green switch to $TARGET_ENV"
    
    # Verify services are running
    verify_services
    
    # Update nginx configuration
    update_nginx_config
    
    # Restart nginx
    restart_nginx
    
    # Health checks
    log "🔍 Performing health checks..."
    
    # Check backend
    if health_check "Backend API" "http://localhost/api/health"; then
        log "✅ Backend API is healthy"
    else
        error "❌ Backend API failed health check"
        exit 1
    fi
    
    # Check face service
    if health_check "Face Service" "http://localhost/face/health"; then
        log "✅ Face Service is healthy"
    else
        error "❌ Face Service failed health check"
        exit 1
    fi
    
    # Check analytics
    if health_check "AI Analytics" "http://localhost/analytics/analytics/health"; then
        log "✅ AI Analytics is healthy"
    else
        warning "⚠️ AI Analytics not responding (optional service)"
    fi
    
    # Check frontend
    if curl -f -s "http://localhost" > /dev/null 2>&1; then
        log "✅ Frontend is healthy"
    else
        error "❌ Frontend failed health check"
        exit 1
    fi
    
    log "🎉 Successfully switched to $TARGET_ENV environment!"
    log "📊 Current status: $TARGET_ENV environment is active"
    
    # Show running containers
    echo ""
    log "📋 Running containers:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "(blue|green|nginx|analytics)"
}

# Execute main function
main "$@"
