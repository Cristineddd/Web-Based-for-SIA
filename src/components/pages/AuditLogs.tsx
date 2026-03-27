/**
 * Audit Logs Viewer Component
 * Allows admins to view and monitor all logged activities
 */

"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuditLogger } from "@/services/auditLogger";
import { AuditLog, ActivityType, GradeSnapshot } from "@/types/audit";
import { useAuth } from "@/contexts/AuthContext";
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCcw,
  Search,
  Activity,
  FileText,
  BarChart3,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

const ACTIVITY_TYPES: ActivityType[] = [
  "file_upload",
  "file_delete",
  "file_download",
  "student_import",
  "answer_key_upload",
  "exam_created",
  "exam_updated",
  "exam_finalized",
  "exam_deleted",
  "class_created",
  "class_deleted",
  "admin_action",
  "settings_changed",
  "grade_created",
  "grade_updated",
  "grade_deleted",
  "grade_override",
  "score_submitted",
  "score_override",
  "bulk_validation",
  "quality_check",
  "duplicate_detection",
  "mark_official",
  "validation_status_change",
  "validation_override",
  "validation_reset",
];

/** Shape of a record from the `templates` Firestore collection */
interface TemplateRecord {
  id: string;
  name: string;
  examName?: string;
  className?: string;
  classId?: string; // Used to back-fill className for old records
  examId?: string; // Used to back-fill classId for old records
  examCode?: string;
  numQuestions: number;
  choicesPerQuestion: number;
  createdBy: string; // Firebase UID
  createdByName?: string; // Resolved from users collection
  createdByEmail?: string; // May not exist for old records
  instructorId?: string;
  createdAt: string | Timestamp;
  isArchived?: boolean;
}

