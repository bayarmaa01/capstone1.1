#!/bin/bash

# Production HTTPS SSL Configuration Fix Script
# Fixes HTTPS connection issues for Docker-based system on Azure VM

set -e

echo "=== PRODUCTION HTTPS SSL CONFIGURATION FIX ==="
echo "Domain: attendance-ml.duckdns.org"
echo "Target: Make HTTPS fully functional with Let's Encrypt certificates"
echo

# STEP 1: Verify SSL certificates exist on host
echo "1. Verifying SSL certificates on host..."
if [ -f "/etc/letsencrypt/live/attendance-ml.duckdns.org/fullchain.pem" ]; then
    echo "SSL certificate found: /etc/letsencrypt/live/attendance-ml.duckdns.org/fullchain.pem"
    echo "Certificate files:"
    ls -la /etc/letsencrypt/live/attendance-ml.duckdns.org/
    echo "Certificate expiration:"
    openssl x509 -in /etc/letsencrypt/live/attendance-ml.duckdns.org/fullchain.pem -noout -dates
else
    echo "ERROR: SSL certificate not found!"
    echo "Please run: sudo certbot --nginx -d attendance-ml.duckdns.org"
    exit 1
fi
echo

# STEP 2: Verify docker-compose.yml nginx configuration
echo "2. Verifying docker-compose.yml nginx configuration..."
echo "Checking nginx port configuration:"
grep -A 10 "nginx:" docker-compose.yml | grep -E "(ports:|80:80|443:443)" || echo "Port configuration issue found"
echo "Checking nginx volume mounts:"
grep -A 15 "nginx:" docker-compose.yml | grep -E "volumes:" || echo "Volume configuration issue found"
echo "Checking SSL certificate mount:"
grep -A 15 "nginx:" docker-compose.yml | grep "letsencrypt" || echo "SSL certificate mount issue found"
echo

# STEP 3: Verify nginx configuration
echo "3. Verifying nginx configuration..."
if [ -f "nginx/default.conf" ]; then
    echo "Nginx configuration found"
    echo "HTTP to HTTPS redirect:"
    grep -A 5 "listen 80" nginx/default.conf || echo "HTTP redirect not found"
    echo "HTTPS server block:"
    grep -A 5 "listen 443 ssl" nginx/default.conf || echo "HTTPS server block not found"
    echo "SSL certificate paths:"
    grep "ssl_certificate" nginx/default.conf || echo "SSL certificate paths not found"
else
    echo "ERROR: nginx/default.conf not found!"
    exit 1
fi
echo

# STEP 4: Stop all containers
echo "4. Stopping all Docker containers..."
docker compose down
echo "All containers stopped"
echo

# STEP 5: Pull latest images and rebuild
echo "5. Pulling latest images and rebuilding..."
docker compose pull
docker compose build --no-cache
echo "Images pulled and rebuilt"
echo

# STEP 6: Start containers
echo "6. Starting Docker containers..."
docker compose up -d
echo "Containers starting..."
sleep 15
echo

# STEP 7: Check nginx container status
echo "7. Checking nginx container status..."
docker ps | grep nginx || echo "Nginx container not running"
echo "Nginx container logs:"
docker logs capstone11-nginx-1 --tail 20
echo

# STEP 8: Verify port binding
echo "8. Verifying port binding..."
echo "Port 80 status:"
ss -tulnp | grep ":80" || echo "Port 80 not listening"
echo "Port 443 status:"
ss -tulnp | grep ":443" || echo "Port 443 not listening"
echo

# STEP 9: Check SSL certificates inside nginx container
echo "9. Checking SSL certificates inside nginx container..."
if docker exec capstone11-nginx-1 test -f /etc/letsencrypt/live/attendance-ml.duckdns.org/fullchain.pem; then
    echo "SSL certificate accessible inside container"
    docker exec capstone11-nginx-1 ls -la /etc/letsencrypt/live/attendance-ml.duckdns.org/
else
    echo "ERROR: SSL certificate not accessible inside nginx container!"
    echo "Checking mount points:"
    docker exec capstone11-nginx-1 ls -la /etc/letsencrypt/ || echo "Mount point not accessible"
fi
echo

# STEP 10: Test nginx configuration
echo "10. Testing nginx configuration..."
docker exec capstone11-nginx-1 nginx -t || echo "Nginx configuration test failed"
echo

# STEP 11: Restart nginx if needed
echo "11. Restarting nginx container..."
docker compose restart nginx
sleep 5
echo "Nginx restarted"
echo

# STEP 12: Final connectivity test
echo "12. Final connectivity test..."
echo "Testing HTTP (should redirect to HTTPS):"
curl -I http://attendance-ml.duckdns.org/ 2>/dev/null | head -3 || echo "HTTP test failed"
echo
echo "Testing HTTPS:"
curl -I https://attendance-ml.duckdns.org/ 2>/dev/null | head -3 || echo "HTTPS test failed"
echo

# STEP 13: Debug information if still failing
echo "13. Debug information..."
echo "Container status:"
docker ps | grep -E "(nginx|backend|frontend)"
echo "Nginx configuration syntax:"
docker exec capstone11-nginx-1 nginx -T 2>/dev/null | head -10 || echo "Could not get nginx config"
echo "SSL certificate validation:"
docker exec capstone11-nginx-1 openssl x509 -in /etc/letsencrypt/live/attendance-ml.duckdns.org/fullchain.pem -noout -dates 2>/dev/null || echo "Could not validate SSL cert"
echo

echo "=== HTTPS FIX COMPLETE ==="
echo
echo "EXPECTED RESULTS:"
echo "- Port 443 should be listening"
echo "- HTTP should redirect to HTTPS (301)"
echo "- HTTPS should return 200 OK"
echo "- No connection refused errors"
echo
echo "If HTTPS still fails, check:"
echo "1. Azure Network Security Group allows 443"
echo "2. SSL certificate permissions"
echo "3. Nginx container logs for errors"
echo "4. Docker container networking"
echo
echo "Manual debug commands:"
echo "docker logs capstone11-nginx-1"
echo "docker exec -it capstone11-nginx-1 sh"
echo "ss -tulnp | grep 443"
