"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import {
  ArrowLeft,
  Edit2,
  Smartphone,
  FileText,
  BarChart3,
  Tag,
  FilePlus,
  CheckCircle,
  Loader2,
  Pencil,
} from "lucide-react";
import { getExamById, updateExam, Exam } from "@/services/examService";
import { AnswerKeyService } from "@/services/answerKeyService";
import { ScanningService } from "@/services/scanningService";
import { useAuth } from "@/contexts/AuthContext";
import { db, auth } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query, where, getDocs, deleteDoc } from "firebase/firestore";
import { toast } from "sonner";
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
          <Link
            href="/exams"
            className="p-2 hover:bg-muted rounded-md transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
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
          <Link
            href="/exams"
            className="p-2 hover:bg-muted rounded-md transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
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
        <Link
          href="/exams"
          className="p-2 hover:bg-muted rounded-md transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-3xl font-bold text-foreground truncate">
            {exam.title}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground truncate">
            ID: {exam.id}
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

      {/* Exam Information */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-3 sm:p-4 border">
          <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase mb-1">
            Total Questions
          </p>
          <p className="text-xl sm:text-2xl font-bold text-primary">
            {exam.num_items}
          </p>
        </Card>
        <Card className="p-3 sm:p-4 border">
          <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase mb-1">
            Exam Date
          </p>
          <p className="text-xl sm:text-2xl font-bold text-foreground">
            {new Date(exam.created_at).toLocaleDateString()}
          </p>
        </Card>
        <Card className="p-3 sm:p-4 border">
          <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase mb-1">
            Status
          </p>
          <p className="text-xl sm:text-2xl font-bold text-primary">
            {answerKeyStatus.hasAnswerKey
              ? answerKeyStatus.completed === answerKeyStatus.total
                ? "Complete"
                : "In Progress"
              : "Not started"}
          </p>
        </Card>
        <Card className="p-3 sm:p-4 border">
          <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase mb-1">
            Folder
          </p>
          <p className="text-xl sm:text-2xl font-bold text-foreground">
            {exam.subject}
          </p>
        </Card>
        {exam.examCode && (
          <Card className="p-3 sm:p-4 border bg-amber-50">
            <p className="text-[10px] sm:text-xs font-semibold text-amber-700 uppercase mb-1">
              Exam Code
            </p>
            <p className="text-lg sm:text-xl font-mono font-bold text-amber-900">
              {exam.examCode}
            </p>
            <p className="text-[10px] text-amber-600 mt-1">
              Printed on answer sheets
            </p>
          </Card>
        )}
      </div>

      {/* Details Card */}
      <Card className="p-6 border">
        <h2 className="text-lg font-bold text-foreground mb-4">Exam Details</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground font-semibold mb-1">
              Created Date
            </p>
            <p className="text-foreground">
              {new Date(exam.created_at).toLocaleDateString()}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground font-semibold mb-1">
              Answer Key Status
            </p>
            {answerKeyStatus.hasAnswerKey ? (
              <p
                className={`font-semibold ${
                  answerKeyStatus.completed === answerKeyStatus.total
                    ? "text-success"
                    : "text-warning"
                }`}
              >
                {answerKeyStatus.completed}/{answerKeyStatus.total} answers
              </p>
            ) : (
              <p className="font-semibold text-muted-foreground">Not started</p>
            )}
          </div>
          <div>
            <p className="text-muted-foreground font-semibold mb-1">
              Papers Scanned
            </p>
            <p className="text-foreground">
              {scannedPaperCount} papers
            </p>
          </div>
        </div>
      </Card>

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

      {/* Edit Exam Dialog */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg border-2 border-primary w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold text-foreground">Edit Exam</h2>
              <button
                onClick={() => setIsEditing(false)}
                className="p-1 hover:bg-muted rounded-md"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-foreground">
                  Exam Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full px-4 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Exam name"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-foreground">
                  Subject / Folder <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={editForm.subject}
                  onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
                  className="w-full px-4 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Subject"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-foreground">
                  Number of Items <span className="text-destructive">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[20, 50, 100].map((num) => (
                    <button
                      key={num}
                      onClick={() => setEditForm({ ...editForm, num_items: num })}
                      className={`py-2 rounded-md font-semibold text-sm border-2 transition-all ${
                        editForm.num_items === num
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-muted hover:border-primary"
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Current: {exam.num_items} items
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-foreground">Choices per Question</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "4 Choices (A–D)", value: 4 },
                    { label: "5 Choices (A–E)", value: 5 },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setEditForm({ ...editForm, choices_per_item: opt.value })}
                      className={`py-2 rounded-md font-semibold text-sm border-2 transition-all ${
                        editForm.choices_per_item === opt.value
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-muted hover:border-primary"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-foreground">Exam Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Board Exam", value: "board" },
                    { label: "Diagnostic Test", value: "diagnostic" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() =>
                        setEditForm({ ...editForm, examType: opt.value as "board" | "diagnostic" })
                      }
                      className={`py-2 rounded-md font-semibold text-sm border-2 transition-all ${
                        editForm.examType === opt.value
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-muted hover:border-primary"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-2">
                ⚠️ Editing this exam will delete any existing answer sheet template so you can generate a new one.
              </p>
            </div>
            <div className="flex gap-3 p-6 border-t">
              <button
                onClick={() => setIsEditing(false)}
                className="flex-1 px-4 py-2 border rounded-md font-semibold hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingEdit ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
