/**
 * Template Service
 *
 * Centralized CRUD + versioning logic for answer-sheet templates stored in
 * the Firestore `templates` collection.  Every mutation bumps the `version`
 * counter and appends a snapshot to the `versionHistory` array so that
 * previous states can be inspected for audit purposes.
 */

import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// ── Types ────────────────────────────────────────────────────────────────

export interface TemplateVersion {
  version: number;
  name: string;
  description: string;
  numQuestions: number;
  choicesPerQuestion: number;
  updatedBy: string;
  updatedAt: string; // ISO string snapshot
}

export interface Template {
  id: string;
  name: string;
  description: string;
  numQuestions: number;
  choicesPerQuestion: number;
  layout: "single" | "double" | "quad";
  includeStudentId: boolean;
  studentIdLength: number;
  createdBy: string;
  instructorId?: string;
  classId?: string;
  className?: string;
  examId?: string;
  examName?: string;
  examCode?: string;
  createdAt: string | Timestamp;
  updatedAt?: string | Timestamp;
  updatedBy?: string;
  isArchived?: boolean;
  archivedAt?: string | Timestamp;
  archivedBy?: string;
  /** Current version number (starts at 1). */
  version: number;
  /** Ordered list of previous version snapshots. */
  versionHistory: TemplateVersion[];
}

// ── Helpers ──────────────────────────────────────────────────────────────

const COLLECTION = "templates";

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as T;
}

// ── Service ──────────────────────────────────────────────────────────────

export const TemplateService = {
  // ─── Create ──────────────────────────────────────────────────────────

  /**
   * Create a new template (version 1).
   */
  async create(
    data: Omit<
      Template,
      "id" | "createdAt" | "updatedAt" | "version" | "versionHistory"
    >,
  ): Promise<string> {
    const payload = stripUndefined({
      ...data,
      version: 1,
      versionHistory: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const ref = await addDoc(collection(db, COLLECTION), payload);
    return ref.id;
  },

  // ─── Read ────────────────────────────────────────────────────────────

  /**
   * Get a single template by ID.
   */
  async getById(templateId: string): Promise<Template | null> {
    const snap = await getDoc(doc(db, COLLECTION, templateId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Template;
  },

  /**
   * Get all templates belonging to an instructor.
   */
  async getByInstructor(instructorId: string): Promise<Template[]> {
    const q = query(
      collection(db, COLLECTION),
      where("instructorId", "==", instructorId),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Template);
  },

  /**
   * Get all non-archived templates for an instructor (for reuse picker).
   */
  async getReusableTemplates(instructorId: string): Promise<Template[]> {
    const all = await this.getByInstructor(instructorId);
    return all.filter((t) => !t.isArchived);
  },

  /**
   * Check if a template already exists for a given exam.
   */
  async existsForExam(examId: string): Promise<boolean> {
    const q = query(
      collection(db, COLLECTION),
      where("examId", "==", examId),
    );
    const snap = await getDocs(q);
    return !snap.empty;
  },

  // ─── Update (with version bump) ─────────────────────────────────────

  /**
   * Update a template, bumping the version and recording the prior state in
   * `versionHistory`.
   */
  async update(
    templateId: string,
    updates: Partial<
      Pick<
        Template,
        "name" | "description" | "numQuestions" | "choicesPerQuestion"
      >
    >,
    updatedBy: string,
  ): Promise<void> {
    const current = await this.getById(templateId);
    if (!current) throw new Error("Template not found");

    // Snapshot the current state before overwriting
    const snapshot: TemplateVersion = {
      version: current.version ?? 1,
      name: current.name,
      description: current.description,
      numQuestions: current.numQuestions,
      choicesPerQuestion: current.choicesPerQuestion,
      updatedBy: current.updatedBy ?? current.createdBy,
      updatedAt: new Date().toISOString(),
    };

    const newVersion = (current.version ?? 1) + 1;
    const history = [...(current.versionHistory ?? []), snapshot];

    const payload = stripUndefined({
      ...updates,
      version: newVersion,
      versionHistory: history,
      updatedBy,
      updatedAt: serverTimestamp(),
    });

    await updateDoc(doc(db, COLLECTION, templateId), payload);
  },

  // ─── Archive / Restore ──────────────────────────────────────────────

  async archive(templateId: string, userId: string): Promise<void> {
    await updateDoc(doc(db, COLLECTION, templateId), {
      isArchived: true,
      archivedAt: serverTimestamp(),
      archivedBy: userId,
    });
  },

  async restore(templateId: string): Promise<void> {
    await updateDoc(doc(db, COLLECTION, templateId), {
      isArchived: false,
      archivedAt: null,
      archivedBy: null,
    });
  },

  // ─── Delete ──────────────────────────────────────────────────────────

  async delete(templateId: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION, templateId));
  },

  /**
   * Delete all templates linked to a given exam.
   */
  async deleteByExam(examId: string): Promise<number> {
    const q = query(
      collection(db, COLLECTION),
      where("examId", "==", examId),
    );
    const snap = await getDocs(q);
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    return snap.size;
  },
};
