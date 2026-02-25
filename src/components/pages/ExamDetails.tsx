"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import {
  ArrowLeft,
  Edit2,
  Smartphone,
  FileText,
  BarChart3,
  Tag,
  FilePlus,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { getExamById, Exam } from "@/services/examService";
import { AnswerKeyService } from "@/services/answerKeyService";
import { ScanningService } from "@/services/scanningService";
import { useAuth } from "@/contexts/AuthContext";
import { db, auth } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore";
import { toast } from "sonner";
import { generateTemplatePDF } from "@/lib/templatePdfGenerator";

interface ExamDetailsProps {
  params: { id: string };
}

interface AnswerKeyStatus {
  total: number;
  completed: number;
  hasAnswerKey: boolean;
}

export default function ExamDetails({ params }: ExamDetailsProps) {
  const { user } = useAuth();
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [scannedPaperCount, setScannedPaperCount] = useState(0);
  const [answerKeyStatus, setAnswerKeyStatus] = useState<AnswerKeyStatus>({
    total: 0,
    completed: 0,
    hasAnswerKey: false,
  });
  const [hasTemplate, setHasTemplate] = useState(false);
  const [creatingTemplate, setCreatingTemplate] = useState(false);

  useEffect(() => {
    async function fetchExam() {
      try {
        setLoading(true);
        const examData = await getExamById(params.id);
        setExam(examData);

        if (examData) {
          try {
            const result = await AnswerKeyService.getAnswerKeyByExamId(
              params.id,
            );
            if (result.success && result.data) {
              const answersCount = result.data.answers.length;
              setAnswerKeyStatus({
                total: examData.num_items,
                completed: answersCount,
                hasAnswerKey: true,
              });
            } else {
              setAnswerKeyStatus({
                total: examData.num_items,
                completed: 0,
                hasAnswerKey: false,
              });
            }
          } catch (error) {
            console.error("Error fetching answer key:", error);
          }

          // Fetch scanned results count
          try {
            const scannedResult = await ScanningService.getScannedResultsByExamId(params.id);
            if (scannedResult.success && scannedResult.data) {
              setScannedPaperCount(scannedResult.data.filter(r => !r.isNullId).length);
            }
          } catch (error) {
            console.error("Error fetching scanned results:", error);
          }

          // Check if a template already exists for this exam
          try {
            const templateQuery = query(
              collection(db, 'templates'),
              where('examId', '==', params.id)
            );
            const templateSnap = await getDocs(templateQuery);
            setHasTemplate(!templateSnap.empty);
          } catch (error) {
            console.error("Error checking template:", error);
          }
        }
      } catch (error) {
        console.error("Error fetching exam:", error);
      } finally {
        setLoading(false);
      }
    }

    if (params.id) {
      fetchExam();
    }
  }, [params.id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href="/exams"
            className="p-2 hover:bg-muted rounded-md transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Loading...</h1>
          </div>
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href="/exams"
            className="p-2 hover:bg-muted rounded-md transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Exam not found
            </h1>
          </div>
        </div>
      </div>
    );
  }

  const handleCreateTemplate = async () => {
    if (!user?.instructorId) {
      toast.error('⚠️ Instructor ID not found. Please log out and log back in.');
      return;
    }

    if (!exam) {
      toast.error('Exam information not found');
      return;
    }

    if (hasTemplate) {
      toast.error('A template has already been generated for this exam.');
      return;
    }

    setCreatingTemplate(true);

    try {
      const currentUser = auth.currentUser;
      console.log('🔍 Firebase Auth State:', {
        isAuthenticated: !!currentUser,
        uid: currentUser?.uid,
      });

      const templateData = {
        name: exam.title,
        description: exam.subject || 'Answer Sheet Template',
        numQuestions: exam.num_items,
        choicesPerQuestion: exam.choices_per_item,
        layout: 'single',
        includeStudentId: true,
        studentIdLength: 10,
        createdBy: user.id,
        instructorId: user.instructorId,
        examId: params.id,
        examName: exam.title,
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'templates'), templateData);
      
      // Generate exam code
      const classPrefix = exam.className 
        ? exam.className.substring(0, 2).toUpperCase()
        : 'XX';
      const examSuffix = exam.title.length >= 2
        ? exam.title.substring(exam.title.length - 2).toUpperCase().replace(/[^A-Z]/g, '')
        : exam.title.substring(0, 2).toUpperCase().replace(/[^A-Z]/g, '');
      const dayDigits = new Date().getDate().toString().padStart(2, '0');
      const examCode = `${classPrefix}${examSuffix}${dayDigits}`;
      
      await generateTemplatePDF({
        name: exam.title,
        description: exam.subject || 'Answer Sheet Template',
        numQuestions: exam.num_items,
        choicesPerQuestion: exam.choices_per_item,
        examName: exam.title,
        examCode: examCode,
      });
      
      setHasTemplate(true);
      toast.success('✅ Template created and downloaded!');
    } catch (error: any) {
      console.error('❌ Error creating template:', error);
      
      if (error?.code === 'permission-denied') {
        toast.error('Permission denied. Please check if you are logged in and try again.');
      } else {
        toast.error(`Failed to create template: ${error?.message || 'Unknown error'}`);
      }
    } finally {
      setCreatingTemplate(false);
    }
  };

  const actionButtons = [
    {
      icon: Edit2,
      label: "Edit Answer Key",
      description: "Set correct answers for each question",
      href: `/exams/${params.id}/edit-key`,
      color: "bg-blue-50 text-primary",
    },
    {
      icon: hasTemplate ? CheckCircle : creatingTemplate ? Loader2 : FilePlus,
      label: hasTemplate ? "Template Created" : creatingTemplate ? "Generating..." : "Create Template",
      description: hasTemplate
        ? "Answer sheet template already generated"
        : "Auto-generate and download answer sheet PDF",
      color: hasTemplate ? "bg-green-100 text-green-600" : "bg-green-50 text-green-600",
      onClick: hasTemplate || creatingTemplate ? undefined : () => handleCreateTemplate(),
      disabled: hasTemplate || creatingTemplate,
    },
    {
      icon: Smartphone,
      label: "Scan Papers",
      description: "Scan and capture answer sheets",
      href: `/exams/${params.id}/scan-papers`,
      color: "bg-blue-50 text-primary",
    },
    {
      icon: FileText,
      label: "Review Papers",
      description: "Review scanned documents",
      href: `/exams/${params.id}/review-papers`,
      color: "bg-blue-50 text-primary",
    },
    {
      icon: BarChart3,
      label: "Item Analysis",
      description: "Analyze question performance",
      href: `/exams/${params.id}/item-analysis`,
      color: "bg-blue-50 text-primary",
    },
    {
      icon: Tag,
      label: "Tag Reports",
      description: "Generate tagged reports",
      href: `/exams/${params.id}/tag-reports`,
      color: "bg-blue-50 text-primary",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 sm:gap-4">
        <Link
          href="/exams"
          className="p-2 hover:bg-muted rounded-md transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-3xl font-bold text-foreground truncate">
            {exam.title}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground truncate">
            ID: {exam.id}
          </p>
        </div>
      </div>

      {/* Exam Information */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-3 sm:p-4 border">
          <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase mb-1">
            Total Questions
          </p>
          <p className="text-xl sm:text-2xl font-bold text-primary">
            {exam.num_items}
          </p>
        </Card>
        <Card className="p-3 sm:p-4 border">
          <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase mb-1">
            Exam Date
          </p>
          <p className="text-xl sm:text-2xl font-bold text-foreground">
            {new Date(exam.created_at).toLocaleDateString()}
          </p>
        </Card>
        <Card className="p-3 sm:p-4 border">
          <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase mb-1">
            Status
          </p>
          <p className="text-xl sm:text-2xl font-bold text-primary">
            {answerKeyStatus.hasAnswerKey
              ? answerKeyStatus.completed === answerKeyStatus.total
                ? "Complete"
                : "In Progress"
              : "Not started"}
          </p>
        </Card>
        <Card className="p-3 sm:p-4 border">
          <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase mb-1">
            Folder
          </p>
          <p className="text-xl sm:text-2xl font-bold text-foreground">
            {exam.subject}
          </p>
        </Card>
      </div>

      {/* Details Card */}
      <Card className="p-6 border">
        <h2 className="text-lg font-bold text-foreground mb-4">Exam Details</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground font-semibold mb-1">
              Created Date
            </p>
            <p className="text-foreground">
              {new Date(exam.created_at).toLocaleDateString()}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground font-semibold mb-1">
              Answer Key Status
            </p>
            {answerKeyStatus.hasAnswerKey ? (
              <p
                className={`font-semibold ${
                  answerKeyStatus.completed === answerKeyStatus.total
                    ? "text-success"
                    : "text-warning"
                }`}
              >
                {answerKeyStatus.completed}/{answerKeyStatus.total} answers
              </p>
            ) : (
              <p className="font-semibold text-muted-foreground">Not started</p>
            )}
          </div>
          <div>
            <p className="text-muted-foreground font-semibold mb-1">
              Papers Scanned
            </p>
            <p className="text-foreground">
              {scannedPaperCount} papers
            </p>
          </div>
        </div>
      </Card>

      {/* Action Buttons */}
      <div>
        <h2 className="text-lg font-bold text-foreground mb-4">Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {actionButtons.map((btn) => {
            const IconComponent = btn.icon;
            const content = (
              <Card className="p-4 border hover:border-primary hover:shadow-md transition-all h-full">
                <div className="flex gap-4">
                  <div
                    className={`w-12 h-12 rounded-lg ${btn.color} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}
                  >
                    <IconComponent className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                      {btn.label}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {btn.description}
                    </p>
                  </div>
                </div>
              </Card>
            );

            if (btn.onClick) {
              return (
                <button key={btn.label} onClick={btn.onClick} className="group text-left">
                  {content}
                </button>
              );
            }

            if (btn.disabled) {
              return (
                <div key={btn.label} className="opacity-70 cursor-not-allowed">
                  {content}
                </div>
              );
            }

            return (
              <Link key={btn.label} href={btn.href || '#'} className="group">
                {content}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
