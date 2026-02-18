import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AnswerKey, AnswerChoice } from "@/types/scanning";

const ANSWER_KEYS_COLLECTION = "answerKeys";

export class AnswerKeyService {
  static async createAnswerKey(
    examId: string,
    answers: AnswerChoice[],
    userId: string,
    questionSettings?: any[],
  ): Promise<{ success: boolean; data?: AnswerKey; error?: string }> {
    try {
      const answerKeyId = `ak_${examId}_${Date.now()}`;
      const now = new Date().toISOString();

      const answerKeyData: AnswerKey = {
        id: answerKeyId,
        examId,
        answers,
        questionSettings: questionSettings || null,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
        locked: false,
        version: 1,
      };

      await setDoc(doc(db, ANSWER_KEYS_COLLECTION, answerKeyId), {
        ...answerKeyData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return { success: true, data: answerKeyData };
    } catch (error) {
      console.error("Error creating answer key:", error);
      return { success: false, error: (error as Error).message };
    }
  }

  static async getAnswerKeyByExamId(
    examId: string,
  ): Promise<{ success: boolean; data?: AnswerKey; error?: string }> {
    try {
      const q = query(
        collection(db, ANSWER_KEYS_COLLECTION),
        where("examId", "==", examId),
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return { success: false, error: "Answer key not found" };
      }

      const docSnapshot = querySnapshot.docs[0];
      const docData = docSnapshot.data();
      const answerKey: AnswerKey = {
        ...docData,
        id: docSnapshot.id,
        createdAt:
          (docData.createdAt as Timestamp)?.toDate().toISOString() || "",
        updatedAt:
          (docData.updatedAt as Timestamp)?.toDate().toISOString() || "",
      } as AnswerKey;

      return { success: true, data: answerKey };
    } catch (error) {
      console.error("Error fetching answer key:", error);
      return { success: false, error: (error as Error).message };
    }
  }

  static async updateAnswerKey(
    answerKeyId: string,
    answers: AnswerChoice[],
    userId: string,
    questionSettings?: any[],
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const answerKeyRef = doc(db, ANSWER_KEYS_COLLECTION, answerKeyId);
      const answerKeyDoc = await getDoc(answerKeyRef);

      if (!answerKeyDoc.exists()) {
        return { success: false, error: "Answer key not found" };
      }

      const currentData = answerKeyDoc.data();

      if (currentData.locked) {
        return {
          success: false,
          error: "Answer key is locked and cannot be modified",
        };
      }

      await updateDoc(answerKeyRef, {
        answers,
        questionSettings: questionSettings || null,
        updatedAt: serverTimestamp(),
        updatedBy: userId,
        version: (currentData.version || 1) + 1,
      });

      return { success: true };
    } catch (error) {
      console.error("Error updating answer key:", error);
      return { success: false, error: (error as Error).message };
    }
  }

  static async lockAnswerKey(
    answerKeyId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const answerKeyRef = doc(db, ANSWER_KEYS_COLLECTION, answerKeyId);

      await updateDoc(answerKeyRef, {
        locked: true,
        updatedAt: serverTimestamp(),
      });

      return { success: true };
    } catch (error) {
      console.error("Error locking answer key:", error);
      return { success: false, error: (error as Error).message };
    }
  }

  static validateAnswers(
    answers: string[],
    validChoices: string[] = ["A", "B", "C", "D", "E"],
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    answers.forEach((answer, index) => {
      const upperAnswer = answer.toUpperCase();
      if (!validChoices.includes(upperAnswer)) {
        errors.push(
          `Question ${index + 1}: Invalid answer "${answer}". Valid choices are: ${validChoices.join(", ")}`,
        );
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  static parseAnswerKeyFromFile(
    data: Array<Record<string, string>>,
    questionCountExpected: number,
  ): { success: boolean; answers?: AnswerChoice[]; errors?: string[] } {
    try {
      const answers: AnswerChoice[] = [];
      const errors: string[] = [];

      for (let i = 0; i < questionCountExpected; i++) {
        const row = data[i];
        if (!row) {
          errors.push(`Missing row for question ${i + 1}`);
          continue;
        }

        const answer =
          row.answer ||
          row.Answer ||
          row.ANSWER ||
          row.choice ||
          row.Choice ||
          "";

        const upperAnswer = answer.toUpperCase().trim();

        if (!["A", "B", "C", "D", "E"].includes(upperAnswer)) {
          errors.push(
            `Question ${i + 1}: Invalid answer "${answer}". Expected A, B, C, D, or E`,
          );
          continue;
        }

        answers.push(upperAnswer as AnswerChoice);
      }

      if (answers.length !== questionCountExpected) {
        errors.push(
          `Expected ${questionCountExpected} answers, but got ${answers.length}`,
        );
      }

      return {
        success: errors.length === 0,
        answers: errors.length === 0 ? answers : undefined,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      return {
        success: false,
        errors: [(error as Error).message],
      };
    }
  }
}
