"use client";

import { useState, useEffect } from "react";
import { X, Loader2, AlertTriangle } from "lucide-react";
import { getClasses, type Class } from "@/services/classService";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
    folder?: string;
  } | null;
  /** Existing exam titles for duplicate detection at Step 1. */
  existingExamTitles?: string[];
  /** If true, uses the simplified single-page UI from the screenshot */
  simpleMode?: boolean;
  classId?: string;
  className?: string;
  folder?: string;
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
  simpleMode = false,
  classId,
  className,
  folder,
}: CreateExamModalProps) {
  const { user } = useAuth();

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

  // Initialize or Reset form
  useEffect(() => {
    if (isOpen) {
      if (fromTemplate) {
        setFormData({
          name: fromTemplate.name || "",
          totalQuestions: fromTemplate.totalQuestions || 50,
          date: getTodayDate(),
          folder: fromTemplate.folder || "General",
          className: fromTemplate.className || "",
          classId: fromTemplate.classId || undefined,
          choicesPerItem: fromTemplate.choicesPerItem || 5,
          examType: "board",
        });
        if (fromTemplate.totalQuestions) setQuestionsPicked(true);
      } else if (classId) {
        setFormData((prev) => ({
          ...prev,
          classId: classId,
          className: className || "",
          folder: folder || prev.folder,
        }));
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
  }, [isOpen, fromTemplate, classId, className, folder]);

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
    <div className="fixed inset-0 bg-black/10 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex-shrink-0 px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold text-gray-900">Create New Exam</h2>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          {!simpleMode && (
            <p className="text-xs text-gray-500 mt-0.5">
              {step === 1 && "What's the name of your exam?"}
              {step === 2 && "How many questions will it have?"}
              {step === 3 && "What answer format will you use?"}
              {step === 4 && "Which class is taking this exam?"}
              {step === 5 && "What type of exam is this?"}
              {step === 6 && "Review and create your exam"}
            </p>
          )}

          {!simpleMode && (
            <div className="space-y-1.5 mt-4">
              <div className="flex justify-between text-xs text-gray-500">
                <span className="font-medium text-gray-700">
                  Step {step} of 6
                </span>
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
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {simpleMode ? (
            <>
              {/* Simple Mode UI matching Screenshot */}
              <div className="space-y-2">
                <label className="text-[13px] font-bold text-gray-600">
                  Exam Title
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="e.g. Midterm Examination"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-white text-[14px] focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all placeholder:text-gray-300"
                />
              </div>

              {!formData.classId || !simpleMode ? (
                <div className="space-y-2">
                  <label className="text-[13px] font-bold text-gray-600">
                    Tag Class
                  </label>
                  {loadingClasses ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-green-600" />
                    </div>
                  ) : (
                    <Select
                      value={formData.classId || ""}
                      onValueChange={(id) => {
                        const c = classes.find((i) => i.id === id);
                        if (c) {
                          handleInputChange("className", c.class_name);
                          handleInputChange("classId", c.id);
                          handleInputChange(
                            "folder",
                            c.course_subject || "General",
                          );
                        }
                      }}
                    >
                      <SelectTrigger className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-white text-[14px] focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all">
                        <SelectValue placeholder="Choose Class..." />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        {classes.map((c) => (
                          <SelectItem
                            key={c.id}
                            value={c.id}
                            className="cursor-pointer"
                          >
                            <div className="flex flex-col">
                              <span className="font-medium text-gray-800">
                                {c.class_name}
                              </span>
                              <span className="text-xs text-gray-400">
                                {c.course_subject}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-[13px] font-bold text-gray-600">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={formData.folder}
                    onChange={(e) =>
                      handleInputChange("folder", e.target.value)
                    }
                    placeholder="e.g. Biology"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 text-[14px] focus:outline-none transition-all placeholder:text-gray-300 font-medium text-gray-500"
                    readOnly
                  />
                </div>
              )}

              <div className="space-y-3">
                <label className="text-[13px] font-bold text-gray-600">
                  Number of Items
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[20, 50, 100, 150, 200].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => {
                        handleInputChange("totalQuestions", num);
                        setQuestionsPicked(true);
                      }}
                      className={`py-3 px-2 rounded-xl border-2 transition-all font-bold text-[13px] ${
                        formData.totalQuestions === num
                          ? "bg-green-50 text-green-600 border-green-500"
                          : "border-gray-100 text-gray-400 hover:border-green-200 hover:bg-green-50/50"
                      }`}
                    >
                      {num} Items
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              {step === 1 && (
                <div className="space-y-3">
                  <label className="block space-y-1.5">
                    <span className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                      Exam Name <span className="text-red-500">*</span>
                    </span>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) =>
                        handleInputChange("name", e.target.value)
                      }
                      placeholder='e.g. "Midterm Exam", "Quiz 1"'
                      className={`w-full px-3 py-2.5 border rounded-lg bg-white text-sm focus:outline-none focus:ring-2 transition-all ${
                        formData.name.trim()
                          ? "border-green-500 focus:ring-green-500/20"
                          : "border-gray-200 focus:ring-green-500/20 focus:border-green-500"
                      }`}
                    />
                  </label>
                  {isDuplicate && (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <div className="text-xs text-amber-800">
                        <p className="font-semibold">Potential Duplicate</p>
                        <p className="mt-0.5">
                          An exam with this name already exists.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {step === 2 && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-gray-700">
                    How many questions? <span className="text-red-500">*</span>
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { num: 20, label: "Quick Quiz" },
                      { num: 50, label: "Standard" },
                      { num: 100, label: "Major Exam" },
                      { num: 150, label: "Comprehensive" },
                      { num: 200, label: "Extended" },
                    ].map(({ num, label }) => (
                      <button
                        key={num}
                        onClick={() => {
                          handleInputChange("totalQuestions", num);
                          setQuestionsPicked(true);
                        }}
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
                </div>
              )}

              {step === 3 && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-gray-700">
                    Answer choices per question{" "}
                    <span className="text-red-500">*</span>
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "A, B, C, D", sub: "4 Choices", value: 4 },
                      { label: "A, B, C, D, E", sub: "5 Choices", value: 5 },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() =>
                          handleInputChange("choicesPerItem", opt.value)
                        }
                        className={`py-4 px-4 rounded-lg border-2 transition-all text-center ${
                          formData.choicesPerItem === opt.value
                            ? "bg-green-600 text-white border-green-600 shadow-md"
                            : "border-gray-200 text-gray-700 hover:border-green-500 hover:bg-green-50"
                        }`}
                      >
                        <div className="font-bold text-base">{opt.label}</div>
                        <div className="text-xs mt-0.5 opacity-80">
                          {opt.sub}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-gray-700">
                    Tag Class
                  </p>
                  {loadingClasses ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-green-600" />
                    </div>
                  ) : (
                    <Select
                      value={formData.classId || ""}
                      onValueChange={(id) => {
                        const c = classes.find((i) => i.id === id);
                        if (c) {
                          handleInputChange("className", c.class_name);
                          handleInputChange("classId", c.id);
                          handleInputChange(
                            "folder",
                            c.course_subject || "General",
                          );
                        }
                      }}
                    >
                      <SelectTrigger className="w-full h-12 text-sm border-2 rounded-lg">
                        <SelectValue placeholder="Choose Class..." />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        {classes.map((c) => (
                          <SelectItem
                            key={c.id}
                            value={c.id}
                            className="cursor-pointer"
                          >
                            <div className="flex flex-col">
                              <span className="font-medium text-gray-800">
                                {c.class_name}
                              </span>
                              <span className="text-xs text-gray-400">
                                {c.course_subject}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {step === 5 && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-gray-700">
                    Exam Type
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {["board", "diagnostic"].map((t) => (
                      <button
                        key={t}
                        onClick={() => {
                          handleInputChange("examType", t as any);
                          setExamTypePicked(true);
                        }}
                        className={`p-4 rounded-lg border-2 transition-all text-left ${
                          formData.examType === t && examTypePicked
                            ? "border-green-500 bg-green-50"
                            : "border-gray-200"
                        }`}
                      >
                        <div className="font-semibold text-sm capitalize">
                          {t} Exam
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 6 && (
                <div className="space-y-4">
                  <div className="bg-gray-50 border rounded-lg p-4 space-y-2">
                    <h4 className="text-sm font-semibold pb-2 border-b">
                      Summary
                    </h4>
                    <div className="flex justify-between text-xs">
                      <span>Name</span>
                      <span>{formData.name}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span>Items</span>
                      <span>{formData.totalQuestions}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span>Class</span>
                      <span>{formData.className}</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold">Exam Date</label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) =>
                        handleInputChange("date", e.target.value)
                      }
                      className="w-full px-3 py-2.5 border rounded-lg text-sm"
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex gap-3 px-6 py-5 border-t border-gray-100 bg-gray-50/50 rounded-b-xl">
          {simpleMode ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-[14px] font-bold text-gray-500 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateExam}
                disabled={isSubmitting || !formData.name.trim()}
                className="flex-[1.5] px-4 py-3 bg-[#10B981] hover:bg-[#059669] text-white rounded-xl text-[14px] font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-500/10 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Creating...
                  </>
                ) : (
                  "Create Exam"
                )}
              </button>
            </>
          ) : (
            <>
              {step > 1 && (
                <button
                  onClick={() => setStep(step - 1)}
                  className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-100"
                >
                  Back
                </button>
              )}
              {step < 6 ? (
                <button
                  onClick={() => setStep(step + 1)}
                  disabled={
                    (step === 1 && !formData.name.trim()) ||
                    (step === 2 && !questionsPicked)
                  }
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                >
                  Continue
                </button>
              ) : (
                <button
                  onClick={handleCreateExam}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                >
                  {isSubmitting ? "Creating..." : "Create Exam"}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
