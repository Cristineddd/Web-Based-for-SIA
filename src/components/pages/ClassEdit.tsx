"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  Tag,
  Save,
  Users,
  Upload,
  Download,
  Plus,
  X,
  Search,
  ArrowUpDown,
  Edit3,
  FileText,
  Mail,
  BarChart3,
  Archive,
  Pencil,
  RefreshCw,
} from "lucide-react";
import {
  getClassById,
  updateClass,
  Class,
  Student as BaseStudent,
} from "@/services/classService";
import {
  getExamsByClassId,
  getExams,
  updateExam,
  archiveExam,
  type Exam,
} from "@/services/examService";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { CreateExamModal } from "@/components/modals/CreateExamModal";
import { AuditLogger } from "@/services/auditLogger";
import { BackButton } from "@/components/ui/BackButton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import * as XLSX from "xlsx";

// Extended Student interface for editing with additional fields
interface Student extends BaseStudent {
  section?: string;
  grade?: string;
  middle_name?: string;
}

interface ClassEditProps {
  classId?: string;
}

export default function ClassEdit({ classId: propClassId }: ClassEditProps) {
  const router = useRouter();
  const { user } = useAuth();
  const searchParams = useSearchParams();
  // Use prop classId if provided, otherwise fall back to search params
  const classId = propClassId || searchParams.get("id");

  const [classData, setClassData] = useState<Class | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [stats, setStats] = useState({
    examCount: 0,
  });
  const [activeTab, setActiveTab] = useState<"students" | "exams" | "stats">("students");
  const [exams, setExams] = useState<Exam[]>([]);
  const [allExams, setAllExams] = useState<Exam[]>([]);
  const [newStudent, setNewStudent] = useState({
    student_id: "",
    first_name: "",
    last_name: "",
    middle_name: "",
    email: "",
  });

  const [fieldErrors, setFieldErrors] = useState({
    student_id: "",
    first_name: "",
    last_name: "",
    middle_name: "",
  });
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [sortBy, setSortBy] = useState<
    "student_id" | "first_name" | "last_name" | "middle_name"
  >("student_id");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [showCreateExam, setShowCreateExam] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [studentToDeleteId, setStudentToDeleteId] = useState<string | null>(null);
  const [isEditingStudents, setIsEditingStudents] = useState(false);
  const [editingStudentsData, setEditingStudentsData] = useState<Student[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    subject: "",
    num_items: 0,
    choices_per_item: 4,
    examType: "board" as "board" | "diagnostic",
    examCode: "",
    courseCode: "",
    institutionName: "",
    logoUrl: "",
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Derived stats from exam data
  const examsWithData = useMemo(
    () => exams.filter((e) => (e.scannedCount ?? 0) > 0 && e.averageScore != null),
    [exams]
  );

  const classAverage = useMemo(() => {
    if (examsWithData.length === 0) return null;
    const totalScanned = examsWithData.reduce((s, e) => s + (e.scannedCount ?? 0), 0);
    const weightedSum = examsWithData.reduce(
      (s, e) => s + parseFloat(e.averageScore ?? "0") * (e.scannedCount ?? 0),
      0
    );
    return Math.round(weightedSum / totalScanned);
  }, [examsWithData]);

  const passRate = useMemo(() => {
    if (examsWithData.length === 0) return null;
    const totalScanned = examsWithData.reduce((s, e) => s + (e.scannedCount ?? 0), 0);
    // Weight exams that averaged >= 60% (passing threshold)
    const passingScanned = examsWithData
      .filter((e) => parseFloat(e.averageScore ?? "0") >= 60)
      .reduce((s, e) => s + (e.scannedCount ?? 0), 0);
    return Math.round((passingScanned / totalScanned) * 100);
  }, [examsWithData]);

  useEffect(() => {
    if (!classId) {
      router.push("/classes");
      return;
    }

    const fetchClassData = async () => {
      try {
        const [data, fetchedExams] = await Promise.all([
          getClassById(classId),
          getExamsByClassId(classId),
        ]);

        if (data) {
            setClassData(data);
            setExams(fetchedExams);
            setStats({
              examCount: fetchedExams.length,
            });
        }
      } catch (error) {
        console.error("Error fetching class:", error);
        toast.error("Failed to load class data");
        router.push("/classes");
      } finally {
        setLoading(false);
      }
    };

    fetchClassData();
  }, [classId, router]);

  useEffect(() => {
    if (activeTab === "exams" && classId) {
        const fetchAllExams = async () => {
            try {
                const data = await getExams(user?.id);
                // Filter out exams already in this class
                setAllExams(data.filter(e => e.classId !== classId));
            } catch (err) {
                console.error(err);
            }
        };
        fetchAllExams();
    }
  }, [activeTab, classId, user?.id]);

  const handleEditExam = (exam: Exam) => {
    setEditingExam(exam);
    setEditForm({
      title: exam.title,
      subject: exam.subject,
      num_items: exam.num_items,
      choices_per_item: exam.choices_per_item || 4,
      examType: (exam.examType as any) || "board",
      examCode: exam.examCode || "",
      courseCode: exam.courseCode || "",
      institutionName: exam.institutionName || "",
      logoUrl: exam.logoUrl || "",
    });
  };

  const handleSaveEdit = async () => {
    if (!editingExam) return;
    if (!editForm.title.trim()) {
      toast.error("Exam name is required");
      return;
    }
    if (!editForm.num_items || editForm.num_items < 1) {
      toast.error("Number of items must be at least 1");
      return;
    }
    try {
      setIsSavingEdit(true);
      const updated: Partial<Exam> = {
        title: editForm.title.trim(),
        subject: editForm.subject.trim(),
        num_items: editForm.num_items,
        choices_per_item: editForm.choices_per_item,
        examType: editForm.examType,
        examCode: editForm.examCode.trim().toUpperCase(),
        courseCode: editForm.courseCode.trim(),
        institutionName: editForm.institutionName,
        logoUrl: editForm.logoUrl,
      };
      await updateExam(editingExam.id, updated);
      // Delete any existing template so a fresh one can be generated
      const templateQuery = query(
        collection(db, "templates"),
        where("examId", "==", editingExam.id),
      );
      const templateSnap = await getDocs(templateQuery);
      if (!templateSnap.empty) {
        await Promise.all(templateSnap.docs.map((d) => deleteDoc(d.ref)));
        toast.info("Existing template deleted — please generate a new one.");
      }
      setExams((prev) =>
        prev.map((e) =>
          e.id === editingExam.id
            ? {
                ...e,
                ...updated,
                updatedAt: new Date().toISOString(),
                hasTemplate: false,
              }
            : e,
        ),
      );
      toast.success("Exam updated successfully");
      if (user?.email) {
        AuditLogger.logActivity(
          user.id,
          user.email,
          "exam_updated",
          `Updated exam: ${editForm.title.trim()}`,
          { entityId: editingExam.id, entityType: "exam" },
        ).catch(console.error);
      }
      setEditingExam(null);
    } catch (error) {
      console.error("Error updating exam:", error);
      toast.error("Failed to update exam");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleArchiveExam = async (examId: string, examTitle: string) => {
    try {
      await archiveExam(examId);
      setExams((prev) => prev.filter((e) => e.id !== examId));
      toast.success(`"${examTitle}" has been archived`);
    } catch (error) {
      console.error("Error archiving exam:", error);
      toast.error("Failed to archive exam");
    }
  };

  const handleCreateExam = async (formData: any) => {
    try {
      if (!user?.id || !user.instructorId) {
        toast.error("You must be logged in to create an exam");
        return;
      }

      const examData = {
        ...formData,
        instructorId: user.instructorId,
        createdBy: user.id,
        classId: classId,
        className: classData?.class_name || "",
        created_at: new Date().toISOString(),
      };

      const { createExam } = await import("@/services/examService");
      const newExam = await createExam(examData, user.id, user.instructorId);

      if (user.email) {
        AuditLogger.logActivity(user.id, user.email, "exam_created", `Created exam: ${formData.name}`, {
          entityId: newExam.id,
          entityType: "exam",
        }).catch(console.error);
      }

      setExams((prev) => [newExam, ...prev]);
      toast.success(`Exam "${formData.name}" created successfully`);
      setShowCreateExam(false);
    } catch (error) {
      console.error("Error creating exam:", error);
      toast.error("Failed to create exam");
    }
  };

  const handleExportRoster = () => {
    const students = classData?.students || [];
    if (students.length === 0) {
      toast.error("No students to export");
      return;
    }
    try {
      const wsData = [
        ["Student ID", "First Name", "Last Name", "Middle Name", "Email"],
        ...students.map((s) => [
          s.student_id || "",
          s.first_name || "",
          s.last_name || "",
          (s as any).middle_name || "",
          (s as any).email || "",
        ]),
      ];
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, "Roster");
      XLSX.writeFile(wb, `${classData?.class_name || "class"}_${classData?.course_subject || "roster"}.xlsx`);
      toast.success(`Exported ${students.length} student(s) successfully`);
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Failed to export roster");
    }
  };

  const handleSave = async () => {
    if (!classData) return;

    // Validation rules (same as class creation)
    // Validate Class Name
    if (!classData.class_name.trim()) {
      toast.error("Program name is required");
      return;
    }
    if (classData.class_name.trim().length < 3) {
      toast.error("Program name must be at least 3 characters long");
      return;
    }
    if (!/^[a-zA-ZñÑ\s]+$/.test(classData.class_name.trim())) {
      toast.error("Program name can only contain letters and spaces");
      return;
    }

    // Validate Course Subject
    if (!classData.course_subject.trim()) {
      toast.error("Course subject is required");
      return;
    }
    if (classData.course_subject.trim().length < 4) {
      toast.error("Course subject must be at least 4 characters long");
      return;
    }

    // Validate Year (optional)
    if (classData.year && !/^[1-4]$/.test(classData.year.trim())) {
      toast.error("Year must be between 1-4");
      return;
    }

    // Validate Room
    if (!classData.room.trim()) {
      toast.error("Room is required");
      return;
    }
    if (!/^[0-9]{3}$/.test(classData.room.trim())) {
      toast.error("Room must be exactly 3 digits (e.g., 101, 205, 312)");
      return;
    }

    // Validate students
    for (let i = 0; i < classData.students.length; i++) {
      const student = classData.students[i];

      // Student ID validation
      if (
        !student.student_id ||
        !/^\d{9}$/.test(student.student_id) ||
        !student.student_id.startsWith("20")
      ) {
        toast.error(
          `Student ${i + 1}: Invalid Student ID. Must be 9 digits starting with '20'`,
        );
        return;
      }

      // First name validation
      if (
        !student.first_name ||
        !/^[a-zA-ZñÑ\s]+$/.test(student.first_name) ||
        student.first_name.length < 4
      ) {
        toast.error(
          `Student ${i + 1}: First name must be at least 4 characters and contain only letters`,
        );
        return;
      }

      // Last name validation
      if (
        !student.last_name ||
        !/^[a-zA-ZñÑ\s]+$/.test(student.last_name) ||
        student.last_name.length < 4
      ) {
        toast.error(
          `Student ${i + 1}: Last name must be at least 4 characters and contain only letters`,
        );
        return;
      }

      // Email validation (optional but must be valid if provided)
      if (student.email && student.email.trim()) {
        const email = student.email.trim();
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(email)) {
          toast.error(`Student ${i + 1}: Invalid email format`);
          return;
        }
      }
    }

    setSaving(true);
    try {
      await updateClass(classData.id, {
        class_name: classData.class_name.trim(),
        course_subject: classData.course_subject.trim(),
        year: classData.year?.trim() || undefined,
        room: classData.room.trim(),
        students: classData.students,
        updatedAt: new Date().toISOString(),
      });

      toast.success("Class updated successfully");

      // Navigate back to classes page after successful save
      setTimeout(() => {
        router.push("/classes");
      }, 1500); // Small delay to let user see the success message
    } catch (error) {
      console.error("Error updating class:", error);
      toast.error("Failed to update class");
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Student ID", "First Name", "Last Name", "Middle Name (Optional)"],
      ["201234567", "Juan", "Dela Cruz", "Santos"],
    ]);
    ws["!cols"] = [{ wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 25 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, "student_import_template.xlsx");
  };

  const handleSaveMultipleStudents = async () => {
    if (!classData) return;
    const errors: string[] = [];
    editingStudentsData.forEach((s, i) => {
      if (!s.student_id || !/^\d{9}$/.test(s.student_id) || !s.student_id.startsWith("20"))
        errors.push(`Row ${i + 1}: Invalid Student ID "${s.student_id}"`);
      else if (!s.first_name || !/^[a-zA-Z\u00c0-\u024f\s]+$/i.test(s.first_name) || s.first_name.length < 4)
        errors.push(`Row ${i + 1}: Invalid First Name`);
      else if (!s.last_name || !/^[a-zA-Z\u00c0-\u024f\s]+$/i.test(s.last_name) || s.last_name.length < 4)
        errors.push(`Row ${i + 1}: Invalid Last Name`);
    });
    if (errors.length > 0) {
      toast.error(errors.slice(0, 3).join("\n") + (errors.length > 3 ? `\n...and ${errors.length - 3} more` : ""));
      return;
    }
    const ids = editingStudentsData.map((s) => s.student_id);
    const dupIds = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (dupIds.length > 0) {
      toast.error(`Duplicate Student IDs: ${[...new Set(dupIds)].join(", ")}`);
      return;
    }
    try {
      await updateClass(classData.id, {
        students: editingStudentsData,
        updatedAt: new Date().toISOString(),
      });
      setClassData({ ...classData, students: editingStudentsData });
      toast.success("Students saved successfully");
      setIsEditingStudents(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to save changes");
    }
  };

  const handleImportStudents = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset input early so re-selecting the same file triggers onChange
    event.target.value = "";

    if (
      !file.name.toLowerCase().endsWith(".xlsx") &&
      !file.name.toLowerCase().endsWith(".xls")
    ) {
      toast.error("Please select an Excel file (.xlsx or .xls)");
      return;
    }

    if (!classData) {
      toast.error("Class data not loaded yet. Please wait and try again.");
      return;
    }

    const normalizeHeader = (h: unknown) =>
      String(h ?? "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/[()]/g, "")
        .replace(/[^a-z0-9 ]/g, "");

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = reader.result;
        if (!(data instanceof ArrayBuffer)) {
          toast.error("Failed to read file");
          return;
        }

        const wb = XLSX.read(data, { type: "array" });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];

        // Parse as array-of-arrays to avoid header quirks
        const aoa = XLSX.utils.sheet_to_json(ws, {
          header: 1,
          defval: "",
          blankrows: false,
        }) as unknown[][];

        if (aoa.length < 2) {
          toast.error(
            "No student rows detected. Please check the template format.",
          );
          return;
        }

        const headerRow = (aoa[0] || []).map(normalizeHeader);

        const aliasesStudentId = new Set(["student id", "studentid", "id"]);
        const aliasesFirst = new Set(["first name", "firstname", "first"]);
        const aliasesLast = new Set(["last name", "lastname", "last"]);
        const aliasesEmail = new Set([
          "email",
          "email optional",
          "email optional ",
          "e mail",
          "e mail optional",
        ]);

        const findCol = (aliases: Set<string>) =>
          headerRow.findIndex((h) => aliases.has(h));

        const colStudentId = findCol(aliasesStudentId);
        const colFirst = findCol(aliasesFirst);
        const colLast = findCol(aliasesLast);
        const colEmail = findCol(aliasesEmail);

        let parsed: Student[];
        if (colStudentId === -1 || colFirst === -1 || colLast === -1) {
          // Fallback: assume A-D (Student ID, First Name, Last Name, Email)
          parsed = aoa
            .slice(1)
            .filter((row) =>
              row.some((cell) => String(cell ?? "").trim() !== ""),
            )
            .map((row) => {
              const student_id = String(row[0] ?? "").trim();
              const first_name = String(row[1] ?? "").trim();
              const last_name = String(row[2] ?? "").trim();
              const email = String(row[3] ?? "").trim();
              return {
                student_id,
                first_name,
                last_name,
                ...(email ? { email } : {}),
              } as Student;
            });
        } else {
          parsed = aoa
            .slice(1)
            .filter((row) =>
              row.some((cell) => String(cell ?? "").trim() !== ""),
            )
            .map((row) => {
              const student_id = String(row[colStudentId] ?? "").trim();
              const first_name = String(row[colFirst] ?? "").trim();
              const last_name = String(row[colLast] ?? "").trim();
              const email =
                colEmail >= 0 ? String(row[colEmail] ?? "").trim() : "";
              return {
                student_id,
                first_name,
                last_name,
                ...(email ? { email } : {}),
              } as Student;
            });
        }

        if (parsed.length === 0) {
          toast.error(
            "No student rows detected. Please check the template format.",
          );
          return;
        }

        // Validation (block blanks)
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        const invalidRows: string[] = [];
        parsed.forEach((s, i) => {
          if (
            !s.student_id ||
            !/^\d{9}$/.test(s.student_id) ||
            !s.student_id.startsWith("20")
          ) {
            invalidRows.push(`Row ${i + 2}: Invalid Student ID`);
            return;
          }
          if (
            !s.first_name ||
            !/^[a-zA-ZñÑ\s]+$/.test(s.first_name) ||
            s.first_name.length < 4
          ) {
            invalidRows.push(`Row ${i + 2}: Invalid First Name`);
            return;
          }
          if (
            !s.last_name ||
            !/^[a-zA-ZñÑ\s]+$/.test(s.last_name) ||
            s.last_name.length < 4
          ) {
            invalidRows.push(`Row ${i + 2}: Invalid Last Name`);
            return;
          }
          if (s.email && s.email.trim() && !emailRegex.test(s.email.trim())) {
            invalidRows.push(`Row ${i + 2}: Invalid Email`);
          }
        });

        if (invalidRows.length > 0) {
          toast.error(
            `Import blocked. Fix these issues:\n${invalidRows.slice(0, 5).join("\n")}${invalidRows.length > 5 ? `\n...and ${invalidRows.length - 5} more` : ""}`,
          );
          return;
        }

        // Duplicate checks
        const seen = new Set<string>();
        const dupInFile = new Set<string>();
        parsed.forEach((s) => {
          if (seen.has(s.student_id)) dupInFile.add(s.student_id);
          seen.add(s.student_id);
        });
        if (dupInFile.size > 0) {
          toast.error(
            `Duplicate Student ID(s) in file: ${Array.from(dupInFile).join(", ")}`,
          );
          return;
        }

        const existingIds = new Set(
          classData.students.map((s) => s.student_id),
        );
        const conflicts = parsed.filter((s) => existingIds.has(s.student_id));
        if (conflicts.length > 0) {
          toast.error(
            `These Student ID(s) already exist in this class: ${Array.from(new Set(conflicts.map((c) => c.student_id))).join(", ")}`,
          );
          return;
        }

        const newStudents = [...classData.students, ...parsed];
        setClassData({ ...classData, students: newStudents });

        try {
          await updateClass(classData.id, {
            students: newStudents,
            updatedAt: new Date().toISOString(),
          });
          toast.success(`Imported ${parsed.length} student(s) — saved automatically.`);
        } catch (saveErr) {
          console.error("Auto-save after import failed:", saveErr);
          toast.error(`Imported ${parsed.length} student(s) locally, but save failed. Please retry.`);
        }
      } catch (err) {
        console.error("Error importing students:", err);
        toast.error(
          "Failed to import students. Please check the file and try again.",
        );
      }
    };
    reader.onerror = () => toast.error("Failed to read file");
    reader.readAsArrayBuffer(file);
  };

  // ── Field validators (called on every onChange for real-time feedback) ──
  const LETTERS_ONLY = /^[a-zA-ZñÑ\s.]+$/;

  const validateStudentId = (
    value: string,
    students: BaseStudent[],
  ): string => {
    if (!value) return "Student ID is required";
    if (!/^\d+$/.test(value))
      return "Numbers only — letters and symbols not allowed";
    if (!value.startsWith("20")) return 'Student ID must start with "20"';
    if (value.length < 9) return `${9 - value.length} more digit(s) needed`;
    if (value.length > 9) return "Student ID must be exactly 9 digits";
    if (students.some((s) => s.student_id === value))
      return "Duplicate — this ID already exists in this class";
    return "";
  };

  const validateName = (
    value: string,
    field: "first_name" | "last_name" | "middle_name",
    students: BaseStudent[],
    draft: { first_name: string; last_name: string; middle_name: string },
  ): string => {
    if (field === "middle_name") {
      if (!value) return ""; // optional
      if (!LETTERS_ONLY.test(value))
        return "Letters only — numbers and symbols not allowed";
    } else {
      const label = field === "first_name" ? "First" : "Last";
      if (!value) return `${label} name is required`;
      if (!LETTERS_ONLY.test(value))
        return "Letters only — numbers and symbols not allowed";
      if (value.trim().length < 4) return "Minimum 4 characters required";
    }

    // Build the full name we're about to check, using `value` for the field being changed
    const fn = (field === "first_name" ? value : draft.first_name)
      .trim()
      .toLowerCase();
    const ln = (field === "last_name" ? value : draft.last_name)
      .trim()
      .toLowerCase();
    const mn = (field === "middle_name" ? value : draft.middle_name)
      .trim()
      .toLowerCase();

    // Only run duplicate check once both required fields have content
    if (fn && ln) {
      const isDuplicate = students.some((s) => {
        const sf = s.first_name.trim().toLowerCase();
        const sl = s.last_name.trim().toLowerCase();
        const sm = ((s as Student).middle_name ?? "").trim().toLowerCase();
        return sf === fn && sl === ln && sm === mn;
      });
      if (isDuplicate) {
        return mn
          ? "Duplicate — a student with this full name already exists"
          : "Duplicate — a student with this first and last name already exists";
      }
    }

    return "";
  };

  const handleAddStudent = async () => {
    if (!classData) return;

    const students = classData.students;
    const draft = {
      first_name: newStudent.first_name,
      last_name: newStudent.last_name,
      middle_name: newStudent.middle_name,
    };

    // Re-run all validations before submit
    const errors = {
      student_id: validateStudentId(newStudent.student_id, students),
      first_name: validateName(
        newStudent.first_name,
        "first_name",
        students,
        draft,
      ),
      last_name: validateName(
        newStudent.last_name,
        "last_name",
        students,
        draft,
      ),
      middle_name: validateName(
        newStudent.middle_name,
        "middle_name",
        students,
        draft,
      ),
    };
    setFieldErrors(errors);
    if (Object.values(errors).some((e) => e !== "")) return;

    const student: Student = {
      student_id: newStudent.student_id,
      first_name: newStudent.first_name,
      last_name: newStudent.last_name,
      ...(newStudent.middle_name.trim() && {
        middle_name: newStudent.middle_name.trim(),
      }),
      ...(newStudent.email.trim() && { email: newStudent.email.trim() }),
    };

    const updatedStudents = [...classData.students, student];
    setClassData({ ...classData, students: updatedStudents });
    setNewStudent({
      student_id: "",
      first_name: "",
      last_name: "",
      middle_name: "",
      email: "",
    });
    setFieldErrors({
      student_id: "",
      first_name: "",
      last_name: "",
      middle_name: "",
    });
    setShowAddStudent(false);

    // Auto-save immediately — no manual Save button needed
    try {
      await updateClass(classData.id, {
        students: updatedStudents,
        updatedAt: new Date().toISOString(),
      });
      toast.success(`Student added and saved (ID: ${student.student_id})`);
    } catch (error) {
      console.error("Auto-save failed:", error);
      toast.error(
        "Student added locally but failed to save. Please use Save Changes.",
      );
    }
  };

  const handleRemoveStudent = (studentId: string) => {
    if (!classData) return;
    const updatedStudents = classData.students.filter(
      (s) => s.student_id !== studentId,
    );
    setClassData({ ...classData, students: updatedStudents });
    toast.success("Student removed from roster");
  };

  const handleSort = (
    field: "student_id" | "first_name" | "last_name" | "middle_name",
  ) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  const handleTagExam = async (examId: string) => {
    if (!classData || !examId) return;
    
    const selectedExam = allExams.find(e => e.id === examId);
    if (!selectedExam) return;

    try {

        await updateExam(examId, {
            classId: classData.id,
            className: classData.class_name
        });
        
        toast.success(`Tagged "${selectedExam.title}" to this class`);
        
        // Refresh exams
        const updatedExams = await getExamsByClassId(classData.id);
        setExams(updatedExams);
        setStats(prev => ({ ...prev, examCount: updatedExams.length }));
        
        // Update allExams (remove the tagged one)
        setAllExams(prev => prev.filter(e => e.id !== examId));
    } catch (err) {
        console.error(err);
        toast.error("Failed to tag exam");
    }
  };

  const filteredAndSortedStudents = classData
    ? classData.students
        .filter((student) => {
          if (!studentSearch.trim()) return true;
          const query = studentSearch.toLowerCase();
          return (
            student.student_id.toLowerCase().includes(query) ||
            student.first_name.toLowerCase().includes(query) ||
            student.last_name.toLowerCase().includes(query) ||
            ((student as Student).middle_name || "")
              .toLowerCase()
              .includes(query)
          );
        })
        .sort((a, b) => {
          const getVal = (s: Student) => {
            if (sortBy === "middle_name") return s.middle_name || "";
            return s[sortBy] || "";
          };
          const aVal = getVal(a as Student).toLowerCase();
          const bVal = getVal(b as Student).toLowerCase();
          if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
          if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
          return 0;
        })
    : [];

  const tabItems = [
    { id: "students", label: `Students (${classData?.students?.length || 0})`, icon: Users },
    { id: "exams", label: `Exams (${stats.examCount})`, icon: FileText },
    { id: "stats", label: "Stats", icon: BarChart3 }
  ] as const;

  if (loading) {
    return (
      <div className="page-container">
        <div className="text-center py-12">Loading class data...</div>
      </div>
    );
  }

  if (!classData) {
    return (
      <div className="page-container">
        <div className="text-center py-12">Class not found</div>
      </div>
    );
  }

  return (
    <div className="page-container pb-4">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <BackButton href="/classes" />
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
            {classData.class_name}{" "}
            {classData.course_subject ? `– ${classData.course_subject}` : ""}
          </h1>
          <p className="text-sm text-gray-500 font-medium">
            Class Details &amp; Management
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Class Information Panel */}
        <Card className="border border-gray-100 shadow-sm rounded-xl bg-white">
          <CardHeader className="bg-white px-6 pt-6 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-[17px] font-bold text-[#1e293b] border-none">
                Class Information
              </CardTitle>
              <div className="flex items-center gap-2">
                {!isEditingInfo ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingInfo(true)}
                    className="h-9 px-3 text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-all rounded-lg font-bold flex items-center gap-1.5"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit Info
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingInfo(false)}
                      className="h-9 px-3 text-gray-400 hover:bg-gray-50 transition-all rounded-lg font-medium"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={async () => {
                        await handleSave();
                        setIsEditingInfo(false);
                      }}
                      disabled={saving}
                      className="h-9 px-4 bg-green-500 hover:bg-green-600 text-white transition-all rounded-lg font-bold flex items-center gap-1.5 shadow-sm"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {saving ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6 pt-4">
            {!isEditingInfo ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0 bg-white rounded-xl border border-gray-100">
                <div className="space-y-1.5 pl-5 py-5">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                    Program
                  </label>
                  <p className="text-[15px] font-bold text-[#1e293b]">
                    {classData.class_name}
                  </p>
                </div>
                <div className="space-y-1.5 border-l border-gray-100 pl-5 py-5">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                    Course
                  </label>
                  <p className="text-[15px] font-bold text-[#1e293b] truncate pr-2">
                    {classData.course_subject}
                  </p>
                </div>
                <div className="space-y-1.5 border-l border-gray-100 pl-5 py-5">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                    Year Level
                  </label>
                  <p className="text-[15px] font-bold text-[#1e293b]">
                    {classData.year
                      ? `${classData.year}${classData.year === "1" ? "st" : classData.year === "2" ? "nd" : classData.year === "3" ? "rd" : "th"} Year`
                      : "—"}
                  </p>
                </div>
                <div className="space-y-1.5 border-l border-gray-100 pl-5 py-5">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                    Room
                  </label>
                  <p className="text-[15px] font-bold text-[#1e293b]">
                    {classData.room || "—"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <Label
                    htmlFor="class_name"
                    className="text-xs font-bold text-gray-500 uppercase tracking-wide"
                  >
                    Program *
                  </Label>
                  <Input
                    id="class_name"
                    value={classData.class_name}
                    onChange={(e) =>
                      setClassData({ ...classData, class_name: e.target.value })
                    }
                    className="h-10 border-gray-200 focus:ring-green-500/20 focus:border-green-600 transition-all rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="course_subject"
                    className="text-xs font-bold text-gray-500 uppercase tracking-wide"
                  >
                    Course *
                  </Label>
                  <Input
                    id="course_subject"
                    value={classData.course_subject}
                    onChange={(e) =>
                      setClassData({
                        ...classData,
                        course_subject: e.target.value,
                      })
                    }
                    className="h-10 border-gray-200 focus:ring-green-500/20 focus:border-green-600 transition-all rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="year"
                    className="text-xs font-bold text-gray-500 uppercase tracking-wide"
                  >
                    Year Level
                  </Label>
                  <Select
                    value={classData.year || "none"}
                    onValueChange={(value) =>
                      setClassData({
                        ...classData,
                        year: value === "none" ? undefined : value,
                      })
                    }
                  >
                    <SelectTrigger className="h-10 border-gray-200 focus:ring-green-500/20 focus:border-green-600 transition-all rounded-xl">
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="1">1st Year</SelectItem>
                      <SelectItem value="2">2nd Year</SelectItem>
                      <SelectItem value="3">3rd Year</SelectItem>
                      <SelectItem value="4">4th Year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="room"
                    className="text-xs font-bold text-gray-500 uppercase tracking-wide"
                  >
                    Room *
                  </Label>
                  <Input
                    id="room"
                    type="number"
                    value={classData.room}
                    onChange={(e) =>
                      setClassData({
                        ...classData,
                        room: e.target.value.slice(0, 3),
                      })
                    }
                    className="h-10 border-gray-200 focus:ring-green-500/20 focus:border-green-600 transition-all rounded-xl"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bottom Stats Section / Tabs */}
        <div className="flex items-center gap-8 border-b border-gray-100 px-2 mt-4">
          {tabItems.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 pb-4 pt-1 transition-all relative ${
                  isActive
                    ? "text-green-600 font-bold"
                    : "text-gray-400 hover:text-gray-600 font-medium"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-green-600" : "text-gray-300"}`} />
                <span className="text-sm">{tab.label}</span>
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-green-500 rounded-full" />
                )}
              </button>
            );
          })}
        </div>

        {activeTab === "students" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Student Roster */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              {/* Roster Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h2 className="text-base font-bold text-gray-900">Student Roster</h2>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportRoster}
                    className="flex items-center gap-2 border-gray-200 text-gray-700 hover:bg-gray-50 font-medium"
                  >
                    <Download className="w-4 h-4" />
                    Export
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowImportModal(true)}
                    className="flex items-center gap-2 border-gray-200 text-gray-700 hover:bg-gray-50 font-medium"
                  >
                    <Upload className="w-4 h-4" />
                    Import Excel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setShowAddStudent(true)}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Add Student
                  </Button>
                </div>
              </div>

              {/* Edit Multiple Students button row */}
              <div className="flex justify-end gap-2 px-6 py-2">
                {isEditingStudents ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingStudents(false)}
                      className="text-xs font-medium text-gray-500"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveMultipleStudents}
                      className="text-xs font-medium bg-green-600 hover:bg-green-700 text-white"
                    >
                      Save All
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingStudentsData(
                        (classData?.students ?? []).map((s) => ({ ...s })) as Student[]
                      );
                      setIsEditingStudents(true);
                    }}
                    className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-xs font-medium"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit Multiple Students
                  </Button>
                )}
              </div>

              {/* Search bar */}
              <div className="px-6 pb-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search by ID or name..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="pl-10 h-10 border-gray-100 rounded-xl bg-gray-50/30"
                  />
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-y border-gray-100 bg-gray-50/60">
                      <th
                        className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[130px] cursor-pointer select-none"
                        onClick={() => handleSort("student_id")}
                      >
                        <div className="flex items-center gap-1">
                          Student ID
                          {sortBy === "student_id" && <ArrowUpDown className="w-3 h-3" />}
                        </div>
                      </th>
                      <th
                        className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[150px] cursor-pointer select-none"
                        onClick={() => handleSort("first_name")}
                      >
                        <div className="flex items-center gap-1">
                          First Name
                          {sortBy === "first_name" && <ArrowUpDown className="w-3 h-3" />}
                        </div>
                      </th>
                      <th
                        className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[150px] cursor-pointer select-none"
                        onClick={() => handleSort("last_name")}
                      >
                        <div className="flex items-center gap-1">
                          Last Name
                          {sortBy === "last_name" && <ArrowUpDown className="w-3 h-3" />}
                        </div>
                      </th>
                      <th
                        className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[140px] cursor-pointer select-none"
                        onClick={() => handleSort("middle_name")}
                      >
                        <div className="flex items-center gap-1">
                          Middle Name
                          {sortBy === "middle_name" && <ArrowUpDown className="w-3 h-3" />}
                        </div>
                      </th>
                      <th className="w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {isEditingStudents
                      ? editingStudentsData.map((s, idx) => (
                          <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                            <td className="px-6 py-2">
                              <Input
                                value={s.student_id}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/[^0-9]/g, "").slice(0, 9);
                                  setEditingStudentsData((prev) =>
                                    prev.map((r, i) => (i === idx ? { ...r, student_id: val } : r))
                                  );
                                }}
                                className="h-7 text-xs font-mono w-full"
                                inputMode="numeric"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <Input
                                value={s.first_name}
                                onChange={(e) =>
                                  setEditingStudentsData((prev) =>
                                    prev.map((r, i) => (i === idx ? { ...r, first_name: e.target.value } : r))
                                  )
                                }
                                className="h-7 text-xs w-full"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <Input
                                value={s.last_name}
                                onChange={(e) =>
                                  setEditingStudentsData((prev) =>
                                    prev.map((r, i) => (i === idx ? { ...r, last_name: e.target.value } : r))
                                  )
                                }
                                className="h-7 text-xs w-full"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <Input
                                value={s.middle_name || ""}
                                onChange={(e) =>
                                  setEditingStudentsData((prev) =>
                                    prev.map((r, i) => (i === idx ? { ...r, middle_name: e.target.value } : r))
                                  )
                                }
                                className="h-7 text-xs w-full"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setEditingStudentsData((prev) => prev.filter((_, i) => i !== idx))
                                }
                                className="h-8 w-8 p-0 text-red-500 bg-red-50 hover:bg-red-100 transition-all rounded-lg"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        ))
                      : filteredAndSortedStudents.map((student) => {
                          const s = student as Student;
                          return (
                            <tr key={s.student_id} className="hover:bg-gray-50/60 transition-colors">
                              <td className="px-6 py-3 text-gray-700 font-mono text-xs">{s.student_id}</td>
                              <td className="px-4 py-3 text-gray-800 font-medium">{s.first_name}</td>
                              <td className="px-4 py-3 text-gray-800">{s.last_name}</td>
                              <td className="px-4 py-3 text-gray-500">
                                {s.middle_name || <span className="text-gray-300">—</span>}
                              </td>
                              <td className="px-4 py-3">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setStudentToDeleteId(s.student_id);
                                    setIsDeleteDialogOpen(true);
                                  }}
                                  className="h-8 w-8 p-0 text-red-500 bg-red-50 hover:bg-red-100 transition-all rounded-lg"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                    {!isEditingStudents && showAddStudent && (
                      <tr className="border-t-2 border-green-200 bg-green-50/30">
                        {/* Student ID */}
                        <td className="px-6 py-2 align-top">
                          <div>
                            <Input
                              value={newStudent.student_id}
                              onChange={(e) => {
                                const raw = e.target.value;
                                const numeric = raw.replace(/[^0-9]/g, "");
                                const val = numeric.slice(0, 9);
                                setNewStudent({ ...newStudent, student_id: val });
                                setFieldErrors((prev) => ({
                                  ...prev,
                                  student_id: validateStudentId(val, classData?.students ?? []),
                                }));
                              }}
                              placeholder="Student ID"
                              className={`border h-8 text-xs font-mono w-full ${
                                fieldErrors.student_id
                                  ? "border-red-400"
                                  : newStudent.student_id.length === 9 && !fieldErrors.student_id
                                  ? "border-green-400"
                                  : ""
                              }`}
                              inputMode="numeric"
                            />
                            {fieldErrors.student_id && (
                              <p className="text-[10px] text-red-500 mt-0.5 leading-tight">
                                {fieldErrors.student_id}
                              </p>
                            )}
                          </div>
                        </td>
                        {/* First Name */}
                        <td className="px-4 py-2 align-top">
                          <div>
                            <Input
                              value={newStudent.first_name}
                              onChange={(e) => {
                                const val = e.target.value;
                                setNewStudent({ ...newStudent, first_name: val });
                                setFieldErrors((prev) => ({
                                  ...prev,
                                  first_name: validateName(val, "first_name", classData?.students ?? [], {
                                    first_name: val,
                                    last_name: newStudent.last_name,
                                    middle_name: newStudent.middle_name,
                                  }),
                                }));
                              }}
                              placeholder="First Name"
                              className={`border h-8 text-xs w-full ${
                                fieldErrors.first_name
                                  ? "border-red-400"
                                  : newStudent.first_name.length >= 4 && !fieldErrors.first_name
                                  ? "border-green-400"
                                  : ""
                              }`}
                            />
                            {fieldErrors.first_name && (
                              <p className="text-[10px] text-red-500 mt-0.5 leading-tight">
                                {fieldErrors.first_name}
                              </p>
                            )}
                          </div>
                        </td>
                        {/* Last Name */}
                        <td className="px-4 py-2 align-top">
                          <div>
                            <Input
                              value={newStudent.last_name}
                              onChange={(e) => {
                                const val = e.target.value;
                                setNewStudent({ ...newStudent, last_name: val });
                                setFieldErrors((prev) => ({
                                  ...prev,
                                  last_name: validateName(val, "last_name", classData?.students ?? [], {
                                    first_name: newStudent.first_name,
                                    last_name: val,
                                    middle_name: newStudent.middle_name,
                                  }),
                                }));
                              }}
                              placeholder="Last Name"
                              className={`border h-8 text-xs w-full ${
                                fieldErrors.last_name
                                  ? "border-red-400"
                                  : newStudent.last_name.length >= 4 && !fieldErrors.last_name
                                  ? "border-green-400"
                                  : ""
                              }`}
                            />
                            {fieldErrors.last_name && (
                              <p className="text-[10px] text-red-500 mt-0.5 leading-tight">
                                {fieldErrors.last_name}
                              </p>
                            )}
                          </div>
                        </td>
                        {/* Middle Name */}
                        <td className="px-4 py-2 align-top">
                          <div>
                            <Input
                              value={newStudent.middle_name}
                              onChange={(e) => {
                                const val = e.target.value;
                                setNewStudent({ ...newStudent, middle_name: val });
                                setFieldErrors((prev) => ({
                                  ...prev,
                                  middle_name: validateName(val, "middle_name", classData?.students ?? [], {
                                    first_name: newStudent.first_name,
                                    last_name: newStudent.last_name,
                                    middle_name: val,
                                  }),
                                }));
                              }}
                              placeholder="Middle Name"
                              className={`border h-8 text-xs w-full ${
                                fieldErrors.middle_name ? "border-red-400" : ""
                              }`}
                            />
                            {fieldErrors.middle_name && (
                              <p className="text-[10px] text-red-500 mt-0.5 leading-tight">
                                {fieldErrors.middle_name}
                              </p>
                            )}
                          </div>
                        </td>
                        {/* Actions */}
                        <td className="px-4 py-2">
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleAddStudent}
                              className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowAddStudent(false)}
                              className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )}
                    {!isEditingStudents && filteredAndSortedStudents.length === 0 && !showAddStudent && (
                      <tr>
                        <td colSpan={5} className="px-6 py-10 text-center text-gray-400 text-sm">
                          <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                          No students in this class yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {studentSearch.trim() && (
                <div className="px-6 py-3 border-t border-gray-100 text-xs text-gray-400">
                  Showing {filteredAndSortedStudents.length} of {classData.students.length} students
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "exams" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="text-xl font-bold text-[#0f172a]">Exams for this Class</h3>
              <div className="flex items-center gap-3">
                <Select onValueChange={handleTagExam}>
                  <SelectTrigger className="w-[200px] h-10 border-gray-200 rounded-xl bg-white shadow-sm font-semibold text-xs text-gray-600">
                    <SelectValue placeholder="Tag Existing Exam..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-gray-100 shadow-xl">
                    {allExams.length === 0 ? (
                      <div className="p-4 text-center text-xs text-gray-400">
                        No exams available to tag
                      </div>
                    ) : (
                      allExams.map((exam) => (
                        <SelectItem
                          key={exam.id}
                          value={exam.id}
                          className="focus:bg-green-50 focus:text-green-700"
                        >
                          {exam.title}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => setShowCreateExam(true)}
                  className="flex items-center gap-2 h-10 px-6 bg-[#10B981] text-white rounded-xl font-bold text-sm hover:bg-[#059669] shadow-md shadow-green-500/10 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Exam</span>
                </Button>
              </div>
            </div>

            {exams.length === 0 ? (
              <div className="py-20 text-center bg-white border border-dashed border-gray-200 rounded-2xl">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-gray-300" />
                </div>
                <p className="text-gray-500 font-medium">No exams tagged to this class yet.</p>
                <p className="text-xs text-gray-400 mt-1">
                  Start by tagging an existing exam or creating a new one.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {exams.map((exam) => (
                  <Card
                    key={exam.id}
                    className="group bg-white border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden flex flex-col h-full rounded-2xl border-b-4 border-b-green-500/10 hover:border-b-green-500/40 relative"
                    onClick={() => router.push(`/exams/${exam.id}`)}
                  >
                    <CardContent className="p-6 flex flex-col h-full">
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-green-100 transition-colors">
                          <FileText className="w-6 h-6 text-green-600" />
                        </div>
                        <div className="px-2.5 py-1 bg-green-50 text-green-700 rounded-full text-[10px] font-bold uppercase tracking-wider border border-green-100">
                          {exam.num_items} Items
                        </div>
                      </div>

                      <div className="flex-1">
                        <h3 className="font-bold text-lg text-gray-900 group-hover:text-green-700 transition-colors line-clamp-1 mb-1">
                          {exam.title}
                        </h3>
                        <p className="text-sm text-gray-500 font-medium line-clamp-1">
                          {exam.subject}
                        </p>

                        <div className="mt-4 flex flex-col gap-2">
                          <div className="flex items-center gap-2 text-gray-400 group-hover:text-gray-500 transition-colors">
                            <span className="text-sm font-bold opacity-30">#</span>
                            <span className="text-xs font-mono font-bold tracking-tight text-gray-600">
                              {exam.examCode || "NO-CODE"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-400">
                            <Calendar className="w-3.5 h-3.5 opacity-60" />
                            <span className="text-[11px] font-bold">
                              {new Date(exam.created_at).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 pt-4 border-t border-gray-50 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                            <Tag className="w-4 h-4 text-blue-600" />
                          </div>
                          <span className="text-xs font-bold text-gray-700">
                            1{" "}
                            <span className="text-[10px] font-normal text-gray-400 uppercase tracking-tight">
                              Class Tagged
                            </span>
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleEditExam(exam); }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                            title="Edit exam"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleArchiveExam(exam.id, exam.title); }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                            title="Archive exam"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "stats" && (
          <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-300">
            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="border border-gray-100 shadow-sm rounded-3xl bg-white p-8 border-b-4 border-b-green-500/10">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-green-600" />
                  </div>
                  <p className="text-[13px] font-bold text-gray-400 uppercase tracking-widest">Class Average</p>
                </div>
                <div className="flex items-baseline gap-1">
                  {classAverage !== null ? (
                    <>
                      <p className="text-[38px] font-bold text-[#1e293b]">{classAverage}</p>
                      <span className="text-xl font-bold text-gray-300">%</span>
                    </>
                  ) : (
                    <p className="text-[38px] font-bold text-gray-300">—</p>
                  )}
                </div>
              </Card>

              <Card className="border border-gray-100 shadow-sm rounded-3xl bg-white p-8 border-b-4 border-b-blue-500/10">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                    <Users className="w-5 h-5 text-blue-600" />
                  </div>
                  <p className="text-[13px] font-bold text-gray-400 uppercase tracking-widest">Pass Rate</p>
                </div>
                <div className="flex items-baseline gap-1">
                  {passRate !== null ? (
                    <>
                      <p className="text-[38px] font-bold text-[#1e293b]">{passRate}</p>
                      <span className="text-xl font-bold text-gray-300">%</span>
                    </>
                  ) : (
                    <p className="text-[38px] font-bold text-gray-300">—</p>
                  )}
                </div>
              </Card>
            </div>

            <div className="flex justify-end pr-2">
              <Button variant="outline" className="text-[13px] font-bold text-[#1e293b] hover:bg-gray-50 rounded-2xl h-12 px-8 border border-gray-100 shadow-sm flex items-center gap-3 transition-all active:scale-[0.98]">
                <Mail className="w-5 h-5 text-gray-400" />
                <span>Send All Scores to Students</span>
              </Button>
            </div>

            {/* Exam Breakdown Table */}
            <Card className="border border-gray-100 shadow-sm rounded-[2rem] overflow-hidden bg-white">
              <div className="p-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                  <div>
                    <h3 className="text-lg font-bold text-[#1e293b]">Exam Performance Breakdown</h3>
                    <p className="text-xs text-gray-400 font-medium">Detailed results for each exam assigned to this class</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-50 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-[#f8fafc] border-none">
                        <TableHead className="text-[11px] font-bold text-gray-400 h-14 uppercase tracking-wider pl-8">Exam Title</TableHead>
                        <TableHead className="text-[11px] font-bold text-gray-400 text-center h-14 uppercase tracking-wider">Papers Scanned</TableHead>
                        <TableHead className="text-[11px] font-bold text-gray-400 text-right h-14 uppercase tracking-wider pr-10">Average Score</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {exams.length > 0 ? exams.map(exam => (
                        <TableRow key={exam.id} className="border-b border-gray-50 h-[75px] hover:bg-gray-50/50 transition-colors group">
                          <TableCell className="pl-8">
                            <div className="flex items-center gap-4">
                               <div className="w-9 h-9 bg-gray-50 rounded-lg flex items-center justify-center group-hover:bg-green-50 transition-colors">
                                  <FileText className="w-4.5 h-4.5 text-gray-400 group-hover:text-green-500 transition-colors" />
                               </div>
                               <div>
                                  <p className="text-[15px] font-bold text-[#1e293b] leading-tight">{exam.title}</p>
                                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{exam.subject}</p>
                               </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="inline-flex items-center justify-center w-10 h-6 bg-gray-50 text-gray-700 rounded-full text-[13px] font-bold border border-gray-100">
                              {exam.scannedCount || 0}
                            </span>
                          </TableCell>
                          <TableCell className="text-right pr-10">
                            <span className="text-[16px] font-bold text-[#10B981]">
                              {exam.averageScore || "0"} <span className="text-[11px] font-bold opacity-40">%</span>
                            </span>
                          </TableCell>
                        </TableRow>
                      )) : (
                        <TableRow>
                          <TableCell colSpan={3} className="h-40 text-center">
                            <div className="flex flex-col items-center justify-center text-gray-400">
                               <BarChart3 className="w-8 h-8 opacity-20 mb-3" />
                               <p className="text-sm font-bold opacity-40">No records to display yet</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>

      {showCreateExam && (
        <CreateExamModal 
          isOpen={showCreateExam} 
          onClose={() => setShowCreateExam(false)}
          onCreateExam={handleCreateExam}
          existingExamTitles={exams.map(e => e.title)}
          fromTemplate={{
            name: "",
            totalQuestions: 50,
            choicesPerItem: 4,
            description: "",
            folder: classData?.course_subject || ""
          }}
          classId={classId || ""}
          className={classData?.class_name || ""}
          folder={classData?.course_subject || ""}
          simpleMode={true}
        />
      )}

      {/* Import Students Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Import Students</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Upload an Excel file (.xlsx) to import multiple students at once.
                </p>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Drop Zone */}
              <label
                className={`flex flex-col items-center justify-center gap-3 w-full h-44 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
                  isDraggingOver
                    ? "border-green-400 bg-green-50"
                    : "border-gray-200 bg-gray-50 hover:border-green-300 hover:bg-green-50/50"
                }`}
                onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
                onDragLeave={() => setIsDraggingOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingOver(false);
                  const file = e.dataTransfer.files?.[0];
                  if (!file) return;
                  const fakeEvent = { target: { files: e.dataTransfer.files, value: "" } } as any;
                  handleImportStudents(fakeEvent);
                  setShowImportModal(false);
                }}
              >
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    handleImportStudents(e);
                    setShowImportModal(false);
                  }}
                />
                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-gray-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-700">Click to upload an Excel file</p>
                  <p className="text-xs text-gray-400 mt-0.5">or drag and drop here</p>
                  <p className="text-xs text-gray-400 mt-1">Required columns: Student ID, First Name, Last Name</p>
                </div>
              </label>
              {/* Download Template */}
              <Button
                variant="outline"
                className="w-full flex items-center justify-center gap-2 border-gray-200 text-gray-600 hover:bg-gray-50 font-medium"
                onClick={handleDownloadTemplate}
              >
                <Download className="w-4 h-4" />
                Download Template
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Exam Modal */}
      {editingExam && (
        <div className="fixed inset-0 bg-black/10 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg border-2 border-primary w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold text-foreground">Edit Exam</h2>
              <button
                onClick={() => setEditingExam(null)}
                className="p-1 hover:bg-muted rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-foreground">
                  Exam Code <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <Input
                    type="text"
                    value={editForm.examCode}
                    onChange={(e) => setEditForm({ ...editForm, examCode: e.target.value.toUpperCase() })}
                    className="w-full font-mono"
                    placeholder="e.g. EX-ABC123"
                    maxLength={12}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
                      let code = "";
                      for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
                      setEditForm({ ...editForm, examCode: `EX-${code}` });
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-primary transition-colors focus:outline-none"
                    title="Regenerate random code"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-foreground">
                  Course Code <span className="text-muted-foreground text-xs font-normal">(optional)</span>
                </label>
                <Input
                  type="text"
                  value={editForm.courseCode}
                  onChange={(e) => setEditForm({ ...editForm, courseCode: e.target.value })}
                  className="w-full"
                  placeholder="e.g. CS101, MATH201"
                  maxLength={20}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-foreground">
                  Exam Name <span className="text-destructive">*</span>
                </label>
                <Input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  placeholder="Exam name"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-foreground">Number of Items <span className="text-destructive">*</span></label>
                <div className="grid grid-cols-3 gap-2">
                  {[20, 50, 100, 150, 200].map((num) => (
                    <button
                      key={num}
                      onClick={() => setEditForm({ ...editForm, num_items: num })}
                      className={`py-2 rounded-md font-semibold text-sm border-2 transition-all ${editForm.num_items === num ? "bg-primary text-primary-foreground border-primary" : "border-muted hover:border-primary"}`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-foreground">Choices per Question</label>
                <div className="grid grid-cols-2 gap-2">
                  {[{ label: "4 Choices (A–D)", value: 4 }, { label: "5 Choices (A–E)", value: 5 }].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setEditForm({ ...editForm, choices_per_item: opt.value })}
                      className={`py-2 rounded-md font-semibold text-sm border-2 transition-all ${editForm.choices_per_item === opt.value ? "bg-primary text-primary-foreground border-primary" : "border-muted hover:border-primary"}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-foreground">Exam Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {[{ label: "Board Exam", value: "board" }, { label: "Diagnostic Test", value: "diagnostic" }].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setEditForm({ ...editForm, examType: opt.value as "board" | "diagnostic" })}
                      className={`py-2 rounded-md font-semibold text-sm border-2 transition-all ${editForm.examType === opt.value ? "bg-primary text-primary-foreground border-primary" : "border-muted hover:border-primary"}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t">
              <button
                onClick={() => setEditingExam(null)}
                className="flex-1 px-4 py-2 border rounded-md font-semibold hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingEdit ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-2xl border-none shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-gray-900">
              Confirm Student Removal
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-500">
              Are you sure you want to remove this student from the class? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel
              onClick={() => {
                setStudentToDeleteId(null);
                setIsDeleteDialogOpen(false);
              }}
              className="rounded-xl border-gray-200 text-gray-600 font-semibold hover:bg-gray-50"
            >
              No
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (studentToDeleteId) {
                  handleRemoveStudent(studentToDeleteId);
                  setStudentToDeleteId(null);
                  setIsDeleteDialogOpen(false);
                }
              }}
              className="rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold shadow-lg shadow-red-500/20 transition-all active:scale-[0.98]"
            >
              Yes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
