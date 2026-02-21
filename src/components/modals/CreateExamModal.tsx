"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { X, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getClasses, type Class } from "@/services/classService";
import { cn } from "@/lib/utils";

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
  choicePoints?: { [key: string]: number };
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
}: CreateExamModalProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [formData, setFormData] = useState<ExamFormData>({
    name: "",
    totalQuestions: 50,
    date: new Date().toISOString().split("T")[0],
    folder: "",
    className: "N/A",
    choicesPerItem: 4,
    examType: "Midterm Exam",
  });

  const [step, setStep] = useState(1);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchClassesData = async () => {
      if (!isOpen || !user?.id) return;

      try {
        setLoadingClasses(true);
        const fetchedClasses = await getClasses(user.id);
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

  const handleNext = () => {
    if (step === 1 && !formData.name.trim()) {
      toast.error("Please enter an exam title");
      return;
    }
    if (step === 4 && !formData.classId) {
      toast.error("Please select a class");
      return;
    }
    if (step < 5) {
      setStep(step + 1);
    } else {
      handleCreate();
    }
  };

  const handleCreate = async () => {
    if (!formData.folder.trim()) {
      toast.error("Please enter a subject/folder name");
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreateExam(formData);
      setFormData({
        name: "",
        totalQuestions: 50,
        date: new Date().toISOString().split("T")[0],
        folder: "",
        className: "N/A",
        choicesPerItem: 4,
        examType: "Midterm Exam",
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
      <Card className="w-full max-w-[500px] bg-white rounded-[32px] overflow-hidden border-none shadow-2xl animate-scale-in text-[#004D2C]">
        {/* Header */}
        <div className="p-6 pb-2">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-2xl font-black">Create New Exam</h2>
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
        <div className="p-8 pt-6 min-h-[350px]">
          {step === 1 && (
            <div className="space-y-6 animate-fade-in">
              <label className="block space-y-3">
                <span className="text-sm font-black uppercase tracking-wider">
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
            <div className="space-y-6 animate-fade-in">
              <span className="text-sm font-black uppercase tracking-wider block mb-4">
                Number of Questions
              </span>
              <div className="grid grid-cols-3 gap-3">
                {[20, 50, 100].map((num) => (
                  <button
                    key={num}
                    onClick={() => handleInputChange("totalQuestions", num)}
                    className={cn(
                      "h-16 rounded-2xl border-2 flex items-center justify-center font-black text-xl transition-all",
                      formData.totalQuestions === num
                        ? "bg-[#004D2C] border-[#004D2C] text-white shadow-lg"
                        : "bg-white border-gray-100 text-gray-400 hover:border-[#BA8E23]/30",
                    )}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-fade-in">
              <span className="text-sm font-black uppercase tracking-wider block mb-4">
                Choices per Item
              </span>
              <div className="grid grid-cols-2 gap-3">
                {[4, 5].map((num) => (
                  <button
                    key={num}
                    onClick={() => handleInputChange("choicesPerItem", num)}
                    className={cn(
                      "h-16 rounded-2xl border-2 flex items-center justify-center font-black text-xl transition-all",
                      formData.choicesPerItem === num
                        ? "bg-[#004D2C] border-[#004D2C] text-white shadow-lg"
                        : "bg-white border-gray-100 text-gray-400 hover:border-[#BA8E23]/30",
                    )}
                  >
                    {num} Choices
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4 animate-fade-in">
              <span className="text-sm font-black uppercase tracking-wider block mb-4">
                Select Class
              </span>
              {loadingClasses ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-[#BA8E23]" />
                  <p className="font-bold text-gray-400">
                    Loading your classes...
                  </p>
                </div>
              ) : classes.length === 0 ? (
                <div className="text-center py-8 space-y-4">
                  <p className="text-gray-400 font-bold">No classes found</p>
                  <Button
                    onClick={() => {
                      onClose();
                      router.push("/classes");
                    }}
                    className="bg-[#BA8E23] text-white"
                  >
                    Manage Classes
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {classes.map((cls) => (
                    <button
                      key={cls.id}
                      onClick={() => {
                        handleInputChange("classId", cls.id);
                        handleInputChange("className", cls.class_name);
                        handleInputChange("examCode", cls.class_code);
                      }}
                      className={cn(
                        "w-full h-14 px-6 rounded-2xl border-2 flex items-center justify-between font-bold transition-all",
                        formData.classId === cls.id
                          ? "bg-[#FAF9F6] border-[#BA8E23] text-[#004D2C]"
                          : "bg-white border-gray-100 text-gray-400 hover:border-[#BA8E23]/30",
                      )}
                    >
                      <div className="text-left">
                        <p className="text-sm font-black">{cls.class_name}</p>
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
            <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <span className="text-sm font-black uppercase tracking-wider block mb-3">
                    Exam Type
                  </span>
                  <select
                    value={formData.examType}
                    onChange={(e) =>
                      handleInputChange("examType", e.target.value)
                    }
                    className="w-full h-14 px-4 bg-white border-2 border-gray-100 rounded-2xl font-bold text-[#004D2C] focus:border-[#BA8E23]/50 focus:outline-none transition-all"
                  >
                    {EXAM_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2 pt-2">
                  <span className="text-sm font-black uppercase tracking-wider block mb-3">
                    Subject / Folder
                  </span>
                  <input
                    type="text"
                    value={formData.folder}
                    onChange={(e) =>
                      handleInputChange("folder", e.target.value)
                    }
                    placeholder="e.g. PHILOSOPHY"
                    className="w-full h-14 px-6 bg-white border-2 border-gray-100 rounded-2xl font-bold text-[#004D2C] focus:border-[#BA8E23]/50 focus:outline-none transition-all placeholder:text-gray-300 uppercase"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-gray-50 flex items-center gap-4 bg-gray-50/30">
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="px-6 py-4 font-black text-gray-400 hover:text-[#004D2C] transition-colors"
            >
              Back
            </button>
          )}
          {step < 5 ? (
            <button
              onClick={handleNext}
              className="flex-1 h-14 bg-[#004D2C] text-white rounded-2xl font-black text-lg shadow-lg hover:bg-[#003d22] transition-all"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={isSubmitting}
              className="flex-1 h-14 bg-[#BA8E23] text-white rounded-2xl font-black text-lg shadow-lg hover:bg-[#a67d1f] transition-all disabled:opacity-50"
            >
              {isSubmitting ? "Creating..." : "Create Exam"}
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}
