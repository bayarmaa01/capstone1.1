#!/bin/bash
set -e

echo "🔄 Switching deployment..."

FILE="nginx.prod.conf"

CURRENT=$(grep "set \$active_backend" $FILE)

if echo "$CURRENT" | grep -q blue_backend; then
    echo "🟢 Switching to GREEN..."

    # Health check using docker exec (more reliable)
    docker exec capstone11-green_backend-1 curl -f -s http://localhost:4000/api/health > /dev/null || exit 1

    # SAFE replace (only this exact line)
    sed -i 's/set \$active_backend blue_backend;/set \$active_backend green_backend;/' $FILE

else
    echo "🔵 Switching to BLUE..."

    # Health check using docker exec (more reliable)
    docker exec capstone11-blue_backend-1 curl -f -s http://localhost:4000/api/health > /dev/null || exit 1

    sed -i 's/set \$active_backend green_backend;/set \$active_backend blue_backend;/' $FILE
fi

echo "🔄 Reloading nginx (zero downtime)..."
docker exec capstone11-nginx-1 nginx -s reload

echo "✅ Switch complete!"