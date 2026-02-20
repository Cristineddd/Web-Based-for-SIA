import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { type Exam } from "@/services/examService";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Checks if an exam is still in the editable window.
 * An exam is editable if it's in 'draft' status AND the current date
 * is before the scheduled exam date (created_at).
 */
export function isExamEditable(exam: Exam | null): boolean {
  if (!exam) return false;
  if (exam.status !== "draft") return false;

  const examDate = new Date(exam.created_at);
  const now = new Date();

  // Set times to midnight for date-only comparison
  const examDateOnly = new Date(
    examDate.getFullYear(),
    examDate.getMonth(),
    examDate.getDate(),
  );
  const nowOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return nowOnly <= examDateOnly;
}
