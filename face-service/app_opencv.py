import os
import requests
import json
import logging
from datetime import datetime
from datetime import timedelta
from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
from PIL import Image
import io
import threading
import time
import pickle

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

# Create directories
os.makedirs("encodings", exist_ok=True)
os.makedirs("logs", exist_ok=True)

# Global variables (lazy loading)
encodings = None
attendance_log = None

def load_encodings():
    """Load face encodings from pickle file"""
    global encodings
    try:
        if os.path.exists(ENC_PATH):
            with open(ENC_PATH, 'rb') as f:
                encodings = pickle.load(f)
            logger.info(f"Loaded {len(encodings)} face encodings")
        else:
            logger.warning(f"Encodings file not found: {ENC_PATH}")
            encodings = []
    except Exception as e:
        logger.error(f"Error loading encodings: {e}")
        encodings = []

def load_attendance_log():
    """Load attendance log to prevent duplicate entries"""
    global attendance_log
    try:
        if os.path.exists(ATTENDANCE_LOG):
            with open(ATTENDANCE_LOG, 'r') as f:
                attendance_log = json.load(f)
        else:
            attendance_log = {}
    except Exception as e:
        logger.error(f"Error loading attendance log: {e}")
        attendance_log = {}

def save_attendance_log():
    """Save attendance log to file"""
    try:
        with open(ATTENDANCE_LOG, 'w') as f:
            json.dump(attendance_log, f)
    except Exception as e:
        logger.error(f"Error saving attendance log: {e}")

def can_mark_attendance(student_id, class_id):
    """Check if student can mark attendance (prevent duplicates within timeout)"""
    key = f"{student_id}_{class_id}"
    if key not in attendance_log:
        return True
    
    last_marked = datetime.fromisoformat(attendance_log[key])
    if datetime.now() - last_marked > timedelta(seconds=SESSION_TIMEOUT):
        return True
    
    return False

def mark_attendance(student_id, class_id):
    """Mark attendance for student"""
    key = f"{student_id}_{class_id}"
    attendance_log[key] = datetime.now().isoformat()
    save_attendance_log()

def detect_faces(image_array):
    """Simple face detection using OpenCV"""
    # Convert to grayscale for face detection
    gray = cv2.cvtColor(image_array, cv2.COLOR_BGR2GRAY)
    
    # Load face classifier
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    
    # Detect faces
    faces = face_cascade.detectMultiScale(gray, 1.1, 4)
    
    return len(faces) > 0, len(faces)

def recognize_face(image_array, student_encodings):
    """Simple face recognition simulation"""
    # This is a placeholder - in real implementation, you'd use proper face recognition
    # For now, we'll simulate recognition by checking if we have any encodings
    if not student_encodings:
        return False, 0.0
    
    # Simulate face matching with random confidence for demo
    import random
    confidence = random.uniform(0.7, 0.95) if student_encodings else 0.0
    matched = confidence > 0.8
    
    return matched, confidence

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "timestamp": datetime.now().isoformat()})

