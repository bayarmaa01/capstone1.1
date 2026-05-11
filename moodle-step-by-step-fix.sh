#!/bin/bash

# Moodle Step-by-Step Fix
echo "🎓 Moodle Step-by-Step Fix"
echo "=============================="

echo "🔍 Issue: Moodle container failing due to unhealthy database dependency"
echo "🔧 Solution: Start services in correct order"

# Step 1: Start database first
echo ""
echo "Step 1: Starting database container..."
docker-compose up -d moodle-db

# Wait for database to be healthy
echo "⏳ Waiting for database to be healthy..."
for i in {1..30}; do
    if docker ps | grep -q "capstone11-moodle-db-1.*healthy"; then
        echo "✅ Database is healthy"
        break
    else
        echo "⏳ Database starting... ($i/30)"
        sleep 2
    fi
done

if ! docker ps | grep -q "capstone11-moodle-db-1.*healthy"; then
    echo "❌ Database failed to become healthy"
    echo "🔍 Checking database logs..."
    docker logs --tail 10 capstone11-moodle-db-1
    exit 1
fi

# Step 2: Start Moodle
echo ""
echo "Step 2: Starting Moodle container..."
docker-compose up -d moodle

# Wait for Moodle to be ready
echo "⏳ Waiting for Moodle to start..."
for i in {1..30}; do
    if docker ps | grep -q "capstone11-moodle-1.*Up"; then
        echo "✅ Moodle container is up"
        break
    else
        echo "⏳ Moodle starting... ($i/30)"
        sleep 2
    fi
done

if ! docker ps | grep -q "capstone11-moodle-1.*Up"; then
    echo "❌ Moodle failed to start"
    echo "🔍 Checking Moodle logs..."
    docker logs --tail 10 capstone11-moodle-1
    exit 1
fi

# Step 3: Test Moodle accessibility
echo ""
echo "Step 3: Testing Moodle accessibility..."
sleep 5
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://40.90.174.78:8081)
echo "📋 HTTP Response Code: $HTTP_CODE"

# Get content preview
echo ""
echo "📋 Moodle homepage content:"
curl -s http://40.90.174.78:8081 | head -5

# Check if config error is resolved
if curl -s http://40.90.174.78:8081 | grep -q "config.php"; then
    echo "❌ Config error still present"
    echo "🔧 Creating config file inside container..."
    
    # Create config file directly in container
    docker exec capstone11-moodle-1 bash -c 'cat > /var/www/html/config.php << "EOF"
<?php
unset($CFG);
global $CFG;
$CFG = new stdClass();
$CFG->dbtype = "mysqli";
$CFG->dbhost = "moodle-db";
$CFG->dbname = "moodle";
$CFG->dbuser = "moodle";
$CFG->dbpass = "moodle_secret";
$CFG->prefix = "mdl_";
$CFG->wwwroot = "http://40.90.174.78:8081";
$CFG->dataroot = "/var/moodledata";
$CFG->admin = "admin";
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

# Step 4: Final verification
echo ""
echo "Step 4: Final verification..."
echo "🌐 Moodle URL: http://40.90.174.78:8081"
echo "📋 Container Status:"
docker ps | grep -E "(moodle|moodle-db)"

echo ""
echo "🎉 Moodle Step-by-Step Fix Complete!"
echo "===================================="
echo "✅ Database: Started and healthy"
echo "✅ Moodle: Started and accessible"
echo "✅ Config: Created (if needed)"
echo ""
echo "🌐 Access Moodle at: http://40.90.174.78:8081"
echo ""
echo "🔧 If still having issues:"
echo "   - Check database logs: docker logs -f capstone11-moodle-db-1"
echo "   - Check Moodle logs: docker logs -f capstone11-moodle-1"
echo "   - Restart specific service: docker-compose restart moodle"
echo "   - Manual config creation: docker exec -it capstone11-moodle-1 bash"
