"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileText,
  BarChart2,
  FilePlus,
  CheckCircle,
  Loader2,
  Pencil,
  Maximize,
  Upload,
  Save,
  X,
  ArrowLeft,
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
import { db, auth } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
} from "firebase/firestore";
import { toast } from "sonner";
import { BackButton } from "@/components/ui/BackButton";
import { generateTemplatePDF } from "@/lib/templatePdfGenerator";
import { AuditLogger } from "@/services/auditLogger";
import { InstructorSettingsService } from "@/services/instructorSettingsService";
import { TemplateService } from "@/services/templateService";

interface ExamDetailsProps {
  params: { id: string };
}

export default function ExamDetails({ params }: ExamDetailsProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasTemplate, setHasTemplate] = useState(false);
  const [creatingTemplate, setCreatingTemplate] = useState(false);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
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

      const settings = await InstructorSettingsService.getSettings(user.id);
      await generateTemplatePDF({
        name: exam.title,
        description: exam.subject,
        numQuestions: exam.num_items,
        choicesPerQuestion: exam.choices_per_item,
        examName: exam.title,
        examCode: exam.examCode,
        institutionName: exam.institutionName || settings?.institutionName,
        logoUrl: exam.logoUrl || settings?.logoUrl,
      });

      setHasTemplate(true);
      toast.success("Template created!");
    } catch (err) {
      toast.error("Failed to create template");
    } finally {
      setCreatingTemplate(false);
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
          <Link
            href="/exams"
            className="mt-1.5 p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0f172a] tracking-tight">
              {exam.title}
            </h1>
            <p className="text-sm sm:text-base font-semibold text-gray-400 mt-1">
              {exam.subject}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {exam.status !== "final" && (
              <button
                onClick={() => setShowFinalizeConfirm(true)}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#22c55e] text-white rounded-xl font-bold text-sm hover:bg-[#16a34a] transition-all shadow-md shadow-green-500/10"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Finalize</span>
              </button>
            )}

            {canEditExam(exam) && (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 px-6 py-2.5 border border-gray-200 bg-white text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
              >
                <Pencil className="w-4 h-4" />
                <span>Edit</span>
              </button>
            )}
          </div>
        </div>

        {/* Stats Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="space-y-3 relative before:absolute before:left-[-24px] before:top-[-8px] before:bottom-[-8px] before:w-[4px] before:bg-green-500 before:rounded-full">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                Items
              </p>
              <p className="text-base font-extrabold text-[#0f172a]">
                {exam.num_items} Questions
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                Template ID
              </p>
              <div className="inline-block px-3 py-1 bg-gray-50 border border-gray-100 rounded-md">
                <span className="text-sm font-bold text-gray-600 font-mono">
                  {exam.examCode || "NO-CODE"}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                Tagged Classes
              </p>
              <div className="flex flex-wrap gap-2">
                <div className="inline-block px-3 py-1 bg-green-50 border border-green-100 rounded-full">
                  <span className="text-xs font-bold text-green-600">
                    {exam.className || "General"}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                Papers Scanned
              </p>
              <p className="text-xl font-extrabold text-[#0f172a]">
                {scannedCount}
              </p>
            </div>
          </div>
        </div>

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
                    ? "text-[#22c55e]"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                <Icon
                  className={`w-4.5 h-4.5 ${isActive ? "text-[#22c55e]" : "text-gray-300"}`}
                />
                <span>{tab.label}</span>
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#22c55e] rounded-full" />
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
                  <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all">
                    <Upload className="w-4 h-4" />
                    <span>Import Key</span>
                  </button>
                  <button
                    onClick={handleSaveAnswerKey}
                    disabled={isSavingKey}
                    className="flex items-center gap-2 px-4 py-2 bg-[#22c55e] text-white rounded-lg text-sm font-bold hover:bg-[#16a34a] transition-all shadow-md shadow-green-500/10 disabled:opacity-50"
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
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all border-2 shadow-sm ${
                                  isSelected
                                    ? "bg-[#22c55e] border-[#22c55e] text-white ring-4 ring-green-500/10 scale-110"
                                    : "bg-white border-gray-200 text-gray-400 hover:border-green-200 hover:text-green-500"
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
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
                <FileText className="w-16 h-16 text-green-500 mx-auto mb-4 opacity-20" />
                <h3 className="text-xl font-bold text-gray-900">
                  Exam Template
                </h3>
                <p className="text-gray-500 max-w-sm mx-auto mt-2">
                  {hasTemplate
                    ? "Template has been generated."
                    : "Generate and download OMR answer sheets for your students."}
                </p>
                <button
                  disabled={hasTemplate || creatingTemplate}
                  onClick={handleCreateTemplate}
                  className={`mt-8 flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-sm mx-auto transition-all ${
                    hasTemplate
                      ? "bg-green-50 text-green-600 cursor-default"
                      : "bg-[#22c55e] text-white hover:bg-[#16a34a] shadow-lg shadow-green-500/20"
                  }`}
                >
                  {creatingTemplate ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : hasTemplate ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <FilePlus className="w-4 h-4" />
                  )}
                  <span>
                    {creatingTemplate
                      ? "Generating..."
                      : hasTemplate
                        ? "Template Created"
                        : "Create Template"}
                  </span>
                </button>
              </div>
            </div>
          )}

          {activeTab === "scan_papers" && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
              <Maximize className="w-16 h-16 text-green-500 mx-auto mb-4 opacity-20" />
              <h3 className="text-xl font-bold text-gray-900">
                Ready to Scan?
              </h3>
              <p className="text-gray-500 max-w-md mx-auto mt-2">
                Use your mobile device to scan the answer sheets. Results sync
                automatically.
              </p>
              <Link
                href={`/exams/${params.id}/scan-papers`}
                className="mt-8 inline-block"
              >
                <button className="bg-[#22c55e] text-white px-10 py-3.5 rounded-xl font-bold hover:bg-[#16a34a] shadow-lg shadow-green-500/20 transition-all">
                  Open Scanner UI
                </button>
              </Link>
            </div>
          )}

          {["review_paper", "item_analysis"].includes(activeTab) && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
              <BarChart2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-gray-900 capitalize">
                {activeTab.replace("_", " ")}
              </h3>
              <p className="text-gray-500 mt-1">
                No data available to display yet.
              </p>
              <Link
                href={`/exams/${params.id}/${activeTab.replace("_", "-")}`}
                className="mt-8 inline-block"
              >
                <button className="px-6 py-2.5 border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50">
                  Go to Dedicated Page
                </button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 bg-[#0f172a]/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden">
            <div className="p-6 border-b border-gray-50 flex items-center justify-between">
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
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all font-semibold text-[#0f172a]"
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
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all font-semibold text-[#0f172a]"
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
                            ? "bg-[#22c55e] text-white border-[#22c55e] shadow-md shadow-green-500/10"
                            : "bg-white border-gray-100 text-gray-500 hover:border-green-200"
                        }`}
                      >
                        {n} Items
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-50 bg-gray-50/50 flex items-center justify-end gap-3">
              <button
                onClick={() => setIsEditing(false)}
                className="px-6 py-2.5 font-bold text-sm text-gray-400 hover:text-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="px-8 py-2.5 bg-[#22c55e] text-white rounded-xl font-bold text-sm hover:bg-[#16a34a] shadow-md shadow-green-500/10 disabled:opacity-50"
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
