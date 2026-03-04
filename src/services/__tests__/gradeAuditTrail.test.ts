
const mockAddDoc = jest.fn().mockResolvedValue({ id: 'audit_log_mock_id' });
const mockGetDocs = jest.fn().mockResolvedValue({ docs: [] });
const mockGetDoc = jest.fn();
const mockUpdateDoc = jest.fn().mockResolvedValue(undefined);
const mockDeleteDoc = jest.fn().mockResolvedValue(undefined);
const mockSetDoc = jest.fn().mockResolvedValue(undefined);
const mockServerTimestamp = jest.fn().mockReturnValue('SERVER_TS');

jest.mock('firebase/firestore', () => ({
  collection: jest.fn().mockReturnValue('mock-collection'),
  doc: jest.fn().mockReturnValue('mock-doc-ref'),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  query: jest.fn().mockReturnValue('mock-query'),
  where: jest.fn().mockReturnValue('mock-constraint'),
  orderBy: jest.fn().mockReturnValue('mock-order'),
  Timestamp: { fromDate: jest.fn().mockReturnValue('mock-timestamp') },
  serverTimestamp: () => mockServerTimestamp(),
}));

jest.mock('@/lib/firebase', () => ({
  db: 'mock-db',
  auth: 'mock-auth',
}));

// Mock the validation guard (always valid) and duplicate detection (no duplicates)
jest.mock('@/services/recordValidationGuardService', () => ({
  RecordValidationGuardService: {
    validateGradeRecord: jest.fn().mockResolvedValue({ isValid: true, errors: [] }),
  },
}));

jest.mock('@/services/duplicateScoreDetectionService', () => ({
  DuplicateScoreDetectionService: {
    checkForDuplicateGrade: jest.fn().mockResolvedValue({ isDuplicate: false }),
    formatDuplicateError: jest.fn().mockReturnValue('Duplicate'),
    recordOverride: jest.fn().mockResolvedValue(undefined),
  },
}));

/* ------------------------------------------------------------------ */
/*  Imports (must come AFTER jest.mock calls)                          */
/* ------------------------------------------------------------------ */
import { AuditLogger } from '@/services/auditLogger';
import { GradeAuditService, GradeAuditContext } from '@/services/gradeAuditService';
import { GradeSnapshot } from '@/types/audit';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const sampleCtx: GradeAuditContext = {
  userId: 'user_123',
  userEmail: 'instructor@example.com',
  gradeId: 'grade_001',
  studentId: 'STU-2025-0001',
  examId: 'exam_midterm_1',
  classId: 'class_CS101',
};

const beforeSnapshot: GradeSnapshot = {
  score: 35,
  max_score: 50,
  percentage: 70,
  letter_grade: 'C',
  status: 'draft',
  is_final: false,
  comments: 'Initial score',
};

const afterSnapshot: GradeSnapshot = {
  score: 42,
  max_score: 50,
  percentage: 84,
  letter_grade: 'B',
  status: 'approved',
  is_final: true,
  comments: 'Re-graded after review',
};

/* ================================================================== */
/*  TEST 1 – Grade Edit Trigger                                        */
/*                                                                     */
/*  BUG: AuditLogger.logActivity() writes beforeValues/afterValues to  */
/*  Firestore but does NOT include them in the returned AuditLog       */
/*  object. Callers (and downstream assertions) that inspect the       */
/*  return value see `undefined` for these fields.                     */
/* ================================================================== */
describe('Grade Edit Trigger', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return an audit log entry with beforeValues and afterValues when a grade is edited', async () => {
    const result = await GradeAuditService.logGradeUpdated(
      sampleCtx,
      beforeSnapshot,
      afterSnapshot
    );

    // The returned AuditLog must carry the change data
    expect(result).not.toBeNull();
    expect(result!.beforeValues).toBeDefined();
    expect(result!.afterValues).toBeDefined();

    // Verify the actual snapshot values are present
    expect(result!.beforeValues!.score).toBe(35);
    expect(result!.afterValues!.score).toBe(42);
    expect(result!.beforeValues!.letter_grade).toBe('C');
    expect(result!.afterValues!.letter_grade).toBe('B');
  });
});

