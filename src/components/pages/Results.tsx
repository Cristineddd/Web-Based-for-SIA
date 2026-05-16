"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronDown,
  ChevronUp,
  Download,
  FileSpreadsheet,
  FileText,
  Folder,
  Loader2,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getClasses, Class } from "@/services/classService";
import { getExams, Exam } from "@/services/examService";
import StudentSearchCombobox, {
  type SearchableStudent,
} from "@/components/ui/StudentSearchCombobox";
import { exportExamReportToExcel } from "@/services/excelExportService";
import { ExportMetadata, generateExamReportPdf, generateClassAllExamsPdf, ClassAllExamsPdfData } from "@/services/pdfReportService";
import {
  collection,
  getDocs,
  onSnapshot,
  query,
  Timestamp,
  Unsubscribe,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

interface HubStudentRow {
  studentId: string;
  studentName: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  status: "Passed" | "Failed";
  examName: string;
  className: string;
  grade: string;
  date: string;
  email?: string;
}

interface ClassView {
  cls: Class;
  exams: Exam[];
  yearLevel: string;
}

interface BulkSendState {
  running: boolean;
  total: number;
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
}

interface PendingStudentJump {
  studentId: string;
  classId: string;
  startedAt: number;
  classScrolled: boolean;
}

function calculateLetterGrade(percentage: number): string {
  if (percentage >= 90) return "A";
  if (percentage >= 85) return "A";
  if (percentage >= 80) return "B+";
  if (percentage >= 75) return "B";
  if (percentage >= 70) return "C";
  if (percentage >= 65) return "D";
  return "F";
}

function normalizeDate(value: unknown): string {
  if (!value) return "N/A";
  if (value instanceof Timestamp) {
    return value.toDate().toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }
  }
  return "N/A";
}

function keyFor(classId: string, examId: string): string {
  return `${classId}__${examId}`;
}

