import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';

const getStudentPhotoUrl = (photoUrl) => {
  if (!photoUrl) return null;
  if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://')) return photoUrl;
  if (photoUrl.startsWith('/uploads/')) return photoUrl;
  return `/uploads/${photoUrl}`;
};

export default function Dashboard({ user, onLogout }) {
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [smartSchedule, setSmartSchedule] = useState({ ongoing: [], upcoming: [] });
  const [loading, setLoading] = useState(true);
  const [showAddClass, setShowAddClass] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showQRCodes, setShowQRCodes] = useState(false);
  const navigate = useNavigate();

  // FORCE API CALLS ON COMPONENT MOUNT
  useEffect(() => {
    console.log('Dashboard: Component mounted, forcing API calls');
    loadData();
    const timer = setInterval(loadData, 30000);
    return () => clearInterval(timer);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch classes from backend
      console.log('Dashboard: Fetching classes from backend...');
      const classesResponse = await api.get('/classes');
      console.log('Dashboard: Classes data received:', classesResponse.data);
      setClasses(classesResponse.data || []);

      // Fetch students from backend
      console.log('Dashboard: Fetching students from backend...');
      const studentsResponse = await api.get('/students');
      console.log('Dashboard: Students data received:', studentsResponse.data);
      setStudents(studentsResponse.data || []);

      const scheduleResponse = await api.get('/schedule');
      setSmartSchedule({
        ongoing: scheduleResponse.data?.ongoing || [],
        upcoming: scheduleResponse.data?.upcoming || []
      });

    } catch (error) {
      console.error('Dashboard: Error loading data:', error);
      // Still try to show what we can
    } finally {
      setLoading(false);
    }
  };

  const handleAddClass = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    try {
      await api.post('/classes', {
        code: formData.get('code'),
        name: formData.get('name'),
        instructor_id: user.id
      });
      setShowAddClass(false);
      e.target.reset();
      loadData(); // Refresh data
      alert('Class added successfully!');
    } catch (error) {
      alert('Error: ' + (error.response?.data?.error || 'Failed to add class'));
    }
  };

  const handleAddStudent = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    try {
      const response = await api.post('/students', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setShowAddStudent(false);
      e.target.reset();
      loadData(); // Refresh data
      
      if (response.data.student.face_enrolled) {
        alert('Student added and face enrolled successfully!');
      } else {
        alert('Student added! Note: Face enrollment failed - check if photo is clear.');
      }
    } catch (error) {
      alert('Error: ' + (error.response?.data?.error || 'Failed to add student'));
    }
  };

  const handleDeleteStudent = async (studentId, studentName) => {
    if (!window.confirm(`Are you sure you want to delete ${studentName}? This action cannot be undone.`)) {
      return;
    }
    
    try {
      await api.delete(`/students/${studentId}`);
      loadData(); // Refresh data
      alert('Student deleted successfully!');
    } catch (error) {
      alert('Error: ' + (error.response?.data?.error || 'Failed to delete student'));
    }
  };

  const downloadQR = (studentId) => {
    const svg = document.getElementById(`qr-${studentId}`);
    
    if (!svg) return;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${studentId}-QRCode.png`;
      link.href = url;
      link.click();
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const formatCountdown = (isoString) => {
    const diffMs = new Date(isoString).getTime() - Date.now();
    const totalMinutes = Math.floor(diffMs / 60000);
    if (totalMinutes <= 0) return 'Starting now';
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours > 0 ? `Starts in ${hours}h ${minutes}m` : `Starts in ${minutes}m`;
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1>Attendance Dashboard</h1>
        <div>
          <span style={styles.username}>Welcome, {user.username}!</span>
          <button onClick={onLogout} style={styles.logoutBtn}>Logout</button>
        </div>
      </header>

      {/* Loading Indicator */}
      {loading && (
        <div style={styles.loadingContainer}>
          <div style={styles.loadingSpinner}></div>
          <p style={styles.loadingText}>Loading data from backend...</p>
        </div>
      )}

      <div style={styles.smartPanel}>
        <div style={styles.smartHeaderRow}>
          <h2 style={styles.smartTitle}>Smart Class View</h2>
          <button style={styles.timetableBtn} onClick={() => navigate('/timetable')}>
            Open Full Timetable
          </button>
        </div>

        <div style={styles.smartSection}>
          <h3 style={styles.smartSectionTitle}>Ongoing Class</h3>
          {smartSchedule.ongoing.length === 0 ? (
            <p style={styles.emptyState}>No class right now</p>
          ) : (
            smartSchedule.ongoing.map((session) => (
              <div key={`ongoing-${session.id}`} style={styles.ongoingCard}>
                <div>
                  <strong>{session.course_name}</strong>
                  <div style={styles.smartMeta}>
                    {session.start_time} - {session.end_time} | {session.day_name}
                  </div>
                </div>
                <button
                  style={styles.joinBtn}
                  onClick={() => navigate(`/attendance/${session.id}`, { state: { classId: session.class_id, session } })}
                >
                  Join / Take Attendance
                </button>
              </div>
            ))
          )}
        </div>

        <div style={styles.smartSection}>
          <h3 style={styles.smartSectionTitle}>Upcoming Classes</h3>
          {smartSchedule.upcoming.length === 0 ? (
            <p style={styles.emptyState}>No upcoming classes</p>
          ) : (
            smartSchedule.upcoming.slice(0, 5).map((session) => (
              <div key={`upcoming-${session.id}`} style={styles.upcomingCard}>
                <div>
                  <strong>{session.course_name}</strong>
                  <div style={styles.smartMeta}>
                    {session.day_name} | {session.session_date} | {session.start_time} - {session.end_time}
                  </div>
                </div>
                <div style={styles.countdownText}>
                  {formatCountdown(session.start_at)}
                  {new Date(session.start_at).getTime() - Date.now() <= 10 * 60000 &&
                    new Date(session.start_at).getTime() > Date.now() && ' • Starting in 10 mins'}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={styles.grid}>
        {/* Classes Section */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2>Classes ({classes.length})</h2>
            <button onClick={() => setShowAddClass(!showAddClass)} style={styles.addBtn}>
              + Add Class
            </button>
          </div>

          {showAddClass && (
            <form onSubmit={handleAddClass} style={styles.form}>
              <input name="code" placeholder="Class Code (e.g., CS101)" required style={styles.input} />
              <input name="name" placeholder="Class Name" required style={styles.input} />
              <button type="submit" style={styles.submitBtn}>Create Class</button>
            </form>
          )}

          <div style={styles.list}>
            {classes.map(cls => (
              <div 
                key={cls.id} 
                style={styles.card}
                onClick={() => navigate(`/class/${cls.id}`)}
              >
                <h3>{cls.code}</h3>
                <p>{cls.name}</p>
                <small>{cls.student_count || 0} students</small>
              </div>
            ))}
            {classes.length === 0 && (
              <p style={styles.emptyState}>No classes yet. Click "Add Class" to create one.</p>
            )}
          </div>
        </div>

        {/* Students Section */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2>Students ({students.length})</h2>
            <div>
              {students.length > 0 && (
                <button 
                  onClick={() => setShowQRCodes(!showQRCodes)} 
                  style={styles.qrBtn}
                >
                  {showQRCodes ? '📋 Hide QR Codes' : '📱 Generate QR Codes'}
                </button>
              )}
              <button 
                onClick={() => setShowAddStudent(!showAddStudent)} 
                style={styles.addBtn}
              >
                + Add Student
              </button>
            </div>
          </div>

          {showAddStudent && (
            <form onSubmit={handleAddStudent} style={styles.form}>
              <input 
                name="student_id" 
                placeholder="Student ID (e.g., STU001)" 
                required 
                style={styles.input} 
              />
              <input 
                name="name" 
                placeholder="Full Name" 
                required 
                style={styles.input} 
              />
              <input 
                name="email" 
                type="email" 
                placeholder="Email (optional)" 
                style={styles.input} 
              />
              <div style={styles.fileInputWrapper}>
                <label style={styles.fileLabel}>
                  📷 Upload Student Photo (clear face photo for recognition)
                </label>
                <input 
                  name="photo" 
                  type="file" 
                  accept="image/*" 
                  required 
                  style={styles.input} 
                />
              </div>
              <button type="submit" style={styles.submitBtn}>Add Student</button>
              <p style={styles.hint}>
                💡 Photo tips: Clear face, good lighting, look at camera
              </p>
            </form>
          )}

          {/* QR Codes Section */}
          {showQRCodes && (
            <div style={styles.qrSection}>
              <h3 style={styles.qrTitle}>📱 Student QR Codes</h3>
              <p style={styles.qrInstruction}>
                Download and print these QR codes. Students can scan them for quick attendance.
              </p>
              <div style={styles.qrGrid}>
                {students.map(student => (
                  <div key={student.id} style={styles.qrCard}>
                    <h4>{student.name}</h4>
                    <p style={styles.studentId}>ID: {student.student_id}</p>
                    
                    <div style={styles.qrCodeWrapper}>
                      <QRCodeSVG
                        id={`qr-${student.student_id}`}
                        value={student.student_id}
                        size={150}
                        level="H"
                        includeMargin={true}
                      />
                    </div>
                    
                    <button 
                      onClick={() => downloadQR(student.student_id)}
                      style={styles.downloadBtn}
                    >
                      ⬇ Download QR
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Students List */}
          {!showQRCodes && (
            <div style={styles.list}>
              {students.map(student => (
                <div key={student.id} style={styles.studentCard}>
                  {student.photo_url && (
                    <img 
                      src={getStudentPhotoUrl(student.photo_url)} 
                      alt={student.name}
                      style={styles.photo}
                      onError={(e) => e.target.style.display = 'none'}
                    />
                  )}
                  <div style={styles.studentInfo}>
                    <strong>{student.name}</strong>
                    <br />
                    <small style={styles.studentId}>ID: {student.student_id}</small>
                    {student.email && (
                      <>
                        <br />
                        <small style={styles.email}>📧 {student.email}</small>
                      </>
                    )}
                  </div>
                  <button 
                    onClick={() => handleDeleteStudent(student.id, student.name)}
                    style={styles.deleteBtn}
                    title="Delete student"
                  >
                    🗑️ Delete
                  </button>
                </div>
              ))}
              {students.length === 0 && (
                <p style={styles.emptyState}>
                  No students yet. Click "Add Student" to register students.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { 
    padding: '20px', 
    maxWidth: '1200px', 
    margin: '0 auto',
    minHeight: '100vh',
    backgroundColor: '#f5f5f5'
  },
  header: { 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: '30px', 
    padding: '20px', 
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
    color: 'white', 
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
  },
  username: { 
    marginRight: '15px', 
    fontWeight: '600' 
  },
  logoutBtn: { 
    padding: '8px 16px', 
    background: 'white', 
    color: '#667eea', 
    border: 'none', 
    borderRadius: '6px', 
    cursor: 'pointer', 
    fontWeight: '600',
    transition: 'transform 0.2s'
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
    background: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    marginBottom: '20px'
  },
  loadingSpinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #f3f3f3',
    borderTop: '4px solid #667eea',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: '15px'
  },
  loadingText: {
    color: '#666',
    fontSize: '16px',
    margin: 0
  },
  smartPanel: {
    background: 'white',
    borderRadius: '10px',
    padding: '20px',
    marginBottom: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
  },
  smartHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap'
  },
  smartTitle: {
    margin: 0
  },
  timetableBtn: {
    padding: '8px 14px',
    border: '1px solid #3b82f6',
    borderRadius: '8px',
    background: '#eff6ff',
    color: '#1d4ed8',
    cursor: 'pointer',
    fontWeight: '600'
  },
  smartSection: {
    marginTop: '16px'
  },
  smartSectionTitle: {
    margin: '0 0 10px 0',
    fontSize: '18px'
  },
  ongoingCard: {
    background: '#ecfdf3',
    borderLeft: '4px solid #22c55e',
    borderRadius: '8px',
    padding: '12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px'
  },
  upcomingCard: {
    background: '#eff6ff',
    borderLeft: '4px solid #3b82f6',
    borderRadius: '8px',
    padding: '12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '8px'
  },
  joinBtn: {
    background: '#166534',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    padding: '8px 12px',
    cursor: 'pointer',
    fontWeight: '600'
  },
  smartMeta: {
    color: '#4b5563',
    fontSize: '13px',
    marginTop: '4px'
  },
  countdownText: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#1d4ed8'
  },
  grid: { 
    display: 'grid', 
    gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', 
    gap: '20px' 
  },
  section: { 
    background: 'white', 
    padding: '20px', 
    borderRadius: '8px', 
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)' 
  },
  sectionHeader: { 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: '15px',
    flexWrap: 'wrap',
    gap: '10px'
  },
  addBtn: { 
    padding: '8px 16px', 
    background: '#28a745', 
    color: 'white', 
    border: 'none', 
    borderRadius: '6px', 
    cursor: 'pointer',
    fontWeight: '600',
    transition: 'background 0.3s'
  },
  qrBtn: {
    padding: '8px 16px',
    background: '#17a2b8',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '600',
    marginRight: '10px',
    transition: 'background 0.3s'
  },
  form: { 
    background: '#f8f9fa', 
    padding: '15px', 
    borderRadius: '6px', 
    marginBottom: '15px', 
    display: 'flex', 
    flexDirection: 'column', 
    gap: '10px' 
  },
  input: { 
    padding: '10px', 
    borderRadius: '4px', 
    border: '1px solid #ddd', 
    fontSize: '14px',
    outline: 'none',
    transition: 'border 0.3s'
  },
  fileInputWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px'
  },
  fileLabel: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#333'
  },
  submitBtn: { 
    padding: '10px', 
    background: '#007bff', 
    color: 'white', 
    border: 'none', 
    borderRadius: '6px', 
    cursor: 'pointer', 
    fontWeight: '600',
    transition: 'background 0.3s'
  },
  hint: {
    fontSize: '12px',
    color: '#666',
    margin: '0',
    fontStyle: 'italic'
  },
  list: { 
    display: 'flex', 
    flexDirection: 'column', 
    gap: '10px', 
    maxHeight: '400px', 
    overflowY: 'auto' 
  },
  card: { 
    padding: '15px', 
    background: '#f8f9fa', 
    borderRadius: '6px', 
    cursor: 'pointer', 
    transition: 'transform 0.2s, box-shadow 0.2s'
  },
  studentCard: { 
    display: 'flex', 
    alignItems: 'center', 
    gap: '15px', 
    padding: '12px', 
    background: '#f8f9fa', 
    borderRadius: '6px',
    transition: 'background 0.3s'
  },
  studentInfo: {
    flex: 1
  },
  photo: { 
    width: '50px', 
    height: '50px', 
    borderRadius: '50%', 
    objectFit: 'cover',
    border: '2px solid #667eea'
  },
  studentId: {
    color: '#666',
    fontSize: '13px'
  },
  email: {
    color: '#888',
    fontSize: '12px'
  },
  emptyState: {
    textAlign: 'center',
    color: '#999',
    padding: '20px',
    fontStyle: 'italic'
  },
  qrSection: {
    marginTop: '20px',
    padding: '20px',
    background: '#f0f8ff',
    borderRadius: '8px',
    border: '2px dashed #17a2b8'
  },
  qrTitle: {
    color: '#17a2b8',
    marginBottom: '10px'
  },
  qrInstruction: {
    fontSize: '14px',
    color: '#666',
    marginBottom: '20px'
  },
  qrGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '20px'
  },
  qrCard: {
    textAlign: 'center',
    padding: '15px',
    background: 'white',
    borderRadius: '8px',
    border: '1px solid #ddd',
    boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
  },
  qrCodeWrapper: {
    display: 'flex',
    justifyContent: 'center',
    margin: '15px 0'
  },
  downloadBtn: {
    width: '100%',
    padding: '8px',
    background: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'background 0.3s'
  },
  deleteBtn: {
    padding: '6px 12px',
    background: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'background 0.3s'
  }
};