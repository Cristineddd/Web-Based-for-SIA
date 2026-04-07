"use client";

import { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CreateExamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateExam: (data: ExamFormData) => Promise<void>;
  /** Pre-fill the form from an existing template (reuse flow). */
  fromTemplate?: {
    name: string;
    totalQuestions: number;
    choicesPerItem: number;
    description: string;
    classId?: string;
    className?: string;
  } | null;
  /** Existing exam titles for duplicate detection at Step 1. */
  existingExamTitles?: string[];
}

interface ExamFormData {
  name: string;
  totalQuestions: number;
  date: string;
  folder: string; // derived from class; not editable in UI
  className: string;
  classId?: string;
  choicesPerItem?: number;
  examType?: "board" | "diagnostic";
  choicePoints?: { [choice: string]: number };
}

export function CreateExamModal({
  isOpen,
  onClose,
  onCreateExam,
  fromTemplate,
}: CreateExamModalProps) {
  const [formData, setFormData] = useState<ExamFormData>({
    name: "",
    totalQuestions: 20,
    date: new Date().toISOString().split("T")[0],
    folder: "General",
    className: "",
    classId: undefined,
    choicesPerItem: 5,
    examType: "board",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (fromTemplate) {
        setFormData({
          name: fromTemplate.name || "",
          totalQuestions: fromTemplate.totalQuestions || 20,
          date: new Date().toISOString().split("T")[0],
          folder: fromTemplate.description || "General",
          className: fromTemplate.className || "",
          classId: fromTemplate.classId || undefined,
          choicesPerItem: fromTemplate.choicesPerItem || 5,
          examType: "board",
        });
      }
    } else {
      setFormData({
        name: "",
        totalQuestions: 20,
        date: new Date().toISOString().split("T")[0],
        folder: "General",
        className: "",
        classId: undefined,
        choicesPerItem: 5,
        examType: "board",
      });
    }
  }, [isOpen, fromTemplate]);

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error("Please enter an exam title");
      return;
    }
    setIsSubmitting(true);
    try {
      await onCreateExam(formData);
      onClose();
    } catch (error) {
      console.error(error);
      toast.error("Failed to create exam");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-gray-100 animation-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-50">
          <h2 className="text-xl font-bold text-gray-900">Create New Exam</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors group"
          >
            <X className="w-5 h-5 text-gray-400 group-hover:text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 ml-1">
              Exam Title
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Midterm Examination"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all text-sm placeholder:text-gray-300 shadow-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 ml-1">
              Subject
            </label>
            <input
              type="text"
              value={formData.folder}
              onChange={(e) => setFormData({ ...formData, folder: e.target.value })}
              placeholder="e.g. Biology"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all text-sm placeholder:text-gray-300 shadow-sm"
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-semibold text-gray-700 ml-1">
              Number of Items
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[20, 50, 100].map((num) => (
                <button
                  key={num}
                  onClick={() => setFormData({ ...formData, totalQuestions: num })}
                  className={`py-3 px-2 rounded-xl border font-semibold text-sm transition-all duration-200 ${
                    formData.totalQuestions === num
                      ? "bg-green-50 border-green-500 text-green-700 shadow-[0_0_15px_rgba(34,197,94,0.1)]"
                      : "border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {num} Items
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-6 px-10 py-6 bg-gray-50/50">
          <button
            onClick={onClose}
            className="text-gray-500 font-bold text-sm hover:text-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={isSubmitting}
            className="px-8 py-3 bg-[#22c55e] text-white rounded-xl font-bold text-sm hover:bg-[#16a34a] transition-all shadow-[0_4px_14px_rgba(34,197,94,0.3)] hover:shadow-[0_6px_20px_rgba(34,197,94,0.3)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</>
            ) : (
              "Create Exam"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
