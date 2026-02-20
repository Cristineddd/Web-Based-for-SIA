"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search, FileText, Eye, Archive } from "lucide-react";
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
  type Exam,
  type ExamFormData,
} from "@/services/examService";
import { cn, isExamEditable } from "@/lib/utils";
import { getClasses, type Class } from "@/services/classService";
import { updateExam } from "@/services/examService";
import { EditExamModal } from "@/components/modals/EditExamModal";

interface ExamWithStatus extends Exam {
  uiStatus: "Completed" | "Grading";
  students_count: number;
  choicesPerItem?: number;
  examType?: string;
  choicePoints?: { [choice: string]: number };
}

export default function Exams() {
  const { user } = useAuth();
  const router = useRouter();
  const [exams, setExams] = useState<ExamWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);

  const fetchExams = async () => {
    try {
      if (!user?.id) {
        setExams([]);
        setLoading(false);
        return;
      }

      console.log(`[Exams] Fetching exams for user: ${user.id}`);
      const fetchedExams = await getExams(user.id);
      // Filter out archived exams
      const activeExams = fetchedExams.filter((exam) => !exam.isArchived);

      // Fetch answer key status for each exam
      const examsWithStatus = await Promise.all(
        activeExams.map(async (exam) => {
          try {
            const result = await AnswerKeyService.getAnswerKeyByExamId(exam.id);
            if (result.success && result.data) {
              const answersCount = result.data.answers.length;
              return {
                ...exam,
                answerKeyStatus: {
                  total: exam.num_items,
                  completed: answersCount,
                  hasAnswerKey: true,
                },
              };
            }
          } catch (error) {
            console.error(
              `Error fetching answer key for exam ${exam.id}:`,
              error,
            );
            if (error instanceof Error) {
              console.error("Error details:", error.message, error.stack);
            }
          }

      setExams(examsWithMetadata);
    } catch (error) {
      console.error("Error fetching exams detail:", error);
      toast.error(`Failed to load exams: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
    if (user?.id) {
      getClasses(user.id).then(setClasses).catch(console.error);
    }
  }, [user]);

  const handleCreateExam = async (formData: ExamFormData) => {
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
        examType: formData.examType || 'board',
      };

      // Add to UI immediately (optimistic)
      setExams([tempExam, ...exams]);
      toast.success(`Exam "${formData.name}" created successfully`);
      setShowCreateModal(false);

      // Save to Firebase in background (don't wait for it)
      try {
        const newExam = await createExam(formData, user.id);
        // Replace temp exam with real one
        setExams((prevExams) =>
          prevExams.map((e) => (e.id === tempId ? newExam : e))
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

  const handleArchive = async () => {
    if (!archiveId) return;

    try {
      await archiveExam(archiveId);

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
      (exam.subject &&
        exam.subject.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div className="flex flex-col min-h-screen bg-[#FAF9F6]">
      {/* Top Header */}
      <header className="h-16 border-b bg-white flex items-center justify-between px-8 shrink-0">
        <h2 className="text-[#004D2C] font-bold text-lg">
          Smart Exam Checking & Auto-Grading System
        </h2>
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchExams}
            className="text-xs font-bold text-gray-400 hover:text-[#004D2C]"
          >
            Refresh Data
          </Button>
          <div className="px-3 py-1 bg-gray-50 border rounded-lg text-xs flex items-center gap-2">
            <span className="text-gray-500">Role:</span>
            <span className="font-bold text-[#004D2C]">Prof</span>
          </div>
        </div>
      </header>

      <main className="flex-1 p-8 space-y-8 overflow-y-auto">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-4xl font-extrabold text-[#004D2C]">Exams</h1>
            <p className="text-gray-500 font-medium">
              Manage your exams and assessments
            </p>
          </div>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-[#004D2C] hover:bg-[#003d22] text-white px-6 h-12 rounded-xl flex items-center gap-2 font-bold shadow-md"
          >
            <Plus className="w-5 h-5" />
            Create New Exam
          </Button>
        </div>

        {/* Search */}
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-[#004D2C] transition-colors" />
          <Input
            placeholder="Search exams..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-12 h-14 bg-white border-[#BA8E23]/20 rounded-2xl shadow-sm italic text-gray-600 focus-visible:ring-[#BA8E23]/30"
          />
        </div>

        {/* Exams Table Card */}
        <Card className="border-[#BA8E23]/20 shadow-sm rounded-[24px] overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
                <TableHead className="py-6 px-6 font-extrabold text-[#004D2C]">
                  Exam Title
                </TableHead>
                <TableHead className="py-6 font-extrabold text-[#004D2C]">
                  Items
                </TableHead>
                <TableHead className="py-6 font-extrabold text-[#004D2C]">
                  Students
                </TableHead>
                <TableHead className="py-6 font-extrabold text-[#004D2C]">
                  Date
                </TableHead>
                <TableHead className="py-6 font-extrabold text-[#004D2C]">
                  Status
                </TableHead>
                <TableHead className="py-6 px-6 text-center font-extrabold text-[#004D2C]">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-20">
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <div className="w-8 h-8 border-4 border-[#004D2C] border-t-transparent rounded-full animate-spin" />
                      <span className="font-bold">Loading exams...</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Link href={`/exams/${exam.id}`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => setArchiveId(exam.id)}
                      >
                        <Archive className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredExams.map((exam) => (
                  <TableRow
                    key={exam.id}
                    className="group hover:bg-emerald-50/30 transition-colors"
                  >
                    <TableCell className="py-6 px-6 font-bold text-[#004D2C] text-[15px]">
                      {exam.title}
                    </TableCell>
                    <TableCell className="py-6 text-gray-500 font-bold">
                      {exam.num_items}
                    </TableCell>
                    <TableCell className="py-6 text-gray-500 font-bold">
                      {exam.students_count}
                    </TableCell>
                    <TableCell className="py-6 text-gray-400 font-bold">
                      {new Date(exam.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="py-6">
                      <div
                        className={cn(
                          "inline-flex px-4 py-1 rounded-lg text-xs font-bold border",
                          exam.uiStatus === "Completed"
                            ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                            : "bg-amber-50 text-amber-600 border-amber-100",
                        )}
                      >
                        {exam.uiStatus}
                      </div>
                    </TableCell>
                    <TableCell className="py-6 px-6">
                      <div className="flex items-center justify-center gap-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-gray-400 hover:text-emerald-700 hover:bg-emerald-100 rounded-lg transition-all"
                          onClick={() => router.push(`/exams/${exam.id}`)}
                        >
                          <Eye className="w-5 h-5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={!isExamEditable(exam)}
                          className={cn(
                            "h-9 w-9 rounded-lg transition-all",
                            isExamEditable(exam)
                              ? "text-gray-400 hover:text-amber-700 hover:bg-amber-100"
                              : "text-gray-200 cursor-not-allowed",
                          )}
                          onClick={() => {
                            setEditingExam(exam);
                            setShowEditModal(true);
                          }}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-gray-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all"
                          onClick={() => setDeleteId(exam.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </main>

      {/* Create Exam Modal */}
      <CreateExamModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreateExam={handleCreateExam}
        classes={classes}
      />

      {/* Edit Exam Modal */}
      <EditExamModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingExam(null);
        }}
        exam={editingExam}
        onUpdate={async (id, data) => {
          await updateExam(id, data);
          fetchExams();
        }}
      />

      {/* Archive Dialog */}
      <AlertDialog open={!!archiveId} onOpenChange={() => setArchiveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Exam</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive this exam? It will be moved to the Archive page and you can restore it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl border-gray-200">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
