"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { FileText, Users, Scan } from "lucide-react";
import { CreateExamModal } from "@/components/modals/CreateExamModal";
import { toast } from "sonner";
import {
  createExam,
  getExams,
  type ExamFormData,
} from "@/services/examService";
import { getClasses } from "@/services/classService";
import { cn } from "@/lib/utils";

interface DashboardStats {
  totalExams: number;
  totalStudents: number;
  totalSheets: number;
  recentExams: Array<{
    id: string;
    title: string;
    subject: string;
    num_items: number;
    created_at: string;
    status: "Completed" | "Grading";
    students_count: number;
  }>;
}

export default function Dashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    totalExams: 0,
    totalStudents: 0,
    totalSheets: 0,
    recentExams: [],
  });
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    async function fetchStats() {
      try {
        if (!user?.id) {
          setLoading(false);
          return;
        }

        const [exams, classes] = await Promise.all([
          getExams(user.id),
          getClasses(user.id),
        ]);

        const totalStudentsCount = classes.reduce(
          (sum, c) => sum + (c.students?.length || 0),
          0,
        );

        const totalSheetsCount = exams.reduce(
          (sum, exam) =>
            sum +
            (exam.generated_sheets?.reduce(
              (s, sheet) => s + (sheet.sheet_count || 0),
              0,
            ) || 0),
          0,
        );

        setStats({
          totalExams: exams.length,
          totalStudents: totalStudentsCount,
          totalSheets: totalSheetsCount,
          recentExams: exams.slice(0, 4).map((exam) => ({
            id: exam.id,
            title: exam.title,
            subject: exam.subject || "N/A",
            num_items: exam.num_items,
            created_at: exam.created_at,
            status: exam.status === "final" ? "Completed" : "Grading",
            students_count: exam.generated_sheets?.length || 0,
          })),
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [user]);

  const handleCreateExam = async (formData: ExamFormData) => {
    try {
      if (!user?.id) {
        toast.error("You must be logged in to create an exam");
        return;
      }

      const newExam = await createExam(formData, user.id);
      toast.success(`Exam "${formData.name}" created successfully`);
      setShowCreateModal(false);
      router.push(`/exams/${newExam.id}`);
    } catch (error) {
      console.error("Error creating exam:", error);
      toast.error("Failed to create exam");
    }
  };

  const statCards = [
    {
      title: "Total Exams",
      value: stats.totalExams,
      trend: "+3 this week",
      icon: FileText,
      color: "text-[#004D2C]",
      bgColor: "bg-emerald-50",
    },
    {
      title: "Total Students",
      value: stats.totalStudents,
      trend: "+12 this month",
      icon: Users,
      color: "text-[#004D2C]",
      bgColor: "bg-emerald-50",
    },
    {
      title: "Answer Sheets",
      value: stats.totalSheets.toLocaleString(),
      trend: "+89 this week",
      icon: Scan,
      color: "text-white",
      bgColor: "bg-[#BA8E23]",
    },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top Professional Header */}
      <header className="h-16 border-b bg-white flex items-center justify-between px-8">
        <h2 className="text-[#004D2C] font-bold text-lg">
          Smart Exam Checking & Auto-Grading System
        </h2>
        <div className="flex items-center gap-4">
          <div className="px-3 py-1 bg-gray-50 border rounded-lg text-xs flex items-center gap-2">
            <span className="text-gray-500">Role:</span>
            <span className="font-bold text-[#004D2C]">Prof</span>
          </div>
        </div>
      </header>

      <main className="flex-1 p-8 space-y-8 bg-[#FAF9F6]">
        {/* Page Title section */}
        <div className="space-y-1">
          <h1 className="text-4xl font-extrabold text-[#004D2C]">Dashboard</h1>
          <p className="text-gray-500 font-medium">
            Welcome back! Here's an overview of your exam management system.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card
                key={stat.title}
                className="border-[#BA8E23]/20 shadow-sm rounded-[20px] overflow-hidden"
              >
                <CardContent className="p-8">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <p className="text-sm font-bold text-gray-500">
                        {stat.title}
                      </p>
                      <p className="text-4xl font-extrabold text-[#004D2C]">
                        {loading ? "-" : stat.value}
                      </p>
                      <div className="flex items-center gap-1 text-xs font-bold text-emerald-600">
                        {/* {stat.trend} */}
                      </div>
                    </div>
                    <div
                      className={cn(
                        "w-14 h-14 rounded-xl flex items-center justify-center shadow-inner",
                        stat.bgColor,
                      )}
                    >
                      <Icon className={cn("w-7 h-7", stat.color)} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Recent Exams Section */}
        <div className="space-y-4">
          <Card className="border-[#BA8E23]/20 shadow-sm rounded-[20px] overflow-hidden">
            <div className="p-6 border-b bg-white">
              <h3 className="text-xl font-bold text-[#004D2C]">Recent Exams</h3>
            </div>
            <CardContent className="p-6">
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="h-20 bg-gray-100 rounded-xl animate-pulse"
                    />
                  ))}
                </div>
              ) : stats.recentExams.length === 0 ? (
                <div className="text-center py-12 space-y-4 opacity-50">
                  <FileText className="w-16 h-16 mx-auto text-gray-400" />
                  <p className="font-bold">No recent exams found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {stats.recentExams.map((exam) => (
                    <div
                      key={exam.id}
                      className="flex items-center justify-between p-5 border border-[#BA8E23]/10 rounded-2xl bg-white hover:border-[#BA8E23]/30 hover:shadow-md transition-all cursor-pointer group"
                      onClick={() => router.push(`/exams/${exam.id}`)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gray-50 border flex items-center justify-center text-gray-400 group-hover:bg-emerald-50 group-hover:text-emerald-700 transition-colors">
                          <FileText className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="font-bold text-[#004D2C] text-lg">
                            {exam.title}
                          </h4>
                          <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
                            <span>
                              {new Date(exam.created_at).toLocaleDateString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                },
                              )}
                            </span>
                            <span>•</span>
                            <span>{exam.students_count} students</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div
                          className={cn(
                            "px-4 py-1.5 rounded-lg text-xs font-bold",
                            exam.status === "Completed"
                              ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                              : "bg-amber-50 text-amber-600 border border-amber-100",
                          )}
                        >
                          {exam.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <CreateExamModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreateExam={handleCreateExam}
      />
    </div>
  );
}
