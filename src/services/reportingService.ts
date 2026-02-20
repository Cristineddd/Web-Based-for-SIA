/**
 * Reporting Service
 * Generates comprehensive reports by joining Student ID across grading, attendance, and student records
 * Provides aggregated data for dashboards, exports, and analytics
 */

import {
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { StudentGrade, GradingService } from './gradingService';
import { StudentAttendance } from './attendanceService';
import { StudentRecord } from './studentService';
import { RecordValidationGuardService, ValidationError } from './recordValidationGuardService';

/**
 * Comprehensive Student Report
 * Combines student info, grades, and attendance
 */
export interface StudentComprehensiveReport {
  student: StudentRecord;
  grades: StudentGrade[];
  attendance_records: StudentAttendance[];
  summary: {
    total_exams: number;
    average_grade: number;
    current_semester_gpa?: number;
    total_classes: number;
    average_attendance_percentage: number;
    flagged_issues?: string[]; // Low grades, excessive absences, etc.
  };
}

/**
 * Class Report
 * Combines all students' performance and attendance in a class
 */
export interface ClassComprehensiveReport {
  class_name: string;
  class_id: string;
  total_students: number;
  grades_summary: {
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
    standard_deviation: number;
  };
  attendance_summary: {
    average_attendance: number;
    total_sessions: number;
    students_with_low_attendance: string[]; // Student IDs with <75% attendance
  };
  high_performers: Array<{
    student_id: string;
    average_grade: number;
    attendance_percentage: number;
  }>;
  at_risk_students: Array<{
    student_id: string;
    average_grade: number;
    attendance_percentage: number;
    issues: string[];
  }>;
}

/**
 * Exam Report
 * Performance report for a specific exam across all students
 */
export interface ExamComprehensiveReport {
  exam_id: string;
  exam_name?: string;
  total_submissions: number;
  grades_summary: {
    average_score: number;
    highest_score: number;
    lowest_score: number;
    median_score: number;
    standard_deviation: number;
    pass_rate: number; // Percentage of students who passed (>=60%)
  };
  item_analysis?: {
    question_number: number;
    correct_count: number;
    incorrect_count: number;
    difficulty_level: 'easy' | 'medium' | 'hard';
  }[];
  grade_distribution: {
    excellent: number;
    good: number;
    satisfactory: number;
    passing: number;
    failing: number;
  };
  top_performers: Array<{
    student_id: string;
    score: number;
    percentage: number;
  }>;
  struggling_students: Array<{
    student_id: string;
    score: number;
    percentage: number;
  }>;
}

/**
 * Period Report
 * Report covering a specific date range for a student
 */
export interface PeriodComprehensiveReport {
  student_id: string;
  student_name?: string;
  period_start: string;
  period_end: string;
  grades: StudentGrade[];
  attendance: StudentAttendance[];
  summary: {
    exams_taken: number;
    average_score: number;
    highest_score: number;
    lowest_score: number;
    attendance_rate: number;
    on_track: boolean; // Indicates if student is performing well
  };
}

const STUDENTS_COLLECTION = 'students';
const GRADES_COLLECTION = 'studentGrades';
const ATTENDANCE_COLLECTION = 'studentAttendance';

export class ReportingService {
  /**
   * Generate a comprehensive student report
   * Joins student record with grades and attendance using student_id
   */
  static async generateStudentReport(studentId: string): Promise<{
    success: boolean;
    data?: StudentComprehensiveReport;
    error?: string;
    validation_errors?: ValidationError[];
  }> {
    try {
      // Validate the report record using validation guard
      const validationResult = await RecordValidationGuardService.validateReportRecord({
        report_type: 'student',
        entity_id: studentId,
        generated_by: 'system',
      });

      // If validation fails, return errors
      if (!validationResult.isValid) {
        return {
          success: false,
          error: 'Report record validation failed',
          validation_errors: validationResult.errors,
        };
      }

      // Fetch student record
      const studentSnapshot = await getDocs(
        query(
          collection(db, STUDENTS_COLLECTION),
          where('student_id', '==', studentId)
        )
      );

      if (studentSnapshot.empty) {
        return { success: false, error: `Student with ID ${studentId} not found` };
      }

      const student = studentSnapshot.docs[0].data() as StudentRecord;

      // Fetch grades for this student
      const gradesResult = await GradingService.getStudentGrades(studentId);
      const grades = gradesResult.data || [];

      // Fetch attendance for this student
      const attendanceSnapshot = await getDocs(
        query(
          collection(db, ATTENDANCE_COLLECTION),
          where('student_id', '==', studentId)
        )
      );
      const attendance = attendanceSnapshot.docs.map((doc) => doc.data()) as StudentAttendance[];

      // Calculate summary statistics
      const averageGrade = grades.length > 0
        ? Math.round(grades.reduce((sum, g) => sum + g.percentage, 0) / grades.length)
        : 0;

      const totalClasses = new Set(attendance.map((a) => a.class_id)).size;
      const averageAttendancePercentage = this.calculateAverageAttendance(attendance);

      // Identify flagged issues
      const flaggedIssues: string[] = [];
      if (averageGrade < 60) {
        flaggedIssues.push('Low overall grades (below 60%)');
      }
      if (averageAttendancePercentage < 75) {
        flaggedIssues.push('Low attendance rate (below 75%)');
      }
      if (grades.some((g) => g.percentage < 50)) {
        flaggedIssues.push('Failed exam(s) detected');
      }

      const report: StudentComprehensiveReport = {
        student,
        grades,
        attendance_records: attendance,
        summary: {
          total_exams: grades.length,
          average_grade: averageGrade,
          total_classes: totalClasses,
          average_attendance_percentage: averageAttendancePercentage,
          flagged_issues: flaggedIssues.length > 0 ? flaggedIssues : undefined,
        },
      };

      return { success: true, data: report };
    } catch (error) {
      console.error('Error generating student report:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Generate a comprehensive class report
   * Analyzes all students' performance and attendance in a class
   */
  static async generateClassReport(classId: string): Promise<{
    success: boolean;
    data?: ClassComprehensiveReport;
    error?: string;
  }> {
    try {
      // Get all grades for the class
      const gradesSnapshot = await getDocs(
        query(
          collection(db, GRADES_COLLECTION),
          where('class_id', '==', classId)
        )
      );
      const grades = gradesSnapshot.docs.map((doc) => doc.data()) as StudentGrade[];

      // Get all attendance for the class
      const attendanceSnapshot = await getDocs(
        query(
          collection(db, ATTENDANCE_COLLECTION),
          where('class_id', '==', classId)
        )
      );
      const attendance = attendanceSnapshot.docs.map((doc) => doc.data()) as StudentAttendance[];

      // Get unique students
      const studentIds = new Set([
        ...grades.map((g) => g.student_id),
        ...attendance.map((a) => a.student_id),
      ]);

      // Calculate grades summary
      const gradePercentages = grades.map((g) => g.percentage);
      const gradesSummary = {
        average_score: this.calculateAverage(gradePercentages),
        highest_score: Math.max(...gradePercentages, 0),
        lowest_score: Math.min(...gradePercentages, 100),
        grade_distribution: this.calculateGradeDistribution(gradePercentages),
        standard_deviation: this.calculateStandardDeviation(gradePercentages),
      };

      // Calculate attendance summary
      const uniqueSessions = new Set(attendance.map((a) => a.date)).size;
      const lowAttendanceStudents = this.identifyLowAttendanceStudents(attendance, 75);

      const attendanceSummary = {
        average_attendance: this.calculateAverageAttendance(attendance),
        total_sessions: uniqueSessions,
        students_with_low_attendance: lowAttendanceStudents,
      };

      // Identify high performers and at-risk students
      const highPerformers = this.identifyHighPerformers(grades, attendance);
      const atRiskStudents = this.identifyAtRiskStudents(grades, attendance);

      const report: ClassComprehensiveReport = {
        class_name: `Class ${classId}`,
        class_id: classId,
        total_students: studentIds.size,
        grades_summary: gradesSummary,
        attendance_summary: attendanceSummary,
        high_performers: highPerformers,
        at_risk_students: atRiskStudents,
      };

      return { success: true, data: report };
    } catch (error) {
      console.error('Error generating class report:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Generate a comprehensive exam report
   * Analyzes student performance on a specific exam
   */
  static async generateExamReport(examId: string): Promise<{
    success: boolean;
    data?: ExamComprehensiveReport;
    error?: string;
  }> {
    try {
      // Get all grades for the exam
      const gradesSnapshot = await getDocs(
        query(
          collection(db, GRADES_COLLECTION),
          where('exam_id', '==', examId)
        )
      );
      const grades = gradesSnapshot.docs.map((doc) => doc.data()) as StudentGrade[];

      if (grades.length === 0) {
        return { success: false, error: `No grades found for exam ${examId}` };
      }

      // Calculate grade statistics
      const percentages = grades.map((g) => g.percentage);
      const averageScore = this.calculateAverage(percentages);
      const median = this.calculateMedian(percentages);
      const stdDeviation = this.calculateStandardDeviation(percentages);
      const passRate = Math.round((percentages.filter((p) => p >= 60).length / percentages.length) * 100);

      const report: ExamComprehensiveReport = {
        exam_id: examId,
        total_submissions: grades.length,
        grades_summary: {
          average_score: averageScore,
          highest_score: Math.max(...percentages),
          lowest_score: Math.min(...percentages),
          median_score: median,
          standard_deviation: stdDeviation,
          pass_rate: passRate,
        },
        grade_distribution: this.calculateGradeDistribution(percentages),
        top_performers: grades
          .sort((a, b) => b.percentage - a.percentage)
          .slice(0, 5)
          .map((g) => ({
            student_id: g.student_id,
            score: g.score,
            percentage: g.percentage,
          })),
        struggling_students: grades
          .sort((a, b) => a.percentage - b.percentage)
          .slice(0, 5)
          .map((g) => ({
            student_id: g.student_id,
            score: g.score,
            percentage: g.percentage,
          })),
      };

      return { success: true, data: report };
    } catch (error) {
      console.error('Error generating exam report:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Generate a period report for a student
   * Covers a specific date range
   */
  static async generateStudentPeriodReport(
    studentId: string,
    startDate: string,
    endDate: string
  ): Promise<{
    success: boolean;
    data?: PeriodComprehensiveReport;
    error?: string;
  }> {
    try {
      // Get grades for the period
      const gradesSnapshot = await getDocs(
        query(
          collection(db, GRADES_COLLECTION),
          where('student_id', '==', studentId)
        )
      );
      const allGrades = gradesSnapshot.docs.map((doc) => doc.data()) as StudentGrade[];
      const grades = allGrades.filter((g) => g.graded_at >= startDate && g.graded_at <= endDate);

      // Get attendance for the period
      const attendanceSnapshot = await getDocs(
        query(
          collection(db, ATTENDANCE_COLLECTION),
          where('student_id', '==', studentId)
        )
      );
      const allAttendance = attendanceSnapshot.docs.map((doc) => doc.data()) as StudentAttendance[];
      const attendance = allAttendance.filter((a) => a.date >= startDate && a.date <= endDate);

      // Calculate summary
      const percentages = grades.map((g) => g.percentage);
      const onTrack = percentages.length > 0 && this.calculateAverage(percentages) >= 75;

      const report: PeriodComprehensiveReport = {
        student_id: studentId,
        period_start: startDate,
        period_end: endDate,
        grades,
        attendance,
        summary: {
          exams_taken: grades.length,
          average_score: this.calculateAverage(percentages),
          highest_score: Math.max(...percentages, 0),
          lowest_score: Math.min(...percentages, 100),
          attendance_rate: this.calculateAverageAttendance(attendance),
          on_track: onTrack,
        },
      };

      return { success: true, data: report };
    } catch (error) {
      console.error('Error generating period report:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Export class report as CSV
   */
  static generateClassReportCSV(report: ClassComprehensiveReport): string {
    const lines: string[] = [];

    lines.push('Class Performance Report');
    lines.push(`Class ID: ${report.class_id}`);
    lines.push(`Total Students: ${report.total_students}`);
    lines.push('');

    lines.push('Grades Summary');
    lines.push(`Average Score: ${report.grades_summary.average_score}%`);
    lines.push(`Highest Score: ${report.grades_summary.highest_score}%`);
    lines.push(`Lowest Score: ${report.grades_summary.lowest_score}%`);
    lines.push(`Standard Deviation: ${report.grades_summary.standard_deviation}`);
    lines.push('');

    lines.push('Grade Distribution');
    lines.push(`Excellent (90-100): ${report.grades_summary.grade_distribution.excellent}`);
    lines.push(`Good (80-89): ${report.grades_summary.grade_distribution.good}`);
    lines.push(`Satisfactory (70-79): ${report.grades_summary.grade_distribution.satisfactory}`);
    lines.push(`Passing (60-69): ${report.grades_summary.grade_distribution.passing}`);
    lines.push(`Failing (<60): ${report.grades_summary.grade_distribution.failing}`);
    lines.push('');

    lines.push('Attendance Summary');
    lines.push(`Average Attendance: ${report.attendance_summary.average_attendance}%`);
    lines.push(`Total Sessions: ${report.attendance_summary.total_sessions}`);
    lines.push('');

    lines.push('High Performers');
    report.high_performers.forEach((student) => {
      lines.push(
        `${student.student_id},${student.average_grade}%,${student.attendance_percentage}%`
      );
    });
    lines.push('');

    lines.push('At-Risk Students');
    report.at_risk_students.forEach((student) => {
      lines.push(
        `${student.student_id},${student.average_grade}%,${student.attendance_percentage}%,"${student.issues.join('; ')}"`
      );
    });

    return lines.join('\n');
  }

  /**
   * Helper: Calculate average
   */
  private static calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  }

  /**
   * Helper: Calculate median
   */
  private static calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  /**
   * Helper: Calculate standard deviation
   */
  private static calculateStandardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    const average = this.calculateAverage(values);
    const variance = values.reduce((sum, val) => sum + Math.pow(val - average, 2), 0) / values.length;
    return Math.round(Math.sqrt(variance) * 100) / 100;
  }

  /**
   * Helper: Calculate grade distribution
   */
  private static calculateGradeDistribution(percentages: number[]): {
    excellent: number;
    good: number;
    satisfactory: number;
    passing: number;
    failing: number;
  } {
    return {
      excellent: percentages.filter((p) => p >= 90).length,
      good: percentages.filter((p) => p >= 80 && p < 90).length,
      satisfactory: percentages.filter((p) => p >= 70 && p < 80).length,
      passing: percentages.filter((p) => p >= 60 && p < 70).length,
      failing: percentages.filter((p) => p < 60).length,
    };
  }

  /**
   * Helper: Calculate average attendance percentage
   */
  private static calculateAverageAttendance(attendance: StudentAttendance[]): number {
    if (attendance.length === 0) return 0;
    const presentCount = attendance.filter((a) => a.status === 'present' || a.status === 'late' || a.status === 'excused').length;
    return Math.round((presentCount / attendance.length) * 100);
  }

  /**
   * Helper: Identify students with low attendance
   */
  private static identifyLowAttendanceStudents(
    attendance: StudentAttendance[],
    threshold: number
  ): string[] {
    const studentAttendanceMap = new Map<string, number[]>();

    attendance.forEach((record) => {
      if (!studentAttendanceMap.has(record.student_id)) {
        studentAttendanceMap.set(record.student_id, []);
      }
      const status = record.status === 'present' || record.status === 'late' || record.status === 'excused' ? 1 : 0;
      studentAttendanceMap.get(record.student_id)!.push(status);
    });

    const lowAttendanceStudents: string[] = [];
    studentAttendanceMap.forEach((statuses, studentId) => {
      const attendanceRate = Math.round((statuses.reduce((a, b) => a + b) / statuses.length) * 100);
      if (attendanceRate < threshold) {
        lowAttendanceStudents.push(studentId);
      }
    });

    return lowAttendanceStudents;
  }

  /**
   * Helper: Identify high performers
   */
  private static identifyHighPerformers(
    grades: StudentGrade[],
    attendance: StudentAttendance[]
  ): Array<{
    student_id: string;
    average_grade: number;
    attendance_percentage: number;
  }> {
    const studentGradeMap = new Map<string, number[]>();
    const studentAttendanceMap = new Map<string, number[]>();

    grades.forEach((grade) => {
      if (!studentGradeMap.has(grade.student_id)) {
        studentGradeMap.set(grade.student_id, []);
      }
      studentGradeMap.get(grade.student_id)!.push(grade.percentage);
    });

    attendance.forEach((record) => {
      if (!studentAttendanceMap.has(record.student_id)) {
        studentAttendanceMap.set(record.student_id, []);
      }
      const status = record.status === 'present' || record.status === 'late' || record.status === 'excused' ? 1 : 0;
      studentAttendanceMap.get(record.student_id)!.push(status);
    });

    const performers: Array<{
      student_id: string;
      average_grade: number;
      attendance_percentage: number;
    }> = [];

    studentGradeMap.forEach((grades, studentId) => {
      const avgGrade = Math.round(grades.reduce((a, b) => a + b) / grades.length);
      const attendanceStats = studentAttendanceMap.get(studentId) || [];
      const attendancePercentage = attendanceStats.length > 0
        ? Math.round((attendanceStats.reduce((a, b) => a + b) / attendanceStats.length) * 100)
        : 0;

      if (avgGrade >= 85 && attendancePercentage >= 85) {
        performers.push({
          student_id: studentId,
          average_grade: avgGrade,
          attendance_percentage: attendancePercentage,
        });
      }
    });

    return performers.sort((a, b) => b.average_grade - a.average_grade);
  }

  /**
   * Helper: Identify at-risk students
   */
  private static identifyAtRiskStudents(
    grades: StudentGrade[],
    attendance: StudentAttendance[]
  ): Array<{
    student_id: string;
    average_grade: number;
    attendance_percentage: number;
    issues: string[];
  }> {
    const studentGradeMap = new Map<string, number[]>();
    const studentAttendanceMap = new Map<string, number[]>();

    grades.forEach((grade) => {
      if (!studentGradeMap.has(grade.student_id)) {
        studentGradeMap.set(grade.student_id, []);
      }
      studentGradeMap.get(grade.student_id)!.push(grade.percentage);
    });

    attendance.forEach((record) => {
      if (!studentAttendanceMap.has(record.student_id)) {
        studentAttendanceMap.set(record.student_id, []);
      }
      const status = record.status === 'present' || record.status === 'late' || record.status === 'excused' ? 1 : 0;
      studentAttendanceMap.get(record.student_id)!.push(status);
    });

    const atRiskStudents: Array<{
      student_id: string;
      average_grade: number;
      attendance_percentage: number;
      issues: string[];
    }> = [];

    studentGradeMap.forEach((grades, studentId) => {
      const avgGrade = Math.round(grades.reduce((a, b) => a + b) / grades.length);
      const attendanceStats = studentAttendanceMap.get(studentId) || [];
      const attendancePercentage = attendanceStats.length > 0
        ? Math.round((attendanceStats.reduce((a, b) => a + b) / attendanceStats.length) * 100)
        : 0;

      const issues: string[] = [];
      if (avgGrade < 60) issues.push('Low grades (< 60%)');
      if (attendancePercentage < 75) issues.push('Low attendance (< 75%)');

      if (issues.length > 0) {
        atRiskStudents.push({
          student_id: studentId,
          average_grade: avgGrade,
          attendance_percentage: attendancePercentage,
          issues,
        });
      }
    });

    return atRiskStudents.sort((a, b) => a.average_grade - b.average_grade);
  }
}
