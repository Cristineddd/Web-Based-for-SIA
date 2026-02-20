import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { StudentIDValidationService } from './studentIDValidationService';
import {
  validateCreateStudentInput,
  validateUpdateStudentInput,
} from '@/middleware/studentValidationMiddleware';

export interface StudentRecord {
  student_id: string; // PRIMARY KEY
  first_name: string;
  last_name: string;
  email?: string;
  section?: string;
  phone?: string;
  archived?: boolean;
  deleted_at?: string;
  deleted_by?: string;
  enrolled_classes: string[]; // Array of class IDs
  created_at: string;
  updated_at: string;
  created_by: string;
  validation_status?: 'official' | 'unvalidated' | 'pending'; // Validation status
  validation_date?: string; // Date when record was marked official
  validated_by?: string; // Admin/user who validated the record
}

export interface StudentEnrollment {
  student_id: string; // PRIMARY KEY
  class_id: string;
  enrolled_date: string;
  status: 'active' | 'inactive' | 'dropped';
}

export interface StudentExamResult {
  result_id: string;
  student_id: string; // PRIMARY KEY for linking
  exam_id: string;
  score: number;
  total_questions: number;
  answers: string[];
  scanned_at: string;
  scanned_by: string;
  is_null_id: boolean;
}

const STUDENTS_COLLECTION = 'students';
const ENROLLMENTS_COLLECTION = 'studentEnrollments';
const EXAM_RESULTS_COLLECTION = 'studentExamResults';

export class StudentService {
  /**
   * Get all students, optionally filtered by creator
   */
  static async getAllStudents(userId?: string): Promise<StudentRecord[]> {
    try {
      const q = userId
        ? query(
            collection(db, STUDENTS_COLLECTION),
            where('created_by', '==', userId)
          )
        : query(collection(db, STUDENTS_COLLECTION));

      const snapshot = await getDocs(q);
      const students = snapshot.docs.map((studentDoc) => {
        const data = studentDoc.data() as any;
        return {
          student_id: data.student_id || studentDoc.id,
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          email: data.email || undefined,
          section: data.section || data.block || undefined,
          phone: data.phone || undefined,
          enrolled_classes: data.enrolled_classes || [],
          created_at:
            data.created_at?.toDate?.()?.toISOString?.() ||
            data.created_at ||
            new Date().toISOString(),
          updated_at:
            data.updated_at?.toDate?.()?.toISOString?.() ||
            data.updated_at ||
            new Date().toISOString(),
          created_by: data.created_by || '',
          validation_status: data.validation_status,
          validation_date:
            data.validation_date?.toDate?.()?.toISOString?.() ||
            data.validation_date,
          validated_by: data.validated_by,
          archived: !!data.archived,
          deleted_at:
            data.deleted_at?.toDate?.()?.toISOString?.() ||
            data.deleted_at,
          deleted_by: data.deleted_by,
        } as StudentRecord;
      });

      return students.filter((student) => !student.archived);
    } catch (error) {
      console.error('Error fetching students:', error);
      return [];
    }
  }

