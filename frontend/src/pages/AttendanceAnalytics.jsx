import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { PieChart, PieCell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function AttendanceAnalytics() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState({ total: 0, present: 0, absent: 0, percentage: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, present, absent
  const [showCharts, setShowCharts] = useState(true);

  useEffect(() => {
    if (sessionId) {
      fetchSessionData();
    }
  }, [sessionId]);

  const fetchSessionData = async () => {
    try {
      setLoading(true);
      
      // Fetch session details
      const sessionResponse = await api.get(`/attendance/session/${sessionId}`);
      setSession(sessionResponse.data.session);
      
      // Fetch attendance records
      const recordsResponse = await api.get(`/attendance/session/${sessionId}/records`);
      setRecords(recordsResponse.data.records);
      setStats(recordsResponse.data.stats);
      
    } catch (error) {
      console.error('Error fetching session data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = records.filter(record => {
    if (filter === 'all') return true;
    return record.status === filter;
  });

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{ color: 'white', fontSize: '24px', fontWeight: '600' }}>
          Loading attendance analytics...
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{ color: 'white', fontSize: '24px', fontWeight: '600' }}>
          Session not found
        </div>
      </div>
    );
  }

  const pieData = [
    { name: 'Present', value: stats.present, color: '#10b981' },
    { name: 'Absent', value: stats.absent, color: '#ef4444' }
  ];

  const barData = records.map(record => ({
    name: record.student_name,
    present: record.status === 'present' ? 1 : 0,
    absent: record.status === 'absent' ? 1 : 0
  }));

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#f5f5f5',
      padding: '20px'
    }}>
      {/* Header */}
      <div style={{
        background: 'white',
        borderRadius: '15px',
        padding: '25px',
        marginBottom: '20px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, color: '#1a202c', fontSize: '28px', fontWeight: '700' }}>
              Attendance Analytics
            </h1>
            <p style={{ margin: '5px 0 0 0', color: '#64748b', fontSize: '16px' }}>
              {session.class_name} - {new Date(session.session_date).toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          </div>
          <button
            onClick={() => navigate(-1)}
            style={{
              padding: '10px 20px',
              background: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Back
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '20px' }}>
        <div style={{
          background: 'white',
          padding: '25px',
          borderRadius: '15px',
          textAlign: 'center',
          boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '36px', fontWeight: '700', color: '#10b981', marginBottom: '10px' }}>
            {stats.total}
          </div>
          <div style={{ fontSize: '16px', color: '#64748b', fontWeight: '500' }}>
            Total Students
          </div>
        </div>
        
        <div style={{
          background: 'white',
          padding: '25px',
          borderRadius: '15px',
          textAlign: 'center',
          boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '36px', fontWeight: '700', color: '#059669', marginBottom: '10px' }}>
            {stats.present}
          </div>
          <div style={{ fontSize: '16px', color: '#64748b', fontWeight: '500' }}>
            Present
          </div>
        </div>
        
        <div style={{
          background: 'white',
          padding: '25px',
          borderRadius: '15px',
          textAlign: 'center',
          boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '36px', fontWeight: '700', color: '#dc2626', marginBottom: '10px' }}>
            {stats.absent}
          </div>
          <div style={{ fontSize: '16px', color: '#64748b', fontWeight: '500' }}>
            Absent
          </div>
        </div>
        
        <div style={{
          background: 'white',
          padding: '25px',
          borderRadius: '15px',
          textAlign: 'center',
          boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '36px', fontWeight: '700', color: '#10b981', marginBottom: '10px' }}>
            {stats.percentage}%
          </div>
          <div style={{ fontSize: '16px', color: '#64748b', fontWeight: '500' }}>
            Attendance Rate
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div style={{
        background: 'white',
        borderRadius: '15px',
        padding: '25px',
        marginBottom: '20px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, color: '#1a202c', fontSize: '22px', fontWeight: '700' }}>
            Attendance Charts
          </h2>
          <button
            onClick={() => setShowCharts(!showCharts)}
            style={{
              padding: '8px 16px',
              background: showCharts ? '#6b7280' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            {showCharts ? 'Hide Charts' : 'Show Charts'}
          </button>
        </div>

        {showCharts && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
            {/* Pie Chart */}
            <div style={{
              background: '#f8fafc',
              padding: '20px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0'
            }}>
              <h3 style={{ margin: '0 0 15px 0', color: '#374151', fontSize: '18px', fontWeight: '600' }}>
                Present vs Absent
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${entry.value}`}
                    outerRadius={80}
                    fill="#8884d8"
                  >
                    <PieCell fill="#8884d8" dataKey="color" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Bar Chart */}
            <div style={{
              background: '#f8fafc',
              padding: '20px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0'
            }}>
              <h3 style={{ margin: '0 0 15px 0', color: '#374151', fontSize: '18px', fontWeight: '600' }}>
                Student Attendance
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="present" fill="#10b981" name="Present" />
                  <Bar dataKey="absent" fill="#ef4444" name="Absent" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Records Table */}
      <div style={{
        background: 'white',
        borderRadius: '15px',
        padding: '25px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, color: '#1a202c', fontSize: '22px', fontWeight: '700' }}>
            Attendance Records
          </h2>
          
          {/* Filter Buttons */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setFilter('all')}
              style={{
                padding: '8px 16px',
                background: filter === 'all' ? '#10b981' : '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              All ({records.length})
            </button>
            <button
              onClick={() => setFilter('present')}
              style={{
                padding: '8px 16px',
                background: filter === 'present' ? '#10b981' : '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Present ({stats.present})
            </button>
            <button
              onClick={() => setFilter('absent')}
              style={{
                padding: '8px 16px',
                background: filter === 'absent' ? '#10b981' : '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Absent ({stats.absent})
            </button>
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            backgroundColor: 'white',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc' }}>
                <th style={{ 
                  padding: '12px', 
                  textAlign: 'left', 
                  borderBottom: '2px solid #e2e8f0',
                  color: '#374151',
                  fontWeight: '600',
                  fontSize: '14px'
                }}>
                  Student Name
                </th>
                <th style={{ 
                  padding: '12px', 
                  textAlign: 'left', 
                  borderBottom: '2px solid #e2e8f0',
                  color: '#374151',
                  fontWeight: '600',
                  fontSize: '14px'
                }}>
                  Status
                </th>
                <th style={{ 
                  padding: '12px', 
                  textAlign: 'left', 
                  borderBottom: '2px solid #e2e8f0',
                  color: '#374151',
                  fontWeight: '600',
                  fontSize: '14px'
                }}>
                  Method
                </th>
                <th style={{ 
                  padding: '12px', 
                  textAlign: 'left', 
                  borderBottom: '2px solid #e2e8f0',
                  color: '#374151',
                  fontWeight: '600',
                  fontSize: '14px'
                }}>
                  Time
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record, index) => (
                <tr key={record.student_id} style={{
                  backgroundColor: index % 2 === 0 ? '#f8fafc' : 'white',
                  borderBottom: '1px solid #e2e8f0'
                }}>
                  <td style={{ 
                    padding: '12px', 
                    color: '#374151',
                    fontSize: '14px'
                  }}>
                    {record.student_name}
                  </td>
                  <td style={{ 
                    padding: '12px',
                    fontSize: '14px'
                  }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '600',
                      backgroundColor: record.status === 'present' ? '#d1fae5' : '#fee2e2',
                      color: record.status === 'present' ? '#065f46' : '#92400e'
                    }}>
                      {record.status === 'present' ? 'Present' : 'Absent'}
                    </span>
                  </td>
                  <td style={{ 
                    padding: '12px',
                    fontSize: '14px'
                  }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      backgroundColor: 
                        record.method === 'face' ? '#dbeafe' :
                        record.method === 'qr' ? '#fef3c7' :
                        record.method === 'manual' ? '#e0e7ff' : '#f3f4f6',
                      color: '#374151'
                    }}>
                      {record.method ? record.method.charAt(0).toUpperCase() + record.method.slice(1) : 'N/A'}
                    </span>
                  </td>
                  <td style={{ 
                    padding: '12px', 
                    color: '#64748b',
                    fontSize: '14px'
                  }}>
                    {new Date(record.timestamp).toLocaleString()}
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
