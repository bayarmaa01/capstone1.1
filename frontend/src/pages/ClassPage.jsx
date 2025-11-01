import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import AttendanceChart from '../components/AttendanceChart';
import ClassSchedule from '../components/ClassSchedule';
import ScheduleCalendar from '../components/ScheduleCalendar';

export default function ClassPage() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const [classInfo, setClassInfo] = useState(null);
  const [students, setStudents] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [stats, setStats] = useState([]);
  const [dates, setDates] = useState([]);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:4000';

  useEffect(() => {
    fetchAllData();
  }, [classId]);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchClassInfo(),
      fetchStudents(),
      fetchAllStudents(),
      fetchStats(),
      fetchDates()
    ]);
    setLoading(false);
  };

  const fetchClassInfo = async () => {
    try {
      const response = await axios.get(`${apiUrl}/api/classes/${classId}`);
      setClassInfo(response.data);
    } catch (error) {
      console.error('Error fetching class:', error);
    }
  };

  const fetchStudents = async () => {
    try {
      const response = await axios.get(`${apiUrl}/api/classes/${classId}/students`);
      setStudents(response.data);
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const fetchAllStudents = async () => {
    try {
      const response = await axios.get(`${apiUrl}/api/students`);
      setAllStudents(response.data);
    } catch (error) {
      console.error('Error fetching all students:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${apiUrl}/api/attendance/class/${classId}/stats`);
      setStats(response.data);
      console.log('📊 Stats loaded:', response.data.length, 'students');
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchDates = async () => {
    try {
      const response = await axios.get(`${apiUrl}/api/attendance/class/${classId}/dates`);
      setDates(response.data);
      console.log('📅 Dates loaded:', response.data.length, 'sessions');
    } catch (error) {
      console.error('Error fetching dates:', error);
    }
  };

  const handleStartAttendance = () => {
    if (students.length === 0) {
      alert('⚠️ Please enroll students in this class first!');
      return;
    }
    navigate(`/attendance/${classId}`);
  };

  const handleEnrollStudent = async (studentId) => {
    try {
      await axios.post(`${apiUrl}/api/classes/${classId}/enroll`, {
        student_id: studentId
      });
      await fetchStudents();
      await fetchStats();
      alert('✓ Student enrolled successfully!');
    } catch (error) {
      alert('Error: ' + (error.response?.data?.error || 'Failed to enroll student'));
    }
  };

  const getUnenrolledStudents = () => {
    const enrolledIds = students.map(s => s.id);
    return allStudents.filter(s => !enrolledIds.includes(s.id));
  };

  if (loading || !classInfo) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner}></div>
        <p>⏳ Loading class information...</p>
      </div>
    );
  }

  const unenrolledStudents = getUnenrolledStudents();

  return (
    <div style={styles.container}>
      <button onClick={() => navigate('/dashboard')} style={styles.backBtn}>
        ← Back to Dashboard
      </button>

      <header style={styles.header}>
        <div>
          <h1>{classInfo.code} - {classInfo.name}</h1>
          <p>Instructor: {classInfo.instructor_name || 'N/A'}</p>
          <p style={styles.enrolledCount}>
            📊 {students.length} student{students.length !== 1 ? 's' : ''} enrolled
          </p>
        </div>
        <div style={styles.headerButtons}>
          <button onClick={() => setShowEnrollModal(!showEnrollModal)} style={styles.enrollBtn}>
            👥 Enroll Students
          </button>
          <button onClick={handleStartAttendance} style={styles.startBtn}>
            ▶ Start Attendance
          </button>
        </div>
      </header>

      {/* Enrollment Modal */}
      {showEnrollModal && (
        <div style={styles.modal} onClick={() => setShowEnrollModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2>Enroll Students in {classInfo.code}</h2>
              <button onClick={() => setShowEnrollModal(false)} style={styles.closeBtn}>
                ✕
              </button>
            </div>
            
            <div style={styles.modalBody}>
              {unenrolledStudents.length === 0 ? (
                <p style={styles.emptyState}>
                  ✓ All students are already enrolled in this class!
                </p>
              ) : (
                <div style={styles.studentsList}>
                  {unenrolledStudents.map(student => (
                    <div key={student.id} style={styles.enrollmentRow}>
                      <div style={styles.studentInfoRow}>
                        {student.photo_url && (
                          <img 
                            src={`${apiUrl}/uploads/${student.photo_url}`}
                            alt={student.name}
                            style={styles.smallPhoto}
                            onError={(e) => e.target.style.display = 'none'}
                          />
                        )}
                        <div>
                          <strong>{student.name}</strong>
                          <br />
                          <small style={styles.studentId}>ID: {student.student_id}</small>
                          {student.email && (
                            <>
                              <br />
                              <small style={styles.email}>{student.email}</small>
                            </>
                          )}
                        </div>
                      </div>
                      <button 
                        onClick={() => handleEnrollStudent(student.id)}
                        style={styles.enrollBtnSmall}
                      >
                        + Enroll
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Statistics Section */}
      <div style={styles.section}>
        <h2>📊 Attendance Statistics</h2>
        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statNumber}>{students.length}</div>
            <div style={styles.statLabel}>Total Students</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statNumber}>{dates.length}</div>
            <div style={styles.statLabel}>Total Sessions</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statNumber}>
              {stats.length > 0 
                ? Math.round(stats.reduce((sum, s) => sum + (s.attendance_percentage || 0), 0) / stats.length) 
                : 0}%
            </div>
            <div style={styles.statLabel}>Average Attendance</div>
          </div>
        </div>
      </div>
      {/* 📅 Class Schedule Section */}
        <div style={styles.section}>
          <h2>📅 Class Schedule</h2>
          <ClassSchedule classId={parseInt(classId)} />
          <ScheduleCalendar classId={classId} />
        </div>

      {/* Enrolled Students */}
      <div style={styles.section}>
        <h2>👥 Enrolled Students</h2>
        {students.length === 0 ? (
          <p style={styles.emptyState}>
            No students enrolled yet. Click "Enroll Students" to add students to this class.
          </p>
        ) : (
          <div style={styles.enrolledGrid}>
            {students.map(student => (
              <div key={student.id} style={styles.enrolledCard}>
                {student.photo_url && (
                  <img 
                    src={`${apiUrl}/uploads/${student.photo_url}`}
                    alt={student.name}
                    style={styles.enrolledPhoto}
                    onError={(e) => e.target.style.display = 'none'}
                  />
                )}
                <div style={styles.enrolledInfo}>
                  <strong>{student.name}</strong>
                  <br />
                  <small style={styles.studentId}>{student.student_id}</small>
                  {student.email && (
                    <>
                      <br />
                      <small style={styles.email}>{student.email}</small>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Statistics and Charts */}
      <AttendanceChart stats={stats} dates={dates} />

      {/* Recent Sessions */}
      <div style={styles.section}>
        <h2>📅 Recent Sessions</h2>
        <div style={styles.sessionsList}>
          {dates.map((date, idx) => (
            <div key={idx} style={styles.sessionCard}>
              <div>
                <strong>{new Date(date.session_date).toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}</strong>
              </div>
              <div style={styles.sessionStats}>
                {date.present_count}/{date.total_students} present
                <span style={{
                  marginLeft: '10px',
                  fontWeight: '600',
                  color: (date.present_count / date.total_students) >= 0.75 ? '#28a745' : '#ffc107'
                }}>
                  ({Math.round((date.present_count / date.total_students) * 100)}%)
                </span>
              </div>
            </div>
          ))}
          {dates.length === 0 && (
            <p style={styles.emptyState}>
              No attendance sessions yet. Click "Start Attendance" to begin!
            </p>
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
  loading: { 
    textAlign: 'center', 
    padding: '50px', 
    fontSize: '18px',
    color: '#667eea',
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
    marginBottom: '30px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    flexWrap: 'wrap',
    gap: '15px'
  },
  enrolledCount: {
    margin: '5px 0 0 0',
    fontSize: '14px',
    opacity: 0.9
  },
  headerButtons: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap'
  },
  enrollBtn: {
    padding: '12px 24px',
    background: '#17a2b8',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '600',
    transition: 'background 0.3s'
  },
  startBtn: { 
    padding: '12px 24px', 
    background: '#28a745', 
    color: 'white', 
    border: 'none', 
    borderRadius: '6px', 
    cursor: 'pointer', 
    fontSize: '16px', 
    fontWeight: '600',
    transition: 'background 0.3s'
  },
  modal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  },
  modalContent: {
    background: 'white',
    borderRadius: '12px',
    maxWidth: '600px',
    width: '90%',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
    borderBottom: '2px solid #e9ecef'
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#666',
    padding: '0',
    width: '30px',
    height: '30px'
  },
  modalBody: {
    padding: '20px',
    overflowY: 'auto',
    flex: 1
  },
  studentsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  enrollmentRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    background: '#f8f9fa',
    borderRadius: '6px',
    border: '1px solid #e9ecef'
  },
  studentInfoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flex: 1
  },
  smallPhoto: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '2px solid #667eea'
  },
  enrollBtnSmall: {
    padding: '6px 16px',
    background: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'background 0.3s'
  },
  section: { 
    background: 'white', 
    padding: '25px', 
    borderRadius: '8px', 
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)', 
    marginBottom: '20px' 
  },
  statsGrid: { 
    display: 'grid', 
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
    gap: '20px', 
    marginTop: '20px' 
  },
  statCard: { 
    background: '#f8f9fa', 
    padding: '20px', 
    borderRadius: '8px', 
    textAlign: 'center',
    border: '2px solid #e9ecef'
  },
  statNumber: { 
    fontSize: '36px', 
    fontWeight: 'bold', 
    color: '#667eea', 
    marginBottom: '8px' 
  },
  statLabel: { 
    fontSize: '14px', 
    color: '#666' 
  },
  enrolledGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
    gap: '15px',
    marginTop: '15px'
  },
  enrolledCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    padding: '15px',
    background: '#f8f9fa',
    borderRadius: '6px',
    border: '1px solid #e9ecef',
    transition: 'transform 0.2s, box-shadow 0.2s'
  },
  enrolledPhoto: {
    width: '50px',
    height: '50px',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '2px solid #667eea'
  },
  enrolledInfo: {
    flex: 1
  },
  sessionsList: { 
    display: 'flex', 
    flexDirection: 'column', 
    gap: '12px', 
    marginTop: '20px' 
  },
  sessionCard: { 
    display: 'flex', 
    justifyContent: 'space-between', 
    padding: '15px', 
    background: '#f8f9fa', 
    borderRadius: '6px',
    border: '1px solid #e9ecef',
    alignItems: 'center'
  },
  sessionStats: { 
    color: '#666',
    fontSize: '14px'
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
    padding: '30px',
    fontStyle: 'italic'
  }
};