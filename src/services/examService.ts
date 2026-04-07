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
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * Generate a unique exam code (e.g., "EX-A1B2C3")
 * This code is printed on answer sheets to identify which exam they belong to
 */
function generateExamCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Exclude confusing chars like 0/O, 1/I/L
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `EX-${code}`;
}

export interface Exam {
  id: string;
  title: string;
  subject: string;
  num_items: number;
  choices_per_item: number;
  student_id_length?: number;
  created_at: string;
  answer_keys: string[];
  generated_sheets: GeneratedSheet[];
  createdBy?: string;
  instructorId?: string; // Instructor ID for the exam creator
  updatedAt?: string;
  className?: string;
  classId?: string; // Class ID linking exam to a class
  examType?: "board" | "diagnostic";
  choicePoints?: { [choice: string]: number };
  isArchived?: boolean;
  archivedAt?: string;
  examCode?: string; // Unique exam code for template validation (e.g., "EX-A1B2C3")
  status?: "draft" | "final"; // Status to control editability
  institutionName?: string;
  logoUrl?: string;
}

export interface GeneratedSheet {
  id: string;
  sheet_count: number;
  created_at: string;
  examCode?: string; // Links this batch to the exam code printed on sheets
  batchNumber?: number; // Sequential batch number (1, 2, 3…)
}

// ── Exam Edit Business Rules ──────────────────────────────────────────────

/**
 * Message shown to users when editing is blocked.
 */
export const EDIT_RESTRICTION_MESSAGE =
  "Editing is not allowed once the exam date has been reached.";

/**
 * Determines whether an exam can still be edited.
 *
 * Business rules:
 *   1. Exams with status "final" cannot be edited.
 *   2. Exams are editable only **before** their scheduled date (`created_at`).
 *      Once today's date is equal to or past the exam date, all edits are blocked.
 *
 * @param exam - The exam (or any object with `created_at` and optional `status`).
 * @returns `true` if the exam can be edited; `false` otherwise.
 */
export function canEditExam(
  exam: Pick<Exam, "created_at"> & { status?: string },
): boolean {
  // Finalized exams are never editable
  if (exam.status === "final") return false;

  // Block editing once the exam date has been reached
  const examDate = new Date(exam.created_at);
  examDate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today < examDate;
}

export interface ExamFormData {
  name: string;
  totalQuestions: number;
  date: string;
  folder: string;
  className?: string;
  classId?: string;
  choicesPerItem?: number;
  examType?: "board" | "diagnostic";
  choicePoints?: { [choice: string]: number };
}

/**
 * Create a new exam in Firestore
 */
export async function createExam(
  formData: ExamFormData,
  userId: string,
  instructorId?: string, // Add instructorId parameter
): Promise<Exam> {
  try {
    console.log("📝 Creating exam...");
    console.log("  - Exam data:", formData);
    console.log("  - User ID:", userId);
    console.log("  - Instructor ID:", instructorId);

    if (!instructorId) {
      console.warn("⚠️ WARNING: instructorId is undefined or null!");
    }

    // Generate a unique exam code for this exam
    const examCode = generateExamCode();
    console.log("  - Generated Exam Code:", examCode);

    const examData = {
      title: formData.name,
      subject: formData.folder,
      num_items: formData.totalQuestions,
      choices_per_item: formData.choicesPerItem || 4,
      created_at: formData.date,
      answer_keys: [],
      generated_sheets: [],
      createdBy: userId, // Keep userId for backward compatibility
      ...(instructorId && { instructorId: instructorId }), // Only include if not undefined
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      className: formData.className || null,
      classId: formData.classId || null,
      examType: formData.examType || "board",
      choicePoints: formData.choicePoints || {},
      examCode: examCode, // Unique code for template validation
      status: "draft", // New field: initial status is draft
    };
    const docRef = await addDoc(collection(db, "exams"), examData);

    // Return the exam with the generated ID (include instructorId)
    const newExam: Exam = {
      id: docRef.id,
      title: examData.title,
      subject: examData.subject,
      num_items: examData.num_items,
      choices_per_item: examData.choices_per_item,
      created_at: examData.created_at,
      answer_keys: examData.answer_keys,
      generated_sheets: examData.generated_sheets,
      createdBy: userId,
      ...(instructorId && { instructorId: instructorId }), // Include instructorId in return value
      updatedAt: new Date().toISOString(),
      className: examData.className || undefined,
      classId: examData.classId || undefined,
      examType: examData.examType || "board",
      choicePoints: examData.choicePoints,
      examCode: examCode, // Include examCode in return value
    };

    return newExam;
  } catch (error) {
    console.error("Error creating exam:", error);
    throw new Error("Failed to create exam");
  }
}

