/**
 * Record Validation Guard Tests
 * Comprehensive test suite for validation blocking logic
 * Tests: validation guards, blocking prevents saves, error reporting, audit logging
 */

import { RecordValidationGuardService, ValidationError } from '@/services/recordValidationGuardService';
import { InvalidRecordLogger } from '@/services/invalidRecordLogger';
import { GradingService } from '@/services/gradingService';
import { AttendanceService } from '@/services/attendanceService';

describe('Record Validation Guard Service', () => {
  describe('Grade Record Validation', () => {
    test('should validate a correct grade record', async () => {
      const validGrade = {
        student_id: 'STU001',
        exam_id: 'EXAM001',
        class_id: 'CLASS001',
        score: 85,
        grade_letter: 'B',
        recorded_by: 'TEACHER001',
      };

      const result = await RecordValidationGuardService.validateGradeRecord(validGrade);

      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
      expect(result.blockedFromSave).toBe(false);
    });

    test('should reject grade with missing student_id', async () => {
      const invalidGrade = {
        student_id: '',
        exam_id: 'EXAM001',
        class_id: 'CLASS001',
        score: 85,
        grade_letter: 'B',
        recorded_by: 'TEACHER001',
      };

      const result = await RecordValidationGuardService.validateGradeRecord(invalidGrade);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.blockedFromSave).toBe(true);
      expect(result.errors.some((e) => e.field === 'student_id')).toBe(true);
    });

    test('should reject grade with invalid score range', async () => {
      const invalidGrade = {
        student_id: 'STU001',
        exam_id: 'EXAM001',
        class_id: 'CLASS001',
        score: 150, // Out of range
        grade_letter: 'B',
        recorded_by: 'TEACHER001',
      };

      const result = await RecordValidationGuardService.validateGradeRecord(invalidGrade);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.field === 'score')).toBe(true);
      expect(result.errors.some((e) => e.message.includes('between 0 and 100'))).toBe(true);
    });

    test('should reject grade with invalid letter grade', async () => {
      const invalidGrade = {
        student_id: 'STU001',
        exam_id: 'EXAM001',
        class_id: 'CLASS001',
        score: 85,
        grade_letter: 'Z', // Invalid
        recorded_by: 'TEACHER001',
      };

      const result = await RecordValidationGuardService.validateGradeRecord(invalidGrade);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.field === 'grade_letter')).toBe(true);
    });

    test('should detect missing required fields', async () => {
      const incompleteGrade = {
        student_id: 'STU001',
        exam_id: 'EXAM001',
        class_id: '',
        score: undefined,
        recorded_by: '',
      };

      const result = await RecordValidationGuardService.validateGradeRecord(incompleteGrade as any);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Attendance Record Validation', () => {
    test('should validate a correct attendance record', async () => {
      const validAttendance = {
        student_id: 'STU001',
        class_id: 'CLASS001',
        date: '2024-01-15',
        status: 'present' as const,
        recorded_by: 'TEACHER001',
      };

      const result = await RecordValidationGuardService.validateAttendanceRecord(validAttendance);

      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    test('should reject attendance with invalid date format', async () => {
      const invalidAttendance = {
        student_id: 'STU001',
        class_id: 'CLASS001',
        date: '01-15-2024', // Wrong format
        status: 'present' as const,
        recorded_by: 'TEACHER001',
      };

      const result = await RecordValidationGuardService.validateAttendanceRecord(invalidAttendance);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.field === 'date')).toBe(true);
    });

    test('should reject attendance with future date', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const futureDate = tomorrow.toISOString().split('T')[0];

      const futureAttendance = {
        student_id: 'STU001',
        class_id: 'CLASS001',
        date: futureDate,
        status: 'present' as const,
        recorded_by: 'TEACHER001',
      };

      const result = await RecordValidationGuardService.validateAttendanceRecord(futureAttendance);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.message.includes('future'))).toBe(true);
    });

    test('should reject attendance with invalid status', async () => {
      const invalidAttendance = {
        student_id: 'STU001',
        class_id: 'CLASS001',
        date: '2024-01-15',
        status: 'maybe' as any, // Invalid status
        recorded_by: 'TEACHER001',
      };

      const result = await RecordValidationGuardService.validateAttendanceRecord(invalidAttendance);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.field === 'status')).toBe(true);
    });

    test('should accept all valid attendance statuses', async () => {
      const validStatuses: Array<'present' | 'absent' | 'late' | 'excused' | 'on-leave'> = [
        'present',
        'absent',
        'late',
        'excused',
        'on-leave',
      ];

      for (const status of validStatuses) {
        const attendance = {
          student_id: 'STU001',
          class_id: 'CLASS001',
          date: '2024-01-15',
          status,
          recorded_by: 'TEACHER001',
        };

        const result = await RecordValidationGuardService.validateAttendanceRecord(attendance);
        expect(result.isValid).toBe(true);
      }
    });
  });

  describe('Report Record Validation', () => {
    test('should validate a correct student report record', async () => {
      const validReport = {
        report_type: 'student' as const,
        entity_id: 'STU001',
        generated_by: 'ADMIN001',
      };

      const result = await RecordValidationGuardService.validateReportRecord(validReport);

      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    test('should reject report with invalid type', async () => {
      const invalidReport = {
        report_type: 'invalid' as any,
        entity_id: 'STU001',
        generated_by: 'ADMIN001',
      };

      const result = await RecordValidationGuardService.validateReportRecord(invalidReport);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.field === 'report_type')).toBe(true);
    });

    test('should validate date range in reports', async () => {
      const reportWithDateRange = {
        report_type: 'period' as const,
        entity_id: 'STU001',
        date_range_start: '2024-01-01',
        date_range_end: '2024-01-31',
        generated_by: 'ADMIN001',
      };

      const result = await RecordValidationGuardService.validateReportRecord(reportWithDateRange);

      expect(result.isValid).toBe(true);
    });

    test('should reject report with start date after end date', async () => {
      const invalidReport = {
        report_type: 'period' as const,
        entity_id: 'STU001',
        date_range_start: '2024-01-31',
        date_range_end: '2024-01-01', // End before start
        generated_by: 'ADMIN001',
      };

      const result = await RecordValidationGuardService.validateReportRecord(invalidReport);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.message.includes('before'))).toBe(true);
    });
  });

  describe('Validation Error Formatting', () => {
    test('should format validation errors for display', () => {
      const errors: ValidationError[] = [
        { field: 'student_id', message: 'Student ID is required', severity: 'error' },
        { field: 'score', message: 'Score must be between 0 and 100', severity: 'error' },
      ];

      const formatted = RecordValidationGuardService.formatValidationErrors(errors, 'Grade');

      expect(formatted).toContain('Grade record validation failed');
      expect(formatted).toContain('student_id');
      expect(formatted).toContain('score');
    });

    test('should generate summary statistics', () => {
      const result = {
        isValid: false,
        errors: [
          { field: 'student_id', message: 'Required', severity: 'error' as const },
          { field: 'score', message: 'Invalid range', severity: 'error' as const },
        ],
        warnings: [{ field: 'exam_id', message: 'Could not verify', severity: 'warning' as const }],
        blockedFromSave: true,
      };

      const summary = RecordValidationGuardService.getValidationSummary(result);

      expect(summary.errorCount).toBe(2);
      expect(summary.warningCount).toBe(1);
      expect(summary.blockedStatus).toBe('BLOCKED');
    });
  });
});

