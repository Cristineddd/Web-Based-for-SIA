/**
 * Class Service - Updated to use Student ID as primary key
 * Classes now reference students by student_id instead of storing full student objects
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { StudentService } from './studentService';

/**
 * @deprecated Use StudentRecord from StudentService instead
 */
export interface Student {
  student_id: string;
  first_name: string;
  last_name: string;
  email?: string;
}

/**
 * Updated Class interface - uses student_id array instead of Student objects
 */
export interface Class {
  id: string;
  class_name: string;
  course_subject: string;
  section_block: string;
  room: string;
  student_ids: string[]; // PRIMARY KEY references to students
  created_at: string;
  createdBy?: string;
  updatedAt?: string;
}

const CLASSES_COLLECTION = 'classes';

/**
 * Create a new class in Firestore
 */
export async function createClass(
  classData: Omit<Class, 'id' | 'student_ids'> & { students?: Student[] },
  userId: string
): Promise<Class> {
  try {
    // Extract student IDs from student objects if provided (backward compatibility)
    const student_ids = classData.students
      ? classData.students.map((s) => s.student_id)
      : [];

    const newClassData = {
      class_name: classData.class_name,
      course_subject: classData.course_subject,
      section_block: classData.section_block,
      room: classData.room,
      student_ids, // Store only student_id references
      createdBy: userId,
      created_at: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, CLASSES_COLLECTION), newClassData);

    const newClass: Class = {
      id: docRef.id,
      class_name: classData.class_name,
      course_subject: classData.course_subject,
      section_block: classData.section_block,
      room: classData.room,
      student_ids,
      created_at: new Date().toISOString(),
      createdBy: userId,
      updatedAt: new Date().toISOString(),
    };

    return newClass;
  } catch (error) {
    console.error('Error creating class:', error);
    throw error;
  }
}

/**
 * Get all classes for a user
 */
export async function getClasses(userId?: string): Promise<Class[]> {
  try {
    let q;

    if (userId) {
      q = query(
        collection(db, CLASSES_COLLECTION),
        where('createdBy', '==', userId)
      );
    } else {
      q = query(collection(db, CLASSES_COLLECTION), orderBy('created_at', 'desc'));
    }

    const querySnapshot = await getDocs(q);
    const classes: Class[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data() as any;
      classes.push({
        id: doc.id,
        class_name: data.class_name,
        course_subject: data.course_subject,
        section_block: data.section_block,
        room: data.room || '',
        student_ids: data.student_ids || data.students?.map((s: any) => s.student_id) || [],
        created_at: data.created_at || data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        createdBy: data.createdBy,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString(),
      });
    });

    return classes;
  } catch (error) {
    console.error('Error fetching classes:', error);
    return [];
  }
}

/**
 * Get a single class by ID
 */
export async function getClass(classId: string): Promise<Class | null> {
  try {
    const docSnap = await getDoc(doc(db, CLASSES_COLLECTION, classId));

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data() as any;
    return {
      id: docSnap.id,
      class_name: data.class_name,
      course_subject: data.course_subject,
      section_block: data.section_block,
      room: data.room || '',
      student_ids: data.student_ids || data.students?.map((s: any) => s.student_id) || [],
      created_at: data.created_at || data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      createdBy: data.createdBy,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString(),
    };
  } catch (error) {
    console.error(`Error fetching class ${classId}:`, error);
    return null;
  }
}

/**
 * Update class information
 * @param classId - The ID of the class to update
 * @param classData - The data to update (excluding student_ids for safety)
 */
export async function updateClass(
  classId: string,
  classData: Partial<Omit<Class, 'id' | 'student_ids'>>
): Promise<Class | null> {
  try {
    const updateData = {
      ...classData,
      updatedAt: serverTimestamp(),
    };

    await updateDoc(doc(db, CLASSES_COLLECTION, classId), updateData);
    return getClass(classId);
  } catch (error) {
    console.error(`Error updating class ${classId}:`, error);
    throw error;
  }
}

/**
 * Delete a class (and optionally remove from student enrollments)
 */
export async function deleteClass(classId: string, userId?: string): Promise<void> {
  try {
    const classDoc = await getClass(classId);
    if (!classDoc) {
      throw new Error(`Class ${classId} not found`);
    }

    // Delete the class document
    await deleteDoc(doc(db, CLASSES_COLLECTION, classId));

    // Unenroll all students from this class
    if (classDoc.student_ids.length > 0) {
      const batch = writeBatch(db);
      for (const student_id of classDoc.student_ids) {
        try {
          // Remove class from student's enrolled_classes
          const studentDoc = await StudentService.getStudentById(student_id);
          if (studentDoc) {
            const updatedClasses = studentDoc.enrolled_classes.filter((id) => id !== classId);
            // Note: This would require updateDoc access to student document
          }
        } catch (error) {
          console.warn(`Error updating student ${student_id}:`, error);
        }
      }
      // Batch update would happen here in production
    }
  } catch (error) {
    console.error(`Error deleting class ${classId}:`, error);
    throw error;
  }
}

