/**
 * PDF Report Service - SS4 2.2 + 2.3 (Gordon College Branding)
 *
 * Generates professional, multi-page PDF reports with:
 * - Cover page with GC logo, institution name, gold accents

 * - Formatted data tables with alternating row colors
 * - Statistics summary section
 * - Grade distribution breakdown
 * - Page numbers on every page
 * - Branded header/footer on every page
 *
 * Uses jsPDF (already installed) + GC Branding constants.
 */

import jsPDF from 'jspdf';
import {
  GC_FULL_NAME,
  GC_SYSTEM_NAME,
  GC_PRIMARY,
  GC_GOLD,
  GC_WHITE,
  GC_TEXT_MUTED,
  GC_FONT_PRIMARY,
  GC_FONT_SIZES,
  GC_PDF_PAGE,
  loadGCLogoBase64,
} from '@/lib/gcBranding';

// === Constants ===

const BRAND_COLOR = GC_PRIMARY;
const GRAY_700: [number, number, number] = [55, 65, 81];
const GRAY_500 = GC_TEXT_MUTED;
const GRAY_200: [number, number, number] = [229, 231, 235];
const WHITE = GC_WHITE;
const GREEN_50: [number, number, number] = [240, 253, 244];
const RED_50: [number, number, number] = [254, 242, 242];
const GOLD = GC_GOLD;

const PAGE_WIDTH = GC_PDF_PAGE.width;
const PAGE_HEIGHT = GC_PDF_PAGE.height;
const MARGIN_LEFT = GC_PDF_PAGE.marginLeft;
const MARGIN_RIGHT = GC_PDF_PAGE.marginRight;
const MARGIN_TOP = GC_PDF_PAGE.marginTop;
const MARGIN_BOTTOM = GC_PDF_PAGE.marginBottom;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

// === Types ===

export interface PdfStudentRow {
  studentId: string;
  studentName: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  grade: string;
  date: string;
  email?: string;
}

export interface PdfStatsData {
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

export interface PdfClassSummaryRow {
  className: string;
  schedule: string;
  totalStudents: number;
  scannedCount: number;
  averageScore: number;
}

// ─── Export Metadata ─────────────────────────────────────────────────────────

/** Optional metadata included on cover pages and branding headers of all exports. */
export interface ExportMetadata {
  instructorName?: string;
  subject?: string;
  section?: string;
  numItems?: number;
  choicesPerItem?: number;
  examDate?: string;
  examCode?: string;
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/** Adds page footer with GC branding + page number. Call AFTER content of each page. */
function addPageFooter(doc: jsPDF, pageNum: number, totalPages: number): void {
  const y = PAGE_HEIGHT - 10;
  // Gold accent line
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.5);
  doc.line(MARGIN_LEFT, y - 5, PAGE_WIDTH - MARGIN_RIGHT, y - 5);
  // Footer text
  doc.setFontSize(GC_FONT_SIZES.footer);
  doc.setFont(GC_FONT_PRIMARY, 'normal');
  doc.setTextColor(...GRAY_500);
  doc.text(GC_SYSTEM_NAME, MARGIN_LEFT, y);
  doc.text(`Page ${pageNum} of ${totalPages}`, PAGE_WIDTH - MARGIN_RIGHT, y, { align: 'right' });
  doc.setTextColor(0);
  doc.setDrawColor(0);
}

/** Add all footers at the end (when total page count is known). */
function addAllFooters(doc: jsPDF): void {
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addPageFooter(doc, i, totalPages);
  }
}

/**
 * Draw a slim branded header on content pages (not cover).
 * Includes a thin green bar, gold accent, and institution name.
 */
function drawContentPageHeader(doc: jsPDF, logoBase64: string): void {
  // Thin brand bar
  doc.setFillColor(...BRAND_COLOR);
  doc.rect(0, 0, PAGE_WIDTH, 3, 'F');
  // Gold accent
  doc.setFillColor(...GOLD);
  doc.rect(0, 3, PAGE_WIDTH, 0.6, 'F');

  // Mini logo + text in the bar area
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', MARGIN_LEFT, 5, 8, 8);
    } catch { /* skip */ }
  }
  doc.setFontSize(7);
  doc.setFont(GC_FONT_PRIMARY, 'normal');
  doc.setTextColor(...GRAY_500);
  doc.text(GC_FULL_NAME, MARGIN_LEFT + (logoBase64 ? 10 : 0), 10);
  doc.setTextColor(0);
}

