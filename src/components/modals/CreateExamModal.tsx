"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2, AlertTriangle } from "lucide-react";
import { getClasses, type Class } from "@/services/classService";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

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
  existingExamTitles = [],
}: CreateExamModalProps) {
  const { user } = useAuth();
  const router = useRouter();

  // Helper function to get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const [formData, setFormData] = useState<ExamFormData>({
    name: "",
    totalQuestions: 50,
    date: getTodayDate(),
    folder: "General",
    className: "",
    classId: undefined,
    choicesPerItem: 5,
    examType: "board",
  });

  const [step, setStep] = useState(1);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [questionsPicked, setQuestionsPicked] = useState(false);
  const [examTypePicked, setExamTypePicked] = useState(false);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);

  // Initialize or Reset form
  useEffect(() => {
    if (isOpen) {
      if (fromTemplate) {
        setFormData({
          name: fromTemplate.name || "",
          totalQuestions: fromTemplate.totalQuestions || 50,
          date: getTodayDate(),
          folder: "General",
          className: fromTemplate.className || "",
          classId: fromTemplate.classId || undefined,
          choicesPerItem: fromTemplate.choicesPerItem || 5,
          examType: "board",
        });
        if (fromTemplate.totalQuestions) setQuestionsPicked(true);
      }
    } else {
      setFormData({
        name: "",
        totalQuestions: 50,
        date: getTodayDate(),
        folder: "General",
        className: "",
        classId: undefined,
        choicesPerItem: 5,
        examType: "board",
      });
      setStep(1);
      setQuestionsPicked(false);
      setExamTypePicked(false);
    }
  }, [isOpen, fromTemplate]);

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();

        if (step < 6) {
          // Trigger next step
          const nextButton = document.querySelector(
            '[data-testid="next-button"]',
          ) as HTMLButtonElement;
          if (nextButton && !nextButton.disabled) {
            nextButton.click();
          }
        } else {
          // Trigger submit
          const submitButton = document.querySelector(
            '[data-testid="submit-button"]',
          ) as HTMLButtonElement;
          if (submitButton && !submitButton.disabled) {
            submitButton.click();
          }
        }
      }

      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, step, onClose]);

  useEffect(() => {
    const fetchClassesData = async () => {
      if (!isOpen) return;

      try {
        setLoadingClasses(true);
        const userId = user?.id;
        const fetchedClasses = await getClasses(userId);
        setClasses(fetchedClasses);
      } catch (error) {
        console.error("Error fetching classes:", error);
        toast.error("Failed to load classes");
      } finally {
        setLoadingClasses(false);
      }
    };

    fetchClassesData();
  }, [isOpen, user]);

  // Recompute isDuplicate whenever the name changes
  useEffect(() => {
    const trimmed = formData.name.trim().toLowerCase();
    if (!trimmed) {
      setIsDuplicate(false);
      return;
    }
    const found = existingExamTitles.some(
      (t) => t.trim().toLowerCase() === trimmed,
    );
    setIsDuplicate(found);
    // Reset confirmation if name changes
    setConfirmDuplicate(false);
  }, [formData.name, existingExamTitles]);

  const handleInputChange = (
    field: keyof ExamFormData,
    value: string | number,
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleCreateExam = async () => {
    if (!formData.name.trim()) {
      toast.error("Please enter an exam name");
      return;
    }
    if (!formData.className) {
      toast.error("Please select a class");
      return;
    }
    if (!formData.date) {
      toast.error("Please select a date");
      return;
    }
    // Folder/subject is derived from the selected class; no user input required.

    try {
      const selected = new Date(formData.date + "T00:00:00");
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selected < today) {
        toast.error("Exam date cannot be in the past");
        return;
      }
    } catch (e) {
      toast.error("Invalid date selected");
      return;
    }

    setIsSubmitting(true);

    try {
      // Wait for onCreateExam to complete - it may show duplicate dialog instead
      await onCreateExam(formData);

      // Note: Success toast is now shown in the parent component (Exams.tsx)
      // This allows the duplicate detection flow to work properly

      // Reset form and close modal
      setFormData({
        name: "",
        totalQuestions: 50,
        date: new Date().toISOString().split("T")[0],
        folder: "General",
        className: "",
        classId: undefined,
        choicesPerItem: 5,
        examType: "board",
        choicePoints: {},
      });
      setStep(1);
      setQuestionsPicked(false);
      setExamTypePicked(false);
      // Don't close modal here - let the parent handle it via onClose or duplicate detection
    } catch (error) {
      console.error("Error creating exam:", error);
      toast.error("Failed to create exam");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex-shrink-0 px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-gray-900">Create New Exam</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {step === 1 && "What's the name of your exam?"}
                {step === 2 && "How many questions will it have?"}
                {step === 3 && "What answer format will you use?"}
                {step === 4 && "Which class is taking this exam?"}
                {step === 5 && "What type of exam is this?"}
                {step === 6 && "Review and create your exam"}
              </p>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* Step Progress */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-gray-500">
              <span className="font-medium text-gray-700">Step {step} of 6</span>
              <span>{Math.round((step / 6) * 100)}%</span>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 h-1.5 rounded-full transition-all ${
                    i + 1 <= step ? "bg-green-600" : "bg-gray-200"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {step === 1 && (
            <div className="space-y-3">
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  Exam Name <span className="text-red-500">*</span>
                </span>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder='e.g. "Midterm Exam", "Quiz 1"'
                  className={`w-full px-3 py-2.5 border rounded-lg bg-white text-sm focus:outline-none focus:ring-2 transition-all ${
                    formData.name.trim()
                      ? "border-green-500 focus:ring-green-500/20"
                      : "border-gray-200 focus:ring-green-500/20 focus:border-green-500"
                  }`}
                />
                {!formData.name.trim() && (
                  <p className="text-xs text-gray-400">Try "Math Midterm", "Science Quiz 1", or "Final Exam"</p>
                )}
              </label>
              {isDuplicate && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-800">
                    <p className="font-semibold">Potential Duplicate</p>
                    <p className="mt-0.5">An exam with this name already exists. You can still proceed.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-gray-700">How many questions? <span className="text-red-500">*</span></p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { num: 20, label: "Quick Quiz" },
                  { num: 50, label: "Standard" },
                  { num: 100, label: "Major Exam" },
                  { num: 150, label: "Comprehensive" }
                ].map(({ num, label }) => (
                  <button
                    key={num}
                    onClick={() => { handleInputChange("totalQuestions", num); setQuestionsPicked(true); }}
                    className={`py-4 px-3 rounded-lg border-2 transition-all text-center ${
                      formData.totalQuestions === num && questionsPicked
                        ? "bg-green-600 text-white border-green-600 shadow-md"
                        : "border-gray-200 text-gray-700 hover:border-green-500 hover:bg-green-50"
                    }`}
                  >
                    <div className="font-bold text-xl">{num}</div>
                    <div className="text-xs mt-0.5 opacity-80">{label}</div>
                  </button>
                ))}
              </div>
              {!questionsPicked && (
                <p className="text-xs text-amber-600">Please select the number of questions to continue</p>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-gray-700">Answer choices per question <span className="text-red-500">*</span></p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "A, B, C, D", sub: "4 Choices (Most Common)", value: 4 },
                  { label: "A, B, C, D, E", sub: "5 Choices (Extended)", value: 5 },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleInputChange("choicesPerItem", opt.value)}
                    className={`py-4 px-4 rounded-lg border-2 transition-all text-center ${
                      formData.choicesPerItem === opt.value
                        ? "bg-green-600 text-white border-green-600 shadow-md"
                        : "border-gray-200 text-gray-700 hover:border-green-500 hover:bg-green-50"
                    }`}
                  >
                    <div className="font-bold text-base">{opt.label}</div>
                    <div className="text-xs mt-0.5 opacity-80">{opt.sub}</div>
                  </button>
                ))}
              </div>
              <p className="text-xs text-green-700 font-medium">{formData.choicesPerItem} answer choices selected</p>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-gray-700">Select Class <span className="text-red-500">*</span></p>
                <p className="text-xs text-gray-400 mt-0.5">Choose which class this exam is for</p>
              </div>
              {loadingClasses ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-green-600" />
                  <span className="ml-2 text-sm text-gray-500">Loading classes...</span>
                </div>
              ) : classes.length === 0 ? (
                <div className="text-center py-8 space-y-3 border-2 border-dashed border-gray-200 rounded-xl">
                  <p className="text-sm text-gray-400">No classes available yet</p>
                  <Button type="button" size="sm" onClick={() => { onClose(); router.push("/classes"); }}
                    className="bg-green-600 hover:bg-green-700 text-white text-xs">
                    Create a New Class
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {classes.map((classItem) => (
                    <button
                      key={classItem.id}
                      onClick={() => {
                        handleInputChange("className", classItem.class_name);
                        handleInputChange("classId", classItem.id);
                        handleInputChange("folder", classItem.course_subject || "General");
                      }}
                      className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                        formData.classId === classItem.id
                          ? "border-green-500 bg-green-50"
                          : "border-gray-200 hover:border-green-400 hover:bg-green-50/50"
                      }`}
                    >
                      <div className="font-semibold text-sm text-gray-800">{classItem.class_name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{classItem.course_subject} · {classItem.students.length} students</div>
                    </button>
                  ))}
                </div>
              )}
              {formData.classId && (
                <p className="text-xs text-green-700 font-medium">✓ {formData.className} selected</p>
              )}
            </div>
          )}

          {step === 5 && (
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-gray-700">Exam Type <span className="text-red-500">*</span></p>
                <p className="text-xs text-gray-400 mt-0.5">Select the type of exam</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Board Exam", sub: "Regular exam assessment", value: "board" },
                  { label: "Diagnostic Test", sub: "Diagnostic assessment", value: "diagnostic" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { handleInputChange("examType", opt.value); setExamTypePicked(true); }}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      formData.examType === opt.value && examTypePicked
                        ? "border-green-500 bg-green-50"
                        : "border-gray-200 hover:border-green-400 hover:bg-green-50/50"
                    }`}
                  >
                    <div className={`font-semibold text-sm ${formData.examType === opt.value && examTypePicked ? "text-green-700" : "text-gray-800"}`}>{opt.label}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{opt.sub}</div>
                  </button>
                ))}
              </div>
              {!examTypePicked && (
                <p className="text-xs text-amber-600">Please select an exam type to continue</p>
              )}
              {examTypePicked && (
                <p className="text-xs text-green-700 font-medium">✓ {formData.examType === "board" ? "Board Exam" : "Diagnostic Test"} selected</p>
              )}
            </div>
          )}

          {step === 6 && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
                <h4 className="text-sm font-semibold text-gray-900 pb-2 border-b border-gray-200">Exam Summary</h4>
                {[
                  { label: "Exam Name", value: formData.name },
                  { label: "Questions", value: `${formData.totalQuestions} questions` },
                  { label: "Answer Format", value: `${formData.choicesPerItem} choices per question` },
                  { label: "Class", value: formData.className },
                  { label: "Type", value: formData.examType === "board" ? "Board Exam" : "Diagnostic Test" },
                  { label: "Date", value: new Date(formData.date).toLocaleDateString() },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between text-xs">
                    <span className="text-gray-500">{row.label}</span>
                    <span className="font-medium text-gray-800">{row.value}</span>
                  </div>
                ))}
              </div>
              {/* Date */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Exam Date <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => handleInputChange("date", e.target.value)}
                  min={getTodayDate()}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Back
            </button>
          )}
          {step < 6 ? (
            <button
              data-testid="next-button"
              onClick={() => {
                if (step === 1 && !formData.name.trim()) { toast.error("Please enter an exam name to continue"); return; }
                if (step === 1 && isDuplicate && !confirmDuplicate) { setConfirmDuplicate(true); return; }
                if (step === 2 && !questionsPicked) { toast.error("Please select a number of questions to continue"); return; }
                if (step === 4 && !formData.className) { toast.error("Please select a class before continuing"); return; }
                if (step === 5 && !examTypePicked) { toast.error("Please select an exam type to continue"); return; }
                setStep(step + 1);
              }}
              disabled={
                (step === 1 && !formData.name.trim()) ||
                (step === 2 && !questionsPicked) ||
                (step === 4 && classes.length === 0) ||
                (step === 5 && !examTypePicked)
              }
              className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed bg-green-600 hover:bg-green-700 text-white"
            >
              {step === 1 && "Continue to Questions"}
              {step === 2 && "Continue to Format"}
              {step === 3 && "Continue to Class"}
              {step === 4 && "Continue to Type"}
              {step === 5 && "Review Exam"}
            </button>
          ) : (
            <button
              data-testid="submit-button"
              onClick={handleCreateExam}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Creating Exam...</>
              ) : (
                <>Create Exam</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