/**
 * Get recent exams for a user (lightweight - for dashboard)
 * Uses client-side filtering to avoid composite index requirement
 */
export async function getRecentExams(
  userId: string,
  limit: number = 5,
): Promise<Exam[]> {
  try {
    // Fetch all exams without filters to avoid composite index
    const q = query(collection(db, "exams"));
    const querySnapshot = await getDocs(q);
    const exams: Exam[] = [];

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      // Filter by userId on client-side and exclude archived exams
      if (data.createdBy === userId && !data.isArchived) {
        // Back-fill examCode for legacy exams
        let examCode = data.examCode;
        if (!examCode) {
          examCode = generateExamCode();
          const docRef = doc(db, "exams", docSnap.id);
          updateDoc(docRef, { examCode }).catch((err) => {
            console.warn("Failed to back-fill exam code:", err);
          });
        }
        exams.push({
          id: docSnap.id,
          title: data.title,
          subject: data.subject,
          num_items: data.num_items,
          choices_per_item: data.choices_per_item,
          created_at:
            data.created_at ||
            data.createdAt?.toDate?.().toISOString() ||
            new Date().toISOString(),
          answer_keys: data.answer_keys || [],
          generated_sheets: data.generated_sheets || [],
          createdBy: data.createdBy,
          updatedAt:
            data.updatedAt?.toDate?.().toISOString() ||
            new Date().toISOString(),
          className: data.className || undefined,
          isArchived: data.isArchived,
          examCode: examCode,
        });
      }
    });

    // Sort and limit
    exams.sort((a, b) => {
      const dateA = new Date(a.updatedAt || a.created_at).getTime();
      const dateB = new Date(b.updatedAt || b.created_at).getTime();
      return dateB - dateA;
    });

    return exams.slice(0, limit);
  } catch (error: any) {
    console.error("Error fetching recent exams:", error);
    return [];
  }
}

export async function getExamCount(userId: string): Promise<number> {
  try {
    // Fetch all exams without filters to avoid composite index
    const q = query(collection(db, "exams"));
    const querySnapshot = await getDocs(q);
    let count = 0;

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      // Filter by userId on client-side and exclude archived exams
      if (data.createdBy === userId && !data.isArchived) {
        count++;
      }
    });

    return count;
  } catch (error: any) {
    console.error("Error fetching exam count:", error);
    return 0;
  }
}

/**
 * Get all exams for a user
 */
export async function getExams(userId?: string): Promise<Exam[]> {
  try {
    // If userId is provided, query with filter to avoid permission issues
    const q = userId
      ? query(collection(db, "exams"), where("createdBy", "==", userId))
      : query(collection(db, "exams"));

    const querySnapshot = await getDocs(q);
    const exams: Exam[] = [];
    const updatePromises: Promise<void>[] = [];

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      // Filter by userId if provided (additional client-side check)
      // Also filter out archived exams
      if ((!userId || data.createdBy === userId) && !data.isArchived) {
        // Back-fill examCode for legacy exams that don't have one
        let examCode = data.examCode;
        if (!examCode) {
          examCode = generateExamCode();
          // Queue background update (non-blocking)
          const docRef = doc(db, "exams", docSnap.id);
          updatePromises.push(
            updateDoc(docRef, { examCode }).catch((err) => {
              console.warn("Failed to back-fill exam code:", err);
            }),
          );
        }
        exams.push({
          id: docSnap.id,
          title: data.title,
          subject: data.subject,
          num_items: data.num_items,
          choices_per_item: data.choices_per_item,
          created_at:
            data.created_at ||
            data.createdAt?.toDate?.().toISOString() ||
            new Date().toISOString(),
          answer_keys: data.answer_keys || [],
          generated_sheets: data.generated_sheets || [],
          createdBy: data.createdBy,
          updatedAt:
            data.updatedAt?.toDate?.().toISOString() ||
            new Date().toISOString(),
          className: data.className || undefined,
          classId: data.classId || undefined,
          isArchived: data.isArchived,
          examCode: examCode,
        });
      }
    });

    // Sort in JavaScript after fetching
    exams.sort((a, b) => {
      const dateA = new Date(a.updatedAt || a.created_at).getTime();
      const dateB = new Date(b.updatedAt || b.created_at).getTime();
      return dateB - dateA;
    });

    // Fire off background updates without waiting
    if (updatePromises.length > 0) {
      Promise.allSettled(updatePromises).then(() => {
        console.log(
          `Updated ${updatePromises.length} exam codes in background`,
        );
      });
    }

    return exams;
  } catch (error: any) {
    console.error("Error fetching exams:", error);
    throw new Error("Failed to fetch exams");
  }
}