/** Check if y would overflow the page and add a new page if needed. Returns new y. */
function checkPageBreak(doc: jsPDF, y: number, neededSpace: number = 20): number {
  if (y + neededSpace > PAGE_HEIGHT - MARGIN_BOTTOM) {
    doc.addPage();
    return MARGIN_TOP;
  }
  return y;
}

/** Draw a horizontal rule */
function drawRule(doc: jsPDF, y: number, color: [number, number, number] = GRAY_200): void {
  doc.setDrawColor(...color);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);
  doc.setDrawColor(0);
}

/** Draw section heading and return new y */
function drawSectionHeading(doc: jsPDF, y: number, title: string): number {
  y = checkPageBreak(doc, y, 20);
  doc.setFontSize(GC_FONT_SIZES.sectionHeading);
  doc.setFont(GC_FONT_PRIMARY, 'bold');
  doc.setTextColor(...BRAND_COLOR);
  doc.text(title, MARGIN_LEFT, y);
  y += 2;
  // Gold accent underline
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.line(MARGIN_LEFT, y, MARGIN_LEFT + 40, y);
  // Green continuation line
  doc.setDrawColor(...BRAND_COLOR);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_LEFT + 40, y, PAGE_WIDTH - MARGIN_RIGHT, y);
  doc.setDrawColor(0);
  doc.setTextColor(0);
  return y + 6;
}

/** Draw a key–value stat line */
function drawStatLine(doc: jsPDF, y: number, label: string, value: string): number {
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GRAY_700);
  doc.text(label, MARGIN_LEFT + 4, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0);
  doc.text(value, MARGIN_LEFT + 70, y);
  return y + 6;
}

/** Draw a filled rounded rect  */
function drawFilledRect(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  color: [number, number, number],
): void {
  doc.setFillColor(...color);
  doc.roundedRect(x, y, w, h, 1.5, 1.5, 'F');
}

// ─── Cover page ──────────────────────────────────────────────────────────────

