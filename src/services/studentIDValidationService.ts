/**
 * Student ID Validation Service
 * Enforces validation rules to prevent duplicate or missing Student IDs
 * Handles validation, logging, and conflict resolution
 */

import { StudentService } from './studentService';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  duplicates?: string[];
}

export interface StudentIDValidation {
  student_id: string;
  isValid: boolean;
  error?: string;
  isDuplicate?: boolean;
  isEmpty?: boolean;
}

export interface ImportValidationResult {
  totalRecords: number;
  validRecords: StudentIDValidation[];
  invalidRecords: StudentIDValidation[];
  duplicateIds: string[];
  emptyIds: number;
  summary: {
    canImport: boolean;
    validCount: number;
    invalidCount: number;
    duplicateCount: number;
  };
}

export class StudentIDValidationService {
  private static readonly MIN_ID_LENGTH = 1;
  private static readonly MAX_ID_LENGTH = 50;
  private static readonly STUDENT_ID_PATTERN = /^\d{4}-\d{4}$/;
  private static readonly VALIDATION_LOG: Array<{
    timestamp: string;
    action: string;
    student_id: string;
    result: string;
    details?: string;
  }> = [];

  /**
   * Validate student ID format only (without duplicate checks)
   */
  static validateStudentIdFormat(student_id: string | null | undefined): StudentIDValidation {
    const result: StudentIDValidation = {
      student_id: student_id || '',
      isValid: false,
    };

    // Check for missing/empty ID
    if (!student_id || typeof student_id !== 'string') {
      result.isEmpty = true;
      result.error = 'Student ID is required and cannot be empty or null';
      this.logValidation('validate_format', student_id || 'NULL', 'FAILED', result.error);
      return result;
    }

    const trimmedId = student_id.trim();

    // Check if empty after trimming
    if (trimmedId.length === 0) {
      result.isEmpty = true;
      result.error = 'Student ID cannot contain only whitespace';
      this.logValidation('validate_format', student_id, 'FAILED', result.error);
      return result;
    }

    // Check length constraints
    if (trimmedId.length < this.MIN_ID_LENGTH) {
      result.error = `Student ID must be at least ${this.MIN_ID_LENGTH} character(s)`;
      this.logValidation('validate_format', student_id, 'FAILED', result.error);
      return result;
    }

    if (trimmedId.length > this.MAX_ID_LENGTH) {
      result.error = `Student ID must not exceed ${this.MAX_ID_LENGTH} characters`;
      this.logValidation('validate_format', student_id, 'FAILED', result.error);
      return result;
    }

    // Enforce strict format: YYYY-XXXX (e.g., 2026-0001)
    if (!this.STUDENT_ID_PATTERN.test(trimmedId)) {
      result.error = 'Student ID must follow YYYY-XXXX format (e.g., 2026-0001)';
      this.logValidation('validate_format', student_id, 'FAILED', result.error);
      return result;
    }

    const sequenceNumber = Number(trimmedId.split('-')[1]);
    if (sequenceNumber < 1) {
      result.error = 'Student ID sequence must be between 0001 and 9999';
      this.logValidation('validate_format', student_id, 'FAILED', result.error);
      return result;
    }

    result.isValid = true;
    result.student_id = trimmedId;
    this.logValidation('validate_format', student_id, 'PASSED', 'Student ID format is valid');
    return result;
  }

  /**
   * Validate a single student ID (format + uniqueness)
   */
  static async validateStudentId(student_id: string | null | undefined): Promise<StudentIDValidation> {
    const result = this.validateStudentIdFormat(student_id);
    if (!result.isValid) {
      return result;
    }

    // Check for duplicate
    try {
      const existing = await StudentService.getStudentById(result.student_id);
      if (existing) {
        result.isValid = false;
        result.isDuplicate = true;
        result.error = `Student ID "${result.student_id}" already exists in the system`;
        this.logValidation('validate_single', student_id || 'NULL', 'DUPLICATE', result.error);
        return result;
      }
    } catch (error) {
      result.isValid = false;
      result.error = `Error checking for duplicate: ${(error as Error).message}`;
      this.logValidation('validate_single', student_id || 'NULL', 'ERROR', result.error);
      return result;
    }

    this.logValidation('validate_single', student_id || 'NULL', 'PASSED', 'Student ID is valid');
    return result;
  }

