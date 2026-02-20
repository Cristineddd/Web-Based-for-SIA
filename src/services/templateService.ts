import {
  collection,
  addDoc,
  getDoc,
  getDocs,
  serverTimestamp,
  doc,
  deleteDoc,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface ExamTemplate {
  id?: string;
  name: string;
  description: string;
  num_items: number;
  choices_per_item: number;
  student_id_length: number;
  logoUrl?: string;
  examCode?: string;
  createdBy: string;
  createdAt: any;
  isTemplate?: boolean;
}

const TEMPLATES_COLLECTION = "exams";

export const TemplateService = {
  /**
   * Save a new exam template
   */
  async saveTemplate(template: Omit<ExamTemplate, "id" | "createdAt">) {
    try {
      const docRef = await addDoc(collection(db, TEMPLATES_COLLECTION), {
        ...template,
        isTemplate: true,
        title: template.name, // Compatibility with exams collection schema
        num_items: template.num_items,
        choices_per_item: template.choices_per_item,
        createdAt: serverTimestamp(),
      });
      return { success: true, id: docRef.id };
    } catch (error) {
      console.error("Error saving template:", error);
      return { success: false, error: (error as Error).message };
    }
  },

  /**
   * Get all templates (optionally filtered by userId)
   */
  async getAllTemplates(userId?: string) {
    try {
      let q;
      if (userId) {
        q = query(
          collection(db, TEMPLATES_COLLECTION),
          where("createdBy", "==", userId),
          where("isTemplate", "==", true),
        );
      } else {
        q = query(
          collection(db, TEMPLATES_COLLECTION),
          where("isTemplate", "==", true),
        );
      }

      const querySnapshot = await getDocs(q as any);
      const templates: ExamTemplate[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data() as any;
        templates.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() || data.createdAt,
        } as ExamTemplate);
      });
      return { success: true, data: templates };
    } catch (error) {
      console.error("Error fetching templates:", error);
      return { success: false, error: (error as Error).message };
    }
  },

  /**
   * Get a template by ID
   */
  async getTemplateById(id: string) {
    try {
      const docSnap = await getDoc(doc(db, TEMPLATES_COLLECTION, id));
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          success: true,
          data: {
            id: docSnap.id,
            ...data,
            createdAt: data.createdAt?.toDate?.() || data.createdAt,
          } as ExamTemplate,
        };
      }
      return { success: false, error: "Template not found" };
    } catch (error) {
      console.error("Error fetching template:", error);
      return { success: false, error: (error as Error).message };
    }
  },

  /**
   * Delete a template
   */
  async deleteTemplate(id: string) {
    try {
      await deleteDoc(doc(db, TEMPLATES_COLLECTION, id));
      return { success: true };
    } catch (error) {
      console.error("Error deleting template:", error);
      return { success: false, error: (error as Error).message };
    }
  },
};