/**
 * Add a student to a class
 * @param classId - The ID of the class
 * @param student_id - The ID of the student to add
 */
export async function addStudentToClass(classId: string, student_id: string): Promise<Class | null> {
  try {
    // Verify student exists
    const student = await StudentService.getStudentById(student_id);
    if (!student) {
      throw new Error(`Student ${student_id} does not exist`);
    }

    const classDoc = await getClass(classId);
    if (!classDoc) {
      throw new Error(`Class ${classId} not found`);
    }

    // Check if student is already enrolled
    if (classDoc.student_ids.includes(student_id)) {
      throw new Error(`Student ${student_id} is already enrolled in this class`);
    }

    // Add student to class
    const updatedStudentIds = [...classDoc.student_ids, student_id];
    await updateDoc(doc(db, CLASSES_COLLECTION, classId), {
      student_ids: updatedStudentIds,
      updatedAt: serverTimestamp(),
    });

    // Also enroll in StudentService
    await StudentService.enrollStudentInClass(student_id, classId);

    return getClass(classId);
  } catch (error) {
    console.error(`Error adding student ${student_id} to class ${classId}:`, error);
    throw error;
  }
}

/**
 * Remove a student from a class
 */
export async function removeStudentFromClass(classId: string, student_id: string): Promise<Class | null> {
  try {
    const classDoc = await getClass(classId);
    if (!classDoc) {
      throw new Error(`Class ${classId} not found`);
    }

    const updatedStudentIds = classDoc.student_ids.filter((id) => id !== student_id);
    await updateDoc(doc(db, CLASSES_COLLECTION, classId), {
      student_ids: updatedStudentIds,
      updatedAt: serverTimestamp(),
    });

    return getClass(classId);
  } catch (error) {
    console.error(`Error removing student ${student_id} from class ${classId}:`, error);
    throw error;
  }
}

/**
 * Get all students in a class
 * @returns Array of StudentRecord objects (requires additional StudentService calls)
 */
export async function getClassStudents(classId: string): Promise<any[]> {
  try {
    const classDoc = await getClass(classId);
    if (!classDoc) {
      return [];
    }

    // Use StudentService to get full student records
    return StudentService.getClassStudents(classId);
  } catch (error) {
    console.error(`Error fetching students for class ${classId}:`, error);
    return [];
  }
}

/**
 * Bulk add students to a class
 * @param classId - The ID of the class
 * @param student_ids - Array of student IDs to add
 */
export async function bulkAddStudentsToClass(
  classId: string,
  student_ids: string[]
): Promise<{ added: string[]; failed: string[] }> {
  const added: string[] = [];
  const failed: string[] = [];

  for (const student_id of student_ids) {
    try {
      await addStudentToClass(classId, student_id);
      added.push(student_id);
    } catch (error) {
      failed.push(`${student_id}: ${(error as Error).message}`);
    }
  }

  return { added, failed };
}

/**
 * Update class students (replace entire student list)
 * @param classId - The ID of the class
 * @param student_ids - New array of student IDs
 */
export async function updateClassStudents(
  classId: string,
  student_ids: string[]
): Promise<Class | null> {
  try {
    // Verify all students exist
    const studentVerification = await Promise.all(
      student_ids.map((id) => StudentService.getStudentById(id))
    );

    const invalidStudents = student_ids.filter((_, i) => !studentVerification[i]);
    if (invalidStudents.length > 0) {
      throw new Error(`Invalid student IDs: ${invalidStudents.join(', ')}`);
    }

    await updateDoc(doc(db, CLASSES_COLLECTION, classId), {
      student_ids,
      updatedAt: serverTimestamp(),
    });

    return getClass(classId);
  } catch (error) {
    console.error(`Error updating students for class ${classId}:`, error);
    throw error;
  }
}

/**
 * Export class data (for backups or reports)
 */
export async function exportClassData(
  classId: string
): Promise<{
  class: Class;
  students: any[];
  enrollmentCount: number;
}> {
  try {
    const classDoc = await getClass(classId);
    if (!classDoc) {
      throw new Error(`Class ${classId} not found`);
    }

    const students = await getClassStudents(classId);

    return {
      class: classDoc,
      students,
      enrollmentCount: classDoc.student_ids.length,
    };
  } catch (error) {
    console.error(`Error exporting class data for ${classId}:`, error);
    throw error;
  }
}
