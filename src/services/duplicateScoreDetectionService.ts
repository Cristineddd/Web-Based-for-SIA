/**
 * Duplicate Score Detection Service
 * Prevents duplicate grade/score submissions for the same student + exam combination.
 * Provides clear error messaging and a faculty override mechanism.
 */

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DuplicateScoreMatch {
  /** ID of the existing grade record */
  existingGradeId: string;
  /** Student ID that has the duplicate */
  studentId: string;
  /** Exam ID that has the duplicate */
  examId: string;
  /** Class ID associated with the existing grade */
  classId: string;
  /** Score that was previously recorded */
  existingScore: number;
  /** Max score of the existing grade */
  existingMaxScore: number;
  /** Percentage of the existing grade */
  existingPercentage: number;
  /** When the existing grade was recorded */
  recordedAt: string;
  /** Who recorded the existing grade */
  recordedBy: string;
}

export interface DuplicateScoreCheckResult {
  /** Whether a duplicate was found */
  isDuplicate: boolean;
  /** Details of the existing duplicate record, if any */
  duplicateMatch?: DuplicateScoreMatch;
  /** Human-readable message */
  message: string;
}

export interface DuplicateOverrideRecord {
  id: string;
  studentId: string;
  examId: string;
  classId: string;
  /** ID of the original grade that was overridden */
  originalGradeId: string;
  /** ID of the new grade that replaced it */
  newGradeId: string;
  /** Score from the original submission */
  originalScore: number;
  /** Score from the new submission */
  newScore: number;
  /** Faculty member who authorized the override */
  overriddenBy: string;
  /** Reason provided by faculty for the override */
  overrideReason: string;
  /** Timestamp of the override */
  overriddenAt: string;
}

export type DuplicateScoreAction = 'block' | 'override' | 'skip';

// ─── Constants ───────────────────────────────────────────────────────────────

const GRADES_COLLECTION = 'studentGrades';
const SCANNED_RESULTS_COLLECTION = 'scannedResults';
const DUPLICATE_OVERRIDES_COLLECTION = 'duplicateScoreOverrides';

// ─── Service ─────────────────────────────────────────────────────────────────

export class DuplicateScoreDetectionService {
  /**
   * Check if a grade already exists for the given student + exam combination.
   * This is the primary duplicate detection method for the grading flow.
   */
  static async checkForDuplicateGrade(
    studentId: string,
    examId: string
  ): Promise<DuplicateScoreCheckResult> {
    try {
      if (!studentId || !examId) {
        return {
          isDuplicate: false,
          message: 'Student ID or Exam ID not provided — skipping duplicate check.',
        };
      }

      const q = query(
        collection(db, GRADES_COLLECTION),
        where('student_id', '==', studentId),
        where('exam_id', '==', examId)
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return {
          isDuplicate: false,
          message: 'No existing grade found for this student/exam combination.',
        };
      }

      // Take the first (and ideally only) match
      const existingDoc = snapshot.docs[0];
      const data = existingDoc.data();

      const match: DuplicateScoreMatch = {
        existingGradeId: existingDoc.id,
        studentId: data.student_id,
        examId: data.exam_id,
        classId: data.class_id,
        existingScore: data.score,
        existingMaxScore: data.max_score,
        existingPercentage: data.percentage,
        recordedAt: data.graded_at?.toDate?.()?.toISOString?.() ?? data.graded_at ?? '',
        recordedBy: data.graded_by ?? '',
      };

      return {
        isDuplicate: true,
        duplicateMatch: match,
        message: `A grade already exists for student "${studentId}" on exam "${examId}" (Score: ${match.existingScore}/${match.existingMaxScore}, ${match.existingPercentage}%). Use the override option if you need to replace it.`,
      };
    } catch (error) {
      console.error('[DuplicateScoreDetection] Error checking for duplicate grade:', error);
      // Fail-open: if the check itself fails, allow the save so grading isn't blocked
      return {
        isDuplicate: false,
        message: 'Duplicate check failed — proceeding with grade submission.',
      };
    }
  }

  /**
   * Check if a scanned result already exists for the given student + exam combination.
   * This is used in the scanning/OMR flow.
   */
  static async checkForDuplicateScannedResult(
    studentId: string,
    examId: string
  ): Promise<DuplicateScoreCheckResult> {
    try {
      if (!studentId || !examId) {
        return {
          isDuplicate: false,
          message: 'Student ID or Exam ID not provided — skipping duplicate check.',
        };
      }

      const q = query(
        collection(db, SCANNED_RESULTS_COLLECTION),
        where('studentId', '==', studentId),
        where('examId', '==', examId)
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return {
          isDuplicate: false,
          message: 'No existing scanned result found for this student/exam combination.',
        };
      }

      const existingDoc = snapshot.docs[0];
      const data = existingDoc.data();

      const match: DuplicateScoreMatch = {
        existingGradeId: existingDoc.id,
        studentId: data.studentId,
        examId: data.examId,
        classId: data.classId ?? '',
        existingScore: data.score,
        existingMaxScore: data.totalQuestions,
        existingPercentage: data.totalQuestions
          ? Math.round((data.score / data.totalQuestions) * 100)
          : 0,
        recordedAt: data.scannedAt?.toDate?.()?.toISOString?.() ?? data.scannedAt ?? '',
        recordedBy: data.scannedBy ?? '',
      };

      return {
        isDuplicate: true,
        duplicateMatch: match,
        message: `A scanned result already exists for student "${studentId}" on exam "${examId}" (Score: ${match.existingScore}/${match.existingMaxScore}). Use the override option if you need to replace it.`,
      };
    } catch (error) {
      console.error('[DuplicateScoreDetection] Error checking scanned result duplicate:', error);
      return {
        isDuplicate: false,
        message: 'Duplicate check failed — proceeding with scan submission.',
      };
    }
  }