  /**
   * Validate multiple student IDs (for imports)
   */
  static async validateStudentIds(student_ids: (string | null | undefined)[]): Promise<ImportValidationResult> {
    const validRecords: StudentIDValidation[] = [];
    const invalidRecords: StudentIDValidation[] = [];
    const seenIds = new Set<string>();
    let duplicateCount = 0;
    let emptyCount = 0;

    for (const id of student_ids) {
      const validation = await this.validateStudentId(id);

      if (!validation.isValid) {
        invalidRecords.push(validation);
        if (validation.isEmpty) emptyCount++;
        if (validation.isDuplicate) duplicateCount++;
        continue;
      }

      // Check for duplicates within the batch
      if (seenIds.has(validation.student_id)) {
        validation.isDuplicate = true;
        validation.error = `Duplicate ID within import batch: "${validation.student_id}"`;
        invalidRecords.push(validation);
        duplicateCount++;
        this.logValidation(
          'batch_validate',
          validation.student_id,
          'DUPLICATE_IN_BATCH',
          validation.error
        );
        continue;
      }

      seenIds.add(validation.student_id);
      validRecords.push(validation);
    }

    const duplicateIds = Array.from(seenIds).filter((id) =>
      invalidRecords.some((rec) => rec.student_id === id && rec.isDuplicate)
    );

    const result: ImportValidationResult = {
      totalRecords: student_ids.length,
      validRecords,
      invalidRecords,
      duplicateIds,
      emptyIds: emptyCount,
      summary: {
        canImport: invalidRecords.length === 0,
        validCount: validRecords.length,
        invalidCount: invalidRecords.length,
        duplicateCount,
      },
    };

    this.logValidation(
      'batch_validate',
      'BATCH',
      result.summary.canImport ? 'PASSED' : 'FAILED',
      `Valid: ${result.summary.validCount}, Invalid: ${result.summary.invalidCount}, Duplicates: ${duplicateCount}`
    );

    return result;
  }

