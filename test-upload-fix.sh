#!/bin/bash

echo "=== Upload System Test Script ==="
echo "Testing all upload and static file serving fixes"

BACKEND_URL="http://localhost:4000"
TEST_IMAGE_URL="https://picsum.photos/seed/testupload/200/200.jpg"

echo ""
echo "1. Testing backend health..."
curl -s "$BACKEND_URL/api/health" | jq .

echo ""
echo "2. Downloading test image..."
curl -L -o "./test-upload.jpg" "$TEST_IMAGE_URL"
echo "Test image downloaded: $(ls -la test-upload.jpg)"

echo ""
echo "3. Testing student creation with photo upload..."
RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/students" \
    -F "student_id=TEST001" \
    -F "name=Test Student" \
    -F "photo=@./test-upload.jpg")

echo "Upload Response:"
echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"

# Extract photo URL from response
PHOTO_URL=$(echo "$RESPONSE" | jq -r '.student.photo_url // empty')
echo "Extracted photo_url: $PHOTO_URL"

if [[ "$PHOTO_URL" != "empty" && "$PHOTO_URL" != "null" ]]; then
    echo ""
    echo "4. Testing static file access..."
    STATIC_URL="https://attendance-ml.duckdns.org/uploads/$PHOTO_URL"
    echo "Testing: $STATIC_URL"
    
    STATIC_RESPONSE=$(curl -s -k "$STATIC_URL")
    if [[ "$STATIC_RESPONSE" == *"Endpoint not found"* ]]; then
        echo "❌ Static file serving FAILED"
        echo "Response: $STATIC_RESPONSE"
    else
        echo "✅ Static file serving WORKS"
        echo "File size: $(echo "$STATIC_RESPONSE" | wc -c) bytes"
    fi
    
    echo ""
    echo "5. Testing via nginx..."
    NGINX_RESPONSE=$(curl -s -k "https://attendance-ml.duckdns.org/uploads/$PHOTO_URL")
    if [[ "$NGINX_RESPONSE" == *"Endpoint not found"* ]]; then
        echo "❌ Nginx routing FAILED"
    else
        echo "✅ Nginx routing WORKS"
    fi
else
    echo "❌ Upload failed - no photo_url returned"
fi

echo ""
echo "6. Verifying student in database..."
STUDENT_RESPONSE=$(curl -s "$BACKEND_URL/api/students" | jq '.[] | select(.student_id == "TEST001")')
echo "Student record:"
echo "$STUDENT_RESPONSE"

echo ""
echo "7. Cleanup test data..."
# Clean up test student
curl -s -X DELETE "$BACKEND_URL/api/students/$(echo "$STUDENT_RESPONSE" | jq -r '.id')" > /dev/null
rm -f ./test-upload.jpg

echo ""
echo "=== Test Complete ==="
echo "Summary:"
echo "- Upload API: $([ "$PHOTO_URL" != "empty" ] && echo '✅ WORKING' || echo '❌ FAILED')"
echo "- Static serving: $([ "$STATIC_RESPONSE" != *"Endpoint not found"* ] && echo '✅ WORKING' || echo '❌ FAILED')"
echo "- Nginx routing: $([ "$NGINX_RESPONSE" != *"Endpoint not found"* ] && echo '✅ WORKING' || echo '❌ FAILED')"
