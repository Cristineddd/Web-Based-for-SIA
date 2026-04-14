/**
 * Grade Audit Service
 * Provides specialised audit logging for all grade / score modifications.
 *
 * Each method delegates to `AuditLogger.logActivity` so that every grade
 * change is captured in the same `auditLogs` Firestore collection used by
 * the rest of the application — but enriched with `beforeValues` /
 * `afterValues` snapshots that enable diff rendering in the UI.
 */

import { AuditLogger } from './auditLogger';
import { GradeSnapshot, AuditLog } from '@/types/audit';

export interface GradeAuditContext {
  /** User ID of whoever performed the action */
  userId: string;
  /** Email of whoever performed the action */
  userEmail: string;
  /** Grade document ID */
  gradeId: string;
  /** Student ID associated with the grade */
  studentId: string;
  /** Exam ID associated with the grade */
  examId: string;
  /** Class ID associated with the grade */
  classId: string;
}

export class GradeAuditService {
  // ───────────────────────────────── Grade Created ─────────────────────────

  /**
   * Log a newly-created grade record.
   */
  static async logGradeCreated(
    ctx: GradeAuditContext,
    afterValues: GradeSnapshot
  ): Promise<AuditLog | null> {
    return AuditLogger.logActivity(
      ctx.userId,
      ctx.userEmail,
      'grade_created',
      `Grade created for student ${ctx.studentId} on exam ${ctx.examId} — score ${afterValues.score ?? '?'}/${afterValues.max_score ?? '?'}`,
      {
        entityId: ctx.gradeId,
        entityType: 'grade',
        entityName: `Grade: ${ctx.studentId}/${ctx.examId}`,
        afterValues,
        metadata: {
          studentId: ctx.studentId,
          examId: ctx.examId,
          classId: ctx.classId,
        },
      }
    );
  }

  // ───────────────────────────────── Grade Updated ─────────────────────────

  /**
   * Log an update to an existing grade record, capturing before/after diffs.
   */
  static async logGradeUpdated(
    ctx: GradeAuditContext,
    beforeValues: GradeSnapshot,
    afterValues: GradeSnapshot
  ): Promise<AuditLog | null> {
    const changes = GradeAuditService.describeChanges(beforeValues, afterValues);

    return AuditLogger.logActivity(
      ctx.userId,
      ctx.userEmail,
      'grade_updated',
      `Grade updated for student ${ctx.studentId} on exam ${ctx.examId} — ${changes}`,
      {
        entityId: ctx.gradeId,
        entityType: 'grade',
        entityName: `Grade: ${ctx.studentId}/${ctx.examId}`,
        beforeValues,
        afterValues,
        metadata: {
          studentId: ctx.studentId,
          examId: ctx.examId,
          classId: ctx.classId,
        },
      }
    );
  }

  // ───────────────────────────────── Grade Deleted ─────────────────────────

  /**
   * Log a grade deletion, capturing the values at time of deletion.
   */
  static async logGradeDeleted(
    ctx: GradeAuditContext,
    beforeValues: GradeSnapshot
  ): Promise<AuditLog | null> {
    return AuditLogger.logActivity(
      ctx.userId,
      ctx.userEmail,
      'grade_deleted',
      `Grade deleted for student ${ctx.studentId} on exam ${ctx.examId} — was ${beforeValues.score ?? '?'}/${beforeValues.max_score ?? '?'}`,
      {
        entityId: ctx.gradeId,
        entityType: 'grade',
        entityName: `Grade: ${ctx.studentId}/${ctx.examId}`,
        beforeValues,
        metadata: {
          studentId: ctx.studentId,
          examId: ctx.examId,
          classId: ctx.classId,
        },
      }
    );
  }

  // ───────────────────────────────── Grade Override ────────────────────────

  /**
   * Log a faculty duplicate-score override for a grade.
   */
  static async logGradeOverride(
    ctx: GradeAuditContext,
    originalGradeId: string,
    beforeValues: GradeSnapshot,
    afterValues: GradeSnapshot,
    overrideReason: string
  ): Promise<AuditLog | null> {
    return AuditLogger.logActivity(
      ctx.userId,
      ctx.userEmail,
      'grade_override',
      `Grade override for student ${ctx.studentId} on exam ${ctx.examId} — ${beforeValues.score ?? '?'} → ${afterValues.score ?? '?'} (reason: ${overrideReason})`,
      {
        entityId: ctx.gradeId,
        entityType: 'grade',
        entityName: `Grade: ${ctx.studentId}/${ctx.examId}`,
        beforeValues,
        afterValues,
        metadata: {
          studentId: ctx.studentId,
          examId: ctx.examId,
          classId: ctx.classId,
          originalGradeId,
          overrideReason,
        },
      }
    );
  }

  // ───────────────────────────────── Score Submitted (scan) ───────────────

