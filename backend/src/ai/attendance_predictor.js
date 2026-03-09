const db = require('../db');

class AttendancePredictor {
  constructor() {
    this.model = null;
    this.isTrained = false;
  }

  async prepareTrainingData(classId, days = 90) {
    try {
      const query = `
        SELECT 
          a.student_id,
          a.session_date,
          a.present,
          EXTRACT(DOW FROM a.session_date) as day_of_week,
          EXTRACT(MONTH FROM a.session_date) as month,
          EXTRACT(WEEK FROM a.session_date) as week_of_year,
          CASE WHEN a.session_date < CURRENT_DATE THEN 1 ELSE 0 END as is_past,
          LAG(a.present) OVER (PARTITION BY a.student_id ORDER BY a.session_date) as previous_attendance,
          COUNT(CASE WHEN a.present = true THEN 1 END) OVER (
            PARTITION BY a.student_id 
            ORDER BY a.session_date 
            ROWS BETWEEN 6 PRECEDING AND 1 PRECEDING
          ) as last_7_days_attendance,
          COUNT(CASE WHEN a.present = true THEN 1 END) OVER (
            PARTITION BY a.student_id 
            ORDER BY a.session_date 
            ROWS BETWEEN 29 PRECEDING AND 1 PRECEDING
          ) as last_30_days_attendance
        FROM attendance a
        WHERE a.class_id = $1 
          AND a.session_date >= NOW() - INTERVAL '${days} days'
        ORDER BY a.student_id, a.session_date
      `;
      
      const result = await db.query(query, [classId]);
      return result.rows;
    } catch (error) {
      console.error('Error preparing training data:', error);
      throw error;
    }
  }

  async trainModel(classId) {
    try {
      console.log('🤖 Training attendance prediction model...');
      
      const trainingData = await this.prepareTrainingData(classId);
      
      if (trainingData.length < 30) {
        throw new Error('Insufficient data for training (minimum 30 records required)');
      }

      // Simple rule-based model (can be replaced with scikit-learn)
      this.model = {
        classId,
        trainedAt: new Date(),
        features: this.extractFeatures(trainingData),
        rules: this.generateRules(trainingData)
      };
      
      this.isTrained = true;
      console.log('✅ Model training completed');
      
      return this.model;
    } catch (error) {
      console.error('❌ Model training error:', error);
      throw error;
    }
  }

  extractFeatures(data) {
    const features = {
      dayOfWeekPatterns: {},
      monthlyPatterns: {},
      attendanceTrends: {},
      studentPatterns: {}
    };

    // Analyze day of week patterns
    data.forEach(record => {
      const dayOfWeek = parseInt(record.day_of_week);
      if (!features.dayOfWeekPatterns[dayOfWeek]) {
        features.dayOfWeekPatterns[dayOfWeek] = { present: 0, total: 0 };
      }
      features.dayOfWeekPatterns[dayOfWeek].total++;
      if (record.present) features.dayOfWeekPatterns[dayOfWeek].present++;
    });

    // Analyze monthly patterns
    data.forEach(record => {
      const month = parseInt(record.month);
      if (!features.monthlyPatterns[month]) {
        features.monthlyPatterns[month] = { present: 0, total: 0 };
      }
      features.monthlyPatterns[month].total++;
      if (record.present) features.monthlyPatterns[month].present++;
    });

    // Analyze student patterns
    data.forEach(record => {
      if (!features.studentPatterns[record.student_id]) {
        features.studentPatterns[record.student_id] = { 
          present: 0, 
          total: 0, 
          recentTrend: [] 
        };
      }
      features.studentPatterns[record.student_id].total++;
      if (record.present) features.studentPatterns[record.student_id].present++;
      features.studentPatterns[record.student_id].recentTrend.push(record.present);
    });

    return features;
  }

  generateRules(data) {
    const rules = {
      highRiskThreshold: 0.6,
      mediumRiskThreshold: 0.75,
      consecutiveAbsencesRisk: 3,
      decliningTrendRisk: 0.1
    };

    return rules;
  }

  async predictRiskStudents(classId, futureDays = 7) {
    try {
      if (!this.isTrained || this.model.classId !== classId) {
        await this.trainModel(classId);
      }

      const recentData = await this.prepareTrainingData(classId, 30);
      const riskPredictions = [];

      // Group by student
      const studentData = {};
      recentData.forEach(record => {
        if (!studentData[record.student_id]) {
          studentData[record.student_id] = [];
        }
        studentData[record.student_id].push(record);
      });

      // Predict risk for each student
      for (const [studentId, records] of Object.entries(studentData)) {
        const prediction = this.calculateRiskScore(records, studentId);
        riskPredictions.push(prediction);
      }

      return riskPredictions.sort((a, b) => b.riskScore - a.riskScore);
    } catch (error) {
      console.error('Error predicting risk students:', error);
      throw error;
    }
  }

