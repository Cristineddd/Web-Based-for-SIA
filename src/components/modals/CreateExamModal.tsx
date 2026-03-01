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
      <Card className="w-full max-w-md border-2 border-primary">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-foreground">Create New Exam</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-md">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {step === 1 && (
            <div className="space-y-3">
              <label className="block">
                <span className="text-sm font-semibold text-foreground mb-2 block">
                  Exam Name
                </span>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="Create New Exam"
                  className="w-full px-4 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
              <p className="text-xs text-muted-foreground">
                Enter a descriptive name for this exam
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-foreground mb-3 block">
                  Number of Questions
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {[20, 50, 100].map((num) => (
                    <button
                      key={num}
                      onClick={() => {
                        handleInputChange("totalQuestions", num);
                        setQuestionsPicked(true);
                      }}
                      className={`py-3 px-2 rounded-md font-semibold text-sm transition-all ${
                        formData.totalQuestions === num && questionsPicked
                          ? "bg-primary text-primary-foreground border-2 border-primary"
                          : "border-2 border-muted hover:border-primary"
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
                {!questionsPicked && (
                  <p className="text-xs text-red-500 mt-2">Please select a number of questions to continue</p>
                )}
              </label>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-foreground mb-3 block">
                  Number of Choices per Question
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleInputChange("choicesPerItem", 4)}
                    className={`py-3 px-4 rounded-md font-semibold text-sm transition-all border-2 ${
                      formData.choicesPerItem === 4
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-muted hover:border-primary"
                    }`}
                  >
                    4 Choices (A–D)
                  </button>
                  <button
                    onClick={() => handleInputChange("choicesPerItem", 5)}
                    className={`py-3 px-4 rounded-md font-semibold text-sm transition-all border-2 ${
                      formData.choicesPerItem === 5
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-muted hover:border-primary"
                    }`}
                  >
                    5 Choices (A–E)
                  </button>
                </div>
              </label>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
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
                      router.push('/classes');
                    }}
                    variant="default"
                  >
                    Create a New Class
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {classes.map((classItem) => (
                    <button
                      key={classItem.id}
                      onClick={() => {
                        handleInputChange("className", classItem.class_name);
                        handleInputChange("classId", classItem.id);
                      }}
                      className={`w-full text-left p-3 rounded-md border-2 transition-all ${
                        formData.classId === classItem.id
                          ? "border-primary bg-primary/10"
                          : "border-muted hover:border-primary"
                      }`}
                    >
                      <div className="font-medium">{classItem.class_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {classItem.course_subject} • Section{" "}
                        {classItem.section_block} • {classItem.students.length}{" "}
                        students
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-foreground mb-3 block">
                  Exam Type
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
                    className={`p-4 rounded-md border-2 transition-all text-left ${
                      formData.examType === "board" && examTypePicked
                        ? "border-primary bg-primary/10"
                        : "border-muted hover:border-primary"
                    }`}
                  >
                    <div className="font-semibold">Board Exam</div>
                    <div className="text-xs text-muted-foreground">
                      Regular exam assessment
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      handleInputChange("examType", "diagnostic");
                      setExamTypePicked(true);
                    }}
                    className={`p-4 rounded-md border-2 transition-all text-left ${
                      formData.examType === "diagnostic" && examTypePicked
                        ? "border-primary bg-primary/10"
                        : "border-muted hover:border-primary"
                    }`}
                  >
                    <div className="font-semibold">Diagnostic Test</div>
                    <div className="text-xs text-muted-foreground">
                      Diagnostic assessment
                    </div>
                  </button>
                </div>
                {!examTypePicked && (
                  <p className="text-xs text-red-500 mt-2">Please select an exam type to continue</p>
                )}
              </label>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-foreground mb-2 block">
                  Exam Date
                </span>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => handleInputChange("date", e.target.value)}
                  className="w-full px-4 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-foreground mb-2 block">
                  Folder / Subject *
                </span>
                <input
                  type="text"
                  value={formData.folder}
                  onChange={(e) => handleInputChange("folder", e.target.value)}
                  placeholder="Folder Name"
                  className="w-full px-4 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
            </div>
          )}

          <div className="flex gap-1 pt-4">
            {[1, 2, 3, 4, 5, 6, 7].map((s) => (
              <div
                key={s}
                className={`flex-1 h-1 rounded-full ${s <= step ? "bg-primary" : "bg-muted"}`}
              />
            ))}
          </div>
        </div>

        <div className="flex gap-3 p-6 border-t">
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="flex-1 px-4 py-2 border rounded-md font-semibold hover:bg-muted transition-colors"
            >
              Back
            </button>
          )}
          {step < 6 ? (
            <button
              onClick={() => {
                if (step === 1 && !formData.name.trim()) {
                  toast.error("Please enter an exam name");
                  return;
                }
                if (step === 2 && !questionsPicked) {
                  toast.error("Please select a number of questions");
                  return;
                }
                if (step === 4 && !formData.className) {
                  toast.error("Please select a class before continuing");
                  return;
                }
                if (step === 5 && !examTypePicked) {
                  toast.error("Please select an exam type");
                  return;
                }
                setStep(step + 1);
              }}
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={
                (step === 1 && !formData.name.trim()) ||
                (step === 2 && !questionsPicked) ||
                (step === 4 && classes.length === 0) ||
                (step === 5 && !examTypePicked)
              }
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleCreateExam}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Creating..." : "Create Exam"}
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}
