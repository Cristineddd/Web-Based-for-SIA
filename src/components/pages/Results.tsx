"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useDebounce } from "@/hooks/useDebounce";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  FileText,
  Download,
  Mail,
  X,
  ChevronRight,
  Folder,
  Users,
  Check,
  FileSpreadsheet,
  Info,
  Search,
  Filter,
  RotateCcw,
  Archive,
  Loader2,
  Table2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getClasses, Class } from "@/services/classService";
import { getExams, Exam } from "@/services/examService";
import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import ExamScoresTable from "@/components/pages/ExamScoresTable";
import ExportFilterPanel, {
  ExportDataRow,
  ExportFormat,
} from "@/components/pages/ExportFilterPanel";
import { exportClassResultsToExcel } from "@/services/excelExportService";
import {
  generateClassResultsPdf,
  generateClassSummaryPdf,
  ExportMetadata,
} from "@/services/pdfReportService";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  batchExportExams,
  BatchExportFormat,
  BatchExportProgress,
} from "@/services/batchExportService";
import { ReportHistoryService } from "@/services/reportHistoryService";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// Types for our component
interface ClassResult {
  classId: string;
  className: string;
  courseSubject: string;
  schedule: string;
  totalStudents: number;
  scannedCount: number;
  averageScore: number;
}

interface ExamStats {
  examId: string;
  scannedCount: number;
  averageScore: number;
}

interface StudentResult {
  studentId: string;
  studentName: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  grade: string;
  date: string;
  email?: string;
}

interface AnswerDetail {
  questionNumber: number;
  studentAnswer: string;
  correctAnswer: string;
  status: 'correct' | 'incorrect' | 'unanswered';
}

// Calculate letter grade from percentage
function calculateLetterGrade(percentage: number): string {
  if (percentage >= 90) return "A";
  if (percentage >= 85) return "A";
  if (percentage >= 80) return "B+";
  if (percentage >= 75) return "B";
  if (percentage >= 70) return "C";
  if (percentage >= 65) return "D";
  return "F";
}

