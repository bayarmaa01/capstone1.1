#!/bin/bash

echo "=== Face Recognition API Debug ==="
echo "Testing FormData routing through nginx"

BACKEND_URL="http://localhost:4000"
FACE_DIRECT="http://localhost:5001"
FACE_NGINX="http://localhost/api/face"

# Create a proper test image
echo "Creating test image..."
curl -L -o "./debug-face.jpg" "https://picsum.photos/seed/debug/200/200.jpg" 2>/dev/null

if [[ ! -f "./debug-face.jpg" ]]; then
    echo "Failed to download test image"
    exit 1
fi

echo ""
echo "1. Testing face service directly..."
echo "URL: $FACE_DIRECT/recognize"

DIRECT_RESPONSE=$(curl -s -X POST "$FACE_DIRECT/recognize" \
    -F "image=@./debug-face.jpg" \
    -F "class_id=1" \
    -F "session_id=18" \
    -v 2>&1)

echo "Direct Response:"
echo "$DIRECT_RESPONSE" | jq . 2>/dev/null || echo "$DIRECT_RESPONSE"

echo ""
echo "2. Testing face service through nginx..."
echo "URL: $FACE_NGINX/recognize"

NGINX_RESPONSE=$(curl -s -X POST "$FACE_NGINX/recognize" \
    -F "image=@./debug-face.jpg" \
    -F "class_id=1" \
    -F "session_id=18" \
    -v 2>&1)

echo "Nginx Response:"
echo "$NGINX_RESPONSE" | jq . 2>/dev/null || echo "$NGINX_RESPONSE"

echo ""
echo "3. Analyzing responses..."

# Check if direct call works
if echo "$DIRECT_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    echo "✅ Direct face service: WORKING"
else
    echo "❌ Direct face service: FAILED"
    ERROR=$(echo "$DIRECT_RESPONSE" | jq -r '.error // "unknown"')
    echo "Error: $ERROR"
fi

# Check if nginx call works
if echo "$NGINX_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    echo "✅ Nginx routing: WORKING"
else
    echo "❌ Nginx routing: FAILED"
    ERROR=$(echo "$NGINX_RESPONSE" | jq -r '.error // "unknown"')
    echo "Error: $ERROR"
fi

echo ""
echo "4. Checking face service logs..."
echo "Recent face service logs:"
docker logs blue_face --tail 10 2>/dev/null || echo "Could not get face service logs"

echo ""
echo "5. Checking nginx logs..."
echo "Recent nginx logs:"
docker logs capstone11-nginx-1 --tail 10 2>/dev/null || echo "Could not get nginx logs"

echo ""
echo "6. Testing with raw curl to see request details..."
echo "Testing raw request to nginx..."

RAW_RESPONSE=$(curl -s -X POST "$FACE_NGINX/recognize" \
    -H "Content-Type: multipart/form-data" \
    -F "image=@./debug-face.jpg" \
    -F "class_id=1" \
    -F "session_id=18" \
    --trace-ascii /dev/null 2>&1)

echo "Raw curl trace saved to debug file"

echo ""
echo "=== Debug Complete ==="

# Cleanup
rm -f ./debug-face.jpg
