/**
 * Report History Service
 *
 * Logs every generated report (PDF, Excel, CSV, email) to Firestore
 * for future access, search, and audit. Supports retention policies
 * and archive cleanup.
 *
 * Firestore collection: "reportHistory"
 * Each doc is keyed by auto-generated ID with instructorId for scoping.
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  Timestamp,
  QueryDocumentSnapshot,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ReportFormat = 'PDF' | 'Excel' | 'CSV' | 'Email' | 'Batch';

export type ReportType =
  | 'class-results'
  | 'exam-scores'
  | 'class-summary'
  | 'student-roster'
  | 'batch-export'
  | 'email-delivery';

export interface ReportHistoryEntry {
  id?: string;
  /** Instructor who generated the report */
  instructorId: string;
  instructorName?: string;
  /** What kind of report */
  reportType: ReportType;
  /** Output format */
  format: ReportFormat;
  /** Human-readable title, e.g. "BSIT-2A — Midterm Exam" */
  title: string;
  /** Optional description/notes */
  description?: string;
  /** Class context */
  className?: string;
  classId?: string;
  /** Exam context */
  examTitle?: string;
  examId?: string;
  /** Student count included in report */
  studentCount?: number;
  /** Filters applied (for audit) */
  filtersApplied?: string;
  /** File size in bytes (approximate) */
  fileSizeBytes?: number;
  /** Generated filename */
  fileName?: string;
  /** Timestamp */
  createdAt: Timestamp;
  /** Retention: auto-delete after this date (optional) */
  expiresAt?: Timestamp;
  /** Tags for search (lowercase) */
  tags?: string[];
}

/** Options for querying report history */
export interface ReportHistoryQuery {
  instructorId: string;
  reportType?: ReportType;
  format?: ReportFormat;
  className?: string;
  searchTerm?: string;
  pageSize?: number;
  lastDoc?: QueryDocumentSnapshot;
  /** Only reports created after this date */
  startDate?: Date;
  /** Only reports created before this date */
  endDate?: Date;
}