// Get grade color class
function getGradeColorClass(grade: string): string {
  switch (grade) {
    case "A":
      return "bg-green-100 text-green-700";
    case "B+":
    case "B":
      return "bg-lime-100 text-lime-700";
    case "C":
      return "bg-yellow-100 text-yellow-700";
    case "D":
      return "bg-orange-100 text-orange-700";
    case "F":
      return "bg-red-100 text-red-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

// Send Results Panel Component
interface SendResultsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  className: string;
  students: StudentResult[];
  onSend: () => void;
  examTitle?: string;
  subject?: string;
  passingThreshold: number;
  instructorName?: string;
  instructorEmail?: string;
}

interface DeliveryResult {
  to: string;
  success: boolean;
  error?: string | null;
}

function SendResultsPanel({
  isOpen,
  onClose,
  className,
  students,
  onSend,
  examTitle,
  subject,
  passingThreshold,
  instructorName,
  instructorEmail,
}: SendResultsPanelProps) {
  const [emails, setEmails] = useState<{ [studentId: string]: string }>({});
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState<{
    sent: number;
    failed: number;
    total: number;
  } | null>(null);
  const [deliveryResults, setDeliveryResults] = useState<
    DeliveryResult[] | null
  >(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const defaultEmails: { [studentId: string]: string } = {};
    students.forEach((student) => {
      defaultEmails[student.studentId] =
        student.email || `${student.studentId}@gordoncollege.edu.ph`;
    });
    setEmails(defaultEmails);
  }, [students]);

  // Reset state when panel opens
  useEffect(() => {
    if (isOpen) {
      setDeliveryResults(null);
      setSendProgress(null);
      setErrorMessage(null);
    }
  }, [isOpen]);

  const handleSend = async () => {
    setIsSending(true);
    setErrorMessage(null);
    setSendProgress({ sent: 0, failed: 0, total: students.length });

    try {
      const payload = {
        className,
        examTitle: examTitle || "Exam",
        subject,
        passingThreshold,
        instructorName,
        instructorEmail,
        students: students.map((s) => ({
          studentId: s.studentId,
          studentName: s.studentName,
          email: emails[s.studentId] || s.email || '',
          score: s.score,
          totalQuestions: s.totalQuestions,
          percentage: s.percentage,
          grade: s.grade,
          date: s.date,
        })),
      };

      const res = await fetch("/api/send-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || "Failed to send emails.");
        setIsSending(false);
        return;
      }

      setSendProgress({
        sent: data.sent,
        failed: data.failed,
        total: data.total,
      });
      setDeliveryResults(data.results || []);
      setIsSending(false);

      if (data.failed === 0) {
        setTimeout(() => {
          onSend();
        }, 3000);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setErrorMessage(msg);
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  const sentCount = sendProgress?.sent ?? 0;
  const failedCount = sendProgress?.failed ?? 0;
  const isDone = deliveryResults !== null;

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md bg-green-600 shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-green-800 flex items-center justify-between">
        <div className="flex items-center gap-3 text-white">
          <Mail className="w-5 h-5" />
          <div>
            <h2 className="font-semibold">Send Results via Email</h2>
            <p className="text-sm text-green-200">
              {className} — {examTitle || "Exam"}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="text-white hover:text-green-200">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Error banner */}
        {errorMessage && (
          <div className="bg-red-900/40 border border-red-700 rounded-lg p-3 mb-4">
            <p className="text-sm text-red-200 font-medium">Failed to send</p>
            <p className="text-xs text-red-300 mt-1">{errorMessage}</p>
          </div>
        )}

        {isDone ? (
          /* Delivery report */
          <div className="space-y-4">
            <div className="flex flex-col items-center text-center py-4">
              {failedCount === 0 ? (
                <>
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                    <Check className="w-8 h-8 text-green-700" />
                  </div>
                  <h3 className="text-xl font-semibold text-white">
                    All Emails Sent!
                  </h3>
                  <p className="text-green-200 mt-1">
                    Results delivered to {sentCount} student
                    {sentCount !== 1 ? "s" : ""}
                  </p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center mb-4">
                    <Info className="w-8 h-8 text-yellow-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-white">
                    Delivery Complete
                  </h3>
                  <p className="text-green-200 mt-1">
                    {sentCount} sent &bull; {failedCount} failed
                  </p>
                </>
              )}
            </div>

            {/* Per-student results */}
            {deliveryResults && deliveryResults.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-green-300 font-medium">
                  Delivery Details
                </p>
                {deliveryResults.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between bg-white/10 rounded-lg px-3 py-2"
                  >
                    <span className="text-sm text-white truncate mr-2">
                      {r.to}
                    </span>
                    {r.success ? (
                      <span className="text-xs text-green-300 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Sent
                      </span>
                    ) : (
                      <span
                        className="text-xs text-red-300 flex items-center gap-1"
                        title={r.error || ""}
                      >
                        <X className="w-3 h-3" /> Failed
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            <Button
              onClick={onClose}
              className="w-full bg-white text-green-800 hover:bg-gray-100 font-semibold py-3 mt-4"
            >
              Close
            </Button>
          </div>
        ) : (
          /* Email form — each student gets their own score email */
          <>
            <div className="bg-blue-900/30 rounded-lg p-3 mb-4 flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-300 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-100">
                Each student will receive a personalized email with their
                individual exam score and grade.
              </p>
            </div>

            {/* Sending progress */}
            {isSending && sendProgress && (
              <div className="bg-white/10 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-3 mb-2">
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                  <p className="text-sm text-white font-medium">
                    Sending emails to students...
                  </p>
                </div>
                <Progress
                  value={
                    ((sentCount + failedCount) / (sendProgress.total || 1)) *
                    100
                  }
                  className="h-2"
                />
                <p className="text-xs text-green-200 mt-2">
                  {sentCount + failedCount} of {sendProgress.total} processed
                </p>
              </div>
            )}

            <div className="space-y-3">
              {students.map((student) => (
                <div
                  key={student.studentId}
                  className="bg-white rounded-lg p-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium text-gray-900">
                        {student.studentName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {student.studentId}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-sm font-semibold ${getGradeColorClass(student.grade)}`}
                    >
                      {student.score}/{student.totalQuestions}
                    </span>
                  </div>
                  <input
                    type="email"
                    value={emails[student.studentId] || ""}
                    onChange={(e) =>
                      setEmails((prev) => ({
                        ...prev,
                        [student.studentId]: e.target.value,
                      }))
                    }
                    placeholder="Enter student email address"
                    disabled={isSending}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-gray-50 disabled:opacity-50"
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      {!isDone && (
        <div className="p-4 border-t border-green-800">
          <Button
            onClick={handleSend}
            disabled={isSending}
            className="w-full bg-white text-green-800 hover:bg-gray-100 font-semibold py-3"
          >
            {isSending ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-green-800 border-t-transparent rounded-full animate-spin" />
                Sending to students...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Send to {students.length} Students
              </span>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

export default function Results() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<Class[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [classResults, setClassResults] = useState<ClassResult[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassResult | null>(null);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [classExamsList, setClassExamsList] = useState<Exam[]>([]);
  const [examStats, setExamStats] = useState<Record<string, ExamStats>>({});
  const [, setSelectedClassData] = useState<Class | null>(null);
  const [studentResults, setStudentResults] = useState<StudentResult[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Refs for real-time listener cleanup
  const examStatsUnsubs = useRef<(() => void)[]>([]);
  const studentResultsUnsub = useRef<(() => void) | null>(null);

  // Passing threshold
  const [passingThreshold, setPassingThreshold] = useState(60);

  // Update threshold when instructor changes it inline
  const handleThresholdChange = useCallback((newThreshold: number) => {
    setPassingThreshold(newThreshold);
  }, []);

  // Modal states
  const [exportModalType, setExportModalType] = useState<
    "PDF" | "Excel" | "CSV" | null
  >(null);
  const [showSendPanel, setShowSendPanel] = useState(false);
  const [viewingStudent, setViewingStudent] = useState<StudentResult | null>(null);
  const [answerDetails, setAnswerDetails] = useState<AnswerDetail[]>([]);
  const [loadingAnswerDetails, ] = useState(false);

  // ── Batch export state (SS4 2.5) ────────────────────────────────────────
  const [selectedExamIds, setSelectedExamIds] = useState<Set<string>>(
    new Set(),
  );
  const [batchExporting, setBatchExporting] = useState(false);
  const [batchProgress, setBatchProgress] =
    useState<BatchExportProgress | null>(null);
  const [batchFormatPicker, setBatchFormatPicker] = useState(false);

  const toggleExamSelection = useCallback((examId: string) => {
    setSelectedExamIds((prev) => {
      const next = new Set(prev);
      if (next.has(examId)) next.delete(examId);
      else next.add(examId);
      return next;
    });
  }, []);

  const toggleAllExams = useCallback(() => {
    if (!classExamsList.length) return;
    setSelectedExamIds((prev) => {
      const allIds = classExamsList.map((e) => e.id);
      const allSelected = allIds.every((id) => prev.has(id));
      if (allSelected) {
        return new Set<string>();
      }
      return new Set(allIds);
    });
  }, [classExamsList]);

  const handleBatchExport = useCallback(
    async (format: BatchExportFormat) => {
      if (!selectedClass || selectedExamIds.size === 0) return;
      const fullClass = classes.find((c) => c.id === selectedClass.classId);
      if (!fullClass) return;

      const selectedExams = classExamsList.filter((e) =>
        selectedExamIds.has(e.id),
      );
      if (selectedExams.length === 0) return;

      setBatchExporting(true);
      setBatchFormatPicker(false);
      setBatchProgress({
        total: selectedExams.length,
        completed: 0,
        currentExamTitle: "",
        step: "Starting...",
        percent: 0,
      });

      try {
        await batchExportExams({
          classId: selectedClass.classId,
          className: selectedClass.className,
          students: fullClass.students || [],
          exams: selectedExams,
          format,
          passingThreshold,
          metadata: {
            instructorName: user?.displayName || undefined,
            section: selectedClass.schedule || undefined,
          },
          onProgress: (p) => setBatchProgress({ ...p }),
        });
        // Log to report history
        if (user?.instructorId) {
          ReportHistoryService.logReport({
            instructorId: user.instructorId,
            reportType: "batch-export",
            format: "Batch",
            title: `Batch Export — ${selectedClass.className} (${selectedExams.length} exams)`,
            className: selectedClass.className,
            studentCount: fullClass.students?.length || 0,
            description: `${format.toUpperCase()} batch export of ${selectedExams.length} exams`,
          }).catch(() => {});
        }
      } catch (err) {
        console.error("Batch export failed:", err);
      } finally {
        setBatchExporting(false);
        // Keep progress visible briefly so the user sees "Done!"
        setTimeout(() => setBatchProgress(null), 1500);
      }
    },
    [
      selectedClass,
      selectedExamIds,
      classExamsList,
      classes,
      passingThreshold,
      user?.displayName,
    ],
  );

  // ── Filter state ────────────────────────────────────────────────────────
  // Class list filters
  const [classSearch, setClassSearch] = useState(searchParams.get("cs") || "");
  const [classMinAvg, setClassMinAvg] = useState(
    searchParams.get("cmin") || "",
  );
  const [classMaxAvg, setClassMaxAvg] = useState(
    searchParams.get("cmax") || "",
  );

  // Exam list filters
  const [examSearch, setExamSearch] = useState(searchParams.get("es") || "");
  const [subjectFilter, setSubjectFilter] = useState(
    searchParams.get("subj") || "all",
  );

  // Show/hide filter panels
  const [showClassFilters, setShowClassFilters] = useState(false);

  // ── URL state sync helper ───────────────────────────────────────────────
  const updateURL = useCallback(
    (params: Record<string, string | null>) => {
      const current = new URLSearchParams(searchParams.toString());
      Object.entries(params).forEach(([key, value]) => {
        if (value && value !== "all") {
          current.set(key, value);
        } else {
          current.delete(key);
        }
      });
      const qs = current.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [searchParams, router, pathname],
  );

  // ── Filtered class results ──────────────────────────────────────────────
  const debouncedClassSearch = useDebounce(classSearch, 200);
  const filteredClassResults = useMemo(() => {
    let results = classResults;
    if (debouncedClassSearch.trim()) {
      const q = debouncedClassSearch.toLowerCase();
      results = results.filter(
        (r) =>
          r.className.toLowerCase().includes(q) ||
          r.schedule.toLowerCase().includes(q),
      );
    }
    if (classMinAvg !== "") {
      const min = Number(classMinAvg);
      if (!isNaN(min)) results = results.filter((r) => r.averageScore >= min);
    }
    if (classMaxAvg !== "") {
      const max = Number(classMaxAvg);
      if (!isNaN(max)) results = results.filter((r) => r.averageScore <= max);
    }
    return results;
  }, [classResults, debouncedClassSearch, classMinAvg, classMaxAvg]);

  // ── Unique subjects for exam filter ───────────────────────────────────
  const availableSubjects = useMemo(() => {
    const subjects = new Set(
      classExamsList.map((e) => e.subject).filter(Boolean),
    );
    return Array.from(subjects).sort();
  }, [classExamsList]);

  // ── Filtered exams list ────────────────────────────────────────────────
  const debouncedExamSearch = useDebounce(examSearch, 200);
  const filteredExamsList = useMemo(() => {
    let list = classExamsList;
    if (debouncedExamSearch.trim()) {
      const q = debouncedExamSearch.toLowerCase();
      list = list.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          (e.subject && e.subject.toLowerCase().includes(q)),
      );
    }
    if (subjectFilter !== "all") {
      list = list.filter((e) => e.subject === subjectFilter);
    }
    return list;
  }, [classExamsList, examSearch, subjectFilter]);

  // ── Active filter counts ──────────────────────────────────────────────
  const classFilterCount = useMemo(() => {
    let n = 0;
    if (classSearch.trim()) n++;
    if (classMinAvg !== "") n++;
    if (classMaxAvg !== "") n++;
    return n;
  }, [classSearch, classMinAvg, classMaxAvg]);

  const examFilterCount = useMemo(() => {
    let n = 0;
    if (examSearch.trim()) n++;
    if (subjectFilter !== "all") n++;
    return n;
  }, [examSearch, subjectFilter]);

  const clearClassFilters = useCallback(() => {
    setClassSearch("");
    setClassMinAvg("");
    setClassMaxAvg("");
    updateURL({ cs: null, cmin: null, cmax: null });
  }, [updateURL]);

  const clearExamFilters = useCallback(() => {
    setExamSearch("");
    setSubjectFilter("all");
    updateURL({ es: null, subj: null });
  }, [updateURL]);

  // Fetch classes and exams
  const fetchData = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      // Fetch classes for this user
      const userClasses = await getClasses(user.id);
      setClasses(userClasses);

      // Fetch exams for this user
      const userExams = await getExams(user.id);
      setExams(userExams);

      // Calculate results for each class
      const results: ClassResult[] = await Promise.all(
        userClasses.map(async (cls) => {
          // Find exams for this class
          const classExams = userExams.filter(
            (e) =>
              e.className === cls.class_name || (e as any).classId === cls.id,
          );
          const examIds = classExams.map((e) => e.id);

          let scannedCount = 0;
          let totalScore = 0;
          let totalMaxScore = 0;

          // Query scanned results for these exams
          if (examIds.length > 0) {
            try {
              const scannedResultsQuery = query(
                collection(db, "scannedResults"),
                where("examId", "in", examIds.slice(0, 10)), // Firestore limit
              );
              const scannedSnapshot = await getDocs(scannedResultsQuery);

              scannedSnapshot.forEach((doc) => {
                const data = doc.data();
                if (!data.isNullId) {
                  scannedCount++;
                  totalScore += data.score || 0;
                  totalMaxScore += data.totalQuestions || 0;
                }
              });
            } catch (err) {
              console.error("Error fetching scanned results:", err);
            }
          }

          // Also check studentGrades collection
          try {
            const gradesQuery = query(
              collection(db, "studentGrades"),
              where("class_id", "==", cls.id),
            );
            const gradesSnapshot = await getDocs(gradesQuery);

            gradesSnapshot.forEach((doc) => {
              const data = doc.data();
              scannedCount++;
              totalScore += data.score || 0;
              totalMaxScore += data.max_score || 0;
            });
          } catch (err) {
          }

          const averageScore =
            totalMaxScore > 0
              ? Math.round((totalScore / totalMaxScore) * 100)
              : 0;

          return {
            classId: cls.id,
            className: cls.class_name,
            courseSubject: cls.course_subject || "General",
            schedule: cls.room || "No schedule set",
            totalStudents: cls.students?.length || 0,
            scannedCount: scannedCount,
            averageScore: averageScore,
          };
        }),
      );

      setClassResults(results);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Cleanup exam-stats and student-results listeners on unmount
  useEffect(() => {
    return () => {
      examStatsUnsubs.current.forEach((u) => u());
      if (studentResultsUnsub.current) studentResultsUnsub.current();
    };
  }, []);

  // ── Real-time listeners for class average updates ─────────────────────
  // Listens to BOTH studentGrades AND scannedResults so averages update
  // instantly when new scores arrive from either source.
  useEffect(() => {
    if (!classResults.length || !exams.length) return;

    const unsubscribes: (() => void)[] = [];

    classResults.forEach((cr) => {
      // Accumulator shared across both listeners for this class
      let gradesData = { totalScore: 0, totalMaxScore: 0, count: 0 };
      let scannedData = { totalScore: 0, totalMaxScore: 0, count: 0 };

      const recalculate = () => {
        const combinedScore = gradesData.totalScore + scannedData.totalScore;
        const combinedMax =
          gradesData.totalMaxScore + scannedData.totalMaxScore;
        const combinedCount = gradesData.count + scannedData.count;
        const newAverage =
          combinedMax > 0 ? Math.round((combinedScore / combinedMax) * 100) : 0;

        setClassResults((prev) =>
          prev.map((r) =>
            r.classId === cr.classId
              ? { ...r, averageScore: newAverage, scannedCount: combinedCount }
              : r,
          ),
        );
      };

      // 1. Listen to studentGrades for this class
      const gradesQ = query(
        collection(db, "studentGrades"),
        where("class_id", "==", cr.classId),
      );
      unsubscribes.push(
        onSnapshot(gradesQ, (snapshot) => {
          let totalScore = 0,
            totalMaxScore = 0,
            count = 0;
          snapshot.forEach((doc) => {
            const d = doc.data();
            count++;
            totalScore += d.score || 0;
            totalMaxScore += d.max_score || 0;
          });
          gradesData = { totalScore, totalMaxScore, count };
          recalculate();
        }),
      );

      // 2. Listen to scannedResults for exams belonging to this class
      const classExams = exams.filter(
        (e) =>
          e.className === cr.className || (e as any).classId === cr.classId,
      );
      const examIds = classExams.map((e) => e.id);

      if (examIds.length > 0) {
        // Firestore 'in' supports max 30 values
        const chunks: string[][] = [];
        for (let i = 0; i < examIds.length; i += 10) {
          chunks.push(examIds.slice(i, i + 10));
        }

        // Per-chunk accumulators that merge into scannedData
        const chunkData: Record<
          number,
          { totalScore: number; totalMaxScore: number; count: number }
        > = {};

        chunks.forEach((chunk, idx) => {
          const scannedQ = query(
            collection(db, "scannedResults"),
            where("examId", "in", chunk),
          );
          unsubscribes.push(
            onSnapshot(scannedQ, (snapshot) => {
              let totalScore = 0,
                totalMaxScore = 0,
                count = 0;
              snapshot.forEach((doc) => {
                const d = doc.data();
                if (!d.isNullId) {
                  count++;
                  totalScore += d.score || 0;
                  totalMaxScore += d.totalQuestions || 0;
                }
              });
              chunkData[idx] = { totalScore, totalMaxScore, count };

              // Merge all chunks
              const merged = { totalScore: 0, totalMaxScore: 0, count: 0 };
              Object.values(chunkData).forEach((cd) => {
                merged.totalScore += cd.totalScore;
                merged.totalMaxScore += cd.totalMaxScore;
                merged.count += cd.count;
              });
              scannedData = merged;
              recalculate();
            }),
          );
        });
      }
    });

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
    // Re-subscribe when the set of class IDs or exams changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    classResults.map((c) => c.classId).join(","),
    exams.map((e) => e.id).join(","),
  ]);

  // Handle clicking a class — show exams for that class
  const handleClassClick = useCallback(
    async (classResult: ClassResult) => {
      // Clean up previous listeners
      examStatsUnsubs.current.forEach((u) => u());
      examStatsUnsubs.current = [];
      if (studentResultsUnsub.current) {
        studentResultsUnsub.current();
        studentResultsUnsub.current = null;
      }

      setSelectedClass(classResult);
      setSelectedExam(null);
      setStudentResults([]);
      setSelectedExamIds(new Set());
      setExamStats({});

      // Find exams linked to this class
      const classExams = exams.filter(
        (e) =>
          e.className === classResult.className ||
          (e as any).classId === classResult.classId,
      );
      setClassExamsList(classExams);

      // Set up real-time listeners for each exam's scannedResults
      classExams.forEach((exam) => {
        const scannedQ = query(
          collection(db, "scannedResults"),
          where("examId", "==", exam.id),
        );

        const unsub = onSnapshot(scannedQ, (snapshot) => {
          let scannedCount = 0;
          let totalScore = 0;
          let totalMaxScore = 0;

          snapshot.forEach((doc) => {
            const data = doc.data();
            if (!data.isNullId) {
              scannedCount++;
              totalScore += data.score || 0;
              totalMaxScore += data.totalQuestions || 0;
            }
          });

          const averageScore =
            totalMaxScore > 0
              ? Math.round((totalScore / totalMaxScore) * 100)
              : 0;

          setExamStats((prev) => ({
            ...prev,
            [exam.id]: { examId: exam.id, scannedCount, averageScore },
          }));
        });

        examStatsUnsubs.current.push(unsub);
      });
    },
    [exams],
  );

  // Fetch student results for a selected exam within a class (real-time)
  const fetchStudentResults = useCallback(
    (classResult: ClassResult, exam: Exam) => {
      // Clean up previous student results listener
      if (studentResultsUnsub.current) {
        studentResultsUnsub.current();
        studentResultsUnsub.current = null;
      }

      setLoadingStudents(true);
      setSelectedExam(exam);

      // Find the full class data
      const fullClass = classes.find((c) => c.id === classResult.classId);
      setSelectedClassData(fullClass || null);

      const students = fullClass?.students || [];

      // Helper to build StudentResult from scanned/graded data
      const buildResults = (
        scannedDocs: { id: string; data: Record<string, any> }[],
        gradeDocs: { id: string; data: Record<string, any> }[],
      ): StudentResult[] => {
        const results: StudentResult[] = [];
        const processedStudentIds = new Set<string>();

        // Process scannedResults first
        for (const doc of scannedDocs) {
          const data = doc.data;
          if (!data.isNullId && !processedStudentIds.has(data.studentId)) {
            processedStudentIds.add(data.studentId);
            const student = students.find(
              (s) => s.student_id === data.studentId,
            );
            const percentage =
              data.totalQuestions > 0
                ? Math.round((data.score / data.totalQuestions) * 100)
                : 0;

            let scannedDate = "";
            if (data.scannedAt) {
              const timestamp = data.scannedAt as Timestamp;
              const date = timestamp?.toDate?.() || new Date(data.scannedAt);
              scannedDate = date.toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              });
            }

            results.push({
              studentId: data.studentId,
              studentName: student
                ? `${student.last_name}, ${student.first_name}`
                : data.studentId,
              score: data.score || 0,
              totalQuestions: data.totalQuestions || 0,
              percentage,
              grade: calculateLetterGrade(percentage),
              date: scannedDate || "N/A",
              email: student?.email,
            });
          }
        }

        // Then process studentGrades
        for (const doc of gradeDocs) {
          const data = doc.data;
          if (!processedStudentIds.has(data.student_id)) {
            processedStudentIds.add(data.student_id);
            const student = students.find(
              (s) => s.student_id === data.student_id,
            );
            const percentage =
              data.percentage ||
              (data.max_score > 0
                ? Math.round((data.score / data.max_score) * 100)
                : 0);

            let gradedDate = "";
            if (data.graded_at) {
              const timestamp = data.graded_at as Timestamp;
              const date = timestamp?.toDate?.() || new Date(data.graded_at);
              gradedDate = date.toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              });
            }

            results.push({
              studentId: data.student_id,
              studentName: student
                ? `${student.last_name}, ${student.first_name}`
                : data.student_id,
              score: data.score || 0,
              totalQuestions: data.max_score || 0,
              percentage,
              grade: data.letter_grade || calculateLetterGrade(percentage),
              date: gradedDate || "N/A",
              email: student?.email,
            });
          }
        }

        results.sort((a, b) => a.studentName.localeCompare(b.studentName));
        return results;
      };

      // Accumulators for both data sources
      let scannedDocs: { id: string; data: Record<string, any> }[] = [];
      let gradeDocs: { id: string; data: Record<string, any> }[] = [];
      let scannedReady = false;
      let gradesReady = false;

      const recalculate = () => {
        if (scannedReady && gradesReady) {
          setStudentResults(buildResults(scannedDocs, gradeDocs));
          setLoadingStudents(false);
        }
      };

      const unsubs: (() => void)[] = [];

      // Listen to scannedResults for this exam
      const scannedQ = query(
        collection(db, "scannedResults"),
        where("examId", "==", exam.id),
      );
      unsubs.push(
        onSnapshot(scannedQ, (snapshot) => {
          scannedDocs = snapshot.docs.map((d) => ({
            id: d.id,
            data: d.data(),
          }));
          scannedReady = true;
          recalculate();
        }),
      );

      // Listen to studentGrades for this class
      const gradesQ = query(
        collection(db, "studentGrades"),
        where("class_id", "==", classResult.classId),
      );
      unsubs.push(
        onSnapshot(gradesQ, (snapshot) => {
          gradeDocs = snapshot.docs.map((d) => ({ id: d.id, data: d.data() }));
          gradesReady = true;
          recalculate();
        }),
      );

      // Store cleanup
      studentResultsUnsub.current = () => {
        unsubs.forEach((u) => u());
      };
    },
    [classes],
  );

  // ── Filtered export handler (SS4 3.1) ──────────────────────────────────
  // Receives only the filtered rows from ExportFilterPanel and exports them.
  const handleFilteredExport = useCallback(
    async (filteredRows: ExportDataRow[], format: ExportFormat) => {
      if (!selectedClass || filteredRows.length === 0) return;

      const meta: ExportMetadata = {
        instructorName: user?.displayName || undefined,
        subject: selectedExam?.subject || undefined,
        section: selectedClass?.schedule || undefined,
        numItems: selectedExam?.num_items || undefined,
        choicesPerItem: selectedExam?.choices_per_item || undefined,
        examDate: selectedExam?.created_at || undefined,
        examCode: selectedExam?.examCode || undefined,
      };

      const rows = filteredRows.map((r) => ({
        studentId: r.studentId,
        studentName: r.studentName,
        score: r.score,
        totalQuestions: r.totalQuestions,
        percentage: r.percentage,
        grade: r.grade,
        date: r.date,
        email: r.email,
      }));

      switch (format) {
        case "PDF":
          await generateClassResultsPdf(
            selectedClass.className,
            selectedExam?.title || "Exam",
            rows,
            passingThreshold,
            meta,
          );
          // Log to report history
          if (user?.instructorId) {
            ReportHistoryService.logReport({
              instructorId: user.instructorId,
              reportType: "class-results",
              format: "PDF",
              title: `${selectedClass.className} — ${selectedExam?.title || "Exam"}`,
              className: selectedClass.className,
              examTitle: selectedExam?.title,
              studentCount: filteredRows.length,
              filtersApplied:
                filteredRows.length !== rows.length
                  ? `Filtered to ${filteredRows.length} students`
                  : undefined,
            }).catch(() => {});
          }
          break;

        case "Excel":
          exportClassResultsToExcel(
            selectedClass.className,
            rows,
            passingThreshold,
            meta,
          );
          // Log to report history
          if (user?.instructorId) {
            ReportHistoryService.logReport({
              instructorId: user.instructorId,
              reportType: "class-results",
              format: "Excel",
              title: `${selectedClass.className} — ${selectedExam?.title || "Exam"}`,
              className: selectedClass.className,
              examTitle: selectedExam?.title,
              studentCount: filteredRows.length,
              filtersApplied:
                filteredRows.length !== rows.length
                  ? `Filtered to ${filteredRows.length} students`
                  : undefined,
            }).catch(() => {});
          }
          break;

        case "CSV": {
          const percentages = filteredRows.map((r) => r.percentage);
          const avg = Math.round(
            percentages.reduce((a, b) => a + b, 0) / percentages.length,
          );
          const passCount = percentages.filter(
            (p) => p >= passingThreshold,
          ).length;

          const headers = [
            "#",
            "Student ID",
            "Student Name",
            "Score",
            "Total",
            "Percentage",
            "Grade",
            "Date",
          ];
          const csvRows = filteredRows.map((result, index) => [
            index + 1,
            result.studentId,
            `"${result.studentName}"`,
            result.score,
            result.totalQuestions,
            `${result.percentage}%`,
            result.grade,
            result.date,
          ]);

          const metaLines: string[] = [];
          if (user?.displayName)
            metaLines.push(`Instructor,${user.displayName}`);
          if (selectedExam?.subject)
            metaLines.push(`Subject,${selectedExam.subject}`);
          if (selectedClass?.schedule)
            metaLines.push(`Section,"${selectedClass.schedule}"`);
          if (selectedExam?.num_items)
            metaLines.push(`No. of Items,${selectedExam.num_items}`);
          if (selectedExam?.choices_per_item)
            metaLines.push(`Choices per Item,${selectedExam.choices_per_item}`);
          if (selectedExam?.examCode)
            metaLines.push(`Exam Code,${selectedExam.examCode}`);
          if (selectedExam?.created_at)
            metaLines.push(`Exam Date,${selectedExam.created_at}`);

          const statsBlk = [
            [],
            ["Statistics Summary"],
            ["Class Average", `${avg}%`],
            ["Highest Score", `${Math.max(...percentages)}%`],
            ["Lowest Score", `${Math.min(...percentages)}%`],
            [`Passed (\u2265${passingThreshold}%)`, passCount],
            [`Failed (<${passingThreshold}%)`, percentages.length - passCount],
          ];

          const csvContent = [
            ...metaLines,
            "",
            headers.join(","),
            ...csvRows.map((r) => r.join(",")),
            ...statsBlk.map((r) => r.join(",")),
          ].join("\n");
          const blob = new Blob([csvContent], { type: "text/csv" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${selectedClass.className}_results.csv`;
          a.click();
          URL.revokeObjectURL(url);
          // Log to report history
          if (user?.instructorId) {
            ReportHistoryService.logReport({
              instructorId: user.instructorId,
              reportType: "class-results",
              format: "CSV",
              title: `${selectedClass.className} — ${selectedExam?.title || "Exam"}`,
              className: selectedClass.className,
              examTitle: selectedExam?.title,
              studentCount: filteredRows.length,
              fileSizeBytes: blob.size,
              fileName: `${selectedClass.className}_results.csv`,
              filtersApplied:
                filteredRows.length !== rows.length
                  ? `Filtered to ${filteredRows.length} students`
                  : undefined,
            }).catch(() => {});
          }
          break;
        }
      }

      setExportModalType(null);
    },
    [selectedClass, selectedExam, passingThreshold, user],
  );

  // Render loading state
  if (loading) {
    return (
      <div className="page-container">
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            Results &amp; Analytics
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            View and export grading results by class
          </p>
        </div>
      </div>
    );
  }

  // Render exam list for selected class
  if (selectedClass && !selectedExam) {
    return (
      <div className="page-container bg-white min-h-screen">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              Results &amp; Analytics
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              View and export grading results by class
            </p>
          </div>
        </div>

        {/* Class Info Bar */}
        <div className="flex items-center gap-4">
          <Button
            onClick={() => {
              setSelectedClass(null);
              setClassExamsList([]);
              setSelectedExamIds(new Set());
            }}
            variant="ghost"
            size="icon"
            className="hover:bg-muted shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold text-green-700 leading-tight truncate">
              {selectedClass.className}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {selectedClass.totalStudents} students
              {selectedClass.courseSubject && (
                <span> • {selectedClass.courseSubject}</span>
              )}
              {selectedClass.schedule && selectedClass.schedule !== 'No room set' && (
                <span> • Room {selectedClass.schedule}</span>
              )}
            </p>
          </div>
        </div>

        {/* Batch Export Action Bar - Only show when exams are selected */}
        {classExamsList.length > 0 && selectedExamIds.size > 0 && (
          <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-3 mb-4">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={
                  classExamsList.length > 0 &&
                  classExamsList.every((e) => selectedExamIds.has(e.id))
                }
                onCheckedChange={toggleAllExams}
                aria-label="Select all exams"
                className="transition-all duration-200"
              />
              <span className="text-sm font-medium text-gray-700">
                {selectedExamIds.size} exam{selectedExamIds.size > 1 ? "s" : ""} selected
              </span>
            </div>
            <div className="flex items-center gap-2 relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedExamIds(new Set())}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-4 h-4 mr-1" />
                Clear
              </Button>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white animate-in fade-in-50 duration-200"
                onClick={() => setBatchFormatPicker((v) => !v)}
                disabled={batchExporting}
              >
                <Archive className="w-4 h-4 mr-2" />
                Export Selected
              </Button>
              {/* Format picker dropdown */}
              {batchFormatPicker && (
                <div className="absolute right-0 top-full mt-1 z-50 bg-white border rounded-lg shadow-lg py-1 min-w-[180px]">
                  <button
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                    onClick={() => handleBatchExport("pdf")}
                  >
                    <FileText className="w-4 h-4 text-red-500" />
                    PDF Reports
                  </button>
                  <button
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                    onClick={() => handleBatchExport("excel")}
                  >
                    <FileSpreadsheet className="w-4 h-4 text-green-700" />
                    Excel Spreadsheets
                  </button>
                  <button
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                    onClick={() => handleBatchExport("both")}
                  >
                    <Download className="w-4 h-4 text-blue-600" />
                    Both (PDF + Excel)
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Batch Export Progress Modal */}
        {batchProgress && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-sm">
            <Card className="w-full max-w-md p-6 mx-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center">
                  {batchProgress.percent < 100 ? (
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  ) : (
                    <Check className="w-5 h-5 text-white" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-green-700">Batch Export</h3>
                  <p className="text-sm text-gray-500">
                    {batchProgress.completed} of {batchProgress.total} exams
                  </p>
                </div>
              </div>
              <Progress value={batchProgress.percent} className="h-3" />
              <p className="text-sm text-gray-600 truncate">
                {batchProgress.step}
              </p>
              {batchProgress.percent >= 100 && (
                <p className="text-sm text-green-700 font-medium">
                  Download complete!
                </p>
              )}
            </Card>
          </div>
        )}

        {/* Exam Search & Filter Bar */}
        {classExamsList.length > 0 && (
          <div className="space-y-3 mb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  placeholder="Search exams by title, subject, or template ID..."
                  value={examSearch}
                  onChange={(e) => {
                    setExamSearch(e.target.value);
                    updateURL({ es: e.target.value || null });
                  }}
                  className="pl-12 h-14 bg-white border-gray-200 shadow-sm rounded-xl text-base focus:outline-none focus:ring-0 focus:border-gray-300 border-2"
                />
              </div>
              {/* Subject filter */}
              {availableSubjects.length > 1 && (
                <Select
                  value={subjectFilter}
                  onValueChange={(v) => {
                    setSubjectFilter(v);
                    updateURL({ subj: v === "all" ? null : v });
                  }}
                >
                  <SelectTrigger className="w-[200px] h-14 bg-white border-gray-200 shadow-sm rounded-xl border-2">
                    <SelectValue placeholder="All Subjects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Subjects</SelectItem>
                    {availableSubjects.map((subj) => (
                      <SelectItem key={subj} value={subj}>
                        {subj}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {/* Clear filters */}
              {examFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearExamFilters}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 h-14 px-6 rounded-xl font-medium"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Clear ({examFilterCount})
                </Button>
              )}
            </div>

            {/* Result count */}
            {examFilterCount > 0 && (
              <p className="text-sm text-muted-foreground">
                Showing {filteredExamsList.length} of {classExamsList.length}{" "}
                exams
              </p>
            )}
          </div>
        )}

        {/* Exams List */}
        {classExamsList.length === 0 ? (
          <Card className="p-12 border text-center">
            <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold text-gray-700">
              No Exams Found
            </h3>
            <p className="text-gray-500 mt-2">
              No exams are linked to this class yet.
            </p>
          </Card>
        ) : filteredExamsList.length === 0 ? (
          <Card className="p-12 border text-center">
            <Search className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold text-gray-700">
              No Matching Exams
            </h3>
            <p className="text-gray-500 mt-2">
              Try adjusting your search or subject filter.
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={clearExamFilters}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Clear Filters
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredExamsList.map((exam) => {
              const stats = examStats[exam.id];
              const scanned = stats?.scannedCount || 0;
              const avg = stats?.averageScore || 0;
              const total = selectedClass.totalStudents;
              const progressPercent =
                total > 0 ? Math.round((scanned / total) * 100) : 0;
              const isSelected = selectedExamIds.has(exam.id);

              return (
                <Card
                  key={exam.id}
                  className={`p-5 border transition-all cursor-pointer group relative ${
                    isSelected
                      ? "border-green-500 bg-green-50/30 shadow-sm"
                      : "border-gray-200 hover:border-green-400 hover:shadow-md bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                        className="flex items-center flex-shrink-0"
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleExamSelection(exam.id)}
                          aria-label={`Select ${exam.title}`}
                          className={`transition-all duration-200 ${isSelected ? 'scale-110' : ''}`}
                        />
                      </div>
                      <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-green-100 transition-colors">
                        <FileText className="w-6 h-6 text-green-600" />
                      </div>
                      <div className="min-w-0 flex-1" onClick={() => fetchStudentResults(selectedClass, exam)}>
                        <h3 className="text-base font-bold text-gray-900 truncate mb-0.5">
                          {exam.title}
                        </h3>
                        <p className="text-[13px] text-gray-500">
                          {exam.subject || "General"} • {exam.num_items} items
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="hidden md:flex flex-col items-end">
                        <p className="text-[11px] uppercase tracking-[0.05em] font-semibold text-gray-400 mb-1">
                          COMPLETION
                        </p>
                        <p className="text-lg font-bold text-green-700 leading-none mb-1">
                          {progressPercent}%
                        </p>
                        <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-600 rounded-full transition-all duration-300"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => fetchStudentResults(selectedClass, exam)}
                        className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-green-600 group-hover:text-white transition-all"
                        title="View details"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {scanned === 0 && total > 0 ? (
                      <div className="col-span-2 bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
                        <Info className="w-4 h-4 text-gray-400 mx-auto mb-1" />
                        <p className="text-xs text-gray-500">No scans yet. Start scanning to see results.</p>
                      </div>
                    ) : (
                      <>
                        <div className="bg-white border border-gray-200 rounded-xl p-3">
                          <p className="text-[11px] uppercase tracking-[0.05em] font-semibold text-gray-400 mb-1">
                            SCANNED
                          </p>
                          <p className="text-lg font-bold text-green-700">
                            {scanned}{" "}
                            <span className="text-xs font-normal text-gray-400">
                              / {total}
                            </span>
                          </p>
                        </div>
                        <div className="bg-white border border-gray-200 rounded-xl p-3">
                          <p className="text-[11px] uppercase tracking-[0.05em] font-semibold text-gray-400 mb-1">
                            AVERAGE SCORE
                          </p>
                          <p className="text-lg font-bold text-green-700">{avg}%</p>
                        </div>
                      </>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Render student results for selected exam
  if (selectedClass && selectedExam) {
    return (
      <div className="page-container">
        {/* Header with Export Buttons aligned to the right */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              Results &amp; Analytics
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              View and export grading results by class
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600 mr-2">
              Export as:
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExportModalType("PDF")}
              className="border-red-200 text-red-600 hover:bg-red-50"
            >
              <FileText className="w-4 h-4 mr-2" />
              PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExportModalType("Excel")}
              className="border-green-200 text-green-700 hover:bg-green-50"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExportModalType("CSV")}
              className="border-green-200 text-green-700 hover:bg-green-50"
            >
              <Table2 className="w-4 h-4 mr-2" />
              CSV
            </Button>
          </div>
        </div>

        {/* Quiet Class / Exam Info & Actions Bar (No Card Background) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 px-1">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                setSelectedExam(null);
                setStudentResults([]);
              }}
              className="w-10 h-10 rounded-full bg-green-600 text-white flex items-center justify-center hover:bg-green-700 transition-colors shrink-0 shadow-sm"
              title="Back to class exams"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-xl font-bold text-green-700 leading-tight mb-1">
                {selectedExam.title}
              </h2>
              <p className="text-sm text-gray-600 font-medium">
                {selectedClass.className} • {selectedExam.num_items} items •{" "}
                {selectedExam.subject || "General"}
              </p>
            </div>
          </div>

          <div className="flex items-center">
            <Button
              onClick={() => setShowSendPanel(true)}
              className="bg-green-600 hover:bg-green-700 text-white shadow-sm px-6"
            >
              <Mail className="w-4 h-4 mr-2" />
              Send Results
            </Button>
          </div>
        </div>

        {/* Sortable Results Table with Pagination */}
        <ExamScoresTable
          data={studentResults}
          loading={loadingStudents}
          examTitle={selectedExam.title}
          passingThreshold={passingThreshold}
          onThresholdChange={handleThresholdChange}
          onViewStudent={(row) => {
            // placeholder — can be wired to a detail view later
            console.log("View student:", row.studentId);
          }}
        />

        {/* Export Filter Panel (SS4 3.1) */}
        <ExportFilterPanel
          isOpen={exportModalType !== null}
          onClose={() => setExportModalType(null)}
          format={exportModalType}
          data={studentResults}
          passingThreshold={passingThreshold}
          onExport={handleFilteredExport}
          className={selectedClass.className}
          examTitle={selectedExam?.title}
        />

        {/* Send Results Panel */}
        <SendResultsPanel
          isOpen={showSendPanel}
          onClose={() => setShowSendPanel(false)}
          className={selectedClass.className}
          students={studentResults}
          onSend={() => {
            setShowSendPanel(false);
            // Log email delivery to report history
            if (user?.instructorId) {
              ReportHistoryService.logReport({
                instructorId: user.instructorId,
                reportType: "email-delivery",
                format: "Email",
                title: `Email Delivery — ${selectedClass.className}`,
                className: selectedClass.className,
                examTitle: selectedExam?.title,
                studentCount: studentResults.length,
              }).catch(() => {});
            }
          }}
          examTitle={selectedExam?.title}
          subject={selectedExam?.subject}
          passingThreshold={passingThreshold}
          instructorName={user?.displayName || undefined}
          instructorEmail={user?.email || undefined}
        />

        {/* Student Detail Dialog */}
        <Dialog open={!!viewingStudent} onOpenChange={(open) => { if (!open) { setViewingStudent(null); setAnswerDetails([]); } }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-green-700">Student Result Details</DialogTitle>
              <DialogDescription>
                {selectedExam?.title} — {selectedClass?.className}
              </DialogDescription>
            </DialogHeader>
            {viewingStudent && (
              <div className="space-y-5 pt-2">
                {/* Student Info */}
                <div className="flex items-center gap-4 p-4 bg-white rounded-lg border">
                  <div className="w-12 h-12 rounded-full bg-green-600 flex items-center justify-center text-white font-bold text-lg">
                    {viewingStudent.studentName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-lg text-foreground">{viewingStudent.studentName}</p>
                    <p className="text-sm text-muted-foreground font-mono">{viewingStudent.studentId}</p>
                    {viewingStudent.email && (
                      <p className="text-sm text-muted-foreground">{viewingStudent.email}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-700">{viewingStudent.score}/{viewingStudent.totalQuestions}</p>
                    <Badge variant="outline" className={`${getGradeColorClass(viewingStudent.grade)}`}>
                      {viewingStudent.grade} — {viewingStudent.percentage}%
                    </Badge>
                  </div>
                </div>

                {/* Score Summary Bar */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg border bg-white text-center">
                    <p className="text-xs text-muted-foreground mb-1">Score</p>
                    <p className="text-lg font-bold text-green-700">
                      {viewingStudent.score}/{viewingStudent.totalQuestions}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg border bg-white text-center">
                    <p className="text-xs text-muted-foreground mb-1">Percentage</p>
                    <p className="text-lg font-bold text-green-700">{viewingStudent.percentage}%</p>
                  </div>
                  <div className="p-3 rounded-lg border bg-white text-center">
                    <p className="text-xs text-muted-foreground mb-1">Grade</p>
                    <Badge variant="outline" className={`text-sm px-2 py-0.5 ${getGradeColorClass(viewingStudent.grade)}`}>
                      {viewingStudent.grade}
                    </Badge>
                  </div>
                  <div className="p-3 rounded-lg border bg-white text-center">
                    <p className="text-xs text-muted-foreground mb-1">Status</p>
                    {viewingStudent.percentage >= passingThreshold ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-sm px-2 py-0.5">
                        Pass
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-sm px-2 py-0.5">
                        Fail
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Answer Breakdown */}
                {loadingAnswerDetails ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-green-700 mr-2" />
                    <span className="text-muted-foreground">Loading answer details...</span>
                  </div>
                ) : answerDetails.length > 0 ? (
                  <div className="space-y-3">
                    {/* Legend */}
                    <div className="flex items-center gap-4 text-sm">
                      <span className="font-medium text-foreground">Answer Breakdown</span>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-sm bg-green-500" />
                        <span className="text-muted-foreground">Correct</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-sm bg-red-500" />
                        <span className="text-muted-foreground">Incorrect</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-sm bg-gray-400" />
                        <span className="text-muted-foreground">Unanswered</span>
                      </div>
                    </div>

                    {/* Answer Grid */}
                    <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                      {answerDetails.map((detail) => (
                        <div key={detail.questionNumber} className="flex flex-col items-center">
                          <span className="text-[10px] text-muted-foreground mb-1">Q{detail.questionNumber}</span>
                          <div
                            className={`w-9 h-9 rounded-md flex items-center justify-center text-white font-bold text-sm ${
                              detail.status === 'correct'
                                ? 'bg-green-500'
                                : detail.status === 'incorrect'
                                ? 'bg-red-500'
                                : 'bg-gray-400'
                            }`}
                          >
                            {detail.studentAnswer}
                          </div>
                          <span className="text-[10px] text-muted-foreground mt-0.5">
                            {detail.correctAnswer}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Summary Counts */}
                    <div className="flex items-center justify-center gap-6 pt-3 border-t">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm bg-green-500" />
                        <span className="text-sm font-medium">
                          Correct: {answerDetails.filter(d => d.status === 'correct').length}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm bg-red-500" />
                        <span className="text-sm font-medium">
                          Incorrect: {answerDetails.filter(d => d.status === 'incorrect').length}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm bg-gray-400" />
                        <span className="text-sm font-medium">
                          Unanswered: {answerDetails.filter(d => d.status === 'unanswered').length}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    No answer breakdown available for this student.
                  </div>
                )}

                {/* Date */}
                <div className="flex items-center justify-between text-sm pt-2 border-t">
                  <span className="text-muted-foreground">Date Scanned</span>
                  <span className="font-medium">{viewingStudent.date}</span>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Render class list view
  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            Results &amp; Analytics
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            View and export grading results by class
          </p>
        </div>
        {classResults.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="border-red-300 text-red-600 hover:bg-red-50"
            onClick={async () => {
              const meta: ExportMetadata = {
                instructorName: user?.displayName || undefined,
              };
              await generateClassSummaryPdf(
                classResults.map((c) => ({
                  className: c.className,
                  schedule: c.schedule,
                  totalStudents: c.totalStudents,
                  scannedCount: c.scannedCount,
                  averageScore: c.averageScore,
                })),
                undefined,
                meta,
              );
              // Log to report history
              if (user?.instructorId) {
                ReportHistoryService.logReport({
                  instructorId: user.instructorId,
                  reportType: "class-summary",
                  format: "PDF",
                  title: "Class Summary Report",
                  studentCount: classResults.reduce(
                    (sum, c) => sum + c.totalStudents,
                    0,
                  ),
                }).catch(() => {});
              }
            }}
          >
            <FileText className="w-4 h-4 mr-1.5" />
            PDF Summary
          </Button>
        )}
      </div>

      {/* Class Search & Filter Bar */}
      {classResults.length > 0 && (
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            {/* Search - more compact */}
            <div className="relative sm:max-w-md">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search classes..."
                value={classSearch}
                onChange={(e) => {
                  setClassSearch(e.target.value);
                  updateURL({ cs: e.target.value || null });
                }}
                className="pl-9 h-9"
              />
            </div>
            {/* Filters toggle */}
            <Button
              variant={showClassFilters ? "default" : "outline"}
              size="sm"
              onClick={() => setShowClassFilters(!showClassFilters)}
              className={
                showClassFilters
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : ""
              }
            >
              <Filter className="h-4 w-4 mr-1.5" />
              Filters
              {classFilterCount > 0 && (
                <Badge className="ml-1.5 bg-amber-500 text-white text-[10px] px-1.5 py-0 h-4 min-w-[16px] rounded-full">
                  {classFilterCount}
                </Badge>
              )}
            </Button>
          </div>

                   {/* Collapsible class filter panel */}
          {showClassFilters && (
            <Card className="p-4 border">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-green-700">
                  Filter by Average Score
                </h4>
                {classFilterCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearClassFilters}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7 text-xs"
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Clear All
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Min Average %
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    placeholder="0"
                    value={classMinAvg}
                    onChange={(e) => {
                      setClassMinAvg(e.target.value);
                      updateURL({ cmin: e.target.value || null });
                    }}
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Max Average %
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    placeholder="100"
                    value={classMaxAvg}
                    onChange={(e) => {
                      setClassMaxAvg(e.target.value);
                      updateURL({ cmax: e.target.value || null });
                    }}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
              {/* Active filter badges */}
              {classFilterCount > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {classSearch.trim() && (
                    <Badge variant="secondary" className="gap-1 text-xs">
                      Search: &ldquo;{classSearch}&rdquo;
                      <button
                        onClick={() => {
                          setClassSearch("");
                          updateURL({ cs: null });
                        }}
                        className="ml-0.5 hover:text-red-600"
                      >
                        ×
                      </button>
                    </Badge>
                  )}
                  {classMinAvg !== "" && (
                    <Badge variant="secondary" className="gap-1 text-xs">
                      Min: {classMinAvg}%
                      <button
                        onClick={() => {
                          setClassMinAvg("");
                          updateURL({ cmin: null });
                        }}
                        className="ml-0.5 hover:text-red-600"
                      >
                        ×
                      </button>
                    </Badge>
                  )}
                  {classMaxAvg !== "" && (
                    <Badge variant="secondary" className="gap-1 text-xs">
                      Max: {classMaxAvg}%
                      <button
                        onClick={() => {
                          setClassMaxAvg("");
                          updateURL({ cmax: null });
                        }}
                        className="ml-0.5 hover:text-red-600"
                      >
                        ×
                      </button>
                    </Badge>
                  )}
                </div>
              )}
            </Card>
          )}

          {/* Result count */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {filteredClassResults.length} of {classResults.length}{" "}
              classes
            </p>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="bg-white border border-gray-200 shadow-sm rounded-xl hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <p className="text-xs text-muted-foreground mb-1">
              Total Classes
            </p>
            <p className="text-2xl font-bold text-green-700">
              {classes.length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white border border-gray-200 shadow-sm rounded-xl hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <p className="text-xs text-muted-foreground mb-1">
              Scanned Results
            </p>
            <p className="text-2xl font-bold text-green-700">
              {classResults.reduce((sum, cr) => sum + cr.scannedCount, 0)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white border border-gray-200 shadow-sm rounded-xl hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <p className="text-xs text-muted-foreground mb-1">
              Average Score
            </p>
            <p className="text-2xl font-bold text-green-700">
              {classResults.length > 0
                ? Math.round(
                    classResults.reduce(
                      (sum, cr) => sum + cr.averageScore,
                      0,
                    ) / classResults.length,
                  )
                : 0}
              %
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white border border-gray-200 shadow-sm rounded-xl hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <p className="text-xs text-muted-foreground mb-1">
              Draft Exams
            </p>
            <p className="text-2xl font-bold text-green-700">
              {exams.filter((exam) => exam.status === "draft").length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Class Cards */}
      {classResults.length === 0 ? (
        <Card className="p-12 border text-center">
          <Folder className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-semibold text-gray-700">
            No Classes Found
          </h3>
          <p className="text-gray-500 mt-2">
            Create a class and add students to start grading exams.
          </p>
        </Card>
      ) : filteredClassResults.length === 0 ? (
        <Card className="p-12 border text-center">
          <Search className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-semibold text-gray-700">
            No Matching Classes
          </h3>
          <p className="text-gray-500 mt-2">
            Try adjusting your search or filters.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={clearClassFilters}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Clear Filters
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredClassResults.map((classResult) => {
            return (
              <Card
                key={classResult.classId}
                className="p-6 border-2 border-slate-100 hover:border-green-600/30 hover:shadow-lg transition-all cursor-pointer group bg-gradient-to-br from-white to-slate-50/30"
                onClick={() => handleClassClick(classResult)}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-green-600/10 rounded-2xl flex items-center justify-center text-green-700 group-hover:bg-green-600/20 transition-colors">
                      <Folder className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-green-700 mb-1 group-hover:text-green-700">
                        {classResult.className}
                      </h3>
                      <p className="text-sm text-gray-500 font-medium flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        {classResult.schedule}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="hidden sm:flex flex-col items-end">
                      <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">
                        Class Average
                      </p>
                      <p className="text-2xl font-black text-green-700 leading-tight">
                        {classResult.scannedCount > 0
                          ? `${classResult.averageScore}%`
                          : "—"}
                      </p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-green-600 group-hover:text-white transition-all">
                      <ChevronRight className="w-6 h-6" />
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm group-hover:shadow-md transition-all">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-4 h-4 text-emerald-600" />
                      <p className="text-[10px] uppercase tracking-wider font-extrabold text-gray-400">
                        Students
                      </p>
                    </div>
                    <p className="text-2xl font-bold text-green-700">
                      {classResult.totalStudents}
                    </p>
                  </div>
                  <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm group-hover:shadow-md transition-all">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4 text-amber-600" />
                      <p className="text-[10px] uppercase tracking-wider font-extrabold text-gray-400">
                        Scanned
                      </p>
                    </div>
                    <p className="text-2xl font-bold text-green-700">
                      {classResult.scannedCount}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
