import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import moment from 'moment';
import api from '../services/api';
import CameraCapture from './CameraCapture';

export default function AttendancePage() {
  const { classId, scheduleId } = useParams();
  const navigate = useNavigate();
  
  const [schedule, setSchedule] = useState(null);
  const [attendanceStats, setAttendanceStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    fetchAttendanceStatus();
    // Check status every 30 seconds
    const interval = setInterval(fetchAttendanceStatus, 30000);
    return () => clearInterval(interval);
  }, [classId, scheduleId]);

  const fetchAttendanceStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get(`/schedule/attendance/status?scheduleId=${scheduleId}`);
      
      if (response.data.success) {
        setSchedule(response.data.schedule);
        setAttendanceStats(response.data.attendance_stats);
        setIsActive(response.data.is_active);
        
        // Redirect if not active
        if (!response.data.is_active) {
          setError('Attendance is only available during scheduled class time');
        }
      } else {
        setError('Failed to load attendance status');
      }
    } catch (err) {
      console.error('Error fetching attendance status:', err);
      setError(err.response?.data?.error || 'Failed to load attendance status');
    } finally {
      setLoading(false);
    }
  };

  const handleAttendanceRecorded = (attendanceData) => {
    // Refresh attendance stats after recording
    fetchAttendanceStatus();
  };

  const handleBack = () => {
    navigate(`/class/${classId}`);
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Loading attendance...</h2>
        <p>Please wait...</p>
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
          <h3>Attendance Not Available</h3>
          <p>{error}</p>
        </div>
        <button onClick={handleBack} style={btnBack}>
          Back to Class
        </button>
      </div>
    );
  }

  if (!schedule || !attendanceStats) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Schedule not found</h2>
        <button onClick={handleBack} style={btnBack}>
          Back to Class
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <div>
          <h1 style={{ color: '#333', margin: '0 0 5px 0' }}>
            {schedule.class_name} - Attendance
          </h1>
          <p style={{ color: '#666', margin: '0' }}>
            {schedule.class_code} | {moment().format('MMMM Do YYYY')}
          </p>
        </div>
        <button onClick={handleBack} style={btnBack}>
          Back to Class
        </button>
      </div>

      {/* Schedule Info */}
      <div style={{ 
        background: '#e3f2fd', 
        padding: '15px', 
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#1976d2' }}>
          Schedule Information
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
          <div>
            <strong>Day:</strong> {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][schedule.day_of_week]}
          </div>
          <div>
            <strong>Time:</strong> {schedule.start_time} - {schedule.end_time}
          </div>
          <div>
            <strong>Room:</strong> {schedule.room_number || 'Not specified'}
          </div>
          <div>
            <strong>Status:</strong> 
            <span style={{ 
              color: isActive ? '#155724' : '#721c24',
              fontWeight: 'bold',
              marginLeft: '5px'
            }}>
              {isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Attendance Statistics */}
        <div style={{ 
          background: '#fff', 
          padding: '20px', 
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>
            Attendance Statistics
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div style={{ textAlign: 'center', padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>
                {attendanceStats.present_count}
              </div>
              <div style={{ color: '#666', fontSize: '14px' }}>Present</div>
            </div>
            <div style={{ textAlign: 'center', padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#dc3545' }}>
                {attendanceStats.absent_count}
              </div>
              <div style={{ color: '#666', fontSize: '14px' }}>Absent</div>
            </div>
            <div style={{ textAlign: 'center', padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#007bff' }}>
                {attendanceStats.total_students}
              </div>
              <div style={{ color: '#666', fontSize: '14px' }}>Total Students</div>
            </div>
            <div style={{ textAlign: 'center', padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#17a2b8' }}>
                {attendanceStats.attendance_rate}
              </div>
              <div style={{ color: '#666', fontSize: '14px' }}>Attendance Rate</div>
            </div>
          </div>
        </div>

        {/* Camera Capture */}
        {isActive && (
          <div style={{ 
            background: '#fff', 
            padding: '20px', 
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>
              Face Recognition Attendance
            </h3>
            <CameraCapture 
              classId={classId}
              scheduleId={scheduleId}
              onAttendanceRecorded={handleAttendanceRecorded}
              disabled={!isActive}
            />
          </div>
        )}
      </div>

      {/* Recent Attendance */}
      <div style={{ 
        background: '#fff', 
        padding: '20px', 
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        marginTop: '20px'
      }}>
        <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>
          Recent Attendance Records
        </h3>
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          <p>Attendance records will appear here as students are marked present/absent</p>
        </div>
      </div>
    </div>
  );
}

/* STYLES */
const btnBack = {
  background: '#6c757d',
  color: 'white',
  border: 'none',
  padding: '10px 20px',
  borderRadius: '6px',
  cursor: 'pointer',
  fontWeight: '600',
  fontSize: '14px'
};
