/**
 * Grading Service
 * Manages student grades with proper Student ID foreign key relationships
 * Links grades to student records, exams, and classes
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  query,
  where,
  getDocs,
  Timestamp,
  serverTimestamp,
  deleteDoc,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { RecordValidationGuardService, ValidationError } from './recordValidationGuardService';


export interface StudentGrade {
  id: string; // Primary Key (grade_id)
  student_id: string; // Foreign Key -> students.student_id
  exam_id: string; // Foreign Key -> exams.id
  class_id: string; // Foreign Key -> classes.id
  score: number; // Numerical score
  max_score: number; // Maximum possible score
  percentage: number; // Percentage score (0-100)
  letter_grade?: string; // Letter grade (A, B, C, etc.)
  status: 'submitted' | 'draft' | 'approved' | 'reviewed'; // Grade status
  graded_at: string; // ISO timestamp when grade was recorded
  graded_by: string; // User ID of the instructor who graded
  comments?: string; // Optional grading comments
  rubric_details?: Record<string, number>; // Breakdown of scores by rubric criteria
  is_final: boolean; // Whether this is a final grade
  created_at: string; // Record creation timestamp
  updated_at: string; // Last update timestamp
  updated_by?: string; // User who last updated the grade
}

/**
 * Grade Statistics by Student
 */
export interface StudentGradeStatistics {
  student_id: string;
  total_exams: number;
  average_score: number;
  highest_score: number;
  lowest_score: number;
  passing_count: number;
  failing_count: number;
  grades: StudentGrade[];
}

/**
 * Grade Statistics by Class
 */
export interface ClassGradeStatistics {
  class_id: string;
  exam_id?: string;
  total_students: number;
  average_score: number;
  highest_score: number;
  lowest_score: number;
  grade_distribution: {
    excellent: number; // 90-100
    good: number; // 80-89
    satisfactory: number; // 70-79
    passing: number; // 60-69
    failing: number; // < 60
  };
  std_deviation: number;
}

/**
 * Grade Input/Update DTO
 */
export interface GradeInputData {
  student_id: string;
  exam_id: string;
  class_id: string;
  score: number;
  max_score: number;
  letter_grade?: string;
  comments?: string;
  rubric_details?: Record<string, number>;
  is_final?: boolean;
  graded_by: string;
}

const GRADES_COLLECTION = 'studentGrades';

