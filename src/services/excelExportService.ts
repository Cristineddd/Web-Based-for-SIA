/**
 * Excel Export Service — SS4 2.1 + SS4 2.3 Gordon College Branding
 *
 * Provides formatted, multi-sheet .xlsx exports for:
 * - Exam scores (from ExamScoresTable)
 * - Class results (from Results page)
 * - Student roster (from Students page)
 *
 * Uses the `xlsx` (SheetJS) library for workbook creation,
 * cell styling, column widths, and data-validation dropdowns.
 * All sheets include Gordon College institutional branding header.
 */

import * as XLSX from 'xlsx';
import { getExcelBrandingRows, ExcelExportMetadata } from '@/lib/gcBranding';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ExamScoreExportRow {
  studentId: string;
  studentName: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  grade: string;
  date: string;
  email?: string;
}

export interface ExamStatsExport {
  total: number;
  passCount: number;
  failCount: number;
  passRate: number;
  failRate: number;
  avgPercentage: number;
  highestPercentage: number;
  lowestPercentage: number;
  medianPercentage: number;
}

export interface ClassResultExportRow {
  classId: string;
  className: string;
  schedule: string;
  totalStudents: number;
  scannedCount: number;
  averageScore: number;
}

export interface StudentExportRow {
  student_id: string;
  first_name: string;
  last_name: string;
  email: string;
  grade?: string | null;
  section?: string | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Auto-fit column widths based on data content and headers */
function autoFitColumns(ws: XLSX.WorkSheet, data: unknown[][], headerRow: string[]): void {
  const colWidths: number[] = headerRow.map((h) => h.length);
  data.forEach((row) => {
    row.forEach((cell, i) => {
      const len = cell != null ? String(cell).length : 0;
      if (len > (colWidths[i] ?? 0)) colWidths[i] = len;
    });
  });
  ws['!cols'] = colWidths.map((w) => ({ wch: Math.min(w + 4, 40) }));
}

/** Apply bold header styling by setting cell types — works with xlsx community edition */
function stylizeHeaderRow(ws: XLSX.WorkSheet, headerCount: number, rowIndex: number = 0): void {
  for (let c = 0; c < headerCount; c++) {
    const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c });
    if (ws[cellAddress]) {
      // Ensure header values are strings for clean display
      ws[cellAddress].t = 's';
    }
  }
}

/** Freeze rows above the data header row (branding + header are frozen) */
function freezeHeaderRow(ws: XLSX.WorkSheet, frozenRows: number = 1): void {
  ws['!freeze'] = { xSplit: 0, ySplit: frozenRows };
  // Some consumers use '!views' instead
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (ws as any)['!views'] = [{ state: 'frozen', ySplit: frozenRows }];
}

/**
 * Build a worksheet with Gordon College branding rows prepended.
 * Returns the worksheet and the 0-based row index of the data header.
 */
function buildBrandedSheet(
  headerRow: string[],
  dataRows: unknown[][],
  metadata?: ExcelExportMetadata,
): { ws: XLSX.WorkSheet; headerRowIndex: number } {
  const brandingRows = getExcelBrandingRows(metadata);
  const allRows = [...brandingRows, headerRow, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(allRows);
  const headerRowIndex = brandingRows.length; // 0-based index of the header
  return { ws, headerRowIndex };
}

/** Add data-validation dropdown for a column range */
function addDataValidation(
  ws: XLSX.WorkSheet,
  col: number,
  startRow: number,
  endRow: number,
  allowedValues: string[],
): void {
  if (!ws['!dataValidation']) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ws as any)['!dataValidation'] = [];
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (ws as any)['!dataValidation'].push({
    type: 'list',
    operator: 'equal',
    allowBlank: true,
    sqref: `${XLSX.utils.encode_col(col)}${startRow + 1}:${XLSX.utils.encode_col(col)}${endRow + 1}`,
    formulas: [allowedValues.join(',')],
  });
}

// ─── Exports ────────────────────────────────────────────────────────────────

