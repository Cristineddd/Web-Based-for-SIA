'use client';

import { useEffect, useState } from 'react';
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
  getExams,
  type ExamFormData 
} from '@/services/examService';

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
  }>;
}

export default function Dashboard() {
  const { userRole, user } = useAuth();
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

        const exams = await getExams(user.id);
        
        setStats({
          totalExams: exams.length,
          totalStudents: 0, 
          totalSheets: exams.reduce((sum, exam) => 
            sum + (exam.generated_sheets?.reduce((s, sheet) => s + (sheet.sheet_count || 0), 0) || 0), 0
          ),
          recentExams: exams.slice(0, 5).map(exam => ({
            id: exam.id,
            title: exam.title,
            subject: exam.subject,
            num_items: exam.num_items,
            created_at: exam.created_at,
          })),
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
        toast.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [user]);

const handleCreateExam = async (formData: ExamFormData) => {
  try {
    if (!user?.id) {
      toast.error('You must be logged in to create an exam');
      return;
    }

    const newExam = await createExam(formData, user.id);

    setStats(prev => ({
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
    }));

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
      title: 'Total Exams',
      value: stats.totalExams,
      icon: FileText,
      color: 'text-[#B38B00]',
      bgColor: 'bg-[#B38B00]/10',
      borderColor: 'border-[#166534]', 
    },
    {
      title: 'Students',
      value: stats.totalStudents,
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
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add the CreateExamModal component */}
      <CreateExamModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreateExam={handleCreateExam}
      />
    </div>
  );
}