import {
  getExamById,
  getExams,
  addGeneratedSheetToExam,
  type GeneratedSheet,
} from "./examService";

export interface BatchRecord {
  id?: string;
  examId: string;
  examCode: string;
  sheetCount: number;
  createdBy: string;
  timestamp: any;
  timezone?: string;
  isDuplicate?: boolean;
  type?: "print" | "review";
}

export const BatchService = {
  /**
   * Record a new batch of printed answer sheets
   * Pivoted to use 'exams' collection to avoid permission issues
   */
  async recordBatch(
    examId: string,
    examCode: string,
    sheetCount: number,
    userId: string,
  ) {
    try {
      // Gracefully handle presets and previews
      if (
        !examId ||
        examId.startsWith("preset-") ||
        examId.startsWith("template-")
      ) {
        console.log(
          `[BatchService] Skipping recording for non-persistent template: ${examId}`,
        );
        return { success: true, id: "skipped" };
      }

      const exam = await getExamById(examId);
      if (!exam) {
        console.warn(
          `[BatchService] Exam not found for recording batch: ${examId}`,
        );
        return { success: true, id: "missing-exam" };
      }

      const timestamp = new Date().toISOString();
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      // Duplicate Check Logic (Task 3.3)
      const lastBatch =
        exam.generated_sheets && exam.generated_sheets.length > 0
          ? exam.generated_sheets[exam.generated_sheets.length - 1]
          : null;

      let isDuplicate = false;
      if (lastBatch) {
        const lastBatchTime = new Date(lastBatch.created_at);
        if (Date.now() - lastBatchTime.getTime() < 2 * 60 * 1000) {
          isDuplicate = true;
        }
      }

      const sheet: GeneratedSheet = {
        id: `batch_${Date.now()}`,
        sheet_count: sheetCount,
        created_at: timestamp,
        examCode: examCode || exam.examCode || "N/A",
        timezone,
        batchType: "answer_sheet",
        isDuplicate,
      };

      await addGeneratedSheetToExam(examId, sheet);

      return { success: true, id: sheet.id };
    } catch (error) {
      console.error("Error recording batch:", error);
      return { success: false, error: (error as Error).message };
    }
  },

  /**
   * Record a review/approval action
   */
  async recordReviewAction(
    examId: string,
    examCode: string,
    userId: string,
    action: "approved" | "rejected",
  ) {
    try {
      const timestamp = new Date().toISOString();
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      const sheet: GeneratedSheet = {
        id: `review_${Date.now()}`,
        sheet_count: 0,
        created_at: timestamp,
        examCode: examCode || "N/A",
        timezone,
        batchType: "review",
        isDuplicate: false,
      };

      await addGeneratedSheetToExam(examId, sheet);
      return { success: true, id: sheet.id };
    } catch (error) {
      console.error("Error recording review action:", error);
      return { success: false, error: (error as Error).message };
    }
  },

  /**
   * Get all logs (batches + reviews) for a specific user
   */
  async getLogsByUserId(userId: string) {
    try {
      const exams = await getExams(userId);
      const logs: BatchRecord[] = [];

      exams.forEach((exam) => {
        if (exam.generated_sheets && Array.isArray(exam.generated_sheets)) {
          exam.generated_sheets.forEach((sheet) => {
            logs.push({
              id: sheet.id,
              examId: exam.id,
              examCode: sheet.examCode || exam.examCode || "N/A",
              sheetCount: sheet.sheet_count,
              createdBy: userId,
              timestamp: sheet.created_at,
              timezone: sheet.timezone,
              isDuplicate: sheet.isDuplicate,
              type: (sheet.batchType === "review" ? "review" : "print") as
                | "print"
                | "review",
            });
          });
        }
      });

      // Sort in memory
      logs.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );

      return { success: true, data: logs };
    } catch (error) {
      console.error("Error fetching user logs:", error);
      return { success: false, error: (error as Error).message };
    }
  },

  /**
   * Get all batches for a specific exam
   */
  async getBatchesByExamId(examId: string) {
    try {
      const exam = await getExamById(examId);
      if (!exam) {
        throw new Error("Exam not found");
      }

      const batches: BatchRecord[] = (exam.generated_sheets || []).map(
        (sheet) => ({
          id: sheet.id,
          examId: exam.id,
          examCode: sheet.examCode || exam.examCode || "N/A",
          sheetCount: sheet.sheet_count,
          createdBy: exam.createdBy || "unknown",
          timestamp: sheet.created_at,
          timezone: sheet.timezone,
          isDuplicate: sheet.isDuplicate,
        }),
      );

      // Sort in memory
      batches.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );

      return { success: true, data: batches };
    } catch (error) {
      console.error("Error fetching batches:", error);
      return { success: false, error: (error as Error).message };
    }
  },

  /**
   * Get all batches for a specific user
   * Aggregates from all user exams
   */
  async getBatchesByUserId(userId: string) {
    try {
      const exams = await getExams(userId);
      const batches: BatchRecord[] = [];

      exams.forEach((exam) => {
        if (exam.generated_sheets && Array.isArray(exam.generated_sheets)) {
          exam.generated_sheets.forEach((sheet) => {
            batches.push({
              id: sheet.id,
              examId: exam.id,
              examCode: sheet.examCode || exam.examCode || "N/A",
              sheetCount: sheet.sheet_count,
              createdBy: userId,
              timestamp: sheet.created_at,
              timezone: sheet.timezone,
              isDuplicate: sheet.isDuplicate,
            });
          });
        }
      });

      // Sort in memory
      batches.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );

      return { success: true, data: batches };
    } catch (error) {
      console.error("Error fetching user batches:", error);
      return { success: false, error: (error as Error).message };
    }
  },
};
