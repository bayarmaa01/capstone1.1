const db = require('../db');

class RiskModel {
  constructor() {
    this.riskThresholds = {
      high: 0.7,
      medium: 0.4,
      low: 0.0
    };
  }

  /**
   * Calculate attendance risk for a student
   * @param {number} studentId - Student ID
   * @param {number} classId - Class ID (optional)
   * @param {number} days - Number of days to analyze (default: 30)
   */
  async calculateStudentRisk(studentId, classId = null, days = 30) {
    try {
      const query = classId 
        ? `SELECT student_id, session_date, present, class_id
           FROM attendance 
           WHERE student_id = $1 AND class_id = $2 
             AND session_date >= NOW() - INTERVAL '${days} days'
           ORDER BY session_date DESC`
        : `SELECT student_id, session_date, present, class_id
           FROM attendance 
           WHERE student_id = $1 
             AND session_date >= NOW() - INTERVAL '${days} days'
           ORDER BY session_date DESC`;

      const result = await db.query(query, classId ? [studentId, classId] : [studentId]);
      const attendanceRecords = result.rows;

      if (attendanceRecords.length === 0) {
        return {
          studentId,
          riskScore: 0.5,
          riskLevel: 'medium',
          attendanceRate: 0,
          factors: ['No attendance data available'],
          recommendations: ['Start tracking attendance regularly'],
          predictionDate: new Date()
        };
      }

      const attendanceRate = attendanceRecords.filter(r => r.present).length / attendanceRecords.length;
      
      // Calculate risk factors
      const riskFactors = this.analyzeRiskFactors(attendanceRecords);
      
      // Calculate overall risk score
      let riskScore = this.calculateRiskScore(attendanceRate, riskFactors);
      
      // Get risk level
      const riskLevel = this.getRiskLevel(riskScore);
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(riskLevel, riskFactors);

      return {
        studentId,
        riskScore: Math.round(riskScore * 100) / 100,
        riskLevel,
        attendanceRate: Math.round(attendanceRate * 100) / 100,
        totalSessions: attendanceRecords.length,
        presentSessions: attendanceRecords.filter(r => r.present).length,
        factors: riskFactors,
        recommendations,
        predictionDate: new Date()
      };
    } catch (error) {
      console.error('Error calculating student risk:', error);
      throw error;
    }
  }

  /**
   * Analyze risk factors for attendance patterns
   */
  analyzeRiskFactors(records) {
    const factors = [];
    
    if (records.length === 0) return factors;

    // 1. Low attendance rate
    const attendanceRate = records.filter(r => r.present).length / records.length;
    if (attendanceRate < 0.6) {
      factors.push(`Low attendance rate (${Math.round(attendanceRate * 100)}%)`);
    } else if (attendanceRate < 0.75) {
      factors.push(`Moderate attendance rate (${Math.round(attendanceRate * 100)}%)`);
    }

    // 2. Consecutive absences
    let consecutiveAbsences = 0;
    for (let i = records.length - 1; i >= 0; i--) {
      if (!records[i].present) {
        consecutiveAbsences++;
      } else {
        break;
      }
    }
    
    if (consecutiveAbsences >= 3) {
      factors.push(`${consecutiveAbsences} consecutive absences`);
    }

    // 3. Declining trend
    if (records.length >= 10) {
      const firstHalf = records.slice(-10, -5);
      const secondHalf = records.slice(-5);
      
      const firstHalfRate = firstHalf.filter(r => r.present).length / firstHalf.length;
      const secondHalfRate = secondHalf.filter(r => r.present).length / secondHalf.length;
      
      if (secondHalfRate < firstHalfRate - 0.2) {
        factors.push('Declining attendance trend');
      }
    }

    // 4. Day of week patterns
    const dayPatterns = this.analyzeDayPatterns(records);
    if (dayPatterns.riskyDays.length > 0) {
      factors.push(`Consistent absences on ${dayPatterns.riskyDays.join(', ')}`);
    }

    // 5. Recent sudden drop
    if (records.length >= 8) {
      const recent = records.slice(-4);
      const previous = records.slice(-8, -4);
      
      const recentRate = recent.filter(r => r.present).length / recent.length;
      const previousRate = previous.filter(r => r.present).length / previous.length;
      
      if (previousRate > 0.8 && recentRate < 0.4) {
        factors.push('Recent sudden drop in attendance');
      }
    }

    return factors;
  }

  /**
   * Calculate overall risk score based on factors
   */
  calculateRiskScore(attendanceRate, factors) {
    let riskScore = 0;

    // Base score from attendance rate
    if (attendanceRate < 0.6) {
      riskScore += 0.4;
    } else if (attendanceRate < 0.75) {
      riskScore += 0.2;
    }

    // Add risk for each factor
    factors.forEach(factor => {
      if (factor.includes('consecutive')) riskScore += 0.15;
      if (factor.includes('declining')) riskScore += 0.1;
      if (factor.includes('sudden drop')) riskScore += 0.2;
      if (factor.includes('Low attendance')) riskScore += 0.1;
      if (factor.includes('Moderate attendance')) riskScore += 0.05;
      if (factor.includes('Consistent absences')) riskScore += 0.05;
    });

    return Math.min(riskScore, 1.0);
  }

