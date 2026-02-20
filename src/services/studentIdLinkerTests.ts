/**
 * Integration Tests for Grading, Attendance, and Reporting Services
 * Tests foreign key relationships and cross-service data joins
 */

import { GradingService, GradeInputData } from '@/services/gradingService';
import { AttendanceService, AttendanceInputData } from '@/services/attendanceService';
import { ReportingService } from '@/services/reportingService';

/**
 * Test Suite: Foreign Key Relationships
 */
export class ForeignKeyRelationshipTests {
  /**
   * Test that grading service validates student_id foreign key exists
   */
  static testGradeStudentIdForeignKey = async (): Promise<{
    success: boolean;
    message: string;
  }> => {
    try {
      const gradeData: GradeInputData = {
        student_id: 'nonexistent_student_123',
        exam_id: 'exam_001',
        class_id: 'class_001',
        score: 80,
        max_score: 100,
        graded_by: 'teacher_001',
      };

      const result = await GradingService.recordGrade(gradeData);

      if (result.success) {
        return { success: false, message: 'FAIL: Should not accept non-existent student ID' };
      }

      if (result.error?.includes('not found')) {
        return { success: true, message: 'PASS: Foreign key constraint validated - student not found' };
      }

      return { success: false, message: `FAIL: Unexpected error: ${result.error}` };
    } catch (error) {
      return { success: false, message: `ERROR: ${(error as Error).message}` };
    }
  };

  /**
   * Test that grading service validates exam_id foreign key exists
   */
  static testGradeExamIdForeignKey = async (): Promise<{
    success: boolean;
    message: string;
  }> => {
    try {
      const gradeData: GradeInputData = {
        student_id: 'valid_student_id',
        exam_id: 'nonexistent_exam_123',
        class_id: 'class_001',
        score: 80,
        max_score: 100,
        graded_by: 'teacher_001',
      };

      const result = await GradingService.recordGrade(gradeData);

      if (result.success) {
        return { success: false, message: 'FAIL: Should not accept non-existent exam ID' };
      }

      if (result.error?.includes('not found')) {
        return { success: true, message: 'PASS: Foreign key constraint validated - exam not found' };
      }

      return { success: false, message: `FAIL: Unexpected error: ${result.error}` };
    } catch (error) {
      return { success: false, message: `ERROR: ${(error as Error).message}` };
    }
  };

  /**
   * Test that attendance service validates student_id foreign key exists
   */
  static testAttendanceStudentIdForeignKey = async (): Promise<{
    success: boolean;
    message: string;
  }> => {
    try {
      const attendanceData: AttendanceInputData = {
        student_id: 'nonexistent_student_123',
        class_id: 'class_001',
        date: '2026-02-19',
        status: 'present',
        marked_by: 'teacher_001',
      };

      const result = await AttendanceService.recordAttendance(attendanceData);

      if (result.success) {
        return { success: false, message: 'FAIL: Should not accept non-existent student ID' };
      }

      if (result.error?.includes('not found')) {
        return { success: true, message: 'PASS: Foreign key constraint validated - student not found' };
      }

      return { success: false, message: `FAIL: Unexpected error: ${result.error}` };
    } catch (error) {
      return { success: false, message: `ERROR: ${(error as Error).message}` };
    }
  };

  /**
   * Test that attendance service validates class_id foreign key exists
   */
  static testAttendanceClassIdForeignKey = async (): Promise<{
    success: boolean;
    message: string;
  }> => {
    try {
      const attendanceData: AttendanceInputData = {
        student_id: 'valid_student_id',
        class_id: 'nonexistent_class_123',
        date: '2026-02-19',
        status: 'present',
        marked_by: 'teacher_001',
      };

      const result = await AttendanceService.recordAttendance(attendanceData);

      if (result.success) {
        return { success: false, message: 'FAIL: Should not accept non-existent class ID' };
      }

      if (result.error?.includes('not found')) {
        return { success: true, message: 'PASS: Foreign key constraint validated - class not found' };
      }

      return { success: false, message: `FAIL: Unexpected error: ${result.error}` };
    } catch (error) {
      return { success: false, message: `ERROR: ${(error as Error).message}` };
    }
  };
}

/**
 * Test Suite: Query Joins and Data Retrieval
 */
export class QueryJoinTests {
  /**
   * Test retrieving all grades for a specific student (using student_id join)
   */
  static testGetStudentGradesJoin = async (studentId: string): Promise<{
    success: boolean;
    message: string;
    gradeCount?: number;
  }> => {
    try {
      const result = await GradingService.getStudentGrades(studentId);

      if (!result.success) {
        return { success: false, message: `FAIL: ${result.error}` };
      }

      const grades = result.data || [];
      const allMatchStudentId = grades.every((g) => g.student_id === studentId);

      if (!allMatchStudentId) {
        return {
          success: false,
          message: 'FAIL: Retrieved grades do not all match the requested student ID',
          gradeCount: grades.length,
        };
      }

      return {
        success: true,
        message: `PASS: Successfully retrieved ${grades.length} grades for student ${studentId}`,
        gradeCount: grades.length,
      };
    } catch (error) {
      return { success: false, message: `ERROR: ${(error as Error).message}` };
    }
  };