  /**
   * Log when a scanned result / score is submitted.
   */
  static async logScoreSubmitted(
    ctx: GradeAuditContext & { resultId: string },
    afterValues: GradeSnapshot
  ): Promise<AuditLog | null> {
    return AuditLogger.logActivity(
      ctx.userId,
      ctx.userEmail,
      'score_submitted',
      `Score submitted for student ${ctx.studentId} on exam ${ctx.examId} — score ${afterValues.score ?? '?'}/${afterValues.max_score ?? '?'}`,
      {
        entityId: ctx.resultId,
        entityType: 'scannedResult',
        entityName: `Scan: ${ctx.studentId}/${ctx.examId}`,
        afterValues,
        metadata: {
          studentId: ctx.studentId,
          examId: ctx.examId,
          classId: ctx.classId,
          gradeId: ctx.gradeId,
        },
      }
    );
  }

  // ───────────────────────────────── Score Override (scan) ────────────────

  /**
   * Log when a duplicate scanned result is overridden.
   */
  static async logScoreOverride(
    ctx: GradeAuditContext & { resultId: string },
    beforeValues: GradeSnapshot,
    afterValues: GradeSnapshot,
    overrideReason: string
  ): Promise<AuditLog | null> {
    return AuditLogger.logActivity(
      ctx.userId,
      ctx.userEmail,
      'score_override',
      `Score override for student ${ctx.studentId} on exam ${ctx.examId} — ${beforeValues.score ?? '?'} → ${afterValues.score ?? '?'} (reason: ${overrideReason})`,
      {
        entityId: ctx.resultId,
        entityType: 'scannedResult',
        entityName: `Scan: ${ctx.studentId}/${ctx.examId}`,
        beforeValues,
        afterValues,
        metadata: {
          studentId: ctx.studentId,
          examId: ctx.examId,
          classId: ctx.classId,
          gradeId: ctx.gradeId,
          overrideReason,
        },
      }
    );
  }

  // ───────────────────────────────── Helpers ──────────────────────────────

  /**
   * Build a `GradeSnapshot` from common grade / scan data.
   */
  static buildSnapshot(data: {
    score?: number;
    max_score?: number;
    percentage?: number;
    letter_grade?: string;
    status?: string;
    is_final?: boolean;
    comments?: string;
  }): GradeSnapshot {
    const snapshot: GradeSnapshot = {};
    if (data.score !== undefined) snapshot.score = data.score;
    if (data.max_score !== undefined) snapshot.max_score = data.max_score;
    if (data.percentage !== undefined) snapshot.percentage = data.percentage;
    if (data.letter_grade !== undefined) snapshot.letter_grade = data.letter_grade;
    if (data.status !== undefined) snapshot.status = data.status;
    if (data.is_final !== undefined) snapshot.is_final = data.is_final;
    if (data.comments !== undefined) snapshot.comments = data.comments;
    return snapshot;
  }

  /**
   * Return a human-readable summary of what changed between two snapshots.
   */
  static describeChanges(
    before: GradeSnapshot,
    after: GradeSnapshot
  ): string {
    const parts: string[] = [];

    if (before.score !== after.score) {
      parts.push(`score ${before.score} → ${after.score}`);
    }
    if (before.max_score !== after.max_score) {
      parts.push(`max ${before.max_score} → ${after.max_score}`);
    }
    if (before.percentage !== after.percentage) {
      parts.push(`pct ${before.percentage}% → ${after.percentage}%`);
    }
    if (before.letter_grade !== after.letter_grade) {
      parts.push(`grade ${before.letter_grade} → ${after.letter_grade}`);
    }
    if (before.status !== after.status) {
      parts.push(`status ${before.status} → ${after.status}`);
    }
    if (before.is_final !== after.is_final) {
      parts.push(`final ${before.is_final} → ${after.is_final}`);
    }
    if (before.comments !== after.comments) {
      parts.push('comments changed');
    }

    return parts.length > 0 ? parts.join(', ') : 'no field changes';
  }

  // ───────────────────────────────── Query helpers ────────────────────────

  /**
   * Retrieve all grade-related audit logs for a given student.
   * Uses server-side entityType filter for efficiency, then narrows by studentId.
   */
  static async getGradeAuditLogsForStudent(studentId: string): Promise<AuditLog[]> {
    const gradeLogs = await AuditLogger.getLogs({ entityType: 'grade' });
    return gradeLogs.filter(
      (log) =>
        (log.metadata as Record<string, unknown>)?.studentId === studentId
    );
  }

  /**
   * Retrieve all grade-related audit logs for a given exam.
   * Uses server-side entityType filter for efficiency, then narrows by examId.
   */
  static async getGradeAuditLogsForExam(examId: string): Promise<AuditLog[]> {
    const gradeLogs = await AuditLogger.getLogs({ entityType: 'grade' });
    return gradeLogs.filter(
      (log) =>
        (log.metadata as Record<string, unknown>)?.examId === examId
    );
  }

  /**
   * Retrieve all grade-related audit logs (any entity type: grade or scannedResult).
   */
  static async getAllGradeAuditLogs(): Promise<AuditLog[]> {
    const gradeLogs = await AuditLogger.getLogs({ entityType: 'grade' });
    const scanLogs = await AuditLogger.getLogs({ entityType: 'scannedResult' });
    return [...gradeLogs, ...scanLogs].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  /**
   * Retrieve the full change history for a specific grade document.
   */
  static async getGradeHistory(gradeId: string): Promise<AuditLog[]> {
    return AuditLogger.getActivityByEntity(gradeId, 'grade');
  }
}
