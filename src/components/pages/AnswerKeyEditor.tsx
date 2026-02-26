'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ArrowLeft, Save, Check, Lock, Upload, Download, FileDown } from 'lucide-react';
import { AnswerKeyService } from '@/services/answerKeyService';
import { AnswerChoice } from '@/types/scanning';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { getExamById, Exam } from '@/services/examService';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface AnswerKeyEditorProps {
  params: { id: string };
}

export default function AnswerKeyEditor({ params }: AnswerKeyEditorProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [exam, setExam] = useState<Exam | null>(null);
  const [answers, setAnswers] = useState<{ [key: number]: AnswerChoice }>({});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answerKeyId, setAnswerKeyId] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorModalTitle, setErrorModalTitle] = useState('Error');
  const [errorModalMessage, setErrorModalMessage] = useState('');

  // Load exam and answer key on mount
  useEffect(() => {
    loadExamAndAnswerKey();
  }, [params.id]);

  const loadExamAndAnswerKey = async () => {
    setLoading(true);
    try {
      // Load exam data
      const examData = await getExamById(params.id);
      if (examData) {
        setExam(examData);
      }

      // Load existing answer key
      await loadAnswerKey();
    } catch (err) {
      console.error('Error loading exam and answer key:', err);
      setError('Failed to load exam data');
    } finally {
      setLoading(false);
    }
  };

  const showErrorDialog = (title: string, message: string) => {
    setErrorModalTitle(title);
    setErrorModalMessage(message);
    setShowErrorModal(true);
  };

  const loadAnswerKey = async () => {
    setLoading(true);
    try {
      const result = await AnswerKeyService.getAnswerKeyByExamId(params.id);
      if (result.success && result.data) {
        const loadedAnswers: { [key: number]: AnswerChoice } = {};
        result.data.answers.forEach((answer, index) => {
          loadedAnswers[index + 1] = answer;
        });
        setAnswers(loadedAnswers);
        setAnswerKeyId(result.data.id);
        setIsLocked(result.data.locked || false);
      }
    } catch (err) {
      console.error('Error loading answer key:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionNumber: number, answer: string) => {
    if (isLocked) return;
    setAnswers(prev => ({
      ...prev,
      [questionNumber]: answer as AnswerChoice
    }));
  };

  const handleSaveAnswerKey = async () => {
    if (isLocked) {
      setError('Answer key is locked and cannot be modified');
      toast.error('Answer key is locked and cannot be modified');
      return;
    }

    if (!user?.id) {
      setError('You must be logged in to save answer keys');
      toast.error('You must be logged in to save answer keys');
      return;
    }

    if (!exam) {
      setError('Exam data not loaded');
      return;
    }

    // Validate all questions have answers
    const totalQuestions = exam.num_items;
    const answersEntered = Object.keys(answers).length;
    
    if (answersEntered < totalQuestions) {
      const missingCount = totalQuestions - answersEntered;
      const errorMsg = `Please answer all questions. ${missingCount} question${missingCount > 1 ? 's' : ''} remaining.`;
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    // Validate all answers are valid choices
    const validChoices = ['A', 'B', 'C', 'D', 'E'].slice(0, exam.choices_per_item);
    const invalidAnswers = Object.entries(answers).filter(([_, choice]) => !validChoices.includes(choice));
    
    if (invalidAnswers.length > 0) {
      const invalidQuestions = invalidAnswers.map(([q]) => q).join(', ');
      const errorMsg = `Invalid answer choices found for questions: ${invalidQuestions}. Only ${validChoices.join(', ')} are allowed.`;
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    setSaving(true);
    setError(null);
    
    try {
      // Convert to array format with uppercase standardization
      const answerArray: AnswerChoice[] = Array.from({ length: exam.num_items }, (_, i) => {
        const answer = answers[i + 1];
        return answer ? answer.toUpperCase() as AnswerChoice : 'A';
      });

      console.log('🔑 Saving answer key...');
      console.log('  - User:', user);
      console.log('  - InstructorId:', user?.instructorId);
      
      if (!user?.instructorId) {
        toast.error('⚠️ Instructor ID not found. Please log out and log back in.');
        setSaving(false);
        return;
      }

      let result;
      if (answerKeyId) {
        result = await AnswerKeyService.updateAnswerKey(answerKeyId, answerArray, user.id);
      } else {
        const createResult = await AnswerKeyService.createAnswerKey(
          params.id, 
          answerArray, 
          user.id, 
          undefined, // questionSettings
          user.instructorId // Pass instructorId
        );
        if (createResult.success && createResult.data) {
          setAnswerKeyId(createResult.data.id);
        }
        result = createResult;
      }

      if (result.success) {
        setSaved(true);
        toast.success('Answer key saved successfully');
        
        // Navigate back to exam page after a short delay
        setTimeout(() => {
          router.push(`/exams/${params.id}`);
        }, 1000);
      } else {
        setError(result.error || 'Failed to save answer key');
        showErrorDialog('Save Failed', result.error || 'Failed to save answer key. Please try again.');
        toast.error(result.error || 'Failed to save answer key');
      }
    } catch (err) {
      const errorMessage = (err as Error).message;
      setError(errorMessage);
      
      // Check if it's a network error
      if (errorMessage.includes('network') || errorMessage.includes('offline') || errorMessage.includes('fetch')) {
        showErrorDialog(
          'Network Error',
          'Unable to save answer key. Please check your internet connection and try again.'
        );
        toast.error('Network error - Please check your connection');
      } else {
        showErrorDialog('Error', errorMessage);
        toast.error(errorMessage);
      }
      console.error('Error saving answer key:', err);
    } finally {
      setSaving(false);
    }
  };

  // Download template CSV
  const handleDownloadTemplate = () => {
    if (!exam) return;
    
    const data = [];
    data.push(['Question Number', 'Answer']);
    
    for (let i = 1; i <= exam.num_items; i++) {
      data.push([i, '']);
    }
    
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Answer Key');
    XLSX.writeFile(workbook, `${exam.title}_answer_key_template.xlsx`);
    toast.success('Template downloaded successfully');
  };

  // Download current answer key
  const handleDownloadAnswerKey = () => {
    if (!exam) return;
    
    const data = [];
    data.push(['Question Number', 'Answer']);
    
    for (let i = 1; i <= exam.num_items; i++) {
      data.push([i, answers[i] || '']);
    }
    
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Answer Key');
    XLSX.writeFile(workbook, `${exam.title}_answer_key.xlsx`);
    toast.success('Answer key downloaded successfully');
  };

  // Upload answer key from file
  const handleUploadAnswerKey = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !exam) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as (string | number)[][];

        // Skip header row
        const answerData: { [key: number]: AnswerChoice } = {};
        const validChoices = ['A', 'B', 'C', 'D', 'E'].slice(0, exam.choices_per_item);
        const errors: string[] = [];

        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          const questionNum = Number(row[0]);
          const answer = String(row[1]).trim().toUpperCase();

          if (!questionNum || questionNum < 1 || questionNum > exam.num_items) {
            errors.push(`Row ${i + 1}: Invalid question number ${row[0]}`);
            continue;
          }

          if (!validChoices.includes(answer)) {
            errors.push(`Row ${i + 1}: Invalid answer "${row[1]}". Must be ${validChoices.join(', ')}`);
            continue;
          }

          answerData[questionNum] = answer as AnswerChoice;
        }

        if (errors.length > 0) {
          const errorList = errors.slice(0, 10).join('\n'); // Show first 10 errors
          const moreErrors = errors.length > 10 ? `\n... and ${errors.length - 10} more errors` : '';
          showErrorDialog(
            'File Upload Errors',
            `Found ${errors.length} error(s) in the uploaded file:\n\n${errorList}${moreErrors}\n\nPlease correct these errors and try again.`
          );
          toast.error(`Found ${errors.length} error(s) in uploaded file`);
          return;
        }

        setAnswers(answerData);
        toast.success(`Successfully loaded ${Object.keys(answerData).length} answers from file`);
        setError(null);
      } catch (err) {
        console.error('Error parsing file:', err);
        const errorMsg = 'Failed to parse file. The file format is incorrect or contains invalid data. Please ensure:\n\n• The file is in Excel format (.xlsx or .xls)\n• It contains "Question Number" and "Answer" columns\n• Question numbers are sequential (1, 2, 3...)\n• Answers are valid choices (A, B, C, D, or E)';
        showErrorDialog('Invalid File Format', errorMsg);
        toast.error('Failed to parse file - Invalid format');
      }
    };

    reader.onerror = () => {
      showErrorDialog(
        'File Read Error',
        'Unable to read the file. Please ensure the file is not corrupted and try again.'
      );
      toast.error('Failed to read file');
    };

    reader.readAsArrayBuffer(file);
    // Reset input so same file can be uploaded again
    event.target.value = '';
  };

  const totalQuestions = exam?.num_items || 0;
  const answersEntered = Object.keys(answers).length;
  const answersPercentage = totalQuestions > 0 ? Math.round((answersEntered / totalQuestions) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading answer key...</p>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground mb-2">Exam not found</p>
          <Link href="/exams" className="text-primary hover:underline">
            Return to Exams
          </Link>
        </div>
      </div>
    );
  }

  // Get available choices based on exam configuration
  const availableChoices = ['A', 'B', 'C', 'D', 'E'].slice(0, exam.choices_per_item);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href={`/exams/${params.id}`}
            className="p-2 hover:bg-muted rounded-md transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-3xl font-bold text-foreground">Edit Answer Key</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">{exam.title} - Set correct answers</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Download Answer Key Button */}
          <button
            onClick={handleDownloadAnswerKey}
            className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-md font-semibold hover:bg-green-700 transition-colors text-sm"
            title="Download current answer key"
            disabled={answersEntered === 0}
          >
            <FileDown className="w-4 h-4" />
            <span className="hidden sm:inline">Download Key</span>
          </button>

          {/* Download Template Button */}
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 px-3 py-2 border border-muted rounded-md font-semibold hover:bg-muted transition-colors text-sm"
            title="Download Excel template"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Template</span>
          </button>

          {/* Upload Answer Key Button */}
          <label className="flex items-center gap-2 px-3 py-2 border border-muted rounded-md font-semibold hover:bg-muted transition-colors cursor-pointer text-sm">
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Upload</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleUploadAnswerKey}
              className="hidden"
              disabled={isLocked}
            />
          </label>

          {isLocked && (
            <Badge variant="secondary" className="gap-1">
              <Lock className="h-3 w-3" />
              Locked
            </Badge>
          )}
          <button
            onClick={handleSaveAnswerKey}
            disabled={saving || isLocked}
            className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-md font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {saved ? (
              <>
                <Check className="w-5 h-5" />
                Saved!
              </>
            ) : saving ? (
              <>
                <Save className="w-5 h-5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save Answer Key
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Progress Card */}
      <Card className="p-4 border bg-blue-50">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs sm:text-sm font-semibold text-muted-foreground mb-1">Progress</p>
            <p className="text-xl sm:text-2xl font-bold text-primary">{answersEntered} / {totalQuestions}</p>
          </div>
          <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-full bg-white border-4 border-primary flex items-center justify-center flex-shrink-0">
            <div className="text-center">
              <p className="text-lg sm:text-2xl font-bold text-primary">{answersPercentage}%</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Complete</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Answer Key Grid - responsive: 2 cols mobile, 3 sm, 5 md+ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3">
        {Array.from({ length: totalQuestions }, (_, i) => i + 1).map((questionNum) => (
          <div key={questionNum} className={`p-3 rounded-lg border transition-all ${answers[questionNum] ? 'bg-blue-50 border-primary' : 'bg-background border-muted'}`}>
            <div className="text-center mb-2">
              <label className="text-xs font-semibold text-foreground block mb-2">
                Q{questionNum}
              </label>
              <div className="flex flex-wrap justify-center gap-1">
                {availableChoices.map(choice => (
                  <label key={choice} className="cursor-pointer">
                    <input
                      type="radio"
                      name={`question-${questionNum}`}
                      value={choice}
                      checked={answers[questionNum] === choice}
                      onChange={(e) => handleAnswerChange(questionNum, e.target.value)}
                      disabled={isLocked}
                      className="hidden"
                    />
                    <span className={`w-6 h-6 flex items-center justify-center rounded text-xs font-semibold transition-colors cursor-pointer block ${
                      answers[questionNum] === choice
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-primary/20'
                    }`}>
                      {choice}
                    </span>
                  </label>
                ))}
              </div>
              {answers[questionNum] && (
                <span className="text-xs font-bold text-primary mt-1">✓</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href={`/exams/${params.id}`}
          className="flex-1 px-4 py-3 border rounded-md font-semibold text-center hover:bg-muted transition-colors"
        >
          Cancel
        </Link>
        <button
          onClick={handleSaveAnswerKey}
          disabled={saving || isLocked}
          className="flex-1 px-4 py-3 bg-primary text-primary-foreground rounded-md font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save Answer Key'}
        </button>
      </div>

      {/* Error Modal */}
      <Dialog open={showErrorModal} onOpenChange={setShowErrorModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <span className="text-2xl">⚠️</span>
              {errorModalTitle}
            </DialogTitle>
            <DialogDescription className="text-base whitespace-pre-wrap pt-4">
              {errorModalMessage}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowErrorModal(false)} className="w-full sm:w-auto">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
