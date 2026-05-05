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
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  writeBatch,
  type DocumentData,
  type Query,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

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
      console.warn("[deleteExam] Skipping restricted collection cleanup:", error);
      return 0;
    }
    throw error;
  }
}

export interface TaggedClass {
  classId: string;
  className: string;
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
  instructorId?: string;
  updatedAt?: string;
  className?: string;
  classId?: string; // Legacy: first tagged class (kept for backward compat)
  taggedClasses?: TaggedClass[]; // NEW: many-to-many class tagging
  examType?: "board" | "diagnostic";
  choicePoints?: { [choice: string]: number };
  isArchived?: boolean;
  archivedAt?: string;
  examCode?: string;
  courseCode?: string;
  status?: "draft" | "final";
  institutionName?: string;
  logoUrl?: string;
  scannedCount?: number;
  averageScore?: string;
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
      createdBy: userId,
      ...(instructorId && { instructorId: instructorId }),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      className: formData.className || null,
      classId: formData.classId || null,
      // Many-to-many: seed taggedClasses from initial class if provided
      taggedClasses: formData.classId && formData.className
        ? [{ classId: formData.classId, className: formData.className }]
        : [],
      examType: formData.examType || "board",
      choicePoints: formData.choicePoints || {},
      examCode: examCode,
      isArchived: false,
      status: "draft",
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
      ...(instructorId && { instructorId: instructorId }),
      updatedAt: new Date().toISOString(),
      className: examData.className || undefined,
      classId: examData.classId || undefined,
      taggedClasses: examData.taggedClasses,
      examType: examData.examType || "board",
      choicePoints: examData.choicePoints,
      examCode: examCode,
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
          taggedClasses: data.taggedClasses || [],
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
      taggedClasses: data.taggedClasses || [],
      examType: (data.examType as "board" | "diagnostic") || "board",
      choicePoints: data.choicePoints || {},
      isArchived: data.isArchived || false,
      examCode: examCode,
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
  const docRef = doc(db, "exams", examId);
  try {
    // Check if we're only updating archive status or other systemic fields
    const systemicFields = ["isArchived", "archivedAt", "classId", "className"];
    const isOnlyArchiveUpdate = Object.keys(updates).every((key) =>
      systemicFields.includes(key),
    );

    const examSnap = await getDoc(docRef);
    if (examSnap.exists()) {
      const examData = examSnap.data() as Exam;
      // Only enforce edit restriction if we are updating substantive content
      if (!isOnlyArchiveUpdate && !canEditExam(examData)) {
        throw new Error(EDIT_RESTRICTION_MESSAGE);
      }
    }

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

    const docRef = doc(db, "exams", examId);
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
 * Get all exams tagged to a specific class (supports many-to-many)
 * Queries both new taggedClasses array and legacy classId field
 */
export async function getExamsByClassId(classId: string): Promise<Exam[]> {
  try {
    // We fetch by legacy classId AND all exams and filter taggedClasses client-side.
    // Firestore does not support array-contains with partial object matching.
    const [legacySnap, allTaggedSnap] = await Promise.all([
      getDocs(query(collection(db, "exams"), where("classId", "==", classId))),
      getDocs(query(collection(db, "exams"))),
    ]);

    const examMap = new Map<string, Exam>();

    const mapDoc = (docSnap: QueryDocumentSnapshot<DocumentData>) => {
      const data = docSnap.data();
      if (data.isArchived === true) return;
      const exam: Exam = {
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
          data.updatedAt?.toDate?.().toISOString() || new Date().toISOString(),
        className: data.className || undefined,
        classId: data.classId || undefined,
        taggedClasses: data.taggedClasses || [],
        isArchived: data.isArchived || false,
        examCode: data.examCode,
        status: data.status,
      };
      examMap.set(docSnap.id, exam);
    };

    // Add legacy classId matches
    legacySnap.docs.forEach(mapDoc);

    // Add new taggedClasses matches (filter client-side)
    allTaggedSnap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const tagged: TaggedClass[] = data.taggedClasses || [];
      if (tagged.some((t) => t.classId === classId)) {
        mapDoc(docSnap);
      }
    });

    return Array.from(examMap.values()).sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  } catch (error) {
    console.error("Error fetching exams by class ID:", error);
    throw new Error("Failed to fetch exams for this class");
  }
}

/**
 * Tag an exam to a class (many-to-many). Does NOT remove existing tags.
 */
export async function tagExamToClass(
  examId: string,
  classId: string,
  className: string,
): Promise<void> {
  try {
    const docRef = doc(db, "exams", examId);
    const examSnap = await getDoc(docRef);
    if (!examSnap.exists()) throw new Error("Exam not found");

    const data = examSnap.data();
    const taggedClasses: TaggedClass[] = data.taggedClasses || [];

    // Avoid duplicates
    if (taggedClasses.some((t) => t.classId === classId)) return;

    const newTag: TaggedClass = { classId, className };

    // Also update legacy fields if this is the first tag
    const isFirst = taggedClasses.length === 0 && !data.classId;

    await updateDoc(docRef, {
      taggedClasses: arrayUnion(newTag),
      ...(isFirst && { classId, className }),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error tagging exam to class:", error);
    throw new Error("Failed to tag exam to class");
  }
}

/**
 * Remove a class tag from an exam.
 */
export async function untagExamFromClass(
  examId: string,
  classId: string,
): Promise<void> {
  try {
    const docRef = doc(db, "exams", examId);
    const examSnap = await getDoc(docRef);
    if (!examSnap.exists()) throw new Error("Exam not found");

    const data = examSnap.data();
    const taggedClasses: TaggedClass[] = data.taggedClasses || [];
    const tagToRemove = taggedClasses.find((t) => t.classId === classId);
    if (!tagToRemove) return;

    // Determine new legacy classId/className after removal
    const remaining = taggedClasses.filter((t) => t.classId !== classId);
    const newLegacy = remaining.length > 0
      ? { classId: remaining[0].classId, className: remaining[0].className }
      : { classId: null, className: null };

    await updateDoc(docRef, {
      taggedClasses: arrayRemove(tagToRemove),
      ...newLegacy,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error untagging exam from class:", error);
    throw new Error("Failed to untag exam from class");
  }
}

/**
 * Get total scanned results count for all exams in a class
 */
export async function getScannedResultsCountByClassId(
  classId: string,
): Promise<number> {
  try {
    const q = query(
      collection(db, "exams"),
      where("classId", "==", classId)
    );
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) return 0;

    const examIds = querySnapshot.docs.map((docSnap) => docSnap.id);

    // Check results for each exam
    let totalCount = 0;
    for (const eid of examIds) {
      const rq = query(
        collection(db, "scannedResults"),
        where("examId", "==", eid),
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