export class GradingService {
  /**
   * Record a student grade
   * Validates foreign key relationships before saving
   */
  static async recordGrade(gradeData: GradeInputData): Promise<{
    success: boolean;
    data?: StudentGrade;
    error?: string;
    validation_errors?: ValidationError[];
  }> {
    try {
      // Validate the grade record using validation guard
      const validationResult = await RecordValidationGuardService.validateGradeRecord({
        student_id: gradeData.student_id,
        exam_id: gradeData.exam_id,
        class_id: gradeData.class_id,
        score: gradeData.score,
        grade_letter: gradeData.letter_grade,
        recorded_by: gradeData.graded_by,
      });

      // If validation fails, block the save and return errors
      if (!validationResult.isValid) {
        return {
          success: false,
          error: 'Grade record validation failed',
          validation_errors: validationResult.errors,
        };
      }

      const now = new Date().toISOString();
      const percentage = Math.round((gradeData.score / gradeData.max_score) * 100);
      const gradeId = `grade_${gradeData.student_id}_${gradeData.exam_id}_${Date.now()}`;

      const grade: StudentGrade = {
        id: gradeId,
        student_id: gradeData.student_id,
        exam_id: gradeData.exam_id,
        class_id: gradeData.class_id,
        score: gradeData.score,
        max_score: gradeData.max_score,
        percentage,
        letter_grade: gradeData.letter_grade || this.calculateLetterGrade(percentage),
        status: gradeData.is_final ? 'approved' : 'draft',
        graded_at: now,
        graded_by: gradeData.graded_by,
        comments: gradeData.comments,
        rubric_details: gradeData.rubric_details,
        is_final: gradeData.is_final || false,
        created_at: now,
        updated_at: now,
        updated_by: gradeData.graded_by,
      };

      await setDoc(doc(db, GRADES_COLLECTION, gradeId), {
        ...grade,
        graded_at: serverTimestamp(),
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      return { success: true, data: grade };
    } catch (error) {
      console.error('Error recording grade:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get all grades for a student
   * Uses student_id foreign key to retrieve all grade records
   */
  static async getStudentGrades(studentId: string): Promise<{
    success: boolean;
    data?: StudentGrade[];
    error?: string;
  }> {
    try {
      const q = query(
        collection(db, GRADES_COLLECTION),
        where('student_id', '==', studentId),
        orderBy('graded_at', 'desc')
      );

      const snapshot = await getDocs(q);
      const grades = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          ...data,
          graded_at: (data.graded_at as Timestamp)?.toDate?.().toISOString?.() || data.graded_at,
          created_at: (data.created_at as Timestamp)?.toDate?.().toISOString?.() || data.created_at,
          updated_at: (data.updated_at as Timestamp)?.toDate?.().toISOString?.() || data.updated_at,
        } as StudentGrade;
      });

      return { success: true, data: grades };
    } catch (error) {
      console.error('Error fetching student grades:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get all grades for an exam
   * Retrieves grades for all students in an exam
   */
  static async getExamGrades(examId: string): Promise<{
    success: boolean;
    data?: StudentGrade[];
    error?: string;
  }> {
    try {
      const q = query(
        collection(db, GRADES_COLLECTION),
        where('exam_id', '==', examId),
        orderBy('percentage', 'desc')
      );

      const snapshot = await getDocs(q);
      const grades = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          ...data,
          graded_at: (data.graded_at as Timestamp)?.toDate?.().toISOString?.() || data.graded_at,
          created_at: (data.created_at as Timestamp)?.toDate?.().toISOString?.() || data.created_at,
          updated_at: (data.updated_at as Timestamp)?.toDate?.().toISOString?.() || data.updated_at,
        } as StudentGrade;
      });

      return { success: true, data: grades };
    } catch (error) {
      console.error('Error fetching exam grades:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get grades for a class
   * Uses class_id foreign key to retrieve all grades in a class
   */
  static async getClassGrades(classId: string): Promise<{
    success: boolean;
    data?: StudentGrade[];
    error?: string;
  }> {
    try {
      const q = query(
        collection(db, GRADES_COLLECTION),
        where('class_id', '==', classId),
        orderBy('graded_at', 'desc')
      );

      const snapshot = await getDocs(q);
      const grades = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          ...data,
          graded_at: (data.graded_at as Timestamp)?.toDate?.().toISOString?.() || data.graded_at,
          created_at: (data.created_at as Timestamp)?.toDate?.().toISOString?.() || data.created_at,
          updated_at: (data.updated_at as Timestamp)?.toDate?.().toISOString?.() || data.updated_at,
        } as StudentGrade;
      });

      return { success: true, data: grades };
    } catch (error) {
      console.error('Error fetching class grades:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get grade statistics for a student
   * Calculates aggregate statistics from all grades
   */
  static async getStudentGradeStatistics(studentId: string): Promise<{
    success: boolean;
    data?: StudentGradeStatistics;
    error?: string;
  }> {
    try {
      const gradesResult = await this.getStudentGrades(studentId);

      if (!gradesResult.success || !gradesResult.data) {
        return { success: false, error: 'Failed to retrieve student grades' };
      }

      const grades = gradesResult.data;

      if (grades.length === 0) {
        return {
          success: true,
          data: {
            student_id: studentId,
            total_exams: 0,
            average_score: 0,
            highest_score: 0,
            lowest_score: 0,
            passing_count: 0,
            failing_count: 0,
            grades: [],
          },
        };
      }

      const percentages = grades.map((g) => g.percentage);
      const passingCount = percentages.filter((p) => p >= 60).length;

      return {
        success: true,
        data: {
          student_id: studentId,
          total_exams: grades.length,
          average_score: Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length),
          highest_score: Math.max(...percentages),
          lowest_score: Math.min(...percentages),
          passing_count: passingCount,
          failing_count: grades.length - passingCount,
          grades,
        },
      };
    } catch (error) {
      console.error('Error calculating grade statistics:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get grade statistics for a class
   * Calculates aggregate statistics for all students in a class
   */
  static async getClassGradeStatistics(classId: string): Promise<{
    success: boolean;
    data?: ClassGradeStatistics;
    error?: string;
  }> {
    try {
      const gradesResult = await this.getClassGrades(classId);

      if (!gradesResult.success || !gradesResult.data) {
        return { success: false, error: 'Failed to retrieve class grades' };
      }

      const grades = gradesResult.data;

      if (grades.length === 0) {
        return {
          success: true,
          data: {
            class_id: classId,
            total_students: 0,
            average_score: 0,
            highest_score: 0,
            lowest_score: 0,
            grade_distribution: {
              excellent: 0,
              good: 0,
              satisfactory: 0,
              passing: 0,
              failing: 0,
            },
            std_deviation: 0,
          },
        };
      }

      const percentages = grades.map((g) => g.percentage);
      const average = percentages.reduce((a, b) => a + b, 0) / percentages.length;

      // Calculate standard deviation
      const variance = percentages.reduce((sum, val) => sum + Math.pow(val - average, 2), 0) / percentages.length;
      const stdDeviation = Math.sqrt(variance);

      // Count grade distribution
      const distribution = {
        excellent: percentages.filter((p) => p >= 90).length,
        good: percentages.filter((p) => p >= 80 && p < 90).length,
        satisfactory: percentages.filter((p) => p >= 70 && p < 80).length,
        passing: percentages.filter((p) => p >= 60 && p < 70).length,
        failing: percentages.filter((p) => p < 60).length,
      };

      // Get unique students count
      const uniqueStudents = new Set(grades.map((g) => g.student_id)).size;

      return {
        success: true,
        data: {
          class_id: classId,
          total_students: uniqueStudents,
          average_score: Math.round(average),
          highest_score: Math.max(...percentages),
          lowest_score: Math.min(...percentages),
          grade_distribution: distribution,
          std_deviation: Math.round(stdDeviation * 100) / 100,
        },
      };
    } catch (error) {
      console.error('Error calculating class grade statistics:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Update a grade record
   */
  static async updateGrade(
    gradeId: string,
    updates: Partial<GradeInputData> & { updated_by: string }
  ): Promise<{
    success: boolean;
    data?: StudentGrade;
    error?: string;
    validation_errors?: ValidationError[];
  }> {
    try {
      const gradeRef = doc(db, GRADES_COLLECTION, gradeId);
      const gradeDoc = await getDoc(gradeRef);

      if (!gradeDoc.exists()) {
        return { success: false, error: `Grade with ID ${gradeId} not found` };
      }

      const existingData = gradeDoc.data() as StudentGrade;

      // Validate the updated grade record using validation guard
      const validationResult = await RecordValidationGuardService.validateGradeRecord({
        student_id: updates.student_id || existingData.student_id,
        exam_id: updates.exam_id || existingData.exam_id,
        class_id: updates.class_id || existingData.class_id,
        score: updates.score ?? existingData.score,
        grade_letter: updates.letter_grade || existingData.letter_grade,
        recorded_by: updates.updated_by,
      });

      // If validation fails, block the update and return errors
      if (!validationResult.isValid) {
        return {
          success: false,
          error: 'Grade record validation failed',
          validation_errors: validationResult.errors,
        };
      }

      const updateData: any = {
        updated_at: serverTimestamp(),
        updated_by: updates.updated_by,
      };

      if (updates.score !== undefined && updates.max_score !== undefined) {
        updateData.score = updates.score;
        updateData.max_score = updates.max_score;
        updateData.percentage = Math.round((updates.score / updates.max_score) * 100);
        updateData.letter_grade = this.calculateLetterGrade(updateData.percentage);
      }

      if (updates.comments !== undefined) {
        updateData.comments = updates.comments;
      }

      if (updates.rubric_details !== undefined) {
        updateData.rubric_details = updates.rubric_details;
      }

      if (updates.is_final !== undefined) {
        updateData.is_final = updates.is_final;
        updateData.status = updates.is_final ? 'approved' : 'draft';
      }

      await updateDoc(gradeRef, updateData);

      const updatedDoc = await getDoc(gradeRef);
      const data = updatedDoc.data() as StudentGrade;

      return { success: true, data };
    } catch (error) {
      console.error('Error updating grade:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Delete a grade record
   */
  static async deleteGrade(gradeId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const gradeRef = doc(db, GRADES_COLLECTION, gradeId);
      const gradeDoc = await getDoc(gradeRef);

      if (!gradeDoc.exists()) {
        return { success: false, error: `Grade with ID ${gradeId} not found` };
      }

      await deleteDoc(gradeRef);
      return { success: true };
    } catch (error) {
      console.error('Error deleting grade:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Calculate letter grade from percentage
   */
  private static calculateLetterGrade(percentage: number): string {
    if (percentage >= 90) return 'A';
    if (percentage >= 80) return 'B';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
  }

  /**
   * Get all students with their latest grade in a class
   * Demonstrates join-like query using student_id foreign key
   */
  static async getClassStudentsWithGrades(classId: string): Promise<{
    success: boolean;
    data?: Array<{ student_id: string; latest_grade?: StudentGrade }>;
    error?: string;
  }> {
    try {
      // Get all grades for the class
      const gradesResult = await this.getClassGrades(classId);

      if (!gradesResult.success || !gradesResult.data) {
        return { success: false, error: 'Failed to retrieve class grades' };
      }

      // Group by student and get latest grade
      const studentGradeMap = new Map<string, StudentGrade>();

      gradesResult.data.forEach((grade) => {
        const existing = studentGradeMap.get(grade.student_id);
        if (!existing || new Date(grade.graded_at) > new Date(existing.graded_at)) {
          studentGradeMap.set(grade.student_id, grade);
        }
      });

      const result = Array.from(studentGradeMap.entries()).map(([studentId, grade]) => ({
        student_id: studentId,
        latest_grade: grade,
      }));

      return { success: true, data: result };
    } catch (error) {
      console.error('Error fetching class students with grades:', error);
      return { success: false, error: (error as Error).message };
    }
  }
}