/**
 * Export exam scores to a multi-sheet .xlsx workbook.
 *
 * Sheet 1 — "Scores": all student rows with auto-sized columns
 * Sheet 2 — "Statistics": summary statistics
 * Sheet 3 — "Grade Distribution": breakdown by letter grade
 */
export function exportExamScoresToExcel(
  rows: ExamScoreExportRow[],
  examTitle: string,
  passingThreshold: number,
  stats: ExamStatsExport,
  metadata?: ExcelExportMetadata,
): void {
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Scores ─────────────────────────────────────────────────────
  const scoreHeaders = ['#', 'Student ID', 'Student Name', 'Score', 'Total', 'Percentage', 'Grade', 'Date'];
  const scoreData = rows.map((r, i) => [
    i + 1,
    r.studentId,
    r.studentName,
    r.score,
    r.totalQuestions,
    r.percentage,
    r.grade,
    r.date,
  ]);

  const { ws: wsScores, headerRowIndex: scoreHdrIdx } = buildBrandedSheet(scoreHeaders, scoreData, metadata);
  autoFitColumns(wsScores, scoreData, scoreHeaders);
  stylizeHeaderRow(wsScores, scoreHeaders.length, scoreHdrIdx);
  freezeHeaderRow(wsScores, scoreHdrIdx + 1);

  // Data validation: grade column (index 6) with allowed letter grades
  if (scoreData.length > 0) {
    addDataValidation(wsScores, 6, scoreHdrIdx + 1, scoreHdrIdx + scoreData.length, ['A', 'B+', 'B', 'C', 'D', 'F']);
  }

  // Percentage column as number format
  for (let r = scoreHdrIdx + 1; r <= scoreHdrIdx + scoreData.length; r++) {
    const cellRef = XLSX.utils.encode_cell({ r, c: 5 });
    if (wsScores[cellRef]) {
      wsScores[cellRef].z = '0"%"';
    }
  }

  XLSX.utils.book_append_sheet(wb, wsScores, 'Scores');

  // ── Sheet 2: Statistics ─────────────────────────────────────────────────
  const statsHeaders = ['Metric', 'Value'];
  const statsData = [
    ['Exam Title', examTitle],
    ...(metadata?.examCode ? [['Exam Code', metadata.examCode]] : []),
    ['Generated', new Date().toLocaleDateString()],
    ['', ''],
    ['Total Students', stats.total],
    ['Passed', `${stats.passCount} (${stats.passRate}%)`],
    ['Failed', `${stats.failCount} (${stats.failRate}%)`],
    ['Class Average', `${stats.avgPercentage}%`],
    ['Highest Score', `${stats.highestPercentage}%`],
    ['Lowest Score', `${stats.lowestPercentage}%`],
    ['Median Score', `${stats.medianPercentage}%`],
    ['Passing Threshold', `${passingThreshold}%`],
  ];

  const brandingRowCount = getExcelBrandingRows(metadata).length;

  const wsStats = XLSX.utils.aoa_to_sheet([...getExcelBrandingRows(metadata), statsHeaders, ...statsData]);
  autoFitColumns(wsStats, statsData, statsHeaders);
  stylizeHeaderRow(wsStats, statsHeaders.length, brandingRowCount);
  freezeHeaderRow(wsStats, brandingRowCount + 1);
  XLSX.utils.book_append_sheet(wb, wsStats, 'Statistics');

  // ── Sheet 3: Grade Distribution ─────────────────────────────────────────
  const gradeOrder = ['A', 'B+', 'B', 'C', 'D', 'F'];
  const gradeCounts: Record<string, number> = {};
  gradeOrder.forEach((g) => (gradeCounts[g] = 0));
  rows.forEach((r) => {
    if (gradeCounts[r.grade] !== undefined) {
      gradeCounts[r.grade]++;
    } else {
      gradeCounts[r.grade] = (gradeCounts[r.grade] || 0) + 1;
    }
  });

  const distHeaders = ['Grade', 'Count', 'Percentage'];
  const distData = gradeOrder.map((g) => [
    g,
    gradeCounts[g],
    rows.length > 0 ? `${Math.round((gradeCounts[g] / rows.length) * 100)}%` : '0%',
  ]);

  const wsDist = XLSX.utils.aoa_to_sheet([...getExcelBrandingRows(metadata), distHeaders, ...distData]);
  autoFitColumns(wsDist, distData, distHeaders);
  stylizeHeaderRow(wsDist, distHeaders.length, brandingRowCount);
  freezeHeaderRow(wsDist, brandingRowCount + 1);
  XLSX.utils.book_append_sheet(wb, wsDist, 'Grade Distribution');

  // ── Write ───────────────────────────────────────────────────────────────
  const safeTitle = examTitle.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_');
  XLSX.writeFile(wb, `${safeTitle}_scores.xlsx`);
}

