import React, { useState, useEffect } from 'react';
import moment from 'moment';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import AddScheduleForm from './AddScheduleForm';
import { useDualSchedule } from '../hooks/useDualSchedule';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function ClassSchedule({ classId, onScheduleUpdated }) {
  const [showForm, setShowForm] = useState(false);
  const [currentTime, setCurrentTime] = useState(moment());
  const navigate = useNavigate();
  
  // Use dual schedule hook
  const {
    schedule,
    useMoodle,
    loading,
    error,
    moodleHealth,
    refreshSchedule,
    toggleSource
  } = useDualSchedule(classId);

  useEffect(() => {
    // Update current time every minute
    const timer = setInterval(() => {
      setCurrentTime(moment());
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
    const now = currentTime;
    
    if (scheduleItem.source === 'moodle') {
      // For Moodle sessions, check against the session date and time
      const sessionDate = moment(scheduleItem.date);
      const sessionStartTime = moment(scheduleItem.date);
      const sessionEndTime = moment(scheduleItem.date).add(scheduleItem.duration || 3600, 'seconds');
      
      return now.isBetween(sessionStartTime, sessionEndTime, null, '[)');
    } else {
      // For manual schedules, use day of week logic
      const scheduleDay = now.clone().day(scheduleItem.day_of_week);
      const startTime = moment(scheduleItem.start_time, 'HH:mm');
      const endTime = moment(scheduleItem.end_time, 'HH:mm');
      const currentTimeStr = now.format('HH:mm');
      const currentMoment = moment(currentTimeStr, 'HH:mm');
      
      return now.day() === scheduleItem.day_of_week && 
             currentMoment.isBetween(startTime, endTime, null, '[)');
    }
  };

  const getScheduleStatus = (scheduleItem) => {
    if (scheduleItem.source === 'moodle') {
      const sessionDate = moment(scheduleItem.date);
      const now = currentTime;
      
      if (now.isBefore(sessionDate)) {
        return 'upcoming';
      } else if (isScheduleActive(scheduleItem)) {
        return 'live';
      } else {
        return 'closed';
      }
    } else {
      return isScheduleActive(scheduleItem) ? 'live' : 'inactive';
    }
  };

  const handleScheduleClick = (scheduleItem) => {
    if (getScheduleStatus(scheduleItem) !== 'live') {
      alert('Attendance is only available during scheduled class time');
      return;
    }
    
    // Navigate to attendance page with appropriate parameters
    if (scheduleItem.source === 'moodle') {
      navigate(`/attendance/${classId}/${scheduleItem.sessionId}?source=moodle`);
    } else {
      navigate(`/attendance/${classId}/${scheduleItem.id}?source=manual`);
    }
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
              background: useMoodle ? '#d4edda' : '#fff3cd',
              color: useMoodle ? '#155724' : '#856404'
            }}>
              {useMoodle ? 'Source: Moodle' : 'Source: Manual'}
            </span>
            {moodleHealth !== null && (
              <span style={{
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: '600',
                background: moodleHealth ? '#d1ecf1' : '#f8d7da',
                color: moodleHealth ? '#0c5460' : '#721c24'
              }}>
                Moodle: {moodleHealth ? 'Connected' : 'Offline'}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {moodleHealth && (
            <button 
              onClick={toggleSource}
              style={{
                background: '#17a2b8',
                color: 'white',
                border: 'none',
                padding: '8px 14px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '14px'
              }}
            >
              Switch to {useMoodle ? 'Manual' : 'Moodle'}
            </button>
          )}
          <button onClick={() => setShowForm(true)} style={{
            background: '#28a745',
            color: 'white',
            border: 'none',
            padding: '8px 14px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '14px'
          }}>
            Add Schedule
          </button>
        </div>
      </div>

      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        background: '#fff',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <thead style={{ background: '#667eea', color: 'white' }}>
          <tr>
            <th style={cell}>Course</th>
            <th style={cell}>Date/Day</th>
            <th style={cell}>Time</th>
            <th style={cell}>Room</th>
            <th style={cell}>Status</th>
            <th style={cell}>Source</th>
            <th style={cell}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {schedule.map((s) => {
            const isActive = isScheduleActive(s);
            const status = getScheduleStatus(s);
            const today = new Date();
            const isToday = s.source === 'moodle' 
              ? moment(s.date).isSame(today, 'day')
              : today.getDay() === s.day_of_week;
            
            return (
              <tr 
                key={s.id} 
                style={{
                  background: status === 'live' ? '#d4edda' : isToday ? '#e6f7ff' : 'transparent',
                  cursor: status === 'live' ? 'pointer' : 'default',
                  opacity: status === 'live' ? 1 : 0.7,
                  transition: 'all 0.3s ease'
                }}
                onClick={() => handleScheduleClick(s)}
                title={status === 'live' ? 'Click to take attendance' : 'Attendance not available'}
              >
                <td style={cell}>
                  <div>
                    <strong>{s.courseCode || 'N/A'}</strong>
                    {s.courseName && <div style={{ fontSize: '12px', color: '#666' }}>{s.courseName}</div>}
                  </div>
                </td>
                <td style={cell}>
                  {s.source === 'moodle' 
                    ? moment(s.date).format('MMM DD, YYYY')
                    : DAYS[s.day_of_week]
                  }
                  {isToday && <span style={{ marginLeft: '5px', color: '#28a745' }}>Today</span>}
                </td>
                <td style={cell}>
                  {s.source === 'moodle' 
                    ? moment(s.date).format('h:mm A')
                    : `${s.start_time} - ${s.end_time}`
                  }
                </td>
                <td style={cell}>{s.room || 'TBD'}</td>
                <td style={cell}>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: '600',
                    background: status === 'live' ? '#28a745' : 
                               status === 'upcoming' ? '#ffc107' : 
                               status === 'closed' ? '#dc3545' : '#6c757d',
                    color: 'white'
                  }}>
                    {status === 'live' ? 'Live' : 
                     status === 'upcoming' ? 'Upcoming' : 
                     status === 'closed' ? 'Closed' : 'Inactive'}
                  </span>
                </td>
                <td style={cell}>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: '600',
                    background: s.source === 'moodle' ? '#28a745' : '#ffc107',
                    color: 'white'
                  }}>
                    {s.source === 'moodle' ? 'Moodle' : 'Manual'}
                  </span>
                </td>
                <td style={cell}>
                  <button 
                    onClick={(e) => handleAttendanceClick(e, s)}
                    disabled={status !== 'live'}
                    style={{
                      ...btnAttendance,
                      background: status === 'live' ? '#28a745' : '#6c757d',
                      cursor: status === 'live' ? 'pointer' : 'not-allowed',
                      opacity: status === 'live' ? 1 : 0.5,
                      marginRight: '5px'
                    }}
                    title={status === 'live' ? 'Take Attendance' : 'Not available'}
                  >
                    Attendance
                  </button>
                  {s.source === 'manual' && (
                    <>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleEdit(s); }} 
                        style={btnEdit}
                      >
                        Edit
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }} 
                        style={btnDel}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Current Time Display */}
      <div style={{ 
        marginTop: '10px', 
        padding: '8px', 
        background: '#f8f9fa', 
        borderRadius: '5px',
        fontSize: '14px',
        color: '#6c757d'
      }}>
        Current Time: {currentTime.format('MMMM Do YYYY, h:mm A')}
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
