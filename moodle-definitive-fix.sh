#!/bin/bash

# Definitive Moodle Fix Script
echo "🎓 Definitive Moodle Fix"
echo "======================"

echo "🔍 Issue: ./moodle-data/config.php is a directory, not a file"
echo "🔧 Solution: Remove directory and create proper file"

# Stop Moodle container first
echo "🛑 Stopping Moodle container..."
docker stop capstone11-moodle-1

# Remove the problematic directory
echo "🗑️ Removing problematic config.php directory..."
sudo rm -rf ./moodle-data/config.php
echo "✅ Directory removed"

# Create proper config file
echo "📝 Creating proper config.php file..."
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

# Set proper permissions
sudo chmod 644 ./moodle-data/config.php
sudo chown $USER:$USER ./moodle-data/config.php

echo "✅ Config file created"
echo "📋 File details:"
ls -la ./moodle-data/config.php
echo "📋 File preview:"
head -5 ./moodle-data/config.php

# Start Moodle container
echo ""
echo "🚀 Starting Moodle container..."
docker start capstone11-moodle-1

# Wait for container to be ready
echo "⏳ Waiting for Moodle to start..."
sleep 15

# Check container status
echo "🔍 Checking container status..."
docker ps | grep moodle

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
    echo "🔍 Checking container config file..."
    docker exec capstone11-moodle-1 ls -la /var/www/html/config.php
    docker exec capstone11-moodle-1 cat /var/www/html/config.php | head -5
else
    echo "✅ Config error resolved!"
fi

# Final verification
echo ""
echo "🎯 Final Verification:"
echo "===================="
echo "🌐 Moodle URL: http://40.90.174.78:8081"
echo "📁 Host config file: $(test -f ./moodle-data/config.php && echo 'EXISTS' || echo 'MISSING')"
echo "🐳 Container: $(docker ps | grep moodle | grep -c .) running"
echo "📋 HTTP Status: $HTTP_CODE"

if [ "$HTTP_CODE" = "200" ] && ! curl -s http://40.90.174.78:8081 | grep -q "config.php"; then
    echo "🎉 SUCCESS: Moodle is fully functional!"
else
    echo "⚠️ Issues still present - check logs:"
    echo "   docker logs capstone11-moodle-1"
fi

echo ""
echo "🌐 Access Moodle at: http://40.90.174.78:8081"
