"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Save, Check, Lock, Upload, Download } from "lucide-react";
import { AnswerKeyService } from "@/services/answerKeyService";
import { AnswerChoice, QuestionAnswer } from "@/types/scanning";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { getExamById, Exam } from "@/services/examService";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings2, ChevronDown, ChevronUp } from "lucide-react";
import * as XLSX from "xlsx";

interface AnswerKeyEditorProps {
  params: { id: string };
}

export default function AnswerKeyEditor({ params }: AnswerKeyEditorProps) {
  const { user } = useAuth();
  const [exam, setExam] = useState<Exam | null>(null);
  const [answers, setAnswers] = useState<{ [key: number]: AnswerChoice }>({});
  const [questionSettings, setQuestionSettings] = useState<{
    [key: number]: Partial<QuestionAnswer>;
  }>({});
  const [expandedSettings, setExpandedSettings] = useState<{
    [key: number]: boolean;
  }>({});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answerKeyId, setAnswerKeyId] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    loadExamAndAnswerKey();
  }, [params.id]);

  const loadExamAndAnswerKey = async () => {
    setLoading(true);
    try {
      const examData = await getExamById(params.id);
      if (examData) {
        setExam(examData);
      }

      await loadAnswerKey();
    } catch (err) {
      console.error("Error loading exam and answer key:", err);
      setError("Failed to load exam data");
    } finally {
      setLoading(false);
    }
  };

  const loadAnswerKey = async () => {
    setLoading(true);
    try {
      const result = await AnswerKeyService.getAnswerKeyByExamId(params.id);
      if (result.success && result.data) {
        const loadedAnswers: { [key: number]: AnswerChoice } = {};
        const loadedSettings: { [key: number]: Partial<QuestionAnswer> } = {};

        result.data.answers.forEach((answer, index) => {
          loadedAnswers[index + 1] = answer;
        });

        if (result.data.questionSettings) {
          result.data.questionSettings.forEach((setting) => {
            loadedSettings[setting.questionNumber] = setting;
            if (setting.correctAnswer) {
              loadedAnswers[setting.questionNumber] = setting.correctAnswer;
            }
          });
        }

        setAnswers(loadedAnswers);
        setQuestionSettings(loadedSettings);
        setAnswerKeyId(result.data.id);

        // Lock if either the answer key itself is locked or the parent exam is finalized
        setIsLocked(result.data.locked || exam?.status === "final" || false);
      }
    } catch (err) {
      console.error("Error loading answer key:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionNumber: number, answer: string) => {
    if (isLocked) return;
    setAnswers((prev) => ({
      ...prev,
      [questionNumber]: answer as AnswerChoice,
    }));

    setQuestionSettings((prev) => ({
      ...prev,
      [questionNumber]: {
        ...prev[questionNumber],
        questionNumber,
        correctAnswer: answer,
        points: prev[questionNumber]?.points ?? 1,
      },
    }));
  };

  const handlePointChange = (questionNumber: number, points: number) => {
    if (isLocked) return;
    setQuestionSettings((prev) => ({
      ...prev,
      [questionNumber]: {
        ...prev[questionNumber],
        questionNumber,
        points: points,
      },
    }));
  };

  const handleLabelChange = (
    questionNumber: number,
    choice: string,
    label: string,
  ) => {
    if (isLocked) return;
    setQuestionSettings((prev) => ({
      ...prev,
      [questionNumber]: {
        ...prev[questionNumber],
        questionNumber,
        choiceLabels: {
          ...(prev[questionNumber]?.choiceLabels || {}),
          [choice]: label,
        },
      },
    }));
  };

  const toggleSettings = (questionNumber: number) => {
    setExpandedSettings((prev) => ({
      ...prev,
      [questionNumber]: !prev[questionNumber],
    }));
  };

  const handleSaveAnswerKey = async () => {
    if (isLocked) {
      setError("Answer key is locked and cannot be modified");
      toast.error("Answer key is locked and cannot be modified");
      return;
    }

    if (!user?.id) {
      setError("You must be logged in to save answer keys");
      toast.error("You must be logged in to save answer keys");
      return;
    }

    if (!exam) {
      setError("Exam data not loaded");
      return;
    }

    const totalQuestions = exam.num_items;
    const answersEntered = Object.keys(answers).length;

    if (answersEntered < totalQuestions) {
      const missingCount = totalQuestions - answersEntered;
      const errorMsg = `Please answer all questions. ${missingCount} question${missingCount > 1 ? "s" : ""} remaining.`;
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const answerArray: AnswerChoice[] = Array.from(
        { length: exam.num_items },
        (_, i) => {
          const answer = answers[i + 1];
          return answer ? (answer.toUpperCase() as AnswerChoice) : "A";
        },
      );

      const settingsArray: QuestionAnswer[] = Array.from(
        { length: exam.num_items },
        (_, i) => {
          const qNum = i + 1;
          const setting = questionSettings[qNum];
          return {
            questionNumber: qNum,
            correctAnswer: answers[qNum] || "A",
            points: setting?.points ?? 1,
            choiceLabels: setting?.choiceLabels || {},
          };
        },
      );

      let result;
      if (answerKeyId) {
        result = await AnswerKeyService.updateAnswerKey(
          answerKeyId,
          answerArray,
          user.id,
          settingsArray,
        );
      } else {
        const createResult = await AnswerKeyService.createAnswerKey(
          params.id,
          answerArray,
          user.id,
          settingsArray,
        );
        if (createResult.success && createResult.data) {
          setAnswerKeyId(createResult.data.id);
        }
        result = createResult;
      }

      if (result.success) {
        setSaved(true);
        toast.success("Answer key saved successfully");
        setTimeout(() => setSaved(false), 2000);
      } else {
        setError(result.error || "Failed to save answer key");
        toast.error(result.error || "Failed to save answer key");
      }
    } catch (err) {
      const errorMessage = (err as Error).message;
      setError(errorMessage);
      toast.error(errorMessage);
      console.error("Error saving answer key:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadTemplate = () => {
    if (!exam) return;

    const data = [];
    data.push(["Question Number", "Answer", "Points"]);

    for (let i = 1; i <= exam.num_items; i++) {
      data.push([i, "", 1]);
    }

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Answer Key");
    XLSX.writeFile(workbook, `${exam.title}_answer_key_template.xlsx`);
    toast.success("Template downloaded successfully");
  };

  const handleUploadAnswerKey = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file || !exam) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, {
          header: 1,
        }) as any[][];

        const answerData: { [key: number]: AnswerChoice } = {};
        const settingsData: { [key: number]: Partial<QuestionAnswer> } = {};
        const validChoices = ["A", "B", "C", "D", "E"].slice(
          0,
          exam.choices_per_item,
        );
        let errors: string[] = [];

        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          const questionNum = Number(row[0]);
          const answer = String(row[1] || "")
            .trim()
            .toUpperCase();
          const points = row[2] ? Number(row[2]) : 1;

          if (!questionNum || questionNum < 1 || questionNum > exam.num_items) {
            continue;
          }

          if (answer && !validChoices.includes(answer)) {
            errors.push(
              `Row ${i + 1}: Invalid answer "${row[1]}". Must be ${validChoices.join(", ")}`,
            );
            continue;
          }

          if (answer) answerData[questionNum] = answer as AnswerChoice;
          settingsData[questionNum] = {
            questionNumber: questionNum,
            correctAnswer: answer,
            points: isNaN(points) ? 1 : points,
          };
        }

        if (errors.length > 0) {
          setError(`File upload errors:\n${errors.join("\n")}`);
          toast.error(`Found ${errors.length} error(s) in uploaded file`);
          return;
        }

        setAnswers((prev) => ({ ...prev, ...answerData }));
        setQuestionSettings((prev) => ({ ...prev, ...settingsData }));
        toast.success(`Successfully loaded data from file`);
        setError(null);
      } catch (err) {
        console.error("Error parsing file:", err);
        setError("Failed to parse file");
        toast.error("Failed to parse file");
      }
    };

    reader.readAsArrayBuffer(file);
    event.target.value = "";
  };

  const totalQuestions = exam?.num_items || 0;
  const answersEntered = Object.keys(answers).length;
  const answersPercentage =
    totalQuestions > 0
      ? Math.round((answersEntered / totalQuestions) * 100)
      : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-vh-100">
        <p>Loading answer key...</p>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="flex items-center justify-center min-vh-100">
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground mb-2">
            Exam not found
          </p>
          <Link href="/exams" className="text-primary hover:underline">
            Return to Exams
          </Link>
        </div>
      </div>
    );
  }

  const availableChoices = ["A", "B", "C", "D", "E"].slice(
    0,
    exam.choices_per_item,
  );

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href={`/exams/${params.id}`}
            className="p-2 hover:bg-muted rounded-md transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-3xl font-bold text-foreground">
              Edit Answer Key
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {exam.title} - Set correct answers and points
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 px-3 py-2 border border-muted rounded-md font-semibold hover:bg-muted transition-colors text-sm"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Template</span>
          </button>

          <label className="flex items-center gap-2 px-3 py-2 border border-muted rounded-md font-semibold hover:bg-muted transition-colors cursor-pointer text-sm">
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Upload</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleUploadAnswerKey}
              className="hidden"
              disabled={isLocked}
            />
          </label>

          {isLocked && (
            <Badge variant="secondary" className="gap-1">
              <Lock className="h-3 w-3" />
              Locked
            </Badge>
          )}
          <button
            onClick={handleSaveAnswerKey}
            disabled={saving || isLocked}
            className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-md font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {saved ? (
              <>
                <Check className="w-5 h-5" />
                Saved!
              </>
            ) : saving ? (
              <>
                <Save className="w-5 h-5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save Answer Key
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Progress Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 border bg-blue-50 col-span-1 md:col-span-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs sm:text-sm font-semibold text-muted-foreground mb-1">
                Answer Progress
              </p>
              <p className="text-xl sm:text-2xl font-bold text-primary">
                {answersEntered} / {totalQuestions} Questions
              </p>
            </div>
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white border-4 border-primary flex items-center justify-center flex-shrink-0">
              <span className="text-sm sm:text-lg font-bold text-primary">
                {answersPercentage}%
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-4 border bg-green-50">
          <p className="text-xs sm:text-sm font-semibold text-muted-foreground mb-1">
            Total Points
          </p>
          <p className="text-xl sm:text-2xl font-bold text-green-600">
            {Object.values(questionSettings).reduce(
              (acc, curr) => acc + (curr.points || 0),
              0,
            ) || totalQuestions}{" "}
            pts
          </p>
        </Card>
      </div>

      {/* Answer Key Grid */}
      <div className="space-y-4">
        {Array.from({ length: totalQuestions }, (_, i) => i + 1).map(
          (questionNum) => (
            <Card
              key={questionNum}
              className={`p-4 transition-all ${answers[questionNum] ? "border-primary" : "border-muted"}`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-center justify-center w-12 h-12 bg-muted rounded-full font-bold text-lg">
                    {questionNum}
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      {availableChoices.map((choice) => (
                        <label key={choice} className="cursor-pointer">
                          <input
                            type="radio"
                            name={`question-${questionNum}`}
                            value={choice}
                            checked={answers[questionNum] === choice}
                            onChange={(e) =>
                              handleAnswerChange(questionNum, e.target.value)
                            }
                            disabled={isLocked}
                            className="hidden"
                          />
                          <span
                            className={`w-10 h-10 flex items-center justify-center rounded-md text-sm font-bold transition-all ${
                              answers[questionNum] === choice
                                ? "bg-primary text-primary-foreground scale-110 shadow-md"
                                : "bg-muted hover:bg-muted/80"
                            }`}
                          >
                            {choice}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 border-t md:border-t-0 pt-4 md:pt-0">
                  <div className="flex flex-col gap-1 min-w-[100px]">
                    <Label
                      htmlFor={`points-${questionNum}`}
                      className="text-xs font-semibold uppercase text-muted-foreground"
                    >
                      Points
                    </Label>
                    <Input
                      id={`points-${questionNum}`}
                      type="number"
                      min="0"
                      step="0.5"
                      className="h-9 w-24"
                      value={questionSettings[questionNum]?.points ?? 1}
                      onChange={(e) =>
                        handlePointChange(
                          questionNum,
                          parseFloat(e.target.value) || 0,
                        )
                      }
                      disabled={isLocked}
                    />
                  </div>

                  <button
                    onClick={() => toggleSettings(questionNum)}
                    className="p-2 hover:bg-muted rounded-md transition-all text-muted-foreground hover:text-primary"
                    title="Custom Choice Labels"
                  >
                    <Settings2 className="w-5 h-5" />
                  </button>

                  <button
                    onClick={() => toggleSettings(questionNum)}
                    className="p-1 hover:bg-muted rounded-md"
                  >
                    {expandedSettings[questionNum] ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Expanded Settings for Labels */}
              {expandedSettings[questionNum] && (
                <div className="mt-4 pt-4 border-t grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 animate-in slide-in-from-top-2 duration-200">
                  {availableChoices.map((choice) => (
                    <div key={choice} className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                        Label for {choice}
                      </Label>
                      <Input
                        placeholder={choice}
                        className="h-8 text-sm"
                        value={
                          questionSettings[questionNum]?.choiceLabels?.[
                            choice
                          ] || ""
                        }
                        onChange={(e) =>
                          handleLabelChange(questionNum, choice, e.target.value)
                        }
                        disabled={isLocked}
                      />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ),
        )}
      </div>

      <div className="fixed bottom-6 right-6 flex items-center gap-2">
        <button
          onClick={handleSaveAnswerKey}
          disabled={saving || isLocked}
          className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-full font-bold shadow-xl hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Save className="w-5 h-5" />
          )}
          Save Answer Key
        </button>
      </div>
    </div>
  );
}

const Loader2 = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);
