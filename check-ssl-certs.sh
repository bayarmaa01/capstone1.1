#!/bin/bash

# SSL Certificate Diagnostic Script
# This script helps identify the exact location of SSL certificates

echo "=== SSL CERTIFICATE DIAGNOSTIC SCRIPT ==="
echo "Domain: attendance-ml.duckdns.org"
echo

echo "1. Checking Let's Encrypt directory structure..."
sudo ls -la /etc/letsencrypt/ 2>/dev/null || echo "Let's Encrypt directory not found"
echo

echo "2. Checking live certificates directory..."
sudo ls -la /etc/letsencrypt/live/ 2>/dev/null || echo "Live certificates directory not found"
echo

echo "3. Checking for attendance-ml certificates..."
if [ -d "/etc/letsencrypt/live/attendance-ml.duckdns.org" ]; then
    echo "Certificate directory found!"
    sudo ls -la /etc/letsencrypt/live/attendance-ml.duckdns.org/
    echo
    echo "Certificate files:"
    sudo ls -la /etc/letsencrypt/live/attendance-ml.duckdns.org/*.pem 2>/dev/null || echo "No .pem files found"
else
    echo "Certificate directory not found"
fi
echo

echo "4. Checking renewal configuration..."
if [ -f "/etc/letsencrypt/renewal/attendance-ml.duckdns.org.conf" ]; then
    echo "Renewal configuration found!"
    echo "Certificate paths from renewal config:"
    grep -E "(cert|key|chain)" /etc/letsencrypt/renewal/attendance-ml.duckdns.org.conf | head -5
else
    echo "Renewal configuration not found"
fi
echo

echo "5. Checking all Let's Encrypt files for attendance-ml..."
sudo find /etc/letsencrypt -name "*attendance-ml*" -type f 2>/dev/null | head -10
echo

echo "6. Checking certificate expiration (if found)..."
if [ -f "/etc/letsencrypt/live/attendance-ml.duckdns.org/fullchain.pem" ]; then
    echo "Certificate expiration:"
    sudo openssl x509 -in /etc/letsencrypt/live/attendance-ml.duckdns.org/fullchain.pem -noout -dates 2>/dev/null || echo "Could not read certificate"
elif [ -f "/etc/letsencrypt/live/attendance-ml.duckdns.org/cert.pem" ]; then
    echo "Certificate expiration:"
    sudo openssl x509 -in /etc/letsencrypt/live/attendance-ml.duckdns.org/cert.pem -noout -dates 2>/dev/null || echo "Could not read certificate"
else
    echo "No certificate file found to check expiration"
fi
echo

echo "7. Checking nginx configuration for SSL paths..."
if [ -f "nginx/default.conf" ]; then
    echo "SSL certificate paths in nginx config:"
    grep -E "(ssl_certificate|ssl_certificate_key)" nginx/default.conf || echo "No SSL paths found in nginx config"
fi
echo

echo "=== DIAGNOSTIC COMPLETE ==="
echo "If certificates are found, update nginx/default.conf with correct paths"
echo "If not found, run: sudo certbot --nginx -d attendance-ml.duckdns.org"
