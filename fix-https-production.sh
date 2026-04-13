#!/bin/bash

# Complete Production HTTPS SSL Configuration Fix Script
# Single comprehensive script for SSL certificate creation and HTTPS setup

set -e

echo "=== COMPLETE PRODUCTION HTTPS SSL CONFIGURATION FIX ==="
echo "Domain: attendance-ml.duckdns.org"
echo "Target: Make HTTPS fully functional with Let's Encrypt certificates"
echo

# STEP 1: Check and create SSL certificates if needed
echo "1. Checking and creating SSL certificates..."
if [ -f "/etc/letsencrypt/live/attendance-ml.duckdns.org/fullchain.pem" ]; then
    echo "SSL certificate found: /etc/letsencrypt/live/attendance-ml.duckdns.org/fullchain.pem"
    echo "Certificate files:"
    ls -la /etc/letsencrypt/live/attendance-ml.duckdns.org/
    echo "Certificate expiration:"
    openssl x509 -in /etc/letsencrypt/live/attendance-ml.duckdns.org/fullchain.pem -noout -dates
else
    echo "SSL certificate not found - creating new certificate..."
    echo "Stopping nginx to free port 80 for certbot..."
    docker compose stop nginx || echo "Nginx already stopped"
    
    echo "Creating SSL certificate with certbot..."
    sudo certbot certonly --standalone -d attendance-ml.duckdns.org --email admin@attendance-ml.duckdns.org --agree-tos --no-eff-email
    
    if [ -f "/etc/letsencrypt/live/attendance-ml.duckdns.org/fullchain.pem" ]; then
        echo "SSL certificate created successfully!"
        echo "Certificate files:"
        ls -la /etc/letsencrypt/live/attendance-ml.duckdns.org/
        echo "Certificate expiration:"
        openssl x509 -in /etc/letsencrypt/live/attendance-ml.duckdns.org/fullchain.pem -noout -dates
    else
        echo "ERROR: Failed to create SSL certificate!"
        exit 1
    fi
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

# STEP 14: Set up SSL auto-renewal
echo "14. Setting up SSL auto-renewal..."
# Create renewal script
cat > /tmp/renew-ssl.sh << 'EOF'
#!/bin/bash

# SSL Certificate Renewal Script
LOG_FILE="/var/log/ssl-renewal.log"

echo "$(date): Starting SSL certificate renewal check" >> $LOG_FILE

# Renew certificates
if certbot renew --quiet --no-self-upgrade >> $LOG_FILE 2>&1; then
    echo "$(date): SSL certificate renewal completed" >> $LOG_FILE
    
    # Restart nginx
    if cd /home/azureuser/capstone1.1 && docker compose restart nginx >> $LOG_FILE 2>&1; then
        echo "$(date): nginx restarted successfully" >> $LOG_FILE
    else
        echo "$(date): ERROR: Failed to restart nginx" >> $LOG_FILE
    fi
else
    echo "$(date): No renewal needed" >> $LOG_FILE
fi
EOF

sudo mv /tmp/renew-ssl.sh /usr/local/bin/renew-ssl.sh
sudo chmod +x /usr/local/bin/renew-ssl.sh

# Add cron job for twice daily renewal
CRON_ENTRY="0 3,15 * * * /usr/local/bin/renew-ssl.sh"
if (crontab -l 2>/dev/null | grep -q "renew-ssl.sh"); then
    echo "Cron job already exists"
else
    (crontab -l 2>/dev/null; echo "$CRON_ENTRY") | crontab -
    echo "SSL auto-renewal cron job added (3:00 AM and 3:00 PM)"
fi

# Create monitoring script
cat > /tmp/monitor-ssl.sh << 'EOF'
#!/bin/bash

# SSL Certificate Monitoring Script
DOMAIN="attendance-ml.duckdns.org"
CERT_PATH="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
WARNING_DAYS=30

if [ -f "$CERT_PATH" ]; then
    EXPIRY=$(openssl x509 -in "$CERT_PATH" -noout -enddate | cut -d= -f2)
    EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s)
    CURRENT_EPOCH=$(date +%s)
    DAYS_LEFT=$(( ($EXPIRY_EPOCH - $CURRENT_EPOCH) / 86400 ))
    
    if [ $DAYS_LEFT -lt $WARNING_DAYS ]; then
        echo "WARNING: SSL certificate expires in $DAYS_LEFT days"
    else
        echo "SSL certificate valid for $DAYS_LEFT more days"
    fi
else
    echo "ERROR: SSL certificate not found"
fi
EOF

sudo mv /tmp/monitor-ssl.sh /usr/local/bin/monitor-ssl.sh
sudo chmod +x /usr/local/bin/monitor-ssl.sh

# Add weekly monitoring
MONITOR_CRON="0 8 * * 1 /usr/local/bin/monitor-ssl.sh >> /var/log/ssl-renewal.log 2>&1"
if (crontab -l 2>/dev/null | grep -q "monitor-ssl.sh"); then
    echo "Monitoring cron job already exists"
else
    (crontab -l 2>/dev/null; echo "$MONITOR_CRON") | crontab -
    echo "SSL monitoring cron job added (weekly on Mondays)"
fi

echo "SSL auto-renewal and monitoring setup complete"
echo

echo "=== COMPLETE HTTPS FIX FINISHED ==="
echo
echo "EXPECTED RESULTS:"
echo "- Port 443 should be listening"
echo "- HTTP should redirect to HTTPS (301)"
echo "- HTTPS should return 200 OK"
echo "- No connection refused errors"
echo "- SSL auto-renewal configured (twice daily)"
echo "- SSL monitoring configured (weekly)"
echo
echo "MANAGEMENT COMMANDS:"
echo "- Check SSL status: sudo /usr/local/bin/monitor-ssl.sh"
echo "- Test renewal: sudo /usr/local/bin/renew-ssl.sh"
echo "- View logs: sudo tail -f /var/log/ssl-renewal.log"
echo "- Edit cron: sudo crontab -e"
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
