"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Loader2, Save } from "lucide-react";
import { getClasses, type Class } from "@/services/classService";
import { updateExam, type Exam } from "@/services/examService";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface EditExamModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: Exam;
  onExamUpdated: (updatedExam: Exam) => void;
}

export function EditExamModal({
  isOpen,
  onClose,
  exam,
  onExamUpdated,
}: EditExamModalProps) {
  const { user } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    title: exam.title,
    subject: exam.subject,
    className: exam.className || "",
    classId: "",
    num_items: exam.num_items,
    choices_per_item: exam.choices_per_item,
    created_at: exam.created_at
      ? new Date(exam.created_at).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when exam changes or modal opens
  useEffect(() => {
    if (isOpen && exam) {
      setFormData({
        title: exam.title,
        subject: exam.subject,
        className: exam.className || "",
        classId: "",
        num_items: exam.num_items,
        choices_per_item: exam.choices_per_item,
        created_at: exam.created_at
          ? new Date(exam.created_at).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
      });
      setErrors({});
    }
  }, [isOpen, exam]);

  // Fetch classes
  useEffect(() => {
    const fetchClassesData = async () => {
      if (!isOpen) return;
      try {
        setLoadingClasses(true);
        const userId = user?.id;
        const fetchedClasses = await getClasses(userId);
        setClasses(fetchedClasses);

        // Match current className to a classId
        if (exam.className) {
          const matched = fetchedClasses.find(
            (c) => c.class_name === exam.className,
          );
          if (matched) {
            setFormData((prev) => ({ ...prev, classId: matched.id }));
          }
        }
      } catch (error) {
        console.error("Error fetching classes:", error);
      } finally {
        setLoadingClasses(false);
      }
    };
    fetchClassesData();
  }, [isOpen, user, exam.className]);

  const handleChange = (field: string, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleClassChange = (classId: string) => {
    const selectedClass = classes.find((c) => c.id === classId);
    if (selectedClass) {
      setFormData((prev) => ({
        ...prev,
        classId: classId,
        className: selectedClass.class_name,
        subject: prev.subject || selectedClass.course_subject,
      }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = "Title is required";
    } else if (formData.title.length > 200) {
      newErrors.title = "Title must be less than 200 characters";
    }

    if (!formData.subject.trim()) {
      newErrors.subject = "Subject is required";
    }

    if (!formData.created_at) {
      newErrors.created_at = "Date is required";
    } else {
      try {
        const selected = new Date(formData.created_at + "T00:00:00");
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (selected < today) {
          newErrors.created_at = "Exam date cannot be in the past";
        }
      } catch {
        newErrors.created_at = "Invalid date selected";
      }
    }

    if (formData.num_items < 1 || formData.num_items > 200) {
      newErrors.num_items = "Must be between 1 and 200";
    }

    if (formData.choices_per_item < 3 || formData.choices_per_item > 5) {
      newErrors.choices_per_item = "Must be between 3 and 5";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setIsSubmitting(true);

    try {
      const updates: Partial<Exam> = {
        title: formData.title.trim(),
        subject: formData.subject.trim(),
        className: formData.className || undefined,
        num_items: Number(formData.num_items),
        choices_per_item: Number(formData.choices_per_item),
        created_at: formData.created_at,
      };

      await updateExam(exam.id, updates);

      const updatedExam: Exam = {
        ...exam,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      onExamUpdated(updatedExam);
      toast.success("Exam updated successfully");
      onClose();
    } catch (error) {
      console.error("Error updating exam:", error);
      toast.error("Failed to update exam");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      <Card className="w-full max-w-lg border-2 border-primary max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-foreground">
            Edit Exam Details
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="edit-title">Exam Title *</Label>
            <Input
              id="edit-title"
              placeholder="Exam Title"
              value={formData.title}
              onChange={(e) => handleChange("title", e.target.value)}
              className={errors.title ? "border-destructive" : ""}
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title}</p>
            )}
          </div>

          {/* Class Selection */}
          <div className="space-y-2">
            <Label>Class</Label>
            {loadingClasses ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">
                  Loading classes...
                </span>
              </div>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {classes.map((classItem) => (
                  <button
                    key={classItem.id}
                    type="button"
                    onClick={() => handleClassChange(classItem.id)}
                    className={`w-full text-left p-3 rounded-md border-2 transition-all ${
                      formData.classId === classItem.id
                        ? "border-primary bg-primary/10"
                        : "border-muted hover:border-primary"
                    }`}
                  >
                    <div className="font-medium text-sm">
                      {classItem.class_name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {classItem.course_subject} &bull; Section{" "}
                      {classItem.section_block}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="edit-subject">Subject *</Label>
            <Input
              id="edit-subject"
              placeholder="Subject"
              value={formData.subject}
              onChange={(e) => handleChange("subject", e.target.value)}
              className={errors.subject ? "border-destructive" : ""}
            />
            {errors.subject && (
              <p className="text-sm text-destructive">{errors.subject}</p>
            )}
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="edit-date">Exam Date *</Label>
            <Input
              id="edit-date"
              type="date"
              value={formData.created_at}
              onChange={(e) => handleChange("created_at", e.target.value)}
              className={errors.created_at ? "border-destructive" : ""}
            />
            {errors.created_at && (
              <p className="text-sm text-destructive">{errors.created_at}</p>
            )}
          </div>

          {/* Number of Items */}
          <div className="space-y-2">
            <Label>Number of Items *</Label>
            <div className="grid grid-cols-3 gap-2">
              {[20, 50, 100].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleChange("num_items", num)}
                  className={`py-2 px-3 rounded-md font-semibold text-sm transition-all ${
                    formData.num_items === num
                      ? "bg-primary text-primary-foreground border-2 border-primary"
                      : "border-2 border-muted hover:border-primary"
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
            {errors.num_items && (
              <p className="text-sm text-destructive">{errors.num_items}</p>
            )}
          </div>

          {/* Choices per Item */}
          <div className="space-y-2">
            <Label>Choices per Item</Label>
            <div className="grid grid-cols-3 gap-2">
              {[3, 4, 5].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleChange("choices_per_item", num)}
                  className={`py-2 px-3 rounded-md font-semibold text-sm transition-all ${
                    formData.choices_per_item === num
                      ? "bg-primary text-primary-foreground border-2 border-primary"
                      : "border-2 border-muted hover:border-primary"
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
            {errors.choices_per_item && (
              <p className="text-sm text-destructive">
                {errors.choices_per_item}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className="flex-1 gradient-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>,
    document.body
  );
}
