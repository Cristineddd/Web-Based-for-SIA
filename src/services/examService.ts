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
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface Exam {
  id: string;
  title: string;
  subject: string;
  num_items: number;
  choices_per_item: number;
  created_at: string;
  answer_keys: string[];
  generated_sheets: GeneratedSheet[];
  createdBy?: string;
  updatedAt?: string;
  className?: string;
  examType?: string;
  choicePoints?: { [choice: string]: number };
  examCode?: string;
  logoUrl?: string;
  student_id_length?: number;
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
    };

    return newExam;
  } catch (error) {
    console.error("Error creating exam:", error);
    throw new Error("Failed to create exam");
  }
}

/**
 * Get all exams for a user
 */
export async function getExams(userId?: string): Promise<Exam[]> {
  try {
    let q;
    if (userId) {
      // Remove orderBy to avoid composite index requirement
      q = query(collection(db, "exams"), where("createdBy", "==", userId));
    } else {
      q = query(collection(db, "exams"), orderBy("createdAt", "desc"));
    }

    const querySnapshot = await getDocs(q);
    const exams: Exam[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data() as any;
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
        examCode: data.examCode || undefined,
        logoUrl: data.logoUrl || undefined,
        student_id_length: data.student_id_length || 6,
      });
    });

    // Sort in JavaScript after fetching to avoid composite index requirement
    if (userId) {
      exams.sort((a, b) => {
        const dateA = new Date(a.updatedAt || a.created_at).getTime();
        const dateB = new Date(b.updatedAt || b.created_at).getTime();
        return dateB - dateA;
      });
    }

    return exams;
  } catch (error) {
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
    };
  } catch (error) {
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
 * Delete an exam
 */
export async function deleteExam(examId: string): Promise<void> {
  try {
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