  /**
   * Create a new student record with Student ID as primary key
   * @throws Error if student ID already exists or fails validation
   */
  static async createStudent(
    student_id: string,
    first_name: string,
    last_name: string,
    email: string | undefined,
    created_by: string,
    section?: string
  ): Promise<StudentRecord> {
    const { normalizedStudentId } = await validateCreateStudentInput({
      student_id,
      first_name,
      last_name,
    });

    // Check if student already exists (prevent duplicates)
    try {
      const existingStudent = await this.getStudentById(normalizedStudentId);
      if (existingStudent) {
        throw new Error(
          `Student ID "${normalizedStudentId}" already exists in the system. ` +
          `Existing student: ${existingStudent.first_name} ${existingStudent.last_name} ` +
          `(created: ${new Date(existingStudent.created_at).toLocaleDateString()})`
        );
      }
    } catch (error) {
      // Re-throw if it's our custom duplicate error
      if ((error as Error).message.includes('already exists')) {
        throw error;
      }
      // Log other errors but continue
      console.error('Error checking for existing student:', error);
    }

    const now = new Date().toISOString();
    const studentRecord: StudentRecord = {
      student_id: normalizedStudentId,
      first_name,
      last_name,
      email,
      section,
      enrolled_classes: [],
      created_at: now,
      updated_at: now,
      created_by,
    };

    try {
      const cleanStudentRecord = Object.fromEntries(
        Object.entries(studentRecord).filter(([, value]) => value !== undefined)
      );

      // Use student_id as the document ID for efficient queries
      await setDoc(doc(db, STUDENTS_COLLECTION, normalizedStudentId), {
        ...cleanStudentRecord,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      return studentRecord;
    } catch (error) {
      console.error(`Error creating student ${student_id}:`, error);
      throw new Error(`Failed to create student: ${(error as Error).message}`);
    }
  }

  /**
   * Get student record by Student ID (primary key lookup)
   */
  static async getStudentById(student_id: string): Promise<StudentRecord | null> {
    try {
      const normalizedStudentId = (student_id || '').trim();
      if (!normalizedStudentId) {
        return null;
      }

      const docSnap = await getDoc(doc(db, STUDENTS_COLLECTION, normalizedStudentId));
      return docSnap.exists() ? (docSnap.data() as StudentRecord) : null;
    } catch (error) {
      console.error(`Error fetching student ${student_id}:`, error);
      throw new Error(`Failed to fetch student: ${(error as Error).message}`);
    }
  }

  /**
   * Update student record
   */
  static async updateStudent(
    student_id: string,
    updates: Partial<StudentRecord>
  ): Promise<StudentRecord> {
    try {
      const normalizedStudentId = validateUpdateStudentInput({
        currentStudentId: student_id,
        requestedStudentId: updates.student_id,
      });

      // Don't allow changing student_id (primary key)
      const { student_id: _, ...safeUpdates } = updates;

      const updateData = {
        ...safeUpdates,
        updated_at: serverTimestamp(),
      };

      await updateDoc(doc(db, STUDENTS_COLLECTION, normalizedStudentId), updateData);

      // Return updated record
      const updated = await this.getStudentById(normalizedStudentId);
      if (!updated) {
        throw new Error('Failed to retrieve updated student record');
      }
      return updated;
    } catch (error) {
      console.error(`Error updating student ${student_id}:`, error);
      throw new Error(`Failed to update student: ${(error as Error).message}`);
    }
  }

  /**
   * Delete student record and cascade delete related data
   */
  static async deleteStudent(student_id: string, userId: string): Promise<void> {
    try {
      // Soft delete only: mark student as archived
      await updateDoc(doc(db, STUDENTS_COLLECTION, student_id), {
        archived: true,
        deleted_at: serverTimestamp(),
        deleted_by: userId,
        updated_at: serverTimestamp(),
      });
    } catch (error) {
      console.error(`Error deleting student ${student_id}:`, error);
      throw new Error(`Failed to delete student: ${(error as Error).message}`);
    }
  }

  /**
   * Enroll student in a class
   */
  static async enrollStudentInClass(
    student_id: string,
    class_id: string
  ): Promise<StudentEnrollment> {
    try {
      // Verify student exists
      const student = await this.getStudentById(student_id);
      if (!student) {
        throw new Error(`Student ${student_id} does not exist`);
      }

      // Check if already enrolled
      const existingEnrollment = await this.getEnrollment(student_id, class_id);
      if (existingEnrollment && existingEnrollment.status === 'active') {
        throw new Error(`Student ${student_id} is already enrolled in class ${class_id}`);
      }

      const now = new Date().toISOString();
      const enrollment_id = `${student_id}_${class_id}`;

      const enrollmentData: StudentEnrollment = {
        student_id,
        class_id,
        enrolled_date: now,
        status: 'active',
      };

      // Create enrollment record
      await setDoc(doc(db, ENROLLMENTS_COLLECTION, enrollment_id), {
        ...enrollmentData,
        enrolled_date: serverTimestamp(),
      });

      // Update student's enrolled_classes array
      await updateDoc(doc(db, STUDENTS_COLLECTION, student_id), {
        enrolled_classes: enrollment => {
          if (!enrollment) return [class_id];
          if (enrollment.includes(class_id)) return enrollment;
          return [...enrollment, class_id];
        },
        updated_at: serverTimestamp(),
      });

      return enrollmentData;
    } catch (error) {
      console.error(`Error enrolling student ${student_id} in class ${class_id}:`, error);
      throw new Error(`Failed to enroll student: ${(error as Error).message}`);
    }
  }

  /**
   * Get enrollment record
   */
  static async getEnrollment(
    student_id: string,
    class_id: string
  ): Promise<StudentEnrollment | null> {
    try {
      const enrollment_id = `${student_id}_${class_id}`;
      const docSnap = await getDoc(doc(db, ENROLLMENTS_COLLECTION, enrollment_id));
      return docSnap.exists() ? (docSnap.data() as StudentEnrollment) : null;
    } catch (error) {
      console.error(`Error fetching enrollment ${student_id}:${class_id}:`, error);
      return null;
    }
  }

  /**
   * Get all students enrolled in a class
   */
  static async getClassStudents(class_id: string): Promise<StudentRecord[]> {
    try {
      const enrollmentsQuery = query(
        collection(db, ENROLLMENTS_COLLECTION),
        where('class_id', '==', class_id),
        where('status', '==', 'active')
      );

      const enrollmentDocs = await getDocs(enrollmentsQuery);
      const studentIds = enrollmentDocs.docs.map(
        (doc) => (doc.data() as StudentEnrollment).student_id
      );

      const students: StudentRecord[] = [];
      for (const student_id of studentIds) {
        const student = await this.getStudentById(student_id);
        if (student) students.push(student);
      }

      return students;
    } catch (error) {
      console.error(`Error fetching class students for ${class_id}:`, error);
      return [];
    }
  }

  /**
   * Get all classes for a student
   */
  static async getStudentClasses(student_id: string): Promise<string[]> {
    try {
      const student = await this.getStudentById(student_id);
      return student?.enrolled_classes || [];
    } catch (error) {
      console.error(`Error fetching classes for student ${student_id}:`, error);
      return [];
    }
  }

  /**
   * Record exam result for student using student_id as foreign key
   */
  static async recordExamResult(
    exam_id: string,
    student_id: string,
    score: number,
    answers: string[],
    scanned_by: string,
    is_null_id: boolean = false
  ): Promise<StudentExamResult> {
    try {
      // Verify student exists
      const student = await this.getStudentById(student_id);
      if (!student) {
        throw new Error(`Student ${student_id} does not exist`);
      }

      const result_id = `result_${exam_id}_${student_id}_${Date.now()}`;
      const now = new Date().toISOString();

      const resultData: StudentExamResult = {
        result_id,
        student_id, // Foreign key reference
        exam_id,
        score,
        total_questions: answers.length,
        answers,
        scanned_at: now,
        scanned_by,
        is_null_id,
      };

      await setDoc(doc(db, EXAM_RESULTS_COLLECTION, result_id), {
        ...resultData,
        scanned_at: serverTimestamp(),
      });

      return resultData;
    } catch (error) {
      console.error(`Error recording exam result for student ${student_id}:`, error);
      throw new Error(`Failed to record exam result: ${(error as Error).message}`);
    }
  }

  /**
   * Get all exam results for a student
   */
  static async getStudentExamResults(student_id: string): Promise<StudentExamResult[]> {
    try {
      const resultsQuery = query(
        collection(db, EXAM_RESULTS_COLLECTION),
        where('student_id', '==', student_id)
      );

      const resultDocs = await getDocs(resultsQuery);
      return resultDocs.docs.map((doc) => doc.data() as StudentExamResult);
    } catch (error) {
      console.error(`Error fetching exam results for student ${student_id}:`, error);
      return [];
    }
  }

  /**
   * Validate student ID format and uniqueness
   */
  static async validateStudentId(student_id: string): Promise<{
    isValid: boolean;
    message?: string;
  }> {
    const formatValidation = StudentIDValidationService.validateStudentIdFormat(student_id);
    if (!formatValidation.isValid) {
      return { isValid: false, message: formatValidation.error || 'Invalid student ID format' };
    }

    const existing = await this.getStudentById(formatValidation.student_id);
    if (existing) {
      return { isValid: false, message: `Student ID "${formatValidation.student_id}" already exists` };
    }

    return { isValid: true };
  }

  /**
   * Bulk create students (with duplicate checking)
   */
  static async bulkCreateStudents(
    students: Array<{
      student_id: string;
      first_name: string;
      last_name: string;
      email?: string;
      section?: string;
    }>,
    created_by: string
  ): Promise<{ created: StudentRecord[]; errors: string[] }> {
    const created: StudentRecord[] = [];
    const errors: string[] = [];

    for (const student of students) {
      try {
        const result = await this.createStudent(
          student.student_id,
          student.first_name,
          student.last_name,
          student.email,
          created_by,
          student.section
        );
        created.push(result);
      } catch (error) {
        errors.push(`${student.student_id}: ${(error as Error).message}`);
      }
    }

    return { created, errors };
  }
}
