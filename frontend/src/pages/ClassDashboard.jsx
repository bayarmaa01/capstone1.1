import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import CameraCapture from '../components/CameraCapture';
import QRScanner from '../components/QRScanner';
import EnrollmentModal from '../components/EnrollmentModal';
import ScheduleModal from '../components/ScheduleModal';

export default function ClassDashboard() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const [classInfo, setClassInfo] = useState(null);
  const [students, setStudents] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Validate classId
  useEffect(() => {
    console.log("classId:", classId);
    if (!classId) {
      console.error("classId is undefined");
      setError("Invalid class ID");
      setLoading(false);
      return;
    }
  }, [classId]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showStudentProfile, setShowStudentProfile] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [attendanceMode, setAttendanceMode] = useState('face');
  const [selectedSession, setSelectedSession] = useState(null);
  const [showEnrollmentModal, setShowEnrollmentModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  useEffect(() => {
    if (classId && !error) {
      loadClassData();
    }
  }, [classId, error]);

  const loadClassData = async () => {
    if (!classId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      console.log('Loading class data for classId:', classId);
      
      // Load class information
      const classResponse = await api.get(`/classes/${classId}`);
      console.log('Class info response:', classResponse.data);
      setClassInfo(classResponse.data);
      
      // Load students
      const studentsResponse = await api.get(`/classes/${classId}/students`);
      console.log('Students response:', studentsResponse.data);
      setStudents(studentsResponse.data);
      
      // Load schedule - use the unified endpoint
      const scheduleResponse = await api.get(`/classes/${classId}/schedule`);
      console.log('Schedule response:', scheduleResponse.data);
      setSchedule(scheduleResponse.data || []);
      
    } catch (error) {
      console.error('Error loading class data:', error);
      console.error('Error details:', error.response?.data);
      console.error('Error status:', error.response?.status);
      
      setError('Failed to load class data');
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
    // Navigate to student profile page instead of showing modal
    navigate(`/students/${student.id}`);
  };

  const handleEnrollStudent = async (student) => {
    if (!classId) {
      console.error('classId is undefined - cannot enroll student');
      showToast('Error: Class ID not found', 'error');
      return;
    }

    try {
      const response = await api.post(`/classes/${classId}/students`, {
        studentId: student.id
      });

      if (response.data.success) {
        showToast(`Student ${student.name} enrolled successfully!`, 'success');
        // Refresh student list
        loadClassData();
      }
    } catch (error) {
      console.error('Error enrolling student:', error);
      const message = error.response?.data?.error || 'Failed to enroll student';
      showToast(message, 'error');
    }
  };

  const handleTakeAttendance = async (session, mode) => {
    console.log('Taking attendance with mode:', mode);
    navigate(`/attendance/${session.id}?classId=${classId}`, {
      state: { session, classId: Number(classId), mode }
    });
  };

  const markAttendance = async (studentId, method) => {
    try {
      const sessionDate = selectedSession.scheduled_date || new Date().toISOString().split('T')[0];
      
      await api.post('/attendance/record', {
        class_id: classId,
        student_id: studentId,
        session_date: sessionDate,
        method: method,
        confidence: 1.0
      });
      
      // Update student attendance status
      setStudents(students.map(s => 
        s.id === studentId ? { ...s, present: true } : s
      ));
      
      alert(`✓ Student marked present via ${method}!`);
      
    } catch (error) {
      console.error('Error marking attendance:', error);
      alert(`Error: ${error.response?.data?.error || error.message}`);
    }
  };

  const isSessionActive = (session) => {
    const now = new Date();
    const sessionDate = new Date(session.scheduled_date || session.session_date);
    const [hours, minutes] = session.start_time.split(':');
    const startTime = new Date(sessionDate);
    startTime.setHours(parseInt(hours), parseInt(minutes));
    
    const [endHours, endMinutes] = session.end_time.split(':');
    const endTime = new Date(sessionDate);
    endTime.setHours(parseInt(endHours), parseInt(endMinutes));
    
    return now >= startTime && now <= endTime;
  };

  const formatDayName = (dayOfWeek) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayOfWeek] || 'Unknown';
  };

  const handleEnrollmentSuccess = (student) => {
    // Refresh student list after successful enrollment
    loadClassData();
  };

  const handleScheduleSuccess = (schedule) => {
    // Refresh schedule data after successful creation
    loadClassData();
  };

  const handleDeleteSchedule = async (scheduleId, source) => {
    if (source === 'moodle') {
      alert('Cannot delete Moodle schedule - managed by LMS');
      return;
    }

    if (!classId) {
      console.error('classId is undefined - cannot delete schedule');
      return;
    }

    const confirmed = window.confirm('Are you sure you want to delete this schedule?');
    if (!confirmed) return;

    try {
      const response = await api.delete(`/classes/${classId}/schedule/${scheduleId}`);
      
      if (response.data.success) {
        showToast('Schedule deleted successfully', 'success');
        // Refresh schedule data
        loadClassData();
      }
    } catch (error) {
      console.error('Error deleting schedule:', error);
      const message = error.response?.data?.error || 'Failed to delete schedule';
      showToast(message, 'error');
    }
  };

  const handleEditSchedule = async (session) => {
    if (session.source === 'moodle') {
      showToast('Moodle schedules are read-only and cannot be edited here.', 'error');
      return;
    }

    const startTime = window.prompt('Enter start time (HH:mm)', session.start_time || '');
    if (startTime === null) return;
    const endTime = window.prompt('Enter end time (HH:mm)', session.end_time || '');
    if (endTime === null) return;
    const roomNumber = window.prompt('Enter room number (optional)', session.room_number || '');
    if (roomNumber === null) return;

    try {
      const response = await api.put(`/schedule/${session.id}`, {
        start_time: startTime,
        end_time: endTime,
        room_number: roomNumber || null
      });
      if (response.data.success) {
        showToast('Schedule updated successfully', 'success');
        loadClassData();
      }
    } catch (error) {
      console.error('Error editing schedule:', error);
      const message = error.response?.data?.error || 'Failed to update schedule';
      showToast(message, 'error');
    }
  };

  const handleRemoveStudent = async (student) => {
    const confirmed = window.confirm(
      `Are you sure you want to remove ${student.name} from this class?`
    );
    
    if (!confirmed) return;

    try {
      const response = await api.delete(`/classes/${classId}/students/${student.id}`);
      
      if (response.data.success) {
        showToast(`Student ${student.name} removed from class`, 'success');
        // Refresh student list
        loadClassData();
      }
    } catch (error) {
      console.error('Error removing student:', error);
      const message = error.response?.data?.error || 'Failed to remove student';
      showToast(message, 'error');
    }
  };

  const showToast = (message, type = 'info') => {
    // Simple toast implementation
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
      color: white;
      border-radius: 8px;
      z-index: 10000;
      font-weight: 500;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 3000);
  };
      
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '10px', color: 'white' }}>Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{ textAlign: 'center', color: 'white' }}>
          <div style={{ fontSize: '24px', marginBottom: '10px' }}>Error</div>
          <div style={{ fontSize: '16px' }}>{error}</div>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              backgroundColor: 'white',
              color: '#667eea',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Back to Dashboard
          </button>
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
              onClick={() => setShowEnrollmentModal(true)}
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
                onClick={() => setShowEnrollmentModal(true)}
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
                    <th style={{ 
                      padding: '15px 12px', 
                      textAlign: 'center', 
                      color: '#4a5568', 
                      fontSize: '12px',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      minWidth: '200px'
                    }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => {
                    const attendanceStatus = getAttendanceStatus(student.attendance_percentage || 0);
                    return (
                      <tr
                        key={student.id}
                        style={{
                          borderBottom: '1px solid #e2e8f0'
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
                        <td style={{ padding: '15px 12px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                            <button
                              onClick={() => handleStudentClick(student)}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'background-color 0.2s'
                              }}
                              onMouseEnter={(e) => e.target.style.backgroundColor = '#2563eb'}
                              onMouseLeave={(e) => e.target.style.backgroundColor = '#3b82f6'}
                              title="View student profile"
                            >
                              Profile
                            </button>
                            <button
                              onClick={() => handleEnrollStudent(student)}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: '#10b981',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'background-color 0.2s'
                              }}
                              onMouseEnter={(e) => e.target.style.backgroundColor = '#059669'}
                              onMouseLeave={(e) => e.target.style.backgroundColor = '#10b981'}
                              title="Enroll student in class"
                            >
                              Enroll
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveStudent(student);
                              }}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: '#ef4444',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'background-color 0.2s'
                              }}
                              onMouseEnter={(e) => e.target.style.backgroundColor = '#dc2626'}
                              onMouseLeave={(e) => e.target.style.backgroundColor = '#ef4444'}
                              title="Remove student from class"
                            >
                              Remove
                            </button>
                          </div>
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
            <button
              onClick={() => setShowScheduleModal(true)}
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
              + Add Schedule
            </button>
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
              {schedule.map((session) => {
                const isActive = isSessionActive(session);
                const isMoodle = session.source === 'moodle' || session.source === 'Moodle' || session.source === 'LMS';
                return (
                  <div
                    key={session.id}
                    style={{
                      padding: '20px',
                      background: isActive ? 
                        'linear-gradient(135deg, #48bb78 0%, #38a169 100%)' : 
                        'linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%)',
                      borderRadius: '12px',
                      borderLeft: `4px solid ${isActive ? '#2f855a' : (isMoodle ? '#ed8936' : '#667eea')}`,
                      position: 'relative',
                      transition: 'all 0.3s',
                      boxShadow: isActive ? 
                        '0 8px 25px rgba(72, 187, 120, 0.3)' : 
                        '0 4px 15px rgba(0,0,0,0.05)',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 8px 25px rgba(102, 126, 234, 0.2)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = isActive ? 
                        '0 8px 25px rgba(72, 187, 120, 0.3)' : 
                        '0 4px 15px rgba(0,0,0,0.05)';
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
                            background: isMoodle ? 
                              (isActive ? 'rgba(251, 191, 36, 0.3)' : '#fbbf24') : 
                              (isActive ? 'rgba(255,255,255,0.2)' : '#718096'),
                            color: isMoodle ? 
                              (isActive ? '#92400e' : '#92400e') : 
                              (isActive ? 'white' : '#4a5568')
                          }}>
                            {isMoodle ? 'Moodle' : 'Manual'}
                          </span>
                          {isMoodle && (
                            <span style={{
                              marginLeft: '8px',
                              fontSize: '11px',
                              color: isActive ? 'rgba(255,255,255,0.7)' : '#64748b',
                              fontStyle: 'italic'
                            }}>
                              Managed by LMS
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '8px', marginLeft: '15px', alignItems: 'flex-start' }}>
                        <button
                          onClick={() => {
                            setSelectedSession(session);
                            setAttendanceMode(null);
                            setShowAttendanceModal(true);
                          }}
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
                          Take Attendance
                        </button>
                        {!isMoodle && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditSchedule(session);
                            }}
                            style={{
                              padding: '6px 12px',
                              background: '#3b82f6',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              transition: 'background-color 0.2s'
                            }}
                            onMouseOver={(e) => e.target.style.backgroundColor = '#2563eb'}
                            onMouseLeave={(e) => e.target.style.backgroundColor = '#3b82f6'}
                            title="Edit schedule"
                          >
                            Edit
                          </button>
                        )}
                        {!isMoodle && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSchedule(session.id, session.source);
                            }}
                            style={{
                              padding: '6px 12px',
                              background: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              transition: 'background-color 0.2s'
                            }}
                            onMouseOver={(e) => e.target.style.backgroundColor = '#dc2626'}
                            onMouseLeave={(e) => e.target.style.backgroundColor = '#ef4444'}
                            title="Remove schedule"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showEnrollmentModal && (
        <EnrollmentModal
          isOpen={showEnrollmentModal}
          classId={classId}
          onClose={() => setShowEnrollmentModal(false)}
          onEnrollmentSuccess={handleEnrollmentSuccess}
        />
      )}
      
      {showScheduleModal && (
        <ScheduleModal
          isOpen={showScheduleModal}
          classId={classId}
          onClose={() => setShowScheduleModal(false)}
          onScheduleSuccess={handleScheduleSuccess}
        />
      )}
      
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
            borderRadius: '15px',
            padding: '30px',
            maxWidth: '500px',
            width: '90%'
          }}>
            <h3 style={{ margin: '0 0 20px 0', color: '#1a202c' }}>Take Attendance</h3>
            <p style={{ margin: '0 0 20px 0', color: '#718096' }}>
              Select attendance method for {selectedSession.scheduled_date ? 
                new Date(selectedSession.scheduled_date).toLocaleDateString() : 
                'this session'
              }
            </p>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <button
                onClick={() => handleTakeAttendance(selectedSession, 'face')}
                style={{
                  flex: 1,
                  padding: '15px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Face Recognition
              </button>
              <button
                onClick={() => handleTakeAttendance(selectedSession, 'qr')}
                style={{
                  flex: 1,
                  padding: '15px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                QR Code Scanner
              </button>
            </div>
            <button
              onClick={() => setShowAttendanceModal(false)}
              style={{
                width: '100%',
                padding: '10px',
                background: '#f3f4f6',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