  /**
   * Test retrieving all attendance records for a specific student (using student_id join)
   */
  static testGetStudentAttendanceJoin = async (
    studentId: string,
    classId: string
  ): Promise<{
    success: boolean;
    message: string;
    attendanceCount?: number;
  }> => {
    try {
      const result = await AttendanceService.getStudentAttendance(studentId, classId);

      if (!result.success) {
        return { success: false, message: `FAIL: ${result.error}` };
      }

      const records = result.data || [];
      const allMatchStudent = records.every((r) => r.student_id === studentId);
      const allMatchClass = records.every((r) => r.class_id === classId);

      if (!allMatchStudent || !allMatchClass) {
        return {
          success: false,
          message: 'FAIL: Retrieved attendance records do not match the requested student/class ID',
          attendanceCount: records.length,
        };
      }

      return {
        success: true,
        message: `PASS: Successfully retrieved ${records.length} attendance records for student ${studentId} in class ${classId}`,
        attendanceCount: records.length,
      };
    } catch (error) {
      return { success: false, message: `ERROR: ${(error as Error).message}` };
    }
  };

  /**
   * Test retrieving grades for an exam (using exam_id join)
   */
  static testGetExamGradesJoin = async (examId: string): Promise<{
    success: boolean;
    message: string;
    gradeCount?: number;
  }> => {
    try {
      const result = await GradingService.getExamGrades(examId);

      if (!result.success) {
        return { success: false, message: `FAIL: ${result.error}` };
      }

      const grades = result.data || [];
      const allMatchExam = grades.every((g) => g.exam_id === examId);

      if (!allMatchExam) {
        return {
          success: false,
          message: 'FAIL: Retrieved grades do not all match the requested exam ID',
          gradeCount: grades.length,
        };
      }

      return {
        success: true,
        message: `PASS: Successfully retrieved ${grades.length} grades for exam ${examId}`,
        gradeCount: grades.length,
      };
    } catch (error) {
      return { success: false, message: `ERROR: ${(error as Error).message}` };
    }
  };

  /**
   * Test retrieving grades for a class (using class_id join)
   */
  static testGetClassGradesJoin = async (classId: string): Promise<{
    success: boolean;
    message: string;
    gradeCount?: number;
    uniqueStudents?: number;
  }> => {
    try {
      const result = await GradingService.getClassGrades(classId);

      if (!result.success) {
        return { success: false, message: `FAIL: ${result.error}` };
      }

      const grades = result.data || [];
      const allMatchClass = grades.every((g) => g.class_id === classId);
      const uniqueStudentIds = new Set(grades.map((g) => g.student_id)).size;

      if (!allMatchClass) {
        return {
          success: false,
          message: 'FAIL: Retrieved grades do not all match the requested class ID',
          gradeCount: grades.length,
        };
      }

      return {
        success: true,
        message: `PASS: Successfully retrieved ${grades.length} grades from ${uniqueStudentIds} students in class ${classId}`,
        gradeCount: grades.length,
        uniqueStudents: uniqueStudentIds,
      };
    } catch (error) {
      return { success: false, message: `ERROR: ${(error as Error).message}` };
    }
  };

  /**
   * Test retrieving attendance for a class on a specific date
   */
  static testGetClassAttendanceByDateJoin = async (
    classId: string,
    date: string
  ): Promise<{
    success: boolean;
    message: string;
    attendanceCount?: number;
  }> => {
    try {
      const result = await AttendanceService.getClassAttendanceByDate(classId, date);

      if (!result.success) {
        return { success: false, message: `FAIL: ${result.error}` };
      }

      const records = result.data || [];
      const allMatchClass = records.every((r) => r.class_id === classId);
      const allMatchDate = records.every((r) => r.date === date);

      if (!allMatchClass || !allMatchDate) {
        return {
          success: false,
          message: 'FAIL: Retrieved attendance does not match the requested class/date',
          attendanceCount: records.length,
        };
      }

      return {
        success: true,
        message: `PASS: Successfully retrieved ${records.length} attendance records for class ${classId} on ${date}`,
        attendanceCount: records.length,
      };
    } catch (error) {
      return { success: false, message: `ERROR: ${(error as Error).message}` };
    }
  };
}

/**
 * Test Suite: Cross-Service Data Integration
 */
