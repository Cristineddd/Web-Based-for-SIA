import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

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
  updatedAt?: string;
  className?: string;
  examType?: string;
  choicePoints?: { [choice: string]: number };
  isArchived?: boolean;
  archivedAt?: string;
}

export interface GeneratedSheet {
  id: string;
  sheet_count: number;
  created_at: string;
  examCode?: string;
  batchType?: string;
  timezone?: string;
  isDuplicate?: boolean;
}

export interface ExamFormData {
  name: string;
  totalQuestions: number;
  date: string;
  folder: string;
  className?: string;
  classId?: string;
  choicesPerItem?: number;
  examType?: string;
  choicePoints?: { [choice: string]: number };
  examCode?: string;
  logoUrl?: string;
  studentIdLength?: number;
  status?: "draft" | "final";
  approvedBy?: string;
  approvedAt?: string;
}

/**
 * Create a new exam in Firestore
 */
export async function createExam(
  formData: ExamFormData,
  userId: string,
): Promise<Exam> {
  try {
    const examData = {
      title: formData.name,
      subject: formData.folder,
      num_items: formData.totalQuestions,
      choices_per_item: formData.choicesPerItem || 4,
      created_at: formData.date,
      answer_keys: [],
      generated_sheets: [],
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      className: formData.className || null,
      classId: formData.classId || null,
      examType: formData.examType || "board",
      choicePoints: formData.choicePoints || {},
      examCode: formData.examCode || null,
      logoUrl: formData.logoUrl || null,
      student_id_length: formData.studentIdLength || 6,
      status: formData.status || "draft",
      approvedBy: formData.approvedBy || null,
      approvedAt: formData.approvedAt || null,
    };
    const docRef = await addDoc(collection(db, "exams"), examData);

    // Return the exam with the generated ID
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
      updatedAt: new Date().toISOString(),
      className: examData.className || undefined,
      examType: examData.examType || "board",
      choicePoints: examData.choicePoints,
      examCode: examData.examCode || undefined,
      logoUrl: examData.logoUrl || undefined,
      student_id_length: examData.student_id_length || 6,
      status: examData.status as "draft" | "final",
      approvedBy: examData.approvedBy || undefined,
      approvedAt: examData.approvedAt || undefined,
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
export async function getRecentExams(userId: string, limit: number = 5): Promise<Exam[]> {
  try {
    // Fetch all exams without filters to avoid composite index
    const q = query(collection(db, "exams"));
    const querySnapshot = await getDocs(q);
    const exams: Exam[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      // Filter by userId on client-side and exclude archived exams
      if (data.createdBy === userId && !data.isArchived) {
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
          isArchived: data.isArchived,
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

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      // Filter by userId if provided (additional client-side check)
      // Also filter out archived exams
      if ((!userId || data.createdBy === userId) && !data.isArchived) {
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
          isArchived: data.isArchived,
        });
      }
    });

    // Sort in JavaScript after fetching
    exams.sort((a, b) => {
      const dateA = new Date(a.updatedAt || a.created_at).getTime();
      const dateB = new Date(b.updatedAt || b.created_at).getTime();
      return dateB - dateA;
    });

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

    const data = docSnap.data() as any;
    return {
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
      examCode: data.examCode || undefined,
      logoUrl: data.logoUrl || undefined,
      student_id_length: data.student_id_length || 6,
      status: data.status || "draft",
      approvedBy: data.approvedBy || undefined,
      approvedAt: data.approvedAt || undefined,
    };
  } catch (error: any) {
    // Silently handle offline errors - don't throw
    if (error?.code === 'failed-precondition' || error?.code === 'unavailable' || error?.message?.includes('offline')) {
      console.warn('Firestore offline - retrying...');
      return null;
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
    const docRef = doc(db, "exams", examId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error updating exam:", error);
    throw new Error("Failed to update exam");
  }
}

/**
 * Archive an exam
 */
export async function archiveExam(examId: string): Promise<void> {
  try {
    const docRef = doc(db, "exams", examId);
    await updateDoc(docRef, {
      isArchived: true,
      archivedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
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
      where("isArchived", "==", true)
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
        isArchived: data.isArchived,
        archivedAt:
          data.archivedAt?.toDate?.().toISOString() || new Date().toISOString(),
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
    // Instead of deleting the document, set isArchived to false and mark as deleted
    await updateDoc(docRef, {
      isArchived: false,
      deletedAt: new Date().toISOString(),
      status: 'deleted'
    });
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
