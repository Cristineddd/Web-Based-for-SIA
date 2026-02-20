"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { X, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface CreateExamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateExam: (data: ExamFormData) => Promise<void>;
}

export interface ExamFormData {
  name: string;
  totalQuestions: number;
  date: string;
  folder: string;
  className: string;
  classId?: string;
  choicesPerItem?: number;
  examType?: string;
  examCode?: string;
  logoUrl?: string;
}

const EXAM_TYPES = [
  "Board Exam",
  "Diagnostic Test",
  "Midterm Exam",
  "Final Exam",
  "Quiz",
];

export function CreateExamModal({
  isOpen,
  onClose,
  onCreateExam,
  classes = [],
}: CreateExamModalProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [formData, setFormData] = useState<ExamFormData>({
    name: "",
    totalQuestions: 50,
    date: new Date().toISOString().split("T")[0],
    folder: "",
    className: "N/A", // Default for now to avoid errors in legacy code
    choicesPerItem: 4,
    examType: "Midterm Exam",
  });

  const [step, setStep] = useState(1);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    if (step === 2 && !formData.classId) {
      toast.error("Please select a class");
      return;
    }
    if (step === 5 && !formData.folder.trim()) {
      toast.error("Please enter a folder name");
      return;
    }

    if (step < 5) {
      setStep(step + 1);
    } else {
      handleCreate();
    }
  };

    setIsSubmitting(true);

    try {
      // Create exam in background - don't wait
      onCreateExam(formData).catch((error) => {
        console.error("Error creating exam:", error);
        toast.error("Failed to save exam to database");
      });
      
      // Close modal immediately for better UX
      setFormData({
        name: "",
        totalQuestions: 50,
        date: new Date().toISOString().split("T")[0],
        folder: "General",
        className: "",
        classId: undefined,
        choicesPerItem: 4,
        examType: "board",
        choicePoints: {},
      });
      setStep(1);
      onClose();
      toast.success("Exam created successfully");
    } catch (error) {
      console.error("Error creating exam:", error);
      toast.error("Failed to create exam");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
      <Card className="w-full max-w-[500px] bg-white rounded-[32px] overflow-hidden border-none shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="p-6 pb-2">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-2xl font-black text-[#004D2C]">
                Create New Exam
              </h2>
              <p className="text-sm font-bold text-gray-400">
                Step {step} of 5
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-6 h-6 text-gray-400" />
            </button>
          </div>
          <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#BA8E23] transition-all duration-300"
              style={{ width: `${(step / 5) * 100}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="p-8 pt-6 min-h-[300px]">
          {step === 1 && (
            <div className="space-y-6 animate-fade-in">
              <label className="block space-y-3">
                <span className="text-sm font-black text-[#004D2C] uppercase tracking-wider">
                  Exam Title
                </span>
                <input
                  type="text"
                  autoFocus
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="e.g. Midterm Exam - CS101"
                  className="w-full h-16 px-6 bg-white border-2 border-gray-100 rounded-2xl text-lg font-bold text-[#004D2C] focus:border-[#BA8E23]/50 focus:outline-none transition-all placeholder:text-gray-300"
                />
              </label>
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
                      onClick={() => handleInputChange("totalQuestions", num)}
                      className={`py-3 px-2 rounded-md font-semibold text-sm transition-all ${
                        formData.totalQuestions === num
                          ? "bg-primary text-primary-foreground border-2 border-primary"
                          : "border-2 border-muted hover:border-primary"
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </label>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-foreground mb-3 block">
                  Number of Choices per Question
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {[4, 5].map((num) => (
                    <button
                      key={num}
                      onClick={() => handleInputChange("choicesPerItem", num)}
                      className={`py-3 px-2 rounded-md font-semibold text-sm transition-all border-2 ${
                        formData.choicesPerItem === num
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted hover:border-primary"
                      }`}
                    >
                      {num} Choices (A-{String.fromCharCode(64 + num)})
                    </button>
                  ))}
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
                      key={cls.id}
                      onClick={() => {
                        handleInputChange("classId", cls.id);
                        handleInputChange("className", cls.class_name);
                        handleInputChange("examCode", cls.class_code);
                      }}
                      className={cn(
                        "w-full h-14 px-6 rounded-2xl border-2 flex items-center justify-between font-bold text-lg transition-all",
                        formData.classId === cls.id
                          ? "bg-[#FAF9F6] border-[#BA8E23] text-[#004D2C]"
                          : "bg-white border-gray-100 text-gray-400 hover:border-[#BA8E23]/30",
                      )}
                    >
                      <div className="text-left">
                        <p className="font-black text-sm">{cls.class_name}</p>
                        <p className="text-xs opacity-60">
                          Code: {cls.class_code}
                        </p>
                      </div>
                      {formData.classId === cls.id && (
                        <ChevronRight className="w-5 h-5 text-[#BA8E23]" />
                      )}
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
                    key={num}
                    onClick={() => handleInputChange("totalQuestions", num)}
                    className={cn(
                      "h-16 rounded-2xl border-2 flex items-center justify-center font-black text-xl transition-all",
                      formData.totalQuestions === num
                        ? "bg-[#004D2C] border-[#004D2C] text-white shadow-lg scale-[1.02]"
                        : "bg-white border-gray-100 text-gray-400 hover:border-[#BA8E23]/30",
                    )}
                  >
                    {num} Items
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6 animate-fade-in">
              <span className="text-sm font-black text-[#004D2C] uppercase tracking-wider block mb-4">
                Exam Type
              </span>
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                {EXAM_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() => handleInputChange("examType", type)}
                    className={cn(
                      "w-full h-14 px-6 rounded-2xl border-2 flex items-center justify-between font-bold text-lg transition-all",
                      formData.examType === type
                        ? "bg-[#FAF9F6] border-[#BA8E23] text-[#004D2C]"
                        : "bg-white border-gray-100 text-gray-400 hover:border-[#BA8E23]/30",
                    )}
                  >
                    <span>{type}</span>
                    {formData.examType === type && (
                      <ChevronRight className="w-5 h-5 text-[#BA8E23]" />
                    )}
                  </button>
                ))}
              </div>
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
                  Folder
                </span>
                <input
                  type="text"
                  autoFocus
                  value={formData.folder}
                  onChange={(e) => handleInputChange("folder", e.target.value)}
                  placeholder="ETHICS"
                  className="w-full h-16 px-6 bg-white border-2 border-gray-100 rounded-2xl text-lg font-bold text-[#004D2C] focus:border-[#BA8E23]/50 focus:outline-none transition-all placeholder:text-gray-300 uppercase"
                />
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-gray-50 flex items-center gap-4">
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="px-6 py-4 font-black text-gray-400 hover:text-[#004D2C] transition-colors"
            >
              Back
            </button>
          )}
          {step < 6 ? (
            <button
              onClick={() => {
                if (step === 4 && !formData.className) {
                  toast.error("Please select a class before continuing");
                  return;
                }

                setStep(step + 1);
              }}
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md font-semibold hover:bg-primary/90 transition-colors"
              disabled={step === 4 && classes.length === 0}
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
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border rounded-md font-semibold hover:bg-muted transition-colors"
          >
            {step === 5 ? "Create Exam" : "Continue"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
