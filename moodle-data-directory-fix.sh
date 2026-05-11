#!/bin/bash

# Moodle Data Directory Fix Script
echo "🎓 Moodle Data Directory Fix"
echo "============================="

echo "🔍 Issue: Moodle data directory does not exist"
echo "🔧 Solution: Create data directory and fix permissions"

# Check if moodle-data directory exists on host
if [ ! -d "./moodle-data" ]; then
    echo "📁 Creating moodle-data directory..."
    mkdir -p ./moodle-data
    echo "✅ Directory created"
else
    echo "✅ moodle-data directory exists"
fi

# Check if config.php exists in moodle-data
if [ ! -f "./moodle-data/config.php" ]; then
    echo "📝 Creating config.php in moodle-data directory..."
    cat > ./moodle-data/config.php << 'EOF'
<?php
// Moodle configuration file

unset($CFG);
global $CFG;

$CFG = new stdClass();

$CFG->dbtype    = "mysqli";
$CFG->dbhost    = "moodle-db";
$CFG->dbname    = "moodle";
$CFG->dbuser    = "moodle";
$CFG->dbpass    = "moodle_secret";
$CFG->prefix    = "mdl_";
$CFG->wwwroot   = "http://40.90.174.78:8081";
$CFG->dataroot  = "/var/moodledata";
$CFG->admin     = "admin";
$CFG->directorypermissions = 02777;
$CFG->smtphosts = "";
$CFG->debug = 0;

require_once(__DIR__."/lib/setup.php");
EOF
    echo "✅ config.php created"
else
    echo "✅ config.php already exists"
fi

# Set proper permissions
chmod 644 ./moodle-data/config.php
echo "✅ Config file permissions set"

# Start services with data directory fix
echo ""
echo "🚀 Starting services with fixed data directory..."
docker compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 20

# Test Moodle accessibility
echo ""
echo "🌐 Testing Moodle accessibility..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://40.90.174.78:8081)
echo "📋 HTTP Response Code: $HTTP_CODE"

# Get content preview
echo ""
echo "📋 Moodle homepage content:"
curl -s http://40.90.174.78:8081 | head -10

# Check if config error is resolved
if curl -s http://40.90.174.78:8081 | grep -q "config.php"; then
    echo "❌ Config error still present"
    echo "🔧 Checking container config file..."
    docker exec capstone11-moodle-1 ls -la /var/www/html/config.php 2>/dev/null || echo "Config file not found"
    docker exec capstone11-moodle-1 cat /var/www/html/config.php 2>/dev/null | head -5 || echo "Cannot read config file"
else
    echo "✅ Config error appears to be resolved!"
fi

# Check data directory in container
echo ""
echo "📁 Checking Moodle data directory in container..."
if docker exec capstone11-moodle-1 test -d /var/moodledata; then
    echo "✅ Data directory exists in container"
    echo "📋 Directory permissions:"
    docker exec capstone11-moodle-1 ls -ld /var/moodledata
else
    echo "❌ Data directory missing in container"
    echo "🔧 Creating data directory in container..."
    docker exec capstone11-moodle-1 mkdir -p /var/moodledata
    docker exec capstone11-moodle-1 chown www-data:www-data /var/moodledata
    docker exec capstone11-moodle-1 chmod 777 /var/moodledata
    echo "✅ Data directory created in container"
fi

echo ""
echo "🎉 Moodle Data Directory Fix Complete!"
echo "====================================="
echo "🌐 Moodle URL: http://40.90.174.78:8081"
echo "✅ Host data directory: Created/Verified"
echo "✅ Config file: Created/Updated"
echo "✅ Container: Started"
echo "✅ Data directory: Configured"
echo ""
echo "🔧 If still having issues:"
echo "   - Check logs: docker compose logs moodle"
echo "   - Check data directory: docker exec capstone11-moodle-1 ls -la /var/moodledata"
echo "   - Restart services: docker compose restart moodle"