function drawCoverPage(
  doc: jsPDF,
  title: string,
  subtitle: string,
  meta: { label: string; value: string }[],
  logoBase64: string,
): void {
  const centerX = PAGE_WIDTH / 2;

  // Brand bar at top
  doc.setFillColor(...BRAND_COLOR);
  doc.rect(0, 0, PAGE_WIDTH, 38, 'F');

  // Gold accent stripe
  doc.setFillColor(...GOLD);
  doc.rect(0, 38, PAGE_WIDTH, 1.5, 'F');

  // Logo (centered, if available)
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', centerX - 6.5, 4, 13, 13);
    } catch {
      // Graceful degradation — skip logo
    }
  }

  // Institution name — centered below logo
  const instY = logoBase64 ? 20 : 12;
  doc.setFontSize(8);
  doc.setFont(GC_FONT_PRIMARY, 'bold');
  doc.setTextColor(200, 230, 210);
  doc.text(GC_FULL_NAME.toUpperCase(), centerX, instY, { align: 'center' });

  // System name — centered
  doc.setFontSize(6.5);
  doc.setFont(GC_FONT_PRIMARY, 'normal');
  doc.setTextColor(180, 210, 190);
  doc.text(GC_SYSTEM_NAME, centerX, instY + 3.5, { align: 'center' });

  // Title — centered
  doc.setFontSize(GC_FONT_SIZES.coverTitle);
  doc.setFont(GC_FONT_PRIMARY, 'bold');
  doc.setTextColor(...WHITE);
  const titleLines = doc.splitTextToSize(title, CONTENT_WIDTH);
  doc.text(titleLines, centerX, instY + 9, { align: 'center' });

  // Subtitle — centered
  doc.setFontSize(GC_FONT_SIZES.coverSubtitle);
  doc.setFont(GC_FONT_PRIMARY, 'normal');
  doc.setTextColor(220, 240, 230);
  doc.text(subtitle, centerX, instY + 9 + titleLines.length * 5 + 2, { align: 'center' });
  doc.setTextColor(0);

  // ── Meta card (Report Details) — no blank gaps ──
  // Measure max label width so values align neatly right after labels
  doc.setFontSize(GC_FONT_SIZES.body);
  doc.setFont(GC_FONT_PRIMARY, 'bold');
  const labelWidths = meta.map(({ label }) => doc.getTextWidth(`${label}:`));
  const maxLabelW = Math.max(...labelWidths);
  const valueIndent = MARGIN_LEFT + 8 + maxLabelW + 4; // 4mm gap after longest label

  const rowH = 7; // tighter row height
  const cardPaddingTop = 10;
  const cardPaddingBottom = 6;
  const headerH = 12; // "Report Details" header + rule
  const cardH = headerH + cardPaddingTop + meta.length * rowH + cardPaddingBottom;

  let y = 55;
  drawFilledRect(doc, MARGIN_LEFT, y - 6, CONTENT_WIDTH, cardH, [248, 250, 252]);
  // Gold left border on meta card
  doc.setFillColor(...GOLD);
  doc.rect(MARGIN_LEFT, y - 6, 2, cardH, 'F');

  doc.setFontSize(10);
  doc.setFont(GC_FONT_PRIMARY, 'bold');
  doc.setTextColor(...BRAND_COLOR);
  doc.text('Report Details', MARGIN_LEFT + 8, y + 2);
  y += 10;
  drawRule(doc, y - 2, GRAY_200);
  y += 4;

  meta.forEach(({ label, value }) => {
    doc.setFontSize(GC_FONT_SIZES.body);
    doc.setFont(GC_FONT_PRIMARY, 'bold');
    doc.setTextColor(...GRAY_700);
    doc.text(`${label}:`, MARGIN_LEFT + 8, y);
    doc.setFont(GC_FONT_PRIMARY, 'normal');
    doc.setTextColor(0);
    doc.text(value, valueIndent, y);
    y += rowH;
  });

  // Footer note
  doc.setFontSize(8);
  doc.setTextColor(...GRAY_500);
  doc.text('This report was automatically generated by GC SMART CHECK.', MARGIN_LEFT, PAGE_HEIGHT - 30);
  doc.text('Please verify data before formal use.', MARGIN_LEFT, PAGE_HEIGHT - 25);
  doc.setTextColor(0);
}

// ─── Data table drawer ───────────────────────────────────────────────────────

interface TableColumn {
  header: string;
  width: number;
  align?: 'left' | 'center' | 'right';
}

function drawDataTable(
  doc: jsPDF,
  y: number,
  columns: TableColumn[],
  rows: string[][],
  options?: { highlightFn?: (row: string[], rowIdx: number) => [number, number, number] | null },
): number {
  const ROW_HEIGHT = 7;
  const HEADER_HEIGHT = 8;

  // Header background
  y = checkPageBreak(doc, y, HEADER_HEIGHT + ROW_HEIGHT * 2);
  drawFilledRect(doc, MARGIN_LEFT, y - 5, CONTENT_WIDTH, HEADER_HEIGHT, BRAND_COLOR);

  // Header text
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...WHITE);
  let x = MARGIN_LEFT + 2;
  columns.forEach((col) => {
    const tx = col.align === 'right' ? x + col.width - 4 : col.align === 'center' ? x + col.width / 2 : x;
    const opts = col.align === 'right' ? { align: 'right' as const } : col.align === 'center' ? { align: 'center' as const } : undefined;
    doc.text(col.header, tx, y - 0.5, opts);
    x += col.width;
  });
  y += HEADER_HEIGHT - 3;

  // Rows
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');

  rows.forEach((row, rowIdx) => {
    y = checkPageBreak(doc, y, ROW_HEIGHT + 2);

    // Alternating row color
    const highlight = options?.highlightFn?.(row, rowIdx);
    if (highlight) {
      drawFilledRect(doc, MARGIN_LEFT, y - 4, CONTENT_WIDTH, ROW_HEIGHT, highlight);
    } else if (rowIdx % 2 === 0) {
      drawFilledRect(doc, MARGIN_LEFT, y - 4, CONTENT_WIDTH, ROW_HEIGHT, [249, 250, 251]);
    }

    doc.setTextColor(...GRAY_700);
    x = MARGIN_LEFT + 2;
    columns.forEach((col, colIdx) => {
      let text = row[colIdx] ?? '';
      // Truncate if too long
      const maxChars = Math.floor(col.width / 2);
      if (text.length > maxChars) text = text.substring(0, maxChars - 2) + '..';
      const tx = col.align === 'right' ? x + col.width - 4 : col.align === 'center' ? x + col.width / 2 : x;
      const opts = col.align === 'right' ? { align: 'right' as const } : col.align === 'center' ? { align: 'center' as const } : undefined;
      doc.text(text, tx, y, opts);
      x += col.width;
    });

    y += ROW_HEIGHT;
  });

  doc.setTextColor(0);
  return y;
}

