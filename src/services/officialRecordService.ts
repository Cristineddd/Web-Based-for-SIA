/**
 * Official Record Service
 * Manages validation status and marks student records as official
 * Ensures only validated students are marked as official in the database
 * Logs all validation status changes for audit trail
 */

import {
  collection,
  doc,
  updateDoc,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ValidationActionLogger } from './validationActionLogger';

export interface StudentRecord {
  student_id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  enrolled_classes: string[];
  created_at: string;
  updated_at: string;
  created_by: string;
  validation_status?: 'official' | 'unvalidated' | 'pending';
  validation_date?: string;
  validated_by?: string;
}

export type ValidationStatus = 'official' | 'unvalidated' | 'pending';

const STUDENTS_COLLECTION = 'students';

export class OfficialRecordService {
  private static getAuditEmail(adminId: string, adminEmail?: string): string {
    const normalized = (adminEmail || '').trim();
    if (normalized) return normalized;
    return `${adminId}@system.local`;
  }

  /**
   * Mark a single student record as official after validation with logging
   * @param studentId - Student ID to mark as official
   * @param validatedBy - Admin/user ID who validated the record
   * @param validatedByEmail - Admin email for logging
   * @param studentName - Student name for logging
   * @returns true if successful, false otherwise
   */
  static async markAsOfficialWithLogging(
    studentId: string,
    validatedBy: string,
    validatedByEmail: string,
    studentName: string
  ): Promise<boolean> {
    return this.markAsOfficial(studentId, validatedBy, validatedByEmail, studentName);
  }

  /**
   * Mark multiple student records as official after batch validation with logging
   * @param studentIds - Array of student IDs to mark as official
   * @param validatedBy - Admin/user ID who validated the records
   * @param validatedByEmail - Admin email for logging
   * @returns Object with success count and failed IDs
   */
  static async markMultipleAsOfficialWithLogging(
    studentIds: string[],
    validatedBy: string,
    validatedByEmail: string
  ): Promise<{
    success: number;
    failed: string[];
    total: number;
  }> {
    return this.markMultipleAsOfficial(studentIds, validatedBy, validatedByEmail);
  }

  /**
   * Mark a single student record as official after validation
   * @param studentId - Student ID to mark as official
   * @param validatedBy - Admin/user ID who validated the record
   * @returns true if successful, false otherwise
   */
  static async markAsOfficial(
    studentId: string,
    validatedBy: string,
    validatedByEmail?: string,
    studentName?: string
  ): Promise<boolean> {
    try {
      const studentRef = doc(db, STUDENTS_COLLECTION, studentId);
      await updateDoc(studentRef, {
        validation_status: 'official',
        validation_date: new Date().toISOString(),
        validated_by: validatedBy,
        updated_at: new Date().toISOString(),
      });

      await ValidationActionLogger.logMarkAsOfficial(
        validatedBy,
        this.getAuditEmail(validatedBy, validatedByEmail),
        studentId,
        studentName || studentId,
        false
      );
      return true;
    } catch (error) {
      console.error(`Failed to mark student ${studentId} as official:`, error);
      return false;
    }
  }

  /**
   * Mark multiple student records as official after batch validation
   * @param studentIds - Array of student IDs to mark as official
   * @param validatedBy - Admin/user ID who validated the records
   * @returns Object with success count and failed IDs
   */
  static async markMultipleAsOfficial(
    studentIds: string[],
    validatedBy: string,
    validatedByEmail?: string
  ): Promise<{
    success: number;
    failed: string[];
    total: number;
  }> {
    const failed: string[] = [];
    let success = 0;

    for (const studentId of studentIds) {
      const result = await this.markAsOfficial(studentId, validatedBy, validatedByEmail);
      if (result) {
        success++;
      } else {
        failed.push(studentId);
      }
    }

    return {
      success,
      failed,
      total: studentIds.length,
    };
  }

  /**
   * Mark a record as pending validation (intermediate status)
   * @param studentId - Student ID to mark as pending
   */
  static async markAsPending(studentId: string): Promise<boolean> {
    try {
      const studentRef = doc(db, STUDENTS_COLLECTION, studentId);
      await updateDoc(studentRef, {
        validation_status: 'pending',
        updated_at: new Date().toISOString(),
      });
      return true;
    } catch (error) {
      console.error(`Failed to mark student ${studentId} as pending:`, error);
      return false;
    }
  }

  /**
   * Get all official student records
   * @returns Array of official student records
   */
  static async getOfficialRecords(): Promise<StudentRecord[]> {
    try {
      const q = query(
        collection(db, STUDENTS_COLLECTION),
        where('validation_status', '==', 'official')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({
        ...doc.data(),
        student_id: doc.id,
      })) as StudentRecord[];
    } catch (error) {
      console.error('Failed to fetch official records:', error);
      return [];
    }
  }

  /**
   * Get all unvalidated student records
   * @returns Array of unvalidated student records
   */
  static async getUnvalidatedRecords(): Promise<StudentRecord[]> {
    try {
      const q = query(
        collection(db, STUDENTS_COLLECTION),
        where('validation_status', '==', 'unvalidated')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({
        ...doc.data(),
        student_id: doc.id,
      })) as StudentRecord[];
    } catch (error) {
      console.error('Failed to fetch unvalidated records:', error);
      return [];
    }
  }

