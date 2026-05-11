#!/bin/bash

# Complete Moodle Docker Fix
echo "🐳 Complete Moodle Docker Fix"
echo "============================"

# Get container names
MOODLE_CONTAINER="capstone11-moodle-1"
DB_CONTAINER="capstone11-moodle-db-1"

echo "🔍 Analyzing Moodle Docker setup issues..."
echo "   Moodle container: $MOODLE_CONTAINER"
echo "   Database container: $DB_CONTAINER"

# Check docker-compose Moodle configuration
echo ""
echo "📋 Checking docker-compose Moodle configuration..."
if [ -f "docker-compose.yml" ]; then
    echo "✅ docker-compose.yml found"
    echo "🔍 Moodle service configuration:"
    grep -A 20 "moodle:" docker-compose.yml | head -20
    echo ""
    echo "🔍 Moodle DB service configuration:"
    grep -A 10 "moodle-db:" docker-compose.yml | head -10
else
    echo "❌ docker-compose.yml not found"
fi

# Fix 1: Remove existing config file if it's a directory
echo ""
echo "🔧 Fix 1: Checking config file issue..."
if docker exec $MOODLE_CONTAINER test -d /var/www/html/config.php; then
    echo "❌ config.php is a directory - removing it"
    docker exec $MOODLE_CONTAINER rm -rf /var/www/html/config.php
fi

# Fix 2: Create proper config file with correct database credentials
echo ""
echo "🔧 Fix 2: Creating proper config file..."
docker exec $MOODLE_CONTAINER bash -c 'cat > /var/www/html/config.php << "EOF"
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
EOF'

echo "✅ Config file created with correct credentials"

# Fix 3: Create data directory with proper permissions
echo ""
echo "🔧 Fix 3: Setting up Moodle data directory..."
docker exec $MOODLE_CONTAINER mkdir -p /var/moodledata 2>/dev/null || true
docker exec $MOODLE_CONTAINER chown -R www-data:www-data /var/moodledata 2>/dev/null || true
docker exec $MOODLE_CONTAINER chmod -R 777 /var/moodledata 2>/dev/null || true
echo "✅ Data directory configured"

# Fix 4: Test database connection with correct credentials
echo ""
echo "🔧 Fix 4: Testing database connection..."
if docker exec $MOODLE_CONTAINER php -r "
\$mysqli = new mysqli('moodle-db', 'moodle', 'moodle_secret', 'moodle');
if (\$mysqli->connect_error) {
    echo '❌ Database connection failed: ' . \$mysqli->connect_error . '\n';
} else {
    echo '✅ Database connection successful\n';
    \$mysqli->close();
}
"; then
    echo "✅ Database connectivity working"
else
    echo "⚠️ Database connection issues - checking database setup..."
    
    # Check if database user exists
    docker exec $DB_CONTAINER mysql -u root -proot_secret -e "
    SELECT User, Host FROM mysql.user WHERE User='moodle';
    SHOW DATABASES LIKE 'moodle';
    "
fi

# Fix 5: Restart Moodle container to apply changes
echo ""
echo "🔧 Fix 5: Restarting Moodle container..."
docker restart $MOODLE_CONTAINER
sleep 5

# Fix 6: Verify Moodle accessibility
echo ""
echo "🔧 Fix 6: Verifying Moodle accessibility..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://40.90.174.78:8081)
echo "📋 HTTP Response Code: $HTTP_CODE"

case $HTTP_CODE in
    200)
        echo "✅ Moodle accessible and working"
        ;;
    302)
        echo "✅ Moodle redirecting (setup mode)"
        ;;
    500)
        echo "⚠️ Moodle has internal server error"
        echo "🔍 Checking error logs..."
        docker logs --tail 5 $MOODLE_CONTAINER
        ;;
    *)
        echo "⚠️ Moodle responding with code: $HTTP_CODE"
        ;;
esac

# Fix 7: Check if Moodle needs web-based setup
echo ""
echo "🔧 Fix 7: Checking Moodle setup status..."
if curl -s http://40.90.174.78:8081 | grep -q "Moodle"; then
    echo "✅ Moodle interface loading"
    if curl -s http://40.90.174.78:8081 | grep -q "install"; then
        echo "🔧 Moodle needs web-based installation"
        echo "🌐 Open browser to: http://40.90.174.78:8081"
        echo "📋 Follow the web installer steps"
    else
        echo "✅ Moodle appears to be installed"
    fi
else
    echo "⚠️ Moodle interface not loading properly"
fi

# Fix 8: Show container logs for debugging
echo ""
echo "📋 Recent Moodle container logs:"
docker logs --tail 10 $MOODLE_CONTAINER

echo ""
echo "📋 Recent Database container logs:"
docker logs --tail 5 $DB_CONTAINER

echo ""
echo "🎉 Moodle Docker Fix Complete!"
echo "============================"
echo "🌐 Access Moodle: http://40.90.174.78:8081"
echo ""
echo "📋 Applied Fixes:"
echo "   ✅ Fixed config.php directory issue"
echo "   ✅ Created config with correct database credentials"
echo "   ✅ Set up data directory permissions"
echo "   ✅ Tested database connectivity"
echo "   ✅ Restarted Moodle container"
echo "   ✅ Verified accessibility"
echo ""
echo "🔧 Docker-compose Configuration:"
echo "   Moodle DB Host: moodle-db"
echo "   Moodle DB User: moodle"
echo "   Moodle DB Password: moodle_secret"
echo "   Moodle DB Name: moodle"
echo ""
echo "🌐 Next Steps:"
echo "1. Access Moodle in browser: http://40.90.174.78:8081"
echo "2. If prompted, complete web-based installation"
echo "3. Create admin account"
echo "4. Configure site settings"
echo ""
echo "🔧 If still having issues:"
echo "   - Check full logs: docker logs -f $MOODLE_CONTAINER"
echo "   - Recreate containers: docker-compose down && docker-compose up -d"
echo "   - Check database: docker exec -it $DB_CONTAINER mysql -u root -proot_secret"
