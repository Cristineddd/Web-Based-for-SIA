/**
 * Gordon College Branding Constants — SS4 2.3
 *
 * Centralised branding configuration used across all PDF and Excel exports.
 * Follows official Gordon College visual identity guidelines.
 */

// ─── Institution ─────────────────────────────────────────────────────────────

export const GC_INSTITUTION_NAME = 'Gordon College';
export const GC_FULL_NAME = 'Gordon College';
export const GC_TAGLINE = 'Excellence in Education';
export const GC_ADDRESS = 'Olongapo City, Zambales, Philippines';
export const GC_SYSTEM_NAME = 'GC SMART CHECK';

// ─── Logo ────────────────────────────────────────────────────────────────────

/** Public path for the GC logo PNG (used in fetch within client-side code) */
export const GC_LOGO_PATH = '/gclogo.png';

/**
 * Fetch the GC logo as a data:image/png;base64 string.
 * Returns empty string on failure so callers can gracefully degrade.
 */
export async function loadGCLogoBase64(): Promise<string> {
  try {
    const primaryUrl =
      typeof window !== 'undefined'
        ? new URL(GC_LOGO_PATH, window.location.origin).toString()
        : GC_LOGO_PATH;
    let response = await fetch(primaryUrl, { cache: 'no-store' });
    if (!response.ok && typeof window !== 'undefined') {
      response = await fetch(GC_LOGO_PATH, { cache: 'no-store' });
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn('[GC Branding] Could not load logo — continuing without it.', err);
    return '';
  }
}

// ─── Official Color Palette ──────────────────────────────────────────────────
// Colours are expressed as [R, G, B] tuples for jsPDF, and as hex strings for CSS/UI.

/** Primary dark green — used for headers, cover bars, primary accent */
export const GC_PRIMARY: [number, number, number] = [26, 71, 42]; // #1a472a
export const GC_PRIMARY_HEX = '#1a472a';

/** Secondary green — hover states, lighter accents */
export const GC_SECONDARY: [number, number, number] = [45, 107, 71]; // #2d6b47
export const GC_SECONDARY_HEX = '#2d6b47';

/** Accent gold — highlights, badges, decorative lines */
export const GC_GOLD: [number, number, number] = [204, 164, 59]; // #cca43b
export const GC_GOLD_HEX = '#cca43b';

/** Light green background tint */
export const GC_GREEN_LIGHT: [number, number, number] = [232, 245, 233]; // #e8f5e9
export const GC_GREEN_LIGHT_HEX = '#e8f5e9';

/** Dark text */
export const GC_TEXT_DARK: [number, number, number] = [33, 37, 41]; // #212529
export const GC_TEXT_DARK_HEX = '#212529';

/** Neutral gray for secondary text */
export const GC_TEXT_MUTED: [number, number, number] = [107, 114, 128]; // #6b7280
export const GC_TEXT_MUTED_HEX = '#6b7280';

/** White */
export const GC_WHITE: [number, number, number] = [255, 255, 255];

// ─── Font Configuration ─────────────────────────────────────────────────────

/** Primary font family — maps to jsPDF built-in Helvetica (closest to Roboto/sans-serif) */
export const GC_FONT_PRIMARY = 'helvetica';

/** Font sizes used across reports (in pt for jsPDF) */
export const GC_FONT_SIZES = {
  coverTitle: 14,
  coverSubtitle: 9,
  sectionHeading: 13,
  body: 9.5,
  tableHeader: 8,
  tableBody: 8,
  footer: 7.5,
  small: 7,
} as const;

// ─── PDF Page Layout ─────────────────────────────────────────────────────────

export const GC_PDF_PAGE = {
  width: 210,   // A4 mm
  height: 297,
  marginLeft: 18,
  marginRight: 18,
  marginTop: 20,
  marginBottom: 22,
  get contentWidth() {
    return this.width - this.marginLeft - this.marginRight;
  },
} as const;

// ─── Excel Branding Header ───────────────────────────────────────────────────

/** Optional metadata for Excel branding headers — mirrors PDF ExportMetadata. */
export interface ExcelExportMetadata {
  instructorName?: string;
  subject?: string;
  section?: string;
  room?: string;
  className?: string;
  examTitle?: string;
  numItems?: number;
  choicesPerItem?: number;
  examDate?: string;
  examCode?: string;
}

/**
 * Rows prepended to every Excel sheet for institutional branding.
 * When metadata is supplied, extra rows are appended before the spacer.
 */
export function getExcelBrandingRows(metadata?: ExcelExportMetadata): (string | number)[][] {
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const rows: (string | number)[][] = [
    [GC_SYSTEM_NAME],
    [`Generated: ${dateStr}`],
  ];
  if (metadata?.instructorName) rows.push([`Instructor: ${metadata.instructorName}`]);
  if (metadata?.subject) rows.push([`Subject: ${metadata.subject}`]);
  if (metadata?.section) rows.push([`Section: ${metadata.section}`]);
  if (metadata?.examCode) rows.push([`Exam Code: ${metadata.examCode}`]);
  // Combine items-related fields on one row when both present
  if (metadata?.numItems && metadata?.choicesPerItem) {
    rows.push([`No. of Items: ${metadata.numItems}  |  Choices per Item: ${metadata.choicesPerItem}`]);
  } else {
    if (metadata?.numItems) rows.push([`No. of Items: ${metadata.numItems}`]);
    if (metadata?.choicesPerItem) rows.push([`Choices per Item: ${metadata.choicesPerItem}`]);
  }
  if (metadata?.examDate) rows.push([`Exam Date: ${metadata.examDate}`]);
  rows.push([]); // blank spacer row
  return rows;
}

/** Default branding row count (without metadata). Use brandingRows.length for dynamic count. */
export const EXCEL_BRANDING_ROW_COUNT = 4;
