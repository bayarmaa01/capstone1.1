#!/usr/bin/env python3
"""
AI Smart Attendance System - Setup Script
Automated setup and verification of the attendance system
"""

import os
import sys
import subprocess
import venv
from pathlib import Path

def print_header(title):
    """Print formatted header"""
    print(f"\n{'='*60}")
    print(f"🚀 {title}")
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

def check_python_version():
    """Check Python version compatibility"""
    print_header("Python Version Check")
    
    version = sys.version_info
    if version.major >= 3 and version.minor >= 10:
        print_success(f"Python {version.major}.{version.minor}.{version.micro} is compatible")
        return True
    else:
        print_error(f"Python {version.major}.{version.minor}.{version.micro} is not compatible")
        print_error("Requires Python 3.10 or higher")
        return False

def create_virtual_environment():
    """Create Python virtual environment"""
    print_header("Virtual Environment Setup")
    
    venv_path = Path("venv")
    
    if venv_path.exists():
        print_info("Virtual environment already exists")
        return True
    
    try:
        print_info("Creating virtual environment...")
        venv.create(venv_path, with_pip=True)
        print_success("Virtual environment created successfully")
        return True
    except Exception as e:
        print_error(f"Failed to create virtual environment: {e}")
        return False

def install_dependencies():
    """Install Python dependencies"""
    print_header("Dependencies Installation")
    
    venv_python = Path("venv/Scripts/python.exe") if os.name == 'nt' else Path("venv/bin/python")
    requirements_path = Path("requirements.txt")
    
    if not requirements_path.exists():
        print_error("requirements.txt not found")
        return False
    
    try:
        print_info("Installing dependencies...")
        result = subprocess.run([
            str(venv_python),
            "-m",
            "pip",
            "install",
            "-r",
            str(requirements_path)
        ], capture_output=True, text=True)
        
        if result.returncode == 0:
            print_success("Dependencies installed successfully")
            return True
        else:
            print_error(f"Failed to install dependencies: {result.stderr}")
            return False
            
    except Exception as e:
        print_error(f"Error installing dependencies: {e}")
        return False

def create_directories():
    """Create necessary directories"""
    print_header("Directory Setup")
    
    directories = ["encodings", "logs", "test_images"]
    
    for directory in directories:
        dir_path = Path(directory)
        if not dir_path.exists():
            try:
                dir_path.mkdir(exist_ok=True)
                print_success(f"Created directory: {directory}")
            except Exception as e:
                print_error(f"Failed to create {directory}: {e}")
                return False
        else:
            print_info(f"Directory already exists: {directory}")
    
    return True

def create_env_file():
    """Create .env file with Moodle configuration"""
    print_header("Environment Configuration")
    
    env_path = Path(".env")
    
    if env_path.exists():
        print_info(".env file already exists")
        response = input("Do you want to recreate it? (y/N): ").lower()
        if response != 'y':
            return True
    
    try:
        print_info("Creating .env file with Moodle configuration...")
        
        env_content = """# AI Smart Attendance System - Environment Configuration
# ===========================================================

# Moodle Configuration
MOODLE_URL=http://40.90.174.78:8080
MOODLE_WS_TOKEN=5d2f63b3c1f56fcb8ef11a723ea3e67d

# Service Configuration
PORT=5001
SESSION_TIMEOUT=300
FACE_RECOGNITION_THRESHOLD=0.6

# Development
FLASK_ENV=development
"""
        
        with open(env_path, 'w') as f:
            f.write(env_content)
        
        print_success(".env file created successfully")
        print_info("Edit .env file if you need to change configuration")
        return True
        
    except Exception as e:
        print_error(f"Failed to create .env file: {e}")
        return False

def test_installation():
    """Test the installation"""
    print_header("Installation Test")
    
    venv_python = Path("venv/Scripts/python.exe") if os.name == 'nt' else Path("venv/bin/python")
    
    try:
        # Test imports
        print_info("Testing Python imports...")
        result = subprocess.run([
            str(venv_python),
            "-c",
            "import flask, requests, face_recognition, cv2, numpy; print('All imports successful')"
        ], capture_output=True, text=True)
        
        if result.returncode == 0:
            print_success("All Python modules imported successfully")
        else:
            print_error(f"Import test failed: {result.stderr}")
            return False
        
        # Test face recognition
        print_info("Testing face recognition...")
        result = subprocess.run([
            str(venv_python),
            "-c",
            "import face_recognition; print('Face recognition module loaded')"
        ], capture_output=True, text=True)
        
        if result.returncode == 0:
            print_success("Face recognition module working")
        else:
            print_error(f"Face recognition test failed: {result.stderr}")
            return False
        
        return True
        
    except Exception as e:
        print_error(f"Installation test failed: {e}")
        return False

def create_startup_scripts():
    """Create startup scripts for different platforms"""
    print_header("Startup Scripts Creation")
    
    if os.name == 'nt':
        # Windows batch file
        startup_script = """@echo off
echo Starting AI Smart Attendance System...
cd /d %~dp0
call venv\\Scripts\\activate
python app.py
pause
"""
        script_path = Path("start.bat")
        with open(script_path, 'w') as f:
            f.write(startup_script)
        print_success("Created start.bat for Windows")
        
    else:
        # Linux/macOS shell script
        startup_script = """#!/bin/bash
echo "Starting AI Smart Attendance System..."
cd "$(dirname "$0")"
source venv/bin/activate
python app.py
"""
        script_path = Path("start.sh")
        with open(script_path, 'w') as f:
            f.write(startup_script)
        os.chmod(script_path, 0o755)  # Make executable
        print_success("Created start.sh for Linux/macOS")

def print_usage_instructions():
    """Print usage instructions"""
    print_header("Usage Instructions")
    
    print_info("1. Start the service:")
    if os.name == 'nt':
        print_info("   Windows: Run start.bat")
    else:
        print_info("   Linux/macOS: Run ./start.sh")
    
    print_info("\n2. Alternative manual start:")
    print_info("   Windows: venv\\Scripts\\activate && python app.py")
    print_info("   Linux/macOS: source venv/bin/activate && python app.py")
    
    print_info("\n3. Test the system:")
    print_info("   python test_system.py")
    
    print_info("\n4. Access the service:")
    print_info("   Health check: http://localhost:5001/health")
    print_info("   Moodle test: http://localhost:5001/moodle-test")
    
    print_info("\n5. Add test images:")
    print_info("   Place face images in test_images/ directory")
    print_info("   Run python test_system.py for full testing")

def main():
    """Main setup function"""
    print("🤖 AI Smart Attendance System - Setup")
    print("This script will set up the complete attendance system with Moodle integration")
    
    # Check Python version
    if not check_python_version():
        print_error("Please install Python 3.10 or higher")
        sys.exit(1)
    
    # Create virtual environment
    if not create_virtual_environment():
        print_error("Failed to create virtual environment")
        sys.exit(1)
    
    # Install dependencies
    if not install_dependencies():
        print_error("Failed to install dependencies")
        sys.exit(1)
    
    # Create directories
    if not create_directories():
        print_error("Failed to create directories")
        sys.exit(1)
    
    # Create environment file
    if not create_env_file():
        print_error("Failed to create environment file")
        sys.exit(1)
    
    # Test installation
    if not test_installation():
        print_error("Installation test failed")
        sys.exit(1)
    
    # Create startup scripts
    create_startup_scripts()
    
    # Print usage instructions
    print_usage_instructions()
    
    print_header("Setup Complete!")
    print_success("🎉 AI Smart Attendance System is ready to use!")
    print_info("Review the usage instructions above to start the system.")

if __name__ == "__main__":
    main()
