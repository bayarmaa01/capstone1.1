import pytest
import sys
import os

def test_health_check():
    """Test the health check endpoint"""
    # Import app here to avoid circular imports
    from app import app
    
    with app.test_client() as client:
        response = client.get('/health')
        assert response.status_code == 200
        # Check for 'status' field instead of 'healthy' text
        data = response.get_json()
        assert 'status' in data
        assert data['status'] == 'ok'

def test_enrolled_endpoint():
    """Test the enrolled students endpoint"""
    from app import app
    
    with app.test_client() as client:
        response = client.get('/enrolled')
        assert response.status_code == 200
        data = response.get_json()
        # Check if response is a dict with expected structure
        assert isinstance(data, dict)
        assert 'enrolled_students' in data or 'students' in data
