#!/bin/bash

echo "=== Face Recognition Test Script ==="
echo "This script tests the face recognition system after enrollment"

FACE_SERVICE_URL="http://localhost:5001"
BACKEND_URL="http://localhost:4000"

echo "1. Checking face service health..."
curl -s "$FACE_SERVICE_URL/health" | jq .

echo ""
echo "2. Checking enrolled students..."
FACE_HEALTH=$(curl -s "$FACE_SERVICE_URL/face/health")
echo "$FACE_HEALTH" | jq . 2>/dev/null || echo "$FACE_HEALTH"

echo ""
echo "3. Testing face recognition with sample image..."

# Create a test image if needed
if [[ ! -f "./test-face.jpg" ]]; then
    echo "Creating test image..."
    if command -v convert &> /dev/null; then
        convert -size 300x300 xc:lightgray -pointsize 30 -fill black -gravity center -annotate +0+0 "TEST FACE" "./test-face.jpg"
    else
        echo "Downloading test image..."
        curl -L -o "./test-face.jpg" "https://picsum.photos/seed/testface/300/300.jpg" 2>/dev/null
    fi
fi

if [[ ! -f "./test-face.jpg" ]]; then
    echo "Error: Could not create or download test image"
    exit 1
fi

echo "Using test image: ./test-face.jpg"
echo ""

# Test face recognition
echo "4. Testing face recognition endpoint..."
RESPONSE=$(curl -s -X POST "$FACE_SERVICE_URL/recognize" \
    -F "image=@./test-face.jpg" \
    -F "class_id=1" \
    -F "session_id=18")

echo "Face Recognition Response:"
echo "$RESPONSE" | jq .

# Check if recognition was successful
if echo "$RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    echo ""
    echo "SUCCESS: Face recognition working!"
    MATCHES=$(echo "$RESPONSE" | jq -r '.matches | length // 0')
    echo "Faces matched: $MATCHES"
    
    if [[ $MATCHES -gt 0 ]]; then
        echo "Matched students:"
        echo "$RESPONSE" | jq -r '.matches[] | "  - Student ID: \(.student_id), Confidence: \(.confidence)"'
    fi
else
    echo ""
    echo "Face recognition failed or no matches found"
    ERROR=$(echo "$RESPONSE" | jq -r '.error // "Unknown error"')
    echo "Error: $ERROR"
    
    if [[ "$ERROR" == "No enrolled students" ]]; then
        echo ""
        echo "SOLUTION: You need to enroll students first!"
        echo "Run: ./enroll-students.sh"
    fi
fi

echo ""
echo "5. Testing via nginx (production route)..."
# Test full API path through nginx
NGINX_RESPONSE=$(curl -s -X POST "http://localhost/api/face/recognize" \
    -F "image=@./test-face.jpg" \
    -F "class_id=1" \
    -F "session_id=18")

echo "Nginx Route Response:"
echo "$NGINX_RESPONSE" | jq . 2>/dev/null || echo "$NGINX_RESPONSE"

echo ""
echo "=== Test Complete ==="
echo "If face recognition is working, you can now test the full attendance system in the browser!"
echo "Visit: https://attendance-ml.duckdns.org"
