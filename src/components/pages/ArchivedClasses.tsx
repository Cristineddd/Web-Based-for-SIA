'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Archive as ArchiveIcon, Search, GraduationCap, Trash2, RotateCcw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
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

interface ArchivedClass {
  id: string;
  class_name: string;
  course_subject: string;
  section_block: string;
  room: string;
  students_count: number;
  created_at: string;
  isArchived: boolean;
}

export default function ArchivedClasses() {
  const { user } = useAuth();
  const [archivedClasses, setArchivedClasses] = useState<ArchivedClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [restoreId, setRestoreId] = useState<string | null>(null);

  useEffect(() => {
    const fetchArchivedClasses = async () => {
      try {
        if (!user?.id) {
          setArchivedClasses([]);
          setLoading(false);
          return;
        }

        const classesRef = collection(db, 'classes');
        const q = query(classesRef, where('isArchived', '==', true));
        const snapshot = await getDocs(q);

        const classes = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            class_name: data.class_name || '',
            course_subject: data.course_subject || '',
            section_block: data.section_block || '',
            room: data.room || '',
            students_count: Array.isArray(data.students) ? data.students.length : 0,
            created_at: data.created_at || '',
            isArchived: data.isArchived || true,
          } as ArchivedClass;
        });

        setArchivedClasses(classes);
      } catch (error) {
        console.error('Error fetching archived classes:', error);
        toast.error('Failed to load archived classes');
      } finally {
        setLoading(false);
      }
    };

    fetchArchivedClasses();
  }, [user?.id]);

  const filteredClasses = archivedClasses.filter((c) =>
    c.class_name.toLowerCase().includes(search.toLowerCase()) ||
    c.course_subject.toLowerCase().includes(search.toLowerCase()) ||
    c.section_block.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const { deleteClass } = await import('@/services/classService');
      await deleteClass(deleteId);
      setArchivedClasses(archivedClasses.filter((c) => c.id !== deleteId));
      setDeleteId(null);
      toast.success('Archived class deleted successfully');
    } catch (error) {
      console.error('Error deleting class:', error);
      toast.error('Failed to delete archived class');
    }
  };

  const handleRestore = async () => {
    if (!restoreId) return;

    try {
      const { updateClass } = await import('@/services/classService');
      await updateClass(restoreId, { isArchived: false });
      setArchivedClasses(archivedClasses.filter((c) => c.id !== restoreId));
      setRestoreId(null);
      toast.success('Class restored successfully');
    } catch (error) {
      console.error('Error restoring class:', error);
      toast.error('Failed to restore class');
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Archived Classes</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            View, restore, and manage archived classes
          </p>
        </div>
      </div>

      {/* Search */}
      <Card className="mb-6 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search archived classes by program, course, or section..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </Card>

      {/* Loading */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading archived classes...
        </div>
      ) : filteredClasses.length === 0 ? (
        <Card className="p-12 text-center">
          <ArchiveIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            {search ? 'No archived classes found matching your search' : 'No archived classes'}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[150px]">Program</TableHead>
                  <TableHead className="min-w-[120px]">Course</TableHead>
                  <TableHead className="min-w-[100px] hidden sm:table-cell">Section</TableHead>
                  <TableHead className="min-w-[80px] hidden md:table-cell">Room</TableHead>
                  <TableHead className="text-center min-w-[100px]">Students</TableHead>
                  <TableHead className="text-center min-w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClasses.map((archivedClass) => (
                  <TableRow key={archivedClass.id}>
                    <TableCell className="font-medium">
                      <div className="truncate max-w-[150px]" title={archivedClass.class_name}>
                        {archivedClass.class_name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="truncate max-w-[120px]" title={archivedClass.course_subject}>
                        {archivedClass.course_subject}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="truncate max-w-[100px]" title={archivedClass.section_block}>
                        {archivedClass.section_block}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="truncate max-w-[80px]" title={archivedClass.room}>
                        {archivedClass.room}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center gap-1">
                        <GraduationCap className="w-4 h-4" />
                        {archivedClass.students_count}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex gap-2 justify-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-blue-600 hover:text-blue-700"
                          onClick={() => setRestoreId(archivedClass.id)}
                          title="Restore class to active"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(archivedClass.id)}
                          title="Permanently delete class"
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Archived Class</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete this archived class? This action cannot be undone.
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

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={!!restoreId} onOpenChange={() => setRestoreId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Class</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to restore this class? It will reappear in your active classes.
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
