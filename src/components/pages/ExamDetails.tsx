"use client";

import { useEffect, useState } from "react";
import {
  X,
  Loader2,
  Camera,
  FileText,
  AlertCircle,
  FileDown,
  ChevronRight,
  ChevronLeft,
  Users,
} from "lucide-react";
import { getExamById, Exam } from "@/services/examService";
import { AnswerKeyService } from "@/services/answerKeyService";
import { BatchService } from "@/services/batchService";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { AnswerChoice } from "@/types/scanning";
import { useSearchParams } from "next/navigation";

interface ExamDetailsProps {
  params: { id: string };
}

type TabType = "Overview" | "Answer Key" | "Scan Sheets" | "Results";

export default function ExamDetails({ params }: ExamDetailsProps) {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const isEditMode = searchParams.get("edit") === "true";
  const [activeTab, setActiveTab] = useState<TabType>(
    isEditMode ? "Answer Key" : "Overview",
  );
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  // Answer Key State
  const [answers, setAnswers] = useState<AnswerChoice[]>([]);
  const [answerKeyId, setAnswerKeyId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function fetchExamAndKey() {
      try {
        setLoading(true);
        const examData = await getExamById(params.id);
        setExam(examData);

        if (examData) {
          // Fetch existing answer key
          const keyResult = await AnswerKeyService.getAnswerKeyByExamId(
            params.id,
          );
          if (keyResult.success && keyResult.data) {
            setAnswers(keyResult.data.answers);
            setAnswerKeyId(keyResult.data.id);
          } else {
            // Initialize empty answers based on num_items
            setAnswers(new Array(examData.num_items).fill(""));
          }
        }
      } catch (error) {
        console.error("Error fetching exam:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchExamAndKey();
  }, [params.id]);

  const handleSaveAnswerKey = async () => {
    if (!user || !exam) return;
    if (exam.status === "final") {
      toast.error("Cannot edit a finalized exam");
      return;
    }

    try {
      setIsSaving(true);
      const filledAnswers = answers.filter((a) => a !== "");
      if (filledAnswers.length < exam.num_items) {
        toast.error(
          `Please provide answers for all ${exam.num_items} questions.`,
        );
        setIsSaving(false);
        return;
      }

      let result;
      if (answerKeyId) {
        result = await AnswerKeyService.updateAnswerKey(
          answerKeyId,
          answers,
          user.id,
        );
      } else {
        result = await AnswerKeyService.createAnswerKey(
          exam.id,
          answers,
          user.id,
        );
        if (result.success && result.data) {
          setAnswerKeyId(result.data.id);
        }
      }

      if (result.success) {
        toast.success("Answer key saved successfully");
      } else {
        toast.error(result.error || "Failed to save answer key");
      }
    } catch (error) {
      console.error("Error saving answer key:", error);
      toast.error("An unexpected error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  const handleFinalize = async () => {
    if (!user || !exam) return;

    // Task 4.1: Verify all questions have answers
    const filledAnswersCount = answers.filter((a) => a !== "").length;
    if (filledAnswersCount < exam.num_items) {
      toast.error(
        `Verification Failed: Only ${filledAnswersCount}/${exam.num_items} questions have answers.`,
      );
      return;
    }

    try {
      setIsSaving(true);
      const { updateExam } = await import("@/services/examService");
      const approvedAt = new Date().toISOString();
      await updateExam(exam.id, {
        status: "final",
        approvedBy: user.id,
        approvedAt: approvedAt,
      });

      // Log the review action (Task 4.5)
      await BatchService.recordReviewAction(
        exam.id,
        exam.examCode || "N/A",
        user.id,
        "approved",
      );

      setExam((prev) =>
        prev
          ? {
              ...prev,
              status: "final",
              approvedBy: user.id,
              approvedAt: approvedAt,
            }
          : null,
      );
      toast.success("Exam approved and finalized");
    } catch (error) {
      console.error("Error finalizing exam:", error);
      toast.error("Failed to finalize exam");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-10 h-10 animate-spin text-[#004D2C]" />
      </div>
    );
  }

  if (!exam) return <div>Exam not found</div>;

  const tabs: { id: TabType; label: string; locked?: boolean }[] = [
    { id: "Overview", label: "Overview" },
    { id: "Answer Key", label: "Answer Key" },
    { id: "Scan Sheets", label: "Scan Sheets", locked: true },
    { id: "Results", label: "Results" },
  ];

  return (
    <div className="max-w-6xl mx-auto bg-white rounded-[32px] overflow-hidden shadow-2xl border border-[#BA8E23]/20 animate-scale-in">
      {/* Header Container */}
      <div className="p-8 pb-0 border-b relative">
        <button
          className="absolute top-8 right-8 p-2 hover:bg-gray-100 rounded-full"
          onClick={() => window.history.back()}
        >
          <X className="w-6 h-6 text-gray-400" />
        </button>

        <div className="flex justify-between items-start mb-8">
          <div className="space-y-1">
            <h1 className="text-3xl font-black text-[#004D2C]">{exam.title}</h1>
            <p className="text-gray-400 font-bold">
              {exam.num_items} items • {exam.generated_sheets.length} students
              scanned •{" "}
              {new Date(exam.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
          <div className="flex gap-3">
            <div
              className={cn(
                "mt-10 px-4 py-2 rounded-xl border text-sm font-black uppercase tracking-wider",
                exam.status === "final"
                  ? "mt-10 bg-emerald-50 text-emerald-600 border-emerald-100"
                  : "mt-10 bg-amber-50 text-amber-600 border-amber-100",
              )}
            >
              {exam.status}
            </div>
            {exam.status === "draft" && (
              <Button
                onClick={handleFinalize}
                disabled={isSaving}
                className="bg-[#BA8E23] hover:bg-[#a67d1f] text-white px-6 rounded-xl font-black shadow-md border-b-4 border-[#8c6a1a]"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Finalize Exam"
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "pb-4 text-[15px] font-black tracking-wide transition-all border-b-4",
                activeTab === tab.id
                  ? "border-[#004D2C] text-[#004D2C]"
                  : "border-transparent text-gray-400 hover:text-gray-600",
              )}
            >
              <div className="flex items-center gap-2">
                {tab.id === "Overview" && <FileText className="w-4 h-4" />}
                {tab.id === "Answer Key" && (
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path
                      d="M7 21v-4a2 2 0 012-2h4a2 2 0 012 2v4M3 21h18"
                      strokeLinecap="round"
                    />
                    <rect
                      x="5"
                      y="3"
                      width="14"
                      height="12"
                      rx="2"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
                {tab.id === "Scan Sheets" && <Camera className="w-4 h-4" />}
                {tab.id === "Results" && (
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path
                      d="M3 3v18h18"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M18 17V9M13 17V5M8 17v-3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
                {tab.label}
                {tab.locked && (
                  <span className="bg-gray-100 text-[10px] text-gray-400 px-2 py-0.5 rounded-md border italic">
                    Locked
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="p-8 min-h-[500px] bg-[#FAF9F6]">
        {activeTab === "Overview" && (
          <OverviewTab exam={exam} hasAnswerKey={!!answerKeyId} />
        )}
        {activeTab === "Answer Key" && (
          <AnswerKeyTab
            exam={exam}
            answers={answers}
            setAnswers={setAnswers}
            onSave={handleSaveAnswerKey}
            isSaving={isSaving}
            isLocked={exam.status === "final"}
          />
        )}
        {activeTab === "Scan Sheets" && <ScanSheetsTab />}
        {activeTab === "Results" && (
          <ResultsTab
            selectedClassId={selectedClassId}
            setSelectedClassId={setSelectedClassId}
          />
        )}
      </div>

      {/* Footer */}
      <div className="p-8 border-t bg-white flex justify-end">
        <Button
          onClick={() => window.history.back()}
          className="bg-[#004D2C] hover:bg-[#003d22] text-white px-8 h-12 rounded-xl font-black text-lg shadow-lg"
        >
          Close
        </Button>
      </div>
    </div>
  );
}

function OverviewTab({
  exam,
  hasAnswerKey,
}: {
  exam: Exam;
  hasAnswerKey: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Exam Info Card */}
        <Card className="rounded-[24px] border-[#BA8E23]/20 shadow-sm overflow-hidden bg-white">
          <div className="p-6 border-b bg-white">
            <h3 className="text-lg font-black text-[#004D2C]">
              Exam Information
            </h3>
          </div>
          <CardContent className="p-8 space-y-6">
            <div className="space-y-1">
              <p className="text-xs font-bold text-gray-400 uppercase">
                Exam Title
              </p>
              <p className="text-xl font-black text-[#004D2C]">{exam.title}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-gray-400 uppercase">
                Number of Items
              </p>
              <p className="text-xl font-black text-[#004D2C]">
                {exam.num_items}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-gray-400 uppercase">
                Date Created
              </p>
              <p className="text-xl font-black text-[#004D2C]">
                {new Date(exam.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
            <div className="space-y-3">
              <p className="text-xs font-bold text-gray-400 uppercase">
                Status
              </p>
              <div
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-black border w-fit uppercase",
                  exam.status === "final"
                    ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                    : "bg-amber-50 text-amber-600 border-amber-100",
                )}
              >
                {exam.status}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Progress Card */}
        <Card className="rounded-[24px] border-[#BA8E23]/20 shadow-sm overflow-hidden bg-white">
          <div className="p-6 border-b bg-white">
            <h3 className="text-lg font-black text-[#004D2C]">Progress</h3>
          </div>
          <CardContent className="p-8 space-y-8">
            <div className="flex justify-between items-end">
              <div className="space-y-1">
                <p className="text-xs font-bold text-gray-400 uppercase">
                  Students Enrolled
                </p>
                <p className="text-3xl font-black text-[#004D2C]">45</p>
              </div>
              <div className="text-right space-y-1">
                <p className="text-xs font-bold text-gray-400 uppercase text-right">
                  Sheets Scanned
                </p>
                <p className="text-3xl font-black text-[#004D2C]">
                  {exam.generated_sheets.length}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-xs font-black text-gray-400 uppercase">
                <span>Completion</span>
                <span>
                  {Math.round((exam.generated_sheets.length / 45) * 100)}%
                </span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#004D2C]"
                  style={{
                    width: `${Math.round((exam.generated_sheets.length / 45) * 100)}%`,
                  }}
                />
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-bold text-gray-400 uppercase">
                Answer Key
              </p>
              {hasAnswerKey ? (
                <div className="bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-lg py-2 px-4 w-fit text-sm font-black">
                  Set
                </div>
              ) : (
                <div className="bg-red-50 text-red-600 border border-red-100 rounded-lg py-2 px-4 w-fit text-sm font-black">
                  Not Set
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Yellow Alert - Show only if answer key is not set */}
      {!hasAnswerKey && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-amber-500 shrink-0" />
          <p className="text-[#004D2C] font-bold text-[15px]">
            <span className="font-extrabold underline">Action Required:</span>{" "}
            Please set the answer key in the "Answer Key" tab before scanning
            answer sheets.
          </p>
        </div>
      )}
    </div>
  );
}

function AnswerKeyTab({
  exam,
  answers,
  setAnswers,
  onSave,
  isSaving,
  isLocked,
}: {
  exam: Exam;
  answers: AnswerChoice[];
  setAnswers: (answers: AnswerChoice[]) => void;
  onSave: () => void;
  isSaving: boolean;
  isLocked?: boolean;
}) {
  const questions = Array.from({ length: exam.num_items }, (_, i) => i + 1);

  const handleChoiceSelect = (qIdx: number, choice: AnswerChoice) => {
    if (isLocked) return;
    const newAnswers = [...answers];
    newAnswers[qIdx] = choice;
    setAnswers(newAnswers);
  };

  return (
    <div className="bg-white rounded-[24px] border-[#BA8E23]/20 shadow-sm overflow-hidden">
      <div className="p-6 border-b flex items-center justify-between">
        <h3 className="text-xl font-black text-[#004D2C]">Set Answer Key</h3>
        <Button
          onClick={onSave}
          disabled={isSaving || isLocked}
          className={cn(
            "bg-[#004D2C] hover:bg-[#003d22] text-white px-6 rounded-xl flex items-center gap-2 font-black transition-all active:scale-95",
            isLocked && "opacity-50 cursor-not-allowed hover:bg-[#004D2C]",
          )}
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
            >
              <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
              <path d="M17 21v-8H7v8M7 3v5h8" />
            </svg>
          )}
          {isSaving ? "Saving..." : isLocked ? "Finalized" : "Save Answer Key"}
        </Button>
      </div>
      <div className="p-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
          {questions.map((q, idx) => (
            <div
              key={q}
              className="p-4 border rounded-2xl space-y-3 bg-[#FAF9F6]/50"
            >
              <p className="text-[13px] font-black text-[#004D2C] text-center uppercase">
                Question {q}
              </p>
              <div className="flex justify-between items-center px-1">
                {["A", "B", "C", "D", "E"]
                  .slice(0, exam.choices_per_item || 4)
                  .map((choice) => {
                    const isSelected = answers[idx] === choice;
                    return (
                      <button
                        key={choice}
                        onClick={() =>
                          handleChoiceSelect(idx, choice as AnswerChoice)
                        }
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-black border-2 transition-all",
                          !isLocked && "active:scale-90",
                          isSelected
                            ? "bg-[#004D2C] border-[#004D2C] text-white shadow-md"
                            : "bg-white border-gray-100 text-gray-400 hover:border-[#BA8E23]/30",
                          isLocked && "cursor-default",
                          isLocked && !isSelected && "opacity-40",
                        )}
                      >
                        {choice}
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScanSheetsTab() {
  return (
    <div className="bg-[#111827] rounded-[32px] min-h-[500px] flex flex-col items-center justify-center relative shadow-2xl overflow-hidden border-8 border-white">
      <div className="space-y-6 text-center">
        <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-white/10">
          <Camera className="w-12 h-12 text-white/40" />
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-black text-white">Camera Ready</h3>
          <p className="text-white/40 font-bold">
            Click "Start Camera" to begin scanning
          </p>
        </div>
        <Button className="bg-[#004D2C] hover:bg-[#003d22] text-white px-10 h-16 rounded-2xl flex items-center gap-3 font-black text-xl shadow-xl active:scale-95 transition-all">
          <Camera className="w-6 h-6" />
          Start Camera
        </Button>
      </div>

      {/* Viewport Corners */}
      <div className="absolute top-12 left-12 w-12 h-12 border-t-4 border-l-4 border-[#BA8E23] rounded-tl-2xl opacity-50" />
      <div className="absolute top-12 right-12 w-12 h-12 border-t-4 border-r-4 border-[#BA8E23] rounded-tr-2xl opacity-50" />
      <div className="absolute bottom-12 left-12 w-12 h-12 border-b-4 border-l-4 border-[#BA8E23] rounded-bl-2xl opacity-50" />
      <div className="absolute bottom-12 right-12 w-12 h-12 border-b-4 border-r-4 border-[#BA8E23] rounded-br-2xl opacity-50" />
    </div>
  );
}

function ResultsTab({
  selectedClassId,
  setSelectedClassId,
}: {
  selectedClassId: string | null;
  setSelectedClassId: (id: string | null) => void;
}) {
  if (selectedClassId) {
    return (
      <div className="animate-fade-in space-y-6">
        {/* Detail view for a class */}
        <div className="bg-white rounded-[24px] border-[#BA8E23]/20 shadow-sm overflow-hidden">
          <div className="p-8 flex items-center justify-between border-b">
            <div className="flex items-center gap-6">
              <button
                onClick={() => setSelectedClassId(null)}
                className="w-12 h-12 rounded-xl border flex items-center justify-center text-gray-400 hover:bg-gray-50 transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <div>
                <h3 className="text-2xl font-black text-[#004D2C]">
                  CS101 - Section A
                </h3>
                <p className="text-gray-400 font-bold">
                  10 students • MWF 9:00 AM – 10:30 AM
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm font-black text-gray-400 mr-2 uppercase tracking-wide">
                Export:
              </span>
              <Button className="bg-red-600 hover:bg-red-700 text-white rounded-xl flex items-center gap-2 h-11 px-6 font-black shadow-lg">
                <FileDown className="w-4 h-4" />
                PDF
              </Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center gap-2 h-11 px-6 font-black shadow-lg">
                <FileText className="w-4 h-4" />
                Excel
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
                  <TableHead className="py-6 px-8 font-black text-[#004D2C]">
                    #
                  </TableHead>
                  <TableHead className="py-6 font-black text-[#004D2C]">
                    Student ID
                  </TableHead>
                  <TableHead className="py-6 font-black text-[#004D2C]">
                    Student Name
                  </TableHead>
                  <TableHead className="py-6 font-black text-[#004D2C]">
                    Score
                  </TableHead>
                  <TableHead className="py-6 font-black text-[#004D2C]">
                    Percentage
                  </TableHead>
                  <TableHead className="py-6 px-8 font-black text-[#004D2C]">
                    Time
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  {
                    id: "202312261",
                    name: "Azel Oquendo",
                    score: "45 / 50",
                    pct: "90%",
                    time: "Feb 10, 2026 9:15 AM",
                  },
                  {
                    id: "202311173",
                    name: "Eunice Gardner",
                    score: "45 / 50",
                    pct: "84%",
                    time: "Feb 10, 2026 9:18 AM",
                  },
                  {
                    id: "202310383",
                    name: "Borbo, Franz",
                    score: "38 / 50",
                    pct: "76%",
                    time: "Feb 10, 2026 9:22 AM",
                  },
                  {
                    id: "202312264",
                    name: "Sabado, Cristine",
                    score: "47 / 50",
                    pct: "94%",
                    time: "Feb 10, 2026 9:25 AM",
                  },
                  {
                    id: "202310192",
                    name: "Misola, CJ John",
                    score: "35 / 50",
                    pct: "70%",
                    time: "Feb 10, 2026 9:30 AM",
                  },
                ].map((s, idx) => (
                  <TableRow key={s.id} className="hover:bg-emerald-50/30">
                    <TableCell className="py-6 px-8 text-gray-400 font-bold">
                      {idx + 1}
                    </TableCell>
                    <TableCell className="py-6 text-gray-500 font-bold">
                      {s.id}
                    </TableCell>
                    <TableCell className="py-6 text-emerald-800 font-black">
                      {s.name}
                    </TableCell>
                    <TableCell className="py-6 text-[#004D2C] font-black text-xl">
                      {s.score}
                    </TableCell>
                    <TableCell className="py-6">
                      <span className="bg-emerald-100 text-emerald-600 px-3 py-1 rounded-lg text-xs font-black border border-emerald-200">
                        {s.pct}
                      </span>
                    </TableCell>
                    <TableCell className="py-6 px-8 text-gray-400 font-bold">
                      {s.time}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-8">
      <div className="space-y-2">
        <h3 className="text-xl font-black text-[#004D2C]">Select a Class</h3>
        <p className="text-gray-400 font-bold">
          Choose a class to view and export student results
        </p>
      </div>

      <div className="grid gap-6">
        {[
          {
            id: "class-a",
            name: "CS101 - Section A",
            schedule: "MWF 9:00 AM – 10:30 AM",
            students: 45,
            scanned: 10,
            score: "84%",
            progress: 22,
          },
          {
            id: "class-b",
            name: "CS101 - Section B",
            schedule: "TTH 1:00 PM – 2:30 PM",
            students: 42,
            scanned: 8,
            score: "86%",
            progress: 19,
          },
        ].map((cls) => (
          <Card
            key={cls.id}
            className="rounded-[24px] border-[#BA8E23]/20 hover:border-[#BA8E23] hover:shadow-xl transition-all p-8 bg-white cursor-pointer group"
            onClick={() => setSelectedClassId(cls.id)}
          >
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 rounded-2xl bg-[#FAF9F6] border border-[#BA8E23]/10 flex items-center justify-center group-hover:bg-emerald-50 transition-colors">
                  <div className="w-10 h-10 rounded-lg border-2 border-[#BA8E23]/30" />
                </div>
                <div>
                  <h4 className="text-2xl font-black text-[#004D2C]">
                    {cls.name}
                  </h4>
                  <div className="flex items-center gap-2 text-gray-400 font-bold mt-1">
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    <span>{cls.schedule}</span>
                  </div>
                </div>
              </div>
              <ChevronRight className="w-8 h-8 text-gray-200 group-hover:text-[#BA8E23] transition-colors" />
            </div>

            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="p-4 rounded-2xl border border-gray-100 bg-[#FAF9F6]/50 space-y-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase">
                  Total Students
                </p>
                <div className="flex items-center gap-2 text-[#004D2C]">
                  <Users className="w-5 h-5" />
                  <span className="text-2xl font-black">{cls.students}</span>
                </div>
              </div>
              <div className="p-4 rounded-2xl border border-gray-100 bg-[#FAF9F6]/50 space-y-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase">
                  Scanned
                </p>
                <div className="text-[#004D2C]">
                  <span className="text-2xl font-black">
                    {cls.scanned} / {cls.students}
                  </span>
                </div>
              </div>
              <div className="p-4 rounded-2xl border border-gray-100 bg-[#FAF9F6]/50 space-y-1 text-emerald-600">
                <p className="text-[10px] font-bold text-gray-400 uppercase">
                  Average Score
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black">{cls.score}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-end text-xs font-black text-[#004D2C]">
                <span>{cls.progress}%</span>
              </div>
              <div className="h-2 bg-[#FAF9F6] border rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#004D2C] transition-all duration-500"
                  style={{ width: `${cls.progress}%` }}
                />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Minimal table components to satisfy the refactor
function Table({ children }: { children: React.ReactNode }) {
  return <table className="w-full text-left border-collapse">{children}</table>;
}
function TableHeader({ children }: { children: React.ReactNode }) {
  return <thead>{children}</thead>;
}
function TableRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <tr className={className}>{children}</tr>;
}
function TableHead({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th className={cn("text-left font-semibold text-sm", className)}>
      {children}
    </th>
  );
}
function TableBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y">{children}</tbody>;
}
function TableCell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={className}>{children}</td>;
}
