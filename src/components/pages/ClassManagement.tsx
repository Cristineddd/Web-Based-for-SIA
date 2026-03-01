"use client";

import { useEffect, useState, useRef } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Search,
  Plus,
  Loader2,
  GraduationCap,
  Upload,
  Download,
  AlertCircle,
  X,
  Archive,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import * as XLSX from "xlsx"; // Added import here
import {
  createClass,
  getClasses,
  updateClass,
  type Class,
  type Student,
} from "@/services/classService";
import { StudentIDValidationService } from "@/services/studentIDValidationService";
import { InvalidRecordLogger } from "@/services/invalidRecordLogger";

export default function ClassManagement() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [currentTab, setCurrentTab] = useState("basic");
  const [importing] = useState(false);
  const [importPreview, setImportPreview] = useState<Student[]>([]);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [roomWarning, setRoomWarning] = useState(false);
  const [classNameWarning, setClassNameWarning] = useState(false);
  const [courseSubjectWarning, setCourseSubjectWarning] = useState(false);
  const [uploadSummary, setUploadSummary] = useState<{
    total: number;
    successful: number;
    failed: number;
    duplicates: number;
    invalidEntries: Array<{student: Student, errors: string[]}>;
  } | null>(null);
  const [showUploadSummary, setShowUploadSummary] = useState(false);

  const [newClass, setNewClass] = useState({
    class_name: "",
    course_subject: "",
    section_block: "",
    room: "",
  });

  const [students, setStudents] = useState<Student[]>([]);
  const [newStudent, setNewStudent] = useState({
    student_id: "",
    first_name: "",
    last_name: "",
    email: "",
  });

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      setLoading(true);
      const userId = user?.id;
      const fetchedClasses = await getClasses(userId);
      setClasses(fetchedClasses);
    } catch (error) {
      console.error("Error fetching classes:", error);
      toast.error("Failed to load classes");
    } finally {
      setLoading(false);
    }
  };

  const handleCloseAddDialog = () => {
    setShowAddDialog(false);
    // Reset form data when closing dialog
    setNewClass({
      class_name: "",
      course_subject: "",
      section_block: "",
      room: "",
    });
    setStudents([]);
    setNewStudent({
      student_id: "",
      first_name: "",
      last_name: "",
      email: "",
    });
    setCurrentTab("basic");
  };

  const handleAddClass = async () => {
    if (
      !newClass.class_name ||
      !newClass.course_subject ||
      !newClass.section_block
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Validate Class Name minimum length
    if (newClass.class_name.trim().length < 5) {
      toast.error("Class Name must be at least 5 characters long");
      return;
    }

    // Validate Course/Subject minimum length
    if (newClass.course_subject.trim().length < 5) {
      toast.error("Course/Subject must be at least 5 characters long");
      return;
    }

    if (!user?.id) {
      toast.error("You must be logged in to create a class");
      return;
    }

    // Save the class data before resetting
    const classToAdd: Omit<Class, "id"> = {
      ...newClass,
      students: students,
      created_at: new Date().toISOString(),
    };

    // Create temporary ID for optimistic update
    const tempId = `temp_${Date.now()}`;
    const tempClass: Class = {
      id: tempId,
      ...newClass,
      students: students,
      created_at: new Date().toISOString(),
      createdBy: user.id,
    };

    // Add to UI immediately (optimistic)
    setClasses([tempClass, ...classes]);
    setShowAddDialog(false);
    setNewClass({
      class_name: "",
      course_subject: "",
      section_block: "",
      room: "",
    });
    setStudents([]);
    setCurrentTab("basic");

    toast.success("Class added successfully");

    // Save to Firebase in background (don't wait for it)
    try {
      const newClassDoc = await createClass(classToAdd, user.id, user.instructorId);
      // Replace temp class with real one
      setClasses((prevClasses) =>
        prevClasses.map((c) => (c.id === tempId ? newClassDoc : c))
      );
    } catch (error) {
      console.error("Error saving class to Firebase:", error);
      // Remove temp class if save fails
      setClasses((prevClasses) => prevClasses.filter((c) => c.id !== tempId));
      toast.error("Failed to save class to database. Please try again.");
    }
  };

  const handleArchive = async () => {
    if (!archiveId) return;

    try {
      const classToArchive = classes.find(c => c.id === archiveId);
      if (!classToArchive) return;

      const updatedClass = { ...classToArchive, isArchived: true };
      await updateClass(archiveId, updatedClass);
      setClasses(classes.filter((c) => c.id !== archiveId));
      setArchiveId(null);
      toast.success("Class archived successfully");
    } catch (error) {
      console.error("Error archiving class:", error);
      toast.error("Failed to archive class");
    }
  };

  const handleEditClass = (classItem: Class) => {
    setEditingClass(classItem);
    setNewClass({
      class_name: classItem.class_name,
      course_subject: classItem.course_subject,
      section_block: classItem.section_block,
      room: classItem.room,
    });
    setStudents(classItem.students);
    setCurrentTab("basic");
    setShowEditDialog(true);
  };

  const handleUpdateClass = async () => {
    if (!editingClass) return;

    if (
      !newClass.class_name ||
      !newClass.course_subject ||
      !newClass.section_block
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Validate Class Name minimum length
    if (newClass.class_name.trim().length < 5) {
      toast.error("Class Name must be at least 5 characters long");
      return;
    }

    // Validate Course/Subject minimum length
    if (newClass.course_subject.trim().length < 5) {
      toast.error("Course/Subject must be at least 5 characters long");
      return;
    }

    try {
      setSaving(true);

      const updatedData = {
        class_name: newClass.class_name,
        course_subject: newClass.course_subject,
        section_block: newClass.section_block,
        room: newClass.room || "",
        students: students || [],
      };

      console.log(
        "Update data being sent:",
        JSON.stringify(updatedData, null, 2),
      );

      await updateClass(editingClass.id, updatedData);

      // Update local state
      setClasses(
        classes.map((c) =>
          c.id === editingClass.id
            ? { ...c, ...updatedData, updatedAt: new Date().toISOString() }
            : c,
        ),
      );

      setShowEditDialog(false);
      setEditingClass(null);
      setNewClass({
        class_name: "",
        course_subject: "",
        section_block: "",
        room: "",
      });
      setStudents([]);
      setCurrentTab("basic");

      toast.success("Class updated successfully");
    } catch (error) {
      console.error("Error updating class:", error);
      toast.error("Failed to update class");
    } finally {
      setSaving(false);
    }
  };

  const handleAddStudent = async () => {
    if (
      !newStudent.student_id ||
      !newStudent.first_name ||
      !newStudent.last_name
    ) {
      toast.error("Please fill in student ID, first name, and last name");
      return;
    }

    // Validate Student ID format and get formatted ID
    const validation = StudentIDValidationService.validateStudentIdFormat(newStudent.student_id);
    if (!validation.isValid) {
      toast.error(validation.error || "Invalid Student ID format");
      
      // Log invalid attempt
      if (user?.id) {
        await InvalidRecordLogger.logInvalidRecord(
          'grade',
          { student_id: newStudent.student_id, first_name: newStudent.first_name, last_name: newStudent.last_name },
          [{ field: 'student_id', message: validation.error || 'Invalid format', value: newStudent.student_id }],
          user.id,
          {
            entity_id: newStudent.student_id,
            user_email: user.email,
            metadata: { action: 'manual_add_student', context: 'class_management' }
          }
        );
      }
      return;
    }

    // Use the formatted student ID
    const formattedStudentId = validation.student_id;

    // Check for duplicate student ID using formatted ID
    if (students.some(s => s.student_id === formattedStudentId)) {
      toast.error(`Student ID "${formattedStudentId}" already exists in this class`);
      
      // Log duplicate attempt
      if (user?.id) {
        await InvalidRecordLogger.logInvalidRecord(
          'grade',
          { student_id: formattedStudentId, first_name: newStudent.first_name, last_name: newStudent.last_name },
          [{ field: 'student_id', message: 'Duplicate Student ID in class', value: formattedStudentId }],
          user.id,
          {
            entity_id: formattedStudentId,
            user_email: user.email,
            metadata: { action: 'manual_add_student', context: 'class_management', reason: 'duplicate' }
          }
        );
      }
      return;
    }

    // Check for duplicate student name (first name + last name combination)
    if (students.some(s => s.first_name === newStudent.first_name && s.last_name === newStudent.last_name)) {
      toast.error(`Student "${newStudent.first_name} ${newStudent.last_name}" already exists in this class`);
      
      // Log duplicate name attempt
      if (user?.id) {
        await InvalidRecordLogger.logInvalidRecord(
          'grade',
          { student_id: newStudent.student_id, first_name: newStudent.first_name, last_name: newStudent.last_name },
          [{ field: 'name', message: 'Duplicate student name in class', value: `${newStudent.first_name} ${newStudent.last_name}` }],
          user.id,
          {
            entity_id: newStudent.student_id,
            user_email: user.email,
            metadata: { action: 'manual_add_student', context: 'class_management', reason: 'duplicate_name' }
          }
        );
      }
      return;
    }

    const student: Student = {
      student_id: formattedStudentId, // Use formatted ID
      first_name: newStudent.first_name,
      last_name: newStudent.last_name,
      ...(newStudent.email && { email: newStudent.email }), // Only include email if it has a value
    };

    setStudents([...students, student]);
    setNewStudent({
      student_id: "",
      first_name: "",
      last_name: "",
      email: "",
    });
    toast.success(`Student added to roster (ID: ${formattedStudentId})`);
  };

  const handleRemoveStudent = (studentId: string) => {
    setStudents(students.filter((s) => s.student_id !== studentId));
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          // Skip header row and create raw student data
          const rawStudents = jsonData
            .slice(1) // Skip header
            .filter((row: any) => row.length >= 3) // Ensure basic validation
            .map((row: any) => ({
              student_id: String(row[0] || ""),
              first_name: String(row[1] || ""),
              last_name: String(row[2] || ""),
              email: row[3] ? String(row[3]) : undefined,
            }));

          if (rawStudents.length === 0) {
            toast.error("No valid students found in file");
            return;
          }

          // Validate all student IDs
          const validStudents: Student[] = [];
          const invalidStudents: Array<{student: Student, errors: string[]}> = [];

          for (const student of rawStudents) {
            const validation = StudentIDValidationService.validateStudentIdFormat(student.student_id);
            
            if (!validation.isValid) {
              invalidStudents.push({
                student,
                errors: [validation.error || 'Invalid Student ID format']
              });
              
              // Log invalid student ID
              if (user?.id) {
                await InvalidRecordLogger.logInvalidRecord(
                  'grade',
                  student,
                  [{ field: 'student_id', message: validation.error || 'Invalid format', value: student.student_id }],
                  user.id,
                  {
                    entity_id: student.student_id,
                    user_email: user.email,
                    metadata: { action: 'bulk_upload', context: 'class_management', file_name: file.name }
                  }
                );
              }
            } else {
              validStudents.push(student);
            }
          }

          // Check for duplicates against current class roster
          const existingIds = new Set(students.map((s) => s.student_id));
          const duplicates = validStudents.filter((s) => existingIds.has(s.student_id));
          const newStudents = validStudents.filter((s) => !existingIds.has(s.student_id));

          // Also check for duplicates within the file itself
          const seenIds = new Set<string>();
          const uniqueNewStudents: Student[] = [];
          for (const s of newStudents) {
            if (!seenIds.has(s.student_id)) {
              seenIds.add(s.student_id);
              uniqueNewStudents.push(s);
            }
          }

          // Create upload summary for Task 4.4
          const summary = {
            total: rawStudents.length,
            successful: uniqueNewStudents.length,
            failed: invalidStudents.length,
            duplicates: duplicates.length + (validStudents.length - newStudents.length),
            invalidEntries: invalidStudents
          };

          setUploadSummary(summary);

          // Show appropriate feedback
          if (uniqueNewStudents.length === 0) {
            if (invalidStudents.length > 0) {
              toast.error(`Upload failed: All ${rawStudents.length} entries are invalid. Click 'View Summary' to download invalid entries.`);
            } else {
              toast.warning(`All ${validStudents.length} student(s) already exist in this class. Nothing to import.`);
            }
            setShowUploadSummary(true);
            return;
          }

          // Success case with mixed results
          if (invalidStudents.length > 0 || duplicates.length > 0) {
            toast.info(`Upload completed with issues. ${uniqueNewStudents.length} will be imported. Click 'View Summary' for details.`);
            setShowUploadSummary(true);
          } else {
            toast.success(`Upload successful! ${uniqueNewStudents.length} new student(s) ready to import.`);
            setShowUploadSummary(true);
          }

          setImportPreview(uniqueNewStudents);
          setShowImportDialog(true);

          if (fileInputRef.current) {
            fileInputRef.current.value = ""; // Reset input
          }
        } catch (error) {
          console.error("Error parsing Excel:", error);
          toast.error("Failed to parse Excel file");
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error("Error reading file:", error);
      toast.error("Failed to read file");
    }
  };

  const downloadInvalidEntries = () => {
    if (!uploadSummary?.invalidEntries.length) {
      toast.error("No invalid entries to download");
      return;
    }

    const headers = [
      "Student ID",
      "First Name", 
      "Last Name",
      "Email",
      "Error Messages"
    ];
    
    const invalidData = uploadSummary.invalidEntries.map(entry => [
      entry.student.student_id,
      entry.student.first_name,
      entry.student.last_name,
      entry.student.email || "",
      entry.errors.join("; ")
    ]);

    const worksheetData = [headers, ...invalidData];
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);

    // Set column widths for better readability
    ws["!cols"] = [
      { wch: 15 }, // Student ID
      { wch: 15 }, // First Name
      { wch: 15 }, // Last Name
      { wch: 25 }, // Email
      { wch: 40 }, // Error Messages
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Invalid Entries");
    XLSX.writeFile(wb, `invalid_entries_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    toast.success(`Downloaded ${uploadSummary.invalidEntries.length} invalid entries`);
  };

  const confirmImport = () => {
    // Final duplicate check before adding
    const existingIds = new Set(students.map((s) => s.student_id));
    const newOnly = importPreview.filter((s) => !existingIds.has(s.student_id));

    if (newOnly.length === 0) {
      toast.warning('All students already exist in this class. Nothing to import.');
      setImportPreview([]);
      setShowImportDialog(false);
      return;
    }

    const skipped = importPreview.length - newOnly.length;
    setStudents((prev) => [...prev, ...newOnly]);
    setImportPreview([]);
    setShowImportDialog(false);

    if (skipped > 0) {
      toast.success(`Imported ${newOnly.length} students. ${skipped} duplicate(s) skipped.`);
    } else {
      toast.success(`Imported ${newOnly.length} students`);
    }

    // If we're not currently adding or editing a class, assume this is a new class creation
    // triggered from the main page upload button.
    if (!showAddDialog && !showEditDialog) {
      setShowAddDialog(true);
      setCurrentTab("students"); // Show the students tab immediately so user sees the import
    } else {
      // If we ARE in a dialog (e.g. user clicked "Import" inside the Add/Edit modal),
      // just switch to the students tab to show the update.
      setCurrentTab("students");
    }
  };

  const downloadTemplate = () => {
    const headers = [
      "Student ID",
      "First Name",
      "Last Name",
      "Email (Optional)",
    ];
    const sampleData = [
      headers,
      ["202400001", "Juan", "Dela Cruz", "juan.delacruz@email.com"],
      ["202400002", "Maria", "Santos", "maria.santos@email.com"],
      ["202400003", "Jose", "Rizal", ""],
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(sampleData);

    // Set column widths for better readability
    ws["!cols"] = [
      { wch: 15 }, // Student ID
      { wch: 15 }, // First Name
      { wch: 15 }, // Last Name
      { wch: 30 }, // Email
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, "student_import_template.xlsx");
    toast.success("Template downloaded! Fill it in and use Import Excel to upload.");
  };

  const filteredClasses = classes
    .filter((classItem) => !classItem.isArchived) // Only show non-archived classes
    .filter((c) =>
      c.class_name.toLowerCase().includes(search.toLowerCase()) ||
      c.course_subject.toLowerCase().includes(search.toLowerCase()) ||
      c.section_block.toLowerCase().includes(search.toLowerCase()),
    );

  return (
    <div className="page-container">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Class</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage student roster and information
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={downloadTemplate}
            variant="outline"
            className="gap-2 flex-shrink-0 border-primary/20 hover:bg-transparent hover:text-current"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Download Template</span>
            <span className="sm:hidden">Template</span>
          </Button>
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            className="gap-2 flex-shrink-0 border-primary/20 hover:bg-transparent hover:text-current"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Import Excel</span>
            <span className="sm:hidden">Import</span>
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button
            onClick={() => setShowAddDialog(true)}
            className="gradient-primary gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Class
          </Button>
        </div>
      </div>

      {/* Upload Summary Dialog */}
      {showUploadSummary && uploadSummary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Upload Summary</h3>
            
            <div className="space-y-3 mb-6">
              <div className="flex justify-between">
                <span>Total Records:</span>
                <span className="font-semibold">{uploadSummary.total}</span>
              </div>
              
              <div className="flex justify-between text-green-600">
                <span>Successfully Added:</span>
                <span className="font-semibold">{uploadSummary.successful}</span>
              </div>
              
              {uploadSummary.duplicates > 0 && (
                <div className="flex justify-between text-yellow-600">
                  <span>Duplicates Skipped:</span>
                  <span className="font-semibold">{uploadSummary.duplicates}</span>
                </div>
              )}
              
              {uploadSummary.failed > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Failed/Invalid:</span>
                  <span className="font-semibold">{uploadSummary.failed}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {uploadSummary.invalidEntries.length > 0 && (
                <Button 
                  onClick={downloadInvalidEntries}
                  variant="outline"
                  className="flex-1"
                >
                  Download Invalid Entries
                </Button>
              )}
              
              <Button 
                onClick={() => setShowUploadSummary(false)}
                className="flex-1"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      <Card className="card-elevated mb-6">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search students by name, ID, or course..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      ) : filteredClasses.length === 0 ? (
        <div className="text-center py-12">
          <GraduationCap className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            {search
              ? "No classes found matching your search"
              : "No classes yet"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredClasses.map((classItem) => (
            <Card
              key={classItem.id}
              className="card-elevated hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => {
                setSelectedClass(classItem);
                setShowViewDialog(true);
              }}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <GraduationCap className="w-6 h-6 text-yellow-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg text-foreground">
                        {classItem.class_name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {classItem.course_subject} &bull; {classItem.section_block}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-primary hover:text-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditClass(classItem);
                      }}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        <path d="m15 5 4 4" />
                      </svg>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        setArchiveId(classItem.id);
                      }}
                    >
                      <Archive className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Total Students
                    </p>
                    <p className="text-sm font-medium flex items-center gap-1">
                      <GraduationCap className="w-4 h-4 text-yellow-600" />
                      {classItem.students.length}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground mb-1">Created</p>
                    <p className="text-xs text-muted-foreground">
                      {classItem.created_at
                        ? new Date(classItem.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          }) + ' &bull; ' + new Date(classItem.created_at).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                          })
                        : '---'}
                    </p>
                  </div>
                </div>

              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Class Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => {
        if (!open) {
          handleCloseAddDialog();
        } else {
          setShowAddDialog(true);
        }
      }}>
        <DialogContent className="w-[95vw] max-w-3xl max-h-[90vh] overflow-y-auto border-2 border-green-200 rounded-xl">
          <DialogHeader className="bg-gradient-to-r from-green-50 to-emerald-50 -m-6 mb-6 p-6 rounded-t-xl border-b border-green-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Plus className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold text-green-900">Add New Class</DialogTitle>
                <DialogDescription className="text-green-700 text-base">
                  Create a new class and add students to the roster
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <Tabs
            value={currentTab}
            onValueChange={setCurrentTab}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2 bg-green-100 border border-green-200">
              <TabsTrigger 
                value="basic" 
                className="data-[state=active]:bg-green-600 data-[state=active]:text-white font-medium"
              >
                Class Information
              </TabsTrigger>
              <TabsTrigger 
                value="students" 
                className="data-[state=active]:bg-green-600 data-[state=active]:text-white font-medium"
              >
                Student Roster
              </TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-6 mt-6 p-3 sm:p-6 bg-gradient-to-br from-green-50/50 to-emerald-50/50 rounded-lg border border-green-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div className="space-y-3">
                  <Label htmlFor="class_name" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    Class Name <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="class_name"
                      value={newClass.class_name}
                      onChange={(e) => {
                        const value = e.target.value;
                        setNewClass({ ...newClass, class_name: value });
                        
                        // Show warning if length exceeds 0 but is less than 5
                        if (value.trim().length > 0 && value.trim().length < 5) {
                          setClassNameWarning(true);
                          setTimeout(() => setClassNameWarning(false), 2000);
                        } else {
                          setClassNameWarning(false);
                        }
                      }}
                      placeholder="Enter class name"
                      className={`transition-all duration-200 border-2 rounded-lg px-4 py-3 ${
                        newClass.class_name.trim() && newClass.class_name.trim().length >= 5
                          ? 'border-green-400 focus:border-green-500 focus:ring-4 focus:ring-green-100 bg-green-50/30' 
                          : newClass.class_name.trim() && newClass.class_name.trim().length < 5
                          ? 'border-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-100 bg-red-50/30'
                          : 'border-gray-200 focus:border-green-400 focus:ring-4 focus:ring-green-100'
                      }`}
                    />
                    {newClass.class_name.trim() && newClass.class_name.trim().length >= 5 && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs font-bold">&#x2713;</span>
                        </div>
                      </div>
                    )}
                  </div>
                  {newClass.class_name.trim() && newClass.class_name.trim().length >= 5 && (
                    <div className="flex items-center gap-2 text-xs text-green-600">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span>Valid class name</span>
                    </div>
                  )}
                  {newClass.class_name.trim() && newClass.class_name.trim().length < 5 && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <div className="w-2 h-2 bg-gray-400 rounded-full" />
                      <span>{newClass.class_name.trim().length}/5 characters minimum</span>
                    </div>
                  )}
                  {classNameWarning && (
                    <div className="flex items-center gap-2 text-xs text-red-600 animate-fade-in">
                      <AlertCircle className="w-3 h-3" />
                      <span>Class Name must be at least 5 characters long</span>
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  <Label htmlFor="course_subject" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    Course/Subject <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="course_subject"
                      value={newClass.course_subject}
                      onChange={(e) => {
                        const value = e.target.value;
                        setNewClass({
                          ...newClass,
                          course_subject: value,
                        });
                        
                        // Show warning if length exceeds 0 but is less than 5
                        if (value.trim().length > 0 && value.trim().length < 5) {
                          setCourseSubjectWarning(true);
                          setTimeout(() => setCourseSubjectWarning(false), 2000);
                        } else {
                          setCourseSubjectWarning(false);
                        }
                      }}
                      placeholder="Enter course subject"
                      className={`transition-all duration-200 border-2 rounded-lg px-4 py-3 ${
                        newClass.course_subject.trim() && newClass.course_subject.trim().length >= 5
                          ? 'border-green-400 focus:border-green-500 focus:ring-4 focus:ring-green-100 bg-green-50/30' 
                          : newClass.course_subject.trim() && newClass.course_subject.trim().length < 5
                          ? 'border-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-100 bg-red-50/30'
                          : 'border-gray-200 focus:border-green-400 focus:ring-4 focus:ring-green-100'
                      }`}
                    />
                    {newClass.course_subject.trim() && newClass.course_subject.trim().length >= 5 && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs font-bold">&#x2713;</span>
                        </div>
                      </div>
                    )}
                  </div>
                  {newClass.course_subject.trim() && newClass.course_subject.trim().length >= 5 && (
                    <div className="flex items-center gap-2 text-xs text-green-600">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span>Valid course subject</span>
                    </div>
                  )}
                  {newClass.course_subject.trim() && newClass.course_subject.trim().length < 5 && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <div className="w-2 h-2 bg-gray-400 rounded-full" />
                      <span>{newClass.course_subject.trim().length}/5 characters minimum</span>
                    </div>
                  )}
                  {courseSubjectWarning && (
                    <div className="flex items-center gap-2 text-xs text-red-600 animate-fade-in">
                      <AlertCircle className="w-3 h-3" />
                      <span>Course/Subject must be at least 5 characters long</span>
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  <Label htmlFor="section_block" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    Block <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <select
                      id="section_block"
                      value={newClass.section_block}
                      onChange={(e) =>
                        setNewClass({
                          ...newClass,
                          section_block: e.target.value,
                        })
                      }
                      className={`w-full transition-all duration-200 border-2 rounded-lg px-4 py-3 bg-background focus:outline-none focus:ring-4 ${
                        newClass.section_block.trim() 
                          ? 'border-green-400 focus:border-green-500 focus:ring-green-100 bg-green-50/30' 
                          : 'border-gray-200 focus:border-green-400 focus:ring-green-100'
                      }`}
                    >
                      <option value="">Select a block...</option>
                      {Array.from({ length: 26 }, (_, i) =>
                        String.fromCharCode(65 + i)
                      ).map((letter) => (
                        <option key={letter} value={letter}>
                          {letter}
                        </option>
                      ))}
                    </select>
                    {newClass.section_block.trim() && (
                      <div className="absolute right-8 top-1/2 transform -translate-y-1/2">
                        <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs font-bold">&#x2713;</span>
                        </div>
                      </div>
                    )}
                  </div>
                  {newClass.section_block.trim() && (
                    <div className="flex items-center gap-2 text-xs text-green-600">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span>Block selected</span>
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  <Label htmlFor="room" className="text-sm font-semibold text-gray-700">
                    Room <span className="text-gray-400 text-xs">(Optional)</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="room"
                      type="number"
                      value={newClass.room}
                      onChange={(e) => {
                        // Only allow exactly 3 numbers
                        const inputValue = e.target.value.replace(/[^0-9]/g, '');
                        if (inputValue.length > 3) {
                          setRoomWarning(true);
                          setTimeout(() => setRoomWarning(false), 3000);
                          return;
                        }
                        const value = inputValue.slice(0, 3);
                        setNewClass({ ...newClass, room: value });
                      }}
                      placeholder="Enter room number (exactly 3 digits)"
                      className="transition-all duration-200 border-2 border-gray-200 focus:border-green-400 focus:ring-4 focus:ring-green-100 rounded-lg px-4 py-3"
                    />
                    {newClass.room.trim() && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs font-bold">&#x2713;</span>
                        </div>
                      </div>
                    )}
                  </div>
                  {newClass.room.trim() && (
                    <div className="flex items-center gap-2 text-xs text-green-600">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span>Room specified</span>
                    </div>
                  )}
                  {roomWarning && (
                    <div className="flex items-center gap-2 text-xs text-red-600 animate-pulse">
                      <div className="w-2 h-2 bg-red-500 rounded-full" />
                      <span>Room number must be exactly 3 digits only</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Progress Indicator */}
              <div className="bg-white border-2 border-green-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-green-700">Form Progress:</span>
                  <span className="text-sm font-semibold text-green-600">
                    {[newClass.class_name.trim(), newClass.course_subject.trim(), newClass.section_block.trim()].filter(Boolean).length}/3 Required
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full transition-all duration-500"
                    style={{ 
                      width: `${[newClass.class_name.trim(), newClass.course_subject.trim(), newClass.section_block.trim()].filter(Boolean).length * 33.33}%` 
                    }}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="students" className="space-y-4 mt-4">
              <div className="flex flex-col sm:flex-row gap-2 mb-4">
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                  className="w-full sm:w-auto"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {importing ? "Importing..." : "Import CSV/Excel"}
                </Button>
                <Button variant="outline" onClick={downloadTemplate} className="w-full sm:w-auto">
                  <Download className="w-4 h-4 mr-2" />
                  Download Template
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6 space-y-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <Plus className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-green-900">Add Student Manually</h4>
                    <p className="text-sm text-green-700">Enter student information below</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground flex items-center gap-2">
                      Student ID 
                      <span className="text-destructive">*</span>
                    </label>
                    <Input
                      placeholder="Enter student ID"
                      value={newStudent.student_id}
                      onChange={(e) =>
                        setNewStudent({
                          ...newStudent,
                          student_id: e.target.value,
                        })
                      }
                      className={`transition-all duration-200 ${
                        newStudent.student_id.trim() 
                          ? 'border-green-500 focus:border-green-500 focus:ring-green-200' 
                          : 'focus:border-primary focus:ring-primary/20'
                      }`}
                    />
                    {newStudent.student_id.trim() && (
                      <div className="flex items-center gap-1 text-xs text-green-600">
                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                        Valid student ID
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground flex items-center gap-2">
                      First Name 
                      <span className="text-destructive">*</span>
                    </label>
                    <Input
                      placeholder="Enter first name"
                      value={newStudent.first_name}
                      onChange={(e) =>
                        setNewStudent({
                          ...newStudent,
                          first_name: e.target.value,
                        })
                      }
                      className={`transition-all duration-200 ${
                        newStudent.first_name.trim() 
                          ? 'border-green-500 focus:border-green-500 focus:ring-green-200' 
                          : 'focus:border-primary focus:ring-primary/20'
                      }`}
                    />
                    {newStudent.first_name.trim() && (
                      <div className="flex items-center gap-1 text-xs text-green-600">
                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                        Valid first name
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground flex items-center gap-2">
                      Last Name 
                      <span className="text-destructive">*</span>
                    </label>
                    <Input
                      placeholder="Enter last name"
                      value={newStudent.last_name}
                      onChange={(e) =>
                        setNewStudent({
                          ...newStudent,
                          last_name: e.target.value,
                        })
                      }
                      className={`transition-all duration-200 ${
                        newStudent.last_name.trim() 
                          ? 'border-green-500 focus:border-green-500 focus:ring-green-200' 
                          : 'focus:border-primary focus:ring-primary/20'
                      }`}
                    />
                    {newStudent.last_name.trim() && (
                      <div className="flex items-center gap-1 text-xs text-green-600">
                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                        Valid last name
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">
                      Email 
                      <span className="text-muted-foreground text-xs">(Optional)</span>
                    </label>
                    <Input
                      placeholder="Enter email address"
                      type="email"
                      value={newStudent.email}
                      onChange={(e) =>
                        setNewStudent({ ...newStudent, email: e.target.value })
                      }
                      className="focus:border-primary focus:ring-primary/20 transition-all duration-200"
                    />
                    {newStudent.email.trim() && (
                      <div className="flex items-center gap-1 text-xs text-green-600">
                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                        Email provided
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-2 border-t border-green-200">
                  <div className="text-sm text-green-700">
                    <span className="font-medium">
                      {newStudent.student_id.trim() && newStudent.first_name.trim() && newStudent.last_name.trim() 
                        ? 'Ready to add' 
                        : 'Fill required fields'}
                    </span>
                  </div>
                  <Button 
                    onClick={handleAddStudent} 
                    disabled={!newStudent.student_id.trim() || !newStudent.first_name.trim() || !newStudent.last_name.trim()}
                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 min-w-[120px]"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Student
                  </Button>
                </div>
              </div>

              {students.length > 0 && (
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[100px]">Student ID</TableHead>
                        <TableHead className="min-w-[120px]">Name</TableHead>
                        <TableHead className="hidden sm:table-cell min-w-[150px]">Email</TableHead>
                        <TableHead className="text-right min-w-[80px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.map((student, idx) => (
                        <TableRow key={`add-class-${idx}`}>
                          <TableCell className="min-w-[100px]">{student.student_id}</TableCell>
                          <TableCell className="min-w-[120px]">{`${student.first_name} ${student.last_name}`}</TableCell>
                          <TableCell className="hidden sm:table-cell min-w-[150px]">{student.email || "---"}</TableCell>
                          <TableCell className="text-right min-w-[80px]">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleRemoveStudent(student.student_id)
                              }
                            >
                              <X className="w-4 h-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {students.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                  <p>No students added yet</p>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCloseAddDialog}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddClass}
              className="gradient-primary"
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Add Class"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Class Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="w-[95vw] max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Class</DialogTitle>
            <DialogDescription>
              Update class information and student roster
            </DialogDescription>
          </DialogHeader>

          <Tabs
            value={currentTab}
            onValueChange={setCurrentTab}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="basic">Class Information</TabsTrigger>
              <TabsTrigger value="students">Student Roster</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_class_name">Class Name *</Label>
                  <Input
                    id="edit_class_name"
                    value={newClass.class_name}
                    onChange={(e) =>
                      setNewClass({ ...newClass, class_name: e.target.value })
                    }
                    placeholder="e.g., Computer Science 101"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_course_subject">Course/Subject *</Label>
                  <Input
                    id="edit_course_subject"
                    value={newClass.course_subject}
                    onChange={(e) =>
                      setNewClass({
                        ...newClass,
                        course_subject: e.target.value,
                      })
                    }
                    placeholder="e.g., Introduction to Programming"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_section_block">Block *</Label>
                  <select
                    id="edit_section_block"
                    value={newClass.section_block}
                    onChange={(e) =>
                      setNewClass({
                        ...newClass,
                        section_block: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Select a block...</option>
                    {Array.from({ length: 26 }, (_, i) =>
                      String.fromCharCode(65 + i)
                    ).map((letter) => (
                      <option key={letter} value={letter}>
                        {letter}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_room">Room</Label>
                  <Input
                    id="edit_room"
                    type="number"
                    value={newClass.room}
                    onChange={(e) => {
                      // Only allow exactly 3 numbers
                      const inputValue = e.target.value.replace(/[^0-9]/g, '');
                      if (inputValue.length > 3) {
                        setRoomWarning(true);
                        setTimeout(() => setRoomWarning(false), 3000);
                        return;
                      }
                      const value = inputValue.slice(0, 3);
                      setNewClass({ ...newClass, room: value });
                    }}
                    placeholder="e.g., 101 (exactly 3 digits)"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="students" className="space-y-4 mt-4">
              <div className="flex flex-col sm:flex-row gap-2 mb-4">
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                  className="w-full sm:w-auto"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {importing ? "Importing..." : "Import CSV/Excel"}
                </Button>
                <Button variant="outline" onClick={downloadTemplate} className="w-full sm:w-auto">
                  <Download className="w-4 h-4 mr-2" />
                  Download Template
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6 space-y-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <Plus className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-green-900">Add Student Manually</h4>
                    <p className="text-sm text-green-700">Add new students to this class</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground flex items-center gap-2">
                      Student ID 
                      <span className="text-destructive">*</span>
                    </label>
                    <Input
                      placeholder="Enter student ID"
                      value={newStudent.student_id}
                      onChange={(e) =>
                        setNewStudent({
                          ...newStudent,
                          student_id: e.target.value,
                        })
                      }
                      className={`transition-all duration-200 ${
                        newStudent.student_id.trim() 
                          ? 'border-green-500 focus:border-green-500 focus:ring-green-200' 
                          : 'focus:border-primary focus:ring-primary/20'
                      }`}
                    />
                    {newStudent.student_id.trim() && (
                      <div className="flex items-center gap-1 text-xs text-green-600">
                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                        Valid student ID
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground flex items-center gap-2">
                      First Name 
                      <span className="text-destructive">*</span>
                    </label>
                    <Input
                      placeholder="Enter first name"
                      value={newStudent.first_name}
                      onChange={(e) =>
                        setNewStudent({
                          ...newStudent,
                          first_name: e.target.value,
                        })
                      }
                      className={`transition-all duration-200 ${
                        newStudent.first_name.trim() 
                          ? 'border-green-500 focus:border-green-500 focus:ring-green-200' 
                          : 'focus:border-primary focus:ring-primary/20'
                      }`}
                    />
                    {newStudent.first_name.trim() && (
                      <div className="flex items-center gap-1 text-xs text-green-600">
                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                        Valid first name
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground flex items-center gap-2">
                      Last Name 
                      <span className="text-destructive">*</span>
                    </label>
                    <Input
                      placeholder="Enter last name"
                      value={newStudent.last_name}
                      onChange={(e) =>
                        setNewStudent({
                          ...newStudent,
                          last_name: e.target.value,
                        })
                      }
                      className={`transition-all duration-200 ${
                        newStudent.last_name.trim() 
                          ? 'border-green-500 focus:border-green-500 focus:ring-green-200' 
                          : 'focus:border-primary focus:ring-primary/20'
                      }`}
                    />
                    {newStudent.last_name.trim() && (
                      <div className="flex items-center gap-1 text-xs text-green-600">
                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                        Valid last name
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">
                      Email 
                      <span className="text-muted-foreground text-xs">(Optional)</span>
                    </label>
                    <Input
                      placeholder="Enter email address"
                      type="email"
                      value={newStudent.email}
                      onChange={(e) =>
                        setNewStudent({ ...newStudent, email: e.target.value })
                      }
                      className="focus:border-primary focus:ring-primary/20 transition-all duration-200"
                    />
                    {newStudent.email.trim() && (
                      <div className="flex items-center gap-1 text-xs text-blue-600">
                        <div className="w-2 h-2 bg-blue-500 rounded-full" />
                        Email provided
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-2 border-t border-green-200">
                  <div className="text-sm text-green-700">
                    <span className="font-medium">
                      {newStudent.student_id.trim() && newStudent.first_name.trim() && newStudent.last_name.trim() 
                        ? 'Ready to add' 
                        : 'Fill required fields'}
                    </span>
                  </div>
                  <Button 
                    onClick={handleAddStudent} 
                    disabled={!newStudent.student_id.trim() || !newStudent.first_name.trim() || !newStudent.last_name.trim()}
                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 min-w-[120px]"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Student
                  </Button>
                </div>
              </div>

              {students.length > 0 && (
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[100px]">Student ID</TableHead>
                        <TableHead className="min-w-[120px]">Name</TableHead>
                        <TableHead className="hidden sm:table-cell min-w-[150px]">Email</TableHead>
                        <TableHead className="text-right min-w-[80px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.map((student, idx) => (
                        <TableRow key={`edit-class-${idx}`}>
                          <TableCell className="min-w-[100px]">{student.student_id}</TableCell>
                          <TableCell className="min-w-[120px]">{`${student.first_name} ${student.last_name}`}</TableCell>
                          <TableCell className="hidden sm:table-cell min-w-[150px]">{student.email || "---"}</TableCell>
                          <TableCell className="text-right min-w-[80px]">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleRemoveStudent(student.student_id)
                              }
                            >
                              <X className="w-4 h-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {students.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                  <p>No students added yet</p>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowEditDialog(false);
                setEditingClass(null);
                setNewClass({
                  class_name: "",
                  course_subject: "",
                  section_block: "",
                  room: "",
                });
                setStudents([]);
                setCurrentTab("basic");
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateClass}
              className="gradient-primary"
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Class"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Class Roster Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Class Roster</DialogTitle>
            <DialogDescription>
              Upload an Excel file (.xls, .xlsx) containing student information
              to create a new class or update an existing one.
            </DialogDescription>
          </DialogHeader>

          {importPreview.length > 0 ? (
            <>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-10 h-10 bg-yellow-100 rounded flex items-center justify-center">
                    <Upload className="w-5 h-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">students.xlsx</p>
                    <p className="text-xs text-muted-foreground">164 KB</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    onClick={() => {
                      setImportPreview([]);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">
                    Total Rows
                  </p>
                  <p className="text-2xl font-bold text-green-600">
                    {importPreview.length}
                  </p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">
                    Valid Students
                  </p>
                  <p className="text-2xl font-bold text-green-600">
                    {importPreview.length}
                  </p>
                </div>
              </div>

              <div className="mb-4">
                <h4 className="font-medium mb-2 text-sm">
                  Detected Student Information Fields
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                      <svg
                        className="w-3 h-3 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                    <span>Student Name</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                      <svg
                        className="w-3 h-3 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                    <span>Student ID</span>
                  </div>
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importPreview.map((student, idx) => (
                      <TableRow key={`cm-import-${idx}`}>
                        <TableCell>{student.student_id}</TableCell>
                        <TableCell>{`${student.first_name} ${student.last_name}`}</TableCell>
                        <TableCell>{student.email || "---"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
              <div className="w-16 h-16 bg-yellow-100 rounded-lg mx-auto mb-4 flex items-center justify-center">
                <Upload className="w-8 h-8 text-yellow-600" />
              </div>
              <p className="font-medium mb-2">
                Click to upload or drag and drop
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                Excel files only (.xls, .xlsx)
              </p>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                Browse Files
              </Button>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowImportDialog(false);
                setImportPreview([]);
              }}
            >
              Cancel
            </Button>
            {importPreview.length > 0 && (
              <Button onClick={confirmImport} className="gradient-primary">
                Confirm Import
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Class Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="w-[95vw] max-w-6xl max-h-[90vh] overflow-hidden flex flex-col p-3 sm:p-6">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-lg sm:text-xl">{selectedClass?.class_name}</DialogTitle>
            <DialogDescription className="text-sm">
              {selectedClass?.course_subject} - Block{" "}
              {selectedClass?.section_block}
            </DialogDescription>
          </DialogHeader>
          {selectedClass && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Room</p>
                  <p className="font-medium">{selectedClass.room || "---"}</p>
                </div>
              </div>

              <div>
                <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
                  <h4 className="font-medium text-sm sm:text-base">
                    Students ({selectedClass.students.length})
                  </h4>
                </div>
                {selectedClass.students.length > 0 ? (
                <div className="space-y-4">
                    {/* Mobile Card Layout */}
                    <div className="block sm:hidden space-y-3">
                      {selectedClass.students.map((student, idx) => (
                        <div key={`${selectedClass.id}-mobile-${idx}`} className="bg-card border rounded-lg p-3">
                          <div className="flex-1 min-w-0">
                            <div className="font-mono text-sm font-medium">{student.student_id}</div>
                            <div className="text-sm font-medium truncate">{`${student.first_name} ${student.last_name}`}</div>
                            <div className="text-xs text-muted-foreground truncate">{student.email || "No email"}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop Table Layout */}
                    <div className="hidden sm:block">
                      <div className="border rounded-lg overflow-hidden">
                        <div className="max-h-[40vh] sm:max-h-[50vh] overflow-y-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="min-w-[70px] sm:min-w-[80px] text-xs sm:text-sm px-1 sm:px-3 w-[100px]">ID</TableHead>
                                <TableHead className="min-w-[80px] sm:min-w-[100px] text-xs sm:text-sm px-1 sm:px-3 w-[120px]">Name</TableHead>
                                <TableHead className="min-w-[100px] text-xs sm:text-sm px-1 sm:px-3">Email</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {selectedClass.students.map((student, idx) => (
                                <TableRow key={`${selectedClass.id}-view-${idx}`} className="hover:bg-muted/50">
                                  <TableCell className="font-mono text-xs sm:text-sm p-1 sm:p-2 w-[100px] max-w-[100px]">
                                    <div className="truncate">{student.student_id}</div>
                                  </TableCell>
                                  <TableCell className="text-xs sm:text-sm p-1 sm:p-2 w-[120px] max-w-[120px]">
                                    <div className="truncate font-medium text-xs sm:text-sm">{`${student.first_name} ${student.last_name}`}</div>
                                  </TableCell>
                                  <TableCell className="text-xs sm:text-sm p-1 sm:p-2">{student.email || "---"}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">
                    No students enrolled
                  </p>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="mt-4 pt-4 border-t flex-shrink-0">
            <Button 
              onClick={() => setShowViewDialog(false)}
              className="w-full sm:w-auto"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={!!archiveId} onOpenChange={() => setArchiveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Class?</AlertDialogTitle>
            <AlertDialogDescription>
              This will move the class to the archive. You can restore it later from the Archive page if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
