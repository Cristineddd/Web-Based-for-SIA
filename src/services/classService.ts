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
  type DocumentData,
  type Query,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface Student {
  student_id: string;
  first_name: string;
  last_name: string;
  email?: string;
  section?: string;
  grade?: string;
  validation_status?: "official" | "unvalidated";
}

export interface Class {
  id: string;
  class_name: string;
  course_subject: string;
  section_block?: string;
  year?: string; // Optional year field
  room?: string;
  semester?: string;
  students: Student[];
  created_at: string;
  createdBy?: string;
  instructorId?: string; // Instructor ID for the class creator
  updatedAt?: string; 
  isArchived?: boolean;
}

const CLASSES_COLLECTION = "classes";

const FIRESTORE_BATCH_LIMIT = 450;

function isPermissionDeniedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const firestoreError = error as { code?: string; message?: string };
  const message = (firestoreError.message || "").toLowerCase();
  return (
    firestoreError.code === "permission-denied" ||
    message.includes("missing or insufficient permissions")
  );
}

function stripUndefinedDeep(value: any): any {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Array.isArray(value)) {
    // Keep array shape, but strip undefined items and strip undefined fields inside objects.
    return value
      .map((v) => stripUndefinedDeep(v))
      .filter((v) => v !== undefined);
  }
  if (typeof value === "object") {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      const cleaned = stripUndefinedDeep(v);
      if (cleaned !== undefined) out[k] = cleaned;
    }
    return out;
  }
  return value;
}

async function deleteDocsInBatches(
  docs: QueryDocumentSnapshot<DocumentData>[],
): Promise<void> {
  for (let i = 0; i < docs.length; i += FIRESTORE_BATCH_LIMIT) {
    const batch = writeBatch(db);
    docs.slice(i, i + FIRESTORE_BATCH_LIMIT).forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });
    await batch.commit();
  }
}

async function deleteDocsByQuery(q: Query<DocumentData>): Promise<number> {
  try {
    const snap = await getDocs(q);
    if (snap.empty) return 0;
    await deleteDocsInBatches(snap.docs);
    return snap.size;
  } catch (error) {
    if (isPermissionDeniedError(error)) {
      console.warn("[deleteClass] Skipping restricted collection cleanup:", error);
      return 0;
    }
    throw error;
  }
}

/**
 * Create a new class in Firestore
 */
export async function createClass(
  classData: Omit<Class, "id">,
  userId: string,
  instructorId?: string, // Add instructorId parameter
): Promise<Class> {
  try {
    console.log("[CREATE] Creating class...");
    console.log("  - Class data:", classData);
    console.log("  - User ID:", userId);
    console.log("  - Instructor ID:", instructorId);

    if (!instructorId) {
      console.warn("[WARNING] WARNING: instructorId is undefined or null!");
    }

    // Firestore rejects `undefined` anywhere in the payload. Normalize + strip it.
    // Also: this codebase uses both `created_at` (string) and `createdAt` (Timestamp).
    const newClassData = stripUndefinedDeep({
      ...classData,
      createdBy: userId, // Keep userId for backward compatibility
      instructorId: instructorId || undefined,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    console.log("[SEND] Sending to Firestore:", newClassData);
    const docRef = await addDoc(
      collection(db, CLASSES_COLLECTION),
      newClassData,
    );
    console.log("[SUCCESS] Class created successfully with ID:", docRef.id);

    // Fetch the saved document to get server timestamps
    const savedDoc = await getDoc(docRef);
    const savedData = savedDoc.data() as any;

    // Return the class with the generated ID (include instructorId)
    const newClass: Class = {
      id: docRef.id,
      ...classData,
      createdBy: userId,
      ...(instructorId && { instructorId: instructorId }), // Include instructorId in return value
      created_at:
        savedData.created_at ||
        savedData.createdAt?.toDate?.()?.toISOString() ||
        new Date().toISOString(),
      updatedAt: savedData.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    };

    return newClass;
  } catch (error) {
    console.error("Error creating class:", error);
    console.error("Error code:", (error as any).code);
    console.error("Error message:", (error as any).message);
    throw error;
  }
}

/**
 * Get total student count for a user (lightweight - for dashboard)
 * Uses client-side filtering to avoid composite index requirement
 */
export async function getTotalStudentCount(userId: string): Promise<number> {
  try {
    // Fetch all classes without filters to avoid composite index
    const q = query(collection(db, CLASSES_COLLECTION));
    const querySnapshot = await getDocs(q);
    let totalStudents = 0;

    querySnapshot.forEach((doc) => {
      const data = doc.data() as any;
      // Filter by userId on client-side
      if (data.createdBy === userId) {
        totalStudents += data.students?.length || 0;
      }
    });

    return totalStudents;
  } catch (error: any) {
    console.error("Error fetching student count:", error);
    return 0;
  }
}

/**
 * Get all classes for a user
 */
export async function getClasses(userId?: string): Promise<Class[]> {
  try {
    let q;

    if (userId) {
      // Query only by createdBy (no orderBy to avoid index requirement)
      q = query(
        collection(db, CLASSES_COLLECTION),
        where("createdBy", "==", userId),
      );
    } else {
      q = query(
        collection(db, CLASSES_COLLECTION),
        orderBy("createdAt", "desc"),
      );
    }

    const querySnapshot = await getDocs(q);
    const classes: Class[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data() as any;

      // Skip archived classes in the main class list
      if (data.isArchived === true) {
        return;
      }

      classes.push({
        id: doc.id,
        class_name: data.class_name,
        course_subject: data.course_subject,
        section_block: data.section_block,
        year: data.year,
        room: data.room,
        students: data.students || [],
        created_at:
          data.created_at ||
          data.createdAt?.toDate?.()?.toISOString() ||
          new Date().toISOString(),
        createdBy: data.createdBy,
        instructorId: data.instructorId,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString(),
        isArchived: data.isArchived || false,
      });
    });

    // Sort in JavaScript if filtering by user
    if (userId) {
      classes.sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return dateB - dateA; // descending order (newest first)
      });
    }

    return classes;
  } catch (error) {
    console.error("Error fetching classes:", error);
    throw error;
  }
}

