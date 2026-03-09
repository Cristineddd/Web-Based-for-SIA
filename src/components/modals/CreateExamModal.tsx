"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { X, Loader2 } from "lucide-react";
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
}

interface ExamFormData {
  name: string;
  totalQuestions: number;
  date: string;
  folder: string;
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
  const { user } = useAuth();
  const router = useRouter();
  const [formData, setFormData] = useState<ExamFormData>({
    name: "",
    totalQuestions: 50,
    date: new Date().toISOString().split("T")[0],
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

  // Pre-fill form when opening from a template reuse flow
  useEffect(() => {
    if (isOpen && fromTemplate) {
      setFormData((prev) => ({
        ...prev,
        name: `${fromTemplate.name} (Copy)`,
        totalQuestions: fromTemplate.totalQuestions,
        choicesPerItem: fromTemplate.choicesPerItem,
        folder: fromTemplate.description || "General",
        className: fromTemplate.className || "",
        classId: fromTemplate.classId,
      }));
      setQuestionsPicked(true);
      // Jump straight to step 1 (name) so the user can rename
      setStep(1);
    }
  }, [isOpen, fromTemplate]);

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
    if (!formData.folder.trim()) {
      toast.error("Please enter a subject/folder name");
      return;
    }

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-lg sm:max-w-xl md:max-w-2xl lg:max-w-4xl border-2 border-primary max-h-[90vh] overflow-hidden flex flex-col">
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
              <span className="text-green-600">
                {Math.round((step / 6) * 100)}% Complete
              </span>
            </div>
            <div className="flex space-x-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 h-2 rounded-full transition-all ${
                    i + 1 <= step ? "bg-green-500" : "bg-gray-200"
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
          <div className="p-4 sm:p-6 space-y-4 min-h-[400px]">
            {step === 1 && (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-800 mb-2">
                    <span className="font-medium">Step 1: Exam Name</span>
                  </div>
                  <p className="text-sm text-green-700">
                    Give your exam a clear, descriptive name that helps you
                    identify it later.
                  </p>
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
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    placeholder="Enter exam name (e.g., Midterm Exam, Final Test, Quiz 1)"
                    className={`w-full px-4 py-3 border rounded-lg bg-background focus:outline-none focus:ring-2 transition-all ${
                      formData.name.trim()
                        ? "border-green-500 focus:ring-green-200"
                        : "focus:ring-gray-200 border-gray-300"
                    }`}
                  />
                  {formData.name.trim() && (
                    <div className="flex items-center gap-1 text-sm text-green-600">
                      <span>Good exam name!</span>
                    </div>
                  )}
                  {!formData.name.trim() && (
                    <p className="text-xs text-gray-600">
                      Try names like "Math Midterm", "Science Quiz 1", or "Final
                      Exam"
                    </p>
                  )}
                </label>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-800 mb-2">
                    <span className="font-medium">
                      Step 2: Number of Questions
                    </span>
                  </div>
                  <p className="text-sm text-green-700">
                    Choose how many questions your exam will have. Select a
                    preset or enter a custom number.
                  </p>
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
                            ? "bg-green-500 text-white border-green-500 shadow-lg transform scale-105"
                            : "border-gray-300 hover:border-green-400 hover:bg-green-50"
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

                  {questionsPicked && (
                    <div className="flex items-center gap-1 text-sm text-green-600">
                      <span>{formData.totalQuestions} questions selected</span>
                    </div>
                  )}
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
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-800 mb-2">
                    <span className="font-medium">Step 3: Answer Format</span>
                  </div>
                  <p className="text-sm text-green-700">
                    Choose how many answer choices each question will have. Most
                    exams use 4 choices (A, B, C, D).
                  </p>
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
                          ? "bg-green-500 text-white border-green-500 shadow-lg"
                          : "border-gray-300 hover:border-green-400 hover:bg-green-50"
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
                          ? "bg-green-500 text-white border-green-500 shadow-lg"
                          : "border-gray-300 hover:border-green-400 hover:bg-green-50"
                      }`}
                    >
                      <div className="font-bold text-lg">A, B, C, D, E</div>
                      <div className="text-xs opacity-75">
                        5 Choices (Extended)
                      </div>
                    </button>
                  </div>

                  <div className="flex items-center gap-1 text-sm text-green-600">
                    <span>
                      {formData.choicesPerItem} answer choices per question
                    </span>
                  </div>
                </label>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-800 mb-2">
                    <span className="font-medium">Step 4: Select Class</span>
                  </div>
                  <p className="text-sm text-green-700">
                    Choose which class will take this exam. This helps track
                    student performance.
                  </p>
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
                          handleInputChange("className", classItem.class_name);
                          handleInputChange("classId", classItem.id);
                        }}
                        className={`w-full text-left p-3 rounded-md border-2 transition-all ${
                          formData.classId === classItem.id
                            ? "border-green-500 bg-green-50 shadow-md"
                            : "border-gray-300 hover:border-green-400 hover:bg-green-50"
                        }`}
                      >
                        <div className="font-medium text-sm sm:text-base">
                          {classItem.class_name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {classItem.course_subject} • Section{" "}
                          {classItem.section_block} •{" "}
                          {classItem.students.length} students
                        </div>
                      </button>
                    ))}
                    {formData.classId && (
                      <div className="flex items-center gap-1 text-sm text-green-600 mt-2">
                        <span>Class selected: {formData.className}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {step === 5 && (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-800 mb-2">
                    <span className="font-medium">Step 5: Exam Type</span>
                  </div>
                  <p className="text-sm text-green-700">
                    Select the type of exam you want to create. This affects
                    scoring and analysis.
                  </p>
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
                          ? "border-green-500 bg-green-50 shadow-lg"
                          : "border-gray-300 hover:border-green-400 hover:bg-green-50"
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
                          ? "border-green-500 bg-green-50 shadow-lg"
                          : "border-gray-300 hover:border-green-400 hover:bg-green-50"
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
                    <div className="flex items-center gap-1 text-sm text-green-600 mt-3">
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
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-800 mb-2">
                    <span className="font-medium">Step 6: Review & Create</span>
                  </div>
                  <p className="text-sm text-green-700">
                    Review your exam details before creating. Make sure
                    everything looks correct.
                  </p>
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
                      <span className="font-medium">{formData.className}</span>
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
                    <div className="flex justify-between">
                      <span className="text-gray-600">Folder:</span>
                      <span className="font-medium">{formData.folder}</span>
                    </div>
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
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-500 transition-all"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-semibold text-foreground mb-2 block">
                      Folder / Subject *
                    </span>
                    <input
                      type="text"
                      value={formData.folder}
                      onChange={(e) =>
                        handleInputChange("folder", e.target.value)
                      }
                      placeholder="e.g., Mathematics, Science, English"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-500 transition-all"
                    />
                  </label>
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
              onClick={() => {
                if (step === 1 && !formData.name.trim()) {
                  toast.error("Please enter an exam name to continue");
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
              onClick={handleCreateExam}
              disabled={isSubmitting}
              className="flex items-center justify-center gap-2 flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
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
  );
}
