"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { type Exam } from "@/services/examService";
import { isExamEditable } from "@/lib/utils";

interface EditExamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (examId: string, data: Partial<Exam>) => Promise<void>;
  exam: Exam | null;
}

export function EditExamModal({
  isOpen,
  onClose,
  onUpdate,
  exam,
}: EditExamModalProps) {
  const [formData, setFormData] = useState({
    title: "",
    subject: "",
    created_at: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (exam) {
      setFormData({
        title: exam.title || "",
        subject: exam.subject || "",
        created_at: exam.created_at || new Date().toISOString().split("T")[0],
      });
    }
  }, [exam, isOpen]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!exam) return;

    // Safety check: Ensure exam is still editable
    if (!isExamEditable(exam)) {
      toast.error("This exam is now locked and cannot be edited.");
      onClose();
      return;
    }

    if (!formData.title.trim()) {
      toast.error("Please enter an exam title");
      return;
    }
    if (!formData.subject.trim()) {
      toast.error("Please enter a subject/folder name");
      return;
    }

    try {
      setIsSaving(true);
      await onUpdate(exam.id, {
        title: formData.title,
        subject: formData.subject,
        created_at: formData.created_at,
      });
      toast.success("Exam updated successfully");
      onClose();
    } catch (error) {
      console.error("Error updating exam:", error);
      toast.error("Failed to update exam");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !exam) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
      <Card className="w-full max-w-[450px] bg-white rounded-[32px] overflow-hidden border-none shadow-2xl animate-scale-in">
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-xl font-black text-[#004D2C]">
            Edit Exam Information
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-8 space-y-6">
          <label className="block space-y-2">
            <span className="text-xs font-black text-[#004D2C] uppercase tracking-wider">
              Exam Title
            </span>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              className="w-full h-12 px-4 bg-gray-50 border-2 border-transparent rounded-xl font-bold text-[#004D2C] focus:bg-white focus:border-[#BA8E23]/50 focus:outline-none transition-all"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-xs font-black text-[#004D2C] uppercase tracking-wider">
              Subject / Folder
            </span>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) => handleInputChange("subject", e.target.value)}
              className="w-full h-12 px-4 bg-gray-50 border-2 border-transparent rounded-xl font-bold text-[#004D2C] focus:bg-white focus:border-[#BA8E23]/50 focus:outline-none transition-all uppercase"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-xs font-black text-[#004D2C] uppercase tracking-wider">
              Exam Date
            </span>
            <input
              type="date"
              value={formData.created_at}
              onChange={(e) => handleInputChange("created_at", e.target.value)}
              className="w-full h-12 px-4 bg-gray-50 border-2 border-transparent rounded-xl font-bold text-[#004D2C] focus:bg-white focus:border-[#BA8E23]/50 focus:outline-none transition-all"
            />
          </label>
        </div>

        <div className="p-8 border-t bg-gray-50/50 flex gap-4">
          <Button
            variant="ghost"
            onClick={onClose}
            className="flex-1 h-12 rounded-xl font-black text-gray-400 hover:text-gray-600"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 h-12 bg-[#004D2C] hover:bg-[#003d22] text-white rounded-xl font-black shadow-lg"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            Save Changes
          </Button>
        </div>
      </Card>
    </div>
  );
}