  /**
   * Get all pending student records
   * @returns Array of pending student records
   */
  static async getPendingRecords(): Promise<StudentRecord[]> {
    try {
      const q = query(
        collection(db, STUDENTS_COLLECTION),
        where('validation_status', '==', 'pending')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({
        ...doc.data(),
        student_id: doc.id,
      })) as StudentRecord[];
    } catch (error) {
      console.error('Failed to fetch pending records:', error);
      return [];
    }
  }

  /**
   * Check if a student record is official
   * @param studentId - Student ID to check
   * @returns true if record is official, false otherwise
   */
  static async isOfficial(studentId: string): Promise<boolean> {
    try {
      const snapshot = await getDocs(query(collection(db, STUDENTS_COLLECTION), where('student_id', '==', studentId)));
      
      if (snapshot.empty) return false;
      
      const studentData = snapshot.docs[0].data() as StudentRecord;
      return studentData.validation_status === 'official';
    } catch (error) {
      console.error(`Failed to check official status for ${studentId}:`, error);
      return false;
    }
  }

  /**
   * Get validation status of a student record
   * @param studentId - Student ID to check
   * @returns Validation status or 'unvalidated' if not found
   */
  static async getValidationStatus(studentId: string): Promise<ValidationStatus> {
    try {
      const q = query(
        collection(db, STUDENTS_COLLECTION),
        where('student_id', '==', studentId)
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) return 'unvalidated';

      const studentData = snapshot.docs[0].data() as StudentRecord;
      return (studentData.validation_status as ValidationStatus) || 'unvalidated';
    } catch (error) {
      console.error(`Failed to get validation status for ${studentId}:`, error);
      return 'unvalidated';
    }
  }

  /**
   * Get validation metadata for a student record
   * @param studentId - Student ID to check
   * @returns Object with validation_date and validated_by, or null if not official
   */
  static async getValidationMetadata(
    studentId: string
  ): Promise<{
    validation_date?: string;
    validated_by?: string;
    status: ValidationStatus;
  } | null> {
    try {
      const q = query(
        collection(db, STUDENTS_COLLECTION),
        where('student_id', '==', studentId)
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return {
          status: 'unvalidated',
        };
      }

      const studentData = snapshot.docs[0].data() as StudentRecord;
      return {
        validation_date: studentData.validation_date,
        validated_by: studentData.validated_by,
        status: (studentData.validation_status as ValidationStatus) || 'unvalidated',
      };
    } catch (error) {
      console.error(`Failed to get validation metadata for ${studentId}:`, error);
      return null;
    }
  }

  /**
   * Reset validation status for a student record with logging (admin only)
   * @param studentId - Student ID to reset
   * @param adminId - Admin ID performing the reset
   * @param adminEmail - Admin email for logging
   * @param studentName - Student name for logging
   * @param reason - Reason for reset
   * @returns true if successful, false otherwise
   */
  static async resetValidationStatusWithLogging(
    studentId: string,
    adminId: string,
    adminEmail: string,
    studentName: string,
    reason: string
  ): Promise<boolean> {
    return this.resetValidationStatus(studentId, adminId, adminEmail, studentName, reason);
  }

  /**
   * Reset validation status for a student record (admin only)
   * @param studentId - Student ID to reset
   * @returns true if successful, false otherwise
   */
  static async resetValidationStatus(
    studentId: string,
    adminId?: string,
    adminEmail?: string,
    studentName: string = 'Unknown Student',
    reason: string = 'Validation status reset'
  ): Promise<boolean> {
    try {
      const studentRef = doc(db, STUDENTS_COLLECTION, studentId);
      await updateDoc(studentRef, {
        validation_status: 'unvalidated',
        validation_date: null,
        validated_by: null,
        updated_at: new Date().toISOString(),
      });

      if (adminId) {
        await ValidationActionLogger.logValidationReset(
          adminId,
          this.getAuditEmail(adminId, adminEmail),
          [studentId],
          [studentName],
          reason
        );
      }
      return true;
    } catch (error) {
      console.error(`Failed to reset validation status for ${studentId}:`, error);
      return false;
    }
  }

  /**
   * Get validation statistics across all students
   * @returns Object with counts of official, unvalidated, and pending records
   */
  static async getValidationStatistics(): Promise<{
    official: number;
    unvalidated: number;
    pending: number;
    total: number;
  }> {
    try {
      const officialRecords = await this.getOfficialRecords();
      const unvalidatedRecords = await this.getUnvalidatedRecords();
      const pendingRecords = await this.getPendingRecords();

      return {
        official: officialRecords.length,
        unvalidated: unvalidatedRecords.length,
        pending: pendingRecords.length,
        total: officialRecords.length + unvalidatedRecords.length + pendingRecords.length,
      };
    } catch (error) {
      console.error('Failed to get validation statistics:', error);
      return {
        official: 0,
        unvalidated: 0,
        pending: 0,
        total: 0,
      };
    }
  }
}
