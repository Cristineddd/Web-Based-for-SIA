'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { FileText, Loader2, Mail, Users } from 'lucide-react';
import { toast } from 'sonner';
import { BackButton } from '@/components/ui/BackButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { getClassById, getClasses, type Class } from '@/services/classService';
import { getExamById, getExams, updateExam, type Exam } from '@/services/examService';
import { ScanningService } from '@/services/scanningService';
import type { ScannedResult } from '@/types/scanning';

interface ReviewPapersProps {
  params: { id: string };
  embedded?: boolean;
}

interface StudentResultRow {
  studentId: string;
  studentName: string;
  className: string;
  course: string;
  section: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  status: 'Passed' | 'Failed';
  letterGrade: string;
  email?: string;
  scannedDate: string;
}


function calculateLetterGrade(percentage: number): string {
  if (percentage >= 90) return 'A';
  if (percentage >= 85) return 'A-';
  if (percentage >= 80) return 'B+';
  if (percentage >= 75) return 'B';
  if (percentage >= 70) return 'C+';
  if (percentage >= 65) return 'C';
  if (percentage >= 60) return 'D';
  return 'F';
}

function normalizeDate(value?: string): string {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function dedupeLatestByStudent(results: ScannedResult[]): ScannedResult[] {
  const sorted = [...results].sort((a, b) => {
    const tsA = new Date(a.scannedAt || 0).getTime();
    const tsB = new Date(b.scannedAt || 0).getTime();
    return tsB - tsA;
  });

  const seen = new Set<string>();
  const deduped: ScannedResult[] = [];

  for (const result of sorted) {
    if (seen.has(result.studentId)) continue;
    seen.add(result.studentId);
    deduped.push(result);
  }

  return deduped;
}

export default function ReviewPapersPage({ params, embedded = false }: ReviewPapersProps) {
  const { user } = useAuth();
  const examId = params.id;

  const [loading, setLoading] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);
  const [sendingMode, setSendingMode] = useState<'selected' | 'all' | null>(null);

  const [availableExams, setAvailableExams] = useState<Exam[]>([]);
  const [availableClasses, setAvailableClasses] = useState<Class[]>([]);
  const [activeExam, setActiveExam] = useState<Exam | null>(null);
  const [rows, setRows] = useState<StudentResultRow[]>([]);

  const [selectedExamId, setSelectedExamId] = useState(examId);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [passingThresholds, setPassingThresholds] = useState<Record<string, number>>({});
  const thresholdSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    setPassingThresholds((prev) => {
      const next = { ...prev };
      availableExams.forEach((exam) => {
        if (next[exam.id] !== undefined) return;
        if (typeof exam.passingThreshold === 'number') {
          next[exam.id] = exam.passingThreshold;
        }
      });
      if (activeExam && next[activeExam.id] === undefined) {
        if (typeof activeExam.passingThreshold === 'number') {
          next[activeExam.id] = activeExam.passingThreshold;
        }
      }
      return next;
    });
  }, [activeExam, availableExams]);

  const getPassingThreshold = useCallback(
    (targetExamId: string) => passingThresholds[targetExamId] ?? 75,
    [passingThresholds],
  );

  const setPassingThreshold = useCallback((targetExamId: string, value: number) => {
    setPassingThresholds((prev) => ({
      ...prev,
      [targetExamId]: value,
    }));

    const existing = thresholdSaveTimers.current[targetExamId];
    if (existing) {
      clearTimeout(existing);
    }

    thresholdSaveTimers.current[targetExamId] = setTimeout(async () => {
      try {
        await updateExam(targetExamId, { passingThreshold: value });
      } catch (error) {
        console.error('Failed to update passing threshold:', error);
        toast.error('Failed to save passing threshold');
      }
    }, 400);
  }, [updateExam]);

  useEffect(() => {
    return () => {
      Object.values(thresholdSaveTimers.current).forEach((timer) => clearTimeout(timer));
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadBootstrapData = async () => {
      setLoading(true);
      try {
        const initialExam = await getExamById(examId);
        if (!initialExam) {
          if (isMounted) {
            setActiveExam(null);
            setAvailableExams([]);
          }
          return;
        }

        if (!user?.id) {
          let singleClassList: Class[] = [];
          if (initialExam.classId) {
            const cls = await getClassById(initialExam.classId);
            if (cls) singleClassList = [cls];
          }

          if (isMounted) {
            setAvailableExams([initialExam]);
            setAvailableClasses(singleClassList);
            setSelectedExamId(initialExam.id);
            setActiveExam(initialExam);
          }
          return;
        }

        const [allExams, allClasses] = await Promise.all([
          getExams(user.id),
          getClasses(user.id),
        ]);

        const examMap = new Map<string, Exam>();
        examMap.set(initialExam.id, initialExam);
        allExams.forEach((exam) => examMap.set(exam.id, exam));

        const mergedExams = Array.from(examMap.values()).sort((a, b) =>
          a.title.localeCompare(b.title),
        );

        if (isMounted) {
          setAvailableExams(mergedExams);
          setAvailableClasses(allClasses);
          setSelectedExamId((prev) => prev || initialExam.id);
          setActiveExam(initialExam);
        }
      } catch (error) {
        console.error('Failed to load review paper data:', error);
        if (isMounted) {
          toast.error('Failed to load review paper data');
          setAvailableExams([]);
          setAvailableClasses([]);
          setActiveExam(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadBootstrapData();

    return () => {
      isMounted = false;
    };
  }, [examId, user?.id]);

  const resolveClassForExam = useCallback(
    async (exam: Exam): Promise<Class | null> => {
      if (exam.classId) {
        const byId = availableClasses.find((cls) => cls.id === exam.classId);
        if (byId) return byId;
        const fetched = await getClassById(exam.classId);
        if (fetched) return fetched;
      }

      if (exam.className) {
        const byName = availableClasses.find((cls) => cls.class_name === exam.className);
        if (byName) return byName;
      }

      return null;
    },
    [availableClasses],
  );

  const loadRowsForExam = useCallback(
    async (targetExamId: string) => {
      setLoadingRows(true);
      try {
        const examFromList = availableExams.find((exam) => exam.id === targetExamId);
        const targetExam = examFromList || (await getExamById(targetExamId));

        if (!targetExam) {
          setActiveExam(null);
          setRows([]);
          return;
        }

        setActiveExam(targetExam);
        const cls = await resolveClassForExam(targetExam);
        const rosterStudents = cls?.students || [];
        // Build a normalized map for robust lookup (trim + lowercase)
        // If no class resolved, fall back to searching all available classes
        const allRosterStudents = rosterStudents.length > 0
          ? rosterStudents
          : availableClasses.flatMap((c) => c.students || []);
        const rosterMap = new Map(allRosterStudents.map((student) => [student.student_id.trim().toLowerCase(), student]));

        const scannedResult = await ScanningService.getScannedResultsByExamId(targetExam.id);
        if (!scannedResult.success || !scannedResult.data) {
          throw new Error(scannedResult.error || 'Failed to fetch scanned results');
        }

        const latestResults = dedupeLatestByStudent(
          scannedResult.data.filter((result) => !result.isNullId),
        );

        const nextRows = latestResults
          .map((result) => {
            const student = rosterMap.get(result.studentId.trim().toLowerCase());
            const percentage =
              result.totalQuestions > 0
                ? Math.round((result.score / result.totalQuestions) * 100)
                : 0;

            return {
              studentId: result.studentId,
              studentName: student
                ? `${student.last_name}, ${student.first_name}`
                : result.studentId,
              className: cls?.class_name || targetExam.className || 'N/A',
              course: cls?.course_subject || targetExam.subject || 'N/A',
              section: student?.section || cls?.section_block || 'N/A',
              score: result.score,
              totalQuestions: result.totalQuestions,
              percentage,
              status: percentage >= getPassingThreshold(targetExam.id) ? 'Passed' : 'Failed',
              letterGrade: calculateLetterGrade(percentage),
              email: student?.email,
              scannedDate: normalizeDate(result.scannedAt),
            } as StudentResultRow;
          })
          .sort((a, b) => a.studentName.localeCompare(b.studentName));

        setRows(nextRows);
        setSelectedStudentIds(new Set());
      } catch (error) {
        console.error('Failed to load exam review rows:', error);
        toast.error('Failed to load student results');
        setRows([]);
        setSelectedStudentIds(new Set());
      } finally {
        setLoadingRows(false);
      }
    },
    [availableExams, getPassingThreshold, resolveClassForExam],
  );

  useEffect(() => {
    if (!selectedExamId) return;
    loadRowsForExam(selectedExamId);
  }, [selectedExamId, loadRowsForExam]);

  const scoredRows = useMemo(() => {
    const threshold = getPassingThreshold(selectedExamId);
    return rows.map((row) => ({
      ...row,
      status: row.percentage >= threshold ? 'Passed' : 'Failed',
    }));
  }, [getPassingThreshold, rows, selectedExamId]);

  const filteredRows = useMemo(() => scoredRows, [scoredRows]);

  const selectedRows = useMemo(() => {
    return filteredRows.filter((row) => selectedStudentIds.has(row.studentId));
  }, [filteredRows, selectedStudentIds]);

  const headerCheckboxState: boolean | 'indeterminate' = useMemo(() => {
    if (filteredRows.length === 0) return false;
    const selectedCount = filteredRows.filter((row) => selectedStudentIds.has(row.studentId)).length;
    if (selectedCount === 0) return false;
    if (selectedCount === filteredRows.length) return true;
    return 'indeterminate';
  }, [filteredRows, selectedStudentIds]);

  const totalPassed = useMemo(
    () => scoredRows.filter((row) => row.status === 'Passed').length,
    [scoredRows],
  );

  const handleToggleStudent = useCallback((studentId: string, checked: boolean) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(studentId);
      else next.delete(studentId);
      return next;
    });
  }, []);

  const handleToggleSelectAll = useCallback(
    (checked: boolean) => {
      setSelectedStudentIds((prev) => {
        const next = new Set(prev);
        filteredRows.forEach((row) => {
          if (checked) next.add(row.studentId);
          else next.delete(row.studentId);
        });
        return next;
      });
    },
    [filteredRows],
  );

  const sendScores = useCallback(
    async (studentsToSend: StudentResultRow[], mode: 'selected' | 'all') => {
      if (!activeExam) {
        toast.error('No exam selected');
        return;
      }

      if (studentsToSend.length === 0) {
        toast.info('No students available to send');
        return;
      }

      setSendingMode(mode);
      try {
        const payload = {
          className: studentsToSend[0]?.className || activeExam.className || 'General',
          examTitle: activeExam.title,
          subject: activeExam.subject,
          passingThreshold: getPassingThreshold(activeExam.id),
          instructorName: user?.displayName || undefined,
          instructorEmail: user?.email || undefined,
          students: studentsToSend.map((row) => ({
            studentId: row.studentId,
            studentName: row.studentName,
            email: row.email || `${row.studentId}@gordoncollege.edu.ph`,
            score: row.score,
            totalQuestions: row.totalQuestions,
            percentage: row.percentage,
            grade: row.letterGrade,
            date: row.scannedDate,
          })),
        };

        const response = await fetch('/api/send-results', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to send scores');
        }

        const sent = Number(data.sent || 0);
        const failed = Number(data.failed || 0);
        const total = Number(data.total || studentsToSend.length);

        if (failed > 0) {
          toast.error(`Sent ${sent}/${total}. ${failed} email(s) failed.`);
        } else {
          toast.success(`Sent ${sent}/${total} score email(s).`);
        }
      } catch (error) {
        console.error('Failed sending scores:', error);
        toast.error('Failed to send scores');
      } finally {
        setSendingMode(null);
      }
    },
    [activeExam, getPassingThreshold, user?.displayName, user?.email],
  );

  const handleSendSelected = useCallback(async () => {
    if (selectedRows.length === 0) {
      toast.info('Select at least one student first');
      return;
    }
    await sendScores(selectedRows, 'selected');
  }, [selectedRows, sendScores]);

  const handleSendAll = useCallback(async () => {
    if (filteredRows.length === 0) {
      toast.info('No students in the current filters');
      return;
    }
    await sendScores(filteredRows, 'all');
  }, [filteredRows, sendScores]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-green-600" />
          <p className="text-muted-foreground">Loading review papers...</p>
        </div>
      </div>
    );
  }

  if (!activeExam) {
    return (
      <div className="space-y-6">
        {!embedded && <BackButton href="/exams" asLink />}
        <p className="text-foreground">Exam not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!embedded && (
        <div className="flex items-center gap-3 sm:gap-4">
          <BackButton href={`/exams/${examId}`} asLink />
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-6 h-6 flex-shrink-0 text-green-600" />
              Review Papers
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">Exam: {activeExam.title}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border border-gray-100 shadow-sm rounded-xl overflow-hidden bg-white">
          <div className="flex items-center gap-4 p-4">
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Student Results</p>
              <p className="text-2xl font-bold text-[#1e293b]">{rows.length}</p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-green-400 to-green-600" />
        </Card>
        <Card className="border border-gray-100 shadow-sm rounded-xl overflow-hidden bg-white">
          <div className="flex items-center gap-4 p-4">
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Passed ({getPassingThreshold(activeExam.id)}%+)</p>
              <p className="text-2xl font-bold text-[#1e293b]">{totalPassed}</p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-green-400 to-green-600" />
        </Card>
        <Card className="border border-gray-100 shadow-sm rounded-xl overflow-hidden bg-white">
          <div className="flex items-center gap-4 p-4">
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <Mail className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Selected to Send</p>
              <p className="text-2xl font-bold text-[#1e293b]">{selectedRows.length}</p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-green-400 to-green-600" />
        </Card>
      </div>

      <Card className="border border-gray-100 shadow-sm rounded-xl bg-white">
        <CardContent className="p-4 grid grid-cols-1 gap-3">
          <div>
            <p className="text-xs text-gray-500 mb-1">Passing Threshold</p>
            <div className="flex items-center gap-3 rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2">
              <input
                type="range"
                min={1}
                max={100}
                value={getPassingThreshold(selectedExamId)}
                onChange={(event) =>
                  setPassingThreshold(selectedExamId, Number(event.target.value))
                }
                className="w-full h-2 accent-emerald-600 cursor-pointer"
              />
              <span className="text-xs font-semibold text-emerald-700 w-10 text-right">
                {getPassingThreshold(selectedExamId)}%
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge variant="outline" className="border-gray-200 text-gray-500 font-medium">
          {filteredRows.length} student(s)
        </Badge>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="border-gray-200 text-gray-600 hover:border-green-400 hover:text-green-700 hover:bg-green-50"
            onClick={handleSendSelected}
            disabled={sendingMode !== null || loadingRows || selectedRows.length === 0}
          >
            {sendingMode === 'selected' ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending Scores...
              </>
            ) : (
              <>
                <Mail className="w-4 h-4 mr-2" />
                Send Scores
              </>
            )}
          </Button>
          <Button
            className="bg-green-600 hover:bg-green-700"
            onClick={handleSendAll}
            disabled={sendingMode !== null || loadingRows || filteredRows.length === 0}
          >
            {sendingMode === 'all' ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending All...
              </>
            ) : (
              <>
                <Users className="w-4 h-4 mr-2" />
                Send All
              </>
            )}
          </Button>
        </div>
      </div>

      <Card className="border border-gray-100 shadow-sm rounded-xl bg-white overflow-hidden">
        {loadingRows ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-green-600" />
            <p className="text-muted-foreground">Loading student results...</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No papers scanned yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Scan answer sheets from the exam page to see results here.
            </p>
            <Link href={`/exams/${selectedExamId}/scanning`}>
              <Button className="mt-4" variant="outline">Go to Scanner</Button>
            </Link>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground font-medium">No students available for this exam.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={headerCheckboxState}
                      onCheckedChange={(checked) => handleToggleSelectAll(checked === true)}
                      aria-label="Select all filtered students"
                    />
                  </TableHead>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Student ID</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row) => (
                  <TableRow key={row.studentId}>
                    <TableCell>
                      <Checkbox
                        checked={selectedStudentIds.has(row.studentId)}
                        onCheckedChange={(checked) => handleToggleStudent(row.studentId, checked === true)}
                        aria-label={`Select ${row.studentName}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{row.studentName}</TableCell>
                    <TableCell className="font-mono text-xs">{row.studentId}</TableCell>
                    <TableCell>{row.className}</TableCell>
                    <TableCell>
                      <span className="font-semibold">{row.score}</span>
                      <span className="text-muted-foreground">/{row.totalQuestions}</span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          row.status === 'Passed'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }
                      >
                        {row.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
