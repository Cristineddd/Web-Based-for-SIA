/**
 * Student Field Validation Service
 * Validates student entries for required fields: Name, ID, Year, Section
 * Provides detailed error messages for missing or invalid fields
 * Logs all validation actions for audit trail
 */

import { ValidationActionLogger } from './validationActionLogger';

export interface StudentValidationError {
  rowIndex: number;
  field: string;
  error: string;
  value?: any;
}

export interface StudentFieldValidationResult {
  isValid: boolean;
  errors: StudentValidationError[];
  missingFields: Set<string>;
  invalidFields: Set<string>;
}

export interface StudentRecord {
  student_id?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  year?: string;
  section?: string;
  block?: string;
  grade?: string;
  [key: string]: any;
}

const REQUIRED_FIELDS = ['student_id', 'first_name', 'last_name', 'year', 'section'];
const FIELD_DISPLAY_NAMES: Record<string, string> = {
  student_id: 'Student ID',
  first_name: 'First Name',
  last_name: 'Last Name',
  email: 'Email',
  year: 'Year/Grade',
  section: 'Section/Block',
  block: 'Block',
  grade: 'Grade',
};

export class StudentFieldValidationService {
  /**
   * Validate a single student record for required fields
   */
  static validateStudentRecord(
    record: StudentRecord,
    rowIndex: number = 0
  ): StudentFieldValidationResult {
    const errors: StudentValidationError[] = [];
    const missingFields = new Set<string>();
    const invalidFields = new Set<string>();

    // Check each required field
    for (const field of REQUIRED_FIELDS) {
      const value = record[field];

      if (value === undefined || value === null) {
        errors.push({
          rowIndex,
          field,
          error: `${FIELD_DISPLAY_NAMES[field]} is required`,
          value,
        });
        missingFields.add(field);
      } else if (typeof value === 'string') {
        const trimmedValue = value.trim();
        if (trimmedValue === '') {
          errors.push({
            rowIndex,
            field,
            error: `${FIELD_DISPLAY_NAMES[field]} cannot be empty`,
            value: trimmedValue,
          });
          missingFields.add(field);
        } else if (!this.isFieldValid(field, trimmedValue)) {
          errors.push({
            rowIndex,
            field,
            error: `${FIELD_DISPLAY_NAMES[field]} format is invalid`,
            value: trimmedValue,
          });
          invalidFields.add(field);
        }
      } else if (typeof value === 'number') {
        if (!this.isFieldValid(field, String(value))) {
          errors.push({
            rowIndex,
            field,
            error: `${FIELD_DISPLAY_NAMES[field]} format is invalid`,
            value,
          });
          invalidFields.add(field);
        }
      }
    }

    // Validate email if provided
    if (record.email) {
      const emailStr = String(record.email).trim();
      if (emailStr && !this.isValidEmail(emailStr)) {
        errors.push({
          rowIndex,
          field: 'email',
          error: 'Email format is invalid',
          value: emailStr,
        });
        invalidFields.add('email');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      missingFields,
      invalidFields,
    };
  }

  /**
   * Validate multiple student records with logging
   */
  static async validateBulkRecordsWithLogging(
    records: StudentRecord[],
    adminId: string,
    adminEmail: string
  ): Promise<{
    validRecords: StudentRecord[];
    invalidRecords: Array<{ record: StudentRecord; errors: StudentValidationError[] }>;
    summary: {
      total: number;
      valid: number;
      invalid: number;
      missingFieldsByType: Record<string, number>;
    };
  }> {
    const validationResult = this.validateBulkRecords(records);
    
    // Log the bulk validation action
    const errorMap = new Map<number, string[]>();
    validationResult.invalidRecords.forEach(({ record, errors }) => {
      const rowIndex = record.rowIndex ?? 0;
      errorMap.set(rowIndex, errors.map((e) => e.error));
    });

    await ValidationActionLogger.logBulkFieldValidation(
      adminId,
      adminEmail,
      validationResult.summary.total,
      validationResult.summary.valid,
      validationResult.summary.invalid,
      errorMap
    );

    return validationResult;
  }

  /**
   * Validate multiple student records
   */
  static validateBulkRecords(
    records: StudentRecord[]
  ): {
    validRecords: StudentRecord[];
    invalidRecords: Array<{ record: StudentRecord; errors: StudentValidationError[] }>;
    summary: {
      total: number;
      valid: number;
      invalid: number;
      missingFieldsByType: Record<string, number>;
    };
  } {
    const validRecords: StudentRecord[] = [];
    const invalidRecords: Array<{ record: StudentRecord; errors: StudentValidationError[] }> = [];
    const missingFieldsByType: Record<string, number> = {};

    records.forEach((record, index) => {
      const validation = this.validateStudentRecord(record, index);

      if (validation.isValid) {
        validRecords.push(record);
      } else {
        invalidRecords.push({
          record,
          errors: validation.errors,
        });

        // Track missing fields
        validation.missingFields.forEach((field) => {
          missingFieldsByType[field] = (missingFieldsByType[field] || 0) + 1;
        });
      }
    });

    return {
      validRecords,
      invalidRecords,
      summary: {
        total: records.length,
        valid: validRecords.length,
        invalid: invalidRecords.length,
        missingFieldsByType,
      },
    };
  }

  /**
   * Validate a specific field value
   */
  private static isFieldValid(field: string, value: string): boolean {
    if (!value || value.trim() === '') return false;

    switch (field) {
      case 'student_id':
        // Student ID should be alphanumeric, no special characters except hyphen/underscore
        return /^[a-zA-Z0-9\-_]+$/.test(value) && value.length >= 3;

      case 'first_name':
      case 'last_name':
        // Names should contain only letters, spaces, hyphens, apostrophes
        return /^[a-zA-Z\s\-']+$/.test(value) && value.length >= 2;

      case 'year':
      case 'grade':
        // Year/Grade should be numeric or common grade formats
        return /^(\d{1,4}|[A-Z]|[1-6])$/.test(value.trim());

      case 'section':
      case 'block':
        // Section/Block should be alphanumeric
        return /^[a-zA-Z0-9-]+$/.test(value) && value.length >= 1;

      default:
        return true;
    }
  }

  /**
   * Validate email format
   */
  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Get human-readable error message for a validation result
   */
  static getErrorSummary(validationResult: StudentFieldValidationResult): string {
    if (validationResult.isValid) {
      return 'All required fields are present and valid';
    }

    const missingCount = validationResult.missingFields.size;
    const invalidCount = validationResult.invalidFields.size;
    const totalErrors = validationResult.errors.length;

    const parts: string[] = [];

    if (missingCount > 0) {
      const fields = Array.from(validationResult.missingFields)
        .map((f) => FIELD_DISPLAY_NAMES[f])
        .join(', ');
      parts.push(`Missing: ${fields}`);
    }

    if (invalidCount > 0) {
      const fields = Array.from(validationResult.invalidFields)
        .map((f) => FIELD_DISPLAY_NAMES[f])
        .join(', ');
      parts.push(`Invalid: ${fields}`);
    }

    return parts.join(' | ') || `${totalErrors} validation error(s)`;
  }

  /**
   * Highlight missing fields in a record
   */
  static getMissingFieldsHighlight(record: StudentRecord): {
    missingFields: string[];
    displayNames: string[];
  } {
    const missingFields: string[] = [];
    const displayNames: string[] = [];

    for (const field of REQUIRED_FIELDS) {
      const value = record[field];
      if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
        missingFields.push(field);
        displayNames.push(FIELD_DISPLAY_NAMES[field]);
      }
    }

    return { missingFields, displayNames };
  }

  /**
   * Get validation status for display
   */
  static getValidationStatus(record: StudentRecord): 'valid' | 'invalid' | 'incomplete' {
    const validation = this.validateStudentRecord(record);
    if (validation.isValid) return 'valid';
    if (validation.missingFields.size > 0) return 'incomplete';
    return 'invalid';
  }

  /**
   * Get detailed field errors for a record
   */
  static getFieldErrors(record: StudentRecord): Record<string, string> {
    const validation = this.validateStudentRecord(record);
    const fieldErrors: Record<string, string> = {};

    validation.errors.forEach((error) => {
      fieldErrors[error.field] = error.error;
    });

    return fieldErrors;
  }

  /**
   * Get required fields list
   */
  static getRequiredFields(): Array<{ key: string; displayName: string }> {
    return REQUIRED_FIELDS.map((key) => ({
      key,
      displayName: FIELD_DISPLAY_NAMES[key],
    }));
  }

  /**
   * Check if a specific field is required
   */
  static isFieldRequired(fieldName: string): boolean {
    return REQUIRED_FIELDS.includes(fieldName);
  }

  /**
   * Mark validated records as official with logging
   * Called after successful field validation and data quality check
   */
  static async markValidatedRecordsAsOfficial(
    studentIds: string[],
    validatedBy: string,
    adminEmail?: string
  ): Promise<{ success: number; failed: string[] }> {
    try {
      const { OfficialRecordService } = await import('./officialRecordService');
      const result = await OfficialRecordService.markMultipleAsOfficial(
        studentIds,
        validatedBy,
        adminEmail
      );

      // Log the bulk official marking
      if (adminEmail) {
        await ValidationActionLogger.logMarkAsOfficial(
          validatedBy,
          adminEmail,
          '',
          'Multiple students',
          true,
          studentIds.length
        );
      }

      return {
        success: result.success,
        failed: result.failed,
      };
    } catch (error) {
      console.error('Failed to mark validated records as official:', error);
      return {
        success: 0,
        failed: studentIds,
      };
    }
  }
}
