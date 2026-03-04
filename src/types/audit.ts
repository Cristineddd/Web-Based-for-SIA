/**
 * Audit Log Types - For tracking all upload, administrative, and grade activities
 */

export type ActivityType = 
  | 'file_upload' 
  | 'file_delete' 
  | 'file_download'
  | 'student_import'
  | 'answer_key_upload'
  | 'exam_created'
  | 'exam_deleted'
  | 'admin_action'
  | 'settings_changed'
  // Grade modification activity types
  | 'grade_created'
  | 'grade_updated'
  | 'grade_deleted'
  | 'grade_override'
  | 'score_submitted'
  | 'score_override';

/** Snapshot of grade field values — used for before/after diff tracking */
export interface GradeSnapshot {
  score?: number;
  max_score?: number;
  percentage?: number;
  letter_grade?: string;
  status?: string;
  is_final?: boolean;
  comments?: string;
}

export interface AuditLog {
  id: string;
  adminId: string;
  adminEmail: string;
  activity: ActivityType;
  description: string;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
  
  // File-related fields
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  filePath?: string;
  
  // Entity-related fields
  entityId?: string;
  entityType?: string;
  entityName?: string;
  
  // Status and result
  status: 'success' | 'failed' | 'pending';
  errorMessage?: string;
  metadata?: Record<string, unknown>;

  // Grade modification change tracking
  beforeValues?: GradeSnapshot;
  afterValues?: GradeSnapshot;
  
  // Indexing fields
  createdAt: string;
  updatedAt?: string;
  expiresAt?: string; // For automatic cleanup of old logs
}

export interface AuditLogQuery {
  adminId?: string;
  activity?: ActivityType;
  entityType?: string;
  status?: 'success' | 'failed' | 'pending';
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface AuditLogResponse {
  success: boolean;
  data?: AuditLog;
  error?: string;
}

export interface AuditLogsResponse {
  success: boolean;
  data?: AuditLog[];
  total?: number;
  hasMore?: boolean;
  error?: string;
}
