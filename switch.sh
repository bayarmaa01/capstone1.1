#!/bin/bash
# Bulletproof Blue-Green Switch Script (FINAL SAFE VERSION)

set -euo pipefail

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

TARGET_ENV=${1:-blue}

if [[ "$TARGET_ENV" != "blue" && "$TARGET_ENV" != "green" ]]; then
    echo "Usage: $0 [blue|green]"
    exit 1
fi

log "🎯 Switching to $TARGET_ENV environment"

# ✅ ONE SAFE BACKUP (ONLY ONCE)
BACKUP_FILE="/tmp/nginx-backup.conf"
cp nginx.prod.conf "$BACKUP_FILE"

# Update nginx config safely
update_nginx_config() {
    log "📝 Updating nginx configuration..."

    if [[ "$TARGET_ENV" == "green" ]]; then
        sed -i 's/server blue_backend/server green_backend/' nginx.prod.conf
        sed -i 's/server blue_frontend/server green_frontend/' nginx.prod.conf
        sed -i 's/server blue_face/server green_face/' nginx.prod.conf
    else
        sed -i 's/server green_backend/server blue_backend/' nginx.prod.conf
        sed -i 's/server green_frontend/server blue_frontend/' nginx.prod.conf
        sed -i 's/server green_face/server blue_face/' nginx.prod.conf
    fi

    log "✅ Nginx config updated"
}

# Restart nginx safely
restart_nginx() {
    log "🔄 Restarting nginx..."

    if ! docker exec capstone11-nginx-1 nginx -t; then
        error "❌ Invalid nginx config. Rolling back..."
        cp "$BACKUP_FILE" nginx.prod.conf
        docker compose restart nginx
        exit 1
    fi

    docker restart capstone11-nginx-1

    for i in {1..6}; do
        if curl -f -s http://localhost/nginx-health > /dev/null; then
            log "✅ Nginx is up"
            return
        fi
        sleep 1
    done

    error "❌ Nginx failed. Rolling back..."
    cp "$BACKUP_FILE" nginx.prod.conf
    docker compose restart nginx
    exit 1
}

# Health check with rollback
check_or_rollback() {
    local name=$1
    local url=$2

    log "🔍 Checking $name..."

    if ! curl -f -s "$url" > /dev/null; then
        error "❌ $name failed. Rolling back..."
        cp "$BACKUP_FILE" nginx.prod.conf
        docker compose restart nginx
        exit 1
    fi

    log "✅ $name OK"
}

# Ensure services running
verify_services() {
    log "🔍 Ensuring services are running..."

    if [[ "$TARGET_ENV" == "green" ]]; then
        docker compose up -d green_backend green_frontend green_face
    else
        docker compose up -d blue_backend blue_frontend blue_face
    fi
}

# MAIN FLOW
main() {
    verify_services
    update_nginx_config
    restart_nginx

    log "🔍 Running health checks..."

    check_or_rollback "Backend" "http://localhost/api/health"
    check_or_rollback "Face" "http://localhost/face/health"
    check_or_rollback "Analytics" "http://localhost/analytics/health"
    check_or_rollback "Frontend" "http://localhost/"

    log "🎉 SUCCESS! Switched to $TARGET_ENV"
}

main "$@"