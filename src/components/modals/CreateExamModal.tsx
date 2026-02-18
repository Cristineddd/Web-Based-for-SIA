"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { X, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CreateExamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateExam: (data: ExamFormData) => void | Promise<void>;
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
}: CreateExamModalProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<ExamFormData>({
    name: "",
    totalQuestions: 50,
    date: new Date().toISOString().split("T")[0],
    folder: "ETHICS",
    className: "N/A", // Default for now to avoid errors in legacy code
    choicesPerItem: 4,
    examType: "Midterm Exam",
  });

  const handleInputChange = (field: keyof ExamFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    if (step === 1 && !formData.name.trim()) {
      toast.error("Please enter an exam title");
      return;
    }
    if (step === 4 && !formData.folder.trim()) {
      toast.error("Please enter a folder name");
      return;
    }

    if (step < 4) {
      setStep(step + 1);
    } else {
      handleCreate();
    }
  };

  const handleCreate = () => {
    onCreateExam(formData);
    // Reset
    setFormData({
      name: "",
      totalQuestions: 50,
      date: new Date().toISOString().split("T")[0],
      folder: "ETHICS",
      className: "N/A",
      choicesPerItem: 4,
      examType: "Midterm Exam",
    });
    setStep(1);
    onClose();
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
                Step {step} of 4
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
              style={{ width: `${(step / 4) * 100}%` }}
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
            <div className="space-y-6 animate-fade-in">
              <span className="text-sm font-black text-[#004D2C] uppercase tracking-wider">
                Number of Items
              </span>
              <div className="grid grid-cols-1 gap-4">
                {[20, 50, 100].map((num) => (
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

          {step === 3 && (
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

          {step === 4 && (
            <div className="space-y-6 animate-fade-in">
              <label className="block space-y-3">
                <span className="text-sm font-black text-[#004D2C] uppercase tracking-wider">
                  Folder Name
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
          <Button
            onClick={handleNext}
            className={cn(
              "flex-1 h-14 rounded-2xl font-black text-lg transition-all shadow-lg",
              step === 4
                ? "bg-[#004D2C] hover:bg-[#003d22] text-white"
                : "bg-[#004D2C] hover:bg-[#003d22] text-white",
            )}
          >
            {step === 4 ? "Create Exam" : "Continue"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
