"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
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
  Trash2,
  Loader2,
  GraduationCap,
  Upload,
  Download,
  AlertCircle,
  X,
  FileText,
  Users,
  ChevronRight,
  CheckCircle2,
  FileDown,
  Clock,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import * as XLSX from "xlsx"; // Added import here
import {
  createClass,
  getClasses,
  updateClass,
  deleteClass,
  type Class,
  type Student,
} from "@/services/classService";

export default function ClassManagement() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [currentTab, setCurrentTab] = useState("basic");
  const [importing] = useState(false);
  const [importPreview, setImportPreview] = useState<Student[]>([]);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importTotalRows, setImportTotalRows] = useState(0);
  const [importDuplicates, setImportDuplicates] = useState(0);
  const [importErrors, setImportErrors] = useState(0);
  const [importFileName, setImportFileName] = useState("");
  const [importStep, setImportStep] = useState(1);
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

    try {
      setSaving(true);

      const classToAdd: Omit<Class, "id"> = {
        ...newClass,
        students: students,
        created_at: new Date().toISOString(),
      };

      const newClassDoc = await createClass(classToAdd, user.id);
      setClasses((prev) => [newClassDoc, ...prev]);
      await fetchClasses(); // Robust fallback to ensure list is in sync

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
    } catch (error) {
      console.error("Error adding class:", error);
      toast.error("Failed to add class");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      await deleteClass(deleteId);
      setClasses(classes.filter((c) => c.id !== deleteId));
      setDeleteId(null);
      toast.success("Class deleted successfully");
    } catch (error) {
      console.error("Error deleting class:", error);
      toast.error("Failed to delete class");
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

    setImportFileName(file.name);

    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          setImportTotalRows(jsonData.length);

          const studentIdSet = new Set();
          let duplicates = 0;
          let errors = 0;

          const importedStudents: Student[] = jsonData
            .slice(1) // Skip header
            .filter((row: any) => {
              // Basic validation: must have at least 3 values (ID, First, Last)
              const isValid =
                row &&
                row.length >= 3 &&
                String(row[0]).trim() &&
                String(row[1]).trim() &&
                String(row[2]).trim();

              if (!isValid && row && row.length > 0) {
                errors++;
                return false;
              }
              return isValid;
            })
            .map((row: any) => ({
              student_id: String(row[0] || "").trim(),
              first_name: String(row[1] || "").trim(),
              last_name: String(row[2] || "").trim(),
              email: row[3] ? String(row[3]).trim() : undefined,
            }))
            .filter((student) => {
              if (studentIdSet.has(student.student_id)) {
                duplicates++;
                return false;
              }
              studentIdSet.add(student.student_id);
              return true;
            });

          setImportErrors(errors);
          setImportDuplicates(duplicates);

          if (importedStudents.length === 0) {
            toast.error("No valid students found in file");
            return;
          }

          setImportPreview(importedStudents);
          setImportStep(jsonData.length > 500 ? 2 : 3); // Dynamic flow or just show Summary
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

  const confirmImport = (keepOpen = false) => {
    setStudents((prev) => [...prev, ...importPreview]);
    if (!keepOpen) {
      setImportPreview([]);
      setShowImportDialog(false);
    }
    toast.success(`Imported ${importPreview.length} students`);

    // Only show add dialog if we were not already in one and we are closing the import dialog
    if (!keepOpen && !showAddDialog && !showEditDialog) {
      setShowAddDialog(true);
      setCurrentTab("students");
    } else if (!keepOpen) {
      setCurrentTab("students");
    }
  };

  const downloadTemplate = () => {
    // simple CSV template
    const headers = [
      "Student ID",
      "First Name",
      "Last Name",
      "Email (Optional)",
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "student_import_template.xlsx");
  };

  const filteredClasses = classes.filter(
    (c) =>
      c.class_name.toLowerCase().includes(search.toLowerCase()) ||
      c.course_subject.toLowerCase().includes(search.toLowerCase()) ||
      c.section_block.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="bg-white rounded-[32px] p-8 shadow-sm border border-[#BA8E23]/10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-emerald-50 text-[#004D2C] text-[10px] font-black px-2 py-0.5 rounded border uppercase tracking-wider">
                Role: Prof
              </span>
              <h2 className="text-[#004D2C] font-black text-sm uppercase tracking-widest opacity-60">
                Smart Exam Checking & Auto-Grading System
              </h2>
            </div>
            <h1 className="text-4xl font-black text-[#004D2C]">Class</h1>
            <p className="text-gray-400 font-bold mt-1">
              Manage student roster and information
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Button
              onClick={() => {
                setImportStep(1);
                setShowImportDialog(true);
              }}
              variant="outline"
              className="h-12 px-6 rounded-xl border-[#BA8E23]/20 text-[#004D2C] font-black gap-2 hover:bg-[#FAF9F6]"
            >
              <FileDown className="w-5 h-5 text-[#BA8E23]" />
              Import Excel
            </Button>
            <Button
              onClick={() => setShowAddDialog(true)}
              className="h-12 px-8 rounded-xl bg-[#004D2C] hover:bg-[#003d22] text-white font-black gap-2 shadow-lg"
            >
              <Plus className="w-5 h-5" />
              Add Class
            </Button>
          </div>
        </div>
      </div>

      {/* Hidden File Input for Excel Import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Search */}
      <Card className="rounded-[24px] border-[#BA8E23]/20 shadow-sm overflow-hidden bg-white">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-6 top-1/2 transform -translate-y-1/2 text-gray-300 w-5 h-5" />
            <input
              placeholder="Search students by name, ID, or course..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-14 pl-14 pr-6 bg-transparent text-lg font-bold placeholder:text-gray-200 focus:outline-none"
            />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-12 h-12 animate-spin text-[#004D2C]" />
        </div>
      ) : filteredClasses.length === 0 ? (
        <div className="bg-white rounded-[32px] border border-dashed border-[#BA8E23]/20 p-24 text-center">
          <div className="w-20 h-20 bg-[#FAF9F6] rounded-full flex items-center justify-center mx-auto mb-6">
            <GraduationCap className="w-10 h-10 text-gray-300" />
          </div>
          <h3 className="text-xl font-black text-[#004D2C] mb-2">
            {search ? "No matches found" : "No classes yet"}
          </h3>
          <p className="text-gray-400 font-bold max-w-xs mx-auto">
            {search
              ? "Try adjusting your search terms to find what you're looking for."
              : "Get started by creating your first class or importing students from Excel."}
          </p>
        </div>
      ) : (
        <div className="grid gap-6">
          {filteredClasses.map((classItem) => (
            <Card
              key={classItem.id}
              className="rounded-[24px] border-[#BA8E23]/20 hover:border-[#BA8E23] hover:shadow-xl transition-all p-8 bg-white cursor-pointer group relative overflow-hidden"
              onClick={() => {
                setSelectedClass(classItem);
                setShowViewDialog(true);
              }}
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 rounded-2xl bg-[#FAF9F6] border border-[#BA8E23]/10 flex items-center justify-center group-hover:bg-emerald-50 transition-colors">
                    <div className="w-10 h-10 rounded-lg border-2 border-[#BA8E23]/30 flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-[#BA8E23]"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-2xl font-black text-[#004D2C]">
                      {classItem.class_name} - {classItem.section_block}
                    </h4>
                    <div className="flex items-center gap-2 text-gray-400 font-bold mt-1">
                      <Clock className="w-4 h-4 text-[#BA8E23]/60" />
                      <span>
                        {classItem.course_subject} • MWF 9:00 AM – 10:30 AM
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-8 h-8 text-gray-200 group-hover:text-[#BA8E23] transition-colors" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="p-4 rounded-2xl border border-gray-100 bg-[#FAF9F6]/50 space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">
                    Total Students
                  </p>
                  <div className="flex items-center gap-2 text-[#004D2C]">
                    <Users className="w-5 h-5 text-[#BA8E23]" />
                    <span className="text-3xl font-black">
                      {classItem.students.length}
                    </span>
                  </div>
                </div>
                <div className="p-4 rounded-2xl border border-gray-100 bg-[#FAF9F6]/50 space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">
                    Scanned
                  </p>
                  <div className="text-[#004D2C]">
                    <span className="text-3xl font-black">
                      10 / {classItem.students.length}
                    </span>
                  </div>
                </div>
                <div className="p-4 rounded-2xl border border-gray-100 bg-[#FAF9F6]/50 space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">
                    Average Score
                  </p>
                  <div className="text-emerald-600">
                    <span className="text-3xl font-black">84%</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-end text-xs font-black text-[#004D2C]">
                  <span>100%</span>
                </div>
                <div className="h-2 bg-[#FAF9F6] border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#004D2C] transition-all duration-500"
                    style={{ width: "100%" }}
                  />
                </div>
              </div>

              {/* Action Buttons (Floating on hover) */}
              <div className="absolute top-4 right-12 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-xl bg-white text-[#004D2C] border shadow-sm hover:bg-emerald-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditClass(classItem);
                  }}
                >
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    <path d="m15 5 4 4" />
                  </svg>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-xl bg-white text-red-500 border shadow-sm hover:bg-red-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteId(classItem.id);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add Class Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Class</DialogTitle>
            <DialogDescription>
              Create a new class and add students to the roster
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
                  <Label htmlFor="class_name">Class Name *</Label>
                  <Input
                    id="class_name"
                    value={newClass.class_name}
                    onChange={(e) =>
                      setNewClass({ ...newClass, class_name: e.target.value })
                    }
                    placeholder="e.g., Computer Science 101"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="course_subject">Course/Subject *</Label>
                  <Input
                    id="course_subject"
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
                  <Label htmlFor="section_block">Section/Block *</Label>
                  <Input
                    id="section_block"
                    value={newClass.section_block}
                    onChange={(e) =>
                      setNewClass({
                        ...newClass,
                        section_block: e.target.value,
                      })
                    }
                    placeholder="e.g., A"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="room">Room</Label>
                  <Input
                    id="room"
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
              </div>

              <div className="border rounded-lg p-4 space-y-4">
                <h4 className="font-medium">Add Student Manually</h4>
                <div className="grid grid-cols-4 gap-3">
                  <Input
                    placeholder="Student ID"
                    value={newStudent.student_id}
                    onChange={(e) =>
                      setNewStudent({
                        ...newStudent,
                        student_id: e.target.value,
                      })
                    }
                  />
                  <Input
                    placeholder="First Name"
                    value={newStudent.first_name}
                    onChange={(e) =>
                      setNewStudent({
                        ...newStudent,
                        first_name: e.target.value,
                      })
                    }
                  />
                  <Input
                    placeholder="Last Name"
                    value={newStudent.last_name}
                    onChange={(e) =>
                      setNewStudent({
                        ...newStudent,
                        last_name: e.target.value,
                      })
                    }
                  />
                  <Input
                    placeholder="Email (optional)"
                    value={newStudent.email}
                    onChange={(e) =>
                      setNewStudent({ ...newStudent, email: e.target.value })
                    }
                  />
                </div>
                <Button onClick={handleAddStudent} variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Student
                </Button>
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
                      {students.map((student) => (
                        <TableRow key={student.student_id}>
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
              onClick={() => setShowAddDialog(false)}
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
                  <Label htmlFor="edit_section_block">Section/Block *</Label>
                  <Input
                    id="edit_section_block"
                    value={newClass.section_block}
                    onChange={(e) =>
                      setNewClass({
                        ...newClass,
                        section_block: e.target.value,
                      })
                    }
                    placeholder="e.g., A"
                  />
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
              </div>

              <div className="border rounded-lg p-4 space-y-4">
                <h4 className="font-medium">Add Student Manually</h4>
                <div className="grid grid-cols-4 gap-3">
                  <Input
                    placeholder="Student ID"
                    value={newStudent.student_id}
                    onChange={(e) =>
                      setNewStudent({
                        ...newStudent,
                        student_id: e.target.value,
                      })
                    }
                  />
                  <Input
                    placeholder="First Name"
                    value={newStudent.first_name}
                    onChange={(e) =>
                      setNewStudent({
                        ...newStudent,
                        first_name: e.target.value,
                      })
                    }
                  />
                  <Input
                    placeholder="Last Name"
                    value={newStudent.last_name}
                    onChange={(e) =>
                      setNewStudent({
                        ...newStudent,
                        last_name: e.target.value,
                      })
                    }
                  />
                  <Input
                    placeholder="Email (optional)"
                    value={newStudent.email}
                    onChange={(e) =>
                      setNewStudent({ ...newStudent, email: e.target.value })
                    }
                  />
                </div>
                <Button onClick={handleAddStudent} variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Student
                </Button>
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
                      {students.map((student) => (
                        <TableRow key={student.student_id}>
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

      {/* Import Class Roster Dialog (Wizard) */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent
          className={cn(
            "bg-white shadow-2xl transition-all duration-300 border-none",
            importStep === 5
              ? "max-w-md rounded-[40px] p-0 overflow-hidden"
              : "max-w-2xl rounded-[32px] p-8",
          )}
        >
          {importStep < 5 && (
            <div className="flex justify-between items-start mb-6">
              <div>
                <DialogTitle className="text-3xl font-black text-[#004D2C]">
                  {importStep === 1 && "Import Class Roster"}
                  {importStep === 2 && "Field Detection"}
                  {importStep === 3 && "Validation"}
                  {importStep === 4 && "File Validation"}
                </DialogTitle>
                <DialogDescription className="text-gray-400 font-bold mt-1">
                  {importStep === 1 &&
                    "Upload an Excel file (.xls, .xlsx) containing student information"}
                  {importStep === 2 &&
                    "Review detected student information fields"}
                  {importStep === 3 &&
                    "Review potential issues before confirming"}
                  {importStep === 4 &&
                    "Review the import summary before confirming"}
                </DialogDescription>
              </div>
              <button
                onClick={() => setShowImportDialog(false)}
                className="text-gray-300 hover:text-gray-500"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          )}

          {/* Step 1: Upload */}
          {importStep === 1 && (
            <div className="space-y-6">
              <div
                className="border-4 border-dashed border-gray-100 rounded-[32px] p-16 text-center hover:border-[#BA8E23]/20 transition-all cursor-pointer bg-[#FAF9F6]/50 group"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-24 h-24 bg-white rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  <div className="w-16 h-16 rounded-xl bg-[#BA8E23] flex items-center justify-center text-white">
                    <svg
                      className="w-8 h-8"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                      <path d="M14 2v6h6M8 13h8M8 17h8M10 9H8" />
                    </svg>
                  </div>
                </div>
                <h3 className="text-xl font-black text-[#004D2C] mb-2">
                  Click to upload or drag and drop
                </h3>
                <p className="text-gray-400 font-bold">
                  Excel files up to 10MB
                </p>
                <Button
                  variant="outline"
                  className="mt-8 h-12 px-8 rounded-xl border-[#BA8E23]/20 font-black text-[#004D2C]"
                >
                  Browse Files
                </Button>
              </div>
              <Button
                variant="ghost"
                className="w-full h-14 rounded-2xl text-gray-400 font-black hover:text-gray-600 uppercase tracking-widest"
                onClick={() => setShowImportDialog(false)}
              >
                Cancel
              </Button>
            </div>
          )}

          {/* Step 2: Field Detection */}
          {importStep === 2 && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl border border-[#004D2C]/10 bg-emerald-50/30 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#004D2C] flex items-center justify-center text-white">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <p className="font-black text-[#004D2C]">{importFileName}</p>
                  <p className="text-xs text-gray-400 font-bold">
                    Excel Document
                  </p>
                </div>
                <Button
                  variant="ghost"
                  className="text-gray-400 font-black hover:text-[#004D2C]"
                  onClick={() => setImportStep(1)}
                >
                  Remove
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-6 rounded-2xl border bg-white space-y-1">
                  <p className="text-xs font-black text-gray-400 uppercase">
                    Total Rows
                  </p>
                  <p className="text-4xl font-black text-[#004D2C]">
                    {importPreview.length}
                  </p>
                </div>
                <div className="p-6 rounded-2xl border bg-white space-y-1">
                  <p className="text-xs font-black text-gray-400 uppercase">
                    Valid Students
                  </p>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                    <p className="text-4xl font-black text-[#004D2C]">
                      {importPreview.length}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-black text-[#004D2C] mb-4">
                  Detected Student Information Fields
                </h4>
                <div className="bg-[#FAF9F6] rounded-2xl p-6 border border-gray-100 space-y-4">
                  {[
                    { label: "Student Name", sample: "Juan Dela Cruz" },
                    { label: "Student ID", sample: "2024-00123" },
                    { label: "Course/Section", sample: "BSIT - Block A" },
                    { label: "Year Level", sample: "3rd Year" },
                    { label: "Email", sample: "juandelacruz@email.com" },
                  ].map((field) => (
                    <div key={field.label} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm">
                        <svg
                          className="w-3 h-3 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="4"
                        >
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-black text-[#004D2C]">
                          {field.label}
                        </p>
                        <p className="text-xs text-gray-400 font-bold">
                          Sample: {field.sample}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-4 pt-4 text-center">
                <Button
                  variant="outline"
                  className="flex-1 h-12 rounded-xl font-black text-gray-400"
                  onClick={() => setShowImportDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 h-12 rounded-xl bg-[#004D2C] hover:bg-[#003d22] text-white font-black"
                  onClick={() => setImportStep(3)}
                >
                  Import Roster
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Validation (Duplicates/Errors) */}
          {importStep === 3 && (
            <div className="space-y-6">
              <div className="max-h-[300px] overflow-y-auto pr-2 custom-scrollbar space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-4">
                  <AlertCircle className="w-6 h-6 text-amber-500 shrink-0" />
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <h5 className="text-amber-800 font-black">
                        Duplicate Entries
                      </h5>
                      <span className="text-xl font-black text-amber-800">
                        {importDuplicates}
                      </span>
                    </div>
                    <p className="text-amber-700/70 font-bold text-xs leading-relaxed">
                      {importDuplicates} duplicate student entries detected.
                      These entries will be skipped during import.
                    </p>
                  </div>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex items-start gap-4">
                  <AlertCircle className="w-6 h-6 text-red-500 shrink-0" />
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <h5 className="text-red-800 font-black">Errors Found</h5>
                      <span className="text-xl font-black text-red-800">
                        {importErrors}
                      </span>
                    </div>
                    <p className="text-red-700/70 font-bold text-xs leading-relaxed">
                      {importErrors} row{importErrors !== 1 ? "s have" : " has"}{" "}
                      invalid data or missing required fields. This row will be
                      skipped during import.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4 text-center">
                <Button
                  variant="outline"
                  className="flex-1 h-14 rounded-2xl font-black text-gray-400 border-2"
                  onClick={() => setShowImportDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 h-14 rounded-2xl bg-[#004D2C] hover:bg-[#003d22] text-white font-black shadow-lg"
                  onClick={() => setImportStep(4)}
                >
                  Import Roster
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Final Summary */}
          {importStep === 4 && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl border border-[#004D2C]/10 bg-[#FAF9F6] flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#004D2C] flex items-center justify-center text-white">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <p className="font-black text-[#004D2C]">{importFileName}</p>
                  <p className="text-xs text-gray-400 font-bold">
                    Ready to import {importPreview.length} students
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-6 rounded-2xl border bg-white space-y-1">
                  <p className="text-xs font-black text-gray-400 uppercase">
                    Total Rows Detected
                  </p>
                  <p className="text-4xl font-black text-[#004D2C]">
                    {importTotalRows}
                  </p>
                </div>
                <div className="p-6 rounded-2xl border bg-white border-emerald-100 flex flex-col justify-center">
                  <p className="text-xs font-black text-gray-400 uppercase mb-1">
                    Valid Students
                  </p>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                    <p className="text-4xl font-black text-[#004D2C]">
                      {importPreview.length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="bg-amber-50/50 border border-amber-100 rounded-xl px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    <span className="text-sm font-bold text-amber-700">
                      Duplicate Entries Found
                    </span>
                  </div>
                  <span className="font-black text-amber-700">
                    {importDuplicates}
                  </span>
                </div>
                <div className="bg-red-50/50 border border-red-100 rounded-xl px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <span className="text-sm font-bold text-red-700">
                      Errors Found
                    </span>
                  </div>
                  <span className="font-black text-red-700">
                    {importErrors}
                  </span>
                </div>
              </div>

              <div className="flex gap-4 pt-4 text-center">
                <Button
                  variant="outline"
                  className="flex-1 h-14 rounded-2xl font-black text-emerald-700 border-2"
                  onClick={() => setShowImportDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 h-14 rounded-2xl bg-[#004D2C] hover:bg-[#003d22] text-white font-black shadow-lg"
                  onClick={() => {
                    confirmImport(true);
                    setImportStep(5);
                  }}
                >
                  Confirm Import
                </Button>
              </div>
            </div>
          )}

          {/* Step 5: Success Screen */}
          {importStep === 5 && (
            <div className="flex flex-col h-full">
              <div className="bg-[#FAF9F6] p-12 flex flex-col items-center">
                <div className="w-32 h-32 rounded-full bg-white flex items-center justify-center shadow-xl mb-8 relative">
                  <div className="absolute inset-0 rounded-full border-8 border-emerald-50 opacity-20 animate-ping" />
                  <div className="w-24 h-24 rounded-full bg-emerald-500 flex items-center justify-center text-white scale-110">
                    <svg
                      className="w-12 h-12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="4"
                    >
                      <path
                        d="M5 13l4 4L19 7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
                <h2 className="text-3xl font-black text-[#004D2C] text-center mb-4 px-4 leading-tight">
                  Students Successfully Imported!
                </h2>
                <p className="text-gray-400 font-bold text-center">
                  {importPreview.length} students have been added to your class
                  roster
                </p>
              </div>
              <div className="p-12 space-y-8 bg-white">
                <div className="bg-emerald-50 rounded-3xl p-6 border border-emerald-100 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm">
                      <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-gray-400 uppercase">
                        Students Added
                      </p>
                      <p className="text-3xl font-black text-[#004D2C]">
                        {importPreview.length}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-8 rounded-3xl border border-[#BA8E23]/20 bg-[#FAF9F6]/50">
                  <h4 className="text-sm font-black text-[#004D2C] mb-4 text-center">
                    What's Next?
                  </h4>
                  <ul className="space-y-3">
                    <li className="flex items-center gap-3 text-sm font-bold text-emerald-700">
                      <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                        <svg
                          className="w-3 h-3 text-emerald-600"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="4"
                        >
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      Students are now visible in your class roster
                    </li>
                    <li className="flex items-center gap-3 text-sm font-bold text-emerald-700">
                      <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                        <svg
                          className="w-3 h-3 text-emerald-600"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="4"
                        >
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      You can start scanning and grading exams
                    </li>
                    <li className="flex items-center gap-3 text-sm font-bold text-emerald-700">
                      <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                        <svg
                          className="w-3 h-3 text-emerald-600"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="4"
                        >
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      All student data has been saved
                    </li>
                  </ul>
                </div>

                <Button
                  className="w-full h-16 rounded-2xl bg-[#004D2C] hover:bg-[#003d22] text-white font-black text-xl shadow-xl transition-all active:scale-95"
                  onClick={() => setShowImportDialog(false)}
                >
                  Go to Class
                </Button>
              </div>
            </div>
          )}
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
                        {selectedClass.students.map((student) => (
                          <TableRow key={student.student_id}>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this class and all associated data.
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
    </div>
  );
}
