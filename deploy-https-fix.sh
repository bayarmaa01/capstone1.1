#!/bin/bash

# Production-level HTTPS deployment script for Azure VM
# This script fixes HTTPS connection issues on attendance-ml.duckdns.org

set -e

echo "=== PRODUCTION HTTPS DEPLOYMENT SCRIPT ==="
echo "Domain: attendance-ml.duckdns.org"
echo "Fixing HTTPS connection issues on Azure VM"
echo

# STEP 1: Check current port status
echo "1. Checking current port status..."
echo "Checking if port 443 is listening:"
sudo ss -tulnp | grep 443 || echo "Port 443 not listening"
echo "Checking if port 80 is listening:"
sudo ss -tulnp | grep 80 || echo "Port 80 not listening"
echo

# STEP 2: Configure VM firewall
echo "2. Configuring VM firewall..."
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
sudo ufw reload
echo "Firewall configured for ports 80 and 443"
echo

# STEP 3: Check SSL certificates
echo "3. Checking SSL certificates..."

# Check for certificate in standard Let's Encrypt locations
if [ -f "/etc/letsencrypt/live/attendance-ml.duckdns.org/fullchain.pem" ]; then
    echo "SSL certificate found: /etc/letsencrypt/live/attendance-ml.duckdns.org/fullchain.pem"
    sudo ls -la /etc/letsencrypt/live/attendance-ml.duckdns.org/
elif [ -f "/etc/letsencrypt/live/attendance-ml.duckdns.org/cert.pem" ]; then
    echo "SSL certificate found: /etc/letsencrypt/live/attendance-ml.duckdns.org/cert.pem"
    sudo ls -la /etc/letsencrypt/live/attendance-ml.duckdns.org/
elif [ -f "/etc/letsencrypt/renewal/attendance-ml.duckdns.org.conf" ]; then
    echo "SSL certificate renewal configuration found, checking actual cert location..."
    # Extract certificate path from renewal config
    CERT_PATH=$(grep "cert" /etc/letsencrypt/renewal/attendance-ml.duckdns.org.conf | head -1 | cut -d'=' -f2 | tr -d ' ')
    if [ -f "$CERT_PATH" ]; then
        echo "SSL certificate found at: $CERT_PATH"
        sudo ls -la "$(dirname "$CERT_PATH")/"
    else
        echo "ERROR: Certificate path found in config but file not found: $CERT_PATH"
        echo "Please run: sudo certbot --nginx -d attendance-ml.duckdns.org"
        exit 1
    fi
else
    echo "ERROR: SSL certificate not found in any standard location!"
    echo "Checking all Let's Encrypt directories..."
    sudo find /etc/letsencrypt -name "*attendance-ml*" -type f 2>/dev/null || echo "No Let's Encrypt files found"
    echo "Please run: sudo certbot --nginx -d attendance-ml.duckdns.org"
    exit 1
fi
echo

# STEP 4: Check Docker Compose configuration
echo "4. Checking Docker Compose configuration..."
echo "Current nginx port configuration:"
grep -A 5 "ports:" docker-compose.yml | grep -E "(80|443)"
echo

# STEP 5: Restart Docker services
echo "5. Restarting Docker services..."
docker compose down
echo "Services stopped"
docker compose up -d --build
echo "Services restarted with HTTPS configuration"
echo

# STEP 6: Wait for services to start
echo "6. Waiting for services to start..."
sleep 10
docker ps | grep nginx
echo

# STEP 7: Check nginx container logs
echo "7. Checking nginx container logs..."
docker logs capstone11-nginx-1 --tail 10
echo

# STEP 8: Test connectivity
echo "8. Testing connectivity..."
echo "Testing HTTP:"
curl -I http://attendance-ml.duckdns.org/ || echo "HTTP test failed"
echo
echo "Testing HTTPS:"
curl -I https://attendance-ml.duckdns.org/ || echo "HTTPS test failed"
echo

# STEP 9: Check port listening status
echo "9. Final port status check..."
echo "Port 80 status:"
sudo ss -tulnp | grep 80 || echo "Port 80 not listening"
echo "Port 443 status:"
sudo ss -tulnp | grep 443 || echo "Port 443 not listening"
echo

# STEP 10: Check nginx configuration
echo "10. Checking nginx configuration..."
docker exec capstone11-nginx-1 nginx -t || echo "Nginx config test failed"
echo

echo "=== DEPLOYMENT COMPLETE ==="
echo "If HTTPS still fails, check:"
echo "1. Azure Network Security Group allows ports 80/443"
echo "2. DuckDNS domain points to correct IP"
echo "3. SSL certificates are valid"
echo
echo "Run 'curl ifconfig.me' to check your public IP"
echo "Ensure DuckDNS points to this IP address"
