/**
 * Data Quality Service
 * Detects and flags duplicates and inconsistent data
 * Provides feedback for data quality issues
 * Logs all quality check actions for audit trail
 */

import { ValidationActionLogger } from './validationActionLogger';

// Reference lists for valid values
export const VALID_GRADES = ['1', '2', '3', '4', '5', '6', 'A', 'B', 'C', 'D', 'E', 'F'];
export const VALID_SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
export const VALID_BLOCKS = ['STEM', 'HUMSS', 'ABM', 'GA', 'TVL', 'SPORTS', 'ARTS',
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

export interface DuplicateEntry {
  type: 'student_id' | 'name_combination' | 'email';
  value: string;
  rowIndices: number[];
  records: any[];
  severity: 'high' | 'medium' | 'low';
  message: string;
}

export interface InconsistencyEntry {
  rowIndex: number;
  field: string;
  value: any;
  severity: 'high' | 'medium' | 'low';
  issue: string;
  suggestion?: string;
}

export interface DataQualityResult {
  isClean: boolean;
  duplicates: DuplicateEntry[];
  inconsistencies: InconsistencyEntry[];
  warnings: string[];
  totalIssues: number;
  summary: {
    duplicateCount: number;
    inconsistencyCount: number;
    highSeverityCount: number;
    mediumSeverityCount: number;
    lowSeverityCount: number;
  };
}

export interface StudentRecord {
  rowIndex?: number;
  student_id?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  year?: string;
  grade?: string;
  section?: string;
  block?: string;
  [key: string]: any;
}

export class DataQualityService {
  /**
   * Check entire batch for duplicates and inconsistencies with logging
   */
  static async checkDataQualityWithLogging(
    records: StudentRecord[],
    adminId: string,
    adminEmail: string
  ): Promise<DataQualityResult> {
    const result = this.checkDataQuality(records);

    // Log the quality check
    await ValidationActionLogger.logQualityCheck(
      adminId,
      adminEmail,
      records.length,
      {
        duplicates: result.summary.duplicateCount,
        inconsistencies: result.summary.inconsistencyCount,
        typos: 0, // Calculated separately if needed
        total: result.totalIssues,
      },
      result.isClean
    );

    // Log duplicate detection if duplicates found
    if (result.duplicates.length > 0) {
      const studentIdDupes = result.duplicates
        .filter((d) => d.type === 'student_id')
        .map((d) => d.value);
      const nameDupes = result.duplicates
        .filter((d) => d.type === 'name_combination')
        .map((d) => d.value);
      const emailDupes = result.duplicates
        .filter((d) => d.type === 'email')
        .map((d) => d.value);

      await ValidationActionLogger.logDuplicateDetection(
        adminId,
        adminEmail,
        {
          studentIdDuplicates: studentIdDupes,
          nameDuplicates: nameDupes,
          emailDuplicates: emailDupes,
          total: result.duplicates.length,
        }
      );
    }

    return result;
  }

  /**
   * Check entire batch for duplicates and inconsistencies
   */
  static checkDataQuality(records: StudentRecord[]): DataQualityResult {
    const duplicates: DuplicateEntry[] = [];
    const inconsistencies: InconsistencyEntry[] = [];
    const warnings: string[] = [];

    // Check for duplicates
    const duplicateChecks = this.detectDuplicates(records);
    duplicates.push(...duplicateChecks);

    // Check for inconsistencies
    records.forEach((record, index) => {
      const recordInconsistencies = this.checkRecordInconsistencies(record, index, records);
      inconsistencies.push(...recordInconsistencies);
    });

    // Calculate summary
    const highSeverity = [
      ...duplicates.filter(d => d.severity === 'high'),
      ...inconsistencies.filter(i => i.severity === 'high'),
    ].length;

    const mediumSeverity = [
      ...duplicates.filter(d => d.severity === 'medium'),
      ...inconsistencies.filter(i => i.severity === 'medium'),
    ].length;

    const lowSeverity = [
      ...duplicates.filter(d => d.severity === 'low'),
      ...inconsistencies.filter(i => i.severity === 'low'),
    ].length;

    return {
      isClean: duplicates.length === 0 && inconsistencies.length === 0,
      duplicates,
      inconsistencies,
      warnings,
      totalIssues: duplicates.length + inconsistencies.length,
      summary: {
        duplicateCount: duplicates.length,
        inconsistencyCount: inconsistencies.length,
        highSeverityCount: highSeverity,
        mediumSeverityCount: mediumSeverity,
        lowSeverityCount: lowSeverity,
      },
    };
  }

  /**
   * Detect various types of duplicates
   */
  private static detectDuplicates(records: StudentRecord[]): DuplicateEntry[] {
    const duplicates: DuplicateEntry[] = [];
    const studentIdMap = new Map<string, number[]>();
    const nameMap = new Map<string, number[]>();
    const emailMap = new Map<string, number[]>();

    // Build maps of duplicates
    records.forEach((record, index) => {
      // Student ID duplicates
      if (record.student_id && record.student_id.trim()) {
        const id = record.student_id.trim().toLowerCase();
        if (!studentIdMap.has(id)) {
          studentIdMap.set(id, []);
        }
        studentIdMap.get(id)!.push(index);
      }

      // Name combination duplicates
      if (record.first_name && record.last_name) {
        const nameKey = `${record.first_name.trim().toLowerCase()} ${record.last_name.trim().toLowerCase()}`;
        if (!nameMap.has(nameKey)) {
          nameMap.set(nameKey, []);
        }
        nameMap.get(nameKey)!.push(index);
      }

      // Email duplicates
      if (record.email && record.email.trim()) {
        const email = record.email.trim().toLowerCase();
        if (!emailMap.has(email)) {
          emailMap.set(email, []);
        }
        emailMap.get(email)!.push(index);
      }
    });

    // Process Student ID duplicates
    studentIdMap.forEach((indices, id) => {
      if (indices.length > 1) {
        const recordsWithDuplicate = indices.map(idx => records[idx]);
        duplicates.push({
          type: 'student_id',
          value: id,
          rowIndices: indices,
          records: recordsWithDuplicate,
          severity: 'high',
          message: `Student ID "${id}" appears ${indices.length} times (rows ${indices.map(i => i + 1).join(', ')})`,
        });
      }
    });

    // Process Name duplicates
    nameMap.forEach((indices, name) => {
      if (indices.length > 1) {
        const recordsWithDuplicate = indices.map(idx => records[idx]);
        // Check if they have different IDs (potential duplicate)
        const ids = new Set(recordsWithDuplicate.map(r => r.student_id));
        if (ids.size > 1 || ids.has(undefined)) {
          duplicates.push({
            type: 'name_combination',
            value: name,
            rowIndices: indices,
            records: recordsWithDuplicate,
            severity: 'medium',
            message: `Name "${name}" appears ${indices.length} times with different or missing IDs (rows ${indices.map(i => i + 1).join(', ')})`,
          });
        }
      }
    });

    // Process Email duplicates
    emailMap.forEach((indices, email) => {
      if (indices.length > 1) {
        const recordsWithDuplicate = indices.map(idx => records[idx]);
        duplicates.push({
          type: 'email',
          value: email,
          rowIndices: indices,
          records: recordsWithDuplicate,
          severity: 'medium',
          message: `Email "${email}" appears ${indices.length} times (rows ${indices.map(i => i + 1).join(', ')})`,
        });
      }
    });

    return duplicates;
  }

  /**
   * Check a single record for inconsistencies
   */
  private static checkRecordInconsistencies(
    record: StudentRecord,
    rowIndex: number,
    allRecords: StudentRecord[]
  ): InconsistencyEntry[] {
    const inconsistencies: InconsistencyEntry[] = [];

    // Check grade validity
    if (record.grade && record.grade.trim()) {
      const grade = record.grade.trim().toUpperCase();
      if (!VALID_GRADES.includes(grade)) {
        inconsistencies.push({
          rowIndex,
          field: 'grade',
          value: record.grade,
          severity: 'high',
          issue: `Invalid grade "${record.grade}". Valid grades are: ${VALID_GRADES.join(', ')}`,
          suggestion: this.suggestGrade(grade),
        });
      }
    }

    // Check section validity
    if (record.section && record.section.trim()) {
      const section = record.section.trim().toUpperCase();
      if (!VALID_SECTIONS.includes(section)) {
        inconsistencies.push({
          rowIndex,
          field: 'section',
          value: record.section,
          severity: 'medium',
          issue: `Invalid section "${record.section}". Valid sections are: ${VALID_SECTIONS.join(', ')}`,
          suggestion: this.suggestSection(section),
        });
      }
    }

    // Check block validity
    if (record.block && record.block.trim()) {
      const block = record.block.trim().toUpperCase();
      if (!VALID_BLOCKS.includes(block)) {
        inconsistencies.push({
          rowIndex,
          field: 'block',
          value: record.block,
          severity: 'medium',
          issue: `Invalid block "${record.block}". Valid blocks are: ${VALID_BLOCKS.join(', ')}`,
          suggestion: this.suggestBlock(block),
        });
      }
    }

    // Check email format
    if (record.email && record.email.trim()) {
      if (!this.isValidEmailFormat(record.email)) {
        inconsistencies.push({
          rowIndex,
          field: 'email',
          value: record.email,
          severity: 'low',
          issue: `Email format appears invalid: "${record.email}"`,
        });
      }
    }

    // Check year is numeric
    if (record.year && record.year.trim()) {
      if (!/^\d+$/.test(record.year.trim())) {
        inconsistencies.push({
          rowIndex,
          field: 'year',
          value: record.year,
          severity: 'low',
          issue: `Year should be numeric, got "${record.year}"`,
        });
      }
    }

    // Check for suspiciously similar names (potential typos)
    const similarNames = this.findSimilarNames(record, allRecords, rowIndex);
    if (similarNames.length > 0) {
      inconsistencies.push({
        rowIndex,
        field: 'name',
        value: `${record.first_name} ${record.last_name}`,
        severity: 'low',
        issue: `Name is similar to: ${similarNames.join(', ')}. Possible typo or duplicate?`,
      });
    }

    return inconsistencies;
  }

  /**
   * Find similar names (potential typos or duplicates)
   */
  private static findSimilarNames(
    record: StudentRecord,
    allRecords: StudentRecord[],
    currentIndex: number
  ): string[] {
    if (!record.first_name || !record.last_name) return [];

    const similar: string[] = [];
    const currentName = `${record.first_name.toLowerCase()} ${record.last_name.toLowerCase()}`;

    allRecords.forEach((other, idx) => {
      if (idx === currentIndex || !other.first_name || !other.last_name) return;

      const otherName = `${other.first_name.toLowerCase()} ${other.last_name.toLowerCase()}`;
      const distance = this.levenshteinDistance(currentName, otherName);

      // If distance is 1-2, likely similar
      if (distance > 0 && distance <= 2) {
        similar.push(`${other.first_name} ${other.last_name} (row ${idx + 1})`);
      }
    });

    return similar;
  }

  /**
   * Calculate Levenshtein distance (edit distance between strings)
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Suggest a valid grade based on input
   */
  private static suggestGrade(input: string): string | undefined {
    const grades = VALID_GRADES;
    for (const grade of grades) {
      if (grade.toLowerCase() === input.toLowerCase()) {
        return grade;
      }
    }
    return undefined;
  }

  /**
   * Suggest a valid section based on input
   */
  private static suggestSection(input: string): string | undefined {
    const sections = VALID_SECTIONS;
    for (const section of sections) {
      if (section.toLowerCase() === input.toLowerCase()) {
        return section;
      }
    }
    return undefined;
  }

  /**
   * Suggest a valid block based on input
   */
  private static suggestBlock(input: string): string | undefined {
    const blocks = VALID_BLOCKS;
    for (const block of blocks) {
      if (block.toLowerCase() === input.toLowerCase()) {
        return block;
      }
    }
    return undefined;
  }

  /**
   * Check email format
   */
  private static isValidEmailFormat(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Get quality summary for display
   */
  static getQualitySummary(result: DataQualityResult): string {
    if (result.isClean) {
      return '✓ All data is clean and consistent';
    }

    const parts: string[] = [];
    if (result.summary.duplicateCount > 0) {
      parts.push(`${result.summary.duplicateCount} duplicate issue(s)`);
    }
    if (result.summary.inconsistencyCount > 0) {
      parts.push(`${result.summary.inconsistencyCount} inconsistency/ies`);
    }

    if (result.summary.highSeverityCount > 0) {
      parts.push(`${result.summary.highSeverityCount} high severity`);
    }

    return parts.join(' | ');
  }

  /**
   * Get recommended action based on quality result
   */
  static getRecommendedAction(result: DataQualityResult): 'block' | 'warn' | 'allow' {
    const highSeverityCount = result.summary.highSeverityCount;

    if (highSeverityCount > 0) {
      return 'block'; // Block import if high severity issues exist
    } else if (result.summary.mediumSeverityCount > 0) {
      return 'warn'; // Warn but allow override
    }

    return 'allow'; // No issues, allow
  }
}
