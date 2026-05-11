#!/bin/bash

# Moodle Services Start Script
echo "🎓 Moodle Services Start"
echo "========================"

echo "🔄 Starting all services with docker compose..."

# Start all services
docker compose up -d

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 20

# Check service status
echo ""
echo "📋 Service Status:"
docker compose ps

echo ""
echo "🌐 Testing Moodle accessibility..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://40.90.174.78:8081)
echo "📋 HTTP Response Code: $HTTP_CODE"

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Moodle is accessible"
elif [ "$HTTP_CODE" = "302" ]; then
    echo "✅ Moodle redirecting (setup mode)"
elif [ "$HTTP_CODE" = "500" ]; then
    echo "⚠️ Moodle has internal server error"
else
    echo "⚠️ Moodle responding with code: $HTTP_CODE"
fi

echo ""
echo "🎉 Services Started!"
echo "=================="
echo "🌐 Moodle URL: http://40.90.174.78:8081"
echo "📋 All services should be running"
echo ""
echo "🔧 If Moodle shows config errors:"
echo "   - Check logs: docker compose logs moodle"
echo "   - Access container: docker exec -it capstone11-moodle-1 bash"
echo "   - Create config: docker exec capstone11-moodle-1 bash -c 'cat > /var/www/html/config.php << \"EOF\"...'"
