/**
 * Student ID Generation and Management Service
 * Handles auto-assignment of temporary IDs and conflict resolution
 */

import { collection, getDocs, query, where, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface StudentIDConfig {
  format: 'NUMERIC' | 'ALPHANUMERIC' | 'YEARLY_SEQUENCE'; // 2026-0001
  prefix?: string; // e.g., 'STU', 'SID'
  length: number; // Total length of ID
  startFrom?: number; // Starting number (default: 1)
}

export interface StudentIDResult {
  success: boolean;
  ids?: string[];
  conflicts?: Array<{ studentId: string; existingName?: string }>;
  error?: string;
}

export class StudentIDService {
  /**
   * Generate temporary IDs for students
   * Format: 2026-0001, 2026-0002, etc.
   */
  static generateTemporaryIDs(
    count: number,
    config: StudentIDConfig = {
      format: 'YEARLY_SEQUENCE',
      length: 4,
      startFrom: 1,
    }
  ): string[] {
    const ids: string[] = [];
    const start = config.startFrom || 1;
    const currentYear = new Date().getFullYear();

    for (let i = 0; i < count; i++) {
      const num = start + i;
      let id: string;

      if (config.format === 'YEARLY_SEQUENCE') {
        const numStr = String(num).padStart(4, '0');
        id = `${currentYear}-${numStr}`;
      } else if (config.format === 'ALPHANUMERIC' && config.prefix) {
        // Format: STU00001, STU00002, etc.
        const numStr = String(num).padStart(config.length - config.prefix.length, '0');
        id = `${config.prefix}${numStr}`;
      } else {
        // Format: 00001, 00002, etc. (numeric only)
        id = String(num).padStart(config.length, '0');
      }

      ids.push(id);
    }

    return ids;
  }

  /**
   * Check for existing student IDs in database to avoid conflicts
   */
  static async checkForConflicts(studentIds: string[]): Promise<string[]> {
    try {
      const normalizedIds = studentIds.map((id) => id.trim()).filter(Boolean);
      if (normalizedIds.length === 0) return [];

      const [studentsSnapshot, classesSnapshot, rostersSnapshot] = await Promise.all([
        getDocs(collection(db, 'students')),
        getDocs(collection(db, 'classes')),
        getDocs(collection(db, 'studentRosters')),
      ]);

      const existingIds = new Set<string>();

      studentsSnapshot.forEach((studentDoc) => {
        existingIds.add(studentDoc.id);
      });

      classesSnapshot.forEach((classDoc) => {
        const classData = classDoc.data();
        if (!Array.isArray(classData.students)) return;
        classData.students.forEach((student: any) => {
          if (student?.student_id && typeof student.student_id === 'string') {
            existingIds.add(student.student_id.trim());
          }
        });
      });

      rostersSnapshot.forEach((rosterDoc) => {
        const rosterData = rosterDoc.data();
        if (!Array.isArray(rosterData.studentIds)) return;
        rosterData.studentIds.forEach((studentId: string) => {
          if (studentId && typeof studentId === 'string') {
            existingIds.add(studentId.trim());
          }
        });
      });

      return normalizedIds.filter((id) => existingIds.has(id));
    } catch (error) {
      console.error('Error checking for conflicts:', error);
      return [];
    }
  }

  /**
   * Auto-assign IDs to students without IDs
   */
  static async autoAssignIDs(
    students: Array<{ student_id: string; first_name: string; last_name: string; email?: string }>,
    config?: StudentIDConfig
  ): Promise<StudentIDResult> {
    try {
      const studentsNeedingIds = students.filter((s) => !s.student_id || s.student_id.trim() === '');

      if (studentsNeedingIds.length === 0) {
        return {
          success: true,
          ids: [],
          conflicts: [],
        };
      }

      // Get the next available ID number
      const nextNum = await this.getNextAvailableIDNumber();
      const defaultConfig: StudentIDConfig = {
        format: 'YEARLY_SEQUENCE',
        length: 4,
        startFrom: nextNum,
      };

      const mergedConfig = { ...defaultConfig, ...config };
      const maxPossible = (mergedConfig.startFrom || 1) + studentsNeedingIds.length - 1;
      if (mergedConfig.format === 'YEARLY_SEQUENCE' && maxPossible > 9999) {
        return {
          success: false,
          error: 'Yearly ID limit reached (maximum is YYYY-9999).',
        };
      }

      // Generate new IDs
      const newIds = this.generateTemporaryIDs(studentsNeedingIds.length, mergedConfig);

      // Check for conflicts
      const conflicts = await this.checkForConflicts(newIds);

      if (conflicts.length > 0) {
        return {
          success: false,
          ids: newIds,
          conflicts: conflicts.map((id) => ({ studentId: id })),
          error: `Found ${conflicts.length} conflicting ID(s). Please review.`,
        };
      }

      return {
        success: true,
        ids: newIds,
        conflicts: [],
      };
    } catch (error) {
      console.error('Error auto-assigning IDs:', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Get the next available ID number by scanning existing records
   */
  private static async getNextAvailableIDNumber(): Promise<number> {
    try {
      let maxNum = 0;
      const currentYear = new Date().getFullYear();

      // Check students collection (source of truth)
      const studentsSnapshot = await getDocs(collection(db, 'students'));
      studentsSnapshot.forEach((studentDoc) => {
        const num = this.extractNumberFromID(studentDoc.id, currentYear);
        if (num > maxNum) maxNum = num;
      });

      // Check classes collection
      const classesSnapshot = await getDocs(collection(db, 'classes'));
      classesSnapshot.forEach((classDoc) => {
        const classData = classDoc.data();
        if (classData.students && Array.isArray(classData.students)) {
          classData.students.forEach((student: any) => {
            const num = this.extractNumberFromID(student.student_id, currentYear);
            if (num > maxNum) maxNum = num;
          });
        }
      });

      // Check student rosters collection
      const rostersSnapshot = await getDocs(collection(db, 'studentRosters'));
      rostersSnapshot.forEach((rosterDoc) => {
        const rosterData = rosterDoc.data();
        if (rosterData.studentIds && Array.isArray(rosterData.studentIds)) {
          rosterData.studentIds.forEach((studentId: string) => {
            const num = this.extractNumberFromID(studentId, currentYear);
            if (num > maxNum) maxNum = num;
          });
        }
      });

      return maxNum + 1;
    } catch (error) {
      console.error('Error getting next available ID number:', error);
      return 1; // Default to 1 if error
    }
  }

  /**
   * Extract numeric part from student ID
   * e.g., "2026-0042" -> 42
   */
  private static extractNumberFromID(studentId: string, year?: number): number {
    if (year) {
      const yearlyMatch = studentId.match(new RegExp(`^${year}-(\\d{4})$`));
      if (yearlyMatch) {
        return parseInt(yearlyMatch[1], 10);
      }
      return 0;
    }

    const numMatch = studentId.match(/\d+$/);
    if (numMatch) {
      return parseInt(numMatch[0], 10);
    }
    return 0;
  }

  /**
   * Update existing student records with auto-assigned IDs
   */
  static async updateStudentsWithIDs(
    classId: string,
    students: Array<{ index: number; student_id: string }>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const classRef = doc(db, 'classes', classId);
      const classDoc = await getDocs(query(collection(db, 'classes'), where('id', '==', classId)));

      if (classDoc.empty) {
        return { success: false, error: 'Class not found' };
      }

      const classData = classDoc.docs[0].data();
      const updatedStudents = [...(classData.students || [])];

      // Update each student with their assigned ID
      students.forEach(({ index, student_id }) => {
        if (updatedStudents[index]) {
          updatedStudents[index].student_id = student_id;
        }
      });

      await updateDoc(classRef, { students: updatedStudents });

      return { success: true };
    } catch (error) {
      console.error('Error updating students with IDs:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Bulk import students and auto-assign IDs if needed
   */
  static async bulkImportStudents(
    students: Array<{ first_name: string; last_name: string; email?: string; student_id?: string }>,
    autoAssignMissingIds: boolean = true,
    config?: StudentIDConfig
  ): Promise<StudentIDResult> {
    try {
      // Prepare students with validated data
      const preparedStudents = students.map((s) => ({
        student_id: s.student_id || '',
        first_name: s.first_name.trim(),
        last_name: s.last_name.trim(),
        email: s.email?.trim() || '',
      }));

      if (!autoAssignMissingIds) {
        return { success: true, ids: [] };
      }

      // Auto-assign IDs for students without them
      return await this.autoAssignIDs(preparedStudents, config);
    } catch (error) {
      console.error('Error bulk importing students:', error);
      return { success: false, error: (error as Error).message };
    }
  }
}
