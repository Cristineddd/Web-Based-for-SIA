/**
 * Validation Action Logger Service
 * Logs all validation actions with admin ID, timestamp, and detailed action information
 * Provides audit trail for validation workflows and compliance tracking
 */

import { AuditLogger } from './auditLogger';

export interface ValidationActionLog {
  id?: string;
  adminId: string;
  adminEmail: string;
  timestamp: string;
  actionType:
    | 'field_validation'
    | 'bulk_validation'
    | 'quality_check'
    | 'duplicate_detection'
    | 'mark_official'
    | 'mark_pending'
    | 'validation_reset'
    | 'override_validation'
    | 'quality_override';
  actionStatus: 'success' | 'failed' | 'pending' | 'warning' | 'info';
  targetType: 'single_record' | 'bulk_records' | 'class' | 'student';
  targetId?: string;
  targetName?: string;
  recordsProcessed: number;
  recordsSuccessful: number;
  recordsFailed: number;
  validationErrors?: string[];
  qualityIssues?: {
    duplicates?: number;
    inconsistencies?: number;
    typos?: number;
    other?: number;
  };
  overrideReason?: string;
  metadata?: Record<string, unknown>;
  details?: string;
}

export class ValidationActionLogger {
  /**
   * Log a single field validation action
   */
  static async logFieldValidation(
    adminId: string,
    adminEmail: string,
    studentId: string,
    studentName: string,
    validationErrors: string[],
    isValid: boolean
  ): Promise<boolean> {
    try {
      const description = isValid
        ? `Field validation passed for ${studentName} (${studentId})`
        : `Field validation failed for ${studentName} (${studentId}): ${validationErrors.join(', ')}`;

      await AuditLogger.logActivity(
        adminId,
        adminEmail,
        'admin_action',
        description,
        {
          entityId: studentId,
          entityType: 'student',
          entityName: studentName,
          status: isValid ? 'success' : 'failed',
          metadata: {
            actionType: 'field_validation',
            validationErrors,
            isValid,
          },
        }
      );

      console.log(`[ValidationActionLogger] Logged field validation for ${studentName}`);
      return true;
    } catch (error) {
      console.error('[ValidationActionLogger] Error logging field validation:', error);
      return false;
    }
  }

  /**
   * Log bulk field validation
   */
  static async logBulkFieldValidation(
    adminId: string,
    adminEmail: string,
    totalRecords: number,
    successfulRecords: number,
    failedRecords: number,
    errors: Map<number, string[]>
  ): Promise<boolean> {
    try {
      const errorSummary = Array.from(errors.entries())
        .slice(0, 5)
        .map(([rowIdx, errs]) => `Row ${rowIdx}: ${errs.join(', ')}`)
        .join('; ');

      const description =
        failedRecords === 0
          ? `Bulk field validation completed: ${successfulRecords}/${totalRecords} records valid`
          : `Bulk field validation completed: ${successfulRecords}/${totalRecords} records valid, ${failedRecords} failed`;

      await AuditLogger.logActivity(
        adminId,
        adminEmail,
        'admin_action',
        description,
        {
          entityType: 'bulk_validation',
          status: failedRecords === 0 ? 'success' : 'failed',
          metadata: {
            actionType: 'bulk_validation',
            totalRecords,
            successfulRecords,
            failedRecords,
            errorCount: errors.size,
            errorSummary,
          },
        }
      );

      console.log(
        `[ValidationActionLogger] Logged bulk validation: ${successfulRecords}/${totalRecords} successful`
      );
      return true;
    } catch (error) {
      console.error('[ValidationActionLogger] Error logging bulk validation:', error);
      return false;
    }
  }

