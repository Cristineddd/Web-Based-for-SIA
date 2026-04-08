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
  FolderArchive,
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
  Class 
} from "@/services/classService";
import { 
  getArchivedExams, 
  updateExam, 
  deleteExam, 
  Exam 
} from "@/services/examService";
import { AuditLogger } from "@/services/auditLogger";
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
import { cn } from "@/lib/utils";

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
  const [deleteType, setDeleteType] = useState<"class" | "exam" | null>(null);
  const [restoreId, setRestoreId] = useState<string | null>(null);
  const [restoreType, setRestoreType] = useState<"class" | "exam" | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;
      try {
        setLoading(true);
        const [archivedClasses, archivedExams] = await Promise.all([
          getArchivedClasses(user.id),
          getArchivedExams(user.id),
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
      else await deleteExam(deleteId);
      
      setItems(items.filter((i) => i.id !== deleteId));
      toast.success("Permanently deleted successfully");
    } catch (error) {
      toast.error("Failed to delete item");
    } finally {
      setDeleteId(null);
      setDeleteType(null);
    }
  };

  const handleRestore = async () => {
    if (!restoreId || !restoreType) return;
    try {
      if (restoreType === "class") await updateClass(restoreId, { isArchived: false });
      else await updateExam(restoreId, { isArchived: false });
      
      setItems(items.filter((i) => i.id !== restoreId));
      toast.success("Restored successfully");
    } catch (error) {
      toast.error("Failed to restore item");
    } finally {
      setRestoreId(null);
      setRestoreType(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] p-8 space-y-8">
      {/* Header matches screenshot 2 */}
      <div className="space-y-1">
        <h1 className="text-[20px] font-bold text-[#1E293B]">Archive</h1>
        <p className="text-[13px] text-[#64748B]">View, restore, or permanently delete past classes.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-green-600" />
        </div>
      ) : items.length === 0 ? (
        /* Empty State exactly from screenshot 2 */
        <div className="w-full h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-[#E2E8F0] rounded-xl bg-white/50">
          <div className="w-12 h-12 bg-[#F1F5F9] rounded-lg flex items-center justify-center mb-6">
            <FolderArchive className="w-6 h-6 text-[#94A3B8]" />
          </div>
          <h2 className="text-[16px] font-bold text-[#334155] mb-2">Archive is empty</h2>
          <p className="text-[#64748B] text-center max-w-sm text-[13px] leading-relaxed">
            Classes you archive will appear here. You can restore them or permanently delete them.
          </p>
        </div>
      ) : (
        /* Grid matches screenshot 3 */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => (
            <Card key={`${item.type}-${item.id}`} className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-sm flex flex-col">
              <div className="p-6 flex-1 space-y-4">
                {/* 1. Item Name & Year Badge */}
                <div className="flex items-start justify-between">
                  <h3 className="text-[15px] font-bold text-[#1E293B] flex-1 pr-4">{item.name}</h3>
                  {item.year && (
                    <span className="text-[10px] font-bold text-[#64748B] bg-[#F1F5F9] px-2 py-0.5 rounded uppercase">
                      {item.year}
                    </span>
                  )}
                </div>

                {/* Sub-header text (BSBIO etc) */}
                <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider">{item.code}</p>

                {/* Aesthetic Progress Bar */}
                <div className="h-[3px] w-full bg-[#F1F5F9] rounded-full overflow-hidden mt-2">
                  <div className="h-full bg-[#10B981] rounded-full w-[100%]" />
                </div>

                {/* Checklist Requirement: Type (class/exam) · Date Archived */}
                <div className="space-y-3.5 pt-1">
                  {/* 2. Type (class/exam) Icon & Label */}
                  <div className="flex items-center gap-3 text-[#64748B]">
                    <Layers className="w-4 h-4 text-[#94A3B8]" strokeWidth={1.5} />
                    <span className="text-[13px] flex items-center gap-1.5">
                      Type: 
                      <span className="font-semibold text-[#1E293B] capitalize flex items-center gap-1">
                        {item.type === 'class' ? <GraduationCap className="w-3 h-3"/> : <FileText className="w-3 h-3"/> }
                        {item.type}
                      </span>
                    </span>
                  </div>

                  {/* 3. Date Archived Icon & Label */}
                  <div className="flex items-center gap-3 text-[#64748B]">
                    <Calendar className="w-4 h-4 text-[#94A3B8]" strokeWidth={1.5} />
                    <span className="text-[13px]">
                      Archived: <span className="font-semibold text-[#1E293B]">{item.archivedAt ? new Date(item.archivedAt).toLocaleDateString() : 'N/A'}</span>
                    </span>
                  </div>

                  {/* Additional Context from Screenshot (Subject and Detail) */}
                  <div className="flex items-center gap-3 text-[#64748B]">
                    <Book className="w-4 h-4 text-[#94A3B8]" strokeWidth={1.5} />
                    <span className="text-[13px]">{item.subjectLabel}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[#64748B]">
                    <Users className="w-4 h-4 text-[#94A3B8]" strokeWidth={1.5} />
                    <span className="text-[13px]">{item.detail1}</span>
                  </div>
                </div>
              </div>

              {/* Footer matches screenshot 3 */}
              <div className="px-6 py-4 bg-white border-t border-[#F1F5F9] flex items-center justify-between gap-4">
                <Button
                  onClick={() => { setRestoreId(item.id); setRestoreType(item.type); }}
                  variant="outline"
                  className="flex-1 h-9 rounded-lg border-[#10B981]/30 text-[#10B981] hover:bg-[#10B981]/5 hover:text-[#059669] text-[13px] font-semibold transition-all flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Restore
                </Button>
                <Button
                  onClick={() => { setDeleteId(item.id); setDeleteType(item.type); }}
                  variant="ghost"
                  className="px-3 h-9 text-[#64748B] hover:text-[#EF4444] hover:bg-[#FEF2F2] text-[13px] font-semibold transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Warning Modal requirement */}
      <AlertDialog open={!!deleteId} onOpenChange={() => { setDeleteId(null); setDeleteType(null); }}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Permanently</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this {deleteType}? <span className="font-bold text-[#EF4444]">This action cannot be undone.</span>
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

      <AlertDialog open={!!restoreId} onOpenChange={() => { setRestoreId(null); setRestoreType(null); }}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to restore this {restoreType} to your active lists?
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