/**
 * Export class-level student results to a multi-sheet .xlsx.
 *
 * Sheet 1 — "Student Results": per-student rows
 * Sheet 2 — "Statistics Summary": computed stats
 */
export function exportClassResultsToExcel(
  className: string,
  studentResults: ExamScoreExportRow[],
  passingThreshold: number,
  metadata?: ExcelExportMetadata,
): void {
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Student Results ────────────────────────────────────────────
  const headers = ['#', 'Student ID', 'Student Name', 'Score', 'Total', 'Percentage', 'Grade', 'Date'];
  const data = studentResults.map((r, i) => [
    i + 1,
    r.studentId,
    r.studentName,
    r.score,
    r.totalQuestions,
    r.percentage,
    r.grade,
    r.date,
  ]);

  const { ws: wsResults, headerRowIndex: resHdrIdx } = buildBrandedSheet(headers, data, metadata);
  autoFitColumns(wsResults, data, headers);
  stylizeHeaderRow(wsResults, headers.length, resHdrIdx);
  freezeHeaderRow(wsResults, resHdrIdx + 1);

  // Data validation on grade column
  if (data.length > 0) {
    addDataValidation(wsResults, 6, resHdrIdx + 1, resHdrIdx + data.length, ['A', 'B+', 'B', 'C', 'D', 'F']);
  }

  // Format percentage column
  for (let r = resHdrIdx + 1; r <= resHdrIdx + data.length; r++) {
    const cellRef = XLSX.utils.encode_cell({ r, c: 5 });
    if (wsResults[cellRef]) {
      wsResults[cellRef].z = '0"%"';
    }
  }

  XLSX.utils.book_append_sheet(wb, wsResults, 'Student Results');

  // ── Sheet 2: Statistics Summary ─────────────────────────────────────────
  const percentages = studentResults.map((r) => r.percentage);
  const avg = percentages.length > 0 ? Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length) : 0;
  const passCount = percentages.filter((p) => p >= passingThreshold).length;
  const failCount = percentages.length - passCount;
  const highest = percentages.length > 0 ? Math.max(...percentages) : 0;
  const lowest = percentages.length > 0 ? Math.min(...percentages) : 0;
  const sorted = [...percentages].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length === 0
      ? 0
      : sorted.length % 2 !== 0
        ? sorted[mid]
        : Math.round((sorted[mid - 1] + sorted[mid]) / 2);

  const statsHeaders = ['Metric', 'Value'];
  const statsData = [
    ['Class', className],
    ...(metadata?.examCode ? [['Exam Code', metadata.examCode]] : []),
    ...(metadata?.subject ? [['Subject', metadata.subject]] : []),
    ['Generated', new Date().toLocaleDateString()],
    ['', ''],
    ['Total Students', studentResults.length],
    ['Passed', `${passCount} (${percentages.length > 0 ? Math.round((passCount / percentages.length) * 100) : 0}%)`],
    ['Failed', `${failCount} (${percentages.length > 0 ? Math.round((failCount / percentages.length) * 100) : 0}%)`],
    ['Class Average', `${avg}%`],
    ['Highest Score', `${highest}%`],
    ['Lowest Score', `${lowest}%`],
    ['Median Score', `${median}%`],
    ['Passing Threshold', `${passingThreshold}%`],
  ];

  // Grade distribution sub-section
  const gradeOrder = ['A', 'B+', 'B', 'C', 'D', 'F'];
  const gradeCounts: Record<string, number> = {};
  gradeOrder.forEach((g) => (gradeCounts[g] = 0));
  studentResults.forEach((r) => {
    if (gradeCounts[r.grade] !== undefined) gradeCounts[r.grade]++;
  });

  const gradeRows = [
    ['', ''],
    ['Grade Distribution', ''],
    ...gradeOrder.map((g) => [
      `Grade ${g}`,
      `${gradeCounts[g]} (${studentResults.length > 0 ? Math.round((gradeCounts[g] / studentResults.length) * 100) : 0}%)`,
    ]),
  ];

  const classResultsBrandingCount = getExcelBrandingRows(metadata).length;

  const wsStats = XLSX.utils.aoa_to_sheet([...getExcelBrandingRows(metadata), statsHeaders, ...statsData, ...gradeRows]);
  autoFitColumns(wsStats, [...statsData, ...gradeRows], statsHeaders);
  stylizeHeaderRow(wsStats, statsHeaders.length, classResultsBrandingCount);
  freezeHeaderRow(wsStats, classResultsBrandingCount + 1);
  XLSX.utils.book_append_sheet(wb, wsStats, 'Statistics Summary');

  // ── Write ───────────────────────────────────────────────────────────────
  const safeName = className.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_');
  XLSX.writeFile(wb, `${safeName}_results.xlsx`);
}

