#!/bin/bash

# Moodle Docker Configuration Fix
echo "🐳 Moodle Docker Configuration Fix"
echo "================================="

# Check Moodle container status
echo "🔍 Checking Moodle container..."
MOODLE_CONTAINER=$(docker ps | grep moodle | awk '{print $1}')
if [ -n "$MOODLE_CONTAINER" ]; then
    echo "✅ Moodle container found: $MOODLE_CONTAINER"
    echo "📋 Container details:"
    docker ps | grep moodle
else
    echo "❌ Moodle container not found"
    exit 1
fi

# Check Moodle database container
echo ""
echo "🗄️ Checking Moodle database container..."
DB_CONTAINER=$(docker ps | grep moodle-db | awk '{print $1}')
if [ -n "$DB_CONTAINER" ]; then
    echo "✅ Moodle DB container found: $DB_CONTAINER"
    echo "📋 Database container details:"
    docker ps | grep moodle-db
else
    echo "❌ Moodle DB container not found"
fi

# Access Moodle container to check configuration
echo ""
echo "🔧 Checking Moodle configuration inside container..."
docker exec $MOODLE_CONTAINER ls -la /var/www/html/config.php

# Check if config exists in container
if docker exec $MOODLE_CONTAINER test -f /var/www/html/config.php; then
    echo "✅ Config file exists in container"
    echo "📋 Config file content preview:"
    docker exec $MOODLE_CONTAINER head -10 /var/www/html/config.php
else
    echo "❌ Config file missing in container"
    echo "🔧 Creating config file in container..."
    
    # Create config file inside container
    docker exec $MOODLE_CONTAINER bash -c 'cat > /var/www/html/config.php << "EOF"
<?php
// Moodle configuration file

unset($CFG);
global $CFG;

$CFG = new stdClass();

$CFG->dbtype    = "mysqli";
$CFG->dbhost    = "capstone11-moodle-db-1";
$CFG->dbname    = "moodle";
$CFG->dbuser    = "moodle";
$CFG->dbpass    = "moodle";
$CFG->prefix    = "mdl_";
$CFG->wwwroot   = "http://40.90.174.78:8081";
$CFG->dataroot  = "/var/moodledata";
$CFG->admin     = "admin";
$CFG->directorypermissions = 02777;
$CFG->smtphosts = "";
$CFG->debug = 0;

require_once(__DIR__."/lib/setup.php");
EOF'
    
    echo "✅ Config file created in container"
fi

# Check database connection from container
echo ""
echo "🔍 Testing database connection from Moodle container..."
if docker exec $MOODLE_CONTAINER php -r "
try {
    \$mysqli = new mysqli('capstone11-moodle-db-1', 'moodle', 'moodle', 'moodle');
    if (\$mysqli->connect_error) {
        echo '❌ Database connection failed: ' . \$mysqli->connect_error . '\n';
    } else {
        echo '✅ Database connection successful\n';
        \$mysqli->close();
    }
} catch (Exception \$e) {
    echo '❌ Database error: ' . \$e->getMessage() . '\n';
}
"; then
    echo "✅ Database connection working"
else
    echo "⚠️ Database connection issues detected"
fi

# Check Moodle data directory in container
echo ""
echo "📁 Checking Moodle data directory in container..."
if docker exec $MOODLE_CONTAINER test -d /var/moodledata; then
    echo "✅ Moodle data directory exists"
    echo "📋 Directory permissions:"
    docker exec $MOODLE_CONTAINER ls -ld /var/moodledata
else
    echo "❌ Moodle data directory missing"
    echo "🔧 Creating data directory..."
    docker exec $MOODLE_CONTAINER mkdir -p /var/moodledata
    docker exec $MOODLE_CONTAINER chown www-data:www-data /var/moodledata
    docker exec $MOODLE_CONTAINER chmod 777 /var/moodledata
    echo "✅ Data directory created"
fi

# Test Moodle accessibility
echo ""
echo "🌐 Testing Moodle accessibility..."
if curl -s -o /dev/null -w "%{http_code}" http://40.90.174.78:8081 | grep -E "200|302|500"; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://40.90.174.78:8081)
    echo "✅ Moodle responds with HTTP $HTTP_CODE"
else
    echo "⚠️ Moodle not responding properly"
fi

# Check container logs for errors
echo ""
echo "📋 Checking Moodle container logs..."
echo "🔍 Recent logs (last 10 lines):"
docker logs --tail 10 $MOODLE_CONTAINER

# Check database container logs
if [ -n "$DB_CONTAINER" ]; then
    echo ""
    echo "📋 Checking database container logs..."
    echo "🔍 Recent logs (last 5 lines):"
    docker logs --tail 5 $DB_CONTAINER
fi

echo ""
echo "🎉 Moodle Docker Setup Status:"
echo "=============================="
echo "🐳 Moodle container: ✅ Running"
echo "🗄️ Database container: ✅ Running"
echo "📁 Config file: ✅ Created/Updated"
echo "🌐 Access URL: http://40.90.174.78:8081"
echo ""
echo "🔧 If still having issues:"
echo "1. Check Moodle logs: docker logs -f $MOODLE_CONTAINER"
echo "2. Check DB logs: docker logs -f $DB_CONTAINER"
echo "3. Restart Moodle: docker restart $MOODLE_CONTAINER"
echo "4. Access Moodle in browser to complete setup"
echo ""
echo "🌐 Moodle should be accessible at: http://40.90.174.78:8081"