describe('Grading Service with Validation Blocking', () => {
  test('should block grade record save with validation errors', async () => {
    const invalidGradeData = {
      student_id: '', // Invalid: empty
      exam_id: 'EXAM001',
      class_id: 'CLASS001',
      score: 85,
      max_score: 100,
      graded_by: 'TEACHER001',
    };

    const result = await GradingService.recordGrade(invalidGradeData);

    expect(result.success).toBe(false);
    expect(result.error).toContain('validation failed');
    expect(result.validation_errors).toBeDefined();
    expect(result.validation_errors?.length).toBeGreaterThan(0);
  });

  test('should block update with invalid data', async () => {
    const updates = {
      score: 150, // Out of range
      max_score: 100,
      updated_by: 'TEACHER001',
    };

    const result = await GradingService.updateGrade('grade_123', updates);

    expect(result.success).toBe(false);
    expect(result.validation_errors).toBeDefined();
  });
});

describe('Attendance Service with Validation Blocking', () => {
  test('should block attendance record save with validation errors', async () => {
    const invalidAttendanceData = {
      student_id: 'STU001',
      class_id: 'CLASS001',
      date: 'invalid-date',
      status: 'present' as const,
      marked_by: 'TEACHER001',
    };

    const result = await AttendanceService.recordAttendance(invalidAttendanceData);

    expect(result.success).toBe(false);
    expect(result.error).toContain('validation failed');
    expect(result.validation_errors).toBeDefined();
  });
});