/**
 * Generate a class results Excel workbook and return as an ArrayBuffer (for batch/zip export).
 * Same content as exportClassResultsToExcel but does NOT trigger a browser download.
 */
export function exportClassResultsToExcelBuffer(
  className: string,
  studentResults: ExamScoreExportRow[],
  passingThreshold: number,
  metadata?: ExcelExportMetadata,
): ArrayBuffer {
  const wb = XLSX.utils.book_new();

  const headers = ['#', 'Student ID', 'Student Name', 'Score', 'Total', 'Percentage', 'Grade', 'Date'];
  const data = studentResults.map((r, i) => [
    i + 1, r.studentId, r.studentName, r.score, r.totalQuestions, r.percentage, r.grade, r.date,
  ]);

  const { ws: wsResults, headerRowIndex: resHdrIdx } = buildBrandedSheet(headers, data, metadata);
  autoFitColumns(wsResults, data, headers);
  stylizeHeaderRow(wsResults, headers.length, resHdrIdx);
  freezeHeaderRow(wsResults, resHdrIdx + 1);
  if (data.length > 0) {
    addDataValidation(wsResults, 6, resHdrIdx + 1, resHdrIdx + data.length, ['A', 'B+', 'B', 'C', 'D', 'F']);
  }
  for (let r = resHdrIdx + 1; r <= resHdrIdx + data.length; r++) {
    const cellRef = XLSX.utils.encode_cell({ r, c: 5 });
    if (wsResults[cellRef]) wsResults[cellRef].z = '0"%"';
  }
  XLSX.utils.book_append_sheet(wb, wsResults, 'Student Results');

  const percentages = studentResults.map((r) => r.percentage);
  const avg = percentages.length > 0 ? Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length) : 0;
  const passCount = percentages.filter((p) => p >= passingThreshold).length;
  const failCount = percentages.length - passCount;
  const highest = percentages.length > 0 ? Math.max(...percentages) : 0;
  const lowest = percentages.length > 0 ? Math.min(...percentages) : 0;
  const sorted = [...percentages].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length === 0 ? 0 : sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);

  const statsHeaders = ['Metric', 'Value'];
  const statsData = [
    ['Class', className],
    ...(metadata?.examCode ? [['Exam Code', metadata.examCode]] : []),
    ...(metadata?.subject ? [['Subject', metadata.subject]] : []),
    ['Generated', new Date().toLocaleDateString()],
    ['', ''],
    ['Total Students', studentResults.length],
    ['Passed', `${passCount} (${percentages.length > 0 ? Math.round((passCount / percentages.length) * 100) : 0}%)`],
    ['Failed', `${failCount} (${percentages.length > 0 ? Math.round((failCount / percentages.length) * 100) : 0}%)`],
    ['Class Average', `${avg}%`],
    ['Highest Score', `${highest}%`],
    ['Lowest Score', `${lowest}%`],
    ['Median Score', `${median}%`],
    ['Passing Threshold', `${passingThreshold}%`],
  ];

  const gradeOrder = ['A', 'B+', 'B', 'C', 'D', 'F'];
  const gradeCounts: Record<string, number> = {};
  gradeOrder.forEach((g) => (gradeCounts[g] = 0));
  studentResults.forEach((r) => { if (gradeCounts[r.grade] !== undefined) gradeCounts[r.grade]++; });
  const gradeRows = [
    ['', ''],
    ['Grade Distribution', ''],
    ...gradeOrder.map((g) => [
      `Grade ${g}`,
      `${gradeCounts[g]} (${studentResults.length > 0 ? Math.round((gradeCounts[g] / studentResults.length) * 100) : 0}%)`,
    ]),
  ];

  const bufBrandingCount = getExcelBrandingRows(metadata).length;
  const wsStats = XLSX.utils.aoa_to_sheet([...getExcelBrandingRows(metadata), statsHeaders, ...statsData, ...gradeRows]);
  autoFitColumns(wsStats, [...statsData, ...gradeRows], statsHeaders);
  stylizeHeaderRow(wsStats, statsHeaders.length, bufBrandingCount);
  freezeHeaderRow(wsStats, bufBrandingCount + 1);
  XLSX.utils.book_append_sheet(wb, wsStats, 'Statistics Summary');

  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
}

