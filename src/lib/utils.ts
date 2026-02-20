import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { type Exam } from "@/services/examService";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Checks if an exam is still in the editable window.
 * An exam is editable if it's in 'draft' status AND no sheets
 * have been generated/scanned yet.
 */
export function isExamEditable(exam: Exam | null): boolean {
  if (!exam) return false;
  if (exam.status !== "draft") return false;

  // Lock if any sheets have been generated/scanned, indicating the exam has started
  if (exam.generated_sheets && exam.generated_sheets.length > 0) {
    return false;
  }

  return true;
}
