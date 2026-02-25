"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
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
import { AnswerKeyService } from "@/services/answerKeyService";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

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
  const searchParams = useSearchParams();
  const [exams, setExams] = useState<ExamWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [duplicateExamData, setDuplicateExamData] = useState<ExamFormData | null>(null);

  useEffect(() => {
    const title = searchParams.get("title");
    const subject = searchParams.get("subject");
    const items = searchParams.get("items");
    const date = searchParams.get("date");
    const choices = searchParams.get("choices");

    if (title && subject && items && date) {
      const examExists = exams.some(
        (exam) =>
          exam.title === title &&
          exam.subject === subject &&
          exam.num_items === parseInt(items),
      );

      if (!examExists) {
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

      // Fetch answer key status for each exam
      const examsWithStatus = await Promise.all(
        activeExams.map(async (exam) => {
          let answerKeyStatus = {
            total: exam.num_items,
            completed: 0,
            hasAnswerKey: false,
          };

          try {
            const result = await AnswerKeyService.getAnswerKeyByExamId(exam.id);
            if (result.success && result.data) {
              const answersCount = result.data.answers.length;
              answerKeyStatus = {
                total: exam.num_items,
                completed: answersCount,
                hasAnswerKey: true,
              };
            }
          } catch (error) {
            console.error(
              `Error fetching answer key for exam ${exam.id}:`,
              error,
            );
          }

          // Check if a template exists for this exam
          let hasTemplate = false;
          try {
            const templateQuery = query(
              collection(db, 'templates'),
              where('examId', '==', exam.id)
            );
            const templateSnap = await getDocs(templateQuery);
            hasTemplate = !templateSnap.empty;
          } catch (error) {
            console.error(`Error checking template for exam ${exam.id}:`, error);
          }

          return {
            ...exam,
            answerKeyStatus,
            hasTemplate,
          };
        }),
      );

      setExams(examsWithStatus);
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

  const handleCreateExam = async (formData: ExamFormData) => {
    // Check for duplicates first
    const isDuplicate = exams.some(
      (e) => e.title.toLowerCase().trim() === formData.name.toLowerCase().trim()
    );

    if (isDuplicate && !duplicateExamData) {
      setDuplicateExamData(formData);
      setShowCreateModal(false);
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
        examType: formData.examType || 'board',
      };

      // Add to UI immediately (optimistic)
      setExams([tempExam, ...exams]);
      toast.success(`Exam "${formData.name}" created successfully`);
      setShowCreateModal(false);

      // Save to Firebase in background (don't wait for it)
      try {
        console.log('📝 Creating exam from Exams page');
        console.log('  - User:', user);
        console.log('  - InstructorId:', user.instructorId);
        
        if (!user.instructorId) {
          toast.error('⚠️ Instructor ID not found. Please log out and log back in.');
          setExams((prevExams) => prevExams.filter((e) => e.id !== tempId));
          return;
        }
        
        const newExam = await createExam(formData, user.id, user.instructorId);
        console.log('✅ Exam created:', newExam);
        
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
      exam.subject.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Exams</h1>
          <p className="text-muted-foreground mt-1">
            Manage your exams and answer keys
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md font-semibold hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create New Exam
        </button>
      </div>

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="py-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by title or subject..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="table-container overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-table-header hover:bg-table-header">
              <TableHead>Title</TableHead>
              <TableHead className="hidden sm:table-cell">Subject</TableHead>
              <TableHead className="hidden lg:table-cell">Class</TableHead>
              <TableHead className="text-center">Items</TableHead>
              <TableHead className="text-center hidden md:table-cell">
                Choices
              </TableHead>
              <TableHead className="text-center hidden sm:table-cell">
                Answer Key
              </TableHead>
              <TableHead className="text-center hidden lg:table-cell">
                Template
              </TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                    Loading exams...
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredExams.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12">
                  <FileText className="w-10 h-10 mx-auto mb-2 text-muted-foreground/50" />
                  <p className="text-muted-foreground">
                    {search
                      ? "No exams found matching your search"
                      : "No exams created yet"}
                  </p>
                  {!search && (
                    <Button
                      variant="link"
                      className="mt-2"
                      onClick={() => setShowCreateModal(true)}
                    >
                      Create your first exam
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              filteredExams.map((exam) => (
                <TableRow key={exam.id} className="hover:bg-table-row-hover">
                  <TableCell className="font-medium">{exam.title}</TableCell>
                  <TableCell className="text-muted-foreground hidden sm:table-cell">
                    {exam.subject}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden lg:table-cell">
                    {exam.className || "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    {exam.num_items}
                  </TableCell>
                  <TableCell className="text-center hidden md:table-cell">
                    {exam.choices_per_item}
                  </TableCell>
                  <TableCell className="text-center hidden sm:table-cell">
                    {exam.answerKeyStatus?.hasAnswerKey ? (
                      exam.answerKeyStatus.completed ===
                      exam.answerKeyStatus.total ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-success/10 text-success">
                          Complete
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-warning/10 text-warning">
                          {exam.answerKeyStatus.completed}/
                          {exam.answerKeyStatus.total}
                        </span>
                      )
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-muted/50 text-muted-foreground">
                        Not started
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-center hidden lg:table-cell">
                    {exam.hasTemplate ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-success/10 text-success">
                        Yes
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-muted/50 text-muted-foreground">
                        No
                      </span>
                    )}
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
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Create Exam Modal */}
      <CreateExamModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreateExam={handleCreateExam}
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
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
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
              An exam with the title <strong className="text-primary">"{duplicateExamData?.name}"</strong> already exists in your records.
              <br /><br />
              Creating multiple exams with the same name can lead to confusion during grading and reporting. Are you sure you want to proceed with creating this duplicate batch?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDuplicateExamData(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (duplicateExamData) {
                  handleCreateExam(duplicateExamData);
                  setDuplicateExamData(null);
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
