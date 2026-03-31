"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  FolderArchive,
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
import { AuditLogger } from "@/services/auditLogger";

export default function ClassManagement() {
  const { user } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [importing, setImporting] = useState(false);
  const [, setSelectedFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<Student[]>([]);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [roomWarning, setRoomWarning] = useState(false);
  const [uploadSummary, setUploadSummary] = useState<{
    total: number;
    successful: number;
    failed: number;
    duplicates: number;
    invalidEntries: Array<{ student: Student; errors: string[] }>;
  } | null>(null);
  const [showUploadSummary, setShowUploadSummary] = useState(false);
  const [archiveId, setArchiveId] = useState<string | null>(null);

  const [newClass, setNewClass] = useState({
    class_name: "",
    course_subject: "",
    year: "",
    room: "",
  });

  const [students, setStudents] = useState<Student[]>([]);
  const [currentTab, setCurrentTab] = useState("basic");
  const [editingClass] = useState<Class | null>(null);
  const [newStudent, setNewStudent] = useState({
    student_id: "",
    first_name: "",
    last_name: "",
    email: "",
  });

  const fetchClasses = useCallback(async () => {
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
  }, [user?.id]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  const handleCloseAddDialog = () => {
    setShowAddDialog(false);
    // Reset form data when closing dialog
    setNewClass({
      class_name: "",
      course_subject: "",
      year: "",
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
    if (!newClass.class_name || !newClass.course_subject) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Validate Class Name minimum length
    if (newClass.class_name.trim().length < 3) {
      toast.error("Class Name must be at least 3 characters long");
      return;
    }

    // Validate Course/Subject minimum length
    if (newClass.course_subject.trim().length < 4) {
      toast.error("Course/Subject must be at least 4 characters long");
      return;
    }

    // Validate Year is selected
    if (!newClass.year || newClass.year.trim() === "") {
      toast.error("Year level is required");
      return;
    }

    // Validate that class has students
    if (students.length === 0) {
      toast.error(
        "Cannot create a class without students. Please add at least one student.",
      );
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
      year: "",
      room: "",
    });
    setStudents([]);
    setCurrentTab("basic");

    toast.success("Class added successfully");

    // Save to Firebase in background (don't wait for it)
    try {
      const newClassDoc = await createClass(
        classToAdd,
        user.id,
        user.instructorId,
      );
      // Replace temp class with real one
      setClasses((prevClasses) =>
        prevClasses.map((c) => (c.id === tempId ? newClassDoc : c)),
      );

      // Log class creation
      await AuditLogger.logActivity(
        user.id,
        user.email || "unknown",
        "class_created",
        `Created class: ${classToAdd.class_name}`,
        {
          entityId: newClassDoc.id,
          entityType: "class",
          entityName: classToAdd.class_name,
        },
      );
    } catch (error) {
      console.error("Error saving class to Firebase:", error);
      // Remove temp class if save fails
      setClasses((prevClasses) => prevClasses.filter((c) => c.id !== tempId));
      toast.error("Failed to save class to database. Please try again.");

      // Log failure
      AuditLogger.logActivity(
        user.id,
        user.email || "unknown",
        "class_created",
        `Failed to create class: ${classToAdd.class_name}`,
        {
          status: "failed",
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      );
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
    const validation = StudentIDValidationService.validateStudentIdFormat(
      newStudent.student_id,
    );
    if (!validation.isValid) {
      toast.error(validation.error || "Invalid Student ID format");

      // Log invalid attempt
      if (user?.id) {
        await InvalidRecordLogger.logInvalidRecord(
          "grade",
          {
            student_id: newStudent.student_id,
            first_name: newStudent.first_name,
            last_name: newStudent.last_name,
          },
          [
            {
              field: "student_id",
              message: validation.error || "Invalid format",
              value: newStudent.student_id,
            },
          ],
          user.id,
          {
            entity_id: newStudent.student_id,
            user_email: user.email,
            metadata: {
              action: "manual_add_student",
              context: "class_management",
            },
          },
        );
      }
      return;
    }

    // Use the formatted student ID
    const formattedStudentId = validation.student_id;

    // Check for duplicate student ID using formatted ID
    if (students.some((s) => s.student_id === formattedStudentId)) {
      toast.error(
        `Student ID "${formattedStudentId}" already exists in this class`,
      );

      // Log duplicate attempt
      if (user?.id) {
        await InvalidRecordLogger.logInvalidRecord(
          "grade",
          {
            student_id: formattedStudentId,
            first_name: newStudent.first_name,
            last_name: newStudent.last_name,
          },
          [
            {
              field: "student_id",
              message: "Duplicate Student ID in class",
              value: formattedStudentId,
            },
          ],
          user.id,
          {
            entity_id: formattedStudentId,
            user_email: user.email,
            metadata: {
              action: "manual_add_student",
              context: "class_management",
              reason: "duplicate",
            },
          },
        );
      }
      return;
    }

    // Check for duplicate student name (first name + last name combination) - Case Insensitive
    if (
      students.some(
        (s) =>
          s.first_name.trim().toLowerCase() ===
            newStudent.first_name.trim().toLowerCase() &&
          s.last_name.trim().toLowerCase() ===
            newStudent.last_name.trim().toLowerCase(),
      )
    ) {
      toast.error(
        `Student "${newStudent.first_name} ${newStudent.last_name}" already exists in this class`,
      );

      // Log duplicate name attempt
      if (user?.id) {
        await InvalidRecordLogger.logInvalidRecord(
          "grade",
          {
            student_id: newStudent.student_id,
            first_name: newStudent.first_name,
            last_name: newStudent.last_name,
          },
          [
            {
              field: "name",
              message: "Duplicate student name in class",
              value: `${newStudent.first_name} ${newStudent.last_name}`,
            },
          ],
          user.id,
          {
            entity_id: newStudent.student_id,
            user_email: user.email,
            metadata: {
              action: "manual_add_student",
              context: "class_management",
              reason: "duplicate_name",
            },
          },
        );
      }
      return;
    }

    // Check for duplicate email (if provided)
    if (newStudent.email && newStudent.email.trim()) {
      const normalizedEmail = newStudent.email.trim().toLowerCase();
      if (
        students.some((s) => s.email?.trim().toLowerCase() === normalizedEmail)
      ) {
        toast.error(
          `Email "${newStudent.email}" is already used by another student in this class`,
        );

        // Log duplicate email attempt
        if (user?.id) {
          await InvalidRecordLogger.logInvalidRecord(
            "grade",
            {
              student_id: newStudent.student_id,
              first_name: newStudent.first_name,
              last_name: newStudent.last_name,
              email: newStudent.email,
            },
            [
              {
                field: "email",
                message: "Duplicate email in class",
                value: newStudent.email,
              },
            ],
            user.id,
            {
              entity_id: newStudent.student_id,
              user_email: user.email,
              metadata: {
                action: "manual_add_student",
                context: "class_management",
                reason: "duplicate_email",
              },
            },
          );
        }
        return;
      }
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

  const handleArchive = async (classId?: string) => {
    const idToArchive = classId || archiveId;
    if (!idToArchive) return;

    try {
      // Update the class to mark as archived
      const classToArchive = classes.find((c) => c.id === idToArchive);
      if (classToArchive) {
        const updatedClass = { ...classToArchive, isArchived: true };
        await updateClass(idToArchive, updatedClass);

        // Remove from current list
        setClasses(classes.filter((c) => c.id !== idToArchive));
        toast.success("Class archived successfully");
      }
    } catch (error) {
      console.error("Error archiving class:", error);
      toast.error("Failed to archive class");
    } finally {
      setArchiveId(null);
    }
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setImporting(true);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          // Preserve empty cells so we can detect blanks correctly.
          const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            defval: "",
            blankrows: false,
          }) as any[];

          // Skip header row and create raw student data
          const rawStudents = (jsonData as any[])
            .slice(1) // Skip header
            .filter((row: any) => row && row.length >= 3) // Ensure expected columns exist
            .map((row: any) => ({
              student_id: String(row?.[0] ?? "").trim(),
              first_name: String(row?.[1] ?? "").trim(),
              last_name: String(row?.[2] ?? "").trim(),
              email: String(row?.[3] ?? "").trim(),
            }));

          if (rawStudents.length === 0) {
            toast.error("No valid students found in file");
            return;
          }

          // Validate all required fields + student IDs
          const validStudents: Student[] = [];
          const invalidStudents: Array<{ student: Student; errors: string[] }> =
            [];

          for (const student of rawStudents) {
            const requiredErrors: string[] = [];
            if (!student.student_id)
              requiredErrors.push("Student ID is required");
            if (!student.first_name)
              requiredErrors.push("First Name is required");
            if (!student.last_name)
              requiredErrors.push("Last Name is required");

            if (requiredErrors.length > 0) {
              invalidStudents.push({
                // Ensure we never store `undefined` in state
                student: {
                  student_id: student.student_id,
                  first_name: student.first_name,
                  last_name: student.last_name,
                  ...(student.email ? { email: student.email } : {}),
                },
                errors: requiredErrors,
              });
              continue;
            }

            const validation =
              StudentIDValidationService.validateStudentIdFormat(
                student.student_id,
              );

            if (!validation.isValid) {
              invalidStudents.push({
                student: {
                  student_id: student.student_id,
                  first_name: student.first_name,
                  last_name: student.last_name,
                  ...(student.email ? { email: student.email } : {}),
                },
                errors: [validation.error || "Invalid Student ID format"],
              });

              // Log invalid student ID
              if (user?.id) {
                await InvalidRecordLogger.logInvalidRecord(
                  "grade",
                  student,
                  [
                    {
                      field: "student_id",
                      message: validation.error || "Invalid format",
                      value: student.student_id,
                    },
                  ],
                  user.id,
                  {
                    entity_id: student.student_id,
                    user_email: user.email,
                    metadata: {
                      action: "bulk_upload",
                      context: "class_management",
                      file_name: file.name,
                    },
                  },
                );
              }
            } else {
              validStudents.push({
                student_id: student.student_id,
                first_name: student.first_name,
                last_name: student.last_name,
                ...(student.email ? { email: student.email } : {}),
              });
            }
          }

          // Check for duplicates against current class roster (ID, Name, or Email)
          const existingIds = new Set(students.map((s) => s.student_id));
          const existingNames = new Set(
            students.map(
              (s) =>
                `${s.first_name.trim().toLowerCase()}|${s.last_name.trim().toLowerCase()}`,
            ),
          );
          const existingEmails = new Set(
            students
              .filter((s) => s.email)
              .map((s) => s.email!.trim().toLowerCase()),
          );

          const duplicates: Student[] = [];
          const newStudents: Student[] = [];

          for (const s of validStudents) {
            const idMatch = existingIds.has(s.student_id);
            const nameMatch = existingNames.has(
              `${s.first_name.trim().toLowerCase()}|${s.last_name.trim().toLowerCase()}`,
            );
            const emailMatch =
              s.email && existingEmails.has(s.email.trim().toLowerCase());

            if (idMatch || nameMatch || emailMatch) {
              duplicates.push(s);
            } else {
              newStudents.push(s);
            }
          }

          // Also check for duplicates within the file itself
          const seenIds = new Set<string>();
          const seenNames = new Set<string>();
          const seenEmails = new Set<string>();
          const uniqueNewStudents: Student[] = [];

          for (const s of newStudents) {
            const sNameKey = `${s.first_name.trim().toLowerCase()}|${s.last_name.trim().toLowerCase()}`;
            const sEmailKey = s.email?.trim().toLowerCase();

            const isDuplicateInFile =
              seenIds.has(s.student_id) ||
              seenNames.has(sNameKey) ||
              (sEmailKey && seenEmails.has(sEmailKey));

            if (!isDuplicateInFile) {
              seenIds.add(s.student_id);
              seenNames.add(sNameKey);
              if (sEmailKey) seenEmails.add(sEmailKey);
              uniqueNewStudents.push(s);
            } else {
              // Track internal file duplicates as duplicates in summary
              duplicates.push(s);
            }
          }

          // Create upload summary for Task 4.4
          const summary = {
            total: rawStudents.length,
            successful: uniqueNewStudents.length,
            failed: invalidStudents.length,
            duplicates:
              duplicates.length + (validStudents.length - newStudents.length),
            invalidEntries: invalidStudents,
          };

          setUploadSummary(summary);

          // Show appropriate feedback
          if (uniqueNewStudents.length === 0) {
            if (invalidStudents.length > 0) {
              toast.error(
                `Upload failed: All ${rawStudents.length} entries are invalid. Click 'View Summary' to download invalid entries.`,
              );
            } else {
              toast.warning(
                `All ${validStudents.length} student(s) already exist in this class. Nothing to import.`,
              );
            }
            setShowUploadSummary(true);
            return;
          }

          // Hard block: if *any* required blanks exist, don't allow import preview.
          // (User requirement: no blank cells allowed in required fields.)
          const blankRequiredCount = invalidStudents.filter((x) =>
            x.errors.some(
              (e) =>
                e === "Student ID is required" ||
                e === "First Name is required" ||
                e === "Last Name is required",
            ),
          ).length;

          if (blankRequiredCount > 0) {
            toast.error(
              `Upload blocked: ${blankRequiredCount} row(s) have blank required fields (Student ID / First Name / Last Name). Fix the file then re-upload.`,
            );
            setShowUploadSummary(true);
            setImportPreview([]);
            setShowImportDialog(false);
            return;
          }

          // Success case with mixed results
          if (invalidStudents.length > 0 || duplicates.length > 0) {
            toast.info(
              `Upload completed with issues. ${uniqueNewStudents.length} will be imported. Click 'View Summary' for details.`,
            );
            setShowUploadSummary(true);
          } else {
            toast.success(
              `Upload successful! ${uniqueNewStudents.length} new student(s) ready to import.`,
            );
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
        } finally {
          setImporting(false);
          setSelectedFile(null);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error("Error reading file:", error);
      toast.error("Failed to read file");
      setImporting(false);
      setSelectedFile(null);
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
      "Error Messages",
    ];

    const invalidData = uploadSummary.invalidEntries.map((entry) => [
      entry.student.student_id,
      entry.student.first_name,
      entry.student.last_name,
      entry.student.email || "",
      entry.errors.join("; "),
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
    XLSX.writeFile(
      wb,
      `invalid_entries_${new Date().toISOString().split("T")[0]}.xlsx`,
    );

    toast.success(
      `Downloaded ${uploadSummary.invalidEntries.length} invalid entries`,
    );
  };

  const confirmImport = () => {
    // Safety net: never import students with blanks in required fields.
    const hasBlankRequired = importPreview.some(
      (s) =>
        !s.student_id?.trim() || !s.first_name?.trim() || !s.last_name?.trim(),
    );

    if (hasBlankRequired) {
      toast.error(
        "Import blocked: One or more rows have blank required fields (Student ID / First Name / Last Name).",
      );
      return;
    }

    // Final duplicate check before adding
    const existingIds = new Set(students.map((s) => s.student_id));
    const newOnly = importPreview.filter((s) => !existingIds.has(s.student_id));

    if (newOnly.length === 0) {
      toast.warning(
        "All students already exist in this class. Nothing to import.",
      );
      setImportPreview([]);
      setShowImportDialog(false);
      return;
    }

    const skipped = importPreview.length - newOnly.length;
    setStudents((prev) => [...prev, ...newOnly]);
    setImportPreview([]);
    setShowImportDialog(false);

    if (skipped > 0) {
      toast.success(
        `Imported ${newOnly.length} students. ${skipped} duplicate(s) skipped.`,
      );
    } else {
      toast.success(`Imported ${newOnly.length} students`);
    }

    // If we're not currently adding a class, assume this is a new class creation
    // triggered from the main page upload button.
    if (!showAddDialog) {
      setShowAddDialog(true);
      setCurrentTab("students"); // Show the students tab immediately so user sees the import
    } else {
      // If we ARE in a dialog (e.g. user clicked "Import" inside the Add modal),
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
    toast.success(
      "Template downloaded! Fill it in and use Import Excel to upload.",
    );
  };

  const filteredClasses = classes.filter(
    (c) =>
      c.class_name.toLowerCase().includes(search.toLowerCase()) ||
      c.course_subject.toLowerCase().includes(search.toLowerCase()) ||
      c.year?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="page-container">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Classes
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage your classes and student rosters</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => setShowAddDialog(true)}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
          >
            <Plus className="w-4 h-4" />
            Add Class
          </Button>
        </div>
      </div>

      {/* Upload Summary Dialog */}
      {showUploadSummary && uploadSummary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Upload Summary</h3>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between">
                <span>Total Records:</span>
                <span className="font-semibold">{uploadSummary.total}</span>
              </div>

              <div className="flex justify-between text-green-600">
                <span>Successfully Added:</span>
                <span className="font-semibold">
                  {uploadSummary.successful}
                </span>
              </div>

              {uploadSummary.duplicates > 0 && (
                <div className="flex justify-between text-yellow-600">
                  <span>Duplicates Skipped:</span>
                  <span className="font-semibold">
                    {uploadSummary.duplicates}
                  </span>
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
      <Card className="bg-white border border-gray-200 shadow-sm rounded-xl mb-6">
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
              className="bg-white border border-gray-200 shadow-sm rounded-xl hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => {
                router.push(`/classes/edit/${classItem.id}`);
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
                        {classItem.course_subject} &bull;{" "}
                        {classItem.section_block}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        Total Students
                      </p>
                      <p className="text-sm font-medium flex items-center gap-1">
                        <GraduationCap className="w-4 h-4 text-yellow-600" />
                        {classItem.students.length}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setArchiveId(classItem.id);
                      }}
                      className="p-1 h-auto text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                    >
                      <FolderArchive className="w-4 h-4" />
                    </Button>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Created
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {classItem.created_at
                        ? new Date(classItem.created_at).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            },
                          ) +
                          " • " +
                          new Date(classItem.created_at).toLocaleTimeString(
                            "en-US",
                            {
                              hour: "numeric",
                              minute: "2-digit",
                              hour12: true,
                            },
                          )
                        : "---"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Archive Confirmation Dialog */}
      <AlertDialog
        open={!!archiveId}
        onOpenChange={(open) => {
          if (!open) setArchiveId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this class?</AlertDialogTitle>
            <AlertDialogDescription>
              This class will be moved to the archive. You can restore it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setArchiveId(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!archiveId) return;
                await handleArchive(archiveId);
              }}
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Class Dialog */}
      <Dialog
        open={showAddDialog}
        onOpenChange={(open) => {
          if (!open) {
            handleCloseAddDialog();
          } else {
            setShowAddDialog(true);
          }
        }}
      >
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto bg-white border border-gray-200 rounded-xl p-0 shadow-lg">
          {/* Header */}
          <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-gray-100">
            <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <Plus className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-gray-900 leading-tight">
                Add New Class
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-500 mt-0.5">
                Create a new class and add students to the roster
              </DialogDescription>
            </div>
          </div>

          {/* Tabs */}
          <div className="px-6 pt-4">
            <Tabs
              value={currentTab}
              onValueChange={setCurrentTab}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2 bg-gray-100 rounded-lg p-1 h-9">
                <TabsTrigger
                  value="basic"
                  className="text-xs font-medium rounded-md data-[state=active]:bg-white data-[state=active]:text-green-700 data-[state=active]:shadow-sm"
                >
                  Class Information
                </TabsTrigger>
                <TabsTrigger
                  value="students"
                  className="text-xs font-medium rounded-md data-[state=active]:bg-white data-[state=active]:text-green-700 data-[state=active]:shadow-sm"
                >
                  Student Roster
                </TabsTrigger>
              </TabsList>

              {/* Class Information Tab */}
              <TabsContent value="basic" className="mt-4 space-y-4 pb-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Program */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      PROGRAM <span className="text-red-500">*</span>
                    </label>
                    <Input
                      id="class_name"
                      value={newClass.class_name}
                      onChange={(e) =>
                        setNewClass({ ...newClass, class_name: e.target.value })
                      }
                      placeholder="e.g. BSIT, BSCS"
                      className={`h-9 text-sm border rounded-lg focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-colors ${
                        newClass.class_name.trim().length >= 3
                          ? "border-green-400 bg-green-50/40"
                          : newClass.class_name.trim().length > 0
                            ? "border-red-300 bg-red-50/30"
                            : "border-gray-200"
                      }`}
                    />
                    {newClass.class_name.trim().length > 0 &&
                      newClass.class_name.trim().length < 3 && (
                        <p className="text-xs text-red-500">Minimum 3 characters</p>
                      )}
                  </div>

                  {/* Course */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      COURSE CODE <span className="text-red-500">*</span>
                    </label>
                    <Input
                      id="course_subject"
                      value={newClass.course_subject}
                      onChange={(e) =>
                        setNewClass({ ...newClass, course_subject: e.target.value })
                      }
                      placeholder="Course Code"
                      className={`h-9 text-sm border rounded-lg focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-colors ${
                        newClass.course_subject.trim().length >= 4
                          ? "border-green-400 bg-green-50/40"
                          : newClass.course_subject.trim().length > 0
                            ? "border-red-300 bg-red-50/30"
                            : "border-gray-200"
                      }`}
                    />
                    {newClass.course_subject.trim().length > 0 &&
                      newClass.course_subject.trim().length < 4 && (
                        <p className="text-xs text-red-500">Minimum 4 characters</p>
                      )}
                  </div>

                  {/* Year */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      YEAR LEVEL <span className="text-red-500">*</span>
                    </label>
                    <Select
                      value={newClass.year || ""}
                      onValueChange={(value) =>
                        setNewClass({ ...newClass, year: value })
                      }
                    >
                      <SelectTrigger
                        className={`h-9 text-sm border rounded-lg focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-colors ${
                          newClass.year ? "border-green-400 bg-green-50/40" : "border-gray-200"
                        }`}
                      >
                        <SelectValue placeholder="Select year level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1" className="focus:bg-green-50 focus:text-green-700">1st Year</SelectItem>
                        <SelectItem value="2" className="focus:bg-green-50 focus:text-green-700">2nd Year</SelectItem>
                        <SelectItem value="3" className="focus:bg-green-50 focus:text-green-700">3rd Year</SelectItem>
                        <SelectItem value="4" className="focus:bg-green-50 focus:text-green-700">4th Year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Room */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      ROOM{" "}
                      <span className="text-gray-400 text-xs normal-case font-normal">(optional)</span>
                    </label>
                    <Input
                      id="room"
                      type="number"
                      value={newClass.room}
                      onChange={(e) => {
                        const inputValue = e.target.value.replace(/[^0-9]/g, "");
                        if (inputValue.length > 3) {
                          setRoomWarning(true);
                          setTimeout(() => setRoomWarning(false), 3000);
                          return;
                        }
                        setNewClass({ ...newClass, room: inputValue.slice(0, 3) });
                      }}
                      placeholder="3-digit room number"
                      className="h-9 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-colors"
                    />
                    {roomWarning && (
                      <p className="text-xs text-red-500">Room number must be exactly 3 digits</p>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* Student Roster Tab */}
              <TabsContent value="students" className="mt-4 space-y-4 pb-2">
                {/* Import buttons */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={importing}
                    className="h-8 text-xs border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-700"
                  >
                    <Upload className="w-3.5 h-3.5 mr-1.5" />
                    {importing ? "Importing..." : "Import CSV/Excel"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadTemplate}
                    className="h-8 text-xs border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-700"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
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

                {/* Manual add student form */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    ADD STUDENT MANUALLY
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs text-gray-600 font-medium">
                        Student ID <span className="text-red-500">*</span>
                      </label>
                      <Input
                        placeholder="Enter student ID"
                        value={newStudent.student_id}
                        onChange={(e) =>
                          setNewStudent({ ...newStudent, student_id: e.target.value })
                        }
                        className="h-8 text-sm border-gray-200 focus:border-green-500 focus:ring-green-500/20"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-gray-600 font-medium">
                        First Name <span className="text-red-500">*</span>
                      </label>
                      <Input
                        placeholder="Enter first name"
                        value={newStudent.first_name}
                        onChange={(e) =>
                          setNewStudent({ ...newStudent, first_name: e.target.value })
                        }
                        className="h-8 text-sm border-gray-200 focus:border-green-500 focus:ring-green-500/20"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-gray-600 font-medium">
                        Last Name <span className="text-red-500">*</span>
                      </label>
                      <Input
                        placeholder="Enter last name"
                        value={newStudent.last_name}
                        onChange={(e) =>
                          setNewStudent({ ...newStudent, last_name: e.target.value })
                        }
                        className="h-8 text-sm border-gray-200 focus:border-green-500 focus:ring-green-500/20"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-gray-600 font-medium">
                        Email{" "}
                        <span className="text-gray-400 font-normal">(optional)</span>
                      </label>
                      <Input
                        placeholder="Enter email address"
                        type="email"
                        value={newStudent.email}
                        onChange={(e) =>
                          setNewStudent({ ...newStudent, email: e.target.value })
                        }
                        className="h-8 text-sm border-gray-200 focus:border-green-500 focus:ring-green-500/20"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end pt-1">
                    <Button
                      size="sm"
                      onClick={handleAddStudent}
                      disabled={
                        !newStudent.student_id.trim() ||
                        !newStudent.first_name.trim() ||
                        !newStudent.last_name.trim()
                      }
                      className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white px-4"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1.5" />
                      Add Student
                    </Button>
                  </div>
                </div>

                {/* Students table */}
                {students.length > 0 ? (
                  <div className="border border-gray-200 rounded-lg overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="text-xs text-gray-500 min-w-[100px]">Student ID</TableHead>
                          <TableHead className="text-xs text-gray-500 min-w-[120px]">Name</TableHead>
                          <TableHead className="text-xs text-gray-500 hidden sm:table-cell min-w-[150px]">Email</TableHead>
                          <TableHead className="text-xs text-gray-500 text-right min-w-[60px]">Remove</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {students.map((student, idx) => (
                          <TableRow key={`add-class-${idx}`} className="text-sm">
                            <TableCell className="py-2">{student.student_id}</TableCell>
                            <TableCell className="py-2">{`${student.first_name} ${student.last_name}`}</TableCell>
                            <TableCell className="py-2 hidden sm:table-cell">{student.email || "—"}</TableCell>
                            <TableCell className="py-2 text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveStudent(student.student_id)}
                                className="h-7 w-7 p-0 text-gray-400 hover:text-red-500"
                              >
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-400">
                    <AlertCircle className="w-7 h-7 mx-auto mb-1.5 text-gray-300" />
                    <p className="text-sm">No students added yet</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCloseAddDialog}
              className="h-8 text-xs border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAddClass}
              className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white px-5"
            >
              Add Class
            </Button>
          </div>
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
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="flex-shrink-0 p-4 sm:p-6 border-b">
            <DialogTitle className="text-lg sm:text-xl">
              {editingClass?.class_name}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {editingClass?.course_subject} - Block{" "}
              {editingClass?.year || "No year specified"}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-0">
            {editingClass && (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Room</p>
                    <p className="font-medium">{editingClass.room || "---"}</p>
                  </div>
                </div>

                <div>
                  <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
                    <h4 className="font-medium text-sm sm:text-base">
                      Students ({editingClass.students.length})
                    </h4>
                  </div>
                  {editingClass.students.length > 0 ? (
                    <div className="space-y-4">
                      {/* Mobile Card Layout */}
                      <div className="block sm:hidden space-y-3">
                        {editingClass.students.map((student, idx) => (
                          <div
                            key={`${editingClass.id}-mobile-${idx}`}
                            className="bg-card border rounded-lg p-3"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-mono text-sm font-medium">
                                {student.student_id}
                              </div>
                              <div className="text-sm font-medium truncate">{`${student.first_name} ${student.last_name}`}</div>
                              <div className="text-xs text-muted-foreground truncate">
                                {student.email || "No email"}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Desktop Table Layout */}
                      <div className="hidden sm:block">
                        <div className="border rounded-lg overflow-hidden">
                          <div className="max-h-[300px] overflow-y-auto">
                            <Table>
                              <TableHeader className="sticky top-0 bg-background">
                                <TableRow>
                                  <TableHead className="text-xs sm:text-sm px-2 sm:px-3">
                                    ID
                                  </TableHead>
                                  <TableHead className="text-xs sm:text-sm px-2 sm:px-3">
                                    Name
                                  </TableHead>
                                  <TableHead className="text-xs sm:text-sm px-2 sm:px-3">
                                    Email
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {editingClass.students.map((student, idx) => (
                                  <TableRow
                                    key={`${editingClass.id}-view-${idx}`}
                                    className="hover:bg-muted/50"
                                  >
                                    <TableCell className="font-mono text-xs sm:text-sm p-2 sm:p-3">
                                      <div className="truncate">
                                        {student.student_id}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-xs sm:text-sm p-2 sm:p-3">
                                      <div className="truncate font-medium text-xs sm:text-sm">{`${student.first_name} ${student.last_name}`}</div>
                                    </TableCell>
                                    <TableCell className="text-xs sm:text-sm p-2 sm:p-3">
                                      {student.email || "---"}
                                    </TableCell>
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
          </div>

          <DialogFooter className="flex-shrink-0 p-4 sm:p-6 border-t">
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={() => setShowViewDialog(false)}
                className="flex-1 sm:flex-none"
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  if (editingClass) {
                    setShowViewDialog(false);
                    // Small delay to ensure dialog closes before navigation
                    setTimeout(() => {
                      router.push(`/classes/edit?id=${editingClass.id}`);
                    }, 100);
                  }
                }}
                className="flex-1 sm:flex-none"
              >
                Edit Class
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
