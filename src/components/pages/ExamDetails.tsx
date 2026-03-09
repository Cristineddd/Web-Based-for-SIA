"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import {
  Edit2,
  Smartphone,
  FileText,
  BarChart3,
  Tag,
  FilePlus,
  CheckCircle,
  Loader2,
  Pencil,
  BookOpen,
  Calendar,
} from "lucide-react";
import { getExamById, updateExam, Exam } from "@/services/examService";
import { AnswerKeyService } from "@/services/answerKeyService";
import { ScanningService } from "@/services/scanningService";
import { useAuth } from "@/contexts/AuthContext";
import { db, auth } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query, where, getDocs, deleteDoc } from "firebase/firestore";
import { toast } from "sonner";
import { BackButton } from '@/components/ui/BackButton';
import { generateTemplatePDF } from "@/lib/templatePdfGenerator";

interface ExamDetailsProps {
  params: { id: string };
}

interface AnswerKeyStatus {
  total: number;
  completed: number;
  hasAnswerKey: boolean;
}

export default function ExamDetails({ params }: ExamDetailsProps) {
  const { user } = useAuth();
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scannedPaperCount, setScannedPaperCount] = useState(0);
  const [answerKeyStatus, setAnswerKeyStatus] = useState<AnswerKeyStatus>({
    total: 0,
    completed: 0,
    hasAnswerKey: false,
  });
  const [hasTemplate, setHasTemplate] = useState(false);
  const [creatingTemplate, setCreatingTemplate] = useState(false);

  // Edit exam state
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "",
    subject: "",
    num_items: 0,
    choices_per_item: 4,
    examType: "board" as "board" | "diagnostic",
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  useEffect(() => {
    async function fetchExam() {
      try {
        setLoading(true);
        setError(null);
        const examData = await getExamById(params.id);
        setExam(examData);

        if (examData) {
          // Pre-populate edit form with current exam data
          setEditForm({
            title: examData.title,
            subject: examData.subject,
            num_items: examData.num_items,
            choices_per_item: examData.choices_per_item,
            examType: examData.examType || "board",
          });

          try {
            const result = await AnswerKeyService.getAnswerKeyByExamId(
              params.id,
            );
            if (result.success && result.data) {
              const answersCount = result.data.answers.length;
              setAnswerKeyStatus({
                total: examData.num_items,
                completed: answersCount,
                hasAnswerKey: true,
              });
            } else {
              setAnswerKeyStatus({
                total: examData.num_items,
                completed: 0,
                hasAnswerKey: false,
              });
            }
          } catch (error) {
            console.error("Error fetching answer key:", error);
          }

          // Fetch scanned results count
          try {
            const scannedResult = await ScanningService.getScannedResultsByExamId(params.id);
            if (scannedResult.success && scannedResult.data) {
              setScannedPaperCount(scannedResult.data.filter(r => !r.isNullId).length);
            }
          } catch (error) {
            console.error("Error fetching scanned results:", error);
          }

          // Check if a template already exists for this exam
          try {
            const templateQuery = query(
              collection(db, 'templates'),
              where('examId', '==', params.id)
            );
            const templateSnap = await getDocs(templateQuery);
            setHasTemplate(!templateSnap.empty);
          } catch (error) {
            console.error("Error checking template:", error);
          }
        }
      } catch (error) {
        console.error("Error fetching exam:", error);
        const msg = error instanceof Error ? error.message : "Failed to load exam";
        setError(msg);
      } finally {
        setLoading(false);
      }
    }

    if (params.id) {
      fetchExam();
    }
  }, [params.id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <BackButton href="/exams" asLink />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Loading...</h1>
          </div>
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <BackButton href="/exams" asLink />
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {error ? "Error loading exam" : "Exam not found"}
            </h1>
            {error && (
              <p className="text-sm text-destructive mt-1">{error}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const handleSaveEdit = async () => {
    if (!editForm.title.trim()) { toast.error("Exam name is required"); return; }
    if (!editForm.subject.trim()) { toast.error("Subject is required"); return; }
    if (!editForm.num_items || editForm.num_items < 1) { toast.error("Number of items must be at least 1"); return; }

    try {
      setIsSavingEdit(true);

      await updateExam(params.id, {
        title: editForm.title.trim(),
        subject: editForm.subject.trim(),
        num_items: editForm.num_items,
        choices_per_item: editForm.choices_per_item,
        examType: editForm.examType,
      });

      // Delete any existing template linked to this exam so a new one can be generated
      const templateQuery = query(
        collection(db, "templates"),
        where("examId", "==", params.id)
      );
      const templateSnap = await getDocs(templateQuery);
      if (!templateSnap.empty) {
        await Promise.all(templateSnap.docs.map((d) => deleteDoc(d.ref)));
        setHasTemplate(false);
        toast.info("Existing template deleted — please generate a new one.");
      }

      // Update local exam state
      setExam((prev) =>
        prev
          ? {
              ...prev,
              title: editForm.title.trim(),
              subject: editForm.subject.trim(),
              num_items: editForm.num_items,
              choices_per_item: editForm.choices_per_item,
              examType: editForm.examType,
            }
          : prev
      );

      // Update answer key status total to match new num_items
      setAnswerKeyStatus((prev) => ({ ...prev, total: editForm.num_items }));

      toast.success("Exam updated successfully");
      setIsEditing(false);
    } catch (err) {
      console.error("Error updating exam:", err);
      toast.error("Failed to update exam");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleCreateTemplate = async () => {
    if (!user?.instructorId) {
      toast.error('⚠️ Instructor ID not found. Please log out and log back in.');
      return;
    }

    if (!exam) {
      toast.error('Exam information not found');
      return;
    }

    if (hasTemplate) {
      toast.error('A template has already been generated for this exam.');
      return;
    }

    setCreatingTemplate(true);

    try {
      const currentUser = auth.currentUser;
      console.log('🔍 Firebase Auth State:', {
        isAuthenticated: !!currentUser,
        uid: currentUser?.uid,
      });

      const templateData = {
        name: exam.title,
        description: exam.subject || 'Answer Sheet Template',
        numQuestions: exam.num_items,
        choicesPerQuestion: exam.choices_per_item,
        layout: 'single',
        includeStudentId: true,
        studentIdLength: 10,
        createdBy: user.id,
        instructorId: user.instructorId,
        examId: params.id,
        examName: exam.title,
        examCode: exam.examCode, // Use stored exam code for template validation
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'templates'), templateData);
      
      // Use the exam's stored exam code (unique identifier for this exam)
      const examCode = exam.examCode || params.id.substring(0, 8).toUpperCase();
      
      await generateTemplatePDF({
        name: exam.title,
        description: exam.subject || 'Answer Sheet Template',
        numQuestions: exam.num_items,
        choicesPerQuestion: exam.choices_per_item,
        examName: exam.title,
        examCode: examCode,
      });
      
      setHasTemplate(true);
      toast.success('✅ Template created and downloaded!');
    } catch (error: any) {
      console.error('❌ Error creating template:', error);
      
      if (error?.code === 'permission-denied') {
        toast.error('Permission denied. Please check if you are logged in and try again.');
      } else {
        toast.error(`Failed to create template: ${error?.message || 'Unknown error'}`);
      }
    } finally {
      setCreatingTemplate(false);
    }
  };

  const actionButtons = [
    {
      icon: Edit2,
      label: "Edit Answer Key",
      description: "Set correct answers for each question",
      href: `/exams/${params.id}/edit-key`,
      color: "bg-blue-50 text-primary",
    },
    {
      icon: hasTemplate ? CheckCircle : creatingTemplate ? Loader2 : FilePlus,
      label: hasTemplate ? "Template Created" : creatingTemplate ? "Generating..." : "Create Template",
      description: hasTemplate
        ? "Answer sheet template already generated"
        : "Auto-generate and download answer sheet PDF",
      color: hasTemplate ? "bg-green-100 text-green-600" : "bg-green-50 text-green-600",
      onClick: hasTemplate || creatingTemplate ? undefined : () => handleCreateTemplate(),
      disabled: hasTemplate || creatingTemplate,
    },
    {
      icon: Smartphone,
      label: "Scan Papers",
      description: "Scan and capture answer sheets",
      href: `/exams/${params.id}/scan-papers`,
      color: "bg-blue-50 text-primary",
    },
    {
      icon: FileText,
      label: "Review Papers",
      description: "Review scanned documents",
      href: `/exams/${params.id}/review-papers`,
      color: "bg-blue-50 text-primary",
    },
    {
      icon: BarChart3,
      label: "Item Analysis",
      description: "Analyze question performance",
      href: `/exams/${params.id}/item-analysis`,
      color: "bg-blue-50 text-primary",
    },
    {
      icon: Tag,
      label: "Tag Reports",
      description: "Generate tagged reports",
      href: `/exams/${params.id}/tag-reports`,
      color: "bg-blue-50 text-primary",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 sm:gap-4">
        <BackButton href="/exams" asLink />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-3xl font-bold text-foreground break-words">
            {exam.title}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground break-words">
            {exam.examCode || "No exam code"}
          </p>
        </div>
        <button
          onClick={() => setIsEditing(true)}
          className="flex items-center gap-2 px-3 py-2 border-2 border-primary text-primary rounded-md font-semibold text-sm hover:bg-primary hover:text-primary-foreground transition-colors flex-shrink-0"
          title="Edit exam details"
        >
          <Pencil className="w-4 h-4" />
          <span className="hidden sm:inline">Edit Exam</span>
        </button>
      </div>

      {/* Action Buttons */}
      <div>
        <h2 className="text-lg font-bold text-foreground mb-4">Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {actionButtons.map((btn) => {
            const IconComponent = btn.icon;
            const content = (
              <Card className="p-4 border hover:border-primary hover:shadow-md transition-all h-full">
                <div className="flex gap-4">
                  <div
                    className={`w-12 h-12 rounded-lg ${btn.color} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}
                  >
                    <IconComponent className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                      {btn.label}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {btn.description}
                    </p>
                  </div>
                </div>
              </Card>
            );

            if (btn.onClick) {
              return (
                <button key={btn.label} onClick={btn.onClick} className="group text-left">
                  {content}
                </button>
              );
            }

            if (btn.disabled) {
              return (
                <div key={btn.label} className="opacity-70 cursor-not-allowed">
                  {content}
                </div>
              );
            }

            return (
              <Link key={btn.label} href={btn.href || '#'} className="group">
                {content}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Exam Details */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Exam Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Program</label>
                <p className="text-base text-foreground mt-1">{exam.title}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Course</label>
                <p className="text-base text-foreground mt-1">{exam.subject}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Created</label>
                <p className="text-base text-foreground mt-1">
                  {new Date(exam.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Number of Items</label>
                <p className="text-base text-foreground mt-1">{exam.num_items}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Choices per Item</label>
                <p className="text-base text-foreground mt-1">{exam.choices_per_item}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Exam Dialog */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-background rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h2 className="text-xl font-bold text-primary">Edit Exam</h2>
                <p className="text-sm text-muted-foreground">Update exam information and settings</p>
              </div>
              <button
                onClick={() => setIsEditing(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-muted rounded-lg transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
              {/* Two Column Layout */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Exam Name */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-foreground">
                    Exam Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-muted rounded-lg bg-white dark:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    placeholder="Enter exam name"
                  />
                </div>

                {/* Subject / Folder */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-foreground">
                    Subject / Folder <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editForm.subject}
                    onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-muted rounded-lg bg-white dark:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    placeholder="Enter subject or folder name"
                  />
                </div>
              </div>

              {/* Number of Items */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700 dark:text-foreground">
                  Number of Items <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[20, 50, 100].map((num) => (
                    <button
                      key={num}
                      onClick={() => setEditForm({ ...editForm, num_items: num })}
                      className={`py-3 rounded-lg font-medium text-sm border transition-all duration-200 ${
                        editForm.num_items === num
                          ? "bg-primary text-white border-primary"
                          : "bg-white dark:bg-background border-gray-200 dark:border-muted text-gray-700 dark:text-foreground hover:border-primary hover:bg-primary/5"
                      }`}
                    >
                      {num} Items
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Current: {exam.num_items} items
                </p>
              </div>

              {/* Two Column for Choices and Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Choices per Question */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-700 dark:text-foreground">Choices per Question</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "4 (A–D)", value: 4 },
                      { label: "5 (A–E)", value: 5 },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setEditForm({ ...editForm, choices_per_item: opt.value })}
                        className={`py-2.5 px-3 rounded-lg font-medium text-sm border transition-all duration-200 ${
                          editForm.choices_per_item === opt.value
                            ? "bg-primary text-white border-primary"
                            : "bg-white dark:bg-background border-gray-200 dark:border-muted text-gray-700 dark:text-foreground hover:border-primary hover:bg-primary/5"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Exam Type */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-700 dark:text-foreground">Exam Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Board", value: "board" },
                      { label: "Diagnostic", value: "diagnostic" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() =>
                          setEditForm({ ...editForm, examType: opt.value as "board" | "diagnostic" })
                        }
                        className={`py-2.5 px-3 rounded-lg font-medium text-sm border transition-all duration-200 ${
                          editForm.examType === opt.value
                            ? "bg-primary text-white border-primary"
                            : "bg-white dark:bg-background border-gray-200 dark:border-muted text-gray-700 dark:text-foreground hover:border-primary hover:bg-primary/5"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Warning Message */}
              <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                <span className="text-amber-500 text-lg flex-shrink-0">⚠️</span>
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Editing this exam will delete any existing answer sheet template so you can generate a new one.
                </p>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 dark:bg-muted/30">
              <button
                onClick={() => setIsEditing(false)}
                className="px-6 py-2.5 border border-gray-200 dark:border-muted rounded-lg font-medium text-gray-700 dark:text-foreground hover:bg-gray-100 dark:hover:bg-muted transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="px-6 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSavingEdit ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Changes</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
