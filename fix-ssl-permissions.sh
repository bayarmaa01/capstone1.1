#!/bin/bash

# SSL Certificate Permissions Fix Script
# Ensures nginx container can read Let's Encrypt certificates

set -e

echo "=== SSL CERTIFICATE PERMISSIONS FIX ==="
echo "Fixing permissions for nginx container access to SSL certificates"
echo

# STEP 1: Check current permissions
echo "1. Checking current SSL certificate permissions..."
echo "Current permissions on /etc/letsencrypt:"
sudo ls -la /etc/letsencrypt/ 2>/dev/null || echo "Directory not found"
echo "Current permissions on live directory:"
sudo ls -la /etc/letsencrypt/live/ 2>/dev/null || echo "Live directory not found"
echo "Current permissions on attendance-ml certificates:"
sudo ls -la /etc/letsencrypt/live/attendance-ml.duckdns.org/ 2>/dev/null || echo "Certificate directory not found"
echo

# STEP 2: Fix permissions for Let's Encrypt directory
echo "2. Fixing Let's Encrypt directory permissions..."
sudo chmod 755 /etc/letsencrypt/ 2>/dev/null || echo "Could not chmod /etc/letsencrypt"
sudo chmod 755 /etc/letsencrypt/live/ 2>/dev/null || echo "Could not chmod /etc/letsencrypt/live"
sudo chmod 755 /etc/letsencrypt/live/attendance-ml.duckdns.org/ 2>/dev/null || echo "Could not chmod certificate directory"
echo "Directory permissions fixed"
echo

# STEP 3: Fix permissions for certificate files
echo "3. Fixing certificate file permissions..."
sudo chmod 644 /etc/letsencrypt/live/attendance-ml.duckdns.org/fullchain.pem 2>/dev/null || echo "Could not chmod fullchain.pem"
sudo chmod 600 /etc/letsencrypt/live/attendance-ml.duckdns.org/privkey.pem 2>/dev/null || echo "Could not chmod privkey.pem"
sudo chmod 644 /etc/letsencrypt/live/attendance-ml.duckdns.org/chain.pem 2>/dev/null || echo "Could not chmod chain.pem"
echo "Certificate file permissions fixed"
echo

# STEP 4: Fix ownership
echo "4. Fixing ownership..."
sudo chown root:root /etc/letsencrypt/live/attendance-ml.duckdns.org/fullchain.pem 2>/dev/null || echo "Could not chown fullchain.pem"
sudo chown root:root /etc/letsencrypt/live/attendance-ml.duckdns.org/privkey.pem 2>/dev/null || echo "Could not chown privkey.pem"
sudo chown root:root /etc/letsencrypt/live/attendance-ml.duckdns.org/chain.pem 2>/dev/null || echo "Could not chown chain.pem"
echo "Ownership fixed"
echo

# STEP 5: Verify permissions
echo "5. Verifying fixed permissions..."
sudo ls -la /etc/letsencrypt/live/attendance-ml.duckdns.org/ 2>/dev/null || echo "Could not verify permissions"
echo

# STEP 6: Test nginx container access
echo "6. Testing nginx container access to certificates..."
if docker ps | grep -q nginx; then
    echo "Testing certificate access inside nginx container..."
    if docker exec capstone11-nginx-1 test -f /etc/letsencrypt/live/attendance-ml.duckdns.org/fullchain.pem; then
        echo "SUCCESS: nginx container can read SSL certificates"
        docker exec capstone11-nginx-1 ls -la /etc/letsencrypt/live/attendance-ml.duckdns.org/
    else
        echo "ERROR: nginx container cannot read SSL certificates"
        echo "Checking mount points:"
        docker exec capstone11-nginx-1 ls -la /etc/letsencrypt/ 2>/dev/null || echo "Mount point not accessible"
    fi
else
    echo "Nginx container not running - will test after restart"
fi
echo

# STEP 7: Restart nginx if permissions fixed
echo "7. Restarting nginx container..."
docker compose restart nginx 2>/dev/null || echo "Could not restart nginx"
sleep 5
echo "Nginx restarted"
echo

echo "=== SSL PERMISSIONS FIX COMPLETE ==="
echo
echo "EXPECTED RESULTS:"
echo "- nginx container can read SSL certificates"
echo "- No permission denied errors"
echo "- HTTPS should work after container restart"
echo
echo "If issues persist, check:"
echo "1. Docker volume mount permissions"
echo "2. SELinux/AppArmor restrictions"
echo "3. Filesystem permissions on host"
