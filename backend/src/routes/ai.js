const express = require('express');
const router = express.Router();
const attendancePredictor = require('../ai/attendance_predictor');
const { requireTeacher } = require('../middleware/auth');

// Train prediction model for a class
router.post('/train-model/:classId', requireTeacher, async (req, res) => {
  try {
    const { classId } = req.params;
    
    const model = await attendancePredictor.trainModel(classId);
    res.json({ 
      success: true, 
      message: 'Model trained successfully',
      model: {
        classId: model.classId,
        trainedAt: model.trainedAt,
        featuresCount: Object.keys(model.features).length
      }
    });
  } catch (error) {
    console.error('Model training error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Predict risk students for a class
router.get('/predict-risk/:classId', requireTeacher, async (req, res) => {
  try {
    const { classId } = req.params;
    const { futureDays = 7 } = req.query;
    
    const riskPredictions = await attendancePredictor.predictRiskStudents(
      classId, 
      parseInt(futureDays)
    );
    
    res.json({ 
      success: true, 
      data: riskPredictions,
      summary: {
        total: riskPredictions.length,
        highRisk: riskPredictions.filter(p => p.riskLevel === 'high').length,
        mediumRisk: riskPredictions.filter(p => p.riskLevel === 'medium').length,
        lowRisk: riskPredictions.filter(p => p.riskLevel === 'low').length
      }
    });
  } catch (error) {
    console.error('Risk prediction error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Detect attendance anomalies
router.get('/detect-anomalies/:classId', requireTeacher, async (req, res) => {
  try {
    const { classId } = req.params;
    
    const anomalies = await attendancePredictor.detectAnomalies(classId);
    
    res.json({ 
      success: true, 
      data: anomalies,
      summary: {
        total: anomalies.length,
        highSeverity: anomalies.filter(a => a.severity === 'high').length,
        mediumSeverity: anomalies.filter(a => a.severity === 'medium').length,
        lowSeverity: anomalies.filter(a => a.severity === 'low').length
      }
    });
  } catch (error) {
    console.error('Anomaly detection error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get AI insights for a class
router.get('/insights/:classId', requireTeacher, async (req, res) => {
  try {
    const { classId } = req.params;
    
    // Get all AI predictions and anomalies
    const [riskPredictions, anomalies] = await Promise.all([
      attendancePredictor.predictRiskStudents(classId, 7),
      attendancePredictor.detectAnomalies(classId)
    ]);
    
    // Generate insights
    const insights = {
      riskStudents: riskPredictions.filter(p => p.riskLevel === 'high').slice(0, 5),
      criticalAnomalies: anomalies.filter(a => a.severity === 'high').slice(0, 5),
      recommendations: this.generateRecommendations(riskPredictions, anomalies),
      overallRiskLevel: this.calculateOverallRisk(riskPredictions)
    };
    
    res.json({ 
      success: true, 
      data: insights
    });
  } catch (error) {
    console.error('AI insights error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate recommendations based on AI analysis
function generateRecommendations(riskPredictions, anomalies) {
  const recommendations = [];
  
  // High number of at-risk students
  const highRiskCount = riskPredictions.filter(p => p.riskLevel === 'high').length;
  if (highRiskCount > 5) {
    recommendations.push({
      type: 'intervention',
      priority: 'high',
      title: 'Multiple High-Risk Students Detected',
      description: `Found ${highRiskCount} students at high risk. Consider implementing early intervention strategies.`,
      action: 'Schedule individual meetings with at-risk students'
    });
  }
  
  // Consecutive absence patterns
  const consecutiveAnomalies = anomalies.filter(a => a.type === 'consecutive_absences');
  if (consecutiveAnomalies.length > 3) {
    recommendations.push({
      type: 'pattern',
      priority: 'medium',
      title: 'Consecutive Absence Pattern Detected',
      description: 'Multiple students showing consecutive absence patterns. May indicate broader issues.',
      action: 'Review class schedule and content engagement'
    });
  }
  
  // Sudden drops
  const suddenDrops = anomalies.filter(a => a.type === 'sudden_drop');
  if (suddenDrops.length > 0) {
    recommendations.push({
      type: 'alert',
      priority: 'high',
      title: 'Sudden Attendance Drops Detected',
      description: 'Some students have shown sudden drops in attendance. Immediate attention recommended.',
      action: 'Contact affected students immediately'
    });
  }
  
  return recommendations;
}

// Calculate overall risk level for the class
function calculateOverallRisk(riskPredictions) {
  if (riskPredictions.length === 0) return 'low';
  
  const avgRiskScore = riskPredictions.reduce((sum, p) => sum + p.riskScore, 0) / riskPredictions.length;
  
  if (avgRiskScore >= 0.6) return 'high';
  if (avgRiskScore >= 0.3) return 'medium';
  return 'low';
}

module.exports = router;
