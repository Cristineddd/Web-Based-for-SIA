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
import { Loader2, FileText, ChevronRight, ChevronLeft, Check } from "lucide-react";
import { z } from "zod";
import { createExam } from "@/services/examService";
import { getClasses, type Class } from "@/services/classService";
import { Button as BackButton } from "@/components/ui/button";

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
  const [currentStep, setCurrentStep] = useState(1);

  const steps = [
    {
      number: 1,
      title: "Basic Information",
      description: "Exam title, class, subject, and date"
    },
    {
      number: 2,
      title: "Exam Configuration",
      description: "Number of items and format settings"
    },
    {
      number: 3,
      title: "Review & Create",
      description: "Final details and confirmation"
    }
  ];

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

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.title.trim()) {
        newErrors.title = "Title is required";
      } else if (formData.title.length > 200) {
        newErrors.title = "Title must be less than 200 characters";
      }

      if (!formData.classId) {
        newErrors.classId = "Class is required";
      }

      if (!formData.subject.trim()) {
        newErrors.subject = "Subject is required";
      } else if (formData.subject.length > 100) {
        newErrors.subject = "Subject must be less than 100 characters";
      }

      if (!formData.date) {
        newErrors.date = "Date is required";
      } else {
        try {
          const selected = new Date(formData.date + 'T00:00:00');
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (selected < today) {
            newErrors.date = 'Exam date cannot be in the past';
          }
        } catch (e) {
          newErrors.date = 'Invalid date selected';
        }
      }
    }

    if (step === 2) {
      if (formData.num_items < 1 || formData.num_items > 200) {
        newErrors.num_items = "Number of items must be between 1 and 200";
      }

      if (formData.choices_per_item < 2 || formData.choices_per_item > 6) {
        newErrors.choices_per_item = "Choices per item must be between 2 and 6";
      }

      if (formData.student_id_length < 4 || formData.student_id_length > 12) {
        newErrors.student_id_length = "Student ID length must be between 4 and 12";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, steps.length));
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all steps before submission
    if (!validateStep(1) || !validateStep(2)) {
      toast.error("Please complete all required fields");
      return;
    }

    setLoading(true);

    if (!user) {
      toast.error("You must be logged in to create an exam");
      setLoading(false);
      return;
    }

    try {
      // Prepare data for the service
      const examData = {
        name: formData.title,
        totalQuestions: formData.num_items,
        date: formData.date,
        folder: formData.subject,
        choicesPerItem: formData.choices_per_item,
        classId: formData.classId,
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
      console.error("Error creating exam:", error);
      toast.error("Failed to create exam");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container max-w-xl pb-4">
      {/* Header */}
      <div className="mb-4">
        <BackButton variant="outline" onClick={() => router.push('/exams')} className="mb-4 -ml-2">
          ← Back to Exams
        </BackButton>
        <h1 className="text-2xl font-bold text-foreground">Create New Exam</h1>
        <div className="mt-2 space-y-1">
          <p className="text-muted-foreground">
            Step {currentStep} of {steps.length}: {steps[currentStep - 1].title}
          </p>
          <div className="text-sm text-blue-600 font-medium">
            {currentStep === 1 && "📝 Let's start with the basic exam information"}
            {currentStep === 2 && "⚙️ Configure your exam format and settings"}
            {currentStep === 3 && "🔍 Review your exam details before creating"}
          </div>
        </div>
      </div>

      {/* Progress Indicator */}
      <Card className="mb-4 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardContent className="pt-4">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="font-medium text-blue-900">Progress</span>
            <span className="text-blue-700">{Math.round((currentStep / steps.length) * 100)}% Complete</span>
          </div>
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.number} className="flex items-center">
                <div className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs transition-all ${
                      currentStep > step.number
                        ? "bg-green-500 text-white shadow-lg"
                        : currentStep === step.number
                        ? "bg-blue-500 text-white shadow-lg ring-2 ring-blue-200"
                        : "bg-gray-200 text-gray-500"
                    }`}
                  >
                    {currentStep > step.number ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      step.number
                    )}
                  </div>
                  <div className="ml-2 hidden sm:block">
                    <p className={`text-xs font-medium ${
                      currentStep >= step.number ? "text-blue-900" : "text-gray-500"
                    }`}>
                      {step.title}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Step Content */}
      <Card className="card-elevated animate-slide-up">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-accent" />
            </div>
            <div>
              <CardTitle>{steps[currentStep - 1].title}</CardTitle>
              <CardDescription>{steps[currentStep - 1].description}</CardDescription>
            </div>
          </div>
          
          {/* Step Validation Feedback */}
          {Object.keys(errors).length > 0 && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 text-red-800">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">Please fix the following issues to continue:</span>
              </div>
              <ul className="mt-2 text-sm text-red-700 list-disc list-inside space-y-1">
                {Object.entries(errors).map(([field, message]) => (
                  <li key={field}>{message}</li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Step Completion Feedback */}
          {Object.keys(errors).length === 0 && currentStep < steps.length && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-800">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">✅ Step {currentStep} looks good! Ready to continue.</span>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Step 1: Basic Information */}
            {currentStep === 1 && (
              <div className="space-y-3">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-2">
                  <h3 className="font-medium text-blue-900 mb-2">📝 Step 1: Exam Name</h3>
                  <p className="text-sm text-blue-700 mb-1">
                    Give your exam a clear, descriptive name that helps you identify it later.
                  </p>
                  <p className="text-sm text-blue-600">
                    Fill in the essential details about your exam. Make sure to choose the correct class and subject.
                  </p>
                </div>

                {/* Title */}
                <div className="space-y-1">
                  <Label htmlFor="title" className="flex items-center gap-2">
                    Exam Title *
                    <span className="text-xs text-muted-foreground">(5-200 characters)</span>
                  </Label>
                  <Input
                    id="title"
                    placeholder="Enter exam title (e.g., Midterm Exam, Quiz 1, Final Exam)"
                    value={formData.title}
                    onChange={(e) => handleChange("title", e.target.value)}
                    className={`transition-all ${
                      errors.title ? "border-red-500 focus:border-red-500 focus:ring-red-200" : 
                      formData.title.trim().length >= 5 ? "border-green-500 focus:border-green-500 focus:ring-green-200" : ""
                    }`}
                  />
                  {formData.title.trim() && formData.title.length < 5 && (
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                      ⚠️ Need {5 - formData.title.length} more characters
                    </p>
                  )}
                  {formData.title.trim().length >= 5 && !errors.title && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      ✅ Good title length
                    </p>
                  )}
                  {errors.title && (
                    <p className="text-sm text-red-600">{errors.title}</p>
                  )}
                </div>

                {/* Class Selection */}
                <div className="space-y-1">
                  <Label htmlFor="class" className="flex items-center gap-2">
                    Class *
                    <span className="text-xs text-muted-foreground">(Select your target class)</span>
                  </Label>
                  <Select
                    value={formData.classId}
                    onValueChange={handleClassChange}
                    disabled={loadingClasses}
                  >
                    <SelectTrigger
                      className={`transition-all ${
                        errors.classId ? "border-red-500 focus:border-red-500 focus:ring-red-200" :
                        formData.classId ? "border-green-500 focus:border-green-500 focus:ring-green-200" : ""
                      }`}
                    >
                      <SelectValue
                        placeholder={
                          loadingClasses ? "Loading classes..." : "Select a class for this exam"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.class_name} ({cls.course_subject}) - {cls.students.length} students
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formData.classId && !errors.classId && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      ✅ Class selected
                    </p>
                  )}
                  {errors.classId && (
                    <p className="text-sm text-red-600">{errors.classId}</p>
                  )}
                </div>

                {/* Subject */}
                <div className="space-y-1">
                  <Label htmlFor="subject" className="flex items-center gap-2">
                    Subject *
                    <span className="text-xs text-muted-foreground">(Auto-filled from class or enter custom)</span>
                  </Label>
                  <Input
                    id="subject"
                    placeholder="Enter subject name (e.g., Mathematics, Science, English)"
                    value={formData.subject}
                    onChange={(e) => handleChange("subject", e.target.value)}
                    className={`transition-all ${
                      errors.subject ? "border-red-500 focus:border-red-500 focus:ring-red-200" :
                      formData.subject.trim().length >= 5 ? "border-green-500 focus:border-green-500 focus:ring-green-200" : ""
                    }`}
                  />
                  {formData.subject.trim() && formData.subject.length < 5 && (
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                      ⚠️ Need {5 - formData.subject.length} more characters
                    </p>
                  )}
                  {formData.subject.trim().length >= 5 && !errors.subject && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      ✅ Subject name looks good
                    </p>
                  )}
                  {errors.subject && (
                    <p className="text-sm text-red-600">{errors.subject}</p>
                  )}
                </div>

                {/* Date */}
                <div className="space-y-1">
                  <Label htmlFor="date" className="flex items-center gap-2">
                    Exam Date *
                    <span className="text-xs text-muted-foreground">(Cannot be in the past)</span>
                  </Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => handleChange("date", e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className={`transition-all ${
                      errors.date ? "border-red-500 focus:border-red-500 focus:ring-red-200" :
                      formData.date ? "border-green-500 focus:border-green-500 focus:ring-green-200" : ""
                    }`}
                  />
                  {formData.date && !errors.date && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      ✅ Exam scheduled for {new Date(formData.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  )}
                  {errors.date && (
                    <p className="text-sm text-red-600">{errors.date}</p>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Exam Configuration */}
            {currentStep === 2 && (
              <div className="space-y-2">
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-2">
                  <h3 className="font-medium text-orange-900 mb-2">⚙️ Step 2: Exam Configuration</h3>
                  <p className="text-sm text-orange-700">
                    Configure the format and structure of your exam. These settings affect how answer sheets are generated.
                  </p>
                </div>

                {/* Number of Items */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    Number of Questions *
                    <span className="text-xs text-muted-foreground">(1-200 questions)</span>
                  </Label>
                  <p className="text-sm text-muted-foreground mb-3">
                    📝 Choose a preset or enter a custom number of questions for your exam.
                  </p>
                  <div className="flex flex-col gap-2">
                    {[20, 50, 100].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handleChange("num_items", num)}
                        className={`py-2 px-3 rounded-lg font-semibold text-sm transition-all border-2 flex items-center justify-between ${
                          formData.num_items === num
                            ? "bg-blue-500 text-white border-blue-500 shadow-md"
                            : "border-gray-300 hover:border-blue-400 hover:bg-blue-50"
                        }`}
                      >
                        <span>{num} Questions</span>
                        <span className="text-xs opacity-75">
                          {num <= 20 ? 'Quick' : num <= 50 ? 'Standard' : 'Major'}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="custom-items" className="text-sm text-muted-foreground">
                      Or enter custom number:
                    </Label>
                    <Input
                      id="custom-items"
                      type="number"
                      placeholder="Enter number of questions (1-200)"
                      min={1}
                      max={200}
                      value={formData.num_items}
                      onChange={(e) => handleChange("num_items", parseInt(e.target.value) || 50)}
                      className={`max-w-xs ${
                        errors.num_items ? "border-red-500 focus:border-red-500 focus:ring-red-200" :
                        formData.num_items >= 1 && formData.num_items <= 200 ? "border-green-500 focus:border-green-500 focus:ring-green-200" : ""
                      }`}
                    />
                  </div>
                  {formData.num_items >= 1 && formData.num_items <= 200 && !errors.num_items && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      ✅ {formData.num_items} questions selected
                    </p>
                  )}
                  {errors.num_items && (
                    <p className="text-sm text-red-600">{errors.num_items}</p>
                  )}
                </div>

                {/* Choices per Item */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    Answer Choices per Question
                    <span className="text-xs text-muted-foreground">(A, B, C, D format)</span>
                  </Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    🔤 Select how many answer choices each question will have. Most common is 4 choices (A, B, C, D).
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[2, 3, 4, 5].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handleChange("choices_per_item", num)}
                        className={`py-2 px-3 rounded-lg font-semibold text-sm transition-all border-2 ${
                          formData.choices_per_item === num
                            ? "bg-blue-500 text-white border-blue-500 shadow-md"
                            : "border-gray-300 hover:border-blue-400 hover:bg-blue-50"
                        }`}
                      >
                        <div className="font-bold text-lg mb-1">
                          {Array.from({ length: num }, (_, i) => String.fromCharCode(65 + i)).join(", ")}
                        </div>
                        <div className="text-xs opacity-75">
                          {num} choices
                        </div>
                      </button>
                    ))}
                  </div>
                  {formData.choices_per_item >= 2 && formData.choices_per_item <= 6 && !errors.choices_per_item && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      ✅ {formData.choices_per_item} answer choices per question
                    </p>
                  )}
                  {errors.choices_per_item && (
                    <p className="text-sm text-red-600">
                      {errors.choices_per_item}
                    </p>
                  )}
                </div>

                {/* Student ID Length */}
                <div className="space-y-2">
                  <Label htmlFor="student_id_length" className="flex items-center gap-2">
                    Student ID Length
                    <span className="text-xs text-muted-foreground">(4-12 digits)</span>
                  </Label>
                  <p className="text-sm text-muted-foreground mb-3">
                    🎦 How many digits should student IDs have on the answer sheet? Default is 9 digits.
                  </p>
                  <div className="flex items-center gap-4">
                    <Input
                      id="student_id_length"
                      type="number"
                      min={4}
                      max={12}
                      value={formData.student_id_length}
                      onChange={(e) =>
                        handleChange("student_id_length", parseInt(e.target.value) || 9)
                      }
                      className={`w-32 ${
                        errors.student_id_length ? "border-red-500 focus:border-red-500 focus:ring-red-200" :
                        formData.student_id_length >= 4 && formData.student_id_length <= 12 ? "border-green-500 focus:border-green-500 focus:ring-green-200" : ""
                      }`}
                    />
                    <div className="text-sm text-gray-600">
                      digits (e.g., {"0".repeat(formData.student_id_length).replace(/0/g, "#")})
                    </div>
                  </div>
                  {formData.student_id_length >= 4 && formData.student_id_length <= 12 && !errors.student_id_length && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      ✅ {formData.student_id_length}-digit student IDs
                    </p>
                  )}
                  {errors.student_id_length && (
                    <p className="text-sm text-red-600">
                      {errors.student_id_length}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Review & Create */}
            {currentStep === 3 && (
              <div className="space-y-2">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                  <h3 className="font-medium text-green-900 mb-2">🔍 Step 3: Review & Create</h3>
                  <p className="text-sm text-green-700">
                    Review all your exam settings below. You can add an optional description and then create your exam.
                  </p>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description" className="flex items-center gap-2">
                    Description 
                    <span className="text-xs text-muted-foreground">(Optional - up to 500 characters)</span>
                  </Label>
                  <Textarea
                    id="description"
                    placeholder="Add any additional notes or instructions for this exam...

Examples:
- Special instructions for students
- Exam topics or chapters covered
- Duration or time limits
- Materials allowed/not allowed"
                    value={formData.description}
                    onChange={(e) => handleChange("description", e.target.value)}
                    rows={6}
                    className={`resize-none ${
                      errors.description ? "border-red-500 focus:border-red-500 focus:ring-red-200" :
                      formData.description.trim() ? "border-blue-500 focus:border-blue-500 focus:ring-blue-200" : ""
                    }`}
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {formData.description.trim() ? `${formData.description.length}/500 characters` : 'Optional field'}
                    </span>
                    {formData.description.length > 450 && (
                      <span className="text-amber-600">
                        {500 - formData.description.length} characters remaining
                      </span>
                    )}
                  </div>
                  {errors.description && (
                    <p className="text-sm text-red-600">{errors.description}</p>
                  )}
                </div>

                {/* Review Summary */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <h3 className="font-semibold text-blue-900">Exam Summary</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Title:</span>
                        <span className="font-medium text-gray-900">{formData.title || 'Not set'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Class:</span>
                        <span className="font-medium text-gray-900">{formData.className || 'Not selected'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Subject:</span>
                        <span className="font-medium text-gray-900">{formData.subject || 'Not set'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Date:</span>
                        <span className="font-medium text-gray-900">
                          {formData.date ? new Date(formData.date).toLocaleDateString('en-US', { 
                            weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' 
                          }) : 'Not set'}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Questions:</span>
                        <span className="font-medium text-gray-900">{formData.num_items}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Choices per Question:</span>
                        <span className="font-medium text-gray-900">{formData.choices_per_item} ({Array.from({ length: formData.choices_per_item }, (_, i) => String.fromCharCode(65 + i)).join(", ")})</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Student ID Length:</span>
                        <span className="font-medium text-gray-900">{formData.student_id_length} digits</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Description:</span>
                        <span className="font-medium text-gray-900">{formData.description.trim() ? 'Added' : 'None'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-blue-200">
                    <div className="text-center text-sm text-blue-700">
                      🚀 <strong>Ready to create your exam!</strong> Once created, you can add answer keys and start scanning papers.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex gap-3 pt-2 border-t">
              {currentStep > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={prevStep}
                  className="flex-1 border-gray-300 hover:border-gray-400"
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Back to {steps[currentStep - 2]?.title}
                </Button>
              )}

              {currentStep < steps.length ? (
                <Button
                  type="button"
                  onClick={() => {
                    if (validateStep(currentStep)) {
                      nextStep();
                    } else {
                      toast.error(`Please complete all required fields in ${steps[currentStep - 1].title}`);
                    }
                  }}
                  className="flex-1 gradient-primary"
                  disabled={Object.keys(errors).length > 0}
                >
                  Continue to {steps[currentStep]?.title}
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  className="flex-1 gradient-primary"
                  disabled={loading || Object.keys(errors).length > 0}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Exam...
                    </>
                  ) : (
                    <>
                      🚀 Create Exam
                    </>
                  )}
                </Button>
              )}

              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push("/exams")}
                className="text-gray-600 hover:text-gray-800"
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