describe('Invalid Record Logger', () => {
  test('should log rejected grade record', async () => {
    const recordData = {
      student_id: 'STU001',
      exam_id: 'EXAM001',
      class_id: 'CLASS001',
      score: 150,
    };

    const validationErrors = [
      { field: 'score', message: 'Score must be between 0 and 100' },
    ];

    const log = await InvalidRecordLogger.logInvalidRecord(
      'grade',
      recordData,
      validationErrors,
      'TEACHER001',
      { entity_id: 'STU001' }
    );

    expect(log).not.toBeNull();
    if (log) {
      expect(log.record_type).toBe('grade');
      expect(log.error_count).toBe(1);
      expect(log.rejection_reason).toContain('Grade');
    }
  });

  test('should format error details', () => {
    const errors = [
      { field: 'student_id', message: 'Required' },
      { field: 'score', message: 'Invalid range' },
    ];

    const formatted = InvalidRecordLogger.formatErrorDetails(errors);

    expect(formatted).toContain('student_id');
    expect(formatted).toContain('score');
    expect(formatted).toContain('•');
  });
});

describe('Validation Error Detection', () => {
  test('should detect required field errors', async () => {
    const incompleteRecord = {
      student_id: '',
      exam_id: '',
      class_id: '',
      score: undefined,
      recorded_by: '',
    };

    const result = await RecordValidationGuardService.validateGradeRecord(incompleteRecord as any);

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.message.includes('required'))).toBe(true);
  });

  test('should detect type errors', async () => {
    const wrongTypeRecord = {
      student_id: 'STU001',
      exam_id: 'EXAM001',
      class_id: 'CLASS001',
      score: 'eighty-five', // Should be number
      recorded_by: 'TEACHER001',
    };

    const result = await RecordValidationGuardService.validateGradeRecord(wrongTypeRecord as any);

    expect(result.errors.some((e) => e.field === 'score')).toBe(true);
  });

  test('should block saves when errors exist', () => {
    const validationResult = {
      isValid: false,
      errors: [{ field: 'student_id', message: 'Required', severity: 'error' as const }],
      warnings: [],
      blockedFromSave: true,
    };

    const shouldBlock = RecordValidationGuardService.shouldBlockSave(validationResult);

    expect(shouldBlock).toBe(true);
  });

  test('should allow saves when no errors', () => {
    const validationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      blockedFromSave: false,
    };

    const shouldBlock = RecordValidationGuardService.shouldBlockSave(validationResult);

    expect(shouldBlock).toBe(false);
  });
});

// Summary test to verify complete flow
describe('Complete Validation Blocking Flow', () => {
  test('should block invalid record, log attempt, and prevent save', async () => {
    // Step 1: Create invalid record
    const invalidRecord = {
      student_id: 'INVALID_STUDENT',
      exam_id: 'EXAM001',
      class_id: 'CLASS001',
      score: 200, // Out of range
      max_score: 100,
      graded_by: 'TEACHER001',
    };

    // Step 2: Attempt to save (should be blocked)
    const saveResult = await GradingService.recordGrade(invalidRecord);

    expect(saveResult.success).toBe(false);
    expect(saveResult.validation_errors).toBeDefined();
    expect(saveResult.validation_errors!.length).toBeGreaterThan(0);

    // Step 3: Log the rejected attempt
    if (saveResult.validation_errors) {
      const logResult = await InvalidRecordLogger.logInvalidRecord(
        'grade',
        invalidRecord,
        saveResult.validation_errors.map((e) => ({
          field: e.field,
          message: e.message,
        })),
        'TEACHER001',
        { entity_id: invalidRecord.student_id }
      );

      expect(logResult).not.toBeNull();
      expect(logResult?.error_count).toBeGreaterThan(0);
    }

    // Step 4: Verify record was NOT saved (by checking that error was returned)
    expect(saveResult.success).toBe(false);
  });
});
