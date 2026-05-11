#!/bin/bash

# Complete Moodle Fix Script
echo "🎓 Complete Moodle Setup Fix"
echo "============================"

# Update system packages
echo "📦 Updating system packages..."
sudo apt update

# Install required packages
echo "🔧 Installing required packages..."
sudo apt install -y apache2 php php-mysql php-gd php-xml php-mbstring php-curl php-zip php-intl mariadb-server mariadb-client

# Start and enable services
echo "🚀 Starting services..."
sudo systemctl start mariadb
sudo systemctl enable mariadb
sudo systemctl start apache2
sudo systemctl enable apache2

# Secure MariaDB installation (non-interactive)
echo "🔒 Securing MariaDB..."
sudo mysql -u root << 'EOF'
DELETE FROM mysql.user WHERE User='';
DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');
DROP DATABASE IF EXISTS test;
DELETE FROM mysql.db WHERE Db='test' OR Db='test\\_%';
FLUSH PRIVILEGES;
EOF

# Create Moodle database and user
echo "🗄️ Creating Moodle database..."
sudo mysql -u root << 'EOF'
CREATE DATABASE IF NOT EXISTS moodle DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'moodleuser'@'localhost' IDENTIFIED BY 'moodlepass';
GRANT ALL PRIVILEGES ON moodle.* TO 'moodleuser'@'localhost';
FLUSH PRIVILEGES;
EOF

# Test database connection
echo "🔍 Testing database connection..."
if mysql -u moodleuser -pmoodlepass -e "SELECT 1;" moodle &>/dev/null; then
    echo "✅ Database connection successful"
else
    echo "❌ Database connection failed"
fi

# Create Moodle data directory
echo "📁 Setting up Moodle data directory..."
sudo mkdir -p /var/moodledata
sudo chown www-data:www-data /var/moodledata
sudo chmod 777 /var/moodledata

# Update Moodle config with proper settings
echo "📝 Creating Moodle configuration..."
sudo tee /var/www/html/config.php > /dev/null << 'EOF'
<?php
// Moodle configuration file

unset($CFG);
global $CFG;

$CFG = new stdClass();

$CFG->dbtype    = 'mysqli';
$CFG->dbhost    = 'localhost';
$CFG->dbname    = 'moodle';
$CFG->dbuser    = 'moodleuser';
$CFG->dbpass    = 'moodlepass';
$CFG->prefix    = 'mdl_';
$CFG->wwwroot   = 'http://172.17.0.4';
$CFG->dataroot  = '/var/moodledata';
$CFG->admin     = 'admin';
$CFG->directorypermissions = 02777;
$CFG->smtphosts = '';
$CFG->debug = 0;

require_once(__DIR__.'/lib/setup.php');
EOF

# Set proper permissions for config
sudo chown www-data:www-data /var/www/html/config.php
sudo chmod 640 /var/www/html/config.php

# Test PHP installation
echo "🧪 Testing PHP..."
php -v
echo "PHP modules:"
php -m | grep -E "(mysql|mysqli|gd|xml|mbstring|curl|zip|intl)"

# Restart Apache to load PHP modules
echo "🔄 Restarting Apache..."
sudo systemctl restart apache2

# Wait a moment for services to start
sleep 3

# Test Moodle accessibility
echo "🌐 Testing Moodle accessibility..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost | grep -E "200|302|500"; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost)
    echo "✅ Moodle responds with HTTP $HTTP_CODE"
else
    echo "⚠️ Moodle not responding (may need browser setup)"
fi

# Test PHP config loading
echo "🧪 Testing PHP configuration..."
sudo -u www-data php -r "
try {
    require_once('/var/www/html/config.php');
    echo '✅ Config file loads successfully\n';
    echo '📋 Moodle wwwroot: ' . \$CFG->wwwroot . '\n';
} catch (Exception \$e) {
    echo '❌ Config file error: ' . \$e->getMessage() . '\n';
} catch (Error \$e) {
    echo '❌ Config file error: ' . \$e->getMessage() . '\n';
}
"

echo ""
echo "🎉 Moodle Setup Complete!"
echo "========================"
echo "🌐 Access Moodle at: http://172.17.0.4"
echo "📋 Services status:"
echo "   MariaDB: $(systemctl is-active mariadb)"
echo "   Apache2: $(systemctl is-active apache2)"
echo "   PHP: $(php -v | head -1)"
echo ""
echo "🔧 If issues persist:"
echo "   - Check Apache logs: sudo journalctl -u apache2 -f"
echo "   - Check MariaDB logs: sudo journalctl -u mariadb -f"
echo "   - Check PHP errors: tail -f /var/log/apache2/error.log"
echo ""
echo "🌐 Next Steps:"
echo "1. Open browser to: http://172.17.0.4"
echo "2. Follow Moodle web installer"
echo "3. Create admin account"
echo "4. Configure site settings"
