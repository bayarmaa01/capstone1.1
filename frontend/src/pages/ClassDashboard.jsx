import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import CameraCapture from '../components/CameraCapture';
import QRScanner from '../components/QRScanner';

export default function ClassDashboard() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const [classInfo, setClassInfo] = useState(null);
  const [students, setStudents] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showStudentProfile, setShowStudentProfile] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [attendanceMode, setAttendanceMode] = useState('face');
  const [selectedSession, setSelectedSession] = useState(null);

  useEffect(() => {
    loadClassData();
  }, [classId]);

  const loadClassData = async () => {
    try {
      setLoading(true);
      
      console.log('Loading class data for classId:', classId);
      
      // Load class information
      console.log('Fetching class info...');
      const classResponse = await api.get(`/classes/${classId}`);
      console.log('Class info response:', classResponse.data);
      setClassInfo(classResponse.data);
      
      // Load students
      console.log('Fetching students...');
      const studentsResponse = await api.get(`/classes/${classId}/students`);
      console.log('Students response:', studentsResponse.data);
      setStudents(studentsResponse.data);
      
      // Load schedule
      console.log('Fetching schedule...');
      const scheduleResponse = await api.get(`/classes/${classId}/schedule`);
      console.log('Schedule response:', scheduleResponse.data);
      setSchedule(scheduleResponse.data);
      
    } catch (error) {
      console.error('Error loading class data:', error);
      console.error('Error details:', error.response?.data);
      console.error('Error status:', error.response?.status);
      
      // Set empty data on error to prevent loading state
      setClassInfo(null);
      setStudents([]);
      setSchedule([]);
    } finally {
      setLoading(false);
    }
  };

  const getAttendanceStatus = (percentage) => {
    if (percentage >= 75) return { status: 'Good', color: '#28a745' };
    return { status: 'At Risk', color: '#dc3545' };
  };

  const handleStudentClick = (student) => {
    setSelectedStudent(student);
    setShowStudentProfile(true);
  };

  const handleTakeAttendance = (session, mode) => {
    setSelectedSession(session);
    setAttendanceMode(mode);
    setShowAttendanceModal(true);
  };

  const isSessionActive = (session) => {
    const now = new Date();
    const sessionDate = new Date(session.session_date || session.scheduled_date);
    const startTime = session.start_time ? new Date(`${sessionDate.toDateString()} ${session.start_time}`) : null;
    const endTime = session.end_time ? new Date(`${sessionDate.toDateString()} ${session.end_time}`) : null;
    
    if (!startTime || !endTime) return false;
    
    const timeDiff = Math.abs(now - startTime);
    const tenMinutes = 10 * 60 * 1000;
    
    return timeDiff <= tenMinutes && now <= endTime;
  };

  const formatDayName = (dayOfWeek) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayOfWeek] || 'Unknown';
  };

  const handleAddStudent = () => {
    // Simple prompt for now - can be enhanced to a modal later
    const studentId = prompt('Enter Student ID:');
    if (studentId) {
      enrollStudent(studentId);
    }
  };

  const enrollStudent = async (studentId) => {
    try {
      await api.post(`/classes/${classId}/enroll`, { student_id: studentId });
      // Refresh student data
      const studentsResponse = await api.get(`/classes/${classId}/students`);
      setStudents(studentsResponse.data);
      
      // Show success notification
      const note = document.createElement('div');
      note.style.cssText = `
        position: fixed; top: 18px; right: 18px; background: linear-gradient(135deg,#28a745 0%,#20c997 100%);
        color: white; padding: 10px 14px; border-radius: 8px; z-index: 99999; font-weight: 700;
      `;
      note.innerHTML = `Student ${studentId} enrolled successfully`;
      document.body.appendChild(note);
      setTimeout(() => note.remove(), 3000);
    } catch (error) {
      console.error('Error enrolling student:', error);
      alert('Error enrolling student. Please check the student ID and try again.');
    }
  };

  const markAttendance = async (studentId, method) => {
    try {
      const sessionDate = selectedSession.scheduled_date || new Date().toISOString().split('T')[0];
      await api.post('/attendance/record', {
        class_id: classId,
        student_id: studentId,
        session_date: sessionDate,
        method: method
      });
      
      // Refresh student data to update attendance percentages
      loadClassData();
    } catch (error) {
      console.error('Error marking attendance:', error);
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8f9fa'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '10px' }}>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      {/* Header */}
      <div style={{
        background: 'white',
        borderRadius: '15px',
        padding: '30px',
        marginBottom: '25px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
        border: '1px solid rgba(255,255,255,0.2)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '10px'
        }}>
          <div>
            <h1 style={{ 
              margin: 0, 
              color: '#1a202c', 
              fontSize: '32px',
              fontWeight: '700',
              letterSpacing: '-0.5px'
            }}>
              {classInfo?.name || 'Class Dashboard'}
            </h1>
            <p style={{ 
              margin: '8px 0 0 0', 
              color: '#718096', 
              fontSize: '18px',
              fontWeight: '500'
            }}>
              {classInfo?.code || 'Course Code'}
            </p>
            <div style={{
              display: 'flex',
              gap: '15px',
              marginTop: '15px'
            }}>
              <span style={{
                padding: '6px 12px',
                background: '#edf2f7',
                color: '#4a5568',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '600'
              }}>
                {students.length} Students
              </span>
              <span style={{
                padding: '6px 12px',
                background: '#edf2f7',
                color: '#4a5568',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '600'
              }}>
                {schedule.length} Sessions
              </span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px' }}>
        {/* Students Section */}
        <div style={{
          background: 'white',
          borderRadius: '15px',
          padding: '25px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
          border: '1px solid rgba(255,255,255,0.2)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '25px'
          }}>
            <div>
              <h2 style={{ 
                margin: 0, 
                color: '#1a202c', 
                fontSize: '22px',
                fontWeight: '700',
                letterSpacing: '-0.3px'
              }}>
                Students
              </h2>
              <p style={{ 
                margin: '5px 0 0 0', 
                color: '#718096', 
                fontSize: '14px' 
              }}>
                {students.length} enrolled students
              </p>
            </div>
            <button
              onClick={handleAddStudent}
              style={{
                padding: '10px 20px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'transform 0.2s',
                boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)'
              }}
              onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
              onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
            >
              + Add Student
            </button>
          </div>

          {students.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: '#718096'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '15px' }}>Students</div>
              <div style={{ fontSize: '16px', marginBottom: '20px' }}>No students enrolled yet</div>
              <button
                onClick={handleAddStudent}
                style={{
                  padding: '12px 24px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Enroll First Student
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ 
                      padding: '15px 12px', 
                      textAlign: 'left', 
                      color: '#4a5568', 
                      fontSize: '12px',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Student
                    </th>
                    <th style={{ 
                      padding: '15px 12px', 
                      textAlign: 'center', 
                      color: '#4a5568', 
                      fontSize: '12px',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Attendance
                    </th>
                    <th style={{ 
                      padding: '15px 12px', 
                      textAlign: 'center', 
                      color: '#4a5568', 
                      fontSize: '12px',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => {
                    const attendanceStatus = getAttendanceStatus(student.attendance_percentage || 0);
                    return (
                      <tr
                        key={student.id}
                        onClick={() => handleStudentClick(student)}
                        style={{
                          borderBottom: '1px solid #e2e8f0',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#f7fafc';
                          e.currentTarget.style.transform = 'translateX(4px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'white';
                          e.currentTarget.style.transform = 'translateX(0)';
                        }}
                      >
                        <td style={{ padding: '15px 12px' }}>
                          <div>
                            <div style={{ 
                              color: '#2d3748', 
                              fontSize: '14px',
                              fontWeight: '600',
                              marginBottom: '2px'
                            }}>
                              {student.name}
                            </div>
                            <div style={{ 
                              color: '#718096', 
                              fontSize: '12px' 
                            }}>
                              {student.student_id}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '15px 12px', textAlign: 'center' }}>
                          <div style={{
                            fontWeight: '700',
                            fontSize: '16px',
                            color: attendanceStatus.color
                          }}>
                            {student.attendance_percentage || 0}%
                          </div>
                        </td>
                        <td style={{ padding: '15px 12px', textAlign: 'center' }}>
                          <span style={{
                            padding: '6px 12px',
                            borderRadius: '20px',
                            fontSize: '11px',
                            fontWeight: '700',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            background: attendanceStatus.color,
                            color: 'white'
                          }}>
                            {attendanceStatus.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Schedule/Timetable Section */}
        <div style={{
          background: 'white',
          borderRadius: '15px',
          padding: '25px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
          border: '1px solid rgba(255,255,255,0.2)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '25px'
          }}>
            <div>
              <h2 style={{ 
                margin: 0, 
                color: '#1a202c', 
                fontSize: '22px',
                fontWeight: '700',
                letterSpacing: '-0.3px'
              }}>
                Schedule
              </h2>
              <p style={{ 
                margin: '5px 0 0 0', 
                color: '#718096', 
                fontSize: '14px' 
              }}>
                Class timetable & sessions
              </p>
            </div>
          </div>
          
          {schedule.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: '#718096'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '15px' }}>Schedule</div>
              <div style={{ fontSize: '16px', marginBottom: '20px' }}>No schedule available</div>
              <div style={{ fontSize: '14px', color: '#a0aec0' }}>
                Add class schedule or sync from Moodle
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '15px' }}>
              {schedule.map((session, index) => {
                const isActive = isSessionActive(session);
                return (
                  <div
                    key={index}
                    style={{
                      padding: '20px',
                      background: isActive ? 
                        'linear-gradient(135deg, #48bb78 0%, #38a169 100%)' : 
                        'linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%)',
                      borderRadius: '12px',
                      borderLeft: `4px solid ${isActive ? '#2f855a' : '#667eea'}`,
                      position: 'relative',
                      transition: 'all 0.3s',
                      boxShadow: isActive ? 
                        '0 8px 25px rgba(72, 187, 120, 0.3)' : 
                        '0 4px 15px rgba(0,0,0,0.05)'
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 8px 25px rgba(102, 126, 234, 0.2)';
                      }
                    }}
                    onMouseOut={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.05)';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ 
                          fontWeight: '700', 
                          color: isActive ? 'white' : '#2d3748', 
                          fontSize: '16px',
                          marginBottom: '8px'
                        }}>
                          {session.scheduled_date ? 
                            new Date(session.scheduled_date).toLocaleDateString('en-US', { 
                              weekday: 'long', 
                              month: 'short', 
                              day: 'numeric' 
                            }) : 
                            formatDayName(session.day_of_week)
                          }
                        </div>
                        <div style={{ 
                          color: isActive ? 'rgba(255,255,255,0.9)' : '#718096', 
                          fontSize: '14px',
                          marginBottom: '8px',
                          fontWeight: '500'
                        }}>
                          {session.start_time && session.end_time ? 
                            `${session.start_time} - ${session.end_time}` : 
                            'All day'
                          }
                        </div>
                        {session.room_number && (
                          <div style={{ 
                            color: isActive ? 'rgba(255,255,255,0.8)' : '#667eea', 
                            fontSize: '13px',
                            fontWeight: '600'
                          }}>
                            Room: {session.room_number}
                          </div>
                        )}
                        <div style={{ marginTop: '10px' }}>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '20px',
                            fontSize: '10px',
                            fontWeight: '700',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            background: session.source === 'scheduled' ? 
                              (isActive ? 'rgba(255,255,255,0.2)' : '#48bb78') : 
                              (isActive ? 'rgba(255,255,255,0.2)' : '#718096'),
                            color: session.source === 'scheduled' ? 
                              (isActive ? 'white' : 'white') : 
                              (isActive ? 'white' : 'white')
                          }}>
                            {session.source === 'scheduled' ? 'Synced' : 'Manual'}
                          </span>
                        </div>
                      </div>
                      
                      {isActive && (
                        <div style={{ display: 'flex', gap: '8px', marginLeft: '15px' }}>
                          <button
                            onClick={() => handleTakeAttendance(session, 'face')}
                            style={{
                              padding: '8px 16px',
                              background: 'rgba(255,255,255,0.9)',
                              color: '#2d3748',
                              border: 'none',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                            }}
                            onMouseOver={(e) => {
                              e.target.style.background = 'white';
                              e.target.style.transform = 'translateY(-1px)';
                            }}
                            onMouseOut={(e) => {
                              e.target.style.background = 'rgba(255,255,255,0.9)';
                              e.target.style.transform = 'translateY(0)';
                            }}
                          >
                            Face
                          </button>
                          <button
                            onClick={() => handleTakeAttendance(session, 'qr')}
                            style={{
                              padding: '8px 16px',
                              background: 'rgba(255,255,255,0.9)',
                              color: '#2d3748',
                              border: 'none',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                            }}
                            onMouseOver={(e) => {
                              e.target.style.background = 'white';
                              e.target.style.transform = 'translateY(-1px)';
                            }}
                            onMouseOut={(e) => {
                              e.target.style.background = 'rgba(255,255,255,0.9)';
                              e.target.style.transform = 'translateY(0)';
                            }}
                          >
                            QR
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Student Profile Modal */}
      {showStudentProfile && selectedStudent && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '10px',
            padding: '30px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h2 style={{ margin: 0, color: '#2c3e50' }}>
                Student Profile
              </h2>
              <button
                onClick={() => setShowStudentProfile(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#6c757d'
                }}
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>
                {selectedStudent.name}
              </h3>
              <p style={{ margin: '5px 0', color: '#6c757d' }}>
                ID: {selectedStudent.student_id}
              </p>
              <p style={{ margin: '5px 0', color: '#6c757d' }}>
                Email: {selectedStudent.email}
              </p>
            </div>

            <div style={{
              padding: '20px',
              background: '#f8f9fa',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '48px', fontWeight: 'bold', marginBottom: '10px' }}>
                {selectedStudent.attendance_percentage || 0}%
              </div>
              <div style={{
                padding: '8px 16px',
                borderRadius: '4px',
                display: 'inline-block',
                fontWeight: 'bold',
                background: getAttendanceStatus(selectedStudent.attendance_percentage || 0).color,
                color: 'white'
              }}>
                {getAttendanceStatus(selectedStudent.attendance_percentage || 0).status}
              </div>
            </div>

            {(selectedStudent.attendance_percentage || 0) < 75 && (
              <div style={{
                marginTop: '20px',
                padding: '15px',
                background: '#f8d7da',
                borderRadius: '6px',
                border: '1px solid #f5c6cb'
              }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#721c24' }}>
                  <span style={{ marginRight: '8px' }}>!</span>
                  At Risk Warning
                </h4>
                <p style={{ margin: 0, color: '#721c24', fontSize: '14px' }}>
                  This student's attendance is below 75%. Consider taking corrective action.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Attendance Modal */}
      {showAttendanceModal && selectedSession && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '10px',
            padding: '30px',
            maxWidth: '800px',
            width: '90%',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h2 style={{ margin: 0, color: '#2c3e50' }}>
                {attendanceMode === 'face' ? 'Face Scanning' : 'QR Code Scanning'}
              </h2>
              <button
                onClick={() => setShowAttendanceModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#6c757d'
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{
              marginBottom: '20px',
              padding: '15px',
              background: '#f8f9fa',
              borderRadius: '8px'
            }}>
              <div style={{ color: '#6c757d', fontSize: '14px' }}>
                Session: {selectedSession.scheduled_date ? 
                  new Date(selectedSession.scheduled_date).toLocaleDateString() : 
                  formatDayName(selectedSession.day_of_week)
                }
              </div>
              <div style={{ color: '#6c757d', fontSize: '14px' }}>
                Time: {selectedSession.start_time && selectedSession.end_time ? 
                  `${selectedSession.start_time} - ${selectedSession.end_time}` : 
                  'All day'
                }
              </div>
            </div>
            
            {attendanceMode === 'face' ? (
              <CameraCapture
                classId={classId}
                sessionDate={selectedSession.scheduled_date || new Date().toISOString().split('T')[0]}
                onRecognized={(student) => {
                  console.log('Face recognized:', student);
                  // Show success notification
                  const note = document.createElement('div');
                  note.style.cssText = `
                    position: fixed; top: 18px; right: 18px; background: linear-gradient(135deg,#28a745 0%,#20c997 100%);
                    color: white; padding: 10px 14px; border-radius: 8px; z-index: 99999; font-weight: 700;
                  `;
                  note.innerHTML = `Attendance marked for ${student.name}`;
                  document.body.appendChild(note);
                  setTimeout(() => note.remove(), 3000);
                }}
                onError={(error) => {
                  console.error('Face recognition error:', error);
                }}
              />
            ) : (
              <QRScanner
                onScan={(studentId) => {
                  console.log('QR scanned:', studentId);
                  // Mark attendance
                  markAttendance(studentId, 'qr');
                  // Show success notification
                  const note = document.createElement('div');
                  note.style.cssText = `
                    position: fixed; top: 18px; right: 18px; background: linear-gradient(135deg,#28a745 0%,#20c997 100%);
                    color: white; padding: 10px 14px; border-radius: 8px; z-index: 99999; font-weight: 700;
                  `;
                  note.innerHTML = `Attendance marked for ${studentId}`;
                  document.body.appendChild(note);
                  setTimeout(() => note.remove(), 3000);
                }}
                onError={(error) => {
                  console.error('QR scanning error:', error);
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
