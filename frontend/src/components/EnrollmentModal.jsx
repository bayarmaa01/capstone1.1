import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function EnrollmentModal({ isOpen, onClose, classId, onEnrollmentSuccess }) {
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [enrollingIds, setEnrollingIds] = useState(new Set());
  const [selectedStudents, setSelectedStudents] = useState(new Set());

  // Fetch all students when modal opens
  useEffect(() => {
    if (isOpen && classId) {
      fetchStudents();
    }
  }, [isOpen, classId]);

  // Filter students based on search
  useEffect(() => {
    const filtered = students.filter(student => 
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.student_id.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredStudents(filtered);
  }, [students, searchTerm]);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const response = await api.get('/students');
      setStudents(response.data || []);
      setFilteredStudents(response.data || []);
    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnrollStudent = async (student) => {
    try {
      setEnrollingIds(prev => new Set(prev).add(student.id));
      
      const response = await api.post(`/classes/${classId}/students`, {
        studentId: student.id
      });

      if (response.data.success) {
        // Remove from available students list
        setStudents(prev => prev.filter(s => s.id !== student.id));
        setSelectedStudents(prev => new Set(prev).add(student.id));
        
        // Show success toast
        showToast(`Student ${student.name} enrolled successfully!`, 'success');
        
        // Notify parent component
        if (onEnrollmentSuccess) {
          onEnrollmentSuccess(response.data.student);
        }
      }
    } catch (error) {
      console.error('Error enrolling student:', error);
      const message = error.response?.data?.error || 'Failed to enroll student';
      showToast(message, 'error');
    } finally {
      setEnrollingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(student.id);
        return newSet;
      });
    }
  };

  const handleMultiEnroll = async () => {
    if (selectedStudents.size === 0) return;

    try {
      setLoading(true);
      const enrollmentPromises = Array.from(selectedStudents).map(studentId => 
        api.post(`/classes/${classId}/students`, { studentId })
      );

      const results = await Promise.allSettled(enrollmentPromises);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      if (successful > 0) {
        showToast(`${successful} students enrolled successfully!`, 'success');
        if (onEnrollmentSuccess) {
          onEnrollmentSuccess();
        }
      }
      
      if (failed > 0) {
        showToast(`${failed} enrollments failed`, 'error');
      }

      // Refresh student list
      await fetchStudents();
      setSelectedStudents(new Set());
    } catch (error) {
      console.error('Error in multi-enrollment:', error);
      showToast('Failed to enroll some students', 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleStudentSelection = (studentId) => {
    setSelectedStudents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(studentId)) {
        newSet.delete(studentId);
      } else {
        newSet.add(studentId);
      }
      return newSet;
    });
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

  if (!isOpen) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h2 style={styles.title}>Enroll Students</h2>
          <button onClick={onClose} style={styles.closeBtn}>×</button>
        </div>

        <div style={styles.searchSection}>
          <input
            type="text"
            placeholder="Search students by name, email, or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
        </div>

        {selectedStudents.size > 0 && (
          <div style={styles.multiEnrollSection}>
            <span style={styles.selectedCount}>
              {selectedStudents.size} student{selectedStudents.size > 1 ? 's' : ''} selected
            </span>
            <button 
              onClick={handleMultiEnroll}
              disabled={loading}
              style={styles.multiEnrollBtn}
            >
              Enroll Selected
            </button>
          </div>
        )}

        <div style={styles.studentsList}>
          {loading ? (
            <div style={styles.loading}>Loading students...</div>
          ) : filteredStudents.length === 0 ? (
            <div style={styles.empty}>
              {searchTerm ? 'No students found matching your search' : 'No students available'}
            </div>
          ) : (
            filteredStudents.map(student => (
              <div key={student.id} style={styles.studentCard}>
                <div style={styles.studentInfo}>
                  {student.photo_url && (
                    <img 
                      src={`/uploads/${student.photo_url}`} 
                      alt={student.name}
                      style={styles.studentPhoto}
                      onError={(e) => e.target.style.display = 'none'}
                    />
                  )}
                  <div style={styles.studentDetails}>
                    <div style={styles.studentName}>{student.name}</div>
                    <div style={styles.studentMeta}>
                      ID: {student.student_id}
                      {student.email && ` · ${student.email}`}
                    </div>
                  </div>
                </div>
                <div style={styles.studentActions}>
                  <input
                    type="checkbox"
                    checked={selectedStudents.has(student.id)}
                    onChange={() => toggleStudentSelection(student.id)}
                    style={styles.checkbox}
                  />
                  <button
                    onClick={() => handleEnrollStudent(student)}
                    disabled={enrollingIds.has(student.id)}
                    style={{
                      ...styles.enrollBtn,
                      opacity: enrollingIds.has(student.id) ? 0.6 : 1,
                      cursor: enrollingIds.has(student.id) ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {enrollingIds.has(student.id) ? 'Enrolling...' : 'Enroll'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '12px',
    width: '90%',
    maxWidth: '700px',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid #e5e7eb'
  },
  title: {
    margin: 0,
    fontSize: '20px',
    fontWeight: '600',
    color: '#111827'
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#6b7280',
    padding: '0',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '6px'
  },
  searchSection: {
    padding: '20px 24px',
    borderBottom: '1px solid #e5e7eb'
  },
  searchInput: {
    width: '100%',
    padding: '10px 14px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box'
  },
  multiEnrollSection: {
    padding: '16px 24px',
    backgroundColor: '#f9fafb',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  selectedCount: {
    fontSize: '14px',
    color: '#6b7280',
    fontWeight: '500'
  },
  multiEnrollBtn: {
    padding: '8px 16px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  studentsList: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 24px'
  },
  loading: {
    textAlign: 'center',
    padding: '40px',
    color: '#6b7280'
  },
  empty: {
    textAlign: 'center',
    padding: '40px',
    color: '#6b7280',
    fontStyle: 'italic'
  },
  studentCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    marginBottom: '12px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    backgroundColor: 'white',
    transition: 'box-shadow 0.2s'
  },
  studentInfo: {
    display: 'flex',
    alignItems: 'center',
    flex: 1
  },
  studentPhoto: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    objectFit: 'cover',
    marginRight: '12px'
  },
  studentDetails: {
    flex: 1
  },
  studentName: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#111827',
    marginBottom: '4px'
  },
  studentMeta: {
    fontSize: '14px',
    color: '#6b7280'
  },
  studentActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer'
  },
  enrollBtn: {
    padding: '8px 16px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  }
};