  /**
   * Log data quality check
   */
  static async logQualityCheck(
    adminId: string,
    adminEmail: string,
    recordsChecked: number,
    issuesFound: {
      duplicates?: number;
      inconsistencies?: number;
      typos?: number;
      total: number;
    },
    isClean: boolean
  ): Promise<boolean> {
    try {
      const description = isClean
        ? `Data quality check passed: ${recordsChecked} records checked, no issues`
        : `Data quality check found ${issuesFound.total} issue(s) in ${recordsChecked} records`;

      await AuditLogger.logActivity(
        adminId,
        adminEmail,
        'admin_action',
        description,
        {
          entityType: 'bulk_validation',
          status: isClean ? 'success' : 'pending',
          metadata: {
            actionType: 'quality_check',
            recordsChecked,
            issuesFound,
            isClean,
          },
        }
      );

      console.log(
        `[ValidationActionLogger] Logged quality check: ${recordsChecked} records, ${issuesFound.total} issues`
      );
      return true;
    } catch (error) {
      console.error('[ValidationActionLogger] Error logging quality check:', error);
      return false;
    }
  }

  /**
   * Log duplicate detection
   */
  static async logDuplicateDetection(
    adminId: string,
    adminEmail: string,
    duplicatesFound: {
      studentIdDuplicates?: string[];
      nameDuplicates?: string[];
      emailDuplicates?: string[];
      total: number;
    }
  ): Promise<boolean> {
    try {
      const idCount = duplicatesFound.studentIdDuplicates?.length ?? 0;
      const nameCount = duplicatesFound.nameDuplicates?.length ?? 0;
      const emailCount = duplicatesFound.emailDuplicates?.length ?? 0;

      const description =
        duplicatesFound.total === 0
          ? `Duplicate detection completed: No duplicates found`
          : `Duplicate detection found ${duplicatesFound.total} duplicate(s): ${idCount} ID dupes, ${nameCount} name dupes, ${emailCount} email dupes`;

      await AuditLogger.logActivity(
        adminId,
        adminEmail,
        'admin_action',
        description,
        {
          entityType: 'bulk_validation',
          status: duplicatesFound.total === 0 ? 'success' : 'pending',
          metadata: {
            actionType: 'duplicate_detection',
            duplicatesFound,
          },
        }
      );

      console.log(
        `[ValidationActionLogger] Logged duplicate detection: ${duplicatesFound.total} duplicates found`
      );
      return true;
    } catch (error) {
      console.error('[ValidationActionLogger] Error logging duplicate detection:', error);
      return false;
    }
  }

  /**
   * Log official record marking
   */
  static async logMarkAsOfficial(
    adminId: string,
    adminEmail: string,
    studentId: string,
    studentName: string,
    isBulk: boolean = false,
    totalRecords?: number
  ): Promise<boolean> {
    try {
      const description = isBulk
        ? `Marked ${totalRecords} record(s) as official`
        : `Marked student ${studentName} (${studentId}) as official`;

      await AuditLogger.logActivity(
        adminId,
        adminEmail,
        'admin_action',
        description,
        {
          entityId: studentId,
          entityType: isBulk ? 'bulk_records' : 'student',
          entityName: studentName,
          status: 'success',
          metadata: {
            actionType: 'mark_official',
            isBulk,
            totalRecords: isBulk ? totalRecords : 1,
          },
        }
      );

      console.log(
        `[ValidationActionLogger] Logged mark as official: ${isBulk ? totalRecords + ' records' : studentName}`
      );
      return true;
    } catch (error) {
      console.error('[ValidationActionLogger] Error logging mark as official:', error);
      return false;
    }
  }

  /**
   * Log validation status change
   */
  static async logStatusChange(
    adminId: string,
    adminEmail: string,
    studentId: string,
    studentName: string,
    fromStatus: string,
    toStatus: string,
    reason?: string
  ): Promise<boolean> {
    try {
      const description = `Changed validation status for ${studentName} (${studentId}) from ${fromStatus} to ${toStatus}${reason ? ` - Reason: ${reason}` : ''}`;

      await AuditLogger.logActivity(
        adminId,
        adminEmail,
        'admin_action',
        description,
        {
          entityId: studentId,
          entityType: 'student',
          entityName: studentName,
          status: 'success',
          metadata: {
            actionType: 'validation_status_change',
            fromStatus,
            toStatus,
            reason,
          },
        }
      );

      console.log(
        `[ValidationActionLogger] Logged status change: ${studentName} ${fromStatus} → ${toStatus}`
      );
      return true;
    } catch (error) {
      console.error('[ValidationActionLogger] Error logging status change:', error);
      return false;
    }
  }

