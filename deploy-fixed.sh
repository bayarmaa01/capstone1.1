#!/bin/bash

echo "Starting zero-downtime deploy..."

docker compose build

docker compose up -d

echo "Waiting for health..."
sleep 15

STATUS=$(docker inspect --format='{{.State.Health.Status}}' capstone11-green_backend-1)

if [ "$STATUS" != "healthy" ]; then
echo "Deployment failed. Rolling back..."
docker compose down
exit 1
fi

echo "Switching traffic..."
curl -X POST http://localhost/api/deploy/switch

echo "Reloading nginx..."
docker exec capstone11-nginx-1 nginx -s reload

echo "Deploy complete!"
