import os
import requests
import json
import logging
from datetime import datetime
from datetime import timedelta
from flask import Flask, request, jsonify
from flask_cors import CORS
import face_recognition
from PIL import Image
import io
import threading
import time
import pickle
import numpy as np

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Moodle Configuration (from environment variables)
MOODLE_URL = os.getenv('MOODLE_URL', 'http://moodle:80/webservice/rest/server.php')
MOODLE_WS_TOKEN = os.getenv('MOODLE_WS_TOKEN', '')
MOODLE_WS_ENDPOINT = f"{MOODLE_URL}?wstoken={MOODLE_WS_TOKEN}&wsfunction=mod_attendance_update_user_status&moodlewsrestformat=json"

# Local configuration
ENC_PATH = "encodings/encodings.pkl"
ATTENDANCE_LOG = "attendance_log.json"
SESSION_TIMEOUT = 300  # 5 minutes between attendance for same student

# Face detection model selection:
# - "hog" is CPU-friendly and reliable for most webcam frames
# - "cnn" is heavier and often fails/timeout without GPU or proper dlib build
FACE_DETECTION_MODEL = os.getenv("FACE_DETECTION_MODEL", "hog").strip().lower() or "hog"
# Upsampling helps detect smaller faces in webcam frames (trade-off: more CPU).
try:
    FACE_UPSAMPLE_TIMES = int(os.getenv("FACE_UPSAMPLE_TIMES", "1"))
except Exception:
    FACE_UPSAMPLE_TIMES = 1

# Create directories
os.makedirs("encodings", exist_ok=True)
os.makedirs("logs", exist_ok=True)

# Global variables (lazy loading)
encodings = None
attendance_log = None
attendance_sessions = {}  # Track last attendance time per student

def load_encodings():
    """Load saved face encodings from disk"""
    if os.path.exists(ENC_PATH):
        try:
            with open(ENC_PATH, "rb") as f:
                data = pickle.load(f)
            logger.info(f"✅ Loaded {len(data)} face encodings: {list(data.keys())}")
            return data
        except Exception as e:
            logger.error(f"❌ Error loading encodings: {e}")
            return {}
    logger.info("⚠️ No encodings file found. Please enroll faces first.")
    return {}

def save_encodings(encodings_dict):
    """Save face encodings to disk"""
    try:
        with open(ENC_PATH, "wb") as f:
            pickle.dump(encodings_dict, f)
        logger.info(f"✅ Saved {len(encodings_dict)} encodings to {ENC_PATH}")
        return True
    except Exception as e:
        logger.error(f"❌ Error saving encodings: {e}")
        return False

def load_attendance_log():
    """Load attendance log"""
    if os.path.exists(ATTENDANCE_LOG):
        try:
            with open(ATTENDANCE_LOG, "r") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"❌ Error loading attendance log: {e}")
    return {}

def save_attendance_log(log_data):
    """Save attendance log"""
    try:
        with open(ATTENDANCE_LOG, "w") as f:
            json.dump(log_data, f, indent=2)
    except Exception as e:
        logger.error(f"❌ Error saving attendance log: {e}")