// ─── Grade distribution bar chart (simple) ───────────────────────────────────

function drawGradeDistribution(doc: jsPDF, y: number, rows: PdfStudentRow[]): number {
  const grades = ['A', 'B+', 'B', 'C', 'D', 'F'];
  const counts: Record<string, number> = {};
  grades.forEach((g) => (counts[g] = 0));
  rows.forEach((r) => {
    if (counts[r.grade] !== undefined) counts[r.grade]++;
  });
  const maxCount = Math.max(...Object.values(counts), 1);

  y = checkPageBreak(doc, y, 60);
  const barMaxWidth = CONTENT_WIDTH - 40;
  const barHeight = 6;

  const gradeColors: Record<string, [number, number, number]> = {
    A: [34, 197, 94],
    'B+': [132, 204, 22],
    B: [163, 230, 53],
    C: [234, 179, 8],
    D: [249, 115, 22],
    F: [239, 68, 68],
  };

  grades.forEach((g) => {
    y = checkPageBreak(doc, y, barHeight + 4);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GRAY_700);
    doc.text(`${g}`, MARGIN_LEFT + 4, y + 4);

    // Bar
    const barWidth = maxCount > 0 ? (counts[g] / maxCount) * barMaxWidth : 0;
    if (barWidth > 0) {
      drawFilledRect(doc, MARGIN_LEFT + 18, y, barWidth, barHeight, gradeColors[g] || GRAY_500);
    }

    // Count label
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY_700);
    const pct = rows.length > 0 ? Math.round((counts[g] / rows.length) * 100) : 0;
    doc.text(`${counts[g]} (${pct}%)`, MARGIN_LEFT + 20 + Math.max(barWidth, 2), y + 4);

    y += barHeight + 3;
  });

  doc.setTextColor(0);
  return y;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a professional PDF report for exam scores.
 *
 * Includes: cover page, scores table,
 * statistics summary, grade distribution, and page numbers.
 */
