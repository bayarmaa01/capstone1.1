import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function AttendanceSession() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [sessionInfo, setSessionInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [studentId, setStudentId] = useState('');
  const [attendanceStatus, setAttendanceStatus] = useState(null);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    fetchSessionInfo();
  }, [id]);

  const fetchSessionInfo = async () => {
    try {
      setLoading(true);
      
      // Try to get session from Moodle first
      try {
        const moodleResponse = await api.get('/moodle-schedule');
        if (moodleResponse.data.success) {
          const session = moodleResponse.data.data.find(s => s.sessionId == id);
          if (session) {
            setSessionInfo({
              ...session,
              source: 'moodle',
              formattedDate: new Date(session.sessdate * 1000).toLocaleString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })
            });
            return;
          }
        }
      } catch (moodleError) {
        console.log('Moodle session not found, trying manual...');
      }

      // Fallback to manual schedule
      const manualResponse = await api.get(`/schedule/${id}`);
      if (manualResponse.data) {
        const session = manualResponse.data;
        setSessionInfo({
          ...session,
          source: 'manual',
          formattedDate: `${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][session.day_of_week]} ${session.start_time} - ${session.end_time}`
        });
      } else {
        setError('Session not found');
      }
    } catch (err) {
      console.error('Error fetching session:', err);
      setError('Failed to load session information');
    } finally {
      setLoading(false);
    }
  };

  const checkAttendance = async () => {
    if (!studentId.trim()) {
      alert('Please enter a student ID');
      return;
    }

    try {
      const response = await api.post('/moodle-schedule/check', {
        studentId: studentId.trim(),
        sessionId: id
      });

      setAttendanceStatus(response.data);
    } catch (err) {
      console.error('Error checking attendance:', err);
      setAttendanceStatus({ allowed: false, error: 'Failed to check attendance' });
    }
  };

  const markAttendance = async () => {
    if (!studentId.trim()) {
      alert('Please enter a student ID');
      return;
    }

    setMarking(true);
    try {
      const response = await api.post('/moodle-schedule/mark', {
        studentId: studentId.trim(),
        sessionId: id
      });

      if (response.data.success) {
        alert('Attendance marked successfully!');
        setStudentId('');
        setAttendanceStatus(null);
      } else {
        alert(response.data.error || 'Failed to mark attendance');
      }
    } catch (err) {
      console.error('Error marking attendance:', err);
      alert(err.response?.data?.error || 'Failed to mark attendance');
    } finally {
      setMarking(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div style={{
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #667eea',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 10px'
        }}></div>
        <p>Loading session...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div style={{
          background: '#f8d7da',
          color: '#721c24',
          padding: '15px',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <h3>Error</h3>
          <p>{error}</p>
        </div>
        <button 
          onClick={() => navigate(-1)}
          style={{
            background: '#6c757d',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <button 
        onClick={() => navigate(-1)}
        style={{
          background: '#6c757d',
          color: 'white',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '6px',
          cursor: 'pointer',
          marginBottom: '20px'
        }}
      >
        Back to Schedule
      </button>

      <div style={{
        background: 'white',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ color: '#333', marginBottom: '20px' }}>Attendance Session</h2>
        
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontWeight: 'bold', color: '#666' }}>Session ID:</span>
            <span>{sessionInfo.id}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontWeight: 'bold', color: '#666' }}>Course:</span>
            <span>{sessionInfo.course}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontWeight: 'bold', color: '#666' }}>Date/Time:</span>
            <span>{sessionInfo.formattedDate}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontWeight: 'bold', color: '#666' }}>Source:</span>
            <span style={{
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: '600',
              background: sessionInfo.source === 'moodle' ? '#28a745' : '#ffc107',
              color: 'white'
            }}>
              {sessionInfo.source === 'moodle' ? 'Synced' : 'Fallback'}
            </span>
          </div>
        </div>

        <div style={{
          background: '#f8f9fa',
          padding: '15px',
          borderRadius: '6px',
          marginBottom: '20px'
        }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>Take Attendance</h3>
          
          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
            <input
              type="text"
              placeholder="Enter Student ID"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              style={{
                flex: 1,
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
            <button
              onClick={checkAttendance}
              style={{
                background: '#17a2b8',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Check
            </button>
          </div>

          {attendanceStatus && (
            <div style={{
              padding: '10px',
              borderRadius: '4px',
              marginBottom: '15px',
              background: attendanceStatus.allowed ? '#d4edda' : '#f8d7da',
              color: attendanceStatus.allowed ? '#155724' : '#721c24'
            }}>
              {attendanceStatus.allowed ? (
                <div>
                  <strong>Attendance Available</strong>
                  <p style={{ margin: '5px 0' }}>Student can mark attendance for this session.</p>
                  <button
                    onClick={markAttendance}
                    disabled={marking}
                    style={{
                      background: '#28a745',
                      color: 'white',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '4px',
                      cursor: marking ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      opacity: marking ? 0.7 : 1
                    }}
                  >
                    {marking ? 'Marking...' : 'Take Attendance'}
                  </button>
                </div>
              ) : (
                <div>
                  <strong>Attendance Already Taken</strong>
                  <p style={{ margin: '5px 0' }}>
                    {attendanceStatus.error || 'This student has already marked attendance for this session.'}
                  </p>
                </div>
              )}
            </div>
          )}

          <button
            onClick={markAttendance}
            disabled={marking || !studentId.trim()}
            style={{
              background: '#28a745',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '6px',
              cursor: (marking || !studentId.trim()) ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: '600',
              width: '100%',
              opacity: (marking || !studentId.trim()) ? 0.7 : 1
            }}
          >
            {marking ? 'Marking Attendance...' : 'Take Attendance'}
          </button>
        </div>
      </div>
    </div>
  );
}
