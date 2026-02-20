"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ExamTemplate } from "@/services/templateService";

interface CreateTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    data: Omit<ExamTemplate, "id" | "createdAt" | "createdBy"> & {
      isStandard?: boolean;
    },
  ) => void | Promise<void>;
}

export function CreateTemplateModal({
  isOpen,
  onClose,
  onSave,
}: CreateTemplateModalProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    num_items: 50 as 20 | 50 | 100,
    choices_per_item: 4,
    student_id_length: 6,
    isStandard: true,
  });

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    if (step === 1 && !formData.name.trim()) {
      toast.error("Please enter a template name");
      return;
    }
    if (step < 3) {
      setStep(step + 1);
    } else {
      handleCreate();
    }
  };

  const handleCreate = async () => {
    try {
      await onSave(formData);
      // Reset
      setFormData({
        name: "",
        description: "",
        num_items: 50,
        choices_per_item: 4,
        student_id_length: 6,
        isStandard: true,
      });
      setStep(1);
      onClose();
    } catch (error) {
      console.error("Error saving template:", error);
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
                Create New Template
              </h2>
              <p className="text-sm font-bold text-gray-400">
                Step {step} of 3
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
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="p-8 pt-6 min-h-[300px]">
          {step === 1 && (
            <div className="space-y-6 animate-fade-in">
              <div className="space-y-4">
                <label className="block space-y-3">
                  <span className="text-sm font-black text-[#004D2C] uppercase tracking-wider">
                    Template Name
                  </span>
                  <input
                    type="text"
                    autoFocus
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    placeholder="e.g. Science Quiz Template"
                    className="w-full h-16 px-6 bg-white border-2 border-gray-100 rounded-2xl text-lg font-bold text-[#004D2C] focus:border-[#BA8E23]/50 focus:outline-none transition-all placeholder:text-gray-300"
                  />
                </label>
                <label className="block space-y-3">
                  <span className="text-sm font-black text-[#004D2C] uppercase tracking-wider">
                    Description
                  </span>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      handleInputChange("description", e.target.value)
                    }
                    placeholder="Short description of this template"
                    className="w-full h-24 p-6 bg-white border-2 border-gray-100 rounded-2xl text-base font-bold text-[#004D2C] focus:border-[#BA8E23]/50 focus:outline-none transition-all placeholder:text-gray-300 resize-none"
                  />
                </label>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-fade-in">
              <span className="text-sm font-black text-[#004D2C] uppercase tracking-wider">
                Select Layout Format
              </span>
              <div className="grid grid-cols-1 gap-4">
                {[20, 50, 100].map((num) => (
                  <button
                    key={num}
                    onClick={() => handleInputChange("num_items", num)}
                    className={cn(
                      "h-16 rounded-2xl border-2 flex items-center justify-between px-6 font-black text-xl transition-all",
                      formData.num_items === num
                        ? "bg-[#004D2C] border-[#004D2C] text-white shadow-lg scale-[1.02]"
                        : "bg-white border-gray-100 text-gray-400 hover:border-[#BA8E23]/30",
                    )}
                  >
                    <span>{num} Items</span>
                    {formData.num_items === num && (
                      <Check className="w-6 h-6" />
                    )}
                  </button>
                ))}
              </div>
              <p className="text-xs text-center text-gray-400 font-bold">
                Standardized student ID fields (6-digits) will be included.
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-fade-in">
              <span className="text-sm font-black text-[#004D2C] uppercase tracking-wider block mb-4">
                Layout Version
              </span>
              <div className="space-y-3">
                <button
                  onClick={() => handleInputChange("isStandard", true)}
                  className={cn(
                    "w-full p-6 rounded-2xl border-2 text-left transition-all",
                    formData.isStandard
                      ? "bg-[#FAF9F6] border-[#BA8E23] text-[#004D2C]"
                      : "bg-white border-gray-100 text-gray-400 hover:border-[#BA8E23]/30",
                  )}
                >
                  <p className="font-black text-lg">Standardized Layout</p>
                  <p className="text-sm opacity-60">
                    Uses the new PNG-based standardized OMR formats.
                  </p>
                </button>
                <button
                  onClick={() => handleInputChange("isStandard", false)}
                  className={cn(
                    "w-full p-6 rounded-2xl border-2 text-left transition-all",
                    !formData.isStandard
                      ? "bg-[#FAF9F6] border-[#BA8E23] text-[#004D2C]"
                      : "bg-white border-gray-100 text-gray-400 hover:border-[#BA8E23]/30",
                  )}
                >
                  <p className="font-black text-lg">Classic Layout</p>
                  <p className="text-sm opacity-60">
                    Uses the legacy answer sheet format.
                  </p>
                </button>
              </div>
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
            className="flex-1 h-14 rounded-2xl font-black text-lg transition-all shadow-lg bg-[#004D2C] hover:bg-[#003d22] text-white"
          >
            {step === 3 ? "Save Template" : "Continue"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
