import React, { useState, useEffect } from 'react';
import moment from 'moment';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import AddScheduleForm from './AddScheduleForm';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function ClassSchedule({ classId, onScheduleUpdated }) {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [currentTime, setCurrentTime] = useState(moment());
  const navigate = useNavigate();

  useEffect(() => {
    fetchSchedules();
    // Update current time every minute
    const timer = setInterval(() => {
      setCurrentTime(moment());
    }, 60000);
    return () => clearInterval(timer);
  }, [classId]);

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/schedule/class/${classId}`);
      setSchedules(res.data);
      if (onScheduleUpdated) onScheduleUpdated(res.data);
    } catch (err) {
      console.error('Error loading schedule:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this schedule?')) return;
    await api.delete(`/schedule/${id}`);
    fetchSchedules();
  };

  const handleEdit = async (schedule) => {
    const day = prompt('Day of week (0=Sun,1=Mon..):', schedule.day_of_week);
    const start = prompt('Start Time (HH:mm):', schedule.start_time);
    const end = prompt('End Time (HH:mm):', schedule.end_time);
    const room = prompt('Room:', schedule.room_number);
    await api.put(`/schedule/${schedule.id}`, {
      day_of_week: parseInt(day),
      start_time: start,
      end_time: end,
      room_number: room,
      scheduled_date: null
    });
    fetchSchedules();
  };

  const isScheduleActive = (schedule) => {
    const now = currentTime;
    const scheduleDay = now.clone().day(schedule.day_of_week);
    
    // Parse start and end times
    const startTime = moment(schedule.start_time, 'HH:mm');
    const endTime = moment(schedule.end_time, 'HH:mm');
    
    // Check if current time is within schedule range
    const currentTimeStr = now.format('HH:mm');
    const currentMoment = moment(currentTimeStr, 'HH:mm');
    
    return now.day() === schedule.day_of_week && 
           currentMoment.isBetween(startTime, endTime, null, '[)');
  };

  const handleScheduleClick = (schedule) => {
    if (!isScheduleActive(schedule)) {
      alert('Attendance is only available during scheduled class time');
      return;
    }
    
    // Navigate to attendance page
    navigate(`/attendance/${classId}/${schedule.id}`);
  };

  const handleAttendanceClick = (e, schedule) => {
    e.stopPropagation(); // Prevent row click
    handleScheduleClick(schedule);
  };

  if (loading) return <p>Loading schedule...</p>;

  return (
    <div style={{ marginTop: '10px' }}>
      {/* Header with Add Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ color: '#333', fontSize: '18px', margin: '10px 0' }}>Class Schedule</h2>
        <button onClick={() => setShowForm(true)} style={btnAdd}>Add Schedule</button>
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
            <th style={cell}>Day</th>
            <th style={cell}>Start</th>
            <th style={cell}>End</th>
            <th style={cell}>Room</th>
            <th style={cell}>Status</th>
            <th style={cell}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {schedules.map((s) => {
            const isActive = isScheduleActive(s);
            const today = new Date();
            const isToday = today.getDay() === s.day_of_week;
            
            return (
              <tr 
                key={s.id} 
                style={{
                  background: isActive ? '#d4edda' : isToday ? '#e6f7ff' : 'transparent',
                  cursor: isActive ? 'pointer' : 'default',
                  opacity: isActive ? 1 : 0.7,
                  transition: 'all 0.3s ease'
                }}
                onClick={() => handleScheduleClick(s)}
                title={isActive ? 'Click to take attendance' : 'Attendance not available'}
              >
                <td style={cell}>
                  {DAYS[s.day_of_week]}
                  {isToday && <span style={{ marginLeft: '5px', color: '#28a745' }}>Today</span>}
                </td>
                <td style={cell}>{s.start_time}</td>
                <td style={cell}>{s.end_time}</td>
                <td style={cell}>{s.room_number || '-'}</td>
                <td style={cell}>
                  {isActive ? (
                    <span style={{ color: '#155724', fontWeight: 'bold' }}>Active</span>
                  ) : (
                    <span style={{ color: '#6c757d' }}>Inactive</span>
                  )}
                </td>
                <td style={cell}>
                  <button 
                    onClick={(e) => handleAttendanceClick(e, s)}
                    disabled={!isActive}
                    style={{
                      ...btnAttendance,
                      background: isActive ? '#28a745' : '#6c757d',
                      cursor: isActive ? 'pointer' : 'not-allowed',
                      opacity: isActive ? 1 : 0.5
                    }}
                    title={isActive ? 'Take Attendance' : 'Not available'}
                  >
                    Attendance
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleEdit(s); }} style={btnEdit}>Edit</button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }} style={btnDel}>Delete</button>
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
                fetchSchedules();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* 🎨 STYLES */
const cell = {
  padding: '10px',
  borderBottom: '1px solid #ddd',
  textAlign: 'center'
};

const btnAdd = {
  background: '#28a745',
  color: 'white',
  border: 'none',
  padding: '8px 14px',
  borderRadius: '6px',
  cursor: 'pointer',
  fontWeight: '600',
  fontSize: '14px'
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
