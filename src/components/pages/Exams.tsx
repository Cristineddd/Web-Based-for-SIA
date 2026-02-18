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
import { Plus, Search, Eye, Trash2, Edit2, FileText } from "lucide-react";
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
  deleteExam,
  type Exam,
  type ExamFormData,
} from "@/services/examService";
import { cn } from "@/lib/utils";

interface ExamWithStatus extends Exam {
  status: "Completed" | "Grading";
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
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchExams = async () => {
    try {
      if (!user?.id) {
        setExams([]);
        setLoading(false);
        return;
      }

      const fetchedExams = await getExams(user.id);

      // Map to include status and mock student count for UI demo/realism
      const examsWithMetadata = fetchedExams.map((exam) => ({
        ...exam,
        status: (Math.random() > 0.3 ? "Completed" : "Grading") as
          | "Completed"
          | "Grading",
        students_count: Math.floor(Math.random() * 20) + 30,
      }));

      setExams(examsWithMetadata);
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
    try {
      if (!user?.id) {
        toast.error("You must be logged in to create an exam");
        return;
      }

      await createExam(formData, user.id);
      toast.success(`Exam "${formData.name}" created successfully`);
      setShowCreateModal(false);
      fetchExams();
    } catch (error) {
      console.error("Error creating exam:", error);
      toast.error("Failed to create exam");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteExam(deleteId);
      setExams(exams.filter((e) => e.id !== deleteId));
      toast.success("Exam deleted successfully");
    } catch (error) {
      console.error("Error deleting exam:", error);
      toast.error("Failed to delete exam");
    } finally {
      setDeleteId(null);
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
                </TableRow>
              ) : filteredExams.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-20">
                    <div className="space-y-4 opacity-40">
                      <FileText className="w-16 h-16 mx-auto text-gray-400" />
                      <p className="font-extrabold text-lg">No created exam</p>
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
                          exam.status === "Completed"
                            ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                            : "bg-amber-50 text-amber-600 border-amber-100",
                        )}
                      >
                        {exam.status}
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
                          className="h-9 w-9 text-gray-400 hover:text-amber-700 hover:bg-amber-100 rounded-lg transition-all"
                          onClick={() =>
                            router.push(`/exams/${exam.id}?edit=true`)
                          }
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
      />

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl border-[#BA8E23]/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#004D2C] font-bold">
              Delete Exam
            </AlertDialogTitle>
            <AlertDialogDescription className="font-medium">
              Are you sure you want to delete this exam? This will also delete
              all associated answer keys and generated sheets. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl border-gray-200">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white rounded-xl"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
