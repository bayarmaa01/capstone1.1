#!/usr/bin/env python3
"""
AI Smart Attendance System - Test Script
Tests all major functionality and Moodle integration
"""

import requests
import json
import time
import os
from datetime import datetime

# Configuration
SERVICE_URL = "http://localhost:5001"
TEST_IMAGE_PATH = "test_images"  # Create this directory for test images

def print_header(title):
    """Print formatted test header"""
    print(f"\n{'='*60}")
    print(f"🧪 {title}")
    print(f"{'='*60}")

def print_success(message):
    """Print success message"""
    print(f"✅ {message}")

def print_error(message):
    """Print error message"""
    print(f"❌ {message}")

def print_info(message):
    """Print info message"""
    print(f"ℹ️  {message}")

def test_health_check():
    """Test service health endpoint"""
    print_header("Health Check Test")
    
    try:
        response = requests.get(f"{SERVICE_URL}/health", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            print_success("Health check passed")
            print_info(f"Service: {data.get('service', 'unknown')}")
            print_info(f"Enrolled students: {data.get('enrolled', 0)}")
            print_info(f"Moodle connected: {data.get('moodle_connected', False)}")
            return True
        else:
            print_error(f"Health check failed: HTTP {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print_error(f"Health check error: {e}")
        return False

def test_moodle_connection():
    """Test Moodle Web Service connection"""
    print_header("Moodle Connection Test")
    
    try:
        response = requests.get(f"{SERVICE_URL}/moodle-test", timeout=15)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                print_success("Moodle connection successful")
                print_info(f"Moodle URL: {data.get('moodle_url')}")
                return True
            else:
                print_error(f"Moodle connection failed: {data.get('error', 'Unknown')}")
                return False
        else:
            print_error(f"Moodle test failed: HTTP {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print_error(f"Moodle connection error: {e}")
        return False

def test_enrollment(student_id, image_path):
    """Test student enrollment"""
    print_header(f"Enrollment Test - {student_id}")
    
    if not os.path.exists(image_path):
        print_error(f"Test image not found: {image_path}")
        return False
    
    try:
        with open(image_path, 'rb') as f:
            files = {'image': f}
            data = {'student_id': student_id}
            
            response = requests.post(f"{SERVICE_URL}/enroll", files=files, data=data, timeout=30)
            
            if response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    print_success(f"Student {student_id} enrolled successfully")
                    print_info(f"Total enrolled: {result.get('total_enrolled', 0)}")
                    return True
                else:
                    print_error(f"Enrollment failed: {result.get('error', 'Unknown')}")
                    return False
            else:
                print_error(f"Enrollment failed: HTTP {response.status_code}")
                return False
                
    except requests.exceptions.RequestException as e:
        print_error(f"Enrollment error: {e}")
        return False

def test_recognition(image_path):
    """Test face recognition without Moodle marking"""
    print_header("Face Recognition Test")
    
    if not os.path.exists(image_path):
        print_error(f"Test image not found: {image_path}")
        return False
    
    try:
        with open(image_path, 'rb') as f:
            files = {'image': f}
            
            response = requests.post(f"{SERVICE_URL}/recognize", files=files, timeout=30)
            
            if response.status_code == 200:
                matches = response.json()
                print_success(f"Recognition completed - Found {len(matches)} matches")
                
                for i, match in enumerate(matches):
                    print_info(f"  Match {i+1}: {match.get('student_id')} (confidence: {match.get('confidence', 0):.3f})")
                
                return len(matches) > 0
            else:
                print_error(f"Recognition failed: HTTP {response.status_code}")
                return False
                
    except requests.exceptions.RequestException as e:
        print_error(f"Recognition error: {e}")
        return False

def test_attendance_marking(image_path):
    """Test recognition with automatic Moodle attendance marking"""
    print_header("Attendance Marking Test")
    
    if not os.path.exists(image_path):
        print_error(f"Test image not found: {image_path}")
        return False
    
    try:
        with open(image_path, 'rb') as f:
            files = {'image': f}
            
            response = requests.post(f"{SERVICE_URL}/recognize-and-mark", files=files, timeout=45)
            
            if response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    matches = result.get('matches', [])
                    attendance_results = result.get('attendance_marked', [])
                    
                    print_success(f"Processed {result.get('faces_detected', 0)} faces")
                    print_info(f"Recognition matches: {len(matches)}")
                    print_info(f"Attendance marked: {len([r for r in attendance_results if r.get('moodle_marked')])}")
                    
                    for i, result in enumerate(attendance_results):
                        status = "✅ MARKED" if result.get('moodle_marked') else "❌ FAILED"
                        print_info(f"  {result.get('student_id')}: {status}")
                        if result.get('moodle_message'):
                            print_info(f"    Message: {result['moodle_message']}")
                    
                    return len([r for r in attendance_results if r.get('moodle_marked')]) > 0
                else:
                    print_error(f"Attendance marking failed: {result.get('error', 'Unknown')}")
                    return False
            else:
                print_error(f"Attendance marking failed: HTTP {response.status_code}")
                return False
                
    except requests.exceptions.RequestException as e:
        print_error(f"Attendance marking error: {e}")
        return False

def test_enrolled_students():
    """Test getting enrolled students list"""
    print_header("Enrolled Students Test")
    
    try:
        response = requests.get(f"{SERVICE_URL}/enrolled", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            students = data.get('enrolled_students', [])
            print_success(f"Retrieved {len(students)} enrolled students")
            
            if students:
                print_info("Enrolled students:")
                for i, student_id in enumerate(students[:5], 1):
                    print_info(f"  {i}. {student_id}")
                if len(students) > 5:
                    print_info(f"  ... and {len(students) - 5} more")
            
            return True
        else:
            print_error(f"Failed to get enrolled students: HTTP {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print_error(f"Get enrolled students error: {e}")
        return False

def test_attendance_log():
    """Test getting attendance log"""
    print_header("Attendance Log Test")
    
    try:
        response = requests.get(f"{SERVICE_URL}/attendance-log?days=7", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                log_data = data.get('log', {})
                total_entries = data.get('total_entries', 0)
                
                print_success(f"Retrieved attendance log - {total_entries} entries")
                
                for date_str, entries in list(log_data.items())[:3]:
                    print_info(f"  {date_str}: {len(entries)} entries")
                
                return True
            else:
                print_error(f"Failed to get attendance log: {data.get('error', 'Unknown')}")
                return False
        else:
            print_error(f"Failed to get attendance log: HTTP {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print_error(f"Get attendance log error: {e}")
        return False

def create_test_images():
    """Create test images directory and instructions"""
    print_header("Test Images Setup")
    
    if not os.path.exists(TEST_IMAGE_PATH):
        os.makedirs(TEST_IMAGE_PATH)
        print_success(f"Created test images directory: {TEST_IMAGE_PATH}")
    
    print_info("Add test images to continue:")
    print_info(f"1. Create directory: {TEST_IMAGE_PATH}")
    print_info("2. Add face images (JPEG/PNG) with clear faces")
    print_info("3. Name them: test_student1.jpg, test_student2.jpg, etc.")
    print_info("4. Then run: python test_system.py")
    
    return os.path.exists(TEST_IMAGE_PATH) and len(os.listdir(TEST_IMAGE_PATH)) > 0

def main():
    """Run all tests"""
    print("🚀 AI Smart Attendance System - Test Suite")
    print(f"📍 Service URL: {SERVICE_URL}")
    print(f"🕐 Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Check if service is running
    if not test_health_check():
        print_error("Service is not responding. Please start the service first.")
        print_info("Run: python app.py")
        return
    
    # Check test images
    if not create_test_images():
        print_header("Test Images Required")
        print_info("Please add test face images to continue with full testing.")
        return
    
    # Run tests
    test_results = {
        'health': test_health_check(),
        'moodle': test_moodle_connection(),
        'enrolled': test_enrolled_students(),
        'attendance_log': test_attendance_log()
    }
    
    # Find test images for enrollment and recognition tests
    test_images = [f for f in os.listdir(TEST_IMAGE_PATH) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
    
    if test_images:
        # Test enrollment with first image
        first_image = os.path.join(TEST_IMAGE_PATH, test_images[0])
        test_results['enrollment'] = test_enrollment("TEST001", first_image)
        
        # Test recognition with first image
        test_results['recognition'] = test_recognition(first_image)
        
        # Test attendance marking with first image
        test_results['attendance_marking'] = test_attendance_marking(first_image)
    
    # Print summary
    print_header("Test Results Summary")
    
    passed = sum(1 for result in test_results.values() if result)
    total = len(test_results)
    
    for test_name, result in test_results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name.title():20} : {status}")
    
    print(f"\n📊 Overall: {passed}/{total} tests passed")
    
    if passed == total:
        print_success("🎉 All tests passed! System is working correctly.")
    else:
        print_error("⚠️ Some tests failed. Check the errors above.")
    
    print(f"\n🕐 Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

if __name__ == "__main__":
    main()
