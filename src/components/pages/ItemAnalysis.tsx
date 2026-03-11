'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { BarChart3, TrendingUp, AlertCircle, ArrowLeft } from 'lucide-react';
import { getExamById, Exam } from '@/services/examService';
import { AnswerKeyService } from '@/services/answerKeyService';
import { ScanningService } from '@/services/scanningService';
import { AnswerChoice } from '@/types/scanning';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ItemAnalysisProps {
  params: { id: string };
}

interface QuestionAnalysis {
  questionNumber: number;
  correctAnswer: string;
  correctRate: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  discrimination: number;
  choiceDistribution: { [choice: string]: number };
  totalResponses: number;
}

export default function ItemAnalysisPage({ params }: ItemAnalysisProps) {
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<QuestionAnalysis[]>([]);
  const [totalPapers, setTotalPapers] = useState(0);
  const examId = params.id;

  useEffect(() => {
    const fetchAnalysisData = async () => {
      try {
        const examData = await getExamById(examId);
        if (!examData) {
          toast.error('Exam not found');
          setLoading(false);
          return;
        }
        setExam(examData);

        // Fetch answer key
        const akResult = await AnswerKeyService.getAnswerKeyByExamId(examId);
        let answerKey: AnswerChoice[] = [];
        if (akResult.success && akResult.data) {
          answerKey = akResult.data.answers;
        }

        // Fetch real scanned results
        const scannedResult = await ScanningService.getScannedResultsByExamId(examId);
        const validResults = (scannedResult.success && scannedResult.data)
          ? scannedResult.data.filter(r => !r.isNullId)
          : [];
        setTotalPapers(validResults.length);

        if (validResults.length === 0 || answerKey.length === 0) {
          // No data to analyze
          setQuestions([]);
          setLoading(false);
          return;
        }

        // Sort students by total score for discrimination calculation
        const studentScores = validResults.map(r => {
          let score = 0;
          r.answers.forEach((ans, idx) => {
            if (answerKey[idx] && ans && ans.toUpperCase() === answerKey[idx].toUpperCase()) {
              score++;
            }
          });
          return { ...r, calculatedScore: score };
        }).sort((a, b) => b.calculatedScore - a.calculatedScore);

        // Upper 27% and lower 27% groups for discrimination
        const groupSize = Math.max(1, Math.ceil(studentScores.length * 0.27));
        const upperGroup = studentScores.slice(0, groupSize);
        const lowerGroup = studentScores.slice(-groupSize);

        const numQuestions = examData.num_items;
        const choicesCount = examData.choices_per_item;
        const analysisData: QuestionAnalysis[] = [];

        for (let i = 0; i < numQuestions; i++) {
          const correctAnswer = answerKey[i] || '';
          let correctCount = 0;
          const distribution: { [choice: string]: number } = {};

          // Initialize distribution for all choices
          for (let j = 0; j < choicesCount; j++) {
            distribution[String.fromCharCode(65 + j)] = 0;
          }

          // Count responses for this question
          let totalResponded = 0;
          validResults.forEach(result => {
            const ans = result.answers[i];
            if (ans) {
              const upperAns = ans.toUpperCase();
              if (distribution.hasOwnProperty(upperAns)) {
                distribution[upperAns]++;
              }
              totalResponded++;
              if (correctAnswer && upperAns === correctAnswer.toUpperCase()) {
                correctCount++;
              }
            }
          });

          const correctRate = totalResponded > 0
            ? Math.round((correctCount / totalResponded) * 100)
            : 0;

          let difficulty: 'Easy' | 'Medium' | 'Hard' = 'Medium';
          if (correctRate > 75) difficulty = 'Easy';
          else if (correctRate < 40) difficulty = 'Hard';

          // Discrimination index (upper group correct% - lower group correct%)
          let upperCorrect = 0;
          upperGroup.forEach(r => {
            const ans = r.answers[i];
            if (ans && correctAnswer && ans.toUpperCase() === correctAnswer.toUpperCase()) {
              upperCorrect++;
            }
          });
          let lowerCorrect = 0;
          lowerGroup.forEach(r => {
            const ans = r.answers[i];
            if (ans && correctAnswer && ans.toUpperCase() === correctAnswer.toUpperCase()) {
              lowerCorrect++;
            }
          });
          const discrimination = groupSize > 0
            ? parseFloat(((upperCorrect / groupSize) - (lowerCorrect / groupSize)).toFixed(2))
            : 0;

          analysisData.push({
            questionNumber: i + 1,
            correctAnswer: correctAnswer.toUpperCase(),
            correctRate,
            difficulty,
            discrimination,
            choiceDistribution: distribution,
            totalResponses: totalResponded,
          });
        }

        setQuestions(analysisData);
      } catch (error) {
        console.error('Error fetching analysis data:', error);
        toast.error('Failed to load item analysis');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysisData();
  }, [examId]);  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading item analysis...</p>
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="space-y-6">
        <Button
          variant="outline"
          onClick={() => window.history.back()}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <p className="text-foreground">Exam not found</p>
      </div>
    );
  }

  const avgCorrectRate = questions.length > 0
    ? Math.round(questions.reduce((sum, q) => sum + q.correctRate, 0) / questions.length)
    : 0;
  const avgDiscrimination = questions.length > 0
    ? parseFloat((questions.reduce((sum, q) => sum + q.discrimination, 0) / questions.length).toFixed(2))
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 sm:gap-4">
        <Button
          variant="outline"
          onClick={() => window.history.back()}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Exam
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-6 h-6" />
            Item Analysis
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">Exam: {exam.title}</p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-4 sm:p-6 border">
          <p className="text-xs sm:text-sm font-semibold text-muted-foreground mb-2">Papers Analyzed</p>
          <p className="text-2xl sm:text-3xl font-bold text-primary">{totalPapers}</p>
          <p className="text-xs text-muted-foreground mt-2">Scanned answer sheets</p>
        </Card>
        <Card className="p-4 sm:p-6 border">
          <p className="text-xs sm:text-sm font-semibold text-muted-foreground mb-2">Avg Correct Rate</p>
          <p className="text-2xl sm:text-3xl font-bold text-primary">{avgCorrectRate}%</p>
          <p className="text-xs text-muted-foreground mt-2">Overall performance</p>
        </Card>
        <Card className="p-4 sm:p-6 border">
          <p className="text-xs sm:text-sm font-semibold text-muted-foreground mb-2">Avg Discrimination</p>
          <p className="text-2xl sm:text-3xl font-bold text-primary">{avgDiscrimination}</p>
          <p className="text-xs text-muted-foreground mt-2">Item quality (0-1)</p>
        </Card>
        <Card className="p-4 sm:p-6 border">
          <p className="text-xs sm:text-sm font-semibold text-muted-foreground mb-2">Questions Analyzed</p>
          <p className="text-2xl sm:text-3xl font-bold text-primary">{questions.length}</p>
          <p className="text-xs text-muted-foreground mt-2">Total exam items</p>
        </Card>
      </div>

      {/* Difficulty Distribution */}
      <Card className="p-4 sm:p-6 border">
        <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Difficulty Distribution
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {['Easy', 'Medium', 'Hard'].map(difficulty => {
            const count = questions.filter(q => q.difficulty === difficulty).length;
            const percentage = questions.length > 0 ? Math.round((count / questions.length) * 100) : 0;
            return (
              <div key={difficulty} className="text-center p-4 rounded-lg bg-muted/50">
                <p className="text-sm font-semibold text-foreground mb-2">{difficulty}</p>
                <p className="text-2xl font-bold text-primary">{count}</p>
                <p className="text-xs text-muted-foreground mt-1">{percentage}% of exam</p>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Questions Detail Table */}
      <Card className="p-4 sm:p-6 border">
        <h2 className="text-lg font-bold text-foreground mb-4">Question Statistics</h2>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {questions.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground font-medium">No analysis data available yet.</p>
              <p className="text-sm text-muted-foreground mt-1">Scan answer sheets to generate item analysis.</p>
            </div>
          ) : (
            questions.map(q => (
              <div key={q.questionNumber} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">Question {q.questionNumber}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">
                      Key: {q.correctAnswer}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`px-3 py-1 rounded text-xs font-semibold ${
                      q.correctRate >= 75
                        ? 'bg-green-50 text-green-700'
                        : q.correctRate >= 40
                        ? 'bg-yellow-50 text-yellow-700'
                        : 'bg-red-50 text-red-700'
                    }`}>
                      {q.correctRate}% Correct
                    </span>
                    <span className={`px-3 py-1 rounded text-xs font-semibold ${
                      q.difficulty === 'Easy' ? 'bg-green-50 text-green-700' :
                      q.difficulty === 'Medium' ? 'bg-yellow-50 text-yellow-700' :
                      'bg-red-50 text-red-700'
                    }`}>
                      {q.difficulty}
                    </span>
                  </div>
                </div>

                {/* Choice Distribution */}
                <div className="mb-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Response Distribution:</p>
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                    {Object.entries(q.choiceDistribution).map(([choice, count]) => {
                      const percentage = q.totalResponses > 0 ? (count / q.totalResponses) * 100 : 0;
                      const isCorrect = choice === q.correctAnswer;
                      return (
                        <div key={choice} className="text-center">
                          <div className={`w-full rounded-md overflow-hidden mb-1 ${isCorrect ? 'ring-2 ring-green-500' : ''}`}>
                            <div
                              className={`flex items-center justify-center transition-all ${isCorrect ? 'bg-green-200' : 'bg-primary/20'}`}
                              style={{ height: `${Math.max(40, percentage * 2)}px` }}
                            />
                          </div>
                          <p className={`text-xs font-semibold ${isCorrect ? 'text-green-700' : 'text-foreground'}`}>
                            {choice} {isCorrect ? '✓' : ''}
                          </p>
                          <p className="text-xs text-muted-foreground">{count} ({Math.round(percentage)}%)</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 text-xs">
                  <div className={`px-3 py-1 rounded ${
                    q.discrimination >= 0.4 ? 'bg-green-50' :
                    q.discrimination >= 0.2 ? 'bg-yellow-50' :
                    'bg-red-50'
                  }`}>
                    <span className="font-semibold text-muted-foreground">Discrimination: </span>
                    <span className={`font-bold ${
                      q.discrimination >= 0.4 ? 'text-green-700' :
                      q.discrimination >= 0.2 ? 'text-yellow-700' :
                      'text-red-700'
                    }`}>{q.discrimination}</span>
                  </div>
                  <div className="px-3 py-1 bg-muted rounded">
                    <span className="font-semibold text-muted-foreground">Total Responses: </span>
                    <span className="font-bold text-foreground">{q.totalResponses}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Analysis Tips */}
      <Card className="p-4 sm:p-6 border bg-blue-50 border-blue-200">
        <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-blue-600" />
          Analysis Tips
        </h3>
        <ul className="text-sm text-foreground space-y-1 ml-7">
          <li>• <strong>Correct Rate:</strong> Percentage of students who answered correctly</li>
          <li>• <strong>Difficulty:</strong> Easy (76-100%), Medium (40-75%), Hard (0-39%)</li>
          <li>• <strong>Discrimination:</strong> How well the question differentiates between high and low performers (0-1 scale)</li>
          <li>• <strong>Distribution:</strong> Visual representation of how students chose each answer</li>
        </ul>
      </Card>
    </div>
  );
}