export default function Results() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<Class[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);

  const [yearFilter, setYearFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [examFilter, setExamFilter] = useState("all");
  const [classStudentSearch, setClassStudentSearch] = useState<Record<string, string>>({});
  const [classSelectedStudentId, setClassSelectedStudentId] = useState<
    Record<string, string | null>
  >({});
  const [pendingStudentJump, setPendingStudentJump] = useState<PendingStudentJump | null>(null);

  const [expandedClassIds, setExpandedClassIds] = useState<Set<string>>(new Set());
  const [rowsCache, setRowsCache] = useState<Record<string, HubStudentRow[]>>({});
  const [loadingRows, setLoadingRows] = useState<Record<string, boolean>>({});
  const [sendingExamKey, setSendingExamKey] = useState<string | null>(null);
  const [sendingStudentClassId, setSendingStudentClassId] = useState<string | null>(null);
  const [exportingClassId, setExportingClassId] = useState<string | null>(null);
  const [selectedStudentIdsByExam, setSelectedStudentIdsByExam] = useState<
    Record<string, string[]>
  >({});
  const [bulkSend, setBulkSend] = useState<BulkSendState>({
    running: false,
    total: 0,
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
  });

  const [passingThreshold, setPassingThreshold] = useState(75);
  const rowsCacheRef = useRef(rowsCache);
  const rowsSubscriptionsRef = useRef<Map<string, Unsubscribe>>(new Map());

  useEffect(() => {
    rowsCacheRef.current = rowsCache;
  }, [rowsCache]);

  const fetchBaseData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [cls, ex] = await Promise.all([getClasses(user.id), getExams(user.id)]);
      setClasses(cls);
      setExams(ex);
    } catch (error) {
      console.error("Error fetching results hub data:", error);
      toast.error("Failed to load Results & Export data");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchBaseData();
  }, [fetchBaseData]);

  const allClassViews = useMemo<ClassView[]>(() => {
    const examsByClassId = new Map<string, Exam[]>(
      classes.map((cls) => [cls.id, [] as Exam[]]),
    );
    const classIdsByName = new Map<string, string[]>();

    classes.forEach((cls) => {
      const existing = classIdsByName.get(cls.class_name) || [];
      existing.push(cls.id);
      existing.sort();
      classIdsByName.set(cls.class_name, existing);
    });

    exams.forEach((exam) => {
      const examClassId = exam.classId?.trim();
      if (examClassId && examsByClassId.has(examClassId)) {
        examsByClassId.get(examClassId)?.push(exam);
        return;
      }

      const legacyClassName = exam.className?.trim();
      if (!legacyClassName) return;

      const matchedClassIds = classIdsByName.get(legacyClassName);
      if (!matchedClassIds?.length) return;

      // Legacy records may only have className; assign to one class to avoid duplicates.
      examsByClassId.get(matchedClassIds[0])?.push(exam);
    });

    return classes.map((cls) => ({
      cls,
      exams: examsByClassId.get(cls.id) || [],
      yearLevel: cls.year || "Unspecified",
    }));
  }, [classes, exams]);

  const filteredClassViews = useMemo<ClassView[]>(() => {
    return allClassViews
      .filter((view) => (yearFilter === "all" ? true : view.yearLevel === yearFilter))
      .filter((view) => (classFilter === "all" ? true : view.cls.id === classFilter))
      .map((view) => ({
        ...view,
        exams:
          examFilter === "all"
            ? view.exams
            : view.exams.filter((exam) => exam.id === examFilter),
      }))
      .filter((view) => view.exams.length > 0 || examFilter === "all");
  }, [allClassViews, yearFilter, classFilter, examFilter]);

  const yearOptions = useMemo(() => {
    const years = new Set(allClassViews.map((v) => v.yearLevel));
    return Array.from(years).sort();
  }, [allClassViews]);

  const examOptions = useMemo(() => {
    if (classFilter === "all") return exams;
    const selected = classes.find((cls) => cls.id === classFilter);
    if (!selected) return exams;
    return exams.filter(
      (exam) => exam.classId === selected.id || exam.className === selected.class_name,
    );
  }, [classFilter, classes, exams]);

  const totalFilteredExams = useMemo(
    () => filteredClassViews.reduce((sum, view) => sum + view.exams.length, 0),
    [filteredClassViews],
  );

  const searchableStudentsByClassId = useMemo<Record<string, SearchableStudent[]>>(() => {
    const byClassId: Record<string, SearchableStudent[]> = {};
    filteredClassViews.forEach((view) => {
      byClassId[view.cls.id] = (view.cls.students || [])
        .map((student) => ({
          studentId: student.student_id,
          studentName: `${student.last_name}, ${student.first_name}`,
          section:
            student.section ||
            [view.cls.course_subject, view.cls.section_block].filter(Boolean).join(" • "),
          email: student.email,
        }))
        .sort((a, b) => a.studentName.localeCompare(b.studentName));
    });
    return byClassId;
  }, [filteredClassViews]);

  useEffect(() => {
    const visibleClassIds = new Set(filteredClassViews.map((view) => view.cls.id));

    setClassStudentSearch((prev) =>
      Object.fromEntries(
        Object.entries(prev).filter(([classId]) => visibleClassIds.has(classId)),
      ),
    );

    setClassSelectedStudentId((prev) =>
      Object.fromEntries(
        Object.entries(prev).filter(([classId]) => visibleClassIds.has(classId)),
      ),
    );
  }, [filteredClassViews]);

  useEffect(() => {
    setClassSelectedStudentId((prev) => {
      const next = { ...prev };
      let changed = false;
      Object.entries(next).forEach(([classId, studentId]) => {
        if (!studentId) return;
        const options = searchableStudentsByClassId[classId] || [];
        const stillVisible = options.some((student) => student.studentId === studentId);
        if (!stillVisible) {
          next[classId] = null;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [searchableStudentsByClassId]);

  useEffect(() => {
    if (!pendingStudentJump) return;

    const { studentId, classId, startedAt, classScrolled } = pendingStudentJump;
    const targetViews = classId
      ? filteredClassViews.filter((view) => view.cls.id === classId)
      : filteredClassViews;

    for (const view of targetViews) {
      for (const exam of view.exams) {
        const cacheKey = keyFor(view.cls.id, exam.id);
        const rowEl = document.getElementById(`results-row-${cacheKey}-${studentId}`);
        if (!rowEl) continue;

        rowEl.scrollIntoView({ behavior: "smooth", block: "center" });
        rowEl.classList.add("bg-emerald-50");
        window.setTimeout(() => {
          rowEl.classList.remove("bg-emerald-50");
        }, 1200);
        setPendingStudentJump(null);
        return;
      }
    }

    if (classId && !classScrolled) {
      const classCardEl = document.getElementById(`results-class-${classId}`);
      if (classCardEl) {
        classCardEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      setPendingStudentJump((prev) =>
        prev ? { ...prev, classScrolled: true } : prev,
      );
      return;
    }

    if (Date.now() - startedAt > 5000) {
      setPendingStudentJump(null);
    }
  }, [pendingStudentJump, filteredClassViews, rowsCache, loadingRows]);

  const filterRowsByStudent = useCallback(
    (rows: HubStudentRow[], classId: string) => {
      const selectedId = classSelectedStudentId[classId];
      if (selectedId) {
        return rows.filter((row) => row.studentId === selectedId);
      }

      const query = (classStudentSearch[classId] || "").trim().toLowerCase();
      if (!query) return rows;

      return rows.filter(
        (row) =>
          row.studentId.toLowerCase().includes(query) ||
          row.studentName.toLowerCase().includes(query),
      );
    },
    [classSelectedStudentId, classStudentSearch],
  );

  useEffect(() => {
    const validIdsByExam = new Map<string, Set<string>>();
    Object.entries(rowsCache).forEach(([cacheKey, rows]) => {
      validIdsByExam.set(cacheKey, new Set(rows.map((row) => row.studentId)));
    });

    setSelectedStudentIdsByExam((prev) => {
      let changed = false;
      const next: Record<string, string[]> = {};

      Object.entries(prev).forEach(([cacheKey, selectedIds]) => {
        const validIds = validIdsByExam.get(cacheKey);
        if (!validIds) {
          changed = true;
          return;
        }

        const filteredIds = selectedIds.filter((studentId) => validIds.has(studentId));
        if (filteredIds.length > 0) {
          next[cacheKey] = filteredIds;
        }

        if (filteredIds.length !== selectedIds.length) {
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [rowsCache]);

  const setExamStudentSelection = useCallback(
    (cacheKey: string, studentId: string, shouldSelect: boolean) => {
      setSelectedStudentIdsByExam((prev) => {
        const current = new Set(prev[cacheKey] || []);
        if (shouldSelect) {
          current.add(studentId);
        } else {
          current.delete(studentId);
        }

        const next = { ...prev };
        if (current.size === 0) {
          delete next[cacheKey];
        } else {
          next[cacheKey] = Array.from(current);
        }
        return next;
      });
    },
    [],
  );

  const setExamBulkSelection = useCallback(
    (cacheKey: string, rows: HubStudentRow[], shouldSelect: boolean) => {
      const rowIds = rows.map((row) => row.studentId);
      if (rowIds.length === 0) return;

      setSelectedStudentIdsByExam((prev) => {
        const current = new Set(prev[cacheKey] || []);
        if (shouldSelect) {
          rowIds.forEach((studentId) => current.add(studentId));
        } else {
          rowIds.forEach((studentId) => current.delete(studentId));
        }

        const next = { ...prev };
        if (current.size === 0) {
          delete next[cacheKey];
        } else {
          next[cacheKey] = Array.from(current);
        }
        return next;
      });
    },
    [],
  );

  const buildExamRows = useCallback(
    (
      cls: Class,
      exam: Exam,
      scannedDocs: Record<string, unknown>[],
      gradeDocs: Record<string, unknown>[],
    ): HubStudentRow[] => {
      const students = cls.students || [];
      const studentMap = new Map(students.map((s) => [s.student_id, s]));
      const rowMap = new Map<string, HubStudentRow>();

      scannedDocs.forEach((data) => {
        if (data.isNullId) return;

        const studentId = String(data.studentId || "").trim();
        if (!studentId) return;

        const score = Number(data.score || 0);
        const totalQuestions = Number(data.totalQuestions || 0);
        const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
        const student = studentMap.get(studentId);

        rowMap.set(studentId, {
          studentId,
          studentName: student ? `${student.last_name}, ${student.first_name}` : studentId,
          score,
          totalQuestions,
          percentage,
          status: percentage >= passingThreshold ? "Passed" : "Failed",
          examName: exam.title,
          className: cls.class_name,
          grade: calculateLetterGrade(percentage),
          date: normalizeDate(data.scannedAt),
          email: student?.email,
        });
      });

      gradeDocs.forEach((data) => {
        const gradeClassId = String(data.class_id || data.classId || "");
        if (gradeClassId && gradeClassId !== cls.id) return;

        const studentId = String(data.student_id || data.studentId || "").trim();
        if (!studentId || rowMap.has(studentId)) return;

        const score = Number(data.score || 0);
        const totalQuestions = Number(data.max_score || data.totalQuestions || 0);
        const percentage = Number(
          data.percentage || (totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0),
        );
        const student = studentMap.get(studentId);

        rowMap.set(studentId, {
          studentId,
          studentName: student ? `${student.last_name}, ${student.first_name}` : studentId,
          score,
          totalQuestions,
          percentage,
          status: percentage >= passingThreshold ? "Passed" : "Failed",
          examName: exam.title,
          className: cls.class_name,
          grade: String(data.letter_grade || calculateLetterGrade(percentage)),
          date: normalizeDate(data.graded_at),
          email: student?.email,
        });
      });

      return Array.from(rowMap.values()).sort((a, b) => a.studentName.localeCompare(b.studentName));
    },
    [passingThreshold],
  );

  const fetchExamRowsOnce = useCallback(
    async (cls: Class, exam: Exam): Promise<HubStudentRow[]> => {
      const cacheKey = keyFor(cls.id, exam.id);
      setLoadingRows((prev) => ({ ...prev, [cacheKey]: true }));

      try {
        const [scannedSnap, gradeSnakeSnap, gradeCamelSnap] = await Promise.all([
          getDocs(query(collection(db, "scannedResults"), where("examId", "==", exam.id))),
          getDocs(query(collection(db, "studentGrades"), where("exam_id", "==", exam.id))),
          getDocs(query(collection(db, "studentGrades"), where("examId", "==", exam.id))),
        ]);

        const rows = buildExamRows(
          cls,
          exam,
          scannedSnap.docs.map((docSnap) => docSnap.data() as Record<string, unknown>),
          [...gradeSnakeSnap.docs, ...gradeCamelSnap.docs].map(
            (docSnap) => docSnap.data() as Record<string, unknown>,
          ),
        );

        setRowsCache((prev) => ({ ...prev, [cacheKey]: rows }));
        return rows;
      } catch (error) {
        console.error("Failed to fetch exam rows:", error);
        toast.error(`Unable to load report for ${exam.title}`);
        return [];
      } finally {
        setLoadingRows((prev) => ({ ...prev, [cacheKey]: false }));
      }
    },
    [buildExamRows],
  );

  const fetchExamRows = useCallback(
    async (cls: Class, exam: Exam): Promise<HubStudentRow[]> => {
      const cacheKey = keyFor(cls.id, exam.id);
      const cachedRows = rowsCacheRef.current[cacheKey];
      if (cachedRows) return cachedRows;
      return fetchExamRowsOnce(cls, exam);
    },
    [fetchExamRowsOnce],
  );

  const subscribeExamRows = useCallback(
    (cls: Class, exam: Exam) => {
      const cacheKey = keyFor(cls.id, exam.id);
      if (rowsSubscriptionsRef.current.has(cacheKey)) return;

      setLoadingRows((prev) => ({ ...prev, [cacheKey]: true }));

      let scannedDocs: Record<string, unknown>[] = [];
      let gradeSnakeDocs: Record<string, unknown>[] = [];
      let gradeCamelDocs: Record<string, unknown>[] = [];
      let scannedReady = false;
      let gradeSnakeReady = false;
      let gradeCamelReady = false;
      let hasShownRealtimeError = false;

      const publishRows = () => {
        if (!scannedReady || !gradeSnakeReady || !gradeCamelReady) return;

        const rows = buildExamRows(cls, exam, scannedDocs, [...gradeSnakeDocs, ...gradeCamelDocs]);
        setRowsCache((prev) => ({ ...prev, [cacheKey]: rows }));
        setLoadingRows((prev) => ({ ...prev, [cacheKey]: false }));
      };

      const onRealtimeError = (error: unknown) => {
        console.error(`Failed live sync for exam ${exam.id}:`, error);
        setLoadingRows((prev) => ({ ...prev, [cacheKey]: false }));
        if (!hasShownRealtimeError) {
          toast.error(`Unable to keep ${exam.title} report in live sync`);
          hasShownRealtimeError = true;
        }
      };

      const unsubScanned = onSnapshot(
        query(collection(db, "scannedResults"), where("examId", "==", exam.id)),
        (snapshot) => {
          scannedDocs = snapshot.docs.map((docSnap) => docSnap.data() as Record<string, unknown>);
          scannedReady = true;
          publishRows();
        },
        onRealtimeError,
      );

      const unsubGradeSnake = onSnapshot(
        query(collection(db, "studentGrades"), where("exam_id", "==", exam.id)),
        (snapshot) => {
          gradeSnakeDocs = snapshot.docs.map((docSnap) => docSnap.data() as Record<string, unknown>);
          gradeSnakeReady = true;
          publishRows();
        },
        onRealtimeError,
      );

      const unsubGradeCamel = onSnapshot(
        query(collection(db, "studentGrades"), where("examId", "==", exam.id)),
        (snapshot) => {
          gradeCamelDocs = snapshot.docs.map((docSnap) => docSnap.data() as Record<string, unknown>);
          gradeCamelReady = true;
          publishRows();
        },
        onRealtimeError,
      );

      rowsSubscriptionsRef.current.set(cacheKey, () => {
        unsubScanned();
        unsubGradeSnake();
        unsubGradeCamel();
      });
    },
    [buildExamRows],
  );

  useEffect(() => {
    const desiredKeys = new Set<string>();

    filteredClassViews.forEach((view) => {
      if (!expandedClassIds.has(view.cls.id)) return;
      view.exams.forEach((exam) => {
        const cacheKey = keyFor(view.cls.id, exam.id);
        desiredKeys.add(cacheKey);
        subscribeExamRows(view.cls, exam);
      });
    });

    rowsSubscriptionsRef.current.forEach((unsubscribe, cacheKey) => {
      if (desiredKeys.has(cacheKey)) return;
      unsubscribe();
      rowsSubscriptionsRef.current.delete(cacheKey);
      setRowsCache((prev) => {
        if (!(cacheKey in prev)) return prev;
        const next = { ...prev };
        delete next[cacheKey];
        return next;
      });
      setLoadingRows((prev) => {
        if (!(cacheKey in prev)) return prev;
        const next = { ...prev };
        delete next[cacheKey];
        return next;
      });
    });
  }, [expandedClassIds, filteredClassViews, subscribeExamRows]);

  // When passing threshold changes, tear down all subscriptions so they
  // re-subscribe with the updated buildExamRows closure.
  useEffect(() => {
    rowsSubscriptionsRef.current.forEach((unsubscribe) => unsubscribe());
    rowsSubscriptionsRef.current.clear();
    setRowsCache({});
  }, [passingThreshold]);

  useEffect(() => {
    const subscriptions = rowsSubscriptionsRef.current;
    return () => {
      subscriptions.forEach((unsubscribe) => unsubscribe());
      subscriptions.clear();
    };
  }, []);

  const sendExamResults = useCallback(
    async (
      cls: Class,
      exam: Exam,
      sourceRows?: HubStudentRow[],
    ): Promise<{ sent: number; failed: number; total: number }> => {
      const rows = sourceRows ?? (await fetchExamRows(cls, exam));
      if (rows.length === 0) {
        return { sent: 0, failed: 0, total: 0 };
      }

      const res = await fetch("/api/send-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          className: cls.class_name,
          examTitle: exam.title,
          subject: exam.subject,
          passingThreshold,
          instructorName: user?.displayName || undefined,
          instructorEmail: user?.email || undefined,
          students: rows.map((row) => ({
            studentId: row.studentId,
            studentName: row.studentName,
            email: row.email || `${row.studentId}@gordoncollege.edu.ph`,
            score: row.score,
            totalQuestions: row.totalQuestions,
            percentage: row.percentage,
            grade: row.grade,
            date: row.date,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Failed to send ${exam.title} results`);
      }

      return {
        sent: Number(data.sent || 0),
        failed: Number(data.failed || 0),
        total: Number(data.total || rows.length),
      };
    },
    [fetchExamRows, user?.displayName, user?.email],
  );

  const handleSendSingleExam = useCallback(
    async (cls: Class, exam: Exam) => {
      const cacheKey = keyFor(cls.id, exam.id);
      setSendingExamKey(cacheKey);
      try {
        const result = await sendExamResults(cls, exam);
        if (result.total === 0) {
          toast.info(`No available scores to send for ${exam.title}`);
          return;
        }
        toast.success(
          `Sent ${result.sent}/${result.total} emails for ${cls.class_name} - ${exam.title}`,
        );
      } catch (error) {
        console.error(error);
        toast.error(`Failed to send emails for ${exam.title}`);
      } finally {
        setSendingExamKey(null);
      }
    },
    [sendExamResults],
  );

  const handleSendSelectedExam = useCallback(
    async (cls: Class, exam: Exam, availableRows: HubStudentRow[]) => {
      const cacheKey = keyFor(cls.id, exam.id);
      const selectedIds = new Set(selectedStudentIdsByExam[cacheKey] || []);
      const selectedRows = availableRows.filter((row) => selectedIds.has(row.studentId));

      if (selectedRows.length === 0) {
        toast.info("Select at least one student to send results.");
        return;
      }

      setSendingExamKey(cacheKey);
      try {
        const result = await sendExamResults(cls, exam, selectedRows);
        toast.success(
          `Sent ${result.sent}/${result.total} selected emails for ${cls.class_name} - ${exam.title}`,
        );
        setSelectedStudentIdsByExam((prev) => {
          const next = { ...prev };
          delete next[cacheKey];
          return next;
        });
      } catch (error) {
        console.error(error);
        toast.error(`Failed to send selected emails for ${exam.title}`);
      } finally {
        setSendingExamKey(null);
      }
    },
    [selectedStudentIdsByExam, sendExamResults],
  );

  const handleSendStudentAllExams = useCallback(
    async (view: ClassView) => {
      const studentId = classSelectedStudentId[view.cls.id];
      if (!studentId) {
        toast.info("Select a student first to send all exam scores.");
        return;
      }

      if (view.exams.length === 0) {
        toast.info("No exams available for this class.");
        return;
      }

      const selectedStudent = (view.cls.students || []).find(
        (student) => student.student_id === studentId,
      );
      const studentLabel = selectedStudent
        ? `${selectedStudent.last_name}, ${selectedStudent.first_name}`
        : studentId;

      setSendingStudentClassId(view.cls.id);
      let sent = 0;
      let failed = 0;
      let skipped = 0;
      let sentExamCount = 0;

      try {
        for (const exam of view.exams) {
          const examRows = await fetchExamRows(view.cls, exam);
          const targetRows = examRows.filter((row) => row.studentId === studentId);

          if (targetRows.length === 0) {
            skipped += 1;
            continue;
          }

          const result = await sendExamResults(view.cls, exam, targetRows);
          sent += result.sent;
          failed += result.failed;
          sentExamCount += 1;
        }

        if (sentExamCount === 0) {
          toast.info(`No available exam results found for ${studentLabel}.`);
          return;
        }

        toast.success(
          `Student score send complete for ${studentLabel}: ${sent} sent, ${failed} failed, ${skipped} exams without records.`,
        );
      } catch (error) {
        console.error("Failed sending student exam scores:", error);
        toast.error(`Failed to send all exam scores for ${studentLabel}`);
      } finally {
        setSendingStudentClassId(null);
      }
    },
    [classSelectedStudentId, fetchExamRows, sendExamResults],
  );

  const handleBulkSend = useCallback(async () => {
    const worklist = filteredClassViews.flatMap((view) =>
      view.exams.map((exam) => ({ cls: view.cls, exam })),
    );

    if (worklist.length === 0) {
      toast.info("No filtered exams available for bulk send");
      return;
    }

    setBulkSend({
      running: true,
      total: worklist.length,
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
    });

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (let i = 0; i < worklist.length; i++) {
      const { cls, exam } = worklist[i];
      try {
        const result = await sendExamResults(cls, exam);
        sent += result.sent;
        failed += result.failed;
        if (result.total === 0) {
          skipped += 1;
        }
      } catch (error) {
        console.error("Bulk send exam failure:", error);
        failed += 1;
      }

      setBulkSend((prev) => ({
        ...prev,
        processed: i + 1,
        sent,
        failed,
        skipped,
      }));
    }

    setBulkSend((prev) => ({ ...prev, running: false }));
    toast.success(
      `Bulk send completed: ${sent} sent, ${failed} failed, ${skipped} skipped`,
    );
  }, [filteredClassViews, sendExamResults]);

  const handleExport = useCallback(
    async (cls: Class, exam: Exam, format: "xlsx" | "pdf") => {
      const rows = await fetchExamRows(cls, exam);
      if (rows.length === 0) {
        toast.info("No rows available to export for this exam");
        return;
      }

      const normalizedExamDate = normalizeDate(exam.created_at);

      const metadata: ExportMetadata = {
        instructorName: user?.displayName || undefined,
        subject: exam.subject || undefined,
        section: cls.room || undefined,
        numItems: exam.num_items || undefined,
        choicesPerItem: exam.choices_per_item || undefined,
        examDate: normalizedExamDate === "N/A" ? undefined : normalizedExamDate,
        examCode: exam.examCode || undefined,
      };

      if (format === "xlsx") {
        exportExamReportToExcel(
          rows.map((r) => ({
            studentId: r.studentId,
            studentName: r.studentName,
            score: r.score,
            percentage: r.percentage,
            status: r.status,
            examName: r.examName,
            className: r.className,
          })),
          exam.title,
          cls.class_name,
          metadata,
        );
        toast.success("Exam report exported as Excel");
        return;
      }

      await generateExamReportPdf(
        rows.map((r) => ({
          studentId: r.studentId,
          studentName: r.studentName,
          score: r.score,
          percentage: r.percentage,
          status: r.status,
          examName: r.examName,
          className: r.className,
        })),
        exam.title,
        cls.class_name,
        metadata,
      );
      toast.success("Exam report exported as PDF");
    },
    [fetchExamRows, user?.displayName],
  );

  const toggleExpandClass = useCallback((classId: string) => {
    setExpandedClassIds((prev) => {
      const next = new Set(prev);
      if (next.has(classId)) next.delete(classId);
      else next.add(classId);
      return next;
    });
  }, []);

  const handleExportClass = useCallback(
    async (view: ClassView) => {
      // Always use allClassViews (pre-computed, unfiltered) to get every exam for this class
      const classView = allClassViews.find((v) => v.cls.id === view.cls.id);
      const classExams = classView?.exams ?? [];

      if (classExams.length === 0) {
        toast.info("No exams available to export for this class.");
        return;
      }

      setExportingClassId(view.cls.id);
      toast.info(`Exporting ${classExams.length} exam(s) for ${view.cls.class_name}…`);
      try {
        const examPdfData: ClassAllExamsPdfData[] = [];

        // Fetch sequentially to avoid cache race conditions
        for (const exam of classExams) {
          const rows = await fetchExamRowsOnce(view.cls, exam);
          const normalizedExamDate = normalizeDate(exam.created_at);
          examPdfData.push({
            examTitle: exam.title,
            rows: rows.map((r) => ({
              studentId: r.studentId,
              studentName: r.studentName,
              score: r.score,
              percentage: r.percentage,
              status: r.status,
              examName: r.examName,
              className: r.className,
            })),
            metadata: {
              instructorName: user?.displayName || undefined,
              subject: exam.subject || undefined,
              section: view.cls.room || undefined,
              numItems: exam.num_items || undefined,
              choicesPerItem: exam.choices_per_item || undefined,
              examDate: normalizedExamDate === "N/A" ? undefined : normalizedExamDate,
              examCode: exam.examCode || undefined,
            },
          });
        }

        await generateClassAllExamsPdf(view.cls.class_name, examPdfData);
        toast.success(`${examPdfData.length} exam(s) exported for ${view.cls.class_name}`);
      } catch (error) {
        console.error("Failed to export class exams:", error);
        toast.error(`Failed to export class report for ${view.cls.class_name}`);
      } finally {
        setExportingClassId(null);
      }
    },
    [allClassViews, fetchExamRowsOnce, user?.displayName],
  );

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center min-h-[55vh]">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="page-container space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Results &amp; Export Hub</h1>
          <p className="text-sm text-gray-500 mt-1">
            Central reporting for classes, exams, and student results.
          </p>
        </div>
        <Button
          onClick={handleBulkSend}
          disabled={bulkSend.running || totalFilteredExams === 0}
          className="bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold shadow-sm disabled:opacity-50"
        >
          {bulkSend.running ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Bulk Sending...
            </>
          ) : (
            <>
              <Mail className="w-4 h-4 mr-2" />
              Bulk Send (Filtered)
            </>
          )}
        </Button>
      </div>

      {/* Filter Card */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest">Year Level</label>
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="bg-white border-gray-200 rounded-xl h-10 text-sm font-medium focus:ring-0">
                <SelectValue placeholder="All Year Levels" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All Year Levels</SelectItem>
                {yearOptions.map((year) => (
                  <SelectItem key={year} value={year}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest">Class</label>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="bg-white border-gray-200 rounded-xl h-10 text-sm font-medium focus:ring-0">
                <SelectValue placeholder="All Classes" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All Classes</SelectItem>
                {classes.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id}>{cls.class_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest">Exam</label>
            <Select value={examFilter} onValueChange={setExamFilter}>
              <SelectTrigger className="bg-white border-gray-200 rounded-xl h-10 text-sm font-medium focus:ring-0">
                <SelectValue placeholder="All Exams" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All Exams</SelectItem>
                {examOptions.map((exam) => (
                  <SelectItem key={exam.id} value={exam.id}>{exam.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest">
              Passing Threshold
            </label>
            <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={passingThreshold}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setPassingThreshold(val);
                  }}
                  className="w-32 h-2 accent-green-600 cursor-pointer"
                />
                <span className="text-sm font-bold text-green-700 w-12 text-center">
                  {passingThreshold}%
                </span>
              </div>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Filtered Classes", value: filteredClassViews.length },
          { label: "Filtered Exams", value: totalFilteredExams },
          { label: "Live Reports", value: Object.keys(rowsCache).length },
        ].map((stat) => (
          <div key={stat.label} className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{stat.label}</p>
            <p className="text-3xl font-bold text-green-600 mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {bulkSend.total > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-gray-700">Bulk Send Progress</span>
            <span className="text-xs text-gray-400">
              {bulkSend.processed}/{bulkSend.total} exam reports
            </span>
          </div>
          <Progress
            value={bulkSend.total > 0 ? (bulkSend.processed / bulkSend.total) * 100 : 0}
            className="h-2"
          />
          <p className="text-xs text-gray-400">
            Sent: {bulkSend.sent} &nbsp;·&nbsp; Failed: {bulkSend.failed} &nbsp;·&nbsp; Skipped: {bulkSend.skipped}
          </p>
        </div>
      )}

      {filteredClassViews.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-xl p-10 text-center">
          <Folder className="w-10 h-10 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No matching classes/exams for current filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredClassViews.map((view) => {
            const isExpanded = expandedClassIds.has(view.cls.id);
            const selectedStudentForClass = (view.cls.students || []).find(
              (student) => student.student_id === classSelectedStudentId[view.cls.id],
            );

            return (
              <div
                key={view.cls.id}
                id={`results-class-${view.cls.id}`}
                className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden"
              >
                <div
                  className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50/60 transition-colors cursor-pointer"
                  onClick={() => toggleExpandClass(view.cls.id)}
                >
                  <div>
                    <p className="text-sm font-bold text-gray-900">{view.cls.class_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Year Level: {view.yearLevel} &nbsp;·&nbsp; Students: {view.cls.students?.length || 0} &nbsp;·&nbsp; Exams: {view.exams.length}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-green-600 bg-green-50 border border-green-100 px-2.5 py-1 rounded-full">
                      {view.exams.length} reports
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExportClass(view);
                      }}
                      disabled={exportingClassId === view.cls.id || view.exams.length === 0}
                      className="border-emerald-200 text-emerald-700 text-xs h-7 px-2"
                    >
                      {exportingClassId === view.cls.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <>
                          <Download className="w-3 h-3 mr-1" />
                          Export All
                        </>
                      )}
                    </Button>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t bg-white">
                    <div className="max-h-[70vh] overflow-y-auto p-4 space-y-4">
                    <div className="rounded-xl border border-green-100 bg-green-50/40 p-3">
                      <p className="text-xs text-green-800 font-semibold mb-2">
                        Search student in this class
                      </p>
                      <StudentSearchCombobox
                        students={searchableStudentsByClassId[view.cls.id] || []}
                        value={classStudentSearch[view.cls.id] || ""}
                        onChange={(value) => {
                          setClassStudentSearch((prev) => ({
                            ...prev,
                            [view.cls.id]: value,
                          }));
                          setClassSelectedStudentId((prev) => ({
                            ...prev,
                            [view.cls.id]: null,
                          }));
                          setPendingStudentJump(null);
                        }}
                        onSelect={(student) => {
                          setClassSelectedStudentId((prev) => ({
                            ...prev,
                            [view.cls.id]: student.studentId,
                          }));
                          setClassStudentSearch((prev) => ({
                            ...prev,
                            [view.cls.id]: student.studentName,
                          }));
                          setPendingStudentJump({
                            studentId: student.studentId,
                            classId: view.cls.id,
                            startedAt: Date.now(),
                            classScrolled: false,
                          });
                        }}
                        placeholder="Search ID or name"
                        className="w-full"
                      />
                      <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <p className="text-xs text-green-700">
                          {selectedStudentForClass
                            ? `Selected: ${selectedStudentForClass.last_name}, ${selectedStudentForClass.first_name}`
                            : "Select a student to send all their exam scores in this class."}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSendStudentAllExams(view)}
                          disabled={
                            !classSelectedStudentId[view.cls.id] ||
                            sendingStudentClassId === view.cls.id
                          }
                          className="border-green-200 text-green-700"
                        >
                          {sendingStudentClassId === view.cls.id ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Sending Student Scores...
                            </>
                          ) : (
                            <>
                              <Mail className="w-4 h-4 mr-2" />
                              Send Student All Exams
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                    {view.exams.length === 0 ? (
                      <p className="text-sm text-gray-400">No exams associated with this class.</p>
                    ) : (
                      (() => {
                        const classSearchActive =
                          Boolean(classSelectedStudentId[view.cls.id]) ||
                          Boolean((classStudentSearch[view.cls.id] || "").trim());

                        const examCards = view.exams
                          .map((exam) => {
                            const cacheKey = keyFor(view.cls.id, exam.id);
                            const rows = rowsCache[cacheKey] || [];
                            const displayRows = filterRowsByStudent(rows, view.cls.id);
                            const isRowsLoading = !!loadingRows[cacheKey];
                            const selectedIds = selectedStudentIdsByExam[cacheKey] || [];
                            const selectedIdSet = new Set(selectedIds);
                            const selectedDisplayCount = displayRows.filter((row) =>
                              selectedIdSet.has(row.studentId),
                            ).length;
                            const allDisplayRowsSelected =
                              displayRows.length > 0 && selectedDisplayCount === displayRows.length;
                            const displayRowsPartiallySelected =
                              selectedDisplayCount > 0 && selectedDisplayCount < displayRows.length;
                            const avg =
                              displayRows.length > 0
                                ? Math.round(
                                    displayRows.reduce((sum, row) => sum + row.percentage, 0) /
                                      displayRows.length,
                                  )
                                : 0;

                            if (classSearchActive && !isRowsLoading && displayRows.length === 0) {
                              return null;
                            }

                            return (
                              <Card key={exam.id} className="border border-green-100">
                                <CardContent className="p-4 space-y-3">
                                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                                    <div>
                                      <p className="font-semibold text-gray-900">{exam.title}</p>
                                      <p className="text-sm text-gray-500">
                                        {exam.subject || "General"} | {exam.num_items} items
                                      </p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      {isRowsLoading && (
                                        <Badge variant="outline" className="border-amber-200 text-amber-700">
                                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                          Syncing...
                                        </Badge>
                                      )}
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleSendSingleExam(view.cls, exam)}
                                        disabled={sendingExamKey === cacheKey}
                                        className="border-green-200 text-green-700"
                                      >
                                        {sendingExamKey === cacheKey ? (
                                          <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Sending
                                          </>
                                        ) : (
                                          <>
                                            <Mail className="w-4 h-4 mr-2" />
                                            Send All Results
                                          </>
                                        )}
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          handleSendSelectedExam(view.cls, exam, displayRows)
                                        }
                                        disabled={
                                          sendingExamKey === cacheKey || selectedDisplayCount === 0
                                        }
                                        className="border-blue-200 text-blue-700"
                                      >
                                        <Mail className="w-4 h-4 mr-2" />
                                        Send Selected ({selectedDisplayCount})
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleExport(view.cls, exam, "xlsx")}
                                        className="border-emerald-200 text-emerald-700"
                                      >
                                        <FileSpreadsheet className="w-4 h-4 mr-2" />
                                        Export XLSX
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleExport(view.cls, exam, "pdf")}
                                        className="border-red-200 text-red-700"
                                      >
                                        <FileText className="w-4 h-4 mr-2" />
                                        Export PDF
                                      </Button>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="rounded-lg border bg-white p-3">
                                      <p className="text-xs text-gray-500">Reported Students</p>
                                      <p className="text-xl font-bold text-green-700">
                                        {displayRows.length}
                                      </p>
                                    </div>
                                    <div className="rounded-lg border bg-white p-3">
                                      <p className="text-xs text-gray-500">Average Percentage</p>
                                      <p className="text-xl font-bold text-green-700">
                                        {displayRows.length ? `${avg}%` : "-"}
                                      </p>
                                    </div>
                                    <div className="rounded-lg border bg-white p-3">
                                      <p className="text-xs text-gray-500">Pass Count</p>
                                      <p className="text-xl font-bold text-green-700">
                                        {displayRows.filter((r) => r.status === "Passed").length}
                                      </p>
                                    </div>
                                  </div>

                                  {displayRows.length > 0 ? (
                                    <div className="overflow-x-auto rounded-lg border">
                                      <table className="min-w-full text-sm">
                                        <thead className="bg-green-50 text-left">
                                          <tr>
                                            <th className="px-3 py-2 w-10">
                                              <Checkbox
                                                checked={
                                                  allDisplayRowsSelected
                                                    ? true
                                                    : displayRowsPartiallySelected
                                                      ? "indeterminate"
                                                      : false
                                                }
                                                onCheckedChange={(checked) =>
                                                  setExamBulkSelection(
                                                    cacheKey,
                                                    displayRows,
                                                    checked === true,
                                                  )
                                                }
                                                aria-label="Select all students in exam"
                                              />
                                            </th>
                                            <th className="px-3 py-2 font-semibold">Student ID</th>
                                            <th className="px-3 py-2 font-semibold">Name</th>
                                            <th className="px-3 py-2 font-semibold">Score</th>
                                            <th className="px-3 py-2 font-semibold">Percentage</th>
                                            <th className="px-3 py-2 font-semibold">Status</th>
                                            <th className="px-3 py-2 font-semibold">Date</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {displayRows.map((row) => (
                                            <tr
                                              key={row.studentId}
                                              id={`results-row-${cacheKey}-${row.studentId}`}
                                              className="border-t transition-colors"
                                            >
                                              <td className="px-3 py-2">
                                                <Checkbox
                                                  checked={selectedIdSet.has(row.studentId)}
                                                  onCheckedChange={(checked) =>
                                                    setExamStudentSelection(
                                                      cacheKey,
                                                      row.studentId,
                                                      checked === true,
                                                    )
                                                  }
                                                  aria-label={`Select ${row.studentName}`}
                                                />
                                              </td>
                                              <td className="px-3 py-2 font-mono text-xs">
                                                {row.studentId}
                                              </td>
                                              <td className="px-3 py-2">{row.studentName}</td>
                                              <td className="px-3 py-2">
                                                {row.score}/{row.totalQuestions}
                                              </td>
                                              <td className="px-3 py-2">{row.percentage}%</td>
                                              <td className="px-3 py-2">
                                                <Badge
                                                  className={
                                                    row.status === "Passed"
                                                      ? "bg-green-100 text-green-700"
                                                      : "bg-red-100 text-red-700"
                                                  }
                                                >
                                                  {row.status}
                                                </Badge>
                                              </td>
                                              <td className="px-3 py-2">{row.date}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  ) : (
                                    <div className="rounded-lg border border-dashed bg-gray-50 px-4 py-5 text-sm text-gray-500">
                                      No student results available yet.
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            );
                          })
                          .filter((card): card is JSX.Element => card !== null);

                        if (examCards.length === 0) {
                          return (
                            <div className="rounded-lg border border-dashed bg-gray-50 px-4 py-5 text-sm text-gray-500">
                              No matching records for this student in the current class.
                            </div>
                          );
                        }

                        return examCards;
                      })()
                    )}
                  </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="text-xs text-gray-500 flex items-center gap-2">
      </div>
    </div>
  );
}
