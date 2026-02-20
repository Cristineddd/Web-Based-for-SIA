'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { ArrowLeft, FileText, CheckCircle, AlertCircle, Eye } from 'lucide-react';
import { getExamById, Exam } from '@/services/examService';
import { toast } from 'sonner';

interface ReviewPapersProps {
  params: { id: string };
}

interface ScannedPaper {
  id: string;
  studentId: string;
  studentName: string;
  status: 'pending' | 'reviewed' | 'flagged';
  score: number | null;
  scannedAt: string;
  imageUrl?: string;
}

export default function ReviewPapersPage({ params }: ReviewPapersProps) {
  const [exam, setExam] = useState<Exam | null>(null);
  const [papers, setPapers] = useState<ScannedPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'reviewed' | 'flagged'>('all');
  const [selectedPaper, setSelectedPaper] = useState<ScannedPaper | null>(null);
  const examId = params.id;

  useEffect(() => {
    const fetchPaperData = async () => {
      try {
        const examData = await getExamById(params.id);
        if (!examData) {
          toast.error('Exam not found');
          return;
        }
        setExam(examData);

        // Generate mock scanned papers data
        const mockPapers: ScannedPaper[] = Array.from({ length: 12 }, (_, i) => ({
          id: `paper_${i + 1}`,
          studentId: `STU${String(i + 1).padStart(5, '0')}`,
          studentName: `Student ${i + 1}`,
          status: i % 3 === 0 ? 'flagged' : i % 2 === 0 ? 'reviewed' : 'pending',
          score: i % 2 === 0 ? Math.floor(Math.random() * 100) : null,
          scannedAt: new Date(Date.now() - i * 3600000).toISOString()
        }));
        setPapers(mockPapers);
      } catch (error) {
        console.error('Error fetching exam data:', error);
        toast.error('Failed to load exam data');
      } finally {
        setLoading(false);
      }
    };

    fetchPaperData();
    }, [examId, params]);

  const filteredPapers = filterStatus === 'all' 
    ? papers 
    : papers.filter(p => p.status === filterStatus);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'reviewed':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'flagged':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'pending':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'reviewed':
        return <CheckCircle className="w-4 h-4" />;
      case 'flagged':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading papers...</p>
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="space-y-6">
        <Link href="/exams" className="p-2 hover:bg-muted rounded-md transition-colors inline-block">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <p className="text-foreground">Exam not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 sm:gap-4">
        <Link
          href={`/exams/${params.id}`}
          className="p-2 hover:bg-muted rounded-md transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
            <FileText className="w-6 h-6 flex-shrink-0" />
            Review Papers
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">Exam: {exam.title}</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-3 sm:p-4 border">
          <p className="text-xs font-semibold text-muted-foreground mb-1">Total Papers</p>
          <p className="text-xl sm:text-2xl font-bold text-primary">{papers.length}</p>
        </Card>
        <Card className="p-3 sm:p-4 border">
          <p className="text-xs font-semibold text-muted-foreground mb-1">Pending Review</p>
          <p className="text-xl sm:text-2xl font-bold text-yellow-600">{papers.filter(p => p.status === 'pending').length}</p>
        </Card>
        <Card className="p-3 sm:p-4 border">
          <p className="text-xs font-semibold text-muted-foreground mb-1">Reviewed</p>
          <p className="text-xl sm:text-2xl font-bold text-green-600">{papers.filter(p => p.status === 'reviewed').length}</p>
        </Card>
        <Card className="p-3 sm:p-4 border">
          <p className="text-xs font-semibold text-muted-foreground mb-1">Flagged</p>
          <p className="text-xl sm:text-2xl font-bold text-red-600">{papers.filter(p => p.status === 'flagged').length}</p>
        </Card>
      </div>

      {/* Filter Buttons */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'pending', 'reviewed', 'flagged'] as const).map(status => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
              filterStatus === status
                ? 'bg-primary text-primary-foreground'
                : 'border hover:bg-muted'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Papers List */}
      {selectedPaper ? (
        <Card className="p-4 sm:p-6 border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-foreground">
              {selectedPaper.studentName} - {selectedPaper.studentId}
            </h2>
            <button
              onClick={() => setSelectedPaper(null)}
              className="px-3 py-1 border rounded-md text-sm hover:bg-muted transition-colors"
            >
              Back
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Paper Preview */}
            <div className="lg:col-span-2">
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">Paper preview would appear here</p>
                </div>
              </div>
            </div>

            {/* Paper Details */}
            <div className="space-y-4">
              <Card className="p-4 border">
                <h3 className="font-semibold text-foreground mb-3">Paper Details</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Student ID</p>
                    <p className="font-semibold text-foreground">{selectedPaper.studentId}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Scanned At</p>
                    <p className="font-semibold text-foreground">
                      {new Date(selectedPaper.scannedAt).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border mt-1 ${getStatusColor(selectedPaper.status)}`}>
                      {getStatusIcon(selectedPaper.status)}
                      {selectedPaper.status.charAt(0).toUpperCase() + selectedPaper.status.slice(1)}
                    </div>
                  </div>
                  {selectedPaper.score !== null && (
                    <div>
                      <p className="text-muted-foreground">Score</p>
                      <p className="font-semibold text-foreground text-lg">{selectedPaper.score}%</p>
                    </div>
                  )}
                </div>
              </Card>

              <Card className="p-4 border">
                <h3 className="font-semibold text-foreground mb-3">Actions</h3>
                <div className="space-y-2">
                  <button className="w-full px-3 py-2 bg-green-600 text-white rounded-md text-sm font-semibold hover:bg-green-700 transition-colors">
                    Mark as Reviewed
                  </button>
                  <button className="w-full px-3 py-2 bg-red-600 text-white rounded-md text-sm font-semibold hover:bg-red-700 transition-colors">
                    Flag for Review
                  </button>
                </div>
              </Card>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-4 border">
          <h2 className="text-lg font-bold text-foreground mb-4">Papers ({filteredPapers.length})</h2>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {filteredPapers.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">No papers found in this category.</p>
              </div>
            ) : (
              filteredPapers.map(paper => (
                <div
                  key={paper.id}
                  onClick={() => setSelectedPaper(paper)}
                  className="p-4 border rounded-lg hover:shadow-md transition-all cursor-pointer hover:bg-muted/50"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{paper.studentName}</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">{paper.studentId}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(paper.status)}`}>
                        {getStatusIcon(paper.status)}
                        {paper.status.charAt(0).toUpperCase() + paper.status.slice(1)}
                      </div>
                      {paper.score !== null && (
                        <span className="text-sm font-semibold text-primary">{paper.score}%</span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPaper(paper);
                        }}
                        className="p-1 hover:bg-muted rounded"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
