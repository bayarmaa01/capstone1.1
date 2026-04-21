#!/bin/bash
echo "Restarting services to apply configuration changes..."

# Restart nginx to apply configuration changes
echo "Restarting nginx..."
docker compose restart nginx

# Restart face services to ensure latest code is loaded
echo "Restarting face services..."
docker compose restart blue_face green_face

# Restart frontend to apply changes
echo "Restarting frontend services..."
docker compose restart blue_frontend green_frontend

echo "All services restarted!"
echo "Wait 10 seconds for services to start..."
sleep 10

# Check service status
echo "Checking service status..."
docker compose ps