export async function generateExamScoresPdf(
  rows: PdfStudentRow[],
  examTitle: string,
  passingThreshold: number,
  stats: PdfStatsData,
  metadata?: ExportMetadata,
): Promise<void> {
  const logoBase64 = await loadGCLogoBase64();
  const doc = new jsPDF('p', 'mm', 'a4');
  const generatedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // ── Page 1: Cover ──
  const examCoverMeta: { label: string; value: string }[] = [
    { label: 'Report Type', value: 'Exam Score Report' },
  ];
  if (metadata?.instructorName) examCoverMeta.push({ label: 'Instructor', value: metadata.instructorName });
  if (metadata?.subject) examCoverMeta.push({ label: 'Subject', value: metadata.subject });
  if (metadata?.section) examCoverMeta.push({ label: 'Section', value: metadata.section });
  if (metadata?.numItems) examCoverMeta.push({ label: 'No. of Items', value: String(metadata.numItems) });
  if (metadata?.choicesPerItem) examCoverMeta.push({ label: 'Choices per Item', value: String(metadata.choicesPerItem) });
  if (metadata?.examCode) examCoverMeta.push({ label: 'Exam Code', value: metadata.examCode });
  if (metadata?.examDate) examCoverMeta.push({ label: 'Exam Date', value: metadata.examDate });
  examCoverMeta.push(
    { label: 'Date Generated', value: generatedDate },
    { label: 'Total Students', value: String(stats.total) },
    { label: 'Passing Threshold', value: `${passingThreshold}%` },
    { label: 'Class Average', value: `${stats.avgPercentage}%` },
    { label: 'Pass Rate', value: `${stats.passRate}%` },
  );
  drawCoverPage(doc, examTitle, 'Exam Scores Report', examCoverMeta, logoBase64);

  // ── Student Scores Table ──
  doc.addPage();
  drawContentPageHeader(doc, logoBase64);
  let y = drawSectionHeading(doc, MARGIN_TOP + 5, 'Student Scores');

  const columns: TableColumn[] = [
    { header: '#', width: 10, align: 'center' },
    { header: 'Student ID', width: 30 },
    { header: 'Student Name', width: 50 },
    { header: 'Score', width: 22, align: 'center' },
    { header: '%', width: 16, align: 'right' },
    { header: 'Grade', width: 16, align: 'center' },
    { header: 'Date', width: CONTENT_WIDTH - 10 - 30 - 50 - 22 - 16 - 16 },
  ];

  const tableRows = rows.map((r, i) => [
    String(i + 1),
    r.studentId,
    r.studentName,
    `${r.score}/${r.totalQuestions}`,
    `${r.percentage}%`,
    r.grade,
    r.date,
  ]);

  y = drawDataTable(doc, y, columns, tableRows, {
    highlightFn: (row) => {
      const pct = parseInt(row[4]);
      if (!isNaN(pct) && pct < passingThreshold) return RED_50;
      return null;
    },
  });

  // ── Statistics Summary ──
  y += 8;
  y = checkPageBreak(doc, y, 70);
  y = drawSectionHeading(doc, y, 'Statistics Summary');

  y = drawStatLine(doc, y, 'Total Students', String(stats.total));
  y = drawStatLine(doc, y, 'Passed', `${stats.passCount}  (${stats.passRate}%)`);
  y = drawStatLine(doc, y, 'Failed', `${stats.failCount}  (${stats.failRate}%)`);
  y = drawStatLine(doc, y, 'Class Average', `${stats.avgPercentage}%`);
  y = drawStatLine(doc, y, 'Highest Score', `${stats.highestPercentage}%`);
  y = drawStatLine(doc, y, 'Lowest Score', `${stats.lowestPercentage}%`);
  y = drawStatLine(doc, y, 'Median Score', `${stats.medianPercentage}%`);
  y = drawStatLine(doc, y, 'Passing Threshold', `${passingThreshold}%`);

  // Pass/fail visual mini-bar
  y += 4;
  y = checkPageBreak(doc, y, 14);
  const passBarWidth = (stats.passRate / 100) * (CONTENT_WIDTH - 8);
  const failBarWidth = CONTENT_WIDTH - 8 - passBarWidth;
  if (passBarWidth > 0) drawFilledRect(doc, MARGIN_LEFT + 4, y, passBarWidth, 8, [34, 197, 94]);
  if (failBarWidth > 0) drawFilledRect(doc, MARGIN_LEFT + 4 + passBarWidth, y, failBarWidth, 8, [239, 68, 68]);
  // Labels on bar
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  if (passBarWidth > 20) {
    doc.setTextColor(...WHITE);
    doc.text(`Pass ${stats.passRate}%`, MARGIN_LEFT + 6, y + 5.5);
  }
  if (failBarWidth > 20) {
    doc.setTextColor(...WHITE);
    doc.text(`Fail ${stats.failRate}%`, MARGIN_LEFT + 6 + passBarWidth, y + 5.5);
  }
  doc.setTextColor(0);
  y += 16;

  // ── Grade Distribution ──
  y = checkPageBreak(doc, y, 70);
  y = drawSectionHeading(doc, y, 'Grade Distribution');
  y = drawGradeDistribution(doc, y, rows);

  // ── Page numbers ──
  addAllFooters(doc);

  // ── Save ──
  const safeTitle = examTitle.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_');
  doc.save(`${safeTitle}_report.pdf`);
}

/**
 * Generate a professional PDF report for class results.
 *
 * Includes: cover page, results table, stats, grade distribution, page numbers.
 */