/* ================================================================== */
/*  TEST 2 – Audit Log Completeness                                    */
/*                                                                     */
/*  BUG: When GradingService.recordGrade() records a faculty override, */
/*  it passes an incomplete beforeValues snapshot that only contains    */
/*  `{ score }` instead of the full GradeSnapshot. This means          */
/*  max_score, percentage, letter_grade, status, etc. are missing      */
/*  from the audit entry — violating completeness.                     */
/*                                                                     */
/*  Additionally, AuditLogger.logActivity() returns an object missing  */
/*  beforeValues/afterValues — so even properly-logged entries appear   */
/*  incomplete to the caller.                                          */
/* ================================================================== */
describe('Audit Log Completeness', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should capture ALL required audit fields including full before/after snapshots and metadata', async () => {
    const result = await GradeAuditService.logGradeUpdated(
      sampleCtx,
      beforeSnapshot,
      afterSnapshot
    );

    expect(result).not.toBeNull();

    // ── Core identity fields ──
    expect(result!.adminId).toBe('user_123');
    expect(result!.adminEmail).toBe('instructor@example.com');
    expect(result!.activity).toBe('grade_updated');
    expect(result!.status).toBe('success');
    expect(result!.timestamp).toBeDefined();
    expect(result!.entityId).toBe('grade_001');
    expect(result!.entityType).toBe('grade');

    // ── Before/After snapshots must be COMPLETE ──
    const requiredSnapshotKeys: (keyof GradeSnapshot)[] = [
      'score',
      'max_score',
      'percentage',
      'letter_grade',
      'status',
      'is_final',
      'comments',
    ];

    for (const key of requiredSnapshotKeys) {
      expect(result!.beforeValues).toHaveProperty(key);
      expect(result!.afterValues).toHaveProperty(key);
    }

    // ── Metadata with contextual IDs ──
    expect(result!.metadata).toBeDefined();
    expect((result!.metadata as Record<string, unknown>).studentId).toBe('STU-2025-0001');
    expect((result!.metadata as Record<string, unknown>).examId).toBe('exam_midterm_1');
    expect((result!.metadata as Record<string, unknown>).classId).toBe('class_CS101');
  });
});

/* ================================================================== */
/*  TEST 3 – Admin Accessibility                                       */
/*                                                                     */
/*  BUG: AuditLogQuery does not support an `entityType` filter, and    */
/*  AuditLogger.getLogs() ignores it. Admins who want to view only     */
/*  grade-related audit logs must fall back to client-side filtering    */
/*  (GradeAuditService.getGradeAuditLogsForStudent fetches ALL logs).  */
/*  The fix adds entityType to AuditLogQuery and honours it in         */
/*  getLogs().                                                         */
/* ================================================================== */
describe('Admin Accessibility', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should allow querying audit logs filtered by entityType "grade"', async () => {
    // Seed two logs in Firestore: one grade, one file upload
    const gradeLogData = {
      id: 'log_1',
      adminId: 'user_123',
      adminEmail: 'instructor@example.com',
      activity: 'grade_updated',
      description: 'Grade updated',
      timestamp: new Date().toISOString(),
      status: 'success',
      entityType: 'grade',
      entityId: 'grade_001',
      createdAt: { toDate: () => new Date() },
    };
    const fileLogData = {
      id: 'log_2',
      adminId: 'user_456',
      adminEmail: 'admin@example.com',
      activity: 'file_upload',
      description: 'Uploaded file',
      timestamp: new Date().toISOString(),
      status: 'success',
      entityType: 'file',
      entityId: 'file_001',
      createdAt: { toDate: () => new Date() },
    };

    // Mock getDocs to return both logs
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'log_1', data: () => gradeLogData },
        { id: 'log_2', data: () => fileLogData },
      ],
    });

    // This call MUST forward entityType into the Firestore query constraints
    // so that the server filters rather than the client.
    const logs = await AuditLogger.getLogs({ entityType: 'grade' });

    // The important assertion: getLogs accepted entityType and constructed
    // a Firestore where() constraint for it.
    const { where } = require('firebase/firestore');
    const whereCallArgs = (where as jest.Mock).mock.calls.map(
      (c: unknown[]) => c
    );
    const hasEntityTypeConstraint = whereCallArgs.some(
      (args: unknown[]) => args[0] === 'entityType' && args[2] === 'grade'
    );
    expect(hasEntityTypeConstraint).toBe(true);

    // Verify we get results (mock returns all, but the constraint was applied)
    expect(logs).toBeDefined();
    expect(Array.isArray(logs)).toBe(true);
  });
});
