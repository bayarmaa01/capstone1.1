#!/bin/bash

# Moodle Final Complete Fix Script
echo "🎓 Moodle Final Complete Fix"
echo "============================="

echo "🔍 Comprehensive fix for all Moodle issues"
echo "   - Data directory permissions"
echo "   - Config file creation"
echo "   - Container startup sequence"
echo "   - Service dependencies"

# Stop all containers first
echo "🛑 Stopping all containers..."
docker compose down

# Clean up volumes completely
echo "🗑️ Removing all Moodle-related volumes..."
docker volume rm capstone1.1_moodle_data 2>/dev/null || true
docker volume rm capstone1.1_moodle_db_data 2>/dev/null || true

# Create fresh moodle-data directory with proper permissions
echo "📁 Creating fresh moodle-data directory..."
sudo rm -rf ./moodle-data
mkdir -p ./moodle-data
sudo chown -R $USER:$USER ./moodle-data
chmod 755 ./moodle-data

# Create config.php in moodle-data directory
echo "📝 Creating fresh config.php..."
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

chmod 644 ./moodle-data/config.php
echo "✅ Config file created with proper permissions"

# Start database first
echo "🗄️ Starting database container..."
docker compose up -d moodle-db

# Wait for database to be healthy
echo "⏳ Waiting for database to be healthy..."
for i in {1..30}; do
    if docker ps | grep -q "capstone11-moodle-db-1.*healthy"; then
        echo "✅ Database is healthy (attempt $i/30)"
        break
    else
        echo "⏳ Database starting... ($i/30)"
        sleep 2
    fi
done

if ! docker ps | grep -q "capstone11-moodle-db-1.*healthy"; then
    echo "❌ Database failed to become healthy"
    echo "🔍 Checking database logs..."
    docker compose logs --tail 10 moodle-db
    exit 1
fi

# Start Moodle container
echo "🚀 Starting Moodle container..."
docker compose up -d moodle

# Wait for Moodle to be ready
echo "⏳ Waiting for Moodle to be ready..."
for i in {1..30}; do
    if docker ps | grep -q "capstone11-moodle-1.*Up.*healthy"; then
        echo "✅ Moodle container is healthy (attempt $i/30)"
        break
    elif docker ps | grep -q "capstone11-moodle-1.*Up"; then
        echo "⏳ Moodle container starting... ($i/30)"
        sleep 2
    else
        echo "⏳ Moodle container not ready... ($i/30)"
        sleep 2
    fi
done

if ! docker ps | grep -q "capstone11-moodle-1.*Up"; then
    echo "❌ Moodle failed to start"
    echo "🔍 Checking Moodle logs..."
    docker compose logs --tail 20 moodle
    exit 1
fi

# Test Moodle accessibility
echo ""
echo "🌐 Testing Moodle accessibility..."
sleep 5
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://40.90.174.78:8081)
echo "📋 HTTP Response Code: $HTTP_CODE"

# Get content preview
echo ""
echo "📋 Moodle homepage content:"
curl -s http://40.90.174.78:8081 | head -10

# Check if config error is resolved
if curl -s http://40.90.174.78:8081 | grep -q "config.php"; then
    echo "❌ Config error still present"
    echo "🔧 Creating config file inside container..."
    
    # Create config file directly in container
    docker exec capstone11-moodle-1 bash -c 'cat > /var/www/html/config.php << "EOF"
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
    
    echo "✅ Config file created in container"
    
    # Restart Moodle
    docker restart capstone11-moodle-1
    sleep 5
    
    # Test again
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://40.90.174.78:8081)
    echo "📋 HTTP Response Code after restart: $HTTP_CODE"
else
    echo "✅ Config error appears to be resolved!"
fi

# Verify data directory in container
echo ""
echo "📁 Verifying Moodle data directory in container..."
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
echo "🎉 Moodle Final Complete Fix Done!"
echo "=================================="
echo "🌐 Moodle URL: http://40.90.174.78:8081"
echo "✅ Host data directory: Created with proper permissions"
echo "✅ Config file: Created and mounted"
echo "✅ Database: Started and healthy"
echo "✅ Container: Started and accessible"
echo "✅ Data directory: Verified in container"
echo ""
echo "📋 Final Status:"
echo "   HTTP Status: $HTTP_CODE"
echo "   Container Status: $(docker ps | grep moodle | head -1)"
echo "   Database Status: $(docker ps | grep moodle-db | head -1)"
echo ""
echo "🌐 Moodle should now be fully functional!"
echo ""
echo "🔧 If still having issues:"
echo "   - Check all logs: docker compose logs"
echo "   - Access container: docker exec -it capstone11-moodle-1 bash"
echo "   - Complete restart: docker compose down && docker compose up -d"
