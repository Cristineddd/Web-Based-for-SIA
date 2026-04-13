"use client";

import { useEffect, useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
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
  Search,
  Plus,
  ArrowLeft,
  Users,
  FileText,
  BarChart3,
  Upload,
  Download,
  Pencil,
  Mail,
  ChevronRight,
  Loader2,
  Calendar,
  Tag,
  Scan,
} from "lucide-react";
import { Class } from "@/services/classService";
import { getExams, type Exam } from "@/services/examService";
import { cn } from "@/lib/utils";
import { CreateExamModal } from "@/components/modals/CreateExamModal";
import { useAuth } from "@/contexts/AuthContext";
import { createExam } from "@/services/examService";
import { toast } from "sonner";
import { AuditLogger } from "@/services/auditLogger";

interface ClassDetailViewProps {
  classItem: Class;
  onBack: () => void;
}

export default function ClassDetailView({
  classItem,
  onBack,
}: ClassDetailViewProps) {
  const [activeTab, setActiveTab] = useState("students");
  const [exams, setExams] = useState<Exam[]>([]);
  const [loadingExams, setLoadingExams] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [showCreateExam, setShowCreateExam] = useState(false);
  const [selectedScanExamId, setSelectedScanExamId] = useState<string>("");
  const { user } = useAuth();

  const handleCreateExam = async (formData: any) => {
    try {
      if (!user?.id || !user.instructorId) {
        toast.error(
          "You must be logged in with a valid instructor ID to create an exam",
        );
        return;
      }

      const newExam = await createExam(formData, user.id, user.instructorId);

      if (user.email) {
        AuditLogger.logActivity(
          user.id,
          user.email,
          "exam_created",
          `Created exam from class page: ${newExam.title}`,
          {
            entityId: newExam.id,
            entityName: newExam.title,
            entityType: "exam",
          },
        ).catch(console.error);
      }

      setExams((prev) => [newExam, ...prev]);
      toast.success(`Exam "${formData.name}" created successfully`);
      setShowCreateExam(false);
    } catch (error) {
      console.error("Error creating exam:", error);
      toast.error("Failed to create exam");
    }
  };

  // Fetch exams for this class
  useEffect(() => {
    async function fetchExams() {
      if (!classItem.id) return;
      setLoadingExams(true);
      try {
        const allExams = await getExams(classItem.instructorId);
        // Filter exams tagged to this class
        const classExams = allExams.filter(
          (e) =>
            e.classId === classItem.id || e.className === classItem.class_name,
        );
        setExams(classExams);
      } catch (error) {
        console.error("Error fetching exams for class:", error);
      } finally {
        setLoadingExams(false);
      }
    }
    fetchExams();
  }, [classItem.id, classItem.instructorId, classItem.class_name]);

  const handleExportRoster = () => {
    const students = classItem.students || [];
    if (students.length === 0) {
      toast.error("No students to export");
      return;
    }
    try {
      const headers = ["Student ID", "First Name", "Last Name", "Email"];
      const rows = students.map((s) => [
        `"${s.student_id || ""}"`,
        `"${s.first_name || ""}"`,
        `"${s.last_name || ""}"`,
        `"${s.email || ""}"`,
      ]);
      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.setAttribute("download", `${classItem.class_name}_${classItem.course_subject}_roster.csv`);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${students.length} student(s) successfully`);
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Failed to export roster");
    }
  };

  const filteredStudents = useMemo(() => {
    return (classItem.students || []).filter(
      (s) =>
        s.first_name.toLowerCase().includes(studentSearch.toLowerCase()) ||
        s.last_name.toLowerCase().includes(studentSearch.toLowerCase()) ||
        s.student_id.includes(studentSearch),
    );
  }, [classItem.students, studentSearch]);

  const tabs = [
    {
      id: "students",
      label: `Students (${classItem.students?.length || 0})`,
      icon: Users,
    },
    { id: "exams", label: `Exams (${exams.length})`, icon: FileText },
    { id: "scan", label: "Scan Papers", icon: Scan },
    { id: "stats", label: "Stats", icon: BarChart3 },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header section matches screenshot 1 & 2 */}
      <div className="flex items-center gap-4 mb-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="rounded-full hover:bg-gray-100"
        >
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-[#1e293b]">
            {classItem.class_name} — {classItem.section_block}
          </h1>
          <p className="text-sm font-semibold text-gray-400">
            Class Details & Management
          </p>
        </div>
      </div>

      {/* Class Information Card — pure white, no inner tinted box */}
      <Card className="border border-gray-100 shadow-sm overflow-hidden rounded-xl bg-white">
        <div className="px-6 pt-6 pb-2">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[17px] font-bold text-[#1e293b]">
              Class Information
            </h2>
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-400 font-bold flex items-center gap-1.5 hover:bg-gray-50 hover:text-gray-600"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit Info
            </Button>
          </div>
        </div>

        <div className="px-6 pb-6">
          <div className="grid grid-cols-4 bg-white rounded-xl p-5 border border-gray-100">
            <div className="space-y-1.5 border-l-4 border-green-500 pl-4">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                Program
              </p>
              <p className="text-[15px] font-bold text-[#1e293b]">
                {classItem.class_name}
              </p>
            </div>
            <div className="space-y-1.5 border-l border-gray-100 pl-6">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                Course
              </p>
              <p className="text-[15px] font-bold text-[#1e293b] truncate">
                {classItem.course_subject}
              </p>
            </div>
            <div className="space-y-1.5 border-l border-gray-100 pl-6">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                Year Level
              </p>
              <p className="text-[15px] font-bold text-[#1e293b]">
                {classItem.year || "3rd Year"}
              </p>
            </div>
            <div className="space-y-1.5 border-l border-gray-100 pl-6">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                Room
              </p>
              <p className="text-[15px] font-bold text-[#1e293b]">
                {classItem.room || "—"}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs list matches screenshots */}
      <div className="flex items-center gap-6 border-b border-gray-100 px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 pb-4 text-[13px] font-bold transition-all relative whitespace-nowrap",
                isActive
                  ? "text-[#22c55e]"
                  : "text-gray-400 hover:text-gray-600",
              )}
            >
              <Icon
                className={cn(
                  "w-4 h-4",
                  isActive ? "text-[#22c55e]" : "text-gray-300",
                )}
                strokeWidth={2.5}
              />
              <span>{tab.label}</span>
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#22c55e] rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      <div className="mt-2 min-h-[500px]">
        {activeTab === "students" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="text-lg font-bold text-[#1e293b]">
                Student Roster
              </h3>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={handleExportRoster}
                  className="rounded-lg h-9 border-gray-200 text-gray-600 text-[13px] font-bold hover:bg-gray-50 flex items-center gap-2"
                >
                  <Download className="w-4 h-4 text-gray-400" />
                  Export
                </Button>
                <Button
                  variant="outline"
                  className="rounded-lg h-9 border-gray-200 text-gray-600 text-[13px] font-bold hover:bg-gray-50 flex items-center gap-2"
                >
                  <Upload className="w-4 h-4 text-gray-400" />
                  Import Excel
                </Button>
                <Button className="bg-[#10B981] hover:bg-[#059669] text-white rounded-lg h-9 text-[13px] font-bold flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Add Student
                </Button>
              </div>
            </div>

            <Card className="border border-gray-100 shadow-sm rounded-xl overflow-hidden bg-white">
              <div className="p-6">
                <div className="flex items-center justify-end mb-4">
                  <Button
                    variant="ghost"
                    className="text-[12px] font-bold text-[#64748B] hover:text-green-600 p-0 h-auto flex items-center gap-1.5 bg-transparent"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit Multiple Students
                  </Button>
                </div>

                <div className="relative mb-6">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
                  <Input
                    placeholder="Search by ID or name..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="pl-11 h-11 bg-white border-gray-100 rounded-xl text-sm"
                  />
                </div>

                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#f8fafc] border-none">
                      <TableHead className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-wider h-10">
                        Student ID{" "}
                        <ChevronRight className="w-2.5 h-2.5 inline rotate-90" />{" "}
                      </TableHead>
                      <TableHead className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-wider h-10">
                        First Name
                      </TableHead>
                      <TableHead className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-wider h-10">
                        Last Name
                      </TableHead>
                      <TableHead className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-wider h-10">
                        Middle Name
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.length > 0 ? (
                      filteredStudents.map((s) => (
                        <TableRow
                          key={s.student_id}
                          className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                        >
                          <TableCell className="text-[13px] font-medium text-[#475569]">
                            {s.student_id}
                          </TableCell>
                          <TableCell className="text-[13px] font-medium text-[#475569]">
                            {s.first_name}
                          </TableCell>
                          <TableCell className="text-[13px] font-medium text-[#475569]">
                            {s.last_name}
                          </TableCell>
                          <TableCell className="text-[13px] font-medium text-[#475569]">
                            -
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="h-64">
                          <div className="flex flex-col items-center justify-center text-gray-400">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                              <Users className="w-8 h-8 opacity-20" />
                            </div>
                            <p className="text-[15px] font-bold text-gray-300">
                              No students in this class yet.
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>
        )}

        {activeTab === "exams" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="text-lg font-bold text-[#1e293b]">
                Exams for this Class
              </h3>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <select className="appearance-none bg-white border border-gray-200 rounded-lg h-9 pl-4 pr-10 text-[13px] font-bold text-gray-600 focus:ring-0 focus:border-green-500 cursor-pointer">
                    <option>Tag Existing Exam...</option>
                  </select>
                  <ChevronRight className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 rotate-90" />
                </div>
                <Button
                  onClick={() => setShowCreateExam(true)}
                  className="bg-[#10B981] hover:bg-[#059669] text-white rounded-lg h-9 text-[13px] font-bold flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Create Exam
                </Button>
              </div>
            </div>

            {loadingExams ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-green-600" />
              </div>
            ) : exams.length === 0 ? (
              <Card className="border-2 border-dashed border-gray-100 p-16 text-center rounded-[2rem] bg-gray-50/20">
                <div className="w-16 h-16 bg-white shadow-sm border border-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <FileText className="w-8 h-8 text-gray-300" />
                </div>
                <h4 className="text-lg font-bold text-gray-700 mb-2">
                  No exams yet
                </h4>
                <p className="text-sm text-gray-400 max-w-xs mx-auto">
                  Create your first exam for this class to start tracking
                  results and performance.
                </p>
                <Button
                  onClick={() => setShowCreateExam(true)}
                  variant="link"
                  className="mt-4 text-[#10B981] font-bold"
                >
                  Start Creating
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {exams.map((exam) => (
                  <Card
                    key={exam.id}
                    className="bg-white border border-gray-100 shadow-sm rounded-[1.5rem] p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="space-y-1">
                        <h4 className="text-[17px] font-bold text-[#1e293b]">
                          {exam.title}
                        </h4>
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                          {exam.subject}
                        </p>
                      </div>
                      <span className="bg-green-50 text-green-600 px-3 py-1 rounded-full text-[10px] font-bold border border-green-100 lowercase">
                        {exam.num_items} items
                      </span>
                    </div>

                    <div className="space-y-3.5 pt-2">
                      <div className="flex items-center gap-2.5 text-[#64748b]">
                        <span className="w-4.5 h-4.5 rounded-md bg-gray-50 flex items-center justify-center text-[11px] font-bold text-[#94a3b8] italic">
                          #
                        </span>
                        <span className="text-[12px] font-medium tracking-tight text-[#94a3b8] font-mono">
                          {exam.examCode || "NO-CODE-1234"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 text-[#64748b]">
                        <Calendar
                          className="w-4 h-4 text-[#94a3b8]"
                          strokeWidth={1.5}
                        />
                        <span className="text-[12px] font-bold text-gray-400">
                          {new Date(exam.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 text-[#64748b] pt-1">
                        <Tag
                          className="w-4 h-4 text-[#94a3b8]"
                          strokeWidth={1.5}
                        />
                        <span className="text-[12px] font-bold text-gray-400">
                          Tagged to{" "}
                          <span className="text-[#1e293b]">1 class(es)</span>
                        </span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "scan" && (
          <div className="flex gap-6 animate-in slide-in-from-bottom-2 duration-700">
            {/* Left: Scan Settings Card */}
            <div className="w-[300px] shrink-0">
              <Card className="p-6 rounded-2xl border border-gray-100 shadow-sm bg-white h-fit">
                {/* Header */}
                <div className="flex items-center gap-3 mb-7">
                  <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center">
                    <Scan className="w-4.5 h-4.5 text-green-600" />
                  </div>
                  <h3 className="text-[16px] font-bold text-[#1e293b]">
                    Scan Settings
                  </h3>
                </div>

                <div className="space-y-5">
                  {/* Divider */}
                  <div className="h-px bg-gray-100" />

                  {/* Select Exam */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block">
                      Select Exam
                    </label>
                    <div className="relative">
                      <select
                        value={selectedScanExamId}
                        onChange={(e) => setSelectedScanExamId(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-xl h-11 px-4 text-[13px] font-semibold text-[#1e293b] focus:outline-none focus:border-green-500 cursor-pointer appearance-none pr-9 transition-all"
                      >
                        <option value="">-- Choose an exam --</option>
                        {exams.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.title}
                          </option>
                        ))}
                      </select>
                      <ChevronRight className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 rotate-90 pointer-events-none" />
                    </div>
                  </div>

                  {/* Start Button */}
                  <Button
                    disabled={!selectedScanExamId}
                    className={`w-full h-11 rounded-xl font-bold text-[14px] flex items-center justify-center gap-2 transition-all ${
                      selectedScanExamId
                        ? "bg-green-500 hover:bg-green-600 text-white shadow-md shadow-green-500/20"
                        : "bg-gray-100 text-gray-400 cursor-not-allowed"
                    }`}
                    onClick={() => {
                      window.location.href = `/exams/${selectedScanExamId}/scan-papers`;
                    }}
                  >
                    <Scan className="w-4 h-4" />
                    Start Scanning
                  </Button>

                  {/* Info note */}
                  {!selectedScanExamId && (
                    <p className="text-[11px] text-gray-400 text-center leading-relaxed">
                      Choose an exam above to enable scanning
                    </p>
                  )}
                </div>
              </Card>
            </div>

            {/* Right: Camera Preview */}
            <div className="flex-1 bg-[#0f1117] rounded-2xl relative min-h-[460px] flex flex-col items-center justify-center border border-gray-800 shadow-xl overflow-hidden">
              {/* Status bar */}
              <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                <div className="flex items-center gap-2 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[11px] font-bold text-white/70 uppercase tracking-widest">
                    No Input Detected
                  </span>
                </div>
                <div className="bg-black/40 backdrop-blur-sm rounded-full px-3 py-1.5">
                  <span className="text-[11px] font-bold text-white/40 uppercase tracking-widest">
                    Scanner Interface
                  </span>
                </div>
              </div>

              {/* Corner brackets */}
              <div className="relative w-[55%] aspect-[3/4] max-h-[320px]">
                {/* TL */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white/20 rounded-tl-lg" />
                {/* TR */}
                <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white/20 rounded-tr-lg" />
                {/* BL */}
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white/20 rounded-bl-lg" />
                {/* BR */}
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white/20 rounded-br-lg" />

                {/* Center content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center">
                    <Scan className="w-7 h-7 text-white/20" />
                  </div>
                  <div className="text-center space-y-1.5">
                    <p className="text-white/50 text-[13px] font-semibold">
                      Camera Preview
                    </p>
                    <p className="text-white/25 text-[11px] max-w-[200px] leading-relaxed">
                      Select an exam and click Start Scanning
                    </p>
                  </div>
                </div>
              </div>

              {/* Bottom label */}
              <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                <span className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">
                  GC Smart Check · Scanner
                </span>
              </div>
            </div>
          </div>
        )}

        {activeTab === "stats" && (
          <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-700">
            {/* Top Stat Cards matches screenshot 4 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="border border-gray-100 shadow-sm rounded-2xl bg-white p-6 pb-8 border-b-4 border-b-green-500/10">
                <p className="text-[13px] font-bold text-gray-400 uppercase tracking-widest mb-4">
                  Class Average
                </p>
                <p className="text-[34px] font-bold text-[#1e293b]">88%</p>
              </Card>
              <Card className="border border-gray-100 shadow-sm rounded-2xl bg-white p-6 pb-8 border-b-4 border-b-green-500/10">
                <p className="text-[13px] font-bold text-gray-400 uppercase tracking-widest mb-4">
                  Pass Rate
                </p>
                <p className="text-[34px] font-bold text-[#1e293b]">100 %</p>
              </Card>
              <Card className="border border-gray-100 shadow-sm rounded-2xl bg-white p-6 pb-8 border-b-4 border-b-green-500/10">
                <p className="text-[13px] font-bold text-gray-400 uppercase tracking-widest mb-4">
                  Total Scans
                </p>
                <p className="text-[34px] font-bold text-[#1e293b]">2</p>
              </Card>
            </div>

            <div className="flex justify-end">
              <Button
                variant="ghost"
                className="text-[13px] font-bold text-[#1e293b] hover:bg-gray-100 rounded-xl h-10 px-6 border border-gray-100 shadow-sm flex items-center gap-2.5 bg-white"
              >
                <Mail className="w-4.5 h-4.5 text-gray-400" />
                Send All Scores to Students
              </Button>
            </div>

            {/* Exam Breakdown Table matches screenshot 4 */}
            <Card className="border border-gray-100 shadow-sm rounded-2xl overflow-hidden bg-white">
              <div className="p-6">
                <h3 className="text-[15px] font-bold text-[#1e293b] mb-6">
                  Exam Breakdown
                </h3>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#f8fafc] border-none font-bold">
                      <TableHead className="text-[12px] font-bold text-[#94a3b8] h-11">
                        Exam Title
                      </TableHead>
                      <TableHead className="text-[12px] font-bold text-[#94a3b8] text-center h-11">
                        Papers Scanned
                      </TableHead>
                      <TableHead className="text-[12px] font-bold text-[#94a3b8] text-right h-11 pr-6">
                        Average Score
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="border-b border-gray-50 h-[60px] hover:bg-gray-50/50 transition-colors">
                      <TableCell className="text-[14px] font-bold text-[#1e293b]">
                        Midterm Exam
                      </TableCell>
                      <TableCell className="text-[14px] font-bold text-[#475569]/80 text-center">
                        2
                      </TableCell>
                      <TableCell className="text-[14px] font-bold text-[#10B981] text-right pr-6">
                        88 %
                      </TableCell>
                    </TableRow>
                    <TableRow className="border-b border-gray-50 h-[60px] hover:bg-gray-50/50 transition-colors">
                      <TableCell className="text-[14px] font-bold text-[#1e293b]">
                        Quiz 1
                      </TableCell>
                      <TableCell className="text-[14px] font-bold text-[#475569]/80 text-center">
                        0
                      </TableCell>
                      <TableCell className="text-[14px] font-bold text-[#475569]/80 text-right pr-6">
                        0 %
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Exam Creation Modal for integrated use */}
      {showCreateExam && (
        <CreateExamModal
          isOpen={showCreateExam}
          onClose={() => setShowCreateExam(false)}
          onCreateExam={handleCreateExam}
          existingExamTitles={exams.map((e) => e.title)}
          fromTemplate={{
            name: "",
            totalQuestions: 50,
            choicesPerItem: 5,
            description: "",
            classId: classItem.id,
            className: classItem.class_name,
            folder: classItem.course_subject,
          }}
          simpleMode={true}
        />
      )}
    </div>
  );
}
