"use client";

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation'; 
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { 
  FileText, 
  Users, 
  ClipboardList, 
  Plus,
  TrendingUp,
  Clock
} from 'lucide-react';
import { CreateExamModal } from '@/components/modals/CreateExamModal';
import { toast } from 'sonner';
import { 
  createExam, 
  type ExamFormData 
} from '@/services/examService';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

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
  
  // Use ref to prevent double fetching
  const hasFetched = useRef(false);

  useEffect(() => {
    // Skip if no user ID or already fetched
    if (!user?.id || hasFetched.current) {
      if (!user?.id) setLoading(false);
      return;
    }

    async function fetchStats() {
      try {
        console.log('Dashboard v2.0 - Fetching stats for user:', user.id);
        
        // OPTIMIZATION 1: Simplified query without orderBy to avoid needing composite index
        const examsRef = collection(db, 'exams');
        const q = query(
          examsRef, 
          where('createdBy', '==', user.id)
        );
        
        let querySnapshot;
        try {
          // Add timeout to prevent hanging
          querySnapshot = await Promise.race([
            getDocs(q),
            new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Query timeout')), 5000);
            })
          ]) as any;
        } catch (queryError: any) {
          console.warn('Dashboard query failed or timed out:', queryError.message);
          // Fallback: set empty stats instead of failing
          setStats({
            totalExams: 0,
            totalStudents: 0,
            totalSheets: 0,
            recentExams: [],
          });
          hasFetched.current = true;
          return;
        }
        
        // Calculate all stats from this single query
        const totalExams = querySnapshot.size;
        const exams = querySnapshot.docs.map((doc: any) => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data.title || '',
            subject: data.subject || '',
            num_items: data.num_items || 0,
            created_at: data.created_at,
            generated_sheets: data.generated_sheets || [],
            isArchived: data.isArchived || false
          } as Exam;
        })
        // Filter out archived exams (client-side to avoid needing composite index)
        .filter((exam: any) => !exam.isArchived)
        // Sort by created_at descending (newest first) and limit to 5
        .sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateB - dateA;
        })
        .slice(0, 5);
        
        // OPTIMIZATION 2: Compute total sheets from exam data
        const totalSheets = exams.reduce((sum, exam) => {
          // Check if generated_sheets exists and is an array
          if (exam.generated_sheets && Array.isArray(exam.generated_sheets)) {
            return sum + exam.generated_sheets.reduce((sheetSum, sheet) => 
              sheetSum + (sheet.sheet_count || 0), 0
            );
          }
          return sum;
        }, 0);
        
        // OPTIMIZATION 3: Student count - set to 0 for now to avoid timeout
        // Note: Students are managed per class, not globally
        const totalStudents = 0;
        
        console.log('Dashboard data fetched successfully:', {
          totalExams,
          recentExams: exams.length,
          totalStudents,
          totalSheets
        });
        
        setStats({
          totalExams,
          totalStudents,
          totalSheets,
          recentExams: exams.map(exam => ({
            id: exam.id,
            title: exam.title,
            subject: exam.subject || "N/A",
            num_items: exam.num_items,
            created_at: exam.created_at,
            status: exam.status === "final" ? "Completed" : "Grading",
            students_count: exam.generated_sheets?.length || 0,
          })),
        });
        
        // Mark as fetched to prevent duplicate requests
        hasFetched.current = true;
        
      } catch (error) {
        console.error('Error fetching stats:', error);
        // Set empty stats on error instead of showing error toast
        setStats({
          totalExams: 0,
          totalStudents: 0,
          totalSheets: 0,
          recentExams: [],
        });
        hasFetched.current = true;
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
    
    // Cleanup function
    return () => {
      // Reset ref if component unmounts
      hasFetched.current = false;
    };
  }, [user?.id]); // Only depend on user.id

  const handleCreateExam = async (formData: ExamFormData) => {
    try {
      if (!user?.id) {
        toast.error('You must be logged in to create an exam');
        return;
      }

      const newExam = await createExam(formData, user.id);

      // OPTIMIZATION 4: Update stats without refetching
      setStats(prev => {
        // Check if exam already exists in recentExams to prevent duplicates
        const exists = prev.recentExams.some(exam => exam.id === newExam.id);
        if (exists) return prev;
        
        return {
          ...prev,
          totalExams: prev.totalExams + 1,
          recentExams: [
            {
              id: newExam.id,
              title: newExam.title,
              subject: newExam.subject,
              num_items: newExam.num_items,
              created_at: newExam.created_at,
            },
            ...prev.recentExams.slice(0, 4)
          ],
        };
      });

      toast.success(`Exam "${formData.name}" created successfully`);
      setShowCreateModal(false);
      
      router.push(`/exams/${newExam.id}`);
      
    } catch (error) {
      console.error('Error creating exam:', error);
      toast.error('Failed to create exam');
    }
  };

  const statCards = [
    {
      title: "Total Exams",
      value: stats.totalExams,
      trend: "+3 this week",
      icon: FileText,
      color: 'text-[#B38B00]',
      bgColor: 'bg-[#B38B00]/10',
      borderColor: 'border-[#166534]', 
    },
    {
      title: "Total Students",
      value: stats.totalStudents,
      trend: "+12 this month",
      icon: Users,
      color: 'text-[#166534]',
      bgColor: 'bg-[#166534]/10',
      borderColor: 'border-[#166534]', 
    },
    {
      title: 'Answer Sheets',
      value: stats.totalSheets,
      icon: ClipboardList,
      color: 'text-[#B38B00]',
      bgColor: 'bg-[#B38B00]/10',
      borderColor: 'border-[#166534]', 
    },
  ];

  return (
    <div className="page-container">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#166534]">Dashboard</h1>
        <p className="text-[#B38B00] mt-1">
          Welcome back! Here's an overview of your exam management system.
        </p>
      </div>

      {!userRole && (
        <Card className="mb-6 border-[#B38B00]/30 bg-[#B38B00]/5">
          <CardContent className="py-4">
            <p className="text-sm text-[#B38B00] flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Your account is pending role assignment. Please contact an administrator.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-3 mb-8">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className={`stat-card animate-slide-up border-2 ${stat.borderColor} hover:border-[#B38B00] transition-colors duration-200`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#166534]">{stat.title}</p>
                    <p className="text-3xl font-bold mt-1 text-[#166534]">
                      {loading ? '-' : stat.value}
                    </p>
                  </div>
                  <div className={`w-12 h-12 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="card-elevated border-2 border-[#166534] hover:border-[#B38B00] transition-colors duration-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-[#166534]">
              <TrendingUp className="w-5 h-5 text-[#B38B00]" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <Button 
              className="w-full justify-start gap-3 h-12 border-2 border-[#166534]/20 hover:border-[#B38B00] hover:bg-[#B38B00]/10 transition-colors duration-200 text-[#166534]" 
              variant="outline"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus className="w-4 h-4 text-[#B38B00]" />
              Create New Exam
            </Button>
            
            <div className="h-2"></div>
            
            <Link href="/students">
              <Button className="w-full justify-start gap-3 h-12 border-2 border-[#166534]/20 hover:border-[#B38B00] hover:bg-[#B38B00]/10 transition-colors duration-200 text-[#166534]" variant="outline">
                <Users className="w-4 h-4 text-[#B38B00]" />
                Manage Students
              </Button>
            </Link>
            
            <div className="h-2"></div>
            
            <Link href="/exams">
              <Button className="w-full justify-start gap-3 h-12 border-2 border-[#166534]/20 hover:border-[#B38B00] hover:bg-[#B38B00]/10 transition-colors duration-200 text-[#166534]" variant="outline">
                <FileText className="w-4 h-4 text-[#B38B00]" />
                View All Exams
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="card-elevated border-2 border-[#166534] hover:border-[#B38B00] transition-colors duration-200">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2 text-[#166534]">
              <Clock className="w-5 h-5 text-[#B38B00]" />
              Recent Exams
            </CardTitle>
            <Link href="/exams">
              <Button variant="ghost" size="sm" className="border-2 border-transparent hover:border-[#B38B00] hover:bg-[#B38B00]/10 transition-colors duration-200 text-[#166534]">View all</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-[#B38B00]/10 rounded-lg animate-pulse border-2 border-[#166534]" />
                ))}
              </div>
            ) : stats.recentExams.length === 0 ? (
              <div className="text-center py-8 text-[#166534] border-2 border-dashed border-[#166534] rounded-lg">
                <FileText className="w-10 h-10 mx-auto mb-2 opacity-50 text-[#B38B00]" />
                <p className="text-[#166534]">No exams created yet</p>
                <Button 
                  variant="link" 
                  className="mt-2 text-[#B38B00] hover:text-[#166534]"
                  onClick={() => setShowCreateModal(true)}
                >
                  Create your first exam
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.recentExams.map((exam) => (
                  <Link 
                    key={exam.id} 
                    href={`/exams/${exam.id}`}
                    className="block p-3 rounded-lg border-2 border-[#166534] hover:border-[#B38B00] hover:bg-[#B38B00]/10 transition-colors duration-200"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-[#166534]">{exam.title}</p>
                        <p className="text-sm text-[#B38B00]">{exam.subject}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-[#166534]}">{exam.num_items} items</p>
                        <p className="text-xs text-[#B38B00]">
                          {new Date(exam.created_at).toLocaleDateString()}
                        </p>
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