export async function generateClassResultsPdf(
  className: string,
  examTitle: string,
  rows: PdfStudentRow[],
  passingThreshold: number,
  metadata?: ExportMetadata,
): Promise<void> {
  const logoBase64 = await loadGCLogoBase64();
  const doc = new jsPDF('p', 'mm', 'a4');
  const generatedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Stats
  const percentages = rows.map((r) => r.percentage);
  const avg = percentages.length > 0 ? Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length) : 0;
  const passCount = percentages.filter((p) => p >= passingThreshold).length;
  const failCount = percentages.length - passCount;
  const highest = percentages.length > 0 ? Math.max(...percentages) : 0;
  const lowest = percentages.length > 0 ? Math.min(...percentages) : 0;
  const sorted = [...percentages].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length === 0 ? 0 : sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  const passRate = percentages.length > 0 ? Math.round((passCount / percentages.length) * 100) : 0;
  const failRate = 100 - passRate;

  // ── Cover ──
  const classCoverMeta: { label: string; value: string }[] = [
    { label: 'Class', value: className },
    { label: 'Exam', value: examTitle },
  ];
  if (metadata?.instructorName) classCoverMeta.push({ label: 'Instructor', value: metadata.instructorName });
  if (metadata?.subject) classCoverMeta.push({ label: 'Subject', value: metadata.subject });
  if (metadata?.section) classCoverMeta.push({ label: 'Section', value: metadata.section });
  if (metadata?.numItems) classCoverMeta.push({ label: 'No. of Items', value: String(metadata.numItems) });
  if (metadata?.choicesPerItem) classCoverMeta.push({ label: 'Choices per Item', value: String(metadata.choicesPerItem) });
  if (metadata?.examCode) classCoverMeta.push({ label: 'Exam Code', value: metadata.examCode });
  if (metadata?.examDate) classCoverMeta.push({ label: 'Exam Date', value: metadata.examDate });
  classCoverMeta.push(
    { label: 'Date Generated', value: generatedDate },
    { label: 'Total Students', value: String(rows.length) },
    { label: 'Class Average', value: `${avg}%` },
    { label: 'Pass Rate', value: `${passRate}%` },
  );
  drawCoverPage(doc, `${className}`, `${examTitle} — Class Results Report`, classCoverMeta, logoBase64);

  // ── Student Results table ──
  doc.addPage();
  drawContentPageHeader(doc, logoBase64);
  let y = drawSectionHeading(doc, MARGIN_TOP + 5, 'Student Results');

  const cols: TableColumn[] = [
    { header: '#', width: 10, align: 'center' },
    { header: 'Student ID', width: 30 },
    { header: 'Student Name', width: 50 },
    { header: 'Score', width: 22, align: 'center' },
    { header: '%', width: 16, align: 'right' },
    { header: 'Grade', width: 16, align: 'center' },
    { header: 'Date', width: CONTENT_WIDTH - 10 - 30 - 50 - 22 - 16 - 16 },
  ];

  const tRows = rows.map((r, i) => [
    String(i + 1),
    r.studentId,
    r.studentName,
    `${r.score}/${r.totalQuestions}`,
    `${r.percentage}%`,
    r.grade,
    r.date,
  ]);

  y = drawDataTable(doc, y, cols, tRows, {
    highlightFn: (row) => {
      const pct = parseInt(row[4]);
      if (!isNaN(pct) && pct < passingThreshold) return RED_50;
      return null;
    },
  });

  // ── Statistics ──
  y += 8;
  y = checkPageBreak(doc, y, 80);
  y = drawSectionHeading(doc, y, 'Statistics Summary');

  y = drawStatLine(doc, y, 'Total Students', String(rows.length));
  y = drawStatLine(doc, y, 'Passed', `${passCount}  (${passRate}%)`);
  y = drawStatLine(doc, y, 'Failed', `${failCount}  (${failRate}%)`);
  y = drawStatLine(doc, y, 'Class Average', `${avg}%`);
  y = drawStatLine(doc, y, 'Highest Score', `${highest}%`);
  y = drawStatLine(doc, y, 'Lowest Score', `${lowest}%`);
  y = drawStatLine(doc, y, 'Median Score', `${median}%`);
  y = drawStatLine(doc, y, 'Passing Threshold', `${passingThreshold}%`);

  // ── Grade Distribution ──
  y += 8;
  y = checkPageBreak(doc, y, 70);
  y = drawSectionHeading(doc, y, 'Grade Distribution');
  drawGradeDistribution(doc, y, rows);

  // ── Footers ──
  addAllFooters(doc);

  const safeName = `${className}_${examTitle}`.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_');
  doc.save(`${safeName}_report.pdf`);
}

