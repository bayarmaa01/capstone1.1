import React, { useState } from 'react';
import axios from 'axios';

const DAYS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' }
];

export default function AddScheduleForm({ classId, onClose, onAdded }) {
  const [day, setDay] = useState(1);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [room, setRoom] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:4000';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!start || !end) {
        setError('Start and End times are required.');
        setLoading(false);
        return;
      }

      await axios.post(`${apiUrl}/api/schedule`, {
        class_id: classId,
        day_of_week: parseInt(day),
        start_time: start,
        end_time: end,
        room_number: room || null
      });

      if (onAdded) onAdded();
    } catch (err) {
      console.error('Error adding schedule:', err);
      setError(err.response?.data?.error || 'Failed to add schedule.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={container}>
      <h2 style={title}>➕ Add New Schedule</h2>

      {error && <p style={errorBox}>⚠️ {error}</p>}

      <form onSubmit={handleSubmit} style={form}>
        {/* Day */}
        <div style={field}>
          <label style={label}>Day of Week:</label>
          <select
            value={day}
            onChange={(e) => setDay(e.target.value)}
            style={input}
            required
          >
            {DAYS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>

        {/* Start Time */}
        <div style={field}>
          <label style={label}>Start Time:</label>
          <input
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            style={input}
            required
          />
        </div>

        {/* End Time */}
        <div style={field}>
          <label style={label}>End Time:</label>
          <input
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            style={input}
            required
          />
        </div>

        {/* Room */}
        <div style={field}>
          <label style={label}>Room Number:</label>
          <input
            type="text"
            placeholder="Enter room number (optional)"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            style={input}
          />
        </div>

        {/* Buttons */}
        <div style={buttonRow}>
          <button
            type="submit"
            disabled={loading}
            style={{
              ...btn,
              backgroundColor: '#4CAF50',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Saving...' : '✅ Save'}
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{ ...btn, backgroundColor: '#dc3545' }}
          >
            ❌ Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

/* 🎨 STYLES */
const container = {
  padding: '20px',
  fontFamily: 'Segoe UI, sans-serif'
};

const title = {
  marginBottom: '15px',
  color: '#333',
  textAlign: 'center'
};

const form = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px'
};

const field = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start'
};

const label = {
  fontWeight: '600',
  marginBottom: '5px',
  color: '#444'
};

const input = {
  padding: '8px 10px',
  borderRadius: '6px',
  border: '1px solid #ccc',
  width: '100%',
  fontSize: '14px',
  outline: 'none'
};

const buttonRow = {
  display: 'flex',
  justifyContent: 'space-between',
  marginTop: '15px'
};

const btn = {
  flex: 1,
  color: 'white',
  padding: '10px 15px',
  margin: '0 5px',
  border: 'none',
  borderRadius: '6px',
  fontWeight: '600',
  fontSize: '15px'
};

const errorBox = {
  backgroundColor: '#f8d7da',
  color: '#721c24',
  padding: '10px',
  borderRadius: '6px',
  fontSize: '14px',
  marginBottom: '10px',
  textAlign: 'center'
};
