"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Search,
  FileText,
  Archive,
  Pencil,
  RefreshCw,
  Tag,
  Calendar,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CreateExamModal } from "@/components/modals/CreateExamModal";
import { useAuth } from "@/contexts/AuthContext";
import {
  createExam,
  getExams,
  archiveExam,
  updateExam,
  type Exam,
  type ExamFormData,
} from "@/services/examService";
import { getClasses, type Class } from "@/services/classService";
import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AuditLogger } from "@/services/auditLogger";

function usePageVisibilityRefresh(onVisible: () => void) {
  useEffect(() => {
    const handler = () => {
      if (!document.hidden) onVisible();
    };
    document.addEventListener("visibilitychange", handler);
    window.addEventListener("focus", handler);
    return () => {
      document.removeEventListener("visibilitychange", handler);
      window.removeEventListener("focus", handler);
    };
  }, [onVisible]);
}

interface ExamWithStatus extends Exam {
  answerKeyStatus?: {
    total: number;
    completed: number;
    hasAnswerKey: boolean;
  };
  hasTemplate?: boolean;
}

export default function Exams() {
  const { user } = useAuth();
  const displayName = user?.displayName || user?.email?.split("@")[0] || "User";
  const router = useRouter();
  const searchParams = useSearchParams();
  const [exams, setExams] = useState<ExamWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [classById, setClassById] = useState<Record<string, Class>>({});
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [templateData, setTemplateData] = useState<any>(null);
  const [duplicateExamData, setDuplicateExamData] =
    useState<ExamFormData | null>(null);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    subject: "",
    num_items: 0,
    choices_per_item: 4,
    examType: "board" as "board" | "diagnostic",
    examCode: "",
    courseCode: "",
    institutionName: "",
    logoUrl: "",
    classId: "",
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const getCourseForExam = (exam: Exam): string => {
    const classId = exam.classId;
    if (classId && classById[classId]?.course_subject)
      return classById[classId].course_subject;
    // Legacy fallback
    return exam.subject || "—";
  };

  const getClassNameForExam = (exam: Exam): string => {
    const classId = exam.classId;
    if (classId && classById[classId]?.class_name)
      return classById[classId].class_name;
    return exam.className || "—";
  };

  useEffect(() => {
    const title = searchParams.get("title");
    const subject = searchParams.get("subject");
    const items = searchParams.get("items");
    const date = searchParams.get("date");
    const choices = searchParams.get("choices");

    if (title && subject && items && date) {
      // Check for EXACT match (same title, subject, items)
      const examExists = exams.some(
        (exam) =>
          exam.title === title &&
          exam.subject === subject &&
          exam.num_items === parseInt(items),
      );

      // Also check for duplicate title only (case-insensitive)
      const hasDuplicateTitle = exams.some(
        (exam) =>
          exam.title.toLowerCase().trim() === title.toLowerCase().trim(),
      );

      if (!examExists) {
        if (hasDuplicateTitle) {
          // Show warning but still allow creation from URL params
          toast.warning(
            `⚠️ An exam with title "${title}" already exists. Creating a new one...`,
            {
              duration: 5000,
            },
          );
        }

        const newExam: Exam = {
          id: `exam_${Date.now()}`,
          title: title,
          subject: subject,
          num_items: parseInt(items),
          choices_per_item: choices ? parseInt(choices) : 4,
          created_at: new Date(date).toISOString(),
          answer_keys: [],
          generated_sheets: [],
        };

        setExams((prev) => [newExam, ...prev]);
        toast.success(`Exam "${title}" added successfully`);

        window.history.replaceState(null, "", "/exams");
      }
    }
  }, [searchParams, exams]);

  const fetchExams = async () => {
    try {
      if (!user?.id) {
        setExams([]);
        setLoading(false);
        return;
      }

      const fetchedExams = await getExams(user.id);
      // Filter out archived exams
      const activeExams = fetchedExams.filter((exam) => !exam.isArchived);

      setExams(activeExams);
    } catch (error) {
      console.error("Error fetching exams:", error);
      toast.error("Failed to load exams");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, [user]);

  const refreshClassesForCourseLookup = useCallback(async () => {
    try {
      if (!user?.id) {
        setClassById({});
        return;
      }
      const classes = await getClasses(user.id);
      const map: Record<string, Class> = {};
      for (const c of classes) map[c.id] = c;
      setClassById(map);
    } catch (error) {
      console.error("Error fetching classes for exam course lookup:", error);
      // Non-blocking; table will fall back to exam.subject.
    }
  }, [user?.id]);

  useEffect(() => {
    refreshClassesForCourseLookup();
  }, [user]);

  usePageVisibilityRefresh(() => {
    refreshClassesForCourseLookup();
  });

  const handleCreateExam = async (
    formData: ExamFormData,
    forceCreate: boolean = false,
  ) => {
    // Check for duplicates first (unless forceCreate is true - user clicked "Proceed Anyway")
    const duplicateExam = exams.find(
      (e) =>
        e.title.toLowerCase().trim() === formData.name.toLowerCase().trim(),
    );

    if (duplicateExam && !forceCreate) {
      // Show duplicate warning dialog and toast notification
      setDuplicateExamData(formData);
      setShowCreateModal(false);
      toast.warning(
        `⚠️ Duplicate detected: An exam named "${formData.name}" already exists!`,
        {
          duration: 5000,
          description: "Review the warning dialog to proceed or cancel.",
        },
      );
      return;
    }

    try {
      if (!user?.id) {
        toast.error("You must be logged in to create an exam");
        return;
      }

      // Create temporary ID for optimistic update
      const tempId = `temp_${Date.now()}`;
      const tempExam: Exam = {
        id: tempId,
        title: formData.name,
        subject: formData.folder,
        num_items: formData.totalQuestions,
        choices_per_item: formData.choicesPerItem || 4,
        created_at: new Date().toISOString(),
        answer_keys: [],
        generated_sheets: [],
        createdBy: user.id,
        className: formData.className,
        examType: formData.examType || "board",
        status: "draft",
        isArchived: false,
      };

      // Add to UI immediately (optimistic)
      setExams([tempExam, ...exams]);
      toast.success(`Exam "${formData.name}" created successfully`);
      setShowCreateModal(false);

      // Save to Firebase in background (don't wait for it)
      try {
        console.log("📝 Creating exam from Exams page");
        console.log("  - User:", user);
        console.log("  - InstructorId:", user.instructorId);

        if (!user.instructorId) {
          toast.error(
            "⚠️ Instructor ID not found. Please log out and log back in.",
          );
          setExams((prevExams) => prevExams.filter((e) => e.id !== tempId));
          return;
        }

        const newExam = await createExam(formData, user.id, user.instructorId);
        console.log("✅ Exam created:", newExam);

        // Log exam creation
        if (user.email) {
          AuditLogger.logActivity(
            user.id,
            user.email,
            "exam_created",
            `Created exam: ${newExam.title}`,
            {
              entityId: newExam.id,
              entityName: newExam.title,
              entityType: "exam",
            },
          ).catch(console.error);
        }

        // Replace temp exam with real one
        setExams((prevExams) =>
          prevExams.map((e) => (e.id === tempId ? newExam : e)),
        );
      } catch (error) {
        console.error("Error saving exam to Firebase:", error);
        // Remove temp exam if save fails
        setExams((prevExams) => prevExams.filter((e) => e.id !== tempId));
        toast.error("Failed to save exam to database. Please try again.");
      }
    } catch (error) {
      console.error("Error creating exam:", error);
      toast.error("Failed to create exam");
    }
  };

  const handleEditExam = (exam: Exam) => {
    setEditingExam(exam);
    setEditForm({
      title: exam.title,
      subject: exam.subject,
      num_items: exam.num_items,
      choices_per_item: exam.choices_per_item || 4,
      examType: (exam.examType as any) || "board",
      examCode: exam.examCode || "",
      courseCode: exam.courseCode || "",
      institutionName: exam.institutionName || "",
      logoUrl: exam.logoUrl || "",
      classId: exam.classId || "",
    });
  };

  const handleSaveEdit = async () => {
    if (!editingExam) return;
    if (!editForm.title.trim()) {
      toast.error("Exam name is required");
      return;
    }
    if (!editForm.subject.trim()) {
      toast.error("Subject is required");
      return;
    }
    if (!editForm.num_items || editForm.num_items < 1) {
      toast.error("Number of items must be at least 1");
      return;
    }

    try {
      setIsSavingEdit(true);

      // Update exam fields in Firestore
      const updated: Partial<Exam> = {
        title: editForm.title.trim(),
        subject: editForm.subject.trim(),
        num_items: editForm.num_items,
        choices_per_item: editForm.choices_per_item,
        examType: editForm.examType,
        examCode: editForm.examCode.trim().toUpperCase(),
        courseCode: editForm.courseCode.trim(),
        institutionName: editForm.institutionName,
        logoUrl: editForm.logoUrl,
        classId: editForm.classId || null,
        className: editForm.classId
          ? classById[editForm.classId]?.class_name
          : null,
      };

      await updateExam(editingExam.id, updated);

      // Delete any existing template linked to this exam so a new one can be generated
      const templateQuery = query(
        collection(db, "templates"),
        where("examId", "==", editingExam.id),
      );
      const templateSnap = await getDocs(templateQuery);
      if (!templateSnap.empty) {
        await Promise.all(templateSnap.docs.map((d) => deleteDoc(d.ref)));
        toast.info("Existing template deleted — please generate a new one.");
      }

      // Update local state
      setExams((prev) =>
        prev.map((e) =>
          e.id === editingExam.id
            ? {
                ...e,
                title: editForm.title.trim(),
                subject: editForm.subject.trim(),
                num_items: editForm.num_items,
                choices_per_item: editForm.choices_per_item,
                examType: editForm.examType,
                examCode: editForm.examCode.trim().toUpperCase(),
                courseCode: editForm.courseCode.trim(),
                institutionName: editForm.institutionName,
                logoUrl: editForm.logoUrl,
                updatedAt: new Date().toISOString(),
                hasTemplate: false, // template was just deleted
              }
            : e,
        ),
      );

      toast.success("Exam updated successfully");

      // Log exam update
      if (user?.email) {
        AuditLogger.logActivity(
          user.id,
          user.email,
          "exam_updated",
          `Updated exam configuration: ${editForm.title.trim()}`,
          {
            entityId: editingExam.id,
            entityName: editForm.title.trim(),
            entityType: "exam",
          },
        ).catch(console.error);
      }

      setEditingExam(null);
    } catch (error) {
      console.error("Error updating exam:", error);
      toast.error("Failed to update exam");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleArchive = async () => {
    if (!archiveId) return;

    try {
      // Get exam details for logging before archiving
      const examToArchive = exams.find((e) => e.id === archiveId);

      await archiveExam(archiveId);

      // Log exam archival
      if (user?.email && examToArchive) {
        AuditLogger.logActivity(
          user.id,
          user.email,
          "exam_deleted",
          `Archived exam: ${examToArchive.title}`,
          {
            entityId: archiveId,
            entityName: examToArchive.title,
            entityType: "exam",
          },
        ).catch(console.error);
      }

      setExams(exams.filter((e) => e.id !== archiveId));
      toast.success("Exam archived successfully");
    } catch (error) {
      console.error("Error archiving exam:", error);
      toast.error("Failed to archive exam");
    } finally {
      setArchiveId(null);
    }
  };

  const filteredExams = exams.filter(
    (exam) =>
      exam.title.toLowerCase().includes(search.toLowerCase()) ||
      getCourseForExam(exam).toLowerCase().includes(search.toLowerCase()) ||
      getClassNameForExam(exam).toLowerCase().includes(search.toLowerCase()) ||
      (exam.examCode || "").toLowerCase().includes(search.toLowerCase()) ||
      exam.num_items.toString().includes(search),
  );

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center min-h-[55vh]">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Exams</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Create and manage your exams and answer keys
          </p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
        >
          <Plus className="w-4 h-4" />
          Create Exam
        </Button>
      </div>

      {/* Search Bar - Full Width */}
      <div className="mb-6">
        <div className="relative">
          <style>{`
            input:-webkit-autofill,
            input:-webkit-autofill:focus,
            input:-webkit-autofill:hover,
            input:-webkit-autofill:active {
              -webkit-box-shadow: 0 0 0 1000px #fff inset !important;
              box-shadow: 0 0 0 1000px #fff inset !important;
              border: 1px solid #e5e7eb !important;
              outline: none !important;
            }
            .search-override,
            .search-override:focus,
            .search-override:active {
              border-color: #e5e7eb !important;
              box-shadow: none !important;
              outline: none !important;
            }
          `}</style>
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none z-10" />
          <Input
            placeholder="Search exams by title, subject, or template ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-override pl-12 h-12 bg-white border border-gray-200 shadow-sm rounded-xl text-sm focus:outline-none focus:ring-0 focus:border-gray-300"
            autoComplete="off"
          />
        </div>
      </div>

      {/* Grid Layout */}
      {filteredExams.length === 0 && !loading ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white border border-dashed border-gray-200 rounded-2xl">
          <FileText className="w-16 h-16 text-gray-200 mb-4" />
          <p className="text-gray-500 text-lg font-medium">
            {search ? "No exams match your search" : "No exams created yet"}
          </p>
          {!search && (
            <Button
              variant="link"
              className="mt-2 text-[#22c55e] hover:text-[#16a34a] font-semibold"
              onClick={() => setShowCreateModal(true)}
            >
              Start by creating your first exam
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredExams.map((exam) => {
            const course = getCourseForExam(exam);
            return (
              <Card
                key={exam.id}
                className="group bg-white border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden flex flex-col h-full rounded-2xl border-b-4 border-b-green-500/10 hover:border-b-green-500/40 relative"
                onClick={() => {
                  router.push(`/exams/${exam.id}`);
                }}
              >
                <CardContent className="p-6 flex flex-col h-full">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-green-100 transition-colors">
                      <FileText className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="px-2.5 py-1 bg-green-50 text-green-700 rounded-full text-[10px] font-bold uppercase tracking-wider border border-green-100">
                        {exam.num_items} Items
                      </div>
                      {exam.status === "final" && (
                        <div className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[9px] font-bold uppercase tracking-tight border border-blue-100">
                          Finalized
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-gray-900 group-hover:text-green-700 transition-colors line-clamp-1 mb-1">
                      {exam.title}
                    </h3>
                    <p className="text-sm text-gray-500 font-medium line-clamp-1">
                      {course}
                    </p>

                    <div className="mt-4 flex flex-col gap-2">
                      <div className="flex items-center gap-2 text-gray-400 group-hover:text-gray-500 transition-colors">
                        <span className="text-sm font-bold opacity-30">#</span>
                        <span className="text-xs font-mono font-bold tracking-tight text-gray-600">
                          {exam.examCode || "NO-CODE-ASSIGNED"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-400">
                        <Calendar className="w-3.5 h-3.5 opacity-60" />
                        <span className="text-[11px] font-bold">
                          {new Date(exam.created_at).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            },
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-gray-50 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                        <Tag className="w-4 h-4 text-blue-600" />
                      </div>
                      <span className="text-xs font-bold text-gray-700">
                        {exam.className ? 1 : 0}{" "}
                        <span className="text-[10px] font-normal text-gray-400 uppercase tracking-tight">
                          Class Tagged
                        </span>
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleEditExam(exam);
                        }}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-600 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setArchiveId(exam.id);
                        }}
                      >
                        <Archive className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Exam Modal */}
      <CreateExamModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setTemplateData(null);
        }}
        onCreateExam={handleCreateExam}
        fromTemplate={templateData}
        existingExamTitles={exams.map((e) => e.title)}
        simpleMode={true}
      />

      {/* Edit Exam Dialog */}
      {editingExam && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[88vh]">

            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-gray-900">Edit Exam</h2>
                <p className="text-xs text-gray-400 mt-0.5">Update the details of this exam</p>
              </div>
              <button
                onClick={() => setEditingExam(null)}
                className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* Scrollable Fields */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

              {/* Exam Code */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest">
                  Exam Code <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Input
                    type="text"
                    value={editForm.examCode}
                    onChange={(e) => setEditForm({ ...editForm, examCode: e.target.value.toUpperCase() })}
                    className="w-full font-mono text-sm bg-white border-gray-200 rounded-xl h-10 pr-10 focus-visible:ring-green-500/20 focus-visible:border-green-500"
                    placeholder="e.g. EX-ABC123"
                    maxLength={12}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
                      let code = "";
                      for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
                      setEditForm({ ...editForm, examCode: `EX-${code}` });
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-green-600 transition-colors"
                    title="Regenerate random code"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-[10px] text-gray-400">Unique identifier used for answer sheet scanning and identification.</p>
              </div>

              {/* Exam Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest">
                  Exam Name <span className="text-red-400">*</span>
                </label>
                <Input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full text-sm bg-white border-gray-200 rounded-xl h-10 focus-visible:ring-green-500/20 focus-visible:border-green-500"
                  placeholder="Exam name"
                />
              </div>

              {/* Number of Items */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest">
                  Number of Items <span className="text-red-400">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[20, 50, 100, 150, 200].map((num) => (
                    <button
                      key={num}
                      onClick={() => setEditForm({ ...editForm, num_items: num })}
                      className={`py-2.5 rounded-xl font-bold text-sm border-2 transition-all ${
                        editForm.num_items === num
                          ? "bg-green-600 text-white border-green-600"
                          : "border-gray-200 text-gray-500 hover:border-green-400 hover:text-green-600 hover:bg-green-50"
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {/* Choices per Question */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest">
                  Choices per Question
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "4 Choices (A–D)", value: 4 },
                    { label: "5 Choices (A–E)", value: 5 },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setEditForm({ ...editForm, choices_per_item: opt.value })}
                      className={`py-2.5 rounded-xl font-bold text-sm border-2 transition-all ${
                        editForm.choices_per_item === opt.value
                          ? "bg-green-600 text-white border-green-600"
                          : "border-gray-200 text-gray-500 hover:border-green-400 hover:text-green-600 hover:bg-green-50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tagged Class */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest">
                  Tagged Class
                </label>
                <select
                  value={editForm.classId}
                  onChange={(e) => setEditForm({ ...editForm, classId: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 text-sm text-gray-700 transition-all"
                >
                  {Object.values(classById).map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.class_name} ({cls.course_subject})
                    </option>
                  ))}
                </select>
              </div>

            </div>

            {/* Footer */}
            <div className="flex-shrink-0 flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => setEditingExam(null)}
                className="px-5 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {isSavingEdit ? "Saving..." : "Save Changes"}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Archive Dialog */}
      <AlertDialog open={!!archiveId} onOpenChange={() => setArchiveId(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-gray-900">
              Archive Exam
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-gray-600 leading-relaxed">
              Are you sure you want to archive this exam? It will be moved to
              the Archive page and you can restore it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel className="h-11 px-6 border-gray-200 text-gray-700 font-medium hover:bg-gray-50">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              className="h-11 px-6 bg-green-600 text-white font-medium hover:bg-green-700"
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Duplicate Batch Warning Dialog */}
      <AlertDialog
        open={!!duplicateExamData}
        onOpenChange={(open) => !open && setDuplicateExamData(null)}
      >
        <AlertDialogContent className="border-2 border-warning">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-warning">
              <Archive className="w-5 h-5" />
              Duplicate Batch Detected
            </AlertDialogTitle>
            <AlertDialogDescription className="text-foreground">
              An exam with the title{" "}
              <strong className="text-primary">
                "{duplicateExamData?.name}"
              </strong>{" "}
              already exists in your records.
              <br />
              <br />
              Creating multiple exams with the same name can lead to confusion
              during grading and reporting. Are you sure you want to proceed
              with creating this duplicate batch?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDuplicateExamData(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (duplicateExamData) {
                  // Pass forceCreate=true to bypass duplicate check
                  handleCreateExam(duplicateExamData, true);
                  setDuplicateExamData(null);
                  toast.info("Creating duplicate exam as requested...");
                }
              }}
              className="bg-warning text-warning-foreground hover:bg-warning/90"
            >
              Proceed Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
