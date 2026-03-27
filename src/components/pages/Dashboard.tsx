"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import {
  FileText,
  Users,
  BookOpen,
  Plus,
  TrendingUp,
  Clock,
  ChevronRight,
  Hash,
  CalendarDays,
  Tag,
} from "lucide-react";
import { CreateExamModal } from "@/components/modals/CreateExamModal";
import { toast } from "sonner";
import { createExam, type ExamFormData } from "@/services/examService";
import { getClasses, type Class } from "@/services/classService";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Define the Exam type
interface Exam {
  id: string;
  title: string;
  subject: string;
  num_items: number;
  created_at: string;
  generated_sheets?: Array<{
    sheet_count?: number;
  }>;
  [key: string]: any; // For other properties
}

interface ClassItem {
  id: string;
  class_name: string;
  course_subject: string;
  section_block?: string;
  year?: string;
  room?: string;
  students: any[];
}

interface DashboardStats {
  totalExams: number;
  totalStudents: number;
  totalClasses: number;
  averageScore: number;
  recentExams: Array<{
    id: string;
    title: string;
    subject: string;
    num_items: number;
    created_at: string;
    classCount?: number;
    examCode?: string;
  }>;
  recentClasses: ClassItem[];
}

export default function Dashboard() {
  const { userRole, user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    totalExams: 0,
    totalStudents: 0,
    totalClasses: 0,
    averageScore: 0,
    recentExams: [],
    recentClasses: [],
  });
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [classes, setClasses] = useState<Class[]>([]);
  const [showClassPicker, setShowClassPicker] = useState(false);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [classSearch, setClassSearch] = useState("");

  // Use ref to prevent double fetching
  const hasFetched = useRef(false);

  useEffect(() => {
    // Skip if no user ID or already fetched
    if (!user?.id || hasFetched.current) {
      if (!user?.id) setLoading(false);
      return;
    }

    // Mark as fetching immediately to prevent double fetch
    hasFetched.current = true;

    async function fetchStats() {
      try {
        // Fetch exams
        const examsRef = collection(db, "exams");
        const examsQuery = query(examsRef, where("createdBy", "==", user.id));
        let examsSnapshot: any;
        try {
          examsSnapshot = (await Promise.race([
            getDocs(examsQuery),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Query timeout")), 3000)
            ),
          ])) as any;
        } catch {
          setStats({ totalExams: 0, totalStudents: 0, totalClasses: 0, averageScore: 0, recentExams: [], recentClasses: [] });
          return;
        }

        const exams: Exam[] = examsSnapshot.docs
          .map((doc: any) => {
            const data = doc.data();
            return {
              id: doc.id,
              title: data.title || "",
              subject: data.subject || "",
              num_items: data.num_items || 0,
              created_at: data.created_at,
              generated_sheets: data.generated_sheets || [],
              isArchived: data.isArchived || false,
              examCode: data.examCode || data.id || doc.id,
            } as Exam;
          })
          .filter((exam: any) => !exam.isArchived);

        const totalExams = exams.length;
        const recentExams = exams
          .sort((a, b) => {
            const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return dateB - dateA;
          })
          .slice(0, 3);

        // Fetch classes
        let totalStudents = 0;
        let recentClasses: ClassItem[] = [];
        let totalClasses = 0;
        try {
          const classesRef = collection(db, "classes");
          const classesQuery = query(classesRef, where("createdBy", "==", user.id));
          const classesSnapshot = await getDocs(classesQuery);

          const classes = classesSnapshot.docs
            .map((doc) => {
              const data = doc.data();
              return {
                id: doc.id,
                class_name: data.class_name || "",
                course_subject: data.course_subject || "",
                section_block: data.section_block || "",
                year: data.year || "",
                room: data.room || "",
                students: data.students || [],
                isArchived: data.isArchived || false,
                created_at: data.created_at,
              };
            })
            .filter((c) => !c.isArchived);

          totalClasses = classes.length;
          totalStudents = classes.reduce((sum, c) => sum + (c.students?.length || 0), 0);
          recentClasses = classes
            .sort((a, b) => {
              const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
              const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
              return dateB - dateA;
            })
            .slice(0, 3) as ClassItem[];
        } catch (e) {
          console.warn("Could not fetch classes:", e);
        }

        // Fetch average score across all scanned results for this instructor's exams
        let averageScore = 0;
        try {
          if (exams.length > 0) {
            const examIds = exams.map((e) => e.id);
            // Query in batches of 10 (Firestore 'in' limit)
            const allScores: number[] = [];
            for (let i = 0; i < examIds.length; i += 10) {
              const batch = examIds.slice(i, i + 10);
              const scoresQuery = query(
                collection(db, "scanned_results"),
                where("examId", "in", batch),
                where("isNullId", "==", false)
              );
              const scoresSnap = await getDocs(scoresQuery);
              scoresSnap.docs.forEach((d) => {
                const s = d.data().score;
                if (typeof s === "number") allScores.push(s);
              });
            }
            if (allScores.length > 0) {
              const sum = allScores.reduce((a, b) => a + b, 0);
              averageScore = Math.round((sum / allScores.length) * 10) / 10;
            }
          }
        } catch (e) {
          console.warn("Could not fetch average score:", e);
        }

        setStats({
          totalExams,
          totalStudents,
          totalClasses,
          averageScore,
          recentExams: recentExams.map((exam) => ({
            id: exam.id,
            title: exam.title,
            subject: exam.subject,
            num_items: exam.num_items,
            created_at: exam.created_at,
            examCode: exam.examCode,
          })),
          recentClasses,
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
        setStats({ totalExams: 0, totalStudents: 0, totalClasses: 0, averageScore: 0, recentExams: [], recentClasses: [] });
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [user?.id]);

  const handleManageStudentsClick = async () => {
    setClassSearch("");
    setLoadingClasses(true);
    try {
      const fetched = await getClasses(user?.id);
      setClasses(fetched.filter((c) => !c.isArchived));
    } catch {
      toast.error("Failed to load classes");
    } finally {
      setLoadingClasses(false);
    }
    setShowClassPicker(true);
  };

  const handleClassSelect = (classId: string) => {
    setShowClassPicker(false);
    router.push(`/classes/edit/${classId}`);
  };

  const handleCreateExam = async (formData: ExamFormData) => {
    try {
      if (!user?.id) { toast.error("You must be logged in to create an exam"); return; }
      if (!user?.instructorId) { toast.error("Instructor ID not found. Please log out and log back in."); return; }

      const newExam = await createExam(formData, user.id, user.instructorId);

      setStats((prev) => {
        const exists = prev.recentExams.some((exam) => exam.id === newExam.id);
        if (exists) return prev;
        return {
          ...prev,
          totalExams: prev.totalExams + 1,
          recentExams: [
            { id: newExam.id, title: newExam.title, subject: newExam.subject, num_items: newExam.num_items, created_at: newExam.created_at },
            ...prev.recentExams.slice(0, 2),
          ],
        };
      });

      toast.success(`Exam "${formData.name}" created successfully`);
      setShowCreateModal(false);
      router.push(`/exams/${newExam.id}`);
    } catch (error) {
      console.error("Error creating exam:", error);
      toast.error("Failed to create exam");
    }
  };

  const displayName = user?.displayName || user?.email?.split("@")[0] || "Instructor";

  const statCards = [
    {
      title: "Total Classes",
      value: stats.totalClasses,
      icon: BookOpen,
      iconColor: "text-emerald-600",
      iconBg: "bg-emerald-50",
      sub: "Active classes",
    },
    {
      title: "Total Students",
      value: stats.totalStudents,
      icon: Users,
      iconColor: "text-emerald-600",
      iconBg: "bg-emerald-50",
      sub: null,
      badge: stats.totalStudents > 0 ? null : null,
    },
    {
      title: "Total Exams",
      value: stats.totalExams,
      icon: FileText,
      iconColor: "text-emerald-600",
      iconBg: "bg-emerald-50",
      sub: "Created this semester",
    },
    {
      title: "Average Score",
      value: stats.averageScore > 0 ? `${stats.averageScore}%` : "N/A",
      icon: TrendingUp,
      iconColor: "text-emerald-600",
      iconBg: "bg-emerald-50",
      sub: stats.averageScore > 0 ? "Across all exams" : "No scores yet",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              Welcome back, {displayName}
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Here&apos;s what&apos;s happening with your classes today.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/classes">
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-1.5 border-gray-300 text-gray-700 hover:bg-gray-100 text-xs h-8 px-3"
              >
                <Plus className="w-3.5 h-3.5" />
                New Class
              </Button>
            </Link>
            <Button
              size="sm"
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs h-8 px-3"
            >
              <Plus className="w-3.5 h-3.5" />
              New Exam
            </Button>
          </div>
        </div>

        {/* Pending role notice */}
        {!userRole && (
          <div className="mb-4 p-3 rounded-lg bg-yellow-50 border border-yellow-200 flex items-center gap-2 text-yellow-800 text-xs">
            <Clock className="w-3.5 h-3.5 flex-shrink-0" />
            Your account is pending role assignment. Please contact an administrator.
          </div>
        )}

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card
                key={stat.title}
                className="bg-white border border-gray-200 shadow-sm rounded-xl"
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col min-w-0">
                      <p className="text-xs text-gray-500 font-medium">
                        {stat.title}
                      </p>
                      <p className="text-2xl font-bold text-gray-900 mt-0.5 leading-none">
                        {loading ? (
                          <span className="inline-block w-8 h-6 bg-gray-100 animate-pulse rounded" />
                        ) : (
                          stat.value
                        )}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-1 min-h-[14px]">
                        {stat.sub ?? ""}
                      </p>
                    </div>
                    <div
                      className={`w-9 h-9 rounded-lg ${stat.iconBg} flex items-center justify-center flex-shrink-0`}
                    >
                      <Icon
                        className={`w-[18px] h-[18px] ${stat.iconColor}`}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Recent Classes + Recent Exams */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Recent Classes */}
          <Card className="bg-white border border-gray-200 shadow-sm rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 pt-4">
              <CardTitle className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-green-600" />
                Recent Classes
              </CardTitle>
              <Link href="/classes">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-green-600 hover:text-green-700 hover:bg-green-50 text-xs font-medium h-7 px-2"
                >
                  View All
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-14 bg-gray-100 rounded-lg animate-pulse"
                    />
                  ))}
                </div>
              ) : stats.recentClasses.length === 0 ? (
                <div className="text-center py-7 border-2 border-dashed border-gray-200 rounded-xl">
                  <BookOpen className="w-6 h-6 mx-auto mb-1.5 text-gray-300" />
                  <p className="text-xs text-gray-400">No classes yet</p>
                  <Link href="/classes">
                    <Button
                      variant="link"
                      className="mt-1 text-xs text-green-600 h-auto p-0"
                    >
                      Create your first class
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {stats.recentClasses.map((cls) => (
                    <Link key={cls.id} href={`/classes`}>
                      <div className="p-3 rounded-lg border border-gray-200 hover:border-green-400 hover:bg-green-50 transition-colors duration-150 cursor-pointer">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="font-semibold text-xs text-gray-800 truncate">
                                {cls.class_name}
                              </p>
                              {cls.year && (
                                <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap">
                                  {cls.year}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-gray-500 mt-0.5">
                              {cls.course_subject}
                            </p>
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
                              {cls.section_block && (
                                <span className="flex items-center gap-0.5">
                                  <Users className="w-2.5 h-2.5" />
                                  {cls.section_block}
                                </span>
                              )}
                              {cls.room && (
                                <span className="flex items-center gap-0.5">
                                  <Tag className="w-2.5 h-2.5" />
                                  {cls.room}
                                </span>
                              )}
                              <span className="flex items-center gap-0.5">
                                <Users className="w-2.5 h-2.5" />
                                {cls.students?.length || 0} students
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Exams */}
          <Card className="bg-white border border-gray-200 shadow-sm rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 pt-4">
              <CardTitle className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-green-600" />
                Recent Exams
              </CardTitle>
              <Link href="/exams">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-green-600 hover:text-green-700 hover:bg-green-50 text-xs font-medium h-7 px-2"
                >
                  View All
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-14 bg-gray-100 rounded-lg animate-pulse"
                    />
                  ))}
                </div>
              ) : stats.recentExams.length === 0 ? (
                <div className="text-center py-7 border-2 border-dashed border-gray-200 rounded-xl">
                  <FileText className="w-6 h-6 mx-auto mb-1.5 text-gray-300" />
                  <p className="text-xs text-gray-400">No exams created yet</p>
                  <Button
                    variant="link"
                    className="mt-1 text-xs text-green-600 h-auto p-0"
                    onClick={() => setShowCreateModal(true)}
                  >
                    Create your first exam
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {stats.recentExams.map((exam) => (
                    <Link key={exam.id} href={`/exams/${exam.id}`}>
                      <div className="p-3 rounded-lg border border-gray-200 hover:border-green-400 hover:bg-green-50 transition-colors duration-150 cursor-pointer">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="font-semibold text-xs text-gray-800 truncate">
                                {exam.title}
                              </p>
                              <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap">
                                {exam.num_items} Items
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-500 mt-0.5">
                              {exam.subject}
                            </p>
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
                              {exam.examCode && (
                                <span className="flex items-center gap-0.5">
                                  <Hash className="w-2.5 h-2.5" />
                                  {exam.examCode}
                                </span>
                              )}
                              {exam.created_at && (
                                <span className="flex items-center gap-0.5">
                                  <CalendarDays className="w-2.5 h-2.5" />
                                  {new Date(exam.created_at).toLocaleDateString(
                                    "en-US",
                                    {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    }
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create Exam Modal */}
      <CreateExamModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreateExam={handleCreateExam}
      />

      {/* Class Picker Modal */}
      {showClassPicker && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setShowClassPicker(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-[#166534]/5 to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#166534]/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-[#166534]" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-[#166534]">
                    Manage Students
                  </h2>
                  <p className="text-xs text-gray-500">Select a class to open</p>
                </div>
              </div>
              <button
                onClick={() => setShowClassPicker(false)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search */}
            <div className="px-6 py-3 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search classes…"
                  value={classSearch}
                  onChange={(e) => setClassSearch(e.target.value)}
                  className="pl-9 h-9 text-sm border-gray-200 focus:border-[#166534] focus:ring-[#166534]/20"
                  autoFocus
                />
              </div>
            </div>

            {/* Class list */}
            <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
              {loadingClasses ? (
                <div className="flex items-center justify-center py-10 text-gray-400 text-sm">
                  Loading classes…
                </div>
              ) : classes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400 gap-2">
                  <Users className="w-8 h-8 opacity-30" />
                  <p className="text-sm">No classes found.</p>
                </div>
              ) : (() => {
                const filtered = classes.filter((cls) => {
                  const q = classSearch.toLowerCase();
                  return (
                    cls.class_name.toLowerCase().includes(q) ||
                    (cls.course_subject || "").toLowerCase().includes(q) ||
                    (cls.section_block || "").toLowerCase().includes(q)
                  );
                });
                return filtered.length === 0 ? (
                  <div className="text-center py-8 text-sm text-gray-400">
                    No classes match "{classSearch}"
                  </div>
                ) : (
                  filtered.map((cls) => (
                    <button
                      key={cls.id}
                      onClick={() => handleClassSelect(cls.id)}
                      className="w-full text-left px-4 py-3 rounded-xl border border-gray-100 hover:border-[#166534] hover:bg-[#166534]/5 transition-all duration-150 group"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-800 group-hover:text-[#166534] truncate">
                            {cls.class_name}
                          </p>
                          <p className="text-xs text-gray-400 truncate mt-0.5">
                            {[cls.course_subject, cls.section_block]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs bg-[#166534]/10 text-[#166534] px-2 py-0.5 rounded-full font-medium">
                            {cls.students?.length ?? 0} students
                          </span>
                          <span className="text-gray-300 group-hover:text-[#B38B00] text-lg leading-none">
                            ›
                          </span>
                        </div>
                      </div>
                    </button>
                  ))
                );
              })()}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50">
              <p className="text-xs text-gray-400 text-center">
                {classes.length} class{classes.length !== 1 ? "es" : ""} available
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
