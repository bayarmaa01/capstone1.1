import React from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

export default function AttendanceChart({ stats, dates }) {
  
  // Check if we have data
  if (!stats || stats.length === 0) {
    return (
      <div style={styles.chartSection}>
        <h3>📊 Statistics & Charts</h3>
        <div style={styles.emptyState}>
          <p>📋 No attendance data yet</p>
          <p style={{ fontSize: '14px', color: '#999' }}>
            Start taking attendance to see charts and statistics
          </p>
        </div>
      </div>
    );
  }
  
  // Prepare data for charts
  const attendanceData = stats.map(student => ({
    name: student.name,
    percentage: student.attendance_percentage || 0,
    present: student.total_present || 0,
    absent: (student.total_sessions || 0) - (student.total_present || 0)
  }));

  // Color based on percentage
  const getColor = (percentage) => {
    if (percentage >= 75) return '#28a745';
    if (percentage >= 50) return '#ffc107';
    return '#dc3545';
  };

  // Summary data for pie chart
  const summary = [
    { name: 'Good (≥75%)', value: stats.filter(s => (s.attendance_percentage || 0) >= 75).length, color: '#28a745' },
    { name: 'Warning (50-74%)', value: stats.filter(s => (s.attendance_percentage || 0) >= 50 && (s.attendance_percentage || 0) < 75).length, color: '#ffc107' },
    { name: 'At Risk (<50%)', value: stats.filter(s => (s.attendance_percentage || 0) < 50).length, color: '#dc3545' }
  ].filter(item => item.value > 0); // Only show categories with data

  // Trend over time
  const trendData = dates && dates.length > 0 ? dates.map(date => ({
    date: new Date(date.session_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    attendance: Math.round((date.present_count / date.total_students) * 100)
  })) : [];

  return (
    <div>
      {/* Bar Chart - Individual Student Performance */}
      <div style={styles.chartSection}>
        <h3>📊 Student Attendance Percentage</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={attendanceData} margin={{ top: 5, right: 30, left: 20, bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="name" 
              angle={-45} 
              textAnchor="end" 
              height={100}
              interval={0}
              style={{ fontSize: '12px' }}
            />
            <YAxis domain={[0, 100]} label={{ value: 'Percentage', angle: -90, position: 'insideLeft' }} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc' }}
              formatter={(value) => `${value}%`}
            />
            <Legend />
            <Bar dataKey="percentage" fill="#667eea" name="Attendance %" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Pie Chart - Summary */}
      {summary.length > 0 && (
        <div style={styles.chartSection}>
          <h3>🥧 Attendance Summary</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={summary}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {summary.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Line Chart - Trend Over Time */}
      {trendData.length > 0 && (
        <div style={styles.chartSection}>
          <h3>📈 Attendance Trend Over Time</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={[0, 100]} label={{ value: 'Attendance %', angle: -90, position: 'insideLeft' }} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc' }}
                formatter={(value) => `${value}%`}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="attendance" 
                stroke="#667eea" 
                strokeWidth={2} 
                name="Class Attendance %" 
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Detailed Table */}
      <div style={styles.chartSection}>
        <h3>📋 Detailed Statistics</h3>
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Student</th>
                <th style={styles.th}>Present</th>
                <th style={styles.th}>Absent</th>
                <th style={styles.th}>Total</th>
                <th style={styles.th}>Attendance %</th>
                <th style={styles.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {attendanceData.map((student, idx) => (
                <tr key={idx} style={styles.tr}>
                  <td style={styles.td}>{student.name}</td>
                  <td style={styles.td}>{student.present}</td>
                  <td style={styles.td}>{student.absent}</td>
                  <td style={styles.td}>{student.present + student.absent}</td>
                  <td style={{...styles.td, color: getColor(student.percentage), fontWeight: 'bold', fontSize: '16px'}}>
                    {student.percentage}%
                  </td>
                  <td style={styles.td}>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '600',
                      background: student.percentage >= 75 ? '#d4edda' : student.percentage >= 50 ? '#fff3cd' : '#f8d7da',
                      color: student.percentage >= 75 ? '#155724' : student.percentage >= 50 ? '#856404' : '#721c24'
                    }}>
                      {student.percentage >= 75 ? '✓ Good' : student.percentage >= 50 ? '⚠ Warning' : '✗ At Risk'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const styles = {
  chartSection: {
    background: 'white',
    padding: '25px',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    marginBottom: '20px'
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px',
    color: '#666',
    fontSize: '16px'
  },
  tableContainer: {
    overflowX: 'auto',
    marginTop: '15px'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: '600px'
  },
  th: {
    background: '#f8f9fa',
    padding: '12px',
    textAlign: 'left',
    fontWeight: '600',
    borderBottom: '2px solid #dee2e6',
    whiteSpace: 'nowrap'
  },
  tr: {
    borderBottom: '1px solid #dee2e6',
    transition: 'background 0.2s'
  },
  td: {
    padding: '12px'
  }
};