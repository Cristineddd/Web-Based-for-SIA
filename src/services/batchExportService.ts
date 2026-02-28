/**
 * Batch Export Service — SS4 2.5
 *
 * Enables exporting multiple exams in a single operation.
 * Generates individual PDF / Excel files per exam, then bundles them
 * into a single .zip file for download.
 *
 * Uses JSZip for zip generation and the buffer-returning variants of
 * the PDF / Excel export services.
 */

import JSZip from 'jszip';
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  generateClassResultsPdfBuffer,
  PdfStudentRow,
  ExportMetadata,
} from '@/services/pdfReportService';
import {
  exportClassResultsToExcelBuffer,
  ExamScoreExportRow,
} from '@/services/excelExportService';
import { ExcelExportMetadata } from '@/lib/gcBranding';
import type { Exam } from '@/services/examService';
import type { Student } from '@/services/classService';

// ─── Types ──────────────────────────────────────────────────────────────────

export type BatchExportFormat = 'pdf' | 'excel' | 'both';

export interface BatchExportProgress {
  /** Total number of exams to process */
  total: number;
  /** Number of exams completed so far */
  completed: number;
  /** Current exam being processed */
  currentExamTitle: string;
  /** Current step description */
  step: string;
  /** Overall percentage 0–100 */
  percent: number;
}