export class CrossServiceIntegrationTests {
  /**
   * Test generating a comprehensive student report (requires joins across multiple services)
   */
  static testStudentComprehensiveReportJoin = async (studentId: string): Promise<{
    success: boolean;
    message: string;
  }> => {
    try {
      const result = await ReportingService.generateStudentReport(studentId);

      if (!result.success) {
        return { success: false, message: `FAIL: ${result.error}` };
      }

      const report = result.data;
      if (!report) {
        return { success: false, message: 'FAIL: No report data returned' };
      }

      // Verify that the report contains student, grades, and attendance data
      if (report.student.student_id !== studentId) {
        return { success: false, message: 'FAIL: Student ID mismatch in report' };
      }

      // Verify all grades and attendance records match the student ID
      const allGradesMatch = report.grades.every((g) => g.student_id === studentId);
      const allAttendanceMatch = report.attendance_records.every((a) => a.student_id === studentId);

      if (!allGradesMatch || !allAttendanceMatch) {
        return {
          success: false,
          message: 'FAIL: Grade or attendance records do not match student ID',
        };
      }

      return {
        success: true,
        message: `PASS: Successfully generated comprehensive report for student ${studentId} with ${report.grades.length} grades and ${report.attendance_records.length} attendance records`,
      };
    } catch (error) {
      return { success: false, message: `ERROR: ${(error as Error).message}` };
    }
  };

  /**
   * Test generating a comprehensive class report (requires joins across multiple students)
   */
  static testClassComprehensiveReportJoin = async (classId: string): Promise<{
    success: boolean;
    message: string;
  }> => {
    try {
      const result = await ReportingService.generateClassReport(classId);

      if (!result.success) {
        return { success: false, message: `FAIL: ${result.error}` };
      }

      const report = result.data;
      if (!report) {
        return { success: false, message: 'FAIL: No report data returned' };
      }

      if (report.class_id !== classId) {
        return { success: false, message: 'FAIL: Class ID mismatch in report' };
      }

      return {
        success: true,
        message: `PASS: Successfully generated comprehensive report for class ${classId} with ${report.total_students} students`,
      };
    } catch (error) {
      return { success: false, message: `ERROR: ${(error as Error).message}` };
    }
  };

  /**
   * Test generating an exam report
   */
  static testExamComprehensiveReportJoin = async (examId: string): Promise<{
    success: boolean;
    message: string;
  }> => {
    try {
      const result = await ReportingService.generateExamReport(examId);

      if (!result.success) {
        return { success: false, message: `FAIL: ${result.error}` };
      }

      const report = result.data;
      if (!report) {
        return { success: false, message: 'FAIL: No report data returned' };
      }

      if (report.exam_id !== examId) {
        return { success: false, message: 'FAIL: Exam ID mismatch in report' };
      }

      return {
        success: true,
        message: `PASS: Successfully generated exam report for exam ${examId} with ${report.total_submissions} submissions`,
      };
    } catch (error) {
      return { success: false, message: `ERROR: ${(error as Error).message}` };
    }
  };

  /**
   * Test generating a period report for a student
   */
  static testStudentPeriodReportJoin = async (
    studentId: string,
    startDate: string,
    endDate: string
  ): Promise<{
    success: boolean;
    message: string;
  }> => {
    try {
      const result = await ReportingService.generateStudentPeriodReport(studentId, startDate, endDate);

      if (!result.success) {
        return { success: false, message: `FAIL: ${result.error}` };
      }

      const report = result.data;
      if (!report) {
        return { success: false, message: 'FAIL: No report data returned' };
      }

      if (report.student_id !== studentId) {
        return { success: false, message: 'FAIL: Student ID mismatch in report' };
      }

      // Verify date filtering
      const allGradesInRange = report.grades.every((g) => g.graded_at >= startDate && g.graded_at <= endDate);
      const allAttendanceInRange = report.attendance.every((a) => a.date >= startDate && a.date <= endDate);

      if (!allGradesInRange || !allAttendanceInRange) {
        return {
          success: false,
          message: 'FAIL: Period report contains records outside the requested date range',
        };
      }

      return {
        success: true,
        message: `PASS: Successfully generated period report for student ${studentId} from ${startDate} to ${endDate}`,
      };
    } catch (error) {
      return { success: false, message: `ERROR: ${(error as Error).message}` };
    }
  };
}

/**
 * Test Suite: Statistical Calculations with Foreign Keys
 */