  /**
   * Validate student record before creation
   */
  static async validateStudentRecord(
    student_id: string,
    first_name?: string,
    last_name?: string
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate student ID
    const idValidation = await this.validateStudentId(student_id);
    if (!idValidation.isValid) {
      errors.push(idValidation.error || 'Invalid student ID');
    }

    // Validate first name
    if (!first_name || !first_name.trim()) {
      errors.push('First name is required');
    } else if (first_name.trim().length > 100) {
      errors.push('First name must not exceed 100 characters');
    }

    // Validate last name
    if (!last_name || !last_name.trim()) {
      errors.push('Last name is required');
    } else if (last_name.trim().length > 100) {
      errors.push('Last name must not exceed 100 characters');
    }

    // Add warnings for potential issues
    if (first_name && first_name.length > 50) {
      warnings.push('First name is quite long, consider shortening it');
    }
    if (last_name && last_name.length > 50) {
      warnings.push('Last name is quite long, consider shortening it');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate student records for batch import
   */
  static async validateStudentRecordsBatch(
    records: Array<{
      student_id?: string;
      first_name?: string;
      last_name?: string;
      email?: string;
    }>
  ): Promise<{
    isValid: boolean;
    validRecords: any[];
    invalidRecords: any[];
    errors: string[];
  }> {
    const validRecords: any[] = [];
    const invalidRecords: any[] = [];
    const errors: string[] = [];
    const seenIds = new Set<string>();

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const recordErrors: string[] = [];

      // Validate student ID
      const idValidation = await this.validateStudentId(record.student_id);
      if (!idValidation.isValid) {
        recordErrors.push(`Row ${i + 1}: ${idValidation.error}`);
      } else if (seenIds.has(idValidation.student_id)) {
        recordErrors.push(`Row ${i + 1}: Duplicate ID in batch "${idValidation.student_id}"`);
      } else {
        seenIds.add(idValidation.student_id);
      }

      // Validate names
      if (!record.first_name || !record.first_name.trim()) {
        recordErrors.push(`Row ${i + 1}: First name is required`);
      }
      if (!record.last_name || !record.last_name.trim()) {
        recordErrors.push(`Row ${i + 1}: Last name is required`);
      }

      if (recordErrors.length > 0) {
        invalidRecords.push({
          ...record,
          _rowIndex: i + 1,
          _errors: recordErrors,
        });
        errors.push(...recordErrors);
      } else {
        validRecords.push({
          ...record,
          _rowIndex: i + 1,
        });
      }
    }

    return {
      isValid: invalidRecords.length === 0,
      validRecords,
      invalidRecords,
      errors,
    };
  }

  /**
   * Check for duplicate student ID in system
   */
  static async checkDuplicate(student_id: string): Promise<{
    isDuplicate: boolean;
    existingRecord?: any;
  }> {
    try {
      const existing = await StudentService.getStudentById(student_id);
      return {
        isDuplicate: !!existing,
        existingRecord: existing || undefined,
      };
    } catch (error) {
      throw new Error(`Error checking for duplicate: ${(error as Error).message}`);
    }
  }

  /**
   * Find duplicate IDs in a system (for data cleanup)
   */
  static async findDuplicatesInSystem(): Promise<{
    found: boolean;
    duplicates: string[];
    details?: any;
  }> {
    try {
      // This would require access to all students in the system
      // Implementation would depend on having a getAllStudents method in StudentService
      this.logValidation('system_scan', 'SYSTEM', 'STARTED', 'Scanning for duplicates');

      return {
        found: false,
        duplicates: [],
      };
    } catch (error) {
      this.logValidation('system_scan', 'SYSTEM', 'ERROR', (error as Error).message);
      throw error;
    }
  }

  /**
   * Log validation events
   */
  private static logValidation(action: string, studentId: string, result: string, details: string) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      action,
      student_id: studentId,
      result,
      details,
    };

    this.VALIDATION_LOG.push(logEntry);

    // Keep log size manageable (last 10000 entries)
    if (this.VALIDATION_LOG.length > 10000) {
      this.VALIDATION_LOG.shift();
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[StudentIDValidation] ${action} - ${studentId}: ${result}`, details);
    }
  }

  /**
   * Get validation logs (for debugging)
   */
  static getValidationLogs(
    limit: number = 100,
    filter?: { action?: string; result?: string; studentId?: string }
  ) {
    let filtered = [...this.VALIDATION_LOG];

    if (filter?.action) {
      filtered = filtered.filter((log) => log.action === filter.action);
    }
    if (filter?.result) {
      filtered = filtered.filter((log) => log.result === filter.result);
    }
    if (filter?.studentId) {
      filtered = filtered.filter((log) => log.student_id === filter.studentId);
    }

    return filtered.slice(-limit);
  }

  /**
   * Clear validation logs
   */
  static clearValidationLogs() {
    this.VALIDATION_LOG.length = 0;
  }

  /**
   * Get validation statistics
   */
  static getValidationStats() {
    const stats = {
      totalValidations: this.VALIDATION_LOG.length,
      passed: this.VALIDATION_LOG.filter((log) => log.result === 'PASSED').length,
      failed: this.VALIDATION_LOG.filter((log) => log.result === 'FAILED').length,
      duplicates: this.VALIDATION_LOG.filter((log) => log.result === 'DUPLICATE').length,
      errors: this.VALIDATION_LOG.filter((log) => log.result === 'ERROR').length,
    };

    return {
      ...stats,
      successRate: stats.totalValidations > 0 ? ((stats.passed / stats.totalValidations) * 100).toFixed(2) + '%' : 'N/A',
    };
  }
}
