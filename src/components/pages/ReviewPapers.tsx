'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  FileText,
  Search,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Users
} from 'lucide-react';
import { getExamById, Exam } from '@/services/examService';
import { AnswerKeyService } from '@/services/answerKeyService';
import { ScanningService } from '@/services/scanningService';
import { getClassById, Class } from '@/services/classService';
import { AnswerChoice, ScannedResult } from '@/types/scanning';
import { toast } from 'sonner';

interface ReviewPapersProps {
  params: { id: string };
}

interface PaperWithDetails extends ScannedResult {
  studentName: string;
  percentage: number;
  letterGrade: string;
}

type SortField = 'studentId' | 'studentName' | 'score' | 'percentage' | 'scannedAt';
type SortDirection = 'asc' | 'desc';

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

export default function ReviewPapersPage({ params }: ReviewPapersProps) {
  const [exam, setExam] = useState<Exam | null>(null);
  const [papers, setPapers] = useState<PaperWithDetails[]>([]);
  const [answerKey, setAnswerKey] = useState<AnswerChoice[]>([]);
  const [loading, setLoading] = useState(true);
  const examId = params.id;

  // Search, Sort, Pagination state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('scannedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Expanded row for answer comparison
  const [expandedPaperId, setExpandedPaperId] = useState<string | null>(null);

  const calculateLetterGrade = (percentage: number): string => {
    if (percentage >= 90) return 'A';
    if (percentage >= 85) return 'A-';
    if (percentage >= 80) return 'B+';
    if (percentage >= 75) return 'B';
    if (percentage >= 70) return 'C+';
    if (percentage >= 65) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
  };

  const getGradeColor = (grade: string): string => {
    if (grade.startsWith('A')) return 'text-green-700 bg-green-100';
    if (grade.startsWith('B')) return 'text-lime-700 bg-lime-100';
    if (grade.startsWith('C')) return 'text-yellow-700 bg-yellow-100';
    if (grade.startsWith('D')) return 'text-orange-700 bg-orange-100';
    return 'text-red-700 bg-red-100';
  };

  const getStatusIndicator = (percentage: number) => {
    if (percentage >= 75) {
      return { icon: CheckCircle, color: 'text-green-500', label: 'Passed' };
    } else if (percentage >= 60) {
      return { icon: AlertTriangle, color: 'text-yellow-500', label: 'Needs Improvement' };
    } else {
      return { icon: XCircle, color: 'text-red-500', label: 'Failed' };
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const examData = await getExamById(examId);
        if (!examData) {
          toast.error('Exam not found');
          setLoading(false);
          return;
        }
        setExam(examData);

        const akResult = await AnswerKeyService.getAnswerKeyByExamId(examId);
        if (akResult.success && akResult.data) {
          setAnswerKey(akResult.data.answers);
        }

        let cls: Class | null = null;
        if ((examData as any).classId) {
          cls = await getClassById((examData as any).classId);
        }

        const scannedResult = await ScanningService.getScannedResultsByExamId(examId);
        if (scannedResult.success && scannedResult.data) {
          const papersWithDetails: PaperWithDetails[] = scannedResult.data
            .filter(r => !r.isNullId)
            .map(result => {
              let studentName = result.studentId;
              if (cls) {
                const student = cls.students.find(s => s.student_id === result.studentId);
                if (student) {
                  studentName = `${student.last_name}, ${student.first_name}`;
                }
              }
              const percentage = result.totalQuestions > 0
                ? Math.round((result.score / result.totalQuestions) * 100)
                : 0;
              return {
                ...result,
                studentName,
                percentage,
                letterGrade: calculateLetterGrade(percentage),
              };
            });
          setPapers(papersWithDetails);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load exam data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [examId]);

  // Filtered and sorted papers
  const filteredAndSortedPapers = useMemo(() => {
    let result = [...papers];

    // Filter by search query (Student ID or Name)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(p =>
        p.studentId.toLowerCase().includes(query) ||
        p.studentName.toLowerCase().includes(query)
      );
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'studentId':
          comparison = a.studentId.localeCompare(b.studentId);
          break;
        case 'studentName':
          comparison = a.studentName.localeCompare(b.studentName);
          break;
        case 'score':
          comparison = a.score - b.score;
          break;
        case 'percentage':
          comparison = a.percentage - b.percentage;
          break;
        case 'scannedAt':
          const dateA = a.scannedAt ? new Date(a.scannedAt).getTime() : 0;
          const dateB = b.scannedAt ? new Date(b.scannedAt).getTime() : 0;
          comparison = dateA - dateB;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [papers, searchQuery, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedPapers.length / itemsPerPage);
  const paginatedPapers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedPapers.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedPapers, currentPage, itemsPerPage]);

  // Reset to page 1 when search or items per page changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, itemsPerPage]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronUp className="w-4 h-4 text-gray-300" />;
    return sortDirection === 'asc'
      ? <ChevronUp className="w-4 h-4 text-primary" />
      : <ChevronDown className="w-4 h-4 text-primary" />;
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const toggleExpanded = (paperId: string) => {
    setExpandedPaperId(prev => prev === paperId ? null : paperId);
  };

  // Answer Comparison Component - Simple grid layout
  const AnswerComparisonGrid = ({ paper }: { paper: PaperWithDetails }) => {
    const totalQuestions = paper.totalQuestions;
    const studentAnswers = paper.answers || [];

    // Split into groups of 50 for 100-item exams
    const hasMultipleSections = totalQuestions > 50;
    const firstHalf = Math.min(50, totalQuestions);
    const secondHalf = totalQuestions > 50 ? totalQuestions - 50 : 0;

    const renderQuestionBox = (questionIndex: number, displayNum: number) => {
      const studentAnswer = studentAnswers[questionIndex] || null;
      const correctAnswer = answerKey[questionIndex] || null;
      const isCorrect = studentAnswer && correctAnswer && studentAnswer === correctAnswer;
      const isUnanswered = !studentAnswer;

      let borderColor = 'border-red-500';
      let bgColor = 'bg-red-50';
      let textColor = 'text-red-600';

      if (isUnanswered) {
        borderColor = 'border-gray-300';
        bgColor = 'bg-gray-100';
        textColor = 'text-gray-400';
      } else if (isCorrect) {
        borderColor = 'border-green-500';
        bgColor = 'bg-green-50';
        textColor = 'text-green-600';
      }

      return (
        <div key={questionIndex} className="flex flex-col items-center">
          <div className="text-[10px] text-muted-foreground mb-1">{displayNum}</div>
          <div
            className={`w-9 h-9 rounded-md border-2 ${borderColor} ${bgColor} flex items-center justify-center`}
          >
            <span className={`text-base font-bold ${textColor}`}>
              {studentAnswer || '-'}
            </span>
          </div>
          {/* Show correct answer below if incorrect */}
          {!isCorrect && !isUnanswered && correctAnswer && (
            <div className="text-[10px] text-green-600 mt-0.5 font-medium">
              {correctAnswer}
            </div>
          )}
          {/* Show correct answer for unanswered */}
          {isUnanswered && correctAnswer && (
            <div className="text-[10px] text-gray-500 mt-0.5">
              {correctAnswer}
            </div>
          )}
        </div>
      );
    };

    return (
      <div className="mt-4 pt-4 border-t" onClick={(e) => e.stopPropagation()}>
        {/* Legend */}
        <div className="flex flex-wrap gap-4 mb-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded border-2 border-green-500 bg-green-50" />
            <span>Correct</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded border-2 border-red-500 bg-red-50" />
            <span>Incorrect</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded border-2 border-gray-300 bg-gray-100" />
            <span>Unanswered</span>
          </div>
        </div>

        {/* Questions 1-50 */}
        {hasMultipleSections && (
          <h5 className="text-xs font-semibold text-muted-foreground mb-2">Questions 1-50</h5>
        )}
        <div className="grid grid-cols-10 gap-2 mb-4">
          {Array.from({ length: firstHalf }, (_, i) => renderQuestionBox(i, i + 1))}
        </div>

        {/* Questions 51-100 */}
        {secondHalf > 0 && (
          <>
            <h5 className="text-xs font-semibold text-muted-foreground mb-2 mt-4">Questions 51-100</h5>
            <div className="grid grid-cols-10 gap-2">
              {Array.from({ length: secondHalf }, (_, i) => renderQuestionBox(50 + i, 51 + i))}
            </div>
          </>
        )}

        {/* Summary */}
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Correct: </span>
            <span className="font-semibold text-green-600">{paper.score}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Incorrect: </span>
            <span className="font-semibold text-red-600">
              {studentAnswers.filter((a, i) => a && answerKey[i] && a !== answerKey[i]).length}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Unanswered: </span>
            <span className="font-semibold text-gray-600">
              {totalQuestions - studentAnswers.filter(a => a).length}
            </span>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading papers...</p>
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="space-y-6">
        <Link href="/exams" className="p-2 hover:bg-muted rounded-md transition-colors inline-block">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <p className="text-foreground">Exam not found</p>
      </div>
    );
  }

  const avgScore = papers.length > 0
    ? Math.round(papers.reduce((sum, p) => sum + p.percentage, 0) / papers.length)
    : 0;
  const highestScore = papers.length > 0 ? Math.max(...papers.map(p => p.percentage)) : 0;
  const lowestScore = papers.length > 0 ? Math.min(...papers.map(p => p.percentage)) : 0;
  const passedCount = papers.filter(p => p.percentage >= 75).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 sm:gap-4">
        <Link href={`/exams/${examId}`} className="p-2 hover:bg-muted rounded-md transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
            <FileText className="w-6 h-6 flex-shrink-0" />
            Review Papers
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">Exam: {exam.title}</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <Card className="p-3 sm:p-4 border">
          <p className="text-xs font-semibold text-muted-foreground mb-1">Total Scanned</p>
          <p className="text-xl sm:text-2xl font-bold text-primary">{papers.length}</p>
        </Card>
        <Card className="p-3 sm:p-4 border">
          <p className="text-xs font-semibold text-muted-foreground mb-1">Passed (≥75%)</p>
          <p className="text-xl sm:text-2xl font-bold text-green-600">{passedCount}</p>
        </Card>
        <Card className="p-3 sm:p-4 border">
          <p className="text-xs font-semibold text-muted-foreground mb-1">Average</p>
          <p className="text-xl sm:text-2xl font-bold text-primary">{avgScore}%</p>
        </Card>
        <Card className="p-3 sm:p-4 border">
          <p className="text-xs font-semibold text-muted-foreground mb-1">Highest</p>
          <p className="text-xl sm:text-2xl font-bold text-green-600">{highestScore}%</p>
        </Card>
        <Card className="p-3 sm:p-4 border">
          <p className="text-xs font-semibold text-muted-foreground mb-1">Lowest</p>
          <p className="text-xl sm:text-2xl font-bold text-red-600">{lowestScore}%</p>
        </Card>
      </div>

      {/* Results List */}
      <Card className="border">
        {/* Search and Controls */}
        <div className="p-4 border-b flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by Student ID or Name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Show:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
              className="border rounded px-2 py-1 text-sm bg-background"
            >
              {ITEMS_PER_PAGE_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <span className="text-muted-foreground">per page</span>
          </div>
        </div>

        {papers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No papers scanned yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Scan answer sheets from the exam page to see results here.
            </p>
            <Link href={`/exams/${examId}/scanning`}>
              <Button className="mt-4" variant="outline">Go to Scanner</Button>
            </Link>
          </div>
        ) : (
          <>
            {/* Table Header */}
            <div className="hidden md:grid md:grid-cols-12 gap-2 px-4 py-3 bg-muted/50 text-sm font-medium text-muted-foreground border-b">
              <button
                onClick={() => handleSort('studentId')}
                className="col-span-2 flex items-center gap-1 hover:text-foreground transition-colors text-left"
              >
                Student ID <SortIcon field="studentId" />
              </button>
              <button
                onClick={() => handleSort('studentName')}
                className="col-span-3 flex items-center gap-1 hover:text-foreground transition-colors text-left"
              >
                Name <SortIcon field="studentName" />
              </button>
              <button
                onClick={() => handleSort('score')}
                className="col-span-2 flex items-center gap-1 hover:text-foreground transition-colors text-left"
              >
                Score <SortIcon field="score" />
              </button>
              <button
                onClick={() => handleSort('percentage')}
                className="col-span-2 flex items-center gap-1 hover:text-foreground transition-colors text-left"
              >
                Percentage <SortIcon field="percentage" />
              </button>
              <button
                onClick={() => handleSort('scannedAt')}
                className="col-span-2 flex items-center gap-1 hover:text-foreground transition-colors text-left"
              >
                Scanned <SortIcon field="scannedAt" />
              </button>
              <div className="col-span-1 text-center">Status</div>
            </div>

            {/* Table Body */}
            <div className="divide-y">
              {paginatedPapers.map(paper => {
                const status = getStatusIndicator(paper.percentage);
                const StatusIcon = status.icon;
                const isExpanded = expandedPaperId === paper.id;
                return (
                  <div
                    key={paper.id}
                    onClick={() => toggleExpanded(paper.id)}
                    className="px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer"
                  >
                    {/* Desktop View */}
                    <div className="hidden md:grid md:grid-cols-12 gap-2 items-center">
                      <div className="col-span-2 font-mono text-sm">{paper.studentId}</div>
                      <div className="col-span-3 font-medium truncate">{paper.studentName}</div>
                      <div className="col-span-2">
                        <span className="font-semibold">{paper.score}</span>
                        <span className="text-muted-foreground">/{paper.totalQuestions}</span>
                      </div>
                      <div className="col-span-2 flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-sm font-bold ${getGradeColor(paper.letterGrade)}`}>
                          {paper.letterGrade}
                        </span>
                        <span className="text-muted-foreground">{paper.percentage}%</span>
                      </div>
                      <div className="col-span-2 text-sm text-muted-foreground">
                        {formatDate(paper.scannedAt)}
                      </div>
                      <div className="col-span-1 flex justify-center items-center gap-2">
                        <StatusIcon className={`w-5 h-5 ${status.color}`} />
                        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </div>

                    {/* Mobile View */}
                    <div className="md:hidden space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm">{paper.studentId}</span>
                        <div className="flex items-center gap-2">
                          <StatusIcon className={`w-5 h-5 ${status.color}`} />
                          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </div>
                      </div>
                      <div className="font-medium">{paper.studentName}</div>
                      <div className="flex items-center justify-between text-sm">
                        <div>
                          <span className="font-semibold">{paper.score}</span>
                          <span className="text-muted-foreground">/{paper.totalQuestions}</span>
                          <span className={`ml-2 px-2 py-0.5 rounded text-xs font-bold ${getGradeColor(paper.letterGrade)}`}>
                            {paper.letterGrade}
                          </span>
                        </div>
                        <span className="text-muted-foreground">{formatDate(paper.scannedAt)}</span>
                      </div>
                    </div>

                    {/* Answer Comparison (Expanded) */}
                    {isExpanded && <AnswerComparisonGrid paper={paper} />}
                  </div>
                );
              })}
            </div>

            {/* No Results */}
            {filteredAndSortedPapers.length === 0 && searchQuery && (
              <div className="text-center py-8">
                <Search className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">No results found for "{searchQuery}"</p>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredAndSortedPapers.length)} of {filteredAndSortedPapers.length} results
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="px-2"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <ChevronLeft className="w-4 h-4 -ml-2" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-2"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="px-3 text-sm font-medium">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-2"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="px-2"
                  >
                    <ChevronRight className="w-4 h-4" />
                    <ChevronRight className="w-4 h-4 -ml-2" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
