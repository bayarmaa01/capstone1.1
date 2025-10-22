import React from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

export default function AttendanceChart({ stats, dates }) {
  
  if (!stats || stats.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
        <p>No attendance data yet. Take attendance to see charts.</p>
      </div>
    );
  }

  // Prepare data for charts
  const attendanceData = stats.map(student => ({
    name: student.name.length > 15 ? student.name.substring(0, 15) + '...' : student.name,
    percentage: parseFloat(student.attendance_percentage) || 0,
    present: parseInt(student.total_present) || 0,
    absent: (parseInt(student.total_sessions) || 0) - (parseInt(student.total_present) || 0)
  }));

  // Color based on percentage
  const getColor = (percentage) => {
    if (percentage >= 75) return '#28a745';
    if (percentage >= 50) return '#ffc107';
    return '#dc3545';
  };

  // Summary data for pie chart
  const summary = [
    { 
      name: 'Good (≥75%)', 
      value: stats.filter(s => parseFloat(s.attendance_percentage) >= 75).length, 
      color: '#28a745' 
    },
    { 
      name: 'Warning (50-74%)', 
      value: stats.filter(s => {
        const p = parseFloat(s.attendance_percentage);
        return p >= 50 && p < 75;
      }).length, 
      color: '#ffc107' 
    },
    { 
      name: 'At Risk (<50%)', 
      value: stats.filter(s => parseFloat(s.attendance_percentage) < 50).length, 
      color: '#dc3545' 
    }
  ].filter(item => item.value > 0); // Only show categories with data

  // Trend over time
  const trendData = dates ? dates.map(date => ({
    date: new Date(date.session_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    attendance: Math.round((date.present_count / date.total_students) * 100)
  })) : [];

  return (
    <div>
      {/* Bar Chart - Individual Student Performance */}
      <div style={styles.chartSection}>
        <h3>📊 Student Attendance Percentage</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={attendanceData} margin={{ bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="name" 
              angle={-45} 
              textAnchor="end" 
              height={100}
              interval={0}
            />
            <YAxis domain={[0, 100]} label={{ value: 'Percentage', angle: -90, position: 'insideLeft' }} />
            <Tooltip />
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
          <h3>📈 Attendance Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={[0, 100]} label={{ value: 'Percentage', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="attendance" 
                stroke="#667eea" 
                strokeWidth={2} 
                name="Class Attendance %"
                dot={{ r: 5 }}
                activeDot={{ r: 8 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Detailed Table */}
      <div style={styles.chartSection}>
        <h3>📋 Detailed Statistics</h3>
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Student</th>
                <th style={styles.th}>Present</th>
                <th style={styles.th}>Absent</th>
                <th style={styles.th}>Total</th>
                <th style={styles.th}>%</th>
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
                  <td style={{...styles.td, color: getColor(student.percentage), fontWeight: 'bold'}}>
                    {student.percentage.toFixed(1)}%
                  </td>
                  <td style={styles.td}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontSize: '12px',
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
  tableWrapper: {
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
    borderBottom: '1px solid #dee2e6'
  },
  td: {
    padding: '12px'
  }
};