// =======================================
// 🧪 Attendance Finalizer Tests
// =======================================

const { finalizeAttendanceSession, createAbsentRecord, generateAttendanceSummary } = require('../../src/services/attendanceFinalizer');
const db = require('../../src/db');

// Mock database for testing
jest.mock('../../src/db');

describe('Attendance Finalizer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('finalizeAttendanceSession', () => {
    test('should mark unrecognized students as absent', async () => {
      // Mock database responses
      db.query.mockImplementation((query, params) => {
        console.log('Mock query called:', query);
        
        if (query.includes('enrolled students')) {
          return Promise.resolve({
            rows: [
              { id: 1, student_id: 'STU001', name: 'John Doe' },
              { id: 2, student_id: 'STU002', name: 'Jane Smith' },
              { id: 3, student_id: 'STU003', name: 'Bob Johnson' }
            ]
          });
        }
        
        if (query.includes('existing attendance')) {
          return Promise.resolve({
            rows: [
              { student_id: 1, present: true, method: 'face' } // Only STU001 recognized
            ]
          });
        }

        if (query.includes('INSERT INTO attendance') && query.includes('auto_absent')) {
          return Promise.resolve({
            rows: [{ id: 999, student_id: 2, present: false, method: 'auto_absent' }]
          });
        }

        if (query.includes('COUNT')) {
          return Promise.resolve({
            rows: [{
              total_students: 3,
              present_count: 1,
              absent_count: 2,
              attendance_percentage: 33.33
            }]
          });
        }

        return Promise.resolve({ rows: [] });
      });

      const result = await finalizeAttendanceSession(
        1, // classId
        '2023-12-01', // sessionDate
        null, // sessionId
        ['STU001'] // recognizedStudentIds
      );

      expect(result.success).toBe(true);
      expect(result.markedAbsent).toBe(2); // STU002 and STU003 marked absent
      expect(result.totalEnrolled).toBe(3);
      expect(result.stats.present_count).toBe(1);
      expect(result.stats.absent_count).toBe(2);
    });

    test('should not mark students as absent if already present', async () => {
      db.query.mockImplementation((query, params) => {
        if (query.includes('enrolled students')) {
          return Promise.resolve({
            rows: [
              { id: 1, student_id: 'STU001', name: 'John Doe' },
              { id: 2, student_id: 'STU002', name: 'Jane Smith' }
            ]
          });
        }
        
        if (query.includes('existing attendance')) {
          return Promise.resolve({
            rows: [
              { student_id: 1, present: true, method: 'face' },
              { student_id: 2, present: true, method: 'qr' }
            ]
          });
        }

        if (query.includes('COUNT')) {
          return Promise.resolve({
            rows: [{
              total_students: 2,
              present_count: 2,
              absent_count: 0,
              attendance_percentage: 100
            }]
          });
        }

        return Promise.resolve({ rows: [] });
      });

      const result = await finalizeAttendanceSession(
        1, // classId
        '2023-12-01', // sessionDate
        null, // sessionId
        ['STU001', 'STU002'] // Both recognized
      );

      expect(result.success).toBe(true);
      expect(result.markedAbsent).toBe(0); // No one marked absent
      expect(result.totalEnrolled).toBe(2);
      expect(result.stats.present_count).toBe(2);
      expect(result.stats.absent_count).toBe(0);
    });
  });

  describe('createAbsentRecord', () => {
    test('should create absent record with correct parameters', async () => {
      const mockResult = { id: 999, student_id: 2, present: false };
      db.query.mockReturnValue(Promise.resolve({ rows: [mockResult] }));

      const result = await createAbsentRecord(1, '2023-12-01', null, 2);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO attendance'),
        [1, 2, '2023-12-01', false, 'auto_absent', 0.0]
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('generateAttendanceSummary', () => {
    test('should calculate correct attendance statistics', async () => {
      db.query.mockReturnValue(Promise.resolve({
        rows: [{
          total_students: 5,
          present_count: 3,
          absent_count: 2,
          attendance_percentage: 60.00
        }]
      }));

      const result = await generateAttendanceSummary(1, '2023-12-01', null);

      expect(result.total_students).toBe(5);
      expect(result.present_count).toBe(3);
      expect(result.absent_count).toBe(2);
      expect(result.attendance_percentage).toBe(60.00);
    });
  });
});