export class StatisticsTests {
  /**
   * Test calculating grade statistics for a student
   */
  static testStudentGradeStatistics = async (studentId: string): Promise<{
    success: boolean;
    message: string;
  }> => {
    try {
      const result = await GradingService.getStudentGradeStatistics(studentId);

      if (!result.success) {
        return { success: false, message: `FAIL: ${result.error}` };
      }

      const stats = result.data;
      if (!stats) {
        return { success: false, message: 'FAIL: No statistics data returned' };
      }

      if (stats.student_id !== studentId) {
        return { success: false, message: 'FAIL: Student ID mismatch in statistics' };
      }

      // Verify that all grades match the student ID
      const allMatch = stats.grades.every((g) => g.student_id === studentId);
      if (!allMatch) {
        return {
          success: false,
          message: 'FAIL: Grade statistics contain records from other students',
        };
      }

      return {
        success: true,
        message: `PASS: Successfully calculated statistics for student ${studentId}: avg=${stats.average_score}, total=${stats.total_exams}`,
      };
    } catch (error) {
      return { success: false, message: `ERROR: ${(error as Error).message}` };
    }
  };

  /**
   * Test calculating grade statistics for a class
   */
  static testClassGradeStatistics = async (classId: string): Promise<{
    success: boolean;
    message: string;
  }> => {
    try {
      const result = await GradingService.getClassGradeStatistics(classId);

      if (!result.success) {
        return { success: false, message: `FAIL: ${result.error}` };
      }

      const stats = result.data;
      if (!stats) {
        return { success: false, message: 'FAIL: No statistics data returned' };
      }

      if (stats.class_id !== classId) {
        return { success: false, message: 'FAIL: Class ID mismatch in statistics' };
      }

      return {
        success: true,
        message: `PASS: Successfully calculated class statistics for class ${classId}: students=${stats.total_students}, avg=${stats.average_score}%`,
      };
    } catch (error) {
      return { success: false, message: `ERROR: ${(error as Error).message}` };
    }
  };

  /**
   * Test calculating attendance statistics for a student
   */
  static testStudentAttendanceStatistics = async (
    studentId: string,
    classId: string
  ): Promise<{
    success: boolean;
    message: string;
  }> => {
    try {
      const result = await AttendanceService.getStudentAttendanceStatistics(studentId, classId);

      if (!result.success) {
        return { success: false, message: `FAIL: ${result.error}` };
      }

      const stats = result.data;
      if (!stats) {
        return { success: false, message: 'FAIL: No statistics data returned' };
      }

      if (stats.student_id !== studentId || stats.class_id !== classId) {
        return { success: false, message: 'FAIL: Student/Class ID mismatch in statistics' };
      }

      return {
        success: true,
        message: `PASS: Successfully calculated attendance statistics: present=${stats.present_count}, absent=${stats.absent_count}, rate=${stats.attendance_percentage}%`,
      };
    } catch (error) {
      return { success: false, message: `ERROR: ${(error as Error).message}` };
    }
  };
}

/**
 * Run all tests
 */
export async function runAllTests(): Promise<void> {
  console.log('='.repeat(60));
  console.log('STARTING COMPREHENSIVE TEST SUITE');
  console.log('Testing Foreign Key Relationships and Query Joins');
  console.log('='.repeat(60));

  console.log('\n--- Foreign Key Relationship Tests ---');
  console.log(await ForeignKeyRelationshipTests.testGradeStudentIdForeignKey());
  console.log(await ForeignKeyRelationshipTests.testGradeExamIdForeignKey());
  console.log(await ForeignKeyRelationshipTests.testAttendanceStudentIdForeignKey());
  console.log(await ForeignKeyRelationshipTests.testAttendanceClassIdForeignKey());

  console.log('\n--- Query Join Tests ---');
  console.log(await QueryJoinTests.testGetStudentGradesJoin('sample_student_001'));
  console.log(await QueryJoinTests.testGetStudentAttendanceJoin('sample_student_001', 'class_001'));
  console.log(await QueryJoinTests.testGetExamGradesJoin('exam_001'));
  console.log(await QueryJoinTests.testGetClassGradesJoin('class_001'));
  console.log(await QueryJoinTests.testGetClassAttendanceByDateJoin('class_001', '2026-02-19'));

  console.log('\n--- Cross-Service Integration Tests ---');
  console.log(await CrossServiceIntegrationTests.testStudentComprehensiveReportJoin('sample_student_001'));
  console.log(await CrossServiceIntegrationTests.testClassComprehensiveReportJoin('class_001'));
  console.log(await CrossServiceIntegrationTests.testExamComprehensiveReportJoin('exam_001'));
  console.log(await CrossServiceIntegrationTests.testStudentPeriodReportJoin(
    'sample_student_001',
    '2026-01-01',
    '2026-02-28'
  ));

  console.log('\n--- Statistics Tests ---');
  console.log(await StatisticsTests.testStudentGradeStatistics('sample_student_001'));
  console.log(await StatisticsTests.testClassGradeStatistics('class_001'));
  console.log(await StatisticsTests.testStudentAttendanceStatistics('sample_student_001', 'class_001'));

  console.log('\n' + '='.repeat(60));
  console.log('TEST SUITE COMPLETED');
  console.log('='.repeat(60));
}