/**
 * Generate a class results PDF and return the raw ArrayBuffer (for batch/zip export).
 * Same content as generateClassResultsPdf but does NOT trigger a browser download.
 */
export async function generateClassResultsPdfBuffer(
  className: string,
  examTitle: string,
  rows: PdfStudentRow[],
  passingThreshold: number,
  metadata?: ExportMetadata,
): Promise<ArrayBuffer> {
  const logoBase64 = await loadGCLogoBase64();
  const doc = new jsPDF('p', 'mm', 'a4');
  const generatedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const percentages = rows.map((r) => r.percentage);
  const avg = percentages.length > 0 ? Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length) : 0;
  const passCount = percentages.filter((p) => p >= passingThreshold).length;
  const failCount = percentages.length - passCount;
  const highest = percentages.length > 0 ? Math.max(...percentages) : 0;
  const lowest = percentages.length > 0 ? Math.min(...percentages) : 0;
  const sorted = [...percentages].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length === 0 ? 0 : sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  const passRate = percentages.length > 0 ? Math.round((passCount / percentages.length) * 100) : 0;
  const failRate = 100 - passRate;

  const classCoverMeta: { label: string; value: string }[] = [
    { label: 'Class', value: className },
    { label: 'Exam', value: examTitle },
  ];
  if (metadata?.instructorName) classCoverMeta.push({ label: 'Instructor', value: metadata.instructorName });
  if (metadata?.subject) classCoverMeta.push({ label: 'Subject', value: metadata.subject });
  if (metadata?.section) classCoverMeta.push({ label: 'Section', value: metadata.section });
  if (metadata?.numItems) classCoverMeta.push({ label: 'No. of Items', value: String(metadata.numItems) });
  if (metadata?.choicesPerItem) classCoverMeta.push({ label: 'Choices per Item', value: String(metadata.choicesPerItem) });
  if (metadata?.examCode) classCoverMeta.push({ label: 'Exam Code', value: metadata.examCode });
  if (metadata?.examDate) classCoverMeta.push({ label: 'Exam Date', value: metadata.examDate });
  classCoverMeta.push(
    { label: 'Date Generated', value: generatedDate },
    { label: 'Total Students', value: String(rows.length) },
    { label: 'Class Average', value: `${avg}%` },
    { label: 'Pass Rate', value: `${passRate}%` },
  );
  drawCoverPage(doc, className, `${examTitle} — Class Results Report`, classCoverMeta, logoBase64);

  doc.addPage();
  drawContentPageHeader(doc, logoBase64);
  let y = drawSectionHeading(doc, MARGIN_TOP + 5, 'Student Results');
  const cols: TableColumn[] = [
    { header: '#', width: 10, align: 'center' },
    { header: 'Student ID', width: 30 },
    { header: 'Student Name', width: 50 },
    { header: 'Score', width: 22, align: 'center' },
    { header: '%', width: 16, align: 'right' },
    { header: 'Grade', width: 16, align: 'center' },
    { header: 'Date', width: CONTENT_WIDTH - 10 - 30 - 50 - 22 - 16 - 16 },
  ];
  const tRows = rows.map((r, i) => [
    String(i + 1), r.studentId, r.studentName,
    `${r.score}/${r.totalQuestions}`, `${r.percentage}%`, r.grade, r.date,
  ]);
  y = drawDataTable(doc, y, cols, tRows, {
    highlightFn: (row) => { const pct = parseInt(row[4]); return (!isNaN(pct) && pct < passingThreshold) ? RED_50 : null; },
  });

  y += 8;
  y = checkPageBreak(doc, y, 80);
  y = drawSectionHeading(doc, y, 'Statistics Summary');
  y = drawStatLine(doc, y, 'Total Students', String(rows.length));
  y = drawStatLine(doc, y, 'Passed', `${passCount}  (${passRate}%)`);
  y = drawStatLine(doc, y, 'Failed', `${failCount}  (${failRate}%)`);
  y = drawStatLine(doc, y, 'Class Average', `${avg}%`);
  y = drawStatLine(doc, y, 'Highest Score', `${highest}%`);
  y = drawStatLine(doc, y, 'Lowest Score', `${lowest}%`);
  y = drawStatLine(doc, y, 'Median Score', `${median}%`);
  y = drawStatLine(doc, y, 'Passing Threshold', `${passingThreshold}%`);

  y += 8;
  y = checkPageBreak(doc, y, 70);
  y = drawSectionHeading(doc, y, 'Grade Distribution');
  drawGradeDistribution(doc, y, rows);

  addAllFooters(doc);
  return doc.output('arraybuffer');
}

