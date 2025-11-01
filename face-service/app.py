import os
import pickle
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
import face_recognition
from PIL import Image
import io

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Path to save encodings
ENC_PATH = "encodings/encodings.pkl"
os.makedirs("encodings", exist_ok=True)

def load_encodings():
    """Load saved face encodings from disk"""
    if os.path.exists(ENC_PATH):
        try:
            with open(ENC_PATH, "rb") as f:
                data = pickle.load(f)
                print(f"✅ Loaded {len(data)} face encodings: {list(data.keys())}")
                return data
        except Exception as e:
            print(f"❌ Error loading encodings: {e}")
            return {}
    print("⚠️ No encodings file found. Please enroll faces first.")
    return {}  # {student_id: encoding_array}

def save_encodings(encodings_dict):
    """Save face encodings to disk"""
    try:
        with open(ENC_PATH, "wb") as f:
            pickle.dump(encodings_dict, f)
        print(f"✅ Saved {len(encodings_dict)} encodings to {ENC_PATH}")
        return True
    except Exception as e:
        print(f"❌ Error saving encodings: {e}")
        return False

# Load encodings at startup
encodings = load_encodings()
print(f"🚀 Face Recognition Service Started")
print(f"📊 Currently enrolled: {len(encodings)} students")
if encodings:
    print(f"👥 Student IDs: {', '.join(encodings.keys())}")

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        "status": "ok", 
        "service": "face-recognition", 
        "enrolled": len(encodings),
        "students": list(encodings.keys())
    })

@app.route('/enroll', methods=['POST'])
def enroll():
    """Enroll a new student's face"""
    try:
        print("\n📸 Enrollment request received")
        
        # Get student_id from form
        student_id = request.form.get('student_id')
        if not student_id:
            return jsonify({"error": "student_id required"}), 400
        
        student_id = student_id.upper()  # Normalize to uppercase
        print(f"👤 Enrolling: {student_id}")
        
        # Get image file
        if 'image' not in request.files:
            return jsonify({"error": "image file required"}), 400
        
        file = request.files['image']
        print(f"📁 Image received: {file.filename}")
        
        # Load and process image
        image = face_recognition.load_image_file(file)
        print(f"🖼️ Image loaded: {image.shape}")
        
        # Find face encodings
        face_encodings = face_recognition.face_encodings(image)
        print(f"🔍 Faces detected: {len(face_encodings)}")
        
        if len(face_encodings) == 0:
            return jsonify({"error": "No face detected in image. Please ensure face is clearly visible."}), 400
        
        if len(face_encodings) > 1:
            return jsonify({"error": f"Multiple faces detected ({len(face_encodings)}). Please use image with single face."}), 400
        
        # Store encoding as list (for JSON serialization)
        encodings[student_id] = face_encodings[0].tolist()
        
        # Save to disk
        if save_encodings(encodings):
            print(f"✅ Successfully enrolled {student_id} (Total: {len(encodings)})")
            return jsonify({
                "success": True, 
                "student_id": student_id, 
                "message": "Face enrolled successfully",
                "total_enrolled": len(encodings)
            })
        else:
            return jsonify({"error": "Failed to save encoding"}), 500
        
    except Exception as e:
        print(f"❌ Enrollment error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/recognize', methods=['POST'])
def recognize():
    """Recognize faces in an image"""
    try:
        # Get image file
        if 'image' not in request.files:
            print("❌ No image in request")
            return jsonify({"error": "image file required"}), 400
        
        file = request.files['image']
        
        # Load image
        image = face_recognition.load_image_file(file)
        
        # Find all faces in image
        face_locations = face_recognition.face_locations(image)
        face_encodings = face_recognition.face_encodings(image, face_locations)
        
        print(f"🔍 Recognition request - Faces detected: {len(face_encodings)}")
        
        if len(face_encodings) == 0:
            return jsonify([])  # No faces found - return empty array
        
        # Check if we have any enrolled students
        known_ids = list(encodings.keys())
        if len(known_ids) == 0:
            print("⚠️ No enrolled students yet")
            return jsonify([])  # No enrolled students
        
        # Convert stored encodings back to numpy arrays
        known_encodings = [np.array(encodings[k]) for k in known_ids]
        
        matches = []
        
        # Compare each detected face
        for idx, face_encoding in enumerate(face_encodings):
            print(f"👤 Analyzing face {idx + 1}/{len(face_encodings)}")
            
            # Calculate Euclidean distances to all known faces
            distances = np.linalg.norm(np.array(known_encodings) - face_encoding, axis=1)
            min_distance_idx = int(np.argmin(distances))
            min_distance = float(distances[min_distance_idx])
            
            # Threshold for recognition (tune this value)
            # Lower = stricter matching, Higher = more lenient
            THRESHOLD = 0.6
            
            print(f"   Best match: {known_ids[min_distance_idx]} - Distance: {min_distance:.3f}")
            
            if min_distance < THRESHOLD:
                # Calculate confidence score (0 to 1)
                confidence = float(max(0, 1.0 - min_distance))
                match_data = {
                    "student_id": known_ids[min_distance_idx],
                    "confidence": round(confidence, 3),
                    "distance": round(min_distance, 3)
                }
                matches.append(match_data)
                print(f"✅ Recognized: {known_ids[min_distance_idx]} (confidence: {confidence:.3f})")
            else:
                print(f"❌ No match - distance {min_distance:.3f} > threshold {THRESHOLD}")
        
        print(f"📊 Total matches: {len(matches)}")
        if len(matches) == 0:
            print("⚠️ No matching faces found.")
        else:
            for m in matches:
                print(f"✅ MATCH FOUND: {m['student_id']} | Confidence: {m['confidence']*100:.1f}% | Distance: {m['distance']:.3f}")
        print("🧠 Recognition cycle complete\n" + "-"*40)
        return jsonify(matches)

        
    except Exception as e:
        print(f"❌ Recognition error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/enrolled', methods=['GET'])
def get_enrolled():
    """Get list of enrolled student IDs"""
    return jsonify({
        "enrolled_students": list(encodings.keys()), 
        "count": len(encodings)
    })

@app.route('/unenroll/<student_id>', methods=['DELETE'])
def unenroll(student_id):
    """Remove a student's face encoding"""
    try:
        student_id = student_id.upper()
        if student_id in encodings:
            del encodings[student_id]
            save_encodings(encodings)
            print(f"✅ Unenrolled student {student_id}")
            return jsonify({"success": True, "message": f"Student {student_id} unenrolled"})
        else:
            return jsonify({"error": "Student not found"}), 404
    except Exception as e:
        print(f"❌ Unenroll error: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("\n" + "="*50)
    print("🚀 Face Recognition Service Starting...")
    print("="*50)
    print(f"📁 Encodings path: {os.path.abspath(ENC_PATH)}")
    print(f"👥 Enrolled students: {len(encodings)}")
    if encodings:
        print(f"📋 IDs: {', '.join(encodings.keys())}")
    else:
        print("⚠️ No faces enrolled yet!")
        print("💡 Use POST /enroll to add student faces")
    print("="*50 + "\n")
    
    # Suppress Flask development server warning
    import logging
    log = logging.getLogger('werkzeug')
    log.setLevel(logging.ERROR)
    
    app.run(host='0.0.0.0', port=5001, debug=True)