#!/bin/bash

echo "=== Student Face Enrollment Script ==="
echo "This script will enroll students with face images for the attendance system"

# Backend API URL
BACKEND_URL="http://localhost:4000"
FACE_SERVICE_URL="http://localhost:5001"

# Students to enroll (from your API response)
declare -A STUDENTS=(
    ["STU12213072"]="Aarohan Sarkar"
    ["STU12218198"]="Ankush Pal" 
    ["STU001"]="Bayarmaa Bumandorj"
    ["STU12221525"]="Munkh-Erdene Khurtsbileg"
    ["STU12211455"]="Rudraksh Bhalerao"
)

echo "Checking face service health..."
curl -s "$FACE_SERVICE_URL/health" | jq .

echo ""
echo "Available sample images for enrollment:"
echo "1. Use existing test images (if available)"
echo "2. Download sample face images from internet"
echo "3. Use placeholder images"

read -p "Choose option (1/2/3): " OPTION

case $OPTION in
    1)
        echo "Using existing test images..."
        IMAGE_DIR="./test-images"
        ;;
    2)
        echo "Downloading sample face images..."
        IMAGE_DIR="./sample-faces"
        mkdir -p $IMAGE_DIR
        
        # Download sample face images (you can replace these URLs)
        echo "Downloading sample face images..."
        curl -L -o "$IMAGE_DIR/face1.jpg" "https://picsum.photos/seed/face1/200/200.jpg" 2>/dev/null
        curl -L -o "$IMAGE_DIR/face2.jpg" "https://picsum.photos/seed/face2/200/200.jpg" 2>/dev/null
        curl -L -o "$IMAGE_DIR/face3.jpg" "https://picsum.photos/seed/face3/200/200.jpg" 2>/dev/null
        curl -L -o "$IMAGE_DIR/face4.jpg" "https://picsum.photos/seed/face4/200/200.jpg" 2>/dev/null
        curl -L -o "$IMAGE_DIR/face5.jpg" "https://picsum.photos/seed/face5/200/200.jpg" 2>/dev/null
        ;;
    3)
        echo "Downloading sample images..."
        IMAGE_DIR="./sample-faces"
        mkdir -p $IMAGE_DIR
        
        # Always download sample images for enrollment
        echo "Downloading sample face images for enrollment..."
        for i in {1..5}; do
            echo "Downloading image $i..."
            curl -L -o "$IMAGE_DIR/face$i.jpg" "https://picsum.photos/seed/student$i/200/200.jpg" 2>/dev/null || {
                echo "Failed to download image $i, trying alternative..."
                # Try alternative source
                curl -L -o "$IMAGE_DIR/face$i.jpg" "https://picsum.photos/200/200.jpg?random=$i" 2>/dev/null || {
                    echo "All downloads failed, creating minimal placeholder..."
                    # Create a minimal valid JPEG using base64
                    echo "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A8A" | base64 -d > "$IMAGE_DIR/face$i.jpg"
                }
            }
            # Verify file was created and is not empty
            if [[ -f "$IMAGE_DIR/face$i.jpg" && -s "$IMAGE_DIR/face$i.jpg" ]]; then
                echo "✓ Image $i downloaded successfully"
            else
                echo "✗ Image $i failed to download"
            fi
        done
        ;;
    *)
        echo "Invalid option. Exiting."
        exit 1
        ;;
esac

echo ""
echo "Starting student enrollment..."

INDEX=0
for STUDENT_ID in "${!STUDENTS[@]}"; do
    STUDENT_NAME="${STUDENTS[$STUDENT_ID]}"
    INDEX=$((INDEX + 1))
    
    # Select image for this student
    IMAGE_FILE="$IMAGE_DIR/face$INDEX.jpg"
    
    if [[ ! -f "$IMAGE_FILE" ]]; then
        echo "Warning: Image file $IMAGE_FILE not found for $STUDENT_ID. Skipping..."
        continue
    fi
    
    # Check if file is actually an image (not .txt)
    if [[ "$IMAGE_FILE" == *.txt ]]; then
        echo "Warning: $IMAGE_FILE is not a valid image file. Skipping..."
        continue
    fi
    
    echo ""
    echo "Enrolling: $STUDENT_ID - $STUDENT_NAME"
    echo "Using image: $IMAGE_FILE"
    
    # First, update student record with photo
    echo "1. Updating student photo..."
    PHOTO_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/students" \
        -F "student_id=$STUDENT_ID" \
        -F "name=$STUDENT_NAME" \
        -F "photo=@$IMAGE_FILE")
    
    if echo "$PHOTO_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
        echo "   Photo upload: SUCCESS"
    else
        echo "   Photo upload: FAILED"
        echo "   Response: $PHOTO_RESPONSE"
        continue
    fi
    
    # Then, enroll face in face service
    echo "2. Enrolling face in recognition service..."
    FACE_RESPONSE=$(curl -s -X POST "$FACE_SERVICE_URL/enroll" \
        -F "student_id=$STUDENT_ID" \
        -F "image=@$IMAGE_FILE")
    
    if echo "$FACE_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
        echo "   Face enrollment: SUCCESS"
        TOTAL_ENROLLED=$(echo "$FACE_RESPONSE" | jq -r '.total_enrolled // 1')
        echo "   Total enrolled: $TOTAL_ENROLLED"
    else
        echo "   Face enrollment: FAILED"
        echo "   Response: $FACE_RESPONSE"
    fi
    
    # Small delay to avoid overwhelming the services
    sleep 1
done

echo ""
echo "=== Enrollment Complete ==="
echo "Checking face service status..."
curl -s "$FACE_SERVICE_URL/face/health" | jq .

echo ""
echo "Verifying student records..."
curl -s "$BACKEND_URL/api/students" | jq '.[] | {student_id, name, photo_url}'
