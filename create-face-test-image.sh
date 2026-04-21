#!/bin/bash

echo "=== Creating Face Test Image ==="
echo "Generating image with detectable face for testing"

# Create a simple face-like image using ImageMagick if available
if command -v convert &> /dev/null; then
    echo "Creating face image with ImageMagick..."
    
    # Create a simple face-like image
    convert -size 300x300 xc:lightblue \
        -fill "#fdbcb4" -draw "circle 150,150 150,150" \
        -fill black -draw "circle 150,150 150,150" \
        -fill black -draw "circle 120,130 120,130" -fill black -draw "circle 180,130 180,130" \
        -fill "#8b4513" -draw "ellipse 150,200 50,20 0,0" \
        -pointsize 20 -fill black -gravity center -annotate +0+0 "TEST FACE" \
        "./face-test.jpg"
    
    echo "✅ Face test image created: ./face-test.jpg"
    echo "Image size: $(ls -la ./face-test.jpg | awk '{print $5}') bytes"
    
else
    echo "ImageMagick not available, downloading face image..."
    # Download an image that should have a face
    curl -L -o "./face-test.jpg" "https://picsum.photos/seed/faceperson/300/300.jpg" 2>/dev/null
    
    if [[ -f "./face-test.jpg" && -s "./face-test.jpg" ]]; then
        echo "✅ Downloaded face test image: ./face-test.jpg"
        echo "Image size: $(ls -la ./face-test.jpg | awk '{print $5}') bytes"
    else
        echo "❌ Failed to download face image"
        exit 1
    fi
fi

echo ""
echo "Testing the image with face recognition..."
echo "Direct call to face service:"

RESPONSE=$(curl -s -X POST "http://localhost:5001/recognize" \
    -F "image=@./face-test.jpg" \
    -F "class_id=1" \
    -F "session_id=18")

echo "Response:"
echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"

# Check if face was detected
if echo "$RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    echo "✅ Face detected successfully!"
    MATCHES=$(echo "$RESPONSE" | jq -r '.matches | length // 0')
    echo "Matches found: $MATCHES"
else
    ERROR=$(echo "$RESPONSE" | jq -r '.error // "unknown"')
    echo "❌ Face detection failed: $ERROR"
fi

echo ""
echo "=== Test Complete ==="
echo "Use ./face-test.jpg for further testing"
