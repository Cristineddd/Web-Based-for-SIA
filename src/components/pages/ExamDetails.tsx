"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import {
  FileText,
  BarChart2,
  FilePlus,
  CheckCircle,
  Loader2,
  Pencil,
  Maximize,
  Upload,
  Download,
  Save,
  X,
  Printer,
} from "lucide-react";
import {
  getExamById,
  updateExam,
  Exam,
  canEditExam,
  EDIT_RESTRICTION_MESSAGE,
} from "@/services/examService";
import { AnswerKeyService } from "@/services/answerKeyService";
import { ScanningService } from "@/services/scanningService";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { toast } from "sonner";
import { BackButton } from "@/components/ui/BackButton";
import ReviewPapersPage from "@/components/pages/ReviewPapers";
import ItemAnalysisPage from "@/components/pages/ItemAnalysis";
import { generateTemplatePDF, getTemplatePDFBlobUrl } from "@/lib/templatePdfGenerator";
import { AuditLogger } from "@/services/auditLogger";
import { InstructorSettingsService } from "@/services/instructorSettingsService";
import { TemplateService } from "@/services/templateService";
import * as XLSX from "xlsx";
import { setPendingImage, setPendingPage } from "@/lib/omrImageStore";

interface ExamDetailsProps {
  params: { id: string };
}