  /**
   * Batch-check multiple student+exam pairs for duplicates.
   * Useful when importing grades in bulk.
   */
  static async batchCheckDuplicates(
    records: Array<{ studentId: string; examId: string }>
  ): Promise<Map<string, DuplicateScoreCheckResult>> {
    const results = new Map<string, DuplicateScoreCheckResult>();

    // Process in parallel with a concurrency limit
    const BATCH_SIZE = 10;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      const checks = batch.map(async (record) => {
        const key = `${record.studentId}_${record.examId}`;
        const result = await this.checkForDuplicateGrade(record.studentId, record.examId);
        results.set(key, result);
      });
      await Promise.all(checks);
    }

    return results;
  }

  /**
   * Record a duplicate override — logs the faculty member's decision to replace
   * an existing grade. This is the audit trail for overrides.
   */
  static async recordOverride(
    override: Omit<DuplicateOverrideRecord, 'id' | 'overriddenAt'>
  ): Promise<{ success: boolean; overrideId?: string; error?: string }> {
    try {
      const overrideId = `dup_override_${override.studentId}_${override.examId}_${Date.now()}`;

      const overrideRecord: DuplicateOverrideRecord = {
        id: overrideId,
        ...override,
        overriddenAt: new Date().toISOString(),
      };

      await setDoc(doc(db, DUPLICATE_OVERRIDES_COLLECTION, overrideId), {
        ...overrideRecord,
        overriddenAt: serverTimestamp(),
      });

      console.log(
        `[DuplicateScoreDetection] Override recorded: ${overrideId} by ${override.overriddenBy}`
      );

      return { success: true, overrideId };
    } catch (error) {
      console.error('[DuplicateScoreDetection] Error recording override:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get all override records for a given exam.
   */
  static async getOverridesByExam(
    examId: string
  ): Promise<{ success: boolean; data?: DuplicateOverrideRecord[]; error?: string }> {
    try {
      const q = query(
        collection(db, DUPLICATE_OVERRIDES_COLLECTION),
        where('examId', '==', examId)
      );

      const snapshot = await getDocs(q);
      const overrides = snapshot.docs.map((d) => d.data() as DuplicateOverrideRecord);

      return { success: true, data: overrides };
    } catch (error) {
      console.error('[DuplicateScoreDetection] Error fetching overrides:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get all override records for a given student.
   */
  static async getOverridesByStudent(
    studentId: string
  ): Promise<{ success: boolean; data?: DuplicateOverrideRecord[]; error?: string }> {
    try {
      const q = query(
        collection(db, DUPLICATE_OVERRIDES_COLLECTION),
        where('studentId', '==', studentId)
      );

      const snapshot = await getDocs(q);
      const overrides = snapshot.docs.map((d) => d.data() as DuplicateOverrideRecord);

      return { success: true, data: overrides };
    } catch (error) {
      console.error('[DuplicateScoreDetection] Error fetching student overrides:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Generate a user-friendly duplicate error message for display in the UI.
   */
  static formatDuplicateError(match: DuplicateScoreMatch): string {
    return (
      `Duplicate submission blocked: Student "${match.studentId}" already has a grade ` +
      `for this exam (Score: ${match.existingScore}/${match.existingMaxScore}, ` +
      `${match.existingPercentage}%). ` +
      `To replace it, use the "Override Duplicate" option.`
    );
  }

  /**
   * Build a unique key for a student+exam combination.
   * Useful for in-memory dedup maps.
   */
  static buildCompositeKey(studentId: string, examId: string): string {
    return `${studentId}__${examId}`;
  }

  /**
   * Count how many duplicate overrides have been recorded for an exam.
   * Useful for dashboards/summary cards.
   */
  static async getDuplicateOverrideCountForExam(
    examId: string
  ): Promise<{ count: number; error?: string }> {
    try {
      const q = query(
        collection(db, DUPLICATE_OVERRIDES_COLLECTION),
        where('examId', '==', examId)
      );
      const snapshot = await getDocs(q);
      return { count: snapshot.size };
    } catch (error) {
      console.error('[DuplicateScoreDetection] Error counting overrides:', error);
      return { count: 0, error: (error as Error).message };
    }
  }

  /**
   * Detect duplicate student IDs within a single batch of scanned results.
   * Returns a map of studentId → array of result indices that share that ID.
   * Only includes entries with more than one occurrence.
   */
  static detectInBatchDuplicates(
    results: Array<{ studentId: string; index: number }>
  ): Map<string, number[]> {
    const idToIndices = new Map<string, number[]>();

    for (const { studentId, index } of results) {
      if (!studentId) continue;
      const existing = idToIndices.get(studentId);
      if (existing) {
        existing.push(index);
      } else {
        idToIndices.set(studentId, [index]);
      }
    }

    // Filter to only duplicates (more than one occurrence)
    const duplicates = new Map<string, number[]>();
    for (const [id, indices] of idToIndices) {
      if (indices.length > 1) {
        duplicates.set(id, indices);
      }
    }

    return duplicates;
  }

  /**
   * Check if a specific scanned result was created via an override.
   * Returns the override record if found, or null.
   */
  static async getOverrideForGrade(
    gradeId: string
  ): Promise<DuplicateOverrideRecord | null> {
    try {
      const q = query(
        collection(db, DUPLICATE_OVERRIDES_COLLECTION),
        where('newGradeId', '==', gradeId)
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;
      return snapshot.docs[0].data() as DuplicateOverrideRecord;
    } catch (error) {
      console.error('[DuplicateScoreDetection] Error looking up override for grade:', error);
      return null;
    }
  }
}
