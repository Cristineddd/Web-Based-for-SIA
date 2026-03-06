'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Archive as ArchiveIcon, Search, FileText, Eye, Trash2, RotateCcw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getArchivedExams, type Exam, deleteExam } from '@/services/examService';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function ArchivedExams() {
  const { user } = useAuth();
  const [archivedExams, setArchivedExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [restoreId, setRestoreId] = useState<string | null>(null);

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
        console.error('Error fetching archived exams:', error);
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
      await deleteExam(deleteId);
      setArchivedExams(archivedExams.filter(e => e.id !== deleteId));
      setDeleteId(null);
      toast.success('Archived exam deleted successfully');
    } catch (error) {
      console.error('Error deleting exam:', error);
      toast.error('Failed to delete archived exam');
    }
  };

  const handleRestore = async () => {
    if (!restoreId) return;

    try {
      const { updateExam } = await import('@/services/examService');
      await updateExam(restoreId, { isArchived: false });
      setArchivedExams(archivedExams.filter(e => e.id !== restoreId));
      setRestoreId(null);
      toast.success('Exam restored successfully');
    } catch (error) {
      console.error('Error restoring exam:', error);
      toast.error('Failed to restore exam');
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Archived Exams</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            View, restore, and manage archived exams
          </p>
        </div>
      </div>

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
            {search ? 'No archived exams found matching your search' : 'No archived exams'}
          </p>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Title
                    </div>
                  </TableHead>
                  <TableHead className="min-w-[120px]">Subject</TableHead>
                  <TableHead className="min-w-[80px]">Items</TableHead>
                  <TableHead className="min-w-[120px] hidden sm:table-cell">Archived Date</TableHead>
                  <TableHead className="text-right min-w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExams.map((exam) => (
                  <TableRow key={exam.id}>
                    <TableCell className="font-medium">
                      <div className="truncate max-w-[200px]" title={exam.title}>
                        {exam.title}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="truncate max-w-[120px]" title={exam.subject}>
                        {exam.subject}
                      </div>
                    </TableCell>
                    <TableCell>{exam.num_items} items</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {exam.archivedAt 
                        ? new Date(exam.archivedAt).toLocaleDateString()
                        : 'Unknown'
                      }
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
                          className="h-8 w-8 text-blue-600 hover:text-blue-700"
                          onClick={() => setRestoreId(exam.id)}
                          title="Restore exam to active"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(exam.id)}
                          title="Permanently delete exam"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Archive Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        <Card className="p-4 sm:p-6 border">
          <p className="text-sm text-muted-foreground">Total Archived</p>
          <p className="text-2xl sm:text-3xl font-bold text-foreground mt-2">{archivedExams.length}</p>
        </Card>
        <Card className="p-4 sm:p-6 border">
          <p className="text-sm text-muted-foreground">Total Questions</p>
          <p className="text-2xl sm:text-3xl font-bold text-foreground mt-2">
            {archivedExams.reduce((sum, exam) => sum + exam.num_items, 0)}
          </p>
        </Card>
        <Card className="p-4 sm:p-6 border sm:col-span-2 lg:col-span-1">
          <p className="text-sm text-muted-foreground">Last Archived</p>
          <p className="text-lg font-bold text-foreground mt-2">
            {archivedExams.length > 0
              ? new Date(archivedExams[0].archivedAt || '').toLocaleDateString()
              : '—'}
          </p>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Archived Exam</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete this archived exam? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={!!restoreId} onOpenChange={() => setRestoreId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Exam</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to restore this exam? It will reappear in your active exams.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore}>
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}