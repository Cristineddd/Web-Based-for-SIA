"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ArrowLeft, Loader2, FileText } from "lucide-react";
import { z } from "zod";
import { createExam } from "@/services/examService";
import { getClasses, type Class } from "@/services/classService";

const examSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be less than 200 characters"),
  subject: z
    .string()
    .min(1, "Subject is required")
    .max(100, "Subject must be less than 100 characters"),
  classId: z.string().min(1, "Class is required"),
  num_items: z
    .number()
    .min(1, "Must have at least 1 item")
    .max(200, "Maximum 200 items"),
  choices_per_item: z
    .number()
    .min(2, "Minimum 2 choices")
    .max(6, "Maximum 6 choices"),
  student_id_length: z
    .number()
    .min(4, "Minimum 4 digits")
    .max(12, "Maximum 12 digits"),
  description: z
    .string()
    .max(500, "Description must be less than 500 characters")
    .optional(),
  date: z.string().min(1, "Date is required"),
});

export default function NewExam() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    subject: "",
    classId: "",
    className: "",
    num_items: 50,
    choices_per_item: 4,
    student_id_length: 9,
    description: "",
    date: new Date().toISOString().split("T")[0],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchClassesData = async () => {
      if (!user?.id) return;
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
  }, [user]);

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
        // Auto-fill subject if empty
        subject: prev.subject || selectedClass.course_subject,
      }));
      setErrors((prev) => ({ ...prev, classId: "" }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    if (!user) {
      toast.error("You must be logged in to create an exam");
      setLoading(false);
      return;
    }

    try {
      const validated = examSchema.parse({
        ...formData,
        num_items: Number(formData.num_items),
        choices_per_item: Number(formData.choices_per_item),
        student_id_length: Number(formData.student_id_length),
      });

        // Prevent selecting a past date
        try {
          const selected = new Date(validated.date + 'T00:00:00');
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (selected < today) {
            toast.error('Exam date cannot be in the past');
            setLoading(false);
            return;
          }
        } catch (e) {
          toast.error('Invalid date selected');
          setLoading(false);
          return;
        }

      // Prepare data for the service
      const examData = {
        name: validated.title,
        totalQuestions: validated.num_items,
        date: validated.date,
        folder: validated.subject,
        choicesPerItem: validated.choices_per_item,
        classId: validated.classId,
        className: formData.className,
      };

      console.log('📝 Creating exam from NewExam page');
      console.log('  - User:', user);
      console.log('  - InstructorId:', user.instructorId);
      
      if (!user.instructorId) {
        toast.error('⚠️ Instructor ID not found. Please log out and log back in.');
        setLoading(false);
        return;
      }

      const newExam = await createExam(examData, user.id, user.instructorId);
      console.log('✅ Exam created:', newExam);

      toast.success("Exam created successfully");
      router.push(`/exams/${newExam.id}`);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
      } else {
        console.error("Error creating exam:", error);
        toast.error("Failed to create exam");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push("/exams")}
          className="mb-4 -ml-2"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Exams
        </Button>
        <h1 className="text-3xl font-bold text-foreground">Create New Exam</h1>
        <p className="text-muted-foreground mt-1">
          Fill in the exam details to get started
        </p>
      </div>

      <Card className="card-elevated animate-slide-up">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-accent" />
            </div>
            <div>
              <CardTitle>Exam Details</CardTitle>
              <CardDescription>Configure your exam settings</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Exam Title *</Label>
              <Input
                id="title"
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
              <Label htmlFor="class">Class *</Label>
              <Select
                value={formData.classId}
                onValueChange={handleClassChange}
                disabled={loadingClasses}
              >
                <SelectTrigger
                  className={errors.classId ? "border-destructive" : ""}
                >
                  <SelectValue
                    placeholder={
                      loadingClasses ? "Loading classes..." : "Select a class"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.class_name} ({cls.section_block})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.classId && (
                <p className="text-sm text-destructive">{errors.classId}</p>
              )}
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <Label htmlFor="subject">Subject *</Label>
              <Input
                id="subject"
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
              <Label htmlFor="date">Exam Date *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => handleChange("date", e.target.value)}
                className={errors.date ? "border-destructive" : ""}
              />
              {errors.date && (
                <p className="text-sm text-destructive">{errors.date}</p>
              )}
            </div>

            {/* Number of Items */}
            <div className="space-y-2">
              <Label htmlFor="num_items">Number of Items *</Label>
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
              <Label htmlFor="choices_per_item">Choices per Item</Label>
              <div className="grid grid-cols-4 gap-2">
                {["A", "B", "C", "D"].map((letter, idx) => (
                  <button
                    key={letter}
                    type="button"
                    onClick={() => handleChange("choices_per_item", idx + 1)}
                    className={`py-2 px-3 rounded-md font-semibold text-sm transition-all ${
                      formData.choices_per_item === idx + 1
                        ? "bg-primary text-primary-foreground border-2 border-primary"
                        : "border-2 border-muted hover:border-primary"
                    }`}
                  >
                    {letter}
                  </button>
                ))}
              </div>
              {errors.choices_per_item && (
                <p className="text-sm text-destructive">
                  {errors.choices_per_item}
                </p>
              )}
            </div>

            {/* Student ID Length */}
            <div className="space-y-2">
              <Label htmlFor="student_id_length">Student ID Length</Label>
              <Input
                id="student_id_length"
                type="number"
                min={4}
                max={12}
                value={formData.student_id_length}
                onChange={(e) =>
                  handleChange("student_id_length", e.target.value)
                }
                className={errors.student_id_length ? "border-destructive" : ""}
              />
              <p className="text-xs text-muted-foreground">Default: 9 digits</p>
              {errors.student_id_length && (
                <p className="text-sm text-destructive">
                  {errors.student_id_length}
                </p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Add any additional notes or instructions..."
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                rows={3}
              />
              {errors.description && (
                <p className="text-sm text-destructive">{errors.description}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/exams")}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 gradient-primary"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Exam"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
