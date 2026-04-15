import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

// Format function as specified
function formatSession(s) {
  const d = new Date(s.sessdate * 1000);

  // Moodle stores sessdate as UNIX seconds, and duration is in seconds (not minutes).
  // Prefer backend-formatted times when present to avoid timezone/server conversion issues.
  const start = (s.start_time_formatted || d.toTimeString().slice(0, 5));
  const endDate = new Date(d.getTime() + (Number(s.duration) || 0) * 1000);
  const end = (s.end_time_formatted || endDate.toTimeString().slice(0, 5));

  return {
    id: s.sessionId,
    day: d.toLocaleString("en-US", { weekday: "long" }),
    time: `${start}-${end}`,
    course: s.course,
    source: "moodle",
    sessdate: s.sessdate,
    duration: Number(s.duration) || 0,
    // Keep raw formatted times if callers need them
    start_time: start,
    end_time: end
  };
}

export const useDualSchedule = (classId) => {
  const [schedule, setSchedule] = useState([]);
  const [source, setSource] = useState("manual");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize schedule with exact merge logic
  useEffect(() => {
    const initializeSchedule = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Fetch Moodle schedule from backend with auth
        const response = await api.get('/moodle-schedule', {
          headers: { 
            Authorization: `Bearer ${localStorage.getItem('token')}` 
          }
        });
        
        if (response.data.success && response.data.data.length > 0) {
          // Format Moodle data using exact formatSession function
          const formattedSchedule = response.data.data.map(formatSession);
          
          setSchedule(formattedSchedule);
          setSource("moodle");
          console.log('✓ Using Moodle schedule:', formattedSchedule.length, 'sessions');
        } else {
          // Fallback to manual schedule
          console.log('✗ Moodle schedule empty, using manual fallback');
          await fetchManualSchedule();
        }
      } catch (err) {
        console.warn('Moodle schedule fetch failed:', err);
        // Fallback to manual schedule
        await fetchManualSchedule();
      }
      
      setLoading(false);
    };

    initializeSchedule();
  }, [classId]);

  // Fetch manual schedule
  const fetchManualSchedule = useCallback(async () => {
    try {
      const response = await api.get(`/schedule/class/${classId}`);
      
      // Format manual schedule to match structure with source = "manual"
      const formattedSchedule = response.data.map(item => ({
        id: item.id,
        day: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][item.day_of_week],
        time: `${item.start_time}-${item.end_time}`,
        course: classId || 'Manual Course',
        source: "manual",
        day_of_week: item.day_of_week,
        start_time: item.start_time,
        end_time: item.end_time,
        room_number: item.room_number
      }));
      
      setSchedule(formattedSchedule);
      setSource("manual");
      console.log('✓ Using manual schedule:', formattedSchedule.length, 'sessions');
    } catch (err) {
      console.error('Manual schedule fetch failed:', err);
      setError(err.response?.data?.error || 'Failed to fetch manual schedule');
    }
  }, [classId]);

  // Refresh schedule
  const refreshSchedule = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    if (source === "moodle") {
      try {
        const response = await api.get('/moodle-schedule', {
          headers: { 
            Authorization: `Bearer ${localStorage.getItem('token')}` 
          }
        });
        
        if (response.data.success && response.data.data.length > 0) {
          const formattedSchedule = response.data.data.map(formatSession);
          setSchedule(formattedSchedule);
          console.log('✓ Refreshed Moodle schedule:', formattedSchedule.length, 'sessions');
        } else {
          await fetchManualSchedule();
        }
      } catch (err) {
        console.warn('Moodle refresh failed:', err);
        await fetchManualSchedule();
      }
    } else {
      await fetchManualSchedule();
    }
    
    setLoading(false);
  }, [source, classId, fetchManualSchedule]);

  // Toggle between Moodle and Manual
  const toggleSource = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    if (source === "moodle") {
      await fetchManualSchedule();
    } else {
      try {
        const response = await api.get('/moodle-schedule', {
          headers: { 
            Authorization: `Bearer ${localStorage.getItem('token')}` 
          }
        });
        
        if (response.data.success && response.data.data.length > 0) {
          const formattedSchedule = response.data.data.map(formatSession);
          setSchedule(formattedSchedule);
          setSource("moodle");
          console.log('✓ Switched to Moodle schedule:', formattedSchedule.length, 'sessions');
        } else {
          await fetchManualSchedule();
        }
      } catch (err) {
        console.warn('Moodle switch failed:', err);
        await fetchManualSchedule();
      }
    }
    
    setLoading(false);
  }, [source, classId, fetchManualSchedule]);

  return {
    schedule,
    source,
    loading,
    error,
    refreshSchedule,
    toggleSource,
    fetchManualSchedule
  };
};

export default useDualSchedule;
