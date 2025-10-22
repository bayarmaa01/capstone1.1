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
    }
  };

  const fetchTodayAttendance = async () => {
    try {
      const response = await axios.get(
        `${apiUrl}/api/attendance/class/${classId}/date/${sessionDate}`
      );
      setAttendance(response.data);
      
      // Track already present students
      const presentIds = new Set(
        response.data.filter(s => s.present).map(s => s.student_id)
      );
      setRecognizedIds(presentIds);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    }
  };

  const handleQRScan = async (decodedText) => {
    try {
    // Extract student ID
      let studentId = decodedText.trim();
    
    // Handle URL-based QR codes
      if (studentId.includes('http')) {
        const match = studentId.match(/STU\d+/i);
        if (match) {
          studentId = match[0].toUpperCase();
        } else {
          alert('⚠️ QR code should contain student ID');
          return;
        }
      }
    
    // Validate format
      if (!studentId.match(/^STU\d+$/i)) {
        alert('⚠️ Invalid student ID format: ' + studentId);
        return;
      }
    
    // Check if already present
      if (recognizedIds.has(studentId)) {
        alert(`✓ Student ${studentId} already marked present!`);
        return;
      }

    // Find student in attendance list
      const student = attendance.find(s => s.student_id === studentId);
    
      if (!student) {
        alert(`⚠️ Student ${studentId} is not enrolled in this class!`);
        return;
      }

    // Record attendance with student's database ID
      await axios.post(`${apiUrl}/api/attendance/record`, {
        class_id: parseInt(classId),
        student_id: student.id,  // Use database ID
        session_date: sessionDate,
        method: 'qr',
        confidence: 1.0
      });
    
      setRecognizedIds(prev => new Set([...prev, studentId]));
      fetchTodayAttendance();
      alert(`✓ Attendance recorded for ${student.name} (${studentId})`);
    
    } catch (error) {
      console.error('QR scan error:', error);
      alert('Error: ' + (error.response?.data?.error || 'Failed to record attendance'));
    }
  };

  const handleFaceRecognized = async (match) => {
    try {
    // match = { student_id: "STU001", confidence: 0.95 }
    
      if (recognizedIds.has(match.student_id)) {
        return; // Already marked
      }
    
    // Find student in attendance list
      const student = attendance.find(s => s.student_id === match.student_id);
    
      if (!student) {
        console.log(`Student ${match.student_id} not enrolled in this class`);
        return;
      }
    
    // Record attendance
      await axios.post(`${apiUrl}/api/attendance/record`, {
        class_id: parseInt(classId),
        student_id: student.id,  // Use database ID
        session_date: sessionDate,
        method: 'face',
        confidence: match.confidence
      });
    
      setRecognizedIds(prev => new Set([...prev, match.student_id]));
      fetchTodayAttendance();
      console.log(`✓ Attendance recorded for ${student.name}`);
    
    } catch (error) {
      console.error('Face recognition error:', error);
    }
  };

  const handleManualMark = async (studentId, present) => {
    try {
      await axios.post(`${apiUrl}/api/attendance/record`, {
        class_id: classId,
        student_id: studentId,
        session_date: sessionDate,
        method: 'manual',
        confidence: 1.0
      });
      fetchTodayAttendance();
    } catch (error) {
      alert('Error recording attendance');
    }
  };

  if (!classInfo) return <div style={styles.loading}>Loading...</div>;

  const presentCount = attendance.filter(s => s.present).length;
  const totalCount = attendance.length;

  return (
    <div style={styles.container}>
      <button onClick={() => navigate(`/class/${classId}`)} style={styles.backBtn}>
        ← Back to Class
      </button>

      <header style={styles.header}>
        <div>
          <h1>Attendance Session</h1>
          <p>{classInfo.code} - {classInfo.name}</p>
          <p>Date: {new Date(sessionDate).toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}</p>
        </div>
        <div style={styles.stats}>
          <div style={styles.statBox}>
            <div style={styles.statNum}>{presentCount}/{totalCount}</div>
            <div>Present</div>
          </div>
          <div style={styles.statBox}>
            <div style={styles.statNum}>{totalCount > 0 ? Math.round((presentCount/totalCount)*100) : 0}%</div>
            <div>Attendance</div>
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
            color: mode === 'face' ? 'white' : '#333'
          }}
        >
          📷 Face Recognition
        </button>
        <button 
          onClick={() => setMode('qr')} 
          style={{
            ...styles.modeBtn,
            background: mode === 'qr' ? '#667eea' : '#e9ecef',
            color: mode === 'qr' ? 'white' : '#333'
          }}
        >
          📱 QR Code Scanner
        </button>
      </div>

      {/* Scanner Section */}
      <div style={styles.scannerSection}>
        {mode === 'face' ? (
          <CameraCapture 
            classId={classId}
            sessionDate={sessionDate}
            onRecognized={handleFaceRecognized}
            onError={(err) => alert(err)}
          />
        ) : (
          <QRScanner 
            onScan={handleQRScan}
            onError={(err) => console.error(err)}
          />
        )}
      </div>

      {/* Attendance List */}
      <div style={styles.listSection}>
        <h2>Student List</h2>
        <div style={styles.studentList}>
          {attendance.map(student => (
            <div 
              key={student.id} 
              style={{
                ...styles.studentItem,
                background: student.present ? '#d4edda' : '#f8f9fa'
              }}
            >
              <div style={styles.studentInfo}>
                {student.photo_url && (
                  <img 
                    src={`${apiUrl}/uploads/${student.photo_url}`} 
                    alt={student.name}
                    style={styles.photo}
                  />
                )}
                <div>
                  <strong>{student.name}</strong>
                  <br />
                  <small>{student.student_id}</small>
                  {student.present && student.method && (
                    <span style={styles.methodBadge}>
                      {student.method === 'face' && '📷'} 
                      {student.method === 'qr' && '📱'} 
                      {student.method === 'manual' && '✋'}
                      {student.confidence && ` ${Math.round(student.confidence * 100)}%`}
                    </span>
                  )}
                </div>
              </div>
              <div>
                {student.present ? (
                  <span style={styles.presentBadge}>✓ Present</span>
                ) : (
                  <button 
                    onClick={() => handleManualMark(student.student_id, true)}
                    style={styles.markBtn}
                  >
                    Mark Present
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { padding: '20px', maxWidth: '1400px', margin: '0 auto' },
  loading: { textAlign: 'center', padding: '50px', fontSize: '18px' },
  backBtn: { padding: '10px 20px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', marginBottom: '20px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#667eea', color: 'white', padding: '25px', borderRadius: '8px', marginBottom: '20px' },
  stats: { display: 'flex', gap: '20px' },
  statBox: { background: 'rgba(255,255,255,0.2)', padding: '15px 25px', borderRadius: '8px', textAlign: 'center' },
  statNum: { fontSize: '28px', fontWeight: 'bold', marginBottom: '5px' },
  modeSelector: { display: 'flex', gap: '10px', marginBottom: '20px' },
  modeBtn: { flex: 1, padding: '15px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: '600', transition: 'all 0.3s' },
  scannerSection: { background: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', marginBottom: '20px' },
  listSection: { background: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
  studentList: { display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px', maxHeight: '500px', overflowY: 'auto' },
  studentItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', borderRadius: '6px', transition: 'transform 0.2s' },
  studentInfo: { display: 'flex', alignItems: 'center', gap: '15px' },
  photo: { width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover' },
  methodBadge: { marginLeft: '10px', fontSize: '12px', color: '#666' },
  presentBadge: { padding: '6px 12px', background: '#28a745', color: 'white', borderRadius: '12px', fontSize: '14px', fontWeight: '600' },
  markBtn: { padding: '8px 16px', background: '#007bff', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }
};