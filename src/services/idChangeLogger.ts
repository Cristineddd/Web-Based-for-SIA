/**
 * ID Change Logger Service
 * Logs all student ID changes with timestamp, admin info, and change details
 * Implements audit trail for compliance and security requirements
 */

import { AuditLogger } from './auditLogger';

export interface IDChangeRecord {
  studentName: string;
  oldId: string | null;
  newId: string;
  classId: string;
  className: string;
  reason?: string;
  changeType: 'create' | 'update' | 'import' | 'bulk_import';
}

export interface IDChangeLog {
  id: string;
  adminId: string;
  adminEmail: string;
  timestamp: string;
  changeRecords: IDChangeRecord[];
  totalChanges: number;
  status: 'success' | 'failed' | 'partial';
  metadata?: Record<string, unknown>;
}

export class IDChangeLogger {
  /**
   * Log a single student ID change
   */
  static async logSingleIDChange(
    adminId: string,
    adminEmail: string,
    record: IDChangeRecord
  ): Promise<boolean> {
    try {
      const description = record.oldId
        ? `Student ID changed from ${record.oldId} to ${record.newId} for ${record.studentName}`
        : `New student ID ${record.newId} created for ${record.studentName}`;

      await AuditLogger.logActivity(
        adminId,
        adminEmail,
        'admin_action',
        description,
        {
          entityId: record.classId,
          entityType: 'student_class',
          entityName: record.className,
          status: 'success',
          metadata: {
            changeType: record.changeType,
            oldId: record.oldId,
            newId: record.newId,
            studentName: record.studentName,
            reason: record.reason,
          },
        }
      );

      console.log(`[IDChangeLogger] Logged single ID change: ${record.oldId} → ${record.newId}`);
      return true;
    } catch (error) {
      console.error('[IDChangeLogger] Error logging single ID change:', error);
      return false;
    }
  }

  /**
   * Log bulk ID changes (e.g., from file import)
   */
  static async logBulkIDChanges(
    adminId: string,
    adminEmail: string,
    records: IDChangeRecord[],
    classId: string,
    className: string
  ): Promise<boolean> {
    try {
      if (records.length === 0) {
        console.warn('[IDChangeLogger] No records to log');
        return true;
      }

      // Count changes by type
      const createCount = records.filter(r => r.changeType === 'create').length;
      const updateCount = records.filter(r => r.changeType === 'update').length;
      const importCount = records.filter(r => r.changeType === 'import').length;

      const summary =
        `Bulk ID import for class "${className}": ` +
        `${createCount} new IDs created, ${updateCount} IDs updated, ${importCount} IDs imported`;

      await AuditLogger.logActivity(
        adminId,
        adminEmail,
        'student_import',
        summary,
        {
          entityId: classId,
          entityType: 'student_class',
          entityName: className,
          status: 'success',
          metadata: {
            changeType: 'bulk_import',
            totalRecords: records.length,
            createCount,
            updateCount,
            importCount,
            records: records.map(r => ({
              studentName: r.studentName,
              oldId: r.oldId,
              newId: r.newId,
              changeType: r.changeType,
            })),
          },
        }
      );

      console.log(
        `[IDChangeLogger] Logged bulk ID changes: ${records.length} records for class "${className}"`
      );
      return true;
    } catch (error) {
      console.error('[IDChangeLogger] Error logging bulk ID changes:', error);
      return false;
    }
  }

  /**
   * Log ID update for existing student
   */
  static async logIDUpdate(
    adminId: string,
    adminEmail: string,
    studentName: string,
    oldId: string,
    newId: string,
    classId: string,
    className: string,
    reason?: string
  ): Promise<boolean> {
    const record: IDChangeRecord = {
      studentName,
      oldId,
      newId,
      classId,
      className,
      reason,
      changeType: 'update',
    };

    return this.logSingleIDChange(adminId, adminEmail, record);
  }

  /**
   * Log new student ID creation
   */
  static async logIDCreation(
    adminId: string,
    adminEmail: string,
    studentName: string,
    newId: string,
    classId: string,
    className: string
  ): Promise<boolean> {
    const record: IDChangeRecord = {
      studentName,
      oldId: null,
      newId,
      classId,
      className,
      changeType: 'create',
    };

    return this.logSingleIDChange(adminId, adminEmail, record);
  }

  /**
   * Log student ID from file import
   */
  static async logIDImport(
    adminId: string,
    adminEmail: string,
    studentName: string,
    oldId: string | null,
    newId: string,
    classId: string,
    className: string
  ): Promise<boolean> {
    const record: IDChangeRecord = {
      studentName,
      oldId,
      newId,
      classId,
      className,
      changeType: oldId ? 'import' : 'create',
    };

    return this.logSingleIDChange(adminId, adminEmail, record);
  }

  /**
   * Get ID change history for a student
   */
  static async getStudentIDHistory(
    studentId: string,
    _limit: number = 10
  ): Promise<IDChangeLog[]> {
    // This would query the auditLogs collection for records matching:
    // - entityType = 'student' or 'student_class'
    // - metadata contains oldId or newId matching studentId
    // Implementation depends on Firestore query structure
    
    console.log(`[IDChangeLogger] Retrieving history for student ID: ${studentId}`);
    // TODO: Implement Firestore query for ID history
    return [];
  }

  /**
   * Get ID change history for a class
   */
  static async getClassIDChangeHistory(
    classId: string,
    _limit: number = 100
  ): Promise<IDChangeLog[]> {
    // This would query the auditLogs collection for records matching:
    // - entityId = classId
    // - activity includes student_import or admin_action with ID changes
    
    console.log(`[IDChangeLogger] Retrieving ID change history for class: ${classId}`);
    // TODO: Implement Firestore query for class ID history
    return [];
  }
}