  calculateRiskScore(studentRecords, studentId) {
    const recentRecords = studentRecords.slice(-14); // Last 14 days
    const attendanceRate = recentRecords.filter(r => r.present).length / recentRecords.length;
    
    let riskScore = 0;
    let riskFactors = [];

    // Low attendance rate
    if (attendanceRate < 0.6) {
      riskScore += 0.4;
      riskFactors.push('Low attendance rate');
    } else if (attendanceRate < 0.75) {
      riskScore += 0.2;
      riskFactors.push('Moderate attendance rate');
    }

    // Consecutive absences
    let consecutiveAbsences = 0;
    for (let i = recentRecords.length - 1; i >= 0; i--) {
      if (!recentRecords[i].present) {
        consecutiveAbsences++;
      } else {
        break;
      }
    }
    
    if (consecutiveAbsences >= 3) {
      riskScore += 0.3;
      riskFactors.push('Recent consecutive absences');
    }

    // Declining trend
    const firstHalf = recentRecords.slice(0, Math.floor(recentRecords.length / 2));
    const secondHalf = recentRecords.slice(Math.floor(recentRecords.length / 2));
    
    const firstHalfRate = firstHalf.filter(r => r.present).length / firstHalf.length;
    const secondHalfRate = secondHalf.filter(r => r.present).length / secondHalf.length;
    
    if (secondHalfRate < firstHalfRate - 0.2) {
      riskScore += 0.2;
      riskFactors.push('Declining attendance trend');
    }

    // Day of week patterns
    const dayOfWeekRisk = this.analyzeDayOfWeekRisk(recentRecords);
    if (dayOfWeekRisk > 0.7) {
      riskScore += 0.1;
      riskFactors.push('Problematic day patterns');
    }

    return {
      studentId: parseInt(studentId),
      riskScore: Math.min(riskScore, 1.0),
      riskLevel: this.getRiskLevel(riskScore),
      attendanceRate: attendanceRate,
      consecutiveAbsences,
      riskFactors,
      predictionDate: new Date()
    };
  }

  analyzeDayOfWeekRisk(records) {
    const dayPatterns = {};
    records.forEach(record => {
      const dayOfWeek = parseInt(record.day_of_week);
      if (!dayPatterns[dayOfWeek]) {
        dayPatterns[dayOfWeek] = { present: 0, total: 0 };
      }
      dayPatterns[dayOfWeek].total++;
      if (record.present) dayPatterns[dayOfWeek].present++;
    });

    const riskDays = Object.values(dayPatterns).filter(
      pattern => pattern.total >= 3 && (pattern.present / pattern.total) < 0.5
    );

    return riskDays.length / 7; // Proportion of risky days
  }

  getRiskLevel(score) {
    if (score >= 0.7) return 'high';
    if (score >= 0.4) return 'medium';
    return 'low';
  }

  async detectAnomalies(classId) {
    try {
      const query = `
        SELECT 
          student_id,
          session_date,
          present,
          COUNT(*) OVER (PARTITION BY student_id) as total_sessions
        FROM attendance 
        WHERE class_id = $1 
          AND session_date >= NOW() - INTERVAL '30 days'
        ORDER BY student_id, session_date
      `;
      
      const result = await db.query(query, [classId]);
      const anomalies = [];

      // Group by student
      const studentData = {};
      result.rows.forEach(record => {
        if (!studentData[record.student_id]) {
          studentData[record.student_id] = [];
        }
        studentData[record.student_id].push(record);
      });

      // Detect anomalies for each student
      for (const [studentId, records] of Object.entries(studentData)) {
        const studentAnomalies = this.detectStudentAnomalies(records, studentId);
        anomalies.push(...studentAnomalies);
      }

      return anomalies;
    } catch (error) {
      console.error('Error detecting anomalies:', error);
      throw error;
    }
  }

  detectStudentAnomalies(records, studentId) {
    const anomalies = [];
    
    // Sudden drop in attendance
    if (records.length >= 10) {
      const recent = records.slice(-5);
      const previous = records.slice(-10, -5);
      
      const recentRate = recent.filter(r => r.present).length / recent.length;
      const previousRate = previous.filter(r => r.present).length / previous.length;
      
      if (previousRate > 0.8 && recentRate < 0.4) {
        anomalies.push({
          type: 'sudden_drop',
          studentId: parseInt(studentId),
          severity: 'high',
          description: 'Sudden drop in attendance detected',
          previousRate,
          recentRate
        });
      }
    }

    // Unusual absence pattern
    const recentRecords = records.slice(-7);
    const consecutiveAbsences = recentRecords
      .reverse()
      .findIndex(record => record.present);
    
    if (consecutiveAbsences >= 5) {
      anomalies.push({
        type: 'consecutive_absences',
        studentId: parseInt(studentId),
        severity: 'medium',
        description: 'Unusual consecutive absence pattern',
        consecutiveAbsences
      });
    }

    return anomalies;
  }
}

module.exports = new AttendancePredictor();
