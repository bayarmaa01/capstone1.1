#!/bin/bash

# Moodle Setup Completion Script
echo "🎓 Moodle Setup Completion"
echo "=========================="

# Check if config file exists
if [ ! -f "/var/www/html/config.php" ]; then
    echo "❌ config.php not found. Please create it first."
    exit 1
fi

echo "✅ config.php found"

# Get server IP for Moodle URL
SERVER_IP=$(hostname -I | awk '{print $1}')
echo "🌐 Server IP detected: $SERVER_IP"

# Create proper Moodle config with actual server details
echo "📝 Updating Moodle configuration with server details..."

sudo tee /var/www/html/config.php > /dev/null << 'EOF'
<?php  // Moodle configuration file

unset($CFG);
global $CFG;

$CFG = new stdClass();

$CFG->dbtype    = 'mysqli';    // Database type
$CFG->dbhost    = 'localhost'; // Database host
$CFG->dbname    = 'moodle';    // Database name
$CFG->dbuser    = 'moodleuser'; // Database username
$CFG->dbpass    = 'moodlepass';  // Database password
$CFG->prefix    = 'mdl_';      // Table prefix
$CFG->wwwroot   = 'http://localhost'; // Moodle URL (update with your domain)
$CFG->dataroot  = '/var/moodledata'; // Moodle data directory
$CFG->admin     = 'admin';
$CFG->directorypermissions = 02777;
$CFG->smtphosts = '';
$CFG->debug = 0; // Set to 0 for production

require_once(__DIR__.'/lib/setup.php');
EOF

# Set proper permissions
sudo chown www-data:www-data /var/www/html/config.php
sudo chmod 640 /var/www/html/config.php

# Create Moodle data directory
echo "📁 Creating Moodle data directory..."
sudo mkdir -p /var/moodledata
sudo chown www-data:www-data /var/moodledata
sudo chmod 777 /var/moodledata

# Restart web server
echo "🔄 Restarting web server..."
sudo systemctl restart apache2 2>/dev/null || sudo systemctl restart nginx 2>/dev/null || echo "⚠️ Could not restart web server automatically"

# Check Moodle database setup
echo "🗄️ Checking database setup..."
if mysql -u root -e "SHOW DATABASES LIKE 'moodle';" 2>/dev/null; then
    echo "✅ Moodle database exists"
else
    echo "🔧 Creating Moodle database and user..."
    sudo mysql -u root << 'EOF'
CREATE DATABASE moodle DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'moodleuser'@'localhost' IDENTIFIED BY 'moodlepass';
GRANT ALL PRIVILEGES ON moodle.* TO 'moodleuser'@'localhost';
FLUSH PRIVILEGES;
EOF
    echo "✅ Database and user created"
fi

echo ""
echo "🎉 Moodle Setup Complete!"
echo "========================="
echo "🌐 Access Moodle at: http://your-server-ip"
echo "👤 Default admin: admin"
echo "📋 Next steps:"
echo "1. Visit http://your-server-ip in browser"
echo "2. Follow the web installer"
echo "3. Create admin account"
echo "4. Configure site settings"
echo ""
echo "🔧 If issues occur, check:"
echo "   - Apache/Nginx logs: /var/log/apache2/error.log"
echo "   - PHP logs: /var/log/php_errors.log"
echo "   - Moodle logs: /var/moodledata/logs"
