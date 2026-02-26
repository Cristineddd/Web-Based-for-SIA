'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useDebounce } from '@/hooks/useDebounce';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Table2,
  Info,
  Search,
  Filter,
  RotateCcw,
  Archive,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getClasses, Class } from '@/services/classService';
import { getExams, Exam } from '@/services/examService';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  Timestamp 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import ExamScoresTable from '@/components/pages/ExamScoresTable';
import { exportClassResultsToExcel } from '@/services/excelExportService';
import { generateClassResultsPdf, generateClassSummaryPdf, ExportMetadata } from '@/services/pdfReportService';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { batchExportExams, BatchExportFormat, BatchExportProgress } from '@/services/batchExportService';

// Types for our component
interface ClassResult {
  classId: string;
  className: string;
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

// Calculate letter grade from percentage
function calculateLetterGrade(percentage: number): string {
  if (percentage >= 90) return 'A';
  if (percentage >= 85) return 'A';
  if (percentage >= 80) return 'B+';
  if (percentage >= 75) return 'B';
  if (percentage >= 70) return 'C';
  if (percentage >= 65) return 'D';
  return 'F';
}

// Get grade color class
function getGradeColorClass(grade: string): string {
  switch (grade) {
    case 'A':
      return 'bg-green-100 text-green-700';
    case 'B+':
    case 'B':
      return 'bg-lime-100 text-lime-700';
    case 'C':
      return 'bg-yellow-100 text-yellow-700';
    case 'D':
      return 'bg-orange-100 text-orange-700';
    case 'F':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

// Confirmation Modal Component
function ConfirmationModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  type,
  className: _className 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onConfirm: () => void; 
  type: 'PDF' | 'Excel' | 'CSV';
  className: string;
}) {
  if (!isOpen) return null;

  const iconColors = {
    PDF: 'text-red-500',
    Excel: 'text-green-600',
    CSV: 'text-green-700',
  };

  const buttonColors = {
    PDF: 'bg-red-500 hover:bg-red-600',
    Excel: 'bg-green-600 hover:bg-green-700',
    CSV: 'bg-green-700 hover:bg-green-800',
  };

  const Icon = type === 'PDF' ? FileText : type === 'Excel' ? FileSpreadsheet : Table2;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-lg bg-gray-100 ${iconColors[type]}`}>
            <Icon className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">Export to {type}</h3>
            <p className="text-sm text-gray-500 mt-1">Confirm export action</p>
          </div>
        </div>
        
        <div className="mt-4">
          <p className="text-gray-700">
            You are about to export class results to <strong>{type}</strong> format.
          </p>
          <p className="text-gray-600 text-sm mt-2">
            The file will be downloaded to your device. Do you want to continue?
          </p>
        </div>

        <div className="flex gap-3 mt-6 justify-end">
          <Button
            variant="outline"
            onClick={onClose}
            className="px-6"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            className={`${buttonColors[type]} text-white px-6 flex items-center gap-2`}
          >
            <Download className="w-4 h-4" />
            Export {type}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Send Results Panel Component
function SendResultsPanel({
  isOpen,
  onClose,
  className,
  students,
  onSend
}: {
  isOpen: boolean;
  onClose: () => void;
  className: string;
  students: StudentResult[];
  onSend: () => void;
}) {
  const [emails, setEmails] = useState<{ [studentId: string]: string }>({});
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);

  useEffect(() => {
    // Pre-populate with default emails format
    const defaultEmails: { [studentId: string]: string } = {};
    students.forEach(student => {
      defaultEmails[student.studentId] = student.email || `${student.studentId}@gordoncollege.edu.ph`;
    });
    setEmails(defaultEmails);
  }, [students]);

  const handleSend = async () => {
    setIsSending(true);
    // Simulate sending emails
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsSending(false);
    setIsSent(true);
    setTimeout(() => {
      onSend();
      setIsSent(false);
    }, 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md bg-[#1a472a] shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-green-800 flex items-center justify-between">
        <div className="flex items-center gap-3 text-white">
          <Mail className="w-5 h-5" />
          <div>
            <h2 className="font-semibold">Send Results via Email</h2>
            <p className="text-sm text-green-200">{className} Results</p>
          </div>
        </div>
        <button onClick={onClose} className="text-white hover:text-green-200">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */} 
      <div className="flex-1 overflow-y-auto p-4">
        {isSent ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-white">Emails Sent!</h3>
            <p className="text-green-200 mt-2">Results sent to {students.length} students</p>
          </div>
        ) : (
          <>
            <div className="bg-blue-900/30 rounded-lg p-3 mb-4 flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-300 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-100">
                Enter Gmail addresses for each student. Scores will be sent automatically to their inboxes.
              </p>
            </div>

            <div className="space-y-3">
              {students.map(student => (
                <div 
                  key={student.studentId} 
                  className="bg-white rounded-lg p-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium text-gray-900">{student.studentName}</p>
                      <p className="text-xs text-gray-500">{student.studentId}</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-sm font-semibold ${getGradeColorClass(student.grade)}`}>
                      {student.score}/{student.totalQuestions}
                    </span>
                  </div>
                  <input
                    type="email"
                    value={emails[student.studentId] || ''}
                    onChange={(e) => setEmails(prev => ({ ...prev, [student.studentId]: e.target.value }))}
                    placeholder="Enter email address"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-gray-50"
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      {!isSent && (
        <div className="p-4 border-t border-green-800">
          <Button
            onClick={handleSend}
            disabled={isSending}
            className="w-full bg-white text-green-800 hover:bg-gray-100 font-semibold py-3"
          >
            {isSending ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-green-800 border-t-transparent rounded-full animate-spin" />
                Sending...
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

  // Passing threshold
  const [passingThreshold, setPassingThreshold] = useState(60);

  // Update threshold when instructor changes it inline
  const handleThresholdChange = useCallback(
    (newThreshold: number) => {
      setPassingThreshold(newThreshold);
    },
    []
  );

  // Modal states
  const [exportModalType, setExportModalType] = useState<'PDF' | 'Excel' | 'CSV' | null>(null);
  const [showSendPanel, setShowSendPanel] = useState(false);

  // ── Batch export state (SS4 2.5) ────────────────────────────────────────
  const [selectedExamIds, setSelectedExamIds] = useState<Set<string>>(new Set());
  const [batchExporting, setBatchExporting] = useState(false);
  const [batchProgress, setBatchProgress] = useState<BatchExportProgress | null>(null);
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

  const handleBatchExport = useCallback(async (format: BatchExportFormat) => {
    if (!selectedClass || selectedExamIds.size === 0) return;
    const fullClass = classes.find((c) => c.id === selectedClass.classId);
    if (!fullClass) return;

    const selectedExams = classExamsList.filter((e) => selectedExamIds.has(e.id));
    if (selectedExams.length === 0) return;

    setBatchExporting(true);
    setBatchFormatPicker(false);
    setBatchProgress({ total: selectedExams.length, completed: 0, currentExamTitle: '', step: 'Starting...', percent: 0 });

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
    } catch (err) {
      console.error('Batch export failed:', err);
    } finally {
      setBatchExporting(false);
      // Keep progress visible briefly so the user sees "Done!"
      setTimeout(() => setBatchProgress(null), 1500);
    }
  }, [selectedClass, selectedExamIds, classExamsList, classes, passingThreshold, user?.displayName]);

  // ── Filter state ────────────────────────────────────────────────────────
  // Class list filters
  const [classSearch, setClassSearch] = useState(searchParams.get('cs') || '');
  const [classMinAvg, setClassMinAvg] = useState(searchParams.get('cmin') || '');
  const [classMaxAvg, setClassMaxAvg] = useState(searchParams.get('cmax') || '');

  // Exam list filters
  const [examSearch, setExamSearch] = useState(searchParams.get('es') || '');
  const [subjectFilter, setSubjectFilter] = useState(searchParams.get('subj') || 'all');

  // Show/hide filter panels
  const [showClassFilters, setShowClassFilters] = useState(false);

  // ── URL state sync helper ───────────────────────────────────────────────
  const updateURL = useCallback((params: Record<string, string | null>) => {
    const current = new URLSearchParams(searchParams.toString());
    Object.entries(params).forEach(([key, value]) => {
      if (value && value !== 'all') {
        current.set(key, value);
      } else {
        current.delete(key);
      }
    });
    const qs = current.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
  }, [searchParams, router, pathname]);

  // ── Filtered class results ──────────────────────────────────────────────
  const debouncedClassSearch = useDebounce(classSearch, 200);
  const filteredClassResults = useMemo(() => {
    let results = classResults;
    if (debouncedClassSearch.trim()) {
      const q = debouncedClassSearch.toLowerCase();
      results = results.filter(r =>
        r.className.toLowerCase().includes(q) ||
        r.schedule.toLowerCase().includes(q)
      );
    }
    if (classMinAvg !== '') {
      const min = Number(classMinAvg);
      if (!isNaN(min)) results = results.filter(r => r.averageScore >= min);
    }
    if (classMaxAvg !== '') {
      const max = Number(classMaxAvg);
      if (!isNaN(max)) results = results.filter(r => r.averageScore <= max);
    }
    return results;
  }, [classResults, debouncedClassSearch, classMinAvg, classMaxAvg]);

  // ── Unique subjects for exam filter ───────────────────────────────────
  const availableSubjects = useMemo(() => {
    const subjects = new Set(classExamsList.map(e => e.subject).filter(Boolean));
    return Array.from(subjects).sort();
  }, [classExamsList]);

  // ── Filtered exams list ────────────────────────────────────────────────
  const debouncedExamSearch = useDebounce(examSearch, 200);
  const filteredExamsList = useMemo(() => {
    let list = classExamsList;
    if (debouncedExamSearch.trim()) {
      const q = debouncedExamSearch.toLowerCase();
      list = list.filter(e =>
        e.title.toLowerCase().includes(q) ||
        (e.subject && e.subject.toLowerCase().includes(q))
      );
    }
    if (subjectFilter !== 'all') {
      list = list.filter(e => e.subject === subjectFilter);
    }
    return list;
  }, [classExamsList, examSearch, subjectFilter]);

  // ── Active filter counts ──────────────────────────────────────────────
  const classFilterCount = useMemo(() => {
    let n = 0;
    if (classSearch.trim()) n++;
    if (classMinAvg !== '') n++;
    if (classMaxAvg !== '') n++;
    return n;
  }, [classSearch, classMinAvg, classMaxAvg]);

  const examFilterCount = useMemo(() => {
    let n = 0;
    if (examSearch.trim()) n++;
    if (subjectFilter !== 'all') n++;
    return n;
  }, [examSearch, subjectFilter]);

  const clearClassFilters = useCallback(() => {
    setClassSearch('');
    setClassMinAvg('');
    setClassMaxAvg('');
    updateURL({ cs: null, cmin: null, cmax: null });
  }, [updateURL]);

  const clearExamFilters = useCallback(() => {
    setExamSearch('');
    setSubjectFilter('all');
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
          const classExams = userExams.filter(e => e.className === cls.class_name || (e as any).classId === cls.id);
          const examIds = classExams.map(e => e.id);

          let scannedCount = 0;
          let totalScore = 0;
          let totalMaxScore = 0;

          // Query scanned results for these exams
          if (examIds.length > 0) {
            try {
              const scannedResultsQuery = query(
                collection(db, 'scannedResults'),
                where('examId', 'in', examIds.slice(0, 10)) // Firestore limit
              );
              const scannedSnapshot = await getDocs(scannedResultsQuery);
              
              scannedSnapshot.forEach(doc => {
                const data = doc.data();
                if (!data.isNullId) {
                  scannedCount++;
                  totalScore += data.score || 0;
                  totalMaxScore += data.totalQuestions || 0;
                }
              });
            } catch (err) {
              console.error('Error fetching scanned results:', err);
            }
          }

          // Also check studentGrades collection
          try {
            const gradesQuery = query(
              collection(db, 'studentGrades'),
              where('class_id', '==', cls.id)
            );
            const gradesSnapshot = await getDocs(gradesQuery);
            
            gradesSnapshot.forEach(doc => {
              const data = doc.data();
              scannedCount++;
              totalScore += data.score || 0;
              totalMaxScore += data.max_score || 0;
            });
          } catch (err) {
            console.error('Error fetching grades:', err);
          }

          const averageScore = totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : 0;

          return {
            classId: cls.id,
            className: cls.class_name,
            schedule: cls.room || 'No schedule set',
            totalStudents: cls.students?.length || 0,
            scannedCount: scannedCount,
            averageScore: averageScore
          };
        })
      );

      setClassResults(results);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle clicking a class — show exams for that class
  const handleClassClick = useCallback(async (classResult: ClassResult) => {
    setSelectedClass(classResult);
    setSelectedExam(null);
    setStudentResults([]);
    setSelectedExamIds(new Set());
    setExamStats({});

    // Find exams linked to this class
    const classExams = exams.filter(e => 
      e.className === classResult.className || (e as any).classId === classResult.classId
    );
    setClassExamsList(classExams);

    // Fetch stats for each exam
    const stats: Record<string, ExamStats> = {};
    for (const exam of classExams) {
      let scannedCount = 0;
      let totalScore = 0;
      let totalMaxScore = 0;

      try {
        const scannedResultsQuery = query(
          collection(db, 'scannedResults'),
          where('examId', '==', exam.id)
        );
        const scannedSnapshot = await getDocs(scannedResultsQuery);
        scannedSnapshot.forEach(doc => {
          const data = doc.data();
          if (!data.isNullId) {
            scannedCount++;
            totalScore += data.score || 0;
            totalMaxScore += data.totalQuestions || 0;
          }
        });
      } catch (err) {
        console.error('Error fetching exam stats:', err);
      }

      const averageScore = totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : 0;
      stats[exam.id] = { examId: exam.id, scannedCount, averageScore };
    }
    setExamStats(stats);
  }, [exams]);

  // Fetch student results for a selected exam within a class
  const fetchStudentResults = useCallback(async (classResult: ClassResult, exam: Exam) => {
    setLoadingStudents(true);
    setSelectedExam(exam);
    
    // Find the full class data
    const fullClass = classes.find(c => c.id === classResult.classId);
    setSelectedClassData(fullClass || null);

    try {
      const students = fullClass?.students || [];
      const examIds = [exam.id];

      // Build student results
      const results: StudentResult[] = [];
      const processedStudentIds = new Set<string>();

      // First, check scannedResults
      if (examIds.length > 0) {
        try {
          const scannedResultsQuery = query(
            collection(db, 'scannedResults'),
            where('examId', 'in', examIds.slice(0, 10))
          );
          const scannedSnapshot = await getDocs(scannedResultsQuery);
          
          scannedSnapshot.forEach(doc => {
            const data = doc.data();
            if (!data.isNullId && !processedStudentIds.has(data.studentId)) {
              processedStudentIds.add(data.studentId);
              const student = students.find(s => s.student_id === data.studentId);
              const percentage = data.totalQuestions > 0 
                ? Math.round((data.score / data.totalQuestions) * 100) 
                : 0;
              
              let scannedDate = '';
              if (data.scannedAt) {
                const timestamp = data.scannedAt as Timestamp;
                const date = timestamp?.toDate?.() || new Date(data.scannedAt);
                scannedDate = date.toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'short', 
                  day: 'numeric' 
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
                date: scannedDate || 'N/A',
                email: student?.email
              });
            }
          });
        } catch (err) {
          console.error('Error fetching scanned results:', err);
        }
      }

      // Also check studentGrades
      try {
        const gradesQuery = query(
          collection(db, 'studentGrades'),
          where('class_id', '==', classResult.classId)
        );
        const gradesSnapshot = await getDocs(gradesQuery);
        
        gradesSnapshot.forEach(doc => {
          const data = doc.data();
          if (!processedStudentIds.has(data.student_id)) {
            processedStudentIds.add(data.student_id);
            const student = students.find(s => s.student_id === data.student_id);
            const percentage = data.percentage || (data.max_score > 0 
              ? Math.round((data.score / data.max_score) * 100) 
              : 0);
            
            let gradedDate = '';
            if (data.graded_at) {
              const timestamp = data.graded_at as Timestamp;
              const date = timestamp?.toDate?.() || new Date(data.graded_at);
              gradedDate = date.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
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
              date: gradedDate || 'N/A',
              email: student?.email
            });
          }
        });
      } catch (err) {
        console.error('Error fetching grades:', err);
      }

      // Sort by student name
      results.sort((a, b) => a.studentName.localeCompare(b.studentName));
      setStudentResults(results);
    } catch (error) {
      console.error('Error fetching student results:', error);
    } finally {
      setLoadingStudents(false);
    }
  }, [classes]);

  // Export functions
  const exportToPDF = async () => {
    if (!selectedClass || studentResults.length === 0) return;

    const meta: ExportMetadata = {
      instructorName: user?.displayName || undefined,
      subject: selectedExam?.subject || undefined,
      section: selectedClass?.schedule || undefined,
      numItems: selectedExam?.num_items || undefined,
      choicesPerItem: selectedExam?.choices_per_item || undefined,
      examDate: selectedExam?.created_at || undefined,
      examCode: selectedExam?.examCode || undefined,
    };

    await generateClassResultsPdf(
      selectedClass.className,
      selectedExam?.title || 'Exam',
      studentResults.map((r) => ({
        studentId: r.studentId,
        studentName: r.studentName,
        score: r.score,
        totalQuestions: r.totalQuestions,
        percentage: r.percentage,
        grade: r.grade,
        date: r.date,
        email: r.email,
      })),
      passingThreshold,
      meta,
    );
    setExportModalType(null);
  };

  const exportToExcel = () => {
    if (!selectedClass || studentResults.length === 0) return;

    const meta = {
      instructorName: user?.displayName || undefined,
      subject: selectedExam?.subject || undefined,
      section: selectedClass?.schedule || undefined,
      numItems: selectedExam?.num_items || undefined,
      choicesPerItem: selectedExam?.choices_per_item || undefined,
      examDate: selectedExam?.created_at || undefined,
      examCode: selectedExam?.examCode || undefined,
    };

    exportClassResultsToExcel(
      selectedClass.className,
      studentResults.map((r) => ({
        studentId: r.studentId,
        studentName: r.studentName,
        score: r.score,
        totalQuestions: r.totalQuestions,
        percentage: r.percentage,
        grade: r.grade,
        date: r.date,
        email: r.email,
      })),
      passingThreshold,
      meta,
    );
    setExportModalType(null);
  };

  const exportToCSV = () => {
    if (!selectedClass || studentResults.length === 0) return;
    
    // Calculate stats
    const percentages = studentResults.map(r => r.percentage);
    const avg = Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length);
    const passCount = percentages.filter(p => p >= passingThreshold).length;

    const headers = ['#', 'Student ID', 'Student Name', 'Score', 'Total', 'Percentage', 'Grade', 'Date'];
    const rows = studentResults.map((result, index) => [
      index + 1,
      result.studentId,
      `"${result.studentName}"`,
      result.score,
      result.totalQuestions,
      `${result.percentage}%`,
      result.grade,
      result.date
    ]);
    
    // Metadata header rows
    const metaLines: string[] = [];
    if (user?.displayName) metaLines.push(`Instructor,${user.displayName}`);
    if (selectedExam?.subject) metaLines.push(`Subject,${selectedExam.subject}`);
    if (selectedClass?.schedule) metaLines.push(`Section,"${selectedClass.schedule}"`);
    if (selectedExam?.num_items) metaLines.push(`No. of Items,${selectedExam.num_items}`);
    if (selectedExam?.choices_per_item) metaLines.push(`Choices per Item,${selectedExam.choices_per_item}`);
    if (selectedExam?.examCode) metaLines.push(`Exam Code,${selectedExam.examCode}`);
    if (selectedExam?.created_at) metaLines.push(`Exam Date,${selectedExam.created_at}`);

    // Append statistics summary
    const statsRows = [
      [],
      ['Statistics Summary'],
      ['Class Average', `${avg}%`],
      ['Highest Score', `${Math.max(...percentages)}%`],
      ['Lowest Score', `${Math.min(...percentages)}%`],
      [`Passed (\u2265${passingThreshold}%)`, passCount],
      [`Failed (<${passingThreshold}%)`, percentages.length - passCount],
    ];

    const csvContent = [
      ...metaLines,
      '',
      headers.join(','),
      ...rows.map(r => r.join(',')),
      ...statsRows.map(r => r.join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedClass.className}_results.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportModalType(null);
  };

  const handleExportConfirm = () => {
    switch (exportModalType) {
      case 'PDF':
        exportToPDF();
        break;
      case 'Excel':
        exportToExcel();
        break;
      case 'CSV':
        exportToCSV();
        break;
    }
  };

  // Render loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-[#1a472a]">Results & Analytics</h1>
          <p className="text-gray-600 mt-1">View and export grading results by class</p>
        </div>
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-[#1a472a] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // Render exam list for selected class
  if (selectedClass && !selectedExam) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[#1a472a]">Results & Analytics</h1>
            <p className="text-gray-600 mt-1">View and export grading results by class</p>
          </div>
        </div>

        {/* Class Info Bar */}
        <div className="flex items-center gap-4">
          <button 
            onClick={() => {
              setSelectedClass(null);
              setClassExamsList([]);
              setSelectedExamIds(new Set());
            }}
            className="w-10 h-10 rounded-full bg-[#1a472a] text-white flex items-center justify-center hover:bg-[#2d6b47] transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-[#1a472a]">{selectedClass.className}</h2>
            <p className="text-gray-600 text-sm">
              {selectedClass.totalStudents} students • {selectedClass.schedule}
            </p>
          </div>
        </div>

        {/* Batch Export Action Bar */}
        {classExamsList.length > 0 && (
          <div className="flex items-center justify-between bg-gray-50 border rounded-lg px-4 py-3">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={classExamsList.length > 0 && classExamsList.every((e) => selectedExamIds.has(e.id))}
                onCheckedChange={toggleAllExams}
                aria-label="Select all exams"
              />
              <span className="text-sm text-gray-700">
                {selectedExamIds.size > 0
                  ? `${selectedExamIds.size} exam${selectedExamIds.size > 1 ? 's' : ''} selected`
                  : 'Select exams for batch export'}
              </span>
            </div>
            <div className="flex items-center gap-2 relative">
              {selectedExamIds.size > 0 && (
                <>
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
                    className="bg-[#1a472a] hover:bg-[#2d6b47] text-white"
                    onClick={() => setBatchFormatPicker((v) => !v)}
                    disabled={batchExporting}
                  >
                    <Archive className="w-4 h-4 mr-2" />
                    Export {selectedExamIds.size} Exam{selectedExamIds.size > 1 ? 's' : ''} as ZIP
                  </Button>
                  {/* Format picker dropdown */}
                  {batchFormatPicker && (
                    <div className="absolute right-0 top-full mt-1 z-50 bg-white border rounded-lg shadow-lg py-1 min-w-[180px]">
                      <button
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                        onClick={() => handleBatchExport('pdf')}
                      >
                        <FileText className="w-4 h-4 text-red-500" />
                        PDF Reports
                      </button>
                      <button
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                        onClick={() => handleBatchExport('excel')}
                      >
                        <FileSpreadsheet className="w-4 h-4 text-green-600" />
                        Excel Spreadsheets
                      </button>
                      <button
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                        onClick={() => handleBatchExport('both')}
                      >
                        <Download className="w-4 h-4 text-blue-600" />
                        Both (PDF + Excel)
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Batch Export Progress Modal */}
        {batchProgress && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <Card className="w-full max-w-md p-6 mx-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#1a472a] flex items-center justify-center">
                  {batchProgress.percent < 100 ? (
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  ) : (
                    <Check className="w-5 h-5 text-white" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-[#1a472a]">Batch Export</h3>
                  <p className="text-sm text-gray-500">
                    {batchProgress.completed} of {batchProgress.total} exams
                  </p>
                </div>
              </div>
              <Progress value={batchProgress.percent} className="h-3" />
              <p className="text-sm text-gray-600 truncate">{batchProgress.step}</p>
              {batchProgress.percent >= 100 && (
                <p className="text-sm text-green-600 font-medium">
                  Download complete!
                </p>
              )}
            </Card>
          </div>
        )}

        {/* Exam Search & Filter Bar */}
        {classExamsList.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search exams..."
                  value={examSearch}
                  onChange={(e) => {
                    setExamSearch(e.target.value);
                    updateURL({ es: e.target.value || null });
                  }}
                  className="pl-9"
                />
              </div>
              {/* Subject filter */}
              {availableSubjects.length > 1 && (
                <Select
                  value={subjectFilter}
                  onValueChange={(v) => {
                    setSubjectFilter(v);
                    updateURL({ subj: v === 'all' ? null : v });
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Subjects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Subjects</SelectItem>
                    {availableSubjects.map((subj) => (
                      <SelectItem key={subj} value={subj}>{subj}</SelectItem>
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
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 h-9 text-xs"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Clear ({examFilterCount})
                </Button>
              )}
            </div>

            {/* Result count */}
            {examFilterCount > 0 && (
              <p className="text-sm text-muted-foreground">
                Showing {filteredExamsList.length} of {classExamsList.length} exams
              </p>
            )}
          </div>
        )}

        {/* Exams List */}
        {classExamsList.length === 0 ? (
          <Card className="p-12 border text-center">
            <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold text-gray-700">No Exams Found</h3>
            <p className="text-gray-500 mt-2">No exams are linked to this class yet.</p>
          </Card>
        ) : filteredExamsList.length === 0 ? (
          <Card className="p-12 border text-center">
            <Search className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold text-gray-700">No Matching Exams</h3>
            <p className="text-gray-500 mt-2">Try adjusting your search or subject filter.</p>
            <Button variant="outline" className="mt-4" onClick={clearExamFilters}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Clear Filters
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredExamsList.map((exam) => {
              const stats = examStats[exam.id];
              const scanned = stats?.scannedCount || 0;
              const avg = stats?.averageScore || 0;
              const total = selectedClass.totalStudents;
              const progressPercent = total > 0 ? Math.round((scanned / total) * 100) : 0;
              const isSelected = selectedExamIds.has(exam.id);

              return (
                <Card
                  key={exam.id}
                  className={`p-5 border hover:shadow-md transition-shadow cursor-pointer ${
                    isSelected ? 'border-[#1a472a] bg-green-50/30 ring-1 ring-[#1a472a]/20' : 'hover:border-[#1a472a]/30'
                  }`}
                  onClick={() => fetchStudentResults(selectedClass, exam)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Checkbox for multi-select */}
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                        className="flex items-center"
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleExamSelection(exam.id)}
                          aria-label={`Select ${exam.title}`}
                        />
                      </div>
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        <FileText className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-[#1a472a]">{exam.title}</h3>
                        <p className="text-sm text-gray-600">
                          {exam.num_items} items • {exam.choices_per_item} choices • {exam.subject}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-4">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">Scanned</p>
                      <p className="text-lg font-bold text-[#1a472a]">
                        {scanned} / {total}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">Average Score</p>
                      <p className="text-lg font-bold text-[#1a472a]">
                        {avg}%
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">Completion</p>
                      <p className="text-lg font-bold text-[#1a472a]">
                        {progressPercent}%
                      </p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-[#1a472a] rounded-full transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      />
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

  // Render student results for selected exam
  if (selectedClass && selectedExam) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[#1a472a]">Results & Analytics</h1>
            <p className="text-gray-600 mt-1">View and export grading results by class</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-600 text-sm">Export as:</span>
            <Button
              variant="outline"
              onClick={() => setExportModalType('PDF')}
              className="border-red-300 text-red-600 hover:bg-red-50"
            >
              <FileText className="w-4 h-4 mr-2" />
              PDF
            </Button>
            <Button
              variant="outline"
              onClick={() => setExportModalType('Excel')}
              className="border-green-300 text-green-600 hover:bg-green-50"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Excel
            </Button>
            <Button
              variant="outline"
              onClick={() => setExportModalType('CSV')}
              className="border-green-400 text-green-700 hover:bg-green-50"
            >
              <Table2 className="w-4 h-4 mr-2" />
              CSV
            </Button>
          </div>
        </div>

        {/* Class / Exam Info Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => {
                setSelectedExam(null);
                setStudentResults([]);
              }}
              className="w-10 h-10 rounded-full bg-[#1a472a] text-white flex items-center justify-center hover:bg-[#2d6b47] transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-xl font-bold text-[#1a472a]">{selectedExam.title}</h2>
              <p className="text-gray-600 text-sm">
                {selectedClass.className} • {selectedExam.num_items} items • {selectedExam.subject}
              </p>
            </div>
          </div>
          <Button
            onClick={() => setShowSendPanel(true)}
            className="bg-[#1a472a] hover:bg-[#2d6b47] text-white"
          >
            <Mail className="w-4 h-4 mr-2" />
            Send Results
          </Button>
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
            console.log('View student:', row.studentId);
          }}
        />

        {/* Export Modal */}
        <ConfirmationModal
          isOpen={exportModalType !== null}
          onClose={() => setExportModalType(null)}
          onConfirm={handleExportConfirm}
          type={exportModalType || 'PDF'}
          className={selectedClass.className}
        />

        {/* Send Results Panel */}
        <SendResultsPanel
          isOpen={showSendPanel}
          onClose={() => setShowSendPanel(false)}
          className={selectedClass.className}
          students={studentResults}
          onSend={() => setShowSendPanel(false)}
        />
      </div>
    );
  }

  // Render class list view
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#1a472a]">Results & Analytics</h1>
          <p className="text-gray-600 mt-1">View and export grading results by class</p>
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
            }}
          >
            <FileText className="w-4 h-4 mr-1.5" />
            PDF Summary
          </Button>
        )}
      </div>

      {/* Class Search & Filter Bar */}
      {classResults.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search classes..."
                value={classSearch}
                onChange={(e) => {
                  setClassSearch(e.target.value);
                  updateURL({ cs: e.target.value || null });
                }}
                className="pl-9"
              />
            </div>
            {/* Filters toggle */}
            <Button
              variant={showClassFilters ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowClassFilters(!showClassFilters)}
              className={showClassFilters ? 'bg-[#1a472a] hover:bg-[#2d6b47] text-white' : ''}
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
                <h4 className="text-sm font-semibold text-[#1a472a]">Filter by Average Score</h4>
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
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Min Average %</label>
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
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Max Average %</label>
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
                      <button onClick={() => { setClassSearch(''); updateURL({ cs: null }); }} className="ml-0.5 hover:text-red-600">×</button>
                    </Badge>
                  )}
                  {classMinAvg !== '' && (
                    <Badge variant="secondary" className="gap-1 text-xs">
                      Min: {classMinAvg}%
                      <button onClick={() => { setClassMinAvg(''); updateURL({ cmin: null }); }} className="ml-0.5 hover:text-red-600">×</button>
                    </Badge>
                  )}
                  {classMaxAvg !== '' && (
                    <Badge variant="secondary" className="gap-1 text-xs">
                      Max: {classMaxAvg}%
                      <button onClick={() => { setClassMaxAvg(''); updateURL({ cmax: null }); }} className="ml-0.5 hover:text-red-600">×</button>
                    </Badge>
                  )}
                </div>
              )}
            </Card>
          )}

          {/* Result count */}
          {classFilterCount > 0 && (
            <p className="text-sm text-muted-foreground">
              Showing {filteredClassResults.length} of {classResults.length} classes
            </p>
          )}
        </div>
      )}

      {/* Class Cards */}
      {classResults.length === 0 ? (
        <Card className="p-12 border text-center">
          <Folder className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-semibold text-gray-700">No Classes Found</h3>
          <p className="text-gray-500 mt-2">Create a class and add students to start grading exams.</p>
        </Card>
      ) : filteredClassResults.length === 0 ? (
        <Card className="p-12 border text-center">
          <Search className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-semibold text-gray-700">No Matching Classes</h3>
          <p className="text-gray-500 mt-2">Try adjusting your search or filters.</p>
          <Button variant="outline" className="mt-4" onClick={clearClassFilters}>
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
                className="p-6 border hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleClassClick(classResult)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                      <Folder className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-[#1a472a]">{classResult.className}</h3>
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        📅 {classResult.schedule}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Total Students</p>
                    <p className="text-lg font-bold text-[#1a472a] flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {classResult.totalStudents}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Class Average</p>
                    <p className="text-lg font-bold text-[#1a472a]">
                      {classResult.scannedCount > 0 ? `${classResult.averageScore}%` : '—'}
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
