import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function StudentProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchStudentData();
    }
  }, [id]);

  const fetchStudentData = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/students/${id}`);
      setStudent(response.data);
    } catch (error) {
      console.error('Error fetching student data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{ color: 'white', fontSize: '24px', fontWeight: '600' }}>
          Loading student profile...
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{ color: 'white', fontSize: '24px', fontWeight: '600' }}>
          Student not found
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      {/* Header */}
      <div style={{
        background: 'white',
        borderRadius: '15px',
        padding: '25px',
        marginBottom: '20px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
        border: '1px solid rgba(255,255,255,0.2)'
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            padding: '10px 20px',
            backgroundColor: '#f3f4f6',
            color: '#374151',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            marginBottom: '20px'
          }}
        >
          <- Back
        </button>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {student.photo_url && (
            <img 
              src={`/uploads/${student.photo_url}`} 
              alt={student.name}
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                objectFit: 'cover'
              }}
              onError={(e) => e.target.style.display = 'none'}
            />
          )}
          <div>
            <h1 style={{ margin: 0, color: '#1a202c', fontSize: '28px', fontWeight: '700' }}>
              {student.name}
            </h1>
            <p style={{ margin: '5px 0 0 0', color: '#718096', fontSize: '16px' }}>
              Student ID: {student.student_id}
            </p>
            {student.email && (
              <p style={{ margin: '5px 0 0 0', color: '#718096', fontSize: '14px' }}>
                {student.email}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Analytics Section */}
      <div style={{
        background: 'white',
        borderRadius: '15px',
        padding: '25px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
        border: '1px solid rgba(255,255,255,0.2)'
      }}>
        <h2 style={{ margin: '0 0 20px 0', color: '#1a202c', fontSize: '22px', fontWeight: '700' }}>
          Attendance Analytics
        </h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
          <div style={{
            background: '#f8fafc',
            padding: '20px',
            borderRadius: '10px',
            textAlign: 'center',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ fontSize: '32px', fontWeight: '700', color: '#10b981', marginBottom: '8px' }}>
              85%
            </div>
            <div style={{ fontSize: '14px', color: '#64748b', fontWeight: '500' }}>
              Overall Attendance
            </div>
          </div>
          
          <div style={{
            background: '#f8fafc',
            padding: '20px',
            borderRadius: '10px',
            textAlign: 'center',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ fontSize: '32px', fontWeight: '700', color: '#3b82f6', marginBottom: '8px' }}>
              12
            </div>
            <div style={{ fontSize: '14px', color: '#64748b', fontWeight: '500' }}>
              Classes Enrolled
            </div>
          </div>
          
          <div style={{
            background: '#f8fafc',
            padding: '20px',
            borderRadius: '10px',
            textAlign: 'center',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ fontSize: '32px', fontWeight: '700', color: '#8b5cf6', marginBottom: '8px' }}>
              Good
            </div>
            <div style={{ fontSize: '14px', color: '#64748b', fontWeight: '500' }}>
              Risk Status
            </div>
          </div>
        </div>

        {/* Placeholder for future charts */}
        <div style={{
          marginTop: '30px',
          padding: '30px',
          background: '#f8fafc',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '16px', color: '#64748b', marginBottom: '10px' }}>
            Attendance Charts Coming Soon
          </div>
          <div style={{ fontSize: '14px', color: '#94a3b8' }}>
            Detailed analytics and graphs will be available here
          </div>
        </div>
      </div>
    </div>
  );
}
