"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Archive as ArchiveIcon,
  Search,
  GraduationCap,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getArchivedClasses, Class } from "@/services/classService";
import { AuditLogger } from "@/services/auditLogger";
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

export default function ArchivedClasses() {
  const { user } = useAuth();
  const [archivedClasses, setArchivedClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
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

        const classes = await getArchivedClasses(user.id);
        setArchivedClasses(classes);
      } catch (error) {
        console.error("Error fetching archived classes:", error);
        toast.error("Failed to load archived classes");
      } finally {
        setLoading(false);
      }
    };

    fetchArchivedClasses();
  }, [user?.id]);

  const filteredClasses = archivedClasses.filter(
    (c) =>
      c.class_name.toLowerCase().includes(search.toLowerCase()) ||
      c.course_subject.toLowerCase().includes(search.toLowerCase()) ||
      (c.year && c.year.toLowerCase().includes(search.toLowerCase())),
  );

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const classToDelete = archivedClasses.find((c) => c.id === deleteId);
      const { deleteClass } = await import("@/services/classService");
      await deleteClass(deleteId);

      if (user?.email && classToDelete) {
        AuditLogger.logActivity(
          user.id,
          user.email,
          "class_deleted",
          `Permanently deleted archived class: ${classToDelete.class_name}`,
          {
            entityId: deleteId,
            entityName: classToDelete.class_name,
            entityType: "class",
          },
        ).catch(console.error);
      }

      setArchivedClasses(archivedClasses.filter((c) => c.id !== deleteId));
      setDeleteId(null);
      toast.success("Archived class deleted successfully");
    } catch (error) {
      console.error("Error deleting class:", error);
      toast.error("Failed to delete archived class");
    }
  };

  const handleRestore = async () => {
    if (!restoreId) return;

    try {
      const classToRestore = archivedClasses.find((c) => c.id === restoreId);
      const { updateClass } = await import("@/services/classService");
      await updateClass(restoreId, { isArchived: false });

      if (user?.email && classToRestore) {
        AuditLogger.logActivity(
          user.id,
          user.email,
          "admin_action",
          `Restored archived class: ${classToRestore.class_name}`,
          {
            entityId: restoreId,
            entityName: classToRestore.class_name,
            entityType: "class",
          },
        ).catch(console.error);
      }

      setArchivedClasses(archivedClasses.filter((c) => c.id !== restoreId));
      setRestoreId(null);
      toast.success("Class restored successfully");
    } catch (error) {
      console.error("Error restoring class:", error);
      toast.error("Failed to restore class");
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            Archived Classes
          </h1>
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
            placeholder="Search archived classes..."
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
            {search
              ? "No archived classes found matching your search"
              : "No archived classes"}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto max-w-full">
            <Table className="w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[120px] w-[40%]">
                    Program
                  </TableHead>
                  <TableHead className="min-w-[100px] w-[25%] hidden sm:table-cell">
                    Course
                  </TableHead>
                  <TableHead className="min-w-[70px] w-[15%] hidden lg:table-cell">
                    Year
                  </TableHead>
                  <TableHead className="min-w-[70px] w-[15%] hidden lg:table-cell">
                    Room
                  </TableHead>
                  <TableHead className="text-center min-w-[70px] w-[15%] hidden md:table-cell">
                    Students
                  </TableHead>
                  <TableHead className="text-center min-w-[80px] w-[20%]">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClasses.map((archivedClass) => (
                  <TableRow key={archivedClass.id}>
                    <TableCell className="font-medium">
                      <div
                        className="break-words overflow-hidden text-ellipsis"
                        style={{ maxWidth: "120px" }}
                        title={archivedClass.class_name}
                      >
                        {archivedClass.class_name}
                      </div>
                      <div className="text-xs text-muted-foreground sm:hidden mt-1">
                        {archivedClass.course_subject}
                        {archivedClass.year && ` • ${archivedClass.year}`}
                        <span className="md:hidden">
                          {" "}
                          •{" "}
                          {archivedClass.students
                            ? archivedClass.students.length
                            : 0}{" "}
                          students
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div
                        className="break-words overflow-hidden text-ellipsis"
                        style={{ maxWidth: "100px" }}
                        title={archivedClass.course_subject}
                      >
                        {archivedClass.course_subject}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div
                        className="break-words overflow-hidden text-ellipsis"
                        title={archivedClass.year || "N/A"}
                      >
                        {archivedClass.year || "N/A"}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div
                        className="break-words overflow-hidden text-ellipsis"
                        title={archivedClass.room || "N/A"}
                      >
                        {archivedClass.room || "N/A"}
                      </div>
                    </TableCell>
                    <TableCell className="text-center hidden md:table-cell">
                      <span className="inline-flex items-center gap-1">
                        <GraduationCap className="w-4 h-4" />
                        {archivedClass.students
                          ? archivedClass.students.length
                          : 0}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-blue-600 hover:text-blue-700 h-8 px-2 flex items-center justify-center"
                          onClick={() => setRestoreId(archivedClass.id)}
                          title="Restore class to active"
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span className="hidden md:inline ml-1">Restore</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive h-8 px-2 flex items-center justify-center"
                          onClick={() => setDeleteId(archivedClass.id)}
                          title="Permanently delete class"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="hidden md:inline ml-1">Delete</span>
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
              Are you sure you want to permanently delete this archived class?
              This action cannot be undone.
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
              Are you sure you want to restore this class? It will reappear in
              your active classes.
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
