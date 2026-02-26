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

  const handleAddStudent = () => {
    if (
      !newStudent.student_id ||
      !newStudent.first_name ||
      !newStudent.last_name
    ) {
      toast.error("Please fill in student ID, first name, and last name");
      return;
    }

    // Validate student ID format: exactly 9 digits
    if (!/^\d{9}$/.test(newStudent.student_id.trim())) {
      toast.error("Student ID Must follow YYYYXXXXX format (e.g. 202300001)");
      return;
    }

    // Check for duplicate student ID
    if (students.some(s => s.student_id === newStudent.student_id)) {
      toast.error(`Student ID "${newStudent.student_id}" already exists in this class`);
      return;
    }

    // Check for duplicate student name (first name + last name combination)
    if (students.some(s => s.first_name === newStudent.first_name && s.last_name === newStudent.last_name)) {
      toast.error(`Student "${newStudent.first_name} ${newStudent.last_name}" already exists in this class`);
      return;
    }

    const student: Student = {
      student_id: newStudent.student_id,
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
    toast.success("Student added to roster");
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
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          // Skip header row and map data to Student objects
          const importedStudents: Student[] = jsonData
            .slice(1) // Skip header
            .filter((row: any) => row.length >= 3) // Ensure basic validation
            .map((row: any) => ({
              student_id: String(row[0] || ""),
              first_name: String(row[1] || ""),
              last_name: String(row[2] || ""),
              email: row[3] ? String(row[3]) : undefined,
            }));

          if (importedStudents.length === 0) {
            toast.error("No valid students found in file");
            return;
          }

          setImportPreview(importedStudents);
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

  const confirmImport = () => {
    setStudents((prev) => [...prev, ...importPreview]);
    setImportPreview([]);
    setShowImportDialog(false);
    toast.success(`Imported ${importPreview.length} students`);

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
      ["2024-00001", "Juan", "Dela Cruz", "juan.delacruz@email.com"],
      ["2024-00002", "Maria", "Santos", "maria.santos@email.com"],
      ["2024-00003", "Jose", "Rizal", ""],
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
          <h1 className="text-3xl font-bold text-foreground">Class</h1>
          <p className="text-muted-foreground mt-1">
            Manage student roster and information
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={downloadTemplate}
            variant="outline"
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Download Template
          </Button>
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            className="gap-2"
          >
            <Upload className="w-4 h-4" />
            Import Excel
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
                        {classItem.course_subject} • {classItem.section_block}
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

                <div className="mt-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Total Students
                    </p>
                    <p className="text-sm font-medium flex items-center gap-1">
                      <GraduationCap className="w-4 h-4 text-yellow-600" />
                      {classItem.students.length}
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto border-2 border-green-200 rounded-xl">
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

            <TabsContent value="basic" className="space-y-6 mt-6 p-6 bg-gradient-to-br from-green-50/50 to-emerald-50/50 rounded-lg border border-green-200">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label htmlFor="class_name" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    Class Name <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="class_name"
                      value={newClass.class_name}
                      onChange={(e) =>
                        setNewClass({ ...newClass, class_name: e.target.value })
                      }
                      placeholder="Enter class name"
                      className={`transition-all duration-200 border-2 rounded-lg px-4 py-3 ${
                        newClass.class_name.trim() 
                          ? 'border-green-400 focus:border-green-500 focus:ring-4 focus:ring-green-100 bg-green-50/30' 
                          : 'border-gray-200 focus:border-green-400 focus:ring-4 focus:ring-green-100'
                      }`}
                    />
                    {newClass.class_name.trim() && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs font-bold">✓</span>
                        </div>
                      </div>
                    )}
                  </div>
                  {newClass.class_name.trim() && (
                    <div className="flex items-center gap-2 text-xs text-green-600">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span>Valid class name</span>
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
                      onChange={(e) =>
                        setNewClass({
                          ...newClass,
                          course_subject: e.target.value,
                        })
                      }
                      placeholder="Enter course subject"
                      className={`transition-all duration-200 border-2 rounded-lg px-4 py-3 ${
                        newClass.course_subject.trim() 
                          ? 'border-green-400 focus:border-green-500 focus:ring-4 focus:ring-green-100 bg-green-50/30' 
                          : 'border-gray-200 focus:border-green-400 focus:ring-4 focus:ring-green-100'
                      }`}
                    />
                    {newClass.course_subject.trim() && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs font-bold">✓</span>
                        </div>
                      </div>
                    )}
                  </div>
                  {newClass.course_subject.trim() && (
                    <div className="flex items-center gap-2 text-xs text-green-600">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span>Valid course subject</span>
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
                          <span className="text-white text-xs font-bold">✓</span>
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
                      value={newClass.room}
                      onChange={(e) =>
                        setNewClass({ ...newClass, room: e.target.value })
                      }
                      placeholder="Enter room number"
                      className="transition-all duration-200 border-2 border-gray-200 focus:border-green-400 focus:ring-4 focus:ring-green-100 rounded-lg px-4 py-3"
                    />
                    {newClass.room.trim() && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs font-bold">✓</span>
                        </div>
                      </div>
                    )}
                  </div>
                  {newClass.room.trim() && (
                    <div className="flex items-center gap-2 text-xs text-blue-600">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                      <span>Room specified</span>
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
              <div className="flex gap-2 mb-4">
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {importing ? "Importing..." : "Import CSV/Excel"}
                </Button>
                <Button variant="outline" onClick={downloadTemplate}>
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
                      placeholder="e.g. 202300001"
                      value={newStudent.student_id}
                      maxLength={9}
                      onChange={(e) =>
                        setNewStudent({
                          ...newStudent,
                          student_id: e.target.value.replace(/\D/g, '').slice(0, 9),
                        })
                      }
                      className={`transition-all duration-200 ${
                        /^\d{9}$/.test(newStudent.student_id.trim())
                          ? 'border-green-500 focus:border-green-500 focus:ring-green-200'
                          : newStudent.student_id.trim()
                          ? 'border-red-400 focus:border-red-400 focus:ring-red-200'
                          : 'focus:border-primary focus:ring-primary/20'
                      }`}
                    />
                    {newStudent.student_id.trim() && (
                      /^\d{9}$/.test(newStudent.student_id.trim()) ? (
                        <div className="flex items-center gap-1 text-xs text-green-600">
                          <div className="w-2 h-2 bg-green-500 rounded-full" />
                          Valid student ID
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-xs text-red-500">
                          <div className="w-2 h-2 bg-red-400 rounded-full" />
                          Must follow YYYYXXXXX format (e.g. 202300001)
                        </div>
                      )
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
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.map((student, idx) => (
                        <TableRow key={`add-class-${idx}`}>
                          <TableCell>{student.student_id}</TableCell>
                          <TableCell>{`${student.first_name} ${student.last_name}`}</TableCell>
                          <TableCell>{student.email || "—"}</TableCell>
                          <TableCell className="text-right">
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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
              <div className="grid grid-cols-2 gap-4">
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
                    value={newClass.room}
                    onChange={(e) =>
                      setNewClass({ ...newClass, room: e.target.value })
                    }
                    placeholder="e.g., Room 301"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="students" className="space-y-4 mt-4">
              <div className="flex gap-2 mb-4">
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {importing ? "Importing..." : "Import CSV/Excel"}
                </Button>
                <Button variant="outline" onClick={downloadTemplate}>
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
                      placeholder="e.g. 202300001"
                      value={newStudent.student_id}
                      maxLength={9}
                      onChange={(e) =>
                        setNewStudent({
                          ...newStudent,
                          student_id: e.target.value.replace(/\D/g, '').slice(0, 9),
                        })
                      }
                      className={`transition-all duration-200 ${
                        /^\d{9}$/.test(newStudent.student_id.trim())
                          ? 'border-green-500 focus:border-green-500 focus:ring-green-200'
                          : newStudent.student_id.trim()
                          ? 'border-red-400 focus:border-red-400 focus:ring-red-200'
                          : 'focus:border-primary focus:ring-primary/20'
                      }`}
                    />
                    {newStudent.student_id.trim() && (
                      /^\d{9}$/.test(newStudent.student_id.trim()) ? (
                        <div className="flex items-center gap-1 text-xs text-green-600">
                          <div className="w-2 h-2 bg-green-500 rounded-full" />
                          Valid student ID
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-xs text-red-500">
                          <div className="w-2 h-2 bg-red-400 rounded-full" />
                          Must follow YYYYXXXXX format (e.g. 202300001)
                        </div>
                      )
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
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.map((student, idx) => (
                        <TableRow key={`edit-class-${idx}`}>
                          <TableCell>{student.student_id}</TableCell>
                          <TableCell>{`${student.first_name} ${student.last_name}`}</TableCell>
                          <TableCell>{student.email || "—"}</TableCell>
                          <TableCell className="text-right">
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
                        <TableCell>{student.email || "—"}</TableCell>
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
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedClass?.class_name}</DialogTitle>
            <DialogDescription>
              {selectedClass?.course_subject} - Section{" "}
              {selectedClass?.section_block}
            </DialogDescription>
          </DialogHeader>
          {selectedClass && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Room</p>
                  <p className="font-medium">{selectedClass.room || "—"}</p>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-3">
                  Students ({selectedClass.students.length})
                </h4>
                {selectedClass.students.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student ID</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedClass.students.map((student, idx) => (
                          <TableRow key={`${selectedClass.id}-view-${idx}`}>
                            <TableCell>{student.student_id}</TableCell>
                            <TableCell>{`${student.first_name} ${student.last_name}`}</TableCell>
                            <TableCell>{student.email || "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">
                    No students enrolled
                  </p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowViewDialog(false)}>Close</Button>
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
