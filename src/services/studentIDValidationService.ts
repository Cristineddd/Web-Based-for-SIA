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
  private static readonly STUDENT_ID_PATTERN = /^\d{9}$/; // 9 digits without hyphen (e.g., 202311070)
  private static readonly STUDENT_ID_PATTERN_WITH_HYPHEN = /^\d{4}-\d{5}$/; // Accept YYYY-XXXXX format for input, will normalize
  // Strict email regex: username@domain.tld (minimum 2 char TLD)
  private static readonly EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  private static readonly VALIDATION_LOG: Array<{
    timestamp: string;
    action: string;
    student_id: string;
    result: string;
    details?: string;
  }> = [];

  /**
   * Validate email format - strict validation
   * Returns true if email is valid, false otherwise
   */
  static validateEmail(email: string | null | undefined): { isValid: boolean; error?: string } {
    if (!email || typeof email !== 'string') {
      return { isValid: true }; // Email is optional
    }
    
    const trimmed = email.trim();
    if (trimmed.length === 0) {
      return { isValid: true }; // Empty email is OK (optional)
    }
    
    // Check basic format
    if (!this.EMAIL_PATTERN.test(trimmed)) {
      return { 
        isValid: false, 
        error: 'Invalid email format. Must be like: student@gmail.com' 
      };
    }
    
    // Check for consecutive dots
    if (trimmed.includes('..')) {
      return { 
        isValid: false, 
        error: 'Email cannot contain consecutive dots' 
      };
    }
    
    // Check local part doesn't start/end with dot
    const localPart = trimmed.split('@')[0];
    if (localPart.startsWith('.') || localPart.endsWith('.')) {
      return { 
        isValid: false, 
        error: 'Email username cannot start or end with a dot' 
      };
    }
    
    // Check domain part
    const domainPart = trimmed.split('@')[1];
    if (domainPart.startsWith('.') || domainPart.startsWith('-') || domainPart.endsWith('-')) {
      return { 
        isValid: false, 
        error: 'Email domain format is invalid' 
      };
    }
    
    return { isValid: true };
  }

  /**
   * Format student ID to 9-digit format (no dash)
   * Accepts both "XXXXXXXXX" (9 digits) and "YYYY-XXXXX" formats, normalizes to 9 digits
   */
  static formatStudentId(student_id: string): string {
    const trimmed = student_id.trim();
    
    // If already in correct format (9 digits, no hyphen), return as is
    if (this.STUDENT_ID_PATTERN.test(trimmed)) {
      return trimmed;
    }
    
    // If in YYYY-XXXXX format with hyphen, remove the hyphen to normalize
    if (this.STUDENT_ID_PATTERN_WITH_HYPHEN.test(trimmed)) {
      return trimmed.replace('-', '');
    }
    
    // Return as is if format is not recognized
    return trimmed;
  }

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

    // Accept both formats: YYYY-XXXXX or XXXXXXXXX (9 digits)
    const formattedId = this.formatStudentId(trimmedId);
    
    // Enforce strict format after formatting: 9 digits (no hyphen)
    if (!this.STUDENT_ID_PATTERN.test(formattedId)) {
      result.error = 'Student ID must be exactly 9 digits (e.g., 202312264). No letters allowed.';
      this.logValidation('validate_format', student_id, 'FAILED', result.error);
      return result;
    }

    // Validate year part (first 4 digits must be a valid year starting with 20)
    const yearPart = formattedId.substring(0, 4);
    const yearNumber = parseInt(yearPart, 10);
    
    if (!yearPart.startsWith('20')) {
      result.error = 'Student ID must start with 20 (year format, e.g., 2023)';
      this.logValidation('validate_format', student_id, 'FAILED', result.error);
      return result;
    }
    
    if (yearNumber < 2000 || yearNumber > 2099) {
      result.error = 'Student ID year must be between 2000 and 2099';
      this.logValidation('validate_format', student_id, 'FAILED', result.error);
      return result;
    }

    // Validate sequence part (last 5 digits must be between 00001 and 99999)
    const sequenceNumber = Number(formattedId.substring(4, 9));
    if (sequenceNumber < 1) {
      result.error = 'Student ID sequence must be between 00001 and 99999';
      this.logValidation('validate_format', student_id, 'FAILED', result.error);
      return result;
    }

    result.isValid = true;
    result.student_id = formattedId; // Return formatted ID
    this.logValidation('validate_format', student_id, 'PASSED', `Student ID format is valid (formatted: ${formattedId})`);
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
    last_name?: string,
    grade?: string,
    section?: string
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

    // Validate grade
    if (!grade || !grade.trim()) {
      errors.push('Grade is required');
    } else {
      const normalizedGrade = grade.trim().toUpperCase();
      if (!/^(\d{1,4}|[A-Z])$/.test(normalizedGrade)) {
        errors.push('Grade format is invalid');
      }
    }

    // Validate section
    if (!section || !section.trim()) {
      errors.push('Section is required');
    } else {
      const normalizedSection = section.trim();
      if (!/^[a-zA-Z0-9-]+$/.test(normalizedSection)) {
        errors.push('Section format is invalid');
      }
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
      year?: string;
      grade?: string;
      section?: string;
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
      } else {
        const firstName = record.first_name.trim();
        if (!/^[a-zA-Z\s]+$/.test(firstName)) {
          recordErrors.push(`Row ${i + 1}: First name must contain letters only`);
        } else if (firstName.length < 2) {
          recordErrors.push(`Row ${i + 1}: First name must be at least 2 characters`);
        }
      }
      
      if (!record.last_name || !record.last_name.trim()) {
        recordErrors.push(`Row ${i + 1}: Last name is required`);
      } else {
        const lastName = record.last_name.trim();
        if (!/^[a-zA-Z\s]+$/.test(lastName)) {
          recordErrors.push(`Row ${i + 1}: Last name must contain letters only`);
        } else if (lastName.length < 2) {
          recordErrors.push(`Row ${i + 1}: Last name must be at least 2 characters`);
        }
      }
      
      // Validate email format (optional but must be valid if provided)
      if (record.email && record.email.trim()) {
        const emailValidation = this.validateEmail(record.email);
        if (!emailValidation.isValid) {
          recordErrors.push(`Row ${i + 1}: ${emailValidation.error}`);
        }
      }
      
      const sectionValue = (record as any).section;
      const gradeValue = (record as any).grade ?? (record as any).year;
      if (!gradeValue || !String(gradeValue).trim()) {
        recordErrors.push(`Row ${i + 1}: Grade is required`);
      } else if (!/^(\d{1,4}|[A-Z])$/.test(String(gradeValue).trim().toUpperCase())) {
        recordErrors.push(`Row ${i + 1}: Grade format is invalid`);
      }
      if (!sectionValue || !String(sectionValue).trim()) {
        recordErrors.push(`Row ${i + 1}: Section is required`);
      } else if (!/^[a-zA-Z0-9-]+$/.test(String(sectionValue).trim())) {
        recordErrors.push(`Row ${i + 1}: Section format is invalid`);
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
