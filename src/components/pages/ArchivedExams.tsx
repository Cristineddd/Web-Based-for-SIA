"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Archive as ArchiveIcon,
  Search,
  FileText,
  Eye,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getArchivedExams,
  type Exam,
  deleteExam,
} from "@/services/examService";
import { AuditLogger } from "@/services/auditLogger";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function ArchivedExams() {
  const { user } = useAuth();
  const [archivedExams, setArchivedExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const fetchArchivedExams = async () => {
      try {
        if (!user?.id) {
          setArchivedExams([]);
          setLoading(false);
          return;
        }

        const exams = await getArchivedExams(user.id);
        setArchivedExams(exams);
      } catch (error) {
        console.error("Error fetching archived exams:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchArchivedExams();
  }, [user]);

  const filteredExams = archivedExams.filter(
    (exam) =>
      exam.title.toLowerCase().includes(search.toLowerCase()) ||
      exam.subject.toLowerCase().includes(search.toLowerCase()),
  );

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const examToDelete = archivedExams.find((e) => e.id === deleteId);
      await deleteExam(deleteId);

      if (user?.email && examToDelete) {
        AuditLogger.logActivity(
          user.id,
          user.email,
          "exam_deleted",
          `Permanently deleted exam: ${examToDelete.title}`,
          {
            entityId: deleteId,
            entityName: examToDelete.title,
            entityType: "exam",
          },
        ).catch(console.error);
      }

      setArchivedExams(archivedExams.filter((e) => e.id !== deleteId));
      setDeleteId(null);
      toast.success("Archived exam deleted successfully");
    } catch (error) {
      console.error("Error deleting exam:", error);
      toast.error("Failed to delete archived exam");
    }
  };

  return (
    <div>
      {/* Search */}
      <Card className="mb-6">
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search archived exams..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading archived exams...
        </div>
      ) : filteredExams.length === 0 ? (
        <Card className="p-12 text-center">
          <ArchiveIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            {search
              ? "No archived exams found matching your search"
              : "No archived exams"}
          </p>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Title
                  </div>
                </TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Archived Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExams.map((exam) => (
                <TableRow key={exam.id}>
                  <TableCell className="font-medium">{exam.title}</TableCell>
                  <TableCell>{exam.subject}</TableCell>
                  <TableCell>{exam.num_items} items</TableCell>
                  <TableCell>
                    {exam.archivedAt
                      ? new Date(exam.archivedAt).toLocaleDateString()
                      : "Unknown"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/exams/${exam.id}`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(exam.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Archive Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <Card className="p-6 border">
          <p className="text-sm text-muted-foreground">Total Archived</p>
          <p className="text-3xl font-bold text-foreground mt-2">
            {archivedExams.length}
          </p>
        </Card>
        <Card className="p-6 border">
          <p className="text-sm text-muted-foreground">Total Questions</p>
          <p className="text-3xl font-bold text-foreground mt-2">
            {archivedExams.reduce((sum, exam) => sum + exam.num_items, 0)}
          </p>
        </Card>
        <Card className="p-6 border">
          <p className="text-sm text-muted-foreground">Last Archived</p>
          <p className="text-lg font-bold text-foreground mt-2">
            {archivedExams.length > 0
              ? new Date(archivedExams[0].archivedAt || "").toLocaleDateString()
              : "—"}
          </p>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Archived Exam</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this archived exam? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