/**
 * Export a summary of all classes with their averages.
 *
 * Sheet 1 — "Class Summary": one row per class
 */
export function exportClassSummaryToExcel(
  classResults: ClassResultExportRow[],
  metadata?: ExcelExportMetadata,
): void {
  const wb = XLSX.utils.book_new();

  const headers = ['#', 'Class Name', 'Schedule', 'Total Students', 'Scanned', 'Average Score (%)'];
  const data = classResults.map((c, i) => [
    i + 1,
    c.className,
    c.schedule,
    c.totalStudents,
    c.scannedCount,
    c.averageScore,
  ]);

  const { ws, headerRowIndex: sumHdrIdx } = buildBrandedSheet(headers, data, metadata);
  autoFitColumns(ws, data, headers);
  stylizeHeaderRow(ws, headers.length, sumHdrIdx);
  freezeHeaderRow(ws, sumHdrIdx + 1);

  // Format average column
  for (let r = sumHdrIdx + 1; r <= sumHdrIdx + data.length; r++) {
    const cellRef = XLSX.utils.encode_cell({ r, c: 5 });
    if (ws[cellRef]) {
      ws[cellRef].z = '0.0"%"';
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, 'Class Summary');
  XLSX.writeFile(wb, 'class_summary.xlsx');
}

/**
 * Export student roster with formatting.
 *
 * Sheet 1 — "Students": formatted roster
 */
export function exportStudentRosterToExcel(students: StudentExportRow[]): void {
  const wb = XLSX.utils.book_new();

  const headers = ['#', 'Student ID', 'First Name', 'Last Name', 'Email', 'Grade/Year', 'Section'];
  const data = students.map((s, i) => [
    i + 1,
    s.student_id,
    s.first_name,
    s.last_name,
    s.email || '',
    s.grade || '',
    s.section || '',
  ]);

  const { ws, headerRowIndex: rosterHdrIdx } = buildBrandedSheet(headers, data);
  autoFitColumns(ws, data, headers);
  stylizeHeaderRow(ws, headers.length, rosterHdrIdx);
  freezeHeaderRow(ws, rosterHdrIdx + 1);

  XLSX.utils.book_append_sheet(wb, ws, 'Students');

  XLSX.writeFile(wb, 'student_roster.xlsx');
}