/**
 * Get a single exam by ID
 */
export async function getExamById(examId: string): Promise<Exam | null> {
  try {
    const docRef = doc(db, "exams", examId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();

    // If exam doesn't have an examCode, generate one and save it (for legacy exams)
    let examCode = data.examCode;
    if (!examCode) {
      examCode = generateExamCode();
      // Update the exam with the new code (fire and forget)
      updateDoc(docRef, { examCode }).catch((err) => {
        console.warn("Failed to save generated exam code:", err);
      });
    }

    return {
      id: docSnap.id,
      title: data.title,
      subject: data.subject,
      num_items: data.num_items,
      choices_per_item: data.choices_per_item,
      student_id_length: data.student_id_length,
      created_at:
        data.created_at ||
        data.createdAt?.toDate?.().toISOString() ||
        new Date().toISOString(),
      answer_keys: data.answer_keys || [],
      generated_sheets: data.generated_sheets || [],
      createdBy: data.createdBy,
      instructorId: data.instructorId,
      updatedAt:
        data.updatedAt?.toDate?.().toISOString() || new Date().toISOString(),
      className: data.className || undefined,
      classId: data.classId || undefined,
      examType: (data.examType as "board" | "diagnostic") || "board",
      choicePoints: data.choicePoints || {},
      isArchived: data.isArchived || false,
      examCode: examCode, // Include exam code for template validation
      status: (data.status as "draft" | "final") || "draft",
      institutionName: data.institutionName,
      logoUrl: data.logoUrl,
    };
  } catch (error: any) {
    // Silently handle offline errors - don't throw
    if (
      error?.code === "failed-precondition" ||
      error?.code === "unavailable" ||
      error?.message?.includes("offline")
    ) {
      console.warn("Firestore offline - retrying...");
      return null;
    }
    // Surface permission errors clearly
    if (error?.code === "permission-denied") {
      console.error("Firestore permission denied when fetching exam:", error);
      throw new Error("Permission denied. Please make sure you are logged in.");
    }
    console.error("Error fetching exam:", error);
    throw new Error("Failed to fetch exam");
  }
}

/**
 * Update an existing exam
 */
export async function updateExam(
  examId: string,
  updates: Partial<Exam>,
): Promise<void> {
  try {
    // Enforce edit restriction at the service layer
    const examSnap = await getDoc(doc(db, "exams", examId));
    if (examSnap.exists()) {
      const examData = examSnap.data() as Exam;
      if (!canEditExam(examData)) {
        throw new Error(EDIT_RESTRICTION_MESSAGE);
      }
    }

    const docRef = doc(db, "exams", examId);

    // Strip undefined values — Firestore rejects them
    const sanitized = Object.fromEntries(
      Object.entries({ ...updates, updatedAt: serverTimestamp() }).filter(
        ([, v]) => v !== undefined,
      ),
    );

    await updateDoc(docRef, sanitized);
  } catch (error) {
    console.error("Error updating exam:", error);
    if (error instanceof Error && error.message === EDIT_RESTRICTION_MESSAGE) {
      throw error;
    }
    throw new Error("Failed to update exam");
  }
}

/**
 * Archive an exam and delete its associated template
 */
export async function archiveExam(examId: string): Promise<void> {
  try {
    // Archive the exam
    const docRef = doc(db, "exams", examId);
    await updateDoc(docRef, {
      isArchived: true,
      archivedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Delete any templates linked to this exam
    const templateQuery = query(
      collection(db, "templates"),
      where("examId", "==", examId),
    );
    const templateSnap = await getDocs(templateQuery);
    const deletePromises = templateSnap.docs.map((d) => deleteDoc(d.ref));
    await Promise.all(deletePromises);
  } catch (error) {
    console.error("Error archiving exam:", error);
    throw new Error("Failed to archive exam");
  }
}

export async function getArchivedExams(userId: string): Promise<Exam[]> {
  try {
    // Use where clause to filter by userId and isArchived to minimize data read
    const q = query(
      collection(db, "exams"),
      where("createdBy", "==", userId),
      where("isArchived", "==", true),
    );
    const querySnapshot = await getDocs(q);
    const exams: Exam[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      exams.push({
        id: doc.id,
        title: data.title,
        subject: data.subject,
        num_items: data.num_items,
        choices_per_item: data.choices_per_item,
        created_at:
          data.created_at ||
          data.createdAt?.toDate?.().toISOString() ||
          new Date().toISOString(),
        answer_keys: data.answer_keys || [],
        generated_sheets: data.generated_sheets || [],
        createdBy: data.createdBy,
        updatedAt:
          data.updatedAt?.toDate?.().toISOString() || new Date().toISOString(),
        className: data.className || undefined,
        classId: data.classId || undefined,
        isArchived: data.isArchived,
        archivedAt:
          data.archivedAt?.toDate?.().toISOString() || new Date().toISOString(),
        examCode: data.examCode || undefined,
      });
    });

    // Sort by archive date
    exams.sort((a, b) => {
      const dateA = new Date(a.archivedAt || a.created_at).getTime();
      const dateB = new Date(b.archivedAt || b.created_at).getTime();
      return dateB - dateA;
    });

    return exams;
  } catch (error: any) {
    console.error("Error fetching archived exams:", error);
    return [];
  }
}

/**
 * Delete an exam
 */
export async function deleteExam(examId: string): Promise<void> {
  try {
    const docRef = doc(db, "exams", examId);
    // Permanently delete the exam document.
    // NOTE: This does not automatically delete related docs (templates/answer keys/results).
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting exam:", error);
    throw new Error("Failed to delete exam");
  }
}

/**
 * Add an answer key to an exam
 */
export async function addAnswerKeyToExam(
  examId: string,
  answerKeyId: string,
): Promise<void> {
  try {
    const docRef = doc(db, "exams", examId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error("Exam not found");
    }

    const currentAnswerKeys = docSnap.data().answer_keys || [];

    await updateDoc(docRef, {
      answer_keys: [...currentAnswerKeys, answerKeyId],
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error adding answer key to exam:", error);
    throw new Error("Failed to add answer key to exam");
  }
}

/**
 * Add a generated sheet to an exam
 */
export async function addGeneratedSheetToExam(
  examId: string,
  sheet: GeneratedSheet,
): Promise<void> {
  try {
    const docRef = doc(db, "exams", examId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error("Exam not found");
    }

    const currentSheets = docSnap.data().generated_sheets || [];

    await updateDoc(docRef, {
      generated_sheets: [...currentSheets, sheet],
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error adding generated sheet to exam:", error);
    throw new Error("Failed to add generated sheet to exam");
  }
}

/**
 * Get all exams for a specific class ID
 */
export async function getExamsByClassId(classId: string): Promise<Exam[]> {
  try {
    const q = query(
      collection(db, "exams"),
      where("classId", "==", classId),
      where("isArchived", "==", false)
    );
    const querySnapshot = await getDocs(q);
    const exams: Exam[] = [];

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      exams.push({
        id: docSnap.id,
        title: data.title,
        subject: data.subject,
        num_items: data.num_items,
        choices_per_item: data.choices_per_item,
        created_at:
          data.created_at ||
          data.createdAt?.toDate?.().toISOString() ||
          new Date().toISOString(),
        answer_keys: data.answer_keys || [],
        generated_sheets: data.generated_sheets || [],
        createdBy: data.createdBy,
        updatedAt:
          data.updatedAt?.toDate?.().toISOString() ||
          new Date().toISOString(),
        className: data.className || undefined,
        classId: data.classId || undefined,
        isArchived: data.isArchived,
        examCode: data.examCode,
      });
    });

    return exams;
  } catch (error) {
    console.error("Error fetching exams by class ID:", error);
    throw new Error("Failed to fetch exams for this class");
  }
}

/**
 * Get total scanned results count for all exams in a class
 */
export async function getScannedResultsCountByClassId(classId: string): Promise<number> {
  try {
    const q = query(
      collection(db, "exams"),
      where("classId", "==", classId),
      where("isArchived", "==", false)
    );
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) return 0;

    const examIds = querySnapshot.docs.map(docSnap => docSnap.id);
    
    // Check results for each exam
    let totalCount = 0;
    for (const eid of examIds) {
      const rq = query(
        collection(db, "scannedResults"),
        where("examId", "==", eid)
      );
      const rSnap = await getDocs(rq);
      totalCount += rSnap.size;
    }
    
    return totalCount;
  } catch (error) {
    console.error("Error counting scanned results for class:", error);
    return 0;
  }
}
