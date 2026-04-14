import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const statusStyles = {
  ongoing: { background: '#eafaf0', border: '#28a745', color: '#1f7a35' },
  upcoming: { background: '#eaf2ff', border: '#3b82f6', color: '#1d4ed8' },
  completed: { background: '#f4f4f5', border: '#a1a1aa', color: '#52525b' }
};

export default function TimetablePage() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadTimetable = async () => {
    try {
      const response = await api.get('/schedule');
      const allSessions = response.data?.all || [];
      const grouped = allSessions.reduce((acc, session) => {
        const key = session.day_name || 'Unknown';
        if (!acc[key]) acc[key] = [];
        acc[key].push(session);
        return acc;
      }, {});

      Object.keys(grouped).forEach((day) => {
        grouped[day].sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
      });

      setGroups(grouped);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load timetable');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTimetable();
    const timer = setInterval(loadTimetable, 30000);
    return () => clearInterval(timer);
  }, []);

  const orderedDays = useMemo(() => {
    return DAY_ORDER.filter((day) => Array.isArray(groups[day]) && groups[day].length > 0);
  }, [groups]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={() => navigate('/dashboard')}>
          ← Dashboard
        </button>
        <h1 style={styles.title}>University Timetable</h1>
      </div>

      {loading && <p style={styles.info}>Loading timetable...</p>}
      {!loading && error && <p style={styles.error}>{error}</p>}
      {!loading && !error && orderedDays.length === 0 && (
        <p style={styles.info}>No timetable sessions available.</p>
      )}

      {!loading && !error && orderedDays.map((day) => (
        <section key={day} style={styles.dayBlock}>
          <h2 style={styles.dayTitle}>{day}</h2>
          {groups[day].map((session) => {
            const palette = statusStyles[session.status] || statusStyles.upcoming;
            return (
              <div
                key={`${day}-${session.id}-${session.start_time}`}
                style={{ ...styles.card, background: palette.background, borderLeftColor: palette.border }}
              >
                <div>
                  <div style={styles.time}>{session.start_time} - {session.end_time}</div>
                  <div style={styles.course}>{session.course_name}</div>
                  <div style={styles.meta}>
                    {session.room_number ? `Room ${session.room_number}` : 'Room TBD'} | {session.session_date}
                  </div>
                </div>
                <span style={{ ...styles.badge, color: palette.color, borderColor: palette.border }}>
                  {session.status}
                </span>
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '1000px',
    margin: '0 auto',
    padding: '24px'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '20px'
  },
  backBtn: {
    border: '1px solid #d4d4d8',
    background: '#fff',
    borderRadius: '8px',
    padding: '8px 12px',
    cursor: 'pointer'
  },
  title: {
    margin: 0,
    fontSize: '28px',
    color: '#111827'
  },
  info: {
    color: '#4b5563'
  },
  error: {
    color: '#dc2626'
  },
  dayBlock: {
    marginBottom: '18px',
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '12px 14px'
  },
  dayTitle: {
    marginTop: 0,
    marginBottom: '10px',
    fontSize: '20px'
  },
  card: {
    borderLeft: '4px solid',
    borderRadius: '10px',
    padding: '12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px'
  },
  time: {
    fontWeight: 700
  },
  course: {
    fontSize: '16px',
    marginTop: '4px'
  },
  meta: {
    marginTop: '4px',
    color: '#4b5563',
    fontSize: '13px'
  },
  badge: {
    border: '1px solid',
    textTransform: 'capitalize',
    borderRadius: '999px',
    padding: '4px 10px',
    fontWeight: 600,
    fontSize: '12px'
  }
};
