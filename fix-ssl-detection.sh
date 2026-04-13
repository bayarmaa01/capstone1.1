#!/bin/bash

# Fix SSL Detection - Simple script to use sudo for certificate access
# This script fixes the SSL certificate detection issue

set -e

echo "=== FIXING SSL DETECTION ==="
echo "Issue: Script needs sudo to access /etc/letsencrypt"
echo "Solution: Check certificates with sudo"
echo

# Check SSL certificates with sudo
echo "Checking SSL certificates with sudo..."
if sudo test -f "/etc/letsencrypt/live/attendance-ml.duckdns.org/fullchain.pem"; then
    echo "✅ SSL certificates found!"
    echo "Certificate files:"
    sudo ls -la /etc/letsencrypt/live/attendance-ml.duckdns.org/
    echo "Certificate expiration:"
    sudo openssl x509 -in /etc/letsencrypt/live/attendance-ml.duckdns.org/fullchain.pem -noout -dates
else
    echo "❌ SSL certificates not found!"
    exit 1
fi

echo
echo "=== SSL DETECTION FIXED ==="
echo "Now run: docker compose down && docker compose up -d --build"
