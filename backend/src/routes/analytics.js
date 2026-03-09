const express = require('express');
const router = express.Router();
const analyticsService = require('../services/analytics');
const { requireAuth } = require('../middleware/auth');
const db = require('../db');

// Get attendance trends for a class
router.get('/attendance-trends/:classId', requireAuth, async (req, res) => {
  try {
    const { classId } = req.params;
    const { period = '30d' } = req.query;
    
    const trends = await analyticsService.getAttendanceTrends(classId, period);
    res.json({ success: true, data: trends });
  } catch (error) {
    console.error('Attendance trends error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get risk students (below threshold)
router.get('/risk-students', requireAuth, async (req, res) => {
  try {
    const { threshold = 75, classId } = req.query;
    
    let riskStudents;
    if (classId) {
      // Get risk students for specific class
      const query = `
        SELECT 
          s.id,
          s.student_id,
          s.name,
          s.email,
          COUNT(*) as total_sessions,
          COUNT(CASE WHEN a.present = true THEN 1 END) as present_sessions,
          ROUND(
            (COUNT(CASE WHEN a.present = true THEN 1 END) * 100.0 / COUNT(*)), 2
          ) as attendance_percentage
        FROM students s
        JOIN attendance a ON s.id = a.student_id
        WHERE a.class_id = $1 
          AND a.session_date >= NOW() - INTERVAL '30 days'
        GROUP BY s.id, s.student_id, s.name, s.email
        HAVING attendance_percentage < $2
        ORDER BY attendance_percentage ASC
      `;
      const result = await db.query(query, [classId, threshold]);
      riskStudents = result.rows;
    } else {
      // Get all risk students
      riskStudents = await analyticsService.getRiskStudents(threshold);
    }
    
    res.json({ success: true, data: riskStudents });
  } catch (error) {
    console.error('Risk students error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get section summary
router.get('/section-summary/:classId', requireAuth, async (req, res) => {
  try {
    const { classId } = req.params;
    
    const summary = await analyticsService.getSectionSummary(classId);
    res.json({ success: true, data: summary });
  } catch (error) {
    console.error('Section summary error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get weekly attendance patterns
router.get('/weekly-attendance/:classId', requireAuth, async (req, res) => {
  try {
    const { classId } = req.params;
    
    const weeklyData = await analyticsService.getWeeklyAttendance(classId);
    res.json({ success: true, data: weeklyData });
  } catch (error) {
    console.error('Weekly attendance error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get monthly attendance trends
router.get('/monthly-attendance/:classId', requireAuth, async (req, res) => {
  try {
    const { classId } = req.params;
    
    const monthlyData = await analyticsService.getMonthlyAttendance(classId);
    res.json({ success: true, data: monthlyData });
  } catch (error) {
    console.error('Monthly attendance error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get attendance heatmap data
router.get('/heatmap/:classId', requireAuth, async (req, res) => {
  try {
    const { classId } = req.params;
    
    const heatmapData = await analyticsService.getAttendanceHeatmap(classId);
    res.json({ success: true, data: heatmapData });
  } catch (error) {
    console.error('Attendance heatmap error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get attendance method distribution
router.get('/method-distribution/:classId', requireAuth, async (req, res) => {
  try {
    const { classId } = req.params;
    
    const methodData = await analyticsService.getMethodDistribution(classId);
    res.json({ success: true, data: methodData });
  } catch (error) {
    console.error('Method distribution error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get top performers
router.get('/top-performers/:classId', requireAuth, async (req, res) => {
  try {
    const { classId } = req.params;
    const { limit = 10 } = req.query;
    
    const topPerformers = await analyticsService.getTopPerformers(classId, parseInt(limit));
    res.json({ success: true, data: topPerformers });
  } catch (error) {
    console.error('Top performers error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get dashboard overview
router.get('/dashboard/:classId', requireAuth, async (req, res) => {
  try {
    const { classId } = req.params;
    
    // Get all dashboard data in parallel
    const [summary, trends, riskStudents, methodDistribution] = await Promise.all([
      analyticsService.getSectionSummary(classId),
      analyticsService.getAttendanceTrends(classId, '7d'),
      analyticsService.getRiskStudents(75),
      analyticsService.getMethodDistribution(classId)
    ]);
    
    res.json({
      success: true,
      data: {
        summary,
        trends,
        riskStudents,
        methodDistribution
      }
    });
  } catch (error) {
    console.error('Dashboard overview error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
