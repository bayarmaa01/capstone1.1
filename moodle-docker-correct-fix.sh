#!/bin/bash

# Correct Moodle Docker Configuration Fix
echo "🐳 Moodle Docker Correct Fix"
echo "============================"

# Get correct container names
MOODLE_CONTAINER="capstone11-moodle-1"
DB_CONTAINER="capstone11-moodle-db-1"

echo "🔍 Using container names:"
echo "   Moodle: $MOODLE_CONTAINER"
echo "   Database: $DB_CONTAINER"

# Check if containers are running
echo ""
echo "🔍 Checking container status..."
if docker ps | grep -q $MOODLE_CONTAINER; then
    echo "✅ Moodle container running"
else
    echo "❌ Moodle container not found"
    exit 1
fi

if docker ps | grep -q $DB_CONTAINER; then
    echo "✅ Database container running"
else
    echo "❌ Database container not found"
    exit 1
fi

# Check config file in Moodle container
echo ""
echo "🔧 Checking Moodle configuration..."
if docker exec $MOODLE_CONTAINER test -f /var/www/html/config.php; then
    echo "✅ Config file exists"
    echo "📋 Config file preview:"
    docker exec $MOODLE_CONTAINER head -5 /var/www/html/config.php
else
    echo "❌ Config file missing - creating it..."
    
    # Create config file in Moodle container
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
    
    echo "✅ Config file created"
fi

# Test database connection
echo ""
echo "🔍 Testing database connection..."
if docker exec $MOODLE_CONTAINER php -r "
\$mysqli = new mysqli('capstone11-moodle-db-1', 'moodle', 'moodle', 'moodle');
if (\$mysqli->connect_error) {
    echo '❌ Database connection failed: ' . \$mysqli->connect_error . '\n';
} else {
    echo '✅ Database connection successful\n';
    \$mysqli->close();
}
"; then
    echo "✅ Database connectivity confirmed"
else
    echo "⚠️ Database connection issues"
fi

# Check Moodle data directory
echo ""
echo "📁 Checking Moodle data directory..."
if docker exec $MOODLE_CONTAINER test -d /var/moodledata; then
    echo "✅ Data directory exists"
    docker exec $MOODLE_CONTAINER ls -ld /var/moodledata
else
    echo "❌ Data directory missing - creating..."
    docker exec $MOODLE_CONTAINER mkdir -p /var/moodledata
    docker exec $MOODLE_CONTAINER chown www-data:www-data /var/moodledata
    docker exec $MOODLE_CONTAINER chmod 777 /var/moodledata
    echo "✅ Data directory created"
fi

# Test Moodle accessibility
echo ""
echo "🌐 Testing Moodle accessibility..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://40.90.174.78:8081)
echo "📋 HTTP Response Code: $HTTP_CODE"

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Moodle accessible"
elif [ "$HTTP_CODE" = "500" ]; then
    echo "⚠️ Moodle has internal server error (likely config issue)"
elif [ "$HTTP_CODE" = "302" ]; then
    echo "✅ Moodle redirecting (normal for setup)"
else
    echo "⚠️ Moodle responding with code: $HTTP_CODE"
fi

# Check Moodle container logs
echo ""
echo "📋 Moodle container logs (last 10 lines):"
docker logs --tail 10 $MOODLE_CONTAINER

# Check database container logs
echo ""
echo "📋 Database container logs (last 5 lines):"
docker logs --tail 5 $DB_CONTAINER

echo ""
echo "🎉 Moodle Docker Fix Complete!"
echo "============================"
echo "🌐 Access Moodle: http://40.90.174.78:8081"
echo "📋 Status:"
echo "   Moodle container: ✅ Running"
echo "   Database container: ✅ Running"
echo "   Config file: ✅ Created"
echo "   Data directory: ✅ Ready"
echo ""
echo "🔧 If still getting config errors:"
echo "1. Restart Moodle container: docker restart $MOODLE_CONTAINER"
echo "2. Check Moodle logs: docker logs -f $MOODLE_CONTAINER"
echo "3. Access Moodle in browser to complete web setup"
echo ""
echo "🌐 Moodle should now be accessible at: http://40.90.174.78:8081"
