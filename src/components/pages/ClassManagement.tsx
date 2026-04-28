"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
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
  GraduationCap,
  Archive,
  Users,
  Calendar,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  createClass,
  getClasses,
  updateClass,
  type Class,
} from "@/services/classService";
import { AuditLogger } from "@/services/auditLogger";
import {
  getExamsByClassId,
  archiveExam,
} from "@/services/examService";

export default function ClassManagement() {
  const { user } = useAuth();
  const router = useRouter();

  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [roomWarning, setRoomWarning] = useState(false);

  const [newClass, setNewClass] = useState({
    class_name: "",
    course_subject: "",
    year: "",
    room: "",
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
    setNewClass({
      class_name: "",
      course_subject: "",
      year: "",
      room: "",
    });
  };

  const handleAddClass = async () => {
    if (!newClass.class_name || !newClass.course_subject) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (newClass.class_name.trim().length < 3) {
      toast.error("Class Name must be at least 3 characters long");
      return;
    }

    if (newClass.course_subject.trim().length < 4) {
      toast.error("Course/Subject must be at least 4 characters long");
      return;
    }

    if (!newClass.year || newClass.year.trim() === "") {
      toast.error("Year level is required");
      return;
    }

    if (!user?.id) {
      toast.error("You must be logged in to create a class");
      return;
    }

    const classToAdd: Omit<Class, "id"> = {
      ...newClass,
      students: [],
      created_at: new Date().toISOString(),
    };

    const tempId = `temp_${Date.now()}`;
    const tempClass: Class = {
      id: tempId,
      ...newClass,
      students: [],
      created_at: new Date().toISOString(),
      createdBy: user.id,
    };

    setClasses([tempClass, ...classes]);
    setShowAddDialog(false);
    setNewClass({
      class_name: "",
      course_subject: "",
      year: "",
      room: "",
    });

    toast.success("Class added successfully");

    try {
      const newClassDoc = await createClass(
        classToAdd,
        user.id,
        user.instructorId,
      );
      setClasses((prevClasses) =>
        prevClasses.map((c) => (c.id === tempId ? newClassDoc : c)),
      );

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

      // Refresh page to update sidebar exam link status
      window.location.reload();
    } catch (error) {
      console.error("Error saving class to Firebase:", error);
      setClasses((prevClasses) => prevClasses.filter((c) => c.id !== tempId));
      toast.error("Failed to save class to database. Please try again.");

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

  const handleArchive = async (classId: string) => {
    try {
      const classToArchive = classes.find((c) => c.id === classId);
      const examsToArchive = await getExamsByClassId(classId);

      // Show warning toast about exams being archived
      if (examsToArchive.length > 0) {
        toast.warning(
          `Archiving ${examsToArchive.length} linked exam${examsToArchive.length !== 1 ? "s" : ""} along with this class...`,
          {
            position: "top-right",
            duration: 4000,
          }
        );
      }

      // Archive all exams connected to this class
      for (const exam of examsToArchive) {
        await archiveExam(exam.id);
        
        // Log exam archiving
        if (user?.email) {
          AuditLogger.logActivity(
            user.id,
            user.email,
            "admin_action",
            `Archived exam: ${exam.title} (from class archive)`,
            {
              entityId: exam.id,
              entityName: exam.title,
              entityType: "exam",
            },
          ).catch(console.error);
        }
      }
      
      // Archive the class
      await updateClass(classId, { isArchived: true });

      // Log class archiving
      if (user && classToArchive) {
        AuditLogger.logActivity(
          user.id,
          user.email || "unknown",
          "admin_action",
          `Archived class: ${classToArchive.class_name}`,
          {
            entityId: classId,
            entityName: classToArchive.class_name,
            entityType: "class",
          },
        ).catch(console.error);
      }

      setClasses((prev) => prev.filter((c) => c.id !== classId));
      toast.success("Class and its exams archived successfully");
    } catch (error) {
      console.error("Error archiving class:", error);
      toast.error("Failed to archive class");
    }
  };

  const filteredClasses = classes.filter(
    (c) =>
      c.class_name.toLowerCase().includes(search.toLowerCase()) ||
      c.course_subject.toLowerCase().includes(search.toLowerCase()) ||
      c.year?.toLowerCase().includes(search.toLowerCase()),
  );

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center min-h-[55vh]">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            Classes
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Create and manage your classes and students.
          </p>
        </div>
        <div className="flex w-full sm:w-auto justify-end gap-3">
          <Button
            onClick={() => setShowAddDialog(true)}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
          >
            <Plus className="w-4 h-4" />
            Add Class
          </Button>
        </div>
      </div>

      <div className="mb-6">
        <div className="relative">
          <style>{`
            input:-webkit-autofill,
            input:-webkit-autofill:focus,
            input:-webkit-autofill:hover,
            input:-webkit-autofill:active {
              -webkit-box-shadow: 0 0 0 1000px #fff inset !important;
              box-shadow: 0 0 0 1000px #fff inset !important;
              border: 1px solid #e5e7eb !important;
              outline: none !important;
            }
            .search-override,
            .search-override:focus,
            .search-override:active {
              border-color: #e5e7eb !important;
              box-shadow: none !important;
              outline: none !important;
            }
          `}</style>
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none z-10" />
          <Input
            placeholder="Search classes by name, course, or year..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-override pl-12 h-12 bg-white border border-gray-200 shadow-sm rounded-xl text-sm focus:outline-none focus:ring-0 focus:border-gray-300"
            autoComplete="off"
          />
        </div>
      </div>

      {!loading && filteredClasses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white border border-dashed border-gray-200 rounded-2xl">
          <GraduationCap className="w-16 h-16 text-gray-200 mb-4" />
          <p className="text-gray-500 text-lg font-medium">
            {search ? "No classes match your search" : "No classes created yet"}
          </p>
          {!search && (
            <Button
              variant="link"
              className="mt-2 text-[#22c55e] hover:text-[#16a34a] font-semibold"
              onClick={() => setShowAddDialog(true)}
            >
              Start by creating your first class
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClasses.map((classItem) => (
            <Card
              key={classItem.id}
              className="group bg-white border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden flex flex-col h-full rounded-2xl border-b-4 border-b-green-500/10 hover:border-b-green-500/40 relative"
              onClick={() => {
                router.push(`/classes/edit/${classItem.id}`);
              }}
            >
              <CardContent className="p-6 flex flex-col h-full">
                {/* Top row: icon + year badge */}
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-green-100 transition-colors">
                    <GraduationCap className="w-6 h-6 text-green-600" />
                  </div>
                  {classItem.year && (
                    <div className="px-2.5 py-1 bg-green-50 text-green-700 rounded-full text-[10px] font-bold uppercase tracking-wider border border-green-100">
                      Year {classItem.year}
                    </div>
                  )}
                </div>

                {/* Body */}
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-gray-900 group-hover:text-green-700 transition-colors line-clamp-1 mb-1">
                    {classItem.class_name}
                  </h3>
                  <p className="text-sm text-gray-500 font-medium line-clamp-1">
                    {classItem.course_subject}
                  </p>

                  <div className="mt-4 flex flex-col gap-2">
                    {classItem.section_block && (
                      <div className="flex items-center gap-2 text-gray-400">
                        <span className="text-sm font-bold opacity-30">#</span>
                        <span className="text-xs font-mono font-bold tracking-tight text-gray-600">
                          {classItem.section_block}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-gray-400">
                      <Calendar className="w-3.5 h-3.5 opacity-60" />
                      <span className="text-[11px] font-bold">
                        {classItem.created_at
                          ? new Date(classItem.created_at).toLocaleDateString("en-US", {
                              month: "short", day: "numeric", year: "numeric",
                            })
                          : "---"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer: students count + archive button */}
                <div className="mt-6 pt-4 border-t border-gray-50 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                      <Users className="w-4 h-4 text-blue-600" />
                    </div>
                    <span className="text-xs font-bold text-gray-700">
                      {classItem.students.length}{" "}
                      <span className="text-[10px] font-normal text-gray-400 uppercase tracking-tight">
                        Students
                      </span>
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleArchive(classItem.id);
                      }}
                      title="Archive Class"
                    >
                      <Archive className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
                Fill in the details to create a new class
              </DialogDescription>
            </div>
          </div>

          <div className="px-6 py-6 border-b border-gray-100">
            <div className="space-y-6">
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
                      <p className="text-xs text-red-500">
                        Minimum 3 characters
                      </p>
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
                      setNewClass({
                        ...newClass,
                        course_subject: e.target.value,
                      })
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
                      <p className="text-xs text-red-500">
                        Minimum 4 characters
                      </p>
                    )}
                </div>

                {/* Year */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold  text-gray-500 uppercase tracking-wide">
                    YEAR LEVEL <span className="text-red-500">*</span>
                  </label>
                  <Select
                    value={newClass.year || ""}
                    onValueChange={(value) =>
                      setNewClass({ ...newClass, year: value })
                    }
                  >
                    <SelectTrigger
                      className={`h-9 text-sm border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500  transition-colors ${
                        newClass.year
                          ? "border-green-400 bg-green-50"
                          : "border-gray-200"
                      }`}
                    >
                      <SelectValue placeholder="Select year level" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem
                        value="1"
                        className="focus:bg-green-50 focus:text-green-700"
                      >
                        1st Year
                      </SelectItem>
                      <SelectItem
                        value="2"
                        className="focus:bg-green-50 focus:text-green-700"
                      >
                        2nd Year
                      </SelectItem>
                      <SelectItem
                        value="3"
                        className="focus:bg-green-50 focus:text-green-700"
                      >
                        3rd Year
                      </SelectItem>
                      <SelectItem
                        value="4"
                        className="focus:bg-green-50 focus:text-green-700"
                      >
                        4th Year
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Room */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    ROOM{" "}
                    <span className="text-gray-400 text-xs normal-case font-normal">
                      (optional)
                    </span>
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
                      setNewClass({
                        ...newClass,
                        room: inputValue.slice(0, 3),
                      });
                    }}
                    placeholder="3-digit room number"
                    className="h-9 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-colors"
                  />
                  {roomWarning && (
                    <p className="text-xs text-red-500">
                      Room number must be exactly 3 digits
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100">
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
    </div>
  );
}
