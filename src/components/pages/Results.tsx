"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
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
import { exportExamReportToExcel } from "@/services/excelExportService";
import { ExportMetadata, generateExamReportPdf } from "@/services/pdfReportService";
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

  const [expandedClassIds, setExpandedClassIds] = useState<Set<string>>(new Set());
  const [rowsCache, setRowsCache] = useState<Record<string, HubStudentRow[]>>({});
  const [loadingRows, setLoadingRows] = useState<Record<string, boolean>>({});
  const [sendingExamKey, setSendingExamKey] = useState<string | null>(null);
  const [bulkSend, setBulkSend] = useState<BulkSendState>({
    running: false,
    total: 0,
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
  });

  const passingThreshold = 60;
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
    return classes.map((cls) => {
      const linkedExams = exams.filter(
        (exam) => exam.classId === cls.id || exam.className === cls.class_name,
      );

      return {
        cls,
        exams: linkedExams,
        yearLevel: cls.year || "Unspecified",
      };
    });
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

  useEffect(() => {
    const subscriptions = rowsSubscriptionsRef.current;
    return () => {
      subscriptions.forEach((unsubscribe) => unsubscribe());
      subscriptions.clear();
    };
  }, []);

  const sendExamResults = useCallback(
    async (cls: Class, exam: Exam): Promise<{ sent: number; failed: number; total: number }> => {
      const rows = await fetchExamRows(cls, exam);
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

      const metadata: ExportMetadata = {
        instructorName: user?.displayName || undefined,
        subject: exam.subject || undefined,
        section: cls.room || undefined,
        numItems: exam.num_items || undefined,
        choicesPerItem: exam.choices_per_item || undefined,
        examDate: exam.created_at || undefined,
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

            return (
              <div key={view.cls.id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <button
                  className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50/60 transition-colors"
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
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100 p-4 space-y-3">
                    {view.exams.length === 0 ? (
                      <p className="text-sm text-gray-400">No exams associated with this class.</p>
                    ) : (
                      view.exams.map((exam) => {
                        const cacheKey = keyFor(view.cls.id, exam.id);
                        const rows = rowsCache[cacheKey] || [];
                        const isRowsLoading = !!loadingRows[cacheKey];
                        const avg =
                          rows.length > 0
                            ? Math.round(rows.reduce((sum, row) => sum + row.percentage, 0) / rows.length)
                            : 0;

                        return (
                          <div key={exam.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
                            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                              <div>
                                <p className="text-sm font-bold text-gray-900">{exam.title}</p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {exam.subject || "General"} &nbsp;·&nbsp; {exam.num_items} items
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                {isRowsLoading && (
                                  <span className="text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full flex items-center gap-1">
                                    <Loader2 className="w-3 h-3 animate-spin" /> Syncing...
                                  </span>
                                )}
                                <button
                                  onClick={() => handleSendSingleExam(view.cls, exam)}
                                  disabled={sendingExamKey === cacheKey}
                                  className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                                >
                                  {sendingExamKey === cacheKey ? (
                                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending</>
                                  ) : (
                                    <><Mail className="w-3.5 h-3.5" /> Send Results</>
                                  )}
                                </button>
                                <button
                                  onClick={() => handleExport(view.cls, exam, "xlsx")}
                                  className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                                >
                                  <FileSpreadsheet className="w-3.5 h-3.5" /> Export XLSX
                                </button>
                                <button
                                  onClick={() => handleExport(view.cls, exam, "pdf")}
                                  className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                                >
                                  <FileText className="w-3.5 h-3.5" /> Export PDF
                                </button>
                              </div>
                            </div>

                            {/* Mini stat row */}
                            <div className="grid grid-cols-3 gap-3">
                              {[
                                { label: "Reported Students", value: rows.length },
                                { label: "Average Percentage", value: rows.length ? `${avg}%` : "—" },
                                { label: "Pass Count", value: rows.filter((r) => r.status === "Passed").length },
                              ].map((s) => (
                                <div key={s.label} className="border border-gray-100 rounded-xl p-3">
                                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{s.label}</p>
                                  <p className="text-xl font-bold text-green-600 mt-0.5">{s.value}</p>
                                </div>
                              ))}
                            </div>

                            {rows.length > 0 && (
                              <div className="overflow-x-auto rounded-xl border border-gray-100">
                                <table className="min-w-full text-xs">
                                  <thead>
                                    <tr className="border-b border-gray-100 bg-gray-50/50">
                                      <th className="px-3 py-2.5 text-left font-bold text-gray-400 uppercase tracking-wider">Student ID</th>
                                      <th className="px-3 py-2.5 text-left font-bold text-gray-400 uppercase tracking-wider">Name</th>
                                      <th className="px-3 py-2.5 text-left font-bold text-gray-400 uppercase tracking-wider">Score</th>
                                      <th className="px-3 py-2.5 text-left font-bold text-gray-400 uppercase tracking-wider">%</th>
                                      <th className="px-3 py-2.5 text-left font-bold text-gray-400 uppercase tracking-wider">Status</th>
                                      <th className="px-3 py-2.5 text-left font-bold text-gray-400 uppercase tracking-wider">Date</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-50">
                                    {rows.slice(0, 8).map((row) => (
                                      <tr key={row.studentId} className="hover:bg-gray-50/40 transition-colors">
                                        <td className="px-3 py-2 font-mono text-gray-600">{row.studentId}</td>
                                        <td className="px-3 py-2 font-medium text-gray-800">{row.studentName}</td>
                                        <td className="px-3 py-2 text-gray-600">{row.score}/{row.totalQuestions}</td>
                                        <td className="px-3 py-2 text-gray-600">{row.percentage}%</td>
                                        <td className="px-3 py-2">
                                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                            row.status === "Passed"
                                              ? "bg-green-50 text-green-600 border border-green-100"
                                              : "bg-red-50 text-red-500 border border-red-100"
                                          }`}>
                                            {row.status}
                                          </span>
                                        </td>
                                        <td className="px-3 py-2 text-gray-400">{row.date}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                {rows.length > 8 && (
                                  <div className="px-3 py-2 border-t border-gray-100 text-xs text-gray-400">
                                    Showing 8 of {rows.length} rows. Use Export to download full report.
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
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