def mark_attendance_in_moodle(student_id, status=1):
    """Mark attendance in Moodle via Web Service API"""
    try:
        logger.info(f"📡 Marking attendance for student {student_id} with status {status}")
        
        # Get current session ID (you may need to implement session management)
        session_id = 1  # Default session, you might want to make this dynamic
        
        params = {
            'wstoken': MOODLE_WS_TOKEN,
            'wsfunction': 'mod_attendance_update_user_status',
            'moodlewsrestformat': 'json',
            'sessionid': session_id,
            'studentid': student_id,
            'statusid': status
        }
        
        response = requests.post(MOODLE_WS_ENDPOINT, data=params, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            if isinstance(result, dict) and result.get('exception'):
                logger.error(f"❌ Moodle API Error: {result}")
                return False, result.get('message', 'Unknown error')
            else:
                logger.info(f"✅ Attendance marked successfully for student {student_id}")
                return True, "Attendance marked successfully"
        else:
            logger.error(f"❌ HTTP Error: {response.status_code} - {response.text}")
            return False, f"HTTP {response.status_code}"
            
    except requests.exceptions.Timeout:
        logger.error(f"❌ Timeout marking attendance for student {student_id}")
        return False, "Request timeout"
    except requests.exceptions.RequestException as e:
        logger.error(f"❌ Network error marking attendance: {e}")
        return False, str(e)
    except Exception as e:
        logger.error(f"❌ Unexpected error marking attendance: {e}")
        return False, str(e)

def can_mark_attendance(student_id):
    """Check if student can mark attendance (prevent duplicates)"""
    current_time = datetime.now()
    last_attendance = attendance_sessions.get(student_id)
    
    if last_attendance:
        time_diff = (current_time - last_attendance).total_seconds()
        if time_diff < SESSION_TIMEOUT:
            logger.info(f"⏰ Student {student_id} already marked attendance {time_diff:.0f}s ago")
            return False
    
    return True

def update_attendance_session(student_id):
    """Update last attendance time for student"""
    attendance_sessions[student_id] = datetime.now()
    logger.info(f"⏰ Updated attendance session for student {student_id}")

def get_encodings():
    """Lazy load encodings when needed"""
    global encodings
    if encodings is None:
        encodings = load_encodings()
    return encodings

def get_attendance_log():
    global attendance_log
    if attendance_log is None:
        attendance_log = load_attendance_log()
    return attendance_log

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "service": "face"}), 200

@app.route('/face/health', methods=['GET'])
def face_health():
    """Health check endpoint for nginx compatibility"""
    return jsonify({
        "status": "ok", 
        "service": "ai-smart-attendance",
        "enrolled": len(encodings),
        "students": list(encodings.keys()),
    })

