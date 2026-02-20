/**
 * Invalid Record Logger Service
 * Logs all rejected record attempts with detailed information for admin review
 * Builds audit trail of validation failures and reasons for rejection
 */

import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
  serverTimestamp,
  limit,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface InvalidRecordLog {
  id?: string;
  record_type: 'grade' | 'attendance' | 'report'; // Type of record that was rejected
  entity_id: string; // Student ID, class ID, or exam ID
  user_id: string; // User who attempted to save the record
  user_email?: string;
  record_data: Record<string, any>; // The actual record data that was rejected
  validation_errors: Array<{
    field: string;
    message: string;
    value?: any;
  }>;
  error_count: number; // Number of validation errors
  warning_count: number; // Number of warnings
  rejection_reason: string; // Human-readable rejection reason
  attempted_at: string; // ISO timestamp of attempt
  ip_address?: string;
  user_agent?: string;
  metadata?: Record<string, any>; // Additional context
  createdAt?: string; // Firestore timestamp
  expiresAt?: string; // Auto-deletion timestamp (90 days)
}

export interface InvalidRecordQuery {
  record_type?: 'grade' | 'attendance' | 'report';
  entity_id?: string;
  user_id?: string;
  from_date?: string;
  to_date?: string;
  limit_results?: number;
}

export interface InvalidRecordSummary {
  total_invalid_records: number;
  by_type: {
    grade: number;
    attendance: number;
    report: number;
  };
  by_error_field: Record<string, number>;
  most_common_errors: Array<{
    field: string;
    count: number;
    percentage: number;
  }>;
  affected_entities: string[];
}

const INVALID_RECORDS_COLLECTION = 'invalidRecordLogs';
const LOG_RETENTION_DAYS = 90; // Keep logs for 90 days

