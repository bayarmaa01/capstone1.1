import React, { useState } from 'react';
import api from '../services/api';

export default function ScheduleModal({ isOpen, onClose, classId, onScheduleSuccess }) {
  const [formData, setFormData] = useState({
    day_of_week: 1, // Monday
    start_time: '',
    end_time: '',
    room_number: '',
    scheduled_date: ''
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const days = [
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
    { value: 0, label: 'Sunday' }
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.day_of_week) {
      newErrors.day_of_week = 'Day is required';
    }
    
    if (!formData.start_time) {
      newErrors.start_time = 'Start time is required';
    }
    
    if (!formData.end_time) {
      newErrors.end_time = 'End time is required';
    }
    
    if (formData.start_time && formData.end_time && formData.start_time >= formData.end_time) {
      newErrors.end_time = 'End time must be after start time';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      
      const scheduleData = {
        class_id: parseInt(classId),
        day_of_week: parseInt(formData.day_of_week),
        start_time: formData.start_time,
        end_time: formData.end_time,
        room_number: formData.room_number || null,
        scheduled_date: formData.scheduled_date || null,
        is_active: true
      };

      const response = await api.post('/classes/schedule', scheduleData);
      
      if (response.data.success) {
        showToast('Schedule created successfully!', 'success');
        
        // Reset form
        setFormData({
          day_of_week: 1,
          start_time: '',
          end_time: '',
          room_number: '',
          scheduled_date: ''
        });
        
        // Notify parent component
        if (onScheduleSuccess) {
          onScheduleSuccess(response.data.schedule);
        }
        
        onClose();
      }
    } catch (error) {
      console.error('Error creating schedule:', error);
      const message = error.response?.data?.error || 'Failed to create schedule';
      showToast(message, 'error');
    } finally {
      setLoading(false);
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

  if (!isOpen) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h2 style={styles.title}>Add Class Schedule</h2>
          <button onClick={onClose} style={styles.closeBtn}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Day of Week *</label>
            <select
              name="day_of_week"
              value={formData.day_of_week}
              onChange={handleInputChange}
              style={{
                ...styles.select,
                borderColor: errors.day_of_week ? '#ef4444' : '#d1d5db'
              }}
            >
              {days.map(day => (
                <option key={day.value} value={day.value}>
                  {day.label}
                </option>
              ))}
            </select>
            {errors.day_of_week && (
              <div style={styles.error}>{errors.day_of_week}</div>
            )}
          </div>

          <div style={styles.formRow}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Start Time *</label>
              <input
                type="time"
                name="start_time"
                value={formData.start_time}
                onChange={handleInputChange}
                style={{
                  ...styles.input,
                  borderColor: errors.start_time ? '#ef4444' : '#d1d5db'
                }}
              />
              {errors.start_time && (
                <div style={styles.error}>{errors.start_time}</div>
              )}
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>End Time *</label>
              <input
                type="time"
                name="end_time"
                value={formData.end_time}
                onChange={handleInputChange}
                style={{
                  ...styles.input,
                  borderColor: errors.end_time ? '#ef4444' : '#d1d5db'
                }}
              />
              {errors.end_time && (
                <div style={styles.error}>{errors.end_time}</div>
              )}
            </div>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Room Number (Optional)</label>
            <input
              type="text"
              name="room_number"
              value={formData.room_number}
              onChange={handleInputChange}
              placeholder="e.g., Room 101"
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Specific Date (Optional)</label>
            <input
              type="date"
              name="scheduled_date"
              value={formData.scheduled_date}
              onChange={handleInputChange}
              style={styles.input}
            />
            <div style={styles.hint}>
              Leave empty for recurring weekly schedule
            </div>
          </div>

          <div style={styles.formActions}>
            <button
              type="button"
              onClick={onClose}
              style={styles.cancelBtn}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                ...styles.submitBtn,
                opacity: loading ? 0.6 : 1,
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Creating...' : 'Create Schedule'}
            </button>
          </div>
        </form>
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
    maxWidth: '500px',
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
  form: {
    padding: '24px',
    flex: 1,
    overflowY: 'auto'
  },
  formGroup: {
    marginBottom: '20px'
  },
  formRow: {
    display: 'flex',
    gap: '16px',
    marginBottom: '20px'
  },
  label: {
    display: 'block',
    marginBottom: '6px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151'
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s'
  },
  select: {
    width: '100%',
    padding: '10px 14px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
    backgroundColor: 'white'
  },
  error: {
    color: '#ef4444',
    fontSize: '12px',
    marginTop: '4px'
  },
  hint: {
    color: '#6b7280',
    fontSize: '12px',
    marginTop: '4px',
    fontStyle: 'italic'
  },
  formActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '24px',
    paddingTop: '20px',
    borderTop: '1px solid #e5e7eb'
  },
  cancelBtn: {
    padding: '10px 20px',
    backgroundColor: '#f3f4f6',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  submitBtn: {
    padding: '10px 20px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  }
};