export default function AuditLogsViewer() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"activity" | "templates">(
    "activity",
  );
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedActivity, setSelectedActivity] = useState<
    ActivityType | "all"
  >("all");
  const [selectedStatus, setSelectedStatus] = useState<
    "all" | "success" | "failed" | "pending"
  >("all");
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportType, setExportType] = useState<"csv" | "xlsx">("xlsx");
  const [selectedReviewer, setSelectedReviewer] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Template history state — sourced directly from `templates` Firestore collection
  const [templateLogs, setTemplateLogs] = useState<TemplateRecord[]>([]);
  const [filteredTemplateLogs, setFilteredTemplateLogs] = useState<
    TemplateRecord[]
  >([]);
  const [tplSearch, setTplSearch] = useState("");
  const [tplDateFilter, setTplDateFilter] = useState("");
  const [tplUserFilter, setTplUserFilter] = useState("all");
  const [tplPage, setTplPage] = useState(1);
  const [tplPerPage, setTplPerPage] = useState(10);
  const [showTplExportDialog, setShowTplExportDialog] = useState(false);
  const [tplExportType, setTplExportType] = useState<"csv" | "xlsx">("xlsx");
  const [tplLoading, setTplLoading] = useState(false);

  const uniqueReviewers = React.useMemo(() => {
    const reviewers = new Set(
      logs.map((log) => log.adminEmail).filter(Boolean),
    );
    return Array.from(reviewers).sort();
  }, [logs]);

  const uniqueTplUsers = React.useMemo(() => {
    const users = new Set(
      templateLogs.map((t) => t.createdByName || t.createdBy).filter(Boolean),
    );
    return Array.from(users as Set<string>).sort();
  }, [templateLogs]);

  useEffect(() => {
    loadLogs();
    loadTemplateLogs();
  }, [user?.instructorId]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const allLogs = await AuditLogger.getLogs({ limit: 500 });
      setLogs(allLogs.filter((l) => l.activity !== "template_generated"));
    } catch (error) {
      console.error("Error loading audit logs:", error);
      toast.error("Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  };

  /** Load template history directly from the `templates` Firestore collection */
  const loadTemplateLogs = async () => {
    if (!user?.instructorId) return;
    try {
      setTplLoading(true);
      const q = query(
        collection(db, "templates"),
        where("instructorId", "==", user.instructorId),
      );
      const snap = await getDocs(q);
      const toMs = (raw: string | Timestamp) =>
        raw instanceof Timestamp
          ? raw.toMillis()
          : new Date(raw as string).getTime();

      // Build initial records
      const rawRecords = snap.docs.map((d) => ({
        id: d.id,
        name: d.data().name ?? "",
        examName: d.data().examName,
        className: d.data().className as string | undefined,
        classId: d.data().classId as string | undefined,
        examId: d.data().examId as string | undefined,
        examCode: d.data().examCode,
        numQuestions: d.data().numQuestions ?? 0,
        choicesPerQuestion: d.data().choicesPerQuestion ?? 4,
        createdBy: d.data().createdBy ?? "",
        createdByEmail: d.data().createdByEmail as string | undefined,
        instructorId: d.data().instructorId,
        createdAt: d.data().createdAt,
        isArchived: d.data().isArchived ?? false,
      }));

      // ── Resolve display names from `users` collection ──────────────────
      const uniqueUids = [
        ...new Set(rawRecords.map((r) => r.createdBy).filter(Boolean)),
      ];
      const nameMap: Record<string, string> = {};
      await Promise.all(
        uniqueUids.map(async (uid) => {
          try {
            const { getDoc: _getDoc, doc: _doc } =
              await import("firebase/firestore");
            const userSnap = await _getDoc(_doc(db, "users", uid));
            if (userSnap.exists()) {
              nameMap[uid] =
                userSnap.data().fullName || userSnap.data().displayName || uid;
            }
          } catch {
            // fall back to UID
          }
        }),
      );

      // ── Step 1: Resolve Exam Data for templates missing Class info ─────
      const templatesNeedingExams = rawRecords.filter(
        (r) => !r.className && !r.classId && r.examId,
      );
      const uniqueExamIds = [
        ...new Set(templatesNeedingExams.map((r) => r.examId as string)),
      ];
      const examMap: Record<string, { classId?: string; className?: string }> =
        {};

      await Promise.all(
        uniqueExamIds.map(async (examId) => {
          try {
            const { getDoc: _getDoc, doc: _doc } =
              await import("firebase/firestore");
            const examSnap = await _getDoc(_doc(db, "exams", examId));
            if (examSnap.exists()) {
              examMap[examId] = {
                classId: examSnap.data().classId,
                className: examSnap.data().className,
              };
            }
          } catch (e) {
            console.error("Failed to resolve exam for template:", examId, e);
          }
        }),
      );

      // ── Step 2: Resolve Class names from `classes` collection ──────────
      // Collect all classIds we have now (direct or via exams)
      const classIdResolver = (r: (typeof rawRecords)[0]) => {
        if (r.classId) return r.classId;
        if (r.examId && examMap[r.examId]) return examMap[r.examId].classId;
        return undefined;
      };

      const classNameResolver = (r: (typeof rawRecords)[0]) => {
        if (r.className) return r.className;
        if (r.examId && examMap[r.examId]) return examMap[r.examId].className;
        return undefined;
      };

      const resolvedClassIds = [
        ...new Set(
          rawRecords
            .filter((r) => !classNameResolver(r))
            .map(classIdResolver)
            .filter(Boolean) as string[],
        ),
      ];

      const classMap: Record<string, string> = {};
      await Promise.all(
        resolvedClassIds.map(async (classId) => {
          try {
            const { getDoc: _getDoc, doc: _doc } =
              await import("firebase/firestore");
            const classSnap = await _getDoc(_doc(db, "classes", classId));
            if (classSnap.exists()) {
              classMap[classId] =
                classSnap.data().class_name ||
                classSnap.data().className ||
                classId;
            }
          } catch {
            // fall back to classId
          }
        }),
      );

      const records: TemplateRecord[] = rawRecords
        .map((r) => {
          const directClassName = classNameResolver(r);
          const cId = classIdResolver(r);
          return {
            ...r,
            createdByName:
              nameMap[r.createdBy] ?? r.createdByEmail ?? r.createdBy,
            className: directClassName || (cId ? classMap[cId] : undefined),
          };
        })
        .sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));

      setTemplateLogs(records);
    } catch (error) {
      console.error("Error loading template history:", error);
      toast.error("Failed to load template history");
    } finally {
      setTplLoading(false);
    }
  };

  useEffect(() => {
    // Filter logs based on search and selected filters
    let filtered = logs;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (log) =>
          log.description.toLowerCase().includes(q) ||
          log.adminEmail.toLowerCase().includes(q) ||
          log.fileName?.toLowerCase().includes(q) ||
          log.entityName?.toLowerCase().includes(q) ||
          log.activity.toLowerCase().includes(q),
      );
    }

    if (selectedActivity !== "all") {
      filtered = filtered.filter((log) => log.activity === selectedActivity);
    }

    if (selectedStatus !== "all") {
      filtered = filtered.filter((log) => log.status === selectedStatus);
    }

    if (selectedReviewer !== "all") {
      filtered = filtered.filter((log) => log.adminEmail === selectedReviewer);
    }

    if (dateFilter) {
      filtered = filtered.filter((log) => {
        const logDate = new Date(log.timestamp);
        logDate.setHours(0, 0, 0, 0);
        const filterDate = new Date(dateFilter);
        filterDate.setHours(0, 0, 0, 0);
        return logDate.getTime() === filterDate.getTime();
      });
    }

    setFilteredLogs(filtered);
    setCurrentPage(1);
  }, [
    logs,
    searchQuery,
    selectedActivity,
    selectedStatus,
    selectedReviewer,
    dateFilter,
  ]);

  // Filter template logs (TemplateRecord fields)
  useEffect(() => {
    let filtered = templateLogs;

    if (tplSearch) {
      const q = tplSearch.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          (t.createdByName ?? t.createdBy).toLowerCase().includes(q) ||
          (t.examName ?? "").toLowerCase().includes(q) ||
          (t.className ?? "").toLowerCase().includes(q) ||
          (t.examCode ?? "").toLowerCase().includes(q),
      );
    }

    if (tplUserFilter !== "all") {
      filtered = filtered.filter(
        (t) => (t.createdByName ?? t.createdBy) === tplUserFilter,
      );
    }

    if (tplDateFilter) {
      filtered = filtered.filter((t) => {
        const raw = t.createdAt;
        const logDate =
          raw instanceof Timestamp ? raw.toDate() : new Date(raw as string);
        logDate.setHours(0, 0, 0, 0);
        const filterDate = new Date(tplDateFilter);
        filterDate.setHours(0, 0, 0, 0);
        return logDate.getTime() === filterDate.getTime();
      });
    }

    setFilteredTemplateLogs(filtered);
    setTplPage(1);
  }, [templateLogs, tplSearch, tplUserFilter, tplDateFilter]);

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const currentLogs = filteredLogs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const tplTotalPages = Math.ceil(filteredTemplateLogs.length / tplPerPage);
  const currentTplLogs = filteredTemplateLogs.slice(
    (tplPage - 1) * tplPerPage,
    tplPage * tplPerPage,
  );

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const handleTplPageChange = (page: number) => {
    setTplPage(Math.max(1, Math.min(page, tplTotalPages)));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case "failed":
        return <AlertCircle className="w-4 h-4 text-rose-600" />;
      case "pending":
        return <Clock className="w-4 h-4 text-amber-600" />;
      default:
        return null;
    }
  };

  const getActivityBadge = (activity: string) => {
    const colors: Record<string, string> = {
      file_upload: "bg-blue-50 text-blue-700 border-blue-200",
      file_delete: "bg-red-50 text-red-700 border-red-200",
      file_download: "bg-purple-50 text-purple-700 border-purple-200",
      student_import: "bg-indigo-50 text-indigo-700 border-indigo-200",
      answer_key_upload: "bg-teal-50 text-teal-700 border-teal-200",
      exam_created: "bg-green-50 text-green-700 border-green-200",
      exam_updated: "bg-amber-50 text-amber-700 border-amber-200",
      exam_finalized: "bg-sky-50 text-sky-700 border-sky-200",
      exam_deleted: "bg-red-50 text-red-700 border-red-200",
      class_created: "bg-emerald-50 text-emerald-700 border-emerald-200",
      class_deleted: "bg-rose-50 text-rose-700 border-rose-200",
      admin_action: "bg-orange-50 text-orange-700 border-orange-200",
      settings_changed: "bg-slate-50 text-slate-700 border-slate-200",
      grade_created: "bg-emerald-50 text-emerald-700 border-emerald-200",
      grade_updated: "bg-amber-50 text-amber-700 border-amber-200",
      grade_deleted: "bg-rose-50 text-rose-700 border-rose-200",
      grade_override: "bg-violet-50 text-violet-700 border-violet-200",
      score_submitted: "bg-cyan-50 text-cyan-700 border-cyan-200",
      score_override: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
      bulk_validation: "bg-sky-50 text-sky-700 border-sky-200",
      quality_check: "bg-violet-50 text-violet-700 border-violet-200",
      duplicate_detection: "bg-yellow-50 text-yellow-700 border-yellow-200",
      mark_official: "bg-emerald-50 text-emerald-700 border-emerald-200",
      validation_status_change: "bg-blue-50 text-blue-700 border-blue-200",
      validation_override: "bg-orange-50 text-orange-700 border-orange-200",
      validation_reset: "bg-rose-50 text-rose-700 border-rose-200",
    };

    const labels: Record<string, string> = {
      file_upload: "File Upload",
      file_delete: "File Delete",
      file_download: "File Download",
      student_import: "Student Import",
      answer_key_upload: "Answer Key",
      exam_created: "Exam Created",
      exam_updated: "Exam Updated",
      exam_finalized: "Exam Finalized",
      exam_deleted: "Exam Deleted",
      class_created: "Class Created",
      class_deleted: "Class Deleted",
      admin_action: "Admin Action",
      settings_changed: "Settings",
      grade_created: "Grade Created",
      grade_updated: "Grade Updated",
      grade_deleted: "Grade Deleted",
      grade_override: "Grade Override",
      score_submitted: "Score Sent",
      score_override: "Score Override",
      bulk_validation: "Bulk Validation",
      quality_check: "Quality Check",
      duplicate_detection: "Duplicates",
      mark_official: "Mark Official",
      validation_status_change: "Status Change",
      validation_override: "Override",
      validation_reset: "Reset",
    };

    return (
      <Badge
        variant="outline"
        className={
          colors[activity] || "bg-gray-50 text-gray-700 border-gray-200"
        }
      >
        {labels[activity] || activity.replace("_", " ").toUpperCase()}
      </Badge>
    );
  };

  /** Whether a log entry is grade-related and may have before/after values */
  const isGradeActivity = (activity: ActivityType): boolean =>
    activity === "grade_created" ||
    activity === "grade_updated" ||
    activity === "grade_deleted" ||
    activity === "grade_override" ||
    activity === "score_submitted" ||
    activity === "score_override";

  /** Render before/after diff inline for grade logs */
  const renderGradeDiff = (before?: GradeSnapshot, after?: GradeSnapshot) => {
    if (!before && !after) return null;

    const rows: {
      label: string;
      old?: string | number | boolean;
      new?: string | number | boolean;
    }[] = [];
    const keys: (keyof GradeSnapshot)[] = [
      "score",
      "max_score",
      "percentage",
      "letter_grade",
      "status",
      "is_final",
    ];

    for (const key of keys) {
      const bv = before?.[key];
      const av = after?.[key];
      if (bv !== undefined || av !== undefined) {
        if (bv !== av) {
          rows.push({ label: key.replace("_", " "), old: bv, new: av });
        }
      }
    }

    if (rows.length === 0)
      return <span className="text-xs text-muted-foreground">—</span>;

    return (
      <div className="space-y-0.5">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-1 text-xs">
            <span className="font-medium capitalize">{r.label}:</span>
            {r.old !== undefined && (
              <span className="line-through text-red-500">{String(r.old)}</span>
            )}
            {r.old !== undefined && r.new !== undefined && <span>→</span>}
            {r.new !== undefined && (
              <span className="text-green-600 font-medium">
                {String(r.new)}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  };

  /** Plain text version for CSV export */
  const formatDiffForExport = (
    before?: GradeSnapshot,
    after?: GradeSnapshot,
  ): string => {
    if (!before && !after) return "-";
    const parts: string[] = [];
    const keys: (keyof GradeSnapshot)[] = [
      "score",
      "max_score",
      "percentage",
      "letter_grade",
      "status",
      "is_final",
    ];
    for (const key of keys) {
      const bv = before?.[key];
      const av = after?.[key];
      if (bv !== undefined || av !== undefined) {
        if (bv !== av) {
          parts.push(`${key}: ${bv ?? "—"} → ${av ?? "—"}`);
        }
      }
    }
    return parts.length > 0 ? parts.join("; ") : "-";
  };

  const handleExport = () => {
    if (exportType === "csv") {
      downloadCsv();
    } else {
      downloadExcel();
    }
    setShowExportDialog(false);
  };

  const handleTplExport = () => {
    if (tplExportType === "csv") {
      downloadTplCsv();
    } else {
      downloadTplExcel();
    }
    setShowTplExportDialog(false);
  };

  const downloadTplCsv = () => {
    const toDate = (raw: string | Timestamp) =>
      raw instanceof Timestamp ? raw.toDate() : new Date(raw as string);

    const csv = [
      [
        "Created At",
        "Created By",
        "Template Name",
        "Exam Name",
        "Questions",
        "Class",
        "Exam Code",
      ],
      ...filteredTemplateLogs.map((t) => [
        toDate(t.createdAt).toLocaleString(),
        sanitizeForExport(t.createdByName ?? t.createdBy),
        sanitizeForExport(t.name),
        sanitizeForExport(t.examName ?? "-"),
        String(t.numQuestions),
        sanitizeForExport(t.className ?? "-"),
        sanitizeForExport(t.examCode ?? "-"),
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute(
      "download",
      `template-history-${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV download started");
  };

  const downloadTplExcel = () => {
    const toDate = (raw: string | Timestamp) =>
      raw instanceof Timestamp ? raw.toDate() : new Date(raw as string);

    const data = filteredTemplateLogs.map((t) => ({
      "Created At": toDate(t.createdAt).toLocaleString(),
      "Created By": sanitizeForExport(t.createdByName ?? t.createdBy),
      "Template Name": sanitizeForExport(t.name),
      "Exam Name": sanitizeForExport(t.examName ?? "-"),
      Questions: t.numQuestions,
      Class: sanitizeForExport(t.className ?? "-"),
      "Exam Code": sanitizeForExport(t.examCode ?? "-"),
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template History");
    XLSX.writeFile(
      workbook,
      `template-history-${new Date().toISOString().split("T")[0]}.xlsx`,
    );
    toast.success("Excel download started");
  };

  /** Sanitize string for CSV/Excel to prevent formula injection */
  const sanitizeForExport = (
    value: string | number | null | undefined,
  ): string => {
    if (value === null || value === undefined) return "-";
    const strValue = String(value);
    // If it starts with an executable formula character, prefix with single quote
    if (/^[=+\-@\t\r]/.test(strValue)) {
      return `'${strValue}`;
    }
    return strValue;
  };

  const downloadCsv = () => {
    const csv = [
      [
        "Timestamp",
        "Admin",
        "Activity",
        "Description",
        "Status",
        "File",
        "File Size",
        "Changes",
        "Error",
      ],
      ...filteredLogs.map((log) => [
        new Date(log.timestamp).toLocaleString(),
        sanitizeForExport(log.adminEmail),
        log.activity,
        sanitizeForExport(log.description),
        log.status,
        sanitizeForExport(log.fileName) || "-",
        log.fileSize ? `${(log.fileSize / 1024).toFixed(2)} KB` : "-",
        sanitizeForExport(
          formatDiffForExport(log.beforeValues, log.afterValues),
        ),
        sanitizeForExport(log.errorMessage) || "-",
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `audit-logs-${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV download started");
  };

  const downloadExcel = () => {
    const data = filteredLogs.map((log) => ({
      Timestamp: new Date(log.timestamp).toLocaleString(),
      Admin: sanitizeForExport(log.adminEmail),
      Activity: log.activity,
      Description: sanitizeForExport(log.description),
      Status: log.status,
      File: sanitizeForExport(log.fileName) || "-",
      "File Size": log.fileSize
        ? `${(log.fileSize / 1024).toFixed(2)} KB`
        : "-",
      Changes: sanitizeForExport(
        formatDiffForExport(log.beforeValues, log.afterValues),
      ),
      Error: sanitizeForExport(log.errorMessage) || "-",
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Audit Logs");

    XLSX.writeFile(
      workbook,
      `audit-logs-${new Date().toISOString().split("T")[0]}.xlsx`,
    );
    toast.success("Excel download started");
  };

  /** Render metadata details for non-grade activities */
  const renderMetadataDetails = (log: AuditLog) => {
    if (isGradeActivity(log.activity))
      return renderGradeDiff(log.beforeValues, log.afterValues);

    const metadata = log.metadata;
    if (!metadata)
      return <span className="text-xs text-muted-foreground">—</span>;

    const items: { label: string; value: any }[] = [];

    if (metadata.actionType)
      items.push({
        label: "Action",
        value: String(metadata.actionType).replace("_", " "),
      });
    if (metadata.totalRecords)
      items.push({ label: "Total", value: metadata.totalRecords });
    if (metadata.successfulRecords !== undefined)
      items.push({ label: "Success", value: metadata.successfulRecords });
    if (metadata.failedRecords !== undefined)
      items.push({ label: "Failed", value: metadata.failedRecords });
    if (metadata.errorCount)
      items.push({ label: "Errors", value: metadata.errorCount });
    if (metadata.isBulk) items.push({ label: "Type", value: "Bulk" });
    if (metadata.recordsChecked)
      items.push({ label: "Checked", value: metadata.recordsChecked });

    if (items.length === 0)
      return <span className="text-xs text-muted-foreground">—</span>;

    return (
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        {items.map((item, idx) => (
          <div
            key={idx}
            className="flex items-center gap-1 text-[10px] bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100"
          >
            <span className="font-medium text-slate-500 uppercase tracking-tight">
              {item.label}:
            </span>
            <span className="text-slate-700 font-bold">{item.value}</span>
          </div>
        ))}
      </div>
    );
  };

  if (!user) {
    return (
      <div className="p-8">
        <Alert
          variant="destructive"
          className="max-w-2xl mx-auto shadow-lg animate-in fade-in slide-in-from-top-4"
        >
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You must be logged in with administrative privileges to view audit
            logs.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Template and Log History
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Monitor all upload, administrative, and grade modification
            activities
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          {
            label: "Total Activities",
            value: logs.length,
            icon: Activity,
            color: "blue",
          },
          {
            label: "Failed Actions",
            value: logs.filter((l) => l.status === "failed").length,
            icon: AlertCircle,
            color: "rose",
          },
          {
            label: "Student Imports",
            value: logs.filter((l) => l.activity === "student_import").length,
            icon: FileText,
            color: "indigo",
          },
          {
            label: "Templates Generated",
            value: templateLogs.length,
            icon: BarChart3,
            color: "amber",
          },
        ].map((stat, idx) => (
          <Card key={idx} className="border-none shadow-sm">
            <CardContent className="p-4 flex items-center gap-4">
              <div className={`p-2.5 rounded-xl bg-slate-50 text-slate-600`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {stat.label}
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {stat.value}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "activity" | "templates")}
      >
        <div className="flex items-center justify-between mb-4">
          <TabsList className="bg-gray-100">
            <TabsTrigger value="activity" className="data-[state=active]:bg-green-600 data-[state=active]:text-white">Activity Log</TabsTrigger>
            <TabsTrigger value="templates" className="data-[state=active]:bg-green-600 data-[state=active]:text-white">Template History</TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            {activeTab === "activity" && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setShowExportDialog(true)}
              >
                <Download className="w-4 h-4" />
                Export
              </Button>
            )}
            {activeTab === "templates" && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setShowTplExportDialog(true)}
                disabled={filteredTemplateLogs.length === 0}
              >
                <Download className="w-4 h-4" />
                Export History
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={loadLogs}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCcw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        </div>

        {/* ── Activity Log Tab ── */}
        <TabsContent value="activity">
          {/* Filters */}
          <Card className="mb-6 shadow-sm">
            <CardContent className="py-4">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search logs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <Select
                  value={selectedActivity}
                  onValueChange={(value) =>
                    setSelectedActivity(value as ActivityType | "all")
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Activity Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Everywhere</SelectItem>
                    {ACTIVITY_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type.replace("_", " ").toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={selectedStatus}
                  onValueChange={(value) =>
                    setSelectedStatus(
                      value as "all" | "success" | "failed" | "pending",
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Execution Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={selectedReviewer}
                  onValueChange={setSelectedReviewer}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Reviewer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Reviewer</SelectItem>
                    {uniqueReviewers.map((reviewer) => (
                      <SelectItem key={reviewer} value={reviewer}>
                        {reviewer}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="w-full"
                    title="Filter Date"
                  />
                </div>

                <Button
                  variant="ghost"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedActivity("all");
                    setSelectedStatus("all");
                    setSelectedReviewer("all");
                    setDateFilter("");
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Clear filters
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card className="table-container overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-table-header hover:bg-table-header">
                    <TableHead className="w-[180px]">Timestamp</TableHead>
                    <TableHead>Administrator</TableHead>
                    <TableHead>Activity</TableHead>
                    <TableHead className="w-[30%]">Details</TableHead>
                    <TableHead>Metadata</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          Loading activities...
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredLogs.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-12 text-muted-foreground"
                      >
                        No activities found matching filters
                      </TableCell>
                    </TableRow>
                  ) : (
                    currentLogs.map((log) => (
                      <TableRow
                        key={log.id}
                        className="hover:bg-table-row-hover"
                      >
                        <TableCell className="text-sm">
                          <div className="font-medium">
                            {new Date(log.timestamp).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className="text-sm font-medium break-all line-clamp-2 max-w-[200px]"
                            title={log.adminEmail}
                          >
                            {log.adminEmail}
                          </span>
                        </TableCell>
                        <TableCell>{getActivityBadge(log.activity)}</TableCell>
                        <TableCell>
                          <div className="space-y-1 max-w-[300px]">
                            <p
                              className="text-sm font-medium leading-tight break-words line-clamp-3"
                              title={log.description}
                            >
                              {log.description}
                            </p>
                            {(log.fileName || log.entityName) && (
                              <div
                                className="flex items-start gap-1.5 text-xs text-muted-foreground mt-1"
                                title={log.fileName || log.entityName}
                              >
                                <FileText className="w-3 h-3 mt-0.5 shrink-0" />
                                <span className="break-all line-clamp-2">
                                  {log.fileName || log.entityName}
                                </span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{renderMetadataDetails(log)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {getStatusIcon(log.status)}
                            <span className="text-sm font-medium capitalize">
                              {log.status}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {!loading && filteredLogs.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-slate-100 bg-white gap-4">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="text-sm text-muted-foreground font-medium whitespace-nowrap">
                    Showing{" "}
                    <span className="text-foreground">
                      {(currentPage - 1) * itemsPerPage + 1}
                    </span>{" "}
                    to{" "}
                    <span className="text-foreground">
                      {Math.min(
                        currentPage * itemsPerPage,
                        filteredLogs.length,
                      )}
                    </span>{" "}
                    of{" "}
                    <span className="text-foreground">
                      {filteredLogs.length}
                    </span>{" "}
                    results
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      Show:
                    </span>
                    <Select
                      value={String(itemsPerPage)}
                      onValueChange={(value) => {
                        setItemsPerPage(Number(value));
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="h-8 w-[70px] text-xs">
                        <SelectValue placeholder={String(itemsPerPage)} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="h-9 w-9 p-0 rounded-lg hover:bg-[#B38B00]/10 hover:text-[#166534] hover:border-[#B38B00] transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }

                      return (
                        <Button
                          key={pageNum}
                          variant={
                            currentPage === pageNum ? "default" : "outline"
                          }
                          size="sm"
                          onClick={() => handlePageChange(pageNum)}
                          className={`h-9 w-9 p-0 rounded-lg transition-all ${
                            currentPage === pageNum
                              ? "bg-[#166534] hover:bg-[#1a7a3e] text-white shadow-sm"
                              : "hover:bg-[#B38B00]/10 hover:text-[#166534] hover:border-[#B38B00]"
                          }`}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="h-9 w-9 p-0 rounded-lg hover:bg-[#B38B00]/10 hover:text-[#166534] hover:border-[#B38B00] transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>
        {/* end Activity Log tab */}

        {/* ── Template History Tab ── */}
        <TabsContent value="templates">
          {/* Filters */}
          <Card className="mb-6 shadow-sm">
            <CardContent className="py-4">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search template, exam, class..."
                    value={tplSearch}
                    onChange={(e) => setTplSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <Select value={tplUserFilter} onValueChange={setTplUserFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Generated By" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    {uniqueTplUsers.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  type="date"
                  value={tplDateFilter}
                  onChange={(e) => setTplDateFilter(e.target.value)}
                  className="w-full"
                  title="Filter by date"
                />

                <Button
                  variant="ghost"
                  onClick={() => {
                    setTplSearch("");
                    setTplUserFilter("all");
                    setTplDateFilter("");
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Clear filters
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card className="table-container overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-table-header hover:bg-table-header">
                    <TableHead className="w-[180px]">Date &amp; Time</TableHead>
                    <TableHead>Generated By</TableHead>
                    <TableHead>Template Name</TableHead>
                    <TableHead>Exam</TableHead>
                    <TableHead className="text-center">Questions</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Exam Code</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tplLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          Loading template history...
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredTemplateLogs.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center py-12 text-muted-foreground"
                      >
                        {tplSearch || tplUserFilter !== "all" || tplDateFilter
                          ? "No templates found matching your filters"
                          : "No templates have been generated yet"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    currentTplLogs.map((t) => {
                      const toDate = (raw: string | Timestamp) =>
                        raw instanceof Timestamp
                          ? raw.toDate()
                          : new Date(raw as string);
                      const dateObj = toDate(t.createdAt);

                      return (
                        <TableRow
                          key={t.id}
                          className="hover:bg-table-row-hover"
                        >
                          <TableCell className="text-sm">
                            <div className="font-medium">
                              {dateObj.toLocaleDateString()}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {dateObj.toLocaleTimeString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span
                              className="text-sm font-medium break-all line-clamp-2 max-w-[180px]"
                              title={t.createdByName}
                            >
                              {t.createdByName}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-semibold">
                              {t.name || "—"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{t.examName ?? "—"}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className="bg-blue-50 text-blue-700 border-blue-200"
                            >
                              {t.numQuestions} Q
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {t.className ?? "—"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs font-mono text-muted-foreground">
                              {t.examCode ?? "—"}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {!tplLoading && filteredTemplateLogs.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-slate-100 bg-white gap-4">
                <div className="flex items-center gap-4">
                  <div className="text-sm text-muted-foreground font-medium whitespace-nowrap">
                    Showing{" "}
                    <span className="text-foreground">
                      {(tplPage - 1) * tplPerPage + 1}
                    </span>{" "}
                    to{" "}
                    <span className="text-foreground">
                      {Math.min(
                        tplPage * tplPerPage,
                        filteredTemplateLogs.length,
                      )}
                    </span>{" "}
                    of{" "}
                    <span className="text-foreground">
                      {filteredTemplateLogs.length}
                    </span>{" "}
                    results
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Show:</span>
                    <Select
                      value={String(tplPerPage)}
                      onValueChange={(value) => {
                        setTplPerPage(Number(value));
                        setTplPage(1);
                      }}
                    >
                      <SelectTrigger className="h-8 w-[70px] text-xs">
                        <SelectValue placeholder={String(tplPerPage)} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTplPageChange(tplPage - 1)}
                    disabled={tplPage === 1}
                    className="h-9 w-9 p-0 rounded-lg hover:bg-[#B38B00]/10 hover:text-[#166534] hover:border-[#B38B00] transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from(
                      { length: Math.min(5, tplTotalPages) },
                      (_, i) => {
                        let pageNum: number;
                        if (tplTotalPages <= 5) pageNum = i + 1;
                        else if (tplPage <= 3) pageNum = i + 1;
                        else if (tplPage >= tplTotalPages - 2)
                          pageNum = tplTotalPages - 4 + i;
                        else pageNum = tplPage - 2 + i;
                        return (
                          <Button
                            key={pageNum}
                            variant={
                              tplPage === pageNum ? "default" : "outline"
                            }
                            size="sm"
                            onClick={() => handleTplPageChange(pageNum)}
                            className={`h-9 w-9 p-0 rounded-lg transition-all ${
                              tplPage === pageNum
                                ? "bg-[#166534] hover:bg-[#1a7a3e] text-white shadow-sm"
                                : "hover:bg-[#B38B00]/10 hover:text-[#166534] hover:border-[#B38B00]"
                            }`}
                          >
                            {pageNum}
                          </Button>
                        );
                      },
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTplPageChange(tplPage + 1)}
                    disabled={tplPage === tplTotalPages}
                    className="h-9 w-9 p-0 rounded-lg hover:bg-[#B38B00]/10 hover:text-[#166534] hover:border-[#B38B00] transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>
        {/* end Template History tab */}
      </Tabs>

      {/* Activity Log Export Dialog */}
      <AlertDialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Export Audit Logs</AlertDialogTitle>
            <AlertDialogDescription>
              Choose your preferred format to download the audit trail. This
              will export {filteredLogs.length} current matching entries.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <button
              onClick={() => setExportType("xlsx")}
              className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                exportType === "xlsx"
                  ? "border-primary bg-primary/5"
                  : "border-slate-100 hover:border-slate-200"
              }`}
            >
              <FileSpreadsheet
                className={`w-8 h-8 ${exportType === "xlsx" ? "text-primary" : "text-slate-400"}`}
              />
              <span className="text-sm font-bold">Excel (.xlsx)</span>
            </button>
            <button
              onClick={() => setExportType("csv")}
              className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                exportType === "csv"
                  ? "border-primary bg-primary/5"
                  : "border-slate-100 hover:border-slate-200"
              }`}
            >
              <FileText
                className={`w-8 h-8 ${exportType === "csv" ? "text-primary" : "text-slate-400"}`}
              />
              <span className="text-sm font-bold">CSV (.csv)</span>
            </button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExport}
              className="gradient-primary"
            >
              Download File
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Template History Export Dialog */}
      <AlertDialog
        open={showTplExportDialog}
        onOpenChange={setShowTplExportDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Export Template History</AlertDialogTitle>
            <AlertDialogDescription>
              Choose your preferred format to download the template history.
              This will export {filteredTemplateLogs.length} current matching
              entries.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <button
              onClick={() => setTplExportType("xlsx")}
              className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                tplExportType === "xlsx"
                  ? "border-primary bg-primary/5"
                  : "border-slate-100 hover:border-slate-200"
              }`}
            >
              <FileSpreadsheet
                className={`w-8 h-8 ${tplExportType === "xlsx" ? "text-primary" : "text-slate-400"}`}
              />
              <span className="text-sm font-bold">Excel (.xlsx)</span>
            </button>
            <button
              onClick={() => setTplExportType("csv")}
              className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                tplExportType === "csv"
                  ? "border-primary bg-primary/5"
                  : "border-slate-100 hover:border-slate-200"
              }`}
            >
              <FileText
                className={`w-8 h-8 ${tplExportType === "csv" ? "text-primary" : "text-slate-400"}`}
              />
              <span className="text-sm font-bold">CSV (.csv)</span>
            </button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleTplExport}
              className="gradient-primary"
            >
              Download File
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
