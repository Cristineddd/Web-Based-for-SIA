/**
 * Attendance Service
 * Manages student attendance with proper Student ID foreign key relationships
 * Links attendance records to student records, classes, and dates
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
  and,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { RecordValidationGuardService, ValidationError } from './recordValidationGuardService';

/**
 * Student Attendance Record
 * Represents a student's attendance for a specific class on a specific date
 */
export interface StudentAttendance {
  id: string; // Primary Key (attendance_id)
  student_id: string; // Foreign Key -> students.student_id
  class_id: string; // Foreign Key -> classes.id
  date: string; // ISO date string (YYYY-MM-DD)
  status: 'present' | 'absent' | 'late' | 'excused' | 'on-leave'; // Attendance status
  remarks?: string; // Optional remarks
  marked_by: string; // User ID who marked the attendance
  marked_at: string; // ISO timestamp when attendance was recorded
  created_at: string; // Record creation timestamp
  updated_at: string; // Last update timestamp
  updated_by?: string; // User who last updated the record
}

/**
 * Attendance Statistics for a Student
 */
export interface StudentAttendanceStatistics {
  student_id: string;
  class_id: string;
  total_sessions: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  excused_count: number;
  on_leave_count: number;
  attendance_percentage: number;
  records: StudentAttendance[];
}

/**
 * Attendance Statistics for a Class
 */
export interface ClassAttendanceStatistics {
  class_id: string;
  date?: string; // Optional date filter
  total_students: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  excused_count: number;
  on_leave_count: number;
  average_attendance_percentage: number;
}

/**
 * Attendance Input/Update DTO
 */
export interface AttendanceInputData {
  student_id: string;
  class_id: string;
  date: string; // ISO date string (YYYY-MM-DD)
  status: 'present' | 'absent' | 'late' | 'excused' | 'on-leave';
  remarks?: string;
  marked_by: string;
}

/**
 * Bulk Attendance Update for a class
 */
export interface BulkAttendanceUpdate {
  class_id: string;
  date: string;
  attendanceRecords: AttendanceInputData[];
  marked_by: string;
}

const ATTENDANCE_COLLECTION = 'studentAttendance';

