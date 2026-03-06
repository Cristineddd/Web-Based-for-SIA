"use client";

import { useEffect, useState, useRef } from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Upload,
  Search,
  Users,
  Plus,
  Trash2,
  FileSpreadsheet,
  Loader2,
  Download,
  AlertCircle,
  Edit3,
  Save,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";
import { StudentService } from "@/services/studentService";

interface Student {
  id: string;
  student_id: string;
  first_name: string;
  last_name: string;
  grade: string | null;
  email: string | null;
  section: string | null;
  created_at: string;
}

export default function Students() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<Partial<Student>[]>([]);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null); // New state to hold file upload
  const [duplicateIds, setDuplicateIds] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  const [newStudent, setNewStudent] = useState({
    student_id: "",
    first_name: "",
    last_name: "",
    grade: "",
    email: "",
    section: "",
  });

  const [editStudent, setEditStudent] = useState({
    student_id: "",
    first_name: "",
    last_name: "",
    grade: "",
    email: "",
    section: "",
  });

  const fetchStudents = async () => {
    try {
      if (!user?.id) {
        setStudents([]);
        return;
      }

      // First try to get from classes collection (where students actually are)
      try {
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        
        const classesRef = collection(db, 'classes');
        const classesQuery = query(classesRef, where('createdBy', '==', user.id));
        const classesSnapshot = await getDocs(classesQuery);
        
        // Aggregate all students from all classes
        const allStudents = new Map<string, Student>(); // Use Map to avoid duplicates
        
        classesSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const classStudents = data.students || [];
          
          // Only process students from non-archived classes
          if (!data.isArchived) {
            classStudents.forEach((student: any) => {
              if (student.student_id) {
                allStudents.set(student.student_id, {
                  id: student.student_id,
                  student_id: student.student_id,
                  first_name: student.first_name || '',
                  last_name: student.last_name || '',
                  grade: student.grade || null,
                  email: student.email || null,
                  section: student.section || null,
                  created_at: data.created_at || new Date().toISOString(),
                });
              }
            });
          }
        });
        
        const mappedStudents = Array.from(allStudents.values());
        console.log('Students loaded from classes:', mappedStudents.length);
        setStudents(mappedStudents);
      } catch (classError) {
        console.warn('Could not fetch from classes, falling back to students collection:', classError);
        
        // Fallback to dedicated students collection
        const records = await StudentService.getAllStudents(user.id);
        const mappedStudents: Student[] = records.map((record) => ({
          id: record.student_id,
          student_id: record.student_id,
          first_name: record.first_name,
          last_name: record.last_name,
          grade: record.grade || null,
          email: record.email || null,
          section: record.section || null,
          created_at: record.created_at,
        }));

        setStudents(mappedStudents);
      }
    } catch (error) {
      console.error("Error fetching students:", error);
      toast.error("Failed to load students");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [user?.id]);

  const exportStudentIds = async (format: "csv" | "xlsx") => {
    try {
      if (!user?.id) {
        toast.error("You must be logged in to export");
        return;
      }

      setExporting(true);
      
      // Get students from classes collection first (where the actual data is)
      try {
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        
        const classesRef = collection(db, 'classes');
        const classesQuery = query(classesRef, where('createdBy', '==', user.id));
        const classesSnapshot = await getDocs(classesQuery);
        
        // Aggregate all students from all classes
        const allStudents = new Map<string, any>(); // Use Map to avoid duplicates
        
        classesSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const classStudents = data.students || [];
          
          // Only process students from non-archived classes
          if (!data.isArchived) {
            classStudents.forEach((student: any) => {
              if (student.student_id && !allStudents.has(student.student_id)) {
                allStudents.set(student.student_id, {
                  student_id: student.student_id,
                  first_name: student.first_name || '',
                  last_name: student.last_name || '',
                  email: student.email || '',
                });
              }
            });
          }
        });
        
        const records = Array.from(allStudents.values());
        console.log('Exporting students from classes:', records.length);
        
        if (records.length === 0) {
          toast.error("No student records to export");
          return;
        }

        const rows = records.map((record) => ({
          student_id: record.student_id,
          first_name: record.first_name,
          last_name: record.last_name,
          email: record.email || "",
        }));

        const worksheet = XLSX.utils.json_to_sheet(rows);
        if (format === "xlsx") {
          const workbook = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(workbook, worksheet, "Student IDs");
          XLSX.writeFile(workbook, "student_id_list.xlsx");
        } else {
          const csv = XLSX.utils.sheet_to_csv(worksheet);
          const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = "student_id_list.csv";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }

        toast.success(`Exported ${rows.length} student ID records`);
      } catch (classError) {
        console.warn('Could not export from classes, falling back to students collection:', classError);
        
        // Fallback to dedicated students collection
        const records = await StudentService.getAllStudents(user.id);
        if (records.length === 0) {
          toast.error("No student records to export");
          return;
        }

        const rows = records.map((record) => ({
          student_id: record.student_id,
          first_name: record.first_name,
          last_name: record.last_name,
          email: record.email || "",
        }));

        const worksheet = XLSX.utils.json_to_sheet(rows);
        if (format === "xlsx") {
          const workbook = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(workbook, worksheet, "Student IDs");
          XLSX.writeFile(workbook, "student_id_list.xlsx");
        } else {
          const csv = XLSX.utils.sheet_to_csv(worksheet);
          const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = "student_id_list.csv";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }

        toast.success(`Exported ${rows.length} student ID records`);
      }
    } catch (error) {
      console.error("Error exporting student IDs:", error);
      toast.error("Failed to export student IDs");
    } finally {
      setExporting(false);
    }
  };

  const handleAddStudent = async () => {
    if (
      !newStudent.student_id ||
      !newStudent.first_name ||
      !newStudent.last_name ||
      !newStudent.grade
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!newStudent.section) {
      toast.error("Please select a block");
      return;
    }

    try {
      if (!user?.id) {
        toast.error("You must be logged in to add students");
        return;
      }

      await StudentService.createStudent(
        newStudent.student_id.trim(),
        newStudent.first_name.trim(),
        newStudent.last_name.trim(),
        newStudent.email.trim() || undefined,
        user.id,
        newStudent.section,
        newStudent.grade.trim(),
      );

      await fetchStudents();
      toast.success("Student added successfully");
      setShowAddDialog(false);
      setNewStudent({
        student_id: "",
        first_name: "",
        last_name: "",
        grade: "",
        email: "",
        section: "",
      });
    } catch (error) {
      console.error("Error adding student:", error);
      const errorMessage = (error as Error).message || "Failed to add student";
      if (errorMessage.includes('already exists')) {
        toast.error(errorMessage);
      } else {
        toast.error("Failed to add student: " + errorMessage);
      }
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      if (!user?.id) {
        toast.error("You must be logged in to delete students");
        return;
      }

      const studentToDelete = students.find((s) => s.id === deleteId);
      if (!studentToDelete) {
        toast.error("Student not found");
        return;
      }

      await StudentService.deleteStudent(studentToDelete.student_id, user.id);
      await fetchStudents();
      toast.success("Student deleted successfully");
    } catch (error) {
      console.error("Error deleting student:", error);
      toast.error("Failed to delete student");
    } finally {
      setDeleteId(null);
    }
  };

  const handleEditStudent = (student: Student) => {
    setEditingStudent(student);
    setEditStudent({
      student_id: student.student_id,
      first_name: student.first_name,
      last_name: student.last_name,
      grade: student.grade || "",
      email: student.email || "",
      section: student.section || "",
    });
    setShowEditDialog(true);
  };

  const handleUpdateStudent = async () => {
    if (
      !editStudent.first_name ||
      !editStudent.last_name ||
      !editStudent.grade ||
      !editStudent.section ||
      !editingStudent
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      if (!user?.id) {
        toast.error("You must be logged in to update students");
        return;
      }

      // Note: Student ID cannot be changed due to it being the primary key
      const updates = {
        first_name: editStudent.first_name.trim(),
        last_name: editStudent.last_name.trim(),
        grade: editStudent.grade.trim(),
        email: editStudent.email.trim() || undefined,
        section: editStudent.section,
      };

      await StudentService.updateStudent(editingStudent.student_id, updates);

      toast.success("Student updated successfully");
      fetchStudents();
      setShowEditDialog(false);
      setEditingStudent(null);
      setEditStudent({
        student_id: "",
        first_name: "",
        last_name: "",
        grade: "",
        email: "",
        section: "",
      });
    } catch (error) {
      console.error("Error updating student:", error);
      const errorMessage = error instanceof Error ? error.message : "An error occurred";
      toast.error("Failed to update student: " + errorMessage);
    }
  };

  const cancelEdit = () => {
    setShowEditDialog(false);
    setEditingStudent(null);
    setEditStudent({
      student_id: "",
      first_name: "",
      last_name: "",
      grade: "",
      email: "",
      section: "",
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);

    try {
      setSelectedFile(file); // Store the file for later upload to server
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = event.target?.result;
          // CHANGED: We now use 'array' type instead of 'binary' because it parses modern Excel files (.xlsx) much more reliably
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet) as Record<
            string,
            unknown
          >[];

          const parsedStudents = jsonData
            .map((row) => ({
              student_id: String(
                row["student_id"] || row["Student ID"] || row["ID"] || "",
              ).trim(),
              first_name: String(
                row["first_name"] ||
                  row["First Name"] ||
                  row["FirstName"] ||
                  "",
              ).trim(),
              last_name: String(
                row["last_name"] || row["Last Name"] || row["LastName"] || "",
              ).trim(),
              grade: String(
                row["grade"] || row["Grade"] || row["year"] || row["Year"] || "",
              ).trim(),
              email: String(row["email"] || row["Email"] || "").trim() || null,
              section:
                String(row["section"] || row["Section"] || "").trim() || null,
            }))
            .filter((s) => s.student_id && s.first_name && s.last_name && s.grade && s.section);

          if (parsedStudents.length === 0) {
            toast.error("No valid student records found in file");
            return;
          }

          // Check for duplicates against existing students in the system
          const existingIds = new Set(students.map((s) => s.student_id));
          const fileIdCounts = new Map<string, number>();
          parsedStudents.forEach((s) => {
            fileIdCounts.set(s.student_id, (fileIdCounts.get(s.student_id) || 0) + 1);
          });

          const dupes = new Set<string>();
          parsedStudents.forEach((s) => {
            if (existingIds.has(s.student_id)) dupes.add(s.student_id);
            if ((fileIdCounts.get(s.student_id) || 0) > 1) dupes.add(s.student_id);
          });
          setDuplicateIds(dupes);

          if (dupes.size > 0 && dupes.size === parsedStudents.length) {
            toast.warning(`All ${parsedStudents.length} students already exist in the system. Nothing new to import.`);
            setImporting(false);
            return;
          }

          if (dupes.size > 0) {
            toast.warning(`${dupes.size} out of ${parsedStudents.length} students already exist and will be skipped.`);
          }

          setImportPreview(parsedStudents);
          setShowImportDialog(true);
        } catch (err) {
          console.error("Error parsing file:", err);
          toast.error("Failed to parse file. Please check the format.");
        } finally {
          setImporting(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error("Error reading file:", error);
      toast.error("Failed to read file");
      setImporting(false);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const confirmImport = async () => {
    setImporting(true);

    try {
      if (!user?.id) {
        toast.error("You must be logged in to import students");
        return;
      }

      // Filter out duplicates before importing
      const studentsToInsert = importPreview
        .filter(
          (
            s,
          ): s is {
            student_id: string;
            first_name: string;
            last_name: string;
            grade: string;
            email: string | null;
            section: string | null;
          } => Boolean(s.student_id && s.first_name && s.last_name && s.grade && s.section && !duplicateIds.has(s.student_id)),
        )
        .map((s) => ({
          student_id: s.student_id,
          first_name: s.first_name,
          last_name: s.last_name,
          grade: s.grade,
          email: s.email || undefined,
          section: s.section || undefined,
        }));

      if (studentsToInsert.length === 0) {
        toast.error("All students in this file already exist in the system. Nothing to import.");
        setShowImportDialog(false);
        setImportPreview([]);
        setDuplicateIds(new Set());
        setImporting(false);
        return;
      }

      const result = await StudentService.bulkCreateStudents(
        studentsToInsert,
        user.id,
      );
      await fetchStudents();

      const skippedCount = importPreview.length - studentsToInsert.length;
      const duplicateErrors = result.errors.filter(e => e.includes('already exists'));
      const otherErrors = result.errors.filter(e => !e.includes('already exists'));
      const totalSkipped = skippedCount + duplicateErrors.length;

      if (result.created.length > 0 && totalSkipped === 0) {
        toast.success(`Successfully imported ${result.created.length} students`);
      } else if (result.created.length > 0 && totalSkipped > 0) {
        toast.success(`Imported ${result.created.length} new students`);
        toast.warning(`${totalSkipped} duplicate student(s) were skipped`);
      } else if (result.created.length === 0 && totalSkipped > 0) {
        toast.warning(`No new students imported - all ${totalSkipped} student(s) already exist in the system.`);
      }

      if (otherErrors.length > 0) {
        toast.error(
          `Failed to import ${otherErrors.length} student(s): ${otherErrors.slice(0, 3).join('; ')}`,
        );
      }

      // NEW LOGIC: Upload the actual file to the server for backup/record keeping
      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile); // Append the file object to the form data

        try {
          // Send POST request to our new API route
          const response = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });

          if (!response.ok) {
            console.error("File upload failed");
            toast.error("Student data imported, but file backup failed.");
          } else {
            const data = await response.json();
            console.log("File backed up at:", data.filePath);
          }
        } catch (uploadError) {
          console.error("Error uploading file:", uploadError);
        }
      }

      setShowImportDialog(false);
      setImportPreview([]);
      setDuplicateIds(new Set());
      setSelectedFile(null); // Clear selected file after upload
    } catch (error) {
      console.error("Error importing students:", error);
      toast.error("Failed to import students");
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const currentYear = new Date().getFullYear();
    const template = [
      {
        student_id: `${currentYear}-0001`,
        first_name: "First Name",
        last_name: "Last Name",
        grade: "10",
        email: "email@example.com",
        section: "Section",
      },
      {
        student_id: `${currentYear}-0002`,
        first_name: "First Name",
        last_name: "Last Name",
        grade: "10",
        email: "email@example.com",
        section: "Section",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, "student_import_template.xlsx");
  };

  const filteredStudents = students.filter((student) => {
    const query = search.toLowerCase().trim();
    if (!query) return true;

    const fullName = `${student.first_name} ${student.last_name}`.toLowerCase();
    const reverseFullName = `${student.last_name} ${student.first_name}`.toLowerCase();
    const studentId = student.student_id.toLowerCase();
    const section = student.section?.toLowerCase() || '';

    // Check if the entire query matches any single field or the combined full name
    if (
      studentId.includes(query) ||
      fullName.includes(query) ||
      reverseFullName.includes(query) ||
      section.includes(query)
    ) {
      return true;
    }

    // Split by spaces and check if ALL terms match at least one field
    const terms = query.split(/\s+/).filter(Boolean);
    if (terms.length > 1) {
      return terms.every((term) =>
        studentId.includes(term) ||
        student.first_name.toLowerCase().includes(term) ||
        student.last_name.toLowerCase().includes(term) ||
        section.includes(term)
      );
    }

    return false;
  });

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Students</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">Manage student records</p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            {importing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            Import
          </Button>
          <Button
            className="gradient-primary gap-2"
            onClick={() => setShowAddDialog(true)}
          >
            <Plus className="w-4 h-4" />
            Add Student
          </Button>
        </div>
      </div>

      {/* Search & Actions */}
      <Card className="mb-6">
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by ID, name, or block..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="w-4 h-4 mr-2" />
              Download Template
            </Button>
            <Button
              variant="outline"
              onClick={() => exportStudentIds("csv")}
              disabled={exporting}
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              onClick={() => exportStudentIds("xlsx")}
              disabled={exporting}
            >
              <Download className="w-4 h-4 mr-2" />
              Export Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="table-container">
        <Table>
          <TableHeader>
            <TableRow className="bg-table-header hover:bg-table-header">
              <TableHead>Student ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Grade</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Block</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-accent" />
                    Loading students...
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredStudents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <Users className="w-10 h-10 mx-auto mb-2 text-muted-foreground/50" />
                  <p className="text-muted-foreground">
                    {search
                      ? "No students found matching your search"
                      : "No students added yet"}
                  </p>
                  {!search && (
                    <Button
                      variant="link"
                      className="mt-2"
                      onClick={() => setShowAddDialog(true)}
                    >
                      Add your first student
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              filteredStudents.map((student) => (
                <TableRow key={student.id} className="hover:bg-table-row-hover">
                  <TableCell className="font-mono">
                    {student.student_id}
                  </TableCell>
                  <TableCell className="font-medium">
                    {student.last_name}, {student.first_name}
                  </TableCell>
                  <TableCell>{student.grade || "-"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {student.email || "-"}
                  </TableCell>
                  <TableCell>{student.section || "-"}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                        onClick={() => handleEditStudent(student)}
                        title="Edit student"
                      >
                        <Edit3 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteId(student.id)}
                        title="Delete student"
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

      {/* Add Student Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Student</DialogTitle>
            <DialogDescription>
              Enter the student's information below
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="student_id">Student ID *</Label>
              <Input
                id="student_id"
                value={newStudent.student_id}
                onChange={(e) =>
                  setNewStudent({ ...newStudent, student_id: e.target.value })
                }
                placeholder="e.g., 2026-0001"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name *</Label>
                <Input
                  id="first_name"
                  value={newStudent.first_name}
                  onChange={(e) =>
                    setNewStudent({ ...newStudent, first_name: e.target.value })
                  }
                  placeholder="John"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name *</Label>
                <Input
                  id="last_name"
                  value={newStudent.last_name}
                  onChange={(e) =>
                    setNewStudent({ ...newStudent, last_name: e.target.value })
                  }
                  placeholder="Doe"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="grade">Grade *</Label>
              <Input
                id="grade"
                value={newStudent.grade}
                onChange={(e) =>
                  setNewStudent({ ...newStudent, grade: e.target.value })
                }
                placeholder="e.g., 10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={newStudent.email}
                onChange={(e) =>
                  setNewStudent({ ...newStudent, email: e.target.value })
                }
                placeholder="john@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="section">Block</Label>
              <select
                id="section"
                value={newStudent.section}
                onChange={(e) =>
                  setNewStudent({ ...newStudent, section: e.target.value })
                }
                className="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select a block...</option>
                {Array.from({ length: 26 }, (_, i) =>
                  String.fromCharCode(65 + i),
                ).map((letter) => (
                  <option key={letter} value={letter}>
                    {letter}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddStudent} className="gradient-primary">
              Add Student
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Student Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-primary" />
              Edit Student
            </DialogTitle>
            <DialogDescription>
              Update the student's information below. Note: Student ID cannot be changed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit_student_id">Student ID</Label>
              <Input
                id="edit_student_id"
                value={editStudent.student_id}
                disabled
                className="bg-muted cursor-not-allowed font-mono"
                title="Student ID cannot be changed as it's the primary key"
              />
              <p className="text-xs text-muted-foreground">
                Student ID cannot be changed after creation
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_first_name">First Name *</Label>
                <Input
                  id="edit_first_name"
                  value={editStudent.first_name}
                  onChange={(e) =>
                    setEditStudent({ ...editStudent, first_name: e.target.value })
                  }
                  placeholder="John"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_last_name">Last Name *</Label>
                <Input
                  id="edit_last_name"
                  value={editStudent.last_name}
                  onChange={(e) =>
                    setEditStudent({ ...editStudent, last_name: e.target.value })
                  }
                  placeholder="Doe"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_grade">Grade *</Label>
              <Input
                id="edit_grade"
                value={editStudent.grade}
                onChange={(e) =>
                  setEditStudent({ ...editStudent, grade: e.target.value })
                }
                placeholder="e.g., 10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_email">Email</Label>
              <Input
                id="edit_email"
                type="email"
                value={editStudent.email}
                onChange={(e) =>
                  setEditStudent({ ...editStudent, email: e.target.value })
                }
                placeholder="john@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_section">Block *</Label>
              <select
                id="edit_section"
                value={editStudent.section}
                onChange={(e) =>
                  setEditStudent({ ...editStudent, section: e.target.value })
                }
                className="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select a block...</option>
                {Array.from({ length: 26 }, (_, i) =>
                  String.fromCharCode(65 + i),
                ).map((letter) => (
                  <option key={letter} value={letter}>
                    {letter}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={cancelEdit}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleUpdateStudent} className="gradient-primary">
              <Save className="w-4 h-4 mr-2" />
              Update Student
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Preview Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-accent" />
              Import Preview
            </DialogTitle>
            <DialogDescription>
              Review the data before importing. {importPreview.length} records
              found.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[300px] overflow-auto border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow className="bg-table-header">
                  <TableHead>Student ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Block</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importPreview.slice(0, 10).map((student, index) => {
                  const isDuplicate = duplicateIds.has(student.student_id || '');
                  return (
                  <TableRow key={index} className={isDuplicate ? 'bg-red-50 dark:bg-red-950/30' : ''}>
                    <TableCell className="font-mono">
                      {student.student_id}
                      {isDuplicate && (
                        <span className="ml-2 text-xs text-red-600 font-semibold">DUPLICATE</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {student.last_name}, {student.first_name}
                    </TableCell>
                    <TableCell>{student.grade || "-"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {student.email || "-"}
                    </TableCell>
                    <TableCell>{student.section || "-"}</TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {importPreview.length > 10 && (
            <p className="text-sm text-muted-foreground text-center">
              ...and {importPreview.length - 10} more records
            </p>
          )}
          {duplicateIds.size > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
              <p className="text-sm text-red-600">
                <strong>{duplicateIds.size} duplicate(s) found</strong> - these students already exist and will be <strong>skipped</strong> during import.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setShowImportDialog(false); setDuplicateIds(new Set()); }}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmImport}
              disabled={importing || (importPreview.length - duplicateIds.size) === 0}
              className="gradient-primary"
            >
              {importing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                `Import ${importPreview.length - duplicateIds.size} Student${(importPreview.length - duplicateIds.size) !== 1 ? 's' : ''}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Student</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this student? This action cannot
              be undone.
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
