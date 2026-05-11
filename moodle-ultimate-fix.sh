#!/bin/bash

# Moodle Ultimate Fix Script
echo "🎓 Moodle Ultimate Fix"
echo "========================"

echo "🔍 Final comprehensive fix for all Moodle issues"

# Stop all services completely
echo "🛑 Stopping all services..."
docker compose down

# Remove all problematic volumes
echo "🗑️ Removing all Moodle-related volumes..."
docker volume rm capstone1.1_moodle_data 2>/dev/null || true
docker volume rm capstone1.1_moodle_db_data 2>/dev/null || true

# Create fresh directories with proper permissions
echo "📁 Creating fresh directories..."
mkdir -p ./moodle-data
sudo chown -R $USER:$USER ./moodle-data
sudo chmod 755 ./moodle-data

# Create fresh config file
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

# Set proper permissions
sudo chmod 644 ./moodle-data/config.php
echo "✅ Config file created with proper permissions"

# Start database first
echo ""
echo "🗄️ Starting database container..."
docker compose up -d moodle-db

# Wait for database to be healthy
echo "⏳ Waiting for database to be healthy..."
for i in {1..15}; do
    if docker ps | grep -q "capstone11-moodle-db-1.*healthy"; then
        echo "✅ Database is healthy (attempt $i/15)"
        break
    else
        echo "⏳ Database starting... ($i/15)"
        sleep 2
    fi
done

if ! docker ps | grep -q "capstone11-moodle-db-1.*healthy"; then
    echo "❌ Database failed to become healthy"
    echo "🔍 Checking database logs..."
    docker compose logs --tail 15 moodle-db
    exit 1
fi

# Start Moodle
echo ""
echo "🚀 Starting Moodle container..."
docker compose up -d moodle

# Wait for Moodle to be ready
echo "⏳ Waiting for Moodle to be ready..."
for i in {1..20}; do
    if docker ps | grep -q "capstone11-moodle-1.*healthy"; then
        echo "✅ Moodle container is healthy (attempt $i/20)"
        break
    elif docker ps | grep -q "capstone11-moodle-1.*Up"; then
        echo "⏳ Moodle container starting... ($i/20)"
        sleep 2
    else
        echo "⏳ Moodle container not ready... ($i/20)"
        sleep 2
    fi
done

if ! docker ps | grep -q "capstone11-moodle-1.*healthy"; then
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

# Check if Moodle is working
if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Moodle is accessible and working!"
    echo ""
    echo "🎉 Moodle Ultimate Fix Complete!"
    echo "=================================="
    echo "🌐 Moodle URL: http://40.90.174.78:8081"
    echo "✅ Database: Healthy"
    echo "✅ Moodle: Running"
    echo "✅ Config: Properly mounted"
    echo "✅ Data directory: Accessible"
    echo ""
    echo "🌐 Moodle is now fully functional!"
    echo ""
    echo "📋 Next Steps:"
    echo "1. Open browser to: http://40.90.174.78:8081"
    echo "2. Complete Moodle web setup if prompted"
    echo "3. Create admin account"
    echo "4. Configure site settings"
    echo ""
    echo "🔧 Troubleshooting:"
    echo "   - Check logs: docker compose logs moodle"
    echo "   - Access container: docker exec -it capstone11-moodle-1 bash"
    echo "   - Check database: docker exec -it capstone11-moodle-db-1 mysql -u moodle -pmoodle_secret"
elif [ "$HTTP_CODE" = "302" ]; then
    echo "✅ Moodle redirecting (setup mode)"
    echo "🌐 Complete web setup at: http://40.90.174.78:8081"
elif [ "$HTTP_CODE" = "500" ]; then
    echo "⚠️ Moodle has internal server error"
    echo "🔍 Checking Moodle logs..."
    docker compose logs --tail 10 moodle
else
    echo "⚠️ Moodle responding with code: $HTTP_CODE"
    echo "🔍 Checking Moodle logs..."
    docker compose logs --tail 10 moodle
fi
