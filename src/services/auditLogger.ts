/**
 * Audit Logger Service
 * Securely logs all administrative and upload activities with timestamp and admin ID
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
  QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  AuditLog,
  AuditLogQuery,
  ActivityType,
  GradeSnapshot,
} from "@/types/audit";

const AUDIT_LOGS_COLLECTION = "auditLogs";
const LOG_RETENTION_DAYS = 90; // Keep logs for 90 days

export class AuditLogger {
  /**
   * Log an activity with admin ID and timestamp
   */
  static async logActivity(
    adminId: string,
    adminEmail: string,
    activity: ActivityType,
    description: string,
    options?: {
      fileName?: string;
      fileType?: string;
      fileSize?: number;
      filePath?: string;
      entityId?: string;
      entityType?: string;
      entityName?: string;
      ipAddress?: string;
      userAgent?: string;
      metadata?: Record<string, unknown>;
      status?: "success" | "failed" | "pending";
      errorMessage?: string;
      beforeValues?: GradeSnapshot;
      afterValues?: GradeSnapshot;
    },
  ): Promise<AuditLog | null> {
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + LOG_RETENTION_DAYS);

      // Create log object with mandatory fields
      const logData: any = {
        adminId,
        adminEmail,
        activity,
        description,
        timestamp: new Date().toISOString(),
        status: options?.status || "success",
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(expiresAt),
      };

      // Only add optional fields if they are defined
      if (options) {
        if (options.ipAddress !== undefined)
          logData.ipAddress = options.ipAddress;
        if (options.userAgent !== undefined)
          logData.userAgent = options.userAgent;
        if (options.fileName !== undefined) logData.fileName = options.fileName;
        if (options.fileType !== undefined) logData.fileType = options.fileType;
        if (options.fileSize !== undefined) logData.fileSize = options.fileSize;
        if (options.filePath !== undefined) logData.filePath = options.filePath;
        if (options.entityId !== undefined) logData.entityId = options.entityId;
        if (options.entityType !== undefined)
          logData.entityType = options.entityType;
        if (options.entityName !== undefined)
          logData.entityName = options.entityName;
        if (options.errorMessage !== undefined)
          logData.errorMessage = options.errorMessage;
        if (options.metadata !== undefined) logData.metadata = options.metadata;
        if (options.beforeValues !== undefined)
          logData.beforeValues = options.beforeValues;
        if (options.afterValues !== undefined)
          logData.afterValues = options.afterValues;
      }

      console.log("AuditLogger: Sending log data to Firestore:", logData);

      const docRef = await addDoc(
        collection(db, AUDIT_LOGS_COLLECTION),
        logData,
      );

      return {
        id: docRef.id,
        adminId,
        adminEmail,
        activity,
        description,
        timestamp: new Date().toISOString(),
        ipAddress: options?.ipAddress,
        userAgent: options?.userAgent,
        fileName: options?.fileName,
        fileType: options?.fileType,
        fileSize: options?.fileSize,
        filePath: options?.filePath,
        entityId: options?.entityId,
        entityType: options?.entityType,
        entityName: options?.entityName,
        status: options?.status || "success",
        errorMessage: options?.errorMessage,
        metadata: options?.metadata,
        beforeValues: options?.beforeValues || null,
        afterValues: options?.afterValues || null,
        createdAt: new Date().toISOString(),
      } as unknown as AuditLog;
    } catch (error) {
      console.error("Error logging activity:", error);
      // Don't throw - logging failure shouldn't crash the app
      return null;
    }
  }

  /**
   * Log file upload activity
   */
  static async logFileUpload(
    adminId: string,
    adminEmail: string,
    fileName: string,
    fileType: string,
    fileSize: number,
    filePath: string,
    success: boolean = true,
    errorMessage?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuditLog | null> {
    return this.logActivity(
      adminId,
      adminEmail,
      "file_upload",
      `Uploaded file: ${fileName}`,
      {
        fileName,
        fileType,
        fileSize,
        filePath,
        status: success ? "success" : "failed",
        errorMessage,
        ipAddress,
        userAgent,
      },
    );
  }

  /**
   * Log file deletion activity
   */
  static async logFileDelete(
    adminId: string,
    adminEmail: string,
    fileName: string,
    filePath: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuditLog | null> {
    return this.logActivity(
      adminId,
      adminEmail,
      "file_delete",
      `Deleted file: ${fileName}`,
      {
        fileName,
        filePath,
        ipAddress,
        userAgent,
      },
    );
  }

  /**
   * Log file download activity
   */
  static async logFileDownload(
    adminId: string,
    adminEmail: string,
    fileName: string,
    filePath: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuditLog | null> {
    return this.logActivity(
      adminId,
      adminEmail,
      "file_download",
      `Downloaded file: ${fileName}`,
      {
        fileName,
        filePath,
        ipAddress,
        userAgent,
      },
    );
  }

  /**
   * Log student import activity
   */
  static async logStudentImport(
    adminId: string,
    adminEmail: string,
    fileName: string,
    studentCount: number,
    success: boolean = true,
    errorMessage?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuditLog | null> {
    return this.logActivity(
      adminId,
      adminEmail,
      "student_import",
      `Imported ${studentCount} students from ${fileName}`,
      {
        fileName,
        status: success ? "success" : "failed",
        errorMessage,
        ipAddress,
        userAgent,
        metadata: { studentCount },
      },
    );
  }

  /**
   * Log answer key upload activity
   */
  static async logAnswerKeyUpload(
    adminId: string,
    adminEmail: string,
    examId: string,
    examName: string,
    questionCount: number,
    success: boolean = true,
    errorMessage?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuditLog | null> {
    return this.logActivity(
      adminId,
      adminEmail,
      "answer_key_upload",
      `Uploaded answer key for exam: ${examName}`,
      {
        entityId: examId,
        entityType: "exam",
        entityName: examName,
        status: success ? "success" : "failed",
        errorMessage,
        ipAddress,
        userAgent,
        metadata: { questionCount },
      },
    );
  }

  /**
   * Log template generated / downloaded activity
   */
  static async logTemplateGenerated(
    adminId: string,
    adminEmail: string,
    templateName: string,
    examName: string,
    numQuestions: number,
    className?: string,
    examCode?: string,
  ): Promise<AuditLog | null> {
    return this.logActivity(
      adminId,
      adminEmail,
      "template_generated",
      `Generated template: "${templateName}" for exam "${examName}"`,
      {
        entityType: "template",
        entityName: templateName,
        metadata: {
          examName,
          numQuestions,
          ...(className && { className }),
          ...(examCode && { examCode }),
        },
      },
    );
  }

  /**
   * Retrieve audit logs with filtering
   */
  static async getLogs(queryOpts?: AuditLogQuery): Promise<AuditLog[]> {
    try {
      const constraints: QueryConstraint[] = [];

      if (queryOpts?.adminId) {
        constraints.push(where("adminId", "==", queryOpts.adminId));
      }

      if (queryOpts?.activity) {
        constraints.push(where("activity", "==", queryOpts.activity));
      }

      if (queryOpts?.entityType) {
        constraints.push(where("entityType", "==", queryOpts.entityType));
      }

      if (queryOpts?.status) {
        constraints.push(where("status", "==", queryOpts.status));
      }

      if (queryOpts?.startDate) {
        constraints.push(where("timestamp", ">=", queryOpts.startDate));
      }

      if (queryOpts?.endDate) {
        constraints.push(where("timestamp", "<=", queryOpts.endDate));
      }

      // Always order by timestamp descending
      constraints.push(orderBy("timestamp", "desc"));

      const q = query(collection(db, AUDIT_LOGS_COLLECTION), ...constraints);
      const snapshot = await getDocs(q);

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp || new Date().toISOString(),
        createdAt:
          doc.data().createdAt?.toDate?.().toISOString() ||
          new Date().toISOString(),
      })) as AuditLog[];
    } catch (error) {
      console.error("Error retrieving audit logs:", error);
      return [];
    }
  }

  /**
   * Get logs for a specific admin
   */
  static async getAdminLogs(
    adminId: string,
    limit: number = 50,
  ): Promise<AuditLog[]> {
    return this.getLogs({ adminId, limit });
  }

  /**
   * Get logs for a specific activity type
   */
  static async getActivityLogs(
    activity: ActivityType,
    limit: number = 50,
  ): Promise<AuditLog[]> {
    return this.getLogs({ activity, limit });
  }

  /**
   * Get logs for a date range
   */
  static async getLogsByDateRange(
    startDate: string,
    endDate: string,
    limit: number = 100,
  ): Promise<AuditLog[]> {
    return this.getLogs({ startDate, endDate, limit });
  }

  /**
   * Get failed activities (for monitoring security issues)
   */
  static async getFailedActivities(limit: number = 50): Promise<AuditLog[]> {
    return this.getLogs({ status: "failed", limit });
  }

  /**
   * Get activities by entity (exam, student, etc)
   */
  static async getActivityByEntity(
    entityId: string,
    entityType: string,
  ): Promise<AuditLog[]> {
    try {
      const constraints: QueryConstraint[] = [
        where("entityId", "==", entityId),
        where("entityType", "==", entityType),
        orderBy("timestamp", "desc"),
      ];

      const q = query(collection(db, AUDIT_LOGS_COLLECTION), ...constraints);
      const snapshot = await getDocs(q);

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp || new Date().toISOString(),
        createdAt:
          doc.data().createdAt?.toDate?.().toISOString() ||
          new Date().toISOString(),
      })) as AuditLog[];
    } catch (error) {
      console.error("Error retrieving activity logs:", error);
      return [];
    }
  }

  /**
   * Get request metadata from NextRequest (for logging)
   */
  static getRequestMetadata(request: Request): {
    ipAddress?: string;
    userAgent?: string;
  } {
    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.headers.get("x-real-ip") ||
      "unknown";

    const userAgent = request.headers.get("user-agent") || "unknown";

    return { ipAddress, userAgent };
  }

  /**
   * Remove undefined fields from an object recursively
   */
  private static sanitize(obj: any): any {
    const sanitized: any = {};
    Object.keys(obj).forEach((key) => {
      if (obj[key] !== undefined) {
        if (
          typeof obj[key] === "object" &&
          obj[key] !== null &&
          !(obj[key] instanceof Date) &&
          !(obj[key] instanceof Timestamp) &&
          typeof obj[key].as_id !== "function" // Not a serverTimestamp proxy
        ) {
          sanitized[key] = this.sanitize(obj[key]);
        } else {
          sanitized[key] = obj[key];
        }
      }
    });
    return sanitized;
  }
}