/**
 * Get a single class by ID
 */
export async function getClassById(classId: string): Promise<Class | null> {
  try {
    const docRef = doc(db, CLASSES_COLLECTION, classId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data() as any;
      return {
        id: docSnap.id,
        class_name: data.class_name,
        course_subject: data.course_subject,
        section_block: data.section_block,
        year: data.year,
        room: data.room,
        students: data.students || [],
        created_at:
          data.created_at ||
          data.createdAt?.toDate?.()?.toISOString() ||
          new Date().toISOString(),
        createdBy: data.createdBy,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString(),
      };
    }

    return null;
  } catch (error) {
    console.error("Error fetching class:", error);
    throw error;
  }
}

// Alias for getClassById for compatibility
export const getClass = getClassById;

/**
 * Update a class
 */
export async function updateClass(
  classId: string,
  classData: Partial<Omit<Class, "id">>,
): Promise<void> {
  try {
    const classRef = doc(db, CLASSES_COLLECTION, classId);

    // Remove undefined and null values from the update data
    const cleanData: Record<string, any> = {};

    Object.entries(classData).forEach(([key, value]) => {
      // Skip undefined and null values
      if (value !== undefined && value !== null) {
        // Handle arrays (like students)
        if (Array.isArray(value)) {
          // Clean each object in the array
          cleanData[key] = value.map((item: any) => {
            if (typeof item === "object" && item !== null) {
              const cleanedItem: Record<string, any> = {};
              Object.entries(item).forEach(([itemKey, itemValue]) => {
                if (itemValue !== undefined && itemValue !== null) {
                  cleanedItem[itemKey] = itemValue;
                }
              });
              return cleanedItem;
            }
            return item;
          });
        } else if (typeof value === "object") {
          // For objects, also clean nested undefined values
          const cleanedObject: Record<string, any> = {};
          Object.entries(value).forEach(([nestedKey, nestedValue]) => {
            if (nestedValue !== undefined && nestedValue !== null) {
              cleanedObject[nestedKey] = nestedValue;
            }
          });
          if (Object.keys(cleanedObject).length > 0) {
            cleanData[key] = cleanedObject;
          }
        } else {
          cleanData[key] = value;
        }
      }
    });

    // Add timestamp
    cleanData.updatedAt = serverTimestamp();

    console.log("Final data being sent to Firestore:", cleanData);
    console.log(
      "Checking for undefined values:",
      Object.entries(cleanData).filter(([_k, v]) => v === undefined),
    );

    await updateDoc(classRef, cleanData);
  } catch (error) {
    console.error("Error updating class:", error);
    throw error;
  }
}

/**
 * Delete a class
 */