export interface BatchExportOptions {
  /** The class this export is for */
  classId: string;
  className: string;
  /** Students in the class (used for name resolution) */
  students: Student[];
  /** Which exams to export */
  exams: Exam[];
  /** Export format */
  format: BatchExportFormat;
  /** Passing threshold % */
  passingThreshold: number;
  /** Metadata for headers (instructor, etc.) */
  metadata?: ExportMetadata;
  /** Progress callback — called once per exam */
  onProgress?: (progress: BatchExportProgress) => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Calculate letter grade from a percentage */
function calculateLetterGrade(percentage: number): string {
  if (percentage >= 90) return 'A';
  if (percentage >= 85) return 'A';
  if (percentage >= 80) return 'B+';
  if (percentage >= 75) return 'B';
  if (percentage >= 70) return 'C';
  if (percentage >= 65) return 'D';
  return 'F';
}

/**
 * Fetch student results for a single exam from Firestore.
 * Returns an array of rows ready for PDF / Excel export.
 */
async function fetchResultsForExam(
  examId: string,
  classId: string,
  students: Student[],
): Promise<PdfStudentRow[]> {
  const results: PdfStudentRow[] = [];
  const processedIds = new Set<string>();

  // 1. scannedResults
  try {
    const scannedQuery = query(
      collection(db, 'scannedResults'),
      where('examId', '==', examId),
    );
    const snap = await getDocs(scannedQuery);
    snap.forEach((doc) => {
      const d = doc.data();
      if (!d.isNullId && !processedIds.has(d.studentId)) {
        processedIds.add(d.studentId);
        const stu = students.find((s) => s.student_id === d.studentId);
        const pct = d.totalQuestions > 0 ? Math.round((d.score / d.totalQuestions) * 100) : 0;
        let scannedDate = '';
        if (d.scannedAt) {
          const ts = d.scannedAt as Timestamp;
          const dt = ts?.toDate?.() || new Date(d.scannedAt);
          scannedDate = dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        }
        results.push({
          studentId: d.studentId,
          studentName: stu ? `${stu.last_name}, ${stu.first_name}` : d.studentId,
          score: d.score || 0,
          totalQuestions: d.totalQuestions || 0,
          percentage: pct,
          grade: calculateLetterGrade(pct),
          date: scannedDate || 'N/A',
          email: stu?.email,
        });
      }
    });
  } catch (err) {
    console.error(`[batch] Error fetching scannedResults for exam ${examId}:`, err);
  }

  // 2. studentGrades fallback
  try {
    const gradesQuery = query(
      collection(db, 'studentGrades'),
      where('class_id', '==', classId),
    );
    const snap = await getDocs(gradesQuery);
    snap.forEach((doc) => {
      const d = doc.data();
      if (!processedIds.has(d.student_id)) {
        processedIds.add(d.student_id);
        const stu = students.find((s) => s.student_id === d.student_id);
        const pct = d.percentage || (d.max_score > 0 ? Math.round((d.score / d.max_score) * 100) : 0);
        let gradedDate = '';
        if (d.graded_at) {
          const ts = d.graded_at as Timestamp;
          const dt = ts?.toDate?.() || new Date(d.graded_at);
          gradedDate = dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        }
        results.push({
          studentId: d.student_id,
          studentName: stu ? `${stu.last_name}, ${stu.first_name}` : d.student_id,
          score: d.score || 0,
          totalQuestions: d.max_score || 0,
          percentage: pct,
          grade: d.letter_grade || calculateLetterGrade(pct),
          date: gradedDate || 'N/A',
          email: stu?.email,
        });
      }
    });
  } catch (err) {
    console.error(`[batch] Error fetching studentGrades for class ${classId}:`, err);
  }

  results.sort((a, b) => a.studentName.localeCompare(b.studentName));
  return results;
}

/** Make a filename-safe string */
function safeName(str: string): string {
  return str.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_');
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Export multiple exams in a single zip download.
 *
 * For each selected exam:
 *   1. Fetch student results from Firestore
 *   2. Generate a PDF and/or Excel buffer
 *   3. Add to zip
 *
 * Finally triggers a browser download of the zip file.
 */
export async function batchExportExams(options: BatchExportOptions): Promise<void> {
  const {
    classId,
    className,
    students,
    exams,
    format,
    passingThreshold,
    metadata,
    onProgress,
  } = options;

  const zip = new JSZip();
  const total = exams.length;

  for (let i = 0; i < exams.length; i++) {
    const exam = exams[i];
    const prefix = safeName(`${className}_${exam.title}`);

    // Report progress — fetching data
    onProgress?.({
      total,
      completed: i,
      currentExamTitle: exam.title,
      step: `Fetching results for "${exam.title}"...`,
      percent: Math.round((i / total) * 100),
    });

    // 1. Fetch results
    const rows = await fetchResultsForExam(exam.id, classId, students);

    // Build per-exam metadata
    const examMeta: ExportMetadata = {
      ...metadata,
      subject: exam.subject || metadata?.subject,
      numItems: exam.num_items || metadata?.numItems,
      choicesPerItem: exam.choices_per_item || metadata?.choicesPerItem,
      examDate: exam.created_at || metadata?.examDate,
      examCode: exam.examCode || metadata?.examCode,
    };

    const excelMeta: ExcelExportMetadata = {
      instructorName: examMeta.instructorName,
      subject: examMeta.subject,
      section: examMeta.section,
      numItems: examMeta.numItems,
      choicesPerItem: examMeta.choicesPerItem,
      examDate: examMeta.examDate,
      examCode: examMeta.examCode,
    };

    // Report progress — generating files
    onProgress?.({
      total,
      completed: i,
      currentExamTitle: exam.title,
      step: `Generating export for "${exam.title}"...`,
      percent: Math.round(((i + 0.5) / total) * 100),
    });

    // 2. Generate PDF buffer
    if (format === 'pdf' || format === 'both') {
      const pdfRows: PdfStudentRow[] = rows;
      const pdfBuf = await generateClassResultsPdfBuffer(
        className,
        exam.title,
        pdfRows,
        passingThreshold,
        examMeta,
      );
      zip.file(`${prefix}_report.pdf`, pdfBuf);
    }

    // 3. Generate Excel buffer
    if (format === 'excel' || format === 'both') {
      const excelRows: ExamScoreExportRow[] = rows.map((r) => ({
        studentId: r.studentId,
        studentName: r.studentName,
        score: r.score,
        totalQuestions: r.totalQuestions,
        percentage: r.percentage,
        grade: r.grade,
        date: r.date,
        email: r.email,
      }));
      const xlsBuf = exportClassResultsToExcelBuffer(
        className,
        excelRows,
        passingThreshold,
        excelMeta,
      );
      zip.file(`${prefix}_results.xlsx`, xlsBuf);
    }
  }

  // Final progress
  onProgress?.({
    total,
    completed: total,
    currentExamTitle: '',
    step: 'Creating zip file...',
    percent: 95,
  });

  // 4. Generate zip and trigger download
  const blob = await zip.generateAsync({ type: 'blob' });

  onProgress?.({
    total,
    completed: total,
    currentExamTitle: '',
    step: 'Done!',
    percent: 100,
  });

  // Browser download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName(className)}_batch_export.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
