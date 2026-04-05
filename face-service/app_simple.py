import os
import json
import logging
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Moodle Configuration (from environment variables)
MOODLE_URL = os.getenv('MOODLE_URL', 'http://moodle:80/webservice/rest/server.php')
MOODLE_WS_TOKEN = os.getenv('MOODLE_WS_TOKEN', '')

# Local configuration
ENC_PATH = "encodings/encodings.pkl"
ATTENDANCE_LOG = "attendance_log.json"
SESSION_TIMEOUT = 300  # 5 minutes between attendance for same student

# Create directories
os.makedirs("encodings", exist_ok=True)
os.makedirs("logs", exist_ok=True)

# Global variables (lazy loading)
encodings = {}
attendance_log = {}
attendance_sessions = {}  # Track last attendance time per student

def load_encodings():
    """Load saved face encodings from disk"""
    if os.path.exists(ENC_PATH):
        try:
            with open(ENC_PATH, "rb") as f:
                import pickle
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
        import pickle
        with open(ENC_PATH, "wb") as f:
            pickle.dump(encodings_dict, f)
        logger.info(f"✅ Saved {len(encodings_dict)} encodings to {ENC_PATH}")
        return True
    except Exception as e:
        logger.error(f"❌ Error saving encodings: {e}")
        return False

def get_encodings():
    """Lazy load encodings when needed"""
    global encodings
    if encodings is None:
        encodings = load_encodings()
    return encodings

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
        
        import requests
        response = requests.post(f"{MOODLE_URL}?wstoken={MOODLE_WS_TOKEN}", data=params, timeout=30)
        
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
    """Enroll a new student's face - simplified version"""
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
        
        # For now, just store student_id without face processing
        # TODO: Add face processing when face_recognition is available
        current_encodings = get_encodings()
        current_encodings[student_id] = f"placeholder_encoding_{datetime.now().isoformat()}"
        
        # Save to disk
        if save_encodings(current_encodings):
            logger.info(f"✅ Successfully enrolled {student_id} (Total: {len(encodings)})")
            return jsonify({
                "success": True, 
                "student_id": student_id, 
                "message": "Face enrolled successfully (simplified mode)",
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
    """Recognize faces and automatically mark attendance in Moodle - simplified version"""
    try:
        logger.info("🎯 Recognition and attendance request received")
        
        # Get image file
        if 'image' not in request.files:
            return jsonify({"error": "image file required"}), 400
        
        file = request.files['image']
        
        # For now, just return a placeholder response
        # TODO: Add face processing when face_recognition is available
        return jsonify({
            "success": True,
            "faces_detected": 0,
            "matches": [],
            "attendance_marked": [],
            "message": "Face recognition service running in simplified mode"
        })
        
    except Exception as e:
        logger.error(f"❌ Recognition and marking error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/enrolled', methods=['GET'])
def get_enrolled():
    """Get list of enrolled students"""
    try:
        current_encodings = get_encodings()
        return jsonify({
            "status": "ok",
            "enrolled_students": list(current_encodings.keys()),
            "total_enrolled": len(current_encodings)
        })
    except Exception as e:
        logger.error(f"❌ Error getting enrolled students: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    logger.info("🚀 Starting Face Recognition Service (Simplified Mode)")
    app.run(host='0.0.0.0', port=5001, debug=False)
