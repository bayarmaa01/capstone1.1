import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import QRScanner from '../components/QRScanner';
import CameraCapture from '../components/CameraCapture';
import moment from 'moment';

export default function AttendancePage() {
  const { scheduleId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState(null); // null, 'face', 'qr', or 'manual'
  const [classInfo, setClassInfo] = useState(null);
  const [scheduleInfo, setScheduleInfo] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);
  const [recognizedIds, setRecognizedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState(null);

  const queryParams = new URLSearchParams(location.search);
  const classIdFromQuery = queryParams.get('classId');
  const sessionFromState = location.state?.session || null;
  const classIdFromState = location.state?.classId || null;

  useEffect(() => {
    if (scheduleId) {
      fetchScheduleStatus();
    }
    
    // Check status every 30 seconds if schedule-based
    const interval = scheduleId ? setInterval(fetchScheduleStatus, 30000) : null;
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [scheduleId]);

  const fetchScheduleStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let resolvedSchedule = sessionFromState;

      // Try local schedule route first (works for manual schedules).
      if (!resolvedSchedule) {
        try {
          const scheduleResponse = await api.get(`/schedule/${scheduleId}`);
          resolvedSchedule = scheduleResponse.data;
        } catch (scheduleErr) {
          const fallbackClassId = classIdFromState || classIdFromQuery;
          if (!fallbackClassId) {
            throw scheduleErr;
          }
          // Fallback for Moodle sessions: fetch class schedule list and match by ID.
          const classScheduleResponse = await api.get(`/classes/${fallbackClassId}/schedule`);
          resolvedSchedule = (classScheduleResponse.data || []).find(
            (item) => String(item.id) === String(scheduleId)
          );
          if (!resolvedSchedule) {
            throw scheduleErr;
          }
        }
      }

      setScheduleInfo(resolvedSchedule);
      const resolvedSessionDate = (resolvedSchedule.scheduled_date || sessionDate);
      setSessionDate(resolvedSessionDate);
      
      // Get class information from schedule/query/state
      const resolvedClassId = resolvedSchedule.class_id || classIdFromState || classIdFromQuery;
      const classResponse = await api.get(`/classes/${resolvedClassId}`);
      setClassInfo(classResponse.data);
      
      // Get attendance for this class and date
      await fetchTodayAttendance(resolvedClassId, resolvedSessionDate);
      
      // Check if schedule is active (within 30 minutes of start time)
      const now = new Date();
      const scheduleDate = new Date(resolvedSchedule.scheduled_date || sessionDate);
      const [hours, minutes] = String(resolvedSchedule.start_time || '00:00').split(':');
      const startTime = new Date(scheduleDate);
      startTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      
      const endTime = new Date(scheduleDate);
      const [endHours, endMinutes] = String(resolvedSchedule.end_time || '23:59').split(':');
      endTime.setHours(parseInt(endHours), parseInt(endMinutes), 0, 0);
      
      const isActive = now >= startTime && now <= endTime;
      setIsActive(isActive);
      
      if (!isActive) {
        setError('Attendance is only available during scheduled class time');
      }
      
    } catch (err) {
      console.error('Error fetching schedule status:', err);
      setError(err.response?.data?.error || 'Failed to load schedule information');
    } finally {
      setLoading(false);
    }
  };

  const fetchTodayAttendance = async (classId, dateOverride) => {
    try {
      setLoading(true);
      const dateToUse = dateOverride || sessionDate;
      const response = await api.get(
        scheduleId
          ? `/attendance/class/${classId}/date/${dateToUse}?sessionId=${encodeURIComponent(scheduleId)}`
          : `/attendance/class/${classId}/date/${dateToUse}`
      );
      setAttendance(response.data);
      
      // Track already present students using their student_id (STU001, etc.)
      const presentIds = new Set(
        response.data.filter(s => s.present).map(s => s.student_id)
      );
      setRecognizedIds(presentIds);
      console.log('Loaded attendance:', response.data.length, 'students');
      console.log('Already present:', presentIds.size, 'students');
    } catch (error) {
      console.error('Error fetching attendance:', error);
      alert('Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  };

  const handleQRScan = async (decodedText) => {
    try {
      console.log(' QR Code scanned:', decodedText);
      
      // Extract student ID
      let studentId = decodedText.trim();
      
      // Handle URL-based QR codes
      if (studentId.includes('http') || studentId.includes('://')) {
        const match = studentId.match(/STU\d+/i);
        if (match) {
          studentId = match[0].toUpperCase();
        } else {
          alert('QR code should contain student ID (format: STU001)');
          return;
        }
      }
      
      // Convert to uppercase
      studentId = studentId.toUpperCase();
      
      // Validate format (STU followed by digits)
      if (!studentId.match(/^STU\d+$/i)) {
        alert(`Invalid student ID format: ${studentId}\nExpected format: STU001`);
        return;
      }
      
      console.log('Looking for student ID:', studentId);
      
      // Check if already present
      if (recognizedIds.has(studentId)) {
        alert(`Student ${studentId} already marked present!`);
        return;
      }

      // Find student in attendance list
      const student = attendance.find(s => s.student_id === studentId);
      
      if (!student) {
        console.error('Student not found in class');
        alert(`Student ${studentId} is not enrolled in this class!`);
        return;
      }

      console.log('Found student:', student.name, '(DB ID:', student.id, ')');

      // Record attendance with student's database ID
      await api.post('/attendance/record', {
        class_id: classInfo.id,
        student_id: student.id,  // Use database ID from the student record
        session_date: sessionDate,
        ...(scheduleId ? { session_id: scheduleId } : {}),
        method: 'qr',
        confidence: 1.0
      });
      
      setRecognizedIds(prev => new Set([...prev, studentId]));
      await fetchTodayAttendance(classInfo.id, sessionDate);
      alert(`Attendance recorded for ${student.name} (${studentId})`);
      
    } catch (error) {
      console.error('QR scan error:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Failed to record attendance';
      alert(`Error: ${errorMsg}`);
    }
  };

  const handleFaceRecognized = async (match) => {
    try {
      console.log('Face recognized:', match);
      
      // match should have: { student_id: "STU001", confidence: 0.95 }
      if (!match || !match.student_id) {
        console.error('Invalid match data:', match);
        return;
      }
      
      const studentId = match.student_id.toUpperCase();
      
      // Check if already marked
      if (recognizedIds.has(studentId)) {
        console.log('Student already marked present:', studentId);
        return;
      }
      
      // Find student in attendance list
      const student = attendance.find(s => s.student_id === studentId);
      
      if (!student) {
        console.log(`Student ${studentId} not enrolled in this class`);
        return;
      }
      
      console.log('Recording attendance for:', student.name, '(DB ID:', student.id, ')');
      
      // Record attendance with student's database ID
      await api.post('/attendance/record', {
        class_id: classInfo.id,
        student_id: student.id,  // Use database ID from the student record
        session_date: sessionDate,
        ...(scheduleId ? { session_id: scheduleId } : {}),
        method: 'face',
        confidence: match.confidence || 0.95
      });
      
      setRecognizedIds(prev => new Set([...prev, studentId]));
      await fetchTodayAttendance(classInfo.id, sessionDate);
      console.log(`Attendance recorded for ${student.name}`);
      
      // Show success notification
      showNotification(`${student.name} marked present!`, 'success');
      
    } catch (error) {
      console.error('Face recognition error:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Failed to record attendance';
      showNotification(`Face recognition error: ${errorMsg}`, 'error');
    }
  };

  const handleManualMark = async (student) => {
    try {
      console.log('Manual marking attendance for:', student);
      
      if (!student || !student.id) {
        alert('Invalid student data');
        return;
      }
      
      // Check if already present
      if (recognizedIds.has(student.student_id)) {
        alert(`${student.name} is already marked present!`);
        return;
      }
      
      // Confirm action
      const confirmed = window.confirm(`Mark ${student.name} (${student.student_id}) as present?`);
      if (!confirmed) return;
      
      console.log('Recording manual attendance - Student DB ID:', student.id, 'Class ID:', classInfo.id);
      
      // Record attendance using the database ID
      await api.post('/attendance/record', {
        class_id: classInfo.id,
        student_id: student.id,  // IMPORTANT: Use database ID (integer), not student_id string
        session_date: sessionDate,
        ...(scheduleId ? { session_id: scheduleId } : {}),
        method: 'manual',
        confidence: 1.0
      });
      
      setRecognizedIds(prev => new Set([...prev, student.student_id]));
      await fetchTodayAttendance(classInfo.id, sessionDate);
      showNotification(`${student.name} marked present`, 'success');
      
    } catch (error) {
      console.error('Manual marking error:', error);
      console.error('Error details:', {
        response: error.response?.data,
        status: error.response?.status,
        message: error.message
      });
      const errorMsg = error.response?.data?.error || error.message || 'Failed to record attendance';
      alert(`Error: ${errorMsg}`);
    }
  };

  const showNotification = (message, type = 'success') => {
    const notification = document.createElement('div');
    const bgColor = type === 'success' ? '#28a745' : '#dc3545';
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${bgColor};
      color: white;
      padding: 15px 25px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      z-index: 9999;
      font-weight: 600;
      animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
  };

  const getStudentPhotoUrl = (photoUrl) => {
    if (!photoUrl) return null;
    
    // If it's already a full URL, return as is
    if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://')) {
      return photoUrl;
    }
    
    // If it starts with /uploads/, return as is
    if (photoUrl.startsWith('/uploads/')) {
      return photoUrl;
    }
    
    // If it's just a filename or relative path, prepend /uploads/
    if (!photoUrl.startsWith('/')) {
      return `/uploads/${photoUrl}`;
    }
    
    return photoUrl;
  };

  if (loading || !classInfo) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner}></div>
        <p>Loading attendance session...</p>
      </div>
    );
  }

  if (error && scheduleId) {
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
        <button onClick={() => navigate(`/class/${classInfo.id}`)} style={styles.backBtn}>
          Back to Class
        </button>
      </div>
    );
  }

  const presentCount = attendance.filter(s => s.present).length;
  const totalCount = attendance.length;

  // Show mode selection if no mode is selected
  if (!mode) {
    return (
      <div style={styles.container}>
        <button onClick={() => navigate(`/class/${classInfo.id}`)} style={styles.backBtn}>
          Back to Class
        </button>

        <header style={styles.header}>
          <div>
            <h1>Take Attendance</h1>
            <p style={styles.headerText}>{classInfo.code} - {classInfo.name}</p>
            {scheduleInfo && (
              <p style={styles.headerText}>
                {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][scheduleInfo.day_of_week]} | 
                {scheduleInfo.start_time} - {scheduleInfo.end_time} | 
                {scheduleInfo.room_number && ` Room ${scheduleInfo.room_number}`}
              </p>
            )}
            <p style={styles.headerText}>
              Date: {new Date(sessionDate).toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
            {scheduleId && (
              <p style={{
                ...styles.headerText,
                color: isActive ? '#28a745' : '#dc3545',
                fontWeight: 'bold'
              }}>
                Status: {isActive ? 'Active' : 'Inactive'}
              </p>
            )}
          </div>
          <div style={styles.stats}>
            <div style={styles.statBox}>
              <div style={styles.statNum}>{presentCount}/{totalCount}</div>
              <div style={styles.statLabel}>Present</div>
            </div>
            <div style={styles.statBox}>
              <div style={styles.statNum}>
                {totalCount > 0 ? Math.round((presentCount/totalCount)*100) : 0}%
              </div>
              <div style={styles.statLabel}>Attendance</div>
            </div>
          </div>
        </header>

        {/* Mode Selection */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
          gap: '20px', 
          marginTop: '40px' 
        }}>
          <div 
            onClick={() => setMode('face')}
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              padding: '40px 30px',
              borderRadius: '15px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'transform 0.3s, box-shadow 0.3s',
              boxShadow: '0 10px 30px rgba(102, 126, 234, 0.3)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-5px)';
              e.currentTarget.style.boxShadow = '0 15px 40px rgba(102, 126, 234, 0.4)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 10px 30px rgba(102, 126, 234, 0.3)';
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '15px' }}>Face Recognition</div>
            <div style={{ fontSize: '16px', opacity: 0.9 }}>Use camera to recognize faces</div>
          </div>

          <div 
            onClick={() => setMode('qr')}
            style={{
              background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
              color: 'white',
              padding: '40px 30px',
              borderRadius: '15px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'transform 0.3s, box-shadow 0.3s',
              boxShadow: '0 10px 30px rgba(240, 147, 251, 0.3)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-5px)';
              e.currentTarget.style.boxShadow = '0 15px 40px rgba(240, 147, 251, 0.4)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 10px 30px rgba(240, 147, 251, 0.3)';
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '15px' }}>QR Code</div>
            <div style={{ fontSize: '16px', opacity: 0.9 }}>Scan QR codes for attendance</div>
          </div>

          <div 
            onClick={() => setMode('manual')}
            style={{
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              color: 'white',
              padding: '40px 30px',
              borderRadius: '15px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'transform 0.3s, box-shadow 0.3s',
              boxShadow: '0 10px 30px rgba(79, 172, 254, 0.3)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-5px)';
              e.currentTarget.style.boxShadow = '0 15px 40px rgba(79, 172, 254, 0.4)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 10px 30px rgba(79, 172, 254, 0.3)';
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '15px' }}>Manual</div>
            <div style={{ fontSize: '16px', opacity: 0.9 }}>Mark attendance manually</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <button onClick={() => navigate(`/class/${classInfo.id}`)} style={styles.backBtn}>
        Back to Class
      </button>

      <header style={styles.header}>
        <div>
          <h1>Take Attendance</h1>
          <p style={styles.headerText}>{classInfo.code} - {classInfo.name}</p>
          {scheduleInfo && (
            <p style={styles.headerText}>
              {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][scheduleInfo.day_of_week]} | 
              {scheduleInfo.start_time} - {scheduleInfo.end_time} | 
              {scheduleInfo.room_number && ` Room ${scheduleInfo.room_number}`}
            </p>
          )}
          <p style={styles.headerText}>
            Date: {new Date(sessionDate).toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
          {scheduleId && (
            <p style={{
              ...styles.headerText,
              color: isActive ? '#28a745' : '#dc3545',
              fontWeight: 'bold'
            }}>
              Status: {isActive ? 'Active' : 'Inactive'}
            </p>
          )}
        </div>
        <div style={styles.stats}>
          <div style={styles.statBox}>
            <div style={styles.statNum}>{presentCount}/{totalCount}</div>
            <div style={styles.statLabel}>Present</div>
          </div>
          <div style={styles.statBox}>
            <div style={styles.statNum}>
              {totalCount > 0 ? Math.round((presentCount/totalCount)*100) : 0}%
            </div>
            <div style={styles.statLabel}>Attendance</div>
          </div>
          {scheduleId && (
            <div style={styles.statBox}>
              <div style={styles.statNum}>
                {moment().format('h:mm A')}
              </div>
              <div style={styles.statLabel}>Current Time</div>
            </div>
          )}
        </div>
      </header>

      {/* Mode Selector */}
      <div style={styles.modeSelector}>
        <button 
          onClick={() => setMode('face')} 
          style={{
            ...styles.modeBtn,
            background: mode === 'face' ? '#667eea' : '#e9ecef',
            color: mode === 'face' ? 'white' : '#333',
            transform: mode === 'face' ? 'scale(1.02)' : 'scale(1)'
          }}
        >
          Face Recognition
        </button>
        <button 
          onClick={() => setMode('qr')} 
          style={{
            ...styles.modeBtn,
            background: mode === 'qr' ? '#667eea' : '#e9ecef',
            color: mode === 'qr' ? 'white' : '#333',
            transform: mode === 'qr' ? 'scale(1.02)' : 'scale(1)'
          }}
        >
          QR Code Scanner
        </button>
        <button 
          onClick={() => setMode('manual')} 
          style={{
            ...styles.modeBtn,
            background: mode === 'manual' ? '#667eea' : '#e9ecef',
            color: mode === 'manual' ? 'white' : '#333',
            transform: mode === 'manual' ? 'scale(1.02)' : 'scale(1)'
          }}
        >
          Manual Attendance
        </button>
      </div>

      {/* Scanner Section */}
      <div style={styles.scannerSection}>
        <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#333' }}>
          {mode === 'face' ? 'Face Recognition Active' : mode === 'qr' ? 'QR Code Scanner Active' : 'Manual Attendance Active'}
        </h3>
        {mode === 'face' ? (
          <CameraCapture 
            classId={classInfo.id}
            sessionDate={sessionDate}
            sessionId={scheduleId}
            onRecognized={handleFaceRecognized}
            onError={(err) => {
              console.error('Camera error:', err);
              alert(err);
            }}
          />
        ) : mode === 'qr' ? (
          <QRScanner 
            onScan={handleQRScan}
            onError={(err) => {
              console.error('QR Scanner error:', err);
            }}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p style={{ fontSize: '18px', color: '#666', marginBottom: '20px' }}>
              Click "Mark Present" buttons in the student list below to record attendance manually.
            </p>
          </div>
        )}
      </div>

      {/* Attendance List */}
      <div style={styles.listSection}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2 style={{ margin: 0 }}>Student List</h2>
          <button 
            onClick={() => fetchTodayAttendance(classInfo.id)}
            style={styles.refreshBtn}
          >
            Refresh
          </button>
        </div>
        
        {attendance.length === 0 ? (
          <div style={styles.emptyState}>
            <p>No students enrolled in this class.</p>
            <button 
              onClick={() => navigate(`/class/${classInfo.id}`)}
              style={styles.enrollButton}
            >
              Go to Class Page to Enroll Students
            </button>
          </div>
        ) : (
          <div style={styles.studentList}>
            {attendance.map(student => (
              <div 
                key={student.id} 
                style={{
                  ...styles.studentItem,
                  background: student.present ? '#d4edda' : '#f8f9fa',
                  borderLeft: student.present ? '4px solid #28a745' : '4px solid transparent'
                }}
              >
                <div style={styles.studentInfo}>
                  {student.photo_url ? (
                    <img 
                      src={getStudentPhotoUrl(student.photo_url)}
                      alt={student.name}
                      style={styles.photo}
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div style={styles.photoPlaceholder}>
                      {student.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <strong style={{ fontSize: '16px' }}>{student.name}</strong>
                    <br />
                    <small style={{ color: '#666' }}>{student.student_id}</small>
                    {student.present && student.method && (
                      <span style={styles.methodBadge}>
                        {student.method === 'face' && 'Face'} 
                        {student.method === 'qr' && 'QR'} 
                        {student.method === 'manual' && 'Manual'}
                        {student.confidence && ` (${Math.round(student.confidence * 100)}%)`}
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  {student.present ? (
                    <span style={styles.presentBadge}>Present</span>
                  ) : (
                    <>
                      <span style={styles.absentBadge}>Absent</span>
                      <button 
                        onClick={() => handleManualMark(student)}
                        style={styles.markBtn}
                      >
                        Mark Present
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { 
    padding: '20px', 
    maxWidth: '1400px', 
    margin: '0 auto',
    minHeight: '100vh',
    backgroundColor: '#f5f5f5'
  },
  loading: { 
    textAlign: 'center', 
    padding: '50px', 
    fontSize: '18px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '15px'
  },
  spinner: {
    border: '4px solid #f3f3f3',
    borderTop: '4px solid #667eea',
    borderRadius: '50%',
    width: '40px',
    height: '40px',
    animation: 'spin 1s linear infinite'
  },
  backBtn: { 
    padding: '10px 20px', 
    background: '#6c757d', 
    color: 'white', 
    border: 'none', 
    borderRadius: '6px', 
    cursor: 'pointer', 
    marginBottom: '20px',
    fontWeight: '600',
    transition: 'background 0.3s'
  },
  header: { 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
    color: 'white', 
    padding: '25px', 
    borderRadius: '8px', 
    marginBottom: '20px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
    flexWrap: 'wrap',
    gap: '20px'
  },
  headerText: {
    margin: '5px 0',
    opacity: 0.95
  },
  stats: { 
    display: 'flex', 
    gap: '20px',
    flexWrap: 'wrap'
  },
  statBox: { 
    background: 'rgba(255,255,255,0.2)', 
    padding: '15px 25px', 
    borderRadius: '8px', 
    textAlign: 'center',
    minWidth: '100px'
  },
  statNum: { 
    fontSize: '28px', 
    fontWeight: 'bold', 
    marginBottom: '5px' 
  },
  statLabel: {
    fontSize: '14px',
    opacity: 0.9
  },
  modeSelector: { 
    display: 'flex', 
    gap: '10px', 
    marginBottom: '20px',
    flexWrap: 'wrap'
  },
  modeBtn: { 
    flex: 1, 
    minWidth: '200px',
    padding: '15px', 
    border: 'none', 
    borderRadius: '8px', 
    cursor: 'pointer', 
    fontSize: '16px', 
    fontWeight: '600', 
    transition: 'all 0.3s',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  scannerSection: { 
    background: 'white', 
    padding: '25px', 
    borderRadius: '8px', 
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)', 
    marginBottom: '20px' 
  },
  listSection: { 
    background: 'white', 
    padding: '25px', 
    borderRadius: '8px', 
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)' 
  },
  refreshBtn: {
    padding: '8px 16px',
    background: '#17a2b8',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'background 0.3s'
  },
  studentList: { 
    display: 'flex', 
    flexDirection: 'column', 
    gap: '10px', 
    maxHeight: '500px', 
    overflowY: 'auto',
    paddingRight: '5px'
  },
  studentItem: { 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: '15px', 
    borderRadius: '6px', 
    transition: 'transform 0.2s, box-shadow 0.2s',
    border: '1px solid #e9ecef'
  },
  studentInfo: { 
    display: 'flex', 
    alignItems: 'center', 
    gap: '15px',
    flex: 1
  },
  photo: { 
    width: '50px', 
    height: '50px', 
    borderRadius: '50%', 
    objectFit: 'cover',
    border: '2px solid #667eea'
  },
  photoPlaceholder: {
    width: '50px',
    height: '50px',
    borderRadius: '50%',
    background: '#667eea',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    fontWeight: 'bold'
  },
  methodBadge: {
    display: 'inline-block',
    padding: '4px 8px',
    background: '#28a745',
    color: 'white',
    borderRadius: '4px',
    fontSize: '12px',
    marginLeft: '8px'
  },
  presentBadge: {
    padding: '8px 16px',
    background: '#28a745',
    color: 'white',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600'
  },
  absentBadge: {
    padding: '8px 16px',
    background: '#dc3545',
    color: 'white',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    marginRight: '8px'
  },
  markBtn: {
    padding: '8px 16px',
    background: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'background 0.3s'
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px',
    color: '#666'
  },
  enrollButton: {
    padding: '10px 20px',
    background: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    marginTop: '15px'
  }
};
