"use client";

import { useEffect, useState, useRef } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
} from "lucide-react";
import * as XLSX from "xlsx";
import { StudentService } from "@/services/studentService";

interface Student {
  id: string;
  student_id: string;
  first_name: string;
  last_name: string;
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
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<Partial<Student>[]>([]);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null); // New state to hold file upload
  const [exporting, setExporting] = useState(false);

  const [newStudent, setNewStudent] = useState({
    student_id: "",
    first_name: "",
    last_name: "",
    email: "",
    section: "",
  });

  const fetchStudents = async () => {
    try {
      if (!user?.id) {
        setStudents([]);
        return;
      }

      const records = await StudentService.getAllStudents(user.id);
      const mappedStudents: Student[] = records.map((record) => ({
        id: record.student_id,
        student_id: record.student_id,
        first_name: record.first_name,
        last_name: record.last_name,
        email: record.email || null,
        section: record.section || null,
        created_at: record.created_at,
      }));

      setStudents(mappedStudents);
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
      !newStudent.last_name
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
      );

      await fetchStudents();
      toast.success("Student added successfully");
      setShowAddDialog(false);
      setNewStudent({
        student_id: "",
        first_name: "",
        last_name: "",
        email: "",
        section: "",
      });
    } catch (error) {
      console.error("Error adding student:", error);
      toast.error("Failed to add student");
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
              email: String(row["email"] || row["Email"] || "").trim() || null,
              section:
                String(row["section"] || row["Section"] || "").trim() || null,
            }))
            .filter((s) => s.student_id && s.first_name && s.last_name);

          if (parsedStudents.length === 0) {
            toast.error("No valid student records found in file");
            return;
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

      const studentsToInsert = importPreview
        .filter(
          (
            s,
          ): s is {
            student_id: string;
            first_name: string;
            last_name: string;
            email: string | null;
            section: string | null;
          } => Boolean(s.student_id && s.first_name && s.last_name),
        )
        .map((s) => ({
          student_id: s.student_id,
          first_name: s.first_name,
          last_name: s.last_name,
          email: s.email || undefined,
          section: s.section || undefined,
        }));

      const result = await StudentService.bulkCreateStudents(
        studentsToInsert,
        user.id,
      );
      await fetchStudents();

      if (result.created.length > 0) {
        toast.success(`Successfully imported ${result.created.length} students`);
      }
      if (result.errors.length > 0) {
        toast.error(
          `Failed to import ${result.errors.length} student(s). Check duplicates/format.`,
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
        email: "email@example.com",
        section: "Section",
      },
      {
        student_id: `${currentYear}-0002`,
        first_name: "First Name",
        last_name: "Last Name",
        email: "email@example.com",
        section: "Section",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, "student_import_template.xlsx");
  };

  const filteredStudents = students.filter(
    (student) =>
      student.student_id.toLowerCase().includes(search.toLowerCase()) ||
      student.first_name.toLowerCase().includes(search.toLowerCase()) ||
      student.last_name.toLowerCase().includes(search.toLowerCase()) ||
      student.section?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Students</h1>
          <p className="text-muted-foreground mt-1">Manage student records</p>
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
              <TableHead>Email</TableHead>
              <TableHead>Block</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-accent" />
                    Loading students...
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredStudents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
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
                  <TableCell className="text-muted-foreground">
                    {student.email || "—"}
                  </TableCell>
                  <TableCell>{student.section || "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(student.id)}
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
                  <TableHead>Email</TableHead>
                  <TableHead>Block</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importPreview.slice(0, 10).map((student, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-mono">
                      {student.student_id}
                    </TableCell>
                    <TableCell>
                      {student.last_name}, {student.first_name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {student.email || "—"}
                    </TableCell>
                    <TableCell>{student.section || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {importPreview.length > 10 && (
            <p className="text-sm text-muted-foreground text-center">
              ...and {importPreview.length - 10} more records
            </p>
          )}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
            <AlertCircle className="w-4 h-4 text-warning mt-0.5" />
            <p className="text-sm text-warning">
              Existing students with matching IDs will be updated.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowImportDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmImport}
              disabled={importing}
              className="gradient-primary"
            >
              {importing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                `Import ${importPreview.length} Students`
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
