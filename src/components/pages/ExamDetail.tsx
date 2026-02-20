'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  Loader2, 
  Key, 
  Printer,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { generateAnswerSheetPDF } from '@/lib/pdfGenerator';
import { getExamById, type Exam } from '@/services/examService';

export default function ExamDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sheetCount, setSheetCount] = useState(1);
  const [totalGenerated, setTotalGenerated] = useState(0);
  const [isOffline, setIsOffline] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  
  // Answer key input state
  const [answers, setAnswers] = useState<Record<number, string>>({});

  const fetchExamData = async (isRetry: boolean = false) => {
    if (!id) return;
    
    try {
      // Fetch exam from Firestore
      const examData = await getExamById(id);
      
      if (!examData) {
        // Only redirect if not offline
        if (!isOffline) {
          toast.error('Exam not found');
          router.push('/exams');
        }
        return;
      }
      
      setExam(examData);
      setAnswers({});
      setTotalGenerated(0);
      setIsOffline(false);
    } catch (error: any) {
      console.error('Error fetching exam:', error);
      
      // Check if it's an offline error
      if (error?.message?.includes('offline') || error?.code === 'failed-precondition') {
        setIsOffline(true);
        if (!isRetry) {
          toast.warning('You are offline. Some features may be limited.');
        }
      } else {
        toast.error('Failed to load exam');
        router.push('/exams');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExamData();
  }, [id]);

  const handleAnswerChange = (itemNumber: number, value: string) => {
    const upperValue = value.toUpperCase();
    if (exam && upperValue.length <= 1 && /^[A-Z]?$/.test(upperValue)) {
      const choiceLimit = String.fromCharCode(64 + exam.choices_per_item);
      if (!upperValue || upperValue <= choiceLimit) {
        setAnswers((prev) => ({ ...prev, [itemNumber]: upperValue }));
      }
    }
  };

  const saveAnswerKeys = async () => {
    if (!exam || !id) return;
    setSaving(true);

    try {
      toast.success('Answer keys saved successfully');
    } catch (error) {
      console.error('Error saving answer keys:', error);
      toast.error('Failed to save answer keys');
    } finally {
      setSaving(false);
    }
  };

  const generatePDF = async () => {
    if (!exam) return;
    setGenerating(true);

    try {
      await generateAnswerSheetPDF(exam, sheetCount);

      setTotalGenerated((prev) => prev + sheetCount);
      toast.success(`Generated ${sheetCount} answer sheet(s)`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-accent mx-auto" />
          <p className="text-muted-foreground">Loading exam...</p>
          {isOffline && (
            <p className="text-sm text-warning">You appear to be offline</p>
          )}
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="page-container">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-warning" />
              Unable to Load Exam
            </CardTitle>
            <CardDescription>
              {isOffline 
                ? 'You appear to be offline. Check your connection and try again.'
                : 'The exam could not be found or loaded.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={() => {
                setLoading(true);
                setRetryCount(retryCount + 1);
                fetchExamData(true);
              }}
              className="w-full"
            >
              {isOffline ? 'Retry' : 'Go Back to Exams'}
            </Button>
            {!isOffline && (
              <Button 
                variant="ghost"
                onClick={() => router.push('/exams')}
                className="w-full"
              >
                Back to Exams
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const answeredCount = Object.values(answers).filter(Boolean).length;
  const isComplete = answeredCount === exam.num_items;

  return (
    <div className="page-container">
      {/* Header */}
      <div className="mb-6">
        <Button 
          variant="ghost" 
          onClick={() => router.push('/exams')}
          className="mb-4 -ml-2"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Exams
        </Button>
        
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{exam.title}</h1>
            <p className="text-muted-foreground mt-1">{exam.subject}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-accent/10 text-accent">
              {exam.num_items} Items
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary/10 text-primary">
              {exam.choices_per_item} Choices
            </span>
          </div>
        </div>
      </div>

      <Tabs defaultValue="answer-key" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="answer-key" className="gap-2">
            <Key className="w-4 h-4" />
            Answer Key
          </TabsTrigger>
          <TabsTrigger value="generate" className="gap-2">
            <Printer className="w-4 h-4" />
            Generate PDF
          </TabsTrigger>
        </TabsList>

        {/* Answer Key Tab */}
        <TabsContent value="answer-key" className="space-y-6">
          <Card className="card-elevated">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    isComplete ? 'bg-success/10' : 'bg-warning/10'
                  }`}>
                    {isComplete ? (
                      <CheckCircle className="w-5 h-5 text-success" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-warning" />
                    )}
                  </div>
                  <div>
                    <CardTitle>Answer Key</CardTitle>
                    <CardDescription>
                      {answeredCount} of {exam.num_items} items answered
                    </CardDescription>
                  </div>
                </div>
                <Button 
                  onClick={saveAnswerKeys} 
                  disabled={saving}
                  className="gradient-primary"
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Answer Key'
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-3">
                {Array.from({ length: exam.num_items }, (_, i) => i + 1).map((num) => (
                  <div key={num} className="space-y-1">
                    <Label className="text-xs text-muted-foreground text-center block">
                      {num}
                    </Label>
                    <Input
                      value={answers[num] || ''}
                      onChange={(e) => handleAnswerChange(num, e.target.value)}
                      className="text-center font-mono uppercase h-10"
                      maxLength={1}
                      placeholder="–"
                    />
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                Enter letters A-{String.fromCharCode(64 + exam.choices_per_item)} for each item
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Generate PDF Tab */}
        <TabsContent value="generate" className="space-y-6">
          <Card className="card-elevated">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Printer className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <CardTitle>Generate Answer Sheets</CardTitle>
                  <CardDescription>
                    Create printable PDF answer sheets for students
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="sheetCount">Number of Copies</Label>
                  <Input
                    id="sheetCount"
                    type="number"
                    min={1}
                    max={100}
                    value={sheetCount}
                    onChange={(e) => setSheetCount(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Each copy will be on a separate page
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Total Generated</Label>
                  <div className="h-10 flex items-center px-3 rounded-md border bg-muted">
                    <span className="font-medium">{totalGenerated} sheets</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Total answer sheets generated for this exam
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-lg border bg-muted/50">
                <h4 className="font-medium mb-2">Sheet Configuration</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Student ID: {exam.student_id_length} digit bubbles</li>
                  <li>• Questions: {exam.num_items} items</li>
                  <li>• Choices per item: {exam.choices_per_item} (A-{String.fromCharCode(64 + exam.choices_per_item)})</li>
                </ul>
              </div>

              <Button 
                onClick={generatePDF} 
                disabled={generating}
                className="w-full gradient-accent text-accent-foreground"
                size="lg"
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating PDF...
                  </>
                ) : (
                  <>
                    <Printer className="mr-2 h-4 w-4" />
                    Generate & Download PDF
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
