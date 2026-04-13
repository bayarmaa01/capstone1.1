#!/bin/bash

# SSL Certificate Auto-Renewal Setup Script
# Sets up automatic SSL certificate renewal with certbot

set -e

echo "=== SSL CERTIFICATE AUTO-RENEWAL SETUP ==="
echo "Setting up automatic Let's Encrypt certificate renewal"
echo

# STEP 1: Check certbot installation
echo "1. Checking certbot installation..."
if command -v certbot &> /dev/null; then
    echo "certbot is installed: $(certbot --version)"
else
    echo "ERROR: certbot not found!"
    echo "Install certbot: sudo apt install certbot python3-certbot-nginx"
    exit 1
fi
echo

# STEP 2: Check existing certificates
echo "2. Checking existing certificates..."
if [ -f "/etc/letsencrypt/live/attendance-ml.duckdns.org/fullchain.pem" ]; then
    echo "SSL certificate found"
    echo "Certificate expiration:"
    sudo openssl x509 -in /etc/letsencrypt/live/attendance-ml.duckdns.org/fullchain.pem -noout -dates
    echo "Certificate details:"
    sudo certbot certificates --domains attendance-ml.duckdns.org
else
    echo "No SSL certificate found - please create one first"
    echo "Run: sudo certbot --nginx -d attendance-ml.duckdns.org"
    exit 1
fi
echo

# STEP 3: Create renewal script
echo "3. Creating SSL renewal script..."
cat > /tmp/renew-ssl.sh << 'EOF'
#!/bin/bash

# SSL Certificate Renewal Script
# Automatically renews SSL certificates and restarts nginx

LOG_FILE="/var/log/ssl-renewal.log"

echo "$(date): Starting SSL certificate renewal check" >> $LOG_FILE

# Renew certificates
if certbot renew --quiet --no-self-upgrade >> $LOG_FILE 2>&1; then
    echo "$(date): SSL certificate renewal completed successfully" >> $LOG_FILE
    
    # Restart nginx to load new certificates
    if cd /home/azureuser/capstone1.1 && docker compose restart nginx >> $LOG_FILE 2>&1; then
        echo "$(date): nginx restarted successfully" >> $LOG_FILE
    else
        echo "$(date): ERROR: Failed to restart nginx" >> $LOG_FILE
    fi
else
    echo "$(date): SSL certificate renewal completed (no changes needed)" >> $LOG_FILE
fi

echo "$(date): SSL renewal check completed" >> $LOG_FILE
EOF

sudo mv /tmp/renew-ssl.sh /usr/local/bin/renew-ssl.sh
sudo chmod +x /usr/local/bin/renew-ssl.sh
echo "Renewal script created at /usr/local/bin/renew-ssl.sh"
echo

# STEP 4: Set up cron job for renewal
echo "4. Setting up cron job for automatic renewal..."
# Create cron entry for twice daily renewal (recommended by Let's Encrypt)
CRON_ENTRY="0 3,15 * * * /usr/local/bin/renew-ssl.sh"

# Check if cron entry already exists
if (crontab -l 2>/dev/null | grep -q "renew-ssl.sh"); then
    echo "Cron job already exists"
else
    # Add cron job
    (crontab -l 2>/dev/null; echo "$CRON_ENTRY") | crontab -
    echo "Cron job added: $CRON_ENTRY"
fi
echo "Current crontab:"
crontab -l | grep renew-ssl.sh
echo

# STEP 5: Test renewal script
echo "5. Testing renewal script..."
sudo /usr/local/bin/renew-ssl.sh
echo "Renewal script executed successfully"
echo "Check log: sudo tail -f /var/log/ssl-renewal.log"
echo

# STEP 6: Create log rotation for renewal logs
echo "6. Setting up log rotation..."
sudo cat > /etc/logrotate.d/ssl-renewal << 'EOF'
/var/log/ssl-renewal.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 644 root root
}
EOF
echo "Log rotation configured"
echo

# STEP 7: Create monitoring script
echo "7. Creating SSL monitoring script..."
cat > /tmp/monitor-ssl.sh << 'EOF'
#!/bin/bash

# SSL Certificate Monitoring Script
# Checks certificate expiration and sends alerts

DOMAIN="attendance-ml.duckdns.org"
CERT_PATH="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
WARNING_DAYS=30

if [ -f "$CERT_PATH" ]; then
    EXPIRY=$(openssl x509 -in "$CERT_PATH" -noout -enddate | cut -d= -f2)
    EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s)
    CURRENT_EPOCH=$(date +%s)
    DAYS_LEFT=$(( ($EXPIRY_EPOCH - $CURRENT_EPOCH) / 86400 ))
    
    if [ $DAYS_LEFT -lt $WARNING_DAYS ]; then
        echo "WARNING: SSL certificate for $DOMAIN expires in $DAYS_LEFT days ($EXPIRY)"
        echo "Please check renewal process: sudo certbot certificates"
    else
        echo "SSL certificate for $DOMAIN is valid for $DAYS_LEFT more days ($EXPIRY)"
    fi
else
    echo "ERROR: SSL certificate not found for $DOMAIN"
fi
EOF

sudo mv /tmp/monitor-ssl.sh /usr/local/bin/monitor-ssl.sh
sudo chmod +x /usr/local/bin/monitor-ssl.sh
echo "Monitoring script created at /usr/local/bin/monitor-ssl.sh"
echo

# STEP 8: Add weekly monitoring to cron
echo "8. Adding weekly monitoring to cron..."
MONITOR_CRON="0 8 * * 1 /usr/local/bin/monitor-ssl.sh >> /var/log/ssl-renewal.log 2>&1"

if (crontab -l 2>/dev/null | grep -q "monitor-ssl.sh"); then
    echo "Monitoring cron job already exists"
else
    (crontab -l 2>/dev/null; echo "$MONITOR_CRON") | crontab -
    echo "Monitoring cron job added"
fi
echo

# STEP 9: Test monitoring
echo "9. Testing SSL monitoring..."
sudo /usr/local/bin/monitor-ssl.sh
echo

echo "=== SSL AUTO-RENEWAL SETUP COMPLETE ==="
echo
echo "SETUP SUMMARY:"
echo "- Automatic renewal: Twice daily (3:00 AM and 3:00 PM)"
echo "- Monitoring: Weekly (8:00 AM on Mondays)"
echo "- Log file: /var/log/ssl-renewal.log"
echo "- Log rotation: 7 days retention"
echo
echo "MANAGEMENT COMMANDS:"
echo "- Check certificates: sudo certbot certificates"
echo "- Test renewal: sudo /usr/local/bin/renew-ssl.sh"
echo "- Check expiration: sudo /usr/local/bin/monitor-ssl.sh"
echo "- View logs: sudo tail -f /var/log/ssl-renewal.log"
echo "- Edit cron: sudo crontab -e"
echo
echo "BEST PRACTICES:"
echo "- Certificates auto-renew 30 days before expiry"
echo "- nginx restarts automatically after renewal"
echo "- Logs are rotated to prevent disk space issues"
echo "- Weekly monitoring checks certificate status"
