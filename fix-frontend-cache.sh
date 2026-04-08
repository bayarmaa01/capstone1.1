#!/bin/bash

echo "🔧 COMPLETE FRONTEND CACHE FIX"
echo "================================"

# 1. Stop all containers
echo "🛑 Stopping all containers..."
docker compose down --remove-orphans

# 2. Remove ALL frontend images
echo "🗑️ Removing frontend images..."
docker rmi capstone11-blue_frontend capstone11-green_frontend 2>/dev/null || true
docker rmi $(docker images | grep "capstone11.*frontend" | awk '{print $3}') 2>/dev/null || true

# 3. Clean Docker completely
echo "🧹 Cleaning Docker cache..."
docker builder prune -a -f
docker system prune -a -f

# 4. Update package.json to force new build
echo "📝 Updating package.json version..."
cd frontend
npm version 2.0.1 --no-git-tag-version
cd ..

# 5. Rebuild everything fresh
echo "🏗️ Rebuilding everything..."
docker compose up -d --build --force-recreate

# 6. Wait for full startup
echo "⏳ Waiting for containers to start..."
sleep 30

# 7. Verify frontend is running
echo "✅ Checking frontend status..."
docker ps | grep frontend

# 8. Test frontend
echo "🌐 Testing frontend..."
curl -I http://attendance-ml.duckdns.org/

# 9. Test API
echo "🔌 Testing API..."
curl -I http://attendance-ml.duckdns.org/api/moodle-schedule

echo "✅ FRONTEND CACHE FIX COMPLETE!"
echo "📱 Access: http://attendance-ml.duckdns.org"
echo "🔄 Clear browser cache: Ctrl+Shift+Delete"
