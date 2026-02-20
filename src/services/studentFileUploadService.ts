/**
 * Student File Upload Service
 * Handles parsing, validation, and preprocessing of CSV/Excel student files
 * Supports .xlsx, .xls, and .csv formats
 */

import * as XLSX from 'xlsx';

export interface ParsedStudent {
  rowIndex: number;
  student_id?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  year?: string;
  section?: string;
  block?: string;
  grade?: string;
  [key: string]: any;
}

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  fileType?: 'csv' | 'xlsx' | 'xls' | 'unknown';
  fileSize?: number;
  maxSize?: number;
}

export interface FileParseResult {
  success: boolean;
  students: ParsedStudent[];
  rowCount: number;
  error?: string;
  warnings?: string[];
}

export const SUPPORTED_FILE_TYPES = ['.csv', '.xlsx', '.xls'];
export const MAX_FILE_SIZE_MB = 10; // 10MB max file size
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export class StudentFileUploadService {
  /**
   * Validate file type and size
   * @param file - File to validate
   * @returns FileValidationResult with validation status
   */
  static validateFile(file: File): FileValidationResult {
    // Check file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return {
        isValid: false,
        error: `File size exceeds ${MAX_FILE_SIZE_MB}MB limit. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB`,
        fileType: 'unknown',
        fileSize: file.size,
        maxSize: MAX_FILE_SIZE_BYTES,
      };
    }

    // Check file type
    const fileName = file.name.toLowerCase();
    const fileExtension = fileName.substring(fileName.lastIndexOf('.'));

    if (!SUPPORTED_FILE_TYPES.includes(fileExtension)) {
      return {
        isValid: false,
        error: `Unsupported file type: ${fileExtension}. Supported types: ${SUPPORTED_FILE_TYPES.join(', ')}`,
        fileType: 'unknown',
        fileSize: file.size,
      };
    }

    const fileType = (fileExtension.replace('.', '') as 'csv' | 'xlsx' | 'xls');

    return {
      isValid: true,
      fileType,
      fileSize: file.size,
    };
  }

  /**
   * Parse Excel file
   * @param data - File data as ArrayBuffer
   * @param fileName - File name for error messages
   * @returns Parsed student records
   */
  private static parseExcel(data: ArrayBuffer, fileName: string): ParsedStudent[] {
    try {
      const workbook = XLSX.read(data, { type: 'array' });
      
      if (workbook.SheetNames.length === 0) {
        throw new Error('Excel file contains no sheets');
      }

      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[];

      if (rows.length === 0) {
        throw new Error('Excel sheet contains no data rows');
      }

      // Map common column names to standard fields
      return rows.map((row, idx) => ({
        rowIndex: idx + 1, // Start from 1 (accounting for header)
        student_id: this.extractValue(row, ['student_id', 'Student ID', 'ID', 'id', 'Student_ID']),
        first_name: this.extractValue(row, ['first_name', 'First Name', 'First', 'first_name', 'FirstName']),
        last_name: this.extractValue(row, ['last_name', 'Last Name', 'Last', 'last_name', 'LastName']),
        email: this.extractValue(row, ['email', 'Email', 'email_address', 'Email Address']),
        year: this.extractValue(row, ['year', 'Year', 'Grade', 'grade', 'Year_Level']),
        section: this.extractValue(row, ['section', 'Section', 'Block', 'block', 'Section_Block']),
        block: this.extractValue(row, ['block', 'Block', 'section', 'Section']),
        grade: this.extractValue(row, ['grade', 'Grade', 'year', 'Year']),
      }));
    } catch (error) {
      console.error(`Failed to parse Excel file ${fileName}:`, error);
      throw new Error(`Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse CSV file
   * @param text - CSV file content as text
   * @param fileName - File name for error messages
   * @returns Parsed student records
   */
  private static parseCSV(text: string, fileName: string): ParsedStudent[] {
    try {
      // Split by newlines and filter empty lines
      const lines = text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      if (lines.length < 2) {
        throw new Error('CSV file must contain header and at least one data row');
      }

      // Parse header
      const headers = lines[0].split(',').map((h) => h.trim());
      
      // Parse data rows
      const rows: ParsedStudent[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map((v) => v.trim());
        const row: Record<string, string> = {};

        headers.forEach((header, idx) => {
          row[header] = values[idx] || '';
        });

        rows.push({
          rowIndex: i,
          student_id: this.extractValue(row, ['student_id', 'Student ID', 'ID', 'id']),
          first_name: this.extractValue(row, ['first_name', 'First Name', 'First']),
          last_name: this.extractValue(row, ['last_name', 'Last Name', 'Last']),
          email: this.extractValue(row, ['email', 'Email']),
          year: this.extractValue(row, ['year', 'Year', 'Grade']),
          section: this.extractValue(row, ['section', 'Section', 'Block']),
          block: this.extractValue(row, ['block', 'Block']),
          grade: this.extractValue(row, ['grade', 'Grade']),
        });
      }

      return rows;
    } catch (error) {
      console.error(`Failed to parse CSV file ${fileName}:`, error);
      throw new Error(`Failed to parse CSV file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract value from row by checking multiple possible column names
   * @param row - Row object
   * @param possibleKeys - Array of possible key names
   * @returns Value if found, empty string otherwise
   */
  private static extractValue(row: Record<string, unknown>, possibleKeys: string[]): string {
    for (const key of possibleKeys) {
      const value = row[key];
      if (value !== undefined && value !== null && value !== '') {
        return String(value).trim();
      }
    }
    return '';
  }

  /**
   * Parse uploaded file (CSV or Excel)
   * @param file - File object to parse
   * @returns FileParseResult with parsed students or error
   */
  static async parseFile(file: File): Promise<FileParseResult> {
    // Validate file first
    const validation = this.validateFile(file);
    if (!validation.isValid) {
      return {
        success: false,
        students: [],
        rowCount: 0,
        error: validation.error,
      };
    }

    try {
      const fileType = validation.fileType as string;

      if (fileType === 'csv') {
        const text = await file.text();
        const students = this.parseCSV(text, file.name);
        return {
          success: true,
          students,
          rowCount: students.length,
        };
      } else if (fileType === 'xlsx' || fileType === 'xls') {
        const arrayBuffer = await file.arrayBuffer();
        const students = this.parseExcel(arrayBuffer, file.name);
        return {
          success: true,
          students,
          rowCount: students.length,
        };
      } else {
        return {
          success: false,
          students: [],
          rowCount: 0,
          error: `Unsupported file type: ${fileType}`,
        };
      }
    } catch (error) {
      console.error('Error parsing file:', error);
      return {
        success: false,
        students: [],
        rowCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error during file parsing',
      };
    }
  }

  /**
   * Generate and download a student template file
   * @param format - File format to generate ('csv' or 'xlsx')
   */
  static downloadTemplate(format: 'csv' | 'xlsx' = 'xlsx'): void {
    const template = [
      {
        student_id: '',
        first_name: 'Juan',
        last_name: 'Dela Cruz',
        email: 'juan.delacruz@example.com',
        year: '10',
        section: 'A',
      },
      {
        student_id: '2026-0001',
        first_name: 'Maria',
        last_name: 'Santos',
        email: 'maria.santos@example.com',
        year: '10',
        section: 'B',
      },
    ];

    if (format === 'csv') {
      const headers = ['student_id', 'first_name', 'last_name', 'email', 'year', 'section'];
      const csvContent = [
        headers.join(','),
        ...template.map((row) =>
          headers.map((header) => `"${row[header as keyof typeof row] || ''}"`).join(',')
        ),
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      this.downloadBlob(blob, 'student_template.csv');
    } else {
      const worksheet = XLSX.utils.json_to_sheet(template);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
      XLSX.writeFile(workbook, 'student_template.xlsx');
    }
  }

  /**
   * Helper to download blob as file
   * @param blob - Blob to download
   * @param fileName - Name of file to download as
   */
  private static downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Get list of supported file types
   */
  static getSupportedTypes(): string {
    return SUPPORTED_FILE_TYPES.join(', ');
  }

  /**
   * Get max file size in MB
   */
  static getMaxFileSizeMB(): number {
    return MAX_FILE_SIZE_MB;
  }

  /**
   * Get file upload requirements as formatted string
   */
  static getRequirements(): string {
    return `Supported formats: ${this.getSupportedTypes()} | Max size: ${this.getMaxFileSizeMB()}MB`;
  }
}
