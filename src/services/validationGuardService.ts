/**
 * Validation Guard Service
 * Prevents unvalidated entries from being used across modules
 * Enforces official record status requirement
 */

import { OfficialRecordService } from './officialRecordService';

export interface ValidationGuardResult {
  isAllowed: boolean;
  reason?: string;
  studentStatus?: 'official' | 'unvalidated' | 'pending';
  blockedStudents?: string[];
  allowedStudents?: string[];
}

export class ValidationGuardService {
  /**
   * Check if a single student can be used in a module
   * @param studentId - Student ID to check
   * @param moduleName - Name of the module requesting access
   * @returns ValidationGuardResult with decision
   */
  static async canUseInModule(
    studentId: string,
    moduleName: string
  ): Promise<ValidationGuardResult> {
    try {
      const status = await OfficialRecordService.getValidationStatus(studentId);

      if (status === 'official') {
        return {
          isAllowed: true,
        };
      }

      const blockingMessage =
        status === 'unvalidated'
          ? `Student ${studentId} is unvalidated and cannot be used in ${moduleName}`
          : `Student ${studentId} is pending validation and cannot be used in ${moduleName}`;

      return {
        isAllowed: false,
        reason: blockingMessage,
        studentStatus: status,
      };
    } catch (error) {
      console.error(`Failed to check validation for student ${studentId}:`, error);
      return {
        isAllowed: false,
        reason: 'Failed to verify student validation status',
        studentStatus: 'unvalidated',
      };
    }
  }

  /**
   * Check if multiple students can be used in a module
   * @param studentIds - Array of student IDs to check
   * @param moduleName - Name of the module requesting access
   * @returns ValidationGuardResult with allowed/blocked lists
   */
  static async canUseMultipleInModule(
    studentIds: string[],
    moduleName: string
  ): Promise<ValidationGuardResult> {
    const blockedStudents: string[] = [];
    const allowedStudents: string[] = [];

    for (const studentId of studentIds) {
      const result = await this.canUseInModule(studentId, moduleName);
      if (result.isAllowed) {
        allowedStudents.push(studentId);
      } else {
        blockedStudents.push(studentId);
      }
    }

    const allAllowed = blockedStudents.length === 0;

    return {
      isAllowed: allAllowed,
      reason: allAllowed
        ? undefined
        : `${blockedStudents.length} unvalidated student(s) cannot be used in ${moduleName}`,
      blockedStudents: blockedStudents.length > 0 ? blockedStudents : undefined,
      allowedStudents: allowedStudents.length > 0 ? allowedStudents : undefined,
    };
  }

  /**
   * Check if students can be used in exams module
   * @param studentIds - Array of student IDs
   * @returns ValidationGuardResult
   */
  static async canUseInExams(studentIds: string[]): Promise<ValidationGuardResult> {
    return this.canUseMultipleInModule(studentIds, 'Exams');
  }

  /**
   * Check if students can be used in class enrollment
   * @param studentIds - Array of student IDs
   * @returns ValidationGuardResult
   */
  static async canUseInClasses(studentIds: string[]): Promise<ValidationGuardResult> {
    return this.canUseMultipleInModule(studentIds, 'Classes');
  }

  /**
   * Check if students can be used in results/reports
   * @param studentIds - Array of student IDs
   * @returns ValidationGuardResult
   */
  static async canUseInResults(studentIds: string[]): Promise<ValidationGuardResult> {
    return this.canUseMultipleInModule(studentIds, 'Results');
  }

  /**
   * Check if students can be used in dashboard
   * @param studentIds - Array of student IDs
   * @returns ValidationGuardResult
   */
  static async canUseInDashboard(studentIds: string[]): Promise<ValidationGuardResult> {
    return this.canUseMultipleInModule(studentIds, 'Dashboard');
  }

  /**
   * Enforce validation requirement with ability to override (admin only)
   * @param studentIds - Array of student IDs
   * @param moduleName - Module name
   * @param adminOverride - Whether admin override is enabled
   * @param isAdmin - Whether caller is admin
   * @returns ValidationGuardResult
   */
  static async enforceValidationRequirement(
    studentIds: string[],
    moduleName: string,
    adminOverride: boolean = false,
    isAdmin: boolean = false
  ): Promise<ValidationGuardResult> {
    const result = await this.canUseMultipleInModule(studentIds, moduleName);

    // If not allowed and admin override is not enabled or user is not admin
    if (!result.isAllowed && (!adminOverride || !isAdmin)) {
      return result;
    }

    // If admin override is enabled and user is admin, allow despite validation status
    if (adminOverride && isAdmin && !result.isAllowed) {
      return {
        isAllowed: true,
        reason: 'Access granted with admin override',
      };
    }

    return result;
  }

  /**
   * Get detailed validation report for a set of students
   * @param studentIds - Array of student IDs
   * @returns Object with validation breakdown by status
   */
  static async getValidationReport(
    studentIds: string[]
  ): Promise<{
    total: number;
    official: number;
    unvalidated: number;
    pending: number;
    officialIds?: string[];
    unvalidatedIds?: string[];
    pendingIds?: string[];
  }> {
    const report = {
      total: studentIds.length,
      official: 0,
      unvalidated: 0,
      pending: 0,
      officialIds: [] as string[],
      unvalidatedIds: [] as string[],
      pendingIds: [] as string[],
    };

    for (const studentId of studentIds) {
      const status = await OfficialRecordService.getValidationStatus(studentId);

      switch (status) {
        case 'official':
          report.official++;
          report.officialIds.push(studentId);
          break;
        case 'pending':
          report.pending++;
          report.pendingIds.push(studentId);
          break;
        case 'unvalidated':
          report.unvalidated++;
          report.unvalidatedIds.push(studentId);
          break;
      }
    }

    return report;
  }

  /**
   * Filter students to only official records
   * @param studentIds - Array of student IDs
   * @returns Array of official student IDs
   */
  static async filterToOfficialOnly(studentIds: string[]): Promise<string[]> {
    const officialIds: string[] = [];

    for (const studentId of studentIds) {
      const status = await OfficialRecordService.getValidationStatus(studentId);
      if (status === 'official') {
        officialIds.push(studentId);
      }
    }

    return officialIds;
  }

  /**
   * Generate warning message for blocked students
   * @param blockedStudents - Array of blocked student IDs
   * @param moduleName - Module name
   * @returns Formatted warning message
   */
  static generateWarningMessage(blockedStudents: string[], moduleName: string): string {
    if (blockedStudents.length === 0) return '';

    const studentsList = blockedStudents.slice(0, 5).join(', ');
    const suffix = blockedStudents.length > 5 ? ` and ${blockedStudents.length - 5} more` : '';

    return `The following students are unvalidated and cannot be used in ${moduleName}: ${studentsList}${suffix}. Please validate these records first.`;
  }
}