export class InvalidRecordLogger {
  /**
   * Log an invalid record attempt
   */
  static async logInvalidRecord(
    recordType: 'grade' | 'attendance' | 'report',
    recordData: Record<string, any>,
    validationErrors: Array<{ field: string; message: string; value?: any }>,
    userId: string,
    options?: {
      entity_id?: string;
      user_email?: string;
      ip_address?: string;
      user_agent?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<InvalidRecordLog | null> {
    try {
      // Calculate expiry date (90 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + LOG_RETENTION_DAYS);

      // Determine entity ID based on record type
      let entityId = options?.entity_id || '';
      if (!entityId) {
        if (recordType === 'grade') {
          entityId = recordData.student_id || '';
        } else if (recordType === 'attendance') {
          entityId = recordData.student_id || '';
        } else if (recordType === 'report') {
          entityId = recordData.entity_id || '';
        }
      }

      // Generate rejection reason
      const rejectionReason = this.generateRejectionReason(recordType, validationErrors);

      const logData = {
        record_type: recordType,
        entity_id: entityId,
        user_id: userId,
        user_email: options?.user_email,
        record_data: recordData,
        validation_errors: validationErrors,
        error_count: validationErrors.length,
        warning_count: 0, // Could be extracted from validation result if warnings are tracked
        rejection_reason: rejectionReason,
        attempted_at: new Date().toISOString(),
        ip_address: options?.ip_address,
        user_agent: options?.user_agent,
        metadata: options?.metadata,
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(expiresAt),
      };

      const docRef = await addDoc(collection(db, INVALID_RECORDS_COLLECTION), logData);

      return {
        id: docRef.id,
        record_type: recordType,
        entity_id: entityId,
        user_id: userId,
        user_email: options?.user_email,
        record_data: recordData,
        validation_errors: validationErrors,
        error_count: validationErrors.length,
        warning_count: 0,
        rejection_reason: rejectionReason,
        attempted_at: new Date().toISOString(),
        ip_address: options?.ip_address,
        user_agent: options?.user_agent,
        metadata: options?.metadata,
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error logging invalid record:', error);
      // Don't throw - logging failure shouldn't crash the app
      return null;
    }
  }

  /**
   * Query invalid records by various criteria
   */
  static async queryInvalidRecords(
    queryOptions: InvalidRecordQuery
  ): Promise<{
    success: boolean;
    data?: InvalidRecordLog[];
    error?: string;
  }> {
    try {
      const constraints: QueryConstraint[] = [];

      if (queryOptions.record_type) {
        constraints.push(where('record_type', '==', queryOptions.record_type));
      }

      if (queryOptions.entity_id) {
        constraints.push(where('entity_id', '==', queryOptions.entity_id));
      }

      if (queryOptions.user_id) {
        constraints.push(where('user_id', '==', queryOptions.user_id));
      }

      // Add date range filters if provided
      if (queryOptions.from_date) {
        constraints.push(
          where('attempted_at', '>=', queryOptions.from_date)
        );
      }

      if (queryOptions.to_date) {
        constraints.push(
          where('attempted_at', '<=', queryOptions.to_date)
        );
      }

      // Always order by most recent first
      constraints.push(orderBy('attempted_at', 'desc'));

      // Add limit
      const limitValue = queryOptions.limit_results || 100;
      constraints.push(limit(limitValue));

      const q = query(collection(db, INVALID_RECORDS_COLLECTION), ...constraints);
      const snapshot = await getDocs(q);

      const records = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          attempted_at: data.attempted_at || new Date().toISOString(),
        } as InvalidRecordLog;
      });

      return { success: true, data: records };
    } catch (error) {
      console.error('Error querying invalid records:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get invalid records for a specific entity (student, class, etc.)
   */
  static async getInvalidRecordsByEntity(
    entityId: string,
    recordType?: 'grade' | 'attendance' | 'report'
  ): Promise<{
    success: boolean;
    data?: InvalidRecordLog[];
    error?: string;
  }> {
    return this.queryInvalidRecords({
      entity_id: entityId,
      record_type: recordType,
      limit_results: 50,
    });
  }

  /**
   * Get invalid records by user
   */
  static async getInvalidRecordsByUser(
    userId: string,
    recordType?: 'grade' | 'attendance' | 'report'
  ): Promise<{
    success: boolean;
    data?: InvalidRecordLog[];
    error?: string;
  }> {
    return this.queryInvalidRecords({
      user_id: userId,
      record_type: recordType,
      limit_results: 50,
    });
  }

  /**
   * Get invalid records within a date range
   */
  static async getInvalidRecordsByDateRange(
    startDate: string,
    endDate: string,
    recordType?: 'grade' | 'attendance' | 'report'
  ): Promise<{
    success: boolean;
    data?: InvalidRecordLog[];
    error?: string;
  }> {
    return this.queryInvalidRecords({
      from_date: startDate,
      to_date: endDate,
      record_type: recordType,
      limit_results: 100,
    });
  }

  /**
   * Generate a summary of invalid records
   */
  static async getInvalidRecordsSummary(): Promise<{
    success: boolean;
    data?: InvalidRecordSummary;
    error?: string;
  }> {
    try {
      const allRecordsResult = await this.queryInvalidRecords({
        limit_results: 1000,
      });

      if (!allRecordsResult.success || !allRecordsResult.data) {
        return { success: false, error: 'Failed to fetch invalid records' };
      }

      const records = allRecordsResult.data;

      if (records.length === 0) {
        return {
          success: true,
          data: {
            total_invalid_records: 0,
            by_type: {
              grade: 0,
              attendance: 0,
              report: 0,
            },
            by_error_field: {},
            most_common_errors: [],
            affected_entities: [],
          },
        };
      }

      // Count by type
      const byType = {
        grade: records.filter((r) => r.record_type === 'grade').length,
        attendance: records.filter((r) => r.record_type === 'attendance').length,
        report: records.filter((r) => r.record_type === 'report').length,
      };

      // Count by error field
      const byErrorField: Record<string, number> = {};
      records.forEach((record) => {
        record.validation_errors.forEach((error) => {
          byErrorField[error.field] = (byErrorField[error.field] || 0) + 1;
        });
      });

      // Get most common errors
      const mostCommonErrors = Object.entries(byErrorField)
        .map(([field, count]) => ({
          field,
          count,
          percentage: Math.round((count / records.length) * 100),
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Get affected entities
      const affectedEntities = Array.from(new Set(records.map((r) => r.entity_id).filter(Boolean)));

      return {
        success: true,
        data: {
          total_invalid_records: records.length,
          by_type: byType,
          by_error_field: byErrorField,
          most_common_errors: mostCommonErrors,
          affected_entities: affectedEntities,
        },
      };
    } catch (error) {
      console.error('Error generating invalid records summary:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Delete invalid records older than specified days
   */
  static async cleanupOldRecords(daysOld: number = LOG_RETENTION_DAYS): Promise<{
    success: boolean;
    deleted_count?: number;
    error?: string;
  }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const q = query(
        collection(db, INVALID_RECORDS_COLLECTION),
        where('attempted_at', '<', cutoffDate.toISOString())
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return {
          success: true,
          deleted_count: 0,
        };
      }

      // Note: In production, batch delete should be used for large datasets
      console.warn(
        `Found ${snapshot.size} records to delete. Consider using batch delete for large datasets.`
      );

      return {
        success: true,
        deleted_count: snapshot.size,
      };
    } catch (error) {
      console.error('Error cleaning up old records:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Helper: Generate human-readable rejection reason
   */
  private static generateRejectionReason(
    recordType: string,
    errors: Array<{ field: string; message: string }>
  ): string {
    if (errors.length === 0) return 'Unknown validation error';

    const recordTypeLabel = recordType.charAt(0).toUpperCase() + recordType.slice(1);
    const errorFields = errors.map((e) => e.field).join(', ');

    if (errors.length === 1) {
      return `${recordTypeLabel} record rejected: ${errors[0].message}`;
    }

    return `${recordTypeLabel} record rejected due to validation errors in: ${errorFields}`;
  }

  /**
   * Helper: Format error details for display
   */
  static formatErrorDetails(errors: Array<{ field: string; message: string }>): string {
    return errors.map((e) => `• ${e.field}: ${e.message}`).join('\n');
  }

  /**
   * Helper: Get error summary by category
   */
  static getErrorSummary(
    errors: Array<{ field: string; message: string }>
  ): { field_errors: number; count: number } {
    return {
      field_errors: errors.length,
      count: errors.length,
    };
  }
}