@app.route('/enroll', methods=['POST'])
def enroll():
    """Enroll a new student's face"""
    try:
        logger.info("\n📸 Enrollment request received")
        
        # Get student_id from form
        student_id = request.form.get('student_id')
        if not student_id:
            return jsonify({"error": "student_id required"}), 400
        
        student_id = student_id.upper().strip()
        logger.info(f"👤 Enrolling: {student_id}")
        
        # Get image file
        if 'image' not in request.files:
            return jsonify({"error": "image file required"}), 400
        
        file = request.files['image']
        logger.info(f"📁 Image received: {file.filename}")
        
        # Load and process image
        image = face_recognition.load_image_file(file)
        logger.info(f"🖼️ Image loaded: {image.shape}")
        
        # Find face encodings
        face_encodings = face_recognition.face_encodings(image)
        logger.info(f"🔍 Faces detected: {len(face_encodings)}")
        
        if len(face_encodings) == 0:
            return jsonify({"error": "No face detected in image. Please ensure face is clearly visible."}), 400
        
        if len(face_encodings) > 1:
            return jsonify({"error": f"Multiple faces detected ({len(face_encodings)}). Please use image with single face."}), 400
        
        # Store encoding as list (for JSON serialization)
        current_encodings = get_encodings()
        current_encodings[student_id] = face_encodings[0].tolist()
        
        # Save to disk
        if save_encodings(current_encodings):
            logger.info(f"✅ Successfully enrolled {student_id} (Total: {len(encodings)})")
            return jsonify({
                "success": True, 
                "student_id": student_id, 
                "message": "Face enrolled successfully",
                "total_enrolled": len(encodings)
            })
        else:
            return jsonify({"error": "Failed to save encoding"}), 500
        
    except Exception as e:
        logger.error(f"❌ Enrollment error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/recognize-and-mark', methods=['POST'])
def recognize_and_mark():
    """Recognize faces and automatically mark attendance in Moodle"""
    try:
        logger.info("🎯 Recognition and attendance request received")
        
        # Get image file
        if 'image' not in request.files:
            return jsonify({"error": "image file required"}), 400
        
        file = request.files['image']
        
        # Load image
        image = face_recognition.load_image_file(file)
        
        # Find all faces in image using configured model
        logger.info(f"🧠 Face detection model: {FACE_DETECTION_MODEL} | upsample: {FACE_UPSAMPLE_TIMES}")
        face_locations = face_recognition.face_locations(
            image,
            number_of_times_to_upsample=max(0, FACE_UPSAMPLE_TIMES),
            model=FACE_DETECTION_MODEL
        )
        face_encodings = face_recognition.face_encodings(image, face_locations)
        
        logger.info(f"🔍 Recognition request - Faces detected: {len(face_encodings)}")
        
        if len(face_encodings) == 0:
            # Return consistent response for no faces detected
            return jsonify({
                "success": False,
                "error": "No face detected",
                "faces_detected": 0,
                "matches": [],
                "attendance_marked": []
            })
        
        # Check if we have any enrolled students
        current_encodings = get_encodings()
        known_ids = list(current_encodings.keys())
        if len(known_ids) == 0:
            logger.warning("⚠️ No enrolled students yet")
            return jsonify({
                "success": False,
                "message": "No enrolled students in system",
                "attendance_marked": []
            })
        
        # Convert stored encodings back to numpy arrays
        known_encodings = [np.array(current_encodings[k]) for k in known_ids]
        
        matches = []
        attendance_results = []
        
        # Compare each detected face
        for idx, face_encoding in enumerate(face_encodings):
            logger.info(f"👤 Analyzing face {idx + 1}/{len(face_encodings)}")
            
            # Calculate Euclidean distances to all known faces
            distances = np.linalg.norm(np.array(known_encodings) - face_encoding, axis=1)
            min_distance_idx = int(np.argmin(distances))
            min_distance = float(distances[min_distance_idx])
            
            # Threshold for recognition (tune this value)
            THRESHOLD = 0.6
            
            logger.info(f"   Best match: {known_ids[min_distance_idx]} - Distance: {min_distance:.3f}")
            
            if min_distance < THRESHOLD:
                # Calculate confidence score (0 to 1)
                confidence = float(max(0, 1.0 - min_distance))
                matched_student_id = known_ids[min_distance_idx]
                
                # Check if attendance can be marked
                if can_mark_attendance(matched_student_id):
                    # Mark attendance in Moodle
                    moodle_success, moodle_message = mark_attendance_in_moodle(matched_student_id, status=1)
                    
                    if moodle_success:
                        # Update local attendance session
                        update_attendance_session(matched_student_id)
                        
                        # Log attendance
                        attendance_entry = {
                            "student_id": matched_student_id,
                            "timestamp": datetime.now().isoformat(),
                            "confidence": confidence,
                            "distance": min_distance,
                            "moodle_status": "success",
                            "method": "face_recognition"
                        }
                        
                        # Add to attendance log
                        current_attendance_log = get_attendance_log()
                        today = datetime.now().strftime("%Y-%m-%d")
                        if today not in current_attendance_log:
                            current_attendance_log[today] = []
                        current_attendance_log[today].append(attendance_entry)
                        save_attendance_log(current_attendance_log)
                        
                        attendance_results.append({
                            "student_id": matched_student_id,
                            "confidence": round(confidence, 3),
                            "distance": round(min_distance, 3),
                            "moodle_marked": True,
                            "moodle_message": moodle_message
                        })
                        
                        logger.info(f"✅ ATTENDANCE MARKED: {matched_student_id} (confidence: {confidence:.3f})")
                    else:
                        attendance_results.append({
                            "student_id": matched_student_id,
                            "confidence": round(confidence, 3),
                            "distance": round(min_distance, 3),
                            "moodle_marked": False,
                            "moodle_message": moodle_message
                        })
                        logger.error(f"❌ Failed to mark attendance for {matched_student_id}: {moodle_message}")
                else:
                    attendance_results.append({
                        "student_id": matched_student_id,
                        "confidence": round(confidence, 3),
                        "distance": round(min_distance, 3),
                        "moodle_marked": False,
                        "moodle_message": "Duplicate attendance - session timeout not reached"
                    })
                    logger.warning(f"⏰ Duplicate attendance prevented for {matched_student_id}")
                
                matches.append({
                    "student_id": matched_student_id,
                    "confidence": round(confidence, 3),
                    "distance": round(min_distance, 3)
                })
            else:
                logger.info(f"❌ No match - distance {min_distance:.3f} > threshold {THRESHOLD}")
        
        logger.info(f"📊 Total matches: {len(matches)}")
        logger.info(f"📊 Attendance marked for: {len([r for r in attendance_results if r['moodle_marked']])} students")
        
        # Return consistent response format
        if len(matches) > 0:
            return jsonify({
                "success": True,
                "faces_detected": len(face_encodings),
                "matches": matches,
                "attendance_marked": attendance_results,
                "message": f"Processed {len(face_encodings)} faces, marked attendance for {len([r for r in attendance_results if r['moodle_marked']])} students"
            })
        else:
            # Face detected but no match
            return jsonify({
                "success": False,
                "error": "Face not recognized",
                "faces_detected": len(face_encodings),
                "matches": [],
                "attendance_marked": []
            })
        
    except Exception as e:
        logger.error(f"❌ Recognition and marking error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/recognize', methods=['POST'])
def recognize():
    """Recognize faces without marking attendance"""
    try:
        logger.info("🎯 Face recognition request received")
        
        # Get image file
        if 'image' not in request.files:
            logger.error("❌ No image file in request")
            return jsonify({"error": "image file required"}), 400
        
        file = request.files['image']
        if file.filename == '':
            logger.error("❌ Empty filename")
            return jsonify({"error": "image file required"}), 400
        
        logger.info(f"📁 Processing image: {file.filename}")
        
        # Load image
        try:
            image = face_recognition.load_image_file(file)
            logger.info(f"🖼️ Image loaded successfully: {image.shape}")
        except Exception as e:
            logger.error(f"❌ Failed to load image: {e}")
            return jsonify({"error": f"failed to load image: {str(e)}"}), 400
        
        # Find all faces in image using configured model
        try:
            logger.info(f"🧠 Face detection model: {FACE_DETECTION_MODEL} | upsample: {FACE_UPSAMPLE_TIMES}")
            face_locations = face_recognition.face_locations(
                image,
                number_of_times_to_upsample=max(0, FACE_UPSAMPLE_TIMES),
                model=FACE_DETECTION_MODEL
            )
            face_encodings = face_recognition.face_encodings(image, face_locations)
            logger.info(f" Faces detected: {len(face_encodings)}")
        except Exception as e:
            logger.error(f" Face detection failed: {e}")
            return jsonify({"error": f"face detection failed: {str(e)}"}), 500
        
        if len(face_encodings) == 0:
            logger.info("No faces detected in image")
            return jsonify({
                "success": False,
                "error": "No face detected",
                "faces_detected": 0
            })
        
        # Check if we have any enrolled students
        current_encodings = get_encodings()
        known_ids = list(current_encodings.keys())
        if len(known_ids) == 0:
            logger.warning(" No enrolled students yet")
            return jsonify({
                "success": False,
                "error": "No enrolled students",
                "faces_detected": len(face_encodings)
            })

        logger.info(f"👥 Comparing against {len(known_ids)} enrolled students: {known_ids}")

        # Convert stored encodings back to numpy arrays
        known_encodings = [np.array(current_encodings[k]) for k in known_ids]

        matches = []
        
        # Compare each detected face
        for idx, face_encoding in enumerate(face_encodings):
            logger.info(f"👤 Analyzing face {idx + 1}/{len(face_encodings)}")
            
            # Calculate Euclidean distances to all known faces
            distances = np.linalg.norm(np.array(known_encodings) - face_encoding, axis=1)
            min_distance_idx = int(np.argmin(distances))
            min_distance = float(distances[min_distance_idx])
            
            # Threshold for recognition
            THRESHOLD = 0.6
            
            logger.info(f"   Best match: {known_ids[min_distance_idx]} - Distance: {min_distance:.3f}")
            
            if min_distance < THRESHOLD:
                # Calculate confidence score (0 to 1)
                confidence = float(max(0, 1.0 - min_distance))
                match_data = {
                    "student_id": known_ids[min_distance_idx],
                    "confidence": round(confidence, 3),
                    "distance": round(min_distance, 3)
                }
                matches.append(match_data)
                logger.info(f"✅ Recognized: {known_ids[min_distance_idx]} (confidence: {confidence:.3f})")
            else:
                logger.info(f"❌ No match - distance {min_distance:.3f} > threshold {THRESHOLD}")
        
        logger.info(f"📊 Total matches: {len(matches)}")
        
        # Return consistent response format
        if len(matches) > 0:
            # Return first match with success=true
            match = matches[0]
            return jsonify({
                "success": True,
                "student_id": match["student_id"],
                "confidence": match["confidence"],
                "faces_detected": len(face_encodings)
            })
        else:
            # Face detected but no match
            return jsonify({
                "success": False,
                "error": "Face not recognized",
                "faces_detected": len(face_encodings)
            })
        
    except Exception as e:
        logger.error(f" Recognition error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"recognition failed: {str(e)}"}), 500

@app.route('/enrolled', methods=['GET'])
def get_enrolled():
    """Get list of enrolled student IDs"""
    current_encodings = get_encodings()
    return jsonify({
        "enrolled_students": list(current_encodings.keys()), 
        "count": len(current_encodings),
        "moodle_url": MOODLE_URL,
        "service_status": "active"
    })

@app.route('/unenroll/<student_id>', methods=['DELETE'])
def unenroll(student_id):
    """Remove a student's face encoding"""
    try:
        student_id = student_id.upper()
        current_encodings = get_encodings()
        if student_id in current_encodings:
            del current_encodings[student_id]
            save_encodings(current_encodings)
            logger.info(f"✅ Unenrolled student {student_id}")
            return jsonify({"success": True, "message": f"Student {student_id} unenrolled"})
        else:
            return jsonify({"error": "Student not found"}), 404
    except Exception as e:
        logger.error(f"❌ Unenroll error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/attendance-log', methods=['GET'])
def get_attendance_log():
    """Get attendance log"""
    try:
        current_attendance_log = get_attendance_log()
        days = request.args.get('days', 7, type=int)
        cutoff_date = datetime.now() - timedelta(days=days)
        
        filtered_log = {}
        for date_str, entries in current_attendance_log.items():
            entry_date = datetime.strptime(date_str, "%Y-%m-%d")
            if entry_date >= cutoff_date:
                filtered_log[date_str] = entries
        
        return jsonify({
            "success": True,
            "days": days,
            "log": filtered_log,
            "total_entries": sum(len(entries) for entries in filtered_log.values())
        })
    except Exception as e:
        logger.error(f"❌ Error getting attendance log: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/moodle-test', methods=['GET'])
def test_moodle_connection():
    """Test Moodle Web Service connection"""
    try:
        params = {
            'wstoken': MOODLE_WS_TOKEN,
            'wsfunction': 'core_webservice_get_site_info',
            'moodlewsrestformat': 'json'
        }
        
        response = requests.post(MOODLE_WS_ENDPOINT, data=params, timeout=10)
        
        if response.status_code == 200:
            result = response.json()
            return jsonify({
                "success": True,
                "moodle_connected": True,
                "moodle_url": MOODLE_URL,
                "site_info": result
            })
        else:
            return jsonify({
                "success": False,
                "moodle_connected": False,
                "error": f"HTTP {response.status_code}",
                "response": response.text
            })
            
    except Exception as e:
        return jsonify({
            "success": False,
            "moodle_connected": False,
            "error": str(e)
        })

if __name__ == '__main__':
    print("\n" + "="*60)
    print("🚀 AI Smart Attendance System Starting...")
    print("="*60)
    print(f"🌐 Moodle URL: {MOODLE_URL}")
    print(f"📁 Encodings path: {os.path.abspath(ENC_PATH)}")
    
    # Use lazy loading for startup info
    current_encodings = get_encodings()
    print(f"👥 Enrolled students: {len(current_encodings)}")
    if current_encodings:
        print(f"📋 IDs: {', '.join(current_encodings.keys())}")
    else:
        print("⚠️ No faces enrolled yet!")
        print("💡 Use POST /enroll to add student faces")
    print(f"📡 Attendance timeout: {SESSION_TIMEOUT} seconds")
    print("="*60 + "\n")
    
    # Suppress Flask development server warning
    import logging
    log = logging.getLogger('werkzeug')
    log.setLevel(logging.ERROR)
    
    app.run(host='0.0.0.0', port=5001, debug=False)