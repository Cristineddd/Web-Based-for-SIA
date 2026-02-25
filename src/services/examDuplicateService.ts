import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AuditLogger } from "./auditLogger";

export interface DuplicateDetectionOptions {
  userId: string;
  adminEmail: string;
}

export class ExamDuplicateService {
  private static readonly EXAMS_COLLECTION = "exams";
  private static lastLoggedAttempt: Map<string, number> = new Map();
  private static readonly LOG_THROTTLE_MS = 60000; // 1 minute

  /**
   * Check if an exam with the same title exists for the user
   * (Excluding archived exams)
   */
  static async checkDuplicateTitle(
    title: string,
    userId: string,
  ): Promise<{
    isDuplicate: boolean;
    existingExam?: { id: string; title: string; created_at: string };
  }> {
    try {
      const normalizedTitle = title.trim().toLowerCase();

      const q = query(
        collection(db, this.EXAMS_COLLECTION),
        where("createdBy", "==", userId),
        where("title", "==", title.trim()), // Firestore is case-sensitive for exact matches
      );

      const querySnapshot = await getDocs(q);

      // Filter out archived exams client-side (to avoid needing a composite index)
      // Also do case-insensitive check to be safe
      const matches = querySnapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }) as any)
        .filter(
          (exam) =>
            !exam.isArchived && exam.title.toLowerCase() === normalizedTitle,
        );

      if (matches.length > 0) {
        const existing = matches[0];
        return {
          isDuplicate: true,
          existingExam: {
            id: existing.id,
            title: existing.title,
            created_at: existing.created_at,
          },
        };
      }

      return { isDuplicate: false };
    } catch (error) {
      console.error(
        "[ExamDuplicateService] Error checking duplicate title:",
        error,
      );
      return { isDuplicate: false };
    }
  }

  /**
   * Log a duplicate detection event with spam prevention
   */
  static async logDuplicateDetection(
    title: string,
    options: DuplicateDetectionOptions,
  ): Promise<void> {
    const logKey = `${options.userId}:${title.toLowerCase()}`;
    const now = Date.now();
    const lastLog = this.lastLoggedAttempt.get(logKey) || 0;

    if (now - lastLog < this.LOG_THROTTLE_MS) {
      console.log(
        `[ExamDuplicateService] Throttling duplicate log for: ${title}`,
      );
      return;
    }

    this.lastLoggedAttempt.set(logKey, now);

    try {
      await AuditLogger.logActivity(
        options.userId,
        options.adminEmail,
        "admin_action",
        `Duplicate batch title detected: "${title}"`,
        {
          entityType: "exam",
          entityName: title,
          status: "failed",
          metadata: {
            issue: "duplicate_title",
            severity: "medium",
          },
        },
      );
      console.log(
        `[ExamDuplicateService] Logged duplicate detection for: ${title}`,
      );
    } catch (error) {
      console.error(
        "[ExamDuplicateService] Error logging duplicate detection:",
        error,
      );
    }
  }
}
