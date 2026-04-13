import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

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
  const [attendanceMode, setAttendanceMode] = useState('face'); // 'face' or 'qr'

  useEffect(() => {
    loadClassData();
  }, [classId]);

  const loadClassData = async () => {
    try {
      setLoading(true);
      
      // Load class information
      const classResponse = await api.get(`/classes/${classId}`);
      setClassInfo(classResponse.data);
      
      // Load students
      const studentsResponse = await api.get(`/classes/${classId}/students`);
      setStudents(studentsResponse.data);
      
      // Load schedule
      const scheduleResponse = await api.get(`/classes/${classId}/schedule`);
      setSchedule(scheduleResponse.data);
      
    } catch (error) {
      console.error('Error loading class data:', error);
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

  const handleTakeAttendance = (mode) => {
    setAttendanceMode(mode);
    setShowAttendanceModal(true);
  };

  const handleAddStudent = () => {
    // TODO: Implement add student modal
    console.log('Add student clicked');
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
    <div style={{ minHeight: '100vh', background: '#f8f9fa', padding: '20px' }}>
      {/* Header */}
      <div style={{
        background: 'white',
        borderRadius: '10px',
        padding: '20px',
        marginBottom: '20px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '10px'
        }}>
          <div>
            <h1 style={{ margin: 0, color: '#2c3e50', fontSize: '28px' }}>
              {classInfo?.name || 'Class Dashboard'}
            </h1>
            <p style={{ margin: '5px 0 0 0', color: '#6c757d', fontSize: '16px' }}>
              {classInfo?.code || 'Course Code'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => handleTakeAttendance('face')}
              style={{
                padding: '12px 24px',
                background: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span>Face Scan</span>
            </button>
            <button
              onClick={() => handleTakeAttendance('qr')}
              style={{
                padding: '12px 24px',
                background: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span>QR Scan</span>
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        {/* Student List */}
        <div style={{
          background: 'white',
          borderRadius: '10px',
          padding: '20px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px'
          }}>
            <h2 style={{ margin: 0, color: '#2c3e50', fontSize: '20px' }}>
              Students ({students.length})
            </h2>
            <button
              onClick={handleAddStudent}
              style={{
                padding: '8px 16px',
                background: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              + Add Student
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e9ecef' }}>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#495057' }}>Name</th>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#495057' }}>ID</th>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#495057' }}>Email</th>
                  <th style={{ padding: '12px', textAlign: 'center', color: '#495057' }}>Attendance</th>
                  <th style={{ padding: '12px', textAlign: 'center', color: '#495057' }}>Status</th>
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
                        borderBottom: '1px solid #e9ecef',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = '#f8f9fa'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
                    >
                      <td style={{ padding: '12px', color: '#2c3e50' }}>
                        {student.name}
                      </td>
                      <td style={{ padding: '12px', color: '#6c757d' }}>
                        {student.student_id}
                      </td>
                      <td style={{ padding: '12px', color: '#6c757d' }}>
                        {student.email}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <span style={{
                          fontWeight: 'bold',
                          color: attendanceStatus.color
                        }}>
                          {student.attendance_percentage || 0}%
                        </span>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: 'bold',
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
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Schedule */}
          <div style={{
            background: 'white',
            borderRadius: '10px',
            padding: '20px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{ margin: '0 0 20px 0', color: '#2c3e50', fontSize: '20px' }}>
              Schedule
            </h2>
            <div style={{ display: 'grid', gap: '10px' }}>
              {schedule.map((session, index) => (
                <div
                  key={index}
                  style={{
                    padding: '12px',
                    background: '#f8f9fa',
                    borderRadius: '6px',
                    borderLeft: '4px solid #007bff'
                  }}
                >
                  <div style={{ fontWeight: 'bold', color: '#2c3e50' }}>
                    {session.day}
                  </div>
                  <div style={{ color: '#6c757d', fontSize: '14px' }}>
                    {session.time}
                  </div>
                  <div style={{ color: '#007bff', fontSize: '14px', marginTop: '4px' }}>
                    {session.course}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Stats */}
          <div style={{
            background: 'white',
            borderRadius: '10px',
            padding: '20px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{ margin: '0 0 20px 0', color: '#2c3e50', fontSize: '20px' }}>
              Overview
            </h2>
            <div style={{ display: 'grid', gap: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6c757d' }}>Total Students</span>
                <span style={{ fontWeight: 'bold', color: '#2c3e50' }}>
                  {students.length}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6c757d' }}>At Risk</span>
                <span style={{ fontWeight: 'bold', color: '#dc3545' }}>
                  {students.filter(s => (s.attendance_percentage || 0) < 75).length}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6c757d' }}>Good Standing</span>
                <span style={{ fontWeight: 'bold', color: '#28a745' }}>
                  {students.filter(s => (s.attendance_percentage || 0) >= 75).length}
                </span>
              </div>
            </div>
          </div>
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
      {showAttendanceModal && (
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
            maxWidth: '500px',
            width: '90%',
            textAlign: 'center'
          }}>
            <h2 style={{ margin: '0 0 20px 0', color: '#2c3e50' }}>
              {attendanceMode === 'face' ? 'Face Scanning' : 'QR Code Scanning'}
            </h2>
            
            <div style={{
              width: '300px',
              height: '300px',
              background: '#f8f9fa',
              border: '2px dashed #dee2e6',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '20px auto'
            }}>
              <div style={{ textAlign: 'center', color: '#6c757d' }}>
                <div style={{ fontSize: '48px', marginBottom: '10px' }}>
                  {attendanceMode === 'face' ? 'Face' : 'QR'}
                </div>
                <div>
                  {attendanceMode === 'face' 
                    ? 'Camera will open for face scanning' 
                    : 'Camera will open for QR code scanning'
                  }
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={() => setShowAttendanceModal(false)}
                style={{
                  padding: '12px 24px',
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '16px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                style={{
                  padding: '12px 24px',
                  background: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '16px',
                  cursor: 'pointer'
                }}
              >
                Start Scanning
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