export class AttendanceService {
  /**
   * Record attendance for a student
   * Validates foreign key relationships before saving
   */
  static async recordAttendance(attendanceData: AttendanceInputData): Promise<{
    success: boolean;
    data?: StudentAttendance;
    error?: string;
    validation_errors?: ValidationError[];
  }> {
    try {
      // Validate the attendance record using validation guard
      const validationResult = await RecordValidationGuardService.validateAttendanceRecord({
        student_id: attendanceData.student_id,
        class_id: attendanceData.class_id,
        date: attendanceData.date,
        status: attendanceData.status,
        remarks: attendanceData.remarks,
        recorded_by: attendanceData.marked_by,
      });

      // If validation fails, block the save and return errors
      if (!validationResult.isValid) {
        return {
          success: false,
          error: 'Attendance record validation failed',
          validation_errors: validationResult.errors,
        };
      }

      const now = new Date().toISOString();
      const attendanceId = `attendance_${attendanceData.student_id}_${attendanceData.class_id}_${attendanceData.date}_${Date.now()}`;

      const attendance: StudentAttendance = {
        id: attendanceId,
        student_id: attendanceData.student_id,
        class_id: attendanceData.class_id,
        date: attendanceData.date,
        status: attendanceData.status,
        remarks: attendanceData.remarks,
        marked_by: attendanceData.marked_by,
        marked_at: now,
        created_at: now,
        updated_at: now,
        updated_by: attendanceData.marked_by,
      };

      await setDoc(doc(db, ATTENDANCE_COLLECTION, attendanceId), {
        ...attendance,
        marked_at: serverTimestamp(),
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      return { success: true, data: attendance };
    } catch (error) {
      console.error('Error recording attendance:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Record attendance for multiple students in a class on a specific date
   */
  static async recordBulkAttendance(bulkData: BulkAttendanceUpdate): Promise<{
    success: boolean;
    data?: StudentAttendance[];
    errors?: Array<{ student_id: string; error: string }>;
  }> {
    try {
      const successRecords: StudentAttendance[] = [];
      const errorRecords: Array<{ student_id: string; error: string }> = [];

      for (const record of bulkData.attendanceRecords) {
        const result = await this.recordAttendance(record);
        if (result.success && result.data) {
          successRecords.push(result.data);
        } else {
          errorRecords.push({
            student_id: record.student_id,
            error: result.error || 'Unknown error',
          });
        }
      }

      return {
        success: errorRecords.length === 0,
        data: successRecords,
        errors: errorRecords.length > 0 ? errorRecords : undefined,
      };
    } catch (error) {
      console.error('Error recording bulk attendance:', error);
      return {
        success: false,
        errors: [
          {
            student_id: 'bulk',
            error: (error as Error).message,
          },
        ],
      };
    }
  }

  /**
   * Get all attendance records for a student
   * Uses student_id foreign key to retrieve all attendance records
   */
  static async getStudentAttendance(
    studentId: string,
    classId?: string
  ): Promise<{
    success: boolean;
    data?: StudentAttendance[];
    error?: string;
  }> {
    try {
      let q;
      if (classId) {
        q = query(
          collection(db, ATTENDANCE_COLLECTION),
          and(where('student_id', '==', studentId), where('class_id', '==', classId)),
          orderBy('date', 'desc')
        );
      } else {
        q = query(
          collection(db, ATTENDANCE_COLLECTION),
          where('student_id', '==', studentId),
          orderBy('date', 'desc')
        );
      }

      const snapshot = await getDocs(q);
      const records = snapshot.docs.map((doc) => {
        const data = doc.data() as StudentAttendance;
        return {
          ...data,
          marked_at: (data.marked_at as unknown as Timestamp)?.toDate?.().toISOString?.() || data.marked_at,
          created_at: (data.created_at as unknown as Timestamp)?.toDate?.().toISOString?.() || data.created_at,
          updated_at: (data.updated_at as unknown as Timestamp)?.toDate?.().toISOString?.() || data.updated_at,
        } as StudentAttendance;
      });

      return { success: true, data: records };
    } catch (error) {
      console.error('Error fetching student attendance:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get all attendance records for a class on a specific date
   * Uses class_id foreign key to retrieve attendance for all students
   */
  static async getClassAttendanceByDate(classId: string, date: string): Promise<{
    success: boolean;
    data?: StudentAttendance[];
    error?: string;
  }> {
    try {
      const q = query(
        collection(db, ATTENDANCE_COLLECTION),
        and(where('class_id', '==', classId), where('date', '==', date)),
        orderBy('marked_at', 'desc')
      );

      const snapshot = await getDocs(q);
      const records = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          ...data,
          marked_at: (data.marked_at as Timestamp)?.toDate?.().toISOString?.() || data.marked_at,
          created_at: (data.created_at as Timestamp)?.toDate?.().toISOString?.() || data.created_at,
          updated_at: (data.updated_at as Timestamp)?.toDate?.().toISOString?.() || data.updated_at,
        } as StudentAttendance;
      });

      return { success: true, data: records };
    } catch (error) {
      console.error('Error fetching class attendance:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get all attendance records for a class within a date range
   */
  static async getClassAttendanceByDateRange(
    classId: string,
    startDate: string,
    endDate: string
  ): Promise<{
    success: boolean;
    data?: StudentAttendance[];
    error?: string;
  }> {
    try {
      const q = query(
        collection(db, ATTENDANCE_COLLECTION),
        where('class_id', '==', classId),
        orderBy('date', 'desc')
      );

      const snapshot = await getDocs(q);
      const records = snapshot.docs
        .map((doc) => {
          const data = doc.data();
          return {
            ...data,
            marked_at: (data.marked_at as Timestamp)?.toDate?.().toISOString?.() || data.marked_at,
            created_at: (data.created_at as Timestamp)?.toDate?.().toISOString?.() || data.created_at,
            updated_at: (data.updated_at as Timestamp)?.toDate?.().toISOString?.() || data.updated_at,
          } as StudentAttendance;
        })
        .filter((record) => record.date >= startDate && record.date <= endDate);

      return { success: true, data: records };
    } catch (error) {
      console.error('Error fetching class attendance by date range:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get attendance statistics for a student in a class
   */
  static async getStudentAttendanceStatistics(
    studentId: string,
    classId: string
  ): Promise<{
    success: boolean;
    data?: StudentAttendanceStatistics;
    error?: string;
  }> {
    try {
      const attendanceResult = await this.getStudentAttendance(studentId, classId);

      if (!attendanceResult.success || !attendanceResult.data) {
        return { success: false, error: 'Failed to retrieve attendance records' };
      }

      const records = attendanceResult.data;

      if (records.length === 0) {
        return {
          success: true,
          data: {
            student_id: studentId,
            class_id: classId,
            total_sessions: 0,
            present_count: 0,
            absent_count: 0,
            late_count: 0,
            excused_count: 0,
            on_leave_count: 0,
            attendance_percentage: 0,
            records: [],
          },
        };
      }

      const presentCount = records.filter((r) => r.status === 'present').length;
      const absentCount = records.filter((r) => r.status === 'absent').length;
      const lateCount = records.filter((r) => r.status === 'late').length;
      const excusedCount = records.filter((r) => r.status === 'excused').length;
      const onLeaveCount = records.filter((r) => r.status === 'on-leave').length;

      // Count present + late + excused as "attending"
      const attendingCount = presentCount + lateCount + excusedCount;
      const attendancePercentage = Math.round((attendingCount / records.length) * 100);

      return {
        success: true,
        data: {
          student_id: studentId,
          class_id: classId,
          total_sessions: records.length,
          present_count: presentCount,
          absent_count: absentCount,
          late_count: lateCount,
          excused_count: excusedCount,
          on_leave_count: onLeaveCount,
          attendance_percentage: attendancePercentage,
          records,
        },
      };
    } catch (error) {
      console.error('Error calculating student attendance statistics:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get attendance statistics for a class
   */
  static async getClassAttendanceStatistics(classId: string, date?: string): Promise<{
    success: boolean;
    data?: ClassAttendanceStatistics;
    error?: string;
  }> {
    try {
      let attendanceResult;

      if (date) {
        attendanceResult = await this.getClassAttendanceByDate(classId, date);
      } else {
        // Get all records for the class
        const q = query(collection(db, ATTENDANCE_COLLECTION), where('class_id', '==', classId));
        const snapshot = await getDocs(q);
        const records = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            ...data,
            marked_at: (data.marked_at as Timestamp)?.toDate?.().toISOString?.() || data.marked_at,
            created_at: (data.created_at as Timestamp)?.toDate?.().toISOString?.() || data.created_at,
            updated_at: (data.updated_at as Timestamp)?.toDate?.().toISOString?.() || data.updated_at,
          } as StudentAttendance;
        });
        attendanceResult = { success: true, data: records };
      }

      if (!attendanceResult.success || !attendanceResult.data) {
        return { success: false, error: 'Failed to retrieve attendance records' };
      }

      const records = attendanceResult.data;

      if (records.length === 0) {
        return {
          success: true,
          data: {
            class_id: classId,
            date,
            total_students: 0,
            present_count: 0,
            absent_count: 0,
            late_count: 0,
            excused_count: 0,
            on_leave_count: 0,
            average_attendance_percentage: 0,
          },
        };
      }

      const presentCount = records.filter((r) => r.status === 'present').length;
      const absentCount = records.filter((r) => r.status === 'absent').length;
      const lateCount = records.filter((r) => r.status === 'late').length;
      const excusedCount = records.filter((r) => r.status === 'excused').length;
      const onLeaveCount = records.filter((r) => r.status === 'on-leave').length;

      const attendingCount = presentCount + lateCount + excusedCount;
      const uniqueStudents = new Set(records.map((r) => r.student_id)).size;
      const averageAttendancePercentage = Math.round((attendingCount / records.length) * 100);

      return {
        success: true,
        data: {
          class_id: classId,
          date,
          total_students: uniqueStudents,
          present_count: presentCount,
          absent_count: absentCount,
          late_count: lateCount,
          excused_count: excusedCount,
          on_leave_count: onLeaveCount,
          average_attendance_percentage: averageAttendancePercentage,
        },
      };
    } catch (error) {
      console.error('Error calculating class attendance statistics:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Update an attendance record
   */
  static async updateAttendance(
    attendanceId: string,
    updates: Partial<AttendanceInputData> & { updated_by: string }
  ): Promise<{
    success: boolean;
    data?: StudentAttendance;
    error?: string;
  }> {
    try {
      const attendanceRef = doc(db, ATTENDANCE_COLLECTION, attendanceId);
      const attendanceDoc = await getDoc(attendanceRef);

      if (!attendanceDoc.exists()) {
        return { success: false, error: `Attendance record with ID ${attendanceId} not found` };
      }

      const updateData: any = {
        updated_at: serverTimestamp(),
        updated_by: updates.updated_by,
      };

      if (updates.status !== undefined) {
        updateData.status = updates.status;
      }

      if (updates.remarks !== undefined) {
        updateData.remarks = updates.remarks;
      }

      await updateDoc(attendanceRef, updateData);

      const updatedDoc = await getDoc(attendanceRef);
      const data = updatedDoc.data() as StudentAttendance;

      return { success: true, data };
    } catch (error) {
      console.error('Error updating attendance:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Delete an attendance record
   */
  static async deleteAttendance(attendanceId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const attendanceRef = doc(db, ATTENDANCE_COLLECTION, attendanceId);
      const attendanceDoc = await getDoc(attendanceRef);

      if (!attendanceDoc.exists()) {
        return { success: false, error: `Attendance record with ID ${attendanceId} not found` };
      }

      await deleteDoc(attendanceRef);
      return { success: true };
    } catch (error) {
      console.error('Error deleting attendance:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get attendance for a date range for a student
   */
  static async getStudentAttendanceByDateRange(
    studentId: string,
    classId: string,
    startDate: string,
    endDate: string
  ): Promise<{
    success: boolean;
    data?: StudentAttendance[];
    error?: string;
  }> {
    try {
      const result = await this.getStudentAttendance(studentId, classId);

      if (!result.success || !result.data) {
        return { success: false, error: 'Failed to retrieve attendance records' };
      }

      const filtered = result.data.filter((record) => record.date >= startDate && record.date <= endDate);

      return { success: true, data: filtered };
    } catch (error) {
      console.error('Error fetching attendance by date range:', error);
      return { success: false, error: (error as Error).message };
    }
  }
}
