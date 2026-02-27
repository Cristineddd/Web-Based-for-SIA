'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  Info
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
import jsPDF from 'jspdf';

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
    CSV: 'text-green-700'
  };

  const buttonColors = {
    PDF: 'bg-red-500 hover:bg-red-600',
    Excel: 'bg-green-600 hover:bg-green-700',
    CSV: 'bg-green-700 hover:bg-green-800'
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
    <div className="fixed inset-y-0 right-0 w-full md:max-w-md bg-[#1a472a] shadow-xl z-50 flex flex-col">
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

  // Modal states
  const [exportModalType, setExportModalType] = useState<'PDF' | 'Excel' | 'CSV' | null>(null);
  const [showSendPanel, setShowSendPanel] = useState(false);

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
  const exportToPDF = () => {
    if (!selectedClass || studentResults.length === 0) return;
    
    const doc = new jsPDF();
    // Using doc dimensions internally
    
    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(`${selectedClass.className} - Results`, 14, 20);
    
    // Subtitle
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 14, 28);
    doc.text(`Total Students: ${studentResults.length}`, 14, 34);
    
    // Table headers
    const headers = ['#', 'Student ID', 'Student Name', 'Score', 'Grade', 'Date'];
    const columnWidths = [10, 30, 50, 25, 20, 35];
    let startX = 14;
    let y = 45;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    headers.forEach((header, i) => {
      doc.text(header, startX, y);
      startX += columnWidths[i];
    });
    
    // Table rows
    doc.setFont('helvetica', 'normal');
    y += 8;
    
    studentResults.forEach((result, index) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      
      startX = 14;
      const row = [
        (index + 1).toString(),
        result.studentId,
        result.studentName,
        `${result.score}/${result.totalQuestions}`,
        result.grade,
        result.date
      ];
      
      row.forEach((cell, i) => {
        const text = cell.length > 20 ? cell.substring(0, 18) + '...' : cell;
        doc.text(text, startX, y);
        startX += columnWidths[i];
      });
      y += 7;
    });
    
    doc.save(`${selectedClass.className}_results.pdf`);
    setExportModalType(null);
  };

  const exportToExcel = () => {
    if (!selectedClass || studentResults.length === 0) return;
    
    // Create CSV content (Excel compatible)
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
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedClass.className}_results.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    setExportModalType(null);
  };

  const exportToCSV = () => {
    if (!selectedClass || studentResults.length === 0) return;
    
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
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
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
      <div className="space-y-4 md:space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#1a472a]">Results & Analytics</h1>
          <p className="text-sm md:text-base text-gray-600 mt-1">View and export grading results by class</p>
        </div>
        <div className="flex items-center justify-center py-12 md:py-20">
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
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#1a472a]">Results & Analytics</h1>
          <p className="text-sm md:text-base text-gray-600 mt-1">View and export grading results by class</p>
        </div>

        {/* Class Info Bar */}
        <div className="flex items-center gap-3 md:gap-4">
          <button 
            onClick={() => {
              setSelectedClass(null);
              setClassExamsList([]);
            }}
            className="w-10 h-10 rounded-full bg-[#1a472a] text-white flex items-center justify-center hover:bg-[#2d6b47] transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg md:text-xl font-bold text-[#1a472a] truncate">{selectedClass.className}</h2>
            <p className="text-gray-600 text-xs md:text-sm truncate">
              {selectedClass.totalStudents} students • {selectedClass.schedule}
            </p>
          </div>
        </div>

        {/* Exams List */}
        {classExamsList.length === 0 ? (
          <Card className="p-12 border text-center">
            <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold text-gray-700">No Exams Found</h3>
            <p className="text-gray-500 mt-2">No exams are linked to this class yet.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {classExamsList.map((exam) => {
              const stats = examStats[exam.id];
              const scanned = stats?.scannedCount || 0;
              const avg = stats?.averageScore || 0;
              const total = selectedClass.totalStudents;
              const progressPercent = total > 0 ? Math.round((scanned / total) * 100) : 0;

              return (
                <Card
                  key={exam.id}
                  className="p-4 md:p-5 border hover:shadow-md transition-shadow cursor-pointer hover:border-[#1a472a]/30"
                  onClick={() => fetchStudentResults(selectedClass, exam)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base md:text-lg font-bold text-[#1a472a] truncate">{exam.title}</h3>
                        <p className="text-xs md:text-sm text-gray-600 truncate">
                          {exam.num_items} items • {exam.choices_per_item} choices • {exam.subject}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 md:w-5 md:h-5 text-gray-400 flex-shrink-0" />
                  </div>

                  <div className="mt-3 md:mt-4 grid grid-cols-3 gap-2 md:gap-4">
                    <div className="bg-gray-50 rounded-lg p-2 md:p-3">
                      <p className="text-[10px] md:text-xs text-gray-500">Scanned</p>
                      <p className="text-sm md:text-lg font-bold text-[#1a472a]">
                        {scanned} / {total}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2 md:p-3">
                      <p className="text-[10px] md:text-xs text-gray-500">Average Score</p>
                      <p className="text-sm md:text-lg font-bold text-[#1a472a]">
                        {avg}%
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2 md:p-3">
                      <p className="text-[10px] md:text-xs text-gray-500">Completion</p>
                      <p className="text-sm md:text-lg font-bold text-[#1a472a]">
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
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#1a472a]">Results & Analytics</h1>
            <p className="text-sm md:text-base text-gray-600 mt-1">View and export grading results by class</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-gray-600 text-xs md:text-sm hidden md:inline">Export as:</span>
            <Button
              variant="outline"
              onClick={() => setExportModalType('PDF')}
              className="border-red-300 text-red-600 hover:bg-red-50 text-xs md:text-sm"
              size="sm"
            >
              <FileText className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
              PDF
            </Button>
            <Button
              variant="outline"
              onClick={() => setExportModalType('Excel')}
              className="border-green-300 text-green-600 hover:bg-green-50 text-xs md:text-sm"
              size="sm"
            >
              <FileSpreadsheet className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
              Excel
            </Button>
            <Button
              variant="outline"
              onClick={() => setExportModalType('CSV')}
              className="border-green-400 text-green-700 hover:bg-green-50 text-xs md:text-sm"
              size="sm"
            >
              <Table2 className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
              CSV
            </Button>
          </div>
        </div>

        {/* Class / Exam Info Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
          <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
            <button 
              onClick={() => {
                setSelectedExam(null);
                setStudentResults([]);
              }}
              className="w-10 h-10 rounded-full bg-[#1a472a] text-white flex items-center justify-center hover:bg-[#2d6b47] transition-colors flex-shrink-0"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg md:text-xl font-bold text-[#1a472a] truncate">{selectedExam.title}</h2>
              <p className="text-gray-600 text-xs md:text-sm truncate">
                {selectedClass.className} • {selectedExam.num_items} items • {selectedExam.subject}
              </p>
            </div>
          </div>
          <Button
            onClick={() => setShowSendPanel(true)}
            className="bg-[#1a472a] hover:bg-[#2d6b47] text-white text-sm w-full md:w-auto"
            size="sm"
          >
            <Mail className="w-4 h-4 mr-2" />
            Send Results
          </Button>
        </div>

        {/* Results — Mobile Cards + Desktop Table */}
        {loadingStudents ? (
          <Card className="border p-8 md:p-12">
            <div className="flex flex-col items-center justify-center text-gray-500">
              <div className="w-6 h-6 border-2 border-[#1a472a] border-t-transparent rounded-full animate-spin mb-2" />
              <p className="text-sm">Loading results...</p>
            </div>
          </Card>
        ) : studentResults.length === 0 ? (
          <Card className="border p-8 md:p-12 text-center text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm md:text-base">No results found for this class yet.</p>
            <p className="text-xs md:text-sm">Scan answer sheets to generate grades.</p>
          </Card>
        ) : (
          <>
            {/* Mobile Cards */}
            <div className="space-y-2.5 md:hidden">
              {studentResults.map((result, index) => (
                <Card key={result.studentId} className="p-3 border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-xs text-gray-400 w-5">{index + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#1a472a] truncate">{result.studentName}</p>
                        <p className="text-[11px] text-gray-500">{result.studentId}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900">{result.score}/{result.totalQuestions}</p>
                        <p className="text-[10px] text-gray-400">{result.date}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${getGradeColorClass(result.grade)}`}>
                        {result.grade}
                      </span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Desktop Table */}
            <Card className="border overflow-hidden hidden md:block">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#fffde7]">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-[#1a472a]">#</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-[#1a472a]">Student ID</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-[#1a472a]">Student Name</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-[#1a472a]">Score</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-[#1a472a]">Grade</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-[#1a472a]">Date</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-[#1a472a]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentResults.map((result, index) => (
                      <tr 
                        key={result.studentId} 
                        className="border-b hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-4 text-sm text-gray-600">{index + 1}</td>
                        <td className="px-4 py-4 text-sm text-gray-900">{result.studentId}</td>
                        <td className="px-4 py-4 text-sm font-medium text-[#1a472a]">{result.studentName}</td>
                        <td className="px-4 py-4 text-sm font-semibold text-gray-900">
                          {result.score} / {result.totalQuestions}
                        </td>
                        <td className="px-4 py-4">
                          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getGradeColorClass(result.grade)}`}>
                            {result.grade}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600">{result.date}</td>
                        <td className="px-4 py-4">
                          <Button variant="outline" size="sm" className="text-gray-600 text-sm">
                            <Download className="w-4 h-4 mr-1" />
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}

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
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-[#1a472a]">Results & Analytics</h1>
        <p className="text-sm md:text-base text-gray-600 mt-1">View and export grading results by class</p>
      </div>

      {/* Class Cards */}
      {classResults.length === 0 ? (
        <Card className="p-12 border text-center">
          <Folder className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-semibold text-gray-700">No Classes Found</h3>
          <p className="text-gray-500 mt-2">Create a class and add students to start grading exams.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {classResults.map((classResult) => {
            return (
              <Card
                key={classResult.classId}
                className="p-3 md:p-5 border hover:shadow-md transition-shadow cursor-pointer hover:border-[#1a472a]/30"
                onClick={() => handleClassClick(classResult)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 md:gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 md:w-11 md:h-11 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Folder className="w-4 h-4 md:w-5 md:h-5 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm md:text-base font-bold text-[#1a472a] truncate">{classResult.className}</h3>
                      <p className="text-[11px] md:text-xs text-gray-500 truncate">
                        📅 {classResult.schedule}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                </div>

                <div className="mt-2.5 md:mt-3 grid grid-cols-2 gap-2">
                  <div className="bg-gray-50 rounded-lg p-2 md:p-2.5">
                    <p className="text-[10px] md:text-xs text-gray-500">Students</p>
                    <p className="text-sm md:text-base font-bold text-[#1a472a] flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {classResult.totalStudents}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2 md:p-2.5">
                    <p className="text-[10px] md:text-xs text-gray-500">Scanned</p>
                    <p className="text-sm md:text-base font-bold text-[#1a472a]">
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
