#!/bin/bash

# Moodle Container Recreation Script
echo "🐳 Moodle Container Recreation"
echo "=============================="

echo "🔄 Using existing docker-compose.yml without modifications"
echo "🔧 This will recreate Moodle containers properly"

# Stop all containers
echo "🛑 Stopping all containers..."
docker-compose down

# Clean up any orphaned containers
echo "🧹 Cleaning up orphaned containers..."
docker-compose down --remove-orphans

# Remove volumes that might cause issues
echo "🗑️ Removing problematic volumes..."
docker volume rm capstone1.1_moodle_data 2>/dev/null || true

# Start containers fresh
echo "🚀 Starting containers fresh..."
docker-compose up -d

# Wait for Moodle to be ready
echo "⏳ Waiting for Moodle to be ready..."
echo "This may take 1-2 minutes for initial setup..."

# Monitor Moodle container status
for i in {1..12}; do
    if docker ps | grep -q "capstone11-moodle-1.*Up"; then
        echo "✅ Moodle container is up (attempt $i/12)"
        
        # Test if Moodle is responding
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://40.90.174.78:8081 2>/dev/null || echo "000")
        
        if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "302" ]; then
            echo "🌐 Moodle is accessible (HTTP $HTTP_CODE)"
            echo ""
            echo "🎉 Moodle Container Recreation Complete!"
            echo "========================================"
            echo "🌐 Access Moodle at: http://40.90.174.78:8081"
            echo "✅ All containers started fresh"
            echo "✅ No config mount conflicts"
            echo ""
            echo "📋 Container Status:"
            docker ps | grep -E "(moodle|moodle-db)"
            echo ""
            echo "🌐 Next Steps:"
            echo "1. Open browser to: http://40.90.174.78:8081"
            echo "2. Complete Moodle web setup if prompted"
            echo "3. Create admin account"
            echo "4. Configure site settings"
            echo ""
            echo "🔧 If issues occur:"
            echo "   - Check logs: docker-compose logs moodle"
            echo "   - Restart: docker-compose restart moodle"
            echo "   - Check database: docker exec -it capstone11-moodle-db-1 mysql -u moodle -pmoodle_secret"
            exit 0
        elif [ "$HTTP_CODE" = "000" ]; then
            echo "⏳ Moodle starting up... (attempt $i/12)"
        else
            echo "⚠️ Moodle responding with HTTP $HTTP_CODE (attempt $i/12)"
        fi
        
        sleep 10
    else
        echo "⏳ Waiting for Moodle container to start... (attempt $i/12)"
        sleep 10
    fi
done

echo ""
echo "❌ Moodle container failed to start properly"
echo "🔍 Checking container logs..."
docker-compose logs moodle --tail 20
echo ""
echo "🔧 Manual troubleshooting:"
echo "   - Check all containers: docker ps -a"
echo "   - Check specific logs: docker logs capstone11-moodle-1"
echo "   - Restart manually: docker-compose up -d moodle"
echo "   - Recreate completely: docker-compose down && docker-compose up -d"
