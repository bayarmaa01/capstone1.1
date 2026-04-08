import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import AddScheduleForm from './AddScheduleForm';
import { useDualSchedule } from '../hooks/useDualSchedule';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function ClassSchedule({ classId, onScheduleUpdated }) {
  const [showForm, setShowForm] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const navigate = useNavigate();
  
  // Use dual schedule hook
  const {
    schedule,
    source,
    loading,
    error,
    refreshSchedule,
    toggleSource
  } = useDualSchedule(classId);

  useEffect(() => {
    // Update current time every minute
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this schedule?')) return;
    await api.delete(`/schedule/${id}`);
    refreshSchedule();
  };

  const handleEdit = async (scheduleItem) => {
    const day = prompt('Day of week (0=Sun,1=Mon..):', scheduleItem.day_of_week);
    const start = prompt('Start Time (HH:mm):', scheduleItem.start_time);
    const end = prompt('End Time (HH:mm):', scheduleItem.end_time);
    const room = prompt('Room:', scheduleItem.room_number);
    await api.put(`/schedule/${scheduleItem.id}`, {
      day_of_week: parseInt(day),
      start_time: start,
      end_time: end,
      room_number: room,
      scheduled_date: null
    });
    refreshSchedule();
  };

  const isScheduleActive = (scheduleItem) => {
    const now = new Date();
    
    if (scheduleItem.source === 'moodle') {
      // For Moodle sessions, check within ±10 minutes of session time
      const sessionStart = new Date(scheduleItem.sessdate * 1000);
      const sessionEnd = new Date(sessionStart.getTime() + scheduleItem.duration * 60000);
      
      // Allow attendance ±10 minutes from session start/end
      const earlyStart = new Date(sessionStart.getTime() - 10 * 60000);
      const lateEnd = new Date(sessionEnd.getTime() + 10 * 60000);
      
      return now >= earlyStart && now <= lateEnd;
    } else {
      // For manual schedules, check day match and time within ±10 minutes
      const scheduleDay = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(scheduleItem.day);
      const currentDay = now.getDay();
      
      if (scheduleDay !== currentDay) {
        return false;
      }
      
      const [startTime, endTime] = scheduleItem.time.split('-');
      const sessionStart = new Date();
      sessionStart.setHours(...startTime.split(':').map(Number), 0, 0);
      
      const sessionEnd = new Date();
      sessionEnd.setHours(...endTime.split(':').map(Number), 0, 0);
      
      // Allow attendance ±10 minutes from session start/end
      const earlyStart = new Date(sessionStart.getTime() - 10 * 60000);
      const lateEnd = new Date(sessionEnd.getTime() + 10 * 60000);
      
      return now >= earlyStart && now <= lateEnd;
    }
  };

  const getScheduleStatus = (scheduleItem) => {
    const now = new Date();
    
    if (scheduleItem.source === 'moodle') {
      const sessionStart = new Date(scheduleItem.sessdate * 1000);
      const earlyStart = new Date(sessionStart.getTime() - 10 * 60000);
      const sessionEnd = new Date(sessionStart.getTime() + scheduleItem.duration * 60000);
      const lateEnd = new Date(sessionEnd.getTime() + 10 * 60000);
      
      if (now < earlyStart) {
        return 'upcoming';
      } else if (now >= earlyStart && now <= lateEnd) {
        return 'live';
      } else {
        return 'closed';
      }
    } else {
      const scheduleDay = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(scheduleItem.day);
      const currentDay = now.getDay();
      
      if (scheduleDay !== currentDay) {
        return 'inactive';
      }
      
      const [startTime, endTime] = scheduleItem.time.split('-');
      const sessionStart = new Date();
      sessionStart.setHours(...startTime.split(':').map(Number), 0, 0);
      
      const earlyStart = new Date(sessionStart.getTime() - 10 * 60000);
      const sessionEnd = new Date();
      sessionEnd.setHours(...endTime.split(':').map(Number), 0, 0);
      
      const lateEnd = new Date(sessionEnd.getTime() + 10 * 60000);
      
      if (now < earlyStart) {
        return 'upcoming';
      } else if (now >= earlyStart && now <= lateEnd) {
        return 'live';
      } else {
        return 'closed';
      }
    }
  };

  const handleScheduleClick = (scheduleItem) => {
    if (getScheduleStatus(scheduleItem) !== 'live') {
      alert('Attendance not available');
      return;
    }
    
    // Navigate to attendance page with session ID
    navigate(`/attendance/${scheduleItem.id}`);
  };

  const handleAttendanceClick = (e, scheduleItem) => {
    e.stopPropagation();
    handleScheduleClick(scheduleItem);
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
        <p>Loading schedule...</p>
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
          <h3>Schedule Load Error</h3>
          <p>{error}</p>
          <button 
            onClick={refreshSchedule}
            style={{
              background: '#dc3545',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              marginTop: '10px'
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: '10px' }}>
      {/* Header with Source Toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <div>
          <h2 style={{ color: '#333', fontSize: '18px', margin: '10px 0' }}>
            Class Schedule
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: '600',
              background: source === 'moodle' ? '#d4edda' : '#fff3cd',
              color: source === 'moodle' ? '#155724' : '#856404'
            }}>
              {source === 'moodle' ? 'Synced' : 'Manual'}
            </span>
            {schedule.length === 0 && !loading && (
              <span style={{
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: '600',
                background: '#f8d7da',
                color: '#721c24'
              }}>
                No sessions available
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={toggleSource}
            style={{
              background: '#17a2b8',
              color: 'white',
              border: 'none',
              padding: '8px 14px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Switch to {source === 'moodle' ? 'Manual' : 'Synced'}
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          Loading schedule...

      {/* Current Time Display */}
      <div style={{ 
        marginTop: '10px', 
        padding: '8px', 
        background: '#f8f9fa', 
        borderRadius: '5px',
        fontSize: '14px',
        color: '#6c757d'
      }}>
        Current Time: {currentTime.toLocaleString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}
      </div>

      {/* Add Schedule Modal */}
      {showForm && (
        <div style={modalBackdrop}>
          <div style={modalContent}>
            <AddScheduleForm
              classId={classId}
              onClose={() => setShowForm(false)}
              onAdded={() => {
                setShowForm(false);
                refreshSchedule();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* STYLES */
const cell = {
  padding: '10px',
  borderBottom: '1px solid #ddd',
  textAlign: 'center'
};

const btnAttendance = {
  background: '#28a745',
  color: 'white',
  border: 'none',
  padding: '5px 10px',
  borderRadius: '5px',
  cursor: 'pointer',
  marginRight: '5px',
  fontSize: '12px',
  fontWeight: '600'
};

const btnEdit = {
  background: '#ffc107',
  border: 'none',
  color: 'white',
  padding: '5px 10px',
  borderRadius: '5px',
  cursor: 'pointer',
  marginRight: '5px'
};

const btnDel = {
  background: '#dc3545',
  border: 'none',
  color: 'white',
  padding: '5px 10px',
  borderRadius: '5px',
  cursor: 'pointer'
};

const modalBackdrop = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  backgroundColor: 'rgba(0,0,0,0.5)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1000
};

const modalContent = {
  background: 'white',
  padding: '20px',
  borderRadius: '10px',
  width: '400px',
  boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
};
