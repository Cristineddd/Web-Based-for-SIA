"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import {
  RotateCcw,
  Trash2,
  Users,
  Book,
  Calendar,
  AlertCircle,
  Loader2,
  Archive as ArchiveIcon,
  Layers,
  FileText,
  GraduationCap,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  getArchivedClasses,
  updateClass,
  deleteClass,
} from "@/services/classService";
import {
  getArchivedExams,
  updateExam,
  deleteExam,
} from "@/services/examService";
import {
  ReportHistoryService,
  type ReportHistoryEntry,
} from "@/services/reportHistoryService";
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

type ArchivedItem = {
  id: string;
  name: string;
  type: "class" | "exam";
  archivedAt?: string;
  code?: string; // BSBIO or similar
  subjectLabel: string; // Biology
  detail1: string; // 5 Students or 20 Items
  year?: string;
};

export default function Archive() {
  const { user } = useAuth();
  const [items, setItems] = useState<ArchivedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteType, setDeleteType] = useState<
    "class" | "exam" | "report" | null
  >(null);
  const [restoreId, setRestoreId] = useState<string | null>(null);
  const [restoreType, setRestoreType] = useState<"class" | "exam" | null>(null);
  const [reports, setReports] = useState<ReportHistoryEntry[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;
      try {
        setLoading(true);
        const [archivedClasses, archivedExams, reportLogs] = await Promise.all([
          getArchivedClasses(user.id),
          getArchivedExams(user.id),
          ReportHistoryService.queryReports({
            instructorId: user.id,
            pageSize: 50,
          }),
        ]);

        const combinedItems: ArchivedItem[] = [
          ...archivedClasses.map((c) => ({
            id: c.id,
            name: c.class_name,
            type: "class" as const,
            archivedAt: (c as any).archivedAt || c.created_at,
            code: c.course_subject, // BSBIO
            subjectLabel: c.course_subject || "General",
            detail1: `${c.students?.length || 0} Students`,
            year: c.year ? `${c.year} Year` : undefined,
          })),
          ...archivedExams.map((e) => ({
            id: e.id,
            name: e.title,
            type: "exam" as const,
            archivedAt: e.archivedAt || e.created_at,
            code: e.subject,
            subjectLabel: e.subject || "No Subject",
            detail1: `${e.num_items} Items`,
          })),
        ];

        setItems(combinedItems);
        setReports(reportLogs.entries);
      } catch (error) {
        console.error("Error fetching archive data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user?.id]);

  const handleDelete = async () => {
    if (!deleteId || !deleteType) return;
    try {
      if (deleteType === "class") await deleteClass(deleteId);
      else if (deleteType === "exam") await deleteExam(deleteId);
      else if (deleteType === "report")
        await ReportHistoryService.deleteReport(deleteId);

      if (deleteType === "report") {
        setReports(reports.filter((r) => r.id !== deleteId));
      } else {
        setItems(items.filter((i) => i.id !== deleteId));
      }
      toast.success("Permanently deleted successfully", { position: "top-right" });
    } catch (error) {
      toast.error("Failed to delete item", { position: "top-right" });
    } finally {
      setDeleteId(null);
      setDeleteType(null);
    }
  };

  const handleRestore = async () => {
    if (!restoreId || !restoreType) return;
    try {
      if (restoreType === "class")
        await updateClass(restoreId, { isArchived: false });
      else await updateExam(restoreId, { isArchived: false });

      setItems(items.filter((i) => i.id !== restoreId));
      toast.success("Restored successfully", { position: "top-right" });
    } catch (error) {
      toast.error("Failed to restore item", { position: "top-right" });
    } finally {
      setRestoreId(null);
      setRestoreType(null);
    }
  };

  return (
    <div className="page-container">
      {/* Header matches screenshot 2 */}
      <div className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
          Archive
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          View, restore, or permanently delete past classes.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-green-600" />
        </div>
      ) : (items.length === 0 && reports.length === 0) ? (
        /* Empty State */
        <div className="w-full h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-[#E2E8F0] rounded-xl bg-white/50">
          <div className="w-12 h-12 bg-[#F1F5F9] rounded-lg flex items-center justify-center mb-6">
            <ArchiveIcon className="w-6 h-6 text-[#94A3B8]" />
          </div>
          <h2 className="text-[16px] font-bold text-[#334155] mb-2">
            Archive is empty
          </h2>
          <p className="text-[#64748B] text-center max-w-sm text-[13px] leading-relaxed">
            Archived classes and exams will appear here. You can restore them or
            permanently delete them.
          </p>
        </div>
      ) : (
        <div className="space-y-12 mt-10">
          {/* Archived Classes Section */}
          {items.filter(i => i.type === 'class').length > 0 && (
            <section className="space-y-6">
              <div className="flex items-center gap-2 px-1">
                <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                  <GraduationCap className="w-4 h-4 text-[#10B981]" />
                </div>
                <h2 className="text-lg font-bold text-gray-800">Archived Classes</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {items.filter(i => i.type === 'class').map((item) => (
                  <Card
                    key={item.id}
                    className="group bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 flex flex-col"
                  >
                    <div className="p-6 flex-1 space-y-4">
                      <div className="flex items-start justify-between">
                         <div className="space-y-1">
                            <h3 className="text-[16px] font-bold text-[#1E293B] line-clamp-1">{item.name}</h3>
                            <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">{item.code}</p>
                         </div>
                         {item.year && (
                          <span className="text-[10px] font-bold text-[#64748B] bg-[#F1F5F9] px-2 py-0.5 rounded-lg uppercase">
                            {item.year}
                          </span>
                        )}
                      </div>

                      <div className="h-[2px] w-full bg-gray-50 rounded-full overflow-hidden">
                        <div className="h-full bg-[#10B981]/40 w-[100%]" />
                      </div>

                      <div className="space-y-3 pt-1">
                        <div className="flex items-center gap-3 text-[#64748B]">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-xs">
                            Archived <span className="font-semibold text-gray-700">{item.archivedAt ? new Date(item.archivedAt).toLocaleDateString() : 'N/A'}</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[#64748B]">
                          <Users className="w-4 h-4 text-gray-400" />
                          <span className="text-xs font-medium">{item.detail1}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[#64748B]">
                          <Book className="w-4 h-4 text-gray-400" />
                          <span className="text-xs font-medium">{item.subjectLabel}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="px-6 py-4 bg-gray-50/50 border-t border-[#F1F5F9] flex items-center justify-between gap-3">
                      <Button
                        onClick={() => { setRestoreId(item.id); setRestoreType(item.type); }}
                        variant="outline"
                        className="flex-1 h-9 rounded-xl border-[#10B981]/20 bg-white text-[#10B981] hover:bg-[#10B981] hover:text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Restore
                      </Button>
                      <Button
                        onClick={() => { setDeleteId(item.id); setDeleteType(item.type); }}
                        variant="ghost"
                        className="px-3 h-9 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 text-xs font-bold transition-all flex items-center justify-center"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* Archived Exams Section */}
          {items.filter(i => i.type === 'exam').length > 0 && (
            <section className="space-y-6">
              <div className="flex items-center gap-2 px-1">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-blue-600" />
                </div>
                <h2 className="text-lg font-bold text-gray-800">Archived Exams</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {items.filter(i => i.type === 'exam').map((item) => (
                  <Card
                    key={item.id}
                    className="group bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 flex flex-col"
                  >
                    <div className="p-6 flex-1 space-y-4">
                      <div className="flex items-start justify-between">
                         <div className="space-y-1">
                            <h3 className="text-[16px] font-bold text-[#1E293B] line-clamp-1">{item.name}</h3>
                            <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">{item.subjectLabel}</p>
                         </div>
                         <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                            <Layers className="w-4 h-4 text-blue-400" />
                         </div>
                      </div>

                      <div className="h-[2px] w-full bg-gray-50 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-400/40 w-[100%]" />
                      </div>

                      <div className="space-y-3 pt-1">
                        <div className="flex items-center gap-3 text-[#64748B]">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-xs">
                            Archived <span className="font-semibold text-gray-700">{item.archivedAt ? new Date(item.archivedAt).toLocaleDateString() : 'N/A'}</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[#64748B]">
                          <AlertCircle className="w-4 h-4 text-gray-400" />
                          <span className="text-xs font-bold text-gray-600 bg-blue-50/50 px-2 py-0.5 rounded border border-blue-100/50">{item.detail1}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[#64748B]">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                          <span className="text-xs font-mono font-bold text-gray-400 tracking-tighter">{item.code || "NO-CODE"}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="px-6 py-4 bg-gray-50/50 border-t border-[#F1F5F9] flex items-center justify-between gap-3">
                      <Button
                        onClick={() => { setRestoreId(item.id); setRestoreType(item.type); }}
                        variant="outline"
                        className="flex-1 h-9 rounded-xl border-blue-200 bg-white text-blue-600 hover:bg-blue-600 hover:text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Restore
                      </Button>
                      <Button
                        onClick={() => { setDeleteId(item.id); setDeleteType(item.type); }}
                        variant="ghost"
                        className="px-3 h-9 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 text-xs font-bold transition-all flex items-center justify-center"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* Report History Section */}
          {reports.length > 0 && (
            <section className="space-y-6">
              <div className="flex items-center gap-2 px-1">
                <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
                  <RotateCcw className="w-4 h-4 text-orange-500" />
                </div>
                <h2 className="text-lg font-bold text-gray-800">Report History</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {reports.map((report) => (
                  <Card
                    key={report.id}
                    className="group bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 flex flex-col"
                  >
                    <div className="p-6 flex-1 space-y-4">
                      <div className="flex items-start justify-between">
                         <div className="space-y-1">
                            <h3 className="text-[15px] font-bold text-[#1E293B] line-clamp-2 leading-tight">{report.title}</h3>
                            <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">{report.reportType.replace('-', ' ')}</p>
                         </div>
                         <div className="px-2 py-0.5 rounded bg-gray-100 text-[9px] font-bold text-gray-500 border border-gray-200 uppercase">
                            {report.format}
                         </div>
                      </div>

                      <div className="space-y-3 pt-1">
                        <div className="flex items-center gap-3 text-[#64748B]">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-xs">
                            Generated <span className="font-semibold text-gray-700">{report.createdAt ? report.createdAt.toDate().toLocaleDateString() : 'N/A'}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="px-6 py-4 bg-gray-50/50 border-t border-[#F1F5F9] flex items-center justify-end">
                      <Button
                        onClick={() => { setDeleteId(report.id!); setDeleteType('report'); }}
                        variant="ghost"
                        className="px-3 h-8 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 text-xs font-bold transition-all flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remove Log
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </div>
      )
}

      {/* Warning Modal requirement */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={() => {
          setDeleteId(null);
          setDeleteType(null);
        }}
      >
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Permanently</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this {deleteType}?{" "}
              <span className="font-bold text-[#EF4444]">
                This action cannot be undone.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white rounded-lg"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!restoreId}
        onOpenChange={() => {
          setRestoreId(null);
          setRestoreType(null);
        }}
      >
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to restore this {restoreType} to your active
              lists?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRestore}
              className="bg-[#10B981] hover:bg-[#059669] text-white rounded-lg"
            >
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
