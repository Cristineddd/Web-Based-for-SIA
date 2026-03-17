"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
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
    <div className="fixed inset-0 bg-black/50 z-50 overflow-auto">
      <div className="min-h-screen px-4 py-8 flex items-center justify-center">
        <Card className="w-full max-w-lg sm:max-w-xl md:max-w-2xl lg:max-w-4xl border-2 border-primary max-h-[80vh] overflow-hidden flex flex-col my-8">
          {/* Header */}
          <div className="flex-shrink-0 p-4 sm:p-6 border-b bg-gradient-to-r from-gray-50 to-slate-50">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                Create New Exam
              </h2>
              <button
                onClick={onClose}
                className="p-1 hover:bg-white/50 rounded-md"
              >
                <X className="w-5 h-5 text-gray-700" />
              </button>
            </div>

            {/* Step Progress */}
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium text-gray-800">
                  Step {step} of 6
                </span>
              </div>
              <div className="flex space-x-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className={`flex-1 h-2 rounded-full transition-all ${
                      i + 1 <= step ? "bg-primary" : "bg-gray-200"
                    }`}
                  />
                ))}
              </div>

              {/* Step Description */}
              <div className="text-sm text-gray-700 font-medium">
                {step === 1 && "What's the name of your exam?"}
                {step === 2 && "How many questions will it have?"}
                {step === 3 && "What answer format will you use?"}
                {step === 4 && "Which class is taking this exam?"}
                {step === 5 && "What type of exam is this?"}
                {step === 6 && "Review and create your exam"}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="p-3 space-y-3">
              {step === 1 && (
                <div className="space-y-3">
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-2">
                    <div className="flex items-center gap-2 text-primary">
                      <span className="font-medium">Step 1: Exam Name</span>
                    </div>
                  </div>

                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-foreground flex items-center gap-2">
                      Exam Name *
                      <span className="text-xs text-muted-foreground">
                        (e.g., "Midterm Exam", "Quiz 1")
                      </span>
                    </span>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) =>
                        handleInputChange("name", e.target.value)
                      }
                      placeholder="Enter exam name (e.g., Midterm Exam, Final Test, Quiz 1)"
                      className={`w-full px-4 py-3 border rounded-lg bg-background focus:outline-none focus:ring-2 transition-all ${
                        formData.name.trim()
                          ? "border-primary focus:ring-primary/20"
                          : "focus:ring-gray-200 border-gray-300"
                      }`}
                    />
                    {!formData.name.trim() && (
                      <p className="text-xs text-gray-600">
                        Try names like "Math Midterm", "Science Quiz 1", or
                        "Final Exam"
                      </p>
                    )}
                    {isDuplicate && (
                      <div className="flex items-start gap-2 p-3 mt-2 bg-amber-50 border border-amber-200 rounded-lg">
                        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                        <div className="text-sm text-amber-800">
                          <p className="font-medium">Potential Duplicate</p>
                          <p className="text-xs mt-1">
                            An exam with this title already exists. You can still
                            create it, but you may want to use a unique name.
                            {confirmDuplicate ? " Click Continue again to proceed." : ""}
                          </p>
                        </div>
                      </div>
                    )}
                  </label>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-2">
                    <div className="flex items-center gap-2 text-primary">
                      <span className="font-medium">
                        Step 2: Number of Questions
                      </span>
                    </div>
                  </div>

                  <label className="block space-y-3">
                    <span className="text-sm font-semibold text-foreground">
                      How many questions? *
                    </span>
                    <div className="grid grid-cols-3 gap-3">
                      {[20, 50, 100].map((num) => (
                        <button
                          key={num}
                          onClick={() => {
                            handleInputChange("totalQuestions", num);
                            setQuestionsPicked(true);
                          }}
                          className={`py-4 px-3 rounded-lg font-semibold text-sm transition-all border-2 ${
                            formData.totalQuestions === num && questionsPicked
                              ? "bg-primary text-primary-foreground border-primary shadow-lg transform scale-105"
                              : "border-gray-300 hover:border-primary/40 hover:bg-primary/5"
                          }`}
                        >
                          <div className="font-bold text-lg">{num}</div>
                          <div className="text-xs opacity-75">
                            {num === 20
                              ? "Quick Quiz"
                              : num === 50
                                ? "Standard Test"
                                : "Major Exam"}
                          </div>
                        </button>
                      ))}
                    </div>

                    {!questionsPicked && (
                      <p className="text-xs text-amber-600 flex items-center gap-1">
                        <span>
                          Please select the number of questions to continue
                        </span>
                      </p>
                    )}
                  </label>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-2">
                    <div className="flex items-center gap-2 text-primary">
                      <span className="font-medium">Step 3: Answer Format</span>
                    </div>
                  </div>

                  <label className="block space-y-3">
                    <span className="text-sm font-semibold text-foreground">
                      Number of answer choices per question *
                    </span>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => handleInputChange("choicesPerItem", 4)}
                        className={`py-4 px-4 rounded-lg font-semibold text-sm transition-all border-2 ${
                          formData.choicesPerItem === 4
                            ? "bg-primary text-primary-foreground border-primary shadow-lg"
                            : "border-gray-300 hover:border-primary/40 hover:bg-primary/5"
                        }`}
                      >
                        <div className="font-bold text-lg">A, B, C, D</div>
                        <div className="text-xs opacity-75">
                          4 Choices (Most Common)
                        </div>
                      </button>
                      <button
                        onClick={() => handleInputChange("choicesPerItem", 5)}
                        className={`py-4 px-4 rounded-lg font-semibold text-sm transition-all border-2 ${
                          formData.choicesPerItem === 5
                            ? "bg-primary text-primary-foreground border-primary shadow-lg"
                            : "border-gray-300 hover:border-primary/40 hover:bg-primary/5"
                        }`}
                      >
                        <div className="font-bold text-lg">A, B, C, D, E</div>
                        <div className="text-xs opacity-75">
                          5 Choices (Extended)
                        </div>
                      </button>
                    </div>

                    <div className="flex items-center gap-1 text-sm text-primary">
                      <span>
                        {formData.choicesPerItem} answer choices per question
                      </span>
                    </div>
                  </label>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-4">
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-2">
                    <div className="flex items-center gap-2 text-primary">
                      <span className="font-medium">Step 4: Select Class</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-sm font-semibold text-foreground mb-3 block">
                      Select Class *
                    </span>
                    <p className="text-xs text-muted-foreground mb-3">
                      Choose which class this exam is for
                    </p>
                  </div>
                  {loadingClasses ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      <span className="ml-2 text-sm text-muted-foreground">
                        Loading classes...
                      </span>
                    </div>
                  ) : classes.length === 0 ? (
                    <div className="text-center py-8 space-y-4">
                      <p className="text-muted-foreground">
                        No classes available yet
                      </p>
                      <Button
                        type="button"
                        onClick={() => {
                          onClose();
                          router.push("/classes");
                        }}
                        variant="default"
                      >
                        Create a New Class
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 sm:max-h-60 md:max-h-72 overflow-y-auto">
                      {classes.map((classItem) => (
                        <button
                          key={classItem.id}
                          onClick={() => {
                            handleInputChange(
                              "className",
                              classItem.class_name,
                            );
                            handleInputChange("classId", classItem.id);
                            handleInputChange(
                              "folder",
                              classItem.course_subject || "General",
                            );
                          }}
                          className={`w-full text-left p-3 rounded-md border-2 transition-all ${
                            formData.classId === classItem.id
                              ? "border-primary bg-primary/10 shadow-md"
                              : "border-gray-300 hover:border-primary/40 hover:bg-primary/5"
                          }`}
                        >
                          <div className="font-medium text-sm sm:text-base">
                            {classItem.class_name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {classItem.course_subject} •{" "}
                            {classItem.students.length} students
                          </div>
                        </button>
                      ))}
                      {formData.classId && (
                        <div className="flex items-center gap-1 text-sm text-primary mt-2">
                          <span>Class selected: {formData.className}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {step === 5 && (
                <div className="space-y-4">
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-2">
                    <div className="flex items-center gap-2 text-primary">
                      <span className="font-medium">Step 5: Exam Type</span>
                    </div>
                  </div>

                  <label className="block">
                    <span className="text-sm font-semibold text-foreground mb-3 block">
                      Exam Type *
                    </span>
                    <p className="text-xs text-muted-foreground mb-4">
                      Select the type of exam
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => {
                          handleInputChange("examType", "board");
                          setExamTypePicked(true);
                        }}
                        className={`p-4 rounded-lg border-2 transition-all text-left ${
                          formData.examType === "board" && examTypePicked
                            ? "border-primary bg-primary/10 shadow-lg"
                            : "border-gray-300 hover:border-primary/40 hover:bg-primary/5"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className="font-semibold">Board Exam</div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Regular exam assessment
                        </div>
                      </button>
                      <button
                        onClick={() => {
                          handleInputChange("examType", "diagnostic");
                          setExamTypePicked(true);
                        }}
                        className={`p-4 rounded-lg border-2 transition-all text-left ${
                          formData.examType === "diagnostic" && examTypePicked
                            ? "border-primary bg-primary/10 shadow-lg"
                            : "border-gray-300 hover:border-primary/40 hover:bg-primary/5"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className="font-semibold">Diagnostic Test</div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Diagnostic assessment
                        </div>
                      </button>
                    </div>
                    {examTypePicked && (
                      <div className="flex items-center gap-1 text-sm text-primary mt-3">
                        <span>
                          {formData.examType === "board"
                            ? "Board exam"
                            : "Diagnostic test"}{" "}
                          selected
                        </span>
                      </div>
                    )}
                    {!examTypePicked && (
                      <p className="text-xs text-amber-600 flex items-center gap-1 mt-3">
                        <span>Please select an exam type to continue</span>
                      </p>
                    )}
                  </label>
                </div>
              )}

              {step === 6 && (
                <div className="space-y-4">
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-2">
                    <div className="flex items-center gap-2 text-primary">
                      <span className="font-medium">
                        Step 6: Review & Create
                      </span>
                    </div>
                  </div>

                  {/* Exam Summary */}
                  <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                    <h4 className="font-semibold text-gray-900 border-b pb-2">
                      Exam Summary
                    </h4>

                    <div className="grid grid-cols-1 gap-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Exam Name:</span>
                        <span className="font-medium">{formData.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Questions:</span>
                        <span className="font-medium">
                          {formData.totalQuestions} questions
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Answer Format:</span>
                        <span className="font-medium">
                          {formData.choicesPerItem} choices per question
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Class:</span>
                        <span className="font-medium">
                          {formData.className}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Type:</span>
                        <span className="font-medium capitalize">
                          {formData.examType}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Date:</span>
                        <span className="font-medium">
                          {new Date(formData.date).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex justify-between"></div>
                    </div>
                  </div>

                  {/* Additional Settings */}
                  <div className="space-y-3">
                    <label className="block">
                      <span className="text-sm font-semibold text-foreground mb-2 block">
                        Exam Date *
                      </span>
                      <input
                        type="date"
                        value={formData.date}
                        onChange={(e) =>
                          handleInputChange("date", e.target.value)
                        }
                        min={getTodayDate()}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                      />
                    </label>

                    {/* Folder / Subject removed */}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex-shrink-0 flex gap-3 p-3 sm:p-4 border-t bg-gray-50">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
              >
                Previous
              </button>
            )}
            {step < 6 ? (
              <button
                data-testid="next-button"
                onClick={() => {
                  if (step === 1 && !formData.name.trim()) {
                    toast.error("Please enter an exam name to continue");
                    return;
                  }
                  // Duplicate check on Step 1 — require confirmation before advancing
                  if (step === 1 && isDuplicate && !confirmDuplicate) {
                    setConfirmDuplicate(true);
                    return;
                  }
                  if (step === 2 && !questionsPicked) {
                    toast.error(
                      "Please select a number of questions to continue",
                    );
                    return;
                  }
                  if (step === 4 && !formData.className) {
                    toast.error("Please select a class before continuing");
                    return;
                  }
                  if (step === 5 && !examTypePicked) {
                    toast.error("Please select an exam type to continue");
                    return;
                  }
                  setStep(step + 1);
                }}
                className={`flex items-center justify-center gap-2 flex-1 px-4 py-2 rounded-lg font-semibold transition-all ${
                  (step === 1 && !formData.name.trim()) ||
                  (step === 2 && !questionsPicked) ||
                  (step === 4 && classes.length === 0) ||
                  (step === 5 && !examTypePicked)
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-[#166534] text-white hover:bg-[#1a7a3e] shadow-md hover:shadow-lg"
                }`}
                disabled={
                  (step === 1 && !formData.name.trim()) ||
                  (step === 2 && !questionsPicked) ||
                  (step === 4 && classes.length === 0) ||
                  (step === 5 && !examTypePicked)
                }
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
                className="flex items-center justify-center gap-2 flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating Exam...
                  </>
                ) : (
                  <>Create Exam</>
                )}
              </button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
