import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import QRScanner from '../components/QRScanner';
import CameraCapture from '../components/CameraCapture';

export default function AttendancePage() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const [mode, setMode] = useState('face'); // 'face' or 'qr'
  const [classInfo, setClassInfo] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [sessionDate] = useState(new Date().toISOString().split('T')[0]);
  const [recognizedIds, setRecognizedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  
  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:4000';

  useEffect(() => {
    fetchClassInfo();
    fetchTodayAttendance();
  }, [classId]);

  const fetchClassInfo = async () => {
    try {
      const response = await axios.get(`${apiUrl}/api/classes/${classId}`);
      setClassInfo(response.data);
    } catch (error) {
      console.error('Error fetching class:', error);
      alert('Failed to load class information');
    }
  };

  const fetchTodayAttendance = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${apiUrl}/api/attendance/class/${classId}/date/${sessionDate}`
      );
      setAttendance(response.data);
      
      // Track already present students using their student_id (STU001, etc.)
      const presentIds = new Set(
        response.data.filter(s => s.present).map(s => s.student_id)
      );
      setRecognizedIds(presentIds);
      console.log('✓ Loaded attendance:', response.data.length, 'students');
      console.log('✓ Already present:', presentIds.size, 'students');
    } catch (error) {
      console.error('Error fetching attendance:', error);
      alert('Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  };

  const handleQRScan = async (decodedText) => {
    try {
      console.log('📱 QR Code scanned:', decodedText);
      
      // Extract student ID
      let studentId = decodedText.trim();
      
      // Handle URL-based QR codes
      if (studentId.includes('http') || studentId.includes('://')) {
        const match = studentId.match(/STU\d+/i);
        if (match) {
          studentId = match[0].toUpperCase();
        } else {
          alert('⚠️ QR code should contain student ID (format: STU001)');
          return;
        }
      }
      
      // Convert to uppercase
      studentId = studentId.toUpperCase();
      
      // Validate format (STU followed by digits)
      if (!studentId.match(/^STU\d+$/i)) {
        alert(`⚠️ Invalid student ID format: ${studentId}\nExpected format: STU001`);
        return;
      }
      
      console.log('🔍 Looking for student ID:', studentId);
      
      // Check if already present
      if (recognizedIds.has(studentId)) {
        alert(`✓ Student ${studentId} already marked present!`);
        return;
      }

      // Find student in attendance list
      const student = attendance.find(s => s.student_id === studentId);
      
      if (!student) {
        console.error('❌ Student not found in class');
        alert(`⚠️ Student ${studentId} is not enrolled in this class!`);
        return;
      }

      console.log('✓ Found student:', student.name, '(DB ID:', student.id, ')');

      // Record attendance with student's database ID
      await axios.post(`${apiUrl}/api/attendance/record`, {
        class_id: parseInt(classId),
        student_id: student.id,  // Use database ID from the student record
        session_date: sessionDate,
        method: 'qr',
        confidence: 1.0
      });
      
      setRecognizedIds(prev => new Set([...prev, studentId]));
      await fetchTodayAttendance();
      alert(`✓ Attendance recorded for ${student.name} (${studentId})`);
      
    } catch (error) {
      console.error('❌ QR scan error:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Failed to record attendance';
      alert(`Error: ${errorMsg}`);
    }
  };

  const handleFaceRecognized = async (match) => {
    try {
      console.log('👤 Face recognized:', match);
      
      // match should have: { student_id: "STU001", confidence: 0.95 }
      if (!match || !match.student_id) {
        console.error('❌ Invalid match data:', match);
        return;
      }
      
      const studentId = match.student_id.toUpperCase();
      
      // Check if already marked
      if (recognizedIds.has(studentId)) {
        console.log('ℹ️ Student already marked present:', studentId);
        return;
      }
      
      // Find student in attendance list
      const student = attendance.find(s => s.student_id === studentId);
      
      if (!student) {
        console.log(`⚠️ Student ${studentId} not enrolled in this class`);
        return;
      }
      
      console.log('✓ Recording attendance for:', student.name, '(DB ID:', student.id, ')');
      
      // Record attendance with student's database ID
      await axios.post(`${apiUrl}/api/attendance/record`, {
        class_id: parseInt(classId),
        student_id: student.id,  // Use database ID from the student record
        session_date: sessionDate,
        method: 'face',
        confidence: match.confidence || 0.95
      });
      
      setRecognizedIds(prev => new Set([...prev, studentId]));
      await fetchTodayAttendance();
      console.log(`✓ Attendance recorded for ${student.name}`);
      
      // Show success notification
      showNotification(`✓ ${student.name} marked present!`, 'success');
      
    } catch (error) {
      console.error('❌ Face recognition error:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Failed to record attendance';
      showNotification(`Face recognition error: ${errorMsg}`, 'error');
    }
  };

  const handleManualMark = async (student) => {
    try {
      console.log('✋ Manual marking attendance for:', student);
      
      if (!student || !student.id) {
        alert('❌ Invalid student data');
        return;
      }
      
      // Check if already present
      if (recognizedIds.has(student.student_id)) {
        alert(`✓ ${student.name} is already marked present!`);
        return;
      }
      
      // Confirm action
      const confirmed = window.confirm(`Mark ${student.name} (${student.student_id}) as present?`);
      if (!confirmed) return;
      
      console.log('💾 Recording manual attendance - Student DB ID:', student.id, 'Class ID:', classId);
      
      // Record attendance using the database ID
      await axios.post(`${apiUrl}/api/attendance/record`, {
        class_id: parseInt(classId),
        student_id: student.id,  // IMPORTANT: Use database ID (integer), not student_id string
        session_date: sessionDate,
        method: 'manual',
        confidence: 1.0
      });
      
      setRecognizedIds(prev => new Set([...prev, student.student_id]));
      await fetchTodayAttendance();
      showNotification(`✓ ${student.name} marked present`, 'success');
      
    } catch (error) {
      console.error('❌ Manual marking error:', error);
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

  if (loading || !classInfo) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner}></div>
        <p>Loading attendance session...</p>
      </div>
    );
  }

  const presentCount = attendance.filter(s => s.present).length;
  const totalCount = attendance.length;

  return (
    <div style={styles.container}>
      <button onClick={() => navigate(`/class/${classId}`)} style={styles.backBtn}>
        ← Back to Class
      </button>

      <header style={styles.header}>
        <div>
          <h1>📋 Attendance Session</h1>
          <p style={styles.headerText}>{classInfo.code} - {classInfo.name}</p>
          <p style={styles.headerText}>
            📅 {new Date(sessionDate).toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
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
          📷 Face Recognition
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
          📱 QR Code Scanner
        </button>
      </div>

      {/* Scanner Section */}
      <div style={styles.scannerSection}>
        <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#333' }}>
          {mode === 'face' ? '📷 Face Recognition Active' : '📱 QR Code Scanner Active'}
        </h3>
        {mode === 'face' ? (
          <CameraCapture 
            classId={parseInt(classId)}
            sessionDate={sessionDate}
            onRecognized={handleFaceRecognized}
            onError={(err) => {
              console.error('Camera error:', err);
              alert(err);
            }}
          />
        ) : (
          <QRScanner 
            onScan={handleQRScan}
            onError={(err) => {
              console.error('QR Scanner error:', err);
            }}
          />
        )}
      </div>

      {/* Attendance List */}
      <div style={styles.listSection}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2 style={{ margin: 0 }}>👥 Student List</h2>
          <button 
            onClick={fetchTodayAttendance}
            style={styles.refreshBtn}
          >
            🔄 Refresh
          </button>
        </div>
        
        {attendance.length === 0 ? (
          <div style={styles.emptyState}>
            <p>No students enrolled in this class.</p>
            <button 
              onClick={() => navigate(`/class/${classId}`)}
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
                      src={`${apiUrl}/uploads/${student.photo_url}`} 
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
                        {student.method === 'face' && '📷 Face'} 
                        {student.method === 'qr' && '📱 QR'} 
                        {student.method === 'manual' && '✋ Manual'}
                        {student.confidence && ` (${Math.round(student.confidence * 100)}%)`}
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  {student.present ? (
                    <span style={styles.presentBadge}>✓ Present</span>
                  ) : (
                    <button 
                      onClick={() => handleManualMark(student)}
                      style={styles.markBtn}
                    >
                      Mark Present
                    </button>
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
    marginLeft: '10px', 
    fontSize: '12px', 
    color: '#666',
    background: '#e9ecef',
    padding: '2px 8px',
    borderRadius: '4px',
    display: 'inline-block',
    marginTop: '5px'
  },
  presentBadge: { 
    padding: '8px 16px', 
    background: '#28a745', 
    color: 'white', 
    borderRadius: '20px', 
    fontSize: '14px', 
    fontWeight: '600',
    display: 'inline-block'
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
    color: '#999'
  },
  enrollButton: {
    marginTop: '15px',
    padding: '10px 20px',
    background: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600'
  }
};