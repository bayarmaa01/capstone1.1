import pytest
import sys
import os

# Add the parent directory to the path so we can import app
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def test_health_check():
    """Test the health check endpoint"""
    # Import app here to avoid circular imports
    from app import app
    
    with app.test_client() as client:
        response = client.get('/health')
        assert response.status_code == 200
        assert b'healthy' in response.data.lower()

def test_enrolled_endpoint():
    """Test the enrolled students endpoint"""
    from app import app
    
    with app.test_client() as client:
        response = client.get('/enrolled')
        assert response.status_code == 200
        assert isinstance(response.json, list)