export async function deleteClass(classId: string): Promise<void> {
  try {
    const classRef = doc(db, CLASSES_COLLECTION, classId);
    const classSnap = await getDoc(classRef);

    if (!classSnap.exists()) {
      return;
    }

    const classData = classSnap.data() as { class_name?: string };
    const className = classData.class_name?.trim() || "";

    const examDocsById = new Map<string, QueryDocumentSnapshot<DocumentData>>();
    const examsByClassIdSnap = await getDocs(
      query(collection(db, "exams"), where("classId", "==", classId)),
    );
    examsByClassIdSnap.docs.forEach((docSnap) => {
      examDocsById.set(docSnap.id, docSnap);
    });

    if (className) {
      const examsByClassNameSnap = await getDocs(
        query(collection(db, "exams"), where("className", "==", className)),
      );
      examsByClassNameSnap.docs.forEach((docSnap) => {
        const examData = docSnap.data() as { classId?: string };
        const examClassId = examData.classId?.trim();
        // Guard against cross-class deletes when classes share names.
        if (examClassId && examClassId !== classId) return;
        examDocsById.set(docSnap.id, docSnap);
      });
    }

    const examIds = Array.from(examDocsById.keys());
    for (const examId of examIds) {
      await deleteDocsByQuery(
        query(collection(db, "templates"), where("examId", "==", examId)),
      );
      await deleteDocsByQuery(
        query(collection(db, "scannedResults"), where("examId", "==", examId)),
      );
      await deleteDocsByQuery(
        query(collection(db, "studentGrades"), where("exam_id", "==", examId)),
      );
      await deleteDocsByQuery(
        query(collection(db, "studentGrades"), where("examId", "==", examId)),
      );
    }

    // Remove student-grade rows directly linked by class fields (legacy/new variants).
    await deleteDocsByQuery(
      query(collection(db, "studentGrades"), where("class_id", "==", classId)),
    );
    await deleteDocsByQuery(
      query(collection(db, "studentGrades"), where("classId", "==", classId)),
    );

    // Remove flattened student records used by import and validation flows.
    await deleteDocsByQuery(
      query(collection(db, "students"), where("class_id", "==", classId)),
    );

    if (examDocsById.size > 0) {
      await deleteDocsInBatches(Array.from(examDocsById.values()));
    }

    await deleteDoc(classRef);
  } catch (error) {
    console.error("Error deleting class:", error);
    throw error;
  }
}

/**
 * Add a student to a class
 */
export async function addStudentToClass(
  classId: string,
  student: Student,
): Promise<void> {
  try {
    const classRef = doc(db, CLASSES_COLLECTION, classId);
    const classDoc = await getDoc(classRef);

    if (classDoc.exists()) {
      const data = classDoc.data() as any;
      const currentStudents = data.students || [];
      await updateDoc(classRef, {
        students: [...currentStudents, student],
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error("Error adding student to class:", error);
    throw error;
  }
}

/**
 * Remove a student from a class
 */
export async function removeStudentFromClass(
  classId: string,
  studentId: string,
): Promise<void> {
  try {
    const classRef = doc(db, CLASSES_COLLECTION, classId);
    const classDoc = await getDoc(classRef);

    if (classDoc.exists()) {
      const data = classDoc.data() as any;
      const currentStudents = data.students || [];
      const updatedStudents = currentStudents.filter(
        (s: Student) => s.student_id !== studentId,
      );
      await updateDoc(classRef, {
        students: updatedStudents,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error("Error removing student from class:", error);
    throw error;
  }
}

/**
 * Get archived classes for a specific user
 */
export async function getArchivedClasses(userId?: string): Promise<Class[]> {
  try {
    let q;

    if (userId) {
      // Query archived classes by createdBy
      q = query(
        collection(db, CLASSES_COLLECTION),
        where("createdBy", "==", userId),
        where("isArchived", "==", true),
      );
    } else {
      q = query(
        collection(db, CLASSES_COLLECTION),
        where("isArchived", "==", true),
        orderBy("createdAt", "desc"),
      );
    }

    const querySnapshot = await getDocs(q);
    const classes: Class[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data() as any;
      classes.push({
        id: doc.id,
        class_name: data.class_name,
        course_subject: data.course_subject,
        year: data.year,
        room: data.room,
        students: data.students || [],
        created_at:
          data.created_at ||
          data.createdAt?.toDate?.()?.toISOString() ||
          new Date().toISOString(),
        createdBy: data.createdBy,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString(),
        isArchived: data.isArchived || false,
      });
    });

    // Sort in JavaScript if filtering by user
    if (userId) {
      classes.sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return dateB - dateA; // descending order (newest first)
      });
    }

    return classes;
  } catch (error) {
    console.error("Error fetching archived classes:", error);
    throw error;
  }
}
