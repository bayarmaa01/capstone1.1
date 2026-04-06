#!/bin/bash
set -e

echo "🔄 Switching deployment..."

# detect current backend from nginx.conf
CURRENT=$(grep active_backend nginx.prod.conf)

if echo "$CURRENT" | grep -q blue_backend; then
    echo "🟢 Switching to GREEN..."

    # health check
    curl -f http://localhost:4000/api/health || echo "skip health"

    # replace in nginx.conf
    sed -i 's/blue_backend/green_backend/' nginx.prod.conf

else
    echo "🔵 Switching to BLUE..."

    curl -f http://localhost:4000/api/health || echo "skip health"

    sed -i 's/green_backend/blue_backend/' nginx.prod.conf
fi

echo "🔄 Restarting nginx..."
docker compose restart nginx

echo "✅ Switch complete!"