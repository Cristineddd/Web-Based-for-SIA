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
  Trash2,
  Loader2,
  GraduationCap,
  Upload,
  Download,
  AlertCircle,
  X,
} from "lucide-react";

interface Student {
  student_id: string;
  first_name: string;
  last_name: string;
  email?: string;
}

interface Class {
  id: string;
  class_name: string;
  course_subject: string;
  section_block: string;
  room: string;
  students: Student[];
  created_at: string;
  schedule_day?: string;
  schedule_time?: string;
  semester?: string;
  school_year?: string;
}

export default function StudentClasses() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [currentTab, setCurrentTab] = useState("basic");
  const [importing] = useState(false);
  const [importPreview, setImportPreview] = useState<Student[]>([]);
  const [showImportDialog, setShowImportDialog] = useState(false);

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
      // TODO: Fetch from Firestore
      // For now, using mock data
      const mockClasses: Class[] = [
        {
          id: "1",
          class_name: "Computer Science 101",
          course_subject: "Introduction to Programming",
          section_block: "A",
          room: "Room 301",

          students: [
            {
              student_id: "2021001",
              first_name: "John",
              last_name: "Doe",
              email: "john.doe@example.com",
            },
            {
              student_id: "2021002",
              first_name: "Jane",
              last_name: "Smith",
              email: "jane.smith@example.com",
            },
          ],
          created_at: new Date().toISOString(),
        },
      ];
      setClasses(mockClasses);
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

    try {
      const classToAdd: Class = {
        id: Date.now().toString(),
        ...newClass,
        students: students,
        created_at: new Date().toISOString(),
      };

      // TODO: Save to Firestore
      setClasses([...classes, classToAdd]);

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
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      // TODO: Delete from Firestore
      setClasses(classes.filter((c) => c.id !== deleteId));
      setDeleteId(null);
      toast.success("Class deleted successfully");
    } catch (error) {
      console.error("Error deleting class:", error);
      toast.error("Failed to delete class");
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
      email: newStudent.email || undefined,
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

  const handleFileUpload = async () => {
    toast.error("Excel import temporarily disabled");
  };

  const confirmImport = () => {
    setStudents([...students, ...importPreview]);
    setImportPreview([]);
    setShowImportDialog(false);
    toast.success(`Imported ${importPreview.length} students`);
  };

  const downloadTemplate = () => {
    toast.error("Template download temporarily disabled");
  };

  const filteredClasses = classes.filter(
    (c) =>
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
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteId(classItem.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Total Students
                    </p>
                    <p className="text-sm font-medium flex items-center gap-1">
                      <GraduationCap className="w-4 h-4 text-yellow-600" />
                      {classItem.students.length}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Scanned
                    </p>
                    <p className="text-sm font-medium text-primary">
                      {classItem.students.length} / {classItem.students.length}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Average Score
                    </p>
                    <p className="text-sm font-medium">84%</p>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: "100%" }}
                    />
                  </div>
                  <p className="text-xs text-right text-muted-foreground mt-1">
                    100%
                  </p>
                </div>
              </CardContent>
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
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                />
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
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddClass} className="gradient-primary">
              Add Class
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
                      <TableRow key={idx}>
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
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Schedule</p>
                  <p className="font-medium">{selectedClass.schedule_day}</p>
                  <p className="text-sm">{selectedClass.schedule_time}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Room</p>
                  <p className="font-medium">{selectedClass.room || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Semester</p>
                  <p className="font-medium">{selectedClass.semester || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">School Year</p>
                  <p className="font-medium">
                    {selectedClass.school_year || "—"}
                  </p>
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