@app.route('/recognize', methods=['POST'])
def recognize():
    """Face recognition endpoint"""
    try:
        # Load data if not already loaded
        if encodings is None:
            load_encodings()
        if attendance_log is None:
            load_attendance_log()
        
        # DEBUG: Log request details
        logger.info(f"Request files: {list(request.files.keys())}")
        logger.info(f"Request form: {list(request.form.keys())}")
        
        # Get image from request
        if 'image' not in request.files:
            logger.error("No image field in request.files")
            return jsonify({"error": "No image provided"}), 400
        
        file = request.files['image']
        logger.info(f"Image filename: {file.filename}, content type: {file.content_type}")
        
        if file.filename == '':
            logger.error("Empty filename")
            return jsonify({"error": "No image selected"}), 400
        
        # Read and process image with robust error handling
        image_bytes = file.read()
        logger.info(f"Image bytes length: {len(image_bytes)}")
        
        if len(image_bytes) == 0:
            logger.error("Empty image file")
            return jsonify({"error": "Empty image file"}), 400
        
        # Use OpenCV for more reliable image decoding
        img_array = np.frombuffer(image_bytes, np.uint8)
        image_array = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
        
        if image_array is None:
            logger.error("Failed to decode image - invalid format")
            return jsonify({"error": "Invalid image format"}), 400
        
        logger.info(f"Successfully decoded image shape: {image_array.shape}")
        
        # Ensure image is in BGR format (OpenCV default)
        if len(image_array.shape) == 3 and image_array.shape[2] == 4:
            # Convert RGBA to BGR
            image_array = cv2.cvtColor(image_array, cv2.COLOR_RGBA2BGR)
        elif len(image_array.shape) == 2:
            # Convert grayscale to BGR
            image_array = cv2.cvtColor(image_array, cv2.COLOR_GRAY2BGR)
        
        # Resize image for better face detection
        if image_array.shape[0] > 800 or image_array.shape[1] > 800:
            image_array = cv2.resize(image_array, (640, 480))
            logger.info(f"Resized image to: {image_array.shape}")
        
        # Detect faces
        faces_detected, num_faces = detect_faces(image_array)
        logger.info(f"Face detection result: faces_detected={faces_detected}, num_faces={num_faces}")
        
        if not faces_detected:
            return jsonify({
                "success": False,
                "error": "No faces detected",
                "faces_detected": 0
            })
        
        # Simple recognition (placeholder)
        matched, confidence = recognize_face(image_array, encodings)
        logger.info(f"Recognition result: matched={matched}, confidence={confidence}")
        
        if matched and encodings:
            # Get first student encoding as match (simplified)
            match_data = encodings[0] if encodings else None
            if match_data:
                result = {
                    "success": True,
                    "faces_detected": num_faces,
                    "matches": [{
                        "student_id": match_data.get("student_id", "unknown"),
                        "name": match_data.get("name", "Unknown Student"),
                        "confidence": confidence,
                        "confidence_percent": round(confidence * 100, 2)
                    }]
                }
                logger.info(f"SUCCESS: Matched student {match_data.get('student_id')} with {round(confidence * 100, 2)}% confidence")
            else:
                result = {
                    "success": False,
                    "error": "Face detected but no encodings available",
                    "faces_detected": num_faces
                }
                logger.warning("Face detected but no encodings available")
        else:
            result = {
                "success": False,
                "error": "Face detected but not recognized",
                "faces_detected": num_faces
            }
            logger.info(f"Face detected but recognition failed: confidence={confidence}")
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error in recognize endpoint: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/recognize-and-mark', methods=['POST'])
def recognize_and_mark():
    """Face recognition with attendance marking"""
    try:
        # Get parameters
        class_id = request.form.get('class_id')
        session_date = request.form.get('session_date', datetime.now().strftime('%Y-%m-%d'))
        
        if not class_id:
            return jsonify({"error": "class_id is required"}), 400
        
        # Load data if not already loaded
        if encodings is None:
            load_encodings()
        if attendance_log is None:
            load_attendance_log()
        
        # Get image from request
        if 'image' not in request.files:
            return jsonify({"error": "No image provided"}), 400
        
        file = request.files['image']
        if file.filename == '':
            return jsonify({"error": "No image selected"}), 400
        
        # Read and process image
        image_bytes = file.read()
        image = Image.open(io.BytesIO(image_bytes))
        image_array = np.array(image)
        
        # Convert RGB to BGR for OpenCV
        if len(image_array.shape) == 3 and image_array.shape[2] == 3:
            image_array = cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR)
        
        # Detect faces
        faces_detected, num_faces = detect_faces(image_array)
        
        if not faces_detected:
            return jsonify({
                "success": False,
                "error": "No faces detected",
                "faces_detected": 0
            })
        
        # Simple recognition (placeholder)
        matched, confidence = recognize_face(image_array, encodings)
        
        if matched and encodings:
            # Get first student encoding as match (simplified)
            match_data = encodings[0] if encodings else None
            if match_data:
                student_id = match_data.get("student_id", "unknown")
                
                # Check if can mark attendance
                if can_mark_attendance(student_id, class_id):
                    # Mark attendance
                    mark_attendance(student_id, class_id)
                    
                    result = {
                        "success": True,
                        "faces_detected": num_faces,
                        "matches": [{
                            "student_id": student_id,
                            "name": match_data.get("name", "Unknown Student"),
                            "confidence": confidence,
                            "confidence_percent": round(confidence * 100, 2)
                        }],
                        "attendance_marked": True
                    }
                else:
                    result = {
                        "success": True,
                        "faces_detected": num_faces,
                        "matches": [{
                            "student_id": student_id,
                            "name": match_data.get("name", "Unknown Student"),
                            "confidence": confidence,
                            "confidence_percent": round(confidence * 100, 2)
                        }],
                        "attendance_marked": False,
                        "error": "Attendance already marked recently"
                    }
            else:
                result = {
                    "success": False,
                    "error": "Face detected but not recognized",
                    "faces_detected": num_faces
                }
        else:
            result = {
                "success": False,
                "error": "Face detected but not recognized",
                "faces_detected": num_faces
            }
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error in recognize_and_mark endpoint: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/load-encodings', methods=['POST'])
def load_encodings_endpoint():
    """Load face encodings from uploaded file"""
    try:
        if 'encodings' not in request.files:
            return jsonify({"error": "No encodings file provided"}), 400
        
        file = request.files['encodings']
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400
        
        # Save uploaded encodings
        encodings_data = file.read()
        with open(ENC_PATH, 'wb') as f:
            f.write(encodings_data)
        
        # Reload encodings
        load_encodings()
        
        return jsonify({
            "success": True,
            "message": f"Loaded {len(encodings)} face encodings"
        })
        
    except Exception as e:
        logger.error(f"Error loading encodings: {e}")
        return jsonify({"error": "Failed to load encodings"}), 500

@app.route('/status', methods=['GET'])
def status():
    """Get service status"""
    if encodings is None:
        load_encodings()
    if attendance_log is None:
        load_attendance_log()
    
    return jsonify({
        "status": "running",
        "encodings_loaded": len(encodings) if encodings else 0,
        "attendance_log_entries": len(attendance_log) if attendance_log else 0,
        "timestamp": datetime.now().isoformat()
    })

if __name__ == '__main__':
    # Load initial data
    load_encodings()
    load_attendance_log()
    
    logger.info("Face Recognition Service (OpenCV-based) starting...")
    app.run(host='0.0.0.0', port=5001, debug=False)