/**
 * Generate a professional PDF summary of multiple classes.
 *
 * Includes: cover page, class comparison table, per-class stats, page numbers.
 */
export async function generateClassSummaryPdf(
  classes: PdfClassSummaryRow[],
  institutionName?: string,
  metadata?: ExportMetadata,
): Promise<void> {
  const logoBase64 = await loadGCLogoBase64();
  const doc = new jsPDF('p', 'mm', 'a4');
  const generatedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const totalStudents = classes.reduce((s, c) => s + c.totalStudents, 0);
  const totalScanned = classes.reduce((s, c) => s + c.scannedCount, 0);
  const overallAvg =
    classes.length > 0
      ? Math.round(classes.reduce((s, c) => s + c.averageScore, 0) / classes.length)
      : 0;

  // ── Cover ──
  const summaryCoverMeta: { label: string; value: string }[] = [
    { label: 'Report Type', value: 'Class Summary' },
  ];
  if (metadata?.instructorName) summaryCoverMeta.push({ label: 'Instructor', value: metadata.instructorName });
  summaryCoverMeta.push(
    { label: 'Date Generated', value: generatedDate },
    { label: 'Total Classes', value: String(classes.length) },
    { label: 'Total Students', value: String(totalStudents) },
    { label: 'Total Scanned', value: String(totalScanned) },
    { label: 'Overall Average', value: `${overallAvg}%` },
  );
  drawCoverPage(doc, institutionName || 'Class Summary Report', 'Overview of All Classes', summaryCoverMeta, logoBase64);

  // ── Class Comparison Table ──
  doc.addPage();
  drawContentPageHeader(doc, logoBase64);
  let y = drawSectionHeading(doc, MARGIN_TOP + 5, 'Class Comparison');

  const cols: TableColumn[] = [
    { header: '#', width: 10, align: 'center' },
    { header: 'Class Name', width: 50 },
    { header: 'Schedule', width: 40 },
    { header: 'Students', width: 22, align: 'center' },
    { header: 'Scanned', width: 22, align: 'center' },
    { header: 'Avg Score', width: CONTENT_WIDTH - 10 - 50 - 40 - 22 - 22, align: 'right' },
  ];

  const tRows = classes.map((c, i) => [
    String(i + 1),
    c.className,
    c.schedule,
    String(c.totalStudents),
    String(c.scannedCount),
    `${c.averageScore}%`,
  ]);

  y = drawDataTable(doc, y, cols, tRows, {
    highlightFn: (row) => {
      const avg = parseFloat(row[5]);
      if (!isNaN(avg) && avg >= 80) return GREEN_50;
      if (!isNaN(avg) && avg < 60) return RED_50;
      return null;
    },
  });

  // ── Summary Statistics ──
  y += 10;
  y = checkPageBreak(doc, y, 50);
  y = drawSectionHeading(doc, y, 'Summary Statistics');

  y = drawStatLine(doc, y, 'Total Classes', String(classes.length));
  y = drawStatLine(doc, y, 'Total Students', String(totalStudents));
  y = drawStatLine(doc, y, 'Total Scanned', String(totalScanned));
  y = drawStatLine(doc, y, 'Overall Average', `${overallAvg}%`);
  if (classes.length > 0) {
    const best = classes.reduce((max, c) => (c.averageScore > max.averageScore ? c : max));
    const worst = classes.reduce((min, c) => (c.averageScore < min.averageScore ? c : min));
    y = drawStatLine(doc, y, 'Highest Avg Class', `${best.className} (${best.averageScore}%)`);
    y = drawStatLine(doc, y, 'Lowest Avg Class', `${worst.className} (${worst.averageScore}%)`);
  }

  // ── Footers ──
  addAllFooters(doc);
  doc.save('class_summary_report.pdf');
}
