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
      const sessionEnd = new Date(sessionStart.getTime() + scheduleItem.duration * 60000);
      
      if (now < sessionStart) {
        return 'upcoming';
      } else if (now >= sessionStart && now <= sessionEnd) {
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
      
      const sessionEnd = new Date();
      sessionEnd.setHours(...endTime.split(':').map(Number), 0, 0);
      
      if (now < sessionStart) {
        return 'upcoming';
      } else if (now >= sessionStart && now <= sessionEnd) {
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

  const cell = {
    padding: '10px',
    borderBottom: '1px solid #ddd',
    textAlign: 'center'
  };

  const cellHeader = {
    padding: '10px',
    borderBottom: '1px solid #ddd',
    textAlign: 'center',
    fontWeight: '600',
    backgroundColor: '#f8f9fa'
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
    fontSize: '12px',
    fontWeight: '600'
  };

  const btnDel = {
    background: '#dc3545',
    border: 'none',
    color: 'white',
    padding: '5px 10px',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '600'
  };

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
              fontWeight: '600',
              fontSize: '14px'
            }}
          >
            Switch to {source === 'moodle' ? 'Manual' : 'Synced'}
          </button>
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

      {loading && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          Loading schedule...
        </div>
      )}

      {error && (
        <div style={{ 
          textAlign: 'center', 
          padding: '20px', 
          backgroundColor: '#f8d7da', 
          color: '#721c24', 
          borderRadius: '8px',
          margin: '20px 0'
        }}>
          <strong>Error loading schedule:</strong> {error}
        </div>
      )}

      {!loading && !error && (
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          marginTop: '20px',
          backgroundColor: 'white',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa' }}>
              <th style={cellHeader}>Course</th>
              <th style={cellHeader}>Day</th>
              <th style={cellHeader}>Time</th>
              <th style={cellHeader}>Room</th>
              <th style={cellHeader}>Status</th>
              <th style={cellHeader}>Source</th>
              <th style={cellHeader}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {schedule.map((s) => {
              const status = getScheduleStatus(s);
              
              return (
                <tr 
                  key={s.id} 
                  style={{
                    background: status === 'live' ? '#d4edda' : 'transparent',
                    cursor: status === 'live' ? 'pointer' : 'default',
                    opacity: status === 'live' ? 1 : 0.7,
                    transition: 'all 0.3s ease'
                  }}
                  onClick={() => handleScheduleClick(s)}
                  title={status === 'live' ? 'Click to take attendance' : 'Attendance not available'}
                >
                  <td style={cell}>
                    <strong>{s.course}</strong>
                  </td>
                  <td style={cell}>
                    {s.day}
                  </td>
                  <td style={cell}>
                    {s.time}
                  </td>
                  <td style={cell}>
                    {s.room_number || 'TBD'}
                  </td>
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
                      {s.source === 'moodle' ? 'Synced' : 'Manual'}
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
            {schedule.length === 0 && !loading && !error && (
              <tr>
                <td colSpan="7" style={{ 
                  textAlign: 'center', 
                  padding: '40px', 
                  color: '#999',
                  fontStyle: 'italic'
                }}>
                  No sessions available. {source === 'moodle' ? 'Try switching to Manual schedule.' : 'Add a schedule to get started.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {/* Current Time Display */}
      <div style={{ 
        marginTop: '10px', 
        padding: '8px', 
        background: '#f8f9fa', 
        borderRadius: '5px',
        fontSize: '14px',
        color: '#666',
        textAlign: 'center'
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
        <div style={{
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
        }}>
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '10px',
            width: '400px',
            boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
          }}>
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
