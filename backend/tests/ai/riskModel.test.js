const riskModel = require('../../src/ai/riskModel');
const db = require('../../src/db');

// Mock database
jest.mock('../../src/db');

describe('RiskModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateStudentRisk', () => {
    it('should calculate high risk for student with low attendance', async () => {
      const mockRecords = [
        { student_id: 1, session_date: new Date(), present: false },
        { student_id: 1, session_date: new Date(), present: false },
        { student_id: 1, session_date: new Date(), present: true },
        { student_id: 1, session_date: new Date(), present: false },
        { student_id: 1, session_date: new Date(), present: false }
      ];

      db.query.mockResolvedValue({ rows: mockRecords });

      const result = await riskModel.calculateStudentRisk(1, 1, 30);

      expect(result.riskLevel).toBe('high');
      expect(result.riskScore).toBeGreaterThan(0.7);
      expect(result.attendanceRate).toBe(0.4);
      expect(result.factors).toContain('Low attendance rate (40%)');
    });

    it('should calculate low risk for student with high attendance', async () => {
      const mockRecords = [
        { student_id: 1, session_date: new Date(), present: true },
        { student_id: 1, session_date: new Date(), present: true },
        { student_id: 1, session_date: new Date(), present: true },
        { student_id: 1, session_date: new Date(), present: true },
        { student_id: 1, session_date: new Date(), present: true }
      ];

      db.query.mockResolvedValue({ rows: mockRecords });

      const result = await riskModel.calculateStudentRisk(1, 1, 30);

      expect(result.riskLevel).toBe('low');
      expect(result.riskScore).toBeLessThan(0.4);
      expect(result.attendanceRate).toBe(1.0);
    });

    it('should handle no attendance data', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await riskModel.calculateStudentRisk(1, 1, 30);

      expect(result.riskLevel).toBe('medium');
      expect(result.riskScore).toBe(0.5);
      expect(result.attendanceRate).toBe(0);
      expect(result.factors).toContain('No attendance data available');
    });
  });

  describe('getClassRiskAnalysis', () => {
    it('should analyze risk for entire class', async () => {
      // Mock student IDs
      db.query
        .mockResolvedValueOnce({ rows: [{ student_id: 1 }, { student_id: 2 }] })
        .mockResolvedValueOnce({ rows: [{ present: true }] }) // Student 1 data
        .mockResolvedValueOnce({ rows: [{ present: false }] }); // Student 2 data

      // Mock calculateStudentRisk calls
      jest.spyOn(riskModel, 'calculateStudentRisk')
        .mockResolvedValueOnce({ riskLevel: 'low', riskScore: 0.2, attendanceRate: 1.0 })
        .mockResolvedValueOnce({ riskLevel: 'high', riskScore: 0.8, attendanceRate: 0.3 });

      const result = await riskModel.getClassRiskAnalysis(1, 30);

      expect(result.totalStudents).toBe(2);
      expect(result.riskDistribution.low).toBe(1);
      expect(result.riskDistribution.high).toBe(1);
      expect(result.studentRisks).toHaveLength(2);
    });
  });

  describe('getRiskTrends', () => {
    it('should calculate risk trends over time', async () => {
      // Mock weekly data
      db.query
        .mockResolvedValue({ rows: [{ total: 5, present: 4 }] }) // Week 1
        .mockResolvedValue({ rows: [{ total: 5, present: 3 }] }) // Week 2
        .mockResolvedValue({ rows: [{ total: 5, present: 2 }] }) // Week 3
        .mockResolvedValue({ rows: [{ total: 5, present: 1 }] }); // Week 4

      // Mock calculateStudentRisk for trend calculation
      jest.spyOn(riskModel, 'calculateStudentRisk')
        .mockResolvedValue({ riskScore: 0.2, riskLevel: 'low' });

      const result = await riskModel.getRiskTrends(1, null, 4);

      expect(result).toHaveLength(4);
      expect(result[0].attendanceRate).toBe(0.8);
      expect(result[3].attendanceRate).toBe(0.2);
    });
  });

  describe('analyzeRiskFactors', () => {
    it('should identify consecutive absences', () => {
      const records = [
        { present: true, session_date: new Date('2023-01-01') },
        { present: false, session_date: new Date('2023-01-02') },
        { present: false, session_date: new Date('2023-01-03') },
        { present: false, session_date: new Date('2023-01-04') }
      ];

      const factors = riskModel.analyzeRiskFactors(records);

      expect(factors).toContain('3 consecutive absences');
    });

    it('should identify declining trend', () => {
      const records = [
        { present: true, session_date: new Date('2023-01-01') },
        { present: true, session_date: new Date('2023-01-02') },
        { present: true, session_date: new Date('2023-01-03') },
        { present: true, session_date: new Date('2023-01-04') },
        { present: true, session_date: new Date('2023-01-05') },
        { present: false, session_date: new Date('2023-01-06') },
        { present: false, session_date: new Date('2023-01-07') },
        { present: false, session_date: new Date('2023-01-08') },
        { present: false, session_date: new Date('2023-01-09') },
        { present: false, session_date: new Date('2023-01-10') }
      ];

      const factors = riskModel.analyzeRiskFactors(records);

      expect(factors).toContain('Declining attendance trend');
    });
  });

  describe('generateRecommendations', () => {
    it('should generate high risk recommendations', () => {
      const factors = ['3 consecutive absences', 'Low attendance rate (40%)'];
      const recommendations = riskModel.generateRecommendations('high', factors);

      expect(recommendations).toContain('Immediate academic counseling required');
      expect(recommendations).toContain('Contact student immediately to check wellbeing');
    });

    it('should generate medium risk recommendations', () => {
      const factors = ['Declining attendance trend'];
      const recommendations = riskModel.generateRecommendations('medium', factors);

      expect(recommendations).toContain('Weekly progress check-ins');
      expect(recommendations).toContain('Monitor attendance trends closely');
    });

    it('should generate low risk recommendations', () => {
      const factors = [];
      const recommendations = riskModel.generateRecommendations('low', factors);

      expect(recommendations).toContain('Maintain current engagement level');
      expect(recommendations).toContain('Consider advanced coursework');
    });
  });
});
