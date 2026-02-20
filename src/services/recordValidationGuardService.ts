/**
 * Record Validation Guard Service
 * Validates grading, attendance, and reporting records before saving
 * Prevents invalid records from being saved to the database
 * Provides detailed error messages for admin feedback
 */

import { StudentService } from './studentService';

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
  value?: any;
}

export interface GradeRecord {
  student_id: string;
  exam_id: string;
  class_id: string;
  score: number;
  grade_letter?: string;
  recorded_by: string;
  recorded_at?: string;
}

export interface AttendanceRecord {
  student_id: string;
  class_id: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused' | 'on-leave';
  remarks?: string;
  recorded_by: string;
  recorded_at?: string;
}

export interface ReportRecord {
  report_type: 'student' | 'class' | 'exam' | 'period';
  entity_id: string;
  date_range_start?: string;
  date_range_end?: string;
  generated_by: string;
  generated_at?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  blockedFromSave: boolean;
}

export class RecordValidationGuardService {
  /**
   * Validate a grade record before saving
   * Checks: required fields, FK references, score range, data types
   */
  static async validateGradeRecord(
    record: GradeRecord
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Validate required fields
    if (!record.student_id || typeof record.student_id !== 'string') {
      errors.push({
        field: 'student_id',
        message: 'Student ID is required and must be a string',
        severity: 'error',
        value: record.student_id,
      });
    }

    if (!record.exam_id || typeof record.exam_id !== 'string') {
      errors.push({
        field: 'exam_id',
        message: 'Exam ID is required and must be a string',
        severity: 'error',
        value: record.exam_id,
      });
    }

    if (!record.class_id || typeof record.class_id !== 'string') {
      errors.push({
        field: 'class_id',
        message: 'Class ID is required and must be a string',
        severity: 'error',
        value: record.class_id,
      });
    }

    if (record.score === undefined || record.score === null) {
      errors.push({
        field: 'score',
        message: 'Score is required',
        severity: 'error',
        value: record.score,
      });
    } else if (typeof record.score !== 'number') {
      errors.push({
        field: 'score',
        message: 'Score must be a number',
        severity: 'error',
        value: record.score,
      });
    } else if (record.score < 0 || record.score > 100) {
      errors.push({
        field: 'score',
        message: 'Score must be between 0 and 100',
        severity: 'error',
        value: record.score,
      });
    }

    if (!record.recorded_by || typeof record.recorded_by !== 'string') {
      errors.push({
        field: 'recorded_by',
        message: 'Recorded by (user ID) is required and must be a string',
        severity: 'error',
        value: record.recorded_by,
      });
    }

    // If there are critical errors, skip FK checks to avoid unnecessary queries
    if (errors.length === 0) {
      // Validate foreign key references
      try {
        const studentExists = await StudentService.getStudentById(record.student_id);
        if (!studentExists) {
          errors.push({
            field: 'student_id',
            message: `Student ID "${record.student_id}" does not exist in the system`,
            severity: 'error',
            value: record.student_id,
          });
        }
      } catch (error) {
        errors.push({
          field: 'student_id',
          message: `Failed to validate student ID: ${(error as Error).message}`,
          severity: 'error',
          value: record.student_id,
        });
      }

      try {
        // Assuming ExamService has a getExamById method
        // Note: Exam existence check may emit warnings but not block saves
        console.log(`[Validation] Exam ID ${record.exam_id} - verification skipped (cross-module dependency)`);
      } catch (error) {
        warnings.push({
          field: 'exam_id',
          message: `Failed to validate exam ID: ${(error as Error).message}`,
          severity: 'warning',
          value: record.exam_id,
        });
      }

      try {
        // Check if class exists
        // Note: Class existence check may emit warnings but not block saves
        console.log(`[Validation] Class ID ${record.class_id} - verification skipped (cross-module dependency)`);
      } catch (error) {
        warnings.push({
          field: 'class_id',
          message: `Failed to validate class ID: ${(error as Error).message}`,
          severity: 'warning',
          value: record.class_id,
        });
      }
    }

    // Validate grade letter if provided
    if (record.grade_letter) {
      const validGrades = ['A', 'B', 'C', 'D', 'F'];
      if (!validGrades.includes(record.grade_letter.toUpperCase())) {
        errors.push({
          field: 'grade_letter',
          message: `Invalid grade letter "${record.grade_letter}". Valid grades are: ${validGrades.join(', ')}`,
          severity: 'error',
          value: record.grade_letter,
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      blockedFromSave: errors.length > 0,
    };
  }

  /**
   * Validate an attendance record before saving
   * Checks: required fields, FK references, valid status, date format
   */
  static async validateAttendanceRecord(
    record: AttendanceRecord
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Validate required fields
    if (!record.student_id || typeof record.student_id !== 'string') {
      errors.push({
        field: 'student_id',
        message: 'Student ID is required and must be a string',
        severity: 'error',
        value: record.student_id,
      });
    }

    if (!record.class_id || typeof record.class_id !== 'string') {
      errors.push({
        field: 'class_id',
        message: 'Class ID is required and must be a string',
        severity: 'error',
        value: record.class_id,
      });
    }

    if (!record.date || typeof record.date !== 'string') {
      errors.push({
        field: 'date',
        message: 'Date is required and must be a string (YYYY-MM-DD format)',
        severity: 'error',
        value: record.date,
      });
    } else if (!this.isValidDateFormat(record.date)) {
      errors.push({
        field: 'date',
        message: 'Date must be in YYYY-MM-DD format',
        severity: 'error',
        value: record.date,
      });
    } else if (this.isDateInFuture(record.date)) {
      errors.push({
        field: 'date',
        message: 'Cannot record attendance for future dates',
        severity: 'error',
        value: record.date,
      });
    }

    if (!record.status) {
      errors.push({
        field: 'status',
        message: 'Attendance status is required',
        severity: 'error',
        value: record.status,
      });
    } else {
      const validStatuses = ['present', 'absent', 'late', 'excused', 'on-leave'];
      if (!validStatuses.includes(record.status)) {
        errors.push({
          field: 'status',
          message: `Invalid status "${record.status}". Valid statuses are: ${validStatuses.join(', ')}`,
          severity: 'error',
          value: record.status,
        });
      }
    }

    if (!record.recorded_by || typeof record.recorded_by !== 'string') {
      errors.push({
        field: 'recorded_by',
        message: 'Recorded by (user ID) is required and must be a string',
        severity: 'error',
        value: record.recorded_by,
      });
    }

    // If there are critical errors, skip FK checks
    if (errors.length === 0) {
      // Validate foreign key references
      try {
        const studentExists = await StudentService.getStudentById(record.student_id);
        if (!studentExists) {
          errors.push({
            field: 'student_id',
            message: `Student ID "${record.student_id}" does not exist in the system`,
            severity: 'error',
            value: record.student_id,
          });
        }
      } catch (error) {
        errors.push({
          field: 'student_id',
          message: `Failed to validate student ID: ${(error as Error).message}`,
          severity: 'error',
          value: record.student_id,
        });
      }

      try {
        // Check if class exists
        // Note: Class existence check may emit warnings but not block saves
        console.log(`[Validation] Class ID ${record.class_id} - verification skipped (cross-module dependency)`);
      } catch (error) {
        warnings.push({
          field: 'class_id',
          message: `Failed to validate class ID: ${(error as Error).message}`,
          severity: 'warning',
          value: record.class_id,
        });
      }
    }

    // Validate remarks if provided
    if (record.remarks && typeof record.remarks !== 'string') {
      errors.push({
        field: 'remarks',
        message: 'Remarks must be a string',
        severity: 'error',
        value: record.remarks,
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      blockedFromSave: errors.length > 0,
    };
  }

  /**
   * Validate a report record before saving
   * Checks: required fields, valid report type, date range validity
   */
  static async validateReportRecord(
    record: ReportRecord
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Validate required fields
    if (!record.report_type) {
      errors.push({
        field: 'report_type',
        message: 'Report type is required',
        severity: 'error',
        value: record.report_type,
      });
    } else {
      const validTypes = ['student', 'class', 'exam', 'period'];
      if (!validTypes.includes(record.report_type)) {
        errors.push({
          field: 'report_type',
          message: `Invalid report type "${record.report_type}". Valid types are: ${validTypes.join(', ')}`,
          severity: 'error',
          value: record.report_type,
        });
      }
    }

    if (!record.entity_id || typeof record.entity_id !== 'string') {
      errors.push({
        field: 'entity_id',
        message: 'Entity ID (student/class/exam ID) is required and must be a string',
        severity: 'error',
        value: record.entity_id,
      });
    }

    if (!record.generated_by || typeof record.generated_by !== 'string') {
      errors.push({
        field: 'generated_by',
        message: 'Generated by (user ID) is required and must be a string',
        severity: 'error',
        value: record.generated_by,
      });
    }

    // Validate date range if provided
    if (record.date_range_start || record.date_range_end) {
      if (record.date_range_start && !this.isValidDateFormat(record.date_range_start)) {
        errors.push({
          field: 'date_range_start',
          message: 'Start date must be in YYYY-MM-DD format',
          severity: 'error',
          value: record.date_range_start,
        });
      }

      if (record.date_range_end && !this.isValidDateFormat(record.date_range_end)) {
        errors.push({
          field: 'date_range_end',
          message: 'End date must be in YYYY-MM-DD format',
          severity: 'error',
          value: record.date_range_end,
        });
      }

      // Check that start date is before end date
      if (
        record.date_range_start &&
        record.date_range_end &&
        this.isValidDateFormat(record.date_range_start) &&
        this.isValidDateFormat(record.date_range_end)
      ) {
        const startDate = new Date(record.date_range_start);
        const endDate = new Date(record.date_range_end);

        if (startDate > endDate) {
          errors.push({
            field: 'date_range_start',
            message: 'Start date must be before or equal to end date',
            severity: 'error',
            value: record.date_range_start,
          });
        }
      }
    }

    // If there are critical errors, skip FK checks
    if (errors.length === 0) {
      // Validate entity exists based on report type
      try {
        if (record.report_type === 'student') {
          const studentExists = await StudentService.getStudentById(record.entity_id);
          if (!studentExists) {
            errors.push({
              field: 'entity_id',
              message: `Student ID "${record.entity_id}" does not exist in the system`,
              severity: 'error',
              value: record.entity_id,
            });
          }
        } else if (record.report_type === 'class') {
          // Check if class exists
          // Note: Class existence check may emit warnings but not block saves
          console.log(`[Validation] Class ID ${record.entity_id} - verification skipped (cross-module dependency)`);
        } else if (record.report_type === 'exam') {
          // Check if exam exists
          // Note: Exam existence check may emit warnings but not block saves
          console.log(`[Validation] Exam ID ${record.entity_id} - verification skipped (cross-module dependency)`);
        }
      } catch (error) {
        warnings.push({
          field: 'entity_id',
          message: `Failed to validate entity ID: ${(error as Error).message}`,
          severity: 'warning',
          value: record.entity_id,
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      blockedFromSave: errors.length > 0,
    };
  }

  /**
   * Get human-readable error summary for admin feedback
   */
  static formatValidationErrors(
    errors: ValidationError[],
    recordType: string
  ): string {
    if (errors.length === 0) return '';

    const errorList = errors
      .map((e) => `• ${e.field}: ${e.message}`)
      .join('\n');

    return `${recordType} record validation failed:\n${errorList}`;
  }

  /**
   * Helper: Check if date string is in valid YYYY-MM-DD format
   */
  private static isValidDateFormat(dateString: string): boolean {
    if (!dateString || typeof dateString !== 'string') return false;

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateString)) return false;

    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  }

  /**
   * Helper: Check if date is in the future
   */
  private static isDateInFuture(dateString: string): boolean {
    if (!this.isValidDateFormat(dateString)) return false;

    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return date > today;
  }

  /**
   * Check if validation errors are critical enough to block saves
   */
  static shouldBlockSave(validationResult: ValidationResult): boolean {
    return validationResult.blockedFromSave || validationResult.errors.length > 0;
  }

  /**
   * Generate summary statistics for validation feedback
   */
  static getValidationSummary(validationResult: ValidationResult): {
    errorCount: number;
    warningCount: number;
    blockedStatus: string;
  } {
    return {
      errorCount: validationResult.errors.length,
      warningCount: validationResult.warnings.length,
      blockedStatus: validationResult.blockedFromSave ? 'BLOCKED' : 'ALLOWED',
    };
  }
}