export interface ReportHistoryPage {
  entries: ReportHistoryEntry[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

/** Stats about report archive */
export interface ArchiveStats {
  totalReports: number;
  byFormat: Record<string, number>;
  byType: Record<string, number>;
  oldestReport?: Date;
  newestReport?: Date;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const COLLECTION = 'reportHistory';
const DEFAULT_PAGE_SIZE = 20;
/** Default retention: 365 days */
const DEFAULT_RETENTION_DAYS = 365;

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildTags(entry: Partial<ReportHistoryEntry>): string[] {
  const tags: string[] = [];
  if (entry.className) tags.push(...entry.className.toLowerCase().split(/\s+/));
  if (entry.examTitle) tags.push(...entry.examTitle.toLowerCase().split(/\s+/));
  if (entry.title) tags.push(...entry.title.toLowerCase().split(/\s+/));
  if (entry.instructorName) tags.push(...entry.instructorName.toLowerCase().split(/\s+/));
  if (entry.format) tags.push(entry.format.toLowerCase());
  if (entry.reportType) tags.push(entry.reportType.toLowerCase());
  // Deduplicate
  return [...new Set(tags.filter(Boolean))];
}

// ─── Service ────────────────────────────────────────────────────────────────

export class ReportHistoryService {
  /**
   * Log a newly generated report to the archive.
   */
  static async logReport(
    entry: Omit<ReportHistoryEntry, 'id' | 'createdAt' | 'tags'> & {
      retentionDays?: number;
    },
  ): Promise<string> {
    const now = Timestamp.now();
    const retentionDays = entry.retentionDays ?? DEFAULT_RETENTION_DAYS;
    const expiresDate = new Date();
    expiresDate.setDate(expiresDate.getDate() + retentionDays);

    const docData: Omit<ReportHistoryEntry, 'id'> = {
      instructorId: entry.instructorId,
      instructorName: entry.instructorName,
      reportType: entry.reportType,
      format: entry.format,
      title: entry.title,
      description: entry.description,
      className: entry.className,
      classId: entry.classId,
      examTitle: entry.examTitle,
      examId: entry.examId,
      studentCount: entry.studentCount,
      filtersApplied: entry.filtersApplied,
      fileSizeBytes: entry.fileSizeBytes,
      fileName: entry.fileName,
      createdAt: now,
      expiresAt: Timestamp.fromDate(expiresDate),
      tags: buildTags(entry),
    };

    // Strip undefined fields
    const cleaned = Object.fromEntries(
      Object.entries(docData).filter(([, v]) => v !== undefined),
    );

    const ref = await addDoc(collection(db, COLLECTION), cleaned);
    return ref.id;
  }

  /**
   * Get a single report entry by ID.
   */
  static async getReport(reportId: string): Promise<ReportHistoryEntry | null> {
    const snap = await getDoc(doc(db, COLLECTION, reportId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as ReportHistoryEntry;
  }

  /**
   * Query report history with pagination, filtering, and search.
   */
  static async queryReports(opts: ReportHistoryQuery): Promise<ReportHistoryPage> {
    const pageSize = opts.pageSize || DEFAULT_PAGE_SIZE;
    const constraints = [
      where('instructorId', '==', opts.instructorId),
    ];

    if (opts.reportType) {
      constraints.push(where('reportType', '==', opts.reportType));
    }

    if (opts.format) {
      constraints.push(where('format', '==', opts.format));
    }

    if (opts.startDate) {
      constraints.push(where('createdAt', '>=', Timestamp.fromDate(opts.startDate)));
    }

    if (opts.endDate) {
      constraints.push(where('createdAt', '<=', Timestamp.fromDate(opts.endDate)));
    }

    // Firestore array-contains for tag-based search (single term)
    if (opts.searchTerm) {
      const term = opts.searchTerm.toLowerCase().trim();
      if (term) {
        constraints.push(where('tags', 'array-contains', term));
      }
    }

    const q = query(
      collection(db, COLLECTION),
      ...constraints,
      orderBy('createdAt', 'desc'),
      ...(opts.lastDoc ? [startAfter(opts.lastDoc)] : []),
      limit(pageSize + 1),
    );

    const snapshot = await getDocs(q);
    const docs = snapshot.docs;
    const hasMore = docs.length > pageSize;
    const resultDocs = hasMore ? docs.slice(0, pageSize) : docs;

    const entries: ReportHistoryEntry[] = resultDocs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as ReportHistoryEntry[];

    return {
      entries,
      lastDoc: resultDocs.length > 0 ? resultDocs[resultDocs.length - 1] : null,
      hasMore,
    };
  }

  /**
   * Get all reports for an instructor matching a className (for archive browsing).
   */
  static async getReportsByClass(
    instructorId: string,
    className: string,
  ): Promise<ReportHistoryEntry[]> {
    const q = query(
      collection(db, COLLECTION),
      where('instructorId', '==', instructorId),
      where('className', '==', className),
      orderBy('createdAt', 'desc'),
      limit(50),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as ReportHistoryEntry[];
  }

  /**
   * Delete a single report history entry.
   */
  static async deleteReport(reportId: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION, reportId));
  }

  /**
   * Bulk-delete selected report entries.
   */
  static async deleteReports(reportIds: string[]): Promise<number> {
    if (reportIds.length === 0) return 0;
    const batch = writeBatch(db);
    for (const id of reportIds) {
      batch.delete(doc(db, COLLECTION, id));
    }
    await batch.commit();
    return reportIds.length;
  }

  /**
   * Run retention-policy cleanup: delete all expired reports for an instructor.
   * Returns number of deleted docs.
   */
  static async cleanupExpired(instructorId: string): Promise<number> {
    const now = Timestamp.now();
    const q = query(
      collection(db, COLLECTION),
      where('instructorId', '==', instructorId),
      where('expiresAt', '<=', now),
      limit(500), // safety cap per batch
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return 0;

    const batch = writeBatch(db);
    snapshot.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    return snapshot.size;
  }

  /**
   * Get archive statistics for an instructor.
   */
  static async getStats(instructorId: string): Promise<ArchiveStats> {
    const q = query(
      collection(db, COLLECTION),
      where('instructorId', '==', instructorId),
      orderBy('createdAt', 'desc'),
      limit(500),
    );

    const snapshot = await getDocs(q);
    const stats: ArchiveStats = {
      totalReports: snapshot.size,
      byFormat: {},
      byType: {},
    };

    snapshot.docs.forEach((d) => {
      const data = d.data() as ReportHistoryEntry;
      // By format
      const fmt = data.format || 'Unknown';
      stats.byFormat[fmt] = (stats.byFormat[fmt] || 0) + 1;
      // By type
      const tp = data.reportType || 'unknown';
      stats.byType[tp] = (stats.byType[tp] || 0) + 1;
      // Dates
      if (data.createdAt) {
        const date = data.createdAt.toDate();
        if (!stats.newestReport || date > stats.newestReport) stats.newestReport = date;
        if (!stats.oldestReport || date < stats.oldestReport) stats.oldestReport = date;
      }
    });

    return stats;
  }
}