  /**
   * Analyze day of week patterns
   */
  analyzeDayPatterns(records) {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayStats = {};

    // Initialize day stats
    for (let i = 0; i < 7; i++) {
      dayStats[i] = { present: 0, total: 0 };
    }

    // Count attendance by day
    records.forEach(record => {
      const day = new Date(record.session_date).getDay();
      dayStats[day].total++;
      if (record.present) dayStats[day].present++;
    });

    // Find risky days (less than 50% attendance with at least 3 records)
    const riskyDays = [];
    for (let i = 0; i < 7; i++) {
      if (dayStats[i].total >= 3) {
        const rate = dayStats[i].present / dayStats[i].total;
        if (rate < 0.5) {
          riskyDays.push(dayNames[i]);
        }
      }
    }

    return { dayStats, riskyDays };
  }

  /**
   * Get risk level based on score
   */
  getRiskLevel(score) {
    if (score >= this.riskThresholds.high) return 'high';
    if (score >= this.riskThresholds.medium) return 'medium';
    return 'low';
  }

  /**
   * Generate recommendations based on risk level and factors
   */
  generateRecommendations(riskLevel, factors) {
    const recommendations = [];

    if (riskLevel === 'high') {
      recommendations.push('Immediate academic counseling required');
      recommendations.push('Schedule meeting with academic advisor');
      recommendations.push('Consider temporary course load reduction');
      recommendations.push('Implement daily attendance monitoring');
      
      if (factors.some(f => f.includes('consecutive'))) {
        recommendations.push('Contact student immediately to check wellbeing');
      }
    } else if (riskLevel === 'medium') {
      recommendations.push('Weekly progress check-ins');
      recommendations.push('Peer mentoring program enrollment');
      recommendations.push('Study skills workshop attendance');
      recommendations.push('Extended office hours utilization');
      
      if (factors.some(f => f.includes('declining'))) {
        recommendations.push('Monitor attendance trends closely');
      }
    } else {
      recommendations.push('Maintain current engagement level');
      recommendations.push('Consider advanced coursework');
      recommendations.push('Participate in research opportunities');
    }

    // Factor-specific recommendations
    if (factors.some(f => f.includes('Monday'))) {
      recommendations.push('Address Monday motivation issues');
    }
    if (factors.some(f => f.includes('Friday'))) {
      recommendations.push('Ensure Friday class completion');
    }

    return recommendations;
  }

  /**
   * Get class-wide risk analysis
   */
  async getClassRiskAnalysis(classId, days = 30) {
    try {
      // Get all students in the class
      const studentsQuery = `
        SELECT DISTINCT student_id 
        FROM attendance 
        WHERE class_id = $1 AND session_date >= NOW() - INTERVAL '${days} days'
      `;
      const studentsResult = await db.query(studentsQuery, [classId]);
      
      const studentIds = studentsResult.rows.map(row => row.student_id);
      
      // Calculate risk for each student
      const riskAnalyses = [];
      for (const studentId of studentIds) {
        const riskAnalysis = await this.calculateStudentRisk(studentId, classId, days);
        riskAnalyses.push(riskAnalysis);
      }

      // Class statistics
      const highRiskCount = riskAnalyses.filter(r => r.riskLevel === 'high').length;
      const mediumRiskCount = riskAnalyses.filter(r => r.riskLevel === 'medium').length;
      const lowRiskCount = riskAnalyses.filter(r => r.riskLevel === 'low').length;
      
      const avgAttendanceRate = riskAnalyses.reduce((sum, r) => sum + r.attendanceRate, 0) / riskAnalyses.length;

      return {
        classId,
        totalStudents: riskAnalyses.length,
        riskDistribution: {
          high: highRiskCount,
          medium: mediumRiskCount,
          low: lowRiskCount
        },
        averageAttendanceRate: Math.round(avgAttendanceRate * 100) / 100,
        studentRisks: riskAnalyses.sort((a, b) => b.riskScore - a.riskScore),
        analysisDate: new Date()
      };
    } catch (error) {
      console.error('Error calculating class risk analysis:', error);
      throw error;
    }
  }

  /**
   * Get risk trends over time
   */
  async getRiskTrends(studentId, classId = null, weeks = 4) {
    try {
      const trends = [];
      
      for (let i = weeks - 1; i >= 0; i--) {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - (i * 7));
        weekStart.setHours(0, 0, 0, 0);
        
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        const query = classId
          ? `SELECT COUNT(*) as total, SUM(CASE WHEN present = true THEN 1 ELSE 0 END) as present
             FROM attendance 
             WHERE student_id = $1 AND class_id = $2 
               AND session_date BETWEEN $3 AND $4`
          : `SELECT COUNT(*) as total, SUM(CASE WHEN present = true THEN 1 ELSE 0 END) as present
             FROM attendance 
             WHERE student_id = $1 
               AND session_date BETWEEN $2 AND $3`;

        const params = classId 
          ? [studentId, classId, weekStart, weekEnd]
          : [studentId, weekStart, weekEnd];

        const result = await db.query(query, params);
        const { total, present } = result.rows[0];

        if (total > 0) {
          const attendanceRate = present / total;
          const weekRisk = await this.calculateStudentRisk(studentId, classId, 7);
          
          trends.push({
            week: weeks - i,
            weekStart,
            weekEnd,
            attendanceRate: Math.round(attendanceRate * 100) / 100,
            riskScore: weekRisk.riskScore,
            riskLevel: weekRisk.riskLevel
          });
        }
      }

      return trends;
    } catch (error) {
      console.error('Error calculating risk trends:', error);
      throw error;
    }
  }
}

module.exports = new RiskModel();
