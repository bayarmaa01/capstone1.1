import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

// Format function as specified
function formatSession(s) {
  const d = new Date(s.sessdate * 1000);

  const start = d.toTimeString().slice(0,5);
  const endDate = new Date(d.getTime() + s.duration * 60000);
  const end = endDate.toTimeString().slice(0,5);

  return {
    id: s.sessionId,
    day: d.toLocaleString("en-US", { weekday: "long" }),
    time: `${start}-${end}`,
    course: s.course,
    source: "moodle",
    sessdate: s.sessdate,
    duration: s.duration
  };
}

export const useDualSchedule = (classId) => {
  const [schedule, setSchedule] = useState([]);
  const [source, setSource] = useState("manual");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch Moodle schedule from backend
  const fetchMoodleSchedule = useCallback(async () => {
    try {
      const response = await api.get('/moodle-schedule');
      
      if (response.data.success && response.data.data.length > 0) {
        // Format Moodle data using exact formatSession function
        const formattedSchedule = response.data.data.map(formatSession);
        
        setSchedule(formattedSchedule);
        setSource("moodle");
        setError(null);
        return true;
      } else {
        return false;
      }
    } catch (err) {
      console.warn('Moodle schedule fetch failed:', err);
      return false;
    }
  }, []);

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
      setError(null);
    } catch (err) {
      console.error('Manual schedule fetch failed:', err);
      setError(err.response?.data?.error || 'Failed to fetch manual schedule');
    }
  }, [classId]);

  // Initialize schedule with exact merge logic
  useEffect(() => {
    const initializeSchedule = async () => {
      setLoading(true);
      
      // Try to fetch Moodle schedule first
      const moodleSuccess = await fetchMoodleSchedule();
      
      if (!moodleSuccess) {
        // Fallback to manual schedule
        await fetchManualSchedule();
      }
      
      setLoading(false);
    };

    initializeSchedule();
  }, [classId, fetchMoodleSchedule, fetchManualSchedule]);

  // Refresh schedule
  const refreshSchedule = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    if (source === "moodle") {
      const moodleSuccess = await fetchMoodleSchedule();
      if (!moodleSuccess) {
        await fetchManualSchedule();
      }
    } else {
      await fetchManualSchedule();
    }
    
    setLoading(false);
  }, [source, fetchMoodleSchedule, fetchManualSchedule]);

  // Toggle between Moodle and Manual
  const toggleSource = useCallback(async () => {
    setLoading(true);
    
    if (source === "moodle") {
      await fetchManualSchedule();
    } else {
      const moodleSuccess = await fetchMoodleSchedule();
      if (!moodleSuccess) {
        await fetchManualSchedule();
      }
    }
    
    setLoading(false);
  }, [source, fetchMoodleSchedule, fetchManualSchedule]);

  return {
    schedule,
    source,
    loading,
    error,
    refreshSchedule,
    toggleSource,
    fetchMoodleSchedule,
    fetchManualSchedule
  };
};

export default useDualSchedule;
