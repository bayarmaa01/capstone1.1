import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

export const useDualSchedule = (classId) => {
  const [schedule, setSchedule] = useState([]);
  const [useMoodle, setUseMoodle] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [moodleHealth, setMoodleHealth] = useState(null);

  // Fetch Moodle schedule
  const fetchMoodleSchedule = useCallback(async () => {
    try {
      const response = await api.get('/moodle-schedule');
      
      if (response.data.success && response.data.data.length > 0) {
        // Filter by class if course is provided
        const filteredSchedule = classId 
          ? response.data.data.filter(item => item.course === parseInt(classId))
          : response.data.data;
        
        setSchedule(filteredSchedule);
        setUseMoodle(true);
        setError(null);
        return true;
      } else {
        return false;
      }
    } catch (err) {
      console.warn('Moodle schedule fetch failed:', err);
      return false;
    }
  }, [classId]);

  // Fetch manual schedule
  const fetchManualSchedule = useCallback(async () => {
    try {
      const response = await api.get(`/schedule/class/${classId}`);
      
      // Format manual schedule to match structure
      const formattedSchedule = response.data.map(item => ({
        ...item,
        sessionId: `manual_${item.id}`,
        source: 'manual',
        date: item.scheduled_date || getNextOccurrence(item.day_of_week),
        courseName: 'Manual Schedule',
        courseCode: 'MANUAL',
        sessionName: `${item.day_of_week} Class`,
        description: `Room: ${item.room_number || 'TBD'}`,
        duration: 3600, // 1 hour default
        timemodified: new Date().getTime() / 1000
      }));
      
      setSchedule(formattedSchedule);
      setUseMoodle(false);
      setError(null);
    } catch (err) {
      console.error('Manual schedule fetch failed:', err);
      setError(err.response?.data?.error || 'Failed to fetch manual schedule');
    }
  }, [classId]);

  // Check Moodle health
  const checkMoodleHealth = useCallback(async () => {
    try {
      const response = await api.get('/moodle-schedule/health');
      setMoodleHealth(response.data.success);
      return response.data.success;
    } catch (err) {
      setMoodleHealth(false);
      return false;
    }
  }, []);

  // Initialize schedule
  useEffect(() => {
    const initializeSchedule = async () => {
      setLoading(true);
      
      // First check Moodle health
      const moodleIsHealthy = await checkMoodleHealth();
      
      if (moodleIsHealthy) {
        // Try to fetch Moodle schedule
        const moodleSuccess = await fetchMoodleSchedule();
        
        if (!moodleSuccess) {
          // Fallback to manual schedule
          await fetchManualSchedule();
        }
      } else {
        // Moodle not healthy, use manual schedule
        await fetchManualSchedule();
      }
      
      setLoading(false);
    };

    initializeSchedule();
  }, [classId, fetchMoodleSchedule, fetchManualSchedule, checkMoodleHealth]);

  // Refresh schedule
  const refreshSchedule = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    if (useMoodle) {
      const moodleSuccess = await fetchMoodleSchedule();
      if (!moodleSuccess) {
        await fetchManualSchedule();
      }
    } else {
      await fetchManualSchedule();
    }
    
    setLoading(false);
  }, [useMoodle, fetchMoodleSchedule, fetchManualSchedule]);

  // Toggle between Moodle and Manual
  const toggleSource = useCallback(async () => {
    setLoading(true);
    
    if (useMoodle) {
      await fetchManualSchedule();
    } else {
      const moodleSuccess = await fetchMoodleSchedule();
      if (!moodleSuccess) {
        await fetchManualSchedule();
      }
    }
    
    setLoading(false);
  }, [useMoodle, fetchMoodleSchedule, fetchManualSchedule]);

  return {
    schedule,
    useMoodle,
    loading,
    error,
    moodleHealth,
    refreshSchedule,
    toggleSource,
    fetchMoodleSchedule,
    fetchManualSchedule
  };
};

// Helper function to get next occurrence of a day
function getNextOccurrence(dayOfWeek) {
  const today = new Date();
  const currentDay = today.getDay();
  const daysUntilNext = (dayOfWeek - currentDay + 7) % 7 || 7;
  const nextDate = new Date(today);
  nextDate.setDate(today.getDate() + daysUntilNext);
  return nextDate.toISOString().split('T')[0];
}

export default useDualSchedule;
