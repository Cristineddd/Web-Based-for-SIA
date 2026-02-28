/**
 * Instructor Settings Service
 * Persists per-instructor configuration to Firestore, including the
 * configurable passing-grade threshold used throughout the grading system.
 */

import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

const SETTINGS_COLLECTION = "instructorSettings";

/** The shape of a single instructor's persisted settings document. */
export interface InstructorSettings {
  /** Minimum percentage to be considered "passing" (0–100). Default 60. */
  passingThreshold: number;
  /** Institution name shown in exports / headers. */
  institutionName?: string;
  /** Timezone preference (informational). */
  timezone?: string;
  /** Firestore bookkeeping */
  updatedAt?: string;
  /** Custom Institution Logo URL */
  logoUrl?: string;
}

const DEFAULT_SETTINGS: InstructorSettings = {
  passingThreshold: 60,
  institutionName: "Gordon College",
  timezone: "UTC-8:00 (Philippine Time)",
};

export class InstructorSettingsService {
  /**
   * Retrieve the instructor's settings.
   * Falls back to sensible defaults if no document exists yet.
   */
  static async getSettings(instructorId: string): Promise<InstructorSettings> {
    try {
      const ref = doc(db, SETTINGS_COLLECTION, instructorId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as Partial<InstructorSettings>;
        return { ...DEFAULT_SETTINGS, ...data };
      }
      return { ...DEFAULT_SETTINGS };
    } catch (error) {
      console.error(
        "[InstructorSettingsService] Error reading settings:",
        error,
      );
      return { ...DEFAULT_SETTINGS };
    }
  }

  /**
   * Persist (merge) updated settings for an instructor.
   */
  static async saveSettings(
    instructorId: string,
    updates: Partial<InstructorSettings>,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const ref = doc(db, SETTINGS_COLLECTION, instructorId);
      await setDoc(
        ref,
        { ...updates, updatedAt: serverTimestamp() },
        { merge: true },
      );
      return { success: true };
    } catch (error) {
      console.error(
        "[InstructorSettingsService] Error saving settings:",
        error,
      );
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Convenience: get just the passing threshold for an instructor.
   */
  static async getPassingThreshold(instructorId: string): Promise<number> {
    const settings = await this.getSettings(instructorId);
    return settings.passingThreshold;
  }

  /**
   * Convenience: set just the passing threshold.
   */
  static async setPassingThreshold(
    instructorId: string,
    threshold: number,
  ): Promise<{ success: boolean; error?: string }> {
    const clamped = Math.max(0, Math.min(100, Math.round(threshold)));
    return this.saveSettings(instructorId, { passingThreshold: clamped });
  }
}