  /**
   * Log validation override (bypassing validation for specific reason)
   */
  static async logValidationOverride(
    adminId: string,
    adminEmail: string,
    studentId: string,
    studentName: string,
    overrideType: 'quality_issues' | 'field_validation' | 'duplicate_detection',
    overrideReason: string,
    affectedCount?: number
  ): Promise<boolean> {
    try {
      const description = `Validation override (${overrideType}): ${studentName} (${studentId}) - Reason: ${overrideReason}`;

      await AuditLogger.logActivity(
        adminId,
        adminEmail,
        'admin_action',
        description,
        {
          entityId: studentId,
          entityType: 'student',
          entityName: studentName,
          status: 'pending',
          metadata: {
            actionType: 'validation_override',
            overrideType,
            overrideReason,
            affectedCount: affectedCount ?? 1,
          },
        }
      );

      console.log(
        `[ValidationActionLogger] Logged validation override: ${studentName} - ${overrideType}`
      );
      return true;
    } catch (error) {
      console.error('[ValidationActionLogger] Error logging validation override:', error);
      return false;
    }
  }

  /**
   * Log validation reset (clearing validation status for revalidation)
   */
  static async logValidationReset(
    adminId: string,
    adminEmail: string,
    studentIds: string[],
    studentNames: string[],
    reason: string
  ): Promise<boolean> {
    try {
      const isMultiple = studentIds.length > 1;
      const description = isMultiple
        ? `Reset validation for ${studentIds.length} student(s) - Reason: ${reason}`
        : `Reset validation for ${studentNames[0]} (${studentIds[0]}) - Reason: ${reason}`;

      await AuditLogger.logActivity(
        adminId,
        adminEmail,
        'admin_action',
        description,
        {
          entityType: isMultiple ? 'bulk_records' : 'student',
          status: 'pending',
          metadata: {
            actionType: 'validation_reset',
            studentIds,
            studentNames,
            recordCount: studentIds.length,
            reason,
          },
        }
      );

      console.log(
        `[ValidationActionLogger] Logged validation reset: ${studentIds.length} record(s) reset`
      );
      return true;
    } catch (error) {
      console.error('[ValidationActionLogger] Error logging validation reset:', error);
      return false;
    }
  }

  /**
   * Get validation action logs with optional filtering
   */
  static async getValidationLogs(
    _options?: {
      adminId?: string;
      actionType?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ): Promise<ValidationActionLog[]> {
    try {
      // TODO: Implement Firestore query when needed
      // For now, returns empty array
      return [];
    } catch (error) {
      console.error('[ValidationActionLogger] Error retrieving validation logs:', error);
      return [];
    }
  }

  /**
   * Get validation statistics for dashboard
   */
  static async getValidationStatistics(): Promise<{
    totalValidations: number;
    successfulValidations: number;
    failedValidations: number;
    overridesApplied: number;
    recentActions: ValidationActionLog[];
  }> {
    try {
      // TODO: Implement Firestore aggregation when needed
      return {
        totalValidations: 0,
        successfulValidations: 0,
        failedValidations: 0,
        overridesApplied: 0,
        recentActions: [],
      };
    } catch (error) {
      console.error('[ValidationActionLogger] Error retrieving statistics:', error);
      return {
        totalValidations: 0,
        successfulValidations: 0,
        failedValidations: 0,
        overridesApplied: 0,
        recentActions: [],
      };
    }
  }
}
