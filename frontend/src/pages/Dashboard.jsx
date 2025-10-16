import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';

export default function Dashboard({ user, onLogout }) {
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [showAddClass, setShowAddClass] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showQRCodes, setShowQRCodes] = useState(false);
  const navigate = useNavigate();

  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:4000';

  useEffect(() => {
    fetchClasses();
    fetchStudents();
  }, []);

  const fetchClasses = async () => {
    try {
      const response = await axios.get(`${apiUrl}/api/classes`);
      setClasses(response.data);
    } catch (error) {
      console.error('Error fetching classes:', error);
    }
  };

  const fetchStudents = async () => {
    try {
      const response = await axios.get(`${apiUrl}/api/students`);
      setStudents(response.data);
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const handleAddClass = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    try {
      await axios.post(`${apiUrl}/api/classes`, {
        code: formData.get('code'),
        name: formData.get('name'),
        instructor_id: user.id
      });
      setShowAddClass(false);
      e.target.reset();
      fetchClasses();
      alert('✓ Class added successfully!');
    } catch (error) {
      alert('Error: ' + (error.response?.data?.error || 'Failed to add class'));
    }
  };

  const handleAddStudent = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    try {
      const response = await axios.post(`${apiUrl}/api/students`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setShowAddStudent(false);
      e.target.reset();
      fetchStudents();
      
      if (response.data.student.face_enrolled) {
        alert('✓ Student added and face enrolled successfully!');
      } else {
        alert('✓ Student added! Note: Face enrollment failed - check if photo is clear.');
      }
    } catch (error) {
      alert('Error: ' + (error.response?.data?.error || 'Failed to add student'));
    }
  };

  const downloadQR = (studentId) => {
  // Get the SVG element
    const svg = document.getElementById(`qr-${studentId}`);
  
    if (!svg) return;
  
  // Convert SVG to canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
  
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
    
    // Download as PNG
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${studentId}-QRCode.png`;
      link.href = url;
      link.click();
    };
  
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1>📚 Attendance Dashboard</h1>
        <div>
          <span style={styles.username}>Welcome, {user.username}!</span>
          <button onClick={onLogout} style={styles.logoutBtn}>Logout</button>
        </div>
      </header>

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
                    
                    {/* QR Code */}
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
                      src={`${apiUrl}/uploads/${student.photo_url}`} 
                      alt={student.name}
                      style={styles.photo}
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
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
    transition: 'transform 0.2s',
    ':hover': {
      transform: 'scale(1.05)'
    }
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
  
  // QR Code Section Styles
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
  }
};