export default function ExamDetails({ params }: ExamDetailsProps) {
  const { user } = useAuth();
  const router = useRouter();
  const importKeyRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasTemplate, setHasTemplate] = useState(false);
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [templatePdfUrl, setTemplatePdfUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Edit exam state
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "",
    subject: "",
    num_items: 0,
    choices_per_item: 4,
    examType: "board" as "board" | "diagnostic",
    institutionName: "",
    examCode: "",
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Finalize exam state
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [scannedCount, setScannedCount] = useState(0);
  const [activeTab, setActiveTab] = useState("key_answer");
  const [uploadPage, setUploadPage] = useState<1 | 2>(1);
  const [answerKey, setAnswerKey] = useState<Record<number, string>>({});
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [existingKeyId, setExistingKeyId] = useState<string | null>(null);

  const tabs = [
    { id: "key_answer", label: "Answer Key", icon: CheckCircle },
    { id: "template", label: "Template", icon: FileText },
    { id: "scan_papers", label: "Scan Papers", icon: Maximize },
    { id: "review_paper", label: "Review Papers", icon: FileText },
    { id: "item_analysis", label: "Item Analysis", icon: BarChart2 },
  ];

  useEffect(() => {
    async function fetchExam() {
      try {
        setLoading(true);
        setError(null);
        const examData = await getExamById(params.id);
        setExam(examData);

        if (examData) {
          // Pre-populate edit form with current exam data
          setEditForm({
            title: examData.title,
            subject: examData.subject,
            num_items: examData.num_items,
            choices_per_item: examData.choices_per_item,
            examType: examData.examType || "board",
            institutionName: examData.institutionName || "",
            examCode: examData.examCode || "",
          });

          try {
            const result = await AnswerKeyService.getAnswerKeyByExamId(
              params.id,
            );
            if (result.success && result.data) {
              setExistingKeyId(result.data.id);
              // Convert array to object for easier editing
              const answersObj: Record<number, string> = {};
              result.data.answers.forEach((ans, idx) => {
                answersObj[idx + 1] = ans;
              });
              setAnswerKey(answersObj);
            } else {
              setAnswerKey({});
            }
          } catch (error) {
            console.error("Error fetching answer key:", error);
          }

          // Fetch scanned results count
          try {
            const scannedResult =
              await ScanningService.getScannedResultsByExamId(params.id);
            if (scannedResult.success && scannedResult.data) {
              setScannedCount(scannedResult.data.length);
            }
          } catch (error) {
            console.error("Error fetching scanned results:", error);
          }

          // Check if a template already exists for this exam
          try {
            const templateQuery = query(
              collection(db, "templates"),
              where("examId", "==", params.id),
            );
            const templateSnap = await getDocs(templateQuery);
            setHasTemplate(!templateSnap.empty);
          } catch (error) {
            console.error("Error checking template:", error);
          }
        }
      } catch (error) {
        console.error("Error fetching exam:", error);
        const msg =
          error instanceof Error ? error.message : "Failed to load exam";
        setError(msg);
      } finally {
        setLoading(false);
      }
    }

    if (params.id) {
      fetchExam();
    }
  }, [params.id]);

  // Auto-load preview whenever the template tab is opened and a template exists
  useEffect(() => {
    if (
      activeTab === "template" &&
      hasTemplate &&
      !templatePdfUrl &&
      !loadingPreview
    ) {
      handleLoadPreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, hasTemplate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400 font-medium">Loading exam...</p>
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900">
          {error || "Exam not found"}
        </h1>
        <Link
          href="/exams"
          className="text-green-600 hover:underline mt-4 inline-block"
        >
          Back to Exams
        </Link>
      </div>
    );
  }

  const handleSaveEdit = async () => {
    if (!canEditExam(exam)) {
      toast.error(EDIT_RESTRICTION_MESSAGE);
      setIsEditing(false);
      return;
    }

    if (!editForm.title.trim() || !editForm.subject.trim()) {
      toast.error("Title and Subject are required");
      return;
    }

    try {
      setIsSavingEdit(true);
      const updates = {
        title: editForm.title.trim(),
        subject: editForm.subject.trim(),
        num_items: editForm.num_items,
        choices_per_item: editForm.choices_per_item,
        examType: editForm.examType,
        institutionName: editForm.institutionName,
        examCode: editForm.examCode.trim().toUpperCase(),
      };

      await updateExam(params.id, updates);

      // Audit Log
      if (user?.email) {
        AuditLogger.logActivity(
          user.id,
          user.email,
          "exam_updated",
          `Updated exam: ${updates.title}`,
          { entityId: params.id, entityType: "exam" },
        ).catch(console.error);
      }

      setExam((prev) => (prev ? { ...prev, ...updates } : null));
      toast.success("Exam updated successfully");
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update exam");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleFinalizeExam = async () => {
    try {
      setIsFinalizing(true);
      await updateExam(params.id, { status: "final" });
      setExam((prev) => (prev ? { ...prev, status: "final" } : null));
      toast.success("Exam finalized!");
      setShowFinalizeConfirm(false);
    } catch (err) {
      toast.error("Failed to finalize");
    } finally {
      setIsFinalizing(false);
    }
  };

  const buildTemplateData = async () => {
    if (!exam || !user) return null;
    const settings = await InstructorSettingsService.getSettings(user.id);
    return {
      name: exam.title,
      description: exam.subject,
      numQuestions: exam.num_items,
      choicesPerQuestion: exam.choices_per_item,
      examName: exam.title,
      examCode: exam.examCode,
      courseCode: exam.courseCode,
      institutionName: exam.institutionName || settings?.institutionName,
      logoUrl: exam.logoUrl || settings?.logoUrl,
    };
  };

  const handleCreateTemplate = async () => {
    if (!user?.instructorId || !exam) return;
    setCreatingTemplate(true);
    try {
      await TemplateService.create({
        name: exam.title,
        description: exam.subject,
        numQuestions: exam.num_items,
        choicesPerQuestion: exam.choices_per_item,
        layout: "single",
        includeStudentId: true,
        studentIdLength: 10,
        createdBy: user.id,
        instructorId: user.instructorId,
        examId: params.id,
        examName: exam.title,
        examCode: exam.examCode,
      });

      const tplData = await buildTemplateData();
      if (tplData) {
        await generateTemplatePDF(tplData);
        // Also build preview URL
        setLoadingPreview(true);
        const url = await getTemplatePDFBlobUrl(tplData);
        if (templatePdfUrl) URL.revokeObjectURL(templatePdfUrl);
        setTemplatePdfUrl(url);
        setLoadingPreview(false);
      }

      setHasTemplate(true);
      toast.success("Template created!");
    } catch (err) {
      toast.error("Failed to create template");
      setLoadingPreview(false);
    } finally {
      setCreatingTemplate(false);
    }
  };

  const handleLoadPreview = async () => {
    const tplData = await buildTemplateData();
    if (!tplData) return;
    setLoadingPreview(true);
    try {
      const url = await getTemplatePDFBlobUrl(tplData);
      if (templatePdfUrl) URL.revokeObjectURL(templatePdfUrl);
      setTemplatePdfUrl(url);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handlePrintTemplate = async () => {
    const tplData = await buildTemplateData();
    if (!tplData) return;
    const url = templatePdfUrl ?? (await getTemplatePDFBlobUrl(tplData));
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = url;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 2000);
    };
  };

  const handleDownloadTemplate = () => {
    if (!exam) return;
    const data: [string, string][] = [["Question", "Answer"]];
    for (let i = 1; i <= exam.num_items; i++) data.push([String(i), ""]);
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 12 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Answer Key");
    XLSX.writeFile(
      wb,
      `answer_key_template_${exam.title.replace(/\s+/g, "_")}.xlsx`,
    );
  };

  const handleImportKey = (file: File) => {
    if (!exam) return;
    const valid = ["A", "B", "C", "D", "E"];

    const processRows = (rows: [unknown, unknown][]) => {
      const imported: Record<number, string> = {};
      let parsed = 0;
      for (const [colA, colB] of rows) {
        const qNum = parseInt(String(colA ?? "").trim(), 10);
        const ans = String(colB ?? "")
          .trim()
          .toUpperCase();
        if (
          !isNaN(qNum) &&
          qNum >= 1 &&
          qNum <= exam.num_items &&
          valid.includes(ans)
        ) {
          imported[qNum] = ans;
          parsed++;
        }
      }
      if (parsed === 0) {
        toast.error(
          "No valid rows found. Expected columns: Question, Answer (e.g. 1, A)",
        );
        return;
      }
      setAnswerKey((prev) => ({ ...prev, ...imported }));
      toast.success(
        `Imported ${parsed} answer${parsed !== 1 ? "s" : ""} from file`,
      );
    };

    const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<[unknown, unknown]>(sheet, {
          header: 1,
        }) as [unknown, unknown][];
        // Skip header row if first cell is not a number
        const dataRows = isNaN(parseInt(String(rows[0]?.[0] ?? ""), 10))
          ? rows.slice(1)
          : rows;
        processRows(dataRows);
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        const rows: [unknown, unknown][] = lines.map((line) => {
          const [a, b] = line.split(",");
          return [a, b];
        });
        const dataRows = isNaN(parseInt(String(rows[0]?.[0] ?? "").trim(), 10))
          ? rows.slice(1)
          : rows;
        processRows(dataRows);
      };
      reader.readAsText(file);
    }
  };

  const handleSaveAnswerKey = async () => {
    if (!user || !exam) return;

    // Check if everything is filled
    const totalQuestions = exam.num_items;
    const answers: string[] = [];
    let missingQuestions = [];

    for (let i = 1; i <= totalQuestions; i++) {
      if (!answerKey[i]) {
        missingQuestions.push(i);
      }
      answers.push(answerKey[i] || ""); // fallback if we allow partial save
    }

    if (missingQuestions.length > 0) {
      toast.warning(
        `${missingQuestions.length} questions are missing answers. You can still save, but scanning may be incomplete.`,
      );
    }

    try {
      setIsSavingKey(true);
      if (existingKeyId) {
        // Update
        const result = await AnswerKeyService.updateAnswerKey(
          existingKeyId,
          answers,
          user.id,
        );
        if (result.success) {
          toast.success("Answer key updated successfully");
        } else {
          toast.error(result.error || "Failed to update answer key");
        }
      } else {
        // Create
        const result = await AnswerKeyService.createAnswerKey(
          params.id,
          answers,
          user.id,
          [], // questionSettings
          user.instructorId,
        );
        if (result.success && result.data) {
          setExistingKeyId(result.data.id);
          toast.success("Answer key created successfully");
        } else {
          toast.error(result.error || "Failed to save answer key");
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("An unexpected error occurred");
    } finally {
      setIsSavingKey(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header Section */}
        <div className="flex items-start gap-4">
          <BackButton href="/exams" asLink className="mt-1" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              {exam.title}
            </h1>
            <p className="text-sm text-gray-500 font-medium mt-0.5">
              {exam.subject}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-end gap-2 flex-shrink-0">
            {exam.status !== "final" && (
              <button
                onClick={() => setShowFinalizeConfirm(true)}
                className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 transition-all shadow-sm shadow-green-500/10"
              >
                <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>Finalize</span>
              </button>
            )}

            {canEditExam(exam) && (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 border border-gray-200 bg-white text-gray-600 rounded-xl font-bold text-xs sm:text-sm hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm whitespace-nowrap w-full sm:w-auto"
              >
                <Pencil className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>Edit</span>
              </button>
            )}
          </div>
        </div>

        {/* Stats Card */}
        <Card className="border border-gray-100 shadow-sm rounded-xl bg-white border-l-4 border-l-green-500">
          <div className="px-4 py-2 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-600">Exam Information</p>
          </div>
          <div className="px-4 pb-3 pt-1">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-0">
              <div className="space-y-0.5 py-1 pr-4">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Items</p>
                <p className="text-sm font-bold text-[#1e293b]">{exam.num_items} Questions</p>
              </div>
              <div className="space-y-0.5 border-l border-gray-100 pl-4 py-1 pr-4">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Template ID</p>
                <p className="text-sm font-bold text-[#1e293b] font-mono">{exam.examCode || "NO-CODE"}</p>
              </div>
              <div className="space-y-0.5 border-l border-gray-100 pl-4 py-1 pr-4">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Tagged Classes</p>
                <p className="text-sm font-bold text-gray-900">{exam.className || "General"}</p>
              </div>
              <div className="space-y-0.5 border-l border-gray-100 pl-4 py-1">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Papers Scanned</p>
                <p className="text-sm font-bold text-[#1e293b]">{scannedCount}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Tabs */}
        <div className="flex items-center gap-8 border-b border-gray-100 px-2 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2.5 pb-5 text-sm font-bold transition-all relative whitespace-nowrap ${
                  isActive
                    ? "text-green-600"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                <Icon
                  className={`w-4.5 h-4.5 ${isActive ? "text-green-600" : "text-gray-300"}`}
                />
                <span>{tab.label}</span>
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-green-500 rounded-full" />
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content Container */}
        <div className="mt-6">
          {activeTab === "key_answer" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h3 className="text-xl font-bold text-[#0f172a]">
                  Answer Key Configuration
                </h3>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleDownloadTemplate}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all"
                  >
                    <Download className="w-4 h-4" />
                    <span>Template</span>
                  </button>
                  <button
                    onClick={() => importKeyRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Import Key</span>
                  </button>
                  <input
                    ref={importKeyRef}
                    type="file"
                    accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImportKey(file);
                      e.target.value = "";
                    }}
                  />
                  <button
                    onClick={handleSaveAnswerKey}
                    disabled={isSavingKey}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 transition-all shadow-sm disabled:opacity-50"
                  >
                    {isSavingKey ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>{isSavingKey ? "Saving..." : "Save Changes"}</span>
                  </button>
                </div>
              </div>

              <Card className="border-none shadow-sm overflow-hidden bg-white/50 backdrop-blur-sm p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-1">
                  {Array.from({ length: exam.num_items }).map((_, idx) => {
                    const qNum = idx + 1;
                    const selectedOption = answerKey ? answerKey[qNum] : null;
                    const choices = ["A", "B", "C", "D", "E"].slice(
                      0,
                      exam.choices_per_item || 5,
                    );

                    return (
                      <div
                        key={qNum}
                        className="flex items-center gap-4 py-2 group hover:bg-green-50/30 rounded-lg transition-colors px-2"
                      >
                        <span className="w-6 text-sm font-bold text-gray-400 tabular-nums">
                          {qNum}.
                        </span>
                        <div className="flex items-center gap-3">
                          {choices.map((choice) => {
                            const isSelected = selectedOption === choice;
                            return (
                              <button
                                key={choice}
                                onClick={() =>
                                  setAnswerKey((prev) => ({
                                    ...prev,
                                    [qNum]: isSelected ? "" : choice,
                                  }))
                                }
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all border-2 ${
                                  isSelected
                                    ? "bg-green-600 border-green-600 text-white ring-4 ring-green-500/10 scale-110"
                                    : "bg-white border-gray-200 text-gray-400 hover:border-green-300 hover:text-green-600"
                                }`}
                              >
                                {choice}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          )}

          {activeTab === "template" && (
            <div className="space-y-4">
              {/* Action bar */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${hasTemplate ? 'bg-green-50' : 'bg-gray-50'}`}>
                    <FileText className={`w-5 h-5 ${hasTemplate ? 'text-green-600' : 'text-gray-400'}`} />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">
                      {hasTemplate ? "Template Ready" : "No Template Yet"}
                    </p>
                    <p className="text-xs text-gray-400">
                      {exam?.num_items} questions · {exam?.choices_per_item}{" "}
                      choices
                    </p>
                  </div>
                  {hasTemplate && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                      <CheckCircle className="w-3 h-3" /> Created
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {!hasTemplate && (
                    <button
                      disabled={creatingTemplate}
                      onClick={handleCreateTemplate}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-green-600 text-white hover:bg-green-700 shadow-sm transition-all disabled:opacity-60"
                    >
                      {creatingTemplate ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <FilePlus className="w-4 h-4" />
                      )}
                      {creatingTemplate ? "Generating…" : "Create Template"}
                    </button>
                  )}
                  {hasTemplate && (
                    <>
                      <button
                        onClick={handlePrintTemplate}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm border-2 border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-700 hover:bg-blue-50 transition-all"
                      >
                        <Printer className="w-4 h-4" />
                        Print
                      </button>
                      <button
                        onClick={async () => {
                          const d = await buildTemplateData();
                          if (d) generateTemplatePDF(d);
                        }}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm border-2 border-gray-200 text-gray-600 hover:border-gray-400 hover:bg-gray-50 transition-all"
                      >
                        <Download className="w-4 h-4" />
                        Download PDF
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* PDF Preview */}
              {hasTemplate && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  {loadingPreview && (
                    <div className="flex items-center justify-center py-20">
                      <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                      <span className="ml-3 text-gray-500 text-sm">
                        Generating preview…
                      </span>
                    </div>
                  )}
                  {!loadingPreview && !templatePdfUrl && (
                    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                      <FileText className="w-12 h-12 text-gray-200 mb-3" />
                      <p className="text-gray-500 text-sm">
                        Click <strong>Refresh Preview</strong> to load the
                        template preview.
                      </p>
                    </div>
                  )}
                  {!loadingPreview && templatePdfUrl && (
                    <iframe
                      src={templatePdfUrl}
                      className="w-full border-0"
                      style={{ height: "75vh", minHeight: "500px" }}
                      title="Template Preview"
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "scan_papers" && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100">
                <h3 className="text-base font-bold text-gray-900">Scan Papers</h3>
                <p className="text-sm text-gray-400 mt-0.5">
                  Use your mobile device to scan answer sheets, or upload a photo from your device.
                </p>
              </div>

              <div className="px-6 py-6 space-y-6">
                {/* Page selector for 200-item exams */}
                {exam && exam.num_items > 150 && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-gray-700">Which page are you scanning?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setUploadPage(1)}
                        className={`px-5 py-2 rounded-lg text-sm font-bold border-2 transition-all ${
                          uploadPage === 1
                            ? 'border-green-600 bg-green-600 text-white shadow-sm'
                            : 'border-gray-200 text-gray-600 hover:border-green-400 hover:text-green-700'
                        }`}
                      >
                        Page 1 · Q1–100
                      </button>
                      <button
                        onClick={() => setUploadPage(2)}
                        className={`px-5 py-2 rounded-lg text-sm font-bold border-2 transition-all ${
                          uploadPage === 2
                            ? 'border-green-600 bg-green-600 text-white shadow-sm'
                            : 'border-gray-200 text-gray-600 hover:border-green-400 hover:text-green-700'
                        }`}
                      >
                        Page 2 · Q101–200
                      </button>
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <Link href={`/exams/${params.id}/scan-papers`} className="flex-1 sm:flex-none">
                    <button className="w-full sm:w-auto flex items-center justify-center gap-2 bg-green-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-green-700 shadow-sm shadow-green-500/20 transition-all">
                      <Maximize className="w-4 h-4" />
                      Open Scanner UI
                    </button>
                  </Link>
                  <button
                    onClick={() => uploadInputRef.current?.click()}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-8 py-3 rounded-xl font-bold border-2 border-gray-200 text-gray-600 hover:border-green-400 hover:text-green-700 hover:bg-green-50 transition-all"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Image
                  </button>
                </div>
              </div>

              <input
                ref={uploadInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    const dataUrl = ev.target?.result as string;
                    setPendingImage(dataUrl);
                    if (exam && exam.num_items > 150) {
                      setPendingPage(uploadPage);
                    }
                    router.push(`/exams/${params.id}/scan-papers`);
                  };
                  reader.readAsDataURL(file);
                  e.target.value = '';
                }}
              />
            </div>
          )}

          {activeTab === "review_paper" && (
            <ReviewPapersPage params={{ id: params.id }} embedded />
          )}

          {activeTab === "item_analysis" && (
            <ItemAnalysisPage params={{ id: params.id }} />
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 bg-[#0f172a]/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-[#0f172a]">
                  Edit Exam Details
                </h2>
                <p className="text-sm text-gray-400 font-medium">
                  Update the information for this exam
                </p>
              </div>
              <button
                onClick={() => setIsEditing(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-8 space-y-6 overflow-y-auto max-h-[70vh]">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Exam Title
                  </label>
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) =>
                      setEditForm({ ...editForm, title: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all font-semibold text-gray-900"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={editForm.subject}
                    onChange={(e) =>
                      setEditForm({ ...editForm, subject: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all font-semibold text-gray-900"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Number of Items
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[20, 50, 100].map((n) => (
                      <button
                        key={n}
                        onClick={() =>
                          setEditForm({ ...editForm, num_items: n })
                        }
                        className={`py-3 rounded-xl font-bold text-sm border transition-all ${
                          editForm.num_items === n
                            ? "bg-green-600 text-white border-green-600 shadow-sm"
                            : "bg-white border-gray-100 text-gray-500 hover:border-green-300"
                        }`}
                      >
                        {n} Items
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                onClick={() => setIsEditing(false)}
                className="px-6 py-2.5 font-bold text-sm text-gray-400 hover:text-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="px-8 py-2.5 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 shadow-sm disabled:opacity-50"
              >
                {isSavingEdit ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Finalize Dialog */}
      {showFinalizeConfirm && (
        <div className="fixed inset-0 bg-[#0f172a]/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center overflow-hidden">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-[#22c55e]" />
            </div>
            <h2 className="text-2xl font-bold text-[#0f172a]">
              Finalize Exam?
            </h2>
            <p className="text-gray-500 mt-3 font-medium leading-relaxed">
              Once finalized, the exam configuration will be locked for editing.
            </p>
            <div className="mt-8 flex items-center gap-3">
              <button
                onClick={() => setShowFinalizeConfirm(false)}
                className="flex-1 px-4 py-3 rounded-xl font-bold text-gray-400 hover:bg-gray-50 transition-all"
              >
                Go Back
              </button>
              <button
                onClick={handleFinalizeExam}
                disabled={isFinalizing}
                className="flex-1 px-4 py-3 bg-[#22c55e] text-white rounded-xl font-bold hover:bg-[#16a34a] shadow-lg shadow-green-500/20 transition-all disabled:opacity-50"
              >
                {isFinalizing ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                ) : (
                  "Yes, Finalize"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
